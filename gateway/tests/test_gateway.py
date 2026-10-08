import json
import os
import stat
from pathlib import Path

import httpx
import pytest

import app as gw

MSGS = [{"role": "system", "content": "Você é o Marcos."}, {"role": "user", "content": "Oi"}]


# ---------------------------------------------------------------- health

def _motores_falsos(monkeypatch, ollama_ok=True):
    async def f_ollama():
        return {"ok": ollama_ok, "modelos": ["llama3.2:latest"] if ollama_ok else []}

    async def f_codex():
        return {"ok": True}

    async def f_bin(nome):
        return {"ok": nome == "claude"}

    monkeypatch.setattr(gw, "detectar_ollama", f_ollama)
    monkeypatch.setattr(gw, "detectar_codex", f_codex)
    monkeypatch.setattr(gw, "detectar_bin", f_bin)


def test_health_formato(cliente, monkeypatch):
    _motores_falsos(monkeypatch)
    r = cliente.get("/api/health")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True and d["versao"] == "1.0.0" and d["edicao"] == "local"
    assert d["motores"]["ollama"] == {"ok": True, "modelos": ["llama3.2:latest"]}
    assert d["motores"]["codex"] == {"ok": True}
    assert d["motores"]["claude"] == {"ok": True}
    assert d["motores"]["gemini"] == {"ok": False}
    assert set(d["stt"]) >= {"ok", "engine"}
    assert set(d["tts"]) >= {"ok", "engine", "vozes"}


def test_health_cache(cliente, monkeypatch):
    chamadas = {"n": 0}

    async def f_ollama():
        chamadas["n"] += 1
        return {"ok": True, "modelos": []}

    _motores_falsos(monkeypatch)
    monkeypatch.setattr(gw, "detectar_ollama", f_ollama)
    cliente.get("/api/health")
    cliente.get("/api/health")
    assert chamadas["n"] == 1


def test_health_motor_lento_nao_trava(cliente, monkeypatch):
    import asyncio
    import time

    async def lento():
        await asyncio.sleep(10)
        return {"ok": True}

    _motores_falsos(monkeypatch)
    monkeypatch.setattr(gw, "detectar_codex", lento)
    t = time.monotonic()
    d = cliente.get("/api/health").json()
    assert time.monotonic() - t < 3.0
    assert d["motores"]["codex"] == {"ok": False}


def test_health_ollama_fora(cliente, monkeypatch):
    def transporte(req):
        raise httpx.ConnectError("recusado", request=req)

    monkeypatch.setattr(gw, "criar_cliente_http",
                        lambda timeout: httpx.AsyncClient(transport=httpx.MockTransport(transporte)))
    d = cliente.get("/api/health").json()
    assert d["motores"]["ollama"] == {"ok": False, "modelos": []}


# ---------------------------------------------------------------- chat ollama

def _ollama_falso(monkeypatch, capturado, linhas=None, status=200):
    linhas = linhas or [
        {"message": {"content": "Olá, "}, "done": False},
        {"message": {"content": "tudo bem?"}, "done": False},
        {"message": {"content": ""}, "done": True},
    ]

    def transporte(req: httpx.Request):
        capturado["url"] = str(req.url)
        capturado["corpo"] = json.loads(req.content)
        corpo = "\n".join(json.dumps(l) for l in linhas) + "\n"
        return httpx.Response(status, content=corpo.encode())

    monkeypatch.setattr(gw, "criar_cliente_http",
                        lambda timeout: httpx.AsyncClient(transport=httpx.MockTransport(transporte)))


def test_chat_ollama_stream(cliente, monkeypatch):
    cap = {}
    _ollama_falso(monkeypatch, cap)
    r = cliente.post("/api/chat", json={"motor": "ollama", "modelo": "llama3.2:latest",
                                         "mensagens": MSGS, "json": True, "temperatura": 0.3})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    assert r.text == "Olá, tudo bem?"
    c = cap["corpo"]
    assert cap["url"].endswith("/api/chat")
    assert c["stream"] is True and c["think"] is False and c["format"] == "json"
    assert c["options"]["temperature"] == 0.3
    assert c["model"] == "llama3.2:latest"
    assert c["messages"][1] == {"role": "user", "content": "Oi"}


def test_chat_ollama_sem_json_nao_manda_format(cliente, monkeypatch):
    cap = {}
    _ollama_falso(monkeypatch, cap)
    r = cliente.post("/api/chat", json={"motor": "ollama", "modelo": "x", "mensagens": MSGS})
    assert r.status_code == 200
    assert "format" not in cap["corpo"]


def test_chat_ollama_erro_http(cliente, monkeypatch):
    _ollama_falso(monkeypatch, {}, linhas=[{"error": "model not found"}], status=404)
    r = cliente.post("/api/chat", json={"motor": "ollama", "modelo": "x", "mensagens": MSGS})
    assert r.status_code == 502
    assert "erro" in r.json()


def test_chat_ollama_indisponivel_503(cliente, monkeypatch):
    def transporte(req):
        raise httpx.ConnectError("recusado", request=req)

    monkeypatch.setattr(gw, "criar_cliente_http",
                        lambda timeout: httpx.AsyncClient(transport=httpx.MockTransport(transporte)))
    r = cliente.post("/api/chat", json={"motor": "ollama", "modelo": "x", "mensagens": MSGS})
    assert r.status_code == 503
    assert "erro" in r.json()


# ---------------------------------------------------------------- chat codex (script falso)

