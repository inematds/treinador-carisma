# Contratos (Fase 1) — congelados em 08/10/2026

Fonte única das interfaces entre front (`app/`), gateway (`gateway/`) e cenas (`cenas/`). Mudou aqui → muda nos três.

## 1. Layout do repositório

```
app/        Vite + React + TS (fonte). base './', build → ../treinar/
treinar/    build commitado (Pages serve /treinar/; o gateway serve na raiz /)
gateway/    Edição Local: FastAPI (Python 3), serve ../treinar e /api/*
cenas/<modo>/<competencia>/<id>.yaml   modo = carisma | conquista
prompts/    treinador.md, personagem.md, avaliador.md
deploy/     iniciar.sh, iniciar.bat, docker-compose.yml, Dockerfile
tests/calibracao/rodar.py
guia/       landing + guia PT/EN/ES
index.html  raiz: redireciona para guia/
```

## 2. Gateway HTTP (Edição Local)

Porta padrão **8787** (env `TC_PORTA`), bind `127.0.0.1` (env `TC_HOST` para VPS). Serve `../treinar/` em `/`.

### GET /api/health
```json
{ "ok": true, "versao": "1.0.0", "edicao": "local",
  "motores": {
    "ollama": {"ok": true, "modelos": ["qwen3.6:35b-a3b", "..."]},
    "codex":  {"ok": true},
    "claude": {"ok": false},
    "gemini": {"ok": false}
  },
  "stt": {"ok": true, "engine": "whisper"},
  "tts": {"ok": true, "engine": "piper", "vozes": ["pt_BR-faber-medium"]} }
```
Detecção: ollama = GET `$OLLAMA_URL/api/tags` (padrão `http://127.0.0.1:11434`); codex = `codex login status` contém "Logged in"; claude = binário `claude` existe; gemini = binário `gemini` existe. Health não pode demorar > 3 s (timeouts curtos, cache de 30 s).

### POST /api/chat
Pedido:
```json
{ "motor": "ollama|codex|claude|gemini",
  "modelo": "opcional",
  "mensagens": [{"role":"system|user|assistant","content":"..."}],
  "json": false,
  "temperatura": 0.7 }
```
Resposta: `text/plain; charset=utf-8` em streaming (chunks de texto). Erro: HTTP 4xx/5xx com `{"erro":"..."}`.

- **ollama:** `POST /api/chat` com `stream:true`, `think:false`, `options.temperature`, e `format:"json"` quando `json:true`. Repassa `message.content` de cada linha NDJSON.
- **codex (assinatura):** monta um prompt único em texto a partir das mensagens (`[SISTEMA]…`, `[USUÁRIO]…`, `[ASSISTENTE]…`, terminando com instrução de responder só a próxima fala). Executa
  `codex exec -s read-only --skip-git-repo-check --ephemeral --color never -o <tmp>/out.txt [-m modelo] -` com o prompt no **stdin (fechado)**, `cwd` = diretório temporário vazio, timeout 120 s. Devolve o conteúdo de `out.txt`. Se `json:true`, acrescenta ao prompt "Responda SOMENTE com um objeto JSON válido".
- **claude (assinatura):** `claude -p --output-format text` com prompt no stdin, cwd temporário, timeout 120 s (ferramentas desligadas se a flag existir).
- **gemini (assinatura):** `gemini -p "<prompt>"`, cwd temporário, timeout 120 s.
- Fila: uma geração por vez por motor (lock), para não carregar dois modelos.

### POST /api/stt
`multipart/form-data` campo `audio` (webm/ogg/wav). Resposta `{"texto":"...","palavras":[{"w":"oi","ini":0.0,"fim":0.3}]}`. Engine: `faster_whisper` se instalado, senão `whisper` (openai-whisper), modelo `env TC_WHISPER=small`, idioma `pt`. 503 se nenhum.

### POST /api/tts
`{"texto":"...","voz":"pt_BR-faber-medium"}` → `audio/wav`. Engine: binário `piper` + modelo em `~/.local/share/piper/<voz>.onnx` (env `TC_PIPER_DIR`). 503 se indisponível (o front cai para `speechSynthesis`).

