/* ================================================================
   a11y.js — MEMÓRIA DE ACESSIBILIDADE COMPARTILHADA
   ================================================================
   Um único arquivo, na RAIZ do site, incluído por TODAS as páginas.
   Resolve o problema de "o modo claro desliga quando eu volto".

   ----------------------------------------------------------------
   POR QUE ISSO ERA NECESSÁRIO
   ----------------------------------------------------------------
   Antes, o estado de acessibilidade viajava SÓ pela URL:

     index.html  --(?theme=light)-->  indexprimeiroano.html
                 --(?theme=light)-->  indexsime.html
                 <--(sem nada!)-----  botão "← 1º Ano"

   O botão de voltar era um <a href="indexprimeiroano.html"> puro,
   sem os parâmetros. Ao voltar, a página do 1º ano abria "limpa",
   caía no padrão (escuro) e o modo claro sumia. A corrente se
   rompia exatamente no caminho de volta.

   ----------------------------------------------------------------
   COMO ESTE ARQUIVO CONSERTA (3 camadas de segurança)
   ----------------------------------------------------------------
   1. MEMÓRIA (localStorage): toda página lê e grava a mesma chave
      "central_a11y_prefs". Mesmo que a URL venha vazia, o estado
      é recuperado da memória do navegador. localStorage é
      compartilhado por todo o site (raiz e subpastas), então
      funciona igual em /index.html e em /primeiroano/indexsime.html.

   2. RECARIMBAGEM DA URL (history.replaceState): se a página abriu
      sem parâmetros, este script reescreve a URL COM os parâmetros
      salvos ANTES do script próprio da página rodar. Assim todo o
      código que você já escreveu (scriptprimeiroano.js, scriptsime.js…)
      continua funcionando sem nenhuma alteração: ele lê
      location.search e encontra os valores certos.

   3. CARIMBO NOS LINKS: ao carregar, todo <a href="algo.html">
      da página — inclusive os botões de voltar — recebe os
      parâmetros atuais. A corrente não se rompe mais em nenhuma
      direção.

   ----------------------------------------------------------------
   AS DUAS CONVENÇÕES DE TEMA DO PROJETO
   ----------------------------------------------------------------
   Seu projeto cresceu com DOIS jeitos de pintar o tema claro:

     A) atributos no <html>   → style.css, styleprimeiroano.css,
        :root[data-theme="light"]   stylesegundoano.css, styleterceiroano.css,
                                    stylesie/siem/siqi/sitp.css

     B) classes no <body>     → stylesime.css, stylesima.css,
        body.light-mode             stylesiativ.css e TODOS os
                                    módulos do 2º e 3º ano

   Este script aplica AS DUAS AO MESMO TEMPO. Nenhum CSS precisa ser
   reescrito, e páginas novas funcionam com qualquer uma das duas.

   ----------------------------------------------------------------
   COMO INCLUIR (deve ser o PRIMEIRO script da página, no <head>)
   ----------------------------------------------------------------
     Na raiz .............. <script src="a11y.js"></script>
     Dentro de uma pasta .. <script src="../a11y.js"></script>

   Não use caminho absoluto ("/a11y.js"): ele quebra se o site for
   publicado numa subpasta (ex.: GitHub Pages em /usuario.github.io/repo/).
   ================================================================ */

