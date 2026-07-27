"""Geracao de arquivos de legenda .srt a partir de segmentos transcritos/traduzidos."""
from pathlib import Path
from typing import List

from src.transcriber import Segmento


def _formatar_timestamp(segundos: float) -> str:
    horas = int(segundos // 3600)
    minutos = int((segundos % 3600) // 60)
    segs = int(segundos % 60)
    milissegundos = int(round((segundos - int(segundos)) * 1000))
    return f"{horas:02d}:{minutos:02d}:{segs:02d},{milissegundos:03d}"


def escrever_srt(segmentos: List[Segmento], destino: Path) -> Path:
    linhas = []
    for indice, seg in enumerate(segmentos, start=1):
        linhas.append(str(indice))
        linhas.append(f"{_formatar_timestamp(seg.inicio)} --> {_formatar_timestamp(seg.fim)}")
        linhas.append(seg.texto)
        linhas.append("")

    destino.write_text("\n".join(linhas), encoding="utf-8")
    return destino
