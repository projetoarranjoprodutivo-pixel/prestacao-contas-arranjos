import { env } from "cloudflare:workers";
import {
  degrees, drawImage, PDFDict, PDFDocument, PDFName, PDFNumber, PDFObjectCopier,
  PDFPage, PDFRawStream, PDFRef, StandardFonts, rgb,
} from "pdf-lib";

type Registro = { tecnico: string; anexos: { key: string; nome: string; tipo?: string }[] };
type Orcamento = { restante: number };

function* imagensPdf(recursos: PDFDict | undefined, visitados: Set<PDFRawStream>): Generator<PDFRawStream> {
  const objetos = recursos?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!objetos) return;
  for (const [nome] of objetos.entries()) {
    const objeto = objetos.lookupMaybe(nome, PDFRawStream);
    if (!objeto || visitados.has(objeto)) continue;
    visitados.add(objeto);
    const tipo = objeto.dict.get(PDFName.of("Subtype"));
    if (tipo === PDFName.of("Image")) {
      const largura = dimensao(objeto, "Width"), altura = dimensao(objeto, "Height");
      if (largura >= 240 && altura >= 160) yield objeto;
    } else if (tipo === PDFName.of("Form")) {
      yield* imagensPdf(objeto.dict.lookupMaybe(PDFName.of("Resources"), PDFDict), visitados);
    }
  }
}

function dimensao(objeto: PDFRawStream, chave: string) {
  return objeto.dict.lookupMaybe(PDFName.of(chave), PDFNumber)?.asNumber() ?? 0;
}

async function lerAnexo(stream: ReadableStream<Uint8Array>, limite: number) {
  const leitor = stream.getReader();
  const blocos: Uint8Array[] = [];
  let tamanho = 0;
  while (true) {
    const { value, done } = await leitor.read();
    if (done) break;
    tamanho += value.byteLength;
    if (tamanho > limite) {
      await leitor.cancel();
      return null;
    }
    blocos.push(value);
  }
  const bytes = new Uint8Array(tamanho);
  let posicao = 0;
  for (const bloco of blocos) { bytes.set(bloco, posicao); posicao += bloco.length; }
  return bytes;
}

export async function incluirFotosDoTecnico(pdf: PDFDocument, registro: Registro, orcamento: Orcamento) {
  const bucket = env.BUCKET;
  if (!bucket || !registro.anexos.length) return;
  const limiteFotos = 5;
  const fonte = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tecnico = registro.tecnico.toUpperCase().replace(/[^\x20-\x7e\u00a0-\u00ff]/g, " ").slice(0, 75);
  let incluidas = 0;
  let pagina: PDFPage | undefined;

  const desenhar = (ref: PDFRef, largura: number, altura: number) => {
    if (!pagina || incluidas % 2 === 0) {
      pagina = pdf.addPage([595.28, 841.89]);
      pagina.drawText("REGISTROS FOTOGRÁFICOS", { x: 42, y: 790, size: 14, font: fonte, color: rgb(0.02, 0.28, 0.19) });
      pagina.drawText(tecnico, { x: 42, y: 770, size: 10, font: fonte });
    }
    const escala = Math.min(511 / largura, 330 / altura);
    const w = largura * escala, h = altura * escala;
    const nome = pagina.node.newXObject("Foto", ref);
    pagina.pushOperators(...drawImage(nome, {
      x: (595.28 - w) / 2, y: (incluidas % 2 ? 60 : 411) + (330 - h) / 2,
      width: w, height: h, rotate: degrees(0), xSkew: degrees(0), ySkew: degrees(0),
    }));
    incluidas++;
  };

  const anexos = registro.anexos.map(anexo => {
    const nome = String(anexo.nome || "").toLowerCase();
    const imagem = /\.(jpe?g|png)$/.test(nome) || ["image/jpeg", "image/png"].includes(anexo.tipo || "");
    const evidenciaPdf = /(?:anexo|foto|evid[eê]ncia|registro).*\.pdf$/i.test(nome);
    return { anexo, imagem, evidenciaPdf };
  });
  // Prioriza imagens avulsas antes de procurar fotos nos PDFs de evidências.
  anexos.sort((a, b) => Number(b.imagem) - Number(a.imagem));
  for (const { anexo, imagem, evidenciaPdf } of anexos) {
    if (incluidas >= limiteFotos || orcamento.restante <= 0) break;
    if (!anexo.key || (!imagem && !evidenciaPdf)) continue;
    try {
      const stream = await bucket.get(anexo.key, "stream");
      if (!stream) continue;
      const bytes = await lerAnexo(stream, Math.min(8 * 1024 * 1024, orcamento.restante));
      if (!bytes?.length) continue;
      orcamento.restante -= bytes.length;
      if (imagem) {
        const foto = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        desenhar(foto.ref, foto.width, foto.height);
      } else {
        const origem = await PDFDocument.load(bytes);
        const copiar = PDFObjectCopier.for(origem.context, pdf.context);
        const visitados = new Set<PDFRawStream>();
        for (const folha of origem.getPages()) {
          if (incluidas >= limiteFotos) break;
          for (const foto of imagensPdf(folha.node.Resources(), visitados)) {
            if (incluidas >= limiteFotos) break;
            desenhar(pdf.context.register(copiar.copy(foto)), dimensao(foto, "Width"), dimensao(foto, "Height"));
          }
        }
      }
    } catch {
      // O anexo original continua disponível pelo link no relatório.
    }
  }
}
