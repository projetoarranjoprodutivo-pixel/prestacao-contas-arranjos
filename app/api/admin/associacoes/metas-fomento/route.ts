import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {z} from "zod";
import {getAderesOrAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {associacoes} from "@/db/schema";
import {baseFomento,chaveConferencia,type ConferenciaFomento} from "@/lib/fomento-aderes";
export const runtime="edge";
const meses=z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).min(1).max(36);
export async function GET(request:Request){
 if(!await getAderesOrAdminUser())return Response.json({message:"Acesso restrito."},{status:403});
 if(!env.BUCKET)return Response.json({message:"Armazenamento indisponível."},{status:503});
 const url=new URL(request.url);const a=await getDb().query.associacoes.findFirst({where:eq(associacoes.nome,url.searchParams.get('associacao')||'')});
 if(!a)return Response.json({message:"Associação não encontrada."},{status:404});
 const base=baseFomento(a.cnpj,a.documentosJson);if(!base)return Response.json({base:null,message:"O termo cadastrado ainda não possui metas conferidas. Não será presumido cumprimento no PDF."});
 const validacao=meses.safeParse(url.searchParams.getAll('competencias'));if(!validacao.success)return Response.json({message:"Selecione competências válidas."},{status:400});
 const salvo=await env.BUCKET.get(chaveConferencia(a.id,base.sha256,validacao.data),'text');
 return Response.json({base,conferencia:salvo?JSON.parse(salvo):null},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 const user=await getAderesOrAdminUser();if(!user)return Response.json({message:"Acesso restrito."},{status:403});
 try{
 if(!env.BUCKET)throw new Error("Armazenamento indisponível.");
 const dados=z.object({associacao:z.string(),sha256:z.string(),competencias:meses,pareceres:z.record(z.string(),z.object({situacao:z.enum(['automatico','realizada','parcial','nao-realizada']),evidencia:z.string().max(4000),justificativa:z.string().max(4000)}))}).parse(await request.json());
 const a=await getDb().query.associacoes.findFirst({where:eq(associacoes.nome,dados.associacao)});const base=a&&baseFomento(a.cnpj,a.documentosJson);
 if(!a||!base||base.sha256!==dados.sha256)return Response.json({message:"O termo mudou. Reabra a conferência."},{status:409});
 for(const [id,p] of Object.entries(dados.pareceres)){if(!base.metas.some(m=>m.id===id))throw new Error("Meta inválida.");if(p.situacao==='realizada'&&!p.evidencia.trim())throw new Error("Informe as evidências para declarar uma meta realizada.");if(['parcial','nao-realizada'].includes(p.situacao)&&!p.justificativa.trim())throw new Error("Informe a justificativa da execução parcial ou não realização.");}
 const conferencia:ConferenciaFomento={sha256:base.sha256,competencias:[...new Set(dados.competencias)].sort(),pareceres:dados.pareceres,atualizadoEm:new Date().toISOString(),responsavel:user.email};
 await env.BUCKET.put(chaveConferencia(a.id,base.sha256,dados.competencias),JSON.stringify(conferencia));
 return Response.json({message:"Conferência e justificativas salvas para esta associação e período."});
 }catch(e){return Response.json({message:e instanceof z.ZodError?"Verifique os campos da conferência.":e instanceof Error?e.message:"Não foi possível salvar."},{status:400});}
}
