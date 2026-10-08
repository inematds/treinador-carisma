#!/usr/bin/env bash
# Treinador de Carisma — Edição Local (Linux/macOS).
# Uso: deploy/iniciar.sh            (porta 8787, só nesta máquina)
#      TC_PORTA=8790 deploy/iniciar.sh
#      TC_HOST=0.0.0.0 deploy/iniciar.sh   (VPS / rede — cuidado: sem senha)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GW="$RAIZ/gateway"
VENV="$GW/.venv"
HOST="${TC_HOST:-127.0.0.1}"
PORTA="${TC_PORTA:-8787}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
export TC_HOST="$HOST" TC_PORTA="$PORTA" OLLAMA_URL

# 1. Python 3
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERRO: python3 não encontrado. Instale o Python 3.10+ e rode de novo." >&2
  exit 1
fi

# 2. venv + dependências
if [ ! -x "$VENV/bin/python" ]; then
  echo "> Criando ambiente virtual em gateway/.venv ..."
  python3 -m venv --system-site-packages "$VENV" || {
    echo "ERRO: não consegui criar o venv (no Ubuntu/Debian: sudo apt install python3-venv)." >&2
    exit 1
  }
fi
echo "> Instalando dependências ..."
"$VENV/bin/python" -m pip install -q --upgrade pip >/dev/null
"$VENV/bin/python" -m pip install -q -r "$GW/requirements.txt"
# Voz -> texto (opcional): reaproveita whisper já instalado no sistema; TC_INSTALAR_VOZ=1 instala o faster-whisper.
if [ "${TC_INSTALAR_VOZ:-0}" = "1" ]; then
  "$VENV/bin/python" -m pip install -q faster-whisper
fi
"$VENV/bin/python" -c "import faster_whisper" 2>/dev/null || "$VENV/bin/python" -c "import whisper" 2>/dev/null \
  || echo "  voz->texto: nenhum whisper encontrado — o microfone usa o navegador (rode com TC_INSTALAR_VOZ=1 para instalar)"

# 3. O que está disponível
echo "> Verificando motores ..."
if python3 - "$OLLAMA_URL" <<'PY' 2>/dev/null
import sys, urllib.request
urllib.request.urlopen(sys.argv[1] + "/api/tags", timeout=2).read()
PY
then
  echo "  ollama: ok ($OLLAMA_URL)"
else
  echo "  ollama: NÃO encontrado em $OLLAMA_URL — instale em https://ollama.com e rode: ollama pull llama3.2"
fi
if command -v codex >/dev/null 2>&1; then
  if codex login status 2>&1 | grep -q "Logged in"; then
    echo "  codex: ok (assinatura)"
  else
    echo "  codex: instalado, mas sem login — rode: codex login"
  fi
else
  echo "  codex: não instalado (opcional)"
fi
command -v claude >/dev/null 2>&1 && echo "  claude: ok" || echo "  claude: não instalado (opcional)"
command -v gemini >/dev/null 2>&1 && echo "  gemini: ok" || echo "  gemini: não instalado (opcional)"
command -v ffmpeg >/dev/null 2>&1 || echo "  ffmpeg: não instalado — sem ele o /api/stt (voz -> texto) não funciona"
command -v piper >/dev/null 2>&1 || [ -x "$HOME/.local/bin/piper" ] || echo "  piper: não instalado — a voz usa a do navegador"
[ -d "$RAIZ/treinar" ] || echo "  aviso: pasta treinar/ ausente — rode o build do app (cd app && npm run build)"

# 4. Porta livre? Senão, ABORTA.
ocupada=0
if command -v ss >/dev/null 2>&1; then
  ss -ltn | awk 'NR>1 {print $4}' | grep -qE "[:.]${PORTA}\$" && ocupada=1
elif command -v lsof >/dev/null 2>&1; then
  lsof -nP -iTCP:"$PORTA" -sTCP:LISTEN >/dev/null 2>&1 && ocupada=1
else
  echo "  aviso: sem ss/lsof para checar a porta; seguindo." >&2
fi
if [ "$ocupada" = 1 ]; then
  echo "ERRO: a porta $PORTA já está em uso. Escolha outra: TC_PORTA=8790 $0" >&2
  exit 1
fi

# 5. Sobe o gateway (exec: o PID deste script vira o do servidor)
URL_HOST="$HOST"; [ "$HOST" = "0.0.0.0" ] && URL_HOST="127.0.0.1"
echo
echo "Treinador de Carisma no ar: http://$URL_HOST:$PORTA/   (Ctrl+C para parar)"
echo
CMD=("$VENV/bin/python" -m uvicorn app:app --app-dir "$GW" --host "$HOST" --port "$PORTA")
if command -v systemd-run >/dev/null 2>&1 && systemd-run --user --scope -q true >/dev/null 2>&1; then
  exec systemd-run --user --scope -q -p MemoryMax=8G -- "${CMD[@]}"
fi
exec "${CMD[@]}"
