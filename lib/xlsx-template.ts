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

function setCells(sheetXml: string, values: Record<string, CellValue>) {
  const rows = new Map<number, Array<[string, CellValue]>>();
  for (const entry of Object.entries(values)) {
    const rowNumber = Number(entry[0].match(/\d+$/)?.[0]);
    if (!rows.has(rowNumber)) rows.set(rowNumber, []);
    rows.get(rowNumber)!.push(entry);
  }
  const styleSources = new Map<string, string>();
  for (const entries of rows.values()) for (const [reference] of entries) {
    const column = reference.match(/^[A-Z]+/)?.[0] || "A";
    if (!styleSources.has(column)) {
      styleSources.set(column, sheetXml.match(new RegExp(`<c\\b[^>]*\\br="${column}2"[^>]*(?:\\/>|>(?:(?!<c\\b)[\\s\\S])*?<\\/c>)`))?.[0] || "");
    }
  }
  const updateBody = (body: string, entries: Array<[string, CellValue]>) => {
    for (const [reference, value] of entries.sort((a, b) => columnNumber(a[0]) - columnNumber(b[0]))) {
      const cellPattern = new RegExp(`<c\\b[^>]*\\br="${reference}"[^>]*(?:\\/>|>(?:(?!<c\\b)[\\s\\S])*?<\\/c>)`);
      const existing = body.match(cellPattern)?.[0];
      const column = reference.match(/^[A-Z]+/)?.[0] || "A";
      const replacement = cellXml(reference, value, existing || styleSources.get(column) || "");
      if (existing) body = body.replace(cellPattern, replacement);
      else {
        const wantedColumn = columnNumber(reference);
        const cells = [...body.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>(?:(?!<c\b)[\s\S])*?<\/c>)/g)];
        const next = cells.find((cell) => columnNumber(cell[1]) > wantedColumn);
        body = next && next.index !== undefined ? `${body.slice(0, next.index)}${replacement}${body.slice(next.index)}` : `${body}${replacement}`;
      }
    }
    return body;
  };
  sheetXml = sheetXml.replace(/<row\b([^>]*\br="(\d+)"[^>]*)(?:\/>|>([\s\S]*?)<\/row>)/g, (row, attributes: string, rowText: string, body = "") => {
    const rowNumber = Number(rowText);
    const entries = rows.get(rowNumber);
    if (!entries) return row;
    rows.delete(rowNumber);
    return `<row${attributes}>${updateBody(body, entries)}</row>`;
  });
  if (rows.size) {
    const added = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([rowNumber, entries]) =>
      `<row r="${rowNumber}" ht="14.25" customHeight="1">${updateBody("", entries)}</row>`
    ).join("");
    sheetXml = sheetXml.replace("</sheetData>", `${added}</sheetData>`);
  }
  const maxRow = Math.max(1, ...[...Object.keys(values)].map((reference) => Number(reference.match(/\d+$/)?.[0]) || 1));
  return sheetXml.replace(/<dimension ref="A1:([A-Z]+)(\d+)"\/>/, (_match, lastColumn: string, lastRow: string) =>
    `<dimension ref="A1:${lastColumn}${Math.max(Number(lastRow), maxRow)}"/>`
  );
}

function columnLetters(number: number) {
  let result = "";
  for (let current = Math.max(1, number); current > 0; current = Math.floor((current - 1) / 26)) {
    result = String.fromCharCode(((current - 1) % 26) + 65) + result;
  }
  return result;
}

