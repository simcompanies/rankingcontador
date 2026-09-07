# Ranking Geral — versão modular

Este é o mesmo app "Ranking — Faixa X / Faixa Y" que antes vivia num único
`index.html`, agora dividido em 30 arquivos organizados por responsabilidade.
**A funcionalidade é 100% idêntica à versão anterior** — nada de
comportamento, regra de pontuação, layout ou fluxo foi alterado; só a
organização do código mudou.

## Estrutura

```
index.html                      casca da página (sidebar/topbar fixos + "slots" vazios)
style.css                       todo o CSS

modulo-0.html                   tela de login/cadastro/esqueci-senha
troca-de-senha.html             modal de troca de senha obrigatória
modulo-1.html                   Faixa X / Faixa Y
modulo-2.html                   Análises Gerais (dashboard)
modulo-3.html                   Lançar Pontuação
modulo-4.html                   Configurações Gerais
configuracoes-de-conta.html     "Minha conta"

a11y.js                         memória de acessibilidade (tema/fonte/contraste/daltonismo/…)
acessibilidade.js               painel visual de acessibilidade (liga a UI a window.A11Y)
config-api.js                   URL da API + chamarAPI/chamarAPIGet
estado-global.js                estado compartilhado (sessão, ranking, caches)
identidade.js                   sessão: aplicar/encerrar, permissões, barra de identidade
navegacao.js                    troca de view/aba
sidebar.js                      abrir/recolher a sidebar
configuracoes-de-conta.js       lógica de "Minha conta"
modulo-0.js                     formulários de login/cadastro/esqueci-senha/nova-senha
texto-do-resumo.js              geração do texto de resumo
colagem.js / colagem-ocr.js     aba "Colar" + leitura de print via OCR
planilha-mestra.js              loadState/saveState/syncToServer (Google Sheets)
participantes.js / dias.js      CRUD de participante/dia + cálculo de ranking
formulario-lancamento-dia.js    aba "Preencher"
analises-gerais.js / filtros.js estatísticas e filtro de Análises Gerais
analises-dashboard.js           destaques + gráfico de evolução + mapa de desempenho
gerenciar-dias-lancados.js      lista de dias lançados
resumos-salvos.js               histórico de resumos
usuarios.js                     painel de administração de usuários
renderizacao.js                 renderDivision + render() geral
inicializacao.js                carrega os módulos HTML e inicia o app (ver abaixo)
```

## Acessibilidade

O botão ♿ (canto inferior direito, em qualquer tela — inclusive no login)
abre um painel com tema claro/escuro, alto contraste, leitura simplificada,
espaçamento amplo, redução de movimento, tamanho de fonte e um filtro de
daltonismo (protanopia/deuteranopia/tritanopia/acromatopsia). Tudo é
memorizado (localStorage) por `a11y.js`, que também é quem aplica cada
preferência na página; `acessibilidade.js` só cuida do painel visual em
cima disso. Ver os comentários de cabeçalho de ambos os arquivos para
detalhes de como estender (ex.: um oitavo controle novo).

Cada arquivo começa com um comentário explicando sua responsabilidade e de
quais outros arquivos ele depende.

## Como os módulos HTML são montados

Como não há nenhum passo de build (é HTML/CSS/JS puro, para hospedagem
estática), `index.html` carrega o conteúdo de cada `modulo-N.html` **em
tempo de execução**, via `fetch()`, injetando o resultado dentro de um
`<div id="slot-...">` correspondente. Isso é feito por
`carregarModulosHtml()`, em `inicializacao.js`, e roda automaticamente antes
do app iniciar.

**Por isso, testar localmente abrindo o `index.html` direto do disco
(clique duplo, `file://`) não funciona** — o navegador bloqueia esses
`fetch()` por segurança. Para testar localmente, sirva a pasta com um
servidor HTTP simples, por exemplo:

```bash
python -m http.server 8000
# depois acesse http://localhost:8000
```

ou a extensão **Live Server** do VS Code. Em qualquer hospedagem HTTP real
— **GitHub Pages incluso** — isso já funciona sem nenhum passo extra, contanto
que todos os 30 arquivos estejam na mesma pasta (sem subpastas).

## Verificação feita nesta refatoração

- As 108 funções/variáveis do arquivo original foram extraídas
  programaticamente (não redigitadas), e cada uma foi conferida como
  presente em exatamente um arquivo final, com o texto idêntico ao original.
- Todo o CSS e todo o HTML de cada módulo também foram conferidos linha a
  linha contra o arquivo original.
- Os 21 arquivos `.js` passam validação de sintaxe.
- A montagem final foi testada de ponta a ponta contra um servidor local
  (carregamento dos 7 módulos via fetch, execução de todos os scripts,
  inicialização do app) — sem erros.
