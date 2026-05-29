import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ShoppingCart, Undo2 } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import {
  approvalRouteLabel,
  formatCurrency,
  type QuoteItem,
  type ApprovalRoute,
  type RequisicaoCompra,
} from './comprasLocal';

const MOCK_GERENTE_COMERCIAL_EMAIL = 'gerente.comercial@linave.com.br';
const MOCK_DIRETOR_FINANCEIRO_EMAIL = 'diretor.financeiro@linave.com.br';

const isGerenteComercialEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.startsWith('comercial@') ||
    normalized.includes('gerente.comercial') ||
    (normalized.includes('gerente') && normalized.includes('comercial'))
  );
};

const isDiretorFinanceiroEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.startsWith('financeiro@') ||
    normalized.includes('diretor.financeiro') ||
    (normalized.includes('diretor') && normalized.includes('financeiro'))
  );
};

export function ComprasAprovacoesView({ searchQuery }: { searchQuery: string }) {
  const { userSession, compras, saveEntity } = useErp();
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => (Array.isArray(compras) ? compras : []));
  const [selectedRequest, setSelectedRequest] = useState<RequisicaoCompra | null>(null);

  useEffect(() => {
    void saveEntity?.('compras', requests || []);
  }, [requests, saveEntity]);

  useEffect(() => {
    if (Array.isArray(compras)) setRequests(compras);
  }, [compras]);

  const isAdmin = userSession?.role === 'ADMIN';
  const email = String(userSession?.email || '').toLowerCase();
  const isMockGerenteComercial = email === MOCK_GERENTE_COMERCIAL_EMAIL;
  const isMockDiretorFinanceiro = email === MOCK_DIRETOR_FINANCEIRO_EMAIL;

  const canApproveGerente = isAdmin || userSession?.permissoes?.aprovacoesComprasGerente === true || isMockGerenteComercial || isGerenteComercialEmail(email);
  const canApproveFinanceiro = isAdmin || userSession?.permissoes?.aprovacoesComprasFinanceiro === true || isMockDiretorFinanceiro || isDiretorFinanceiroEmail(email);

  const allowedRoutes = useMemo(() => {
    if (isAdmin) return ['gerenteComercial', 'diretorFinanceiro'] as const;

    const routes: Exclude<ApprovalRoute, null>[] = [];
    if (canApproveGerente) routes.push('gerenteComercial');
    if (canApproveFinanceiro) routes.push('diretorFinanceiro');
    return routes;
  }, [isAdmin, canApproveGerente, canApproveFinanceiro]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return requests
      .filter((request) => request.stage === 'APROVACAO')
      .filter((request) => {
        if (isAdmin) return true;
        return request.approvalRoute !== null && allowedRoutes.includes(request.approvalRoute);
      })
      .filter((request) => {
        if (!query) return true;

        const searchableText = [
          request.solicitante,
          request.departamento,
          request.centroCusto,
          request.approvalRoute ? approvalRouteLabel[request.approvalRoute] : '',
          request.budgetValue ? String(request.budgetValue) : '',
          ...request.itens.map((item) => item.descricao || item.nome),
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });
  }, [requests, searchQuery, isAdmin, allowedRoutes]);

  const patchRequest = (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    setRequests((current) => current.map((request) => (request.id === requestId ? updater(request) : request)));
  };

  const getDefaultItemPurchaseState = (naturezaFornecimento: 'ITEM' | 'SERVICO') => (
    naturezaFornecimento === 'ITEM' ? 'comprado' : 'contratado'
  );

  const handleApprove = (requestId: string) => {
    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'COMPRADOS',
      itens: request.itens.map((item) => ({
        ...item,
        purchaseState: item.purchaseState || getDefaultItemPurchaseState(item.naturezaFornecimento),
      })),
      purchaseState: request.purchaseState || 'comprado',
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

  const openRequestDetails = (requestId: string) => {
    const request = filteredRequests.find((item) => item.id === requestId) || null;
    setSelectedRequest(request);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-700 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
            <Clock3 size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Aprovações de Compras</h1>
            <p className="text-white/50 text-sm mt-1">Aprovação final por perfil: gerente comercial para valores menores que R$ 500 e diretor financeiro para valores a partir de R$ 500.</p>
          </div>
        </div>
      </div>

      <section className="bg-[#101f3d]/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">Pendentes para aprovação</h3>
          <span className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-xs font-bold">
            {filteredRequests.length} pendente(s)
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="bg-[#0b1220] text-xs font-bold text-white/40 uppercase tracking-wider text-left border-b border-white/10">
                <th className="p-4">Solicitante</th>
                <th className="p-4">Centro de custo</th>
                <th className="p-4 text-center">Itens</th>
                <th className="p-4">Rota de aprovação</th>
                <th className="p-4 text-right">Valor</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-white/35 text-sm" colSpan={6}>
                    Nenhuma solicitação pendente para o seu perfil no momento.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => openRequestDetails(request.id)}
                  >
                    <td className="p-4">
                      <p className="text-white font-semibold text-sm">{request.solicitante || '-'}</p>
                      <p className="text-white/40 text-xs mt-1">{new Date(request.createdAt).toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="p-4 text-white/80 text-sm">{request.centroCusto || '-'}</td>
                    <td className="p-4 text-center text-white/70 text-sm">{request.itens.length}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full border text-xs font-bold ${request.approvalRoute === 'diretorFinanceiro' ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : 'bg-orange-500/10 border-orange-500/20 text-orange-200'}`}>
                        {request.approvalRoute ? approvalRouteLabel[request.approvalRoute] : '-'}
                      </span>
                    </td>
                    <td className="p-4 text-right text-emerald-300 font-bold text-sm">{formatCurrency(request.budgetValue)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleReturnToSolicitations(request.id);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider"
                        >
                          <Undo2 size={14} /> Devolver
                        </button>
                        <button
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleApprove(request.id);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider"
                        >
                          <CheckCircle2 size={14} /> Aprovar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/45 flex items-center gap-2">
          <ShoppingCart size={14} />
          As aprovações desta tela movem automaticamente o pedido para a coluna Comprados no Kanban.
        </div>
      </section>

      {selectedRequest && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1220] shadow-2xl">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/35 font-black">Detalhamento da pendência</p>
                <h2 className="text-2xl font-black text-white mt-2">{selectedRequest.centroCusto || 'Solicitação de compras'}</h2>
                <p className="text-white/45 text-sm mt-1">{selectedRequest.solicitante || '-'} • {selectedRequest.departamento || '-'}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
              >
                Fechar
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-92px)] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Rota</p>
                  <p className="text-white font-semibold mt-2">{selectedRequest.approvalRoute ? approvalRouteLabel[selectedRequest.approvalRoute] : '-'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Valor total</p>
                  <p className="text-emerald-300 font-black text-xl mt-2">{formatCurrency(selectedRequest.budgetValue)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Itens</p>
                  <p className="text-white font-semibold mt-2">{selectedRequest.itens.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.3em] font-black">Data</p>
                  <p className="text-white font-semibold mt-2">{new Date(selectedRequest.createdAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] overflow-hidden">
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr className="bg-[#101826] text-xs font-bold text-white/40 uppercase tracking-wider text-left border-b border-white/10">
                      <th className="p-4">Item</th>
                      <th className="p-4">Natureza</th>
                      <th className="p-4">Descrição</th>
                      <th className="p-4 text-center">Qtd</th>
                      <th className="p-4">Un.</th>
                      <th className="p-4">Fornecedor selecionado</th>
                      <th className="p-4 text-right">Preço selecionado</th>
                      <th className="p-4">Menor valor</th>
                      <th className="p-4">Fornecedores orçados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedRequest.itens.map((item) => {
                      const detail = (selectedRequest.budgetDetails || []).find((entry) => entry.itemId === item.id) || null;
                      const suppliers = detail?.fornecedores || [];

                      return (
                        <tr key={item.id} className="align-top">
                          <td className="p-4 text-white font-semibold text-sm">{item.nome || '-'}</td>
                          <td className="p-4 text-amber-300 text-xs font-black uppercase tracking-widest">{detail?.naturezaFornecimento || item.naturezaFornecimento || 'SERVIÇO'}</td>
                          <td className="p-4 text-white/70 text-sm max-w-[260px]">{item.descricao || '-'}</td>
                          <td className="p-4 text-center text-white/80 text-sm">{item.qtd}</td>
                          <td className="p-4 text-white/80 text-sm">{item.un || '-'}</td>
                          <td className="p-4 text-white text-sm font-semibold">{detail?.fornecedorSelecionado || (detail?.jaEmEstoque ? 'Em estoque' : 'Aguardando seleção')}</td>
                          <td className="p-4 text-right text-emerald-300 text-sm font-bold">{detail?.valorSelecionado !== null && detail?.valorSelecionado !== undefined ? formatCurrency(detail.valorSelecionado) : '-'}</td>
                          <td className="p-4 text-white/80 text-sm">{detail?.menorValor !== null && detail?.menorValor !== undefined ? formatCurrency(detail.menorValor) : '-'}</td>
                          <td className="p-4 text-white/70 text-sm">
                            <div className="space-y-1">
                              {suppliers.length > 0 ? suppliers.map((supplier, index) => (
                                <div key={`${item.id}-${supplier.fornecedor}-${index}`} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                                  <p className="text-white font-medium">{supplier.fornecedor || '-'}</p>
                                  <p className="text-white/45 text-xs">{formatCurrency(supplier.valor)} • {supplier.prazoEntrega || 'Sem prazo'} • {supplier.condicaoPagamento || 'Sem condição'}</p>
                                </div>
                              )) : (
                                <span className="text-white/40">Sem orçamentos</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
