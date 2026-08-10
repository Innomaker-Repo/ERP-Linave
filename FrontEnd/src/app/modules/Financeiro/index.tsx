import React from 'react';
import { FinFiltersProvider, FinFiltersBar } from '../../components/modules/Financeiro/finFilters';
import { FinNavProvider } from '../../components/modules/Financeiro/finNav';
import { DashboardView } from '../../components/modules/Financeiro/views/DashboardView';
import { SolicitacaoView } from '../../components/modules/Financeiro/views/SolicitacaoView';
import { AprovacoesView } from '../../components/modules/Financeiro/views/AprovacoesView';
import { ContasPagarView } from '../../components/modules/Financeiro/views/ContasPagarView';
import { NfeView } from '../../components/modules/Financeiro/views/NfeView';
import { ContasReceberView } from '../../components/modules/Financeiro/views/ContasReceberView';
import { PrevisaoView } from '../../components/modules/Financeiro/views/PrevisaoView';
import { BancosView } from '../../components/modules/Financeiro/views/BancosView';
import { HistoricoView } from '../../components/modules/Financeiro/views/HistoricoView';
import { CustoPorOsView } from '../../components/modules/Financeiro/views/CustoPorOsView';
import { ReciboLocacaoView } from '../../components/modules/Financeiro/views/ReciboLocacaoView';

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
  aprovacoes: AprovacoesView,
  pagar: ContasPagarView,
  nfe: NfeView,
  receber: ContasReceberView,
  previsao: PrevisaoView,
  bancos: BancosView,
  historico: HistoricoView,
  custoOs: CustoPorOsView,
  reciboLocacao: ReciboLocacaoView,
};

export function FinanceiroModule({ activeItem, onNavigate }: FinanceiroModuleProps) {
  const Active = VIEWS[activeItem] || DashboardView;
  return (
    <FinNavProvider onNavigate={onNavigate}>
      <FinFiltersProvider view={activeItem}>
        <div className="space-y-5">
          <FinFiltersBar view={activeItem} />
          <Active />
        </div>
      </FinFiltersProvider>
    </FinNavProvider>
  );
}
