# Treinador de Carisma — Plano completo da solução

> Data: 08/10/2026 · Status: **Fases 1 e 2 implementadas (v1.1.0)** · Fases 3 e 4 no roadmap · Pasta: `~/projetos/treinador-carisma`
> Origem: análise de `carisma_conquista_treinamento.md` (clipboard, 08/10/2026).
> Revisão 2: em vez de versões v1…v5, **duas edições completas que evoluem juntas**, com o objetivo final de conversar com um treinador (e depois com um avatar em tempo real).

---

## 1. O que é, no final

**Você conversa com a IA como se fosse uma pessoa te treinando.** Ela fala com você, monta a cena ("agora eu sou o Marcos, seu colega que vive atrasando"), entra no papel, conversa, sai do papel quando precisa ("pausa: você abriu com acusação, tenta de novo começando pelo fato") e volta para a cena. Tudo por voz, como numa ligação, ou por texto.

No futuro, esse treinador ganha **rosto: um avatar falando em tempo real** com você.

```
   Você ⇄ TREINADOR (voz contínua, interrompível)
              │
              ├─ modo TREINADOR: conversa, explica, combina o exercício, dá UMA correção
              └─ modo PERSONAGEM: vira o Marcos / a cliente / o recrutador e reage a você
                      ↑ (estado escondido: abertura, paciência, confiança)
              (por trás) AVALIADOR silencioso dá nota em cada tentativa com evidência
```

Frase-guia: *você não aprende carisma assistindo; você treina em centenas de pequenas interações corrigidas.*

---

## 1.1 Dois modos de treino

| | **Modo Carisma** | **Modo Conquista** |
|---|---|---|
| Para quê | trabalho e vida social: liderar, negociar, apresentar, conversa difícil, networking | atração e relacionamento: puxar conversa, flertar, ler interesse, convidar, primeiro encontro |
| Treinador(a) | **Executivo** ou **Executiva**: postura de mentor(a) de liderança, terno/tailleur, escritório moderno | **Homem elegante** ou **Mulher linda**: sofisticado(a), confiante, bem-humorado(a), lounge/café ao entardecer |
| Quem você enfrenta na cena | colega, chefe, cliente, recrutador, equipe | pessoa que chamou sua atenção (homem ou mulher, você escolhe), com perfis: tímida, direta, responde curto, interessada, desinteressada |
| Competências | Presença, Voz, Conexão, Influência, Situações difíceis | Presença, Voz, Conexão + Abertura, Flerte leve, Leitura de reciprocidade, Convite, Lidar com recusa |
| Tom do treinador | objetivo, estratégico | charmoso, provocador na medida, sincero |

- Na primeira tela você escolhe o **modo** e o **treinador(a)** (4 opções: Executivo, Executiva, Homem elegante, Mulher linda). Pode trocar a qualquer momento.
- **Ética como regra de nota (Conquista):** insistir depois de sinal negativo, pressionar, elogio invasivo ou manipulação **perdem ponto**; ler a reciprocidade, recuar com elegância, convidar sem pressão e lidar bem com a recusa **ganham**. O personagem pode dizer não, e isso faz parte do treino.
- Visual: cada treinador(a) tem rosto e voz próprios. Rostos **ilustrados em SVG gerado por código** (5 expressões + boca animada), sem imagem de modelo com licença não comercial, para o projeto poder ser copiado e vendido (licença MIT). Depois VRM, depois avatar realista. Adultos, elegantes e não sexualizados.
- Decisões de 08/10/2026: Conquista treina abordando **mulher ou homem** (o usuário escolhe); o(a) treinador(a) **só orienta** (não entra na cena); Nuvem **grátis** (chave/conta de cada usuário); assinatura **Codex primeiro**; licença **MIT** (copiar, ajustar e vender).
- Cada modo tem seu próprio progresso e suas cenas (`cenas/carisma/…`, `cenas/conquista/…`). O núcleo é o mesmo.

---

## 2. Duas edições, um núcleo

