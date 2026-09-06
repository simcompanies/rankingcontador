/* ============================================================================
   configuracoes-de-conta.js
   ----------------------------------------------------------------------------
   Lógica da tela "Minha conta" (aberta pelo link no topbar, disponível para
   qualquer papel): mostra os dados do usuário logado e permite solicitar a
   troca de senha (envia um código temporário por e-mail).

   Depende de: config-api.js, estado-global.js (sessaoUsuario).
   HTML correspondente: configuracoes-de-conta.html (injetado em #view-conta).
   ============================================================================ */

// Preenche a tela "Minha conta" com os dados da sessão atual.
function renderContaView(){
  if(!sessaoUsuario) return;
  const info = document.getElementById('conta-info');
  if(info){
    info.innerHTML =
      '<div class="linha"><span class="rotulo">Nome</span><span>' + sessaoUsuario.nome + '</span></div>' +
      '<div class="linha"><span class="rotulo">E-mail</span><span>' + sessaoUsuario.email + '</span></div>' +
      '<div class="linha"><span class="rotulo">Papel</span><span class="role-badge ' + (souAdmin() ? 'admin' : '') + '">' + sessaoUsuario.papel + '</span></div>';
  }
  document.getElementById('conta-membro-area').classList.toggle('hidden', souAdmin());
  document.getElementById('conta-admin-area').classList.toggle('hidden', !souAdmin());
  document.getElementById('conta-reset-status').textContent = '';
  const btn = document.getElementById('solicitar-reset-btn');
  if(btn){ btn.disabled = false; btn.textContent = 'Solicitar nova senha'; }
}

// Botão "Solicitar troca de senha" na tela de conta: pede ao backend para
// gerar e enviar por e-mail um código temporário, usado depois no modal de
// troca de senha (ver modulo-0.js: handleDefinirNovaSenha).
async function handleSolicitarReset(){
  if(!sessaoUsuario) return;
  const btn = document.getElementById('solicitar-reset-btn');
  definirCarregando(btn, true, 'Solicitar nova senha');
  try{
    const resposta = await chamarAPI({ action:'solicitarResetSenha', token:sessaoUsuario.token });
    if(!resposta.sucesso && tratarErroSessaoOuPermissao(resposta)) return;
    document.getElementById('conta-reset-status').textContent = resposta.mensagem || resposta.erro || '';
    if(resposta.sucesso){ btn.disabled = true; btn.textContent = 'Solicitação enviada'; return; }
  }catch(erro){
    console.error(erro);
    document.getElementById('conta-reset-status').textContent = 'Erro de conexão.';
  }
  definirCarregando(btn, false, 'Solicitar nova senha');
}
