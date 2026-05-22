import React from 'react';
import { useErp } from '../../context/ErpContext';
import { ComprasKanbanView } from '../../components/modules/Compras/ComprasKanbanView';
import { ComprasSolicitacoesView } from '../../components/modules/Compras/ComprasSolicitacoesView';
import { ComprasAprovacoesView } from '../../components/modules/Compras/ComprasAprovacoesView';
import { FornecedoresView } from '../../components/modules/Fornecedores/FornecedoresView';

interface ComprasModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ComprasModule({ activeItem, searchQuery }: ComprasModuleProps) {
  const { userSession } = useErp();
  const temAcessoCompras = userSession?.role === 'ADMIN' || userSession?.permissoes?.[activeItem] === true;

  switch (activeItem) {
    case 'compras':
      return <ComprasSolicitacoesView searchQuery={searchQuery} />;
    case 'kanbanCompras':
      if (!temAcessoCompras) {
        return (
          <div className="bg-[#101f3d] p-12 rounded-[40px] border border-amber-500/20 text-center m-10">
            <p className="text-amber-400 font-black uppercase tracking-widest text-lg">Acesso Restrito</p>
            <p className="text-white/20 text-xs mt-2">O kanban de compras é visível apenas para o pessoal do setor de compras.</p>
          </div>
        );
      }

      return <ComprasKanbanView searchQuery={searchQuery} />;
    case 'aprovacoesCompras':
      return <ComprasAprovacoesView searchQuery={searchQuery} />;
    case 'fornecedores':
      if (!temAcessoCompras) {
        return (
          <div className="bg-[#101f3d] p-12 rounded-[40px] border border-amber-500/20 text-center m-10">
            <p className="text-amber-400 font-black uppercase tracking-widest text-lg">Acesso Restrito</p>
            <p className="text-white/20 text-xs mt-2">Você não tem permissão para aceder a fornecedores.</p>
          </div>
        );
      }

      return <FornecedoresView searchQuery={searchQuery} />;
    default:
      return <ComprasSolicitacoesView searchQuery={searchQuery} />;
  }
}