| | **Edição Nuvem** (sem servidor local) | **Edição Local** (tem PC/servidor com GPU) |
|---|---|---|
| Para quem | qualquer pessoa: abre o link e usa | você, quem tem PC bom ou VPS com GPU |
| Onde roda | GitHub Pages ou Vercel | PC do usuário (`iniciar.sh` / `docker compose`) ou VPS |
| IA (cérebro) | API: chave do usuário (BYOK), login OpenRouter (OAuth), ou chave do servidor no Vercel com login e plano; WebLLM no navegador como modo grátis/limitado | **Ollama** (sem API, offline) **ou a assinatura do usuário: Claude, Codex (ChatGPT) ou Gemini**, pelas CLIs logadas no PC (ver 4.5); API opcional |
| Ouvir (STT) | Whisper no navegador (WebGPU) ou STT da API | faster-whisper / inemavox na GPU, com tempo por palavra |
| Falar (TTS) | voz do navegador ou TTS da API | chatterbox / Piper / Kokoro local |
| Conversa por voz | **Realtime de provedor** (fala↔fala) ou cadeia STT→LLM→TTS | cadeia local em streaming (VAD → STT → LLM → TTS), interrompível |
| Avatar em tempo real (futuro) | serviço de avatar interativo por API | modelo de lip-sync local na GPU |
| Custo | por uso da API (do usuário ou seu) | zero por uso; custo = máquina |
| Privacidade | conversa sai para o provedor (aviso na tela) | nada sai do PC |

**Núcleo comum (90% do código):** interface, treinador, personagens, avaliador, cenas, progresso e testes. A diferença entre as edições está só em **adaptadores** (cérebro, ouvido, voz, avatar) e no **empacotamento**. Toda melhoria no núcleo vale para as duas, e cada fase de evolução entrega nas duas ao mesmo tempo.

---

## 3. O treinador (como a conversa funciona)

### 3.1 Estados da sessão

```
ACOLHIDA → COMBINA EXERCÍCIO → CENA (personagem) → PAUSA/CORREÇÃO → REFAZ → … → FECHAMENTO
   ↑ conversa livre ("como foi sua semana? quer treinar o quê?")
```

- **Acolhida:** o treinador pergunta o que você quer treinar ou sugere pela competência mais fraca do histórico.
- **Combina exercício:** explica a cena em 2–3 frases, diz o objetivo e quem ele vai interpretar.
- **Cena:** ele fala **como o personagem** (outra voz, e no futuro outro visual), reagindo pelo estado escondido.
- **Pausa:** por gatilho do avaliador (erro grave), pelo fim da cena ou quando você diz "pausa". O treinador volta, dá **uma** correção e um ponto forte.
- **Refaz:** a mesma cena, com o personagem no mesmo estado inicial; no fim, comparação curta ("abertura de 4 para 7").
- **Fechamento:** resumo de 3 linhas, uma tarefa para a vida real ("amanhã, abra uma conversa com um fato") e registro no progresso.

Você pode interromper a qualquer momento (barge-in): "espera, como assim?", "repete", "muda pra uma pessoa mais difícil".

### 3.2 Três papéis, um modelo

| Papel | Prompt | Saída |
|---|---|---|
| **Treinador** | `prompts/treinador.md`: caloroso, direto, fala curto (voz!), nunca dá aula longa | texto falado |
| **Personagem** | `prompts/personagem.md` + dados da cena | fala + JSON do estado (`abertura`, `paciencia`, `confianca`) |
| **Avaliador** | `prompts/avaliador.md` + critérios da cena, temperatura baixa | JSON: notas, evidência por nota, `correcao_unica`, `ponto_forte`, `pausar_agora?` |

O avaliador roda **em paralelo e em silêncio** depois de cada fala sua (barato, saída curta) e decide se vale pausar. Na edição Local em GB10, usar um modelo só carregado, com as chamadas em fila.

### 3.3 Currículo (próprio, não copia o curso de origem)

| Competência | Critérios (exemplos) |
|---|---|
| Presença | abertura, calma, pausa, não acelerar |
| Voz e clareza | objetividade, frase completa, ritmo, vícios ("né", "tipo") |
| Conexão | pergunta aberta, retomar o que o outro disse, proporção de fala |
| Influência | história em 6 passos, argumento, fechar com proposta |
| Situações difíceis | Fato→Impacto→Pergunta→Proposta, dizer não, interromper, desarmar conflito |
| *(Modo Conquista)* Atração e relacionamento | abertura contextual, flerte leve, leitura de reciprocidade, recuar, convite sem pressão, lidar com recusa; **insistir após sinal negativo perde ponto** |

Os 15 títulos do curso de terceiros não são reproduzidos.

### 3.4 Formato de cena (dados, sem código)

