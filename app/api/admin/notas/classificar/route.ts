import {and,eq,sql} from "drizzle-orm";
import {getAderesOrAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {colaboradores,documentosAssociacao} from "@/db/schema";
import {associacoesDoColaborador} from "@/lib/notas-servico";
import {normalizarNomeAssociacao} from "@/lib/nome-associacao";
import {ativoNaCompetencia} from "@/lib/vinculo-colaborador";
export const runtime="edge";
export async function POST(request:Request){
 if(!await getAderesOrAdminUser())return Response.json({message:"ACESSO NEGADO."},{status:403});
 try{
  const {key,categoriaNota,vinculoPrestacao}=await request.json() as {key?:string;categoriaNota?:string;vinculoPrestacao?:{colaboradorId:number;competencia:string}};
  if(typeof key!=="string"||!key||!["mudas","servico","outras","automatico"].includes(categoriaNota||""))return Response.json({message:"CLASSIFICAÇÃO INVÁLIDA."},{status:400});
  if(vinculoPrestacao!==undefined&&(
   categoriaNota!=="servico"||!vinculoPrestacao||!Number.isSafeInteger(vinculoPrestacao.colaboradorId)||
   typeof vinculoPrestacao.competencia!=="string"||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(vinculoPrestacao.competencia)
  ))return Response.json({message:"SELECIONE UM PRESTADOR E UMA COMPETÊNCIA VÁLIDOS PARA A NOTA DE SERVIÇO."},{status:400});
  const db=getDb();
  const registros=await db.select({id:documentosAssociacao.id,associacao:documentosAssociacao.associacao,notasFiscaisJson:documentosAssociacao.notasFiscaisJson}).from(documentosAssociacao).where(sql`instr(${documentosAssociacao.notasFiscaisJson}, ${key}) > 0`);
  for(const registro of registros){
   const notas=JSON.parse(registro.notasFiscaisJson) as Array<Record<string,unknown>>;
   const nota=notas.find(item=>item.key===key);if(!nota)continue;
   if(vinculoPrestacao){
    const [colaborador]=await db.select({
     associacao:colaboradores.associacao,associacoesJson:colaboradores.associacoesJson,
     dataAdmissao:colaboradores.dataAdmissao,dataSaida:colaboradores.dataSaida,
    }).from(colaboradores).where(eq(colaboradores.id,vinculoPrestacao.colaboradorId)).limit(1);
    if(!colaborador||!ativoNaCompetencia(colaborador,vinculoPrestacao.competencia)||
     !associacoesDoColaborador(colaborador).some(nome=>normalizarNomeAssociacao(nome)===normalizarNomeAssociacao(registro.associacao))){
     return Response.json({message:"O PRESTADOR DEVE ESTAR VINCULADO À ASSOCIAÇÃO E ATIVO NA COMPETÊNCIA."},{status:422});
    }
    nota.vinculoPrestacao=vinculoPrestacao;
   }
   if(categoriaNota==="automatico")delete nota.categoriaNota;else nota.categoriaNota=categoriaNota;
   const alterados=await db.update(documentosAssociacao).set({notasFiscaisJson:JSON.stringify(notas),atualizadoEm:new Date().toISOString()}).where(and(eq(documentosAssociacao.id,registro.id),eq(documentosAssociacao.notasFiscaisJson,registro.notasFiscaisJson))).returning({id:documentosAssociacao.id});
   if(!alterados.length)return Response.json({message:"A NOTA FOI ALTERADA. ATUALIZE A PÁGINA E TENTE NOVAMENTE."},{status:409});
   return Response.json({message:vinculoPrestacao?"PRESTADOR E COMPETÊNCIA SALVOS.":"CLASSIFICAÇÃO SALVA."});
  }
  return Response.json({message:"NOTA NÃO ENCONTRADA."},{status:404});
 }catch{return Response.json({message:"NÃO FOI POSSÍVEL CLASSIFICAR A NOTA."},{status:500});}
}
