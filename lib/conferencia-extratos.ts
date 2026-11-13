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
