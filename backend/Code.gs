/**
 * ============================================================================
 * RANKING GERAL — BACKEND (Google Apps Script)
 * ============================================================================
 * Planilha única e compartilhada — agora com login por conta (e-mail/senha)
 * e com FAIXAS DINÂMICAS (qualquer número de divisões, não só X/Y).
 * Este script:
 *  - Lê e grava os dados de ranking (faixas/participantes/pontuações) direto
 *    na Planilha Mestra — nenhuma planilha nova é criada para ninguém;
 *  - Autentica cada pessoa com sua própria conta (e-mail + senha), com dois
 *    papéis: "administrador" (acesso completo, pode alterar dados em
 *    qualquer módulo) e "membro" (acesso somente leitura, restrito aos
 *    módulos Faixas e Análises Gerais);
 *  - Recuperação de senha por e-mail: gera um código temporário de 6
 *    dígitos, envia por e-mail (MailApp) e força a definição de uma senha
 *    nova assim que esse código é usado pra entrar. Um administrador também
 *    pode disparar esse mesmo envio pra um membro que solicitou a troca;
 *  - Identifica quem fez cada alteração automaticamente pela sessão logada
 *    (não é mais um nome escolhido manualmente) e mantém um log de mudanças;
 *  - Guarda os resumos salvos numa aba própria, que o app nunca edita nem
 *    limpa — ficam preservados mesmo se o ranking do dia a dia for limpo;
 *  - Guarda a data de cada "Dia" lançado numa aba própria, usada pelos
 *    filtros do painel de Análises Gerais (Estatísticas Gerais);
 *  - Guarda a LISTA DE FAIXAS (id/título/intervalo/cor/ordem) numa aba
 *    própria (ABA_FAIXAS), pra sobreviver a um F5/nova sessão sabendo os
 *    nomes/intervalos de faixas criadas pelo painel "Gerenciar faixas".
 *
 * ----------------------------------------------------------------------------
 * IMPORTANTE — ATUALIZANDO DE UMA VERSÃO ANTERIOR (sem faixas dinâmicas):
 * ----------------------------------------------------------------------------
 * Versões anteriores deste arquivo validavam a divisão como sendo
 * OBRIGATORIAMENTE 'x' ou 'y' (tanto ao carregar quanto ao salvar), e o
 * front-end mandava/recebia `estado.x` / `estado.y`. A partir desta versão:
 *   - carregarRanking() devolve `estado.divisoes` (array), não mais
 *     `estado.x`/`estado.y`;
 *   - salvarRanking() espera receber `estado.divisoes` (array) no corpo da
 *     requisição — um `estado.x`/`estado.y` antigo NÃO é mais aceito;
 *   - qualquer texto (não só "x"/"y") agora é um id de faixa válido na
 *     coluna "Divisao" da aba Participantes/Pontuacoes.
 * Isso significa que o FRONT-END e o BACKEND precisam estar OS DOIS
 * atualizados juntos — um front-end novo com um Code.gs antigo (ou
 * vice-versa) vai falhar ao salvar/carregar. Depois de colar este arquivo
 * no editor do Apps Script, é preciso publicar uma NOVA VERSÃO do
 * deployment já existente (Implantar → Gerenciar implantações → ✎ → Nova
 * versão → Implantar) — só salvar o arquivo no editor NÃO atualiza a URL já
 * publicada que o app usa (API_URL, em config-api.js).
 * A aba "Faixas" é criada automaticamente (com Faixa X/Faixa Y como
 * padrão) na primeira leitura/gravação depois desta atualização — não
 * precisa rodar configurarPlanilhaMestra() de novo por causa dela.
 *
 * IMPORTANTE — ATUALIZANDO DE UMA VERSÃO SEM LOGIN (mais antiga ainda):
 * A aba "Usuarios" mudou de estrutura (antes só tinha nome; agora tem
 * e-mail, senha, papel etc.). Se a sua Planilha Mestra já tem uma aba
 * "Usuarios" da versão anterior, RENOMEIE ou APAGUE essa aba antes de rodar
 * configurarPlanilhaMestra() — como as contas antigas não tinham e-mail nem
 * senha, elas não podem ser aproveitadas automaticamente; cada pessoa
 * precisa criar uma conta nova pela tela "Crie sua conta".
 *
 * Veja o GUIA_CONFIGURACAO.md para o passo a passo de instalação.
 * ============================================================================
 */

// ==================== CONFIGURAÇÕES ====================

// ID da Planilha Mestra (extraído do link fornecido). Troque se usar outra.
const PLANILHA_MESTRA_ID = '1fNnqdy42eksQaBmOuwrFjs2W9_a4-V4FZCek4P_C7Uo';

// Dados da PRIMEIRA conta de administrador. A partir desta versão, NÃO
// ficam mais escritos aqui no código (uma senha hardcoded num arquivo que
// pode ser compartilhado/versionado é uma credencial exposta). Configure-os
// em: editor do Apps Script → ⚙️ Configurações do projeto → Propriedades do
// Script → adicionar ADMIN_PADRAO_NOME, ADMIN_PADRAO_EMAIL e
// ADMIN_PADRAO_SENHA. São lidos só uma vez, dentro de
// configurarPlanilhaMestra() (função obterCredenciaisAdminPadrao, mais
// abaixo) — depois de criada a conta, troque a senha pelo próprio app e as
// propriedades podem até ser apagadas.

const ABA_PARTICIPANTES = 'Participantes';
const ABA_PONTUACOES = 'Pontuacoes';
const ABA_CONFIG = 'Config';
const ABA_USUARIOS = 'Usuarios';
const ABA_LOG = 'Log';
const ABA_RESUMOS = 'ResumosSalvos';
const ABA_DIAS = 'Dias';
const ABA_FAIXAS = 'Faixas';

const CABECALHO_PARTICIPANTES = ['Divisao', 'Nome', 'Data_Adicionado'];
const CABECALHO_PONTUACOES = ['Divisao', 'Nome', 'Dia', 'Pontuacao'];
const CABECALHO_CONFIG = ['Chave', 'Valor'];
const CABECALHO_USUARIOS = ['ID_Usuario', 'Nome', 'Email', 'Senha_Hash', 'Salt', 'Papel', 'Data_Criacao', 'Codigo_Temp_Hash', 'Codigo_Temp_Expira', 'Reset_Pendente'];
const CABECALHO_LOG = ['Data_Hora', 'Usuario', 'Acao'];
const CABECALHO_RESUMOS = ['Data_Hora', 'Dia', 'Texto'];
const CABECALHO_DIAS = ['Dia', 'Data'];
const CABECALHO_FAIXAS = ['ID', 'Titulo', 'Intervalo', 'Cor', 'Ordem'];

const PAPEL_ADMIN = 'administrador';
const PAPEL_MEMBRO = 'membro';

const DURACAO_SESSAO_SEGUNDOS = 21600; // 6h — máximo permitido pelo CacheService
const DURACAO_CODIGO_TEMP_MINUTOS = 30;
const LOG_MAX_LINHAS = 300; // evita que a aba de log cresça pra sempre

const RATE_LIMIT_MAX_TENTATIVAS = 5; // tentativas de login falhas permitidas por e-mail dentro da janela
const RATE_LIMIT_JANELA_SEGUNDOS = 900; // 15 minutos

// Cadastro: como o app roda como Web App "anyone" (sem cookie/sessão antes
// de existir conta), não há como identificar quem está chamando por
// e-mail/usuário ainda — o único jeito confiável de conter uma enxurrada
// automatizada de cadastros é um contador GLOBAL (todas as contas criadas,
// de qualquer pessoa, dentro da janela). É mais grosso que um limite por
// pessoa, mas é o que dá pra fazer sem depender de IP (Apps Script não
// expõe o IP de quem chama um Web App).
const RATE_LIMIT_CADASTRO_MAX = 30;
const RATE_LIMIT_CADASTRO_JANELA_SEGUNDOS = 600; // 10 minutos

