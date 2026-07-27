"""Transcricao de audio com timestamps usando faster-whisper."""
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

from faster_whisper import WhisperModel

# Modelo carregado uma unica vez e reutilizado entre requisicoes.
_MODEL = None
_TAMANHO_MODELO = "small"


def _obter_modelo() -> WhisperModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = WhisperModel(_TAMANHO_MODELO, device="cpu", compute_type="int8")
    return _MODEL


@dataclass
class Segmento:
    inicio: float
    fim: float
    texto: str


def transcrever(audio_path: Path) -> Tuple[List[Segmento], str]:
    """Transcreve o audio no idioma original.

    Retorna a lista de segmentos com timestamps e o codigo do idioma detectado.
    """
    modelo = _obter_modelo()
    segmentos_whisper, info = modelo.transcribe(str(audio_path), beam_size=5)

    segmentos = [
        Segmento(inicio=s.start, fim=s.end, texto=s.text.strip())
        for s in segmentos_whisper
        if s.text.strip()
    ]

    if not segmentos:
        raise ValueError("Nao foi possivel identificar fala no audio enviado.")

    return segmentos, info.language
