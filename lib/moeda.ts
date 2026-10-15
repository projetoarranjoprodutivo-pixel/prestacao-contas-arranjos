const formato=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
export function numeroMonetario(valor:unknown):number{
 if(typeof valor==="number")return Number.isFinite(valor)?valor:NaN;
 const texto=String(valor??"").replace(/R\$/gi,"").replace(/\s/g,"");
 if(!texto||!/^-?[\d.,]+$/.test(texto))return NaN;
 const normalizado=texto.includes(",")?texto.replaceAll(".","").replace(",","."):/^-?\d{1,3}(\.\d{3})+$/.test(texto)?texto.replaceAll(".",""):texto;
 const numero=Number(normalizado);return Number.isFinite(numero)?numero:NaN;
}
export function formatarMoeda(valor:unknown,vazio="NÃO INFORMADO"):string{const numero=numeroMonetario(valor);return Number.isFinite(numero)?formato.format(numero):vazio;}
export function valorMonetarioDecimal(valor:unknown):string{const numero=numeroMonetario(valor);return Number.isFinite(numero)?String(numero):"";}
