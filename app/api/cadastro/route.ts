import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { garantirNomeEmpresarial } from "@/db/bootstrap";
import { associacoes, colaboradores } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export const runtime = "edge";
const cargos = new Set(["Técnico de campo", "Mobilizador", "Consultor de agroindústria", "Consultor de projetos", "Consultor de associativismo", "Coordenador geral", "Subcoordenador", "Comunicação"]);
const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ message: "Sessão expirada. Entre novamente." }, { status: 401 });
  try {
    await garantirNomeEmpresarial();
    const form = await request.formData(); const required = ["nomeCompleto","dataNascimento","cpf","sexo","cargo","associacao","cep","endereco","numero","bairro","cidade","uf","celular"];
    if (required.some(key => !text(form, key))) return Response.json({ message: "Preencha todos os campos obrigatórios." }, { status: 400 });
    if (!cargos.has(text(form, "cargo"))) return Response.json({ message: "Selecione um cargo válido." }, { status: 400 });
    const db=getDb();const associacaoValida=await db.query.associacoes.findFirst({where:and(eq(associacoes.nome,text(form,"associacao")),eq(associacoes.ativo,true))});
    if (!associacaoValida) return Response.json({ message: "Selecione uma associação válida." }, { status: 400 });
    let municipiosAtendidos:string[]=[];try{municipiosAtendidos=JSON.parse(text(form,"municipiosAtendidos")||"[]");}catch{}
    let municipiosAssociacao:string[]=[];try{municipiosAssociacao=JSON.parse(associacaoValida.municipiosJson||"[]");}catch{}
    if(text(form,"cargo")==="Técnico de campo"&&(!municipiosAtendidos.length||municipiosAtendidos.some(m=>!municipiosAssociacao.includes(m))))return Response.json({message:"Selecione somente municípios atendidos pela associação."},{status:400});
    const cpf = text(form, "cpf").replace(/\D/g, ""); if (cpf.length !== 11) return Response.json({ message: "Informe um CPF válido." }, { status: 400 });
    let atendimentos:Array<{municipio:string;comunidade:string;propriedade:string;agricultor:string;telefone:string}>=[];
    try{atendimentos=JSON.parse(text(form,"atendimentos"));}catch{atendimentos=[];}
    if(!atendimentos.length||atendimentos.some(a=>!a.municipio?.trim()||!a.comunidade?.trim()||!a.propriedade?.trim()||!a.agricultor?.trim()||!a.telefone?.trim()))return Response.json({message:"Complete município, comunidade, propriedade, agricultor e telefone em todos os atendimentos."},{status:400});
    let superiores:Record<string,string>={};try{superiores=JSON.parse(text(form,"superiores")||"{}");}catch{superiores={};}
    const existing = await db.query.colaboradores.findFirst({ where: eq(colaboradores.authUserId, user.userId) });
    let documentos: Array<{key:string;nome:string;tipo:string;validade:string}> = [];
    try { documentos = existing?.documentosJson ? JSON.parse(existing.documentosJson) : []; } catch { documentos = []; }
    documentos = documentos.map(d => ({ ...d, validade: d.validade || existing?.documentoValidade || "" }));
    if (!documentos.length && existing?.documentoKey) documentos.push({ key: existing.documentoKey, nome: existing.documentoNome || "Documento", tipo: existing.documentoTipo || "application/octet-stream", validade: existing.documentoValidade });
    const novos = form.getAll("documentos").filter((item): item is File => item instanceof File && item.size > 0);
    const validades = form.getAll("documentosValidades").map(String);
    if (novos.length !== validades.length || validades.some(v => !/^\d{4}-\d{2}-\d{2}$/.test(v))) return Response.json({ message: "Informe a validade de cada documento selecionado." }, { status: 400 });
    if (novos.length) {
      if (!env.BUCKET) throw new Error("Armazenamento KV indisponível");
      for (const [index, file] of novos.entries()) {
        if (file.size > 10 * 1024 * 1024) return Response.json({ message: `O arquivo ${file.name} deve ter no máximo 10 MB.` }, { status: 400 });
        if (!new Set(["application/pdf","image/jpeg","image/png"]).has(file.type)) return Response.json({ message: `Formato não permitido: ${file.name}.` }, { status: 400 });
        const key = `colaboradores/${user.userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await env.BUCKET.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
        documentos.push({ key, nome: file.name, tipo: file.type, validade: validades[index] });
      }
    }
    if (!documentos.length) return Response.json({ message: "Envie pelo menos um documento de identificação." }, { status: 400 });
    const primeiro = documentos[0]; const proximaValidade = documentos.map(d=>d.validade).filter(Boolean).sort()[0];
    if (!proximaValidade) return Response.json({ message: "Informe a validade dos documentos." }, { status: 400 });
    const values = { authUserId: user.userId, email: user.email, nomeCompleto: text(form,"nomeCompleto"), dataNascimento: text(form,"dataNascimento"), cpf, sexo: text(form,"sexo"), cargo: text(form,"cargo"), associacao: text(form,"associacao"), municipiosAtendidosJson:JSON.stringify(text(form,"cargo")==="Técnico de campo"?municipiosAtendidos:[]), mei:text(form,"mei")||null, nomeEmpresarial:text(form,"nomeEmpresarial")||null, cftaCrea:text(form,"cftaCrea")||null, cep: text(form,"cep"), endereco: text(form,"endereco"), numero: text(form,"numero"), complemento: text(form,"complemento") || null, bairro: text(form,"bairro"), cidade: text(form,"cidade"), uf: text(form,"uf").toUpperCase(), celular: text(form,"celular"), atendimentosJson: JSON.stringify(atendimentos), superioresJson: text(form,"cargo")==="Técnico de campo"?JSON.stringify(superiores):"{}", documentoKey: primeiro.key, documentoNome: primeiro.nome, documentoTipo: primeiro.tipo, documentosJson: JSON.stringify(documentos), documentoValidade: proximaValidade, atualizadoEm: new Date().toISOString() };
    if (existing) await db.update(colaboradores).set(values).where(eq(colaboradores.authUserId, user.userId)); else await db.insert(colaboradores).values(values);
    return Response.json({ message: existing ? "Cadastro atualizado com sucesso." : "Cadastro salvo com sucesso." });
  } catch (error) { console.error("cadastro_error", error); return Response.json({ message: "O serviço está temporariamente indisponível. Tente novamente." }, { status: 500 }); }
}
