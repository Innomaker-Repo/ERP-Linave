import type { ElementType, ReactNode } from 'react';
import { boldOS } from './utils/osHighlight';
import {
  House, Users, Anchor, ClipboardList,
  ShoppingCart, DollarSign, BarChart3, Settings, Factory,
  HeartHandshake, Clock, Briefcase, FileText, Zap, CheckCircle2, Trash2, LayoutGrid, Package2, History,
  FilePlus, Banknote, ScrollText, Wallet, TrendingUp, Landmark, Ruler, UserCog, ShoppingBag
} from 'lucide-react';

/* =========================================================================================
 * NAVEGAÇÃO — fonte única de verdade dos departamentos/itens do ERP e da regra de acesso.
 * Consumida pela Sidebar (menu lateral) e pela Home (grade de acessos pós-login).
 * Ao adicionar uma aba nova: incluir aqui, no switch do App.tsx e (se for controlada por
 * permissão) no painel de Usuários & Acessos + permissions.py do backend.
 * =======================================================================================*/

export interface NavItem {
  id: string;
  label: ReactNode;
  icon: ElementType;
}

export interface NavDepartment {
  id: string;
  title: string;
  icon: ElementType;
  items: NavItem[];
}

export const DEPARTMENTS: NavDepartment[] = [
  {
    id: 'gestao',
    title: 'Gestão & Estratégia',
    icon: Briefcase,
    items: [
      { id: 'dashboard', label: 'Dashboard Geral', icon: House },
      { id: 'relatorios', label: 'Relatórios BI', icon: BarChart3 },
    ]
  },
  {
    id: 'producao',
    title: 'Produção',
    icon: Anchor,
    items: [
      // Visão Macro do Projeto (USV Traveller)
      { id: 'obras', label: 'Serviços (Produção)', icon: Anchor },
    ]
  },
  {
    id: 'comercial',
    title: 'Comercial',
    icon: Users,
    items: [
      // CRM - Gerenciamento de Negócios
      { id: 'crm', label: 'Negócios (CRM)', icon: HeartHandshake },

      { id: 'orcamentos', label: 'Orçar Negócios', icon: FileText },

      // Fazer Proposta
      { id: 'proposta', label: 'Fazer Proposta', icon: FileText },

      // Fazer Ordem de Serviço
      { id: 'fazerOs', label: boldOS('Fazer OS'), icon: Zap },

      // Medição (por OS) — só aprovada libera finalização
      { id: 'medicao', label: 'Medição', icon: Ruler },

      // Histórico de negócios com medição aprovada/finalizada
      { id: 'finalizadosComercial', label: 'Finalizados', icon: CheckCircle2 },

      // Base de Clientes
      { id: 'clientes', label: 'Base de Clientes', icon: Users },
    ]
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    icon: DollarSign,
    items: [
      // Operação
      { id: 'finDashboard', label: 'Dashboard Financeiro', icon: House },
      { id: 'finSolicitacao', label: 'Solicitação de Pagamento', icon: FilePlus },
      { id: 'finAprovacoes', label: 'Aprovações', icon: CheckCircle2 },
      { id: 'finPagar', label: 'Contas a Pagar', icon: Banknote },
      { id: 'finNfe', label: 'NFe', icon: ScrollText },
      { id: 'finReceber', label: 'Contas a Receber', icon: Wallet },
      { id: 'finPrevisao', label: 'Previsão de Receita', icon: TrendingUp },
      // Gestão
      { id: 'finBancos', label: 'Bancos', icon: Landmark },
      { id: 'finHistorico', label: 'Histórico', icon: History },
      { id: 'finCustoOs', label: boldOS('Custo por OS'), icon: ClipboardList },
      { id: 'finReciboLocacao', label: 'Fazer Recibo de Locação', icon: ScrollText },
    ]
  },
  {
    id: 'compras',
    title: 'Compras',
    icon: ShoppingCart,
    items: [
      { id: 'compras', label: 'Compras / Requisições', icon: ShoppingCart },
      { id: 'minhasCompras', label: 'Minhas Compras', icon: ShoppingBag },
      { id: 'kanbanCompras', label: 'Kanban de Compras', icon: LayoutGrid },
      { id: 'aprovacoesCompras', label: 'Aprovações', icon: Clock },
      { id: 'historicoCompras', label: 'Histórico de Compras', icon: History },
      { id: 'fornecedores', label: 'Fornecedores', icon: Factory },
    ]
  },
  {
    id: 'almoxerifado',
    title: 'Suprimentos',
    icon: ClipboardList,
    items: [
      { id: 'estoquePublico', label: 'Estoque View', icon: ClipboardList },
      { id: 'estoque', label: 'Almoxarifado', icon: ClipboardList },
      { id: 'itensAdicionar', label: 'Itens para adicionar', icon: Package2 },
      { id: 'historicoBaixa', label: 'Histórico de Baixa', icon: Trash2 },
      { id: 'historicoRomaneio', label: 'Histórico de Romaneio', icon: ClipboardList },
      { id: 'alocadosPorOS', label: boldOS('Alocados por OS'), icon: ClipboardList },
    ]
  },
  {
    id: 'config',
    title: 'Configurações',
    icon: Settings,
    items: [
      { id: 'usuarios', label: 'Usuários & Acessos', icon: Users },
      { id: 'logAtividades', label: 'Log de Atividades', icon: History },
      { id: 'meuPerfil', label: 'Meu Perfil', icon: UserCog },
    ]
  }
];

// Itens liberados a TODO usuário logado, independentemente do painel de permissões:
// solicitar compra, ver o próprio histórico de compras e solicitar pagamento.
// (O backend espelha isso: compras_data e financeiro/solicitacao/ são só IsAuthenticated.)
export const ITENS_LIBERADOS_A_TODOS = ['compras', 'minhasCompras', 'finSolicitacao'] as const;

export const hasAccess = (userSession: any, itemId: string): boolean => {
  if (!userSession) return false;
  const role = userSession.role?.toUpperCase() || '';

  // Admin: acesso total, exceto "Meu Perfil" (usa Usuários & Acessos)
  if (role === 'ADMIN') {
    return itemId !== 'meuPerfil';
  }

  // Gerente/Usuário: sem acesso a gerenciamento de usuários nem log de atividades
  if (itemId === 'usuarios' || itemId === 'logAtividades') return false;

  // Gerente: acesso a tudo mais; usa "Meu Perfil"
  if (role === 'GERENTE') return true;

  if ((ITENS_LIBERADOS_A_TODOS as readonly string[]).includes(itemId)) return true;

  // Usuário: apenas itens explicitamente liberados pelo admin + Meu Perfil
  if (itemId === 'meuPerfil') return true;
  return userSession.permissoes?.[itemId] === true;
};
