'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
let total=0, falhas=0;
function ok(desc,cond,det){ total++; if(cond) console.log('OK  '+desc); else {falhas++; console.error('FALHA '+desc+(det?' — '+det:''));}}
const props=new Map(); const cache=new Map();
function bytes(buf){ return Array.from(buf).map(v=>v>127?v-256:v); }
const ctx={console,
  Utilities:{
    DigestAlgorithm:{SHA_256:'sha256'}, Charset:{UTF_8:'utf8'},
    computeDigest:(alg,val)=>bytes(crypto.createHash('sha256').update(String(val),'utf8').digest()),
    computeHmacSha256Signature:(val,key)=>bytes(crypto.createHmac('sha256',String(key)).update(String(val),'utf8').digest()),
    getUuid:()=>crypto.randomUUID()
  },
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.has(k)?props.get(k):null,setProperty:(k,v)=>props.set(k,String(v)),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props)})},
  CacheService:{getScriptCache:()=>({get:k=>cache.has(k)?cache.get(k):null,put:(k,v)=>cache.set(k,String(v)),remove:k=>cache.delete(k)})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:()=>({setMimeType(){return this;}})},
  SpreadsheetApp:{openById(){ throw new Error('obterSessao não deveria abrir planilha'); }},
  LockService:{}, MailApp:{}, Drive:{}, DocumentApp:{}, MimeType:{}, Set
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'Code.gs'),'utf8'),ctx,{filename:'Code.gs'});

const salt='salt-test';
const h3=ctx.gerarHashSenha('SenhaSegura123',salt);
ok('novo hash usa v3', /^v3\$1500\$/.test(h3));
let v=ctx.verificarHashSenha('SenhaSegura123',salt,h3);
ok('v3 valida senha correta', v.ok && !v.legado);
ok('v3 rejeita senha errada', !ctx.verificarHashSenha('errada',salt,h3).ok);
const h2=ctx.gerarHashSenhaV2('SenhaSegura123',salt,12000);
v=ctx.verificarHashSenha('SenhaSegura123',salt,h2);
ok('hash v2 antigo continua válido e é marcado para migração', v.ok && v.legado && v.versao==='v2');
ok('pepper fica fora do hash e nas propriedades do script', !!props.get('PASSWORD_PEPPER_V3') && !h3.includes(props.get('PASSWORD_PEPPER_V3')));

const usuario={idUsuario:'u1',nome:'Ana',email:'ana@example.com',papel:'administrador'};
const token=ctx.criarSessao(usuario);
let sess=ctx.obterSessao(token);
ok('sessão recupera perfil sem planilha', sess && sess.idUsuario==='u1' && sess.papel==='administrador');
ctx.invalidarSessoesUsuario('u1');
ok('versão de sessão invalida token imediatamente', ctx.obterSessao(token)===null);

console.log('\nRESULTADO AUTH: '+(total-falhas)+'/'+total+' passaram; '+falhas+' falha(s).');
process.exit(falhas?1:0);
