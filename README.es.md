# Entrenador de Carisma

[![Entrenador de Carisma](guia/assets/banner-es.jpg)](https://inematds.github.io/treinador-carisma/guia/es/)

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

## Qué es

El Entrenador de Carisma es una app en la que practicas conversaciones con una inteligencia artificial. Ella hace el papel de otra persona (un colega que llega tarde, un jefe exigente, alguien en un café), tú conversas y, al final, un evaluador te dice qué funcionó y te da una única corrección para que repitas la escena. Sirve para quien quiere comunicarse mejor en el trabajo (modo Carisma) o en las relaciones (modo Conquista). Se abre directo en el navegador, o funciona en tu PC con Ollama o con tu suscripción de ChatGPT (Codex), Claude o Gemini.

## 📖 Guía de uso

https://inematds.github.io/treinador-carisma/guia/es/

> La interfaz de la app está en portugués por ahora.

**Usar ahora (Edición Nube):** https://inematds.github.io/treinador-carisma/treinar/
**Guía:** https://inematds.github.io/treinador-carisma/guia/es/

## Dos ediciones, un núcleo

| | Edición Nube | Edición Local |
|---|---|---|
| Cómo se abre | enlace en el navegador | `deploy/iniciar.sh` (o `iniciar.bat`, o `docker compose`) |
| IA | modelo en el navegador (WebLLM), Ollama directo, OpenRouter (inicio de sesión), OpenAI/Anthropic (tu clave) | Ollama (sin API) o **tu suscripción** Codex / Claude / Gemini, mediante las CLIs autenticadas |
| Voz | voz del navegador | Whisper + Kokoro (voz femenina y masculina) o Piper, locales |
| Conversación continua | sí (el micrófono se pausa mientras el personaje habla) | sí, con interrupción: hablar encima corta al personaje |

## Ejecutar en tu PC

```bash
git clone https://github.com/inematds/treinador-carisma
cd treinador-carisma
deploy/iniciar.sh            # se abre en http://127.0.0.1:8787
```
Requisitos: Python 3 y al menos un motor (Ollama con un modelo de 8B o más, o Codex/Claude CLI autenticado). Voz opcional: `TC_INSTALAR_VOZ=1 deploy/iniciar.sh` instala faster-whisper, Kokoro y Piper (los modelos de voz se descargan en el primer uso).

## Desarrollar

```bash
cd app && npm install
npm test                 # pruebas del núcleo
npm run cenas            # valida las escenas YAML
npm run build            # genera ../treinar
npx playwright test      # flujo completo con el motor de demostración
npx vite-node scripts/calibrar.ts -- --gateway http://127.0.0.1:8787 --motor ollama --modelo qwen3:30b
cd ../gateway && python3 -m pytest -q
```

- Escenas nuevas: un YAML en `cenas/<modo>/<competencia>/` (formato en `CONTRATOS.md`, en portugués).
- Prompts: `prompts/`.
- Rostros: `app/src/rostos/catalogo.ts`.
- Plan completo: `PLANO.md` (en portugués).

## Fases

- **Fase 1 ✓ (1.0.0)**: base completa en las dos ediciones — dos modos, 4 entrenadores, 16 escenas, evaluador calibrado, texto y voz por turnos.
- **Fase 2 ✓ (1.1.0)**: conversación natural — manos libres, respuesta hablada frase por frase, interrupción, pausa automática, voz femenina local y métricas de habla. Cerca de 1,3 s desde el final de tu habla hasta la voz del personaje con Ollama local (sin contar el instante de silencio que marca el final de tu turno).
- **Fase 3 (roadmap)**: rostro — avatar 3D con la boca sincronizada con el habla; voz y rostro propios por personaje.
- **Fase 4 (roadmap)**: avatar en tiempo real — un rostro realista hablando en vivo (servicio de avatar en la Nube, o modelo en la tarjeta de video en la Edición Local).

## Licencia

MIT: cópialo, ajústalo y, si quieres, véndelo. Los rostros son SVG generados por código, sin imágenes de terceros.