// OCR: aqui sim dá pra limitar por pessoa de verdade, porque só quem já
// está logado como administrador pode chamar ocrImagem() — usamos o
// idUsuario da sessão.
const RATE_LIMIT_OCR_MAX = 20;
const RATE_LIMIT_OCR_JANELA_SEGUNDOS = 3600; // 1 hora

// Contador genérico de rate limit no CacheService — incrementa a cada
// chamada e recusa quando o limite da janela é atingido. Usado por
// cadastro e OCR (login já tinha o seu próprio, específico, mantido como
// estava acima).
function verificarRateLimit(chave, max, janelaSegundos) {
  const cache = CacheService.getScriptCache();
  const chaveCache = 'rate_limit_' + chave;
  const atual = Number(cache.get(chaveCache) || 0);
  if (atual >= max) return false;
  cache.put(chaveCache, String(atual + 1), janelaSegundos);
  return true;
}


// ==================== ROTEAMENTO HTTP (doGet / doPost) ====================

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'ping') {
      return criarResposta({ sucesso: true, mensagem: 'API online' });
    }
    if (action === 'verificarSessao') {
      return verificarSessao(e.parameter.token);
    }
    if (action === 'listarRanking') {
      const sessao = obterSessao(e.parameter.token);
      if (!sessao) return respostaSessaoExpirada();
      return criarResposta({ sucesso: true, dados: carregarRanking() });
    }
    if (action === 'listarUsuarios') {
      const sessao = obterSessao(e.parameter.token);
      if (!sessao) return respostaSessaoExpirada();
      if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
      return criarResposta({ sucesso: true, dados: listarUsuariosEAtividade() });
    }
    if (action === 'listarResumosSalvos') {
      const sessao = obterSessao(e.parameter.token);
      if (!sessao) return respostaSessaoExpirada();
      return criarResposta({ sucesso: true, dados: listarResumosSalvos() });
    }

    return criarResposta({ sucesso: false, erro: 'Ação GET não reconhecida: ' + action });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: erro.message });
  }
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return criarResposta({ sucesso: false, erro: 'Corpo da requisição vazio.' });
    }

    // Limite de tamanho do corpo da requisição — protege contra alguém
    // mandar um JSON absurdamente grande pra derrubar a execução por
    // tempo/memória. 'ocrImagem' fica de fora dessa checagem porque o
    // próprio base64 da imagem já domina o tamanho do corpo nesse caso —
    // o limite dela é MAX_BYTES_IMAGEM_OCR, verificado dentro de
    // ocrImagem() depois de decodificar.
    const MAX_PAYLOAD_BYTES_GERAL = 3 * 1024 * 1024; // 3MB — folga generosa pra salvarRanking com muitos participantes/dias
    let acaoRapida = '';
    try { acaoRapida = (JSON.parse(e.postData.contents) || {}).action || ''; } catch (erroParse) { /* segue e deixa o parse abaixo reportar o erro */ }
    if (acaoRapida !== 'ocrImagem' && e.postData.contents.length > MAX_PAYLOAD_BYTES_GERAL) {
      return criarResposta({ sucesso: false, erro: 'Requisição muito grande.' });
    }

    const corpo = JSON.parse(e.postData.contents);

    switch (corpo.action) {
      case 'cadastrar':
        return cadastrar(corpo.nome, corpo.email, corpo.senha, corpo.confirmarSenha);
      case 'login':
        return login(corpo.email, corpo.senha);
      case 'logout':
        return logout(corpo.token);
      case 'esqueciSenha':
        return esqueciSenha(corpo.email);
      case 'solicitarResetSenha':
        return solicitarResetSenha(corpo.token);
      case 'definirNovaSenha':
        return definirNovaSenha(corpo.token, corpo.novaSenha, corpo.confirmarNovaSenha);
      case 'adminEnviarReset':
        return adminEnviarReset(corpo.token, corpo.idUsuario);
      case 'adminAlterarPapel':
        return adminAlterarPapel(corpo.token, corpo.idUsuario, corpo.novoPapel);
      case 'adminRemoverUsuario':
        return adminRemoverUsuario(corpo.token, corpo.idUsuario);
      case 'salvarRanking':
        return salvarRanking(corpo.token, corpo.estado);
      case 'salvarResumo':
        return salvarResumo(corpo.token, corpo.dia, corpo.texto);
      case 'ocrImagem':
        return ocrImagem(corpo.token, corpo.imagemBase64, corpo.mimeType);
      default:
        return criarResposta({ sucesso: false, erro: 'Ação POST não reconhecida: ' + corpo.action });
    }
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: erro.message });
  }
}


// ==================== SESSÃO ====================
// Cada login gera um token guardado no CacheService, apontando pros dados
// básicos da conta (id/nome/email/papel). É assim que o backend sabe quem
// está chamando cada ação e com que permissão — sem precisar de um nome
// escolhido manualmente como na versão anterior.

function criarSessao(usuario) {
  const token = Utilities.getUuid();
  const payload = JSON.stringify({
    idUsuario: usuario.idUsuario,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel
  });
  CacheService.getScriptCache().put('sessao_' + token, payload, DURACAO_SESSAO_SEGUNDOS);
  return token;
}

function obterSessao(token) {
  if (!token) return null;
  const chave = 'sessao_' + String(token);
  const cache = CacheService.getScriptCache();
  const bruto = cache.get(chave);
  if (!bruto) return null;
  try {
    const sessao = JSON.parse(bruto);
    // Sliding expiration: cada uso da sessão renova o prazo de
    // DURACAO_SESSAO_SEGUNDOS a partir de AGORA. Assim, quem está de fato
    // usando o app continua logado, e só quem fica realmente ocioso perde
    // a sessão (em até 6h desde a última ação) — antes, a sessão expirava
    // 6h depois do LOGIN mesmo com uso contínuo.
    cache.put(chave, bruto, DURACAO_SESSAO_SEGUNDOS);
    return sessao;
  } catch (erro) {
    return null;
  }
}

function encerrarSessao(token) {
  if (!token) return;
  CacheService.getScriptCache().remove('sessao_' + String(token));
}

function respostaSessaoExpirada() {
  return criarResposta({ sucesso: false, erro: 'Sessão expirada. Faça login novamente.', codigo: 'SESSAO_EXPIRADA' });
}

function respostaPermissaoNegada() {
  return criarResposta({ sucesso: false, erro: 'Essa ação é restrita a administradores.', codigo: 'PERMISSAO_NEGADA' });
}

function verificarSessao(token) {
  const sessao = obterSessao(token);
  if (!sessao) return respostaSessaoExpirada();
  return criarResposta({ sucesso: true, dados: sessao });
}

function logout(token) {
  encerrarSessao(token);
  return criarResposta({ sucesso: true, mensagem: 'Sessão encerrada.' });
}


// ==================== CONTAS — CADASTRO, LOGIN, RECUPERAÇÃO DE SENHA ====================

function normalizarEmail(email) {
  return email ? String(email).trim().toLowerCase() : '';
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function localizarLinhaUsuarioPorEmail(abaUsuarios, email) {
  if (!abaUsuarios || abaUsuarios.getLastRow() < 2) return -1;
  const emails = abaUsuarios.getRange(2, 3, abaUsuarios.getLastRow() - 1, 1).getValues(); // coluna Email
  const alvo = normalizarEmail(email);
  for (let i = 0; i < emails.length; i++) {
    if (normalizarEmail(emails[i][0]) === alvo) return i + 2; // linha real na planilha
  }
  return -1;
}

function localizarLinhaUsuarioPorId(abaUsuarios, idUsuario) {
  if (!abaUsuarios || abaUsuarios.getLastRow() < 2) return -1;
  const ids = abaUsuarios.getRange(2, 1, abaUsuarios.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(idUsuario)) return i + 2;
  }
  return -1;
}

