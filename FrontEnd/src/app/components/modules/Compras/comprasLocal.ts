import type { ElementType } from 'react';
import { CheckCircle2, ClipboardList, Clock3, Users } from 'lucide-react';

export type BoardStage = 'SOLICITACOES' | 'SELECAO_GERENTE' | 'APROVACAO' | 'COMPRADOS';
export type ApprovalRoute = 'gerenteComercial' | 'diretorFinanceiro' | null;
// Itens (produtos) iniciam em 'comprar' e avançam para comprado/entregue/estoque.
// Serviços iniciam em 'aContratar' e avançam para contratado.
export type PurchaseState = 'comprar' | 'comprado' | 'entregue' | 'estoque' | 'aContratar' | 'contratado';

export const APPROVAL_LIMIT = 500;

// Emails mockados dos únicos perfis autorizados a selecionar o fornecedor na etapa
// "Seleção do Gerente". Provisório até existir um modelo de permissões por usuário.
export const MOCK_GERENTE_COMERCIAL_EMAIL = 'gerente.comercial@linave.com.br';
export const MOCK_DIRETOR_FINANCEIRO_EMAIL = 'diretor.financeiro@linave.com.br';

// Quem opera a etapa de seleção do gerente: perfis Admin/Gerente (login real) OU os e-mails
// de gerente comercial / diretor financeiro (mockados e padrões comercial@/financeiro@).
// Sem isso, com o login real ninguém (nem o admin) avançava os pedidos para a Aprovação.
export const podeSelecionarFornecedorGerente = (email?: string | null, role?: string | null): boolean => {
  const r = String(role || '').trim().toUpperCase();
  if (r === 'ADMIN' || r === 'GERENTE') return true;
  const normalized = String(email || '').trim().toLowerCase();
  return (
    normalized === MOCK_GERENTE_COMERCIAL_EMAIL ||
    normalized === MOCK_DIRETOR_FINANCEIRO_EMAIL ||
    normalized.startsWith('comercial@') ||
    normalized.startsWith('financeiro@') ||
    (normalized.includes('gerente') && normalized.includes('comercial')) ||
    (normalized.includes('diretor') && normalized.includes('financeiro'))
  );
};

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
  // Identidade estável do solicitante (login) — permite o histórico por usuário mesmo
  // que o nome digitado mude. Opcionais para compat. com pedidos antigos (só têm `solicitante`).
  solicitanteCpf?: string;
  solicitanteEmail?: string;
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
    subtitle: 'Marque cada item como comprado/contratado: gera a conta a pagar e vai ao histórico (NFe pendente)',
    icon: CheckCircle2,
    accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-300',
  },
];

