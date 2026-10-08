"""Worker do chatterbox para o gateway (opcional).

Roda no Python do ambiente onde o chatterbox está instalado (TC_CHATTERBOX_PY).
Lê um pedido JSON por linha no stdin: {"texto", "ref", "saida"} e responde {"ok": true} ou
{"ok": false, "erro": "..."} no stdout. O modelo fica carregado entre as frases.
A voz vem do WAV de referência do PRÓPRIO usuário (até 10 s de fala limpa); nenhuma voz vem no projeto.
"""

import json
import sys


def main() -> None:
    resposta_para = sys.stdout
    sys.stdout = sys.stderr  # o que as bibliotecas imprimem não pode sujar o protocolo
    import soundfile as sf
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    modelo = ChatterboxMultilingualTTS.from_pretrained(device=device)
    for linha in sys.stdin:
        try:
            p = json.loads(linha)
            wav = modelo.generate(p["texto"], language_id="pt", audio_prompt_path=p["ref"],
                                  exaggeration=0.5, cfg_weight=0.5, temperature=0.8)
            sf.write(p["saida"], wav.squeeze().cpu().numpy(), modelo.sr)
            resposta = {"ok": True}
        except Exception as e:  # responde o erro e segue vivo
            resposta = {"ok": False, "erro": str(e)[:300]}
        resposta_para.write(json.dumps(resposta) + "\n")
        resposta_para.flush()


if __name__ == "__main__":
    main()
