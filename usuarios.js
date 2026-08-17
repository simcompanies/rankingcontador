/* ============================================================================
   usuarios.js
   ----------------------------------------------------------------------------
   Painel de administração de usuários (Módulo 4, Configurações Gerais,
   exclusivo de administrador): listar contas, promover/rebaixar papel,
   remover conta, reenviar código de troca de senha, e o log de atividade
   recente que acompanha a mesma tela.

   Depende de: config-api.js (chamarAPI, chamarAPIGet, tratarErroSessaoOuPermissao),
   estado-global.js (usuariosRoster, atividadeLog, usuariosCarregado, sessaoUsuario).
   ============================================================================ */

/* Busca a lista de usuários + log de atividade no backend, uma vez só por
   sessão (cacheado em usuariosCarregado) a menos que `forcar` seja true.
   Só executa de fato se a sessão atual for de administrador. */
async function carregarUsuariosSeNecessario(forcar){
  if(!sessaoUsuario || !souAdmin()) return;
  if(usuariosCarregado && !forcar) return;
  try{
    const resposta = await chamarAPIGet({ action:'listarUsuarios', token: sessaoUsuario.token });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      throw new Error(resposta.erro || 'Falha ao carregar');
    }
    usuariosRoster = (resposta.dados && resposta.dados.usuarios) || [];
    atividadeLog = (resposta.dados && resposta.dados.log) || [];
    usuariosCarregado = true;
  }catch(e){
    console.error('Erro ao carregar usuários', e);
    usuariosRoster = []; atividadeLog = [];
  }
  renderUsuarios();
}

/* Desenha a lista de usuários (nome, e-mail, papel, aviso se a pessoa
   pediu troca de senha) com os botões de ação — exceto na própria linha
   do usuário logado, que mostra só "é você" em vez de ações — e, junto,
   a lista de atividade recente (#log-list). */
function renderUsuarios(){
  const list = document.getElementById('user-list');
  if(list){
    list.innerHTML = usuariosRoster.length
      ? usuariosRoster.map(function(u){
          const souEu = sessaoUsuario && String(u.idUsuario) === String(sessaoUsuario.idUsuario);
          const badge = `<span class="role-badge ${u.papel==='administrador'?'admin':''}">${u.papel}</span>`;
          const pendente = u.resetPendente
            ? `<span class="pending-reset-badge">🔑 solicitou nova senha</span>`
            : '';
          let acoes = '<span class="empty-hint" style="padding:0;">é você</span>';
          if(!souEu){
            const proximoPapel = u.papel === 'administrador' ? 'membro' : 'administrador';
            const rotuloPapel = u.papel === 'administrador' ? '↓ tornar membro' : '↑ tornar admin';
            acoes = `<button class="del-x-btn" onclick="handleAlterarPapel('${u.idUsuario}', '${proximoPapel}')" title="Alterar papel">${rotuloPapel}</button>`;
            if(u.resetPendente){
              acoes += `<button class="del-x-btn" onclick="handleAdminEnviarReset('${u.idUsuario}')" title="Enviar código temporário">Enviar código</button>`;
            }
            acoes += `<button class="del-x-btn" onclick="handleRemoverUsuario('${u.idUsuario}')" title="Remover">✕</button>`;
          }
          return `<div class="user-row">
            <span class="user-row-name">${u.nome} <span class="user-row-email">${u.email}</span> ${badge} ${pendente}</span>
            <span class="row-btns">${acoes}</span>
          </div>`;
        }).join('')
      : '<div class="empty-hint">Nenhum usuário cadastrado ainda.</div>';
  }

  const logList = document.getElementById('log-list');
  if(logList){
    logList.innerHTML = atividadeLog.length
      ? atividadeLog.map(function(l){
          const data = l.dataHora ? new Date(l.dataHora).toLocaleString('pt-BR') : '—';
          return `<div class="log-row">
            <span class="log-row-data">${data}</span>
            <span class="log-row-usuario">${l.usuario}</span>
            <span class="log-row-acao">${l.acao}</span>
          </div>`;
        }).join('')
      : '<div class="empty-hint">Nenhuma atividade registrada ainda.</div>';
  }
}

// Botão de alternar papel (membro ↔ administrador) de um usuário, com confirmação.
async function handleAlterarPapel(idUsuario, novoPapel){
  if(!confirm('Alterar o papel deste usuário para "' + novoPapel + '"?')) return;
  try{
    const resposta = await chamarAPI({ action:'adminAlterarPapel', token:sessaoUsuario.token, idUsuario:idUsuario, novoPapel:novoPapel });
    if(!resposta.sucesso){ if(tratarErroSessaoOuPermissao(resposta)) return; alert(resposta.erro || 'Não foi possível alterar.'); return; }
    await carregarUsuariosSeNecessario(true);
  }catch(erro){
    console.error(erro);
    alert('Erro de conexão ao alterar papel.');
  }
}

// Botão de remover um usuário (perde acesso imediatamente), com confirmação.
async function handleRemoverUsuario(idUsuario){
  if(!confirm('Remover este usuário? Ele perde o acesso ao sistema imediatamente.')) return;
  try{
    const resposta = await chamarAPI({ action:'adminRemoverUsuario', token:sessaoUsuario.token, idUsuario:idUsuario });
    if(!resposta.sucesso){ if(tratarErroSessaoOuPermissao(resposta)) return; alert(resposta.erro || 'Não foi possível remover.'); return; }
    await carregarUsuariosSeNecessario(true);
  }catch(erro){
    console.error(erro);
    alert('Erro de conexão ao remover usuário.');
  }
}

/* Reenvia o código de troca de senha para um usuário que já havia
   solicitado (resetPendente) — atalho do administrador para não depender
   só do fluxo de "esqueci minha senha" da própria pessoa. */
async function handleAdminEnviarReset(idUsuario){
  try{
    const resposta = await chamarAPI({ action:'adminEnviarReset', token:sessaoUsuario.token, idUsuario:idUsuario });
    if(!resposta.sucesso){ if(tratarErroSessaoOuPermissao(resposta)) return; alert(resposta.erro || 'Não foi possível enviar o código.'); return; }
    alert(resposta.mensagem || 'Código enviado.');
    await carregarUsuariosSeNecessario(true);
  }catch(erro){
    console.error(erro);
    alert('Erro de conexão ao enviar código.');
  }
}
