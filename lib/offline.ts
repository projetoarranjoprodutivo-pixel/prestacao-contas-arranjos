"use client";

type Fila={id:string;url:string;method:string;campos:Array<{nome:string;valor:string|Blob;arquivo?:string}>;criadoEm:string};
const BANCO="arranjos-offline";const VERSAO=1;const LOJA="fila";
function abrir(){return new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(BANCO,VERSAO);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(LOJA))req.result.createObjectStore(LOJA,{keyPath:"id"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function transacao<T>(modo:IDBTransactionMode,acao:(loja:IDBObjectStore)=>IDBRequest<T>){const db=await abrir();return new Promise<T>((resolve,reject)=>{const tx=db.transaction(LOJA,modo);const req=acao(tx.objectStore(LOJA));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
function serializar(form:FormData){const campos:Fila["campos"]=[];form.forEach((valor,nome)=>campos.push(typeof valor==="string"?{nome,valor}:{nome,valor,arquivo:valor.name}));return campos;}
function montar(campos:Fila["campos"]){const form=new FormData();for(const campo of campos)typeof campo.valor==="string"?form.append(campo.nome,campo.valor):form.append(campo.nome,campo.valor,campo.arquivo);return form;}
export async function salvarNaFila(url:string,form:FormData){const item:Fila={id:crypto.randomUUID(),url,method:"POST",campos:serializar(form),criadoEm:new Date().toISOString()};await transacao("readwrite",loja=>loja.put(item));window.dispatchEvent(new Event("offline-fila"));return item.id;}
export async function enviarOuEnfileirar(url:string,form:FormData){if(navigator.onLine){try{const resposta=await fetch(url,{method:"POST",body:form});const dados=await resposta.json().catch(()=>({}));return{ok:resposta.ok,pendente:false,dados};}catch{}}
  await salvarNaFila(url,form);return{ok:true,pendente:true,dados:{message:"SALVO NO CELULAR. SERÁ ENVIADO AUTOMATICAMENTE QUANDO A INTERNET VOLTAR."}};
}
export async function quantidadePendente(){return (await transacao<Fila[]>("readonly",loja=>loja.getAll())).length;}
export async function sincronizarFila(){if(!navigator.onLine)return{enviados:0,pendentes:await quantidadePendente()};const itens=await transacao<Fila[]>("readonly",loja=>loja.getAll());let enviados=0;for(const item of itens){try{const resposta=await fetch(item.url,{method:item.method,body:montar(item.campos)});if(!resposta.ok){if(resposta.status===401||resposta.status===403)break;continue;}await transacao("readwrite",loja=>loja.delete(item.id));enviados++;}catch{break;}}window.dispatchEvent(new Event("offline-fila"));return{enviados,pendentes:await quantidadePendente()};}
