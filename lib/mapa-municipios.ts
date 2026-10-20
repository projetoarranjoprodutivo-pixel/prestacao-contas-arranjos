import {chaveMunicipio, mapaAssociacoesPorMunicipio} from "@/lib/associacoes-municipios";
export type MunicipioMapa={nome:string;associacoes:string[];tecnicos:string[];atendimentos:number;produtores:number;mudas:number;tiposMudas:Record<string,number>;eventos:number;ultimaCompetencia:string};
export function consolidarMapa(associacoes:Array<{nome:string;municipiosJson:string|null}>,usuarios:Array<{authUserId:string;nomeCompleto:string;cargo:string;municipiosAtendidosJson:string;dataSaida:string|null}>,atividades:Array<{usuario:string;municipio:string;tipo:string;produtor:string;quantidade:number;tipoMuda:string;competencia:string;executada:boolean}>){
 const cobertura=mapaAssociacoesPorMunicipio(associacoes);const mapa=new Map<string,MunicipioMapa>();const produtores=new Map<string,Set<string>>();
 for(const [nome,associacao] of cobertura)mapa.set(nome,{nome,associacoes:[associacao],tecnicos:[],atendimentos:0,produtores:0,mudas:0,tiposMudas:{},eventos:0,ultimaCompetencia:""});
 for(const u of usuarios){if(u.dataSaida && u.dataSaida<new Date().toISOString().slice(0,10))continue;if(!/t[eé]cnico.*campo/i.test(u.cargo))continue;let municipios:string[]=[];try{municipios=JSON.parse(u.municipiosAtendidosJson||"[]")}catch{}for(const nome of municipios){const m=mapa.get(chaveMunicipio(nome));if(m&&!m.tecnicos.includes(u.nomeCompleto))m.tecnicos.push(u.nomeCompleto);}}
 for(const a of atividades){if(!a.executada)continue;const chave=chaveMunicipio(a.municipio),m=mapa.get(chave);if(!m)continue;const tipo=chaveMunicipio(a.tipo);m.ultimaCompetencia=m.ultimaCompetencia>a.competencia?m.ultimaCompetencia:a.competencia;
 if(tipo==="VISITA TECNICA"){m.atendimentos++;if(a.produtor?.trim()&&!/^(NAO INFORMAD[OA]|DIVERSOS|NAO IDENTIFICAD[OA])$/.test(chaveMunicipio(a.produtor))){const nomes=produtores.get(chave)||new Set<string>();nomes.add(chaveMunicipio(a.produtor));produtores.set(chave,nomes);}}
 else if(tipo==="ENTREGA DE MUDAS"){const q=Number(a.quantidade)||0;if(q>0){m.mudas+=q;const t=a.tipoMuda||"TIPO NÃO INFORMADO";m.tiposMudas[t]=(m.tiposMudas[t]||0)+q;}}
 else m.eventos++;
 }
 for(const [chave,m] of mapa)m.produtores=produtores.get(chave)?.size||0;
 return [...mapa.values()];
}
