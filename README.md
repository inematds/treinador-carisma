# Treinador de Carisma

Converse com um(a) treinador(a) de IA, entre em cenas reais (feedback difícil, networking, puxar conversa num café…), receba **uma correção por vez** e refaça até ficar natural. Por texto ou por voz.

- **Modo Carisma:** trabalho e vida social, com treinador Executivo ou Executiva.
- **Modo Conquista:** atração e relacionamento, com treinador Homem elegante ou Mulher linda. Respeito e leitura do interesse do outro contam na nota.

**Usar agora (Edição Nuvem):** https://inematds.github.io/treinador-carisma/treinar/
**Guia:** https://inematds.github.io/treinador-carisma/guia/

## Duas edições, um núcleo

| | Edição Nuvem | Edição Local |
|---|---|---|
| Como abre | link no navegador | `deploy/iniciar.sh` (ou `iniciar.bat`, ou `docker compose`) |
| IA | modelo no navegador (WebLLM), Ollama direto, OpenRouter (login), OpenAI/Anthropic (sua chave) | Ollama (sem API) ou **sua assinatura** Codex / Claude / Gemini, pelas CLIs logadas |
| Voz | voz do navegador | Whisper + Piper locais |

## Rodar no seu PC

```bash
git clone https://github.com/inematds/treinador-carisma
cd treinador-carisma
deploy/iniciar.sh            # abre em http://127.0.0.1:8787
```
Requisitos: Python 3 e pelo menos um motor (Ollama com um modelo de 8B ou mais, ou o Codex/Claude CLI logado). Voz opcional: `TC_INSTALAR_VOZ=1 deploy/iniciar.sh` e o `piper` com uma voz pt_BR.

## Desenvolver

```bash
cd app && npm install
npm test                 # testes do núcleo
npm run cenas            # valida as cenas YAML
npm run build            # gera ../treinar
npx playwright test      # fluxo completo com o motor de demonstração
npx vite-node scripts/calibrar.ts -- --gateway http://127.0.0.1:8787 --motor ollama --modelo qwen3:30b
cd ../gateway && python3 -m pytest -q
```

- Cenas novas: um YAML em `cenas/<modo>/<competencia>/` (formato em `CONTRATOS.md`).
- Prompts: `prompts/`.
- Rostos: `app/src/rostos/catalogo.ts`.
- Plano completo, com as próximas fases (conversa por voz em tempo real e avatar em tempo real): `PLANO.md`.

## Licença

MIT: copie, ajuste e, se quiser, venda. Os rostos são SVG gerados por código, sem imagem de terceiros.
