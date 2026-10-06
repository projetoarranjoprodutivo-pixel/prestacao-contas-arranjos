import {eq} from "drizzle-orm";
import {env} from "cloudflare:workers";
import {strFromU8,strToU8,unzipSync,zipSync} from "fflate";
import {getAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {associacoes} from "@/db/schema";

export const runtime="edge";
type Linha=Record<string,string>;
function xml(valor:unknown){return String(valor??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;").replace(/\r?\n/g,"</w:t><w:br/><w:t xml:space=\"preserve\">");}
function moeda(valor:string){const n=Number(String(valor||"").replace(/\./g,"").replace(",","."))||0;return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function colocar(documento:string,chave:string,valor:unknown){return documento.split(`{{${chave}}}`).join(xml(valor));}
function ajustarLinhas(documento:string,marcador:string,quantidade:number,capacidade:number){
 const linhas=[...documento.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map(resultado=>resultado[0]);
 const identificadas=linhas.map(linha=>({linha,indice:Number(linha.match(new RegExp(`\\{\\{${marcador}_(\\d+)\\}\\}`))?.[1]||0)})).filter(item=>item.indice>0);
 for(const item of [...identificadas].reverse())if(item.indice>quantidade)documento=documento.replace(item.linha,"");
 if(quantidade>capacidade){const base=identificadas.find(item=>item.indice===capacidade)?.linha;if(base){let novas="";for(let i=capacidade+1;i<=quantidade;i++)novas+=base.replace(new RegExp(`_${capacidade}\\}\\}`,"g"),`_${i}}}`);documento=documento.replace(base,`${base}${novas}`)}}
 return documento;
}
function organizarModelo(documento:string,dados:{etapas:Linha[];objetivos:Linha[];equipe:Linha[];itens:Linha[];repasses:Array<{mes:string;valor:string}>}){
 for(const antigo of ["passos.joao13@hotmail.com","(27) 3754-1236","702.605 SSP/ES","03/2025","03/2027","Produtor Rural e Técnico em agropecuária"])documento=documento.split(antigo).join("");
 documento=documento.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g,linha=>linha.includes("{{MON_QUANT_3}}")&&!linha.includes("{{MON_OBJ_3}}")?"":linha);
 documento=ajustarLinhas(documento,"ETAPA",dados.etapas.length,3);
 documento=ajustarLinhas(documento,"MON_OBJ",dados.objetivos.length,3);
 documento=ajustarLinhas(documento,"EQ_CARGO",dados.equipe.length,4);
 documento=ajustarLinhas(documento,"REPASSE_MES",dados.repasses.length,2);
 documento=ajustarLinhas(documento,"APL_ITEM",dados.itens.length,8);
 return documento.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g,tabela=>tabela
  .replace(/<w:trPr>([\s\S]*?)<\/w:trPr>/g,"<w:trPr><w:cantSplit/>$1</w:trPr>")
  .replace(/<w:tr(?!Pr)([^>]*)>(?!<w:trPr>)/g,'<w:tr$1><w:trPr><w:cantSplit/></w:trPr>')
  .replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g,(_paragrafo,atributos:string,conteudo:string)=>{
   const limpo=conteudo.replace(/<w:spacing\b[^>]*\/>/g,"");const espacamento='<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>';
   return limpo.includes("<w:pPr>")?`<w:p${atributos}>${limpo.replace("<w:pPr>",`<w:pPr>${espacamento}`)}</w:p>`:`<w:p${atributos}><w:pPr>${espacamento}</w:pPr>${limpo}</w:p>`;
  }));
}

