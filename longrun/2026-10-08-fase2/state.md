# Estado — fase2 (08/10/2026 12:55)

**Concluída (v1.1.0).** Critérios do `goal.md`:
- [x] vitest → 51 passed (≥ 40)
- [x] playwright → 4 fake + 2 com gateway (mãos-livres, interrupção) verdes; + sessão real gravada (`sessao-real`)
- [x] pytest gateway → 41 passed, 1 skipped (≥ 25); STT real ida e volta (TC_TESTE_STT=1) passou
- [x] latencia.ts 16 rodadas → p50 1336 ms < 1500 (sem a espera de silêncio; ver evidencias/README.md)
- [x] sessão real gravada → evidencias/sessao-real.json (+ vídeo local)
- [x] calibração → 15/16 (≥ 14)
- [x] validar-cenas → 16 cenas OK
- [x] build ok, treinar/ atualizado
- [x] nenhuma API paga; realtime de provedor e login/plano Vercel → roadmap
- [x] nenhuma voz de referência no repo
- [x] 5º treinador não criado

Pendências conhecidas: personagem qwen3:30b ainda troca de lado ~2/8 na feedback-atraso (R14); outro processo descarrega o Ollama (LIMITES); WebLLM/Nuvem mãos-livres não testado em navegador real (só lógica e headless).
