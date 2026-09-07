# Versão 105 — Bottom sheets contextuais oficiais

A V105 altera somente a camada visual adicionada pela interface nova.

## O que mudou
- Os botões da barra contextual agora abrem um bottom sheet real.
- Cada bottom sheet explica a função e oferece ações ligadas às funções já existentes no projeto oficial.
- Foram evitadas ações paralelas que criariam uma segunda mecânica.
- A navegação continua usando `mostrarView()` e `switchLaunchTab()` oficiais.
- Filtros usam `setFiltroModo()` oficial.
- Resumo usa `generateSummary()` oficial.
- OCR continua usando o `ocr-file-input` oficial.
- Nenhum cálculo de ranking, persistência, autenticação ou regra de negócio foi substituído.
