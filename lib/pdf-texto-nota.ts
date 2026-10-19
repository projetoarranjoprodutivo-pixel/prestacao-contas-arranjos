import { PDFDocument, PDFArray, PDFRawStream, PDFName, PDFDict, decodePDFRawStream } from "pdf-lib";

// Leitura local dos PDFs fiscais com fontes WinAnsi. Outros formatos continuam
// pela conversão/OCR; nunca interpretamos códigos de fontes como texto legível.
export async function extrairTextoNotaPdf(bytes: ArrayBuffer): Promise<string> {
 const pdf = await PDFDocument.load(bytes);
 if (pdf.getPageCount() > 4) return "";
 const paginas: string[] = [];
 for (const page of pdf.getPages()) {
  const fonts = page.node.Resources()?.lookup(PDFName.of("Font"));
  if (!(fonts instanceof PDFDict)) continue;
  const permitidas = new Set(fonts.entries().filter(([,ref]) => {
   const fonte = pdf.context.lookup(ref);
   return fonte instanceof PDFDict && fonte.get(PDFName.of("Encoding"))?.toString() === "/WinAnsiEncoding";
  }).map(([name]) => name.toString()));
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map(ref=>pdf.context.lookup(ref)) : [contents];
  const linhas = new Map<number, Array<{x:number;texto:string}>>();
  for (const stream of streams) {
   if (!(stream instanceof PDFRawStream)) continue;
   const dados = decodePDFRawStream(stream).decode();
   if (dados.length > 2 * 1024 * 1024) continue;
   let content = "";
   for(let i=0;i<dados.length;i+=8192)content+=String.fromCharCode(...dados.subarray(i,i+8192));
   // Tokeniza strings PDF com escapes, números, nomes e operadores. Strings
   // são consumidas inteiras, inclusive parênteses aninhados.
   const tokens: string[] = [];
   for(let i=0;i<content.length;){
    if(/\s/.test(content[i])){i++;continue;}
    if(content[i]==="%"){while(i<content.length&&!/[\r\n]/.test(content[i]))i++;continue;}
    const inicio=i;
    if(content[i]==="("){let nivel=1;i++;while(i<content.length&&nivel){if(content[i]==="\\"){i+=2;continue;}if(content[i]==="(")nivel++;if(content[i]===")")nivel--;i++;}}
    else if(content[i]==="<"&&content[i+1]!=="<"){i++;while(i<content.length&&content[i]!==">")i++;i++;}
    else if(/[\[\]]/.test(content[i]))i++;
    else {i++;while(i<content.length&&!/[\s()[\]<>]/.test(content[i]))i++;}
    tokens.push(content.slice(inicio,i));
   }
   let x=0,y=0,baseX=0,baseY=0,font="",emTexto=false;
   const args:string[]=[];
   const literal=(token:string)=>{
    let valor="";
    if(token.startsWith("<")){for(const par of token.slice(1,-1).replace(/\s/g,"").match(/.{1,2}/g)||[])valor+=String.fromCharCode(parseInt(par.padEnd(2,"0"),16));}
    else valor=token.slice(1,-1).replace(/\\(?:([0-7]{1,3})|([\s\S]))/g,(_,oct,car)=>oct?String.fromCharCode(parseInt(oct,8)):(({n:"\n",r:"\r",t:"\t",b:"\b",f:"\f"} as Record<string,string>)[car]??(/[\r\n]/.test(car)?"":car)));
    return new TextDecoder("windows-1252").decode(Uint8Array.from(valor,c=>c.charCodeAt(0)));
   };
   for(const token of tokens){
    if(token.startsWith("(")||token.startsWith("<")||token.startsWith("/")||/^[-+.]?\d/.test(token)||token==="["||token==="]"){args.push(token);continue;}
    if(token==="BT"){emTexto=true;x=y=baseX=baseY=0;}
    if(token==="ET")emTexto=false;
    if(token==="Tf")font=args[0]||"";
    if(token==="Tm"){x=baseX=Number(args[4])||0;y=baseY=Number(args[5])||0;}
    if(token==="Td"||token==="TD"){baseX+=Number(args[0])||0;baseY+=Number(args[1])||0;x=baseX;y=baseY;}
    if(emTexto&&permitidas.has(font)&&(token==="Tj"||token==="TJ")){
     const texto=args.filter(a=>a.startsWith("(")||a.startsWith("<")).map(literal).join("");
     if(texto.trim()){const linha=Math.round(y*2)/2;const itens=linhas.get(linha)||[];itens.push({x,texto});linhas.set(linha,itens);}
    }
    args.length=0;
   }
  }
  paginas.push([...linhas].sort(([a],[b])=>b-a).map(([,itens])=>itens.sort((a,b)=>a.x-b.x).map(i=>i.texto).join(" ")).join("\n"));
 }
 return paginas.join("\n").slice(0,60000);
}
