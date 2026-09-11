import React, { useEffect, useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { comFinanceiroAtual } from '../../../../services/financeiroSeguro';
import { comComprasAtual } from '../../../../services/comprasSeguro';
import { formatNumeroOsDisplay } from '../../../../services/ordensServico';
import { ArrowRight, Ban, Banknote, CalendarClock, CircleDollarSign, Eye, FileDown, Package, Plus, Send, ShoppingCart, Split, Trash2, Users, X } from 'lucide-react';
import {
  APPROVAL_LIMIT,
  BOARD_COLUMNS,
  buildHistoricoRecord,
  formatCurrency,
  formatPedidoCompraNumero,
  parsePedidoCompraSeqAtual,
  purchaseStateLabel,
  type ItemCompra,
  type PedidoCompraResumo,
  type QuoteFornecedor,
  type QuoteItem,
  type RequisicaoCompra,
} from './comprasLocal';
import { handleDownloadPedidoCompraPDF } from './handleDownloadPedidoCompraPDF';
import { recusarRequisicao } from './comprasAprovacaoShared';
import { RecusarPedidoModal } from './RecusarPedidoModal';
import { FinModal, Field, Input, Select, Textarea, Btn, boldOS } from '../Financeiro/finUi';
import { toast } from 'sonner';
import {
  br, money, num, todayStr, days,
  FORMAS_PAGAMENTO, TIPOS_REEMBOLSO, empresaFromCC, buildContasPagar, CP_STATUS,
  type Empresa,
} from '../Financeiro/finData';

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
  // Natureza vem do ITEM (escolhida na solicitação), não do fornecedor.
  naturezaFornecimento: 'ITEM' | 'SERVICO';
  fornecedores: QuoteSupplierDraft[];
  jaEmEstoque: boolean;
};

type QuoteModalState = {
  requestId: string;
  mode: 'edit' | 'view';
} | null;

// Card de "Comprados" agrupado por Pedido de Compra (PC) + fornecedor — ver `comprasCards`.
type PcCard = {
  key: string;
  request: RequisicaoCompra;
  pedidoCompraNumero?: string;
  fornecedor?: string;
  itens: ItemCompra[];
};

// Formulário do popup "Conta a Pagar" disparado ao marcar um item como comprado/contratado.
type BuyFormState = {
  empresa: string;
  fornecedor: string;
  tipoPagamento: string;
  documento: string;
  valor: string;
  vencimento: string;
  banco: string;
  forma: string;
  obs: string;
  parcelar: boolean;
  nParcelas: string;
  intervalo: string;
  dataInicio: string;
};

const emptyBuyForm = (): BuyFormState => ({
  empresa: 'Linave', fornecedor: '', tipoPagamento: 'Material', documento: '', valor: '',
  vencimento: todayStr, banco: '', forma: '', obs: '',
  parcelar: false, nParcelas: '2', intervalo: '30', dataInicio: todayStr,
});

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

const normalizarNatureza = (natureza: any): 'ITEM' | 'SERVICO' =>
  natureza === 'ITEM' ? 'ITEM' : 'SERVICO';

// Natureza do fornecedor (Itens/ITEM ou Serviços/SERVICO). Aceita o legado tipo "Empresas"=ITEM.
// Continua sendo o RÓTULO do fornecedor no catálogo (exibido nos dropdowns), mas NÃO define mais
// a natureza da compra — essa agora vem do item, escolhida na solicitação.
const naturezaFornecedor = (s: any): 'ITEM' | 'SERVICO' =>
  (s?.naturezaFornecimento === 'ITEM' || s?.tipo === 'Itens' || s?.tipo === 'Empresas') ? 'ITEM' : 'SERVICO';

