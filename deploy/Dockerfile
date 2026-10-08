# Treinador de Carisma — gateway da Edição Local em contêiner.
# Contexto de build = raiz do repositório:  docker build -f deploy/Dockerfile .
# Só o motor "ollama" funciona aqui: codex/claude/gemini (assinatura) vivem
# no PC do usuário e não entram no contêiner.
# A pasta treinar/ (build do front) é montada como volume pelo docker-compose.
FROM python:3.12-slim

ARG COM_VOZ=0
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    TC_HOST=0.0.0.0 TC_PORTA=8787 \
    TC_STATIC_DIR=/app/treinar TC_PIPER_DIR=/app/piper

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY gateway/requirements.txt gateway/requirements.txt
RUN pip install --no-cache-dir -r gateway/requirements.txt

# Voz opcional (piper + voz pt_BR-faber-medium): docker build --build-arg COM_VOZ=1 ...
RUN if [ "$COM_VOZ" = "1" ]; then \
      pip install --no-cache-dir piper-tts && mkdir -p /app/piper && \
      base=https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium && \
      curl -fsSL -o /app/piper/pt_BR-faber-medium.onnx "$base/pt_BR-faber-medium.onnx" && \
      curl -fsSL -o /app/piper/pt_BR-faber-medium.onnx.json "$base/pt_BR-faber-medium.onnx.json"; \
    fi

COPY gateway/ gateway/

EXPOSE 8787
CMD ["sh", "-c", "python -m uvicorn app:app --app-dir /app/gateway --host $TC_HOST --port $TC_PORTA"]
