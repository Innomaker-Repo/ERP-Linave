import React from 'react';
import { ComprasKanbanView } from '../../components/modules/Compras/ComprasKanbanView';
import { ComprasSolicitacoesView } from '../../components/modules/Compras/ComprasSolicitacoesView';
import { ComprasAprovarComercialView } from '../../components/modules/Compras/ComprasAprovarComercialView';
import { ComprasAprovarFinanceiroView } from '../../components/modules/Compras/ComprasAprovarFinanceiroView';
import { HistoricoComprasView } from '../../components/modules/Compras/HistoricoComprasView';
import { MinhasComprasView } from '../../components/modules/Compras/MinhasComprasView';
import { FornecedoresView } from '../../components/modules/Fornecedores/FornecedoresView';

interface ComprasModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ComprasModule({ activeItem, searchQuery }: ComprasModuleProps) {
  switch (activeItem) {
    case 'compras':
      return <ComprasSolicitacoesView searchQuery={searchQuery} />;
    case 'minhasCompras':
      return <MinhasComprasView searchQuery={searchQuery} />;
    case 'kanbanCompras':
      return <ComprasKanbanView searchQuery={searchQuery} />;
    case 'aprovarComercial':
      return <ComprasAprovarComercialView searchQuery={searchQuery} />;
    case 'aprovarFinanceiro':
      return <ComprasAprovarFinanceiroView searchQuery={searchQuery} />;
    case 'historicoCompras':
      return <HistoricoComprasView searchQuery={searchQuery} />;
    case 'fornecedores':
      return <FornecedoresView searchQuery={searchQuery} />;
    default:
      return <ComprasSolicitacoesView searchQuery={searchQuery} />;
  }
}
