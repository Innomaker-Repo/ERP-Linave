import React from 'react';
import { FinanceiroView } from '../../components/modules/Financeiro/FinanceiroView';

interface FinanceiroModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function FinanceiroModule({ activeItem, searchQuery }: FinanceiroModuleProps) {
  return <FinanceiroView />;
}
