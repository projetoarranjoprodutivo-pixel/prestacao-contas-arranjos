import { getDb } from "@/db";
import { garantirAssociacoesCompletas, garantirBanco } from "@/db/bootstrap";
import { associacoes, usuariosAcesso } from "@/db/schema";
import { criarSenha } from "@/app/chatgpt-auth";
import { getAdminUser } from "@/lib/admin";
import { MUNICIPIOS_ES } from "@/lib/municipios-es";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";

export const runtime = "edge";

type Documento = { key: string; nome: string; tipo: string; tamanho: number };

const texto = (form: FormData, chave: string) => String(form.get(chave) || "").trim();
const somenteNumeros = (valor: string) => valor.replace(/\D/g, "");
const emailValido = (valor: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
const municipioValido = (valor: string) => MUNICIPIOS_ES.includes(valor as typeof MUNICIPIOS_ES[number]);

function lerDocumentos(valor: string | null): Documento[] {
  try {
    const itens = JSON.parse(valor || "[]");
    return Array.isArray(itens) ? itens : [];
  } catch {
    return [];
  }
}

function montarDados(form: FormData, documentos: Documento[]) {
  const nome = texto(form, "nome").toUpperCase();
  const razaoSocial = texto(form, "razaoSocial");
  const cnpj = somenteNumeros(texto(form, "cnpj"));
  const email = texto(form, "email").toLowerCase();
  const presidenteCpf = somenteNumeros(texto(form, "presidenteCpf"));
  const presidenteEmail = texto(form, "presidenteEmail").toLowerCase();
  let municipios: string[] = [];
  try { municipios = JSON.parse(texto(form, "municipios")); } catch {}
  municipios = [...new Set(municipios)].filter(municipioValido);

  const obrigatorios = [nome, razaoSocial, texto(form, "cep"), texto(form, "endereco"), texto(form, "celular")];
  if (obrigatorios.some(valor => !valor) || !municipios.length) {
    throw new Error("Preencha os campos obrigatórios e selecione ao menos um município atendido.");
  }
  if (cnpj.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");
  if (presidenteCpf && presidenteCpf.length !== 11) throw new Error("Informe um CPF do presidente com 11 dígitos.");
  if ((email && !emailValido(email)) || (presidenteEmail && !emailValido(presidenteEmail))) throw new Error("Informe endereços de e-mail válidos.");
  if ((texto(form, "municipio") && !municipioValido(texto(form, "municipio"))) ||
      (texto(form, "presidenteMunicipio") && !municipioValido(texto(form, "presidenteMunicipio")))) {
    throw new Error("Selecione municípios válidos do Espírito Santo.");
  }

  return {
    nome,
    razaoSocial,
    cnpj,
    cep: texto(form, "cep"),
    endereco: texto(form, "endereco"),
    bairro: texto(form, "bairro"),
    numero: texto(form, "numero"),
    municipio: texto(form, "municipio"),
    uf: texto(form, "uf").toUpperCase(),
    email,
    usuario: texto(form, "usuario").toLowerCase(),
    telefone: texto(form, "telefone") || null,
    celular: texto(form, "celular"),
    presidenteNome: texto(form, "presidenteNome"),
    presidenteCpf,
    presidenteCep: texto(form, "presidenteCep"),
    presidenteEndereco: texto(form, "presidenteEndereco"),
    presidenteBairro: texto(form, "presidenteBairro"),
    presidenteNumero: texto(form, "presidenteNumero"),
    presidenteMunicipio: texto(form, "presidenteMunicipio"),
    presidenteUf: texto(form, "presidenteUf").toUpperCase(),
    presidenteEmail,
    documentosJson: JSON.stringify(documentos),
    municipiosJson: JSON.stringify(municipios),
    ativo: true,
  };
}

async function prepararAcesso(form:FormData, associacaoAtual?:string){
  await garantirBanco();
  const db=getDb();
  const usuario=texto(form,"usuario").toLowerCase();
  const senha=texto(form,"senha");
  if(usuario.length<3)throw new Error("Informe um usuário com pelo menos 3 caracteres.");
  const vinculado=associacaoAtual?await db.query.usuariosAcesso.findFirst({where:and(eq(usuariosAcesso.funcao,"associacao"),eq(usuariosAcesso.associacao,associacaoAtual))}):null;
  const mesmoUsuario=await db.query.usuariosAcesso.findFirst({where:eq(usuariosAcesso.email,usuario)});
  if(mesmoUsuario&&mesmoUsuario.id!==vinculado?.id)throw new Error("Este usuário já está sendo utilizado.");
  if(!vinculado&&senha.length<8)throw new Error("A senha deve ter pelo menos 8 caracteres.");
  if(senha&&senha.length<8)throw new Error("A senha deve ter pelo menos 8 caracteres.");
  return{usuario,senha,vinculado};
}

async function salvarAcesso(usuario:string,senha:string,nomeAssociacao:string,vinculado?:typeof usuariosAcesso.$inferSelect|null){
  const db=getDb();
  if(vinculado){
    const dados:Partial<typeof usuariosAcesso.$inferInsert>={email:usuario,associacao:nomeAssociacao,funcao:"associacao",ativo:true};
    if(senha){const segredo=await criarSenha(senha);dados.senhaHash=segredo.hash;dados.senhaSalt=segredo.salt;}
    await db.update(usuariosAcesso).set(dados).where(eq(usuariosAcesso.id,vinculado.id));
  }else{
    const segredo=await criarSenha(senha);
    await db.insert(usuariosAcesso).values({id:crypto.randomUUID(),email:usuario,senhaHash:segredo.hash,senhaSalt:segredo.salt,funcao:"associacao",associacao:nomeAssociacao,ativo:true});
  }
}

async function salvarDocumentos(form: FormData, existentes: Documento[], identificador: string) {
  const arquivos = form.getAll("documentos").filter((item): item is File => item instanceof File && item.size > 0);
  if (!arquivos.length) return existentes;
  if (!env.BUCKET) throw new Error("O armazenamento de documentos não está configurado.");

  const permitidos = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const novos: Documento[] = [];
  for (const arquivo of arquivos) {
    if (!permitidos.has(arquivo.type)) throw new Error(`O arquivo ${arquivo.name} deve ser PDF, JPG ou PNG.`);
    if (arquivo.size > 10 * 1024 * 1024) throw new Error(`O arquivo ${arquivo.name} ultrapassa o limite de 10 MB.`);
    const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `associacoes/${identificador}/${crypto.randomUUID()}-${nomeSeguro}`;
    await env.BUCKET.put(key, await arquivo.arrayBuffer());
    novos.push({ key, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size });
  }
  return [...existentes, ...novos];
}

export async function POST(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito." }, { status: 403 });
  try {
    await garantirAssociacoesCompletas();
    const form = await request.formData();
    const acesso=await prepararAcesso(form);
    const documentos = await salvarDocumentos(form, [], crypto.randomUUID());
    const dados=montarDados(form, documentos);
    await getDb().insert(associacoes).values(dados);
    await salvarAcesso(acesso.usuario,acesso.senha,dados.nome);
    return Response.json({ message: "Associação cadastrada." });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Não foi possível cadastrar." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito." }, { status: 403 });
  try {
    await garantirAssociacoesCompletas();
    const form = await request.formData();
    const id = Number(form.get("id"));
    if (!id) throw new Error("Associação inválida.");
    const [atual] = await getDb().select().from(associacoes).where(eq(associacoes.id, id)).limit(1);
    if (!atual) throw new Error("Associação não encontrada.");
    const acesso=await prepararAcesso(form,atual.nome);
    const documentos = await salvarDocumentos(form, lerDocumentos(atual.documentosJson), String(id));
    const dados=montarDados(form, documentos);
    await getDb().update(associacoes).set(dados).where(eq(associacoes.id, id));
    await salvarAcesso(acesso.usuario,acesso.senha,dados.nome,acesso.vinculado);
    return Response.json({ message: "Associação atualizada." });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Não foi possível atualizar." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito." }, { status: 403 });
  await garantirAssociacoesCompletas();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ message: "Associação inválida." }, { status: 400 });
  await getDb().update(associacoes).set({ ativo: false }).where(eq(associacoes.id, id));
  return Response.json({ message: "Associação desativada." });
}
