/* ============================================================================
   acessibilidade.js
   ----------------------------------------------------------------------------
   Controlador do MENU/painel de acessibilidade visível no app: liga os
   controles visuais (botões de tema, switches, slider de fonte, seletor de
   daltonismo) à API pública já exposta por a11y.js (window.A11Y), que é quem
   de fato guarda, aplica e memoriza cada preferência.

   Este arquivo só cuida da UI — abrir/fechar o painel, refletir o estado
   atual nos controles e repassar cada mudança para
   window.A11Y.definir(chave, valor). Nenhuma lógica de tema/contraste/fonte/
   daltonismo mora aqui, para não duplicar o que a11y.js já resolve sozinho.

   O botão e o painel ficam embutidos direto em index.html (não são um
   módulo buscado por fetch), de propósito: assim funcionam mesmo na tela
   de login, antes de qualquer sessão existir.

   Depende de: a11y.js (window.A11Y — carregado no <head>, antes de tudo).
   ============================================================================ */

(function () {
  'use strict';

  var painelAberto = false;

  function els(){
    return {
      btnAbrir:     document.getElementById('a11y-toggle-btn'),
      overlay:      document.getElementById('a11y-panel-overlay'),
      painel:       document.getElementById('a11y-panel'),
      btnFechar:    document.getElementById('a11y-fechar-btn'),
      btnRestaurar: document.getElementById('a11y-restaurar-btn'),
      temaBtns:     document.querySelectorAll('[data-a11y-tema]'),
      contraste:    document.getElementById('a11y-contraste'),
      leitura:      document.getElementById('a11y-leitura'),
      espacamento:  document.getElementById('a11y-espacamento'),
      movimento:    document.getElementById('a11y-movimento'),
      daltonismo:   document.getElementById('a11y-daltonismo'),
      fonteRange:   document.getElementById('a11y-fonte'),
      fonteValor:   document.getElementById('a11y-fonte-valor')
    };
  }

  function abrirPainel(){
    var e = els();
    if(!e.painel || !e.overlay) return;
    painelAberto = true;
    e.overlay.classList.add('open');
    if(e.btnAbrir) e.btnAbrir.setAttribute('aria-expanded', 'true');
    sincronizarControles();
    // Foca o primeiro controle interativo do painel — ajuda quem navega por teclado.
    var primeiroFoco = e.painel.querySelector('button, select, input');
    if(primeiroFoco) primeiroFoco.focus();
  }

  function fecharPainel(){
    var e = els();
    if(!e.painel || !e.overlay) return;
    painelAberto = false;
    e.overlay.classList.remove('open');
    if(e.btnAbrir){
      e.btnAbrir.setAttribute('aria-expanded', 'false');
      e.btnAbrir.focus();
    }
  }

  function alternarPainel(){
    if(painelAberto) fecharPainel(); else abrirPainel();
  }

  // Reflete window.A11Y.estado nos controles visuais do painel — chamada ao
  // abrir o painel e sempre que o estado mudar (inclusive por fora do
  // painel, ex.: restauração de bfcache ao voltar pelo botão do navegador —
  // ver o evento "a11y:change" disparado em a11y.js).
  function sincronizarControles(){
    if(!window.A11Y) return;
    var estado = window.A11Y.estado;
    var e = els();

    e.temaBtns.forEach(function(btn){
      var ligado = btn.getAttribute('data-a11y-tema') === estado.theme;
      btn.classList.toggle('active', ligado);
      btn.setAttribute('aria-pressed', ligado ? 'true' : 'false');
    });

    if(e.contraste)   e.contraste.checked = !!estado.contrast;
    if(e.leitura)      e.leitura.checked = estado.reading === 'on';
    if(e.espacamento) e.espacamento.checked = !!estado.spacing;
    if(e.movimento)    e.movimento.checked = !!estado.motion;
    if(e.daltonismo)  e.daltonismo.value = estado.colorblind || 'none';
    if(e.fonteRange)  e.fonteRange.value = estado.fontScale;
    if(e.fonteValor)  e.fonteValor.textContent = Math.round(estado.fontScale * 100) + '%';
  }

  // Restaura as 7 preferências para o padrão de fábrica, uma chamada de
  // definir() por chave — cada chamada já salva e reaplica sozinha.
  function restaurarPadrao(){
    if(!window.A11Y) return;
    window.A11Y.definir('theme', 'dark');
    window.A11Y.definir('reading', false);
    window.A11Y.definir('colorblind', 'none');
    window.A11Y.definir('contrast', false);
    window.A11Y.definir('spacing', false);
    window.A11Y.definir('motion', false);
    window.A11Y.definir('fontScale', 1);
    sincronizarControles();
  }

  function ligar(){
    var e = els();
    if(!e.btnAbrir || !window.A11Y) return;

    e.btnAbrir.addEventListener('click', alternarPainel);
    if(e.btnFechar) e.btnFechar.addEventListener('click', fecharPainel);
    if(e.overlay) e.overlay.addEventListener('click', function(evento){
      if(evento.target === e.overlay) fecharPainel();
    });
    document.addEventListener('keydown', function(evento){
      if(evento.key === 'Escape' && painelAberto) fecharPainel();
    });

    e.temaBtns.forEach(function(btn){
      btn.addEventListener('click', function(){
        window.A11Y.definir('theme', btn.getAttribute('data-a11y-tema'));
      });
    });

    if(e.contraste) e.contraste.addEventListener('change', function(){
      window.A11Y.definir('contrast', e.contraste.checked);
    });
    if(e.leitura) e.leitura.addEventListener('change', function(){
      window.A11Y.definir('reading', e.leitura.checked);
    });
    if(e.espacamento) e.espacamento.addEventListener('change', function(){
      window.A11Y.definir('spacing', e.espacamento.checked);
    });
    if(e.movimento) e.movimento.addEventListener('change', function(){
      window.A11Y.definir('motion', e.movimento.checked);
    });
    if(e.daltonismo) e.daltonismo.addEventListener('change', function(){
      window.A11Y.definir('colorblind', e.daltonismo.value);
    });
    if(e.fonteRange) e.fonteRange.addEventListener('input', function(){
      window.A11Y.definir('fontScale', parseFloat(e.fonteRange.value));
    });
    if(e.btnRestaurar) e.btnRestaurar.addEventListener('click', restaurarPadrao);

    // Mantém o painel sincronizado se o estado mudar por fora dele (ver
    // acima) — sem isso, o painel podia mostrar um tema diferente do que
    // está realmente aplicado na tela depois de um "voltar" pelo navegador.
    window.addEventListener('a11y:change', sincronizarControles);

    sincronizarControles();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ligar);
  } else {
    ligar();
  }
})();
