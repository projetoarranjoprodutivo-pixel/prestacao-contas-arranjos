import DocumentosAssociacaoForm from "../portal-associacao/documentos-form";

export default function DocumentosAssociacaoAdmin({ associacoes: _associacoes }: { associacoes: string[] }) {
  return <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
    <p className="text-sm font-bold text-emerald-800">INCLUSÃO DE DOCUMENTOS</p>
    <h2 className="mt-1 text-xl font-bold">ENVIAR EXTRATO BANCÁRIO OU NOTA FISCAL</h2>
    <p className="mt-2 text-sm font-semibold text-emerald-950">A ASSOCIAÇÃO E A COMPETÊNCIA SERÃO IDENTIFICADAS AUTOMATICAMENTE EM CADA ARQUIVO ENVIADO.</p>
    <div className="mt-5"><DocumentosAssociacaoForm associacao="" automatico/></div>
  </section>;
}
