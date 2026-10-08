# Progresso (só acrescentar)

| data/hora | checkpoint | commit | critério atingido? | tokens in/cached/out | compactações |
|---|---|---|---|---|---|
- 12:15 medições: whisper small GPU 0,3 s; faster-whisper CPU 1,3 s; piper na memória 0,1-0,25 s; kokoro 0,07 s aquecido (voz feminina pt OK)
- 12:20 latência 1ª: p50 1868 (STT inteira) → trechos + sem palavras: p50 766
- 12:30 front: fluxo.ts, vad.ts, microfone.ts, falante.ts, vozes.ts, Sessao.falarStream, pausa automática, métricas
- 12:35 e2e mãos-livres e interrupção verdes (bugs: motor recriado ao mudar config; geração "ativa" durante a voz)
- 12:45 prompt do personagem: contexto marcado como do usuário + "VOCÊ (Nome)"; calibração 15/16
- 12:55 docs, versão 1.1.0, evidências
