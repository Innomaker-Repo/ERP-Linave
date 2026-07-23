/* =========================================================================================
 * FINANCEIRO — compat / fallback
 * As seções do Financeiro agora são itens próprios no sidebar do ERP (ver ./views e o
 * roteamento em modules/Financeiro/index.tsx). Este componente é mantido apenas como
 * landing padrão (Dashboard) para chamadas legadas.
 * =======================================================================================*/
import React from 'react';
import { FinFiltersProvider, FinFiltersBar } from './finFilters';
import { DashboardView } from './views/DashboardView';

export function FinanceiroView() {
  return (
    <FinFiltersProvider>
      <div className="space-y-5">
        <FinFiltersBar />
        <DashboardView />
      </div>
    </FinFiltersProvider>
  );
}
