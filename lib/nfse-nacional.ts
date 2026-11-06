export function identificarPrestador(conteudo:string){
 const trecho=conteudo.split(/PRESTADOR\s*\/\s*FORNECEDOR|EMITENTE DA NFS-e/i).slice(1).join(" ").split(/TOMADOR\s*\/|DESTINATARIO|DESTINATÁRIO/i)[0]||"";
 const cnpjPrestador=trecho.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0]||"";
 const prestador=trecho.match(/Nome\s*\/\s*Nome Empresarial\s*\n([^\n]+)/i)?.[1]?.trim()||"";
 return {prestador,cnpjPrestador};
}
export function lerNfseNacional(conteudo:string) {
 const texto=conteudo.replace(/NFS\s*-\s*e/gi,"NFS-e");
 if(!/DANFSe|Documento\s+Auxiliar\s+da\s+NFS-e/i.test(texto))return null;
 const cabecalho=texto.match(/N[ÚU]MERO DA NFS-e[^\n]*\n\s*(\d{1,15})\s+(\d{2}\/\d{2}\/20\d{2})\s+(\d{2}\/\d{2}\/20\d{2})/i);
 const verticalNumero=texto.match(/N[ÚU]MERO DA NFS-e\s*\n\s*(\d{1,15})/i)?.[1];
 const verticalCompetencia=texto.match(/COMPET[ÊE]NCIA DA NFS-e\s*\n\s*(\d{2}\/\d{2}\/20\d{2})/i)?.[1];
 const verticalEmissao=texto.match(/DATA E HORA DA EMISS[ÃA]O DA NFS-e\s*\n\s*(\d{2}\/\d{2}\/20\d{2})/i)?.[1];
 const numeroNota=cabecalho?.[1]||verticalNumero, dataCompetencia=cabecalho?.[2]||verticalCompetencia, emissao=cabecalho?.[3]||verticalEmissao;
 if(!numeroNota||!dataCompetencia||!emissao)return null;
 const iso=(valor:string)=>{const [dia,mes,ano]=valor.split("/");const data=`${ano}-${mes}-${dia}`;const parsed=new Date(data+"T00:00:00Z");return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===data?data:"";};
 const dataEmissao=iso(emissao),competencia=iso(dataCompetencia).slice(0,7);
 const trecho=texto.split(/Descri[çc][ãa]o do Servi[çc]o/i).slice(1).join(" ").split(/(?:Tipo de Tributa[çc][ãa]o|TRIBUTA[ÇC][ÃA]O MUNICIPAL)/i)[0]||"";
 const descricao=trecho.replace(/\s+/g," ").trim();
 // O total da operação precede retenções e impostos: nunca usar o maior
 // número encontrado na página nem o total de IBS/CBS.
 const total=texto.match(/VALOR TOTAL DA NFS-e[\s\S]{0,300}?R\$\s*([\d.]+,\d{2})/i)?.[1];
 const valor=total?Number(total.replace(/\./g,"").replace(",",".")).toFixed(2):"";
 const quantidade=descricao.match(/\b(\d+(?:[.,]\d+)?)\s*horas?\b/i)?.[1].replace(",",".")||"";
 const meses:Record<string,string>={JANEIRO:"01",FEVEREIRO:"02",MARCO:"03",ABRIL:"04",MAIO:"05",JUNHO:"06",JULHO:"07",AGOSTO:"08",SETEMBRO:"09",OUTUBRO:"10",NOVEMBRO:"11",DEZEMBRO:"12"};
 const referencia=descricao.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().match(/COMPETENCIA\s+([A-Z]+)\s*[\/-]\s*(20\d{2})/);
 const competenciaDescricao=referencia&&meses[referencia[1]]?`${referencia[2]}-${meses[referencia[1]]}`:"";
 const aviso=competenciaDescricao&&competenciaDescricao!==competencia?`A DESCRIÇÃO MENCIONA ${competenciaDescricao}, MAS O CABEÇALHO INFORMA ${competencia}. CONFIRA A COMPETÊNCIA ANTES DE SALVAR.`:"";
 if(!dataEmissao||!competencia||!descricao||!(Number(valor)>0))return null;
 return {...identificarPrestador(texto),origemLeitura:"conteudo",competenciaDocumento:competencia,competenciaDescricao,numeroNota,descricao,quantidade,valor,dataEmissao,competencia,aviso};
}
