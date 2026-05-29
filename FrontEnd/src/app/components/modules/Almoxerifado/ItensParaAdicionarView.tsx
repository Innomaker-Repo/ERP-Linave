import React, { useEffect, useMemo } from 'react';
import { Bell, CheckCircle2, Package2 } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';

type ItensParaAdicionarStatus = 'pendente' | 'ok';

type ItensParaAdicionarRecord = {
  id: string;
  pedidoId: string;
  itemId: string;
  itemNome: string;
  itemDescricao: string;
  centroCusto: string;
  solicitante: string;
  fornecedor: string;
  quantidade: number;
  unidade: string;
  naturezaFornecimento: 'ITEM' | 'SERVICO';
  purchaseState: 'entregue';
  status: ItensParaAdicionarStatus;
  criadoEm: string;
  confirmadoEm?: string;
  confirmadoPor?: string;
};

const makeKey = (pedidoId: string, itemId: string) => `${pedidoId}::${itemId}`;

const buildDeliveredItems = (compras: any[]): ItensParaAdicionarRecord[] => {
  if (!Array.isArray(compras)) return [];

  return compras.flatMap((pedido: any) => {
    const items = Array.isArray(pedido?.itens) ? pedido.itens : [];
    const details = Array.isArray(pedido?.budgetDetails) ? pedido.budgetDetails : [];

    return items
      .filter((item: any) => item?.naturezaFornecimento === 'ITEM' && item?.purchaseState === 'entregue')
      .map((item: any) => {
        const detail = details.find((entry: any) => entry.itemId === item.id) || null;
        const selectedSupplier = detail?.fornecedorSelecionado || item.fornecedor || '';

        return {
          id: makeKey(String(pedido.id || ''), String(item.id || '')),
          pedidoId: String(pedido.id || ''),
          itemId: String(item.id || ''),
          itemNome: String(item.nome || ''),
          itemDescricao: String(item.descricao || ''),
          centroCusto: String(pedido.centroCusto || ''),
          solicitante: String(pedido.solicitante || ''),
          fornecedor: selectedSupplier,
          quantidade: Number(item.qtd || 0),
          unidade: String(item.un || 'un'),
          naturezaFornecimento: 'ITEM',
          purchaseState: 'entregue',
          status: 'pendente',
          criadoEm: String(pedido.updatedAt || pedido.createdAt || new Date().toISOString()),
        };
      });
  });
};

export function ItensParaAdicionarView({ searchQuery }: { searchQuery: string }) {
  const { compras, almoxerifado, saveEntity, userSession } = useErp();

  const storedItems = Array.isArray(almoxerifado?.itensParaAdicionar) ? (almoxerifado.itensParaAdicionar as ItensParaAdicionarRecord[]) : [];
  const deliveredItems = useMemo(() => buildDeliveredItems(Array.isArray(compras) ? compras : []), [compras]);

  useEffect(() => {
    const merged = deliveredItems.map((item) => {
      const existing = storedItems.find((entry) => entry.id === item.id);
      if (!existing) return item;
      return {
        ...item,
        status: existing.status === 'ok' ? 'ok' : 'pendente',
        confirmadoEm: existing.confirmadoEm,
        confirmadoPor: existing.confirmadoPor,
      };
    });

    const currentSignature = JSON.stringify(storedItems.map((item) => ({ id: item.id, status: item.status, confirmadoEm: item.confirmadoEm, confirmadoPor: item.confirmadoPor })));
    const mergedSignature = JSON.stringify(merged.map((item) => ({ id: item.id, status: item.status, confirmadoEm: item.confirmadoEm, confirmadoPor: item.confirmadoPor })));

    if (currentSignature !== mergedSignature) {
      void saveEntity?.('almoxerifado', {
        ...(almoxerifado || {}),
        itensParaAdicionar: merged,
      });
    }
  }, [deliveredItems, storedItems, almoxerifado, saveEntity]);

  const handleConfirm = (recordId: string) => {
    const updated = storedItems.map((item) => (
      item.id === recordId
        ? {
            ...item,
            status: 'ok' as const,
            confirmadoEm: new Date().toISOString(),
            confirmadoPor: userSession?.username || userSession?.email || 'sistema',
          }
        : item
    ));

    void saveEntity?.('almoxerifado', {
      ...(almoxerifado || {}),
      itensParaAdicionar: updated,
    });
  };

  const filteredItems = storedItems.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [item.itemNome, item.itemDescricao, item.centroCusto, item.solicitante, item.fornecedor, item.unidade]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const pendentes = filteredItems.filter((item) => item.status !== 'ok');
  const confirmados = filteredItems.filter((item) => item.status === 'ok');

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-violet-500 to-fuchsia-700 rounded-2xl shadow-lg shadow-violet-500/20 text-white">
            <Bell size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Itens para adicionar</h1>
            <p className="text-white/50 text-sm mt-1">Itens de pedidos entregues que precisam ser adicionados em suprimentos. Marque OK quando concluir.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white/40">
          <Package2 size={14} />
          Somente itens com status entregue aparecem aqui
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Pendentes</p>
          <p className="text-white font-black text-3xl mt-2">{pendentes.length}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Confirmados</p>
          <p className="text-white font-black text-3xl mt-2">{confirmados.length}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Total sincronizado</p>
          <p className="text-white font-black text-3xl mt-2">{storedItems.length}</p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-[#101f3d]/60 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">Itens pendentes</h3>
            <span className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-xs font-bold">{pendentes.length}</span>
          </div>

          <div className="space-y-3">
            {pendentes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-white/35 text-sm">Nenhum item pendente para adicionar.</div>
            ) : pendentes.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-white font-bold text-sm">{item.itemDescricao || item.itemNome}</h4>
                    <p className="text-white/45 text-[11px] mt-1">{item.centroCusto} • {item.solicitante}</p>
                  </div>
                  <button
                    onClick={() => handleConfirm(item.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider"
                  >
                    <CheckCircle2 size={14} /> OK
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-white/65">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-white/35 uppercase tracking-widest font-black text-[10px]">Fornecedor</p>
                    <p className="text-white mt-1">{item.fornecedor || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-white/35 uppercase tracking-widest font-black text-[10px]">Quantidade</p>
                    <p className="text-white mt-1">{item.quantidade} {item.unidade}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-white/35 uppercase tracking-widest font-black text-[10px]">Natureza</p>
                    <p className="text-white mt-1">ITEM</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-white/35 uppercase tracking-widest font-black text-[10px]">Pedido</p>
                    <p className="text-white mt-1">{item.pedidoId}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#101f3d]/60 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Itens confirmados</h3>
            <span className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-xs font-bold">{confirmados.length}</span>
          </div>

          <div className="space-y-3">
            {confirmados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-white/35 text-sm">Nenhum item confirmado ainda.</div>
            ) : confirmados.map((item) => (
              <article key={item.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-white font-bold text-sm">{item.itemDescricao || item.itemNome}</h4>
                    <p className="text-white/50 text-[11px] mt-1">Confirmado em {item.confirmadoEm ? new Date(item.confirmadoEm).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 size={14} /> OK
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}