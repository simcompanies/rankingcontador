# V104 — Compatibilidade de API sem alterar a mecânica

Esta versão corrige o erro:

`Dados de ranking inválidos (esperado estado.divisoes)`

A correção acontece somente na fronteira entre o front-end atual e o backend oficial:

- Ao carregar, aceita `dados.divisoes` e converte Faixa X/Faixa Y para o estado interno já usado pela aplicação (`state.x` e `state.y`).
- Ao salvar, envia um payload com `estado.divisoes`, no formato esperado pelo backend atual.
- A mecânica existente do front-end não foi substituída.
- A camada visual nova da V103 foi preservada.
- Nenhuma regra de ranking, participante, lançamento, filtro ou navegação foi reescrita nesta versão.

## Objetivo
Resolver a incompatibilidade entre o front-end visual novo e o backend publicado, sem misturar uma migração completa de arquitetura com esta correção.
