import React from 'react';
import { ComprasView } from '../../components/modules/Compras/ComprasView';
import { FornecedoresView } from '../../components/modules/Fornecedores/FornecedoresView';

interface ComprasModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ComprasModule({ activeItem, searchQuery }: ComprasModuleProps) {
  switch (activeItem) {
    case 'compras':
      return <ComprasView searchQuery={searchQuery} />;
    case 'fornecedores':
      return <FornecedoresView searchQuery={searchQuery} />;
    default:
      return <ComprasView searchQuery={searchQuery} />;
  }
}
