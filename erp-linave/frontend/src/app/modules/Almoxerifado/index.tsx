import React from 'react';
import { EstoqueView } from '../../components/modules/Almoxerifado/EstoqueView';
import { HistoricoBaixaView } from '../../components/modules/Almoxerifado/HistoricoBaixaView';
import { HistoricoRomaneioView } from '../../components/modules/Almoxerifado/HistoricoRomaneioView';
import { AlocadosPorOSView } from '../../components/modules/Almoxerifado/AlocadosPorOSView';
import { ItensParaAdicionarView } from '../../components/modules/Almoxerifado/ItensParaAdicionarView';

interface AlmoxerifadoModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function AlmoxerifadoModule({ activeItem, searchQuery }: AlmoxerifadoModuleProps) {
  switch (activeItem) {
    case 'estoquePublico':
      return <EstoqueView searchQuery={searchQuery} mode="public" />;
    case 'itensAdicionar':
      return <ItensParaAdicionarView searchQuery={searchQuery} />;
    case 'historicoBaixa':
      return <HistoricoBaixaView searchQuery={searchQuery} />;
    case 'historicoRomaneio':
      return <HistoricoRomaneioView searchQuery={searchQuery} />;
    case 'alocadosPorOS':
      return <AlocadosPorOSView searchQuery={searchQuery} />;
    case 'estoque':
    default:
      return <EstoqueView searchQuery={searchQuery} />;
  }
}
