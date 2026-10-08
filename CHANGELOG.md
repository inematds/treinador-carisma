# Changelog

## 1.0.0 — 2026-10-08
- Fase 1 completa nas duas edições.
- Núcleo: treinador + personagem + avaliador, sessão com pausa, uma correção, refazer e comparação; métricas de fala; progresso local (IndexedDB) com exportar/importar.
- Modos Carisma (Executivo/Executiva) e Conquista (Homem elegante/Mulher linda; abordar mulher ou homem; ética como critério de nota).
- 16 cenas (10 Carisma + 6 Conquista) em YAML, com validador e calibração do avaliador.
- Edição Nuvem (estática): Ollama direto, WebLLM no navegador, OpenRouter (login OAuth ou chave), OpenAI, Anthropic, demonstração.
- Edição Local: gateway FastAPI com Ollama e assinaturas Codex / Claude / Gemini (CLIs), voz local (Whisper + Piper), `iniciar.sh/.bat`, Docker.
- Rostos ilustrados em SVG gerados por código (MIT).
- Avaliador: evidência antes da nota, escala explícita, crédito para correção de rumo; calibração 14/16 com qwen3:30b (~8 s por cena).
- Guia landing + guia PT/EN/ES em `guia/`, capa e banners.
