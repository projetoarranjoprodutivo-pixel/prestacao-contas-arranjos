import {env} from "cloudflare:workers";
import {and,eq} from "drizzle-orm";
import {getAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {associacoes,colaboradores,planosTrabalho,prestacoes} from "@/db/schema";
import {chaveTexto,confirmarImportacaoSchema,listaJson,totalMinutosImportados,unirAtividades,type AtividadeImportada} from "@/lib/importacao-relatorios";
export const runtime="edge";
const hash=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");
type Anexo={key:string;nome:string;tipo:string;importacaoHash?:string;dadosHash?:string};
export async function POST(request:Request){
 if(!await getAdminUser())return Response.json({message:"ACESSO RESTRITO."},{status:403});
 try{
 if(!env.BUCKET)return Response.json({message:"ARMAZENAMENTO INDISPONÍVEL."},{status:503});
 const form=await request.formData(),dados=confirmarImportacaoSchema.parse(JSON.parse(String(form.get("dados")||""))),arquivo=form.get("arquivo");
 if(!(arquivo instanceof File)||arquivo.type!=="application/pdf"||!arquivo.size||arquivo.size>20*1024*1024)return Response.json({message:"ENVIE O PDF ORIGINAL DE ATÉ 20 MB."},{status:400});
 const bytes=await arquivo.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")return Response.json({message:"O ARQUIVO NÃO É UM PDF VÁLIDO."},{status:400});
 const db=getDb(),pessoa=await db.query.colaboradores.findFirst({where:eq(colaboradores.id,dados.colaboradorId)});if(!pessoa)return Response.json({message:"COLABORADOR NÃO ENCONTRADO."},{status:404});
 const associacao=await db.query.associacoes.findFirst({where:and(eq(associacoes.nome,dados.associacao),eq(associacoes.ativo,true))});if(!associacao)return Response.json({message:"SELECIONE UMA ASSOCIAÇÃO ATIVA."},{status:400});
 const condicao=and(eq(prestacoes.authUserId,pessoa.authUserId),eq(prestacoes.competencia,dados.competencia));
 const condicaoPlano=and(eq(planosTrabalho.authUserId,pessoa.authUserId),eq(planosTrabalho.competencia,dados.competencia));
 const [existente,plano]=await Promise.all([db.query.prestacoes.findFirst({where:condicao}),db.query.planosTrabalho.findFirst({where:condicaoPlano})]);
 if((existente?.atualizadoEm??null)!==dados.versaoPrestacao||(plano?.atualizadoEm??null)!==dados.versaoPlano)return Response.json({message:"OS REGISTROS DESTE MÊS FORAM ALTERADOS. ATUALIZE A CONFERÊNCIA DO DESTINO ANTES DE SALVAR."},{status:409});
 const digest=await hash(bytes),dadosHash=await hash(new TextEncoder().encode(JSON.stringify({atividades:dados.atividades,descricao:dados.descricao,associacao:dados.associacao,modo:dados.modo})).buffer);
 const anexos=listaJson<Anexo>(existente?.anexosJson);
 if(anexos.some(a=>a.importacaoHash===digest&&a.dadosHash===dadosHash))return Response.json({message:"ESTE PDF E ESTAS ATIVIDADES JÁ FORAM IMPORTADOS. NENHUM REGISTRO DUPLICADO.",atividades:listaJson(existente?.atividadesJson).length,jaImportado:true});
 const key=`prestacoes/${pessoa.authUserId}/${dados.competencia}/importacao-${digest}.pdf`;
 await env.BUCKET.put(key,bytes,{metadata:{contentType:"application/pdf"}});
 const anexo={key,nome:arquivo.name,tipo:"application/pdf",importacaoHash:digest,dadosHash};
 const anexosFinais=[...anexos.filter(a=>a.key!==key),anexo];
 const atividades=dados.modo==="substituir"?dados.atividades:unirAtividades(listaJson<AtividadeImportada>(existente?.atividadesJson),dados.atividades);
 const agendaNova=dados.atividades.map(a=>({data:a.data,hora:a.hora,duracaoEstimada:a.duracao?String(Number(a.duracao)/60):"",municipio:a.municipio,comunidade:a.comunidade,propriedade:a.propriedade,agricultor:a.agricultor,telefone:a.telefone,tipoAtividade:a.tipoAtividade,tipoMuda:a.tipoMuda,quantidadeMudas:a.quantidadeMudas,observacao:a.resumo}));
 const agenda=dados.modo==="substituir"?agendaNova:unirAtividades(listaJson<typeof agendaNova[number]>(plano?.agendaJson),agendaNova);
 const descricao=dados.modo==="substituir"||!existente?.observacoes?dados.descricao:existente.observacoes.includes(dados.descricao)?existente.observacoes:[existente.observacoes,dados.descricao].filter(Boolean).join("\n\n");
 const agricultores=listaJson<Record<string,string>>(pessoa.atendimentosJson),porNome=new Map(agricultores.map(a=>[`${chaveTexto(a.agricultor||"")}|${chaveTexto(a.municipio||"")}`,a]));
 for(const a of dados.atividades)if(a.agricultor.trim()){const chave=`${chaveTexto(a.agricultor)}|${chaveTexto(a.municipio)}`;if(!porNome.has(chave))porNome.set(chave,{agricultor:a.agricultor,municipio:a.municipio,comunidade:a.comunidade,propriedade:a.propriedade,telefone:a.telefone});}
 const atualizadoEm=new Date().toISOString();
 const values={authUserId:pessoa.authUserId,competencia:dados.competencia,municipio:atividades.find(a=>a.municipio)?.municipio||"",associacao:dados.associacao,atividadesJson:JSON.stringify(atividades),totalMinutos:totalMinutosImportados(atividades),anexosJson:JSON.stringify(anexosFinais),observacoes:descricao,status:"importado",atualizadoEm};
 const planoValues={authUserId:pessoa.authUserId,competencia:dados.competencia,associacao:dados.associacao,agendaJson:JSON.stringify(agenda),status:"importado",atualizadoEm};
 await db.batch([db.insert(prestacoes).values(values).onConflictDoUpdate({target:[prestacoes.authUserId,prestacoes.competencia],set:values}),db.insert(planosTrabalho).values(planoValues).onConflictDoUpdate({target:[planosTrabalho.authUserId,planosTrabalho.competencia],set:planoValues}),db.update(colaboradores).set({atendimentosJson:JSON.stringify([...porNome.values()]),atualizadoEm}).where(eq(colaboradores.id,pessoa.id))]);
 return Response.json({message:`IMPORTAÇÃO CONCLUÍDA: ${pessoa.nomeCompleto} · ${dados.competencia} · ${atividades.length} ATIVIDADES. PLANO, PRESTAÇÃO E PDF ORIGINAL SALVOS.`,atividades:atividades.length});
 }catch(error){console.error("confirmar_importacao_pdf",error);return Response.json({message:error instanceof Error&&error.name==="ZodError"?"CONFIRA OS CAMPOS DAS ATIVIDADES, DATAS E DURAÇÕES ANTES DE SALVAR.":"NÃO FOI POSSÍVEL SALVAR A IMPORTAÇÃO. CONFIRA OS DADOS E TENTE NOVAMENTE."},{status:400});}
}
