/* ============================================================================
   inicializacao.js
   ----------------------------------------------------------------------------
   Ponto de entrada da aplicação. ÚLTIMO script a carregar (depois de todos
   os outros, que só declaram funções/estado e não executam nada sozinhos).

   Faz, nesta ordem, ao evento DOMContentLoaded:
     1) carregarModulosHtml() — busca (fetch) o HTML de cada módulo
        (modulo-0.html, modulo-1.html... troca-de-senha.html,
        configuracoes-de-conta.html) e injeta cada um no seu slot dentro de
        index.html. Isso é infraestrutura NOVA desta refatoração: no
        arquivo monolítico original esse HTML já vinha todo embutido na
        página, então nada precisava ser buscado antes de iniciar.
     2) iniciarApp() — o início original do app (restaura a sidebar
        recolhida, tenta restaurar uma sessão salva, carrega o ranking).
        Só pode rodar DEPOIS do passo 1, pois usa elementos como #auth-gate
        que só existem depois de modulo-0.html ser injetado.

   Depende de literalmente todos os outros arquivos JS (é o único que
   chama funções de módulos de UI específicos) — por isso deve ser o
   ÚLTIMO <script src="..."> antes do fechamento de </body> em index.html.

   ATENÇÃO AO TESTAR LOCALMENTE: como carregarModulosHtml() usa fetch()
   para buscar os .html, abrir o index.html direto do disco (file://) faz
   o navegador bloquear essas requisições por segurança (CORS), e os
   módulos não aparecem. Sirva a pasta com um servidor local simples, por
   exemplo "python -m http.server" ou a extensão "Live Server" do VS Code,
   e acesse via http://localhost — em qualquer hospedagem HTTP real
   (GitHub Pages incluso) isso já funciona sem nenhum passo extra.
   ============================================================================ */

// Cada entrada liga um arquivo de módulo HTML ao <div id="..."> (o "slot")
// de index.html onde seu conteúdo deve ser injetado. Os ids de slot aqui
// precisam bater exatamente com os ids usados em index.html.
const MODULOS_HTML = [
  { arquivo: 'modulo-0.html',                slot: 'slot-modulo-0' },
  { arquivo: 'troca-de-senha.html',          slot: 'slot-troca-senha' },
  { arquivo: 'modulo-1.html',                slot: 'slot-modulo-1' },
  { arquivo: 'modulo-2.html',                slot: 'slot-modulo-2' },
  { arquivo: 'modulo-3.html',                slot: 'slot-modulo-3' },
  { arquivo: 'modulo-4.html',                slot: 'slot-modulo-4' },
  { arquivo: 'configuracoes-de-conta.html',  slot: 'slot-configuracoes-conta' },
];

// Busca todos os fragmentos de HTML em paralelo (nenhum depende do
// conteúdo de outro) e injeta cada um no seu slot. Se algum fetch falhar
// (ex.: rodando via file:// sem servidor local — ver aviso acima), mostra
// uma mensagem de erro visível naquele slot em vez de deixar a tela em
// branco silenciosamente.
async function carregarModulosHtml(){
  await Promise.all(MODULOS_HTML.map(async function(modulo){
    const el = document.getElementById(modulo.slot);
    if(!el) return;
    try{
      const resposta = await fetch(modulo.arquivo);
      if(!resposta.ok) throw new Error('HTTP ' + resposta.status);
      el.innerHTML = await resposta.text();
    }catch(erro){
      console.error('Falha ao carregar ' + modulo.arquivo, erro);
      el.innerHTML = '<p style="padding:24px;color:#c0392b;font-family:monospace;">'
        + 'Não foi possível carregar "' + modulo.arquivo + '". '
        + 'Se você abriu este index.html direto do disco (file://), rode um '
        + 'servidor local (ex.: <code>python -m http.server</code>) e acesse via http://localhost.'
        + '</p>';
    }
  }));
}

async function iniciarApp(){
  if(localStorage.getItem('rankingGeral_sidebarCollapsed') === '1'){
    toggleSidebarCollapse();
  }

  const tokenSalvo = sessionStorage.getItem('rankingGeral_token');
  if(!tokenSalvo){
    document.getElementById('auth-gate').classList.remove('hidden');
    return;
  }

  try{
    const resposta = await chamarAPIGet({ action:'verificarSessao', token: tokenSalvo });
    if(!resposta.sucesso) throw new Error(resposta.erro || 'Sessão inválida');
    sessaoUsuario = {
      token: tokenSalvo,
      idUsuario: resposta.dados.idUsuario,
      nome: resposta.dados.nome,
      email: resposta.dados.email,
      papel: resposta.dados.papel
    };
    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    aplicarPermissoesPapel();
    atualizarBarraIdentidade();
    loadState();
  }catch(erro){
    console.error('Sessão salva inválida ou expirada', erro);
    encerrarSessaoLocal();
  }
}

// Ponto de entrada real, ligado ao DOMContentLoaded lá embaixo: primeiro
// monta o HTML dos módulos, só então roda a inicialização original do app.
async function iniciarAplicacao(){
  await carregarModulosHtml();
  await iniciarApp();
}

document.addEventListener('DOMContentLoaded', iniciarAplicacao);
window.addEventListener('beforeunload', saveState);
window.addEventListener('pagehide', saveState);
window.addEventListener('blur', saveState);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') saveState(); });
