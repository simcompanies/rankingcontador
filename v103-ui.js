/* V107 — camada visual/navegação contextual.
   Não substitui a mecânica oficial. Usa delegação de eventos para que os
   botões continuem funcionais mesmo quando o módulo oficial reconstrói DOM. */
(function () {
  'use strict';

  const state = { initialized: false, currentView: 'faixas' };
  const $ = (id) => document.getElementById(id);

  const official = {
    faixas: {
      'Visão geral': {
        title: 'Visão geral do ranking',
        text: 'Exibe o ranking oficial das duas faixas.',
        actions: [
          ['Abrir visão geral', () => scrollToId('view-faixas')],
          ['Ir para Faixa X', () => scrollToId('div-x')],
          ['Ir para Faixa Y', () => scrollToId('div-y')]
        ]
      },
      'Faixa X': { title: 'Faixa X', text: 'Acesso ao ranking oficial da Faixa X.', actions: [['Abrir Faixa X', () => scrollToId('div-x')]] },
      'Faixa Y': { title: 'Faixa Y', text: 'Acesso ao ranking oficial da Faixa Y.', actions: [['Abrir Faixa Y', () => scrollToId('div-y')]] }
    },
    analises: {
      'Visão geral': { title: 'Análises gerais', text: 'Estatísticas e componentes analíticos oficiais.', actions: [['Abrir análises', () => scrollToId('view-analises')]] },
      'Período': { title: 'Filtrar por período', text: 'Usa o filtro oficial por intervalo de datas.', actions: [['Usar filtro por período', () => officialCall(() => window.setFiltroModo('periodo'))]] },
      'Dias específicos': { title: 'Filtrar por dias específicos', text: 'Usa a seleção oficial de dias lançados.', actions: [['Selecionar dias', () => officialCall(() => window.setFiltroModo('dias'))]] },
      'Evolução': { title: 'Evolução acumulada', text: 'Mostra a evolução calculada pelo módulo oficial.', actions: [['Ver evolução da Faixa X', () => scrollToId('evolucao-chart-x')], ['Ver evolução da Faixa Y', () => scrollToId('evolucao-chart-y')]] },
      'Mapa de desempenho': { title: 'Mapa de desempenho', text: 'Cruza participante e dia usando os dados oficiais.', actions: [['Ver mapa da Faixa X', () => scrollToId('heatmap-wrap-x')], ['Ver mapa da Faixa Y', () => scrollToId('heatmap-wrap-y')]] },
      'Resumos salvos': { title: 'Resumos salvos', text: 'Consulta o histórico oficial persistido.', actions: [['Abrir resumos', () => scrollToId('ultimo-resumo-wrap')]] }
    },
    lancar: {
      'Preencher': { title: 'Preencher lançamento', text: 'Abre o formulário oficial de lançamento.', actions: [['Abrir preenchimento', () => officialCall(() => window.switchLaunchTab('form'))]] },
      'Colar dados': { title: 'Colar dados', text: 'Abre o fluxo oficial de colagem e conferência.', actions: [['Abrir colagem', () => officialCall(() => window.switchLaunchTab('paste'))]] },
      'OCR': { title: 'Ler pontuação de um print', text: 'Usa o fluxo oficial de OCR.', actions: [['Selecionar imagem', () => { const el = $('ocr-file-input'); if (el) el.click(); }]] },
      'Resumo do dia': { title: 'Resumo do dia', text: 'Usa a geração oficial do resumo diário.', actions: [['Gerar resumo', () => officialCall(() => window.generateSummary())], ['Ir para resumo', () => scrollToId('summary-output')]] },
      'Dias lançados': { title: 'Dias lançados', text: 'Consulta a lista oficial de dias lançados.', actions: [['Abrir dias lançados', () => scrollToId('day-list')]] }
    },
    config: {
      'Configurações gerais': { title: 'Configurações gerais', text: 'Área oficial de administração e gerenciamento.', actions: [['Abrir configurações', () => scrollToId('view-config')]] },
      'Minha conta': { title: 'Minha conta', text: 'Abre a conta da sessão atual.', actions: [['Abrir minha conta', () => officialCall(() => window.mostrarView('conta'))]] },
      'Usuários': { title: 'Usuários', text: 'Painel oficial de usuários, respeitando permissões.', actions: [['Abrir usuários', () => scrollToId('user-list')]] },
      'Atividade recente': { title: 'Atividade recente', text: 'Mostra a atividade registrada pelo sistema oficial.', actions: [['Abrir atividade', () => scrollToId('log-list')]] },
      'Resumos salvos': { title: 'Resumos salvos', text: 'Consulta o histórico oficial de resumos.', actions: [['Abrir histórico', () => scrollToId('resumos-salvos-lista')]] },
      'Sair': { title: 'Sair da conta', text: 'Encerra a sessão pelo mecanismo oficial.', actions: [['Sair da conta', () => officialCall(() => { if (typeof window.handleLogout === 'function') window.handleLogout(); })]] }
    }
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function isLogged() {
    const login = $('view-modulo-0');
    return !login || login.classList.contains('hidden');
  }

  function activeView() {
    const views = ['faixas', 'analises', 'lancar', 'config', 'conta'];
    for (const view of views) {
      const el = $('view-' + view);
      if (el && !el.classList.contains('hidden')) return view;
    }
    return 'faixas';
  }

  function scrollToId(id) {
    const el = $(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    closeSheet();
  }

  function officialCall(fn) {
    try { fn(); } catch (error) { console.error('[V107] ação oficial falhou:', error); }
    closeSheet();
  }

  function openSheet(item) {
    const overlay = $('v105-sheet-overlay');
    const body = $('v105-sheet-body');
    const title = $('v105-sheet-title');
    if (!overlay || !body || !title || !item) return;
    title.textContent = item.title;
    body.innerHTML = '<p class="v105-sheet-description">' + escapeHtml(item.text) + '</p>' +
      '<div class="v105-sheet-actions">' +
      item.actions.map((a, i) => '<button type="button" class="v105-sheet-action" data-v107-action="' + i + '">' + escapeHtml(a[0]) + '</button>').join('') +
      '</div>';
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('v105-sheet-open');
    state.sheetItem = item;
  }

  function closeSheet() {
    const overlay = $('v105-sheet-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('v105-sheet-open');
    state.sheetItem = null;
  }

  function render(view) {
    const nav = $('v102-bottom-nav');
    const ctx = $('v102-context-bar');
    if (!nav || !ctx) return;
    const normalized = view === 'conta' ? 'config' : view;
    const items = official[normalized] || {};
    const labels = Object.keys(items);
    state.currentView = normalized;

    nav.querySelectorAll('.v102-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.v102View === normalized);
    });

    ctx.dataset.count = String(labels.length);
    ctx.innerHTML = labels.map((label, index) =>
      '<button type="button" class="v102-context-btn" data-v107-context="' + index + '">' + escapeHtml(label) + '</button>'
    ).join('');
  }

  function syncVisibility() {
    const nav = $('v102-bottom-nav');
    const ctx = $('v102-context-bar');
    if (!nav || !ctx) return;
    const logged = isLogged();
    nav.style.display = logged ? '' : 'none';
    ctx.style.display = logged ? 'flex' : 'none';
    if (logged) render(activeView());
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Delegação: os botões de contexto são recriados a cada troca de view.
    document.addEventListener('click', function (event) {
      const navButton = event.target.closest && event.target.closest('.v102-nav-btn');
      if (navButton) {
        event.preventDefault();
        const view = navButton.dataset.v102View;
        if (typeof window.mostrarView === 'function') {
          window.mostrarView(view);
          // Atualiza imediatamente a camada visual. Não dependemos de um
          // MutationObserver de atributos (que poderia entrar em loop).
          render(view);
        } else {
          console.error('[V107] mostrarView não está disponível.');
        }
        return;
      }

      const contextButton = event.target.closest && event.target.closest('.v102-context-btn');
      if (contextButton) {
        event.preventDefault();
        const ctx = $('v102-context-bar');
        const items = official[state.currentView] || {};
        const labels = Object.keys(items);
        const index = Number(contextButton.dataset.v107Context);
        ctx.querySelectorAll('.v102-context-btn').forEach((b) => b.classList.remove('active'));
        contextButton.classList.add('active');
        openSheet(items[labels[index]]);
        return;
      }

      const actionButton = event.target.closest && event.target.closest('.v105-sheet-action');
      if (actionButton && state.sheetItem) {
        event.preventDefault();
        const index = Number(actionButton.dataset.v107Action);
        const action = state.sheetItem.actions[index];
        if (action && typeof action[1] === 'function') action[1]();
        return;
      }

      if (event.target.closest && event.target.closest('#v105-sheet-close')) {
        event.preventDefault();
        closeSheet();
        return;
      }

      if (event.target === $('v105-sheet-overlay')) closeSheet();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSheet();
    });

    // O projeto oficial injeta os módulos por fetch. Observe apenas a
    // inserção de nós; observar alterações de `class` aqui cria um ciclo:
    // syncVisibility() -> render() -> classList -> MutationObserver -> ...
    // Esse ciclo bloqueava o thread principal e fazia todos os botões
    // parecerem sem resposta.
    const observer = new MutationObserver(() => {
      syncVisibility();
    });
    observer.observe(document.body, { subtree: true, childList: true });

    syncVisibility();
    setTimeout(syncVisibility, 250);
    setTimeout(syncVisibility, 800);
    setTimeout(syncVisibility, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
