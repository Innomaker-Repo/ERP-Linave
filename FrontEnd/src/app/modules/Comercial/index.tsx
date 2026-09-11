import React from 'react';
import { CrmViewNew } from '../../components/modules/CRM/CrmViewNew';
import { ClientesView } from '../../components/modules/Clientes/ClientesView';
import { PropostaView } from '../../components/modules/Comercial/PropostaView';
import { TemplatesPropostaView } from '../../components/modules/Comercial/TemplatesPropostaView';
import { MedicaoView } from '../../components/modules/Comercial/MedicaoView';
import { FinalizadosComercialView } from '../../components/modules/Comercial/FinalizadosComercialView';
import { OsView } from '../../components/modules/OS/OsView';
import { OrcamentosView } from '../../components/modules/Orcamentos/OrcamentosView';

interface ComercialModuleProps {
  activeItem: string;
  searchQuery: string;
  // Id do negócio (obraId) que a tela de OS deve abrir sozinha ao montar — vem do
  // fluxo "Deseja ir direto para OS?" do Novo Negócio (ver App.tsx/CrmViewNew.tsx).
  autoAbrirOsObraId?: string | null;
  onAutoAbrirOsConsumido?: () => void;
}

export function ComercialModule({ activeItem, searchQuery, autoAbrirOsObraId, onAutoAbrirOsConsumido }: ComercialModuleProps) {
  switch (activeItem) {
    case 'crm':
      return <CrmViewNew searchQuery={searchQuery} />;
    case 'clientes':
      return <ClientesView searchQuery={searchQuery} />;
    case 'proposta':
      return <PropostaView />;
    case 'templatesProposta':
      return <TemplatesPropostaView />;
    case 'fazerOs':
      return <OsView searchQuery={searchQuery} autoAbrirObraId={autoAbrirOsObraId} onAutoAbrirConsumido={onAutoAbrirOsConsumido} />;
    case 'orcamentos':
      return <OrcamentosView searchQuery={searchQuery} />;
    case 'medicao':
      return <MedicaoView searchQuery={searchQuery} />;
    case 'finalizadosComercial':
      return <FinalizadosComercialView searchQuery={searchQuery} />;
    default:
      return <CrmViewNew searchQuery={searchQuery} />;
  }
}