function linhaParaUsuario(valores) {
  // valores segue a ordem de CABECALHO_USUARIOS
  return {
    idUsuario: valores[0],
    nome: valores[1],
    email: valores[2],
    senhaHash: valores[3],
    salt: valores[4],
    papel: valores[5],
    dataCriacao: valores[6],
    codigoTempHash: valores[7],
    codigoTempExpira: valores[8],
    resetPendente: valores[9] === true
  };
}

function contarAdministradores(abaUsuarios) {
  if (!abaUsuarios || abaUsuarios.getLastRow() < 2) return 0;
  const linhas = abaUsuarios.getRange(2, 1, abaUsuarios.getLastRow() - 1, CABECALHO_USUARIOS.length).getValues();
  let total = 0;
  linhas.forEach(function (linha) {
    if (linha[5] === PAPEL_ADMIN) total++;
  });
  return total;
}

// ==================== LIMITE DE TENTATIVAS DE LOGIN (rate limiting) ====================
// Usa o mesmo CacheService já usado pra sessão — um contador por e-mail,
// incrementado a cada tentativa de LOGIN FALHA (senha errada, e-mail
// inexistente, ou código temporário errado/expirado) e zerado assim que um
// login for bem-sucedido por qualquer um dos dois caminhos (senha normal ou
// código temporário). Os dois são validados dentro de login(), então um
// único contador por e-mail já cobre força bruta de senha E adivinhação do
// código de 6 dígitos da recuperação.

function chaveTentativasLogin(emailNormalizado) {
  return 'tentativas_login_' + emailNormalizado;
}

function tentativasLoginExcedidas(emailNormalizado) {
  const bruto = CacheService.getScriptCache().get(chaveTentativasLogin(emailNormalizado));
  return (bruto ? Number(bruto) : 0) >= RATE_LIMIT_MAX_TENTATIVAS;
}

function registrarTentativaLoginFalha(emailNormalizado) {
  const cache = CacheService.getScriptCache();
  const chave = chaveTentativasLogin(emailNormalizado);
  const bruto = cache.get(chave);
  const atual = (bruto ? Number(bruto) : 0) + 1;
  cache.put(chave, String(atual), RATE_LIMIT_JANELA_SEGUNDOS);
  registrarLog(emailNormalizado, 'Tentativa de login falhou (' + atual + '/' + RATE_LIMIT_MAX_TENTATIVAS + ')');
  if (atual === RATE_LIMIT_MAX_TENTATIVAS) {
    avisarAdminTentativasSuspeitas(emailNormalizado);
  }
}

// Dispara um e-mail pra um administrador (o primeiro encontrado na aba
// Usuarios — não há mais um e-mail de admin fixo no código, ver
// obterCredenciaisAdminPadrao) avisando que um e-mail bateu no limite de
// tentativas de login. Não deve, sob hipótese nenhuma, derrubar o fluxo de
// login por causa de uma falha de envio — daí o try/catch cobrindo tudo.
function avisarAdminTentativasSuspeitas(emailAlvo) {
  try {
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = planilha.getSheetByName(ABA_USUARIOS);
    if (!abaUsuarios || abaUsuarios.getLastRow() < 2) return;
    const linhas = abaUsuarios.getRange(2, 1, abaUsuarios.getLastRow() - 1, CABECALHO_USUARIOS.length).getValues();
    const admin = linhas.find(function (linha) { return linha[5] === PAPEL_ADMIN; });
    if (!admin) return;
    MailApp.sendEmail(
      admin[2], // Email
      '⚠️ Ranking Geral — tentativas de login suspeitas',
      'O e-mail "' + emailAlvo + '" atingiu o limite de ' + RATE_LIMIT_MAX_TENTATIVAS +
      ' tentativas de login falhas nos últimos ' + Math.round(RATE_LIMIT_JANELA_SEGUNDOS / 60) +
      ' minutos e está temporariamente bloqueado para novas tentativas.\n\n' +
      'Se foi você mesmo errando a senha, é só aguardar e tentar de novo. Se não reconhece essa ' +
      'tentativa, pode ser alguém tentando adivinhar a senha dessa conta.'
    );
  } catch (erro) {
    Logger.log('Falha ao enviar alerta de tentativas suspeitas: ' + erro.message);
  }
}

function limparTentativasLogin(emailNormalizado) {
  CacheService.getScriptCache().remove(chaveTentativasLogin(emailNormalizado));
}

// ==================== POLÍTICA DE SENHA ====================
// Aplicada a toda senha NOVA (cadastro e definição de nova senha). Não
// afeta quem já tem conta — só passa a valer pra frente. Segue o mesmo
// espírito do "6 caracteres" que já existia, só reforçado: comprimento
// maior importa mais que exigir símbolo, mas mantemos os requisitos de
// maiúscula/número/especial por serem baratos e reduzirem bastante senhas
// como "12345678".
const SENHA_MIN_LENGTH = 8;
const SENHAS_COMUNS_BLOQUEADAS = ['12345678', 'senha123', 'password', 'qwerty123', 'admin123', '87654321'];

function validarPoliticaSenha(senha) {
  const erros = [];
  if (senha.length < SENHA_MIN_LENGTH) {
    erros.push('A senha deve ter pelo menos ' + SENHA_MIN_LENGTH + ' caracteres.');
  }
  if (!/[A-Z]/.test(senha)) erros.push('A senha deve conter pelo menos uma letra maiúscula.');
  if (!/[0-9]/.test(senha)) erros.push('A senha deve conter pelo menos um número.');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)) erros.push('A senha deve conter pelo menos um caractere especial.');
  if (SENHAS_COMUNS_BLOQUEADAS.indexOf(senha.toLowerCase()) !== -1) erros.push('Essa senha é muito comum — escolha outra.');
  return erros;
}

