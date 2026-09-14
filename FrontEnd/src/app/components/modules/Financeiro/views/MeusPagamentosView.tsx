import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FilePlus, Paperclip, Pencil, Search, Users, Wallet } from 'lucide-react';
import { useErp } from '../../../../context/ErpContext';
import { useFinNavigate, FIN_SECTIONS } from '../finNav';
import { matchesSolicitante, money, num, br } from '../finData';

// Documentos anexados na solicitação (NF, boleto, recibo...) precisam continuar acessíveis
// daqui — este é o único lugar onde o colaborador comum (sem acesso a Aprovações/Contas a
// Pagar) acompanha as próprias solicitações, então sem isso o anexo enviado ficava "preso"
// sem nenhuma forma de reconsultar.
function AnexosDaSolicitacao({ anexos }: { anexos?: string[] }) {
  const lista = Array.isArray(anexos) ? anexos : [];
  if (!lista.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Paperclip size={12} className="text-white/30" />
      {lista.map((a, i) => {
        const ehUrl = /^(https?:|\/media\/)/.test(String(a));
        const nome = ehUrl ? decodeURIComponent(String(a).split('/').pop() || 'documento') : String(a);
        return ehUrl ? (
          <a
            key={i}
            href={a}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/20"
          >
            📄 {nome}
          </a>
        ) : (
          <span key={i} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-white/60">
            📄 {nome}
          </span>
        );
      })}
    </div>
  );
}

/* =========================================================================================
 * MEUS PAGAMENTOS — espelho de "Minhas Compras" (Compras/comprasLocal), só que pra
 * Solicitação de Pagamento. Mesma regra de acesso: cada usuário só vê as próprias
 * solicitações; admin e gerente veem de todos, com filtro por usuário.
 * =======================================================================================*/

const statusTone = (status: string) =>
  status === 'Aprovado'
    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
    : status === 'Reprovado'
    ? 'border-rose-500/30 bg-rose-500/15 text-rose-200'
    : 'border-amber-500/30 bg-amber-500/15 text-amber-200';

const pagoTone = (status: string) =>
  status === 'Pago'
    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
    : 'border-amber-500/30 bg-amber-500/15 text-amber-200';

// "Pago" não é um status próprio da solicitação (só existe na Conta a Pagar gerada por
// ela) — precisa olhar as duas pontas pra dar pra filtrar por ele aqui.
const STATUS_FILTROS_PAGAMENTOS = ['Todos', 'Aguardando aprovação', 'Reprovado', 'Aprovado', 'Pago'] as const;
type StatusFiltroPagamentos = typeof STATUS_FILTROS_PAGAMENTOS[number];
const statusEfetivo = (r: any, contaPagar: any): StatusFiltroPagamentos => {
  if (r.status === 'Aprovado') return contaPagar?.status === 'Pago' ? 'Pago' : 'Aprovado';
  if (r.status === 'Reprovado') return 'Reprovado';
  return 'Aguardando aprovação';
};

