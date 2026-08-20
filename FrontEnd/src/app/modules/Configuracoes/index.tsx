import React from 'react';
import { UsuariosView } from '../../components/modules/Usuarios/UsuariosView';
import { PerfilView } from '../../components/modules/Usuarios/PerfilView';
import { LogAtividadesView } from '../../components/modules/Configuracoes/LogAtividadesView';
import { EmpresasPrestadorasView } from '../../components/modules/Configuracoes/EmpresasPrestadorasView';

interface ConfiguracoesModuleProps {
  activeItem: string;
  searchQuery: string;
}

export function ConfiguracoesModule({ activeItem, searchQuery }: ConfiguracoesModuleProps) {
  switch (activeItem) {
    case 'usuarios':
      return <UsuariosView />;
    case 'empresasPrestadoras':
      return <EmpresasPrestadorasView />;
    case 'logAtividades':
      return <LogAtividadesView />;
    case 'meuPerfil':
      return <PerfilView />;
    default:
      return <UsuariosView />;
  }
}
