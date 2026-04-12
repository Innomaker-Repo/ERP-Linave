import React from 'react';
import { EstoqueView } from '../../components/modules/Almoxerifado/EstoqueView';

interface AlmoxerifadoModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function AlmoxerifadoModule({ activeItem, searchQuery }: AlmoxerifadoModuleProps) {
  return <EstoqueView searchQuery={searchQuery} />;
}
