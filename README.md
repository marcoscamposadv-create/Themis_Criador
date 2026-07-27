# Themis_Criador

Tradutor WhatsApp

## Tradutor de Voz do Instagram

Aplicacao web para traduzir a fala de Reels/videos publicos do Instagram.
Voce cola o link do post, o programa baixa o video, transcreve a fala,
traduz o texto para o idioma escolhido e gera:

- Legendas `.srt` (original e traduzida);
- Um audio dublado com a traducao (texto-para-voz);
- Uma copia do video com a trilha de audio substituida pela dublagem.

### Como funciona

1. **Download**: [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) baixa o video a
   partir do link publico do Instagram.
2. **Transcricao**: [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper)
   transcreve a fala original com timestamps por trecho e detecta o idioma falado.
3. **Traducao**: [`deep-translator`](https://github.com/nidhaloff/deep-translator)
   (Google Translate) traduz cada trecho para o idioma escolhido.
4. **Legendas**: os trechos original e traduzido sao exportados como arquivos `.srt`.
5. **Dublagem**: [`gTTS`](https://github.com/pndurang/gTTS) gera o audio falado da
   traducao e o `ffmpeg` substitui a trilha de audio original do video por ela.

### Requisitos

- Python 3.10+
- [`ffmpeg`](https://ffmpeg.org/) instalado e disponivel no `PATH`
- Conexao com a internet (download do Instagram, traducao e sintese de voz)

### Instalacao

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Uso

```bash
python app.py
```

Acesse `http://localhost:5000`, cole o link do Reels/video publico do
Instagram, escolha o idioma de destino e clique em **Traduzir**. O progresso
e exibido na tela; ao final, ficam disponiveis para download as legendas, o
audio dublado e o video dublado.

### Limitacoes conhecidas

- Funciona apenas com posts/Reels **publicos** do Instagram (sem login).
- A dublagem posiciona cada fala no timestamp do trecho original, mas a
  duracao da voz sintetizada pode nao coincidir exatamente com a fala
  original (nao ha ajuste automatico de velocidade).
- A qualidade da traducao depende do Google Translate (via `deep-translator`)
  e pode variar para expressoes idiomaticas ou girias.
- Os arquivos gerados por job ficam em `jobs/<id>/` e nao sao apagados
  automaticamente; para uso em producao, adicione uma rotina de limpeza.
