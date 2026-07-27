"""Download de video publico do Instagram e extracao do audio."""
import subprocess
from pathlib import Path

import yt_dlp


class DownloadError(Exception):
    pass


def baixar_video(url: str, destino_dir: Path) -> Path:
    """Baixa um Reels/video publico do Instagram para destino_dir.

    Retorna o caminho do arquivo de video baixado.
    """
    destino_dir.mkdir(parents=True, exist_ok=True)
    saida_template = str(destino_dir / "original.%(ext)s")

    opcoes = {
        "outtmpl": saida_template,
        "format": "mp4/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(opcoes) as ydl:
            info = ydl.extract_info(url, download=True)
            caminho = ydl.prepare_filename(info)
    except yt_dlp.utils.DownloadError as exc:
        raise DownloadError(
            "Nao foi possivel baixar o video. Verifique se o link e publico "
            f"e valido. Detalhe: {exc}"
        ) from exc

    caminho_video = Path(caminho)
    if not caminho_video.exists():
        raise DownloadError("O download terminou mas o arquivo de video nao foi encontrado.")
    return caminho_video


def extrair_audio(video_path: Path, destino_dir: Path) -> Path:
    """Extrai o audio do video em WAV mono 16kHz (formato esperado pelo whisper)."""
    audio_path = destino_dir / "audio.wav"
    comando = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-f", "wav",
        str(audio_path),
    ]
    resultado = subprocess.run(comando, capture_output=True, text=True)
    if resultado.returncode != 0:
        raise DownloadError(f"Falha ao extrair audio com ffmpeg: {resultado.stderr[-500:]}")
    return audio_path
