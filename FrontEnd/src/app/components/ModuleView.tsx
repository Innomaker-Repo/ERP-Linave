import React from "react";
import { useErp } from "../context/ErpContext";

// Importação de TODOS os módulos do sistema
import { DashboardView } from "./modules/Dashboard/DashboardView";
import { ClientesView } from "./modules/Clientes/ClientesView";
import { FuncionariosView } from "./modules/Funcionarios/FuncionariosView";
import { ObrasView } from "./modules/Obras/ObrasView";
import { OsView } from "./modules/OS/OsView";
import { ServicosView } from "./modules/Servicos/ServicosView"; // Visão ClickUp
import { AtividadesView } from "./modules/Atividades/AtividadesView"; // Diário de Bordo
import { EquipesView } from "./modules/Equipes/EquipesView";
import { HorasView } from "./modules/Horas/HorasView";
import { ComprasView } from "./modules/Compras/ComprasView";
import { FornecedoresView } from "./modules/Fornecedores/FornecedoresView";
import { FinanceiroView } from "./modules/Financeiro/FinanceiroView";
import { CrmView } from "./modules/CRM/CrmView";
import { RelatoriosView } from "./modules/Relatorios/RelatoriosView";
import { UsuariosView } from "./modules/Usuarios/UsuariosView";
import { ListasAuxiliaresView } from "./modules/Configuracoes/ListasAuxiliaresView";
import { EstoqueView } from "./modules/Almoxerifado/EstoqueView";

interface ModuleViewProps {
  section: string;
  searchQuery: string;
}

export function ModuleView({ section, searchQuery }: ModuleViewProps) {
  const { loading, userSession } = useErp();

  if (loading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-amber-500 font-black animate-pulse uppercase tracking-[0.3em] text-[10px]">
          Sincronizando Base de Dados...
        </p>
      </div>
    );
  }

  // Proteção de Acesso
  const temAcesso = userSession?.role === 'ADMIN' || userSession?.permissoes?.[section] === true;

  if (!temAcesso && section !== "dashboard") {
    return (
      <div className="bg-[#101f3d] p-12 rounded-[40px] border border-red-500/20 text-center m-10">
        <p className="text-red-400 font-black uppercase tracking-widest text-lg">Acesso Restrito</p>
        <p className="text-white/20 text-xs mt-2">Você não tem permissão para aceder ao módulo <span className="text-white font-bold">{section}</span>.</p>
      </div>
    );
  }

  // Roteamento das Views
  switch (section) {
    case "dashboard": return <DashboardView />;
    case "crm": return <CrmView />;
    case "relatorios": return <RelatoriosView />;
    
    case "obras": return <ObrasView searchQuery={searchQuery} />;
    case "os": return <OsView searchQuery={searchQuery} />;
    case "servicos": return <ServicosView searchQuery={searchQuery} />;
    case "atividades": return <AtividadesView searchQuery={searchQuery} />;
    case "clientes": return <ClientesView searchQuery={searchQuery} />;
    
    case "funcionarios": return <FuncionariosView searchQuery={searchQuery} />;
    case "equipe": return <EquipesView />;
    case "horas": return <HorasView />;
    
    case "financeiro": return <FinanceiroView />;
    case "compras": return <ComprasView searchQuery={searchQuery} />;
    case "fornecedores": return <FornecedoresView searchQuery={searchQuery} />;
    
    case "estoque": return <EstoqueView searchQuery={searchQuery} />;
    
    case "usuarios": return <UsuariosView />;
    case "listas": return <ListasAuxiliaresView />;
    
    default: return <DashboardView />;
  }
}
