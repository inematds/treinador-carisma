# CLAUDE.md — treinador-carisma

Simulador de conversa com IA (personagem + avaliador + uma correção + refazer). Plano completo em [PLANO.md](PLANO.md).

- Dois modos: Carisma (treinador Executivo/Executiva) e Conquista (Homem elegante/Mulher linda); ética do Conquista vira critério de nota.
- Duas edições (Nuvem e Local) sobre o mesmo núcleo; evoluem juntas.
- Repo de destino: `inematds/treinador-carisma`, autor `inematds <inematds@gmail.com>`.
- Roda no PC (com ou sem API), GitHub Pages, Vercel ou VPS. Front estático primeiro com motor plugável: ollama | assinatura (claude|codex|gemini CLI, só Local) | webllm | byok | openrouter-oauth | servidor | fake.
- Nenhuma chamada a API paga em build/teste sem autorização explícita: testes usam o motor `fake` + Ollama local.
- Ollama no GB10: um modelo carregado, personagem e avaliador em sequência.
- Servidor local de teste: conferir a porta com `ss -ltn` e abortar se estiver ocupada; matar só o PID que subiu.
- Versão `vX.XX.YY` (minor mantém YY; só o major zera).

## Self-learning

When I correct you, or you catch yourself making a mistake: before continuing, add the lesson as a one-line rule under ## Lessons, so it never happens again.

## Lessons
