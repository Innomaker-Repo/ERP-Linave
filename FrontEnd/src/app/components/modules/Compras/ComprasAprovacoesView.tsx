import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, FileDown, ShoppingCart, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useErp } from '../../../context/ErpContext';
import {
  approvalRouteLabel,
  buildHistoricoRecord,
  formatCurrency,
  formatPedidoCompraNumero,
  parsePedidoCompraSeq,
  resolveApprovalRoute,
  APPROVAL_LIMIT,
  type CompraHistoricoRegistro,
  type ItemCompra,
  type PedidoCompraResumo,
  type QuoteItem,
  type RequisicaoCompra,
} from './comprasLocal';
import { CP_STATUS, empresaFromCC } from '../Financeiro/finData';
import { handleDownloadPedidoCompraPDF } from './handleDownloadPedidoCompraPDF';

export function ComprasAprovacoesView({ searchQuery }: { searchQuery: string }) {
  const { userSession, compras, financeiro, comprasHistorico, fornecedores, saveEntity } = useErp() as any;
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => (Array.isArray(compras) ? compras : []));
  const [selectedRequest, setSelectedRequest] = useState<RequisicaoCompra | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [pedidosGeradosModal, setPedidosGeradosModal] = useState<PedidoCompraResumo[] | null>(null);

  // Só persiste em mudança de fato local (não no mount/sync), para não sobrescrever o
  // workspace compartilhado com estado vazio/antigo.
  const lastSyncedComprasRef = useRef<RequisicaoCompra[]>(Array.isArray(compras) ? compras : []);

  useEffect(() => {
    if (requests === lastSyncedComprasRef.current) return;
    void saveEntity?.('compras', requests || []);
  }, [requests]);

  useEffect(() => {
    if (Array.isArray(compras)) {
      lastSyncedComprasRef.current = compras;
      setRequests(compras);
    }
  }, [compras]);

  const roleNorm = String(userSession?.role || '').toUpperCase();
  // Regra de aprovação (decidida pelo VALOR do orçamento, não por rota gravada):
  //   >= R$ 500 -> somente a gerência (Admin/Gerente) vê e aprova;
  //   <  R$ 500 -> qualquer usuário com acesso a esta aba aprova (setor de compras;
  //                a aba é liberada pelo painel de permissões, chave aprovacoesCompras).
  const isGerencia = roleNorm === 'ADMIN' || roleNorm === 'GERENTE';
  const rotaDoPedido = (request: RequisicaoCompra) => resolveApprovalRoute(request.budgetValue);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return requests
      .filter((request) => request.stage === 'APROVACAO')
      .filter((request) => isGerencia || rotaDoPedido(request) === 'setorCompras')
      .filter((request) => {
        if (!query) return true;

        const searchableText = [
          request.solicitante,
          request.departamento,
          request.centroCusto,
          approvalRouteLabel[rotaDoPedido(request)],
          request.budgetValue ? String(request.budgetValue) : '',
          ...request.itens.map((item) => item.descricao || item.nome),
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });
  }, [requests, searchQuery, isGerencia]);

  const patchRequest = (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    setRequests((current) => current.map((request) => (request.id === requestId ? updater(request) : request)));
  };

  const getDefaultItemPurchaseState = (naturezaFornecimento: 'ITEM' | 'SERVICO') => (
    naturezaFornecimento === 'ITEM' ? 'comprar' : 'aContratar'
  );

  // Aprovação: para cada item com fornecedor selecionado na cotação, agrupa por fornecedor e
  // gera automaticamente 1 Pedido de Compra + 1 Conta a Pagar por fornecedor (regra: quantidade
  // de fornecedores selecionados = quantidade de Pedidos de Compra = quantidade de Contas a
  // Pagar). Itens sem seleção válida (não deveria acontecer, mas fica como rede de segurança)
  // continuam indo para a coluna Comprados, onde o fluxo manual item a item (marcar como
  // comprado/contratado) permanece disponível como exceção/ajuste pontual.
  const handleApprove = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    setGerando(requestId);
    try {
      const detailsById = new Map((request.budgetDetails || []).map((d) => [d.itemId, d]));
      const elegiveis = request.itens.filter((item) => {
        const detail = detailsById.get(item.id);
        return detail && !detail.jaEmEstoque && detail.fornecedorSelecionado && detail.valorSelecionado !== null && detail.valorSelecionado !== undefined;
      });

      if (elegiveis.length > 0) {
        const gruposPorFornecedor = new Map<string, ItemCompra[]>();
        for (const item of elegiveis) {
          const fornecedor = detailsById.get(item.id)!.fornecedorSelecionado;
          if (!gruposPorFornecedor.has(fornecedor)) gruposPorFornecedor.set(fornecedor, []);
          gruposPorFornecedor.get(fornecedor)!.push(item);
        }

        const historicoAtual: any[] = Array.isArray(comprasHistorico) ? comprasHistorico : [];
        const financeiroAtual: any[] = Array.isArray(financeiro) ? financeiro : [];
        const catalogoFornecedores: any[] = Array.isArray(fornecedores) ? fornecedores : [];
        const userLabel = userSession?.nome || userSession?.email || 'sistema';

        const novasContas: any[] = [];
        const novosRegistros: CompraHistoricoRegistro[] = [];
        const pedidosGerados: PedidoCompraResumo[] = [];
        let seq = parsePedidoCompraSeq(historicoAtual);

        for (const [fornecedor, itensDoGrupo] of gruposPorFornecedor) {
          seq += 1;
          const numero = formatPedidoCompraNumero(seq);
          const cnpj = catalogoFornecedores.find((f: any) => f?.razaoSocial === fornecedor)?.cnpj || '';
          const primeiroDetail = detailsById.get(itensDoGrupo[0].id)!;
          const valorTotalGrupo = itensDoGrupo.reduce((sum, item) => sum + (detailsById.get(item.id)?.valorSelecionado || 0), 0);
          const todosMateriais = itensDoGrupo.every((item) => (detailsById.get(item.id)?.naturezaFornecimento || item.naturezaFornecimento) === 'ITEM');
          const contaPagarId = `CP-${Date.now().toString(36).toUpperCase()}-${seq}`;

          novasContas.push({
            id: contaPagarId,
            tipo: 'contaPagar' as const,
            type: 'single' as const,
            parentId: null,
            parcela: '-',
            totalParcelas: 1,
            origemCompra: true,
            pedidoCompraNumero: numero,
            empresa: empresaFromCC(request.centroCusto, 'Linave'),
            vinculoTipo: 'OS' as const,
            vinculoValor: request.centroCusto,
            fornecedor,
            tipoPagamento: todosMateriais ? 'Material' : 'Fornecedor',
            natureza: '',
            documento: '',
            valor: valorTotalGrupo,
            vencimento: '',
            banco: '',
            forma: '',
            obs: `Pedido de Compra ${numero} — ${itensDoGrupo.length} item(ns), gerado automaticamente na aprovação.`,
            status: CP_STATUS.semDoc,
            valorPago: 0,
            jurosPago: 0,
            anexos: [] as string[],
            comprovantes: [] as string[],
            dataPagamento: '',
            createdAt: new Date().toISOString(),
          });

          for (const item of itensDoGrupo) {
            const detail = detailsById.get(item.id) || null;
            novosRegistros.push(buildHistoricoRecord(request, item, detail, userLabel, contaPagarId, numero, cnpj));
          }

          pedidosGerados.push({
            numero,
            solicitacaoId: request.id,
            centroCusto: request.centroCusto,
            solicitante: request.solicitante,
            departamento: request.departamento,
            fornecedor,
            fornecedorCnpj: cnpj,
            itens: itensDoGrupo.map((item) => {
              const detail = detailsById.get(item.id)!;
              const valorTotalItem = detail.valorSelecionado || 0;
              return {
                itemId: item.id,
                nome: item.nome,
                descricao: item.descricao,
                qtd: item.qtd,
                un: item.un,
                valorUnitario: item.qtd > 0 ? valorTotalItem / item.qtd : valorTotalItem,
                valorTotal: valorTotalItem,
              };
            }),
            valorTotal: valorTotalGrupo,
            prazoEntrega: primeiroDetail.prazoEntregaSelecionado || '',
            condicaoPagamento: primeiroDetail.condicaoPagamentoSelecionada || '',
            observacoes: '',
            data: new Date().toISOString(),
          });
        }

        await saveEntity?.('financeiro', [...novasContas, ...financeiroAtual]);
        const idsNovos = new Set(novosRegistros.map((r) => r.id));
        await saveEntity?.('comprasHistorico', [...novosRegistros, ...historicoAtual.filter((r: any) => !idsNovos.has(r?.id))]);

        pedidosGerados.forEach((pedido) => handleDownloadPedidoCompraPDF(pedido));
        setPedidosGeradosModal(pedidosGerados);
        toast.success(
          pedidosGerados.length === 1
            ? `Pedido de Compra ${pedidosGerados[0].numero} gerado e conta a pagar criada.`
            : `${pedidosGerados.length} Pedidos de Compra gerados, um por fornecedor, cada um com sua conta a pagar.`
        );

        const idsProcessados = new Set(elegiveis.map((i) => i.id));
        setRequests((current) =>
          current
            .map((r): RequisicaoCompra => {
              if (r.id !== requestId) return r;
              return {
                ...r,
                itens: r.itens.filter((it) => !idsProcessados.has(it.id)),
                budgetDetails: (r.budgetDetails || []).filter((d) => !idsProcessados.has(d.itemId)),
                stage: 'COMPRADOS',
                purchaseState: r.purchaseState || 'comprar',
                updatedAt: new Date().toISOString(),
              };
            })
            .filter((r) => r.id !== requestId || r.itens.length > 0)
        );
        return;
      }

      // Nenhum item elegível para geração automática (sem seleção de fornecedor) — mantém o
      // comportamento anterior: request inteira vai para Comprados, fluxo manual item a item.
      patchRequest(requestId, (current) => ({
        ...current,
        stage: 'COMPRADOS',
        itens: current.itens.map((item) => {
          const natureza = item.naturezaFornecimento === 'ITEM' ? 'ITEM' : 'SERVICO';
          return {
            ...item,
            naturezaFornecimento: natureza,
            purchaseState: getDefaultItemPurchaseState(natureza),
          };
        }),
        purchaseState: current.purchaseState || 'comprar',
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setGerando(null);
    }
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
            <p className="text-white/50 text-sm mt-1">Compras abaixo de R$ {APPROVAL_LIMIT} podem ser aprovadas por todo o setor de compras (quem tem acesso a esta aba); a partir de R$ {APPROVAL_LIMIT}, somente a gerência.</p>
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
                      <span className={`px-2 py-1 rounded-full border text-xs font-bold ${rotaDoPedido(request) === 'gerencia' ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : 'bg-orange-500/10 border-orange-500/20 text-orange-200'}`}>
                        {approvalRouteLabel[rotaDoPedido(request)]}
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
                            void handleApprove(request.id);
                          }}
                          disabled={gerando === request.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-wait"
                        >
                          <CheckCircle2 size={14} /> {gerando === request.id ? 'Gerando...' : 'Aprovar'}
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
          Ao aprovar, o sistema agrupa os itens por fornecedor selecionado na cotação e gera automaticamente 1 Pedido de Compra + 1 Conta a Pagar por fornecedor (com PDF do pedido). Itens sem fornecedor selecionado seguem para a coluna Comprados, onde o lançamento manual item a item continua disponível como exceção.
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
                    <p className="text-white/45 text-xs mt-1">{pedido.itens.length} item(ns) • {formatCurrency(pedido.valorTotal)} • Conta a pagar já criada (Aberto S/Documento)</p>
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
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/35 font-black">Detalhamento da pendência</p>
                <h2 className="text-2xl font-black text-white mt-2">{selectedRequest.centroCusto || 'Solicitação de compras'}</h2>
                <p className="text-white/45 text-sm mt-1">{selectedRequest.solicitante || '-'}</p>
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
                  <p className="text-white font-semibold mt-2">{approvalRouteLabel[rotaDoPedido(selectedRequest)]}</p>
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
