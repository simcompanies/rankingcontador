/* ============================================================================
   dialogos.js — sistema visual unificado de diálogos do Ranking Geral
   ----------------------------------------------------------------------------
   Substitui as caixas nativas do navegador por componentes do próprio app.
   - uiAlert: informação/sucesso/aviso/erro
   - uiConfirm: confirmação assíncrona
   - uiPrompt: entrada de texto assíncrona
   Todos os diálogos são enfileirados, acessíveis por teclado e responsivos.
   ============================================================================ */
(function(global){
  'use strict';

  const fila = [];
  let ativo = false;

  const ICONES = {
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10v6"></path><path d="M12 7h.01"></path></svg>',
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 8.5"></path></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path></svg>',
    danger: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6M15 9l-6 6"></path></svg>',
    question: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .65-1.5 1.15-1.5 2.25"></path><path d="M12 17h.01"></path></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>'
  };

  function inferirTipo(mensagem){
    const s = String(mensagem || '').toLowerCase();
    if(/sucesso|salv[oa]|enviad|criad[oa]|encerrad[oa]|sincronizad|conclu[ií]d/.test(s)) return 'success';
    if(/erro|falha|inv[aá]lid|n[aã]o foi poss[ií]vel|expirou|offline|conflito/.test(s)) return 'danger';
    if(/aten[cç][aã]o|aviso|bloquead|restrit|apenas administradores|j[aá] existe|remover|apagar|descartar/.test(s)) return 'warning';
    return 'info';
  }

  function tituloPadrao(tipo, modo){
    if(modo === 'confirm') return tipo === 'danger' ? 'Confirmar ação crítica' : 'Confirmar ação';
    if(modo === 'prompt') return 'Editar informação';
    return ({success:'Concluído', warning:'Atenção', danger:'Não foi possível concluir', info:'Informação'})[tipo] || 'Informação';
  }

  function garantirCamada(){
    let camada = document.getElementById('rg-dialog-layer');
    if(camada) return camada;
    camada = document.createElement('div');
    camada.id = 'rg-dialog-layer';
    camada.className = 'rg-dialog-layer';
    camada.setAttribute('aria-live','polite');
    document.body.appendChild(camada);
    return camada;
  }

  function processarFila(){
    if(ativo || !fila.length) return;
    ativo = true;
    const item = fila.shift();
    abrir(item.opcoes).then(item.resolve, item.reject).finally(()=>{
      ativo = false;
      processarFila();
    });
  }

  function enfileirar(opcoes){
    return new Promise((resolve,reject)=>{
      fila.push({opcoes,resolve,reject});
      processarFila();
    });
  }

  function abrir(opcoes){
    return new Promise((resolve)=>{
      const camada = garantirCamada();
      const anterior = document.activeElement;
      const modo = opcoes.mode || 'alert';
      const tipo = opcoes.variant || (modo === 'confirm' ? 'warning' : (modo === 'prompt' ? 'info' : inferirTipo(opcoes.message)));
      const icone = modo === 'confirm' ? (tipo === 'danger' ? ICONES.danger : ICONES.question) : (modo === 'prompt' ? ICONES.edit : (ICONES[tipo] || ICONES.info));

      const overlay = document.createElement('div');
      overlay.className = 'rg-dialog-overlay';
      overlay.dataset.variant = tipo;

      const card = document.createElement('section');
      card.className = 'rg-dialog-card';
      card.setAttribute('role', modo === 'alert' ? 'alertdialog' : 'dialog');
      card.setAttribute('aria-modal','true');
      card.setAttribute('aria-labelledby','rg-dialog-title-active');
      card.setAttribute('aria-describedby','rg-dialog-message-active');

      const topo = document.createElement('div');
      topo.className = 'rg-dialog-head';
      const iconWrap = document.createElement('div');
      iconWrap.className = 'rg-dialog-icon';
      iconWrap.innerHTML = icone;
      const titleWrap = document.createElement('div');
      titleWrap.className = 'rg-dialog-heading';
      const eyebrow = document.createElement('div');
      eyebrow.className = 'rg-dialog-eyebrow';
      eyebrow.textContent = opcoes.eyebrow || 'Ranking Geral';
      const title = document.createElement('h2');
      title.id = 'rg-dialog-title-active';
      title.textContent = opcoes.title || tituloPadrao(tipo, modo);
      titleWrap.append(eyebrow,title);
      topo.append(iconWrap,titleWrap);

      const body = document.createElement('div');
      body.className = 'rg-dialog-body';
      const msg = document.createElement('p');
      msg.id = 'rg-dialog-message-active';
      msg.className = 'rg-dialog-message';
      msg.textContent = String(opcoes.message || '');
      body.appendChild(msg);

      let input = null;
      if(modo === 'prompt'){
        const label = document.createElement('label');
        label.className = 'rg-dialog-field';
        const labelText = document.createElement('span');
        labelText.textContent = opcoes.inputLabel || 'Valor';
        input = document.createElement(opcoes.multiline ? 'textarea' : 'input');
        if(!opcoes.multiline) input.type = opcoes.inputType || 'text';
        input.value = opcoes.defaultValue == null ? '' : String(opcoes.defaultValue);
        input.placeholder = opcoes.placeholder || '';
        input.autocomplete = opcoes.autocomplete || 'off';
        if(opcoes.maxLength) input.maxLength = opcoes.maxLength;
        label.append(labelText,input);
        body.appendChild(label);
      }

      if(opcoes.hint){
        const hint = document.createElement('div');
        hint.className = 'rg-dialog-hint';
        hint.textContent = opcoes.hint;
        body.appendChild(hint);
      }

      const actions = document.createElement('div');
      actions.className = 'rg-dialog-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'rg-dialog-btn rg-dialog-btn-secondary';
      cancel.textContent = opcoes.cancelText || 'Cancelar';
      const primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'rg-dialog-btn ' + (tipo === 'danger' && modo === 'confirm' ? 'rg-dialog-btn-danger' : 'rg-dialog-btn-primary');
      primary.textContent = opcoes.confirmText || (modo === 'alert' ? 'Entendi' : (modo === 'prompt' ? 'Salvar' : 'Confirmar'));
      if(modo !== 'alert') actions.appendChild(cancel);
      actions.appendChild(primary);

      card.append(topo,body,actions);
      overlay.appendChild(card);
      camada.appendChild(overlay);

      let encerrado = false;
      function fechar(valor){
        if(encerrado) return;
        encerrado = true;
        document.removeEventListener('keydown', onKey, true);
        overlay.classList.add('rg-dialog-closing');
        window.setTimeout(()=>{
          overlay.remove();
          if(anterior && typeof anterior.focus === 'function'){
            try{ anterior.focus({preventScroll:true}); }catch(_){ try{ anterior.focus(); }catch(__){} }
          }
          resolve(valor);
        }, 150);
      }
      function confirmar(){
        if(modo === 'prompt') fechar(input ? input.value : '');
        else fechar(true);
      }
      function cancelar(){ fechar(modo === 'prompt' ? null : false); }
      function onKey(ev){
        if(ev.key === 'Escape' && modo !== 'alert'){ ev.preventDefault(); cancelar(); return; }
        if(ev.key === 'Enter' && !(input && input.tagName === 'TEXTAREA')){ ev.preventDefault(); confirmar(); return; }
        if(ev.key === 'Tab'){
          const focaveis = Array.from(card.querySelectorAll('button,input,textarea,select,[tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled);
          if(focaveis.length){
            const primeiro=focaveis[0], ultimo=focaveis[focaveis.length-1];
            if(ev.shiftKey && document.activeElement===primeiro){ev.preventDefault();ultimo.focus();}
            else if(!ev.shiftKey && document.activeElement===ultimo){ev.preventDefault();primeiro.focus();}
          }
        }
      }

      primary.addEventListener('click', confirmar);
      cancel.addEventListener('click', cancelar);
      overlay.addEventListener('mousedown',(ev)=>{ if(ev.target===overlay && modo!=='alert') cancelar(); });
      document.addEventListener('keydown', onKey, true);
      requestAnimationFrame(()=>{
        overlay.classList.add('rg-dialog-open');
        (input || primary).focus();
        if(input && typeof input.select === 'function') input.select();
      });
    });
  }

  function uiAlert(message, options){
    return enfileirar(Object.assign({mode:'alert',message:String(message == null ? '' : message)}, options || {}));
  }
  function uiConfirm(message, options){
    return enfileirar(Object.assign({mode:'confirm',message:String(message == null ? '' : message)}, options || {}));
  }
  function uiPrompt(message, defaultValue, options){
    return enfileirar(Object.assign({mode:'prompt',message:String(message == null ? '' : message),defaultValue:defaultValue == null ? '' : defaultValue}, options || {}));
  }

  global.uiAlert = uiAlert;
  global.uiConfirm = uiConfirm;
  global.uiPrompt = uiPrompt;

  // Mantém compatibilidade com os alert() antigos: visual próprio, sem caixa do navegador.
  global.alert = function(message){ void uiAlert(message); };
})(window);
