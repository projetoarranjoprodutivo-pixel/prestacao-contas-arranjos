import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {prestacoes} from "@/db/schema";

const RESPONSAVEL="admin-importacao-mudas-2026";
const COMPETENCIA="2026-04";
const DATA_PADRAO="2026-04-20";

const ITENS:[string,string,number][]=[
 ["Alegre","Café Conilon",33000],["Muniz Freire","Café Conilon",33000],["Conceição do Castelo","Cacau",5000],["Jerônimo Monteiro","Café Conilon",33000],["Piúma","Café Conilon",35000],["Guaçuí","Café Arábica",33000],["Guaçuí","Banana-da-terra",8000],["Atílio Vivácqua","Café Conilon",28000],["Atílio Vivácqua","Banana-da-terra",6000],["Atílio Vivácqua","Maracujá",2000],["Alfredo Chaves","Café Conilon",38000],["Boa Esperança","Pimenta-do-reino",12000],["Colatina","Citros",3500],["Colatina","Manga",2000],["Conceição da Barra","Café Conilon",38000],["João Neiva","Cacau",5500],["Montanha","Café Conilon",38000],["Pedro Canário","Café Conilon",38000],["Pedro Canário","Goiaba",2500],["Jaguaré","Banana",22000],["Nova Venécia","Café Conilon",38000],["Marilândia","Cacau",5000],["Marilândia","Goiaba",500],["Itapemirim","Citros",2000],["Alto Rio Novo","Cacau",7500],["Alto Rio Novo","Abacate",1000],["Ecoporanga","Banana-da-terra",6000],["Vila Pavão","Cacau",7000],["Ibiraçu","Palmáceas",6000],["Rio Novo do Sul","Café Conilon",33000],["Rio Novo do Sul","Cacau",2000],["São Domingos do Norte","Cacau",8000],["São Domingos do Norte","Citros",2500],["Vila Valério","Abacate",1000],["Vila Valério","Citros",1500],["Vila Valério","Cacau",2500]
];

export async function garantirEntregasPlanilha2026(){
 const db=getDb();
 const existente=await db.query.prestacoes.findFirst({where:eq(prestacoes.authUserId,RESPONSAVEL)});
 if(existente)return;
 const atividades=ITENS.map(([municipio,tipoMuda,quantidade])=>({executada:true,municipio,comunidade:"",propriedade:"",agricultor:"",telefone:"",tipoAtividade:"Entrega de mudas",tipoMuda,quantidadeMudas:String(quantidade),data:DATA_PADRAO,inicio:"00:00",duracao:"0",unidadeDuracao:"horas",resumo:`ENTREGA DE ${quantidade.toLocaleString("pt-BR")} MUDA(S) DE ${tipoMuda.toLocaleUpperCase("pt-BR")}. DATA PROVISÓRIA PARA POSTERIOR CONFERÊNCIA.`,observacao:"DATA PROVISÓRIA IMPORTADA DA PLANILHA.",assinaturaProdutor:"",assinaturaTecnico:""}));
 await db.insert(prestacoes).values({authUserId:RESPONSAVEL,competencia:COMPETENCIA,municipio:"Consolidado",associacao:"CONSOLIDADO ADMINISTRATIVO",atividadesJson:JSON.stringify(atividades),totalMinutos:0,anexosJson:"[]",observacoes:"IMPORTAÇÃO DA PLANILHA DE ENTREGA DE MUDAS. DATA PADRÃO 20/04/2026.",status:"enviado",atualizadoEm:new Date().toISOString()}).onConflictDoNothing();
}
