"""Substitui a trilha de audio original do video pela dublagem traduzida."""
import subprocess
from pathlib import Path


class DublagemError(Exception):
    pass


def gerar_video_dublado(video_original: Path, audio_dublado: Path, destino_dir: Path) -> Path:
    video_final = destino_dir / "video_dublado.mp4"
    comando = [
        "ffmpeg", "-y",
        "-i", str(video_original),
        "-i", str(audio_dublado),
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        str(video_final),
    ]
    resultado = subprocess.run(comando, capture_output=True, text=True)
    if resultado.returncode != 0:
        raise DublagemError(f"Falha ao gerar video dublado com ffmpeg: {resultado.stderr[-500:]}")
    return video_final
