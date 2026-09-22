# Ranking Geral — versão v58 limpa

Pacote de produção do Ranking Geral, com a correção consolidada dos temas e das cores acessíveis. A mecânica de pontuação, a integração com a API, a autenticação, os dados e a animação oficial permanecem preservados.

## Publicação

Antes de publicar, leia `GUIA_CONFIGURACAO.md`.

Publique o front-end e o `Code.gs` desta versão em conjunto. O backend faz parte das garantias de integridade e compatibilidade do aplicativo.

Se `configurarPlanilhaMestra()` mostrar apenas “Ocorreu um erro desconhecido”, execute primeiro `diagnosticarConfiguracaoPlanilhaMestra()` no editor do Apps Script. O diagnóstico é somente leitura e informa a etapa exata da falha sem alterar a planilha.

## Recursos preservados

- IDs estáveis para participantes e dias e controle de revisão para evitar sobrescritas concorrentes;
- carregamento seguro, salvamento protegido e migração conservadora dos dados;
- colagem manual e fluxo assistido opcional pelo Gemini, com recálculo local da pontuação;
- temas claro, escuro e modos de daltonismo com cores semânticas consistentes;
- trilho de navegação visual com ícones SVG padronizados, rótulos completos no foco/hover e tipografia de interface unificada;
- edição de pontuações em dias já lançados com regeneração dos resumos da série ativa;
- histórico de resumos organizado por série e dia, com busca, filtros, texto integral e cópia direta;
- abertura animada oficial com alternativa acessível para movimento reduzido;
- Service Worker limitado ao app shell offline; login, ranking e gravações continuam exigindo rede.

## Endpoint ativo da API

`https://script.google.com/macros/s/AKfycbypHFgogRlqWGo00tNOyDNRqnzces3kUT7c_MQ81w8GlbFqHATie2uIW34R0UDWWFdfLw/exec`
