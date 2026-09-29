export type CellValue = string | number | null | undefined;
type ZipEntry = { name: string; bytes: Uint8Array };
const decoder = new TextDecoder(), encoder = new TextEncoder();

function escapeXml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }
function columnNumber(reference: string) { return [...(reference.match(/^[A-Z]+/)?.[0] || "A")].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0); }
function cellXml(reference: string, value: CellValue, previous = "") {
  const opening = previous.match(/^<c\b([^>]*)>/)?.[1] || previous.match(/^<c\b([^>]*)\/>/)?.[1] || ` r="${reference}"`;
  const style = opening.match(/\bs="([^"]+)"/)?.[1], styleAttribute = style ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value ?? ""))}</t></is></c>`;
}
function setCell(sheetXml: string, reference: string, value: CellValue) {
  const rowNumber = Number(reference.match(/\d+$/)?.[0]), rowPattern = new RegExp(`<row\\b([^>]*\\br="${rowNumber}"[^>]*)>([\\s\\S]*?)<\\/row>`), rowMatch = sheetXml.match(rowPattern);
  if (!rowMatch) return sheetXml;
  const cellPattern = new RegExp(`<c\\b[^>]*\\br="${reference}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  let rowBody = rowMatch[2]; const existing = rowBody.match(cellPattern)?.[0], replacement = cellXml(reference, value, existing || "");
  if (existing) rowBody = rowBody.replace(cellPattern, replacement);
  else {
    const wantedColumn = columnNumber(reference), cells = [...rowBody.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)], next = cells.find((cell) => columnNumber(cell[1]) > wantedColumn);
    rowBody = next && next.index !== undefined ? `${rowBody.slice(0, next.index)}${replacement}${rowBody.slice(next.index)}` : `${rowBody}${replacement}`;
  }
  return sheetXml.replace(rowPattern, `<row${rowMatch[1]}>${rowBody}</row>`);
}
async function inflateRaw(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Modelo XLSX inválido.");
  const total = view.getUint16(eocd + 10, true); let cursor = view.getUint32(eocd + 16, true); const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < total; index++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Diretório XLSX inválido.");
    const method = view.getUint16(cursor + 10, true), compressedSize = view.getUint32(cursor + 20, true), nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true), localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)), localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true), dataStart = localOffset + 30 + localNameLength + localExtraLength, compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    if (method !== 0 && method !== 8) throw new Error("Compressão XLSX não suportada.");
    entries.set(name, { name, bytes: method === 0 ? compressed.slice() : await inflateRaw(compressed) }); cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function zip(entries: Map<string, ZipEntry>) {
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = []; let offset = 0;
  for (const entry of entries.values()) {
    const name = encoder.encode(entry.name), data = entry.bytes, crc = crc32(data), local = new Uint8Array(30 + name.length + data.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true); local.set(name, 30); local.set(data, 30 + name.length); locals.push(local);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer); cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer); ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.size, true); ev.setUint16(10, entries.size, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + 22); let position = 0; for (const item of [...locals, ...centrals, end]) { result.set(item, position); position += item.length; } return result;
}
export async function fillXlsxTemplate(template: Uint8Array, sheets: Record<string, Record<string, CellValue>>) {
  const files = await unzip(template);
  for (const [sheetPath, values] of Object.entries(sheets)) { const original = files.get(sheetPath); if (!original) throw new Error(`Planilha interna não encontrada: ${sheetPath}`); let xml = decoder.decode(original.bytes); for (const [reference, value] of Object.entries(values)) xml = setCell(xml, reference, value); original.bytes = encoder.encode(xml); }
  return zip(files);
}
export function excelDate(value: unknown) { const parts = String(value || "").split("-"); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || ""); }
