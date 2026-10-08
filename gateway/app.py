"""Gateway da Edição Local do Treinador de Carisma.

Contrato: CONTRATOS.md, seção 2. Serve ../treinar/ em / e expõe /api/*.
Rodar: python3 -m uvicorn app:app --app-dir gateway --host 127.0.0.1 --port 8787
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import re
import shutil
import tempfile
import time
from pathlib import Path
from typing import AsyncIterator, Optional
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from versao import VERSAO

AQUI = Path(__file__).resolve().parent
TIMEOUT_CLI = 120.0
TIMEOUT_TTS = 60.0
TIMEOUT_CHATTERBOX = 90.0
TIMEOUT_CHATTERBOX_CARGA = 600.0
CACHE_HEALTH_S = 30.0
MOTORES = ("ollama", "codex", "claude", "gemini")


# ---------------------------------------------------------------- config (lida na hora)

def ollama_url() -> str:
    return os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")


def piper_dir() -> Path:
    return Path(os.environ.get("TC_PIPER_DIR", str(Path.home() / ".local/share/piper"))).expanduser()


def static_dir() -> Path:
    return Path(os.environ.get("TC_STATIC_DIR", str(AQUI.parent / "treinar"))).expanduser()


def whisper_modelo() -> str:
    return os.environ.get("TC_WHISPER", "small")


def vozes_dir() -> Path:
    """WAVs de referência do chatterbox (um por treinador: <id>.wav). Nenhum vem no repositório."""
    return Path(os.environ.get("TC_VOZES_DIR", str(Path.home() / ".local/share/treinador-carisma/vozes"))).expanduser()


def chatterbox_py() -> Optional[str]:
    """Python do ambiente onde o chatterbox está instalado (TC_CHATTERBOX_PY). Sem ele, chatterbox fica desligado."""
    py = os.environ.get("TC_CHATTERBOX_PY", "")
    return py if py and Path(py).is_file() else None


def achar_bin(nome: str) -> Optional[str]:
    achado = shutil.which(nome)
    if achado:
        return achado
    if nome == "piper":
        local = Path.home() / ".local/bin/piper"
        if local.is_file() and os.access(local, os.X_OK):
            return str(local)
    return None


def criar_cliente_http(timeout: httpx.Timeout) -> httpx.AsyncClient:
    """Fábrica única de cliente HTTP (os testes trocam por MockTransport)."""
    return httpx.AsyncClient(timeout=timeout)


class GatewayErro(Exception):
    def __init__(self, status: int, msg: str):
        super().__init__(msg)
        self.status = status
        self.msg = msg


def erro(status: int, msg: str) -> JSONResponse:
    return JSONResponse({"erro": msg}, status_code=status)


# ---------------------------------------------------------------- locks

_locks: dict = {}


def lock_de(nome: str) -> asyncio.Lock:
    """Um lock por motor (e um para STT), recriado se o event loop mudar."""
    loop = asyncio.get_running_loop()
    chave = (id(loop), nome)
    if chave not in _locks:
        _locks[chave] = asyncio.Lock()
    return _locks[chave]


# ---------------------------------------------------------------- health

_cache_health: dict = {"t": 0.0, "dados": None}


def limpar_cache() -> None:
    _cache_health["t"] = 0.0
    _cache_health["dados"] = None


async def detectar_ollama() -> dict:
    try:
        async with criar_cliente_http(httpx.Timeout(1.5, connect=1.0)) as c:
            r = await c.get(f"{ollama_url()}/api/tags")
            r.raise_for_status()
            modelos = [m.get("name") or m.get("model") for m in r.json().get("models", [])]
            return {"ok": True, "modelos": [m for m in modelos if m]}
    except Exception:
        return {"ok": False, "modelos": []}


async def detectar_codex() -> dict:
    exe = achar_bin("codex")
    if not exe:
        return {"ok": False}
    try:
        proc = await asyncio.create_subprocess_exec(
            exe, "login", "status",
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), 2.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return {"ok": False}
        return {"ok": "Logged in" in out.decode("utf-8", "replace")}
    except Exception:
        return {"ok": False}


async def detectar_bin(nome: str) -> dict:
    return {"ok": achar_bin(nome) is not None}


def _tem(modulo: str) -> bool:
    try:
        return importlib.util.find_spec(modulo) is not None
    except (ImportError, ValueError):
        return False


def _cuda() -> bool:
    if not _tem("torch"):
        return False
    try:
        import torch
        return bool(torch.cuda.is_available())
    except Exception:
        return False


def escolher_stt() -> Optional[str]:
    """TC_STT=whisper|faster_whisper força; auto: whisper na GPU, senão faster-whisper (CPU), senão whisper."""
    pedido = os.environ.get("TC_STT", "auto")
    if pedido in ("whisper", "faster_whisper"):
        return pedido if _tem(pedido) else None
    if _tem("whisper") and _cuda():
        return "whisper"
    if _tem("faster_whisper"):
        return "faster_whisper"
    if _tem("whisper"):
        return "whisper"
    return None


def detectar_stt() -> dict:
    engine = escolher_stt()
    return {"ok": engine is not None, "engine": engine}


def listar_vozes() -> list:
    d = piper_dir()
    if not d.is_dir():
        return []
    return sorted(p.stem for p in d.glob("*.onnx"))


KOKORO_VOZES = ["pf_dora", "pm_alex", "pm_santa"]  # português do Brasil no Kokoro-82M


def refs_chatterbox() -> list:
    d = vozes_dir()
    return sorted(p.stem for p in d.glob("*.wav")) if d.is_dir() else []


def detectar_tts() -> dict:
    vozes = listar_vozes()
    piper_ok = (achar_bin("piper") is not None or _tem("piper")) and bool(vozes)
    kokoro_ok = _tem("kokoro")
    cb_ok = chatterbox_py() is not None and bool(refs_chatterbox())
    engines = {
        "piper": {"ok": piper_ok, "vozes": vozes},
        "kokoro": {"ok": kokoro_ok, "vozes": KOKORO_VOZES if kokoro_ok else []},
        "chatterbox": {"ok": cb_ok, "vozes": refs_chatterbox() if cb_ok else []},
    }
    principal = "kokoro" if kokoro_ok else ("piper" if piper_ok else None)
    return {"ok": principal is not None, "engine": principal, "vozes": vozes, "engines": engines}


async def _com_teto(coro, padrao: dict, teto: float) -> dict:
    try:
        return await asyncio.wait_for(coro, teto)
    except Exception:
        return padrao


async def montar_health() -> dict:
    agora = time.monotonic()
    if _cache_health["dados"] is not None and agora - _cache_health["t"] < CACHE_HEALTH_S:
        return _cache_health["dados"]
    teto = 2.5
    ollama, codex, claude, gemini = await asyncio.gather(
        _com_teto(detectar_ollama(), {"ok": False, "modelos": []}, teto),
        _com_teto(detectar_codex(), {"ok": False}, teto),
        _com_teto(detectar_bin("claude"), {"ok": False}, teto),
        _com_teto(detectar_bin("gemini"), {"ok": False}, teto),
    )
    dados = {
        "ok": True,
        "versao": VERSAO,
        "edicao": "local",
        "motores": {"ollama": ollama, "codex": codex, "claude": claude, "gemini": gemini},
        "stt": detectar_stt(),
        "tts": detectar_tts(),
    }
    _cache_health["t"] = agora
    _cache_health["dados"] = dados
    return dados


# ---------------------------------------------------------------- chat

class Mensagem(BaseModel):
    role: str
    content: str


class PedidoChat(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    motor: str
    modelo: Optional[str] = None
    mensagens: list[Mensagem]
    json_: bool = Field(False, alias="json")
    temperatura: float = 0.7
    pensar: bool = False  # ollama: liga o raciocínio (think) — usado pelo avaliador


ROTULOS = {"system": "[SISTEMA]", "user": "[USUÁRIO]", "assistant": "[ASSISTENTE]"}


def montar_prompt(pedido: PedidoChat) -> str:
    partes = []
    for m in pedido.mensagens:
        partes.append(f"{ROTULOS.get(m.role, '[' + m.role.upper() + ']')}\n{m.content.strip()}")
    partes.append(
        "Responda apenas com a próxima fala do [ASSISTENTE], sem rótulos, sem explicações "
        "e sem usar ferramentas."
    )
    if pedido.json_:
        partes.append("Responda SOMENTE com um objeto JSON válido.")
    return "\n\n".join(partes) + "\n"


async def gerar_ollama(pedido: PedidoChat) -> AsyncIterator[str]:
    async with lock_de("ollama"):
        modelo = pedido.modelo or os.environ.get("TC_OLLAMA_MODELO")
        try:
            async with criar_cliente_http(httpx.Timeout(300.0, connect=5.0)) as c:
                if not modelo:
                    r = await c.get(f"{ollama_url()}/api/tags")
                    nomes = [m.get("name") for m in r.json().get("models", []) if m.get("name")]
                    if not nomes:
                        raise GatewayErro(503, "ollama sem modelos instalados")
                    modelo = nomes[0]
                corpo = {
                    "model": modelo,
                    "messages": [m.model_dump() for m in pedido.mensagens],
                    "stream": True,
                    "think": pedido.pensar,
                    # mantém o modelo carregado entre as falas (recarregar custa segundos)
                    "keep_alive": os.environ.get("TC_OLLAMA_KEEP_ALIVE", "30m"),
                    "options": {"temperature": pedido.temperatura},
                }
                if pedido.json_:
                    corpo["format"] = "json"
                async with c.stream("POST", f"{ollama_url()}/api/chat", json=corpo) as r:
                    if r.status_code != 200:
                        texto = (await r.aread()).decode("utf-8", "replace")[:300]
                        raise GatewayErro(502, f"ollama HTTP {r.status_code}: {texto}")
                    async for linha in r.aiter_lines():
                        linha = linha.strip()
                        if not linha:
                            continue
                        try:
                            obj = json.loads(linha)
                        except ValueError:
                            continue
                        if obj.get("error"):
                            raise GatewayErro(502, f"ollama: {obj['error']}")
                        pedaco = (obj.get("message") or {}).get("content") or ""
                        if pedaco:
                            yield pedaco
                        if obj.get("done"):
                            break
        except httpx.ConnectError:
            raise GatewayErro(503, f"ollama indisponível em {ollama_url()}")
        except httpx.TimeoutException:
            raise GatewayErro(504, "ollama: tempo esgotado")


async def rodar_cli(nome: str, args: list, entrada: Optional[str], cwd: str) -> str:
    """Roda um CLI com stdin fechado (após enviar a entrada), timeout de 120 s."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=cwd,
            stdin=asyncio.subprocess.PIPE if entrada is not None else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        raise GatewayErro(503, f"{nome} não encontrado")
    try:
        out, err = await asyncio.wait_for(
            proc.communicate(entrada.encode("utf-8") if entrada is not None else None), TIMEOUT_CLI
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise GatewayErro(504, f"{nome}: tempo esgotado ({int(TIMEOUT_CLI)} s)")
    if proc.returncode != 0:
        detalhe = (err or out).decode("utf-8", "replace").strip()[-400:]
        raise GatewayErro(502, f"{nome} saiu com código {proc.returncode}: {detalhe}")
    return out.decode("utf-8", "replace")


async def gerar_codex(pedido: PedidoChat) -> AsyncIterator[str]:
    exe = achar_bin("codex")
    if not exe:
        raise GatewayErro(503, "codex indisponível (binário não encontrado)")
    async with lock_de("codex"):
        with tempfile.TemporaryDirectory(prefix="tc-codex-cwd-") as cwd, \
                tempfile.TemporaryDirectory(prefix="tc-codex-out-") as saida:
            arq = Path(saida) / "out.txt"
            args = [exe, "exec", "-s", "read-only", "--skip-git-repo-check", "--ephemeral",
                    "--color", "never", "-o", str(arq)]
            if pedido.modelo:
                args += ["-m", pedido.modelo]
            args.append("-")
            await rodar_cli("codex", args, montar_prompt(pedido), cwd)
            texto = arq.read_text("utf-8", "replace").strip() if arq.exists() else ""
    if not texto:
        raise GatewayErro(502, "codex não devolveu resposta")
    yield texto


async def gerar_claude(pedido: PedidoChat) -> AsyncIterator[str]:
    exe = achar_bin("claude")
    if not exe:
        raise GatewayErro(503, "claude indisponível (binário não encontrado)")
    async with lock_de("claude"):
        with tempfile.TemporaryDirectory(prefix="tc-claude-") as cwd:
            # --tools "" desliga todas as ferramentas; sem MCP e sem salvar sessão.
            args = [exe, "-p", "--output-format", "text", "--tools", "",
                    "--strict-mcp-config", "--no-session-persistence"]
            if pedido.modelo:
                args += ["--model", pedido.modelo]
            texto = (await rodar_cli("claude", args, montar_prompt(pedido), cwd)).strip()
    if not texto:
        raise GatewayErro(502, "claude não devolveu resposta")
    yield texto


async def gerar_gemini(pedido: PedidoChat) -> AsyncIterator[str]:
    exe = achar_bin("gemini")
    if not exe:
        raise GatewayErro(503, "gemini indisponível (binário não encontrado)")
    async with lock_de("gemini"):
        with tempfile.TemporaryDirectory(prefix="tc-gemini-") as cwd:
            args = [exe, "-p", montar_prompt(pedido)]
            if pedido.modelo:
                args += ["-m", pedido.modelo]
            texto = (await rodar_cli("gemini", args, None, cwd)).strip()
    if not texto:
        raise GatewayErro(502, "gemini não devolveu resposta")
    yield texto


GERADORES = {"ollama": gerar_ollama, "codex": gerar_codex, "claude": gerar_claude, "gemini": gerar_gemini}


# ---------------------------------------------------------------- STT

_stt: dict = {"engine": None, "modelo": None}


def _carregar_stt():
    if _stt["modelo"] is not None:
        return _stt["engine"], _stt["modelo"]
    nome = whisper_modelo()
    engine = escolher_stt()
    if engine == "whisper":
        import whisper
        _stt["modelo"] = whisper.load_model(nome, device="cuda" if _cuda() else "cpu")
    elif engine == "faster_whisper":
        from faster_whisper import WhisperModel
        _stt["modelo"] = WhisperModel(nome, device="auto", compute_type="int8")
    else:
        raise GatewayErro(503, "nenhum motor de STT instalado (faster_whisper ou whisper)")
    _stt["engine"] = engine
    return _stt["engine"], _stt["modelo"]


def _ler_audio(wav: str):
    """WAV 16 kHz mono → float32 (passar array evita o decodificador de áudio de cada engine)."""
    import numpy as np
    import wave
    with wave.open(wav, "rb") as w:
        dados = w.readframes(w.getnframes())
    return np.frombuffer(dados, dtype=np.int16).astype(np.float32) / 32768.0


# Frases que o Whisper costuma inventar em silêncio/ruído (legendas de vídeos do treino dele).
ALUCINACOES = re.compile(
    r"^\W*(obrigad[oa]( por assistir)?|tchau|legendas? (pela|por) .*|amara\.org.*|inscreva-se.*|"
    r"\.\.\.|hum+|ah+)\W*$", re.IGNORECASE)


def limpar_transcricao(texto: str, rms: float) -> str:
    """Áudio quase mudo ou frase típica de alucinação vira texto vazio."""
    if rms < 0.004:
        return ""
    return "" if ALUCINACOES.match(texto.strip()) else texto.strip()


def _transcrever(wav: str, com_palavras: bool = True) -> dict:
    engine, modelo = _carregar_stt()
    audio = _ler_audio(wav)
    rms = float((audio ** 2).mean() ** 0.5) if len(audio) else 0.0
    palavras = []
    if engine == "faster_whisper":
        segmentos, _info = modelo.transcribe(audio, language="pt", word_timestamps=com_palavras, beam_size=1)
        textos = []
        for s in segmentos:
            if s.no_speech_prob > 0.6 and s.avg_logprob < -1.0:
                continue
            textos.append(s.text.strip())
            for w in (s.words or []):
                palavras.append({"w": w.word.strip(), "ini": round(w.start, 2), "fim": round(w.end, 2)})
        texto = " ".join(t for t in textos if t)
    else:
        r = modelo.transcribe(audio, language="pt", word_timestamps=com_palavras, fp16=_cuda(),
                              condition_on_previous_text=False)
        segs = [s for s in r.get("segments", []) if not (s.get("no_speech_prob", 0) > 0.6 and s.get("avg_logprob", 0) < -1.0)]
        texto = " ".join(s["text"].strip() for s in segs).strip()
        for s in segs:
            for w in s.get("words", []) or []:
                palavras.append({"w": w["word"].strip(), "ini": round(w["start"], 2), "fim": round(w["end"], 2)})
    texto = limpar_transcricao(texto, rms)
    return {"texto": texto, "palavras": palavras if texto else [], "duracao_audio": round(len(audio) / 16000, 2)}


async def converter_wav(origem: str, destino: str) -> None:
    ffmpeg = achar_bin("ffmpeg")
    if not ffmpeg:
        raise GatewayErro(503, "ffmpeg não encontrado")
    proc = await asyncio.create_subprocess_exec(
        ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", origem, "-ar", "16000", "-ac", "1", "-f", "wav", destino,
        stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, err = await asyncio.wait_for(proc.communicate(), 60)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise GatewayErro(504, "ffmpeg: tempo esgotado")
    if proc.returncode != 0:
        raise GatewayErro(400, f"áudio inválido: {err.decode('utf-8', 'replace').strip()[-200:]}")


# ---------------------------------------------------------------- TTS

RE_VOZ = re.compile(r"^[A-Za-z0-9_.\-]+$")
ENGINES_TTS = ("piper", "kokoro", "chatterbox")


class PedidoTTS(BaseModel):
    texto: str
    # "<engine>:<voz>" (ex.: "kokoro:pf_dora") ou só o nome de uma voz do piper
    voz: str = "pt_BR-faber-medium"
    velocidade: float = Field(1.0, ge=0.5, le=2.0)


def separar_voz(voz: str) -> tuple:
    engine, _, nome = voz.partition(":") if ":" in voz else ("piper", "", voz)
    if engine not in ENGINES_TTS or not RE_VOZ.match(nome or ""):
        raise GatewayErro(400, "voz inválida")
    return engine, nome


def wav_bytes(amostras, taxa: int) -> bytes:
    """float32 (-1..1) → WAV PCM 16 bits mono."""
    import io
    import wave

    import numpy as np
    pcm = (np.clip(amostras, -1.0, 1.0) * 32767).astype(np.int16).tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(taxa)
        w.writeframes(pcm)
    return buf.getvalue()


_piper_vozes: dict = {}
_kokoro: dict = {}


def _sintetizar_piper(nome: str, texto: str, velocidade: float) -> bytes:
    """Piper carregado na memória (uma frase em ~0,1-0,25 s)."""
    import io
    import wave

    from piper import PiperVoice, SynthesisConfig
    modelo = piper_dir() / f"{nome}.onnx"
    if not modelo.is_file():
        raise GatewayErro(503, f"voz do piper ausente: {nome}")
    if nome not in _piper_vozes:
        _piper_vozes[nome] = PiperVoice.load(str(modelo))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        _piper_vozes[nome].synthesize_wav(texto, w, syn_config=SynthesisConfig(length_scale=1.0 / velocidade))
    return buf.getvalue()


def _sintetizar_kokoro(nome: str, texto: str, velocidade: float) -> bytes:
    import numpy as np
    if nome not in KOKORO_VOZES:
        raise GatewayErro(400, f"voz do kokoro inválida: {nome}")
    if "pipe" not in _kokoro:
        from kokoro import KPipeline
        _kokoro["pipe"] = KPipeline(lang_code="p", repo_id="hexgrad/Kokoro-82M", device="cuda" if _cuda() else "cpu")
    partes = [a.numpy() if hasattr(a, "numpy") else a for _, _, a in _kokoro["pipe"](texto, voice=nome, speed=velocidade)]
    if not partes:
        raise GatewayErro(502, "kokoro não gerou áudio")
    return wav_bytes(np.concatenate(partes), 24000)


class Chatterbox:
    """Processo persistente no ambiente do chatterbox (modelo carregado uma vez). Uma frase por vez."""

    def __init__(self):
        self.proc = None
        self.pronto = False  # a 1ª frase inclui carregar o modelo: espera mais

    async def garantir(self):
        if self.proc and self.proc.returncode is None:
            return
        py = chatterbox_py()
        if not py:
            raise GatewayErro(503, "chatterbox desligado (defina TC_CHATTERBOX_PY)")
        self.pronto = False
        self.proc = await asyncio.create_subprocess_exec(
            py, str(AQUI / "chatterbox_worker.py"),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, limit=1 << 20,
        )

    async def falar(self, ref: Path, texto: str, saida: Path) -> None:
        await self.garantir()
        pedido = json.dumps({"texto": texto, "ref": str(ref), "saida": str(saida)}, ensure_ascii=False) + "\n"
        self.proc.stdin.write(pedido.encode("utf-8"))
        await self.proc.stdin.drain()
        try:
            teto = TIMEOUT_CHATTERBOX if self.pronto else TIMEOUT_CHATTERBOX_CARGA
            linha = await asyncio.wait_for(self.proc.stdout.readline(), teto)
        except asyncio.TimeoutError:
            self.proc.kill()
            raise GatewayErro(504, "chatterbox: tempo esgotado")
        if not linha:
            raise GatewayErro(502, "chatterbox encerrou")
        r = json.loads(linha)
        self.pronto = True
        if not r.get("ok"):
            raise GatewayErro(502, f"chatterbox: {r.get('erro', 'falhou')}")


_chatterbox = Chatterbox()


async def sintetizar(engine: str, nome: str, texto: str, velocidade: float) -> bytes:
    if engine == "kokoro":
        if not _tem("kokoro"):
            raise GatewayErro(503, "kokoro não instalado")
        async with lock_de("tts-kokoro"):
            return await run_in_threadpool(_sintetizar_kokoro, nome, texto, velocidade)
    if engine == "chatterbox":
        ref = vozes_dir() / f"{nome}.wav"
        if not ref.is_file():
            raise GatewayErro(503, f"sem voz de referência para {nome}")
        with tempfile.TemporaryDirectory(prefix="tc-cb-") as d:
            saida = Path(d) / "fala.wav"
            async with lock_de("tts-chatterbox"):
                await _chatterbox.falar(ref, texto, saida)
            return saida.read_bytes()
    # piper: na memória quando o módulo existe, senão o binário
    if _tem("piper"):
        async with lock_de("tts-piper"):
            return await run_in_threadpool(_sintetizar_piper, nome, texto, velocidade)
    piper = achar_bin("piper")
    modelo = piper_dir() / f"{nome}.onnx"
    if not piper or not modelo.is_file():
        raise GatewayErro(503, "piper ou voz indisponível")
    with tempfile.TemporaryDirectory(prefix="tc-tts-") as d:
        saida = Path(d) / "fala.wav"
        await rodar_tts(piper, modelo, texto, saida, d)
        if not saida.is_file() or saida.stat().st_size == 0:
            raise GatewayErro(502, "piper não gerou áudio")
        return saida.read_bytes()


def aquecer() -> None:
    """Carrega STT e vozes antes do primeiro uso (TC_AQUECER=1), para a 1ª fala não pagar o carregamento."""
    try:
        if escolher_stt():
            _carregar_stt()
        if _tem("kokoro"):
            for v in KOKORO_VOZES:
                _sintetizar_kokoro(v, "Olá.", 1.0)
        if _tem("piper"):
            for v in listar_vozes():
                _sintetizar_piper(v, "Olá.", 1.0)
    except Exception as e:  # aquecimento nunca derruba o gateway
        print(f"[gateway] aquecimento incompleto: {e}", flush=True)


# ---------------------------------------------------------------- app

app = FastAPI(title="Treinador de Carisma — gateway local", version=VERSAO,
              docs_url=None, redoc_url=None, openapi_url=None)


@app.on_event("startup")
async def ao_iniciar():
    if os.environ.get("TC_AQUECER") == "1":
        asyncio.get_running_loop().run_in_executor(None, aquecer)


@app.middleware("http")
async def mesma_origem(request: Request, call_next):
    """Sem CORS: só a própria origem. Pedido com Origin de outro host leva 403."""
    origem = request.headers.get("origin")
    if origem and request.url.path.startswith("/api/"):
        host = request.headers.get("host", "")
        if urlsplit(origem).netloc != host:
            return erro(403, "origem não permitida")
    return await call_next(request)


@app.get("/api/health")
async def health():
    return await montar_health()


@app.post("/api/chat")
async def chat(pedido: PedidoChat):
    if pedido.motor not in GERADORES:
        return erro(400, f"motor inválido: {pedido.motor} (use {', '.join(MOTORES)})")
    if not pedido.mensagens:
        return erro(400, "mensagens vazias")
    gen = GERADORES[pedido.motor](pedido)
    try:
        primeiro = await gen.__anext__()
    except StopAsyncIteration:
        primeiro = None
    except GatewayErro as e:
        return erro(e.status, e.msg)

    async def corpo():
        try:
            if primeiro is not None:
                yield primeiro
            async for pedaco in gen:
                yield pedaco
        except GatewayErro:
            return  # status já enviado; encerra o stream
        finally:
            await gen.aclose()  # cliente caiu: libera o lock do motor na hora

    return StreamingResponse(corpo(), media_type="text/plain; charset=utf-8")


@app.post("/api/stt")
async def stt(audio: UploadFile = File(...), palavras: bool = Form(True)):
    if not detectar_stt()["ok"]:
        return erro(503, "nenhum motor de STT instalado (faster_whisper ou whisper)")
    with tempfile.TemporaryDirectory(prefix="tc-stt-") as d:
        origem = str(Path(d) / "entrada")
        destino = str(Path(d) / "audio.wav")
        Path(origem).write_bytes(await audio.read())
        try:
            await converter_wav(origem, destino)
            async with lock_de("stt"):
                resultado = await run_in_threadpool(_transcrever, destino, palavras)
        except GatewayErro as e:
            return erro(e.status, e.msg)
    return resultado


@app.post("/api/tts")
async def tts(pedido: PedidoTTS):
    texto = pedido.texto.strip()
    if not texto:
        return erro(400, "texto vazio")
    try:
        engine, nome = separar_voz(pedido.voz)
        dados = await sintetizar(engine, nome, texto, pedido.velocidade)
    except GatewayErro as e:
        return erro(e.status, e.msg)
    return Response(dados, media_type="audio/wav")


async def rodar_tts(piper: str, modelo: Path, texto: str, saida: Path, cwd: str) -> None:
    proc = await asyncio.create_subprocess_exec(
        piper, "-m", str(modelo), "-f", str(saida), cwd=cwd,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, err = await asyncio.wait_for(proc.communicate(texto.encode("utf-8")), TIMEOUT_TTS)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise GatewayErro(504, "piper: tempo esgotado")
    if proc.returncode != 0:
        raise GatewayErro(502, f"piper falhou: {err.decode('utf-8', 'replace').strip()[-200:]}")


PAGINA_SEM_BUILD = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Treinador de Carisma</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;
background:#111;color:#eee}code{background:#222;padding:.1rem .3rem;border-radius:4px}</style>
</head><body>
<h1>Treinador de Carisma — gateway local</h1>
<p>O gateway está no ar (versão {versao}), mas a interface ainda não foi gerada.</p>
<p>Rode o build do front: <code>cd app &amp;&amp; npm install &amp;&amp; npm run build</code>
(gera a pasta <code>treinar/</code>) e recarregue esta página.</p>
<p>Diagnóstico: <a href="/api/health" style="color:#fb3">/api/health</a></p>
</body></html>"""


@app.api_route("/api/{resto:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def api_inexistente(resto: str):
    return erro(404, f"rota inexistente: /api/{resto}")


@app.get("/{caminho:path}")
async def estatico(caminho: str):
    raiz = static_dir()
    if not raiz.is_dir():
        return HTMLResponse(PAGINA_SEM_BUILD.replace("{versao}", VERSAO))
    raiz = raiz.resolve()
    alvo = (raiz / caminho).resolve()
    if alvo != raiz and raiz not in alvo.parents:
        return erro(404, "não encontrado")
    if alvo.is_dir():
        alvo = alvo / "index.html"
    if alvo.is_file():
        return FileResponse(alvo)
    indice = raiz / "index.html"
    if indice.is_file():
        return FileResponse(indice)
    return HTMLResponse(PAGINA_SEM_BUILD.replace("{versao}", VERSAO))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("TC_HOST", "127.0.0.1"),
                port=int(os.environ.get("TC_PORTA", "8787")))
