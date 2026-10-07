import { env } from "cloudflare:workers";
import { getAdminUser } from "@/lib/admin";
import { garantirBanco } from "@/db/bootstrap";

export const runtime="edge";
type Item={item?:string;descricao?:string;quantidade?:string;unidade?:string;valorUnitario?:string};

export async function POST(request:Request){
  if(!await getAdminUser())return Response.json({message:"ACESSO RESTRITO."},{status:403});
  await garantirBanco();
  const corpo=await request.json() as Item&{itens?:Item[]};
  const itens=Array.isArray(corpo.itens)?corpo.itens:[corpo];
  for(const registro of itens){
    const item=String(registro.item||"").trim().toLocaleUpperCase("pt-BR");
    if(!item)continue;
    await env.DB.prepare(`INSERT INTO itens_plano_associacao (item,descricao,quantidade,unidade,valor_unitario,atualizado_em)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(item) DO UPDATE SET descricao=excluded.descricao,quantidade=excluded.quantidade,unidade=excluded.unidade,valor_unitario=excluded.valor_unitario,atualizado_em=CURRENT_TIMESTAMP`)
      .bind(item,String(registro.descricao||""),String(registro.quantidade||""),String(registro.unidade||""),String(registro.valorUnitario||"")).run();
  }
  return Response.json({message:"ITEM SALVO COM SUCESSO."});
}
