"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Eraser, PenLine, X } from "lucide-react";
export default function AssinaturaCanvas({
  titulo,
  valor,
  onChange,
}: {
  titulo: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto || !canvas.current) return;
    const c = canvas.current,
      ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    if (valor) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = valor;
    }
  }, [aberto, valor]);
  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget,
      r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  }
  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const p = ponto(e),
      ctx = e.currentTarget.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const p = ponto(e),
      ctx = e.currentTarget.getContext("2d");
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
  }
  function terminar(e: React.PointerEvent<HTMLCanvasElement>) {
    desenhando.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }
  function limpar() {
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  function confirmar() {
    const c = canvas.current;
    if (!c) return;
    onChange(c.toDataURL("image/jpeg", 0.72));
    setAberto(false);
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">{titulo}</p>
          <p
            className={`text-xs ${valor ? "text-emerald-700" : "text-slate-500"}`}
          >
            {valor ? "Assinatura registrada" : "Ainda não assinada"}
          </p>
        </div>
        <div className="flex gap-2">
          {valor && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
            >
              Remover
            </button>
          )}
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#176344] px-4 py-2 text-sm font-bold text-white"
          >
            <PenLine className="h-4 w-4" />
            {valor ? "Assinar novamente" : "Assinar na tela"}
          </button>
        </div>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{titulo}</h3>
                <p className="text-sm text-slate-600">
                  Assine com o dedo ou uma caneta digital.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <canvas
              ref={canvas}
              width={640}
              height={220}
              onPointerDown={iniciar}
              onPointerMove={mover}
              onPointerUp={terminar}
              onPointerCancel={terminar}
              className="mt-4 h-48 w-full touch-none rounded-xl border-2 border-slate-300 bg-white"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={limpar}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-bold"
              >
                <Eraser className="h-4 w-4" />
                Limpar
              </button>
              <button
                type="button"
                onClick={confirmar}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#176344] px-4 py-3 font-bold text-white"
              >
                <Check className="h-4 w-4" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
