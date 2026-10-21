import {redirect} from 'next/navigation';
import {getAdminUser} from '@/lib/admin';
import './agenda.css';
import AgendaClient from './agenda-client';
export const dynamic='force-dynamic';
export default async function Agenda(){if(!await getAdminUser())redirect('/');return <main className="agenda-page min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-7"><div className="mx-auto max-w-7xl"><a href="/admin" className="text-sm font-bold text-emerald-800">← VOLTAR AO PAINEL</a><p className="mt-5 text-xs font-black tracking-widest text-emerald-800">ACOMPANHAMENTO · ARRANJOS PRODUTIVOS</p><h1 className="mt-2 text-3xl font-black">AGENDA DE ENTREGAS</h1><p className="mt-2 text-sm text-slate-600">Programação de entregas liberadas. A agenda não altera os totais de entregas realizadas nem as prestações de contas.</p><AgendaClient/></div></main>;}
