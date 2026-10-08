import React, { useMemo, useState } from 'react';
import { Ban, CheckCircle2, ClipboardList, Clock3, Package, Pencil, Plus, Search, Send, ShoppingBag, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useErp } from '../../../context/ErpContext';
import { formatOsChipLabel } from '../../../../services/ordensServico';
import { comComprasAtual } from '../../../../services/comprasSeguro';
import { confirmDialog } from '../../ui/feedback';
import {
  createEmptyItem,
  formatCurrency,
  matchesSolicitante,
  normalizeRequests,
  purchaseStateLabel,
  stageLabel,
  toItemRecords,
  type BoardStage,
  type CompraHistoricoRegistro,
  type ItemCompra,
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
  AGUARDANDO_COMERCIAL: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  AGUARDANDO_FIN: 'border-blue-500/30 bg-blue-500/15 text-blue-200',
  COMPRADOS: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  RECUSADO: 'border-red-500/30 bg-red-500/15 text-red-200',
};

const stateTone = (state: string) =>
  state === 'estoque'
    ? 'border-violet-500/30 bg-violet-500/15 text-violet-200'
    : state === 'comprado' || state === 'contratado' || state === 'entregue'
    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
    : 'border-amber-500/30 bg-amber-500/15 text-amber-200';

export function MinhasComprasView({ searchQuery }: MinhasComprasViewProps) {
  const { compras, comprasHistorico, userSession, saveEntity } = useErp() as any;
  // Admin e gerente veem o histórico de todos; colaborador comum só o próprio.
  const isAdmin = ['ADMIN', 'GERENTE'].includes(String(userSession?.role || '').toUpperCase());

  const [filtro, setFiltro] = useState(searchQuery || '');
  const [solicitanteFiltro, setSolicitanteFiltro] = useState(''); // só admin

  // Edição inline de uma requisição recusada, antes de reenviar.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [itensEditados, setItensEditados] = useState<ItemCompra[]>([]);
  const [reenviando, setReenviando] = useState(false);

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

  // ---- Recusadas (aguardando ação do solicitante: editar+reenviar ou cancelar) ----
  const recusadas = useMemo(() => {
    return escopar(requests).filter((r) =>
      r.stage === 'RECUSADO' &&
      buscaEm([r.centroCusto, r.solicitante, r.departamento, r.motivoRecusa, ...r.itens.map((it) => `${it.descricao} ${it.nome}`)]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, isAdmin, solicitanteFiltro, termo, userSession]);

  // ---- Em andamento (pedidos no funil, exceto recusados) agrupados por pedido ----
  const pedidosAndamento = useMemo(() => {
    return escopar(requests).filter((r) =>
      r.stage !== 'RECUSADO' &&
      buscaEm([r.centroCusto, r.solicitante, r.departamento, stageLabel[r.stage], ...r.itens.map((it) => `${it.descricao} ${it.nome}`)]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, isAdmin, solicitanteFiltro, termo, userSession]);

  // Grava sempre em cima da cópia mais recente do servidor — mesmo padrão do resto do módulo.
  const patchRequest = async (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    await comComprasAtual(async ({ compras: base }) => {
      const atualizado = base.map((r: any) => (r.id === requestId ? updater(r) : r));
      await saveEntity?.('compras', atualizado);
      return true;
    });
  };

  const handleCancelarPedido = async (request: RequisicaoCompra) => {
    const rotulo = request.itens[0]?.descricao || request.itens[0]?.nome || 'esta solicitação';
    if (!(await confirmDialog(`Cancelar "${rotulo}"? Essa ação não pode ser desfeita.`))) return;
    await comComprasAtual(async ({ compras: base }) => {
      await saveEntity?.('compras', base.filter((r: any) => r.id !== request.id));
      return true;
    });
    toast.success('Solicitação cancelada.');
  };

  const handleIniciarEdicao = (request: RequisicaoCompra) => {
    setEditandoId(request.id);
    setItensEditados(request.itens.map((item) => ({ ...item })));
  };

  const handleCancelarEdicao = () => {
    setEditandoId(null);
    setItensEditados([]);
  };

  const updateItemEditado = (id: string, field: keyof ItemCompra, value: string | number) => {
    setItensEditados((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleAddItemEditado = () => {
    setItensEditados((current) => [...current, createEmptyItem()]);
  };

  const handleRemoveItemEditado = (id: string) => {
    setItensEditados((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  };

  const handleReenviar = async (request: RequisicaoCompra) => {
    const itensValidos = itensEditados
      .filter((item) => item.descricao.trim() !== '')
      .map((item) => ({ ...item, nome: item.descricao.trim() }));
    if (itensValidos.length === 0) {
      toast.error('Preencha ao menos uma descrição na tabela.');
      return;
    }
    setReenviando(true);
    try {
      await patchRequest(request.id, (r) => ({
        ...r,
        stage: 'SOLICITACOES',
        itens: itensValidos,
        budgetDetails: [],
        budgetValue: null,
        motivoRecusa: undefined,
        recusadoPor: undefined,
        recusadoEm: undefined,
        pedidoCompraNumero: undefined,
        updatedAt: new Date().toISOString(),
      }));
      setEditandoId(null);
      setItensEditados([]);
      toast.success('Solicitação reenviada — disponível no Kanban de Compras.');
    } finally {
      setReenviando(false);
    }
  };

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
          {isAdmin ? 'Histórico de compras' : 'Meu histórico de compras'}
        </h1>
        <p className="text-white/50 text-sm">
          Acompanhe suas solicitações, as compras em andamento e o estado de cada item — do pedido à conclusão.
          {isAdmin && <span className="text-white/40"> Como {String(userSession?.role || '').toUpperCase() === 'ADMIN' ? 'administrador' : 'gerente'}, você vê as compras de todos e pode filtrar por usuário.</span>}
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
        {/* ===== RECUSADAS ===== */}
        {recusadas.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-white/80">
              <Ban size={16} className="text-red-300" />
              <h2 className="text-sm font-black uppercase tracking-widest">Recusadas</h2>
              <span className="text-white/30 text-xs">({recusadas.length} pedido(s))</span>
            </div>

            {recusadas.map((request) => {
              const editando = editandoId === request.id;
              return (
                <article key={request.id} className="overflow-hidden rounded-[24px] border border-red-500/20 bg-[#101f3d] shadow-xl shadow-black/20">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                          {request.centroCusto ? formatOsChipLabel(request.centroCusto) : 'OS: —'}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${stageTone.RECUSADO}`}>
                          Recusado
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{request.itens.length} item(ns)</span>
                      </div>
                      <p className="mt-2 text-sm text-white/60">
                        {isAdmin && <>Solicitante: <span className="text-white/85">{request.solicitante || '—'}</span> • </>}
                        Criado em {formatDate(request.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mx-6 mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Motivo da recusa</p>
                    <p className="mt-1 text-sm text-red-100">{request.motivoRecusa || '—'}</p>
                    <p className="mt-2 text-xs text-red-200/60">
                      {request.recusadoPor ? `Recusado por ${request.recusadoPor}` : 'Recusado'}
                      {request.recusadoEm ? ` em ${formatDate(request.recusadoEm)}` : ''}
                    </p>
                  </div>

                  {!editando ? (
                    <>
                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white/[0.03]">
                            <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                              <th className="px-6 py-3 text-left">Item</th>
                              <th className="px-6 py-3 text-left">Natureza</th>
                              <th className="px-6 py-3 text-left">Qtd</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {request.itens.map((item) => (
                              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-3 font-semibold text-white">{item.descricao || item.nome || '—'}</td>
                                <td className="px-6 py-3 text-white/70">{item.naturezaFornecimento === 'ITEM' ? 'Item' : 'Serviço'}</td>
                                <td className="px-6 py-3 text-white/70">{item.qtd} {item.un}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap gap-3 px-6 py-4">
                        <button
                          onClick={() => handleIniciarEdicao(request)}
                          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all"
                        >
                          <Pencil size={14} /> Editar e reenviar
                        </button>
                        <button
                          onClick={() => handleCancelarPedido(request)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/70 hover:text-red-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all"
                        >
                          <Trash2 size={14} /> Cancelar pedido
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3 px-6 py-4">
                      <div className="overflow-auto rounded-2xl border border-white/10">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white/[0.03]">
                            <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                              <th className="px-4 py-3 text-left">Descrição</th>
                              <th className="px-4 py-3 text-left">Tipo</th>
                              <th className="px-4 py-3 text-center">Qtd</th>
                              <th className="px-4 py-3 text-center">Un</th>
                              <th className="px-4 py-3 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {itensEditados.map((item) => (
                              <tr key={item.id}>
                                <td className="p-2">
                                  <input
                                    className="w-full rounded-lg border border-white/10 bg-[#0b1220] p-2 text-sm text-white outline-none focus:border-amber-500"
                                    placeholder="Descrição do item"
                                    value={item.descricao}
                                    onChange={(e) => updateItemEditado(item.id, 'descricao', e.target.value)}
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    className={`w-full rounded-lg border border-white/10 bg-[#0b1220] p-2 text-sm font-bold outline-none focus:border-amber-500 ${item.naturezaFornecimento === 'ITEM' ? 'text-emerald-300' : 'text-sky-300'}`}
                                    value={item.naturezaFornecimento}
                                    onChange={(e) => updateItemEditado(item.id, 'naturezaFornecimento', e.target.value)}
                                  >
                                    <option value="ITEM" className="bg-[#0b1220] text-white">Compra de material</option>
                                    <option value="SERVICO" className="bg-[#0b1220] text-white">Serviço</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min="1"
                                    className="w-full rounded-lg border border-white/10 bg-[#0b1220] p-2 text-sm text-center font-bold text-white outline-none focus:border-amber-500"
                                    value={item.qtd}
                                    onChange={(e) => updateItemEditado(item.id, 'qtd', Number(e.target.value))}
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    className="w-full rounded-lg border border-white/10 bg-[#0b1220] p-2 text-sm text-center uppercase text-white outline-none focus:border-amber-500"
                                    value={item.un}
                                    onChange={(e) => updateItemEditado(item.id, 'un', e.target.value)}
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button onClick={() => handleRemoveItemEditado(item.id)} className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Remover item">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={handleAddItemEditado}
                        className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        <Plus size={14} /> Adicionar item
                      </button>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <button
                          onClick={() => handleReenviar(request)}
                          disabled={reenviando}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                        >
                          <Send size={14} /> {reenviando ? 'Reenviando...' : 'Reenviar solicitação'}
                        </button>
                        <button
                          onClick={handleCancelarEdicao}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all"
                        >
                          <X size={14} /> Cancelar edição
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

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
                        {request.centroCusto ? formatOsChipLabel(request.centroCusto) : 'OS: —'}
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
                          {grupo.centroCusto ? formatOsChipLabel(grupo.centroCusto) : 'OS: —'}
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
