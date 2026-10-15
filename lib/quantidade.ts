const formato=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:6});
export function numeroQuantidade(valor:unknown):number{
 if(typeof valor==="number")return Number.isFinite(valor)?valor:NaN;
 const texto=String(valor??"").trim();
 const achado=texto.match(/^(-?\d[\d.,\s]*)(?:\s*[A-Za-zÀ-ÿ]+\.?)?$/);
 if(!achado)return NaN;
 const parte=achado[1].replace(/\s/g,"");
 const normalizada=parte.includes(".")&&parte.includes(",")?parte.replaceAll(".","").replace(",","."):/^-?\d{1,3}([.,]\d{3})+$/.test(parte)?parte.replace(/[.,]/g,""):parte.replace(",",".");
 const numero=Number(normalizada);return Number.isFinite(numero)?numero:NaN;
}
export function formatarQuantidade(valor:unknown,preservarUnidade=false):string{
 const numero=numeroQuantidade(valor);if(!Number.isFinite(numero))return String(valor??"").trim()||"NÃO INFORMADA";
 const unidade=preservarUnidade?String(valor??"").trim().match(/\s*([A-Za-zÀ-ÿ]+)\.?$/)?.[1]:"";
 return formato.format(numero)+(unidade?` ${unidade.toLocaleUpperCase("pt-BR")}`:"");
}
