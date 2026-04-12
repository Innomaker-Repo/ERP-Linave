import React from 'react';
import { DashboardView } from '../../components/modules/Dashboard/DashboardView';
import { RelatoriosView } from '../../components/modules/Relatorios/RelatoriosView';

interface GestaoModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function GestaoModule({ activeItem, searchQuery }: GestaoModuleProps) {
  switch (activeItem) {
    case 'dashboard':
      return <DashboardView />;
    case 'relatorios':
      return <RelatoriosView />;
    default:
      return <DashboardView />;
  }
}
