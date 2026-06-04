import React, { useMemo, useState } from 'react';
import { Archive, CalendarClock, History, Package, Search } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import {
  formatCurrency,
  purchaseStateLabel,
  type PurchaseState,
  type QuoteItem,
  type RequisicaoCompra,
} from './comprasLocal';

interface HistoricoComprasViewProps {
  searchQuery: string;
}

// Registro de compra concluída: o pedido completo + metadados de finalização.
type CompraHistoricoRegistro = RequisicaoCompra & {
  finalizadoEm?: string;
  finalizadoPor?: string;
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const purchaseStateTone = (state: PurchaseState) => {
  switch (state) {
    case 'comprar':
    case 'aContratar':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-200';
    case 'comprado':
    case 'contratado':
      return 'border-sky-500/30 bg-sky-500/15 text-sky-200';
    case 'entregue':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200';
    case 'estoque':
      return 'border-violet-500/30 bg-violet-500/15 text-violet-200';
    default:
      return 'border-white/15 bg-white/10 text-white/70';
  }
};

export function HistoricoComprasView({ searchQuery }: HistoricoComprasViewProps) {
  const { comprasHistorico } = useErp();
  const [filtro, setFiltro] = useState(searchQuery || '');
  const [osFiltro, setOsFiltro] = useState('');

  const registros = useMemo<CompraHistoricoRegistro[]>(
    () => (Array.isArray(comprasHistorico) ? (comprasHistorico as CompraHistoricoRegistro[]) : []),
    [comprasHistorico],
  );

  // Opções do filtro por OS = centros de custo (obras/OS) distintos presentes no histórico.
  const opcoesOS = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((registro) => {
      const os = (registro.centroCusto || '').trim();
      if (os) set.add(os);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    const termo = (filtro || '').toLowerCase().trim();

    return registros.filter((registro) => {
      if (osFiltro && (registro.centroCusto || '').trim() !== osFiltro) return false;
      if (!termo) return true;

      const detalhePorItem = new Map((registro.budgetDetails || []).map((detail) => [detail.itemId, detail]));
      const searchable = [
        registro.centroCusto,
        registro.solicitante,
        registro.departamento,
        registro.budgetValue ? String(registro.budgetValue) : '',
        ...registro.itens.flatMap((item) => {
          const detail = detalhePorItem.get(item.id);
          return [
            item.descricao,
            item.nome,
            purchaseStateLabel[item.purchaseState],
            detail?.fornecedorSelecionado,
            detail?.condicaoPagamentoSelecionada,
            detail?.prazoEntregaSelecionado,
          ];
        }),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(termo);
    });
  }, [registros, filtro, osFiltro]);

  const totalItens = useMemo(
    () => registrosFiltrados.reduce((sum, registro) => sum + registro.itens.length, 0),
    [registrosFiltrados],
  );

  const getDetail = (registro: CompraHistoricoRegistro, itemId: string): QuoteItem | undefined =>
    (registro.budgetDetails || []).find((detail) => detail.itemId === itemId);

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-amber-300 text-[10px] font-black uppercase tracking-widest">
          <History size={14} /> Histórico de Compras
        </div>
        <h1 className="text-3xl font-black text-white">Compras concluídas</h1>
        <p className="text-white/50 text-sm">
          Toda compra finalizada (card excluído do kanban) fica registrada aqui com todos os seus itens, fornecedor e estado final.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px_160px_160px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
          <input
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            placeholder="Buscar por item, fornecedor, solicitante..."
            className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white text-sm outline-none focus:border-amber-500 placeholder:text-white/40"
          />
        </div>

        <div className="relative">
          <select
            value={osFiltro}
            onChange={(event) => setOsFiltro(event.target.value)}
            className="h-14 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-white text-sm outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Todas as OS</option>
            {opcoesOS.map((os) => (
              <option key={os} value={os}>{os}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30">▼</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Compras</p>
          <p className="mt-1 text-2xl font-black text-white">{registrosFiltrados.length}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Itens</p>
          <p className="mt-1 text-2xl font-black text-white">{totalItens}</p>
        </div>
      </div>

      {registrosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-[#101f3d] p-12 text-center text-white/40 shadow-2xl shadow-black/20">
          <Archive size={42} className="text-white/20" />
          <p className="text-sm font-bold">Nenhuma compra no histórico</p>
          <p className="text-xs text-white/30">
            {osFiltro || filtro ? 'Ajuste os filtros para ver mais resultados.' : 'Conclua uma compra no kanban (excluir card) para registrá-la aqui.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-auto pb-4">
          {registrosFiltrados.map((registro) => (
            <article key={registro.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/20">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                      OS: {registro.centroCusto || '—'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                      {registro.itens.length} item(ns)
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    Solicitante: <span className="text-white/85">{registro.solicitante || '—'}</span>
                    {registro.departamento ? ` • ${registro.departamento}` : ''}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-2 text-xs text-white/45">
                    <CalendarClock size={13} className="text-amber-400" />
                    Concluída em {formatDateTime(registro.finalizadoEm)}
                    {registro.finalizadoPor ? ` por ${registro.finalizadoPor}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total</p>
                  <p className="text-xl font-black text-emerald-300">
                    {registro.budgetValue ? formatCurrency(registro.budgetValue) : '—'}
                  </p>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/[0.03]">
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                      <th className="px-6 py-3 text-left">Item</th>
                      <th className="px-6 py-3 text-left">Natureza</th>
                      <th className="px-6 py-3 text-left">Qtd</th>
                      <th className="px-6 py-3 text-left">Fornecedor</th>
                      <th className="px-6 py-3 text-left">Valor</th>
                      <th className="px-6 py-3 text-left">Entrega / Pagamento</th>
                      <th className="px-6 py-3 text-left">Estado final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {registro.itens.map((item) => {
                      const detail = getDetail(registro, item.id);
                      return (
                        <tr key={`${registro.id}-${item.id}`} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{item.descricao || item.nome || '—'}</div>
                          </td>
                          <td className="px-6 py-4 text-white/70">{item.naturezaFornecimento === 'ITEM' ? 'Item' : 'Serviço'}</td>
                          <td className="px-6 py-4 text-white/70">{item.qtd} {item.un}</td>
                          <td className="px-6 py-4 text-white/80">
                            {detail?.jaEmEstoque ? 'Já em estoque' : (detail?.fornecedorSelecionado || '—')}
                          </td>
                          <td className="px-6 py-4 text-white/80">
                            {detail?.valorSelecionado != null ? formatCurrency(detail.valorSelecionado) : '—'}
                          </td>
                          <td className="px-6 py-4 text-white/60">
                            <div>{detail?.prazoEntregaSelecionado || '—'}</div>
                            <div className="text-xs text-white/35">{detail?.condicaoPagamentoSelecionada || '—'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${purchaseStateTone(item.purchaseState)}`}>
                              <Package size={12} /> {purchaseStateLabel[item.purchaseState]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
