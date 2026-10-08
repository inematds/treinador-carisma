# Evidências da Fase 2 (08/10/2026)

## Latência da voz (`app/scripts/latencia.ts`, gateway local, qwen3:30b, 16 rodadas)
`latencia.txt`: p50 **1336 ms** do fim da fala à voz da 1ª frase (STT do último trecho + modelo até a 1ª frase + voz dessa frase), sem contar a espera de 600 ms de silêncio. Médias: STT 383 · modelo 1163 · voz 124 ms. p95 7310 ms = uma rodada em que o Ollama recarregou o modelo.

## Sessão real gravada (`app/e2e/sessao-real.spec.ts`)
Gateway + Ollama (qwen3:30b) + microfone falso do Chromium tocando uma fala, modo mãos-livres, sem clique.
`sessao-real.json` = última gravação (transcrição + latências medidas no navegador, do fim do som até a 1ª frase soar, já contando a espera de silêncio). O vídeo fica só na máquina (`sessao-real.webm`, fora do git).

| gravação | latências no navegador | observação |
|---|---|---|
| 1ª (12:37) | 7633, 1754 ms | 1ª resposta com o modelo sendo carregado; personagem trocou de lado (antes da correção do prompt) |
| 2ª (12:39) | 1268, 6846 ms | 2ª resposta pagou recarga do modelo |
| 3ª (12:52, `sessao-real.json`) | 7067, 7674 ms | as duas pagaram recarga: outro processo da máquina descarrega o modelo ~10 s depois de cada resposta (ver `~/projetos/wifi/LIMITES.md`); personagem coerente nas duas |

Com o modelo carregado, a resposta no navegador ficou entre 1,27 e 1,75 s contando a espera de silêncio. Com o cérebro fake (só STT + voz reais) ficou entre 0,80 e 1,25 s (testes `maos-livres`).
