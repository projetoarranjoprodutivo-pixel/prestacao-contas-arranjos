"use client";
import dynamic from "next/dynamic";
const Mapa=dynamic(()=>import("./mapa-projeto"),{ssr:false,loading:()=> <section className="mx-auto w-full max-w-[1600px] px-5 pb-4 lg:min-h-0 lg:px-7"><div role="status" className="grid h-full min-h-64 place-items-center rounded-3xl border bg-white text-sm font-bold text-emerald-900">Carregando mapa dos municípios…</div></section>});
export default function MapaCarregamento(){return <Mapa/>}
