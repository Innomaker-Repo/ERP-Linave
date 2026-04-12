import React from 'react';
import { CrmViewNew } from '../../components/modules/CRM/CrmViewNew';
import { ClientesView } from '../../components/modules/Clientes/ClientesView';
import { PropostaView } from '../../components/modules/Comercial/PropostaView';
import { OsView } from '../../components/modules/OS/OsView';

interface ComercialModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ComercialModule({ activeItem, searchQuery }: ComercialModuleProps) {
  switch (activeItem) {
    case 'crm':
      return <CrmViewNew searchQuery={searchQuery} />;
    case 'clientes':
      return <ClientesView searchQuery={searchQuery} />;
    case 'proposta':
      return <PropostaView />;
    case 'fazerOs':
      return <OsView searchQuery={searchQuery} />;
    default:
      return <CrmViewNew searchQuery={searchQuery} />;
  }
}
