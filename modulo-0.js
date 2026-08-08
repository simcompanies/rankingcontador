/* ============================================================================
   modulo-0.js
   ----------------------------------------------------------------------------
   Controlador da TELA de login (Módulo 0 — HTML em modulo-0.html): troca
   entre os três sub-formulários (entrar / criar conta / esqueci a senha),
   os handlers de submit de cada um deles, e o modal de troca de senha
   obrigatória (troca-de-senha.html) que aparece quando o backend pede um
   código temporário.

   Diferença para identidade.js: aqui fica o que é específico do FORMULÁRIO
   de login (ler campos da tela, validar, chamar a API de auth e mostrar
   erro/sucesso naquela tela); identidade.js é o serviço de sessão que o
   app inteiro usa depois que o login já aconteceu.

   Depende de: config-api.js (chamarAPI, mostrarMsg, definirCarregando),
   identidade.js (aplicarSessao).
   ============================================================================ */

// Alterna qual dos três cartões do módulo 0 fica visível: 'login',
// 'cadastro' ou 'esqueci'. Usada pelos links "Criar conta" / "Esqueci
// minha senha" / "Voltar para o login".
function mostrarAuthView(nome){
  ['login','cadastro','esqueci'].forEach(function(v){
    const el = document.getElementById('auth-view-'+v);
    if(el) el.classList.toggle('hidden', v !== nome);
  });
  ['login-msg','cadastro-msg','esqueci-msg'].forEach(esconderMsg);
}

// Submit do formulário de login: valida, chama a API e aplica a sessão devolvida.
async function handleLogin(event){
  event.preventDefault();
  const btn = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  esconderMsg('login-msg');
  definirCarregando(btn, true, 'Entrar');
  try{
    const resposta = await chamarAPI({ action:'login', email:email, senha:senha });
    if(!resposta.sucesso){ mostrarMsg('login-msg', resposta.erro || 'Não foi possível entrar.', false); return; }
    document.getElementById('login-senha').value = '';
    aplicarSessao(resposta.dados);
    if(resposta.dados.precisaTrocarSenha) abrirModalNovaSenha();
  }catch(erro){
    console.error(erro);
    mostrarMsg('login-msg', 'Erro de conexão. Verifique a URL da API (API_URL) e sua internet.', false);
  }finally{
    definirCarregando(btn, false, 'Entrar');
  }
}

// Submit do formulário de criar conta: cria o usuário e, se a API já devolver sessão, entra direto.
async function handleCadastro(event){
  event.preventDefault();
  const btn = document.getElementById('cadastro-btn');
  const nome = document.getElementById('cadastro-nome').value.trim();
  const email = document.getElementById('cadastro-email').value.trim();
  const senha = document.getElementById('cadastro-senha').value;
  const senha2 = document.getElementById('cadastro-senha2').value;
  esconderMsg('cadastro-msg');
  if(senha !== senha2){ mostrarMsg('cadastro-msg', 'As senhas não conferem.', false); return; }
  definirCarregando(btn, true, 'Criar conta');
  try{
    const resposta = await chamarAPI({ action:'cadastrar', nome:nome, email:email, senha:senha, confirmarSenha:senha2 });
    if(!resposta.sucesso){ mostrarMsg('cadastro-msg', resposta.erro || 'Não foi possível criar a conta.', false); return; }
    aplicarSessao(resposta.dados);
  }catch(erro){
    console.error(erro);
    mostrarMsg('cadastro-msg', 'Erro de conexão. Verifique a URL da API (API_URL) e sua internet.', false);
  }finally{
    definirCarregando(btn, false, 'Criar conta');
  }
}

// Submit do formulário "esqueci minha senha": pede ao backend o envio de um
// código temporário por e-mail. Esse código funciona como senha provisória —
// o usuário volta para a tela de login e entra com ele (handleLogin), o que
// aciona o modal de troca de senha obrigatória (precisaTrocarSenha=true).
async function handleEsqueciSenha(event){
  event.preventDefault();
  const btn = document.getElementById('esqueci-btn');
  const email = document.getElementById('esqueci-email').value.trim();
  esconderMsg('esqueci-msg');
  definirCarregando(btn, true, 'Enviar código');
  try{
    const resposta = await chamarAPI({ action:'esqueciSenha', email:email });
    mostrarMsg('esqueci-msg', resposta.mensagem || resposta.erro || 'Se esse e-mail existir, enviamos um código.', resposta.sucesso);
  }catch(erro){
    console.error(erro);
    mostrarMsg('esqueci-msg', 'Erro de conexão. Verifique a URL da API (API_URL) e sua internet.', false);
  }finally{
    definirCarregando(btn, false, 'Enviar código');
  }
}

// Abre/fecha o modal de definição de nova senha (após receber o código por e-mail).
function abrirModalNovaSenha(){
  document.getElementById('modal-nova-senha').classList.remove('hidden');
}

function fecharModalNovaSenha(){
  document.getElementById('modal-nova-senha').classList.add('hidden');
  document.getElementById('nova-senha-1').value = '';
  document.getElementById('nova-senha-2').value = '';
  esconderMsg('nova-senha-msg');
}

// Submit do modal de nova senha: usa a sessão já ativa (sessaoUsuario.token
// — obtida ao logar com a senha provisória) para definir a senha definitiva.
// Não recebe nenhum "código": a identidade já foi validada no login anterior.
async function handleDefinirNovaSenha(event){
  event.preventDefault();
  const btn = document.getElementById('nova-senha-btn');
  const s1 = document.getElementById('nova-senha-1').value;
  const s2 = document.getElementById('nova-senha-2').value;
  esconderMsg('nova-senha-msg');
  if(s1 !== s2){ mostrarMsg('nova-senha-msg', 'As senhas não conferem.', false); return; }
  if(!sessaoUsuario){ mostrarMsg('nova-senha-msg', 'Sessão inválida — faça login de novo.', false); return; }
  definirCarregando(btn, true, 'Salvar nova senha');
  try{
    const resposta = await chamarAPI({ action:'definirNovaSenha', token:sessaoUsuario.token, novaSenha:s1, confirmarNovaSenha:s2 });
    if(!resposta.sucesso){ mostrarMsg('nova-senha-msg', resposta.erro || 'Não foi possível salvar.', false); return; }
    fecharModalNovaSenha();
  }catch(erro){
    console.error(erro);
    mostrarMsg('nova-senha-msg', 'Erro de conexão.', false);
  }finally{
    definirCarregando(btn, false, 'Salvar nova senha');
  }
}
