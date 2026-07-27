"""Orquestra as etapas de download, transcricao, traducao, legenda e dublagem."""
import shutil
import threading
import uuid
from pathlib import Path
from typing import Dict

from src import downloader, subtitles, translator, tts, dubber
from src.transcriber import transcrever

JOBS_DIR = Path(__file__).resolve().parent.parent / "jobs"

# Estado dos jobs em memoria. Para producao com multiplos workers, trocar por
# um armazenamento compartilhado (Redis, banco de dados, etc.).
_JOBS: Dict[str, dict] = {}
_LOCK = threading.Lock()


def _atualizar(job_id: str, **campos) -> None:
    with _LOCK:
        _JOBS[job_id].update(campos)


def obter_status(job_id: str) -> dict:
    with _LOCK:
        job = _JOBS.get(job_id)
        return dict(job) if job else None


def _executar(job_id: str, url: str, idioma_destino: str) -> None:
    job_dir = JOBS_DIR / job_id
    try:
        _atualizar(job_id, etapa="baixando_video", progresso=10)
        video_path = downloader.baixar_video(url, job_dir)

        _atualizar(job_id, etapa="extraindo_audio", progresso=25)
        audio_path = downloader.extrair_audio(video_path, job_dir)

        _atualizar(job_id, etapa="transcrevendo", progresso=40)
        segmentos, idioma_origem = transcrever(audio_path)

        _atualizar(job_id, etapa="traduzindo", progresso=60, idioma_origem=idioma_origem)
        segmentos_traduzidos = translator.traduzir_segmentos(segmentos, idioma_origem, idioma_destino)

        _atualizar(job_id, etapa="gerando_legendas", progresso=70)
        srt_original = subtitles.escrever_srt(segmentos, job_dir / "original.srt")
        srt_traduzido = subtitles.escrever_srt(segmentos_traduzidos, job_dir / "traduzido.srt")

        _atualizar(job_id, etapa="gerando_dublagem", progresso=80)
        audio_dublado = tts.sintetizar_audio(segmentos_traduzidos, idioma_destino, job_dir)

        _atualizar(job_id, etapa="montando_video", progresso=92)
        video_dublado = dubber.gerar_video_dublado(video_path, audio_dublado, job_dir)

        _atualizar(
            job_id,
            etapa="concluido",
            progresso=100,
            status="concluido",
            resultado={
                "texto_original": " ".join(s.texto for s in segmentos),
                "texto_traduzido": " ".join(s.texto for s in segmentos_traduzidos),
                "legenda_original": srt_original.name,
                "legenda_traduzida": srt_traduzido.name,
                "audio_dublado": audio_dublado.name,
                "video_dublado": video_dublado.name,
            },
        )
    except Exception as exc:  # noqa: BLE001 - reportar qualquer falha do pipeline ao usuario
        _atualizar(job_id, etapa="erro", status="erro", erro=str(exc))


def iniciar_job(url: str, idioma_destino: str) -> str:
    job_id = uuid.uuid4().hex
    with _LOCK:
        _JOBS[job_id] = {
            "status": "processando",
            "etapa": "na_fila",
            "progresso": 0,
            "url": url,
            "idioma_destino": idioma_destino,
        }

    thread = threading.Thread(target=_executar, args=(job_id, url, idioma_destino), daemon=True)
    thread.start()
    return job_id


def caminho_arquivo(job_id: str, nome_arquivo: str) -> Path:
    if "/" in nome_arquivo or "\\" in nome_arquivo or nome_arquivo in (".", ".."):
        raise ValueError("Caminho de arquivo invalido.")

    job_dir_resolvido = (JOBS_DIR / job_id).resolve()
    caminho = (job_dir_resolvido / nome_arquivo).resolve()
    if caminho.parent != job_dir_resolvido:
        raise ValueError("Caminho de arquivo invalido.")
    if not caminho.exists():
        raise FileNotFoundError(nome_arquivo)
    return caminho


def limpar_job(job_id: str) -> None:
    with _LOCK:
        _JOBS.pop(job_id, None)
    shutil.rmtree(JOBS_DIR / job_id, ignore_errors=True)
