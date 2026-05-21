import React, { useEffect, useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { ArrowRight, CheckCircle2, CircleDollarSign, Package, Send, ShoppingCart, Users } from 'lucide-react';
import { BOARD_COLUMNS, formatCurrency, getStoredRequests, purchaseStateLabel, saveRequests, type PurchaseState, type RequisicaoCompra } from './comprasLocal';

export function ComprasKanbanView({ searchQuery }: { searchQuery: string }) {
  const { userSession } = useErp();
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => getStoredRequests());
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    saveRequests(requests);
  }, [requests]);

  const patchRequest = (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    setRequests((current) => current.map((request) => (request.id === requestId ? updater(request) : request)));
  };

  const handleSendToApproval = (requestId: string) => {
    const draft = budgetDrafts[requestId];
    const budgetValue = Number(draft);

    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      return window.alert('Informe um orçamento válido antes de enviar para aprovação.');
    }

    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'APROVACAO',
      approvalRoute: budgetValue > 500 ? 'gerente' : 'direta',
      budgetValue,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleApproveRequest = (requestId: string) => {
    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'COMPRADOS',
      purchaseState: request.purchaseState || 'comprado',
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangePurchaseState = (requestId: string, purchaseState: PurchaseState) => {
    patchRequest(requestId, (request) => ({
      ...request,
      purchaseState,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleReturnToSolicitations = (requestId: string) => {
    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'SOLICITACOES',
      approvalRoute: null,
      updatedAt: new Date().toISOString(),
    }));
  };

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return requests;

    return requests.filter((request) => {
      const searchableText = [
        request.solicitante,
        request.departamento,
        request.centroCusto,
        request.approvalRoute || '',
        purchaseStateLabel[request.purchaseState],
        ...request.itens.flatMap((item) => [item.nome, item.descricao, item.categoria, item.fornecedor, item.link]),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [requests, searchQuery]);

  const requestsByStage = useMemo(
    () => ({
      SOLICITACOES: filteredRequests.filter((request) => request.stage === 'SOLICITACOES'),
      APROVACAO: filteredRequests.filter((request) => request.stage === 'APROVACAO'),
      COMPRADOS: filteredRequests.filter((request) => request.stage === 'COMPRADOS'),
    }),
    [filteredRequests]
  );

  const temAcesso = userSession?.role === 'ADMIN' || userSession?.permissoes?.['kanbanCompras'] === true;

  if (!temAcesso) {
    return (
      <div className="bg-[#101f3d] p-12 rounded-[40px] border border-amber-500/20 text-center m-10">
        <p className="text-amber-400 font-black uppercase tracking-widest text-lg">Acesso Restrito</p>
        <p className="text-white/20 text-xs mt-2">O kanban de compras é visível apenas para o pessoal do setor de compras.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-sky-500 to-cyan-700 rounded-2xl shadow-lg shadow-sky-500/20 text-white">
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Kanban de Compras</h1>
            <p className="text-white/50 text-sm mt-1">Acompanhamento interno das solicitações, aprovações e compras concluídas.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white/40">
          <Users size={14} />
          <span>Somente a equipe de compras</span>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
          <div>
            <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">Fluxo interno</h3>
            <p className="text-white/35 text-xs mt-2 max-w-2xl">As solicitações entram em orçamento, passam por aprovação e depois seguem para o estado final de compra.</p>
          </div>
          <div className="text-xs text-white/35 uppercase tracking-widest flex items-center gap-2">
            <CircleDollarSign size={14} />
            Aprovação acima de R$ 500 vai para gerente
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          {BOARD_COLUMNS.map((column) => {
            const ColumnIcon = column.icon;
            const cards = requestsByStage[column.id];

            return (
              <div key={column.id} className={`rounded-3xl border bg-gradient-to-b ${column.accent} p-4 min-h-[360px]`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-white">
                      <ColumnIcon size={18} />
                    </div>
                    <div>
                      <h4 className="text-white font-black uppercase text-sm tracking-wider">{column.title}</h4>
                      <p className="text-white/45 text-[11px] mt-1">{column.subtitle}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-[11px] font-bold">
                    {cards.length}
                  </div>
                </div>

                <div className="space-y-3 max-h-[860px] overflow-y-auto pr-1">
                  {cards.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-white/35 text-sm">
                      Nenhuma requisição nesta coluna.
                    </div>
                  ) : cards.map((request) => {
                    const budgetDraft = budgetDrafts[request.id] ?? (request.budgetValue ? String(request.budgetValue) : '');

                    return (
                      <article key={request.id} className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-4 shadow-lg shadow-black/10 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-white font-bold text-sm leading-tight">{request.centroCusto}</h5>
                            <p className="text-white/45 text-[11px] mt-1">{request.solicitante} • {request.departamento}</p>
                          </div>
                          <button
                            className="text-white/20 hover:text-white/60 transition-colors"
                            title="Voltar para solicitações"
                            onClick={() => handleReturnToSolicitations(request.id)}
                          >
                            <ArrowRight size={14} className="rotate-180" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/45">{request.itens.length} item(ns)</span>
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/45">{new Date(request.createdAt).toLocaleDateString('pt-BR')}</span>
                          {request.stage === 'APROVACAO' && (
                            <span className={`px-2 py-1 rounded-full border ${request.approvalRoute === 'gerente' ? 'bg-orange-500/10 border-orange-500/20 text-orange-200' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'}`}>
                              {request.approvalRoute === 'gerente' ? 'Gerente' : 'Direta'}
                            </span>
                          )}
                          {request.stage === 'COMPRADOS' && (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">{purchaseStateLabel[request.purchaseState]}</span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {request.itens.map((item) => (
                            <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-white text-sm font-semibold">{item.nome}</p>
                                  <p className="text-white/40 text-[11px] mt-1">{item.descricao || 'Sem descrição'}</p>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest text-amber-300/80 font-bold">{item.qtd} {item.un}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[10px] text-white/35">
                                {item.categoria && <span className="px-2 py-1 rounded-full bg-white/5">{item.categoria}</span>}
                                {item.fornecedor && <span className="px-2 py-1 rounded-full bg-white/5">{item.fornecedor}</span>}
                                {item.dataDesejada && <span className="px-2 py-1 rounded-full bg-white/5">{item.dataDesejada}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {request.stage === 'SOLICITACOES' && (
                          <div className="space-y-2 pt-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Orçamento do pedido</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full bg-[#101826] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-amber-500"
                              value={budgetDraft}
                              onChange={(event) => setBudgetDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                              placeholder="Informe o valor total"
                            />
                            <button
                              onClick={() => handleSendToApproval(request.id)}
                              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                            >
                              <Send size={14} /> Enviar para aprovação
                            </button>
                          </div>
                        )}

                        {request.stage === 'APROVACAO' && (
                          <div className="space-y-2 pt-1">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-sm">
                              <span className="text-white/45 uppercase tracking-widest text-[10px] font-bold">Orçamento</span>
                              <strong className="text-white">{formatCurrency(request.budgetValue || 0)}</strong>
                            </div>
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                            >
                              <CheckCircle2 size={14} /> {request.approvalRoute === 'gerente' ? 'Aprovar no gerente' : 'Aprovar direto'}
                            </button>
                          </div>
                        )}

                        {request.stage === 'COMPRADOS' && (
                          <div className="space-y-2 pt-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Estado do item</label>
                            <select
                              className="w-full bg-[#101826] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 cursor-pointer"
                              value={request.purchaseState}
                              onChange={(event) => handleChangePurchaseState(request.id, event.target.value as PurchaseState)}
                            >
                              <option value="comprado">Comprado</option>
                              <option value="entregue">Entregue</option>
                              <option value="estoque">Estoque</option>
                            </select>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-widest text-white/45 font-bold">
                              <span>Pronto para acompanhamento</span>
                              <Package size={14} />
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <style>{`
        .input-table {
          @apply w-full bg-transparent border border-transparent p-2 rounded-lg text-sm outline-none focus:bg-[#0b1220] focus:border-amber-500/50 transition-all placeholder:text-white/10 focus:shadow-lg;
        }
      `}</style>
    </div>
  );
}
