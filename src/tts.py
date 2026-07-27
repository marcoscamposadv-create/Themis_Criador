"""Sintese de voz (texto-para-audio) da traducao usando gTTS."""
from pathlib import Path
from typing import List

from gtts import gTTS
from pydub import AudioSegment

from src.transcriber import Segmento


def sintetizar_audio(segmentos: List[Segmento], idioma_destino: str, destino_dir: Path) -> Path:
    """Gera um audio unico com a dublagem, posicionando cada fala no timestamp
    do segmento original (silencio nos intervalos sem fala)."""
    trilha = AudioSegment.silent(duration=0)
    posicao_atual_ms = 0

    for indice, seg in enumerate(segmentos):
        if not seg.texto.strip():
            continue

        clipe_path = destino_dir / f"_tts_{indice}.mp3"
        gTTS(text=seg.texto, lang=idioma_destino).save(str(clipe_path))
        clipe = AudioSegment.from_mp3(clipe_path)
        clipe_path.unlink(missing_ok=True)

        inicio_alvo_ms = int(seg.inicio * 1000)
        if inicio_alvo_ms > posicao_atual_ms:
            trilha += AudioSegment.silent(duration=inicio_alvo_ms - posicao_atual_ms)
            posicao_atual_ms = inicio_alvo_ms

        trilha += clipe
        posicao_atual_ms += len(clipe)

    if len(trilha) == 0:
        raise ValueError("Nao foi possivel gerar audio traduzido: nenhum segmento com texto.")

    audio_final = destino_dir / "dublagem.mp3"
    trilha.export(audio_final, format="mp3")
    return audio_final