(function () {
  'use strict';

  /* ---------------------------------------------------------------
     1. CONFIGURAÇÃO
     --------------------------------------------------------------- */

  // Mesma chave usada pelo script.js da Central: os dois se entendem.
  var CHAVE = 'central_a11y_prefs';

  // Nomes dos parâmetros na URL — exatamente como o buildUrl() do
  // script.js já monta. Não mude sem mudar lá também.
  var PARAMS = ['theme', 'reading', 'colorblind', 'contrast', 'fontscale', 'spacing', 'motion'];

  var DALTONISMOS = ['protanopia', 'deuteranopia', 'tritanopia', 'acromatopsia'];

  // Estado padrão (o que vale numa primeira visita, sem memória).
  var estado = {
    theme:      'dark',
    reading:    'off',
    colorblind: 'none',
    contrast:   false,
    fontScale:  1,
    spacing:    false,
    motion:     false
  };


  /* ---------------------------------------------------------------
     2. FUNÇÕES DE LEITURA (memória e URL)
     --------------------------------------------------------------- */

  // Converte "true"/"on"/"1" em true. Aceita os dois vocabulários
  // do projeto ("on/off" e "true/false") sem reclamar.
  function paraBooleano(valor) {
    return valor === true || valor === 'true' || valor === 'on' || valor === '1';
  }

  // Garante que um valor recebido de fora é seguro antes de usar.
  // Nunca confie cegamente na URL: o usuário pode digitar qualquer coisa.
  function higienizar(bruto) {
    return {
      theme:      bruto.theme === 'light' ? 'light' : 'dark',
      reading:    paraBooleano(bruto.reading) ? 'on' : 'off',
      colorblind: DALTONISMOS.indexOf(bruto.colorblind) !== -1 ? bruto.colorblind : 'none',
      contrast:   paraBooleano(bruto.contrast),
      spacing:    paraBooleano(bruto.spacing),
      motion:     paraBooleano(bruto.motion),
      fontScale:  limitarFonte(bruto.fontScale !== undefined ? bruto.fontScale : bruto.fontscale)
    };
  }

  function limitarFonte(valor) {
    var n = parseFloat(valor);
    if (isNaN(n)) return 1;
    return Math.min(1.5, Math.max(0.75, Math.round(n * 100) / 100));
  }

  function lerMemoria() {
    try {
      var cru = localStorage.getItem(CHAVE);
      return cru ? JSON.parse(cru) : null;
    } catch (e) {
      // Modo privado, cookies bloqueados ou arquivo aberto via file://
      return null;
    }
  }

  function gravarMemoria() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) { /* sem memória disponível: segue funcionando pela URL */ }
  }

  // Lê os parâmetros da URL. Devolve null se NENHUM deles estiver
  // presente — é assim que sabemos que a página abriu "limpa"
  // (link de voltar, favorito, F5 ou digitação direta).
  function lerURL() {
    var busca = window.location.search;
    if (!busca || busca.length < 2) return null;

    var encontrados = {};
    var achouAlgum = false;

    busca.replace(/^\?/, '').split('&').forEach(function (par) {
      if (!par) return;
      var corte = par.indexOf('=');
      var chave = corte === -1 ? par : par.slice(0, corte);
      var valor = corte === -1 ? '' : par.slice(corte + 1);
      try { valor = decodeURIComponent(valor.replace(/\+/g, ' ')); } catch (e) { /* valor inválido: usa como veio */ }
      if (PARAMS.indexOf(chave) !== -1) {
        encontrados[chave] = valor;
        achouAlgum = true;
      }
    });

    return achouAlgum ? encontrados : null;
  }


  /* ---------------------------------------------------------------
     3. DECIDIR O ESTADO — a ordem de prioridade é o coração do fix
     --------------------------------------------------------------- */
  // URL vence memória (o hub acabou de dizer o que quer).
  // Memória vence padrão (o usuário já escolheu antes).
  // Padrão só vale na primeiríssima visita.

  var daURL = lerURL();
  var daMemoria = lerMemoria();
  var precisaRecarimbarURL = false;

  if (daURL) {
    estado = higienizar(daURL);
  } else if (daMemoria) {
    estado = higienizar(daMemoria);
    precisaRecarimbarURL = true;   // <- este é o caso do botão "voltar"
  }

  gravarMemoria();


  /* ---------------------------------------------------------------
     4. MONTAR A QUERY STRING (usada na URL e nos links)
     --------------------------------------------------------------- */
  function queryString() {
    return '?theme=' + encodeURIComponent(estado.theme) +
           '&reading=' + encodeURIComponent(estado.reading) +
           '&colorblind=' + encodeURIComponent(estado.colorblind) +
           '&contrast=' + encodeURIComponent(estado.contrast) +
           '&fontscale=' + encodeURIComponent(estado.fontScale) +
           '&spacing=' + encodeURIComponent(estado.spacing) +
           '&motion=' + encodeURIComponent(estado.motion);
  }

  // Reescreve a URL da barra de endereços SEM recarregar a página.
  // Feito agora, no <head>, para que o script próprio da página
  // (que roda no fim do <body>) já encontre os parâmetros prontos.
  if (precisaRecarimbarURL) {
    try {
      history.replaceState(null, '', window.location.pathname + queryString() + window.location.hash);
    } catch (e) { /* file:// não permite: as camadas 1 e 3 cobrem */ }
  }


  /* ---------------------------------------------------------------
     5. APLICAR O ESTADO NA PÁGINA (as duas convenções)
     --------------------------------------------------------------- */
  var html = document.documentElement;

  function aplicarNoHtml() {
    // Convenção A — atributos no <html>, lidos por :root[data-...]
    html.setAttribute('data-theme',      estado.theme);
    html.setAttribute('data-contrast',   estado.contrast ? 'on' : 'off');
    html.setAttribute('data-reading',    estado.reading);
    html.setAttribute('data-spacing',    estado.spacing ? 'on' : 'off');
    html.setAttribute('data-motion',     estado.motion ? 'on' : 'off');
    html.setAttribute('data-colorblind', estado.colorblind);

    // Duas variáveis porque o projeto usa os dois nomes:
    // --font-scale (menus, SIE, SIEM…) e --a11y-font-scale (SIME…).
    html.style.setProperty('--font-scale', estado.fontScale);
    html.style.setProperty('--a11y-font-scale', estado.fontScale);

    // Ajuda o navegador a pintar barras de rolagem e campos de
    // formulário na cor certa — detalhe de acessibilidade real.
    html.style.colorScheme = estado.theme === 'light' ? 'light' : 'dark';
  }

  function aplicarNoBody() {
    var body = document.body;
    if (!body) return;

    // Convenção B — classes no <body>, lidas por body.light-mode etc.
    alternar(body, 'light-mode',    estado.theme === 'light');
    alternar(body, 'high-contrast', estado.contrast);
    alternar(body, 'simple-read',   estado.reading === 'on');
    alternar(body, 'wide-spacing',  estado.spacing);
    alternar(body, 'reduce-motion', estado.motion);
  }

  // classList.toggle(nome, condição) não funciona no IE e em
  // navegadores antigos; esta versão funciona em todos.
  function alternar(elemento, classe, ligado) {
    if (ligado) elemento.classList.add(classe);
    else elemento.classList.remove(classe);
  }

  // O filtro de daltonismo NUNCA vai no <body> ou <html>: isso
  // quebra position:fixed e o layout inteiro dos simuladores.
  // Vai numa camada própria, com backdrop-filter.
  function aplicarDaltonismo() {
    var camada = document.getElementById('colorblindOverlay');
    if (!camada) return;
    var filtro = estado.colorblind === 'none' ? 'none' : 'url(#f-' + estado.colorblind + ')';
    camada.style.backdropFilter = filtro;
    camada.style.webkitBackdropFilter = filtro;
  }

  // Aplica no <html> IMEDIATAMENTE, antes do primeiro pixel na tela.
  // É isso que elimina o "flash escuro" ao abrir uma página no modo claro.
  aplicarNoHtml();


  /* ---------------------------------------------------------------
     6. CARIMBAR OS LINKS — a corrente nunca mais se rompe
     --------------------------------------------------------------- */
  function carimbarLinks() {
    var links = document.querySelectorAll('a[href]');
    var query = queryString();

    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute('href');
      if (!href) return;

      // Ignora o que não é navegação interna para outra página HTML:
      // âncoras (#), links externos, mailto:, tel:, javascript:.
      if (href.charAt(0) === '#') return;
      if (/^(https?:)?\/\//i.test(href)) return;
      if (/^(mailto|tel|javascript|data):/i.test(href)) return;

      // Separa caminho, query antiga e âncora.
      var ancora = '';
      var semAncora = href;
      var corteAncora = href.indexOf('#');
      if (corteAncora !== -1) {
        ancora = href.slice(corteAncora);
        semAncora = href.slice(0, corteAncora);
      }
      var caminho = semAncora.split('?')[0];

      // Só carimba se for de fato um arquivo .html.
      if (!/\.html$/i.test(caminho)) return;

      // Sempre reconstrói do zero: nunca acumula "?theme=...?theme=..."
      link.setAttribute('href', caminho + query + ancora);
    });

    /* IMPORTANTE: os cartões dos menus têm data-file e o script da
       página faz preventDefault + monta a própria URL. Por isso NÃO
       tocamos em data-file — se carimbássemos os dois, a URL final
       sairia com a query duplicada. O href carimbado fica como
       reserva: se o JS da página falhar, o link ainda leva o tema. */
  }


  /* ---------------------------------------------------------------
     7. LIGAR TUDO NOS MOMENTOS CERTOS
     --------------------------------------------------------------- */
  function aoCarregar() {
    aplicarNoBody();
    aplicarDaltonismo();
    carimbarLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aoCarregar);
  } else {
    aoCarregar();
  }

  // Voltar pelo botão do navegador pode restaurar a página do cache
  // (bfcache) sem rodar scripts de novo. Este evento cobre esse caso.
  window.addEventListener('pageshow', function (evento) {
    if (evento.persisted) {
      var salvo = lerMemoria();
      if (salvo) estado = higienizar(salvo);
      window.A11Y.estado = estado;
      aplicarNoHtml();
      aplicarNoBody();
      aplicarDaltonismo();
      window.dispatchEvent(new CustomEvent('a11y:change', { detail: estado }));
    }
  });


  /* ---------------------------------------------------------------
     8. API PÚBLICA — para os scripts das páginas usarem
     --------------------------------------------------------------- */
  // Exemplo, dentro de scriptsime.js:
  //   if (window.A11Y.estado.motion) { /* não animar */ }
  //   window.A11Y.definir('theme', 'light');   // se um dia houver
  //                                            // painel local
  window.A11Y = {
    estado: estado,

    // Muda uma preferência, salva, aplica e recarimba os links.
    definir: function (chave, valor) {
      var novo = {};
      PARAMS.concat(['fontScale']).forEach(function (k) { novo[k] = estado[k]; });
      novo[chave] = valor;
      estado = higienizar(novo);
      window.A11Y.estado = estado;
      gravarMemoria();
      aplicarNoHtml();
      aplicarNoBody();
      aplicarDaltonismo();
      carimbarLinks();
      // Avisa quem estiver ouvindo (ex.: o painel visual de acessibilidade)
      // que o estado mudou, para atualizar os controles na tela sem duplicar
      // a lógica de leitura/aplicação que já mora inteira aqui.
      window.dispatchEvent(new CustomEvent('a11y:change', { detail: estado }));
    },

    // Monta um link para outra página já com o estado atual.
    link: function (arquivo) {
      if (!arquivo || !/\.html$/i.test(arquivo)) return '#';
      return arquivo.split('?')[0] + queryString();
    },

    query: queryString,
    recarimbar: carimbarLinks
  };

})();
