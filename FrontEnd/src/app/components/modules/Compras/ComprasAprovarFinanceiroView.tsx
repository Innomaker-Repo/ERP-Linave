import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eye, FileDown, Undo2 } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { comComprasAtual } from '../../../../services/comprasSeguro';
import { formatNumeroOsDisplay } from '../../../../services/ordensServico';
import { APPROVAL_LIMIT, formatCurrency, type PedidoCompraResumo, type RequisicaoCompra } from './comprasLocal';
import { finalizarAprovacaoPedido, recusarRequisicao } from './comprasAprovacaoShared';
import { handleDownloadPedidoCompraPDF } from './handleDownloadPedidoCompraPDF';
import { RecusarPedidoModal } from './RecusarPedidoModal';

// Só chegam aqui pedidos já aprovados pelo Comercial cujo total ultrapassa APPROVAL_LIMIT —
// o fornecedor de cada item já foi escolhido lá, então esta tela não mexe mais nisso, só
// aprova (finaliza: gera Pedido de Compra + Conta a Pagar por fornecedor) ou recusa.
export function ComprasAprovarFinanceiroView({ searchQuery }: { searchQuery: string }) {
  const { userSession, compras, fornecedores, saveEntity } = useErp() as any;
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => (Array.isArray(compras) ? compras : []));
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [pedidosGeradosModal, setPedidosGeradosModal] = useState<PedidoCompraResumo[] | null>(null);
  const [recusaAlvo, setRecusaAlvo] = useState<RequisicaoCompra | null>(null);

  useEffect(() => {
    if (Array.isArray(compras)) setRequests(compras);
  }, [compras]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests
      .filter((request) => request.stage === 'AGUARDANDO_FIN')
      .filter((request) => {
        if (!query) return true;
        const searchableText = [
          request.solicitante,
          request.departamento,
          request.centroCusto,
          request.pedidoCompraNumero || '',
          request.budgetValue ? String(request.budgetValue) : '',
          ...request.itens.map((item) => item.descricao || item.nome),
        ].join(' ').toLowerCase();
        return searchableText.includes(query);
      });
  }, [requests, searchQuery]);

  const patchRequest = async (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    await comComprasAtual(async ({ compras: base }) => {
      const atualizado = base.map((request: any) => (request.id === requestId ? updater(request) : request));
      await saveEntity?.('compras', atualizado);
      return true;
    });
  };

  const handleAprovar = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    setGerando(requestId);
    try {
      const pedidosGerados = await finalizarAprovacaoPedido(request, { userSession, fornecedores, saveEntity });
      if (!pedidosGerados) return; // helper já avisou o usuário do erro

      if (pedidosGerados.length > 0) {
        pedidosGerados.forEach((pedido) => handleDownloadPedidoCompraPDF(pedido));
        setPedidosGeradosModal(pedidosGerados);
      }
      setSelectedRequestId(null);
    } finally {
      setGerando(null);
    }
  };

  const confirmarRecusa = async (motivo: string) => {
    if (!recusaAlvo) return;
    const userLabel = userSession?.nome || userSession?.email || 'sistema';
    await recusarRequisicao(recusaAlvo.id, motivo, userLabel, patchRequest);
    setRecusaAlvo(null);
    setSelectedRequestId(null);
  };

  const handleBaixarResumo = (request: RequisicaoCompra) => {
    const resumo: PedidoCompraResumo = {
      numero: request.pedidoCompraNumero || '—',
      solicitacaoId: request.id,
      centroCusto: request.centroCusto,
      solicitante: request.solicitante,
      departamento: request.departamento,
      fornecedor: '',
      fornecedorCnpj: '',
      itens: request.itens.map((item) => {
        const detail = (request.budgetDetails || []).find((d) => d.itemId === item.id) || null;
        const valorTotal = detail?.valorSelecionado || 0;
        return {
          itemId: item.id,
          nome: item.nome,
          descricao: `${item.descricao || item.nome}${detail?.fornecedorSelecionado ? ` — ${detail.fornecedorSelecionado}` : ''}`,
          qtd: item.qtd,
          un: item.un,
          valorUnitario: item.qtd > 0 ? valorTotal / item.qtd : valorTotal,
          valorTotal,
        };
      }),
      valorTotal: request.budgetValue || 0,
      prazoEntrega: '',
      condicaoPagamento: '',
      observacoes: 'Resumo aguardando aprovação do Financeiro.',
      data: request.createdAt,
    };
    handleDownloadPedidoCompraPDF(resumo);
  };

  const selectedRequest = useMemo(
    () => (selectedRequestId ? requests.find((r) => r.id === selectedRequestId) || null : null),
    [requests, selectedRequestId],
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-700 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
            <Clock3 size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Aprovar Financeiro</h1>
            <p className="text-white/50 text-sm mt-1">Aqui aparecem somente os pedidos acima de {formatCurrency(APPROVAL_LIMIT)} que já foram aprovados pelo Comercial.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4 text-sm text-white/70">
        <strong className="text-white">Regra do Financeiro:</strong> esta aba recebe somente pedidos acima de {formatCurrency(APPROVAL_LIMIT)} que já foram aprovados pelo Comercial. Aqui o status é <strong className="text-white">Aguardando Fin</strong>.
      </div>

      <section className="bg-[#101f3d]/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">Pendentes — Aguardando Fin</h3>
          <span className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-xs font-bold">
            {filteredRequests.length} pendente(s)
          </span>
        </div>

        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-white/35 text-sm rounded-2xl border border-white/10">
              Nenhum pedido aguardando o Financeiro no momento.
            </div>
          ) : (
            filteredRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-[140px]">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.25em] font-black">Pedido de compra</p>
                  <p className="text-white font-black text-lg mt-1">{request.pedidoCompraNumero || '—'}</p>
                  <p className="text-white/45 text-xs mt-1">Solicitante: {request.solicitante || '-'}</p>
                </div>
                <div className="min-w-[140px]">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.25em] font-black">Centro de custo</p>
                  <p className="text-white font-semibold text-sm mt-1">{request.departamento || '—'}</p>
                  <p className="text-white/45 text-xs mt-1">Projeto {formatNumeroOsDisplay(request.centroCusto) || '—'}</p>
                </div>
                <div className="min-w-[140px]">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.25em] font-black">Status</p>
                  <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Aguardando Fin
                  </span>
                </div>
                <div className="min-w-[120px]">
                  <p className="text-white/35 text-[10px] uppercase tracking-[0.25em] font-black">Total do pedido</p>
                  <p className="text-emerald-300 font-black text-lg mt-1">{formatCurrency(request.budgetValue)}</p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setSelectedRequestId(request.id)} title="Ver pedido" className="p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => handleBaixarResumo(request)} title="Baixar resumo" className="p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70">
                    <FileDown size={16} />
                  </button>
                  <button
                    onClick={() => setRecusaAlvo(request)}
                    className="px-3 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={() => handleAprovar(request.id)}
                    disabled={gerando === request.id}
                    className="px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {gerando === request.id ? 'Gerando...' : 'Aprovar'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/45">
          Somente pedidos com total maior que {formatCurrency(APPROVAL_LIMIT)} aparecem aqui e apenas depois da aprovação Comercial.
        </div>
      </section>

      {pedidosGeradosModal && (
        <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] shadow-2xl">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/35 font-black">Aprovação concluída</p>
                <h2 className="text-2xl font-black text-white mt-2">
                  {pedidosGeradosModal.length === 1 ? '1 Pedido de Compra gerado' : `${pedidosGeradosModal.length} Pedidos de Compra gerados`}
                </h2>
              </div>
              <button onClick={() => setPedidosGeradosModal(null)} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                Fechar
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-96px)] space-y-3">
              {pedidosGeradosModal.map((pedido) => (
                <div key={pedido.numero} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-bold text-sm">{pedido.numero} — {pedido.fornecedor}</p>
                    <p className="text-white/45 text-xs mt-1">{pedido.itens.length} item(ns) • {formatCurrency(pedido.valorTotal)} • Aguardando confirmação de compra no Kanban</p>
                  </div>
                  <button
                    onClick={() => handleDownloadPedidoCompraPDF(pedido)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider shrink-0"
                  >
                    <FileDown size={14} /> Baixar PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1220] shadow-2xl">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/35 font-black">Pedido de compra</p>
                <h2 className="text-2xl font-black text-white mt-2">{selectedRequest.pedidoCompraNumero || formatNumeroOsDisplay(selectedRequest.centroCusto) || 'Solicitação de compras'}</h2>
                <p className="text-white/45 text-sm mt-1">{selectedRequest.solicitante || '-'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAprovar(selectedRequest.id)}
                  disabled={gerando === selectedRequest.id}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-wait"
                >
                  <CheckCircle2 size={14} /> {gerando === selectedRequest.id ? 'Gerando...' : 'Aprovar'}
                </button>
                <button
                  onClick={() => setRecusaAlvo(selectedRequest)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  <Undo2 size={14} /> Recusar
                </button>
                <button
                  onClick={() => setSelectedRequestId(null)}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-92px)] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-[#101826] text-xs font-bold text-white/40 uppercase tracking-wider text-left border-b border-white/10">
                      <th className="p-4">Item</th>
                      <th className="p-4">Natureza</th>
                      <th className="p-4">Descrição</th>
                      <th className="p-4 text-center">Qtd</th>
                      <th className="p-4">Un.</th>
                      <th className="p-4">Fornecedor selecionado</th>
                      <th className="p-4 text-right">Preço selecionado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedRequest.itens.map((item) => {
                      const detail = (selectedRequest.budgetDetails || []).find((entry) => entry.itemId === item.id) || null;
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="p-4 text-white font-semibold text-sm">{item.nome || '-'}</td>
                          <td className="p-4 text-amber-300 text-xs font-black uppercase tracking-widest">{detail?.naturezaFornecimento || item.naturezaFornecimento || 'SERVIÇO'}</td>
                          <td className="p-4 text-white/70 text-sm max-w-[260px]">{item.descricao || '-'}</td>
                          <td className="p-4 text-center text-white/80 text-sm">{item.qtd}</td>
                          <td className="p-4 text-white/80 text-sm">{item.un || '-'}</td>
                          <td className="p-4 text-white text-sm font-semibold">{detail?.fornecedorSelecionado || (detail?.jaEmEstoque ? 'Em estoque' : 'Aguardando seleção')}</td>
                          <td className="p-4 text-right text-emerald-300 text-sm font-bold">{detail?.valorSelecionado !== null && detail?.valorSelecionado !== undefined ? formatCurrency(detail.valorSelecionado) : '-'}</td>
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

      {recusaAlvo && (
        <RecusarPedidoModal request={recusaAlvo} onClose={() => setRecusaAlvo(null)} onConfirm={confirmarRecusa} />
      )}
    </div>
  );
}
