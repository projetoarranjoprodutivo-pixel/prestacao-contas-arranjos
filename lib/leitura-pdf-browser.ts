

// A leitura do texto é feita no navegador para preservar as tabelas dos PDFs
// digitais e evitar processamento pesado no Worker do portal.
export async function lerTextoRelatorioPdf(arquivo:File,signal:AbortSignal,progresso:(pagina:number,total:number)=>void){
 const modulo="/pdfjs/pdf.min.mjs";
 const {getDocument,GlobalWorkerOptions}=await import(/* @vite-ignore */modulo) as typeof import("pdfjs-dist");
 GlobalWorkerOptions.workerSrc="/pdfjs/pdf.worker.min.mjs";
 const tarefa=getDocument({data:new Uint8Array(await arquivo.arrayBuffer()),useSystemFonts:true});
 const cancelar=()=>{void tarefa.destroy();};signal.addEventListener("abort",cancelar,{once:true});
 try{
  if(signal.aborted)throw new DOMException("Leitura interrompida","AbortError");
  const pdf=await tarefa.promise;if(pdf.numPages>100)throw new Error("Envie um relatório por profissional e competência, com até 100 páginas.");
  const paginas:string[]=[];
  for(let n=1;n<=pdf.numPages;n++){
   if(signal.aborted)throw new DOMException("Leitura interrompida","AbortError");progresso(n,pdf.numPages);
   const pagina=await pdf.getPage(n),conteudo=await pagina.getTextContent();
   const linhas=new Map<number,Array<{x:number;largura:number;texto:string}>>();
   for(const item of conteudo.items){if(!("str" in item)||!item.str.trim())continue;const y=Math.round(item.transform[5]/2)*2;const linha=linhas.get(y)||[];linha.push({x:item.transform[4],largura:item.width,texto:item.str});linhas.set(y,linha);}
   const texto=[...linhas].sort(([a],[b])=>b-a).map(([,itens])=>{itens.sort((a,b)=>a.x-b.x);return itens.map((item,i)=>`${i?(item.x-(itens[i-1].x+itens[i-1].largura)>9?"\t":" "):""}${item.texto}`).join("");}).join("\n");
   paginas.push(`[PÁGINA ${n}]\n${texto}`);pagina.cleanup();
  }
  return paginas.join("\n\n");
 }finally{signal.removeEventListener("abort",cancelar);await tarefa.destroy();}
}
