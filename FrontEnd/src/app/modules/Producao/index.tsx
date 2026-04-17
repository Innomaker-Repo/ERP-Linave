import React from 'react';
import { ObrasView } from '../../components/modules/Obras/ObrasView';

interface ProducaoModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ProducaoModule({ activeItem, searchQuery }: ProducaoModuleProps) {
  switch (activeItem) {
    case 'obras':
      return <ObrasView searchQuery={searchQuery} />;
    default:
      return <ObrasView searchQuery={searchQuery} />;
  }
}
