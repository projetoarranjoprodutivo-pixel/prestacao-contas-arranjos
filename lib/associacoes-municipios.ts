export const MUNICIPIOS_POR_ASSOCIACAO:ReadonlyArray<readonly [string,readonly string[]]>=[
  ["AAFAIAR",["ALTO RIO NOVO","MANTENÓPOLIS"]],
  ["AAFAMA",["PANCAS","ÁGUIA BRANCA"]],
  ["AAFARSCRUZ",["GUAÇUÍ","ALEGRE","JERÔNIMO MONTEIRO"]],
  ["AAFATRIM",["PEDRO CANÁRIO","MONTANHA"]],
  ["APEAGRI",["ITAPEMIRIM","PIÚMA","RIO NOVO DO SUL","ICONHA"]],
  ["APROFASAUNA",["IBIRAÇU","JOÃO NEIVA"]],
  ["APROVIPA",["VILA PAVÃO","ECOPORANGA","NOVA VENÉCIA"]],
  ["APRUVAB",["ANCHIETA","GUARAPARI","ALFREDO CHAVES"]],
  ["APRVG",["BREJETUBA","CONCEIÇÃO DO CASTELO","IBATIBA"]],
  ["ARQSCD",["CONCEIÇÃO DA BARRA","BOA ESPERANÇA","JAGUARÉ"]],
  ["CAF COLATINA",["VILA VALÉRIO","SÃO DOMINGOS DO NORTE","COLATINA","MARILÂNDIA"]],
  ["MUNIZ CAF",["MUNIZ FREIRE","IÚNA","IBITIRAMA","DIVINO DE SÃO LOURENÇO"]],
  ["NEEMIAS",["ATÍLIO VIVÁCQUA"]],
];

export function chaveMunicipio(valor:unknown){
  return String(valor??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleUpperCase("pt-BR");
}

export function mapaAssociacoesPorMunicipio(cadastradas?:Array<{nome:string;municipiosJson?:string|null}>){
  const mapa=new Map<string,string>();
  for(const [associacao,municipios] of MUNICIPIOS_POR_ASSOCIACAO)for(const municipio of municipios)mapa.set(chaveMunicipio(municipio),associacao);
  for(const associacao of cadastradas||[]){
    let municipios:string[]=[];
    try{const dados=JSON.parse(associacao.municipiosJson||"[]");if(Array.isArray(dados))municipios=dados.map(String);}catch{}
    for(const municipio of municipios)mapa.set(chaveMunicipio(municipio),associacao.nome);
  }
  return mapa;
}
