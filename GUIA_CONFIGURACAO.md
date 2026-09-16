# Guia de configuração — Ranking Geral

## 1. Front-end

Publique o conteúdo desta pasta em um servidor HTTPS, como GitHub Pages. Não abra `index.html` diretamente por `file://`, pois os módulos HTML são carregados por `fetch()`.

O endpoint do Apps Script está em `js/core/config-api.js`, constante `API_URL`. Se um novo deployment for criado com outra URL, atualize esse único valor.

## 2. Backend Google Apps Script

1. Abra o projeto Apps Script ligado à Planilha Mestra.
2. Substitua o conteúdo do script pela versão de `Code.gs` deste pacote.
3. Confirme `PLANILHA_MESTRA_ID` antes de executar qualquer função.
4. Em **Configurações do projeto > Propriedades do script**, para a primeira instalação somente, crie:
   - `ADMIN_BOOTSTRAP_NOME`
   - `ADMIN_BOOTSTRAP_EMAIL`
   - `ADMIN_BOOTSTRAP_SENHA` — mínimo de 8 caracteres.
5. Execute manualmente `configurarPlanilhaMestra()` uma vez.
6. A função cria/migra o esquema e apaga `ADMIN_BOOTSTRAP_SENHA` das propriedades assim que o primeiro administrador é criado.
7. Publique uma **nova versão do deployment existente** do Web App para manter a mesma URL usada pelo front-end. Se criar um deployment novo, atualize `API_URL`.

## 3. Migração de dados

A migração adiciona identificadores estáveis de participante (`Participant_ID`) e de dia (`Day_ID`), preserva `Data_Adicionado`, ajusta `Dias_Total` ao maior dia efetivamente encontrado e amplia o histórico de resumos com `Day_ID`, data e revisão.

A migração é deliberadamente conservadora. Ela interrompe em vez de adivinhar quando encontra:

- dois participantes com o mesmo nome **na mesma faixa** e pontuações antigas sem ID;
- `Participant_ID` duplicado;
- `Day_ID` duplicado;
- pontuação órfã;
- duas linhas de pontuação para o mesmo participante no mesmo dia.

Se isso acontecer, corrija a ambiguidade diretamente na Planilha Mestra e execute `configurarPlanilhaMestra()` novamente. Não remova dados para “forçar” a migração sem primeiro conservar uma cópia da planilha.

## 4. Revisões e concorrência

`Ranking_Revision` é mantido na aba de configuração. Cada salvamento envia a revisão que o navegador carregou. Se outro administrador tiver salvo antes, o backend retorna `REVISION_CONFLICT` e a interface bloqueia novas edições até recarregar a versão atual.

O backend usa `LockService`, valida todo o snapshot antes da escrita, mantém cópias das abas alteradas para rollback e as leituras do ranking usam o mesmo lock para não observar uma gravação pela metade.

## 5. Sessões e senhas

- remoção/rebaixamento de usuário invalida imediatamente as sessões existentes;
- troca de senha invalida tokens anteriores e entrega um token novo;
- senha mínima: 8 caracteres;
- hashes antigos continuam aceitos e são atualizados automaticamente no próximo login bem-sucedido;
- o limite de tentativas de login é persistido em `PropertiesService` por uma janela temporal, em vez de depender apenas de cache volátil.

## 6. PWA e modo offline

O Service Worker cacheia apenas o **app shell**. O ranking, login e gravações continuam exigindo rede e nunca são respondidos a partir de um cache de API. Quando `navigator.onLine === false`, alterações administrativas são bloqueadas para impedir que o usuário acredite que modificou dados que não podem ser sincronizados.

## 7. Atualização segura

Sempre publique `Code.gs` e o front-end desta versão em conjunto. Esta versão introduz IDs estáveis e revisão de snapshot; usar o front-end novo com um backend antigo elimina as garantias de integridade e pode fazer a API rejeitar operações.


## Endpoint ativo da API

`https://script.google.com/macros/s/AKfycbypHFgogRlqWGo00tNOyDNRqnzces3kUT7c_MQ81w8GlbFqHATie2uIW34R0UDWWFdfLw/exec`
