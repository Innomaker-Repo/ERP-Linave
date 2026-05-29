import type { ElementType } from 'react';
import { CheckCircle2, ClipboardList, Clock3, Users } from 'lucide-react';

export type BoardStage = 'SOLICITACOES' | 'SELECAO_GERENTE' | 'APROVACAO' | 'COMPRADOS';
export type ApprovalRoute = 'gerenteComercial' | 'diretorFinanceiro' | null;
export type PurchaseState = 'comprado' | 'entregue' | 'estoque' | 'contratado';

export const APPROVAL_LIMIT = 500;

export const approvalRouteLabel: Record<Exclude<ApprovalRoute, null>, string> = {
  gerenteComercial: 'Gerente Comercial',
  diretorFinanceiro: 'Diretor Financeiro',
};

export const resolveApprovalRoute = (budgetValue: number | null | undefined): Exclude<ApprovalRoute, null> =>
  (budgetValue || 0) >= APPROVAL_LIMIT ? 'diretorFinanceiro' : 'gerenteComercial';

export interface QuoteFornecedor {
  fornecedor: string;
  valor: number;
  prazoEntrega: string;
  condicaoPagamento: string;
}

export interface QuoteItem {
  itemId: string;
  naturezaFornecimento: 'ITEM' | 'SERVICO';
  fornecedores: QuoteFornecedor[];
  menorValor: number | null;
  fornecedorVencedor: string;
  fornecedorSelecionado: string;
  valorSelecionado: number | null;
  prazoEntregaSelecionado: string;
  condicaoPagamentoSelecionada: string;
  jaEmEstoque: boolean;
}

export interface ItemCompra {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  dataDesejada: string;
  prioridade: string;
  qtd: number;
  un: string;
  link: string;
  fornecedor: string;
  naturezaFornecimento: 'ITEM' | 'SERVICO';
  purchaseState: PurchaseState;
}

