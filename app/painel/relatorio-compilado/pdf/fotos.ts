import { env } from "cloudflare:workers";
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, StandardFonts, rgb } from "pdf-lib";

type Registro = { tecnico: string; anexos: { key: string; nome: string; tipo?: string }[] };

function temImagem(dict: PDFDict | undefined, visitados = new Set<PDFDict>()): boolean {
  if (!dict || visitados.has(dict)) return false;
  visitados.add(dict);
  const objetos = dict.lookupMaybe(PDFName.of("XObject"), PDFDict);
  return objetos?.entries().some(([chave]) => {
    const objeto = objetos.lookupMaybe(chave, PDFRawStream);
    if (!objeto) return false;
    const tipo = objeto.dict.get(PDFName.of("Subtype"));
    if (tipo === PDFName.of("Image")) {
      const largura = objeto.dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber() ?? 0;
      const altura = objeto.dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber() ?? 0;
      return largura >= 240 && altura >= 160;
    }
    return tipo === PDFName.of("Form") && temImagem(objeto.dict.lookupMaybe(PDFName.of("Resources"), PDFDict), visitados);
  }) ?? false;
}

export async function incluirRegistrosFotograficos(base: Uint8Array, registros: Registro[]) {
  const bucket = env.BUCKET;
  if (!bucket) return base;
  const pdf = await PDFDocument.load(base);
  const fonte = await pdf.embedFont(StandardFonts.HelveticaBold);
  let incluidas = 0, bytesLidos = 0;
  const limiteBytes = 8 * 1024 * 1024;
  const limitePaginas = 18;
  for (const registro of registros) {
    for (const anexo of registro.anexos) {
      if (incluidas >= limitePaginas || bytesLidos >= limiteBytes) break;
      const nome = String(anexo.nome || "").toLowerCase();
      const imagem = /\.(jpe?g|png)$/.test(nome) || ["image/jpeg", "image/png"].includes(anexo.tipo || "");
      const evidenciaPdf = /(?:anexo|foto|evid[eê]ncia|registro).+\.pdf$/i.test(nome);
      if (!anexo.key || (!imagem && !evidenciaPdf)) continue;
      try {
        const stream = await bucket.get(anexo.key, "stream");
        if (!stream) continue;
        const leitor = stream.getReader();
        const blocos: Uint8Array[] = [];
        let tamanho = 0;
        while (true) {
          const { value, done } = await leitor.read();
          if (done) break;
          tamanho += value.byteLength;
          if (bytesLidos + tamanho > limiteBytes) {
            await leitor.cancel();
            blocos.length = 0;
            break;
          }
          blocos.push(value);
        }
        if (!blocos.length) continue;
        bytesLidos += tamanho;
        const bytes = new Uint8Array(tamanho);
        let posicao = 0;
        for (const bloco of blocos) { bytes.set(bloco, posicao); posicao += bloco.length; }

        const paginaFotografica = () => {
          const pagina = pdf.addPage([595.28, 841.89]);
          pagina.drawText("REGISTROS FOTOGRÁFICOS", { x: 42, y: 790, size: 14, font: fonte, color: rgb(0.02, 0.28, 0.19) });
          const tecnico = registro.tecnico.toUpperCase().replace(/[^\x20-\x7e\u00a0-\u00ff]/g, " ").slice(0, 75);
          pagina.drawText(tecnico, { x: 42, y: 770, size: 10, font: fonte });
          return pagina;
        };
        const enquadrar = (largura: number, altura: number) => {
          const escala = Math.min(511 / largura, 705 / altura);
          const w = largura * escala, h = altura * escala;
          return { x: (595.28 - w) / 2, y: 42 + (705 - h) / 2, width: w, height: h };
        };
        if (imagem) {
          const foto = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          paginaFotografica().drawImage(foto, enquadrar(foto.width, foto.height));
          incluidas++;
        } else {
          const origem = await PDFDocument.load(bytes);
          const indices = origem.getPages().flatMap((pagina, indice) => temImagem(pagina.node.Resources()) ? [indice] : [])
            .slice(0, limitePaginas - incluidas);
          if (!indices.length) continue;
          for (const indice of indices) {
            const foto = await pdf.embedPage(origem.getPage(indice));
            paginaFotografica().drawPage(foto, enquadrar(foto.width, foto.height));
            incluidas++;
          }
        }
      } catch {
        // O link do anexo original continua disponível no relatório.
      }
    }
  }
  return incluidas ? pdf.save() : base;
}
