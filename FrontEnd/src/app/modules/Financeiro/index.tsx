import React from 'react';
import { FinFiltersProvider, FinFiltersBar } from '../../components/modules/Financeiro/finFilters';
import { DashboardView } from '../../components/modules/Financeiro/views/DashboardView';
import { SolicitacaoView } from '../../components/modules/Financeiro/views/SolicitacaoView';
import { AprovacoesView } from '../../components/modules/Financeiro/views/AprovacoesView';
import { ContasPagarView } from '../../components/modules/Financeiro/views/ContasPagarView';
import { NfeView } from '../../components/modules/Financeiro/views/NfeView';
import { ContasReceberView } from '../../components/modules/Financeiro/views/ContasReceberView';
import { PrevisaoView } from '../../components/modules/Financeiro/views/PrevisaoView';
import { BancosView } from '../../components/modules/Financeiro/views/BancosView';
import { DepartamentosView } from '../../components/modules/Financeiro/views/DepartamentosView';
import { HistoricoView } from '../../components/modules/Financeiro/views/HistoricoView';

interface FinanceiroModuleProps {
  activeItem: string;
  searchQuery: string;
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
  departamentos: DepartamentosView,
  historico: HistoricoView,
};

export function FinanceiroModule({ activeItem }: FinanceiroModuleProps) {
  const Active = VIEWS[activeItem] || DashboardView;
  return (
    <FinFiltersProvider>
      <div className="space-y-5">
        <FinFiltersBar />
        <Active />
      </div>
    </FinFiltersProvider>
  );
}
