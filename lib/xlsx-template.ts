import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export type CellValue = string | number | null | undefined;

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function columnNumber(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0] || "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function cellXml(reference: string, value: CellValue, previous = "") {
  const opening = previous.match(/^<c\b([^>]*)>/)?.[1] || previous.match(/^<c\b([^>]*)\/>/)?.[1] || ` r="${reference}"`;
  const style = opening.match(/\bs="([^"]+)"/)?.[1];
  const styleAttribute = style ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  const text = escapeXml(String(value ?? ""));
  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function setCell(sheetXml: string, reference: string, value: CellValue) {
  const rowNumber = Number(reference.match(/\d+$/)?.[0]);
  const rowPattern = new RegExp(`<row\\b([^>]*\\br="${rowNumber}"[^>]*)>([\\s\\S]*?)<\\/row>`);
  let rowMatch = sheetXml.match(rowPattern);
  if (!rowMatch) {
    const emptyRowPattern = new RegExp(`<row\\b([^>]*\\br="${rowNumber}"[^>]*)\\/>`);
    const emptyRow = sheetXml.match(emptyRowPattern);
    if (emptyRow) {
      sheetXml = sheetXml.replace(emptyRowPattern, `<row${emptyRow[1]}></row>`);
    } else {
      sheetXml = sheetXml.replace("</sheetData>", `<row r="${rowNumber}" ht="14.25" customHeight="1"></row></sheetData>`);
      sheetXml = sheetXml.replace(/<dimension ref="A1:([A-Z]+)(\d+)"\/>/, (_match, lastColumn: string, lastRow: string) =>
        `<dimension ref="A1:${lastColumn}${Math.max(Number(lastRow), rowNumber)}"/>`
      );
    }
    rowMatch = sheetXml.match(rowPattern);
  }
  if (!rowMatch) return sheetXml;
  const cellPattern = new RegExp(`<c\\b[^>]*\\br="${reference}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  let rowBody = rowMatch[2];
  const existing = rowBody.match(cellPattern)?.[0];
  const column = reference.match(/^[A-Z]+/)?.[0] || "A";
  const styleSource = existing || sheetXml.match(new RegExp(`<c\\b[^>]*\\br="${column}2"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`))?.[0] || "";
  const replacement = cellXml(reference, value, styleSource);
  if (existing) rowBody = rowBody.replace(cellPattern, replacement);
  else {
    const wantedColumn = columnNumber(reference);
    const cells = [...rowBody.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)];
    const next = cells.find((cell) => columnNumber(cell[1]) > wantedColumn);
    rowBody = next && next.index !== undefined ? `${rowBody.slice(0, next.index)}${replacement}${rowBody.slice(next.index)}` : `${rowBody}${replacement}`;
  }
  return sheetXml.replace(rowPattern, `<row${rowMatch[1]}>${rowBody}</row>`);
}

export function fillXlsxTemplate(template: Uint8Array, sheets: Record<string, Record<string, CellValue>>) {
  const files = unzipSync(template);
  for (const [sheetPath, values] of Object.entries(sheets)) {
    const original = files[sheetPath];
    if (!original) throw new Error(`Planilha interna não encontrada: ${sheetPath}`);
    let xml = strFromU8(original);
    for (const [reference, value] of Object.entries(values)) xml = setCell(xml, reference, value);
    files[sheetPath] = strToU8(xml);
  }
  return zipSync(files, { level: 6 });
}

export function excelDate(value: unknown) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || "");
}
