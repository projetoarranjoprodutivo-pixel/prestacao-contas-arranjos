import {chaveMunicipio, mapaAssociacoesPorMunicipio} from "@/lib/associacoes-municipios";
export type MunicipioMapa={nome:string;associacoes:string[];tecnicos:string[];quantidadeTecnicos:number;atendimentos:number;cadastrados:number;produtores:number;mudas:number;tiposMudas:Record<string,number>;eventos:number;ultimaCompetencia:string};
export function tecnicoCampoAtivo(u:{cargo:string;dataSaida:string|null}){return /t[eé]cnico.*campo/i.test(u.cargo)&&(!u.dataSaida||u.dataSaida>=new Date().toISOString().slice(0,10));}
export function consolidarMapa(associacoes:Array<{nome:string;municipiosJson:string|null}>,usuarios:Array<{authUserId:string;nomeCompleto:string;cargo:string;municipiosAtendidosJson:string;dataSaida:string|null}>,atividades:Array<{usuario:string;municipio:string;tipo:string;produtor:string;quantidade:number;tipoMuda:string;competencia:string;executada:boolean}>,cadastros:Array<{nome:string;municipio:string}>=[]){
 const chaves=new Map<string,string>();const chaveRapida=(valor:string)=>{let chave=chaves.get(valor);if(chave===undefined){chave=chaveMunicipio(valor);chaves.set(valor,chave);}return chave;};
 const cobertura=mapaAssociacoesPorMunicipio(associacoes);const mapa=new Map<string,MunicipioMapa>();const produtores=new Map<string,Set<string>>();
 for(const [nome,associacao] of cobertura)mapa.set(nome,{nome,associacoes:[associacao],tecnicos:[],quantidadeTecnicos:0,atendimentos:0,cadastrados:0,produtores:0,mudas:0,tiposMudas:{},eventos:0,ultimaCompetencia:""});
 if(!mapa.has("BARRA DE SAO FRANCISCO"))mapa.set("BARRA DE SAO FRANCISCO",{nome:"BARRA DE SÃO FRANCISCO",associacoes:[],tecnicos:[],quantidadeTecnicos:0,atendimentos:0,cadastrados:0,produtores:0,mudas:0,tiposMudas:{},eventos:0,ultimaCompetencia:""});
 const cadastrados=new Map<string,Set<string>>();
 for(const c of cadastros){const chave=chaveRapida(c.municipio);if(!mapa.has(chave)||!c.nome?.trim())continue;const nomes=cadastrados.get(chave)||new Set<string>();nomes.add(chaveRapida(c.nome));cadastrados.set(chave,nomes);}
 for(const [chave,m] of mapa)m.cadastrados=cadastrados.get(chave)?.size||0;
 const tecnicosPorMunicipio=new Map<string,Set<string>>();
 for(const u of usuarios){if(!tecnicoCampoAtivo(u))continue;let municipios:string[]=[];try{municipios=JSON.parse(u.municipiosAtendidosJson||"[]")}catch{}for(const nome of municipios){const chave=chaveMunicipio(nome),m=mapa.get(chave);if(!m)continue;const ids=tecnicosPorMunicipio.get(chave)||new Set<string>();ids.add(u.authUserId);tecnicosPorMunicipio.set(chave,ids);if(!m.tecnicos.includes(u.nomeCompleto))m.tecnicos.push(u.nomeCompleto);m.quantidadeTecnicos=ids.size;}}

 for(const a of atividades){if(!a.executada)continue;const chave=chaveRapida(a.municipio),m=mapa.get(chave);if(!m)continue;const tipo=chaveMunicipio(a.tipo);m.ultimaCompetencia=m.ultimaCompetencia>a.competencia?m.ultimaCompetencia:a.competencia;
 if(tipo==="VISITA TECNICA"){m.atendimentos++;if(a.produtor?.trim()&&!/^(NAO INFORMAD[OA]|DIVERSOS|NAO IDENTIFICAD[OA])$/.test(chaveMunicipio(a.produtor))){const nomes=produtores.get(chave)||new Set<string>();nomes.add(chaveMunicipio(a.produtor));produtores.set(chave,nomes);}}
 else if(tipo==="ENTREGA DE MUDAS"){const q=Number(a.quantidade)||0;if(q>0){m.mudas+=q;const t=a.tipoMuda||"TIPO NÃO INFORMADO";m.tiposMudas[t]=(m.tiposMudas[t]||0)+q;}}
 else m.eventos++;
 }
 for(const [chave,m] of mapa)m.produtores=produtores.get(chave)?.size||0;
 return [...mapa.values()];
}
