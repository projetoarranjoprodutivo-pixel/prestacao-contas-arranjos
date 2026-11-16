import { numeroMonetario } from "./moeda";

export type Saida = { data: string; descricao: string; centavos: number };

const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function lerSaidas(texto: string, inicio: string, fim = inicio) {
  const saidas: Saida[] = [];
  let linhasSemIndicador = 0;
  let competenciaPagina = "";
  let data = "";
  for (const linha of texto.split(/\r?\n/)) {
    if (/^\[PÁGINA \d+\]/.test(linha)) {
      competenciaPagina = "";
      data = "";
      continue;
    }
    const periodo = linha.match(/per[ií]odo\s*:?\s*\d{2}\/(\d{2})\/(\d{4})/i);
    if (periodo) competenciaPagina = `${periodo[2]}-${periodo[1]}`;
    if (/^\s*data\s+lan[cç]amento/i.test(linha)) continue;
    const cabecalho = linha.match(/^\s*(\d{2})\/(\d{2})(?:\/(\d{4}|\d{2}))?\s+/);
    const diaBanestes = !cabecalho && competenciaPagina ? linha.match(/^\s*(\d{1,2})(?=\s{2,}|\t|$)\s*/) : null;
    const mesBanestes = linha.match(/^\s*([A-Z]{3})\/(\d{2})(?=\s|$)\s*/i);
    const corpo = linha.slice(cabecalho?.[0].length ?? diaBanestes?.[0].length ?? mesBanestes?.[0].length ?? 0).trim();
    if (cabecalho) {
      const ano = cabecalho[3];
      data = `${ano?.length === 2 ? "20" + ano : ano || competenciaPagina.slice(0, 4) || inicio.slice(0, 4)}-${cabecalho[2]}-${cabecalho[1]}`;
    } else if (diaBanestes) {
      data = `${competenciaPagina}-${diaBanestes[1].padStart(2, "0")}`;
    } else if (mesBanestes && data) {
      const mes = meses.indexOf(mesBanestes[1].toUpperCase());
      if (mes >= 0) data = `20${mesBanestes[2]}-${String(mes + 1).padStart(2, "0")}-${data.slice(-2)}`;
    }
    if (!corpo || /^(?:saldo\w*|total|resumo|p.gina|data|per[ií]odo)\b/i.test(corpo)) continue;

    // O Banestes inclui a data e a hora do PIX dentro do histórico.
    const dataPix = corpo.match(/\b(\d{2})\/(\d{2})\/(\d{4})(?=[\s:-]+\d{2}:\d{2})/);
    const dataSaida = dataPix ? `${dataPix[3]}-${dataPix[2]}-${dataPix[1]}` : data;
    const mes = dataSaida.slice(0, 7);
    if (!mes || mes < inicio || mes > fim) continue;

    const valores = [...corpo.matchAll(/(?:R\$\s*)?([−+-])?\s*(\d[\d.]*,\d{2})(?:\s*([DC+−-])(?=\s|$))?(?=\s|$)/gi)];
    if (!valores.length) continue;
    if (valores.length !== 1) {
      linhasSemIndicador++;
      continue;
    }
    const [valor] = valores;
    const sinal = valor[3]?.toUpperCase() || valor[1];
    if (sinal === "C" || sinal === "+" || /^\s*[↑↗]/.test(corpo)) continue;
    const descricao = corpo.slice(0, valor.index).trim();
    if (sinal !== "D" && sinal !== "-" && sinal !== "−" && !/^[↓↘]|^PIX ENVIADO\b/i.test(descricao)) {
      linhasSemIndicador++;
      continue;
    }
    const centavos = Math.round(numeroMonetario(valor[2]) * 100);
    if (centavos > 0) saidas.push({ data: dataSaida, descricao, centavos });
  }
  return { saidas, linhasSemIndicador };
}

export type NotaConciliacao = {
  key: string;
  nome: string;
  prestador: string;
  cnpjPrestador?: string;
  competencia: string;
  centavos: number | null;
};

