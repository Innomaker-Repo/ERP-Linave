import React from 'react';
import { ComprasKanbanView } from '../../components/modules/Compras/ComprasKanbanView';
import { ComprasSolicitacoesView } from '../../components/modules/Compras/ComprasSolicitacoesView';
import { ComprasAprovacoesView } from '../../components/modules/Compras/ComprasAprovacoesView';
import { FornecedoresView } from '../../components/modules/Fornecedores/FornecedoresView';

interface ComprasModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ComprasModule({ activeItem, searchQuery }: ComprasModuleProps) {
  switch (activeItem) {
    case 'compras':
      return <ComprasSolicitacoesView searchQuery={searchQuery} />;
    case 'kanbanCompras':
      return <ComprasKanbanView searchQuery={searchQuery} />;
    case 'aprovacoesCompras':
      return <ComprasAprovacoesView searchQuery={searchQuery} />;
    case 'fornecedores':
      return <FornecedoresView searchQuery={searchQuery} />;
    default:
      return <ComprasSolicitacoesView searchQuery={searchQuery} />;
  }
}
