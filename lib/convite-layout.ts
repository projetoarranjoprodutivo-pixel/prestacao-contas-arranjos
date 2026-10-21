// Recorta a área central mantendo a mesma proporção da área de destino.
export function recorteProporcional(sx:number,sy:number,sw:number,sh:number,dw:number,dh:number){
 const escala=Math.max(dw/sw,dh/sh),largura=dw/escala,altura=dh/escala;
 return {x:sx+(sw-largura)/2,y:sy+(sh-altura)/2,largura,altura};
}
