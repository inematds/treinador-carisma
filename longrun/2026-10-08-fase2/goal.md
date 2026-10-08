# Goal — fase2 (Conversa natural)

- **Início:** 2026-10-08 12:11 · **Agente:** Claude (sessão interativa)
- **Tetos:** tempo 6 h · memória: gateway em `systemd-run --user --scope -p MemoryMax=12G`

## Resultado
Treinador de Carisma 1.1.0: conversa por voz contínua nas duas edições (mãos-livres, interrupção, pausa automática, voz em streaming por frase, métricas de fala), Fases 3 e 4 só no roadmap.

## Critérios de pronto (verificáveis)

**Função**
- [ ] `cd app && npx vitest run` → verde, ≥ 40 testes (os 28 da fase 1 + leitor de "fala" parcial, divisor de frases, VAD, pausa automática, métricas de voz)
- [ ] `cd app && npx playwright test` → ≥ 4 testes verdes, incluindo o fluxo mãos-livres com `?motor=fake` e áudio falso do Chromium (fala → resposta em streaming → nova escuta → pausa)
- [ ] `cd gateway && .venv/bin/python -m pytest -q` → verde, ≥ 25 testes (inclui TTS por voz/engine e STT por array)
- [ ] `npx vite-node scripts/latencia.ts -- --gateway http://127.0.0.1:8797 --modelo qwen3:30b --rodadas 8` → imprime p50 e p95 de (STT + 1ª frase do modelo + TTS da 1ª frase); **p50 < 1500 ms**
- [ ] sessão real (gateway + Ollama + áudio falso no Chromium, mãos-livres) gravada em `longrun/2026-10-08-fase2/evidencias/` com a latência medida no navegador

**Regressão**
- [ ] `npx vite-node scripts/calibrar.ts -- --gateway http://127.0.0.1:8797 --motor ollama --modelo qwen3:30b` → ≥ 14/16
- [ ] `node app/scripts/validar-cenas.mjs` → "16 cenas OK"
- [ ] `npm run build` sem erro; `treinar/` atualizado

**Limite**
- [ ] nenhuma chamada a API paga; realtime de provedor e login/plano no Vercel ficam fora (roadmap)
- [ ] nenhuma voz de referência no repo (chatterbox só com WAV do próprio usuário); vozes Kokoro/Piper baixadas na instalação
- [ ] 5º treinador (voz/avatar do Nei) não criado

**Teste rápido por ciclo**: `cd app && npx vitest run`
**Teste completo no final**: vitest + playwright + pytest + latência + calibração + validar-cenas

## Restrições
- só pela assinatura ou local (sem API sem autorização)
- não mexer em: outros repos além de treinador-carisma e, no fim, portal via atualiza-portal

## Portões humanos (parar e perguntar)
- gasto de crédito / API / render pago
- decisão de negócio ou conflito entre requisitos
- (push do repo e do portal: AUTORIZADO em 08/10 "faca o 2 e deixa o 3,4 em roadmap")
