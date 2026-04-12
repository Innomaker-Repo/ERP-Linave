import React from 'react';
import { OrcamentosView } from '../../components/modules/Orcamentos/OrcamentosView';

interface OrcamentosModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function OrcamentosModule({ activeItem, searchQuery }: OrcamentosModuleProps) {
  return <OrcamentosView searchQuery={searchQuery} />;
}
