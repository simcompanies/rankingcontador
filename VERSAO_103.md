# V103 — Nova camada visual sobre a mecânica oficial

## Objetivo
Aplicar exclusivamente a nova apresentação visual mobile definida nas versões anteriores, preservando a mecânica oficial do projeto.

## Preservado sem alteração de regra
- autenticação, cadastro, recuperação e troca de senha;
- sessão, identidade e permissões;
- estado global;
- regras de pontuação e desempate;
- participantes e dias;
- lançamento, colagem e OCR;
- análises, filtros, evoluções e mapas;
- resumos e histórico;
- usuários e auditoria;
- acessibilidade;
- integração com Google Apps Script / Planilha;
- PWA e Service Worker.

## Alteração visual
- sidebar escondida no mobile para priorizar a navegação inferior;
- barra inferior com os menus principais;
- barra contextual acima dela, preenchida de acordo com o menu selecionado;
- distribuição proporcional dos itens da barra contextual sem comprimir textos;
- rolagem horizontal somente quando necessária em telas estreitas;
- identidade visual escura, cartões, campos e espaçamentos da nova interface preservados.

## Regra arquitetural
`v103-ui.js` não implementa regras de negócio nem substitui funções da aplicação oficial. Ele apenas sincroniza visualmente a camada de navegação e utiliza `mostrarView`/`switchLaunchTab` já existentes.