## 3. Cena (YAML)

```yaml
id: feedback-atraso                 # = nome do arquivo sem .yaml, único
modo: carisma                       # carisma | conquista
competencia: situacoes-dificeis     # ver lista abaixo
nivel: 2                            # 1 fácil, 2 médio, 3 difícil
titulo: "Seu colega chega atrasado nas reuniões"
contexto: "2-3 frases, segunda pessoa"
objetivo: "1 frase"
abertura_personagem: "primeira fala do personagem (ou vazio se o usuário abre)"
personagem:                          # carisma: um personagem
  nome: Marcos
  rosto: marcos                      # id em app/src/rostos/catalogo.ts
  voz: masculina                     # masculina | feminina
  perfil: defensivo                  # timido|direto|curto|interessado|desinteressado|defensivo|irritado|ocupado
  descricao: "quem é, como fala (2-3 frases)"
  estado_inicial: { abertura: 3, paciencia: 6, confianca: 5 }   # 0-10
  sobe_quando: ["...", "..."]
  desce_quando: ["...", "..."]
  segredo: "opcional; só revela se o usuário perguntar bem"
variantes:                           # SÓ conquista (no lugar de nome/rosto/voz): o usuário escolhe quem aborda
  mulher: { nome: Camila, rosto: camila, voz: feminina }
  homem:  { nome: Rafael, rosto: rafael, voz: masculina }
fim: { max_falas: 10, sucesso: "condição de sucesso", fracasso: "condição de fracasso" }
criterios:                           # 3 a 5; pesos inteiros 1-3
  - id: abertura_fato
    nome: "Abre com o fato"
    peso: 3
    bons: ["sinal observável no texto", "..."]
    ruins: ["sinal observável", "..."]
calibracao:
  nota_3: "UMA fala do usuário que mereceria nota ≤ 4"
  nota_8: "UMA fala do usuário que mereceria nota ≥ 7"
dica_inicial: "uma dica curta que o treinador dá antes da cena"
```

Em conquista, `personagem` tem tudo menos `nome/rosto/voz` (que vêm de `variantes`). Competências válidas:
- carisma: `presenca`, `voz-clareza`, `conexao`, `influencia`, `situacoes-dificeis`
- conquista: `abertura`, `flerte`, `reciprocidade`, `convite`, `recusa`

Conquista: critérios devem incluir um de **pressão** (insistir após sinal negativo, elogio invasivo, manipulação → nota baixa) e o personagem pode recusar.

## 4. Saídas JSON dos papéis

**Personagem** (a cada fala):
```json
{ "fala": "texto falado pelo personagem",
  "estado": {"abertura": 4, "paciencia": 6, "confianca": 5},
  "expressao": "neutro|aberto|fechado|irritado|sorrindo",
  "fim": false, "resultado": null }
```
`resultado` quando `fim:true`: `"sucesso" | "fracasso" | "neutro"`.

**Avaliador** (fim/pausa da cena):
```json
{ "notas": {"abertura_fato": 4, "pergunta": 7},
  "evidencias": {"abertura_fato": "fala 1: 'você sempre chega tarde'", "pergunta": "fala 3: '...'"},
  "nota_geral": 5.6,
  "ponto_forte": "frase curta",
  "correcao_unica": "instrução executável para a próxima tentativa" }
```
Regras validadas em código: toda chave de `criterios` aparece em `notas` (0-10) e em `evidencias` (não vazia). `nota_geral` é recalculada no código pela média ponderada. Nota sem evidência é descartada. JSON inválido → 1 retry com o erro; falhou de novo → "sem avaliação".

## 5. Rostos

SVG gerado por código (`app/src/rostos/`), MIT. Treinadores: `executivo`, `executiva`, `elegante` (homem elegante), `linda` (mulher linda). Personagens: ids citados nas cenas, definidos em `catalogo.ts` (pele, cabelo, cor, roupa, acessório, idade).
