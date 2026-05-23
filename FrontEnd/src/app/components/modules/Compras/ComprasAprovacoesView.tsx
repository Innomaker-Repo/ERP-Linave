import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ShoppingCart, Undo2 } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import {
  approvalRouteLabel,
  formatCurrency,
  getStoredRequests,
  saveRequests,
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
  const { userSession } = useErp();
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => getStoredRequests());

  useEffect(() => {
    saveRequests(requests);
  }, [requests]);

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

  const canAccess = isAdmin || allowedRoutes.length > 0;

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

  const handleApprove = (requestId: string) => {
    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'COMPRADOS',
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

  if (!canAccess) {
    return (
      <div className="bg-[#101f3d] p-12 rounded-[40px] border border-amber-500/20 text-center m-10">
        <p className="text-amber-400 font-black uppercase tracking-widest text-lg">Acesso Restrito</p>
        <p className="text-white/20 text-xs mt-2">A tela de aprovações é exclusiva para gerente comercial e diretor financeiro.</p>
      </div>
    );
  }

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
                  <tr key={request.id} className="hover:bg-white/[0.02] transition-colors">
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
                          onClick={() => handleReturnToSolicitations(request.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider"
                        >
                          <Undo2 size={14} /> Devolver
                        </button>
                        <button
                          onClick={() => handleApprove(request.id)}
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
    </div>
  );
}