`cenas/<modo>/<competencia>/<id>.yaml` (modo = `carisma` | `conquista`):

```yaml
id: feedback-atraso
competencia: situacoes-dificeis
nivel: 2
titulo: "Seu colega chega atrasado nas reuniões"
contexto: "Você coordena a equipe. Pela terceira vez seguida, Marcos chegou 15 min atrasado."
objetivo: "Marcos reconhecer o impacto e combinar uma solução, sem brigar."
personagem:
  nome: Marcos
  voz: masculina-grave            # id de voz por adaptador
  visual: marcos                  # pasta de expressões / id do avatar
  perfil: defensivo
  estado_inicial: { abertura: 3, paciencia: 6, confianca: 5 }
  sobe_quando: ["fato concreto", "pergunta genuína", "proposta conjunta"]
  desce_quando: ["'você sempre/nunca'", "ironia", "sermão longo"]
  segredo: "Está cuidando do pai doente de manhã."
fim: { max_falas: 10, sucesso: "Marcos propõe ou aceita um acordo" }
criterios:
  - { id: abertura_fato, peso: 3, bons: ["ocorrência concreta"], ruins: ["rótulo pessoal"] }
  - { id: pergunta,      peso: 2, bons: ["pergunta aberta antes de propor"] }
  - { id: proposta,      peso: 2, bons: ["solução combinada", "próximo passo"] }
  - { id: pressao,       peso: 2, ruins: ["insiste após resposta curta", "ameaça"] }
calibracao:
  nota_3: "Marcos, você é muito irresponsável, todo mundo já reparou."
  nota_8: "Marcos, nas três últimas reuniões você chegou depois das 9h15 e a gente repetiu a pauta. Está acontecendo alguma coisa? Como a gente resolve?"
```

Toda nota do avaliador precisa citar a fala que a justifica; sem evidência, a nota não conta.

### 3.5 Métricas de fala (quando é voz)

Palavras/min, pausas (contagem e duração), vícios, proporção de fala você × personagem, tempo de resposta, frase que "morre" no fim (queda de volume, só com áudio). Na edição Local saem precisas (timestamps por palavra); na Nuvem, aproximadas.

---

## 4. Arquitetura

### 4.1 Camadas

```
┌──────────────────────────── NÚCLEO (TypeScript, roda no navegador) ───────────────────────────┐
│ UI: palco, conversa, painel do treinador, progresso                                          │
│ Sessão: máquina de estados (acolhida→cena→pausa→refaz→fechamento), barge-in                  │
│ Papéis: treinador | personagem | avaliador  ·  Cenas YAML  ·  Métricas de fala               │
│ Persistência: IndexedDB + export/import JSON (Nuvem c/ login: + Supabase)                    │
├───────────────────────────────── PORTAS (interfaces) ───────────────────────────────────────┤
│ Cerebro.chat()  ·  Ouvido.ouvir()  ·  Voz.falar()  ·  Conversa.realtime()  ·  Avatar.mostrar() │
├───────────────── adaptadores NUVEM ─────────────────┬──────────── adaptadores LOCAL ──────────┤
│ byok (OpenAI/Anthropic/OpenRouter), openrouter-oauth│ ollama                                  │
│                                                     │ assinatura: claude | codex | gemini CLI │
│ servidor (Vercel fn, chave sua + login/plano)       │ faster-whisper / inemavox (STT)         │
│ webllm (no navegador, grátis)                       │ chatterbox / Kokoro / Piper (TTS)       │
│ whisper-web, voz do navegador, TTS/STT de API       │ gateway local de voz (WebSocket)        │
│ realtime de provedor (fala↔fala)                    │ avatar lip-sync local (GPU)             │
│ avatar interativo por API                           │                                         │
└─────────────────────────────────────────────────────┴─────────────────────────────────────────┘
                     fake (testes, sem rede) serve as duas edições
```

### 4.2 Interfaces

```ts
interface Cerebro  { chat(msgs: Msg[], o: { json?: boolean; stream?: boolean; temperatura?: number }): AsyncIterable<string> }
interface Ouvido   { ouvir(audio: MediaStream): AsyncIterable<{ texto: string; final: boolean; palavras?: Palavra[] }> }
interface Voz      { falar(texto: AsyncIterable<string>, voz: string): AsyncIterable<AudioChunk & { visemas?: Visema[] }> }
interface Conversa { realtime?(cfg): SessaoRealtime }      // provedor fala↔fala, quando existir
interface Avatar   { mostrar(audio: AsyncIterable<AudioChunk>, expressao: string): void }
```

