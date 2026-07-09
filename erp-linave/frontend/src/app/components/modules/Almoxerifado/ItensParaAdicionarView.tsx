import React, { useMemo } from 'react';
import { Bell, CheckCircle2, Package2 } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import type { CompraHistoricoRegistro } from '../Compras/comprasLocal';

// Esta tela consome diretamente o Histórico de Compras (fonte única). Cada item de
// natureza ITEM marcado como "comprado" no kanban entra aqui como pendente; ao clicar
// OK, o status do registro vira "estoque" — gravado de volta no comprasHistorico (SQL).
export function ItensParaAdicionarView({ searchQuery }: { searchQuery: string }) {
  const { comprasHistorico, saveEntity, userSession } = useErp() as any;

  const registros = useMemo<CompraHistoricoRegistro[]>(
    () => (Array.isArray(comprasHistorico) ? comprasHistorico : []).filter((r: any) => r?.naturezaFornecimento === 'ITEM'),
    [comprasHistorico],
  );

  const handleConfirm = (recordId: string) => {
    const all = Array.isArray(comprasHistorico) ? comprasHistorico : [];
    const updated = all.map((r: any) =>
      r?.id === recordId
        ? {
            ...r,
            purchaseState: 'estoque',
            estoqueOkEm: new Date().toISOString(),
            estoqueOkPor: userSession?.username || userSession?.nome || userSession?.email || 'sistema',
          }
        : r,
    );
    void saveEntity?.('comprasHistorico', updated);
  };

  const filteredItems = registros.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [item.itemNome, item.itemDescricao, item.centroCusto, item.solicitante, item.fornecedor, item.un]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const pendentes = filteredItems.filter((item) => item.purchaseState !== 'estoque');
  const confirmados = filteredItems.filter((item) => item.purchaseState === 'estoque');

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-violet-500 to-fuchsia-700 rounded-2xl shadow-lg shadow-violet-500/20 text-white">
            <Bell size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Itens para adicionar</h1>
            <p className="text-white/50 text-sm mt-1">Itens comprados que precisam ser adicionados ao estoque. Marque OK para mudar o status para Estoque.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white/40">
          <Package2 size={14} />
          Somente itens (produtos) comprados aparecem aqui
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Pendentes</p>
          <p className="text-white font-black text-3xl mt-2">{pendentes.length}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Em estoque</p>
          <p className="text-white font-black text-3xl mt-2">{confirmados.length}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Total de itens</p>
          <p className="text-white font-black text-3xl mt-2">{registros.length}</p>
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
                    <p className="text-white mt-1">{item.qtd} {item.un}</p>
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
            <h3 className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Itens em estoque</h3>
            <span className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-xs font-bold">{confirmados.length}</span>
          </div>

          <div className="space-y-3">
            {confirmados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-white/35 text-sm">Nenhum item em estoque ainda.</div>
            ) : confirmados.map((item) => (
              <article key={item.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-white font-bold text-sm">{item.itemDescricao || item.itemNome}</h4>
                    <p className="text-white/50 text-[11px] mt-1">Em estoque desde {item.estoqueOkEm ? new Date(item.estoqueOkEm).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 size={14} /> Estoque
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
