// Identificação leve para relatórios narrativos, sem carregar validadores de importação nos PDFs.
const normalizarNome=(nome:string)=>nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
export function relatorioNarrativoDouglas(pessoa:{nomeCompleto?:string;email?:string}){return ["doglasgasparetto86@gmail.com","dria.sic1302@gmail.com","alealbergaria@gmail.com"].includes(pessoa.email?.trim().toLowerCase()||"")||["DOUGLASGASPARETTO","ANDREIAHABERLYSIQUEIRA","CRISLANEWANDERMAASKRETTLINERY","IVANPEREIRANERY","ALESSANDRAVASCONCELOSALBERGARIA"].includes(normalizarNome(pessoa.nomeCompleto||""));}

export const MINUTOS_DIAGNOSTICO_AGROINDUSTRIA = 160 * 60;

export function consultorDeAgroindustria(cargo: string) {
  return /^CONSULTOR(?:A)?(?:DE)?AGROINDUSTRIA$/.test(normalizarNome(cargo));
}

export function identificarDiagnosticoAgroindustria(texto: string, arquivo = "") {
  const cabecalho = texto.slice(0, 5000);
  const normalizado = cabecalho.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!/RELATORIO\s+(?:DE\s+)?DIAGNOSTICO/i.test(normalizado) || !/agroindustria/i.test(normalizado)) return null;

  const periodo = normalizado.match(/periodo\s+de\s+referencia\s*:\s*(\w+)\s+de\s+(\d{4})/i);
  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mes = periodo ? meses.indexOf(periodo[1].toLowerCase()) + 1 : 0;
  const palavrasArquivo = arquivo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z]+/);
  const mesesArquivo = meses.filter(nome => palavrasArquivo.includes(nome));
  const divergencia = mes > 0 && mesesArquivo.length === 1 && mesesArquivo[0] !== meses[mes - 1];
  return {
    competencia: mes && periodo && !divergencia ? `${periodo[2]}-${String(mes).padStart(2, "0")}` : "",
    aviso: divergencia ? `O nome do arquivo indica ${mesesArquivo[0]}, mas o relatório informa ${periodo?.[1]}. Confira o original antes de selecionar a competência.` : "",
    nomeCompleto: cabecalho.match(/consultor(?:a)?\s+respons[aá]vel\s*:\s*([^\n]+)/i)?.[1].trim() || "",
    cnpj: normalizado.match(/CPF\s*\/\s*CNPJ\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i)?.[1].replace(/\D/g, "") || "",
  };
}