type Situacao = "vinculada" | "revisar" | "sem-identificacao" | "sem-valor";

const termosIgnorados = new Set([
  "DA", "DAS", "DE", "DO", "DOS", "E", "LTDA", "MEI", "ME", "EPP", "PDF",
  "NOTA", "FISCAL", "NF", "NFE", "NFSE", "SERVICO", "SERVICOS", "COMPETENCIA",
  "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO",
  "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
]);

function termosIdentidade(texto: string) {
  return texto.replace(/\S+@\S+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().match(/[A-Z]+/g)?.filter(termo => termo.length > 1 && !termosIgnorados.has(termo)) ?? [];
}

function temNome(termos: string[], historico: string) {
  return termos.length >= 2 && historico.includes(` ${termos.join(" ")} `);
}

export function conciliarSaidas<T extends NotaConciliacao>(saidas: Saida[], notas: T[]) {
  const porValor = new Map<number, Array<{ nota: T; nome: string[]; arquivo: string[]; documento: string }>>();
  for (const nota of notas) {
    if (nota.centavos === null) continue;
    const grupo = porValor.get(nota.centavos) ?? [];
    grupo.push({
      nota,
      nome: termosIdentidade(nota.prestador),
      arquivo: termosIdentidade(nota.nome),
      documento: (nota.cnpjPrestador || "").replace(/\D/g, ""),
    });
    porValor.set(nota.centavos, grupo);
  }

  const pedidos = new Map<string, number>();
  const sugestoes = saidas.map(saida => {
    const grupo = porValor.get(saida.centavos) ?? [];
    const historico = ` ${termosIdentidade(saida.descricao).join(" ")} `;
    const documentos = [...saida.descricao.matchAll(/\b(?:\d{2}\.\d{3}\.\d{3}(?:\/\d{4}-\d{2})?|\d{3}\.\d{3}\.\d{3}-\d{2})\b/g)]
      .map(([valor]) => valor.replace(/\D/g, ""));
    const temIdentidade = grupo.flatMap(({nota, nome, arquivo, documento}) => {
      const identificador = documentos.some(valor => documento === valor || (valor.length === 8 && documento.length === 14 && documento.startsWith(valor)));
      const documentoConflitante = documento.length === 14 && documentos.some(valor => valor.length === 8 || valor.length === 14) && !identificador;
      if (documentoConflitante) return [];
      const pontos = identificador ? 3 : temNome(nome, historico) ? 2 : !nome.length && temNome(arquivo, historico) ? 1 : 0;
      return pontos ? [{nota, pontos}] : [];
    });
    const competencia = saida.data.slice(0, 7);
    const doMes = temIdentidade.filter(({nota}) => nota.competencia === competencia);
    const opcoes = doMes.length ? doMes : temIdentidade;
    const melhor = Math.max(0, ...opcoes.map(({pontos}) => pontos));
    const candidatas = opcoes.filter(({pontos}) => pontos === melhor).map(({nota}) => nota);
    for (const nota of candidatas) pedidos.set(nota.key, (pedidos.get(nota.key) ?? 0) + 1);
    return {candidatas, mesmoMes: doMes.length > 0, temMesmoValor: grupo.length > 0};
  });

  const vinculadas = new Set<string>();
  const paraRevisar = new Set<string>();
  const lancamentos = sugestoes.map(({candidatas, mesmoMes, temMesmoValor}) => {
    const primeira = candidatas[0];
    let situacao: Situacao = temMesmoValor ? "sem-identificacao" : "sem-valor";
    if (primeira && candidatas.length === 1 && mesmoMes && pedidos.get(primeira.key) === 1) {
      situacao = "vinculada";
      vinculadas.add(primeira.key);
    } else if (primeira) {
      situacao = "revisar";
      for (const nota of candidatas) paraRevisar.add(nota.key);
    }
    return {situacao, candidatas, mesmoMes};
  });
  return {lancamentos, vinculadas, paraRevisar};
}