A voz devolve **visemas** (formas da boca no tempo) quando dá. É isso que alimenta o avatar simples já no início e prepara o avatar realista.

### 4.3 Conversa por voz em tempo real

Meta: **< 1,5 s** do fim da sua fala até ouvir a resposta, com interrupção natural.

**Como ficou na Fase 2 (v1.1.0):**
- **Local (cadeia em streaming, por HTTP):** detector de fala por energia no navegador (AudioWorklet, calibra o ruído nos primeiros 400 ms) → cada pausa de 350 ms fecha um trecho, que vai na hora para `POST /api/stt` (Whisper `small` na GPU, sem tempo por palavra) → 600 ms de silêncio encerram a vez → Ollama em streaming (`qwen3:30b`, sem raciocínio) → o campo `fala` é lido do JSON ainda incompleto e cortado em frases → `POST /api/tts` por frase (Kokoro na GPU, ~0,1 s; Piper como reserva) → a voz da frase seguinte é pedida enquanto a anterior toca. Se você fala por cima, o navegador corta a voz e aborta a geração (barge-in); o gateway libera o modelo na hora.
- WebSocket e Silero VAD ficaram de fora: HTTP + VAD por energia bastaram para a meta e mantêm o gateway simples. Voltam se o uso real pedir.
- **Medido** (`app/scripts/latencia.ts`, 16 rodadas, qwen3:30b): p50 **1,34 s** do fim da fala à voz da 1ª frase, sem contar a espera de silêncio (STT 0,38 · modelo 1,16 · voz 0,12, em média). No navegador, do fim do som à voz, contando a espera: **1,27 a 1,75 s**. Picos de 7 s acontecem quando o Ollama recarrega o modelo (o gateway pede `keep_alive` de 30 min).
- **Nuvem:** cadeia grátis no navegador: reconhecimento contínuo do Web Speech → motor em streaming (Ollama direto, WebLLM ou chave do usuário) → voz do navegador por frase. Sem interrupção: o microfone pausa enquanto o personagem fala, senão o navegador ouviria a própria voz.
- O avaliador continua fora do caminho crítico; a **pausa automática** é decidida pelo estado escondido do personagem (paciência ≤ 2 ou queda de 20 pontos de conexão), sem chamada extra ao modelo.

**Roadmap (não feito):** realtime de provedor (fala↔fala nativa por API, com custo) e login/plano no Vercel. Os dois contrariam a decisão de 08/10 de manter a Nuvem grátis com a conta de cada usuário; ficam como opção para quem for revender.

### 4.4 Avatar em tempo real (horizonte final)

Em degraus, todos atrás da mesma interface `Avatar`:

| Degrau | Nuvem | Local |
|---|---|---|
| **A. Ilustrado** (já no início) | rosto SVG gerado por código, 5 expressões + boca animada pelo volume/visemas | igual |
| **B. 3D estilizado** | avatar VRM (three.js + three-vrm) com lip-sync por visemas, olhar e piscada | igual |
| **C. Realista em tempo real** | serviço de avatar interativo por API (ex.: HeyGen Interactive/LiveAvatar, Tavus, Simli, D-ID: **conferir disponibilidade e preço por minuto na época**) via WebRTC | modelo de lip-sync em tempo real na GPU (ex.: família MuseTalk/LivePortrait: **medir FPS no GB10 antes de prometer**) servido pelo gateway por WebRTC |

O treinador e cada personagem podem ter rostos diferentes. Um rosto realista do **Nei** como treinador (avatar já existente no HeyGen) é uma opção natural para a edição Nuvem. Cada uso custa crédito, então só com autorização.

### 4.5 Usar a assinatura (Claude, Codex, Gemini) em vez de API

Só na **Edição Local**: o gateway chama a CLI oficial que o usuário já tem logada com a assinatura dele, no próprio PC. Não usa chave de API, não há custo por uso além do plano, e conta no limite da assinatura.

