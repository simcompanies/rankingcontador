# Ranking Geral — versão de integridade v42

Esta versão mantém a identidade visual da versão estética atual e preserva a mecânica de pontuação validada contra o pacote de 22/08/2026, mas corrige as fragilidades encontradas na auditoria completa.

Principais mudanças técnicas:

- IDs estáveis para participantes e dias;
- revisão monotônica para impedir sobrescrita concorrente;
- fila de salvamento e gravação imediata das ações do ranking;
- carregamento seguro: falha de rede nunca vira ranking vazio editável;
- validação integral de snapshot e migração conservadora;
- rollback no backend e leitura/gravação protegidas por lock;
- correções de colagem, filtros, heatmap, resumos e tela Conteúdo;
- revogação efetiva de sessões e bootstrap sem senha no código;
- leitura por colagem manual e fluxo assistido opcional pelo Gemini, sempre recalculando a regra de pontos localmente;
- Service Worker corrigido como **app shell offline** — alterações do ranking exigem rede;
- testes automatizados sem dependências npm.

Leia antes de publicar:

1. `GUIA_CONFIGURACAO.md`
3. `AUDITORIA_TESTES_E_MELHORIAS.md`
4. `PLANO_DE_ACAO_CORRECOES_2026-09-15.md`

Teste principal:

```bash
node tests/test-regressao.js
```

**Importante:** publique o front-end e o `Code.gs` desta versão em conjunto. O backend novo é parte das correções de integridade.

## Ajustes v42

- OCR interno removido por confiabilidade; o fluxo de colagem manual permanece como entrada principal.
- Faixas continuam dinâmicas; faixas com participantes não podem mais ser apagadas de forma destrutiva.
- Login otimizado: hash v3 com salt + pepper secreto, migração automática de hashes antigos, sessão sem releitura da aba Usuarios em toda requisição e log de entrada em segundo plano.
- Contas antigas com hash v2 podem ter um primeiro login mais lento; após o primeiro acesso bem-sucedido, o hash é migrado automaticamente para v3.


## Endpoint ativo da API

`https://script.google.com/macros/s/AKfycbypHFgogRlqWGo00tNOyDNRqnzces3kUT7c_MQ81w8GlbFqHATie2uIW34R0UDWWFdfLw/exec`

## v46 — organização da interface
A v46 reorganiza as informações por intenção de uso. Visão Geral foi simplificada, regras foram movidas para Regras e Ajuda, dias e resumos foram concentrados em Lançamentos e Administração passou a ser dividida entre Participantes, Faixas, Usuários, Atividade e Sistema. A mecânica de pontuação não foi alterada.


## Reiniciador de séries (v48)

Em **Lançamentos > Reiniciar série**, o administrador pode reiniciar a série atual mantendo a numeração, arquivar uma série parcial e iniciar a próxima ou descartar a série parcial e avançar. Participantes e faixas são preservados em todos os modos. Consulte `ALTERACOES_V48_REINICIADOR_SERIES.md`.


## v50 — abertura animada e acessibilidade

A abertura usa a animação oficial em canvas com brilho intenso, enquanto módulos, sessão e ranking carregam em paralelo. A animação respeita `prefers-reduced-motion` e a preferência interna "Reduzir movimento", possui botão para pular a animação e não impõe espera fixa após os dados estarem prontos. Consulte `ALTERACOES_V50_ANIMACAO_ACESSIBILIDADE.md`.
