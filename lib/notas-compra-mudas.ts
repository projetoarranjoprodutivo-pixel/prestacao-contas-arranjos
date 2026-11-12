export type NotaCompraMudas = {
  key?: string; nome?: string; descricao?: string; numeroNota?: string; cnpjPrestador?: string;
  chaveNfe?: string; referenciasNfe?: string[]; numeroNotaReferenciada?: string; naturezaOperacao?: string;
};

const normal = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const numero = (s: unknown) => String(s ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
const chave = (s: unknown) => {
  const digitos = String(s ?? "").replace(/[\s.-]/g, "");
  return /^\d{20}55\d{22}$/.test(digitos) ? digitos : "";
};
const chavesNoTexto = (texto: string) => [...new Set(
  [...texto.matchAll(/(?<!\d)(?:\d{44}|\d{4}(?:[ .-]+\d{4}){10})(?!\d)/g)].map(m => chave(m[0])).filter(Boolean),
)];

export function identificarVinculoNfe(texto: string) {
  const principal = texto.split(/INFORMA[CÇ][ÕO]ES COMPLEMENTARES|DADOS ADICIONAIS/i)[0];
  const chaveNfe = chavesNoTexto(principal)[0] || "";
  const referenciasNfe = chaveNfe ? chavesNoTexto(texto).filter(item => item !== chaveNfe) : [];
  const naturezaOperacao = texto.match(/NATUREZA DA OPERA[CÇ][ÃA]O[^\n]*\n\s*([^\n]+)/i)?.[1]
    .split(/\s{3,}/)[0].trim() || "";
  return { chaveNfe, referenciasNfe, naturezaOperacao };
}

type Linha = { associacao: string; competencia: string; arquivo: NotaCompraMudas };
export type SituacaoCompraMudas = "contabilizada" | "remessa-vinculada" | "duplicada" | "conferir-remessa";

export function verificarComprasMudas<T extends Linha>(notas: T[]): Map<T, SituacaoCompraMudas> {
  const situacoes = new Map<T, SituacaoCompraMudas>();
  const identidades = new Set<string>();
  const faturadasPorChave = new Set<string>();
  const faturadasPorNumero = new Map<string, Array<{ faturamento: boolean; emissor: string }>>();
  const preparadas = [...notas].sort((a,b) => a.competencia.localeCompare(b.competencia)).map(linha => {
    const n = linha.arquivo;
    const associacao = normal(linha.associacao).replace(/[^A-Z0-9]/g, "").replace(/^APROVIPA$/, "APPROVIPA");
    const texto = normal([n.naturezaOperacao, n.descricao, n.nome].filter(Boolean).join(" "));
    const acesso = chave(n.chaveNfe) || chavesNoTexto(String(n.nome || ""))[0] || "";
    const num = numero(n.numeroNota || acesso.slice(25,34) || texto.match(/\b(?:VF\s+NF|NF)\s*([\d.]+)/)?.[1]);
    const emissor = acesso.slice(6,20) || numero(n.cnpjPrestador);
    const referencias = Array.isArray(n.referenciasNfe) ? n.referenciasNfe.map(chave).filter(ref => ref && ref !== acesso) : [];
    const refNumero = numero(n.numeroNotaReferenciada || texto.match(/\bREF(?:ERENCIA|ERENTE)?\.?\s*(?:A\s+)?(?:VF|NF-?E?)\s*(?:N[ºO.]?\s*)?([\d.]+)/)?.[1] ||
      texto.match(/ORIGINAD[AO]\s+DE\s+NF-?E?\s*(?:N[ºO.]?\s*)?([\d.]+)/)?.[1]);
    const faturamento = /SIMPLES FAT|\b[56]\.?922\b|\bVF\s+NF\b/.test(texto);
    const remessa = /\bREMESSA\s+(?:NF|.{0,40}ENTREGA FUTURA)|\b[56]\.?11[67]\b|ORIGINAD[AO].{0,45}ENTREGA FUTURA/.test(texto) || !!refNumero;
    const identidade = acesso ? `NFE:${acesso}` : n.key ? `ARQUIVO:${n.key}` : "";
    const duplicada = !!identidade && identidades.has(`${associacao}|${identidade}`);
    if (identidade) identidades.add(`${associacao}|${identidade}`);
    if (!remessa && !duplicada) {
      if (acesso) faturadasPorChave.add(`${associacao}|${acesso}`);
      if (num) {
        const indice = `${associacao}|${num}`;
        faturadasPorNumero.set(indice, [...(faturadasPorNumero.get(indice) || []), { faturamento, emissor }]);
      }
    }
    return { linha, associacao, referencias, refNumero, remessa, duplicada, emissor };
  });
  for (const { linha, associacao, referencias, refNumero, remessa, duplicada, emissor } of preparadas) {
    if (duplicada) { situacoes.set(linha, "duplicada"); continue; }
    if (!remessa) { situacoes.set(linha, "contabilizada"); continue; }
    const porChave = referencias.length > 0 && referencias.every(ref => faturadasPorChave.has(`${associacao}|${ref}`));
    const porNumero = (faturadasPorNumero.get(`${associacao}|${refNumero}`) || []).filter(candidato =>
      emissor && candidato.emissor ? emissor === candidato.emissor : candidato.faturamento);
    situacoes.set(linha, porChave || (!referencias.length && refNumero && porNumero.length === 1)
      ? "remessa-vinculada" : "conferir-remessa");
  }
  return situacoes;
}
