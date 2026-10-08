# FALHAS

| data | o que quebrou | menor correção | prompt \| infra |
|---|---|---|---|
| 2026-10-08 | Ollama `qwen3.6:35b-a3b` passou a responder "CUDA error: illegal memory access" no meio da calibração (runner caiu) | calibração aceita `--modelo`; rodada completa refeita com `qwen3:30b` (15/16) | infra |
| 2026-10-08 | Avaliador dava 0 a critérios do tipo "evitar erro" (não insistir, não aconselhar cedo) quando o erro não acontecia | regra de exceção no `prompts/avaliador.md` | prompt |
| 2026-10-08 | Playwright 1.56 procurava Chromium 1194, ausente no cache | fixado `@playwright/test@1.57.0` (Chromium 1200 já instalado) | infra |
