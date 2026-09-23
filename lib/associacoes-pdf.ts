import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type AssociacaoRelatorio = {
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  numero: string | null;
  municipio: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  presidenteNome: string | null;
  presidenteCpf: string | null;
  presidenteCep: string | null;
  presidenteEndereco: string | null;
  presidenteBairro: string | null;
  presidenteNumero: string | null;
  presidenteMunicipio: string | null;
  presidenteUf: string | null;
  presidenteEmail: string | null;
  municipiosJson: string;
  documentosJson: string;
};

type Documento = { nome?: string };

const VERDE = rgb(0.02, 0.28, 0.19);
const VERDE_MEDIO = rgb(0.04, 0.48, 0.32);
const VERDE_CLARO = rgb(0.92, 0.97, 0.94);
const CINZA = rgb(0.34, 0.39, 0.43);
const CINZA_CLARO = rgb(0.96, 0.97, 0.98);
const BORDA = rgb(0.82, 0.86, 0.84);
const PRETO = rgb(0.08, 0.11, 0.13);
const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 42;
const CONTEUDO = LARGURA - MARGEM * 2;

function lista<T>(json: string | null): T[] {
  try { const valor = JSON.parse(json || "[]"); return Array.isArray(valor) ? valor : []; }
  catch { return []; }
}

function informar(valor: string | null | undefined) {
  return (valor?.trim() || "NÃO INFORMADO").toLocaleUpperCase("pt-BR");
}

