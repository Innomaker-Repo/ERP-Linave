import React from 'react';
import { UsuariosView } from '../../components/modules/Usuarios/UsuariosView';

interface ConfiguracoesModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ConfiguracoesModule({ activeItem, searchQuery }: ConfiguracoesModuleProps) {
  switch (activeItem) {
    case 'usuarios':
      return <UsuariosView />;
    default:
      return <UsuariosView />;
  }
}