export const purchaseStateLabel: Record<PurchaseState, string> = {
  comprar: 'Comprar',
  comprado: 'Comprado',
  entregue: 'Entregue',
  estoque: 'Estoque',
  aContratar: 'À contratar',
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
  purchaseState: 'aContratar',
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
      solicitanteCpf: String(item.solicitanteCpf || ''),
      solicitanteEmail: String(item.solicitanteEmail || ''),
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
            purchaseState: ['comprar', 'comprado', 'entregue', 'estoque', 'aContratar', 'contratado'].includes(it.purchaseState)
              ? it.purchaseState
              : (it.naturezaFornecimento === 'ITEM' ? 'comprar' : 'aContratar'),
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

// ---------------------------------------------------------------------------
// Histórico de Compras — agora um registro POR ITEM comprado/contratado.
// Cada item que sai do kanban (ao ser marcado "Comprado"/"Contratado") gera o
// seu próprio registro no histórico, carregando o estado de estoque e o status
// da NF do fornecedor (NFe de entrada). A exibição reagrupa por pedido.
// ---------------------------------------------------------------------------
export type HistoricoNfeStatus = 'pendente' | 'lancada';
export type HistoricoPurchaseState = 'comprado' | 'estoque' | 'contratado';

export interface CompraHistoricoRegistro {
  id: string; // `${pedidoId}::${itemId}` — único (exigido pelo backend)
  pedidoId: string;
  centroCusto: string;
  solicitante: string;
  solicitanteCpf?: string;
  solicitanteEmail?: string;
  departamento: string;
  itemId: string;
  itemNome: string;
  itemDescricao: string;
  categoria: string;
  qtd: number;
  un: string;
  naturezaFornecimento: 'ITEM' | 'SERVICO';
  fornecedor: string;
  valor: number | null;
  prazoEntrega: string;
  condicaoPagamento: string;
  purchaseState: HistoricoPurchaseState;
  nfeStatus: HistoricoNfeStatus;
  nfeNumero?: string;
  nfeAnexos?: string[];
  contaPagarId?: string;
  compradoEm: string;
  compradoPor: string;
  estoqueOkEm?: string;
  estoqueOkPor?: string;
  nfeLancadaEm?: string;
  nfeLancadaPor?: string;
}

export const historicoRecordId = (pedidoId: string, itemId: string) => `${pedidoId}::${itemId}`;

// Monta o registro de histórico (1 por item) a partir do pedido + item + cotação selecionada.
export const buildHistoricoRecord = (
  request: RequisicaoCompra,
  item: ItemCompra,
  detail: QuoteItem | null,
  userLabel: string,
  contaPagarId?: string,
): CompraHistoricoRegistro => {
  const isItem = (detail?.naturezaFornecimento || item.naturezaFornecimento) === 'ITEM';

  return {
    id: historicoRecordId(request.id, item.id),
    pedidoId: request.id,
    centroCusto: request.centroCusto,
    solicitante: request.solicitante,
    solicitanteCpf: request.solicitanteCpf || '',
    solicitanteEmail: request.solicitanteEmail || '',
    departamento: request.departamento,
    itemId: item.id,
    itemNome: item.nome,
    itemDescricao: item.descricao,
    categoria: item.categoria,
    qtd: item.qtd,
    un: item.un,
    naturezaFornecimento: isItem ? 'ITEM' : 'SERVICO',
    fornecedor: detail?.fornecedorSelecionado || item.fornecedor || '',
    valor: detail?.valorSelecionado ?? null,
    prazoEntrega: detail?.prazoEntregaSelecionado || '',
    condicaoPagamento: detail?.condicaoPagamentoSelecionada || '',
    purchaseState: isItem ? 'comprado' : 'contratado',
    nfeStatus: 'pendente',
    contaPagarId,
    compradoEm: new Date().toISOString(),
    compradoPor: userLabel,
  };
};

// Rótulo da etapa do pedido no funil de compras (usado no histórico por usuário).
export const stageLabel: Record<BoardStage, string> = {
  SOLICITACOES: 'Solicitação',
  SELECAO_GERENTE: 'Em cotação',
  APROVACAO: 'Em aprovação',
  COMPRADOS: 'Em compra',
};

// O registro (pedido ou item de histórico) pertence ao usuário logado?
// Casa por CPF/e-mail (identidade estável do login) e, para dados antigos, pelo nome digitado.
export const matchesSolicitante = (
  record: { solicitante?: string; solicitanteCpf?: string; solicitanteEmail?: string },
  session: { cpf?: string; email?: string; nome?: string } | null | undefined,
): boolean => {
  if (!session) return false;
  const norm = (v?: string) => String(v || '').trim().toLowerCase();
  const cpf = norm(session.cpf);
  const email = norm(session.email);
  const nome = norm(session.nome);
  if (cpf && norm(record.solicitanteCpf) === cpf) return true;
  if (email && norm(record.solicitanteEmail) === email) return true;
  const s = norm(record.solicitante);
  if (!s) return false;
  return (!!nome && s === nome) || (!!email && s === email);
};

// Achata registros de histórico legados (shape antigo por pedido, com `itens`) em registros por
// item (somente leitura) para que o histórico anterior continue aparecendo. Registros já no
// novo shape (por item) passam direto. Compartilhado pelas telas de Histórico de Compras.
export const toItemRecords = (registros: any[]): CompraHistoricoRegistro[] => {
  const rows: CompraHistoricoRegistro[] = [];
  for (const r of registros || []) {
    if (r && Array.isArray(r.itens)) {
      const details = Array.isArray(r.budgetDetails) ? r.budgetDetails : [];
      for (const it of r.itens) {
        const d = details.find((x: any) => x.itemId === it.id) || null;
        const isItem = (d?.naturezaFornecimento || it.naturezaFornecimento) === 'ITEM';
        rows.push({
          id: `${r.id}::${it.id}`,
          pedidoId: String(r.id || ''),
          centroCusto: String(r.centroCusto || ''),
          solicitante: String(r.solicitante || ''),
          solicitanteCpf: String(r.solicitanteCpf || ''),
          solicitanteEmail: String(r.solicitanteEmail || ''),
          departamento: String(r.departamento || ''),
          itemId: String(it.id || ''),
          itemNome: String(it.nome || ''),
          itemDescricao: String(it.descricao || ''),
          categoria: String(it.categoria || ''),
          qtd: Number(it.qtd || 0),
          un: String(it.un || 'un'),
          naturezaFornecimento: isItem ? 'ITEM' : 'SERVICO',
          fornecedor: d?.fornecedorSelecionado || it.fornecedor || '',
          valor: d?.valorSelecionado ?? null,
          prazoEntrega: d?.prazoEntregaSelecionado || '',
          condicaoPagamento: d?.condicaoPagamentoSelecionada || '',
          purchaseState: it.purchaseState === 'estoque' ? 'estoque' : it.purchaseState === 'contratado' ? 'contratado' : 'comprado',
          nfeStatus: 'pendente',
          compradoEm: String(r.finalizadoEm || ''),
          compradoPor: String(r.finalizadoPor || ''),
          _legacy: true,
        } as CompraHistoricoRegistro & { _legacy: boolean });
      }
    } else if (r && (r.itemId || r.pedidoId)) {
      rows.push(r as CompraHistoricoRegistro);
    }
  }
  return rows;
};
