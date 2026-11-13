import { numeroMonetario } from "./moeda";

export type Saida = { data: string; descricao: string; centavos: number };

export function lerSaidas(texto: string, competencia: string) {
  const saidas: Saida[] = [];
  let linhasSemIndicador = 0;
  let data = "";
  for (const linha of texto.split(/\r?\n/)) {
    const cabecalho = linha.match(/^\s*(\d{2})\/(\d{2})(?:\/(\d{4}|\d{2}))?\s+/);
    if (cabecalho) {
      const ano = cabecalho[3];
      data = `${ano?.length === 2 ? "20" + ano : ano || competencia.slice(0, 4)}-${cabecalho[2]}-${cabecalho[1]}`;
    }
    if (!data.startsWith(competencia + "-")) continue;
    const corpo = linha.slice(cabecalho?.[0].length ?? 0).trim();
    if (/^(?:saldo|total|resumo|p.gina|data)\b/i.test(corpo) || !corpo) continue;
    const valores = [...corpo.matchAll(/(?:R\$\s*)?([-−+]?\d[\d.]*,\d{2})(?:\s*([DC+−-])(?=\s|$))?(?=\s|$)/gi)];
    if (!valores.length) continue;
    if (valores.length !== 1) {
      linhasSemIndicador++;
      continue;
    }
    const [valor] = valores;
    const sinal = valor[2]?.toUpperCase();
    if (sinal === "C" || sinal === "+" || valor[1].startsWith("+")) continue;
    if (sinal !== "D" && sinal !== "-" && sinal !== "−" && !/^[-−]/.test(valor[1])) {
      linhasSemIndicador++;
      continue;
    }
    const centavos = Math.round(Math.abs(numeroMonetario(valor[1].replace("−", "-"))) * 100);
    if (centavos > 0) saidas.push({ data, descricao: corpo.slice(0, valor.index).trim(), centavos });
  }
  return { saidas, linhasSemIndicador };
}
