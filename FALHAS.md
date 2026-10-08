# FALHAS

| data | o que quebrou | menor correção | prompt \| infra |
|---|---|---|---|
| 2026-10-08 | Personagem (qwen3:30b) trocava de lado e cobrava o usuário: o contexto da cena diz "Você coordena…" e o modelo achava que era ele | marcar o contexto como texto do USUÁRIO e as falas do personagem como "VOCÊ (Nome)"; resta ~2 em 8 na feedback-atraso (R14) | prompt |
| 2026-10-08 | Ligar o mãos-livres (qualquer mudança de config) recriava o motor e reiniciava a cena | `useMemo` do motor só pelos campos do motor | infra |
| 2026-10-08 | VAD: ruído constante no começo virava "fala" que nunca acabava | calibração de 400 ms + teto de 30 s por fala | infra |
| 2026-10-08 | Interrupção não marcava a fala do personagem: a geração seguia "ativa" enquanto a voz tocava | encerrar o estado de geração quando o texto acaba + número de turno para o turno velho não mexer no estado | infra |
| 2026-10-08 | STT do gateway: `faster-whisper` caía no `av.open(metadata_errors)` (PyAV do sistema) e o CPU levava 1,3 s | passar o áudio como array; openai-whisper na GPU quando há CUDA (0,3 s) | infra |
| 2026-10-08 | Avaliador (qwen3:30b sem think) dava 0 a conversa boa quando o personagem falava longo; com think acertava mas levava ~50 s | saída "evidência antes da nota" (`analise: [{id, evidencia, nota}]`): 5,7 estável em ~5 s; `pensar` fica opcional no gateway | prompt |
| 2026-10-08 | Avaliador marcava "não apareceu" para critério cumprido numa fala posterior | regra: ler todas as falas, crédito para correção de rumo + falas do usuário listadas à parte | prompt |
| 2026-10-08 | Ollama `qwen3.6:35b-a3b` passou a responder "CUDA error: illegal memory access" no meio da calibração (runner caiu) | calibração aceita `--modelo`; rodada completa refeita com `qwen3:30b` (15/16) | infra |
| 2026-10-08 | Avaliador dava 0 a critérios do tipo "evitar erro" (não insistir, não aconselhar cedo) quando o erro não acontecia | regra de exceção no `prompts/avaliador.md` | prompt |
| 2026-10-08 | Playwright 1.56 procurava Chromium 1194, ausente no cache | fixado `@playwright/test@1.57.0` (Chromium 1200 já instalado) | infra |
