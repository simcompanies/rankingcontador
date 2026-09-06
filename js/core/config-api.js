/* ============================================================================
   config-api.js
   ----------------------------------------------------------------------------
   Camada mais baixa da aplicação: sabe ONDE fica o backend (Google Apps
   Script) e COMO conversar com ele (GET/POST via fetch), além de alguns
   helpers de UI genéricos usados por praticamente todo formulário do app
   (mostrar/esconder mensagem de sucesso ou erro, travar botão em "Aguarde...").

   Não depende de nenhum outro arquivo do projeto — é o primeiro script que
   deve ser carregado, pois praticamente todos os outros chamam chamarAPI()
   ou chamarAPIGet() para falar com a planilha mestra.
   ============================================================================ */

/* --------------------------------------------------------------------------
   URL do Web App publicado a partir do Code.gs (Google Apps Script).
   É o ÚNICO endpoint que o front-end conhece: todas as ações (login,
   salvar ranking, listar usuários, OCR etc.) passam por aqui, diferenciadas
   pelo campo "action" enviado no corpo/query da requisição.
   -------------------------------------------------------------------------- */
const API_URL = 'https://script.google.com/macros/s/AKfycbzzE5jhGAw2y_2oDWJ1kBL-b_-gvbmXBdNdu_kZdGvl4Pp_ArPDWSR2rUtcBQ4qz54NAQ/exec';

/* Chamada autenticada/mutável (POST) — usada para toda ação que grava ou
   altera dado no backend (login, salvar ranking, criar usuário...).
   Recebe o payload já pronto (objeto JS) e devolve o JSON de resposta. */
async function chamarAPI(payload){
  const resposta = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
  if(!resposta.ok) throw new Error('Erro de rede (HTTP ' + resposta.status + ')');
  return resposta.json();
}

/* Chamada de leitura (GET) — usada para ações que só consultam dado
   (listar ranking, listar usuários, verificar sessão...). Os parâmetros
   viram querystring via URLSearchParams. */
async function chamarAPIGet(params){
  const query = new URLSearchParams(params).toString();
  const resposta = await fetch(API_URL + '?' + query);
  if(!resposta.ok) throw new Error('Erro de rede (HTTP ' + resposta.status + ')');
  return resposta.json();
}

/* --------------------------------------------------------------------------
   Helpers de feedback visual reaproveitados por qualquer tela com formulário:
   mostrar uma mensagem de sucesso/erro abaixo do form, escondê-la, e alternar
   um botão entre o rótulo normal e "Aguarde..." enquanto uma chamada à API
   está em andamento.
   -------------------------------------------------------------------------- */
function mostrarMsg(elId, texto, ok){
  const el = document.getElementById(elId);
  if(!el) return;
  el.textContent = texto;
  el.classList.remove('hidden', 'ok', 'erro');
  el.classList.add(ok ? 'ok' : 'erro');
}

function esconderMsg(elId){
  const el = document.getElementById(elId);
  if(el) el.classList.add('hidden');
}

function definirCarregando(btn, carregando, textoNormal){
  btn.disabled = carregando;
  btn.textContent = carregando ? 'Aguarde...' : textoNormal;
}

// Trata erro de sessão expirada ou de permissão negada de forma centralizada;
// devolve true se já tratou o erro (nesse caso quem chamou deve parar/retornar,
// pois a mensagem/redirecionamento já foi disparado por esta função).
// Usada por praticamente toda função que chama chamarAPI()/chamarAPIGet().
function tratarErroSessaoOuPermissao(resposta){
  if(resposta && resposta.codigo === 'SESSAO_EXPIRADA'){
    encerrarSessaoLocal();
    alert('Sua sessão expirou. Faça login novamente.');
    return true;
  }
  if(resposta && resposta.codigo === 'PERMISSAO_NEGADA'){
    alert(resposta.erro || 'Essa ação é restrita a administradores.');
    return true;
  }
  return false;
}