function cadastrar(nome, email, senha, confirmarSenha) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const nomeNormalizado = nome ? String(nome).trim().substring(0, 80) : '';
    const emailNormalizado = normalizarEmail(email);
    const senhaInformada = senha ? String(senha) : '';

    if (!nomeNormalizado) return criarResposta({ sucesso: false, erro: 'Informe seu nome.' });
    if (/[<>]/.test(nomeNormalizado)) return criarResposta({ sucesso: false, erro: 'O nome não pode conter os caracteres < ou >.' });
    if (!emailValido(emailNormalizado)) return criarResposta({ sucesso: false, erro: 'Informe um e-mail válido.' });
    const errosSenha = validarPoliticaSenha(senhaInformada);
    if (errosSenha.length) return criarResposta({ sucesso: false, erro: errosSenha.join(' ') });
    if (senhaInformada !== String(confirmarSenha || '')) return criarResposta({ sucesso: false, erro: 'As senhas não conferem.' });

    if (!verificarRateLimit('cadastro_global', RATE_LIMIT_CADASTRO_MAX, RATE_LIMIT_CADASTRO_JANELA_SEGUNDOS)) {
      return criarResposta({ sucesso: false, erro: 'Muitas contas criadas em pouco tempo. Tente novamente mais tarde.' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);

    if (localizarLinhaUsuarioPorEmail(abaUsuarios, emailNormalizado) !== -1) {
      return criarResposta({ sucesso: false, erro: 'Já existe uma conta com esse e-mail.' });
    }

    const salt = Utilities.getUuid();
    const idUsuario = Utilities.getUuid();
    abaUsuarios.appendRow([
      idUsuario, nomeNormalizado, emailNormalizado, gerarHashSenhaV2(senhaInformada, salt), salt,
      PAPEL_MEMBRO, new Date(), '', '', false
    ]);
    registrarLog(nomeNormalizado, 'Criou uma conta (membro)');

    const token = criarSessao({ idUsuario: idUsuario, nome: nomeNormalizado, email: emailNormalizado, papel: PAPEL_MEMBRO });
    return criarResposta({
      sucesso: true,
      mensagem: 'Conta criada com sucesso!',
      dados: { token: token, idUsuario: idUsuario, nome: nomeNormalizado, email: emailNormalizado, papel: PAPEL_MEMBRO }
    });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao criar conta: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function login(email, senha) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const emailNormalizado = normalizarEmail(email);
    const senhaInformada = senha ? String(senha) : '';
    if (!emailNormalizado || !senhaInformada) {
      return criarResposta({ sucesso: false, erro: 'Informe e-mail e senha.' });
    }

    if (tentativasLoginExcedidas(emailNormalizado)) {
      return criarResposta({ sucesso: false, erro: 'Muitas tentativas. Aguarde alguns minutos.', codigo: 'MUITAS_TENTATIVAS' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorEmail(abaUsuarios, emailNormalizado);
    if (linha === -1) {
      registrarTentativaLoginFalha(emailNormalizado);
      return criarResposta({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
    }

    const valores = abaUsuarios.getRange(linha, 1, 1, CABECALHO_USUARIOS.length).getValues()[0];
    const usuario = linhaParaUsuario(valores);

    const verificacaoSenha = verificarSenha(senhaInformada, usuario.senhaHash, usuario.salt);
    if (verificacaoSenha.bate) {
      limparTentativasLogin(emailNormalizado);
      if (verificacaoSenha.precisaAtualizar) {
        // upgrade transparente: essa conta ainda estava no formato de hash
        // antigo (uma passada de SHA-256) — como a senha certa acabou de
        // ser confirmada, regrava já no formato v2 (mais custoso de força
        // bruta), sem pedir nada da pessoa.
        abaUsuarios.getRange(linha, 4).setValue(gerarHashSenhaV2(senhaInformada, usuario.salt));
      }
      const token = criarSessao(usuario);
      registrarLog(usuario.nome, 'Entrou na conta');
      return criarResposta({
        sucesso: true,
        dados: { token: token, idUsuario: usuario.idUsuario, nome: usuario.nome, email: usuario.email, papel: usuario.papel, precisaTrocarSenha: false }
      });
    }

    // a senha normal não bateu — tenta o código temporário (recuperação de senha)
    if (usuario.codigoTempHash && usuario.codigoTempExpira && Date.now() <= new Date(usuario.codigoTempExpira).getTime()) {
      if (gerarHashSenha(senhaInformada, usuario.salt) === usuario.codigoTempHash) {
        limparTentativasLogin(emailNormalizado);
        abaUsuarios.getRange(linha, 8, 1, 3).setValues([['', '', false]]); // consome o código (uso único)
        const token = criarSessao(usuario);
        registrarLog(usuario.nome, 'Entrou com código temporário');
        return criarResposta({
          sucesso: true,
          dados: { token: token, idUsuario: usuario.idUsuario, nome: usuario.nome, email: usuario.email, papel: usuario.papel, precisaTrocarSenha: true }
        });
      }
    }

    registrarTentativaLoginFalha(emailNormalizado);
    return criarResposta({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao entrar: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function esqueciSenha(email) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const mensagemGenerica = 'Se esse e-mail estiver cadastrado, enviamos um código temporário para ele.';
    const emailNormalizado = normalizarEmail(email);
    if (!emailValido(emailNormalizado)) {
      return criarResposta({ sucesso: true, mensagem: mensagemGenerica });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorEmail(abaUsuarios, emailNormalizado);
    if (linha === -1) {
      return criarResposta({ sucesso: true, mensagem: mensagemGenerica }); // não revela se o e-mail existe ou não
    }

    const valores = abaUsuarios.getRange(linha, 1, 1, CABECALHO_USUARIOS.length).getValues()[0];
    enviarCodigoTemporario(abaUsuarios, linha, linhaParaUsuario(valores));

    return criarResposta({ sucesso: true, mensagem: mensagemGenerica });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao solicitar recuperação: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

// Gera um código de 6 dígitos, salva o hash + validade na linha do usuário e
// envia por e-mail. Usado tanto pelo "Esqueceu sua senha?" (autoatendimento,
// na tela de login) quanto pelo administrador respondendo a uma solicitação
// de um membro (painel Usuários, em Configurações Gerais).
function enviarCodigoTemporario(abaUsuarios, linha, usuario) {
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expira = new Date(Date.now() + DURACAO_CODIGO_TEMP_MINUTOS * 60000);
  abaUsuarios.getRange(linha, 8, 1, 3).setValues([[gerarHashSenha(codigo, usuario.salt), expira, false]]);

  const assunto = 'Ranking Geral — código temporário de acesso';
  const corpo = 'Olá, ' + usuario.nome + '!\n\n' +
    'Use o código abaixo no lugar da sua senha pra entrar no Ranking Geral. Ele vale por ' +
    DURACAO_CODIGO_TEMP_MINUTOS + ' minutos e só funciona uma vez — assim que você entrar com ' +
    'ele, o app já vai pedir pra você definir uma senha nova.\n\n' +
    'Código: ' + codigo + '\n\n' +
    'Se você não pediu isso, pode ignorar este e-mail.';
  try {
    MailApp.sendEmail(usuario.email, assunto, corpo);
  } catch (erro) {
    // não derruba a ação principal — o código já foi salvo, só o envio do e-mail falhou
    Logger.log('Falha ao enviar e-mail de código temporário: ' + erro.message);
  }
  registrarLog(usuario.nome, 'Recebeu um código temporário de acesso');
}

function solicitarResetSenha(token) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorId(abaUsuarios, sessao.idUsuario);
    if (linha === -1) return criarResposta({ sucesso: false, erro: 'Conta não encontrada.' });

    abaUsuarios.getRange(linha, 10).setValue(true); // Reset_Pendente
    registrarLog(sessao.nome, 'Solicitou troca de senha');
    return criarResposta({ sucesso: true, mensagem: 'Solicitação enviada. Aguarde o administrador liberar seu código de acesso.' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao solicitar troca de senha: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function definirNovaSenha(token, novaSenha, confirmarNovaSenha) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();

    const senhaNova = novaSenha ? String(novaSenha) : '';
    const errosSenha = validarPoliticaSenha(senhaNova);
    if (errosSenha.length) return criarResposta({ sucesso: false, erro: errosSenha.join(' ') });
    if (senhaNova !== String(confirmarNovaSenha || '')) return criarResposta({ sucesso: false, erro: 'As senhas não conferem.' });

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorId(abaUsuarios, sessao.idUsuario);
    if (linha === -1) return criarResposta({ sucesso: false, erro: 'Conta não encontrada.' });

    const salt = Utilities.getUuid();
    abaUsuarios.getRange(linha, 4, 1, 2).setValues([[gerarHashSenhaV2(senhaNova, salt), salt]]); // Senha_Hash, Salt
    abaUsuarios.getRange(linha, 8, 1, 3).setValues([['', '', false]]); // limpa código temporário e pendência
    registrarLog(sessao.nome, 'Definiu uma nova senha');

    return criarResposta({ sucesso: true, mensagem: 'Senha atualizada com sucesso!' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao definir nova senha: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}


// ==================== USUÁRIOS — PAINEL DO ADMINISTRADOR ====================
// Ações restritas a quem está logado com papel "administrador": disparar um
// código temporário pra alguém, promover/rebaixar papel e remover conta.

function adminEnviarReset(token, idUsuario) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
    if (!idUsuario) return criarResposta({ sucesso: false, erro: 'Usuário não informado.' });

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorId(abaUsuarios, idUsuario);
    if (linha === -1) return criarResposta({ sucesso: false, erro: 'Usuário não encontrado.' });

    const valores = abaUsuarios.getRange(linha, 1, 1, CABECALHO_USUARIOS.length).getValues()[0];
    const usuario = linhaParaUsuario(valores);
    enviarCodigoTemporario(abaUsuarios, linha, usuario);
    registrarLog(sessao.nome, 'Enviou um código temporário para ' + usuario.nome);

    return criarResposta({ sucesso: true, mensagem: 'Código temporário enviado para ' + usuario.email + '.' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao enviar código: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function adminAlterarPapel(token, idUsuario, novoPapel) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
    if (novoPapel !== PAPEL_ADMIN && novoPapel !== PAPEL_MEMBRO) {
      return criarResposta({ sucesso: false, erro: 'Papel inválido.' });
    }
    if (String(idUsuario) === String(sessao.idUsuario)) {
      return criarResposta({ sucesso: false, erro: 'Você não pode alterar o próprio papel por aqui.' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorId(abaUsuarios, idUsuario);
    if (linha === -1) return criarResposta({ sucesso: false, erro: 'Usuário não encontrado.' });

    const papelAtual = abaUsuarios.getRange(linha, 6).getValue();
    if (papelAtual === PAPEL_ADMIN && novoPapel === PAPEL_MEMBRO && contarAdministradores(abaUsuarios) <= 1) {
      return criarResposta({ sucesso: false, erro: 'Não é possível remover o último administrador.' });
    }

    abaUsuarios.getRange(linha, 6).setValue(novoPapel);
    const nomeUsuario = abaUsuarios.getRange(linha, 2).getValue();
    registrarLog(sessao.nome, 'Alterou o papel de ' + nomeUsuario + ' para ' + novoPapel);

    return criarResposta({ sucesso: true, mensagem: 'Papel atualizado.' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao alterar papel: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function adminRemoverUsuario(token, idUsuario) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
    if (String(idUsuario) === String(sessao.idUsuario)) {
      return criarResposta({ sucesso: false, erro: 'Você não pode remover a própria conta por aqui.' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorId(abaUsuarios, idUsuario);
    if (linha === -1) return criarResposta({ sucesso: false, erro: 'Usuário não encontrado.' });

    const papelAtual = abaUsuarios.getRange(linha, 6).getValue();
    if (papelAtual === PAPEL_ADMIN && contarAdministradores(abaUsuarios) <= 1) {
      return criarResposta({ sucesso: false, erro: 'Não é possível remover o último administrador.' });
    }

    const nomeUsuario = abaUsuarios.getRange(linha, 2).getValue();
    abaUsuarios.deleteRow(linha);
    registrarLog(sessao.nome, 'Removeu a conta de ' + nomeUsuario);

    return criarResposta({ sucesso: true, mensagem: 'Usuário removido.' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao remover usuário: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function listarUsuariosEAtividade() {
  const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
  const abaUsuarios = planilha.getSheetByName(ABA_USUARIOS);
  const abaLog = planilha.getSheetByName(ABA_LOG);

  const usuarios = [];
  if (abaUsuarios && abaUsuarios.getLastRow() > 1) {
    const linhas = abaUsuarios.getRange(2, 1, abaUsuarios.getLastRow() - 1, CABECALHO_USUARIOS.length).getValues();
    linhas.forEach(function (linha) {
      if (!linha[1]) return;
      usuarios.push({
        idUsuario: linha[0],
        nome: linha[1],
        email: linha[2],
        papel: linha[5],
        resetPendente: linha[9] === true
      });
    });
  }

  const log = [];
  if (abaLog && abaLog.getLastRow() > 1) {
    const ultimaLinha = abaLog.getLastRow();
    const primeiraLinha = Math.max(2, ultimaLinha - 29); // últimas 30 entradas
    const linhas = abaLog.getRange(primeiraLinha, 1, ultimaLinha - primeiraLinha + 1, CABECALHO_LOG.length).getValues();
    linhas.reverse().forEach(function (linha) {
      log.push({ dataHora: linha[0], usuario: linha[1], acao: linha[2] });
    });
  }

  return { usuarios: usuarios, log: log };
}

function registrarLog(usuario, acao) {
  try {
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaLog = obterOuCriarAba(planilha, ABA_LOG, CABECALHO_LOG);
    abaLog.appendRow([new Date(), usuario, acao]);
    const ultimaLinha = abaLog.getLastRow();
    if (ultimaLinha > LOG_MAX_LINHAS + 1) {
      abaLog.deleteRows(2, ultimaLinha - LOG_MAX_LINHAS - 1);
    }
  } catch (erro) {
    // o log é só um extra — nunca deve derrubar a ação principal
  }
}


// ==================== RANKING (dados operacionais, com faixas dinâmicas) ====================

// Lê a aba Faixas e devolve um array de divisões { id, titulo, intervalo,
// cor, participantes:[] } na ordem salva (coluna "Ordem"). Se a aba não
// existir ainda ou estiver vazia (planilha de uma versão anterior a esta,
// ou recém-criada), devolve Faixa X / Faixa Y como padrão — mesma
// convenção sempre usada pelo app antes desta versão, então dados antigos
// continuam funcionando sem nenhuma migração manual.
function lerFaixasCadastradas(planilha) {
  const abaFaixas = planilha.getSheetByName(ABA_FAIXAS);
  const divisoes = [];

  if (abaFaixas && abaFaixas.getLastRow() > 1) {
    const linhas = abaFaixas.getRange(2, 1, abaFaixas.getLastRow() - 1, CABECALHO_FAIXAS.length).getValues();
    linhas
      .map(function (linha) {
        return {
          id: String(linha[0] || '').trim().toLowerCase(),
          titulo: String(linha[1] || '').trim(),
          intervalo: String(linha[2] || '').trim(),
          cor: String(linha[3] || '--panel-2').trim(),
          ordem: Number(linha[4]) || 0
        };
      })
      .filter(function (d) { return d.id; })
      .sort(function (a, b) { return a.ordem - b.ordem; })
      .forEach(function (d) {
        divisoes.push({ id: d.id, titulo: d.titulo || d.id, intervalo: d.intervalo, cor: d.cor, participantes: [] });
      });
  }

  if (!divisoes.length) {
    divisoes.push({ id: 'x', titulo: 'Faixa X', intervalo: '0 a 19.999M', cor: '--x-color', participantes: [] });
    divisoes.push({ id: 'y', titulo: 'Faixa Y', intervalo: '20M ou mais', cor: '--y-color', participantes: [] });
  }

  return divisoes;
}

function carregarRanking() {
  const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
  const abaParticipantes = planilha.getSheetByName(ABA_PARTICIPANTES);
  const abaPontuacoes = planilha.getSheetByName(ABA_PONTUACOES);
  const abaConfig = planilha.getSheetByName(ABA_CONFIG);
  const abaDias = planilha.getSheetByName(ABA_DIAS);

  const diasTotal = Number(lerConfig(abaConfig, 'Dias_Total', 0)) || 0;
  const divisoes = lerFaixasCadastradas(planilha);
  const indiceDivisao = {};
  divisoes.forEach(function (d) { indiceDivisao[d.id] = d; });

  const estado = { days: diasTotal, dayDates: new Array(diasTotal).fill(null), divisoes: divisoes };
  const indiceParticipante = {};

  if (abaParticipantes && abaParticipantes.getLastRow() > 1) {
    const linhas = abaParticipantes.getRange(2, 1, abaParticipantes.getLastRow() - 1, CABECALHO_PARTICIPANTES.length).getValues();
    linhas.forEach(function (linha) {
      const divisaoId = String(linha[0]).trim().toLowerCase();
      const nome = String(linha[1]).trim();
      if (!nome || !divisaoId) return;
      // Participante pertence a uma divisão que não está (mais) cadastrada
      // na aba Faixas (ex.: uma faixa removida sem limpar as linhas antigas
      // — não deveria acontecer no fluxo normal, já que salvarRanking()
      // reescreve as duas abas juntas, mas fica a rede de segurança pra
      // nunca simplesmente descartar um participante). Cria a divisão
      // "recuperada" na hora, com um título genérico.
      if (!indiceDivisao[divisaoId]) {
        const recuperada = { id: divisaoId, titulo: 'Faixa ' + divisaoId, intervalo: '', cor: '--panel-2', participantes: [] };
        divisoes.push(recuperada);
        indiceDivisao[divisaoId] = recuperada;
      }
      const participante = { name: nome, scores: new Array(diasTotal).fill(null) };
      indiceDivisao[divisaoId].participantes.push(participante);
      indiceParticipante[divisaoId + '||' + nome.toLowerCase()] = participante;
    });
  }

  if (abaPontuacoes && abaPontuacoes.getLastRow() > 1) {
    const linhas = abaPontuacoes.getRange(2, 1, abaPontuacoes.getLastRow() - 1, CABECALHO_PONTUACOES.length).getValues();
    linhas.forEach(function (linha) {
      const divisaoId = String(linha[0]).trim().toLowerCase();
      const nome = String(linha[1]).trim();
      const dia = Number(linha[2]);
      const pontuacao = linha[3];
      const participante = indiceParticipante[divisaoId + '||' + nome.toLowerCase()];
      if (participante && dia >= 1 && dia <= diasTotal && pontuacao !== '' && pontuacao !== null && pontuacao !== undefined) {
        participante.scores[dia - 1] = Number(pontuacao);
      }
    });
  }

  if (abaDias && abaDias.getLastRow() > 1) {
    const linhas = abaDias.getRange(2, 1, abaDias.getLastRow() - 1, CABECALHO_DIAS.length).getValues();
    const fusoScript = Session.getScriptTimeZone();
    linhas.forEach(function (linha) {
      const dia = Number(linha[0]);
      if (dia >= 1 && dia <= diasTotal) {
        // formatDate (não toISOString) devolve a data no fuso do PRÓPRIO
        // projeto Apps Script, sem "Z" no final — mesma convenção de
        // dataLocalISO() no front-end (estado-global.js). Isso fecha o
        // ciclo da correção de fuso do item 0.2: se o front gravasse local
        // mas o backend sempre devolvesse UTC na leitura, o bug do filtro
        // "hoje" voltaria a aparecer depois de um F5. Pra funcionar sem
        // desvio nenhum, o fuso do projeto (Configurações do projeto →
        // Fuso horário, no editor do Apps Script) precisa bater com o fuso
        // de quem lança os dias.
        estado.dayDates[dia - 1] = linha[1] ? Utilities.formatDate(new Date(linha[1]), fusoScript, "yyyy-MM-dd'T'HH:mm:ss.SSS") : null;
      }
    });
  }

  return estado;
}

function salvarRanking(token, estado) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
    if (!estado || !Array.isArray(estado.divisoes)) {
      return criarResposta({ sucesso: false, erro: 'Dados de ranking inválidos (esperado estado.divisoes — veja a nota no topo deste arquivo sobre atualizar front-end e backend juntos).' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaParticipantes = obterOuCriarAba(planilha, ABA_PARTICIPANTES, CABECALHO_PARTICIPANTES);
    const abaPontuacoes = obterOuCriarAba(planilha, ABA_PONTUACOES, CABECALHO_PONTUACOES);
    const abaConfig = obterOuCriarAba(planilha, ABA_CONFIG, CABECALHO_CONFIG);
    const abaDias = obterOuCriarAba(planilha, ABA_DIAS, CABECALHO_DIAS);
    const abaFaixas = obterOuCriarAba(planilha, ABA_FAIXAS, CABECALHO_FAIXAS);

    limparAbaExcetoCabecalho(abaParticipantes);
    limparAbaExcetoCabecalho(abaPontuacoes);
    limparAbaExcetoCabecalho(abaDias);
    limparAbaExcetoCabecalho(abaFaixas);

    const agora = new Date();
    const linhasParticipantes = [];
    const linhasPontuacoes = [];
    const linhasFaixas = [];
    let totalParticipantes = 0;

    estado.divisoes.forEach(function (divisao, ordem) {
      const divisaoId = String(divisao && divisao.id ? divisao.id : '').trim().toLowerCase();
      if (!divisaoId) return;

      linhasFaixas.push([
        divisaoId,
        String((divisao.titulo || divisaoId)),
        String(divisao.intervalo || ''),
        String(divisao.cor || '--panel-2'),
        ordem + 1
      ]);

      (divisao.participantes || []).forEach(function (p) {
        const nome = String(p && p.name ? p.name : '').trim();
        if (!nome) return;
        totalParticipantes++;
        linhasParticipantes.push([divisaoId, nome, agora]);
        (p.scores || []).forEach(function (valor, i) {
          if (valor !== null && valor !== undefined && valor !== '') {
            const numero = Number(valor);
            if (!isNaN(numero)) linhasPontuacoes.push([divisaoId, nome, i + 1, numero]);
          }
        });
      });
    });

    if (linhasParticipantes.length) {
      abaParticipantes.getRange(2, 1, linhasParticipantes.length, CABECALHO_PARTICIPANTES.length).setValues(linhasParticipantes);
    }
    if (linhasPontuacoes.length) {
      abaPontuacoes.getRange(2, 1, linhasPontuacoes.length, CABECALHO_PONTUACOES.length).setValues(linhasPontuacoes);
    }
    if (linhasFaixas.length) {
      abaFaixas.getRange(2, 1, linhasFaixas.length, CABECALHO_FAIXAS.length).setValues(linhasFaixas);
    }

    const diasTotal = Number(estado.days) || 0;
    const dayDatesRecebidas = Array.isArray(estado.dayDates) ? estado.dayDates : [];
    const linhasDias = [];
    for (let i = 0; i < diasTotal; i++) {
      linhasDias.push([i + 1, dayDatesRecebidas[i] ? new Date(dayDatesRecebidas[i]) : agora]);
    }
    if (linhasDias.length) {
      abaDias.getRange(2, 1, linhasDias.length, CABECALHO_DIAS.length).setValues(linhasDias);
    }

    escreverConfig(abaConfig, 'Dias_Total', diasTotal);

    registrarLog(sessao.nome, 'Salvou o ranking — ' + diasTotal + ' dia(s), ' + totalParticipantes + ' participante(s), ' + linhasFaixas.length + ' faixa(s)');

    return criarResposta({ sucesso: true, mensagem: 'Ranking salvo com sucesso!' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao salvar ranking: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}


// ==================== OCR DE IMAGEM (ler print de ranking pra pontuação) ====================
// Lê um print (ex.: ranking do Simco Tools) usando o OCR nativo do Google
// Drive: sobe a imagem como uma cópia temporária em Google Docs com o texto
// já reconhecido, lê esse texto, apaga a cópia e devolve tudo já formatado
// como "Nome, Pontuação;" — pronto pra colar na aba "Colar". Precisa do
// serviço avançado "Drive API" ativado no projeto (veja OCR_CONFIGURACAO.md).
// Não depende de faixa nenhuma — a escolha de qual faixa cada nome
// reconhecido pertence é feita depois, no front-end (colagem.js), então
// esta seção não precisou de nenhuma mudança nesta atualização.
//
// Regra de pontuação por posição no dia (a mesma do painel "Regra de
// Pontuação" no app): a ORDEM das linhas na imagem é a classificação do dia
// (1º ao último) — não o número da coluna "Posição" do Simco Tools, que é
// outra métrica. 1º=+10 ... 10º=+1, 11º=0; a partir do 12º vira negativo:
// decrescente 1 a 1 se a faixa tiver até 14 participantes, ou escalonado de
// 2 em 2 posições (12º-13º=-1, 14º-15º=-2, 16º-17º=-3...) se tiver 15 ou mais.

function ocrImagem(token, imagemBase64, mimeType) {
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
    if (!imagemBase64) return criarResposta({ sucesso: false, erro: 'Nenhuma imagem recebida.' });

    if (!verificarRateLimit('ocr_' + sessao.idUsuario, RATE_LIMIT_OCR_MAX, RATE_LIMIT_OCR_JANELA_SEGUNDOS)) {
      return criarResposta({ sucesso: false, erro: 'Limite de leituras por OCR atingido. Tente novamente daqui a pouco.' });
    }

    const tipo = mimeType || 'image/png';
    const MIMES_PERMITIDOS_OCR = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (MIMES_PERMITIDOS_OCR.indexOf(tipo) === -1) {
      return criarResposta({ sucesso: false, erro: 'Formato de imagem não suportado (use PNG, JPEG ou WEBP).' });
    }

    let bytes;
    try {
      bytes = Utilities.base64Decode(imagemBase64);
    } catch (erroBase64) {
      return criarResposta({ sucesso: false, erro: 'Imagem inválida (dados corrompidos).' });
    }
    const MAX_BYTES_IMAGEM_OCR = 8 * 1024 * 1024; // 8MB — folga generosa pra print de tela em alta resolução
    if (bytes.length > MAX_BYTES_IMAGEM_OCR) {
      return criarResposta({ sucesso: false, erro: 'Imagem muito grande (máximo 8MB).' });
    }

    const blob = Utilities.newBlob(bytes, tipo, 'ranking_ocr_' + new Date().getTime());

    const textoOcr = extrairTextoComOcr(blob);
    const nomes = extrairNomesDoTextoOcr(textoOcr);
    const totalParticipantes = nomes.length;
    const textoFormatado = nomes.map(function (nome, i) {
      return nome + ', ' + pontosPorPosicao(i + 1, totalParticipantes) + ';';
    }).join('\n');

    registrarLog(sessao.nome, 'Leu uma imagem por OCR (' + totalParticipantes + ' participante(s) reconhecido(s))');

    return criarResposta({
      sucesso: true,
      dados: { textoFormatado: textoFormatado, textoOcrBruto: textoOcr, linhas: totalParticipantes }
    });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao ler a imagem por OCR: ' + erro.message });
  }
}

// Sobe a imagem como uma cópia temporária em Google Docs com "ocr: true"
// (é isso que aciona o reconhecimento nativo do Drive), lê o texto do corpo
// do documento gerado, e SEMPRE apaga essa cópia temporária depois — mesmo
// se a leitura falhar — pra não acumular arquivo na conta do Google.
function extrairTextoComOcr(blob) {
  const recurso = { name: blob.getName(), mimeType: MimeType.GOOGLE_DOCS };
  const arquivoTemporario = Drive.Files.create(recurso, blob, { ocr: true, ocrLanguage: 'pt' });
  try {
    const documento = DocumentApp.openById(arquivoTemporario.id);
    return documento.getBody().getText();
  } finally {
    try { Drive.Files.remove(arquivoTemporario.id); } catch (erroLimpeza) { /* não derruba a ação principal */ }
  }
}

function pontosPorPosicao(posicao, totalParticipantes) {
  if (posicao <= 10) return 11 - posicao;
  if (posicao === 11) return 0;
  if (totalParticipantes <= 14) return -(posicao - 11);
  const deslocamento = posicao - 12; // 12=0, 13=1, 14=2, 15=3, 16=4...
  const par = Math.floor(deslocamento / 2) + 1; // 0,1→1 · 2,3→2 · 4,5→3...
  return -par;
}

// Um "token" (palavra separada por espaço) parece nome de empresa se tiver
// pelo menos uma letra e não for dominado por dígitos/símbolos de moeda ou
// percentual — assim uma linha como "3 8.840 +127 lobo de wall street
// $ 17.147.962 +4,32%" sobra só com "lobo de wall street".
function pareceNomeEmpresa(token) {
  const letras = (token.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letras < 1) return false;
  if (/^[+\-]?R?\$?\s?[\d.,]+%?$/.test(token)) return false;
  const digitos = (token.match(/[0-9]/g) || []).length;
  return letras >= digitos;
}

const OCR_ROTULOS_IGNORADOS = new Set([
  // conectores comuns — não bloqueiam a linha inteira, só não contam sozinhos
  // como "palavra real" (assim "lobo de wall street" continua passando)
  'DE', 'DA', 'DO', 'DAS', 'DOS', 'E',
  // cabeçalhos de coluna e título comuns numa tela de ranking — ajuste esta
  // lista se a sua fonte usar outras palavras de cabeçalho
  'POSIÇÃO', 'POSICAO', 'DIFF', 'EMPRESA', 'VALOR', 'VALUE', 'CHANGE', 'RANKING',
  'SIMCO', 'TOOLS', 'MAGNATAS',
  // meses (aparecem em datas tipo "22 DE JULHO DE 2026")
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO',
  'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
]);

// Varre o texto reconhecido linha por linha; em cada linha, mantém só os
// tokens que parecem nome de empresa. Uma linha só vira "candidata a nome"
// se sobrar pelo menos UMA palavra que não seja conector/rótulo — isso deixa
// "lobo de wall street" intacto (o "de" sobrevive por estar ao lado de
// palavras reais) mas descarta uma linha de cabeçalho/data que só tenha
// conectores e rótulos. A ORDEM das linhas reconhecidas vira a posição do
// dia (1ª linha = 1º colocado etc.), por isso a imagem precisa mostrar a
// faixa inteira já ordenada por crescimento do dia, do 1º ao último colocado.
function extrairNomesDoTextoOcr(textoOcr) {
  const linhas = String(textoOcr || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  const nomes = [];
  linhas.forEach(function (linha) {
    const tokens = linha.split(/\s+/).filter(pareceNomeEmpresa);
    if (!tokens.length) return;
    const temPalavraReal = tokens.some(function (tok) { return !OCR_ROTULOS_IGNORADOS.has(tok.toUpperCase()); });
    if (!temPalavraReal) return;
    const nome = tokens.join(' ').trim();
    if (nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 2) nomes.push(nome);
  });
  return nomes;
}


// ==================== RESUMOS SALVOS (histórico protegido) ====================
// Aba própria, alimentada só por "append" — o app nunca edita nem apaga
// linhas aqui, então o histórico sobrevive mesmo se o ranking do dia a dia
// for limpo ou reiniciado. Qualquer conta logada pode ler (usado tanto pelo
// painel "Resumos Salvos", só de administrador, quanto pelo card "Resumo do
// Último Dia" em Análises Gerais, que qualquer papel acessa).

function salvarResumo(token, dia, texto) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();

    const textoResumo = texto ? String(texto).substring(0, 20000) : '';
    if (!textoResumo.trim()) {
      return criarResposta({ sucesso: false, erro: 'Nada para salvar — gere o resumo primeiro.' });
    }
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaResumos = obterOuCriarAba(planilha, ABA_RESUMOS, CABECALHO_RESUMOS);
    abaResumos.appendRow([new Date(), Number(dia) || 0, textoResumo]);

    registrarLog(sessao.nome, 'Salvou o resumo do Dia ' + (Number(dia) || 0));

    return criarResposta({ sucesso: true, mensagem: 'Resumo salvo no histórico!' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao salvar resumo: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function listarResumosSalvos() {
  const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
  const abaResumos = planilha.getSheetByName(ABA_RESUMOS);
  const resumos = [];
  if (abaResumos && abaResumos.getLastRow() > 1) {
    const linhas = abaResumos.getRange(2, 1, abaResumos.getLastRow() - 1, CABECALHO_RESUMOS.length).getValues();
    linhas.forEach(function (linha) {
      resumos.push({ dataHora: linha[0], dia: linha[1], texto: linha[2] });
    });
    resumos.reverse(); // mais recente primeiro
  }
  return resumos;
}


// ==================== UTILITÁRIOS ====================

function lerConfig(abaConfig, chave, padrao) {
  if (!abaConfig || abaConfig.getLastRow() < 2) return padrao;
  const linhas = abaConfig.getRange(2, 1, abaConfig.getLastRow() - 1, 2).getValues();
  for (let i = 0; i < linhas.length; i++) {
    if (String(linhas[i][0]) === chave) return linhas[i][1];
  }
  return padrao;
}

function escreverConfig(abaConfig, chave, valor) {
  const ultimaLinha = abaConfig.getLastRow();
  if (ultimaLinha > 1) {
    const linhas = abaConfig.getRange(2, 1, ultimaLinha - 1, 1).getValues();
    for (let i = 0; i < linhas.length; i++) {
      if (String(linhas[i][0]) === chave) {
        abaConfig.getRange(i + 2, 2).setValue(valor);
        return;
      }
    }
  }
  abaConfig.appendRow([chave, valor]);
}

function limparAbaExcetoCabecalho(aba) {
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha > 1) {
    aba.getRange(2, 1, ultimaLinha - 1, Math.max(aba.getLastColumn(), 1)).clearContent();
  }
}

function obterOuCriarAba(planilha, nome, cabecalho) {
  let aba = planilha.getSheetByName(nome);
  if (!aba) {
    aba = planilha.insertSheet(nome);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    formatarCabecalho(aba, cabecalho.length);
  }
  return aba;
}

function formatarCabecalho(aba, numColunas) {
  aba.getRange(1, 1, 1, numColunas).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
  aba.setFrozenRows(1);
  try { aba.autoResizeColumns(1, numColunas); } catch (e) { /* ignora se falhar em planilha vazia */ }
}

// Hash "clássico" (uma passada de SHA-256 + salt) — mantido por causa de
// contas já cadastradas com esse formato (ver verificarSenha, abaixo, que
// aceita os dois formatos). NÃO use mais esta função para senha nova —
// use gerarHashSenhaV2. Ainda é usada para o código temporário de 6
// dígitos (Codigo_Temp_Hash), que já expira sozinho em 30 minutos e é de
// uso único, então o custo mais baixo aqui não é um problema real.
function gerarHashSenha(valor, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(valor) + '::' + String(salt), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// Quantas vezes repetir o SHA-256 em série no hash de senha "v2". Apps
// Script não tem PBKDF2/bcrypt/Argon2 nativos — repetir um hash rápido
// muitas vezes ("key stretching" artesanal) não é tão forte quanto um KDF
// de verdade, mas já multiplica bastante o custo de um ataque de força
// bruta offline comparado a uma única passada, sem precisar de nenhuma
// biblioteca externa. 10.000 voltas leva uma fração de segundo no V8 do
// Apps Script — não deve ser perceptível no login.
const HASH_ITERACOES_V2 = 10000;

// Hash de senha "v2": prefixo "v2$" + SHA-256 repetido HASH_ITERACOES_V2
// vezes. Use esta função para TODA senha nova (cadastro, definir nova
// senha, conta admin inicial) a partir de agora.
function gerarHashSenhaV2(valor, salt) {
  let atual = String(valor) + '::' + String(salt);
  for (let i = 0; i < HASH_ITERACOES_V2; i++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, atual, Utilities.Charset.UTF_8);
    atual = bytes.map(function (b) {
      const v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  }
  return 'v2$' + atual;
}

// Verifica uma senha contra o hash salvo na planilha, aceitando tanto o
// formato antigo (gerarHashSenha — sem prefixo, uma passada) quanto o novo
// (gerarHashSenhaV2 — prefixo "v2$"). Devolve { bate, precisaAtualizar }:
// quando precisaAtualizar vier true, quem chamou deve regravar o hash em
// formato v2 na hora (upgrade "preguiçoso" — só acontece pra quem realmente
// consegue entrar com a senha certa, então nenhuma conta é bloqueada por
// causa dessa migração, ela só acontece sozinha no próximo login de cada
// pessoa).
function verificarSenha(senhaInformada, hashSalvo, salt) {
  const hash = String(hashSalvo || '');
  if (hash.indexOf('v2$') === 0) {
    return { bate: gerarHashSenhaV2(senhaInformada, salt) === hash, precisaAtualizar: false };
  }
  const bateLegado = gerarHashSenha(senhaInformada, salt) === hash;
  return { bate: bateLegado, precisaAtualizar: bateLegado };
}

function criarResposta(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}


// ==================== SETUP (rodar manualmente uma vez) ====================

/**
 * Rode esta função UMA VEZ pelo editor do Apps Script (selecione o nome dela
 * no menu suspenso ao lado de "Executar" e clique em "Executar") para criar
 * e formatar automaticamente as abas na Planilha Mestra e criar a primeira
 * conta de administrador (a partir de ADMIN_PADRAO_NOME/EMAIL/SENHA, lá em
 * cima).
 *
 * Seguro rodar de novo: só cria o que ainda não existe e nunca sobrescreve
 * uma conta já criada. Numa planilha que já vinha de uma versão sem faixas
 * dinâmicas, rodar esta função de novo também é seguro — ela só cria a aba
 * "Faixas" com Faixa X/Faixa Y se essa aba ainda não existir; não mexe em
 * Participantes/Pontuacoes já existentes.
 *
 * IMPORTANTE: se esta planilha já tinha uma aba "Usuarios" de uma versão
 * anterior (sem login — só nome, sem e-mail/senha) ou da versão multi-tenant
 * antiga (com "Grupos"), apague ou renomeie essas abas ANTES de rodar esta
 * função — a estrutura de colunas mudou e contas antigas não podem ser
 * reaproveitadas automaticamente (não tinham e-mail nem senha). Cada pessoa
 * deve criar uma conta nova pela tela "Crie sua conta".
 */
function configurarPlanilhaMestra() {
  const admin = obterCredenciaisAdminPadrao();
  const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
  obterOuCriarAba(planilha, ABA_PARTICIPANTES, CABECALHO_PARTICIPANTES);
  obterOuCriarAba(planilha, ABA_PONTUACOES, CABECALHO_PONTUACOES);
  const abaConfig = obterOuCriarAba(planilha, ABA_CONFIG, CABECALHO_CONFIG);
  const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
  obterOuCriarAba(planilha, ABA_LOG, CABECALHO_LOG);
  obterOuCriarAba(planilha, ABA_RESUMOS, CABECALHO_RESUMOS);
  obterOuCriarAba(planilha, ABA_DIAS, CABECALHO_DIAS);

  const abaFaixas = obterOuCriarAba(planilha, ABA_FAIXAS, CABECALHO_FAIXAS);
  if (abaFaixas.getLastRow() < 2) {
    abaFaixas.appendRow(['x', 'Faixa X', '0 a 19.999M', '--x-color', 1]);
    abaFaixas.appendRow(['y', 'Faixa Y', '20M ou mais', '--y-color', 2]);
  }

  if (lerConfig(abaConfig, 'Dias_Total', null) === null) {
    escreverConfig(abaConfig, 'Dias_Total', 0);
  }

  if (localizarLinhaUsuarioPorEmail(abaUsuarios, admin.email) === -1) {
    const salt = Utilities.getUuid();
    abaUsuarios.appendRow([
      Utilities.getUuid(), admin.nome, normalizarEmail(admin.email),
      gerarHashSenhaV2(admin.senha, salt), salt, PAPEL_ADMIN, new Date(), '', '', false
    ]);
  }

  Logger.log('Planilha Mestra configurada com sucesso!');
  return 'Planilha Mestra configurada com sucesso! Entre no app com o e-mail ' + admin.email +
    ' e a senha definida em ADMIN_PADRAO_SENHA (Propriedades do Script), e troque essa senha assim que possível ' +
    '(Configurações Gerais → Configurações de conta, ou "Esqueceu sua senha?" na tela de login).';
}

// Lê as credenciais da PRIMEIRA conta de administrador das Propriedades do
// Script (nunca do código-fonte — ver comentário nas CONFIGURAÇÕES, no
// topo do arquivo). Lança um erro claro se ainda não tiverem sido
// configuradas, em vez de criar uma conta com senha vazia/indefinida.
function obterCredenciaisAdminPadrao() {
  const props = PropertiesService.getScriptProperties();
  const nome = props.getProperty('ADMIN_PADRAO_NOME') || 'Administrador';
  const email = props.getProperty('ADMIN_PADRAO_EMAIL');
  const senha = props.getProperty('ADMIN_PADRAO_SENHA');
  if (!email || !senha) {
    throw new Error(
      'Configure ADMIN_PADRAO_EMAIL e ADMIN_PADRAO_SENHA em "Configurações do projeto → ' +
      'Propriedades do Script" (menu ⚙️ no editor do Apps Script) antes de rodar configurarPlanilhaMestra().'
    );
  }
  return { nome: nome, email: email, senha: senha };
}