function formatarNumero(valor: string | null | undefined, tipo: "cnpj" | "cpf" | "cep") {
  const numeros = (valor || "").replace(/\D/g, "");
  if (tipo === "cnpj" && numeros.length === 14) return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (tipo === "cpf" && numeros.length === 11) return numeros.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (tipo === "cep" && numeros.length === 8) return numeros.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return informar(valor);
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number) {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let linha = "";
  for (const palavra of palavras) {
    const candidata = linha ? `${linha} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(candidata, tamanho) <= largura) linha = candidata;
    else {
      if (linha) linhas.push(linha);
      linha = palavra;
    }
  }
  if (linha) linhas.push(linha);
  return linhas.length ? linhas : [""];
}

function desenharTexto(page: PDFPage, linhas: string[], fonte: PDFFont, tamanho: number, x: number, y: number, cor = PRETO, entrelinha = 13) {
  linhas.forEach((linha, indice) => page.drawText(linha, { x, y: y - indice * entrelinha, size: tamanho, font: fonte, color: cor }));
}

export async function gerarPdfAssociacoes(registros: AssociacaoRelatorio[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("RELATÓRIO CADASTRAL DE ASSOCIAÇÕES - ARRANJOS PRODUTIVOS");
  pdf.setAuthor("PROJETO ARRANJOS PRODUTIVOS");
  pdf.setSubject("CADASTRO COMPLETO DAS ASSOCIAÇÕES");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage;
  let y = 0;
  let associacaoAtual = "";
  let indiceAtual = 0;

  function novaPagina(nome: string, indice: number, continuacao = false) {
    page = pdf.addPage([LARGURA, ALTURA]);
    page.drawRectangle({ x: 0, y: ALTURA - 112, width: LARGURA, height: 112, color: VERDE });
    page.drawRectangle({ x: 0, y: ALTURA - 118, width: LARGURA, height: 6, color: VERDE_MEDIO });
    page.drawText("ARRANJOS PRODUTIVOS", { x: MARGEM, y: ALTURA - 38, size: 10, font: bold, color: rgb(0.69, 0.9, 0.79) });
    page.drawText("RELATÓRIO CADASTRAL DE ASSOCIAÇÃO", { x: MARGEM, y: ALTURA - 61, size: 16, font: bold, color: rgb(1, 1, 1) });
    const titulo = informar(nome);
    const tituloLinhas = quebrar(titulo, bold, 12, 405);
    desenharTexto(page, tituloLinhas.slice(0, 2), bold, 12, MARGEM, ALTURA - 86, rgb(1, 1, 1), 14);
    page.drawRectangle({ x: LARGURA - 112, y: ALTURA - 92, width: 70, height: 30, color: VERDE_MEDIO });
    page.drawText(continuacao ? "CONTINUAÇÃO" : `${indice + 1} DE ${registros.length}`, { x: LARGURA - 104, y: ALTURA - 81, size: continuacao ? 7.5 : 9, font: bold, color: rgb(1, 1, 1) });
    y = ALTURA - 148;
  }

  function garantirEspaco(altura: number) {
    if (y - altura < 66) novaPagina(associacaoAtual, indiceAtual, true);
  }

  function tituloSecao(titulo: string) {
    garantirEspaco(34);
    page.drawRectangle({ x: MARGEM, y: y - 22, width: CONTEUDO, height: 25, color: VERDE_CLARO });
    page.drawRectangle({ x: MARGEM, y: y - 22, width: 4, height: 25, color: VERDE_MEDIO });
    page.drawText(titulo, { x: MARGEM + 13, y: y - 14, size: 10, font: bold, color: VERDE });
    y -= 34;
  }

  function campo(rotulo: string, valor: string, largura = CONTEUDO) {
    const linhas = quebrar(informar(valor), regular, 9.5, largura - 22);
    const altura = Math.max(43, 29 + linhas.length * 12);
    garantirEspaco(altura + 8);
    page.drawRectangle({ x: MARGEM, y: y - altura, width: largura, height: altura, color: CINZA_CLARO, borderColor: BORDA, borderWidth: 0.6 });
    page.drawText(rotulo, { x: MARGEM + 11, y: y - 15, size: 7.5, font: bold, color: VERDE_MEDIO });
    desenharTexto(page, linhas, regular, 9.5, MARGEM + 11, y - 31, PRETO, 12);
    y -= altura + 8;
  }

  function linhaCampos(campos: Array<{ rotulo: string; valor: string }>) {
    const intervalo = 8;
    const largura = (CONTEUDO - intervalo * (campos.length - 1)) / campos.length;
    const preparados = campos.map(item => ({ ...item, linhas: quebrar(informar(item.valor), regular, 9.2, largura - 20) }));
    const altura = Math.max(43, 29 + Math.max(...preparados.map(item => item.linhas.length)) * 12);
    garantirEspaco(altura + 8);
    preparados.forEach((item, indice) => {
      const x = MARGEM + indice * (largura + intervalo);
      page.drawRectangle({ x, y: y - altura, width: largura, height: altura, color: CINZA_CLARO, borderColor: BORDA, borderWidth: 0.6 });
      page.drawText(item.rotulo, { x: x + 10, y: y - 15, size: 7.5, font: bold, color: VERDE_MEDIO });
      desenharTexto(page, item.linhas, regular, 9.2, x + 10, y - 31, PRETO, 12);
    });
    y -= altura + 8;
  }

  for (const [indice, associacao] of registros.entries()) {
    associacaoAtual = associacao.nome;
    indiceAtual = indice;
    novaPagina(associacao.nome, indice);
    tituloSecao("IDENTIFICAÇÃO DA ENTIDADE");
    campo("RAZÃO SOCIAL", associacao.razaoSocial || "");
    linhaCampos([
      { rotulo: "NOME ABREVIADO", valor: associacao.nome },
      { rotulo: "CNPJ", valor: formatarNumero(associacao.cnpj, "cnpj") },
    ]);

    tituloSecao("ENDEREÇO E CONTATO");
    campo("ENDEREÇO", `${informar(associacao.endereco)}, N. ${informar(associacao.numero)}`);
    linhaCampos([
      { rotulo: "BAIRRO", valor: associacao.bairro || "" },
      { rotulo: "MUNICÍPIO / UF", valor: `${informar(associacao.municipio)} / ${informar(associacao.uf)}` },
      { rotulo: "CEP", valor: formatarNumero(associacao.cep, "cep") },
    ]);
    linhaCampos([
      { rotulo: "TELEFONE", valor: associacao.telefone || "" },
      { rotulo: "CELULAR", valor: associacao.celular || "" },
      { rotulo: "E-MAIL", valor: associacao.email || "" },
    ]);

    tituloSecao("MUNICÍPIOS ATENDIDOS");
    const municipios = lista<string>(associacao.municipiosJson);
    campo("RELAÇÃO DE MUNICÍPIOS", municipios.length ? municipios.join(" - ") : "NÃO INFORMADOS");

    tituloSecao("DADOS DO PRESIDENTE");
    campo("NOME COMPLETO", associacao.presidenteNome || "");
    linhaCampos([
      { rotulo: "CPF", valor: formatarNumero(associacao.presidenteCpf, "cpf") },
      { rotulo: "E-MAIL", valor: associacao.presidenteEmail || "" },
    ]);
    campo("ENDEREÇO", `${informar(associacao.presidenteEndereco)}, N. ${informar(associacao.presidenteNumero)}`);
    linhaCampos([
      { rotulo: "BAIRRO", valor: associacao.presidenteBairro || "" },
      { rotulo: "MUNICÍPIO / UF", valor: `${informar(associacao.presidenteMunicipio)} / ${informar(associacao.presidenteUf)}` },
      { rotulo: "CEP", valor: formatarNumero(associacao.presidenteCep, "cep") },
    ]);

    tituloSecao("DOCUMENTOS CADASTRADOS");
    const documentos = lista<Documento>(associacao.documentosJson);
    campo("ARQUIVOS", documentos.length ? documentos.map((documento, item) => `${item + 1}. ${informar(documento.nome)}`).join("   |   ") : "NENHUM DOCUMENTO CADASTRADO");
  }

  const paginas = pdf.getPages();
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
  paginas.forEach((pagina, indice) => {
    pagina.drawLine({ start: { x: MARGEM, y: 48 }, end: { x: LARGURA - MARGEM, y: 48 }, color: BORDA, thickness: 0.7 });
    pagina.drawText(`EMITIDO EM ${data}`, { x: MARGEM, y: 31, size: 7.5, font: regular, color: CINZA });
    const textoPagina = `PÁGINA ${indice + 1} DE ${paginas.length}`;
    pagina.drawText(textoPagina, { x: LARGURA - MARGEM - bold.widthOfTextAtSize(textoPagina, 7.5), y: 31, size: 7.5, font: bold, color: VERDE });
  });

  return pdf.save();
}
