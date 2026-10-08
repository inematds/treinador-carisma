# Treinador de Carisma

[![Treinador de Carisma](guia/assets/banner.jpg)](https://inematds.github.io/treinador-carisma/guia/)

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

## O que é

O Treinador de Carisma é um app em que você treina conversas com uma inteligência artificial. Ela faz o papel de outra pessoa (um colega atrasado, um chefe exigente, alguém num café), você conversa e, no fim, um avaliador diz o que funcionou e dá uma única correção para você refazer a cena. Serve para quem quer se comunicar melhor no trabalho (modo Carisma) ou nos relacionamentos (modo Conquista). Abre direto no navegador, ou roda no seu PC com o Ollama ou com a sua assinatura do ChatGPT (Codex), do Claude ou do Gemini.

## 📖 Guia de uso

Guia completo (landing + passo a passo): **https://inematds.github.io/treinador-carisma/guia/**

**Usar agora (Edição Nuvem):** https://inematds.github.io/treinador-carisma/treinar/
**Guia:** https://inematds.github.io/treinador-carisma/guia/

## Duas edições, um núcleo

| | Edição Nuvem | Edição Local |
|---|---|---|
| Como abre | link no navegador | `deploy/iniciar.sh` (ou `iniciar.bat`, ou `docker compose`) |
| IA | modelo no navegador (WebLLM), Ollama direto, OpenRouter (login), OpenAI/Anthropic (sua chave) | Ollama (sem API) ou **sua assinatura** Codex / Claude / Gemini, pelas CLIs logadas |
| Voz | voz do navegador | Whisper + Kokoro (voz feminina e masculina) ou Piper, locais |
| Conversa contínua | sim (o microfone pausa enquanto o personagem fala) | sim, com interrupção: falar por cima corta o personagem |

## Rodar no seu PC

```bash
git clone https://github.com/inematds/treinador-carisma
cd treinador-carisma
deploy/iniciar.sh            # abre em http://127.0.0.1:8787
```
Requisitos: Python 3 e pelo menos um motor (Ollama com um modelo de 8B ou mais, ou o Codex/Claude CLI logado). Voz opcional: `TC_INSTALAR_VOZ=1 deploy/iniciar.sh` instala o faster-whisper, o Kokoro e o Piper (os modelos de voz baixam no primeiro uso).

## Desenvolver

```bash
cd app && npm install
npm test                 # testes do núcleo
npm run cenas            # valida as cenas YAML
npm run build            # gera ../treinar
npx playwright test      # fluxo completo com o motor de demonstração
# mãos-livres com microfone falso, contra o gateway local:
E2E_GATEWAY=http://127.0.0.1:8787 npx playwright test --project maos-livres --project interrupcao
npx vite-node scripts/latencia.ts -- --gateway http://127.0.0.1:8787 --modelo qwen3:30b   # latência da voz
npx vite-node scripts/calibrar.ts -- --gateway http://127.0.0.1:8787 --motor ollama --modelo qwen3:30b
cd ../gateway && python3 -m pytest -q
```

- Cenas novas: um YAML em `cenas/<modo>/<competencia>/` (formato em `CONTRATOS.md`).
- Prompts: `prompts/`.
- Rostos: `app/src/rostos/catalogo.ts`.
- Plano completo: `PLANO.md`.

## Fases

- **Fase 1 ✓ (1.0.0)**: base completa nas duas edições — dois modos, 4 treinadores, 16 cenas, avaliador calibrado, texto e voz em turnos.
- **Fase 2 ✓ (1.1.0)**: conversa natural — mãos-livres, resposta falada frase a frase, interrupção, pausa automática, voz feminina local e métricas de fala. Cerca de 1,3 s do fim da sua fala à voz do personagem no Ollama local (sem contar o instante de silêncio que marca o fim da sua vez).
- **Fase 3 (roadmap)**: rosto — avatar 3D com a boca sincronizada à fala; voz e rosto próprios por personagem.
- **Fase 4 (roadmap)**: avatar em tempo real — rosto realista falando ao vivo (serviço de avatar na Nuvem, ou modelo na placa de vídeo na Edição Local).

## Licença

MIT: copie, ajuste e, se quiser, venda. Os rostos são SVG gerados por código, sem imagem de terceiros.
