export type NotaClassificavel={categoriaNota?:string;nome?:string;descricao?:string};
export function categoriaDaNota(nota:NotaClassificavel):"servico"|"mudas"|"outras"{
 if(nota.categoriaNota==="servico"||nota.categoriaNota==="mudas"||nota.categoriaNota==="outras")return nota.categoriaNota;
 const texto=`${nota.nome||""} ${nota.descricao||""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
 if(/\bNFS[ -]?E?\b|NOTA FISCAL DE SERVICO|PRESTACAO DE SERVICO|SERVICOS TECNICOS|CONSULTORIA|COORDENACAO TECNICA|GESTAO DO PROJETO|MOBILIZACAO|ASSESSORIA|160\s*H/.test(texto))return "servico";
 if(/\bMUDAS?\b|\bSEMENTES?\b|PLANTULA/.test(texto))return "mudas";
 if(/\bNFS\w*\b|NOTA FISCAL DE SERVICO|PRESTACAO DE SERVICO|SERVICOS TECNICOS|CONSULTORIA|COORDENACAO TECNICA|GESTAO DO PROJETO|MOBILIZACAO|ASSESSORIA|160\s*H/.test(texto))return "servico";
 return "outras";
}
