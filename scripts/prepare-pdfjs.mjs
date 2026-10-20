import {mkdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const pacote=dirname(require.resolve('pdfjs-dist/package.json'));
const destino=new URL('../public/pdfjs/',import.meta.url);
await mkdir(destino,{recursive:true});
for(const nome of ['pdf.min.mjs','pdf.worker.min.mjs'])await copyFile(join(pacote,'build',nome),new URL(nome,destino));
