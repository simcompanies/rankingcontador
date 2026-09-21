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
 * deployment já existente (Implantar → Gerenciar implantações →  → Nova
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

// Credenciais de bootstrap NÃO ficam no código. Antes de rodar
// configurarPlanilhaMestra(), defina no Apps Script → Configurações do
// projeto → Propriedades do script: ADMIN_BOOTSTRAP_NOME,
// ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_SENHA. A senha é apagada da
// propriedade automaticamente após a criação da primeira conta.
const PROP_ADMIN_NOME = 'ADMIN_BOOTSTRAP_NOME';
const PROP_ADMIN_EMAIL = 'ADMIN_BOOTSTRAP_EMAIL';
const PROP_ADMIN_SENHA = 'ADMIN_BOOTSTRAP_SENHA';

const ABA_PARTICIPANTES = 'Participantes';
const ABA_PONTUACOES = 'Pontuacoes';
const ABA_CONFIG = 'Config';
const ABA_USUARIOS = 'Usuarios';
const ABA_LOG = 'Log';
const ABA_RESUMOS = 'ResumosSalvos';
const ABA_DIAS = 'Dias';
const ABA_FAIXAS = 'Faixas';
const ABA_HISTORICO_SERIES = 'HistoricoSeries';

const CABECALHO_PARTICIPANTES = ['Participant_ID', 'Divisao', 'Nome', 'Data_Adicionado'];
const CABECALHO_PONTUACOES = ['Participant_ID', 'Divisao', 'Nome', 'Dia', 'Pontuacao'];
const CABECALHO_CONFIG = ['Chave', 'Valor'];
const CABECALHO_USUARIOS = ['ID_Usuario', 'Nome', 'Email', 'Senha_Hash', 'Salt', 'Papel', 'Data_Criacao', 'Codigo_Temp_Hash', 'Codigo_Temp_Expira', 'Reset_Pendente'];
const CABECALHO_LOG = ['Data_Hora', 'Usuario', 'Acao'];
const CABECALHO_RESUMOS = ['Data_Hora','Serie_ID','Serie_Numero','Dia','Day_ID','Data_Dia','Revision','Texto'];
const CABECALHO_DIAS = ['Dia', 'Day_ID', 'Data'];
const CABECALHO_FAIXAS = ['ID', 'Titulo', 'Intervalo', 'Cor', 'Ordem'];
const CABECALHO_HISTORICO_SERIES = ['Serie_ID','Serie_Numero','Arquivada_Em','Arquivada_Por','Participant_ID','Divisao_ID','Divisao_Titulo','Nome','Dia_Serie','Day_ID','Data_Referencia','Pontuacao'];

const PAPEL_ADMIN = 'administrador';
const PAPEL_MEMBRO = 'membro';

const DURACAO_SESSAO_SEGUNDOS = 21600; // 6h — máximo permitido pelo CacheService
const DURACAO_CODIGO_TEMP_MINUTOS = 30;
const LOG_MAX_LINHAS = 300; // evita que a aba de log cresça pra sempre

const RATE_LIMIT_MAX_TENTATIVAS = 5; // tentativas de login falhas permitidas por e-mail dentro da janela
const RATE_LIMIT_JANELA_SEGUNDOS = 900; // 15 minutos

const HASH_VERSAO = 'v3';
const HASH_ITERACOES = 1500; // v3: custo moderado + pepper secreto; reduz bastante a latência do Apps Script
const HASH_V2_ITERACOES = 12000; // compatibilidade: contas antigas são migradas após o primeiro login bem-sucedido
const PROP_PASSWORD_PEPPER = 'PASSWORD_PEPPER_V3';


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
    if (action === 'bootstrap') {
      // v47: sessão + ranking em uma única viagem HTTP. Isso elimina a espera
      // sequencial verificarSessao -> listarRanking na abertura do PWA.
      const sessao = obterSessao(e.parameter.token);
      if (!sessao) return respostaSessaoExpirada();
      return criarResposta({ sucesso:true, dados:{ sessao:sessao, ranking:carregarRanking() } });
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
    if (action === 'listarHistoricoSeries') {
      const sessao = obterSessao(e.parameter.token);
      if (!sessao) return respostaSessaoExpirada();
      return criarResposta({ sucesso: true, dados: listarHistoricoSeries() });
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
    const corpo = JSON.parse(e.postData.contents);

    switch (corpo.action) {
      case 'cadastrar':
        return cadastrar(corpo.nome, corpo.email, corpo.senha, corpo.confirmarSenha);
      case 'login':
        return login(corpo.email, corpo.senha);
      case 'logout':
        return logout(corpo.token);
      case 'registrarEventoSessao':
        return registrarEventoSessao(corpo.token, corpo.evento);
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
        return salvarResumo(corpo.token, corpo.dia, corpo.dayId, corpo.dayDate, corpo.revision, corpo.texto);
      case 'encerrarSerie':
        return encerrarSerie(corpo.token, corpo.modo, corpo.estado);
      case 'reiniciarSerie':
        return reiniciarSerie(corpo.token, corpo.modo, corpo.estado);
      case 'editarSerieHistorica':
        return editarSerieHistorica(corpo.token, corpo.serieId, corpo.alteracoes);
      default:
        return criarResposta({ sucesso: false, erro: 'Ação POST não reconhecida: ' + corpo.action });
    }
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: erro.message });
  }
}


// ==================== SESSÃO ====================
// Cada login gera um token guardado no CacheService. O token carrega apenas
// o id e a versão da sessão; existência, nome, e-mail e papel são relidos na
// aba Usuarios em toda requisição. Isso permite revogação imediata.

function chaveVersaoSessao(idUsuario) {
  return 'sessao_versao_' + String(idUsuario);
}

function obterVersaoSessaoUsuario(idUsuario) {
  const props = PropertiesService.getScriptProperties();
  const bruto = props.getProperty(chaveVersaoSessao(idUsuario));
  return Math.max(0, Number(bruto) || 0);
}

function invalidarSessoesUsuario(idUsuario) {
  const props = PropertiesService.getScriptProperties();
  const atual = obterVersaoSessaoUsuario(idUsuario);
  props.setProperty(chaveVersaoSessao(idUsuario), String(atual + 1));
}

function criarSessao(usuario) {
  const token = Utilities.getUuid();
  // O perfil mínimo fica no próprio payload de sessão. A versão continua
  // sendo comparada a cada requisição; adminRemoverUsuario/adminAlterarPapel
  // incrementam essa versão, portanto revogação continua imediata sem abrir
  // a planilha Usuarios em toda chamada.
  const payload = JSON.stringify({
    idUsuario: usuario.idUsuario,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    versaoSessao: obterVersaoSessaoUsuario(usuario.idUsuario)
  });
  CacheService.getScriptCache().put('sessao_' + token, payload, DURACAO_SESSAO_SEGUNDOS);
  return token;
}