| Assinatura | CLI | Como o gateway usa |
|---|---|---|
| Claude (Pro/Max) | `claude` (Claude Code) | `claude -p --output-format stream-json --input-format stream-json` num processo persistente por sessão (evita o tempo de partida a cada fala); sem ferramentas (`--tools ""` ou equivalente), só texto |
| ChatGPT (Plus/Pro) | `codex` | `codex exec -s read-only --skip-git-repo-check -` com pedido por stdin (fechar o stdin); ou o modo servidor/app-server da CLI, se disponível na época, para manter a sessão aberta |
| Google (Gemini) | `gemini` (Gemini CLI, login Google) | `gemini -p` com saída em JSON/stream |

- Adaptador `assinatura` com três motores, atrás da mesma porta `Cerebro`. O app detecta quais CLIs estão instaladas e logadas (`claude`, `codex login status`, `gemini`) e lista na engrenagem: "IA: Ollama | Claude (sua assinatura) | Codex (sua assinatura) | Gemini (sua conta) | API".
- **Uso pessoal:** cada pessoa usa a própria assinatura no próprio PC. A Edição Nuvem não oferece isso (seria revender o acesso de uma assinatura). Conferir os termos dos três provedores antes de publicar.
- **Latência:** boa para texto e para o avaliador; na voz, alguns segundos por resposta. Mitigação: sessão persistente + streaming + TTS por frase. Para conversa instantânea, Ollama ou realtime.
- **Mistura útil:** personagem no Ollama (rápido) e avaliador/treinador na assinatura (melhor julgamento). Configurável por papel.

### 4.6 Stack

- **Front (núcleo):** Vite + React + TypeScript + Tailwind + framer-motion; `js-yaml`; Silero VAD (WASM); transformers.js (whisper-web); WebLLM; three-vrm (degrau B).
- **Servidor fino (Nuvem com login):** Hono em Vercel Functions: `/api/chat`, `/api/stt`, `/api/tts`, `/api/realtime-token`, `/api/avatar-token`. Auth e dados no Supabase. Planos e limite por usuário.
- **Gateway Local:** Python (FastAPI + WebSocket): faster-whisper, cliente Ollama, TTS, lip-sync (degrau C). Serve também o front, assim tudo fica na mesma origem.
- **Empacotamento Local:** `iniciar.sh` / `iniciar.bat` (detecta GPU, Ollama e modelos; sobe o gateway com teto de memória) e `docker compose` (gateway + ollama + whisper + tts), o mesmo para PC e VPS (com Caddy/HTTPS na VPS).
- **Testes:** Vitest (sessão, papéis, parse, métricas), Playwright (fluxo completo com adaptador `fake`), **calibração** (avaliador dá ≤4 na fala `nota_3` e ≥7 na `nota_8` de cada cena), e teste de latência da cadeia de voz Local.

### 4.7 Modelos

| Papel | Local (Ollama, já instalado aqui) | Nuvem |
|---|---|---|
| Treinador + personagem | `qwen3.6:35b-a3b` (rápido) · qualidade: `qwen3.8:27b` · PC fraco: `llama3.1:8b`/`llama3.2` | modelo médio da API · grátis: WebLLM pequeno |
| Avaliador | o mesmo carregado, `format: json` (ou Claude/Codex/Gemini pela assinatura, ver 4.5) | modelo barato com JSON |

O app recomenda o modelo pela RAM e pela GPU detectadas. GB10: um modelo só, `-np 1` (ver `wifi/OLLAMA-TUNING.md`).

---

## 5. Interface

