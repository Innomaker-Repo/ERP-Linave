import React from 'react';
import { ObrasView } from '../../components/modules/Obras/ObrasView';
import { ServicosView } from '../../components/modules/Servicos/ServicosView';

interface ProducaoModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ProducaoModule({ activeItem, searchQuery }: ProducaoModuleProps) {
  switch (activeItem) {
    case 'obras':
      return <ObrasView searchQuery={searchQuery} />;
    case 'servicos':
      return <ServicosView searchQuery={searchQuery} />;
    default:
      return <ObrasView searchQuery={searchQuery} />;
  }
}
