import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type PdfSection = { heading?: string; lines: string[] };

type CapaProjeto = { logoBase64: string; identificacao: string; consultor?: string[]; periodo: string };

const LARGURA=595.28,ALTURA=841.89,MARGEM=42,CONTEUDO=LARGURA-MARGEM*2;
const VERDE=rgb(0.02,0.28,0.19),VERDE_MEDIO=rgb(0.04,0.48,0.32),VERDE_CLARO=rgb(0.92,0.97,0.94);
const CINZA=rgb(0.34,0.39,0.43),CINZA_CLARO=rgb(0.96,0.97,0.98),BORDA=rgb(0.82,0.86,0.84),PRETO=rgb(0.08,0.11,0.13);

function caixaAlta(valor:unknown){return String(valor??"").trim().toLocaleUpperCase("pt-BR");}
function quebrar(texto:string,fonte:PDFFont,tamanho:number,largura:number){const palavras=caixaAlta(texto).split(/\s+/).filter(Boolean);const linhas:string[]=[];let linha="";for(const original of palavras){let palavra=original;if(fonte.widthOfTextAtSize(palavra,tamanho)>largura){if(linha){linhas.push(linha);linha="";}while(fonte.widthOfTextAtSize(palavra,tamanho)>largura&&palavra.length>1){let corte=palavra.length-1;while(corte>1&&fonte.widthOfTextAtSize(`${palavra.slice(0,corte)}-`,tamanho)>largura)corte--;linhas.push(`${palavra.slice(0,corte)}-`);palavra=palavra.slice(corte);}}const candidata=linha?`${linha} ${palavra}`:palavra;if(fonte.widthOfTextAtSize(candidata,tamanho)<=largura)linha=candidata;else{if(linha)linhas.push(linha);linha=palavra;}}if(linha)linhas.push(linha);return linhas.length?linhas:["NÃO INFORMADO"];}

export async function createPdf(title:string,sections:PdfSection[],capa?:CapaProjeto){const pdf=await PDFDocument.create();pdf.setTitle(caixaAlta(title));pdf.setAuthor("PROJETO ARRANJOS PRODUTIVOS");pdf.setSubject("RELATÓRIO DO PORTAL DE PRESTAÇÃO DE CONTAS");const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page:PDFPage;let y=0;
 if (capa) {
   const folha = pdf.addPage([LARGURA, ALTURA]);
   const logo = await pdf.embedJpg(Uint8Array.from(atob(capa.logoBase64), caractere => caractere.charCodeAt(0)));
   const escala = Math.min(306 / logo.width, 99 / logo.height);
   folha.drawImage(logo, { x: (LARGURA - logo.width * escala) / 2, y: 690, width: logo.width * escala, height: logo.height * escala });

   const centro = (texto: string, posicao: number, tamanho: number, largura: number) =>
     quebrar(texto, bold, tamanho, largura).forEach((linha, indice) => folha.drawText(linha, {
       x: (LARGURA - bold.widthOfTextAtSize(linha, tamanho)) / 2,
       y: posicao - indice * (tamanho + 5), size: tamanho, font: bold, color: PRETO,
     }));

   folha.drawRectangle({ x: 70, y: 522, width: 455, height: 86, color: rgb(0.85, 0.88, 0.89) });
   centro("Realização de assistência técnica para", 575, 10, 400);
   centro("Agricultores e empreendedores familiares", 540, 10, 400);
   folha.drawRectangle({ x: 78, y: 350, width: 440, height: 135, color: rgb(0.92, 0.92, 0.92) });
   if (capa.consultor?.length) {
     centro(capa.identificacao, 458, 12, 390);
     const linhas = capa.consultor.flatMap(texto => quebrar(texto, bold, 10, 390));
     linhas.forEach((linha, indice) => folha.drawText(linha, {
       x: (LARGURA - bold.widthOfTextAtSize(linha, 10)) / 2,
       y: 433 - indice * 13, size: 10, font: bold, color: PRETO,
     }));
   } else {
     centro(capa.identificacao, 427, 13, 390);
   }
   centro(title, 285, 15, CONTEUDO);
   centro("Projeto Arranjos Produtivos no Estado do Espírito Santo", 226, 13, CONTEUDO);
   centro(capa.periodo, 175, 14, CONTEUDO);
 }

 function novaPagina(){page=pdf.addPage([LARGURA,ALTURA]);page.drawRectangle({x:0,y:ALTURA-92,width:LARGURA,height:92,color:VERDE});page.drawRectangle({x:0,y:ALTURA-97,width:LARGURA,height:5,color:VERDE_MEDIO});page.drawText("ARRANJOS PRODUTIVOS",{x:MARGEM,y:ALTURA-29,size:8,font:bold,color:rgb(0.69,0.9,0.79)});page.drawText("PORTAL DE PRESTAÇÃO DE CONTAS",{x:MARGEM,y:ALTURA-48,size:9,font:bold,color:rgb(1,1,1)});quebrar(title,bold,12,CONTEUDO).slice(0,2).forEach((linha,indice)=>page.drawText(linha,{x:MARGEM,y:ALTURA-68-indice*12,size:11,font:bold,color:rgb(1,1,1)}));y=ALTURA-119;}
 function garantirEspaco(altura:number){if(y-altura<66)novaPagina();}
 function tituloSecao(titulo:string){garantirEspaco(29);page.drawRectangle({x:MARGEM,y:y-17,width:CONTEUDO,height:20,color:VERDE_CLARO});page.drawRectangle({x:MARGEM,y:y-17,width:4,height:20,color:VERDE_MEDIO});page.drawText(caixaAlta(titulo),{x:MARGEM+12,y:y-11.5,size:8.3,font:bold,color:VERDE});y-=25;}
 function linhaConteudo(texto:string){const linhas=quebrar(texto||"NÃO INFORMADO",regular,8.4,CONTEUDO-24);const altura=Math.max(27,14+linhas.length*10);garantirEspaco(altura+4);page.drawRectangle({x:MARGEM,y:y-altura,width:CONTEUDO,height:altura,color:CINZA_CLARO,borderColor:BORDA,borderWidth:0.6});linhas.forEach((linha,indice)=>page.drawText(linha,{x:MARGEM+12,y:y-17-indice*10,size:8.4,font:regular,color:PRETO}));y-=altura+4;}
 novaPagina();const conteudo=sections.length?sections:[{heading:"SEM REGISTROS",lines:["NENHUMA INFORMAÇÃO ENCONTRADA."]}];for(const section of conteudo){if(section.heading)tituloSecao(section.heading);for(const line of section.lines.length?section.lines:["NÃO INFORMADO"])linhaConteudo(line);y-=5;}
 const paginas=pdf.getPages().slice(capa ? 1 : 0);const data=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date());paginas.forEach((pagina,indice)=>{pagina.drawLine({start:{x:MARGEM,y:48},end:{x:LARGURA-MARGEM,y:48},color:BORDA,thickness:0.7});pagina.drawText(`EMITIDO EM ${data}`,{x:MARGEM,y:31,size:7.5,font:regular,color:CINZA});const textoPagina=`PÁGINA ${indice+1} DE ${paginas.length}`;pagina.drawText(textoPagina,{x:LARGURA-MARGEM-bold.widthOfTextAtSize(textoPagina,7.5),y:31,size:7.5,font:bold,color:VERDE});});return pdf.save();}
