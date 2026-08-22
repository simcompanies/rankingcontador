/* ============================================================================
   colagem-gemini.js
   ----------------------------------------------------------------------------
   Leitura de prints de ranking (ex.: a ferramenta "Simco Tools") com ajuda
   do Gemini chat PADRÃO (gemini.google.com — sem custo de API, sem backend
   próprio). No lugar de mandar a imagem pra um OCR automático, o fluxo é:

     1) usuário clica em "Copiar regras de leitura" (copia pra área de
        transferência o prompt pronto em REGRAS_LEITURA_GEMINI, que explica
        o que é a imagem, a fórmula de pontuação por posição — igual à regra
        mostrada em Faixa X / Faixa Y — e o formato de saída);
     2) clica em "Abrir Gemini" (abre https://gemini.google.com/app numa
        aba nova), cola as regras lá E anexa o print;
     3) copia a resposta do Gemini (já no formato "Nome, Pontuação;") e cola
        na mesma caixa de colar usada por colagem.js — o resto do fluxo
        (Ler colagem → conferir → Lançar) continua idêntico, sem nenhuma
        mudança em colagem.js.

   Por que não um link que já abre o Gemini com o texto preenchido? O
   Gemini não tem suporte nativo a parâmro de URL pra pré-preencher o
   campo (só via extensão de navegador de terceiros, que não dá pra
   depender aqui) — por isso o fluxo é copiar+colar mesmo, como pedido.

   Como REGRAS_LEITURA_GEMINI é só texto puro, dá pra ajustar à vontade
   (ex.: se a fórmula real de pontuação por posição for diferente da
   copiada de Faixa X / Faixa Y) direto neste arquivo, sem mexer em mais nada.

   Depende de: nada além do DOM — não chama nenhuma API/backend.
   ============================================================================ */

// Link do chat padrão do Gemini (não é possível pré-preencher o campo de
// texto por URL sem uma extensão de terceiros — ver nota acima).
const LINK_GEMINI_CHAT = 'https://gemini.google.com/app';

// Prompt pronto pra colar no Gemini junto com o print. A fórmula de pontos
// por posição abaixo é a mesma mostrada em Faixa X / Faixa Y ("Regra de
// pontuação") — se a sua regra real for diferente, ajuste o texto aqui.
const REGRAS_LEITURA_GEMINI =
`Você vai ler um print de um ranking diário (ex.: da ferramenta Simco Tools), ordenado pelo crescimento % do dia — o que importa é a POSIÇÃO de cada linha na lista, não o valor de crescimento em si.

Para cada linha do print, na ordem em que aparecem:
1. Identifique o NOME do participante/empresa.
2. Anote a POSIÇÃO dele na lista (1º, 2º, 3º...).

Depois, calcule a PONTUAÇÃO de cada um pela posição, seguindo esta regra:
- 1º ao 10º colocado: de +10 a +1 (cada posição vale 1 ponto a menos que a anterior)
- 11º colocado: 0 ponto
- Do 12º colocado em diante, depende de quantos participantes tem a lista inteira:
  - até 14 participantes no total: continue descendo 1 a 1 (12º = -1, 13º = -2, 14º = -3...)
  - 15 participantes ou mais no total: desça em pares (12º e 13º = -1, 14º e 15º = -2, 16º e 17º = -3, e assim por diante)

Responda SOMENTE com a lista final, um participante por linha, neste formato exato — sem numeração, sem markdown, sem texto antes ou depois:

Nome, Pontuação;

Exemplo de uma linha: João, 8;

Se algum nome ou posição ficar difícil de ler no print, faça sua melhor leitura mesmo assim e avise a dúvida numa linha separada, no final, começando com "OBS:".`;

// Botão "🔗 Abrir Gemini": abre o chat padrão numa aba nova.
function handleAbrirGemini(){
  window.open(LINK_GEMINI_CHAT, '_blank', 'noopener');
}

// Botão "📋 Copiar regras de leitura": copia REGRAS_LEITURA_GEMINI pra área
// de transferência (com fallback pra navegador sem Clipboard API), e pisca
// uma confirmação no próprio botão — mesmo padrão visual de copySummary()
// em texto-do-resumo.js.
function handleCopiarRegrasGemini(){
  const btn = document.getElementById('gemini-copiar-btn');
  const textoOriginal = btn.textContent;
  const finalizar = () => {
    btn.textContent = '✓ Copiado!';
    btn.classList.add('copy-flash');
    setTimeout(()=>{ btn.textContent = textoOriginal; btn.classList.remove('copy-flash'); }, 1800);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(REGRAS_LEITURA_GEMINI).then(finalizar).catch(()=> copiarTextoViaFallback(REGRAS_LEITURA_GEMINI, finalizar));
  } else {
    copiarTextoViaFallback(REGRAS_LEITURA_GEMINI, finalizar);
  }
}

// Fallback de cópia pra quando a Clipboard API não está disponível: cria um
// <textarea> temporário e invisível só pra selecionar+copiar, e remove em
// seguida (o texto a copiar não vive em nenhum campo visível da tela).
function copiarTextoViaFallback(texto, aoTerminar){
  const temp = document.createElement('textarea');
  temp.value = texto;
  temp.style.position = 'fixed';
  temp.style.opacity = '0';
  document.body.appendChild(temp);
  temp.select();
  try{ document.execCommand('copy'); }catch(e){ /* nada a fazer se nem isso funcionar */ }
  document.body.removeChild(temp);
  aoTerminar();
}
