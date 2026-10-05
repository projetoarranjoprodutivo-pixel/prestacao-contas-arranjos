type ColaboradorNota={id:number;nomeCompleto:string;nomeEmpresarial:string|null;email:string;cargo:string;associacao:string|null;associacoesJson:string};
type DocumentoNota={associacao:string;competencia:string;notasFiscaisJson:string};
type ArquivoNota={nome?:string;descricao?:string};

function normalizar(valor?:string|null){return String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/gi," ").trim().toUpperCase();}

function associacoesDoColaborador(usuario:ColaboradorNota){
  let lista:string[]=[];try{const dados=JSON.parse(usuario.associacoesJson||"[]");if(Array.isArray(dados))lista=dados.filter((item):item is string=>typeof item==="string"&&!!item.trim());}catch{}
  if(!lista.length&&usuario.associacao)lista=[usuario.associacao];return [...new Set(lista)];
}

function arquivos(valor:string){try{const dados=JSON.parse(valor);return Array.isArray(dados)?dados.filter((item):item is ArquivoNota=>!!item&&typeof item==="object"):[];}catch{return [];}}

function pertence(nota:ArquivoNota,usuario:ColaboradorNota){
  const texto=normalizar(`${nota.nome||""} ${nota.descricao||""}`);if(!texto)return false;
  const candidatos=[usuario.nomeCompleto,usuario.nomeEmpresarial,usuario.email.split("@")[0]].map(normalizar).filter(Boolean);
  return candidatos.some(candidato=>{
    if(candidato.length>=5&&texto.includes(candidato))return true;
    const partes=candidato.split(" ").filter(parte=>parte.length>=3);return partes.length>=2&&partes.filter(parte=>texto.includes(parte)).length>=2;
  });
}

export function listarNotasServicoPendentes(usuarios:ColaboradorNota[],documentos:DocumentoNota[],competencias:string[]){
  const porAssociacaoCompetencia=new Map(documentos.map(item=>[`${item.associacao}|${item.competencia}`,arquivos(item.notasFiscaisJson)]));
  return usuarios.flatMap(usuario=>associacoesDoColaborador(usuario).flatMap(associacao=>competencias.filter(competencia=>{
    const notas=porAssociacaoCompetencia.get(`${associacao}|${competencia}`)||[];return !notas.some(nota=>pertence(nota,usuario));
  }).map(competencia=>({id:usuario.id,nomeCompleto:usuario.nomeCompleto,cargo:usuario.cargo,email:usuario.email,associacao,competencia}))));
}
