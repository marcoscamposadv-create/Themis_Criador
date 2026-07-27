"""Traducao de texto usando deep-translator (Google Translate, sem chave de API)."""
from typing import List

from deep_translator import GoogleTranslator

from src.transcriber import Segmento


def traduzir_segmentos(segmentos: List[Segmento], idioma_origem: str, idioma_destino: str) -> List[Segmento]:
    """Traduz o texto de cada segmento, preservando os timestamps originais."""
    tradutor = GoogleTranslator(source=idioma_origem or "auto", target=idioma_destino)

    traduzidos = []
    for seg in segmentos:
        texto_traduzido = tradutor.translate(seg.texto) or ""
        traduzidos.append(Segmento(inicio=seg.inicio, fim=seg.fim, texto=texto_traduzido.strip()))
    return traduzidos
