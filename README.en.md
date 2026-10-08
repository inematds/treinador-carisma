# Charisma Coach

[![Charisma Coach](guia/assets/banner-en.jpg)](https://inematds.github.io/treinador-carisma/guia/en/)

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

## What it is

Charisma Coach is an app where you practice conversations with an artificial intelligence. It plays another person (a colleague who is running late, a demanding boss, someone at a café), you talk and, at the end, an evaluator tells you what worked and gives you a single correction so you can redo the scene. It is for anyone who wants to communicate better at work (Charisma mode) or in relationships (Dating mode). It opens right in the browser, or runs on your PC with Ollama or with your ChatGPT (Codex), Claude or Gemini subscription.

## 📖 Usage guide

https://inematds.github.io/treinador-carisma/guia/en/

> The app interface is in Portuguese for now.

**Use it now (Cloud Edition):** https://inematds.github.io/treinador-carisma/treinar/
**Guide:** https://inematds.github.io/treinador-carisma/guia/en/

## Two editions, one core

| | Cloud Edition | Local Edition |
|---|---|---|
| How it opens | link in the browser | `deploy/iniciar.sh` (or `iniciar.bat`, or `docker compose`) |
| AI | in-browser model (WebLLM), Ollama directly, OpenRouter (sign-in), OpenAI/Anthropic (your key) | Ollama (no API) or **your subscription** Codex / Claude / Gemini, through the logged-in CLIs |
| Voice | browser voice | local Whisper + Kokoro (female and male voices) or Piper |
| Continuous conversation | yes (the microphone pauses while the character speaks) | yes, with interruption: talking over the character cuts them off |

## Run it on your PC

```bash
git clone https://github.com/inematds/treinador-carisma
cd treinador-carisma
deploy/iniciar.sh            # opens at http://127.0.0.1:8787
```
Requirements: Python 3 and at least one engine (Ollama with an 8B-or-larger model, or the Codex/Claude CLI logged in). Optional voice: `TC_INSTALAR_VOZ=1 deploy/iniciar.sh` installs faster-whisper, Kokoro and Piper (the voice models download on first use).

## Develop

```bash
cd app && npm install
npm test                 # core tests
npm run cenas            # validates the YAML scenes
npm run build            # builds ../treinar
npx playwright test      # full flow with the demo engine
npx vite-node scripts/calibrar.ts -- --gateway http://127.0.0.1:8787 --motor ollama --modelo qwen3:30b
cd ../gateway && python3 -m pytest -q
```

- New scenes: a YAML file in `cenas/<modo>/<competencia>/` (format in `CONTRATOS.md`, in Portuguese).
- Prompts: `prompts/`.
- Faces: `app/src/rostos/catalogo.ts`.
- Full plan: `PLANO.md` (in Portuguese).

## Phases

- **Phase 1 ✓ (1.0.0)**: complete base in both editions — two modes, 4 coaches, 16 scenes, calibrated evaluator, turn-based text and voice.
- **Phase 2 ✓ (1.1.0)**: natural conversation — hands-free, spoken reply sentence by sentence, interruption, automatic pause, local female voice and speech metrics. About 1.3 s from the end of your speech to the character's voice on local Ollama (not counting the moment of silence that marks the end of your turn).
- **Phase 3 (roadmap)**: face — a 3D avatar with lips synced to speech; each character with their own voice and face.
- **Phase 4 (roadmap)**: real-time avatar — a realistic face talking live (an avatar service in the Cloud, or a model on the graphics card in the Local Edition).

## License

MIT: copy, adapt and, if you like, sell. The faces are code-generated SVGs, with no third-party images.
