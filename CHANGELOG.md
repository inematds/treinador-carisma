# Changelog

## 1.1.0 — 2026-10-08
- Fase 2 (conversa natural) nas duas edições.
- **Conversa contínua (mãos-livres):** microfone aberto, sem botão. Detector de fala por energia com calibração do ruído, pausa curta fecha um trecho (a transcrição dele começa enquanto você ainda fala) e 600 ms de silêncio encerram a sua vez.
- **Resposta em streaming:** o personagem fala frase a frase enquanto o modelo ainda escreve (leitura do campo `fala` de um JSON incompleto); a voz da frase seguinte é pedida enquanto a anterior toca.
- **Interrupção (Edição Local):** falar por cima corta a voz e a geração; a transcrição guarda só o que chegou a ser dito, marcado como interrompido. Na Nuvem o microfone pausa enquanto o personagem fala.
- **Pausa automática:** o treinador entra sozinho quando a paciência do personagem chega a 2 ou a conexão cai 20 pontos numa fala só (pode desligar na engrenagem).
- **Métricas de fala:** tempo para responder, pausas no meio da fala, interrupções e a latência de cada resposta.
- **Vozes locais:** Kokoro (voz feminina e masculina em português) além do Piper; Whisper na GPU quando houver; chatterbox opcional para treinador(a) com o WAV de referência do próprio usuário (nenhuma voz vem no projeto). Voz e ouvido locais valem para qualquer motor.
- Gateway: `/api/tts` aceita `engine:voz` e `velocidade`; `/api/stt` aceita `palavras=false` (mais rápido), lê o áudio como array e descarta alucinações do Whisper em silêncio; Ollama com `keep_alive` de 30 min; `TC_AQUECER=1` carrega STT e vozes na subida.
- Personagem: o contexto da cena é marcado como texto do usuário e as falas do personagem aparecem como "VOCÊ (Nome)" (o qwen3:30b às vezes trocava de lado).
- Corrigido: mudar qualquer configuração recriava o motor e reiniciava a cena.
- Latência medida (`app/scripts/latencia.ts`, qwen3:30b, 16 rodadas): p50 1,34 s do fim da fala à voz da 1ª frase, sem contar a espera de silêncio; no navegador, do fim do som à voz, 1,27 a 1,75 s.
- Chatterbox testado pelo gateway (WAV de referência gerado com o Kokoro): 1ª frase 14,9 s (carga do modelo), depois ~2,7 s por frase — serve para o(a) treinador(a), não para o personagem.
- Testes: 51 de unidade, 4 e2e com motor fake, 3 e2e com o gateway (mãos-livres, interrupção, sessão real gravada), 41 do gateway; calibração 15/16.
- Não testado: mãos-livres da Nuvem (Web Speech contínuo) num navegador real e interrupção com caixa de som de verdade (o microfone falso não tem eco).

## 1.0.0 — 2026-10-08
- Fase 1 completa nas duas edições.
- Núcleo: treinador + personagem + avaliador, sessão com pausa, uma correção, refazer e comparação; métricas de fala; progresso local (IndexedDB) com exportar/importar.
- Modos Carisma (Executivo/Executiva) e Conquista (Homem elegante/Mulher linda; abordar mulher ou homem; ética como critério de nota).
- 16 cenas (10 Carisma + 6 Conquista) em YAML, com validador e calibração do avaliador.
- Edição Nuvem (estática): Ollama direto, WebLLM no navegador, OpenRouter (login OAuth ou chave), OpenAI, Anthropic, demonstração.
- Edição Local: gateway FastAPI com Ollama e assinaturas Codex / Claude / Gemini (CLIs), voz local (Whisper + Piper), `iniciar.sh/.bat`, Docker.
- Rostos ilustrados em SVG gerados por código (MIT).
- Avaliador: evidência antes da nota, escala explícita, crédito para correção de rumo; calibração 14/16 com qwen3:30b (~8 s por cena).
- Guia landing + guia PT/EN/ES em `guia/`, capa e banners.
