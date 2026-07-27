const ETAPAS = {
  na_fila: "Na fila...",
  baixando_video: "Baixando video do Instagram...",
  extraindo_audio: "Extraindo audio...",
  transcrevendo: "Transcrevendo a fala...",
  traduzindo: "Traduzindo o texto...",
  gerando_legendas: "Gerando legendas...",
  gerando_dublagem: "Gerando audio dublado...",
  montando_video: "Montando video dublado...",
  concluido: "Concluido!",
  erro: "Ocorreu um erro.",
};

const form = document.getElementById("form-traduzir");
const secaoProgresso = document.getElementById("progresso");
const secaoResultado = document.getElementById("resultado");
const secaoErro = document.getElementById("erro");
const etapaAtual = document.getElementById("etapa-atual");
const barraPreenchida = document.getElementById("barra-preenchida");

let intervaloConsulta = null;

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  secaoErro.hidden = true;
  secaoResultado.hidden = true;
  secaoProgresso.hidden = false;
  barraPreenchida.style.width = "0%";
  etapaAtual.textContent = "Iniciando...";
  form.querySelector("button").disabled = true;

  const dados = {
    url: document.getElementById("url").value,
    idioma_destino: document.getElementById("idioma_destino").value,
  };

  try {
    const resposta = await fetch("/traduzir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const corpo = await resposta.json();

    if (!resposta.ok) {
      mostrarErro(corpo.erro || "Nao foi possivel iniciar a traducao.");
      return;
    }

    acompanharJob(corpo.job_id);
  } catch (erro) {
    mostrarErro("Falha de comunicacao com o servidor.");
  }
});

function acompanharJob(jobId) {
  intervaloConsulta = setInterval(async () => {
    try {
      const resposta = await fetch(`/status/${jobId}`);
      const job = await resposta.json();

      if (!resposta.ok) {
        pararConsulta();
        mostrarErro(job.erro || "Job nao encontrado.");
        return;
      }

      etapaAtual.textContent = ETAPAS[job.etapa] || job.etapa;
      barraPreenchida.style.width = `${job.progresso || 0}%`;

      if (job.status === "concluido") {
        pararConsulta();
        mostrarResultado(jobId, job.resultado);
      } else if (job.status === "erro") {
        pararConsulta();
        mostrarErro(job.erro || "Ocorreu um erro durante o processamento.");
      }
    } catch (erro) {
      pararConsulta();
      mostrarErro("Falha de comunicacao com o servidor.");
    }
  }, 2000);
}

function pararConsulta() {
  clearInterval(intervaloConsulta);
  form.querySelector("button").disabled = false;
}

function mostrarResultado(jobId, resultado) {
  secaoProgresso.hidden = true;
  secaoResultado.hidden = false;

  document.getElementById("texto-original").textContent = resultado.texto_original;
  document.getElementById("texto-traduzido").textContent = resultado.texto_traduzido;

  document.getElementById("link-legenda-original").href = `/download/${jobId}/${resultado.legenda_original}`;
  document.getElementById("link-legenda-traduzida").href = `/download/${jobId}/${resultado.legenda_traduzida}`;
  document.getElementById("link-audio-dublado").href = `/download/${jobId}/${resultado.audio_dublado}`;
  document.getElementById("link-video-dublado").href = `/download/${jobId}/${resultado.video_dublado}`;
}

function mostrarErro(mensagem) {
  secaoProgresso.hidden = true;
  secaoErro.hidden = false;
  secaoErro.textContent = mensagem;
  form.querySelector("button").disabled = false;
}
