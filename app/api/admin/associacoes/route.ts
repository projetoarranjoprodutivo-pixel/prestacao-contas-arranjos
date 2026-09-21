import { getDb } from "@/db";
import { associacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { MUNICIPIOS_ES } from "@/lib/municipios-es";
import { eq } from "drizzle-orm";

export const runtime = "edge";
const texto=(form:FormData,chave:string)=>String(form.get(chave)||"").trim();

function dados(form:FormData){
  const nome=texto(form,"nome").toUpperCase();
  const razaoSocial=texto(form,"razaoSocial");
  const cnpj=texto(form,"cnpj").replace(/\D/g,"");
  let municipios:string[]=[];try{municipios=JSON.parse(texto(form,"municipios"));}catch{}
  municipios=[...new Set(municipios)].filter(m=>MUNICIPIOS_ES.includes(m as typeof MUNICIPIOS_ES[number]));
  if(!nome||!razaoSocial||cnpj.length!==14||!texto(form,"cep")||!texto(form,"endereco")||!texto(form,"celular")||!municipios.length)throw new Error("Preencha os campos obrigatórios e selecione ao menos um município.");
  return {nome,razaoSocial,cnpj,cep:texto(form,"cep"),endereco:texto(form,"endereco"),telefone:texto(form,"telefone")||null,celular:texto(form,"celular"),municipiosJson:JSON.stringify(municipios),ativo:true};
}

export async function POST(request:Request){
  if(!await getAdminUser())return Response.json({message:"Acesso restrito."},{status:403});
  try{const form=await request.formData();await getDb().insert(associacoes).values(dados(form));return Response.json({message:"Associação cadastrada."});}
  catch(error){return Response.json({message:error instanceof Error?error.message:"Não foi possível cadastrar."},{status:400});}
}

export async function PUT(request:Request){
  if(!await getAdminUser())return Response.json({message:"Acesso restrito."},{status:403});
  try{const form=await request.formData();const id=Number(form.get("id"));if(!id)throw new Error("Associação inválida.");await getDb().update(associacoes).set(dados(form)).where(eq(associacoes.id,id));return Response.json({message:"Associação atualizada."});}
  catch(error){return Response.json({message:error instanceof Error?error.message:"Não foi possível atualizar."},{status:400});}
}

export async function DELETE(request:Request){
  if(!await getAdminUser())return Response.json({message:"Acesso restrito."},{status:403});
  const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({message:"Associação inválida."},{status:400});
  await getDb().update(associacoes).set({ativo:false}).where(eq(associacoes.id,id));return Response.json({message:"Associação desativada."});
}
