type ColaboradorEmail={id:number;nomeCompleto:string;email:string};
export type PendenciaEmail={colaboradorId:number;associacao:string;competencia:string;tipo:"prestacao"|"nota"};
export function emailDePendencias(colaborador:ColaboradorEmail,pendencias:PendenciaEmail[]){
 const email=colaborador.email.trim();
 if(!/^[^\s@,;<>?&#]+@[^\s@,;<>?&#]+\.[^\s@,;<>?&#]+$/.test(email))return null;
 const itens=[...new Map(pendencias.filter(p=>p.colaboradorId===colaborador.id&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(p.competencia)).map(p=>[`${p.tipo}|${p.associacao}|${p.competencia}`,p])).values()];
 if(!itens.length)return null;
 const blocos=(["prestacao","nota"] as const).flatMap(tipo=>{
  const grupo=itens.filter(p=>p.tipo===tipo);if(!grupo.length)return [];
  const associacoes=[...new Set(grupo.map(p=>p.associacao))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  return [(tipo==="prestacao"?"Relatório mensal pendentes:":"Notas fiscais de serviço pendentes:")+"\n"+associacoes.map(a=>"- "+a+": "+grupo.filter(p=>p.associacao===a).map(p=>p.competencia).sort().map(m=>m.slice(5)+"/"+m.slice(0,4)).join(", ")).join("\n")];
 });
 const assunto="Pendências de relatório mensal e notas fiscais - Arranjos Produtivos";
 const mensagem=`Prezado ${colaborador.nomeCompleto}, informamos que consta em nosso sistema as seguintes pendências, solicitamos o envio dos mesmos para o email arranjosprodutivos2026@gmail.com .\n\n${blocos.join("\n\n")}`;
 const gmailComposicao=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`;
 const gmailHref=`https://accounts.google.com/AccountChooser?service=mail&continue=${encodeURIComponent(gmailComposicao)}`;
 return {destinatario:email,assunto,mensagem,gmailHref,href:`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`};
}