export interface RequisicaoCompra {
  id: string;
  solicitante: string;
  departamento: string;
  centroCusto: string;
  itens: ItemCompra[];
  stage: BoardStage;
  approvalRoute: ApprovalRoute;
  purchaseState: PurchaseState;
  budgetValue: number | null;
  budgetDetails: QuoteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface FormState {
  solicitante: string;
  departamento: string;
  centroCusto: string;
}

export const STORAGE_KEY = 'erp.compras.kanban.v1';

export const BOARD_COLUMNS: Array<{ id: BoardStage; title: string; subtitle: string; icon: ElementType; accent: string }> = [
  {
    id: 'SOLICITACOES',
    title: 'Solicitações',
    subtitle: 'Orçamento é levantado aqui',
    icon: ClipboardList,
    accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-300',
  },
  {
    id: 'SELECAO_GERENTE',
    title: 'Seleção do Gerente',
    subtitle: 'Gerente analisa e escolhe os orçamentos',
    icon: Users,
    accent: 'from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-300',
  },
  {
    id: 'APROVACAO',
    title: 'Aprovações',
    subtitle: 'Até R$ 499 com gerente comercial, a partir de R$ 500 com diretor financeiro',
    icon: Clock3,
    accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-300',
  },
  {
    id: 'COMPRADOS',
    title: 'Compras',
    subtitle: 'Comprado, entregue, estoque ou contratado por item',
    icon: CheckCircle2,
    accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-300',
  },
];

export const purchaseStateLabel: Record<PurchaseState, string> = {
  comprado: 'Comprado',
  entregue: 'Entregue',
  estoque: 'Estoque',
  contratado: 'Contratado',
};

export const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createEmptyItem = (): ItemCompra => ({
  id: createId(),
  nome: '',
  descricao: '',
  categoria: '',
  dataDesejada: '',
  prioridade: 'Normal',
  qtd: 1,
  un: 'un',
  link: '',
  fornecedor: '',
  naturezaFornecimento: 'SERVICO',
  purchaseState: 'contratado',
});

export const createDefaultRequest = (solicitante = '', departamento = '', centroCusto = ''): FormState => ({
  solicitante,
  departamento,
  centroCusto,
});

export const normalizeRequests = (value: unknown): RequisicaoCompra[] => {
  if (!Array.isArray(value)) return [];

  const normalizeFornecedor = (source: any): QuoteFornecedor => ({
    fornecedor: String(source?.fornecedor || ''),
    valor: Number(source?.valor || 0),
    prazoEntrega: String(source?.prazoEntrega || ''),
    condicaoPagamento: String(source?.condicaoPagamento || ''),
  });

  const normalizeQuote = (quote: any, index: number): QuoteItem => {
    const fornecedores = Array.isArray(quote?.fornecedores) && quote.fornecedores.length > 0
      ? quote.fornecedores.map(normalizeFornecedor)
      : [quote?.fornecedor1, quote?.fornecedor2, quote?.fornecedor3].map(normalizeFornecedor);

    const valoresValidos: QuoteFornecedor[] = fornecedores.filter((entry: QuoteFornecedor) => entry.fornecedor.trim() && Number.isFinite(entry.valor) && entry.valor > 0);
    const menor = valoresValidos.reduce<number | null>((current: number | null, entry: QuoteFornecedor) => (current === null || entry.valor < current ? entry.valor : current), null);
    const vencedor = valoresValidos.find((entry: QuoteFornecedor) => entry.valor === menor)?.fornecedor || '';
    const selecionado = String(quote?.fornecedorSelecionado || '');
    const fornecedorSelecionado = fornecedores.find((entry: QuoteFornecedor) => entry.fornecedor === selecionado) || null;

    const naturezaFornecimento = quote?.naturezaFornecimento === 'ITEM' || quote?.naturezaFornecimento === 'SERVICO'
      ? quote.naturezaFornecimento
      : 'SERVICO';

    return {
      itemId: String(quote?.itemId || quote?.id || index),
      naturezaFornecimento,
      fornecedores: valoresValidos,
      menorValor: menor,
      fornecedorVencedor: vencedor,
      fornecedorSelecionado: fornecedorSelecionado?.fornecedor || '',
      valorSelecionado: fornecedorSelecionado ? fornecedorSelecionado.valor : null,
      prazoEntregaSelecionado: fornecedorSelecionado?.prazoEntrega || '',
      condicaoPagamentoSelecionada: fornecedorSelecionado?.condicaoPagamento || '',
      jaEmEstoque: Boolean(quote?.jaEmEstoque),
    };
  };

  const normalizeApprovalRoute = (route: any, budgetValue: number | null): ApprovalRoute => {
    if (route === 'gerenteComercial' || route === 'diretorFinanceiro') {
      return route;
    }

    // Backward compatibility with older route names.
    if (route === 'gerente' || route === 'direta') {
      return resolveApprovalRoute(budgetValue);
    }

    return null;
  };

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item: any) => ({
      id: String(item.id || createId()),
      solicitante: String(item.solicitante || ''),
      departamento: String(item.departamento || ''),
      centroCusto: String(item.centroCusto || ''),
      itens: Array.isArray(item.itens)
        ? item.itens.map((it: any) => ({
            id: String(it.id || createId()),
            nome: String(it.nome || ''),
            descricao: String(it.descricao || ''),
            categoria: String(it.categoria || ''),
            dataDesejada: String(it.dataDesejada || ''),
            prioridade: String(it.prioridade || 'Normal'),
            qtd: Number(it.qtd || 1),
            un: String(it.un || 'un'),
            link: String(it.link || ''),
            fornecedor: String(it.fornecedor || ''),
            naturezaFornecimento: it.naturezaFornecimento === 'ITEM' || it.naturezaFornecimento === 'SERVICO' ? it.naturezaFornecimento : 'SERVICO',
            purchaseState: it.purchaseState === 'comprado' || it.purchaseState === 'entregue' || it.purchaseState === 'estoque' || it.purchaseState === 'contratado'
              ? it.purchaseState
              : (it.naturezaFornecimento === 'ITEM' ? 'comprado' : 'contratado'),
          }))
        : [],
      stage: ['SOLICITACOES','SELECAO_GERENTE','APROVACAO','COMPRADOS'].includes(item.stage) ? item.stage : 'SOLICITACOES',
      approvalRoute: normalizeApprovalRoute(item.approvalRoute, typeof item.budgetValue === 'number' ? item.budgetValue : null),
      purchaseState: item.purchaseState === 'entregue' || item.purchaseState === 'estoque' || item.purchaseState === 'contratado' ? item.purchaseState : 'comprado',
      budgetValue: typeof item.budgetValue === 'number' ? item.budgetValue : null,
      budgetDetails: Array.isArray(item.budgetDetails) ? item.budgetDetails.map(normalizeQuote) : [],
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    }))
    .filter((item) => item.itens.length > 0);
};

export const getStoredRequests = (): RequisicaoCompra[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    return normalizeRequests(JSON.parse(raw));
  } catch (error) {
    return [];
  }
};

export const saveRequests = (requests: RequisicaoCompra[]) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
};

export const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
