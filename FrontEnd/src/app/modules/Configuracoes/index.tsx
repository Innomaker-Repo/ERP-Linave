import React from 'react';
import { UsuariosView } from '../../components/modules/Usuarios/UsuariosView';
import { EmpresasPrestadorasView } from '../../components/modules/Configuracoes/EmpresasPrestadorasView';
import { ListasAuxiliaresView } from '../../components/modules/Configuracoes/ListasAuxiliaresView';
import { TemplatesView } from '../../components/modules/Configuracoes/TemplatesView';

interface ConfiguracoesModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ConfiguracoesModule({ activeItem, searchQuery }: ConfiguracoesModuleProps) {
  switch (activeItem) {
    case 'usuarios':
      return <UsuariosView />;
    case 'empresas':
      return <EmpresasPrestadorasView />;
    case 'listas':
      return <ListasAuxiliaresView />;
    case 'templates':
      return <TemplatesView />;
    default:
      return <UsuariosView />;
  }
}