function obterSessao(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const bruto = cache.get('sessao_' + String(token));
  if (!bruto) return null;
  try {
    const payload = JSON.parse(bruto);
    if (!payload.idUsuario || !payload.nome || !payload.email || !payload.papel) return null;
    if (Number(payload.versaoSessao || 0) !== obterVersaoSessaoUsuario(payload.idUsuario)) {
      cache.remove('sessao_' + String(token));
      return null;
    }
    return {
      idUsuario: payload.idUsuario,
      nome: payload.nome,
      email: payload.email,
      papel: payload.papel
    };
  } catch (erro) {
    cache.remove('sessao_' + String(token));
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

function registrarEventoSessao(token, evento) {
  const sessao = obterSessao(token);
  if (!sessao) return respostaSessaoExpirada();
  const tipo = String(evento || '').toLowerCase();
  const mensagens = {
    login: 'Entrou na conta',
    login_temporario: 'Entrou com código temporário'
  };
  if (!mensagens[tipo]) return criarResposta({ sucesso:false, erro:'Evento de sessão inválido.' });
  registrarLog(sessao.nome, mensagens[tipo]);
  return criarResposta({ sucesso:true });
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
// Janela persistente em PropertiesService, indexada por hash do e-mail.
// Não desaparece por simples evicção do CacheService e cobre senha e código
// temporário, ambos validados dentro de login().

function chaveTentativasLogin(emailNormalizado) {
  const digest = bytesParaHex(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(emailNormalizado || ''),
    Utilities.Charset.UTF_8
  )).slice(0, 32);
  return 'tentativas_login_' + digest;
}

function lerJanelaTentativasLogin(emailNormalizado) {
  const props = PropertiesService.getScriptProperties();
  const chave = chaveTentativasLogin(emailNormalizado);
  const bruto = props.getProperty(chave);
  if (!bruto) return { count:0, resetAt:0, chave:chave };
  try {
    const dado = JSON.parse(bruto);
    if (!dado.resetAt || Date.now() >= Number(dado.resetAt)) {
      props.deleteProperty(chave);
      return { count:0, resetAt:0, chave:chave };
    }
    return { count:Math.max(0, Number(dado.count)||0), resetAt:Number(dado.resetAt)||0, chave:chave };
  } catch (e) {
    props.deleteProperty(chave);
    return { count:0, resetAt:0, chave:chave };
  }
}

function tentativasLoginExcedidas(emailNormalizado) {
  return lerJanelaTentativasLogin(emailNormalizado).count >= RATE_LIMIT_MAX_TENTATIVAS;
}

function limparJanelasTentativasLogin() {
  const props = PropertiesService.getScriptProperties();
  const todos = props.getProperties();
  const agora = Date.now();
  const ativos = [];
  Object.keys(todos).forEach(function(chave){
    if (chave.indexOf('tentativas_login_') !== 0) return;
    try {
      const dado = JSON.parse(todos[chave]);
      const resetAt = Number(dado.resetAt) || 0;
      if (!resetAt || agora >= resetAt) props.deleteProperty(chave);
      else ativos.push({ chave:chave, resetAt:resetAt });
    } catch (e) {
      props.deleteProperty(chave);
    }
  });
  // Evita crescimento indefinido das Script Properties em ataques que usam
  // muitos e-mails diferentes. Preserva as 100 janelas com expiração mais recente.
  if (ativos.length > 100) {
    ativos.sort(function(a,b){ return b.resetAt - a.resetAt; });
    ativos.slice(100).forEach(function(item){ props.deleteProperty(item.chave); });
  }
}

function registrarTentativaLoginFalha(emailNormalizado) {
  const props = PropertiesService.getScriptProperties();
  limparJanelasTentativasLogin();
  const atual = lerJanelaTentativasLogin(emailNormalizado);
  const resetAt = atual.resetAt || (Date.now() + RATE_LIMIT_JANELA_SEGUNDOS * 1000);
  props.setProperty(atual.chave, JSON.stringify({ count:atual.count + 1, resetAt:resetAt }));
}

function limparTentativasLogin(emailNormalizado) {
  PropertiesService.getScriptProperties().deleteProperty(chaveTentativasLogin(emailNormalizado));
}

function cadastrar(nome, email, senha, confirmarSenha) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const nomeNormalizado = nome ? String(nome).trim() : '';
    const emailNormalizado = normalizarEmail(email);
    const senhaInformada = senha ? String(senha) : '';

    if (!nomeNormalizado) return criarResposta({ sucesso: false, erro: 'Informe seu nome.' });
    if (/[<>]/.test(nomeNormalizado)) return criarResposta({ sucesso: false, erro: 'O nome não pode conter os caracteres < ou >.' });
    if (!emailValido(emailNormalizado)) return criarResposta({ sucesso: false, erro: 'Informe um e-mail válido.' });
    if (senhaInformada.length < 8) return criarResposta({ sucesso: false, erro: 'A senha deve ter pelo menos 8 caracteres.' });
    if (senhaInformada !== String(confirmarSenha || '')) return criarResposta({ sucesso: false, erro: 'As senhas não conferem.' });

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);

    if (localizarLinhaUsuarioPorEmail(abaUsuarios, emailNormalizado) !== -1) {
      return criarResposta({ sucesso: false, erro: 'Já existe uma conta com esse e-mail.' });
    }

    const salt = Utilities.getUuid();
    const idUsuario = Utilities.getUuid();
    abaUsuarios.appendRow([
      idUsuario, nomeNormalizado, emailNormalizado, gerarHashSenha(senhaInformada, salt), salt,
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
  // Login não usa o lock global do ranking: um salvamento grande não deve
  // colocar quem está entrando na fila por vários segundos.
  try {
    const inicio = Date.now();
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

    const verificacaoSenha = verificarHashSenha(senhaInformada, usuario.salt, usuario.senhaHash);
    if (verificacaoSenha.ok) {
      // Migração transparente: uma conta v1/v2 paga o custo antigo apenas no
      // primeiro login após a atualização. Daí em diante usa v3, bem mais rápido.
      if (verificacaoSenha.legado) {
        const novoHash = gerarHashSenha(senhaInformada, usuario.salt);
        abaUsuarios.getRange(linha, 4).setValue(novoHash);
        usuario.senhaHash = novoHash;
      }
      limparTentativasLogin(emailNormalizado);
      const token = criarSessao(usuario);
      let rankingInicial = null;
      try { rankingInicial = carregarRanking(); } catch (erroRanking) { console.warn('Login concluído, mas o ranking será carregado pelo frontend: ' + erroRanking.message); }
      return criarResposta({
        sucesso: true,
        dados: {
          token: token, idUsuario: usuario.idUsuario, nome: usuario.nome,
          email: usuario.email, papel: usuario.papel, precisaTrocarSenha: false,
          ranking: rankingInicial,
          tempoServidorMs: Date.now() - inicio
        }
      });
    }

    // a senha normal não bateu — tenta o código temporário
    if (usuario.codigoTempHash && usuario.codigoTempExpira && Date.now() <= new Date(usuario.codigoTempExpira).getTime()) {
      if (verificarHashSenha(senhaInformada, usuario.salt, usuario.codigoTempHash).ok) {
        limparTentativasLogin(emailNormalizado);
        abaUsuarios.getRange(linha, 8, 1, 3).setValues([['', '', false]]);
        const token = criarSessao(usuario);
        let rankingInicial = null;
        try { rankingInicial = carregarRanking(); } catch (erroRanking) { console.warn('Login temporário concluído, mas o ranking será carregado pelo frontend: ' + erroRanking.message); }
        return criarResposta({
          sucesso: true,
          dados: {
            token: token, idUsuario: usuario.idUsuario, nome: usuario.nome,
            email: usuario.email, papel: usuario.papel, precisaTrocarSenha: true,
            ranking: rankingInicial,
            tempoServidorMs: Date.now() - inicio
          }
        });
      }
    }

    registrarTentativaLoginFalha(emailNormalizado);
    return criarResposta({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
  } catch (erro) {
    return criarResposta({ sucesso: false, erro: 'Erro ao entrar: ' + erro.message });
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

  const assunto = 'Ranking Geral — código temporário de acesso';
  const corpo = 'Olá, ' + usuario.nome + '!\n\n' +
    'Use o código abaixo no lugar da sua senha pra entrar no Ranking Geral. Ele vale por ' +
    DURACAO_CODIGO_TEMP_MINUTOS + ' minutos e só funciona uma vez — assim que você entrar com ' +
    'ele, o app já vai pedir pra você definir uma senha nova.\n\n' +
    'Código: ' + codigo + '\n\n' +
    'Se você não pediu isso, pode ignorar este e-mail.';

  // Só grava um código válido depois que o MailApp confirma o envio. Assim a
  // interface nunca responde "enviado" quando o e-mail efetivamente falhou.
  try {
    MailApp.sendEmail(usuario.email, assunto, corpo);
  } catch (erro) {
    throw new Error('Falha ao enviar o e-mail de recuperação: ' + erro.message);
  }
  abaUsuarios.getRange(linha, 8, 1, 3).setValues([[gerarHashSenha(codigo, usuario.salt), expira, false]]);
  registrarLog(usuario.nome, 'Recebeu um código temporário de acesso');
  return true;
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
    if (senhaNova.length < 8) return criarResposta({ sucesso: false, erro: 'A nova senha deve ter pelo menos 8 caracteres.' });
    if (senhaNova !== String(confirmarNovaSenha || '')) return criarResposta({ sucesso: false, erro: 'As senhas não conferem.' });

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
    const linha = localizarLinhaUsuarioPorId(abaUsuarios, sessao.idUsuario);
    if (linha === -1) return criarResposta({ sucesso: false, erro: 'Conta não encontrada.' });

    const salt = Utilities.getUuid();
    abaUsuarios.getRange(linha, 4, 1, 2).setValues([[gerarHashSenha(senhaNova, salt), salt]]); // Senha_Hash, Salt
    abaUsuarios.getRange(linha, 8, 1, 3).setValues([['', '', false]]); // limpa código temporário e pendência
    invalidarSessoesUsuario(sessao.idUsuario);
    encerrarSessao(token);
    const valoresAtualizados = abaUsuarios.getRange(linha, 1, 1, CABECALHO_USUARIOS.length).getValues()[0];
    const usuarioAtualizado = linhaParaUsuario(valoresAtualizados);
    const novoToken = criarSessao(usuarioAtualizado);
    registrarLog(sessao.nome, 'Definiu uma nova senha e invalidou sessões anteriores');

    return criarResposta({ sucesso: true, mensagem: 'Senha atualizada com sucesso!', dados:{ token:novoToken } });
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
    invalidarSessoesUsuario(idUsuario);
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
    invalidarSessoesUsuario(idUsuario);
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

function cabecalhoAtual(aba) {
  if (!aba || aba.getLastColumn() < 1) return [];
  return aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String);
}

function cabecalhoIgual(atual, esperado) {
  if (atual.length < esperado.length) return false;
  for (let i = 0; i < esperado.length; i++) if (String(atual[i]) !== String(esperado[i])) return false;
  return true;
}

function reescreverAbaCompleta(aba, cabecalho, linhas) {
  aba.clearContents();
  aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  if (linhas && linhas.length) aba.getRange(2, 1, linhas.length, cabecalho.length).setValues(linhas);
  formatarCabecalho(aba, cabecalho.length);
}

function garantirEsquemaRanking(planilha) {
  const abaParticipantes = obterOuCriarAba(planilha, ABA_PARTICIPANTES, CABECALHO_PARTICIPANTES);
  const abaPontuacoes = obterOuCriarAba(planilha, ABA_PONTUACOES, CABECALHO_PONTUACOES);
  const abaDias = obterOuCriarAba(planilha, ABA_DIAS, CABECALHO_DIAS);
  const abaResumos = obterOuCriarAba(planilha, ABA_RESUMOS, CABECALHO_RESUMOS);
  const abaConfig = obterOuCriarAba(planilha, ABA_CONFIG, CABECALHO_CONFIG);
  const abaFaixas = obterOuCriarAba(planilha, ABA_FAIXAS, CABECALHO_FAIXAS);
  const abaHistoricoSeries = obterOuCriarAba(planilha, ABA_HISTORICO_SERIES, CABECALHO_HISTORICO_SERIES);
  const cabH = cabecalhoAtual(abaHistoricoSeries);
  if (!cabecalhoIgual(cabH, CABECALHO_HISTORICO_SERIES)) {
    if (abaHistoricoSeries.getLastRow() <= 1) reescreverAbaCompleta(abaHistoricoSeries, CABECALHO_HISTORICO_SERIES, []);
    else throw new Error('A aba HistoricoSeries já existe com estrutura incompatível. Renomeie essa aba para preservar os dados e recarregue o sistema para que uma nova aba seja criada.');
  }

  let mapaNomeParaIds = {};
  let participantesNovos = [];
  let precisaReescreverParticipantes = false;
  const cabP = cabecalhoAtual(abaParticipantes);
  if (cabecalhoIgual(cabP, CABECALHO_PARTICIPANTES)) {
    if (abaParticipantes.getLastRow() > 1) participantesNovos = abaParticipantes.getRange(2,1,abaParticipantes.getLastRow()-1,CABECALHO_PARTICIPANTES.length).getValues();
    participantesNovos = participantesNovos.map(function(r){
      let pid = String(r[0] || '').trim();
      if (!pid) { pid = Utilities.getUuid(); precisaReescreverParticipantes = true; }
      const div = String(r[1] || '').trim().toLowerCase();
      const nome = String(r[2] || '').trim();
      const criado = r[3] || new Date();
      const chave = div + '||' + nome.toLowerCase();
      if (!mapaNomeParaIds[chave]) mapaNomeParaIds[chave] = [];
      mapaNomeParaIds[chave].push(pid);
      return [pid, div, nome, criado];
    });
  } else {
    const qtd = Math.max(0, abaParticipantes.getLastRow()-1);
    const antigas = qtd ? abaParticipantes.getRange(2,1,qtd,Math.max(3,abaParticipantes.getLastColumn())).getValues() : [];
    participantesNovos = antigas.map(function(r){
      const pid = Utilities.getUuid();
      const div = String(r[0] || '').trim().toLowerCase();
      const nome = String(r[1] || '').trim();
      const criado = r[2] || new Date();
      const chave = div + '||' + nome.toLowerCase();
      if (!mapaNomeParaIds[chave]) mapaNomeParaIds[chave] = [];
      mapaNomeParaIds[chave].push(pid);
      return [pid, div, nome, criado];
    });
    precisaReescreverParticipantes = true;
  }
  participantesNovos = participantesNovos.filter(function(r){
    const div = String(r[1] || '').trim();
    const nome = String(r[2] || '').trim();
    if (!div && !nome) { precisaReescreverParticipantes = true; return false; }
    if (!div || !nome) throw new Error('Migração interrompida: participante com faixa ou nome ausente.');
    return true;
  });
  mapaNomeParaIds = {};
  participantesNovos.forEach(function(r){
    const chave = String(r[1]).trim().toLowerCase() + '||' + String(r[2]).trim().toLowerCase();
    if (!mapaNomeParaIds[chave]) mapaNomeParaIds[chave] = [];
    mapaNomeParaIds[chave].push(String(r[0] || '').trim());
  });
  if (precisaReescreverParticipantes) reescreverAbaCompleta(abaParticipantes, CABECALHO_PARTICIPANTES, participantesNovos);

  const idsParticipantesValidos = {};
  participantesNovos.forEach(function(r){
    const pid = String(r[0] || '').trim();
    if (!pid) throw new Error('Migração interrompida: participante sem ID.');
    if (idsParticipantesValidos[pid]) throw new Error('Migração interrompida: Participant_ID duplicado (' + pid + ').');
    idsParticipantesValidos[pid] = true;
  });
  function resolverParticipanteLegado(div, nome) {
    const ids = mapaNomeParaIds[String(div || '').trim().toLowerCase() + '||' + String(nome || '').trim().toLowerCase()] || [];
    if (ids.length > 1) {
      throw new Error('Migração interrompida: existem participantes duplicados com o mesmo nome e a mesma faixa ("' + nome + '"). Renomeie a duplicidade na planilha antes de migrar para IDs estáveis.');
    }
    if (!ids.length && (String(div || '').trim() || String(nome || '').trim())) {
      throw new Error('Migração interrompida: existe pontuação sem participante correspondente (' + div + ' / ' + nome + ').');
    }
    return ids[0] || '';
  }

  let pontosNovos = [];
  let precisaReescreverPontos = false;
  const cabQ = cabecalhoAtual(abaPontuacoes);
  if (cabecalhoIgual(cabQ, CABECALHO_PONTUACOES)) {
    const qtd = Math.max(0, abaPontuacoes.getLastRow()-1);
    pontosNovos = qtd ? abaPontuacoes.getRange(2,1,qtd,CABECALHO_PONTUACOES.length).getValues() : [];
    pontosNovos = pontosNovos.map(function(r){
      let pid = String(r[0] || '').trim();
      const div = String(r[1] || '').trim().toLowerCase();
      const nome = String(r[2] || '').trim();
      if (!pid) {
        pid = resolverParticipanteLegado(div, nome);
        precisaReescreverPontos = true;
      }
      if (pid && !idsParticipantesValidos[pid]) throw new Error('Migração interrompida: pontuação órfã para Participant_ID ' + pid + '.');
      return [pid, div, nome, r[3], r[4]];
    }).filter(function(r){ return r[0]; });
  } else {
    const qtd = Math.max(0, abaPontuacoes.getLastRow()-1);
    const antigas = qtd ? abaPontuacoes.getRange(2,1,qtd,Math.max(4,abaPontuacoes.getLastColumn())).getValues() : [];
    pontosNovos = antigas.map(function(r){
      const div = String(r[0] || '').trim().toLowerCase();
      const nome = String(r[1] || '').trim();
      const pid = resolverParticipanteLegado(div, nome);
      return [pid, div, nome, r[2], r[3]];
    }).filter(function(r){ return r[0]; });
    precisaReescreverPontos = true;
  }
  pontosNovos = pontosNovos.filter(function(r){ return r[4] !== '' && r[4] !== null && r[4] !== undefined; });
  const chavesPonto = {};
  let maiorDiaPontos = 0;
  pontosNovos.forEach(function(r){
    const dia = Number(r[3]);
    const valor = Number(r[4]);
    if (!Number.isInteger(dia) || dia < 1) throw new Error('Migração interrompida: número de dia inválido em Pontuacoes.');
    if (!Number.isFinite(valor) || valor > 10) throw new Error('Migração interrompida: pontuação inválida ou acima de +10 no Dia ' + dia + '.');
    maiorDiaPontos = Math.max(maiorDiaPontos, dia);
    const chave = String(r[0]) + '||' + String(r[3]);
    if (chavesPonto[chave]) throw new Error('Migração interrompida: pontuação duplicada para o mesmo participante no Dia ' + r[3] + '.');
    chavesPonto[chave] = true;
  });
  if (precisaReescreverPontos) reescreverAbaCompleta(abaPontuacoes, CABECALHO_PONTUACOES, pontosNovos);

  let diasNovos = [];
  let precisaReescreverDias = false;
  const cabD = cabecalhoAtual(abaDias);
  if (cabecalhoIgual(cabD, CABECALHO_DIAS)) {
    const qtd = Math.max(0, abaDias.getLastRow()-1);
    diasNovos = qtd ? abaDias.getRange(2,1,qtd,CABECALHO_DIAS.length).getValues() : [];
    diasNovos = diasNovos.map(function(r){
      let dayId = String(r[1] || '').trim();
      if (!dayId) { dayId = 'd_' + Utilities.getUuid(); precisaReescreverDias = true; }
      return [r[0], dayId, r[2]];
    });
  } else {
    const qtd = Math.max(0, abaDias.getLastRow()-1);
    const antigas = qtd ? abaDias.getRange(2,1,qtd,Math.max(2,abaDias.getLastColumn())).getValues() : [];
    diasNovos = antigas.map(function(r){ return [r[0], 'd_' + Utilities.getUuid(), r[1]]; });
    precisaReescreverDias = true;
  }
  // Dias_Total histórico nem sempre acompanhava a aba Dias. Usa o maior
  // índice real encontrado para não ocultar pontuações durante a migração.
  let maiorDiaAba = 0;
  diasNovos.forEach(function(r){ const d = Number(r[0]); if (Number.isFinite(d)) maiorDiaAba = Math.max(maiorDiaAba, Math.trunc(d)); });
  let diasTotalConfig = Number(lerConfig(abaConfig, 'Dias_Total', 0)) || 0;
  const diasTotalReal = Math.max(0, diasTotalConfig, maiorDiaAba, maiorDiaPontos);
  if (diasTotalReal !== diasTotalConfig) escreverConfig(abaConfig, 'Dias_Total', diasTotalReal);

  const porNumeroDia = {};
  diasNovos.forEach(function(r){
    const bruto = r[0];
    if ((bruto === '' || bruto === null || bruto === undefined) && !r[1] && !r[2]) return;
    const dNum = Number(bruto);
    if (!Number.isInteger(dNum) || dNum < 1) throw new Error('Migração interrompida: número de dia inválido na aba Dias.');
    const d = dNum;
    if (porNumeroDia[d]) throw new Error('Migração interrompida: Dia ' + d + ' aparece mais de uma vez na aba Dias.');
    if (d <= diasTotalReal) porNumeroDia[d] = r;
  });
  const idsDiaVistos = {};
  const diasNormalizados = [];
  for (let d=1; d<=diasTotalReal; d++) {
    const existente = porNumeroDia[d] || [d, '', ''];
    let dayId = String(existente[1] || '').trim();
    if (!dayId) { dayId = 'd_' + Utilities.getUuid(); precisaReescreverDias = true; }
    if (idsDiaVistos[dayId]) throw new Error('Migração interrompida: Day_ID duplicado (' + dayId + ').');
    idsDiaVistos[dayId] = true;
    diasNormalizados.push([d, dayId, existente[2] || '']);
  }
  if (diasNormalizados.length !== diasNovos.length) precisaReescreverDias = true;
  diasNovos = diasNormalizados;
  if (precisaReescreverDias) reescreverAbaCompleta(abaDias, CABECALHO_DIAS, diasNovos);

  const diaPorNumero = {};
  diasNovos.forEach(function(r){ diaPorNumero[Number(r[0])] = r; });
  const cabR = cabecalhoAtual(abaResumos);
  if (!cabecalhoIgual(cabR, CABECALHO_RESUMOS)) {
    const qtd = Math.max(0, abaResumos.getLastRow()-1);
    const antigas = qtd ? abaResumos.getRange(2,1,qtd,Math.max(3,abaResumos.getLastColumn())).getValues() : [];
    const eraFormato6 = cabR.length >= 6 && String(cabR[0]) === 'Data_Hora' && String(cabR[1]) === 'Dia' && String(cabR[2]) === 'Day_ID';
    const novos = antigas.map(function(r){
      if (eraFormato6) return [r[0], 's_legado', 1, Number(r[1])||0, r[2]||'', r[3]||'', r[4]||'', r[5]||''];
      const dia = Number(r[1]) || 0;
      const infoDia = diaPorNumero[dia] || [];
      return [r[0], 's_legado', 1, dia, infoDia[1] || '', infoDia[2] || '', '', r[2] || ''];
    });
    reescreverAbaCompleta(abaResumos, CABECALHO_RESUMOS, novos);
  }

  if (lerConfig(abaConfig, 'Ranking_Revision', '') === '') escreverConfig(abaConfig, 'Ranking_Revision', 0);
  if (lerConfig(abaConfig, 'Serie_Atual_ID', '') === '') escreverConfig(abaConfig, 'Serie_Atual_ID', 's_' + Utilities.getUuid());
  if (lerConfig(abaConfig, 'Serie_Atual_Numero', '') === '') escreverConfig(abaConfig, 'Serie_Atual_Numero', 1);
  escreverConfig(abaConfig, 'Serie_Limite_Dias', 7);
  return { abaParticipantes, abaPontuacoes, abaDias, abaResumos, abaConfig, abaFaixas, abaHistoricoSeries };
}

function carregarRanking() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    const diasTotal = Number(lerConfig(abas.abaConfig, 'Dias_Total', 0)) || 0;
    const revision = Number(lerConfig(abas.abaConfig, 'Ranking_Revision', 0)) || 0;
    const serieAtualId = String(lerConfig(abas.abaConfig, 'Serie_Atual_ID', '') || ('s_' + Utilities.getUuid()));
    const serieAtualNumero = Math.max(1, Number(lerConfig(abas.abaConfig, 'Serie_Atual_Numero', 1)) || 1);
    const divisoes = lerFaixasCadastradas(planilha);
    const indiceDivisao = {};
    divisoes.forEach(function (d) { indiceDivisao[d.id] = d; });

    const estado = { revision:revision, days:diasTotal, dayDates:new Array(diasTotal).fill(null), dayIds:new Array(diasTotal).fill(null), seriesMeta:{currentId:serieAtualId,currentNumber:serieAtualNumero,maxDays:7}, divisoes:divisoes };
    const indiceParticipante = {};

    if (abas.abaParticipantes.getLastRow() > 1) {
      const linhas = abas.abaParticipantes.getRange(2,1,abas.abaParticipantes.getLastRow()-1,CABECALHO_PARTICIPANTES.length).getValues();
      linhas.forEach(function (linha) {
        const pid = String(linha[0] || '').trim();
        const divisaoId = String(linha[1] || '').trim().toLowerCase();
        const nome = String(linha[2] || '').trim();
        if (!pid || !nome || !divisaoId) return;
        if (!indiceDivisao[divisaoId]) {
          const recuperada = { id:divisaoId, titulo:'Faixa ' + divisaoId, intervalo:'', cor:'--panel-2', participantes:[] };
          divisoes.push(recuperada); indiceDivisao[divisaoId] = recuperada;
        }
        const participante = { id:pid, name:nome, createdAt:linha[3] || null, scores:new Array(diasTotal).fill(null) };
        indiceDivisao[divisaoId].participantes.push(participante);
        indiceParticipante[pid] = participante;
      });
    }

    if (abas.abaPontuacoes.getLastRow() > 1) {
      const linhas = abas.abaPontuacoes.getRange(2,1,abas.abaPontuacoes.getLastRow()-1,CABECALHO_PONTUACOES.length).getValues();
      linhas.forEach(function (linha) {
        const pid = String(linha[0] || '').trim();
        const dia = Number(linha[3]);
        const pontuacao = linha[4];
        const participante = indiceParticipante[pid];
        if (participante && dia >= 1 && dia <= diasTotal && pontuacao !== '' && pontuacao !== null && pontuacao !== undefined) {
          const n = Number(pontuacao);
          if (isFinite(n)) participante.scores[dia - 1] = Math.min(n, 10);
        }
      });
    }

    if (abas.abaDias.getLastRow() > 1) {
      const linhas = abas.abaDias.getRange(2,1,abas.abaDias.getLastRow()-1,CABECALHO_DIAS.length).getValues();
      const fusoScript = Session.getScriptTimeZone();
      linhas.forEach(function (linha) {
        const dia = Number(linha[0]);
        if (dia >= 1 && dia <= diasTotal) {
          estado.dayIds[dia - 1] = String(linha[1] || ('d_' + Utilities.getUuid()));
          estado.dayDates[dia - 1] = linha[2] ? Utilities.formatDate(new Date(linha[2]), fusoScript, "yyyy-MM-dd'T'HH:mm:ss.SSS") : null;
        }
      });
    }
    for (let i=0;i<diasTotal;i++) if (!estado.dayIds[i]) estado.dayIds[i] = 'd_' + Utilities.getUuid();
    return estado;
  } finally {
    lock.releaseLock();
  }
}

function validarSnapshotRankingBackend(estado) {
  if (!estado || !Array.isArray(estado.divisoes)) throw new Error('Dados de ranking inválidos: estado.divisoes ausente.');
  const diasTotal = Number(estado.days);
  if (!Number.isInteger(diasTotal) || diasTotal < 0) throw new Error('Quantidade de dias inválida.');
  const dayDates = Array.isArray(estado.dayDates) ? estado.dayDates : [];
  const dayIds = Array.isArray(estado.dayIds) ? estado.dayIds : [];
  if (dayDates.length !== diasTotal || dayIds.length !== diasTotal) throw new Error('Datas/IDs de dia desalinhados com a quantidade de dias.');
  const metaEntrada = estado.seriesMeta && typeof estado.seriesMeta === 'object' ? estado.seriesMeta : {};
  const serieId = String(metaEntrada.currentId || '').trim();
  const serieNumero = Math.max(1, Math.trunc(Number(metaEntrada.currentNumber) || 1));
  if (!serieId) throw new Error('Serie_ID atual ausente.');
  const seriesMeta = { currentId:serieId, currentNumber:serieNumero, maxDays:7 };

  const idsFaixa = {};
  const idsParticipante = {};
  const idsDia = {};
  const linhasFaixas = [], linhasParticipantes = [], linhasPontuacoes = [], linhasDias = [];
  let totalParticipantes = 0;
  const agora = new Date();

  estado.divisoes.forEach(function(divisao, ordem){
    const divisaoId = String(divisao && divisao.id || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(divisaoId)) throw new Error('ID de faixa inválido: ' + divisaoId);
    if (idsFaixa[divisaoId]) throw new Error('ID de faixa duplicado: ' + divisaoId);
    idsFaixa[divisaoId] = true;
    linhasFaixas.push([divisaoId, String(divisao.titulo || divisaoId), String(divisao.intervalo || ''), String(divisao.cor || '--panel-2'), ordem + 1]);

    const participantes = Array.isArray(divisao.participantes) ? divisao.participantes : [];
    participantes.forEach(function(p){
      const pid = String(p && p.id || '').trim();
      const nome = String(p && p.name || '').trim().replace(/\s+/g,' ');
      if (!pid) throw new Error('Participante sem ID estável na faixa ' + divisaoId + '.');
      if (idsParticipante[pid]) throw new Error('Participant_ID duplicado: ' + pid);
      if (!nome) throw new Error('Participante com nome vazio na faixa ' + divisaoId + '.');
      idsParticipante[pid] = true;
      const scores = Array.isArray(p.scores) ? p.scores : [];
      if (scores.length !== diasTotal) throw new Error('Pontuações desalinhadas para ' + nome + '.');
      let criado = p.createdAt ? new Date(p.createdAt) : agora;
      if (isNaN(criado.getTime())) criado = agora;
      linhasParticipantes.push([pid, divisaoId, nome, criado]);
      totalParticipantes++;
      scores.forEach(function(valor,i){
        if (valor === null || valor === undefined || valor === '') return;
        const numero = Number(valor);
        if (!isFinite(numero)) throw new Error('Pontuação inválida para ' + nome + ' no Dia ' + (i+1) + '.');
        if (numero > 10) throw new Error('Pontuação acima do limite (+10) para ' + nome + ' no Dia ' + (i+1) + '.');
        linhasPontuacoes.push([pid, divisaoId, nome, i+1, numero]);
      });
    });
  });

  for (let i=0;i<diasTotal;i++) {
    const dayId = String(dayIds[i] || '').trim();
    if (!dayId || idsDia[dayId]) throw new Error('Day_ID ausente ou duplicado no Dia ' + (i+1) + '.');
    idsDia[dayId] = true;
    let d = '';
    if (dayDates[i]) {
      d = new Date(dayDates[i]);
      if (isNaN(d.getTime())) throw new Error('Data inválida no Dia ' + (i+1) + '.');
    }
    linhasDias.push([i+1, dayId, d]);
  }

  return { diasTotal, linhasFaixas, linhasParticipantes, linhasPontuacoes, linhasDias, totalParticipantes, seriesMeta };
}

function capturarAba(aba) {
  const lr = Math.max(1, aba.getLastRow());
  const lc = Math.max(1, aba.getLastColumn());
  return { valores:aba.getRange(1,1,lr,lc).getValues(), linhas:lr, colunas:lc };
}

function restaurarAba(aba, backup) {
  aba.clearContents();
  if (backup && backup.valores && backup.valores.length) aba.getRange(1,1,backup.valores.length,backup.valores[0].length).setValues(backup.valores);
}

function salvarRanking(token, estado) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();

    // Valida e materializa TODAS as linhas antes de tocar nas abas vivas.
    const snapshot = validarSnapshotRankingBackend(estado);
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    const revisaoAtual = Number(lerConfig(abas.abaConfig, 'Ranking_Revision', 0)) || 0;
    const revisaoEsperada = Number(estado.revision) || 0;
    if (revisaoEsperada !== revisaoAtual) {
      return criarResposta({ sucesso:false, codigo:'REVISION_CONFLICT', erro:'O ranking foi alterado por outra sessão.', revision:revisaoAtual });
    }
    const serieServidorId = String(lerConfig(abas.abaConfig, 'Serie_Atual_ID', '') || '');
    const serieServidorNumero = Math.max(1, Number(lerConfig(abas.abaConfig, 'Serie_Atual_Numero', 1)) || 1);
    if (snapshot.seriesMeta.currentId !== serieServidorId || snapshot.seriesMeta.currentNumber !== serieServidorNumero) {
      return criarResposta({ sucesso:false, codigo:'SERIES_META_CONFLICT', erro:'A série ativa mudou no servidor. Recarregue o ranking antes de salvar.' });
    }
    const novaRevisao = revisaoAtual + 1;

    const backups = {
      participantes:capturarAba(abas.abaParticipantes),
      pontuacoes:capturarAba(abas.abaPontuacoes),
      dias:capturarAba(abas.abaDias),
      faixas:capturarAba(abas.abaFaixas),
      config:capturarAba(abas.abaConfig)
    };

    try {
      reescreverAbaCompleta(abas.abaParticipantes, CABECALHO_PARTICIPANTES, snapshot.linhasParticipantes);
      reescreverAbaCompleta(abas.abaPontuacoes, CABECALHO_PONTUACOES, snapshot.linhasPontuacoes);
      reescreverAbaCompleta(abas.abaDias, CABECALHO_DIAS, snapshot.linhasDias);
      reescreverAbaCompleta(abas.abaFaixas, CABECALHO_FAIXAS, snapshot.linhasFaixas);
      escreverConfig(abas.abaConfig, 'Dias_Total', snapshot.diasTotal);
      escreverConfig(abas.abaConfig, 'Serie_Atual_ID', snapshot.seriesMeta.currentId);
      escreverConfig(abas.abaConfig, 'Serie_Atual_Numero', snapshot.seriesMeta.currentNumber);
      escreverConfig(abas.abaConfig, 'Serie_Limite_Dias', 7);
      escreverConfig(abas.abaConfig, 'Ranking_Revision', novaRevisao);
      SpreadsheetApp.flush();
    } catch (erroEscrita) {
      // Rollback best-effort: restaura todas as abas, inclusive a revisão.
      try { restaurarAba(abas.abaParticipantes, backups.participantes); } catch(e) {}
      try { restaurarAba(abas.abaPontuacoes, backups.pontuacoes); } catch(e) {}
      try { restaurarAba(abas.abaDias, backups.dias); } catch(e) {}
      try { restaurarAba(abas.abaFaixas, backups.faixas); } catch(e) {}
      try { restaurarAba(abas.abaConfig, backups.config); } catch(e) {}
      try { SpreadsheetApp.flush(); } catch(e) {}
      throw new Error('Falha durante a gravação; o snapshot anterior foi restaurado. ' + erroEscrita.message);
    }

    registrarLog(sessao.nome, 'Salvou o ranking — rev. ' + novaRevisao + ', ' + snapshot.diasTotal + ' dia(s), ' + snapshot.totalParticipantes + ' participante(s), ' + snapshot.linhasFaixas.length + ' faixa(s)');
    return criarResposta({ sucesso:true, mensagem:'Ranking salvo com sucesso!', revision:novaRevisao, dados:{revision:novaRevisao} });
  } catch (erro) {
    return criarResposta({ sucesso:false, erro:'Erro ao salvar ranking: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}



// ==================== SÉRIES DE 7 DIAS / HISTÓRICO ====================
function linhasHistoricoSerie(estado, sessao, quantidadeDias) {
  const qtd = Math.max(0, Math.min(Number(quantidadeDias) || 0, Number(estado.days) || 0));
  const meta = estado.seriesMeta || {};
  const serieId = String(meta.currentId || '').trim();
  const serieNumero = Math.max(1, Math.trunc(Number(meta.currentNumber) || 1));
  const arquivadaEm = new Date();
  const linhas = [];

  (estado.divisoes || []).forEach(function(div){
    (div.participantes || []).forEach(function(p){
      for (let i=0; i<qtd; i++) {
        const dataRef = estado.dayDates && estado.dayDates[i] ? new Date(estado.dayDates[i]) : '';
        const valor = p.scores && p.scores[i] !== null && p.scores[i] !== undefined && p.scores[i] !== '' ? Number(p.scores[i]) : '';
        linhas.push([
          serieId, serieNumero, arquivadaEm, sessao.nome,
          String(p.id || ''), String(div.id || ''), String(div.titulo || div.id || ''), String(p.name || ''),
          i+1, String((estado.dayIds || [])[i] || ''), dataRef, valor
        ]);
      }
    });
  });

  // Mantém a existência da série mesmo se ainda não houver participantes.
  if (!linhas.length) {
    for (let i=0; i<qtd; i++) {
      const dataRef = estado.dayDates && estado.dayDates[i] ? new Date(estado.dayDates[i]) : '';
      linhas.push([serieId, serieNumero, arquivadaEm, sessao.nome, '', '', '', '', i+1, String((estado.dayIds || [])[i] || ''), dataRef, '']);
    }
  }
  return linhas;
}

function estadoDepoisDeEncerrarSerie(estado, quantidadeDias, novaRevisao) {
  const qtd = Math.max(0, Math.min(Number(quantidadeDias) || 0, Number(estado.days) || 0));
  const novo = JSON.parse(JSON.stringify(estado));
  novo.days = Math.max(0, Number(novo.days || 0) - qtd);
  novo.dayDates = (novo.dayDates || []).slice(qtd);
  novo.dayIds = (novo.dayIds || []).slice(qtd);
  (novo.divisoes || []).forEach(function(div){
    (div.participantes || []).forEach(function(p){
      p.scores = (p.scores || []).slice(qtd);
    });
  });
  const meta = novo.seriesMeta || {};
  novo.seriesMeta = {
    currentId:'s_' + Utilities.getUuid(),
    currentNumber:Math.max(1, Math.trunc(Number(meta.currentNumber) || 1)) + 1,
    maxDays:7
  };
  novo.revision = novaRevisao;
  return novo;
}

function snapshotTemDiaIncompleto(estado, indiceDia) {
  const indice = Number(indiceDia);
  if (!Number.isInteger(indice) || indice < 0) return false;
  for (let i = 0; i < (estado.divisoes || []).length; i++) {
    const participantes = estado.divisoes[i].participantes || [];
    for (let j = 0; j < participantes.length; j++) {
      const valor = participantes[j].scores && participantes[j].scores[indice];
      if (valor === null || valor === undefined || valor === '' || !isFinite(Number(valor))) return true;
    }
  }
    return false;
}


function estadoDepoisDeReiniciarSerie(estado, novaRevisao, avancarNumero) {
  const novo = JSON.parse(JSON.stringify(estado));
  novo.days = 0;
  novo.dayDates = [];
  novo.dayIds = [];
  (novo.divisoes || []).forEach(function(div){
    (div.participantes || []).forEach(function(p){
      p.scores = [];
    });
  });
  const meta = novo.seriesMeta || {};
  const numeroAtual = Math.max(1, Math.trunc(Number(meta.currentNumber) || 1));
  novo.seriesMeta = {
    currentId:'s_' + Utilities.getUuid(),
    currentNumber: numeroAtual + (avancarNumero ? 1 : 0),
    maxDays:7
  };
  novo.revision = novaRevisao;
  return novo;
}

/*
 * Reinício administrativo manual da série ativa.
 * modos:
 * - reiniciar: limpa os lançamentos e mantém o número da série (gera novo ID interno);
 * - arquivar: arquiva a série parcial/cheia e inicia a próxima;
 * - descartar: descarta a série parcial/cheia e inicia a próxima.
 *
 * Diferente de encerrarSerie(), esta operação pode ser usada antes do 7º dia.
 */
function reiniciarSerie(token, modo, estado) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
    if (modo !== 'reiniciar' && modo !== 'arquivar' && modo !== 'descartar') {
      return criarResposta({ sucesso:false, erro:'Modo de reinício de série inválido.' });
    }

    const snapshotAtual = validarSnapshotRankingBackend(estado);
    if (snapshotAtual.diasTotal > 7) {
      return criarResposta({ sucesso:false, codigo:'SERIES_LEGACY_OVERFLOW', erro:'A série ativa possui mais de 7 dias. Encerre primeiro os blocos completos de 7 dias antes de usar o reiniciador manual.' });
    }
    if (modo === 'arquivar' && snapshotAtual.diasTotal === 0) {
      return criarResposta({ sucesso:false, erro:'A série está vazia; não há lançamentos para arquivar.' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    const revisaoAtual = Number(lerConfig(abas.abaConfig, 'Ranking_Revision', 0)) || 0;
    const revisaoEsperada = Number(estado.revision) || 0;
    if (revisaoEsperada !== revisaoAtual) {
      return criarResposta({ sucesso:false, codigo:'REVISION_CONFLICT', erro:'O ranking foi alterado por outra sessão.', revision:revisaoAtual });
    }

    const serieServidorId = String(lerConfig(abas.abaConfig, 'Serie_Atual_ID', '') || '');
    const serieServidorNumero = Math.max(1, Number(lerConfig(abas.abaConfig, 'Serie_Atual_Numero', 1)) || 1);
    if (snapshotAtual.seriesMeta.currentId !== serieServidorId || snapshotAtual.seriesMeta.currentNumber !== serieServidorNumero) {
      return criarResposta({ sucesso:false, codigo:'SERIES_META_CONFLICT', erro:'A série ativa mudou no servidor. Recarregue o ranking.' });
    }

    const novaRevisao = revisaoAtual + 1;
    const avancarNumero = modo === 'arquivar' || modo === 'descartar';
    const novoEstado = estadoDepoisDeReiniciarSerie(estado, novaRevisao, avancarNumero);
    const snapshotNovo = validarSnapshotRankingBackend(novoEstado);
    const linhasHistorico = modo === 'arquivar'
      ? linhasHistoricoSerie(estado, sessao, snapshotAtual.diasTotal)
      : [];

    const backups = {
      participantes:capturarAba(abas.abaParticipantes),
      pontuacoes:capturarAba(abas.abaPontuacoes),
      dias:capturarAba(abas.abaDias),
      faixas:capturarAba(abas.abaFaixas),
      config:capturarAba(abas.abaConfig),
      historicoUltimaLinha:abas.abaHistoricoSeries.getLastRow()
    };

    try {
      if (linhasHistorico.length) {
        const inicio = abas.abaHistoricoSeries.getLastRow() + 1;
        abas.abaHistoricoSeries.getRange(inicio,1,linhasHistorico.length,CABECALHO_HISTORICO_SERIES.length).setValues(linhasHistorico);
      }
      reescreverAbaCompleta(abas.abaParticipantes, CABECALHO_PARTICIPANTES, snapshotNovo.linhasParticipantes);
      reescreverAbaCompleta(abas.abaPontuacoes, CABECALHO_PONTUACOES, snapshotNovo.linhasPontuacoes);
      reescreverAbaCompleta(abas.abaDias, CABECALHO_DIAS, snapshotNovo.linhasDias);
      reescreverAbaCompleta(abas.abaFaixas, CABECALHO_FAIXAS, snapshotNovo.linhasFaixas);
      escreverConfig(abas.abaConfig, 'Dias_Total', snapshotNovo.diasTotal);
      escreverConfig(abas.abaConfig, 'Serie_Atual_ID', snapshotNovo.seriesMeta.currentId);
      escreverConfig(abas.abaConfig, 'Serie_Atual_Numero', snapshotNovo.seriesMeta.currentNumber);
      escreverConfig(abas.abaConfig, 'Serie_Limite_Dias', 7);
      escreverConfig(abas.abaConfig, 'Ranking_Revision', novaRevisao);
      SpreadsheetApp.flush();
    } catch (erroEscrita) {
      try { restaurarAba(abas.abaParticipantes, backups.participantes); } catch(e) {}
      try { restaurarAba(abas.abaPontuacoes, backups.pontuacoes); } catch(e) {}
      try { restaurarAba(abas.abaDias, backups.dias); } catch(e) {}
      try { restaurarAba(abas.abaFaixas, backups.faixas); } catch(e) {}
      try { restaurarAba(abas.abaConfig, backups.config); } catch(e) {}
      try {
        const atual = abas.abaHistoricoSeries.getLastRow();
        if (atual > backups.historicoUltimaLinha) abas.abaHistoricoSeries.deleteRows(backups.historicoUltimaLinha + 1, atual - backups.historicoUltimaLinha);
      } catch(e) {}
      try { SpreadsheetApp.flush(); } catch(e) {}
      throw new Error('Falha no reinício; o estado anterior foi restaurado. ' + erroEscrita.message);
    }

    let descricao;
    if (modo === 'reiniciar') {
      descricao = 'Reiniciou a Série ' + snapshotAtual.seriesMeta.currentNumber + ' do zero (' + snapshotAtual.diasTotal + ' dias descartados; numeração mantida)';
    } else if (modo === 'arquivar') {
      descricao = 'Arquivou manualmente a Série ' + snapshotAtual.seriesMeta.currentNumber + ' (' + snapshotAtual.diasTotal + ' dias) e iniciou a Série ' + snapshotNovo.seriesMeta.currentNumber;
    } else {
      descricao = 'Descartou manualmente a Série ' + snapshotAtual.seriesMeta.currentNumber + ' (' + snapshotAtual.diasTotal + ' dias) e iniciou a Série ' + snapshotNovo.seriesMeta.currentNumber;
    }
    registrarLog(sessao.nome, descricao + ' · rev. ' + novaRevisao);

    return criarResposta({
      sucesso:true,
      revision:novaRevisao,
      dados:{ estado:novoEstado, modo:modo, diasRemovidos:snapshotAtual.diasTotal }
    });
  } catch (erro) {
    return criarResposta({ sucesso:false, erro:'Erro ao reiniciar série: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function encerrarSerie(token, modo, estado) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();
    if (modo !== 'arquivar' && modo !== 'descartar') return criarResposta({ sucesso:false, erro:'Modo de encerramento inválido.' });

    const snapshotAtual = validarSnapshotRankingBackend(estado);
    if (snapshotAtual.diasTotal < 7) return criarResposta({ sucesso:false, erro:'A série ainda não completou 7 lançamentos.' });
    if (snapshotAtual.diasTotal === 7 && snapshotTemDiaIncompleto(estado, 6)) {
      return criarResposta({ sucesso:false, codigo:'SERIE_DIA_INCOMPLETO', erro:'Complete o Dia 7 em todas as faixas antes de encerrar a série.' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    const revisaoAtual = Number(lerConfig(abas.abaConfig, 'Ranking_Revision', 0)) || 0;
    const revisaoEsperada = Number(estado.revision) || 0;
    if (revisaoEsperada !== revisaoAtual) {
      return criarResposta({ sucesso:false, codigo:'REVISION_CONFLICT', erro:'O ranking foi alterado por outra sessão.', revision:revisaoAtual });
    }
    const serieServidorId = String(lerConfig(abas.abaConfig, 'Serie_Atual_ID', '') || '');
    const serieServidorNumero = Math.max(1, Number(lerConfig(abas.abaConfig, 'Serie_Atual_Numero', 1)) || 1);
    if (snapshotAtual.seriesMeta.currentId !== serieServidorId || snapshotAtual.seriesMeta.currentNumber !== serieServidorNumero) {
      return criarResposta({ sucesso:false, codigo:'SERIES_META_CONFLICT', erro:'A série ativa mudou no servidor. Recarregue o ranking.' });
    }

    const novaRevisao = revisaoAtual + 1;
    const quantidadeEncerrar = 7;
    const novoEstado = estadoDepoisDeEncerrarSerie(estado, quantidadeEncerrar, novaRevisao);
    const snapshotNovo = validarSnapshotRankingBackend(novoEstado);
    const linhasHistorico = modo === 'arquivar' ? linhasHistoricoSerie(estado, sessao, quantidadeEncerrar) : [];

    const backups = {
      participantes:capturarAba(abas.abaParticipantes),
      pontuacoes:capturarAba(abas.abaPontuacoes),
      dias:capturarAba(abas.abaDias),
      faixas:capturarAba(abas.abaFaixas),
      config:capturarAba(abas.abaConfig),
      historicoUltimaLinha:abas.abaHistoricoSeries.getLastRow()
    };

    try {
      if (linhasHistorico.length) {
        const inicio = abas.abaHistoricoSeries.getLastRow() + 1;
        abas.abaHistoricoSeries.getRange(inicio,1,linhasHistorico.length,CABECALHO_HISTORICO_SERIES.length).setValues(linhasHistorico);
      }
      reescreverAbaCompleta(abas.abaParticipantes, CABECALHO_PARTICIPANTES, snapshotNovo.linhasParticipantes);
      reescreverAbaCompleta(abas.abaPontuacoes, CABECALHO_PONTUACOES, snapshotNovo.linhasPontuacoes);
      reescreverAbaCompleta(abas.abaDias, CABECALHO_DIAS, snapshotNovo.linhasDias);
      reescreverAbaCompleta(abas.abaFaixas, CABECALHO_FAIXAS, snapshotNovo.linhasFaixas);
      escreverConfig(abas.abaConfig, 'Dias_Total', snapshotNovo.diasTotal);
      escreverConfig(abas.abaConfig, 'Serie_Atual_ID', snapshotNovo.seriesMeta.currentId);
      escreverConfig(abas.abaConfig, 'Serie_Atual_Numero', snapshotNovo.seriesMeta.currentNumber);
      escreverConfig(abas.abaConfig, 'Serie_Limite_Dias', 7);
      escreverConfig(abas.abaConfig, 'Ranking_Revision', novaRevisao);
      SpreadsheetApp.flush();
    } catch (erroEscrita) {
      try { restaurarAba(abas.abaParticipantes, backups.participantes); } catch(e) {}
      try { restaurarAba(abas.abaPontuacoes, backups.pontuacoes); } catch(e) {}
      try { restaurarAba(abas.abaDias, backups.dias); } catch(e) {}
      try { restaurarAba(abas.abaFaixas, backups.faixas); } catch(e) {}
      try { restaurarAba(abas.abaConfig, backups.config); } catch(e) {}
      try {
        const atual = abas.abaHistoricoSeries.getLastRow();
        if (atual > backups.historicoUltimaLinha) abas.abaHistoricoSeries.deleteRows(backups.historicoUltimaLinha + 1, atual - backups.historicoUltimaLinha);
      } catch(e) {}
      try { SpreadsheetApp.flush(); } catch(e) {}
      throw new Error('Falha no encerramento; o estado anterior foi restaurado. ' + erroEscrita.message);
    }

    registrarLog(sessao.nome, (modo === 'arquivar' ? 'Arquivou' : 'Descartou') + ' a Série ' + snapshotAtual.seriesMeta.currentNumber + ' (7 dias) e iniciou a Série ' + snapshotNovo.seriesMeta.currentNumber + ' · rev. ' + novaRevisao);
    return criarResposta({ sucesso:true, revision:novaRevisao, dados:{ estado:novoEstado, modo:modo } });
  } catch (erro) {
    return criarResposta({ sucesso:false, erro:'Erro ao encerrar série: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function listarHistoricoSeries() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    if (abas.abaHistoricoSeries.getLastRow() <= 1) return [];
    const linhas = abas.abaHistoricoSeries.getRange(2,1,abas.abaHistoricoSeries.getLastRow()-1,CABECALHO_HISTORICO_SERIES.length).getValues();
    const porSerie = {};
    const fuso = Session.getScriptTimeZone();

    function isoLocal(valor) {
      if (!valor) return null;
      const d = new Date(valor);
      if (isNaN(d.getTime())) return null;
      return Utilities.formatDate(d, fuso, "yyyy-MM-dd'T'HH:mm:ss.SSS");
    }

    linhas.forEach(function(r){
      const serieId = String(r[0] || '').trim();
      if (!serieId) return;
      if (!porSerie[serieId]) {
        porSerie[serieId] = {
          id:serieId,
          numero:Number(r[1]) || 0,
          arquivadaEm:isoLocal(r[2]),
          arquivadaPor:String(r[3] || ''),
          daysMap:{}, participantesMap:{}
        };
      }
      const serie = porSerie[serieId];
      const diaNum = Number(r[8]) || 0;
      if (diaNum > 0 && !serie.daysMap[diaNum]) {
        serie.daysMap[diaNum] = { numero:diaNum, dayId:String(r[9] || ''), date:isoLocal(r[10]) };
      }
      const pid = String(r[4] || '').trim();
      if (!pid) return;
      if (!serie.participantesMap[pid]) {
        serie.participantesMap[pid] = {
          id:pid, divId:String(r[5] || ''), divTitle:String(r[6] || ''), name:String(r[7] || ''), scoresMap:{}
        };
      }
      const p = serie.participantesMap[pid];
      if (diaNum > 0) {
        const bruto = r[11];
        p.scoresMap[diaNum] = (bruto === '' || bruto === null || bruto === undefined) ? null : Number(bruto);
      }
    });

    return Object.keys(porSerie).map(function(id){
      const s = porSerie[id];
      const days = Object.keys(s.daysMap).map(Number).sort(function(a,b){return a-b;}).map(function(k){ return s.daysMap[k]; });
      const participantes = Object.keys(s.participantesMap).map(function(pid){
        const p = s.participantesMap[pid];
        return { id:p.id, divId:p.divId, divTitle:p.divTitle, name:p.name, scores:days.map(function(d){ return Object.prototype.hasOwnProperty.call(p.scoresMap,d.numero) ? p.scoresMap[d.numero] : null; }) };
      });
      return { id:s.id, numero:s.numero, arquivadaEm:s.arquivadaEm, arquivadaPor:s.arquivadaPor, days:days, participantes:participantes };
    }).sort(function(a,b){ return a.numero-b.numero; });
  } finally {
    lock.releaseLock();
  }
}

// Permite ao administrador corrigir ou completar pontuações de uma série já
// arquivada, sem reabrir a série ativa e sem reescrever o ranking corrente.
// A edição atua somente nas células existentes da aba HistoricoSeries.
function editarSerieHistorica(token, serieId, alteracoes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();

    const idSerie = String(serieId || '').trim();
    if (!idSerie) return criarResposta({ sucesso:false, erro:'Série histórica não informada.' });
    if (!Array.isArray(alteracoes) || !alteracoes.length) {
      return criarResposta({ sucesso:false, erro:'Nenhuma alteração foi informada.' });
    }
    if (alteracoes.length > 2000) {
      return criarResposta({ sucesso:false, erro:'Quantidade de alterações acima do limite permitido.' });
    }

    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    const aba = abas.abaHistoricoSeries;
    if (aba.getLastRow() <= 1) {
      return criarResposta({ sucesso:false, codigo:'SERIE_HISTORICA_NAO_ENCONTRADA', erro:'Não há séries arquivadas para editar.' });
    }

    const quantidadeLinhas = aba.getLastRow() - 1;
    const linhas = aba.getRange(2, 1, quantidadeLinhas, CABECALHO_HISTORICO_SERIES.length).getValues();
    const indicePorChave = {};
    let serieEncontrada = false;
    linhas.forEach(function(linha, indice) {
      if (String(linha[0] || '').trim() !== idSerie) return;
      serieEncontrada = true;
      const participantId = String(linha[4] || '').trim();
      const dia = Number(linha[8]) || 0;
      if (participantId && dia > 0) indicePorChave[participantId + '::' + dia] = indice + 2;
    });
    if (!serieEncontrada) {
      return criarResposta({ sucesso:false, codigo:'SERIE_HISTORICA_NAO_ENCONTRADA', erro:'A série selecionada não foi encontrada no histórico.' });
    }

    const vistos = {};
    const atualizacoes = [];
    alteracoes.forEach(function(item) {
      const participantId = String(item && (item.participantId || item.id) || '').trim();
      const dia = Number(item && (item.dia != null ? item.dia : item.dayNumber));
      if (!participantId || !Number.isInteger(dia) || dia < 1 || dia > 7) {
        throw new Error('Participante ou dia inválido na edição da série histórica.');
      }
      const chave = participantId + '::' + dia;
      if (vistos[chave]) throw new Error('A mesma pontuação foi enviada mais de uma vez.');
      vistos[chave] = true;
      const linhaPlanilha = indicePorChave[chave];
      if (!linhaPlanilha) throw new Error('Participante ou dia não pertence à série selecionada.');

      const bruto = item && (item.pontuacao != null ? item.pontuacao : item.score);
      let valor = '';
      if (bruto !== null && bruto !== undefined && String(bruto).trim() !== '') {
        const numero = Number(String(bruto).trim().replace(',', '.'));
        if (!Number.isFinite(numero) || numero > 10) throw new Error('Pontuação histórica inválida. Use um número até 10.');
        valor = numero;
      }
      atualizacoes.push({ linha:linhaPlanilha, valor:valor });
    });

    const backup = capturarAba(aba);
    try {
      atualizacoes.forEach(function(item){ aba.getRange(item.linha, 12).setValue(item.valor); });
      SpreadsheetApp.flush();
    } catch (erroEscrita) {
      try { restaurarAba(aba, backup); } catch(e) {}
      try { SpreadsheetApp.flush(); } catch(e) {}
      throw new Error('Falha ao salvar a edição histórica; os dados anteriores foram restaurados. ' + erroEscrita.message);
    }

    registrarLog(sessao.nome, 'Corrigiu ' + atualizacoes.length + ' pontuação(ões) da Série histórica ' + idSerie);
    return criarResposta({ sucesso:true, serieId:idSerie, alteracoes:atualizacoes.length });
  } catch (erro) {
    return criarResposta({ sucesso:false, erro:'Erro ao editar série histórica: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

// ==================== REGRA DE PONTUAÇÃO POR POSIÇÃO ====================
// Contrato mecânico preservado da versão de 22/08/2026.
function pontosPorPosicao(posicao, totalParticipantes) {
  if (posicao <= 10) return 11 - posicao;
  if (posicao === 11) return 0;
  if (totalParticipantes <= 14) return -(posicao - 11);
  const deslocamento = posicao - 12;
  return -(Math.floor(deslocamento / 2) + 1);
}


// ==================== RESUMOS SALVOS (histórico protegido) ====================
// Aba própria, alimentada só por "append" — o app nunca edita nem apaga
// linhas aqui, então o histórico sobrevive mesmo se o ranking do dia a dia
// for limpo ou reiniciado. Qualquer conta logada pode ler (usado tanto pelo
// painel "Resumos Salvos", só de administrador, quanto pelo card "Resumo do
// Último Dia" em Análises Gerais, que qualquer papel acessa).

function salvarResumo(token, dia, dayId, dayDate, revision, texto) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessao = obterSessao(token);
    if (!sessao) return respostaSessaoExpirada();
    if (sessao.papel !== PAPEL_ADMIN) return respostaPermissaoNegada();

    const textoResumo = texto ? String(texto) : '';
    if (!textoResumo.trim()) return criarResposta({ sucesso:false, erro:'Nada para salvar — gere o resumo primeiro.' });
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    const revisaoAtual = Number(lerConfig(abas.abaConfig, 'Ranking_Revision', 0)) || 0;
    if (revision !== undefined && revision !== null && Number(revision) !== revisaoAtual) {
      return criarResposta({ sucesso:false, codigo:'REVISION_CONFLICT', erro:'O resumo corresponde a uma versão antiga do ranking.', revision:revisaoAtual });
    }
    const dataDia = dayDate ? new Date(dayDate) : '';
    const serieId = String(lerConfig(abas.abaConfig, 'Serie_Atual_ID', '') || 's_legado');
    const serieNumero = Math.max(1, Number(lerConfig(abas.abaConfig, 'Serie_Atual_Numero', 1)) || 1);
    abas.abaResumos.appendRow([new Date(), serieId, serieNumero, Number(dia) || 0, String(dayId || ''), dataDia, revisaoAtual, textoResumo]);
    registrarLog(sessao.nome, 'Salvou o resumo da Série ' + serieNumero + ' · Dia ' + (Number(dia) || 0) + ' · rev. ' + revisaoAtual);
    return criarResposta({ sucesso:true, mensagem:'Resumo salvo no histórico!' });
  } catch (erro) {
    return criarResposta({ sucesso:false, erro:'Erro ao salvar resumo: ' + erro.message });
  } finally {
    lock.releaseLock();
  }
}

function listarResumosSalvos() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
    const abas = garantirEsquemaRanking(planilha);
    const resumos = [];
    if (abas.abaResumos.getLastRow() > 1) {
      const linhas = abas.abaResumos.getRange(2,1,abas.abaResumos.getLastRow()-1,CABECALHO_RESUMOS.length).getValues();
      linhas.forEach(function(linha){
        resumos.push({ dataHora:linha[0], seriesId:linha[1], seriesNumber:linha[2], dia:linha[3], dayId:linha[4], dayDate:linha[5], revision:linha[6], texto:linha[7] });
      });
      resumos.reverse();
    }
    return resumos;
  } finally {
    lock.releaseLock();
  }
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

function bytesParaHex(bytes) {
  return bytes.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function gerarHashSenhaLegado(valor, salt) {
  return bytesParaHex(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(valor) + '::' + String(salt),
    Utilities.Charset.UTF_8
  ));
}

function obterPepperSenha() {
  const props = PropertiesService.getScriptProperties();
  let pepper = props.getProperty(PROP_PASSWORD_PEPPER);
  if (!pepper) {
    pepper = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(PROP_PASSWORD_PEPPER, pepper);
  }
  return pepper;
}

function derivarSenhaIterativa(valor, salt, iteracoes) {
  let material = String(valor) + '::' + String(salt);
  let hash = '';
  const total = Math.max(1, Number(iteracoes) || 1);
  for (let i = 0; i < total; i++) {
    hash = bytesParaHex(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      material + '::' + i,
      Utilities.Charset.UTF_8
    ));
    material = hash + '::' + String(salt);
  }
  return hash;
}

// v3 mantém salt por usuário, adiciona um pepper secreto fora da planilha e
// usa um custo menor que v2 para que o Apps Script não leve vários segundos
// em cada login. O pepper impede que uma cópia isolada da planilha permita
// testar senhas offline sem também comprometer as Propriedades do script.
function gerarHashSenhaV3(valor, salt, iteracoes) {
  const custo = Math.max(1, Number(iteracoes) || HASH_ITERACOES);
  const derivado = derivarSenhaIterativa(valor, salt, custo);
  const assinatura = bytesParaHex(Utilities.computeHmacSha256Signature(
    derivado,
    obterPepperSenha(),
    Utilities.Charset.UTF_8
  ));
  return 'v3$' + custo + '$' + assinatura;
}

function gerarHashSenhaV2(valor, salt, iteracoes) {
  const custo = Math.max(1, Number(iteracoes) || HASH_V2_ITERACOES);
  return 'v2$' + custo + '$' + derivarSenhaIterativa(valor, salt, custo);
}

function gerarHashSenha(valor, salt) {
  return gerarHashSenhaV3(valor, salt, HASH_ITERACOES);
}

function verificarHashSenha(valor, salt, hashArmazenado) {
  const armazenado = String(hashArmazenado || '');
  if (!armazenado) return { ok:false, legado:false, versao:'' };

  let m = armazenado.match(/^v3\$(\d+)\$([0-9a-f]+)$/i);
  if (m) {
    return {
      ok: gerarHashSenhaV3(valor, salt, Number(m[1])) === armazenado,
      legado: Number(m[1]) !== HASH_ITERACOES,
      versao:'v3'
    };
  }

  m = armazenado.match(/^v2\$(\d+)\$([0-9a-f]+)$/i);
  if (m) {
    return {
      ok: gerarHashSenhaV2(valor, salt, Number(m[1])) === armazenado,
      legado:true,
      versao:'v2'
    };
  }

  return {
    ok: gerarHashSenhaLegado(valor, salt) === armazenado,
    legado:true,
    versao:'v1'
  };
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
 * conta de administrador a partir das propriedades seguras
 * ADMIN_BOOTSTRAP_NOME, ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_SENHA.
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
  const planilha = SpreadsheetApp.openById(PLANILHA_MESTRA_ID);
  const abaConfig = obterOuCriarAba(planilha, ABA_CONFIG, CABECALHO_CONFIG);
  const abaUsuarios = obterOuCriarAba(planilha, ABA_USUARIOS, CABECALHO_USUARIOS);
  obterOuCriarAba(planilha, ABA_LOG, CABECALHO_LOG);
  const abas = garantirEsquemaRanking(planilha);

  if (abas.abaFaixas.getLastRow() < 2) {
    abas.abaFaixas.appendRow(['x', 'Faixa X', '0 a 19.999M', '--x-color', 1]);
    abas.abaFaixas.appendRow(['y', 'Faixa Y', '20M ou mais', '--y-color', 2]);
  }
  if (lerConfig(abaConfig, 'Dias_Total', null) === null) escreverConfig(abaConfig, 'Dias_Total', 0);
  if (lerConfig(abaConfig, 'Ranking_Revision', null) === null) escreverConfig(abaConfig, 'Ranking_Revision', 0);

  if (contarAdministradores(abaUsuarios) === 0) {
    const props = PropertiesService.getScriptProperties();
    const nome = String(props.getProperty(PROP_ADMIN_NOME) || '').trim();
    const email = normalizarEmail(props.getProperty(PROP_ADMIN_EMAIL));
    const senha = String(props.getProperty(PROP_ADMIN_SENHA) || '');
    if (!nome || !emailValido(email) || senha.length < 8) {
      throw new Error('Defina ADMIN_BOOTSTRAP_NOME, ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_SENHA (mínimo 8 caracteres) nas Propriedades do script antes de criar o primeiro administrador.');
    }
    const salt = Utilities.getUuid();
    abaUsuarios.appendRow([Utilities.getUuid(), nome, email, gerarHashSenha(senha, salt), salt, PAPEL_ADMIN, new Date(), '', '', false]);
    props.deleteProperty(PROP_ADMIN_SENHA); // segredo não permanece armazenado após bootstrap
    registrarLog(nome, 'Conta administradora inicial criada por bootstrap seguro');
  }

  Logger.log('Planilha Mestra configurada/migrada com sucesso.');
  return 'Planilha Mestra configurada/migrada com sucesso. A senha de bootstrap foi removida das Propriedades do script após a criação do primeiro administrador.';
}
