#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg, detail='') {
  if (cond) { pass++; console.log('OK ', msg); }
  else { fail++; console.error('FALHA', msg, detail ? `\n  ${detail}` : ''); }
}
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function walk(dir, ext){
  const out=[];
  for(const ent of fs.readdirSync(path.join(ROOT,dir), {withFileTypes:true})){
    const rel=path.join(dir,ent.name);
    if(ent.isDirectory()) out.push(...walk(rel,ext));
    else if(!ext || ent.name.endsWith(ext)) out.push(rel.replace(/\\/g,'/'));
  }
  return out;
}

// v57 consolidada: o index.html já contém todo o DOM essencial; não se
// concatenam fragmentos externos, pois eles deixaram de fazer parte do runtime.
function semComentariosHtml(txt){ return txt.replace(/<!--[\s\S]*?-->/g, ''); }
const assembled = semComentariosHtml(read('index.html'));
const ids = [...assembled.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
const counts = ids.reduce((a,id)=>(a[id]=(a[id]||0)+1,a),{});
const dup = Object.entries(counts).filter(([,n])=>n>1);
ok(dup.length===0, 'DOM consolidado não contém IDs duplicados', JSON.stringify(dup));

// Referências de label/ARIA devem apontar para IDs existentes.
const idSet = new Set(ids);
const refs=[];
for(const m of assembled.matchAll(/\b(?:for|aria-controls|aria-labelledby|aria-describedby)\s*=\s*["']([^"']+)["']/gi)){
  for(const ref of m[1].trim().split(/\s+/)) if(ref) refs.push(ref);
}
const missingRefs=[...new Set(refs.filter(r=>!idSet.has(r)))];
ok(missingRefs.length===0, 'labels e referências ARIA apontam para elementos existentes', missingRefs.join(', '));

// Todos os handlers inline chamados como func(...) precisam existir nos scripts do app.
const jsFiles = walk('js','.js');
const jsAll = jsFiles.map(read).join('\n');
const handlerNames=[];
for(const m of assembled.matchAll(/\bon(?:click|change|input|submit|blur|keydown)\s*=\s*["']([^"']+)["']/gi)){
  for(const c of m[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){
    const name=c[1];
    if(!['if','for','while','switch','alert','confirm','prompt','Number','String','Boolean','parseInt','parseFloat','getElementById','querySelector','querySelectorAll','click','focus','select'].includes(name)) handlerNames.push(name);
  }
}
const missingHandlers=[...new Set(handlerNames.filter(name=>{
  const esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return !(new RegExp(`(?:function\\s+${esc}\\s*\\(|(?:const|let|var)\\s+${esc}\\s*=|window\\.${esc}\\s*=)`).test(jsAll));
}))];
ok(missingHandlers.length===0, 'handlers HTML possuem implementação JavaScript', missingHandlers.join(', '));

// Contrato frontend/backend de ações.
const frontendActions=[...new Set([...jsAll.matchAll(/\baction\s*:\s*["']([^"']+)["']/g)].map(m=>m[1]))].sort();
const codegs=read('Code.gs');
const backendActions=new Set([
  ...[...codegs.matchAll(/action\s*===\s*["']([^"']+)["']/g)].map(m=>m[1]),
  ...[...codegs.matchAll(/case\s+["']([^"']+)["']/g)].map(m=>m[1])
]);
const withoutBackend=frontendActions.filter(a=>!backendActions.has(a));
ok(withoutBackend.length===0, 'todas as ações de API do frontend existem no Code.gs', withoutBackend.join(', '));

// App shell: todos os caminhos locais declarados devem existir.
const sw=read('sw.js');
const appShellBlock=(sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/)||[])[1]||'';
const shellEntries=[...appShellBlock.matchAll(/["']([^"']+)["']/g)].map(m=>m[1]);
const localEntries=shellEntries.filter(e=>!/^https?:/i.test(e) && e!=='./' && e!=='/');
const missingShell=localEntries.filter(e=>{
  const clean=e.replace(/^\.\//,'').split('?')[0].split('#')[0];
  return clean && !fs.existsSync(path.join(ROOT,clean));
});
ok(shellEntries.length>0, 'APP_SHELL do Service Worker foi encontrado');
ok(missingShell.length===0, 'todos os arquivos locais do APP_SHELL existem', missingShell.join(', '));
ok(/navigator\.serviceWorker\.register\s*\(/.test(jsAll), 'Service Worker possui registro no frontend');
ok(/CACHE_PREFIX/.test(sw) && /startsWith\s*\(\s*CACHE_PREFIX\s*\)/.test(sw), 'limpeza de cache está restrita ao prefixo do aplicativo');

console.log('\n' + '='.repeat(72));
console.log(`RESULTADO ESTRUTURAL: ${pass}/${pass+fail} passaram; ${fail} falha(s).`);
console.log('='.repeat(72));
process.exitCode = fail ? 1 : 0;