export function MeusPagamentosView() {
  const { userSession, financeiro, setPendingEditSolicitacaoId } = useErp() as any;
  const navegar = useFinNavigate();
  const isAdmin = ['ADMIN', 'GERENTE'].includes(String(userSession?.role || '').toUpperCase());

  const [filtro, setFiltro] = useState('');
  const [solicitanteFiltro, setSolicitanteFiltro] = useState(''); // só admin/gerente
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltroPagamentos>('Todos');

  const solicitacoes = useMemo(
    () => (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => r?.tipo === 'solicitacao'),
    [financeiro],
  );

  const contaPagarDe = (solicitacaoId: string) =>
    (Array.isArray(financeiro) ? financeiro : []).find((r: any) => r?.tipo === 'contaPagar' && r.origemSolicitacao === solicitacaoId);

  const solicitantes = useMemo(() => {
    if (!isAdmin) return [] as string[];
    const set = new Set<string>();
    solicitacoes.forEach((r: any) => { const s = (r.solicitante || '').trim(); if (s) set.add(s); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [isAdmin, solicitacoes]);

  const escopar = (lista: any[]) => {
    let base = isAdmin ? lista : lista.filter((r) => matchesSolicitante(r, userSession));
    if (isAdmin && solicitanteFiltro) base = base.filter((r) => (r.solicitante || '').trim() === solicitanteFiltro);
    return base;
  };

  const termo = filtro.trim().toLowerCase();
  const buscaEm = (partes: Array<string | number | null | undefined>) =>
    !termo || partes.filter(Boolean).join(' ').toLowerCase().includes(termo);

  const emAndamento = useMemo(() => {
    return escopar(solicitacoes)
      .filter((r: any) => (r.status || 'Aguardando aprovação') !== 'Aprovado')
      .filter((r: any) => statusFiltro === 'Todos' || statusEfetivo(r, null) === statusFiltro)
      .filter((r: any) => buscaEm([r.fornecedor, r.documento, r.solicitante, r.vinculoValor]))
      .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitacoes, isAdmin, solicitanteFiltro, statusFiltro, termo, userSession]);

  const concluidas = useMemo(() => {
    return escopar(solicitacoes)
      .filter((r: any) => r.status === 'Aprovado')
      .filter((r: any) => buscaEm([r.fornecedor, r.documento, r.solicitante, r.vinculoValor]))
      .map((r: any) => ({ ...r, contaPagar: contaPagarDe(r.id) }))
      .filter((r: any) => statusFiltro === 'Todos' || statusEfetivo(r, r.contaPagar) === statusFiltro)
      .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitacoes, isAdmin, solicitanteFiltro, statusFiltro, termo, userSession, financeiro]);

  const totalPago = concluidas.reduce((s: number, r: any) => s + (r.contaPagar?.status === 'Pago' ? num(r.contaPagar.valorPago ?? r.valor) : 0), 0);

  const irEditar = (id: string) => {
    // Deixa o recado pra Solicitação de Pagamento abrir esse registro em edição assim que montar.
    setPendingEditSolicitacaoId(id);
    navegar(FIN_SECTIONS.solicitacao);
  };

  const nomeUsuario = isAdmin
    ? (solicitanteFiltro || 'Todos os usuários')
    : (userSession?.nome || userSession?.email || 'Você');

  return (
    <div className="flex h-full flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-amber-300 text-[10px] font-black uppercase tracking-widest">
          <Wallet size={14} /> {isAdmin ? 'Pagamentos por usuário' : 'Meus Pagamentos'}
        </div>
        <h1 className="text-3xl font-black text-white">
          {isAdmin ? 'Histórico de pagamentos' : 'Meu histórico de pagamentos'}
        </h1>
        <p className="text-white/50 text-sm">
          Acompanhe suas solicitações de pagamento, o que está em aprovação e o que já foi aprovado.
          {isAdmin && <span className="text-white/40"> Como {String(userSession?.role || '').toUpperCase() === 'ADMIN' ? 'administrador' : 'gerente'}, você vê os pagamentos de todos e pode filtrar por usuário.</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px] xl:grid-cols-[1fr_220px_160px_160px_160px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por fornecedor, documento, OS..."
            className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white text-sm outline-none focus:border-amber-500 placeholder:text-white/40"
          />
        </div>

        {isAdmin ? (
          <div className="relative">
            <select
              value={solicitanteFiltro}
              onChange={(e) => setSolicitanteFiltro(e.target.value)}
              className="h-14 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-white text-sm outline-none focus:border-amber-500 cursor-pointer [&>option]:bg-[#101f3d] [&>option]:text-white"
            >
              <option value="">Todos os usuários</option>
              {solicitantes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30">▼</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101f3d] px-4 py-3">
            <Users size={16} className="text-white/40" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Usuário</p>
              <p className="truncate text-sm font-bold text-white">{nomeUsuario}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Em andamento</p>
          <p className="mt-1 text-2xl font-black text-amber-300">{emAndamento.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Aprovadas</p>
          <p className="mt-1 text-2xl font-black text-emerald-300">{concluidas.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total pago</p>
          <p
            className="mt-1 truncate text-lg font-black text-white"
            title={totalPago ? money(totalPago) : undefined}
          >
            {totalPago ? money(totalPago) : '—'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-white/30">Status</span>
        {STATUS_FILTROS_PAGAMENTOS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all active:scale-95 ${
              statusFiltro === s
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/10'
                : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8 overflow-auto pb-4">
        {/* ===== EM ANDAMENTO ===== */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-white/80">
            <Clock3 size={16} className="text-amber-300" />
            <h2 className="text-sm font-black uppercase tracking-widest">Em andamento</h2>
            <span className="text-white/30 text-xs">({emAndamento.length} solicitação(ões))</span>
          </div>

          {emAndamento.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-[#101f3d] p-10 text-center text-white/40">
              <FilePlus size={34} className="text-white/20" />
              <p className="text-sm font-bold">Nenhuma solicitação em andamento</p>
              <p className="text-xs text-white/30">Crie uma em "Solicitação de Pagamento" para acompanhá-la aqui.</p>
            </div>
          ) : (
            emAndamento.map((r: any) => (
              <article key={r.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101f3d] shadow-xl shadow-black/20">
                <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                        {r.vinculoValor ? `OS: ${r.vinculoValor}` : 'Sem OS'}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(r.status || 'Aguardando aprovação')}`}>
                        {r.status || 'Aguardando aprovação'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">{r.fornecedor || 'Fornecedor não informado'}</p>
                    <p className="text-white/50 text-xs">
                      {isAdmin && <>Solicitante: <span className="text-white/85">{r.solicitante || '—'}</span> • </>}
                      Doc: {r.documento || '—'} • Criado em {br(String(r.createdAt || '').slice(0, 10))}
                    </p>
                    {r.status === 'Reprovado' && r.motivoReprovacao && (
                      <p className="mt-1 text-rose-300 text-xs">Motivo: {r.motivoReprovacao}</p>
                    )}
                    <AnexosDaSolicitacao anexos={r.anexos} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Valor</p>
                      <p className="text-lg font-black text-white">{money(num(r.valor))}</p>
                    </div>
                    {r.status === 'Reprovado' && (
                      <button
                        onClick={() => irEditar(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white transition-colors"
                      >
                        <Pencil size={13} /> Editar e reenviar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        {/* ===== APROVADAS ===== */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 size={16} className="text-emerald-300" />
            <h2 className="text-sm font-black uppercase tracking-widest">Aprovadas</h2>
            <span className="text-white/30 text-xs">({concluidas.length} solicitação(ões))</span>
          </div>

          {concluidas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-[#101f3d] p-10 text-center text-white/40">
              <Wallet size={34} className="text-white/20" />
              <p className="text-sm font-bold">Nenhum pagamento aprovado ainda</p>
              <p className="text-xs text-white/30">Quando uma solicitação for aprovada, ela vira Conta a Pagar e aparece aqui.</p>
            </div>
          ) : (
            concluidas.map((r: any) => (
              <article key={r.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101f3d] shadow-xl shadow-black/20">
                <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                        {r.vinculoValor ? `OS: ${r.vinculoValor}` : 'Sem OS'}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${pagoTone(r.contaPagar?.status || 'Aberto')}`}>
                        {r.contaPagar?.status === 'Pago' ? 'Pago' : 'Aguardando pagamento'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">{r.fornecedor || 'Fornecedor não informado'}</p>
                    <p className="text-white/50 text-xs">
                      {isAdmin && <>Solicitante: <span className="text-white/85">{r.solicitante || '—'}</span> • </>}
                      Doc: {r.documento || '—'}
                      {r.contaPagar?.status === 'Pago' && r.contaPagar?.dataPagamento && ` • Pago em ${br(r.contaPagar.dataPagamento)}`}
                    </p>
                    <AnexosDaSolicitacao anexos={r.anexos} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Valor</p>
                    <p className="text-lg font-black text-emerald-300">{money(num(r.valor))}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
