"""Aplicacao web para traduzir e dublar a fala de Reels/videos publicos do Instagram."""
import re

from flask import Flask, jsonify, render_template, request, send_file

from src import pipeline

app = Flask(__name__)

IDIOMAS_SUPORTADOS = {
    "pt": "Portugues",
    "en": "Ingles",
    "es": "Espanhol",
    "fr": "Frances",
    "de": "Alemao",
    "it": "Italiano",
    "ja": "Japones",
}

URL_INSTAGRAM_REGEX = re.compile(r"^https?://(www\.)?instagram\.com/", re.IGNORECASE)


@app.get("/")
def index():
    return render_template("index.html", idiomas=IDIOMAS_SUPORTADOS)


@app.post("/traduzir")
def traduzir():
    dados = request.get_json(silent=True) or request.form
    url = (dados.get("url") or "").strip()
    idioma_destino = (dados.get("idioma_destino") or "pt").strip()

    if not url or not URL_INSTAGRAM_REGEX.match(url):
        return jsonify({"erro": "Informe um link publico e valido do Instagram (instagram.com/...)."}), 400

    if idioma_destino not in IDIOMAS_SUPORTADOS:
        return jsonify({"erro": "Idioma de destino nao suportado."}), 400

    job_id = pipeline.iniciar_job(url, idioma_destino)
    return jsonify({"job_id": job_id})


@app.get("/status/<job_id>")
def status(job_id):
    job = pipeline.obter_status(job_id)
    if job is None:
        return jsonify({"erro": "Job nao encontrado."}), 404
    return jsonify(job)


@app.get("/download/<job_id>/<nome_arquivo>")
def download(job_id, nome_arquivo):
    try:
        caminho = pipeline.caminho_arquivo(job_id, nome_arquivo)
    except FileNotFoundError:
        return jsonify({"erro": "Arquivo nao encontrado."}), 404
    except ValueError:
        return jsonify({"erro": "Caminho de arquivo invalido."}), 400
    return send_file(caminho, as_attachment=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
