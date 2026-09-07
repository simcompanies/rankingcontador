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
   salvar ranking, listar usuários etc.) passam por aqui, diferenciadas
   pelo campo "action" enviado no corpo/query da requisição.
   -------------------------------------------------------------------------- */
const API_URL = 'https://script.google.com/macros/s/AKfycbzB-zCaIRIDt4amlwcQIRDzQUtot2NuNV47r0s-t6xitCk7gZvaORVM8gZ3GiBfnDJBYw/exec';

/* Chamada autenticada/mutável (POST) — usada para toda ação que grava ou
   altera dado no backend (login, salvar ranking, criar usuário...).
   Recebe o payload já pronto (objeto JS) e devolve o JSON de resposta. */
async function chamarAPI(payload){
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 30000);
  try{
    const resposta = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
      signal: controlador.signal
    });
    if(!resposta.ok) throw new Error('Erro de rede (HTTP ' + resposta.status + ')');
    const texto = await resposta.text();
    try{
      return JSON.parse(texto);
    }catch(parseErro){
      console.error('Resposta inválida da API:', texto);
      throw new Error('A API respondeu em formato inválido.');
    }
  }catch(erro){
    if(erro && erro.name === 'AbortError') throw new Error('A API demorou mais de 30 segundos para responder.');
    throw erro;
  }finally{
    clearTimeout(timer);
  }
}

/* Chamada de leitura (GET) — usada para ações que só consultam dado
   (listar ranking, listar usuários, verificar sessão...). Os parâmetros
   viram querystring via URLSearchParams. */
async function chamarAPIGet(params){
  const query = new URLSearchParams(params).toString();
  const resposta = await fetch(API_URL + '?' + query, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'follow',
    cache: 'no-store'
  });
  if(!resposta.ok) throw new Error('Erro de rede (HTTP ' + resposta.status + ')');
  const texto = await resposta.text();
  try{
    return JSON.parse(texto);
  }catch(parseErro){
    console.error('Resposta GET inválida da API:', texto);
    throw new Error('A API respondeu em formato inválido.');
  }
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
