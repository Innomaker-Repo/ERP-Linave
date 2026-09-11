import React from 'react';
import { FinFiltersProvider, FinFiltersBar } from '../../components/modules/Financeiro/finFilters';
import { FinNavProvider } from '../../components/modules/Financeiro/finNav';
import { DashboardView } from '../../components/modules/Financeiro/views/DashboardView';
import { SolicitacaoView } from '../../components/modules/Financeiro/views/SolicitacaoView';
import { MeusPagamentosView } from '../../components/modules/Financeiro/views/MeusPagamentosView';
import { AprovacoesView } from '../../components/modules/Financeiro/views/AprovacoesView';
import { ContasPagarView } from '../../components/modules/Financeiro/views/ContasPagarView';
import { NfeReciboView } from '../../components/modules/Financeiro/views/NfeReciboView';
import { ContasReceberView } from '../../components/modules/Financeiro/views/ContasReceberView';
import { PrevisaoView } from '../../components/modules/Financeiro/views/PrevisaoView';
import { BancosView } from '../../components/modules/Financeiro/views/BancosView';
import { HistoricoView } from '../../components/modules/Financeiro/views/HistoricoView';
import { CustoPorOsView } from '../../components/modules/Financeiro/views/CustoPorOsView';

interface FinanceiroModuleProps {
  activeItem: string;
  searchQuery: string;
  // Navegação entre seções do ERP (setActiveSection do App). Permite que uma view do
  // Financeiro mande o usuário para outra — ex.: Contas a Receber → Solicitar NFe.
  onNavigate?: (section: string) => void;
}

// Cada item do sidebar do ERP (grupo Financeiro) cai aqui e renderiza sua própria view.
const VIEWS: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  solicitacao: SolicitacaoView,
  meusPagamentos: MeusPagamentosView,
  aprovacoes: AprovacoesView,
  pagar: ContasPagarView,
  nfe: NfeReciboView,
  receber: ContasReceberView,
  previsao: PrevisaoView,
  bancos: BancosView,
  historico: HistoricoView,
  custoOs: CustoPorOsView,
};

// "Solicitação de Pagamento" é um formulário de criação, não uma lista — os filtros
// globais (Empresa/Banco/Período) não têm nada para filtrar ali e só ocupavam espaço
// no topo da tela.
const VIEWS_SEM_FILTROS = new Set(['solicitacao']);

export function FinanceiroModule({ activeItem, onNavigate }: FinanceiroModuleProps) {
  const Active = VIEWS[activeItem] || DashboardView;
  return (
    <FinNavProvider onNavigate={onNavigate}>
      <FinFiltersProvider view={activeItem}>
        <div className="space-y-5">
          {!VIEWS_SEM_FILTROS.has(activeItem) && <FinFiltersBar view={activeItem} />}
          <Active />
        </div>
      </FinFiltersProvider>
    </FinNavProvider>
  );
}