Conceito: **"sala de ensaio com um treinador"**. Escuro, padrão INEMA âmbar. A conversa é o centro, sem cara de formulário.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ● Treinador  [Carisma|Conquista]  Presença ▰▰▰▱  Conexão ▰▰▱▱ ... ⚙ Nuvem/Local │
├───────────────────────────────────────────────┬───────────────────────────┤
│                                               │ CENA: Feedback — atraso    │
│        ┌──────────────────────┐               │ Objetivo: acordo sem briga │
│        │   ROSTO (treinador   │  ~termômetro~ │ Tentativa 2 · nível 2      │
│        │   ou personagem)     │   de conexão  │───────────────────────────│
│        │  fala / expressão    │               │ (aparece na pausa)         │
│        └──────────────────────┘               │ ⚡ UMA CORREÇÃO             │
│   legenda ao vivo: "Ah... de novo isso?"      │ "Abra com o fato..."       │
│                                               │ ✓ ponto forte: pergunta    │
│   ◉━━━━━━━━━━━━━━  (onda da sua voz)           │ Abertura 4 → 7 ▲           │
│   [ 🎙 falando… ]   [ ⌨ texto ]  [ ⏸ pausa ]    │ [ REFAZER ▶ ]  [ próxima ] │
└───────────────────────────────────────────────┴───────────────────────────┘
```

- **Rosto no centro:** troca entre treinador e personagem com uma transição (luz e cor mudam: âmbar = treinador, cor fria = cena).
- **Termômetro de conexão** reage ao estado escondido; pode ser desligado no modo difícil.
- **Legenda ao vivo** das duas falas; a transcrição completa fica a um clique, com as falas que geraram cada nota destacadas.
- **Modo mãos-livres:** conversa contínua por voz, sem botão (VAD). Push-to-talk como alternativa. Texto sempre disponível.
- **Progresso:** radar das competências, sequência de dias, histórico de tentativas por cena.
- **Seletor da edição** na engrenagem: "IA neste PC / no navegador / na nuvem (sua chave ou conta)", com aviso de privacidade quando os dados saem do PC.
- Celular primeiro (margem 16 px, botão de voz grande). Construção com as skills `frontend-design` / `impeccable`.

---

## 6. Projeto completo desde o início, evoluindo nas duas edições

O projeto nasce com **toda a estrutura**: núcleo, portas, adaptadores das duas edições, empacotamento, testes e guia. As fases dizem **o que fica bom primeiro**, nunca uma edição sem a outra.

| Fase | Núcleo (vale para as duas) | Edição Nuvem | Edição Local |
|---|---|---|---|
| **1. Base completa** | os dois modos e os 4 treinadores; sessão com treinador + personagem + avaliador; 10 cenas Carisma (situações difíceis + conexão) + 6 cenas Conquista (café, evento, mensagem, convite, recusa, reconexão); interface; progresso; calibração | Pages; BYOK + OpenRouter OAuth + WebLLM; texto + voz do navegador | `iniciar.sh/.bat` + compose; Ollama + **assinatura Claude/Codex/Gemini**; gateway com faster-whisper + TTS; texto + voz por turnos |
| **2. Conversa natural ✓ (v1.1.0)** | barge-in, modo mãos-livres, pausa automática, métricas de fala | cadeia em streaming no navegador (sem barge-in); realtime de provedor e login/plano no Vercel → roadmap | cadeia em streaming (p50 1,34 s sem a espera de silêncio); Kokoro com voz feminina; chatterbox opcional com a voz do próprio usuário |
| **3. Rosto** (roadmap) | avatar ilustrado → VRM com visemas; voz e rosto por personagem | degrau B | degrau B |
| **4. Avatar em tempo real** (roadmap) | interface `Avatar` com WebRTC | avatar interativo por API (com custo) | lip-sync em tempo real na GPU |
| **contínuo** | novas cenas nos dois modos, editor de cenas | — | — |

Critério de pronto de cada fase, por edição: `npm test` verde, calibração verde, Playwright do fluxo completo, teste de latência (fase 2+) e uma sessão real gravada como evidência.

Versão do pacote: `vX.XX.YY` (minor incrementa XX e mantém YY; só o major zera). Fase 1 = `1.0.0`; Fase 2 = `1.1.0`.

---

## 7. Estrutura do repositório

```
treinador-carisma/
├── PLANO.md · CLAUDE.md · CHANGELOG.md · FALHAS.md
├── app/                        ← núcleo (front TS), roda nas duas edições
│   └── src/{sessao,papeis,cenas,metricas,ui,dados,portas}/
├── adaptadores/
│   ├── nuvem/                  ← byok, openrouter-oauth, servidor, webllm, whisper-web, realtime, avatar-api
│   ├── local/                  ← ollama, gateway-ws (stt/tts/avatar)
│   └── fake/
├── gateway/                    ← Edição Local: FastAPI + WebSocket (whisper, tts, lip-sync)
├── server/                     ← Edição Nuvem com login: Hono (Vercel)
├── cenas/  prompts/  vozes/  rostos/
├── deploy/                     ← iniciar.sh, iniciar.bat, docker-compose.yml, Caddyfile, vercel.json
├── tests/                      ← vitest, playwright, calibracao/, latencia/
└── guia/                       ← landing + guia PT/EN/ES (skill projetos-landing-guia)
```

---

## 8. Riscos e mitigação

| # | Risco | Mitigação |
|---|---|---|
| R1 | Página no github.io chamando o Ollama em `localhost` (CORS / Private Network Access) | a edição Local serve o front pelo gateway (mesma origem); no Pages, `OLLAMA_ORIGINS` + teste no 1º dia |
| R2 | Avaliador generoso | exemplos nota 3/8, evidência obrigatória, temperatura baixa, calibração no CI |
| R3 | Personagem simpático demais | estado escondido com regras; dá para perder a cena |
| R4 | JSON quebrado em modelo local | `format: json` + schema + 1 retry; se falhar, "sem avaliação", sem nota inventada |
| R5 | Latência de voz | MoE sem thinking, TTS por frase, avaliador fora do caminho crítico, medir em teste |
| R6 | Treinador fala demais na voz | regra no prompt (≤2 frases fora da correção) + critério de teste |
| R7 | Avatar realista: custo (Nuvem) e GPU (Local) | degraus A/B primeiro; C só após medir FPS local e preço/min na nuvem, com autorização |
| R8 | Conteúdo de terceiros | currículo próprio por competência |
| R9 | Privacidade | Local por padrão; áudio não é guardado; aviso quando sai do PC |
| R10 | PC fraco | recomendação de modelo pela máquina, WebLLM ou BYOK como saída |
| R11 | Modo Conquista virar "técnica de manipulação" | ética codificada nos critérios (pressão e insistência perdem ponto), personagem pode recusar, treino de lidar com a recusa |
| R12 | Assinatura (Claude/Codex/Gemini) usada fora do uso pessoal | só na Edição Local, com a CLI logada pelo **próprio** usuário no **próprio** PC; nunca na Nuvem servindo outras pessoas com uma assinatura; conferir os termos de cada provedor antes de publicar |
| R13 | CLI lenta para voz (alguns segundos para iniciar) | processo persistente com streaming (sessão aberta), avaliador fora do caminho crítico; para voz instantânea, Ollama ou realtime |
| R14 | Modelo local sem raciocínio troca de lado e fala como o usuário (qwen3:30b: ~2 em 8 na cena feedback-atraso, mesmo com o prompt corrigido) | contexto marcado como texto do usuário e falas do personagem como "VOCÊ (Nome)"; para cenas difíceis, motor maior ou assinatura; medir de novo a cada troca de modelo |
| R15 | Eco da própria voz dispara o microfone no mãos-livres | cancelamento de eco do navegador + limiar 2,2× enquanto o personagem fala; na Nuvem o microfone pausa durante a fala; com caixa de som alta, usar fone. **Ainda não testado com caixa de som real** (o teste usa microfone falso, sem eco), nem o mãos-livres da Nuvem num navegador de verdade |
| R16 | Whisper "inventa" frases em silêncio ou ruído | trecho quase mudo vira texto vazio; segmentos com `no_speech_prob` alto descartados; frases típicas ("Obrigado.", "Legendas pela comunidade…") filtradas |

**Regra de desenvolvimento:** nenhuma chamada a API paga (LLM, realtime, avatar) durante construção e testes sem autorização explícita. Os testes usam o adaptador `fake` e o Ollama.

---

## 9. Publicação

- Repo `inematds/treinador-carisma`, autor `inematds <inematds@gmail.com>`.
- GitHub Pages da raiz: Edição Nuvem em `/`, guia em `/guia/` (PT/EN/ES). Vercel quando entrar o login.
- Edição Local: release no GitHub com `iniciar.sh/.bat` e o compose.
- Portal inema.club via `atualiza-portal`.

---

## 10. Decisões em aberto

1. Aprova esta estrutura (duas edições + núcleo comum + fases) para começar a Fase 1?
2. Os 4 treinadores (Executivo, Executiva, Homem elegante, Mulher linda) ganham rosto e voz próprios e fictícios. Quer também um 5º treinador com **você** (voz `nei*` e o seu avatar)?
3. Modo Conquista: você treina abordando **mulher, homem ou os dois** (escolha do usuário)? E o(a) treinador(a) entra na cena como a pessoa abordada, ou só orienta?
4. Nuvem com login: o objetivo é **vender** (plano pago, chave sua) ou só oferecer grátis com a chave/conta de cada usuário?
5. Assinatura na Edição Local: qual vem primeiro, Claude, Codex ou Gemini? (Eu sugiro Codex e Claude, que já estão logados aqui.)