const buildDraftRows = (request: RequisicaoCompra): QuoteRowDraft[] =>
  request.itens.map((item) => {
    const existing = (request.budgetDetails || []).find((detail) => detail.itemId === item.id);

    return {
      itemId: item.id,
      itemLabel: item.descricao || item.nome,
      naturezaFornecimento: normalizarNatureza(item.naturezaFornecimento),
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
  previousDetails: QuoteItem[] = []
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

    return {
      itemId: row.itemId,
      // Natureza do ITEM (escolhida na solicitação) — independe do fornecedor selecionado.
      naturezaFornecimento: row.naturezaFornecimento,
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
  const { userSession, fornecedores, compras, financeiro, config, saveEntity } = useErp() as any;
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => (Array.isArray(compras) ? compras : []));
  const [quoteModal, setQuoteModal] = useState<QuoteModalState>(null);
  const [quoteRows, setQuoteRows] = useState<Record<string, QuoteRowDraft[]>>({});

  // Popup "Conta a Pagar" (marcar item como comprado/contratado).
  const [buyModal, setBuyModal] = useState<{ requestId: string; itemId: string } | null>(null);
  const [buyForm, setBuyForm] = useState<BuyFormState>(emptyBuyForm());
  const [buySaving, setBuySaving] = useState(false);

  // Recusar (com motivo) durante a cotação — devolve ao solicitante, ver comprasAprovacaoShared.ts.
  const [recusaAlvo, setRecusaAlvo] = useState<RequisicaoCompra | null>(null);
  const setBuyF = (k: keyof BuyFormState, v: string | boolean) => setBuyForm((prev) => ({ ...prev, [k]: v }));

  const supplierOptions = useMemo(
    () => (Array.isArray(fornecedores) ? fornecedores : []).filter((supplier: any) => supplier?.razaoSocial),
    [fornecedores]
  );

  // Opções para o popup de Conta a Pagar (empresas prestadoras e bancos cadastrados).
  const empresasOptions = useMemo<string[]>(() => {
    const lista = (config?.empresasPrestadoras || [])
      .filter((e: any) => e?.ativa !== false)
      .map((e: any) => e?.nome)
      .filter(Boolean);
    return lista.length ? lista : ['Linave', 'Servinave'];
  }, [config]);

  const bancosOptions = useMemo<string[]>(
    () => (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => r?.tipo === 'banco').map((b: any) => b.nome).filter(Boolean),
    [financeiro]
  );

  const visibleBoardColumns = BOARD_COLUMNS;

  // update local state when workspace compras changes (inclusive depois de uma gravação
  // nossa: saveEntity('compras', ...) atualiza o contexto, e o efeito abaixo reflete aqui).
  useEffect(() => {
    if (Array.isArray(compras)) {
      setRequests(compras);
    }
  }, [compras]);

  const activeRequest = useMemo(
    () => (quoteModal ? requests.find((request) => request.id === quoteModal.requestId) || null : null),
    [requests, quoteModal]
  );

  // Grava SEMPRE em cima da cópia mais recente do servidor, nunca do `requests` local (que
  // pode estar desatualizado se outra pessoa mexeu em Compras nesse meio-tempo) — é o que
  // causava itens "sumindo" entre a Seleção do Gerente e a aba Aprovações: a gravação com
  // dado velho falhava ou sobrescrevia em silêncio. Ver comComprasAtual em comprasSeguro.ts.
  const patchRequest = async (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    await comComprasAtual(async ({ compras: base }) => {
      const atualizado = base.map((request: any) => (request.id === requestId ? updater(request) : request));
      await saveEntity?.('compras', atualizado);
      return true;
    });
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

  const handleSaveQuote = async () => {
    if (!activeRequest || !quoteModal) return;

    if (supplierOptions.length === 0) {
      return toast.error('Cadastre fornecedores na página de Fornecedores antes de orçar.');
    }

    const rows = quoteRows[activeRequest.id] || [];
    if (rows.length === 0) {
      return toast.error('Nenhum item encontrado para cotação.');
    }

    for (const row of rows) {
      if (!row.jaEmEstoque && row.fornecedores.length < 3) {
        return toast.error('Cada item precisa ter no mínimo 3 fornecedores para salvar a cotação.');
      }

      if (!row.jaEmEstoque) {
        for (const supplier of row.fornecedores) {
          if (!supplier.fornecedor || !supplier.valor || !supplier.prazoEntrega || !supplier.condicaoPagamento) {
            return toast.error('Preencha fornecedor, valor, prazo de entrega e condição de pagamento em cada fornecedor do item.');
          }
        }
      }
    }

    const { details } = calculateBudgetDetails(rows, activeRequest?.budgetDetails || []);

    // Itens marcados como "já em estoque" não seguem o fluxo de compra: ao concluir o
    // orçamento eles são removidos do pedido (somem da seleção, aprovação e finalizados).
    const idsEmEstoque = new Set(rows.filter((row) => row.jaEmEstoque).map((row) => row.itemId));
    const detailsFiltrados = details.filter((detail) => !idsEmEstoque.has(detail.itemId));
    const itensAtualizados = activeRequest.itens
      .filter((item) => !idsEmEstoque.has(item.id))
      .map((item) => {
        // A natureza é a do próprio item (escolhida na solicitação). O detalhe da cotação só
        // a espelha; o item continua sendo a fonte da verdade.
        const natureza = normalizarNatureza(item.naturezaFornecimento);
        return {
          ...item,
          naturezaFornecimento: natureza,
          purchaseState: item.purchaseState || (natureza === 'ITEM' ? 'comprar' : 'aContratar'),
        };
      });

    await patchRequest(activeRequest.id, (request) => ({
      ...request,
      itens: itensAtualizados,
      budgetDetails: detailsFiltrados,
      budgetValue: calculateSelectedBudgetValue(detailsFiltrados),
      updatedAt: new Date().toISOString(),
    }));

    // Limpa o rascunho para que, ao reabrir, a lista reflita só os itens remanescentes.
    setQuoteRows((current) => {
      const next = { ...current };
      delete next[activeRequest.id];
      return next;
    });

    closeQuoteModal();
  };

  const handleSendToApproval = async (requestId: string) => {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;

    if ((request.budgetDetails || []).length === 0) {
      return toast.error('Faça a cotação completa antes de enviar para aprovação.');
    }

    // A escolha do fornecedor vencedor não acontece mais aqui — é feita em Aprovar Com.,
    // no momento da aprovação do Pedido de Compra (ver ComprasAprovarComercialView).
    // Sai da cotação e vira Pedido de Compra: recebe o número provisório (PC-XXXX) já aqui,
    // pra identificar o pedido em Aprovar Com./Aprovar Fin.. Busca a base fresca de compras E
    // de histórico juntas (o `patchRequest` só cobre `compras`) porque o número depende da
    // sequência já usada no histórico.
    await comComprasAtual(async ({ compras: base, comprasHistorico: historico }) => {
      const atual = base.find((r: any) => r.id === requestId);
      if (!atual) return true;
      const numero = atual.pedidoCompraNumero || formatPedidoCompraNumero(parsePedidoCompraSeqAtual(historico, base) + 1);
      const atualizado = base.map((r: any) => (r.id === requestId ? {
        ...r,
        stage: 'AGUARDANDO_COMERCIAL',
        pedidoCompraNumero: numero,
        updatedAt: new Date().toISOString(),
      } : r));
      await saveEntity?.('compras', atualizado);
      return true;
    });
  };

  // Abre o popup de Conta a Pagar pré-preenchido com a cotação selecionada do item.
  const openBuyModal = (requestId: string, itemId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;
    const item = request.itens.find((it) => it.id === itemId);
    if (!item) return;
    const detail = (request.budgetDetails || []).find((d) => d.itemId === itemId) || null;
    const isItem = (detail?.naturezaFornecimento || item.naturezaFornecimento) === 'ITEM';

    setBuyForm({
      empresa: empresaFromCC(request.centroCusto, (empresasOptions[0] as Empresa) || 'Linave'),
      fornecedor: detail?.fornecedorSelecionado || item.fornecedor || '',
      tipoPagamento: isItem ? 'Material' : 'Fornecedor',
      documento: '',
      valor: detail?.valorSelecionado != null ? String(detail.valorSelecionado) : '',
      vencimento: todayStr,
      banco: '',
      forma: '',
      obs: [
        detail?.prazoEntregaSelecionado ? `Entrega: ${detail.prazoEntregaSelecionado}` : '',
        detail?.condicaoPagamentoSelecionada ? `Pagto: ${detail.condicaoPagamentoSelecionada}` : '',
      ].filter(Boolean).join(' • '),
      parcelar: false,
      nParcelas: '2',
      intervalo: '30',
      dataInicio: todayStr,
    });
    setBuyModal({ requestId, itemId });
  };

  const closeBuyModal = () => setBuyModal(null);

  const buyContext = useMemo(() => {
    if (!buyModal) return null;
    const request = requests.find((r) => r.id === buyModal.requestId) || null;
    const item = request?.itens.find((it) => it.id === buyModal.itemId) || null;
    const detail = (request?.budgetDetails || []).find((d) => d.itemId === buyModal.itemId) || null;
    return request && item ? { request, item, detail } : null;
  }, [buyModal, requests]);

  const buyIsItem = buyContext
    ? (buyContext.detail?.naturezaFornecimento || buyContext.item.naturezaFornecimento) === 'ITEM'
    : true;

  // Confirma a compra do item: cria a(s) Conta(s) a Pagar, registra no Histórico (NFe
  // pendente) e remove o item do kanban (removendo o card se ele ficar vazio).
  const handleConfirmBuy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!buyModal || !buyContext) return;
    const { request, item, detail } = buyContext;

    if (!buyForm.fornecedor.trim() || !num(buyForm.valor)) {
      toast.error('Informe o fornecedor e o valor da conta a pagar.');
      return;
    }
    setBuySaving(true);
    try {
      // 1) Financeiro — cria a Conta a Pagar EM BRANCO, marcada como originada de Compras.
      //    Ela nasce sem documento (NF de entrada/boleto), sem vencimento e sem banco, com status
      //    "Aberto S/Documento". O gerente anexa o documento e preenche esses dados depois, ao
      //    editar a conta em Contas a Pagar — carregando o fornecedor da compra (p/ a checagem
      //    de duplicidade de documento por fornecedor).
      const contaPagarId = `CP-${Date.now().toString(36).toUpperCase()}`;
      const conta = {
        id: contaPagarId,
        tipo: 'contaPagar' as const,
        type: 'single' as const,
        parentId: null,
        parcela: '-',
        totalParcelas: 1,
        origemCompra: true,
        pedidoCompraNumero: item.pedidoCompraNumero || request.pedidoCompraNumero || undefined,
        empresa: buyForm.empresa,
        vinculoTipo: 'OS' as const,
        vinculoValor: request.centroCusto,
        fornecedor: buyForm.fornecedor.trim(),
        tipoPagamento: buyForm.tipoPagamento,
        natureza: '',
        documento: '',
        valor: num(buyForm.valor),
        vencimento: '',
        banco: '',
        forma: '',
        obs: buyForm.obs || '',
        status: CP_STATUS.semDoc,
        valorPago: 0,
        jurosPago: 0,
        anexos: [] as string[],
        comprovantes: [] as string[],
        dataPagamento: '',
        createdAt: new Date().toISOString(),
      };
      const salvouFinanceiro = await comFinanceiroAtual(async (base) => {
        await saveEntity?.('financeiro', [conta, ...base]);
        return true;
      });
      if (!salvouFinanceiro) return; // comFinanceiroAtual já avisou o usuário do erro

      // 2) Histórico de Compras — um registro por item, NFe do fornecedor pendente. Busca a
      //    base mais recente do histórico (não o `comprasHistorico` do contexto, que pode
      //    estar desatualizado) antes de gravar. Leva o número do Pedido de Compra do próprio
      //    pedido (atribuído quando ele saiu da cotação) — é isso que faz cada item marcado
      //    manualmente aqui cair no MESMO card do pedido no Histórico, em vez de um por item.
      const userLabel = userSession?.nome || userSession?.email || 'sistema';
      const fornecedorNome = detail?.fornecedorSelecionado || item.fornecedor || '';
      const fornecedorCnpj = (Array.isArray(fornecedores) ? fornecedores : []).find((f: any) => f?.razaoSocial === fornecedorNome)?.cnpj || '';
      const registro = buildHistoricoRecord(request, item, detail, userLabel, contaPagarId, item.pedidoCompraNumero || request.pedidoCompraNumero, fornecedorCnpj);
      const salvouHistorico = await comComprasAtual(async ({ comprasHistorico: historicoAtual }) => {
        const historicoSemDuplicado = historicoAtual.filter((r: any) => r?.id !== registro.id);
        await saveEntity?.('comprasHistorico', [registro, ...historicoSemDuplicado]);
        return true;
      });
      if (!salvouHistorico) return; // comComprasAtual já avisou o usuário do erro

      // 3) Compras — remove o item do card; remove o card se ficar sem itens. Aplica em cima
      //    da base mais recente (não do `requests` local) pelo mesmo motivo do item 2.
      const salvouCompras = await comComprasAtual(async ({ compras: base }) => {
        const atualizado = base
          .map((r: any) =>
            r.id === request.id
              ? {
                  ...r,
                  itens: r.itens.filter((it: any) => it.id !== item.id),
                  budgetDetails: (r.budgetDetails || []).filter((d: any) => d.itemId !== item.id),
                  updatedAt: new Date().toISOString(),
                }
              : r,
          )
          .filter((r: any) => r.itens.length > 0);
        await saveEntity?.('compras', atualizado);
        return true;
      });
      if (!salvouCompras) return; // comComprasAtual já avisou o usuário do erro

      setBuyModal(null);
    } finally {
      setBuySaving(false);
    }
  };

  const handleReturnToSolicitations = async (requestId: string) => {
    await patchRequest(requestId, (request) => ({
      ...request,
      stage: 'SOLICITACOES',
      approvalRoute: null,
      updatedAt: new Date().toISOString(),
    }));
  };

  const confirmarRecusa = async (motivo: string) => {
    if (!recusaAlvo) return;
    const userLabel = userSession?.nome || userSession?.email || 'sistema';
    await recusarRequisicao(recusaAlvo.id, motivo, userLabel, patchRequest);
    setRecusaAlvo(null);
  };

  // Baixa o PDF do Pedido de Compra vinculado ao card do grupo (PC + fornecedor) — só os itens
  // daquele grupo, não a requisição inteira.
  const handleBaixarPedido = (card: PcCard) => {
    const { request, itens } = card;
    const resumo: PedidoCompraResumo = {
      numero: card.pedidoCompraNumero || request.pedidoCompraNumero || '—',
      solicitacaoId: request.id,
      centroCusto: request.centroCusto,
      solicitante: request.solicitante,
      departamento: request.departamento,
      fornecedor: card.fornecedor || '',
      fornecedorCnpj: '',
      itens: itens.map((item) => {
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
      valorTotal: itens.reduce((sum, item) => sum + ((request.budgetDetails || []).find((d) => d.itemId === item.id)?.valorSelecionado || 0), 0),
      prazoEntrega: '',
      condicaoPagamento: '',
      observacoes: '',
      data: request.createdAt,
    };
    handleDownloadPedidoCompraPDF(resumo);
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

  // Só as 2 etapas do Kanban propriamente dito (a aprovação saiu daqui, ver Aprovar Com./
  // Aprovar Fin.) — tipado como Partial porque BoardStage também inclui os estágios de
  // aprovação, que nunca aparecem como coluna nesta tela.
  const requestsByStage: Partial<Record<RequisicaoCompra['stage'], RequisicaoCompra[]>> = useMemo(
    () => ({
      SOLICITACOES: filteredRequests.filter((request) => request.stage === 'SOLICITACOES'),
      COMPRADOS: filteredRequests.filter((request) => request.stage === 'COMPRADOS'),
    }),
    [filteredRequests]
  );

  // Backfill: itens em Comprados sem `pedidoCompraNumero` (dados de antes desse número
  // existir, ou aprovados pelo fluxo manual de segurança sem fornecedor pré-selecionado)
  // ficavam mostrando "—" no card e no PDF do pedido. Assim que a tela detecta algum item
  // assim, atribui um número novo pra cada um e grava — autoextingue (a próxima checagem já
  // não encontra mais nada faltando, então não há loop).
  useEffect(() => {
    const faltandoNumero = (requestsByStage.COMPRADOS ?? []).some((request) =>
      request.itens.some((item) => !item.pedidoCompraNumero)
    );
    if (!faltandoNumero) return;

    comComprasAtual(async ({ compras: base, comprasHistorico }) => {
      let seq = parsePedidoCompraSeqAtual(comprasHistorico, base);
      const atualizado = base.map((r: any) => {
        if (r.stage !== 'COMPRADOS') return r;
        return {
          ...r,
          itens: r.itens.map((item: any) => {
            if (item.pedidoCompraNumero) return item;
            seq += 1;
            return { ...item, pedidoCompraNumero: formatPedidoCompraNumero(seq) };
          }),
        };
      });
      await saveEntity?.('compras', atualizado);
      return true;
    });
  }, [requestsByStage]);

  // Cards de Comprados agrupados por Pedido de Compra (PC) + fornecedor — cada requisição
  // aprovada pode virar vários cards (1 por fornecedor), já que os itens de uma mesma OS podem
  // ter sido cotados com fornecedores diferentes. Itens sem `pedidoCompraNumero` (rede de
  // segurança — aprovados sem seleção de fornecedor) viram 1 card por item, preservando o fluxo
  // manual de escolher o fornecedor na hora de marcar como comprado.
  const comprasCards: PcCard[] = useMemo(() => {
    const out: PcCard[] = [];
    for (const request of requestsByStage.COMPRADOS ?? []) {
      const grupos = new Map<string, typeof request.itens>();
      for (const item of request.itens) {
        const key = item.pedidoCompraNumero || `item:${item.id}`;
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key)!.push(item);
      }
      for (const [key, itensDoGrupo] of grupos) {
        const detail = (request.budgetDetails || []).find((d) => d.itemId === itensDoGrupo[0].id) || null;
        out.push({
          key: `${request.id}::${key}`,
          request,
          pedidoCompraNumero: itensDoGrupo[0].pedidoCompraNumero,
          fornecedor: detail?.fornecedorSelecionado,
          itens: itensDoGrupo,
        });
      }
    }
    return out;
  }, [requestsByStage]);

  const modalRequest = quoteModal ? requests.find((request) => request.id === quoteModal.requestId) || null : null;
  const modalRows = modalRequest ? quoteRows[modalRequest.id] || buildDraftRows(modalRequest) : [];
  const modalSummary = calculateBudgetDetails(modalRows, activeRequest?.budgetDetails || []);

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
              Ao enviar para aprovação, o pedido segue para a aba Aprovar Com.; acima de R$ {APPROVAL_LIMIT} ele passa depois por Aprovar Fin.
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 ${visibleBoardColumns.length >= 4 ? 'lg:grid-cols-4' : visibleBoardColumns.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4 items-start`}>
            {visibleBoardColumns.map((column) => {
              const ColumnIcon = column.icon;
              const isComprados = column.id === 'COMPRADOS';
              const solicitacoesCards = isComprados ? [] : (requestsByStage[column.id] ?? []);
              const cardCount = isComprados ? comprasCards.length : solicitacoesCards.length;

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
                      {cardCount}
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[860px] overflow-y-auto pr-1">
                    {cardCount === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-white/35 text-sm">
                        Nenhuma requisição nesta coluna.
                      </div>
                    ) : isComprados ? comprasCards.map((card) => (
                      <article key={card.key} className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-4 shadow-lg shadow-black/10 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-white font-bold text-sm leading-tight">Pedido {card.pedidoCompraNumero || '—'}</h5>
                            <p className="text-white/45 text-[11px] mt-1">{formatNumeroOsDisplay(card.request.centroCusto)} • {card.request.solicitante || 'Solicitação de compras'}</p>
                          </div>
                          <button className="text-white/20 hover:text-white/60 transition-colors" title="Voltar para solicitações" onClick={() => handleReturnToSolicitations(card.request.id)}>
                            <ArrowRight size={14} className="rotate-180" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/45">{card.itens.length} item(ns)</span>
                          {card.fornecedor && (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">{card.fornecedor}</span>
                          )}
                          <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">Compras</span>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-white/45 uppercase tracking-widest text-[10px] font-bold">OS / Centro de custo</p>
                              <p className="text-white font-black text-sm mt-0.5 truncate">{formatNumeroOsDisplay(card.request.centroCusto)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => openQuoteModal(card.request.id, 'view')} title="Ver cotação" className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70">
                                <Eye size={15} />
                              </button>
                              <button onClick={() => handleBaixarPedido(card)} title="Baixar pedido" className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70">
                                <FileDown size={15} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {card.itens.map((item) => {
                              const detail = (card.request.budgetDetails || []).find((d) => d.itemId === item.id) || null;
                              const isItem = (detail?.naturezaFornecimento || item.naturezaFornecimento) === 'ITEM';
                              return (
                                <div key={`${card.request.id}-${item.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-white text-sm font-semibold">{item.descricao || item.nome}</p>
                                      <p className="text-white/40 text-[11px] mt-1">
                                        {isItem ? 'Item' : 'Serviço'}
                                        {detail?.fornecedorSelecionado ? ` • ${detail.fornecedorSelecionado}` : ''}
                                        {detail?.valorSelecionado != null ? ` • ${formatCurrency(detail.valorSelecionado)}` : ''}
                                      </p>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-widest text-amber-300/80 font-black">{isItem ? 'A comprar' : 'A contratar'}</span>
                                  </div>
                                  <button
                                    onClick={() => openBuyModal(card.request.id, item.id)}
                                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                                  >
                                    <Banknote size={14} /> {isItem ? 'Marcar como comprado' : 'Marcar como contratado'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-white/40 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            Ao confirmar, geramos a conta a pagar, o item sai do kanban para o Histórico como <strong className="text-white/70">NFe pendente</strong> e, se for item, vai para a tela de estoque.
                          </p>
                        </div>
                      </article>
                    )) : solicitacoesCards.map((request) => (
                      <article key={request.id} className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-4 shadow-lg shadow-black/10 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-white font-bold text-sm leading-tight">{formatNumeroOsDisplay(request.centroCusto)}</h5>
                            <p className="text-white/45 text-[11px] mt-1">{request.solicitante || 'Solicitação de compras'}</p>
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
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-sm">
                            <span className="text-white/45 uppercase tracking-widest text-[10px] font-bold">Total do orçamento</span>
                            <strong className="text-white">{request.budgetValue ? formatCurrency(request.budgetValue) : 'Seleção pendente'}</strong>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => openQuoteModal(request.id, 'edit')} className="w-full flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all">
                              <Package size={12} /> Orçar
                            </button>
                            <button onClick={() => openQuoteModal(request.id, 'view')} disabled={!(request.budgetDetails || []).length} className="w-full flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white px-2.5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                              <Eye size={12} /> Ver orçamento
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => setRecusaAlvo(request)} className="w-full flex items-center justify-center gap-1.5 bg-red-600/80 hover:bg-red-500 text-white px-2.5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all">
                              <Ban size={12} /> Solicitar reajuste
                            </button>
                            <button onClick={() => handleSendToApproval(request.id)} className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed" disabled={(request.budgetDetails || []).length === 0}>
                              <Send size={12} /> Enviar p/ aprovação
                            </button>
                          </div>
                        </div>
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
                <p className="text-white/45 text-sm mt-1">{formatNumeroOsDisplay(activeRequest.centroCusto)}</p>
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
                  const rowSummary = calculateBudgetDetails([row], activeRequest?.budgetDetails || []).details[0];

                  return (
                    <div key={row.itemId} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-white font-black text-lg">{row.itemLabel}</h3>
                          {!row.jaEmEstoque && (
                            <p className="text-white/35 text-xs mt-1">Adicione no mínimo 3 fornecedores. Você pode inserir mais fornecedores para este item.</p>
                          )}
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

                      {row.jaEmEstoque ? (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100 text-sm font-bold">
                          Já consta no estoque — este item não segue o fluxo de compra.
                        </div>
                      ) : (
                      <>
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
                          <p className="text-white font-bold mt-1">{row.fornecedores.length}</p>
                        </div>
                      </div>
                      </>
                      )}
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

      {buyModal && buyContext && (
        <FinModal
          wide
          title={buyIsItem ? 'Marcar como comprado · Conta a Pagar' : 'Marcar como contratado · Conta a Pagar'}
          hint="Gera a conta a pagar como Aberto S/Documento (sem documento/vencimento/banco). Ao confirmar, o item sai do kanban e vai ao Histórico como NFe pendente."
          onClose={closeBuyModal}
        >
          <form className="grid grid-cols-12 gap-4" onSubmit={handleConfirmBuy}>
            <div className="col-span-12 rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm">
              <span className="text-white/40 text-[10px] uppercase tracking-widest font-black">Item</span>
              <p className="text-white font-semibold mt-1">{buyContext.item.descricao || buyContext.item.nome} • {buyContext.item.qtd} {buyContext.item.un}</p>
            </div>

            <Field label="Empresa" span={3}>
              <Select value={buyForm.empresa} onChange={(e) => setBuyF('empresa', e.target.value)}>
                {empresasOptions.map((emp) => <option key={emp}>{emp}</option>)}
              </Select>
            </Field>
            <Field label={boldOS('Vínculo (OS / Centro de custo)')} span={5}>
              <Input value={formatNumeroOsDisplay(buyContext.request.centroCusto)} disabled />
            </Field>
            <Field label="Tipo" span={4}>
              <Select value={buyForm.tipoPagamento} onChange={(e) => setBuyF('tipoPagamento', e.target.value)}>
                {TIPOS_REEMBOLSO.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>

            <Field label="Fornecedor" span={8}>
              <Select value={buyForm.fornecedor} onChange={(e) => setBuyF('fornecedor', e.target.value)}>
                <option value="">Selecione o fornecedor…</option>
                {buyForm.fornecedor && !supplierOptions.some((s: any) => String(s?.razaoSocial) === buyForm.fornecedor) && (
                  <option value={buyForm.fornecedor}>{buyForm.fornecedor} (não cadastrado)</option>
                )}
                {supplierOptions.map((s: any) => (
                  <option key={s.id || s.razaoSocial} value={s.razaoSocial}>
                    {s.razaoSocial} — {naturezaFornecedor(s) === 'ITEM' ? 'ITEM' : 'SERVIÇO'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor total" span={4}><Input type="number" step="0.01" value={buyForm.valor} onChange={(e) => setBuyF('valor', e.target.value)} /></Field>

            {/* A classificação no Custo por OS vem da NATUREZA DO ITEM (escolhida na solicitação),
                não do fornecedor. */}
            <div className="col-span-12 -mt-1 text-[11px] font-bold">
              {buyIsItem ? (
                <span className="text-emerald-300/90">Item de <strong>MATERIAL</strong> → o custo entra em <strong>Materiais</strong> no Custo por OS.</span>
              ) : (
                <span className="text-sky-300/90">Item de <strong>SERVIÇO</strong> → o custo entra em <strong>Serviços Terceirizados</strong> no Custo por OS.</span>
              )}
            </div>

            <Field label="Observação" span={12}><Textarea value={buyForm.obs} onChange={(e) => setBuyF('obs', e.target.value)} /></Field>

            <div className="col-span-12 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[11px] leading-relaxed text-amber-200/90">
              A conta a pagar nasce como <strong>Aberto S/Documento</strong> — sem documento, vencimento nem banco.
              Quando o documento de compra (NF de entrada, boleto...) chegar, o gerente anexa e preenche número, vencimento e banco em <strong>Contas a Pagar → Editar</strong>.
            </div>

            <div className="col-span-12 flex items-center justify-between gap-2">
              <p className="text-[11px] text-white/40 flex items-center gap-2">
                <CalendarClock size={13} /> Total: <strong className="text-emerald-300">{money(num(buyForm.valor))}</strong>
              </p>
              <div className="flex gap-2">
                <Btn type="button" variant="ghost" onClick={closeBuyModal}>Cancelar</Btn>
                <Btn type="submit" variant="green" disabled={buySaving}>
                  <Banknote size={15} /> {buySaving ? 'Confirmando...' : (buyIsItem ? 'Comprar e gerar conta' : 'Contratar e gerar conta')}
                </Btn>
              </div>
            </div>
          </form>
        </FinModal>
      )}

      {recusaAlvo && (
        <RecusarPedidoModal request={recusaAlvo} onClose={() => setRecusaAlvo(null)} onConfirm={confirmarRecusa} />
      )}
    </>
  );
}