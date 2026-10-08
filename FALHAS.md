# FALHAS

| data | o que quebrou | menor correção | prompt \| infra |
|---|---|---|---|
| 2026-10-08 | Avaliador (qwen3:30b sem think) dava 0 a conversa boa quando o personagem falava longo; com think acertava mas levava ~50 s | saída "evidência antes da nota" (`analise: [{id, evidencia, nota}]`): 5,7 estável em ~5 s; `pensar` fica opcional no gateway | prompt |
| 2026-10-08 | Avaliador marcava "não apareceu" para critério cumprido numa fala posterior | regra: ler todas as falas, crédito para correção de rumo + falas do usuário listadas à parte | prompt |
| 2026-10-08 | Ollama `qwen3.6:35b-a3b` passou a responder "CUDA error: illegal memory access" no meio da calibração (runner caiu) | calibração aceita `--modelo`; rodada completa refeita com `qwen3:30b` (15/16) | infra |
| 2026-10-08 | Avaliador dava 0 a critérios do tipo "evitar erro" (não insistir, não aconselhar cedo) quando o erro não acontecia | regra de exceção no `prompts/avaliador.md` | prompt |
| 2026-10-08 | Playwright 1.56 procurava Chromium 1194, ausente no cache | fixado `@playwright/test@1.57.0` (Chromium 1200 já instalado) | infra |
