import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Clock3, Package, Search, ShoppingBag, Users } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import {
  formatCurrency,
  matchesSolicitante,
  normalizeRequests,
  purchaseStateLabel,
  stageLabel,
  toItemRecords,
  type BoardStage,
  type CompraHistoricoRegistro,
  type RequisicaoCompra,
} from './comprasLocal';

interface MinhasComprasViewProps {
  searchQuery: string;
}

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

// Tom da etapa (funil de compras) para o badge de situação.
const stageTone: Record<BoardStage, string> = {
  SOLICITACOES: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  SELECAO_GERENTE: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
  APROVACAO: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  COMPRADOS: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
};

const stateTone = (state: string) =>
  state === 'estoque'
    ? 'border-violet-500/30 bg-violet-500/15 text-violet-200'
    : state === 'comprado' || state === 'contratado' || state === 'entregue'
    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
    : 'border-amber-500/30 bg-amber-500/15 text-amber-200';

export function MinhasComprasView({ searchQuery }: MinhasComprasViewProps) {
  const { compras, comprasHistorico, userSession } = useErp() as any;
  const isAdmin = String(userSession?.role || '').toUpperCase() === 'ADMIN';

  const [filtro, setFiltro] = useState(searchQuery || '');
  const [solicitanteFiltro, setSolicitanteFiltro] = useState(''); // só admin

  // Pedidos em aberto (ainda no funil) e itens já concluídos (histórico).
  const requests = useMemo<RequisicaoCompra[]>(() => normalizeRequests(compras), [compras]);
  const historico = useMemo<CompraHistoricoRegistro[]>(
    () => toItemRecords(Array.isArray(comprasHistorico) ? comprasHistorico : []),
    [comprasHistorico],
  );

  // Lista de solicitantes (só para o seletor do admin).
  const solicitantes = useMemo(() => {
    if (!isAdmin) return [] as string[];
    const set = new Set<string>();
    [...requests, ...historico].forEach((r) => {
      const s = (r.solicitante || '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [isAdmin, requests, historico]);

  // Escopo por usuário: admin vê tudo (com filtro opcional por solicitante); demais só o próprio.
  const escopar = <T extends { solicitante?: string; solicitanteCpf?: string; solicitanteEmail?: string }>(lista: T[]): T[] => {
    let base = isAdmin ? lista : lista.filter((r) => matchesSolicitante(r, userSession));
    if (isAdmin && solicitanteFiltro) base = base.filter((r) => (r.solicitante || '').trim() === solicitanteFiltro);
    return base;
  };

  const termo = filtro.trim().toLowerCase();
  const buscaEm = (partes: Array<string | number | null | undefined>) =>
    !termo || partes.filter(Boolean).join(' ').toLowerCase().includes(termo);

  // ---- Em andamento (pedidos no funil) agrupados por pedido ----
  const pedidosAndamento = useMemo(() => {
    return escopar(requests).filter((r) =>
      buscaEm([r.centroCusto, r.solicitante, r.departamento, stageLabel[r.stage], ...r.itens.map((it) => `${it.descricao} ${it.nome}`)]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, isAdmin, solicitanteFiltro, termo, userSession]);

  // ---- Concluídas (itens do histórico) agrupadas por pedido ----
  const historicoFiltrado = useMemo(() => {
    return escopar(historico).filter((r) =>
      buscaEm([r.centroCusto, r.solicitante, r.itemDescricao, r.itemNome, r.fornecedor, purchaseStateLabel[r.purchaseState]]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historico, isAdmin, solicitanteFiltro, termo, userSession]);

  const gruposConcluidos = useMemo(() => {
    const map = new Map<string, { pedidoId: string; centroCusto: string; solicitante: string; itens: CompraHistoricoRegistro[] }>();
    historicoFiltrado.forEach((r) => {
      const key = r.pedidoId || r.id;
      if (!map.has(key)) map.set(key, { pedidoId: key, centroCusto: r.centroCusto, solicitante: r.solicitante, itens: [] });
      map.get(key)!.itens.push(r);
    });
    return Array.from(map.values());
  }, [historicoFiltrado]);

  // ---- KPIs ----
  const totalItensAndamento = pedidosAndamento.reduce((s, r) => s + r.itens.length, 0);
  const totalItensConcluidos = historicoFiltrado.length;
  const totalGasto = historicoFiltrado.reduce((s, r) => s + (r.valor || 0), 0);

  const nomeUsuario = isAdmin
    ? (solicitanteFiltro || 'Todos os usuários')
    : (userSession?.nome || userSession?.email || 'Você');

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-amber-300 text-[10px] font-black uppercase tracking-widest">
          <ShoppingBag size={14} /> {isAdmin ? 'Compras por usuário' : 'Minhas Compras'}
        </div>
        <h1 className="text-3xl font-black text-white">
          {isAdmin ? 'Histórico de compras (todos os usuários)' : 'Meu histórico de compras'}
        </h1>
        <p className="text-white/50 text-sm">
          Acompanhe suas solicitações, as compras em andamento e o estado de cada item — do pedido à conclusão.
          {isAdmin && <span className="text-white/40"> Como administrador, você vê as compras de todos e pode filtrar por usuário.</span>}
        </p>
      </div>

      {/* Filtros + KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px] xl:grid-cols-[1fr_220px_160px_160px_160px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por item, OS, fornecedor..."
            className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white text-sm outline-none focus:border-amber-500 placeholder:text-white/40"
          />
        </div>

        {isAdmin ? (
          <div className="relative">
            <select
              value={solicitanteFiltro}
              onChange={(e) => setSolicitanteFiltro(e.target.value)}
              className="h-14 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-white text-sm outline-none focus:border-amber-500 cursor-pointer"
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
          <p className="mt-1 text-2xl font-black text-amber-300">{totalItensAndamento}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Concluídas</p>
          <p className="mt-1 text-2xl font-black text-emerald-300">{totalItensConcluidos}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total comprado</p>
          <p className="mt-1 text-2xl font-black text-white">{totalGasto ? formatCurrency(totalGasto) : '—'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-8 overflow-auto pb-4">
        {/* ===== EM ANDAMENTO ===== */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-white/80">
            <Clock3 size={16} className="text-amber-300" />
            <h2 className="text-sm font-black uppercase tracking-widest">Em andamento</h2>
            <span className="text-white/30 text-xs">({pedidosAndamento.length} pedido(s))</span>
          </div>

          {pedidosAndamento.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-[#101f3d] p-10 text-center text-white/40">
              <ClipboardList size={34} className="text-white/20" />
              <p className="text-sm font-bold">Nenhum pedido em andamento</p>
              <p className="text-xs text-white/30">Crie uma solicitação em "Compras / Requisições" para acompanhá-la aqui.</p>
            </div>
          ) : (
            pedidosAndamento.map((request) => (
              <article key={request.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101f3d] shadow-xl shadow-black/20">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                        OS: {request.centroCusto || '—'}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${stageTone[request.stage]}`}>
                        {stageLabel[request.stage]}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{request.itens.length} item(ns)</span>
                    </div>
                    <p className="mt-2 text-sm text-white/60">
                      {isAdmin && <>Solicitante: <span className="text-white/85">{request.solicitante || '—'}</span> • </>}
                      Criado em {formatDate(request.createdAt)}
                    </p>
                  </div>
                  {request.budgetValue != null && (
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Orçamento</p>
                      <p className="text-lg font-black text-white">{formatCurrency(request.budgetValue)}</p>
                    </div>
                  )}
                </div>

                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/[0.03]">
                      <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                        <th className="px-6 py-3 text-left">Item</th>
                        <th className="px-6 py-3 text-left">Natureza</th>
                        <th className="px-6 py-3 text-left">Qtd</th>
                        <th className="px-6 py-3 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {request.itens.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3 font-semibold text-white">{item.descricao || item.nome || '—'}</td>
                          <td className="px-6 py-3 text-white/70">{item.naturezaFornecimento === 'ITEM' ? 'Item' : 'Serviço'}</td>
                          <td className="px-6 py-3 text-white/70">{item.qtd} {item.un}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${stateTone(item.purchaseState)}`}>
                              <Package size={12} /> {purchaseStateLabel[item.purchaseState]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          )}
        </section>

        {/* ===== CONCLUÍDAS ===== */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 size={16} className="text-emerald-300" />
            <h2 className="text-sm font-black uppercase tracking-widest">Concluídas</h2>
            <span className="text-white/30 text-xs">({totalItensConcluidos} item(ns))</span>
          </div>

          {gruposConcluidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-[#101f3d] p-10 text-center text-white/40">
              <ShoppingBag size={34} className="text-white/20" />
              <p className="text-sm font-bold">Nenhuma compra concluída</p>
              <p className="text-xs text-white/30">Quando um item for comprado/contratado, ele aparece aqui com fornecedor e valor.</p>
            </div>
          ) : (
            gruposConcluidos.map((grupo) => {
              const total = grupo.itens.reduce((s, it) => s + (it.valor || 0), 0);
              return (
                <article key={grupo.pedidoId} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101f3d] shadow-xl shadow-black/20">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                          OS: {grupo.centroCusto || '—'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{grupo.itens.length} item(ns)</span>
                      </div>
                      {isAdmin && <p className="mt-2 text-sm text-white/60">Solicitante: <span className="text-white/85">{grupo.solicitante || '—'}</span></p>}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total</p>
                      <p className="text-lg font-black text-emerald-300">{total ? formatCurrency(total) : '—'}</p>
                    </div>
                  </div>

                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/[0.03]">
                        <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                          <th className="px-6 py-3 text-left">Item</th>
                          <th className="px-6 py-3 text-left">Qtd</th>
                          <th className="px-6 py-3 text-left">Fornecedor</th>
                          <th className="px-6 py-3 text-left">Valor</th>
                          <th className="px-6 py-3 text-left">Estado</th>
                          <th className="px-6 py-3 text-left">NFe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {grupo.itens.map((item) => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-3">
                              <div className="font-semibold text-white">{item.itemDescricao || item.itemNome || '—'}</div>
                              <div className="text-xs text-white/35">Concluído em {formatDate(item.compradoEm)}</div>
                            </td>
                            <td className="px-6 py-3 text-white/70">{item.qtd} {item.un}</td>
                            <td className="px-6 py-3 text-white/80">{item.fornecedor || '—'}</td>
                            <td className="px-6 py-3 text-white/80">{item.valor != null ? formatCurrency(item.valor) : '—'}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${stateTone(item.purchaseState)}`}>
                                <Package size={12} /> {purchaseStateLabel[item.purchaseState]}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              {item.nfeStatus === 'lancada' ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-200">
                                  NFe {item.nfeNumero || 'lançada'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-200">
                                  NFe pendente
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
