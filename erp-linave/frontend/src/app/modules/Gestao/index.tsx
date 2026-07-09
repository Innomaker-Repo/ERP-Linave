import React from 'react';
import { DashboardView } from '../../components/modules/Dashboard/DashboardView';

interface GestaoModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function GestaoModule({ activeItem, searchQuery }: GestaoModuleProps) {
  switch (activeItem) {
    case 'dashboard':
      return <DashboardView />;
    default:
      return <DashboardView />;
  }
}