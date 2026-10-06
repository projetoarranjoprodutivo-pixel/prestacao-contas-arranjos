import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { getAderesOrAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { associacoes, colaboradores, documentosAssociacao, prestacoes } from "@/db/schema";
import { createPdf, PdfSection } from "@/lib/pdf";
import { ehEntregaMudas, quantidadeEntregue, tipoMudaEntregue } from "@/lib/entregas-mudas";

export const runtime="edge";
type Atividade={executada?:boolean;municipio?:string;comunidade?:string;propriedade?:string;agricultor?:string;beneficiario?:string;telefone?:string;tipoAtividade?:string;tipoMuda?:string;quantidadeMudas?:string;data?:string;inicio?:string;duracao?:string;resumo?:string;assinaturaProdutor?:string;assinaturaTecnico?:string};
type Arquivo={key:string;nome:string;tipo:string;descricao?:string;quantidade?:string;valor?:string;dataEmissao?:string};
const informado=(v:unknown)=>String(v??"").trim()||"NÃO INFORMADO";
const dataBr=(v:unknown)=>{const s=String(v||"");const p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:informado(v)};
const lista=<T,>(json:string|null|undefined):T[]=>{try{const v=JSON.parse(json||"[]");return Array.isArray(v)?v:[]}catch{return[]}};
const mesReferencia=(competencia:string)=>new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${competencia}-02T12:00:00Z`));
const numero=(valor:unknown)=>{const texto=String(valor??"").replace(/[^\d,.-]/g,"");if(!texto)return 0;const normalizado=texto.includes(",")?texto.replaceAll(".","").replace(",","."):/^-?\d{1,3}(\.\d{3})+$/.test(texto)?texto.replaceAll(".",""):texto;const resultado=Number(normalizado);return Number.isFinite(resultado)?resultado:0;};
const ehCompraMudas=(arquivo:Arquivo)=>/muda|semente|plântula|plantula/i.test(`${arquivo.descricao||""} ${arquivo.nome||""}`);
const chaveTexto=(valor:unknown)=>String(valor??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR");

export async function GET(request:Request){
  if(!await getAderesOrAdminUser())return new Response("Acesso restrito",{status:403});
  const url=new URL(request.url);const competenciaUnica=url.searchParams.get("competencia")||"";const nomeAssociacao=url.searchParams.get("associacao")||"";
  const competencias=[...new Set([...url.searchParams.getAll("competencias"),...(competenciaUnica?[competenciaUnica]:[])])].filter(valor=>/^\d{4}-\d{2}$/.test(valor)).sort();
  if(!competencias.length)return new Response("Selecione ao menos uma competência válida",{status:400});
  const db=getDb();
  const associacao=await db.query.associacoes.findFirst({where:and(eq(associacoes.nome,nomeAssociacao),eq(associacoes.ativo,true))});
  if(!associacao)return new Response("Associação não encontrada",{status:404});
  let relatorios:typeof prestacoes.$inferSelect[]=[],usuarios:typeof colaboradores.$inferSelect[]=[],financeiro:typeof documentosAssociacao.$inferSelect[]=[];
  const colunasPrestacao=getTableColumns(prestacoes);
  try{[relatorios,usuarios,financeiro]=await Promise.all([
    db.select({...colunasPrestacao,atividadesJson:sql<string>`COALESCE((SELECT json_group_array(json_remove(value, '$.assinaturaProdutor', '$.assinaturaTecnico')) FROM json_each(${prestacoes.atividadesJson})), '[]')`}).from(prestacoes).where(and(eq(prestacoes.associacao,associacao.nome),inArray(prestacoes.competencia,competencias))),
    db.select().from(colaboradores),
    db.select().from(documentosAssociacao).where(and(eq(documentosAssociacao.associacao,associacao.nome),inArray(documentosAssociacao.competencia,competencias))),
  ]);}catch(error){return new Response(`FALHA AO CONSULTAR OS DADOS: ${error instanceof Error?error.message:String(error)}`,{status:500});}
  const nomes=new Map(usuarios.map(u=>[u.authUserId,u]));
  const atividades=relatorios.flatMap(r=>lista<Atividade>(r.atividadesJson).filter(a=>a.executada!==false).map(a=>({a,r,u:nomes.get(r.authUserId)})));
  const visitas=atividades.filter(x=>informado(x.a.tipoAtividade).toLocaleLowerCase("pt-BR")==="visita técnica");
  const eventos=atividades.filter(x=>informado(x.a.tipoAtividade).toLocaleLowerCase("pt-BR")!=="visita técnica"&&!ehEntregaMudas(x.a));
  const entregas=atividades.filter(x=>ehEntregaMudas(x.a));
  const agricultoresMap=new Map<string,{nome:string;municipio:string;beneficios:string[];quantidade:number;observacoes:string[]}>();
  for(const {a} of atividades){const nome=informado(a.agricultor||a.beneficiario);if(nome==="NÃO INFORMADO")continue;const atual=agricultoresMap.get(nome)||{nome,municipio:informado(a.municipio),beneficios:[],quantidade:0,observacoes:[]};if(a.tipoAtividade)atual.beneficios.push(informado(a.tipoAtividade));if(ehEntregaMudas(a))atual.beneficios.push(`MUDAS DE ${tipoMudaEntregue(a)}`);atual.quantidade+=quantidadeEntregue(a);if(a.resumo)atual.observacoes.push(a.resumo);agricultoresMap.set(nome,atual);}
  const agricultores=[...agricultoresMap.values()];
  const extratos=financeiro.flatMap(item=>lista<Arquivo>(item.extratosJson)),notas=financeiro.flatMap(item=>lista<Arquivo>(item.notasFiscaisJson)),anexos=relatorios.flatMap(r=>lista<Arquivo>(r.anexosJson));
  const comprasMudas=notas.filter(ehCompraMudas);
  const totalMudasCompradas=comprasMudas.reduce((total,arquivo)=>total+numero(arquivo.quantidade),0);
  const totalMudasEntregues=entregas.reduce((total,item)=>total+quantidadeEntregue(item.a),0);
  const identificarPrestador=(arquivo:Arquivo)=>{const texto=chaveTexto(`${arquivo.nome} ${arquivo.descricao}`);return usuarios.find(usuario=>{const nomes=[usuario.nomeCompleto,usuario.nomeEmpresarial,usuario.email].filter(Boolean).map(chaveTexto);const partes=chaveTexto(usuario.nomeCompleto).split(/\s+/).filter(parte=>parte.length>3).slice(0,2);return nomes.some(nome=>nome.length>4&&texto.includes(nome))||(partes.length>0&&partes.every(parte=>texto.includes(parte)));});};
  const pagamentosColaboradores=notas.map(arquivo=>({arquivo,prestador:identificarPrestador(arquivo)})).filter(item=>!!item.prestador||/SERVIÇO|SERVICO|TÉCNIC|TECNIC|CONSULT|MOBILIZ|COORDENA|COMUNICAÇÃO|COMUNICACAO/i.test(`${item.arquivo.descricao||""} ${item.arquivo.nome||""}`));
  const totalPagamentosColaboradores=pagamentosColaboradores.reduce((total,item)=>total+numero(item.arquivo.valor),0);
  const fichasVisita=anexos.filter(arquivo=>/ficha/i.test(arquivo.nome));
  const chavesFichas=new Set(fichasVisita.map(arquivo=>arquivo.key));
  const fotos=anexos.filter(arquivo=>!chavesFichas.has(arquivo.key)&&(arquivo.tipo==="image/jpeg"||arquivo.tipo==="image/png")).slice(0,10);
  const arquivos=[...extratos.map(a=>({...a,grupo:"EXTRATO BANCÁRIO"})),...notas.map(a=>({...a,grupo:"NOTA FISCAL"})),...anexos.map(a=>({...a,grupo:"ANEXO TÉCNICO"}))];
  const referencias=competencias.map(mesReferencia).join("; ");
  const identificadorCompetencias=competencias.join("_");
  const tecnicos=[...new Set(relatorios.map(r=>nomes.get(r.authUserId)?.nomeCompleto).filter(Boolean))] as string[];
  const endereco=[associacao.endereco,associacao.numero,associacao.bairro,associacao.municipio,associacao.uf,associacao.cep].filter(Boolean).join(" - ");
  const enderecoPresidente=[associacao.presidenteEndereco,associacao.presidenteNumero,associacao.presidenteBairro,associacao.presidenteMunicipio,associacao.presidenteUf,associacao.presidenteCep].filter(Boolean).join(" - ");
  const sections:PdfSection[]=[
    {heading:"CABEÇALHO - DADOS COMPLETOS DA ASSOCIAÇÃO",lines:[`RAZÃO SOCIAL: ${informado(associacao.razaoSocial)}`,`NOME ABREVIADO: ${informado(associacao.nome)} | CNPJ: ${informado(associacao.cnpj)}`,`ENDEREÇO: ${informado(endereco)}`,`TELEFONE: ${informado(associacao.telefone)} | CELULAR: ${informado(associacao.celular)} | E-MAIL: ${informado(associacao.email)}`,`MUNICÍPIOS ATENDIDOS: ${lista<string>(associacao.municipiosJson).join(", ")||"NÃO INFORMADO"}`,`PRESIDENTE: ${informado(associacao.presidenteNome)} | CPF: ${informado(associacao.presidenteCpf)} | E-MAIL: ${informado(associacao.presidenteEmail)}`,`ENDEREÇO DO PRESIDENTE: ${informado(enderecoPresidente)}`]},
    {heading:"IDENTIFICAÇÃO",lines:[`ASSOCIAÇÃO: ${informado(associacao.razaoSocial||associacao.nome)}`,`CNPJ: ${informado(associacao.cnpj)}`,`MUNICÍPIO: ${informado(associacao.municipio)} / ${informado(associacao.uf)}`,`MESES DE REFERÊNCIA: ${referencias}`,`RESPONSÁVEL PELO PREENCHIMENTO: ${informado(associacao.presidenteNome)}`,`TÉCNICO(S) RESPONSÁVEL(IS): ${tecnicos.join("; ")||"NÃO INFORMADO"}`]},
    {heading:"RESUMO GERAL DA PRESTAÇÃO DE CONTAS",lines:[`COMPETÊNCIAS CONSOLIDADAS: ${competencias.map(c=>mesReferencia(c).toLocaleUpperCase("pt-BR")).join(" · ")}`,`VISITAS TÉCNICAS REALIZADAS: ${visitas.length}`,`AGRICULTORES IDENTIFICADOS: ${agricultores.length}`,`MUDAS ENTREGUES: ${totalMudasEntregues.toLocaleString("pt-BR")}`,`MUDAS COMPRADAS IDENTIFICADAS NAS NOTAS: ${totalMudasCompradas?totalMudasCompradas.toLocaleString("pt-BR"):"QUANTIDADE NÃO IDENTIFICADA"}`,`PAGAMENTOS A COLABORADORES IDENTIFICADOS: ${totalPagamentosColaboradores.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`,`FICHAS DE VISITA LOCALIZADAS: ${fichasVisita.length}`,`FOTOS INCLUÍDAS NO RELATÓRIO: ${fotos.length} DE NO MÁXIMO 10`]},
    {heading:"AGRICULTORES",lines:agricultores.length?agricultores.map((a,i)=>`${i+1}. NOME DO AGRICULTOR: ${a.nome} | MUNICÍPIO: ${a.municipio} | TIPO DE BENEFÍCIO RECEBIDO: ${[...new Set(a.beneficios)].join(", ")||"ASSISTÊNCIA TÉCNICA"} | QUANTIDADE: ${a.quantidade||"NÃO INFORMADO"} | OBSERVAÇÕES: ${a.observacoes.join("; ")||"NÃO INFORMADO"}`):["NENHUM AGRICULTOR REGISTRADO NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"VISITAS TÉCNICAS REALIZADAS",lines:visitas.length?visitas.map((x,i)=>`${i+1}. COMPETÊNCIA: ${mesReferencia(x.r.competencia).toLocaleUpperCase("pt-BR")} | DATA: ${dataBr(x.a.data)} | TÉCNICO RESPONSÁVEL: ${informado(x.u?.nomeCompleto)} | AGRICULTOR: ${informado(x.a.agricultor||x.a.beneficiario)} | MUNICÍPIO: ${informado(x.a.municipio)} | COMUNIDADE: ${informado(x.a.comunidade)} | PROPRIEDADE: ${informado(x.a.propriedade)} | ATIVIDADE / ORIENTAÇÃO: ${informado(x.a.resumo)}`):["NENHUMA VISITA TÉCNICA REGISTRADA NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"EVENTOS E AÇÕES COLETIVAS",lines:eventos.length?eventos.map((x,i)=>`${i+1}. COMPETÊNCIA: ${mesReferencia(x.r.competencia).toLocaleUpperCase("pt-BR")} | DATA: ${dataBr(x.a.data)} | TIPO: ${informado(x.a.tipoAtividade)} | TEMA: ${informado(x.a.resumo)} | LOCAL: ${informado([x.a.comunidade,x.a.municipio].filter(Boolean).join(" - "))} | RESPONSÁVEL: ${informado(x.u?.nomeCompleto)}`):["NENHUM EVENTO OU AÇÃO COLETIVA REGISTRADO NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"MUDAS ENTREGUES",lines:entregas.length?[`TOTAL ENTREGUE NO PERÍODO: ${totalMudasEntregues.toLocaleString("pt-BR")} MUDA(S)`,...entregas.map((x,i)=>`${i+1}. COMPETÊNCIA: ${mesReferencia(x.r.competencia).toLocaleUpperCase("pt-BR")} | DATA: ${dataBr(x.a.data)} | MUNICÍPIO: ${informado(x.a.municipio)} | TIPO DE MUDAS: ${tipoMudaEntregue(x.a)} | QUANTIDADE: ${quantidadeEntregue(x.a)||"NÃO INFORMADO"} | RESPONSÁVEL: ${informado(x.u?.nomeCompleto)}`)]:["NENHUMA ENTREGA DE MUDAS REGISTRADA NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"MUDAS COMPRADAS",lines:comprasMudas.length?[`TOTAL COMPRADO IDENTIFICADO: ${totalMudasCompradas?totalMudasCompradas.toLocaleString("pt-BR"):"QUANTIDADE NÃO IDENTIFICADA"} MUDA(S)`,...comprasMudas.map((arquivo,i)=>`${i+1}. DATA DE EMISSÃO: ${arquivo.dataEmissao?dataBr(arquivo.dataEmissao):"NÃO IDENTIFICADA"} | DESCRIÇÃO: ${informado(arquivo.descricao)} | QUANTIDADE: ${informado(arquivo.quantidade)} | VALOR: ${arquivo.valor?numero(arquivo.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"NÃO INFORMADO"} | NOTA FISCAL: ${arquivo.nome}`)]:["NENHUMA COMPRA DE MUDAS FOI IDENTIFICADA NAS NOTAS FISCAIS SELECIONADAS."]},
    {heading:"PAGAMENTOS EFETUADOS AOS COLABORADORES",lines:pagamentosColaboradores.length?[`TOTAL DE PAGAMENTOS IDENTIFICADOS NO PERÍODO: ${totalPagamentosColaboradores.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`,...pagamentosColaboradores.map((item,i)=>`${i+1}. COLABORADOR / PRESTADOR: ${informado(item.prestador?.nomeCompleto||item.prestador?.nomeEmpresarial)} | CARGO: ${informado(item.prestador?.cargo)} | DATA DE EMISSÃO: ${item.arquivo.dataEmissao?dataBr(item.arquivo.dataEmissao):"NÃO IDENTIFICADA"} | SERVIÇO: ${informado(item.arquivo.descricao)} | VALOR PAGO: ${item.arquivo.valor?numero(item.arquivo.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"NÃO INFORMADO"} | DOCUMENTO: ${item.arquivo.nome}`)]:["NENHUM PAGAMENTO A COLABORADOR FOI IDENTIFICADO NOS DOCUMENTOS DAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"FICHAS DE VISITA",lines:fichasVisita.length?fichasVisita.map((arquivo,i)=>`${i+1}. ${arquivo.nome} | ARQUIVO INCLUÍDO OU ANEXADO AO FINAL DO RELATÓRIO`):["NENHUMA FICHA DE VISITA FOI IDENTIFICADA NOS ANEXOS."]},
    {heading:"REGISTRO FOTOGRÁFICO",lines:fotos.length?[`FORAM SELECIONADAS ${fotos.length} FOTO(S), RESPEITANDO O LIMITE MÁXIMO DE 10 IMAGENS.`,...fotos.map((arquivo,i)=>`${i+1}. ${arquivo.nome}`)]:["NENHUMA FOTO FOI IDENTIFICADA NOS ANEXOS."]},
    {heading:"AQUISIÇÕES E DOCUMENTOS FISCAIS",lines:notas.length?notas.map((a,i)=>`${i+1}. DATA DE EMISSÃO: ${a.dataEmissao?dataBr(a.dataEmissao):"NÃO IDENTIFICADA"} | DESCRIÇÃO DO PRODUTO OU SERVIÇO: ${a.descricao||"NÃO IDENTIFICADA"} | QUANTIDADE: ${a.quantidade||"NÃO INFORMADA"} | VALOR TOTAL: ${a.valor?numero(a.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"NÃO INFORMADO"} | DOCUMENTO FISCAL: ${a.nome}`):["NENHUMA NOTA FISCAL ENVIADA NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"CONTROLE DE HORAS - FOMENTO",lines:relatorios.length?relatorios.map((r,i)=>{const u=nomes.get(r.authUserId);return `${i+1}. NOME DO PROFISSIONAL: ${informado(u?.nomeCompleto)} | CARGO / FUNÇÃO: ${informado(u?.cargo)} | PERÍODO DE REFERÊNCIA: ${mesReferencia(r.competencia)} | HORAS PREVISTAS: NÃO INFORMADO | HORAS TRABALHADAS: ${(r.totalMinutos/60).toLocaleString("pt-BR",{maximumFractionDigits:2})} | VALOR DA HORA: NÃO INFORMADO | VALOR CORRESPONDENTE: NÃO INFORMADO | OBSERVAÇÕES: ${informado(r.observacoes)}`;}):["NENHUM CONTROLE DE HORAS REGISTRADO NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"RESUMO GERAL DA EXECUÇÃO DO FOMENTO",lines:[`AGRICULTORES CADASTRADOS: ${agricultores.length}`,`VISITAS TÉCNICAS REGISTRADAS: ${visitas.length}`,`EVENTOS / AÇÕES REGISTRADOS: ${eventos.length}`,`TOTAL DE MUDAS ENTREGUES: ${totalMudasEntregues.toLocaleString("pt-BR")}`,`TOTAL DE MUDAS COMPRADAS IDENTIFICADAS: ${totalMudasCompradas?totalMudasCompradas.toLocaleString("pt-BR"):"NÃO IDENTIFICADO"}`,`TOTAL PAGO AOS COLABORADORES: ${totalPagamentosColaboradores.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`,`FICHAS DE VISITA: ${fichasVisita.length}`,`FOTOS SELECIONADAS: ${fotos.length}`,`EXTRATOS BANCÁRIOS: ${extratos.length}`,`NOTAS FISCAIS: ${notas.length}`,`ANEXOS TÉCNICOS: ${anexos.length}`]},
    {heading:"RELAÇÃO DE ARQUIVOS ENVIADOS",lines:arquivos.length?arquivos.map((a,i)=>`${i+1}. ${a.grupo}: ${a.nome} | ARQUIVO REGISTRADO NO SISTEMA`):["NENHUM ARQUIVO ENVIADO NAS COMPETÊNCIAS SELECIONADAS."]},
  ];
  const titulo=`RELATÓRIO GERAL DE PRESTAÇÃO DE CONTAS À ADERES - ${associacao.nome} - ${referencias}`;
  if(url.searchParams.get("formato")==="json")return Response.json({titulo,sections});
  // O PDF principal não abre nem descompacta os binários enviados. Fotos, fichas,
  // notas e extratos permanecem relacionados por nome e contabilizados no corpo.
  // Isso mantém a geração dentro dos limites do plano gratuito do Cloudflare.
  const resultado=await createPdf(titulo,sections);
  return new Response(resultado.buffer.slice(resultado.byteOffset,resultado.byteOffset+resultado.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="prestacao-aderes-${associacao.nome.replace(/[^a-zA-Z0-9_-]/g,"-")}-${identificadorCompetencias}.pdf"`}});
}
