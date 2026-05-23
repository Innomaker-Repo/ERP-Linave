import React from 'react';
import { EstoqueView } from '../../components/modules/Almoxerifado/EstoqueView';
import { HistoricoBaixaView } from '../../components/modules/Almoxerifado/HistoricoBaixaView';
import { AlocadosPorOSView } from '../../components/modules/Almoxerifado/AlocadosPorOSView';

interface AlmoxerifadoModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function AlmoxerifadoModule({ activeItem, searchQuery }: AlmoxerifadoModuleProps) {
  switch (activeItem) {
    case 'estoquePublico':
      return <EstoqueView searchQuery={searchQuery} mode="public" />;
    case 'historicoBaixa':
      return <HistoricoBaixaView searchQuery={searchQuery} />;
    case 'alocadosPorOS':
      return <AlocadosPorOSView searchQuery={searchQuery} />;
    case 'estoque':
    default:
      return <EstoqueView searchQuery={searchQuery} />;
  }
}
