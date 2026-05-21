import type { ElementType } from 'react';
import { CheckCircle2, ClipboardList, Clock3 } from 'lucide-react';

export type BoardStage = 'SOLICITACOES' | 'APROVACAO' | 'COMPRADOS';
export type ApprovalRoute = 'direta' | 'gerente' | null;
export type PurchaseState = 'comprado' | 'entregue' | 'estoque';

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
    id: 'APROVACAO',
    title: 'Aprovações',
    subtitle: 'Direta ou com gerente acima de R$ 500',
    icon: Clock3,
    accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-300',
  },
  {
    id: 'COMPRADOS',
    title: 'Comprados',
    subtitle: 'Comprado, entregue ou em estoque',
    icon: CheckCircle2,
    accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-300',
  },
];

export const purchaseStateLabel: Record<PurchaseState, string> = {
  comprado: 'Comprado',
  entregue: 'Entregue',
  estoque: 'Estoque',
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
});

export const createDefaultRequest = (solicitante = '', departamento = '', centroCusto = ''): FormState => ({
  solicitante,
  departamento,
  centroCusto,
});

export const normalizeRequests = (value: unknown): RequisicaoCompra[] => {
  if (!Array.isArray(value)) return [];

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
          }))
        : [],
      stage: item.stage === 'APROVACAO' || item.stage === 'COMPRADOS' ? item.stage : 'SOLICITACOES',
      approvalRoute: item.approvalRoute === 'direta' || item.approvalRoute === 'gerente' ? item.approvalRoute : null,
      purchaseState: item.purchaseState === 'entregue' || item.purchaseState === 'estoque' ? item.purchaseState : 'comprado',
      budgetValue: typeof item.budgetValue === 'number' ? item.budgetValue : null,
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

export const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