CODEX_FALSO = r"""#!/usr/bin/env python3
import os, sys, json
args = sys.argv[1:]
if args[:2] == ["login", "status"]:
    print("Logged in using ChatGPT"); sys.exit(0)
prompt = sys.stdin.read()
saida = args[args.index("-o") + 1]
with open(saida, "w") as f:
    f.write(json.dumps({"args": args, "cwd": os.getcwd(), "cwd_vazio": os.listdir(".") == [],
                        "prompt": prompt}))
"""


@pytest.fixture
def codex_falso(tmp_path, monkeypatch):
    b = tmp_path / "bin"
    b.mkdir()
    exe = b / "codex"
    exe.write_text(CODEX_FALSO)
    exe.chmod(exe.stat().st_mode | stat.S_IXUSR)
    monkeypatch.setenv("PATH", f"{b}{os.pathsep}{os.environ['PATH']}")
    return exe


def test_chat_codex(cliente, codex_falso):
    msgs = MSGS + [{"role": "assistant", "content": "E aí?"}, {"role": "user", "content": "Tudo"}]
    r = cliente.post("/api/chat", json={"motor": "codex", "modelo": "gpt-x", "mensagens": msgs, "json": True})
    assert r.status_code == 200, r.text
    d = json.loads(r.text)
    a = d["args"]
    assert a[:6] == ["exec", "-s", "read-only", "--skip-git-repo-check", "--ephemeral", "--color"]
    assert a[6] == "never" and a[7] == "-o"
    assert a[-3:] == ["-m", "gpt-x", "-"]
    assert d["cwd_vazio"] is True
    p = d["prompt"]
    assert "[SISTEMA]\nVocê é o Marcos." in p
    assert "[USUÁRIO]\nOi" in p and "[ASSISTENTE]\nE aí?" in p
    assert "Responda SOMENTE com um objeto JSON válido" in p


def test_health_codex_real_detector_com_falso(cliente, codex_falso):
    d = cliente.get("/api/health").json()
    assert d["motores"]["codex"] == {"ok": True}


# ---------------------------------------------------------------- 503 / 400

@pytest.mark.parametrize("motor", ["codex", "claude", "gemini"])
def test_cli_indisponivel_503(cliente, monkeypatch, motor):
    monkeypatch.setattr(gw, "achar_bin", lambda nome: None)
    r = cliente.post("/api/chat", json={"motor": motor, "mensagens": MSGS})
    assert r.status_code == 503
    assert motor in r.json()["erro"]


def test_motor_invalido_400(cliente):
    r = cliente.post("/api/chat", json={"motor": "openai", "mensagens": MSGS})
    assert r.status_code == 400
    assert "erro" in r.json()


def test_origem_estranha_403(cliente):
    r = cliente.post("/api/chat", json={"motor": "ollama", "mensagens": MSGS},
                     headers={"Origin": "https://malicioso.example"})
    assert r.status_code == 403


def test_stt_sem_engine_503(cliente, monkeypatch):
    monkeypatch.setattr(gw, "detectar_stt", lambda: {"ok": False, "engine": None})
    r = cliente.post("/api/stt", files={"audio": ("a.wav", b"RIFF", "audio/wav")})
    assert r.status_code == 503


# ---------------------------------------------------------------- TTS

def test_tts_voz_invalida(cliente):
    r = cliente.post("/api/tts", json={"texto": "oi", "voz": "../../etc/passwd"})
    assert r.status_code == 400


def test_tts_indisponivel_503(cliente, monkeypatch, tmp_path):
    monkeypatch.setenv("TC_PIPER_DIR", str(tmp_path))
    r = cliente.post("/api/tts", json={"texto": "oi"})
    assert r.status_code == 503


VOZ = Path(os.environ.get("TC_PIPER_DIR", str(Path.home() / ".local/share/piper"))) / "pt_BR-faber-medium.onnx"


@pytest.mark.skipif(gw.achar_bin("piper") is None or not VOZ.is_file(), reason="piper/voz ausente")
def test_tts_piper_real(cliente):
    r = cliente.post("/api/tts", json={"texto": "Olá, tudo bem?", "voz": "pt_BR-faber-medium"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    assert r.content[:4] == b"RIFF" and len(r.content) > 1000


# ---------------------------------------------------------------- estático

def test_estatico_sem_build(cliente, monkeypatch, tmp_path):
    monkeypatch.setenv("TC_STATIC_DIR", str(tmp_path / "nao-existe"))
    r = cliente.get("/")
    assert r.status_code == 200 and "build" in r.text


def test_estatico_fallback_index(cliente, monkeypatch, tmp_path):
    (tmp_path / "index.html").write_text("<p>APP</p>")
    (tmp_path / "a.js").write_text("console.log(1)")
    monkeypatch.setenv("TC_STATIC_DIR", str(tmp_path))
    assert cliente.get("/").text == "<p>APP</p>"
    assert cliente.get("/a.js").text == "console.log(1)"
    assert cliente.get("/rota/qualquer").text == "<p>APP</p>"
    assert cliente.get("/api/nada").status_code == 404


# ---------------------------------------------------------------- STT real (opcional: TC_TESTE_STT=1)

@pytest.mark.skipif(os.environ.get("TC_TESTE_STT") != "1" or not VOZ.is_file()
                    or gw.achar_bin("piper") is None, reason="STT real só com TC_TESTE_STT=1")
def test_stt_real_ida_e_volta(cliente):
    wav = cliente.post("/api/tts", json={"texto": "Bom dia, tudo bem com você?"}).content
    r = cliente.post("/api/stt", files={"audio": ("fala.wav", wav, "audio/wav")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "tudo bem" in d["texto"].lower()
    assert d["palavras"] and {"w", "ini", "fim"} <= set(d["palavras"][0])
