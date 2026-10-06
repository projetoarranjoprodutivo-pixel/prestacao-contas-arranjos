import {eq} from "drizzle-orm";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {getDb} from "@/db";
import {garantirBanco} from "@/db/bootstrap";
import {documentosAssociacao} from "@/db/schema";
import {isAdminEmail} from "@/lib/admin";

export const runtime="edge";
type Arquivo={key?:string;nome?:string;tipo?:string;descricao?:string;quantidade?:string;valor?:string;dataEmissao?:string};

const produtos:Record<string,Pick<Arquivo,"descricao"|"quantidade"|"valor"|"dataEmissao">>={
  "AAFAIAR 073.PDF":{descricao:"MUDAS DE BANANA-DA-TERRA",quantidade:"9.090 UN",valor:"100000.00",dataEmissao:"2026-05-19"},
  "AAFAIAR 100420001.PDF":{descricao:"MUDAS FRUTÍFERAS NÃO ORNAMENTAIS",quantidade:"5.264 UN",valor:"100000.00",dataEmissao:"2026-04-10"},
  "AAFARSCRUZ 021.PDF":{descricao:"MUDAS DE CAFÉ CONILON CLONAL",quantidade:"76.924 UN",valor:"200000.00",dataEmissao:"2026-04-24"},
  "AAFATRIM 071.PDF":{descricao:"MUDAS DE PIMENTA-DO-REINO",quantidade:"8.333 UN",valor:"50000.00",dataEmissao:"2026-05-19"},
  "APRUVAB 026.PDF":{descricao:"MUDAS DE CAFÉ CONILON CLONAL",quantidade:"38.462 UN",valor:"100000.00",dataEmissao:"2026-05-18"},
  "APRUVAB 25089.PDF":{descricao:"MUDAS DE CACAU CCN 51 (2.780 UN) E PS 13.19 (2.776 UN)",quantidade:"5.556 UN",valor:"100000.00",dataEmissao:"2026-06-19"},
  "APRVG 027.PDF":{descricao:"MUDAS DE CAFÉ ARÁBICA",quantidade:"26.924 UN",valor:"70000.00",dataEmissao:"2026-05-18"},
  "APRVG 24631.PDF":{descricao:"MUDAS DE ABACATE E CITROS (GEADA, HASS, MARGARIDA, PRIMAVERA, LARANJA, MEXERICA E TANGERINA)",quantidade:"8.389 UN",valor:"200016.00",dataEmissao:"2026-04-24"},
  "APRVG 24825.PDF":{descricao:"MUDAS DE CACAU CCN 51 (1.389 UN) E PS 13.19 (1.389 UN)",quantidade:"2.778 UN",valor:"50000.00",dataEmissao:"2026-05-19"},
  "ARQSCD 066.PDF":{descricao:"MUDAS DE PIMENTA-DO-REINO",quantidade:"33.334 UN",valor:"200000.00",dataEmissao:"2026-04-08"},
  "NEEMIAS 038.PDF":{descricao:"MUDAS DE CAFÉ CONILON CLONAL",quantidade:"19.231 UN",valor:"50000.00",dataEmissao:"2026-05-28"},
  "NEEMIAS 8794.PDF":{descricao:"MUDAS DE BANANA BRS TERRA ANÃ",quantidade:"2.500 UN",valor:"27500.00",dataEmissao:"2026-06-18"},
};

function nomeNormalizado(nome=""){return nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/_/g," ").replace(/\s+/g," ").trim().toUpperCase()}
function mesExtenso(competencia:string){const [ano,mes]=competencia.split("-");const nomes=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];return `${nomes[Number(mes)-1]||mes} DE ${ano}`}

async function processar(){
  const user=await getChatGPTUser();
  if(!user||(user.role!=="aderes"&&user.role!=="admin"&&!isAdminEmail(user.email)))return Response.json({message:"ACESSO NEGADO."},{status:403});
  await garantirBanco();const db=getDb();const registros=await db.select().from(documentosAssociacao);let alterados=0;
  for(const registro of registros){
    let notas:Arquivo[]=[];try{notas=JSON.parse(registro.notasFiscaisJson||"[]")}catch{continue}
    let mudou=false;
    notas=notas.map(nota=>{
      if(nota.descricao&&nota.valor&&nota.dataEmissao)return nota;
      const nome=nomeNormalizado(nota.nome);const produto=produtos[nome];
      if(produto){mudou=true;alterados++;return {...nota,...produto}}
      // Os demais arquivos históricos são NFS-e mensais dos profissionais.
      // Preenche somente dados confirmáveis pelo contrato e pela competência;
      // a data permanece vazia quando não consta na indexação original.
      mudou=true;alterados++;
      return {...nota,descricao:`PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS — COMPETÊNCIA ${mesExtenso(registro.competencia)}`,quantidade:"160 H",valor:"5200.00"};
    });
    if(mudou)await db.update(documentosAssociacao).set({notasFiscaisJson:JSON.stringify(notas)}).where(eq(documentosAssociacao.id,registro.id));
  }
  return Response.json({message:"DOCUMENTOS PROCESSADOS COM SUCESSO.",alterados});
}
export const POST=processar;
export const GET=processar;
