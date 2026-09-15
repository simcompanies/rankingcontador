/* ============================================================================
   colagem-ocr.js
   ----------------------------------------------------------------------------
   Leitura de prints de ranking (ex.: a ferramenta "Simco Tools") via OCR
   nativo do Google Drive, feita no backend — este arquivo só cuida da
   ponta cliente: pegar o arquivo escolhido pelo usuário, converter para
   base64 e mandar pro backend, que devolve o texto já formatado como
   "Nome, Pontuação;" pronto para cair na mesma caixa de texto usada por
   colagem.js (o resto do fluxo — conferir → lançar — é o mesmo).

   Depende de: config-api.js (chamarAPI, mostrarMsg, definirCarregando).
   ============================================================================ */

// Regra autoritativa de pontuação usada na versão de 22/08/2026.
// Mantida também no front-end para que a leitura de print não dependa de
// uma implantação antiga/desatualizada do Code.gs para calcular os pontos.
function pontosPorPosicaoLeitura(posicao, totalParticipantes){
  if(posicao <= 10) return 11 - posicao;
  if(posicao === 11) return 0;
  if(totalParticipantes <= 14) return -(posicao - 11);
  return -(Math.floor((posicao - 12) / 2) + 1);
}

// O backend devolve "Nome, Pontuação;". A ordem reconhecida é a colocação
// do dia; portanto recalculamos os pontos localmente pela regra autoritativa
// acima. Isso corrige eventuais divergências de um backend ainda publicado
// com outra versão sem alterar nomes nem a ordem reconhecida pelo OCR.
function normalizarPontuacaoOcr(textoFormatado){
  const linhas = String(textoFormatado || '')
    .split(/\r?\n|;/)
    .map(l => l.trim())
    .filter(Boolean);

  const nomes = linhas.map(function(linha){
    const ultimaVirgula = linha.lastIndexOf(',');
    return (ultimaVirgula >= 0 ? linha.slice(0, ultimaVirgula) : linha).trim();
  }).filter(Boolean);

  const total = nomes.length;
  return nomes.map(function(nome, i){
    return `${nome}, ${pontosPorPosicaoLeitura(i + 1, total)};`;
  }).join('\n');
}

// Lê um print de ranking usando o OCR nativo do Google Drive no backend e
// devolve o texto já formatado como "Nome, Pontuação;" direto na caixa de
// colar — o resto do fluxo (Ler colagem → conferir → Lançar) continua
// igual, então dá pra revisar/corrigir antes de confirmar.
// Disparada pelo evento "change" do <input type="file"> da aba "Colar".
async function handleOcrFileSelected(event){
  if(!exigirAdministrador()){ event.target.value = ''; return; }
  const file = event.target.files[0];
  if(!file) return;

  const btn = document.getElementById('ocr-upload-btn');
  const status = document.getElementById('ocr-status');
  const textoOriginal = btn.textContent;
  document.getElementById('ocr-raw-wrap').classList.add('hidden');
  definirCarregando(btn, true, textoOriginal);
  status.textContent = 'Lendo a imagem — isso pode levar alguns segundos...';

  try{
    const imagemBase64 = await arquivoParaBase64(file);
    const resposta = await chamarAPI({
      action:'ocrImagem', token:sessaoUsuario.token,
      imagemBase64:imagemBase64, mimeType:file.type || 'image/png'
    });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      status.textContent = resposta.erro || 'Não foi possível ler a imagem.';
      return;
    }
    document.getElementById('paste-area').value = normalizarPontuacaoOcr(resposta.dados.textoFormatado || '');
    status.textContent = resposta.dados.linhas
      ? `${resposta.dados.linhas} participante(s) reconhecido(s) — confira os nomes e a pontuação abaixo antes de clicar em "Ler colagem".`
      : 'Não reconheci nenhum participante nessa imagem — veja o texto bruto abaixo ou digite manualmente.';
    if(resposta.dados.textoOcrBruto){
      document.getElementById('ocr-raw-text').textContent = resposta.dados.textoOcrBruto;
      document.getElementById('ocr-raw-wrap').classList.remove('hidden');
    }
  }catch(erro){
    console.error(erro);
    status.textContent = 'Erro de conexão ao ler a imagem.';
  }finally{
    definirCarregando(btn, false, textoOriginal);
    event.target.value = ''; // permite escolher o mesmo arquivo de novo depois
  }
}

// Converte um File (imagem escolhida pelo usuário) para base64, para envio ao backend.
function arquivoParaBase64(file){
  return new Promise(function(resolve, reject){
    const reader = new FileReader();
    reader.onload = function(){ resolve(String(reader.result).split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
