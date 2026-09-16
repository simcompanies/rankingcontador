/* ============================================================================
   sidebar.js
   ----------------------------------------------------------------------------
   Comportamento do menu lateral: abrir/fechar em telas estreitas (mobile,
   com overlay escurecendo o resto da tela) e recolher/expandir em telas
   largas (desktop, com preferência lembrada em localStorage).

   Depende de: nada além do DOM — não lê/escreve estado de ranking.
   ============================================================================ */

// Mobile: abre/fecha a sidebar como um painel sobreposto (com overlay
// escuro atrás). `abrir` é opcional — se omitido, apenas alterna o estado atual.
function toggleSidebarMobile(abrir){
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const estado = typeof abrir === 'boolean' ? abrir : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', estado);
  overlay.classList.toggle('show', estado);
}

// Desktop: recolhe a sidebar para uma faixa estreita (só ícones) ou expande
// de volta, e lembra a preferência em localStorage para a próxima visita.
function toggleSidebarCollapse(){
  const sidebar = document.getElementById('sidebar');
  const collapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('rankingGeral_sidebarCollapsed', collapsed ? '1' : '0');
  const btn = document.getElementById('sidebar-collapse-btn');
  if(btn) btn.textContent = collapsed ? '»' : '«';
}
