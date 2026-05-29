import React, { useEffect, useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { ArrowRight, CheckCircle2, CircleDollarSign, Eye, Package, Plus, Send, ShoppingCart, Trash2, Users, X } from 'lucide-react';
import {
  APPROVAL_LIMIT,
  BOARD_COLUMNS,
  approvalRouteLabel,
  formatCurrency,
  purchaseStateLabel,
  resolveApprovalRoute,
  type PurchaseState,
  type QuoteFornecedor,
  type QuoteItem,
  type RequisicaoCompra,
} from './comprasLocal';

type QuoteSupplierDraft = {
  id: string;
  fornecedor: string;
  valor: string;
  prazoEntrega: string;
  condicaoPagamento: string;
};

type QuoteRowDraft = {
  itemId: string;
  itemLabel: string;
  fornecedores: QuoteSupplierDraft[];
  jaEmEstoque: boolean;
};

type QuoteModalState = {
  requestId: string;
  mode: 'edit' | 'view';
} | null;

const createSupplierDraft = (seed?: Partial<QuoteSupplierDraft>): QuoteSupplierDraft => ({
  id: seed?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  fornecedor: seed?.fornecedor || '',
  valor: seed?.valor || '',
  prazoEntrega: seed?.prazoEntrega || '',
  condicaoPagamento: seed?.condicaoPagamento || '',
});

const ensureMinimumSuppliers = (suppliers: QuoteSupplierDraft[]) => {
  const base = [...suppliers];
  while (base.length < 3) {
    base.push(createSupplierDraft());
  }
  return base;
};

const resolveNaturezaFromSupplierName = (supplierName: string, supplierCatalog: any[]): 'ITEM' | 'SERVICO' => {
  const supplier = supplierCatalog.find((entry) => String(entry?.razaoSocial || '') === supplierName);
  return supplier?.naturezaFornecimento === 'ITEM' ? 'ITEM' : 'SERVICO';
};

  const getItemPurchaseStateOptions = (naturezaFornecimento: 'ITEM' | 'SERVICO') => (
    naturezaFornecimento === 'ITEM'
      ? (['comprado', 'entregue', 'estoque'] as PurchaseState[])
      : (['contratado'] as PurchaseState[])
  );

  const getDefaultItemPurchaseState = (naturezaFornecimento: 'ITEM' | 'SERVICO') => (
    naturezaFornecimento === 'ITEM' ? 'comprado' : 'contratado'
  );

const buildDraftRows = (request: RequisicaoCompra): QuoteRowDraft[] =>
  request.itens.map((item) => {
    const existing = (request.budgetDetails || []).find((detail) => detail.itemId === item.id);

    return {
      itemId: item.id,
      itemLabel: item.descricao || item.nome,
      jaEmEstoque: Boolean(existing?.jaEmEstoque),
      fornecedores: ensureMinimumSuppliers(
        (existing?.fornecedores || []).map((supplier, index) =>
          createSupplierDraft({
            id: `${item.id}-${index}`,
            fornecedor: supplier.fornecedor,
            valor: supplier.valor ? String(supplier.valor) : '',
            prazoEntrega: supplier.prazoEntrega,
            condicaoPagamento: supplier.condicaoPagamento,
          })
        )
      ),
    };
  });

const parseCurrencyInput = (value: string) => {
  const normalized = value.replace(',', '.').trim();
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const calculateSelectedBudgetValue = (details: QuoteItem[]) => {
  if (details.length === 0) return null;

  const pendingSelection = details.some((detail) => !detail.jaEmEstoque && (!detail.fornecedorSelecionado || detail.valorSelecionado === null));
  if (pendingSelection) return null;

  return details.reduce((sum, detail) => sum + (detail.jaEmEstoque ? 0 : (detail.valorSelecionado || 0)), 0);
};

const calculateBudgetDetails = (
  rows: QuoteRowDraft[],
  previousDetails: QuoteItem[] = [],
  supplierCatalog: any[] = []
) => {
  const details: QuoteItem[] = rows.map((row) => {
    const fornecedores: QuoteFornecedor[] = row.fornecedores.map((supplier) => ({
      fornecedor: supplier.fornecedor.trim(),
      valor: parseCurrencyInput(supplier.valor),
      prazoEntrega: supplier.prazoEntrega.trim(),
      condicaoPagamento: supplier.condicaoPagamento.trim(),
    }));

    const validQuotes = fornecedores.filter((entry) => entry.fornecedor && entry.valor > 0);
    const winner = validQuotes.length > 0
      ? validQuotes.reduce((lowest, current) => (current.valor < lowest.valor ? current : lowest), validQuotes[0])
      : null;
    const previousSelection = previousDetails.find((detail) => detail.itemId === row.itemId)?.fornecedorSelecionado || '';
    const selectedQuote = fornecedores.find((entry) => entry.fornecedor === previousSelection) || null;
    const selectedNatureza = selectedQuote
      ? resolveNaturezaFromSupplierName(selectedQuote.fornecedor, supplierCatalog)
      : previousDetails.find((detail) => detail.itemId === row.itemId)?.naturezaFornecimento || 'SERVICO';
    const winnerNatureza = winner ? resolveNaturezaFromSupplierName(winner.fornecedor, supplierCatalog) : 'SERVICO';

    return {
      itemId: row.itemId,
      naturezaFornecimento: selectedQuote ? selectedNatureza : winnerNatureza,
      fornecedores,
      menorValor: winner ? winner.valor : null,
      fornecedorVencedor: winner ? winner.fornecedor : '',
      fornecedorSelecionado: selectedQuote?.fornecedor || '',
      valorSelecionado: selectedQuote ? selectedQuote.valor : null,
      prazoEntregaSelecionado: selectedQuote?.prazoEntrega || '',
      condicaoPagamentoSelecionada: selectedQuote?.condicaoPagamento || '',
      jaEmEstoque: row.jaEmEstoque,
    };
  });

  const total = calculateSelectedBudgetValue(details);

  return { details, total };
};

export function ComprasKanbanView({ searchQuery }: { searchQuery: string }) {
  const { userSession, fornecedores, compras, saveEntity } = useErp();
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => (Array.isArray(compras) ? compras : []));
  const [quoteModal, setQuoteModal] = useState<QuoteModalState>(null);
  const [quoteRows, setQuoteRows] = useState<Record<string, QuoteRowDraft[]>>({});

  const supplierOptions = useMemo(
    () => (Array.isArray(fornecedores) ? fornecedores : []).filter((supplier: any) => supplier?.razaoSocial),
    [fornecedores]
  );

  // persist requests to workspace so other users (gerente / diretor) see them
  useEffect(() => {
    void saveEntity?.('compras', requests || []);
  }, [requests, saveEntity]);

  // update local state when workspace compras changes
  useEffect(() => {
    if (Array.isArray(compras)) setRequests(compras);
  }, [compras]);

  const activeRequest = useMemo(
    () => (quoteModal ? requests.find((request) => request.id === quoteModal.requestId) || null : null),
    [requests, quoteModal]
  );

  const patchRequest = (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    setRequests((current) => current.map((request) => (request.id === requestId ? updater(request) : request)));
  };

  const openQuoteModal = (requestId: string, mode: 'edit' | 'view') => {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;

    setQuoteRows((current) => ({
      ...current,
      [requestId]: buildDraftRows(request),
    }));
    setQuoteModal({ requestId, mode });
  };

  const closeQuoteModal = () => setQuoteModal(null);

  const updateQuoteSupplier = (requestId: string, itemId: string, supplierId: string, field: keyof QuoteSupplierDraft, value: string) => {
    setQuoteRows((current) => ({
      ...current,
      [requestId]: (current[requestId] || []).map((row) => {
        if (row.itemId !== itemId) return row;
        return {
          ...row,
          fornecedores: row.fornecedores.map((supplier) => (supplier.id === supplierId ? { ...supplier, [field]: value } : supplier)),
        };
      }),
    }));
  };

  const addQuoteSupplier = (requestId: string, itemId: string) => {
    setQuoteRows((current) => ({
      ...current,
      [requestId]: (current[requestId] || []).map((row) => {
        if (row.itemId !== itemId) return row;
        return {
          ...row,
          fornecedores: [...row.fornecedores, createSupplierDraft()],
        };
      }),
    }));
  };

  const removeQuoteSupplier = (requestId: string, itemId: string, supplierId: string) => {
    setQuoteRows((current) => ({
      ...current,
      [requestId]: (current[requestId] || []).map((row) => {
        if (row.itemId !== itemId) return row;
        const next = row.fornecedores.filter((supplier) => supplier.id !== supplierId);
        return {
          ...row,
          fornecedores: ensureMinimumSuppliers(next),
        };
      }),
    }));
  };

  const toggleQuoteItemStock = (requestId: string, itemId: string, jaEmEstoque: boolean) => {
    setQuoteRows((current) => ({
      ...current,
      [requestId]: (current[requestId] || []).map((row) => {
        if (row.itemId !== itemId) return row;

        return {
          ...row,
          jaEmEstoque,
          fornecedores: jaEmEstoque ? row.fornecedores : ensureMinimumSuppliers(row.fornecedores),
        };
      }),
    }));
  };

  const handleSaveQuote = () => {
    if (!activeRequest || !quoteModal) return;

    if (supplierOptions.length === 0) {
      return window.alert('Cadastre fornecedores na página de Fornecedores antes de orçar.');
    }

    const rows = quoteRows[activeRequest.id] || [];
    if (rows.length === 0) {
      return window.alert('Nenhum item encontrado para cotação.');
    }

    for (const row of rows) {
      if (!row.jaEmEstoque && row.fornecedores.length < 3) {
        return window.alert('Cada item precisa ter no mínimo 3 fornecedores para salvar a cotação.');
      }

      if (!row.jaEmEstoque) {
        for (const supplier of row.fornecedores) {
          if (!supplier.fornecedor || !supplier.valor || !supplier.prazoEntrega || !supplier.condicaoPagamento) {
            return window.alert('Preencha fornecedor, valor, prazo de entrega e condição de pagamento em cada fornecedor do item.');
          }
        }
      }
    }

    const { details, total } = calculateBudgetDetails(rows, activeRequest?.budgetDetails || [], supplierOptions);
    const itensAtualizados = activeRequest.itens.map((item) => {
      const detail = details.find((entry) => entry.itemId === item.id);
      return {
        ...item,
        naturezaFornecimento: detail?.naturezaFornecimento || item.naturezaFornecimento || 'SERVICO',
      };
    });

    patchRequest(activeRequest.id, (request) => ({
      ...request,
      itens: itensAtualizados,
      budgetDetails: details,
      budgetValue: total,
      updatedAt: new Date().toISOString(),
    }));

    closeQuoteModal();
  };

  const handleSendToApproval = (requestId: string) => {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;

    if ((request.budgetDetails || []).length === 0) {
      return window.alert('Faça a cotação completa antes de enviar para aprovação.');
    }

    const hasAllSelections = (request.budgetDetails || []).every((detail) => detail.jaEmEstoque || (detail.fornecedorSelecionado && detail.valorSelecionado !== null));
    if (!hasAllSelections || !request.budgetValue || request.budgetValue <= 0) {
      return window.alert('Selecione manualmente o fornecedor de cada item que não estiver em estoque antes de enviar para aprovação.');
    }

    patchRequest(requestId, (current) => ({
      ...current,
      stage: 'APROVACAO',
      approvalRoute: resolveApprovalRoute(current.budgetValue),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSendToSelection = (requestId: string) => {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;

    if ((request.budgetDetails || []).length === 0) {
      return window.alert('Faça a cotação completa antes de enviar para seleção do gerente.');
    }

    patchRequest(requestId, (current) => ({
      ...current,
      stage: 'SELECAO_GERENTE',
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangePurchaseState = (requestId: string, itemId: string, purchaseState: PurchaseState) => {
    patchRequest(requestId, (request) => ({
      ...request,
      itens: request.itens.map((item) => (
        item.id === itemId
          ? { ...item, purchaseState }
          : item
      )),
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

  const handleDeleteRequest = (requestId: string) => {
    const shouldDelete = window.confirm('Deseja excluir este card de compras? Esta ação não poderá ser desfeita.');
    if (!shouldDelete) return;

    setRequests((current) => current.filter((request) => request.id !== requestId));
    setQuoteRows((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });

    if (quoteModal?.requestId === requestId) {
      setQuoteModal(null);
    }
  };

  const handleSelectSupplier = (requestId: string, itemId: string, fornecedorSelecionado: string) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    if (req.stage !== 'SELECAO_GERENTE') {
      window.alert('A seleção de fornecedor só pode ser feita na etapa Seleção do Gerente.');
      return;
    }

    setRequests((current) => current.map((request) => {
      if (request.id !== requestId) return request;

      const nextDetails = (request.budgetDetails || []).map((detail) => {
        if (detail.itemId !== itemId) return detail;

        if (detail.jaEmEstoque) return detail;

        const selectedQuote = detail.fornecedores.find((entry) => entry.fornecedor === fornecedorSelecionado) || null;
        const naturezaFornecimento = selectedQuote
          ? resolveNaturezaFromSupplierName(selectedQuote.fornecedor, supplierOptions)
          : detail.naturezaFornecimento || 'SERVICO';

        return {
          ...detail,
          naturezaFornecimento,
          fornecedorSelecionado: selectedQuote?.fornecedor || '',
          valorSelecionado: selectedQuote ? selectedQuote.valor : null,
          prazoEntregaSelecionado: selectedQuote?.prazoEntrega || '',
          condicaoPagamentoSelecionada: selectedQuote?.condicaoPagamento || '',
        };
      });

      return {
        ...request,
        budgetDetails: nextDetails,
        budgetValue: calculateSelectedBudgetValue(nextDetails),
        updatedAt: new Date().toISOString(),
      };
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
        request.budgetValue ? String(request.budgetValue) : '',
        ...request.itens.flatMap((item) => [item.nome, item.descricao, item.categoria, item.fornecedor, item.link]),
        ...((request.budgetDetails || []).flatMap((detail) =>
          detail.fornecedores.flatMap((supplier) => [
            supplier.fornecedor,
            String(supplier.valor || ''),
            supplier.prazoEntrega,
            supplier.condicaoPagamento,
          ])
        )),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [requests, searchQuery]);

  const requestsByStage = useMemo(
    () => ({
      SOLICITACOES: filteredRequests.filter((request) => request.stage === 'SOLICITACOES'),
      SELECAO_GERENTE: filteredRequests.filter((request) => request.stage === 'SELECAO_GERENTE'),
      APROVACAO: filteredRequests.filter((request) => request.stage === 'APROVACAO'),
      COMPRADOS: filteredRequests.filter((request) => request.stage === 'COMPRADOS'),
    }),
    [filteredRequests]
  );

  const modalRequest = quoteModal ? requests.find((request) => request.id === quoteModal.requestId) || null : null;
  const modalRows = modalRequest ? quoteRows[modalRequest.id] || buildDraftRows(modalRequest) : [];
  const modalSummary = calculateBudgetDetails(modalRows, activeRequest?.budgetDetails || [], supplierOptions);

  return (
    <>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gradient-to-br from-sky-500 to-cyan-700 rounded-2xl shadow-lg shadow-sky-500/20 text-white">
              <ShoppingCart size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Kanban de Orçamento</h1>
              <p className="text-white/50 text-sm mt-1">Cotação por item com fornecedores, prazo de entrega, condição de pagamento e total pelo menor valor.</p>
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
              <p className="text-white/35 text-xs mt-2 max-w-2xl">Cada item precisa de no mínimo 3 fornecedores para a cotação ser salva. Você pode adicionar mais fornecedores por item.</p>
            </div>
            <div className="text-xs text-white/35 uppercase tracking-widest flex items-center gap-2">
              <CircleDollarSign size={14} />
              Abaixo de R$ {APPROVAL_LIMIT} vai para gerente comercial e a partir de R$ {APPROVAL_LIMIT} para diretor financeiro
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
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
                    ) : cards.map((request) => (
                      <article key={request.id} className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-4 shadow-lg shadow-black/10 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-white font-bold text-sm leading-tight">{request.centroCusto}</h5>
                            <p className="text-white/45 text-[11px] mt-1">{request.solicitante} • {request.departamento || 'Solicitação de compras'}</p>
                          </div>
                          <button className="text-white/20 hover:text-white/60 transition-colors" title="Voltar para solicitações" onClick={() => handleReturnToSolicitations(request.id)}>
                            <ArrowRight size={14} className="rotate-180" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/45">{request.itens.length} item(ns)</span>
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/45">{new Date(request.createdAt).toLocaleDateString('pt-BR')}</span>
                          {request.budgetValue ? (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">Total {formatCurrency(request.budgetValue)}</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/35">Sem orçamento</span>
                          )}
                          {request.stage === 'APROVACAO' && (
                            <span className={`px-2 py-1 rounded-full border ${request.approvalRoute === 'diretorFinanceiro' ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : 'bg-orange-500/10 border-orange-500/20 text-orange-200'}`}>
                              {request.approvalRoute ? approvalRouteLabel[request.approvalRoute] : 'Sem rota'}
                            </span>
                          )}
                          {request.stage === 'COMPRADOS' && (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">Compras</span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {request.itens.map((item) => {
                            const itemDetail = (request.budgetDetails || []).find((detail) => detail.itemId === item.id) || null;

                            return (
                              <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-white text-sm font-semibold">{item.descricao || item.nome}</p>
                                    <p className="text-white/40 text-[11px] mt-1">{item.qtd} {item.un}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] uppercase tracking-widest text-amber-300/80 font-bold block">{item.qtd} {item.un}</span>
                                    <span className="text-[10px] uppercase tracking-widest text-violet-300/80 font-black">{itemDetail?.naturezaFornecimento === 'ITEM' ? 'ITEM' : 'SERVIÇO'}</span>
                                  </div>
                                </div>

                                {itemDetail ? (
                                  <div className="space-y-2">
                                    {(() => {
                                      const quotedSuppliers = itemDetail.fornecedores.filter((supplier) => supplier.fornecedor.trim() && supplier.valor > 0);

                                      return (
                                        <>
                                    {request.stage === 'SELECAO_GERENTE' ? (
                                      <>
                                        <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-black">Fornecedor da aprovação</label>
                                        <select
                                          className="w-full rounded-xl border border-white/10 bg-[#101826] p-3 text-white text-sm outline-none focus:border-amber-500 cursor-pointer"
                                          value={itemDetail.fornecedorSelecionado}
                                          onChange={(event) => handleSelectSupplier(request.id, item.id, event.target.value)}
                                          disabled={itemDetail.jaEmEstoque}
                                        >
                                          <option value="">{itemDetail.jaEmEstoque ? 'Item já em estoque' : 'Selecione um fornecedor orçado'}</option>
                                          {quotedSuppliers.map((supplier, supplierIndex) => (
                                            <option key={`${item.id}-${supplier.fornecedor}-${supplierIndex}`} value={supplier.fornecedor}>
                                              {supplier.fornecedor} - {formatCurrency(supplier.valor)}
                                            </option>
                                          ))}
                                        </select>
                                      </>
                                    ) : request.stage === 'APROVACAO' || request.stage === 'COMPRADOS' ? (
                                      <div>
                                        <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-black">Selecionado</label>
                                        <p className="text-white text-sm mt-1">{itemDetail.fornecedorSelecionado ? itemDetail.fornecedorSelecionado : 'Aguardando seleção do gerente'}</p>
                                      </div>
                                    ) : null}

                                    <div className="flex flex-wrap gap-2 text-[10px] text-white/35">
                                      <span className="px-2 py-1 rounded-full bg-white/5">{quotedSuppliers.length} fornecedores</span>
                                      <span className="px-2 py-1 rounded-full bg-white/5">{itemDetail.fornecedorSelecionado ? `Selecionado: ${itemDetail.fornecedorSelecionado}` : itemDetail.jaEmEstoque ? 'Em estoque' : 'Seleção pendente'}</span>
                                      <span className="px-2 py-1 rounded-full bg-white/5">{itemDetail.valorSelecionado ? formatCurrency(itemDetail.valorSelecionado) : itemDetail.jaEmEstoque ? 'Sem orçamento' : 'Valor pendente'}</span>
                                    </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-3 text-white/35 text-xs">
                                    Este item ainda não foi orçado.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {request.stage === 'SOLICITACOES' && (
                          <div className="space-y-2 pt-1">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-sm">
                              <span className="text-white/45 uppercase tracking-widest text-[10px] font-bold">Total do orçamento</span>
                              <strong className="text-white">{request.budgetValue ? formatCurrency(request.budgetValue) : 'Seleção pendente'}</strong>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => openQuoteModal(request.id, 'edit')} className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all">
                                <Package size={14} /> Orçar
                              </button>
                              <button onClick={() => openQuoteModal(request.id, 'view')} disabled={!(request.budgetDetails || []).length} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                <Eye size={14} /> Ver orçamento
                              </button>
                            </div>
                            <button onClick={() => handleSendToSelection(request.id)} className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed" disabled={(request.budgetDetails || []).length === 0}>
                              <Users size={14} /> Enviar para seleção do gerente
                            </button>
                          </div>
                        )}

                        {request.stage === 'SELECAO_GERENTE' && (
                          <div className="space-y-2 pt-1">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-sm">
                              <span className="text-white/45 uppercase tracking-widest text-[10px] font-bold">Orçamento</span>
                              <strong className="text-white">{request.budgetValue ? formatCurrency(request.budgetValue) : 'Seleção pendente'}</strong>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => openQuoteModal(request.id, 'edit')} className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all">
                                <Package size={14} /> Ajustar/Selecionar
                              </button>
                              <button onClick={() => openQuoteModal(request.id, 'view')} disabled={!(request.budgetDetails || []).length} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                <Eye size={14} /> Ver orçamento
                              </button>
                            </div>
                            <button onClick={() => handleSendToApproval(request.id)} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed" disabled={(request.budgetDetails || []).length === 0 || !(request.budgetDetails || []).every((detail) => detail.jaEmEstoque || (detail.fornecedorSelecionado && detail.valorSelecionado !== null))}>
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
                            <div className="grid grid-cols-1 gap-2">
                              <button onClick={() => openQuoteModal(request.id, 'view')} disabled={!(request.budgetDetails || []).length} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                <Eye size={14} /> Detalhar
                              </button>
                            </div>
                            <p className="text-[11px] text-white/40 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                              A aprovação final é feita na tela de Aprovações.
                            </p>
                          </div>
                        )}

                        {request.stage === 'COMPRADOS' && (
                          <div className="space-y-2 pt-1">
                            <div className="space-y-3">
                              {request.itens.map((item) => (
                                <div key={`${request.id}-${item.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-white text-sm font-semibold">{item.descricao || item.nome}</p>
                                      <p className="text-white/40 text-[11px] mt-1">{item.naturezaFornecimento === 'ITEM' ? 'Item' : 'Serviço'}</p>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-widest text-violet-300/80 font-black">{purchaseStateLabel[item.purchaseState]}</span>
                                  </div>
                                  <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Estado de compra</label>
                                  <select
                                    className="w-full bg-[#101826] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 cursor-pointer"
                                    value={item.purchaseState}
                                    onChange={(event) => handleChangePurchaseState(request.id, item.id, event.target.value as PurchaseState)}
                                  >
                                    {getItemPurchaseStateOptions(item.naturezaFornecimento).map((state) => (
                                      <option key={state} value={state}>
                                        {purchaseStateLabel[state]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => handleDeleteRequest(request.id)} className="w-full flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all">
                              <Trash2 size={14} /> Excluir card
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {quoteModal && activeRequest && (
        <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1220] shadow-2xl">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/35 font-black">Documento de Cotação</p>
                <h2 className="text-2xl font-black text-white mt-2">{quoteModal.mode === 'edit' ? 'Orçar solicitação' : 'Detalhamento do orçamento'}</h2>
                <p className="text-white/45 text-sm mt-1">{activeRequest.centroCusto}</p>
              </div>
              <button onClick={closeQuoteModal} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-92px)] space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Solicitante</p>
                  <p className="text-white font-semibold mt-2">{activeRequest.solicitante}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Itens</p>
                  <p className="text-white font-semibold mt-2">{activeRequest.itens.length} item(ns)</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Total calculado</p>
                  <p className="text-emerald-300 font-black text-xl mt-2">{formatCurrency(modalSummary.total)}</p>
                </div>
              </div>

              {quoteModal.mode === 'edit' && supplierOptions.length === 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200 text-sm">Nenhum fornecedor cadastrado. Cadastre fornecedores na página de Fornecedores para liberar os dropdowns de cotação.</div>
              )}

              <div className="space-y-4">
                {modalRows.map((row) => {
                  const rowSummary = calculateBudgetDetails([row], activeRequest?.budgetDetails || [], supplierOptions).details[0];

                  return (
                    <div key={row.itemId} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-white font-black text-lg">{row.itemLabel}</h3>
                          <p className="text-white/35 text-xs mt-1">Adicione no mínimo 3 fornecedores. Você pode inserir mais fornecedores para este item.</p>
                        </div>
                        {quoteModal.mode === 'edit' && !row.jaEmEstoque && (
                          <button onClick={() => addQuoteSupplier(activeRequest.id, row.itemId)} className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors">
                            <Plus size={14} /> Adicionar fornecedor
                          </button>
                        )}
                      </div>

                      {quoteModal.mode === 'edit' && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-black">Já em estoque</p>
                            <p className="text-white/35 text-[11px] mt-1">Marque se este item já existe no estoque e não precisa de orçamento.</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={row.jaEmEstoque}
                            onChange={(event) => toggleQuoteItemStock(activeRequest.id, row.itemId, event.target.checked)}
                            className="h-5 w-5 accent-emerald-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {row.jaEmEstoque && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-100 text-xs font-semibold">
                          Item já em estoque. Este item não precisa de orçamento.
                        </div>
                      )}

                      <div className="space-y-3">
                        {row.fornecedores.map((supplier) => (
                          <div key={supplier.id} className="rounded-2xl border border-white/10 bg-[#101826] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-black">Fornecedor</span>
                              {quoteModal.mode === 'edit' && row.fornecedores.length > 3 && !row.jaEmEstoque && (
                                <button onClick={() => removeQuoteSupplier(activeRequest.id, row.itemId, supplier.id)} className="text-white/30 hover:text-red-400 transition-colors" title="Remover fornecedor">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                              {quoteModal.mode === 'edit' ? (
                                <>
                                  <select
                                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] p-3 text-white text-sm outline-none focus:border-amber-500 cursor-pointer"
                                    value={supplier.fornecedor}
                                    onChange={(event) => updateQuoteSupplier(activeRequest.id, row.itemId, supplier.id, 'fornecedor', event.target.value)}
                                    disabled={row.jaEmEstoque}
                                  >
                                    <option value="">Selecione um fornecedor</option>
                                    {supplierOptions.map((option: any, optionIndex) => (
                                      <option key={option.id || `${option.razaoSocial}-${optionIndex}`} value={option.razaoSocial}>
                                        {option.razaoSocial}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] p-3 text-white text-sm outline-none focus:border-emerald-500"
                                    placeholder="Valor"
                                    value={supplier.valor}
                                    onChange={(event) => updateQuoteSupplier(activeRequest.id, row.itemId, supplier.id, 'valor', event.target.value)}
                                    disabled={row.jaEmEstoque}
                                  />
                                  <input
                                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] p-3 text-white text-sm outline-none focus:border-sky-500"
                                    placeholder="Prazo de entrega"
                                    value={supplier.prazoEntrega}
                                    onChange={(event) => updateQuoteSupplier(activeRequest.id, row.itemId, supplier.id, 'prazoEntrega', event.target.value)}
                                    disabled={row.jaEmEstoque}
                                  />
                                  <input
                                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] p-3 text-white text-sm outline-none focus:border-cyan-500"
                                    placeholder="Condição de pagamento"
                                    value={supplier.condicaoPagamento}
                                    onChange={(event) => updateQuoteSupplier(activeRequest.id, row.itemId, supplier.id, 'condicaoPagamento', event.target.value)}
                                    disabled={row.jaEmEstoque}
                                  />
                                </>
                              ) : (
                                <>
                                  <div>
                                    <p className="text-white font-semibold">{supplier.fornecedor || '-'}</p>
                                    <p className="text-white/45 text-xs mt-1">{supplier.prazoEntrega || 'Sem prazo'}</p>
                                  </div>
                                  <div>
                                    <p className="text-white font-semibold">{supplier.valor ? formatCurrency(parseCurrencyInput(supplier.valor)) : '-'}</p>
                                    <p className="text-white/45 text-xs mt-1">{supplier.condicaoPagamento || 'Sem condição'}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/35 text-[10px] uppercase tracking-[0.2em] font-black">Prazo de entrega</p>
                                    <p className="text-white text-sm mt-1">{supplier.prazoEntrega || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/35 text-[10px] uppercase tracking-[0.2em] font-black">Pagamento</p>
                                    <p className="text-white text-sm mt-1">{supplier.condicaoPagamento || '-'}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-emerald-500/10 p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-emerald-200 font-black text-lg">{rowSummary?.jaEmEstoque ? 'Em estoque' : rowSummary?.menorValor ? formatCurrency(rowSummary.menorValor) : '-'}</p>
                          <p className="text-white/45 text-xs mt-1">{rowSummary?.jaEmEstoque ? 'Item dispensado de orçamento' : `Fornecedor vencedor: ${rowSummary?.fornecedorVencedor || 'Sem cotação válida'}`}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-[0.25em] text-white/45 font-black">Fornecedores</p>
                          <p className="text-white font-bold mt-1">{row.jaEmEstoque ? 'N/A' : row.fornecedores.length}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {quoteModal.mode === 'view' && (activeRequest?.budgetDetails || []).length > 0 && (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 space-y-3">
                  <p className="text-white font-black uppercase tracking-[0.25em] text-[10px]">Resumo da cotação</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(activeRequest?.budgetDetails || []).map((detail, index) => (
                      <div key={detail.itemId} className="rounded-2xl border border-white/10 bg-[#101826] p-4 space-y-2">
                        <p className="text-white font-semibold text-sm">Item {index + 1}</p>
                        <p className="text-white/45 text-xs">{detail.jaEmEstoque ? 'Já em estoque' : `Fornecedor vencedor: ${detail.fornecedorVencedor || '-'}`}</p>
                        <p className="text-emerald-300 font-black text-lg">{detail.jaEmEstoque ? 'Sem orçamento' : detail.menorValor ? formatCurrency(detail.menorValor) : '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-3 justify-end pt-2">
                <button onClick={closeQuoteModal} className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors font-bold text-xs uppercase tracking-wider">
                  Fechar
                </button>
                {quoteModal.mode === 'edit' ? (
                  <button onClick={handleSaveQuote} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 justify-center">
                    <Package size={14} /> Salvar orçamento
                  </button>
                ) : (
                  <button onClick={closeQuoteModal} className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 justify-center">
                    <Eye size={14} /> Voltar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}