export async function POST(request:Request){
 if(!await getAdminUser())return Response.json({message:"ACESSO RESTRITO."},{status:403});
 try{
  const dados=await request.json() as {associacaoId:number;inicio:string;termino:string;culturas:string[];etapas:Linha[];objetivos:Linha[];equipe:Linha[];itens:Linha[];repasses:Array<{mes:string;valor:string}>};
  const associacao=await getDb().query.associacoes.findFirst({where:eq(associacoes.id,Number(dados.associacaoId))});if(!associacao)return Response.json({message:"ASSOCIAÇÃO NÃO ENCONTRADA."},{status:404});
  let municipios:string[]=[];try{municipios=JSON.parse(associacao.municipiosJson||"[]");}catch{}const listaMunicipios=municipios.join(", ")||associacao.municipio||"MUNICÍPIOS A DEFINIR";const culturas=(dados.culturas||[]).join(", ")||"CULTURAS A DEFINIR";
  if(!env.ASSETS)throw new Error("O VÍNCULO DE ARQUIVOS ESTÁTICOS NÃO ESTÁ DISPONÍVEL.");
  const resposta=await env.ASSETS.fetch(new URL("/modelo-plano-trabalho-associacao.docx",request.url));if(!resposta.ok)throw new Error("MODELO DO PLANO NÃO ENCONTRADO.");const arquivos=unzipSync(new Uint8Array(await resposta.arrayBuffer()));let documento=organizarModelo(strFromU8(arquivos["word/document.xml"]),{etapas:dados.etapas||[],objetivos:dados.objetivos||[],equipe:dados.equipe||[],itens:dados.itens||[],repasses:dados.repasses||[]});
  const endereco=[associacao.endereco,associacao.numero,associacao.bairro].filter(Boolean).join(", ");const enderecoPresidente=[associacao.presidenteEndereco,associacao.presidenteNumero,associacao.presidenteBairro].filter(Boolean).join(", ");
  const apresentacao=`O fortalecimento dos Arranjos Produtivos visa o desenvolvimento sustentável e o contínuo avanço das cadeias produtivas dos agricultores familiares. Este projeto tem como objetivo fortalecer a produção agrícola familiar nos municípios de ${listaMunicipios}, reduzir o êxodo rural, gerar renda, desenvolver as comunidades e ampliar a diversificação produtiva, com prioridade para as culturas de ${culturas}.`;
  const diagnostico=`Nos municípios de ${listaMunicipios}, o diagnóstico territorial considera as cadeias produtivas de ${culturas}. Serão trabalhados o conhecimento e a capacitação técnica, a gestão da produção, o preparo do solo, o plantio, o manejo, a colheita, o armazenamento, a comercialização e o beneficiamento por agroindústrias, promovendo o desenvolvimento econômico e sustentável.`;
  const justificativa=`A ${associacao.nome} é entidade sem fins lucrativos que atua no fortalecimento da agricultura familiar. O projeto dará continuidade e ampliará o apoio aos produtores rurais dos municípios de ${listaMunicipios}, considerando o potencial das culturas de ${culturas}, por meio de assistência técnica, capacitação, diversificação produtiva e fornecimento de insumos.`;
  const objetivoGeral=`Fortalecer os Arranjos Produtivos da Agricultura Familiar nos municípios de ${listaMunicipios}, por meio de assistência técnica continuada, capacitação produtiva e incentivo à diversificação das culturas de ${culturas}.`;
  const publico=`Produtores rurais dos municípios de ${listaMunicipios}, beneficiados com capacitação, apoio técnico, aperfeiçoamento produtivo e ações voltadas às culturas de ${culturas}.`;
  const abrangencia=`O Projeto será executado nos municípios de ${listaMunicipios}, abrangendo comunidades, propriedades da agricultura familiar, associações rurais e empreendimentos familiares previamente identificados. As ações ocorrerão nas propriedades e em espaços comunitários destinados a reuniões, capacitações, dias de campo, seminários e treinamentos técnicos.`;
  const mapa:Record<string,unknown>={NOME_ASSOCIACAO:associacao.nome,RAZAO_SOCIAL:associacao.razaoSocial||associacao.nome,CNPJ:associacao.cnpj||"",ENDERECO:endereco,MUNICIPIO_SEDE:associacao.municipio||"",UF:associacao.uf||"ES",CEP:associacao.cep||"",TELEFONE:associacao.telefone||"",CELULAR:associacao.celular||"",EMAIL:associacao.email||"",PRESIDENTE:associacao.presidenteNome||"",CPF_PRESIDENTE:associacao.presidenteCpf||"",RG_PRESIDENTE:"",ENDERECO_PRESIDENTE:enderecoPresidente,MUNICIPIO_PRESIDENTE:associacao.presidenteMunicipio||"",UF_PRESIDENTE:associacao.presidenteUf||"ES",CEP_PRESIDENTE:associacao.presidenteCep||"",EMAIL_PRESIDENTE:associacao.presidenteEmail||"",TELEFONE_PRESIDENTE:associacao.telefone||"",CELULAR_PRESIDENTE:associacao.celular||"",PERIODO_INICIO:dados.inicio,PERIODO_TERMINO:dados.termino,APRESENTACAO:apresentacao,DIAGNOSTICO:diagnostico,JUSTIFICATIVA_1:justificativa,JUSTIFICATIVA_2:"",OBJETIVO_GERAL:objetivoGeral,OBJETIVOS_ESPECIFICOS:(dados.etapas||[]).map(x=>x.objetivo).join("\n"),PUBLICO_1:publico,PUBLICO_2:"",ABRANGENCIA:abrangencia};
  (dados.etapas||[]).forEach((l,i)=>Object.assign(mapa,{[`ETAPA_${i+1}`]:l.nome,[`OBJETIVO_${i+1}`]:l.objetivo,[`ACOES_${i+1}`]:l.acoes,[`METAS_${i+1}`]:l.metas,[`RESULTADOS_${i+1}`]:l.resultados}));
  (dados.objetivos||[]).forEach((l,i)=>Object.assign(mapa,{[`MON_OBJ_${i+1}`]:l.objetivo,[`MON_QUANT_${i+1}`]:l.quantitativos,[`MON_QUAL_${i+1}`]:l.qualitativos,[`MON_FONTE_${i+1}`]:l.fonte,[`MON_COLETA_${i+1}`]:l.coleta,[`MON_RESP_${i+1}`]:l.responsavel,[`MON_PERIOD_${i+1}`]:l.periodicidade}));
  (dados.equipe||[]).forEach((l,i)=>Object.assign(mapa,{[`EQ_CARGO_${i+1}`]:l.cargo,[`EQ_NUM_${i+1}`]:l.numero,[`EQ_ESC_SUP_${i+1}`]:l.escolaridade.toLocaleLowerCase("pt-BR").includes("superior")?"X":"",[`EQ_ESC_MED_${i+1}`]:l.escolaridade.toLocaleLowerCase("pt-BR").includes("médio")||l.escolaridade.toLocaleLowerCase("pt-BR").includes("medio")?"X":"",[`EQ_ATRIB_${i+1}`]:l.atribuicoes,[`EQ_SIM_${i+1}`]:"",[`EQ_NAO_${i+1}`]:"X",[`EQ_PERIODO_${i+1}`]:l.periodo,[`EQ_NATUREZA_${i+1}`]:l.natureza}));
  let total=0;(dados.itens||[]).forEach((l,i)=>{total+=Number(l.valorTotal.replace(/\./g,"").replace(",","."))||0;Object.assign(mapa,{[`APL_ITEM_${i+1}`]:l.item,[`APL_DESC_${i+1}`]:l.descricao,[`APL_QUANT_${i+1}`]:l.quantidade,[`APL_UNID_${i+1}`]:l.unidade,[`APL_UNIT_${i+1}`]:moeda(l.valorUnitario),[`APL_TOTAL_${i+1}`]:moeda(l.valorTotal)})});mapa.TOTAL_GERAL=total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});mapa.ORCAMENTO=`Orçamento total do projeto, conforme Plano de Aplicação de Recursos: ${mapa.TOTAL_GERAL}.`;
  (dados.repasses||[]).forEach((l,i)=>{mapa[`REPASSE_MES_${i+1}`]=l.mes;mapa[`REPASSE_VALOR_${i+1}`]=moeda(l.valor)});mapa.DECLARACAO=`Na qualidade de representante legal do proponente, declaro, para fins de prova junto à ADERES, sob as penas da Lei, que inexiste situação de inadimplência que impeça a transferência de recursos públicos na forma deste Plano de Trabalho.\n\n${associacao.municipio||"Espírito Santo"}, ____ de __________________ de ______.\n\n${associacao.presidenteNome||"RESPONSÁVEL PELA INSTITUIÇÃO"}\nResponsável pela Instituição`;
  for(const[chave,valor]of Object.entries(mapa))documento=colocar(documento,chave,valor);documento=documento.replace(/\{\{[A-Z0-9_]+\}\}/g,"");arquivos["word/document.xml"]=strToU8(documento);
  const saida=zipSync(arquivos,{level:6});const nome=`PLANO_DE_TRABALHO_${associacao.nome.replace(/[^A-Z0-9]+/gi,"_")}.docx`;
  return new Response(saida,{headers:{"content-type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","content-disposition":`attachment; filename=\"${nome}\"`}});
 }catch(error){console.error("gerar_plano_associacao",error);return Response.json({message:error instanceof Error?error.message:"NÃO FOI POSSÍVEL GERAR O PLANO DE TRABALHO."},{status:500})}
}