function translateFormula(formula: string, sourceReference: string, targetReference: string) {
  const sourceColumn = columnNumber(sourceReference);
  const targetColumn = columnNumber(targetReference);
  const sourceRow = Number(sourceReference.match(/\d+$/)?.[0] || 1);
  const targetRow = Number(targetReference.match(/\d+$/)?.[0] || 1);
  const columnDelta = targetColumn - sourceColumn;
  const rowDelta = targetRow - sourceRow;
  return formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (_match, fixedColumn: string, letters: string, fixedRow: string, row: string) => {
    const nextColumn = fixedColumn ? columnNumber(letters) : columnNumber(letters) + columnDelta;
    const nextRow = fixedRow ? Number(row) : Number(row) + rowDelta;
    return `${fixedColumn}${columnLetters(nextColumn)}${fixedRow}${Math.max(1, nextRow)}`;
  });
}

// Excel 2010 is especially strict about shared-formula metadata. Expanding the
// template formulas avoids repair warnings after data cells are replaced.
function expandSharedFormulas(sheetXml: string) {
  const masters = new Map<string, { reference: string; formula: string }>();
  return sheetXml.replace(/<c\b([^>]*\br="([A-Z]+\d+)"[^>]*)(?<!\/)>([\s\S]*?)<\/c>/g,
    (cell, attributes: string, reference: string, body: string) => {
      const shared = body.match(/<f\b([^>]*\bt="shared"[^>]*)>([\s\S]*?)<\/f>/);
      if (shared) {
        const index = shared[1].match(/\bsi="(\d+)"/)?.[1];
        if (!index) return cell;
        const formula = shared[2];
        if (formula) masters.set(index, { reference, formula });
        const master = masters.get(index);
        if (!master) return cell;
        const expanded = translateFormula(master.formula, master.reference, reference);
        return `<c${attributes}>${body.replace(shared[0], `<f>${expanded}</f>`)}</c>`;
      }
      const follower = body.match(/<f\b([^>]*\bt="shared"[^>]*)\/>/);
      if (!follower) return cell;
      const index = follower[1].match(/\bsi="(\d+)"/)?.[1];
      const master = index ? masters.get(index) : undefined;
      if (!master) return cell;
      const expanded = translateFormula(master.formula, master.reference, reference);
      return `<c${attributes}>${body.replace(follower[0], `<f>${expanded}</f>`)}</c>`;
    });
}

function enableAutomaticRecalculation(workbookXml: string) {
  const calculation = '<calcPr calcId="0" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>';
  if (/<calcPr\b[^>]*\/>/.test(workbookXml)) return workbookXml.replace(/<calcPr\b[^>]*\/>/, calculation);
  return workbookXml.replace("</workbook>", `${calculation}</workbook>`);
}

export function fillXlsxTemplate(template: Uint8Array, sheets: Record<string, Record<string, CellValue>>) {
  const files = unzipSync(template);
  for (const [sheetPath, values] of Object.entries(sheets)) {
    const original = files[sheetPath];
    if (!original) throw new Error(`Planilha interna não encontrada: ${sheetPath}`);
    let xml = strFromU8(original);
    xml = expandSharedFormulas(setCells(xml, values));
    files[sheetPath] = strToU8(xml);
  }
  // The calculation chain becomes stale whenever template inputs change. It is
  // optional in XLSX files; removing it makes Excel rebuild every formula.
  delete files["xl/calcChain.xml"];
  const relationshipsPath = "xl/_rels/workbook.xml.rels";
  if (files[relationshipsPath]) {
    const relationships = strFromU8(files[relationshipsPath]).replace(
      /<Relationship\b[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/calcChain"[^>]*\/>/g,
      "",
    );
    files[relationshipsPath] = strToU8(relationships);
  }
  const contentTypesPath = "[Content_Types].xml";
  if (files[contentTypesPath]) {
    files[contentTypesPath] = strToU8(strFromU8(files[contentTypesPath]).replace(
      /<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g,
      "",
    ));
  }
  const workbookPath = "xl/workbook.xml";
  if (files[workbookPath]) files[workbookPath] = strToU8(enableAutomaticRecalculation(strFromU8(files[workbookPath])));
  return zipSync(files, { level: 6 });
}

export function excelDate(value: unknown) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || "");
}
