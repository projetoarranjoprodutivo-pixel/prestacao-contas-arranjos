import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { prestacoes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createPdf } from "@/lib/pdf";
import { isAdminEmail } from "@/lib/admin";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "edge";

type Atividade = {
  executada?: boolean;
  municipio?: string;
  comunidade?: string;
  propriedade?: string;
  agricultor?: string;
  beneficiario?: string;
  telefone?: string;
  tipoAtividade?: string;
  tipoMuda?: string;
  quantidadeMudas?: string;
  data?: string;
  inicio?: string;
  duracao?: string;
  resumo?: string;
  assinaturaProdutor?: string;
  assinaturaTecnico?: string;
};

function assinaturaBytes(valor?:string){
  if(!valor?.startsWith("data:image/"))return null;
  try{return Uint8Array.from(atob(valor.split(",")[1]||""),c=>c.charCodeAt(0));}catch{return null;}
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const competencia = url.searchParams.get("competencia") || "";
  if (id && !isAdminEmail(user.email)) return new Response("Acesso restrito", {status:403});
  const registro = await getDb().query.prestacoes.findFirst({
    where: id ? eq(prestacoes.id,id) : and(
      eq(prestacoes.authUserId, user.userId),
      eq(prestacoes.competencia, competencia),
    ),
  });
  if (!registro) return new Response("Prestação não encontrada", { status: 404 });

  const atividades = JSON.parse(registro.atividadesJson) as Atividade[];
  const sections = [
    {
      heading: "DADOS DO RELATÓRIO",
      lines: [
        `Competência: ${registro.competencia}`,
        `Associação: ${registro.associacao}`,
        `Município principal: ${registro.municipio}`,
        `Carga horária executada: ${registro.totalMinutos} minutos`,
      ],
    },
    {
      heading: "ATIVIDADES DO MÊS",
      lines: atividades.flatMap((a, i) => [
        `${i + 1}. ${a.executada === false ? "NÃO EXECUTADA" : "EXECUTADA"} | ${a.data || "Sem data"} - ${a.inicio || "Sem horário"}`,
        `${a.municipio || ""} - ${a.comunidade || ""} | Propriedade: ${a.propriedade || "Não informada"}`,
        `Agricultor: ${a.agricultor || a.beneficiario || "Não informado"} | Telefone: ${a.telefone || "Não informado"}`,
        `Tipo de atividade: ${a.tipoAtividade || "Visita Técnica"}${a.tipoAtividade === "Entrega de mudas" ? ` | Mudas: ${a.tipoMuda || "Não informado"} | Quantidade: ${a.quantidadeMudas || "0"}` : ""}`,
        `${a.executada === false ? "Motivo" : `Duração: ${a.duracao || "0"} minutos | Resumo`}: ${a.resumo || "Não informado"}`,
      ]),
    },
    {
      heading: "OBSERVAÇÕES",
      lines: [registro.observacoes || "Sem observações."],
    },
  ];
  const basePdf = await createPdf(
    "PRESTAÇÃO DE CONTAS MENSAL - ARRANJOS PRODUTIVOS",
    sections,
  );
  const pdf = await PDFDocument.load(basePdf);
  const anexos = JSON.parse(registro.anexosJson || "[]") as Array<{key:string;nome:string;tipo:string}>;
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  for(const [indice,atividade] of atividades.entries()){
    const assinaturas=[{titulo:"ASSINATURA DO PRODUTOR/REPRESENTANTE",valor:atividade.assinaturaProdutor},{titulo:"ASSINATURA DO TÉCNICO",valor:atividade.assinaturaTecnico}];
    if(!assinaturas.some(a=>a.valor))continue;
    const pagina=pdf.addPage([595.28,841.89]);
    pagina.drawText(`ASSINATURAS — ATIVIDADE ${indice+1}`,{x:40,y:800,size:14,font:fonte,color:rgb(0.08,0.23,0.16)});
    pagina.drawText(`${atividade.data||"Sem data"} · ${atividade.tipoAtividade||"Atividade"} · ${atividade.municipio||""}`,{x:40,y:776,size:10,font:fonte});
    for(const [posicao,item] of assinaturas.entries()){
      const y=posicao===0?470:165;pagina.drawText(item.titulo,{x:40,y:y+205,size:11,font:fonte});
      const bytes=assinaturaBytes(item.valor);if(!bytes){pagina.drawText("Não assinada",{x:40,y:y+100,size:10,font:fonte});continue;}
      try{const imagem=await pdf.embedJpg(bytes);const escala=Math.min(500/imagem.width,165/imagem.height,1);pagina.drawImage(imagem,{x:40,y:y+25,width:imagem.width*escala,height:imagem.height*escala});}catch{pagina.drawText("Assinatura indisponível",{x:40,y:y+100,size:10,font:fonte});}
      pagina.drawLine({start:{x:40,y:y+15},end:{x:555,y:y+15},thickness:0.7,color:rgb(0.3,0.3,0.3)});
    }
  }
  for (const [indice, anexo] of anexos.entries()) {
    const objeto = await env.BUCKET.get(anexo.key, "arrayBuffer");
    if (!objeto) continue;
    const bytes = new Uint8Array(objeto);
    try {
      if (anexo.tipo === "application/pdf") {
        const documento = await PDFDocument.load(bytes);
        const paginas = await pdf.copyPages(documento, documento.getPageIndices());
        paginas.forEach(pagina => pdf.addPage(pagina));
      } else if (anexo.tipo === "image/jpeg" || anexo.tipo === "image/png") {
        const imagem = anexo.tipo === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const pagina = pdf.addPage([595.28, 841.89]);
        pagina.drawText(`ANEXO ${indice + 1}: ${anexo.nome}`, {x:40,y:806,size:11,font:fonte,color:rgb(0.08,0.23,0.16)});
        const escala = Math.min(515 / imagem.width, 730 / imagem.height, 1);
        const largura = imagem.width * escala;
        const altura = imagem.height * escala;
        pagina.drawImage(imagem, {x:(595.28-largura)/2,y:45+(730-altura)/2,width:largura,height:altura});
      } else {
        await pdf.attach(bytes, anexo.nome, {mimeType:anexo.tipo||"application/octet-stream",description:`Anexo da prestação de contas ${registro.competencia}`});
      }
    } catch {
      await pdf.attach(bytes, anexo.nome, {mimeType:anexo.tipo||"application/octet-stream",description:`Anexo da prestação de contas ${registro.competencia}`});
    }
  }
  const resultado = await pdf.save();
  return new Response(resultado.buffer.slice(resultado.byteOffset,resultado.byteOffset+resultado.byteLength), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="prestacao-contas-${registro.competencia}.pdf"`,
    },
  });
}
