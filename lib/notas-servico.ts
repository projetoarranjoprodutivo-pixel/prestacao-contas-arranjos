type ColaboradorNota={id:number;nomeCompleto:string;nomeEmpresarial:string|null;mei:string|null;email:string;cargo:string;associacao:string|null;associacoesJson:string};
type DocumentoNota={associacao:string;competencia:string;notasFiscaisJson:string};
type ArquivoNota={nome?:string;descricao?:string};

function normalizar(valor?:string|null){return String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/gi," ").trim().toUpperCase();}

function associacoesDoColaborador(usuario:ColaboradorNota){
  let lista:string[]=[];try{const dados=JSON.parse(usuario.associacoesJson||"[]");if(Array.isArray(dados))lista=dados.filter((item):item is string=>typeof item==="string"&&!!item.trim());}catch{}
  if(!lista.length&&usuario.associacao)lista=[usuario.associacao];return [...new Set(lista)];
}

function arquivos(valor:string){try{const dados=JSON.parse(valor);return Array.isArray(dados)?dados.filter((item):item is ArquivoNota=>!!item&&typeof item==="object"):[];}catch{return [];}}

function tokensIdentificadores(usuario:ColaboradorNota){
  const ignorados=new Set(["DE","DA","DO","DAS","DOS","E","MEI","LTDA","SERVICOS","AGROPECUARIOS","REPRESENTACOES"]);
  return [...new Set([usuario.nomeCompleto,usuario.nomeEmpresarial,usuario.email.split("@")[0]].flatMap(valor=>normalizar(valor).split(" ")).filter(parte=>parte.length>=4&&!ignorados.has(parte)&&!/^\d+$/.test(parte)))];
}

function pertence(nota:ArquivoNota,usuario:ColaboradorNota,usuariosAssociacao:ColaboradorNota[]){
  const texto=normalizar(`${nota.nome||""} ${nota.descricao||""}`);if(!texto)return false;
  const candidatos=[usuario.nomeCompleto,usuario.nomeEmpresarial,usuario.email.split("@")[0]].map(normalizar).filter(Boolean);
  if(candidatos.some(candidato=>{
    if(candidato.length>=5&&texto.includes(candidato))return true;
    const partes=candidato.split(" ").filter(parte=>parte.length>=3);return partes.length>=2&&partes.filter(parte=>texto.includes(parte)).length>=2;
  }))return true;
  const cnpj=String(usuario.mei||"").replace(/\D/g,"");if(cnpj.length>=8&&normalizar(texto).replace(/\D/g,"").includes(cnpj))return true;
  const outrosTokens=new Set(usuariosAssociacao.filter(outro=>outro.id!==usuario.id).flatMap(tokensIdentificadores));
  return tokensIdentificadores(usuario).some(token=>!outrosTokens.has(token)&&texto.includes(token));
}

function ehNotaServico(nota:ArquivoNota){const texto=normalizar(`${nota.nome||""} ${nota.descricao||""}`);return /\bNFS\w*\b|NOTA FISCAL DE SERVICO|PRESTACAO DE SERVICO|SERVICOS TECNICOS|CONSULTORIA|160 H/.test(texto);}

export function listarNotasServicoPendentes(usuarios:ColaboradorNota[],documentos:DocumentoNota[],competencias:string[]){
  const porAssociacaoCompetencia=new Map(documentos.map(item=>[`${item.associacao}|${item.competencia}`,arquivos(item.notasFiscaisJson)]));
  const associacoes=[...new Set(usuarios.flatMap(associacoesDoColaborador))];const pendentes=[];
  for(const associacao of associacoes){
    const vinculados=usuarios.filter(usuario=>associacoesDoColaborador(usuario).includes(associacao));
    for(const competencia of competencias){
      const notas=(porAssociacaoCompetencia.get(`${associacao}|${competencia}`)||[]).filter(ehNotaServico);
      const identificados=vinculados.filter(usuario=>notas.some(nota=>pertence(nota,usuario,vinculados)));
      const semIdentificacao=vinculados.filter(usuario=>!identificados.includes(usuario));
      const notasIdentificadas=notas.filter(nota=>vinculados.some(usuario=>pertence(nota,usuario,vinculados))).length;
      const notasGenericasDisponiveis=Math.max(0,notas.length-notasIdentificadas);
      if(notasGenericasDisponiveis>=semIdentificacao.length)continue;
      for(const usuario of semIdentificacao){pendentes.push({id:usuario.id,nomeCompleto:usuario.nomeCompleto,cargo:usuario.cargo,email:usuario.email,associacao,competencia});}
    }
  }
  return pendentes;
}
