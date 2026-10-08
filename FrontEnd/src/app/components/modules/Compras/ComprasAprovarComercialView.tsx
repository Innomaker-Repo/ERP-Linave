import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eye, FileDown, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useErp } from '../../../context/ErpContext';
import { comComprasAtual } from '../../../../services/comprasSeguro';
import { formatNumeroOsDisplay } from '../../../../services/ordensServico';
import {
  APPROVAL_LIMIT,
  formatCurrency,
  formatPedidoCompraNumero,
  parsePedidoCompraSeq,
  type PedidoCompraResumo,
  type RequisicaoCompra,
} from './comprasLocal';
import { finalizarAprovacaoPedido, recusarRequisicao } from './comprasAprovacaoShared';
import { handleDownloadPedidoCompraPDF } from './handleDownloadPedidoCompraPDF';
import { RecusarPedidoModal } from './RecusarPedidoModal';

// Todo pedido que sai da cotação (Seleção do Gerente) entra aqui primeiro, com o número
// provisório do Pedido de Compra já atribuído pelo Kanban (ver handleSendToApproval em
// ComprasKanbanView.tsx). O Comercial confirma 1 fornecedor por item e aprova/recusa. Se o
// total ultrapassar APPROVAL_LIMIT, a aprovação segue pra Aprovar Fin.; senão, encerra aqui —
// mesma finalização (Pedido de Compra + Conta a Pagar por fornecedor) de antes.
export function ComprasAprovarComercialView({ searchQuery }: { searchQuery: string }) {
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
      .filter((request) => request.stage === 'AGUARDANDO_COMERCIAL')
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

  // Grava SEMPRE em cima da cópia mais recente do servidor — ver comComprasAtual.
  const patchRequest = async (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    await comComprasAtual(async ({ compras: base }) => {
      const atualizado = base.map((request: any) => (request.id === requestId ? updater(request) : request));
      await saveEntity?.('compras', atualizado);
      return true;
    });
  };

  const calcularOrcamentoSelecionado = (details: RequisicaoCompra['budgetDetails']) => {
    if (details.length === 0) return null;
    const pendente = details.some((d) => !d.jaEmEstoque && (!d.fornecedorSelecionado || d.valorSelecionado === null));
    if (pendente) return null;
    return details.reduce((soma, d) => soma + (d.jaEmEstoque ? 0 : (d.valorSelecionado || 0)), 0);
  };

  // Escolha do fornecedor vencedor por item — a etapa central desta tela ("o Comercial
  // seleciona 1 fornecedor para cada item").
  const handleSelecionarFornecedor = async (requestId: string, itemId: string, fornecedorSelecionado: string) => {
    await patchRequest(requestId, (request) => {
      const nextDetails = (request.budgetDetails || []).map((detail) => {
        if (detail.itemId !== itemId || detail.jaEmEstoque) return detail;
        const escolhido = detail.fornecedores.find((entry) => entry.fornecedor === fornecedorSelecionado) || null;
        return {
          ...detail,
          fornecedorSelecionado: escolhido?.fornecedor || '',
          valorSelecionado: escolhido ? escolhido.valor : null,
          prazoEntregaSelecionado: escolhido?.prazoEntrega || '',
          condicaoPagamentoSelecionada: escolhido?.condicaoPagamento || '',
        };
      });
      return {
        ...request,
        budgetDetails: nextDetails,
        budgetValue: calcularOrcamentoSelecionado(nextDetails),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const todosItensComFornecedor = (request: RequisicaoCompra) =>
    (request.budgetDetails || []).length > 0 &&
    (request.budgetDetails || []).every((d) => d.jaEmEstoque || (d.fornecedorSelecionado && d.valorSelecionado !== null));

  const handleAprovar = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;
    if (!todosItensComFornecedor(request)) {
      toast.error('Selecione 1 fornecedor para cada item antes de aprovar.');
      return;
    }

    setGerando(requestId);
    try {
      const total = request.budgetValue || 0;
      if (total > APPROVAL_LIMIT) {
        // Acima do limite: segue pra Aprovar Fin. — a finalização (Pedido de Compra + Conta a
        // Pagar) só acontece lá, depois da aprovação do Financeiro.
        await patchRequest(requestId, (current) => ({
          ...current,
          stage: 'AGUARDANDO_FIN',
          updatedAt: new Date().toISOString(),
        }));
        toast.success('Pedido aprovado pelo Comercial e enviado para o Financeiro (total acima de ' + formatCurrency(APPROVAL_LIMIT) + ').');
        setSelectedRequestId(null);
        return;
      }

      const pedidosGerados = await finalizarAprovacaoPedido(request, { userSession, fornecedores, saveEntity });
      if (!pedidosGerados) return; // helper já avisou o usuário do erro

      if (pedidosGerados.length > 0) {
        pedidosGerados.forEach((pedido) => handleDownloadPedidoCompraPDF(pedido));
        setPedidosGeradosModal(pedidosGerados);
        toast.success(
          pedidosGerados.length === 1
            ? `Pedido de Compra ${pedidosGerados[0].numero} gerado — aguardando confirmação de compra no Kanban.`
            : `${pedidosGerados.length} Pedidos de Compra gerados, um por fornecedor — aguardando confirmação de compra no Kanban.`
        );
      } else {
        toast.success('Pedido aprovado.');
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

  // Baixa um resumo do pedido em PDF com o que já está definido até agora (itens sem
  // fornecedor selecionado ainda entram como "A definir" — o PDF final de verdade, por
  // fornecedor, só sai na aprovação).
  const handleBaixarResumo = (request: RequisicaoCompra) => {
    const numero = request.pedidoCompraNumero || formatPedidoCompraNumero(parsePedidoCompraSeq([]) + 1);
    const resumo: PedidoCompraResumo = {
      numero,
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
          descricao: `${item.descricao || item.nome}${detail?.fornecedorSelecionado ? ` — ${detail.fornecedorSelecionado}` : ' — A definir'}`,
          qtd: item.qtd,
          un: item.un,
          valorUnitario: item.qtd > 0 ? valorTotal / item.qtd : valorTotal,
          valorTotal,
        };
      }),
      valorTotal: request.budgetValue || 0,
      prazoEntrega: '',
      condicaoPagamento: '',
      observacoes: 'Resumo pré-aprovação — sujeito a confirmação do Comercial.',
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
            <h1 className="text-3xl font-bold text-white tracking-tight">Aprovar Comercial</h1>
            <p className="text-white/50 text-sm mt-1">Aqui aparece somente o pedido de compra. Antes de aprovar, o Comercial seleciona 1 fornecedor para cada item.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4 text-sm text-white/70">
        <strong className="text-white">Regra do fluxo:</strong> todo pedido entra primeiro como <strong className="text-white">Aguardando Comercial</strong>. Se o total for maior que {formatCurrency(APPROVAL_LIMIT)}, depois da aprovação Comercial ele é enviado automaticamente para <strong className="text-white">Aprovar Fin.</strong>. Pedidos de até {formatCurrency(APPROVAL_LIMIT)} encerram a etapa de aprovação após o Comercial.
      </div>

      <section className="bg-[#101f3d]/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">Pendentes — Aguardando Comercial</h3>
          <span className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-xs font-bold">
            {filteredRequests.length} pendente(s)
          </span>
        </div>

        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-white/35 text-sm rounded-2xl border border-white/10">
              Nenhum pedido aguardando o Comercial no momento.
            </div>
          ) : (
            filteredRequests.map((request) => {
              const pronto = todosItensComFornecedor(request);
              return (
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
                    <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Aguardando Comercial
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
                      onClick={() => setSelectedRequestId(request.id)}
                      className="px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Selecionar fornecedores
                    </button>
                    <button
                      onClick={() => setRecusaAlvo(request)}
                      className="px-3 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={() => handleAprovar(request.id)}
                      disabled={!pronto || gerando === request.id}
                      className="px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {gerando === request.id ? 'Gerando...' : 'Aprovar'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/45">
          O card continua mostrando somente o pedido. Para aprovar, o Comercial deve clicar em <strong className="text-white/70">Selecionar fornecedores</strong> e escolher 1 fornecedor para cada item do pedido.
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
                  disabled={!todosItensComFornecedor(selectedRequest) || gerando === selectedRequest.id}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr className="bg-[#101826] text-xs font-bold text-white/40 uppercase tracking-wider text-left border-b border-white/10">
                      <th className="p-4">Item</th>
                      <th className="p-4">Natureza</th>
                      <th className="p-4">Descrição</th>
                      <th className="p-4 text-center">Qtd</th>
                      <th className="p-4">Un.</th>
                      <th className="p-4 text-right">Preço selecionado</th>
                      <th className="p-4">Menor valor</th>
                      <th className="p-4">Fornecedores orçados (clique para selecionar)</th>
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
                          <td className="p-4 text-white/70 text-sm max-w-[220px]">{item.descricao || '-'}</td>
                          <td className="p-4 text-center text-white/80 text-sm">{item.qtd}</td>
                          <td className="p-4 text-white/80 text-sm">{item.un || '-'}</td>
                          <td className="p-4 text-right text-emerald-300 text-sm font-bold">{detail?.valorSelecionado !== null && detail?.valorSelecionado !== undefined ? formatCurrency(detail.valorSelecionado) : '-'}</td>
                          <td className="p-4 text-white/80 text-sm">{detail?.menorValor !== null && detail?.menorValor !== undefined ? formatCurrency(detail.menorValor) : '-'}</td>
                          <td className="p-4 text-white/70 text-sm">
                            <div className="space-y-1">
                              {detail?.jaEmEstoque ? (
                                <span className="text-white/40">Item já em estoque</span>
                              ) : suppliers.length > 0 ? suppliers.map((supplier, index) => {
                                const selecionado = supplier.fornecedor === detail?.fornecedorSelecionado;
                                return (
                                  <button
                                    key={`${item.id}-${supplier.fornecedor}-${index}`}
                                    type="button"
                                    onClick={() => handleSelecionarFornecedor(selectedRequest.id, item.id, supplier.fornecedor)}
                                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                                      selecionado ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 bg-black/10 hover:bg-white/5'
                                    }`}
                                  >
                                    <p className={`font-medium flex items-center gap-2 ${selecionado ? 'text-emerald-300' : 'text-white'}`}>
                                      {selecionado && <CheckCircle2 size={13} className="shrink-0" />} {supplier.fornecedor || '-'}
                                    </p>
                                    <p className="text-white/45 text-xs">{formatCurrency(supplier.valor)} • {supplier.prazoEntrega || 'Sem prazo'} • {supplier.condicaoPagamento || 'Sem condição'}</p>
                                  </button>
                                );
                              }) : (
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

      {recusaAlvo && (
        <RecusarPedidoModal request={recusaAlvo} onClose={() => setRecusaAlvo(null)} onConfirm={confirmarRecusa} />
      )}
    </div>
  );
}
