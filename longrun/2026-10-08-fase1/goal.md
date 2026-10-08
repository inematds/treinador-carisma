# Goal — fase1

- **Início:** 2026-10-08 01:22 · **Agente:** Claude (sessão interativa)
- **Tetos:** tempo 6 h · memória: gateway/serviços em `systemd-run --user --scope -p MemoryMax=8G`

## Resultado
Treinador de Carisma 1.0.0: Fase 1 completa nas duas edições (Nuvem estática + Local com gateway), publicada em inematds/treinador-carisma (Pages), com guia PT/EN/ES e card no portal.

## Critérios de pronto (verificáveis)

**Função**
- [ ] `cd app && npm test` → todos verdes, ≥ 25 testes (sessão, papéis, parse JSON, avaliador com evidência, métricas, cenas)
- [ ] `node app/scripts/validar-cenas.mjs` → "16 cenas OK" (10 carisma + 6 conquista; schema + calibração nota_3/nota_8 presentes; conquista com variantes mulher/homem)
- [ ] `cd app && npx playwright test` → fluxo e2e com `?motor=fake`: escolher modo → treinador → cena → 3 falas → pausa → correção → refazer → comparação visível
- [ ] `cd gateway && python3 -m pytest -q` → verde (health, chat ollama/codex com fakes, tts piper, stt)
- [ ] gateway real: `POST /api/chat {motor:"codex"}` devolve texto (assinatura) e `{motor:"ollama"}` devolve texto
- [ ] `python3 tests/calibracao/rodar.py --motor ollama` → nota_3 ≤ 4 e nota_8 ≥ 7 em ≥ 14/16 cenas
- [ ] `ls treinar/index.html` e app abre por HTTP sem `pageerror` (Playwright)

**Regressão**
- [ ] build `npm run build` sem erro; `treinar/` atualizado no commit

**Limite**
- [ ] nenhuma chamada a API paga (OpenAI/Anthropic/OpenRouter/Gemini API) — só fake, Ollama, Codex CLI pela assinatura
- [ ] nenhum asset com licença não comercial no repo (rostos = SVG em código)
- [ ] LICENSE MIT presente

**Teste rápido por ciclo**: `cd app && npm test`
**Teste completo no final**: npm test + playwright + pytest + calibração + validar-cenas

## Restrições
- só pela assinatura (sem API sem autorização)
- não mexer em: outros repos além de treinador-carisma e (no fim) portal via atualiza-portal

## Portões humanos (parar e perguntar)
- gasto de crédito / API / render pago
- decisão de negócio ou conflito entre requisitos
- (push do repo novo e portal: AUTORIZADO pelo usuário em 08/10 "faça o projeto e coloque no portal")
