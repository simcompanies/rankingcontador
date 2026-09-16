'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const ctx={console,crypto:crypto.webcrypto,window:null,navigator:{onLine:true},alert:()=>{},confirm:()=>true,document:{getElementById:()=>null,querySelectorAll:()=>[]}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'js/core/estado-global.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'js/features/colagem.js'),'utf8'),ctx);
const casos=[
 ['Grupo Alfa, 8,5',{name:'Grupo Alfa',valueStr:'8.5',ambiguous:true}],
 ['Silva, João, 8',{name:'Silva, João',valueStr:'8'}],
 ['Empresa, -2,5',{name:'Empresa',valueStr:'-2.5',ambiguous:true}],
 ['João, 8',{name:'João',valueStr:'8'}],
 ['Empresa, 8.5',{name:'Empresa',valueStr:'8.5'}],
 ['Café & Companhia Ltda, 3',{name:'Café & Companhia Ltda',valueStr:'3'}],
 ['João',null]
];
let falhas=0;
for(const [entrada,esperado] of casos){
 const obt=ctx.separarNomeValorDaLinha(entrada); const ok=JSON.stringify(obt)===JSON.stringify(esperado);
 console.log((ok?'OK  ':'FALHA ')+entrada); if(!ok){console.log(' esperado',esperado,'obtido',obt);falhas++;}
}
process.exit(falhas?1:0);
