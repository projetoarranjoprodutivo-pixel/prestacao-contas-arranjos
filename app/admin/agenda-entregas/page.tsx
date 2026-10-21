import {redirect} from 'next/navigation';
import {getAgendaEntregasUser} from '@/lib/admin';
import './agenda.css';
import {getDb} from '@/db';
import {colaboradores} from '@/db/schema';
import AgendaClient from './agenda-client';
export const dynamic='force-dynamic';
export default async function Agenda(){const user=await getAgendaEntregasUser();if(!user)redirect('/');const responsaveis=await getDb().select({authUserId:colaboradores.authUserId,nome:colaboradores.nomeCompleto,associacao:colaboradores.associacao}).from(colaboradores);return <main className="agenda-page min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-7"><div className="mx-auto max-w-7xl"><a href={user.role==='admin'||user.email.toLowerCase()==='rafaeldalla@hotmail.com'?'/admin':'/painel'} className="text-sm font-bold text-emerald-800">← VOLTAR AO PAINEL</a><p className="mt-5 text-xs font-black tracking-widest text-emerald-800">ACOMPANHAMENTO · ARRANJOS PRODUTIVOS</p><h1 className="mt-2 text-3xl font-black">AGENDA DE ENTREGAS</h1><p className="mt-2 text-sm text-slate-600">Programação de entregas. Agendamentos concluídos são registrados em Entrega de Mudas.</p><AgendaClient responsaveis={responsaveis}/></div></main>;}
