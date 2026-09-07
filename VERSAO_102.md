# V102 — Consolidação mecânica do projeto oficial

Esta versão deixa de usar um protótipo paralelo como base de dados/regras. A aplicação é construída sobre a estrutura oficial modular, preservando seus módulos e fluxos.

## Mecânicas preservadas
- autenticação, criação de conta, recuperação de senha e troca obrigatória;
- sessão, identidade e permissões por papel;
- Faixa X e Faixa Y com regra oficial de pontuação e desempate;
- criação, remoção, renomeação e edição de participantes;
- gerenciamento de dias e datas;
- lançamento por formulário;
- importação por colagem;
- OCR de imagem;
- resumo diário e histórico de resumos;
- análises por período ou dias específicos;
- evolução e mapa de desempenho;
- gerenciamento de usuários;
- configurações de conta;
- acessibilidade;
- sincronização com a Planilha/API;
- PWA e service worker.

## Nova camada de interface
- sidebar removida da experiência principal;
- barra inferior com Ranking, Análises, Lançar pontuação e Configurações;
- barra contextual acima da navegação inferior;
- Minha conta e Sair contextualizados dentro de Configurações;
- KPIs em trilho horizontal sem compressão;
- visual responsivo inspirado na V1/V101;
- sem emojis na navegação nova.

## Teste local
Como o projeto oficial usa `fetch()` para carregar os módulos HTML, execute via servidor HTTP, por exemplo:

`python -m http.server 8000`

Abra `http://localhost:8000/`.
