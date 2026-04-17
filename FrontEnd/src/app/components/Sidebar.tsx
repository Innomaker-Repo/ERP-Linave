import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { 
  LayoutDashboard, Users, HardHat, Anchor, ClipboardList, 
  ShoppingCart, DollarSign, BarChart3, Settings, Factory, 
  HeartHandshake, List, Clock, ChevronDown, ChevronRight, 
  Briefcase, Wrench, Activity, FileText, Zap
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const { userSession, config } = useErp();
  
  // Controle dos grupos do menu (Acordeão)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'gestao': true,
    'producao': true, // Mantém aberto por padrão para facilitar o acesso à operação
    'comercial': false,
    'orcamentos': false,
    'financeiro': false,
    'compras': false,
    'almoxerifado': false,
    'config': false
  });

  const toggleGroup = (g: string) => setOpenGroups(p => ({ ...p, [g]: !p[g] }));

  // Estrutura Completa de Departamentos
  const departments = [
    {
      id: 'gestao',
      title: 'Gestão & Estratégia',
      icon: Briefcase,
      items: [
        { id: 'dashboard', label: 'Dashboard Geral', icon: LayoutDashboard },
        { id: 'relatorios', label: 'Relatórios BI', icon: BarChart3 },
      ]
    },
    {
      id: 'producao',
      title: 'Produção',
      icon: Anchor,
      items: [
        // Visão Macro do Projeto (USV Traveller)
        { id: 'obras', label: 'Serviços (Produção)', icon: Anchor },
      ]
    },
    {
      id: 'comercial',
      title: 'Comercial',
      icon: Users,
      items: [
        // CRM - Gerenciamento de Negócios
        { id: 'crm', label: 'Negócios (CRM)', icon: HeartHandshake },
        
        // Fazer Proposta
        { id: 'proposta', label: 'Fazer Proposta', icon: FileText },
        
        // Fazer Ordem de Serviço
        { id: 'fazerOs', label: 'Fazer OS', icon: Zap },
        
        // Base de Clientes
        { id: 'clientes', label: 'Base de Clientes', icon: Users },
      ]
    },
    {
      id: 'orcamentos',
      title: 'Orçamentos',
      icon: DollarSign,
      items: [
        { id: 'orcamentos', label: 'Orçar Negócios', icon: FileText },
      ]
    },
    {
      id: 'financeiro',
      title: 'Financeiro',
      icon: DollarSign,
      items: [
        { id: 'financeiro', label: 'Fluxo de Caixa', icon: DollarSign },
      ]
    },
    {
      id: 'compras',
      title: 'Compras',
      icon: ShoppingCart,
      items: [
        { id: 'compras', label: 'Compras / Requisições', icon: ShoppingCart },
        { id: 'fornecedores', label: 'Fornecedores', icon: Factory },
      ]
    },
    {
      id: 'almoxerifado',
      title: 'Almoxerifado',
      icon: ClipboardList,
      items: [
        { id: 'estoque', label: 'Estoque', icon: ClipboardList },
      ]
    },
    {
      id: 'config',
      title: 'Configurações',
      icon: Settings,
      items: [
        { id: 'usuarios', label: 'Usuários & Acessos', icon: Settings },
        { id: 'listas', label: 'Menus Suspensos', icon: List },
        { id: 'templates', label: 'Templates de Docs', icon: FileText }
      ]
    }
  ];

  // Filtra itens com base nas permissões do utilizador logado
  const hasAccess = (itemId: string) => {
    if (!userSession) return false;
    const role = userSession.role?.toUpperCase() || '';
    
    // Admin tem acesso irrestrito
    if (role === 'ADMIN') return true;
    
    // Utilizador comum verifica a lista de permissões recebida do Drive
    return userSession.permissoes?.[itemId] === true;
  };

  return (
    <div className="w-64 bg-[#101f3d] border-r border-white/5 flex flex-col h-full z-30 transition-all duration-300">
      
      {/* CABEÇALHO */}
      <div className="p-6 border-b border-white/5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center font-black text-[#0b1220] shadow-lg shadow-amber-500/20">
            IN
          </div>
          <div>
            <h1 className="text-white font-black italic uppercase text-xl leading-none">
              Linave
            </h1>
            <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-1">
              SaaS Edition
            </p>
          </div>
        </div>
      </div>

      {/* MENU DE NAVEGAÇÃO ACORDEÃO */}
      <nav className="flex-1 px-4 space-y-4 overflow-y-auto custom-scrollbar pb-10">
        {departments.map((dept) => {
          // Verifica se há itens visíveis neste departamento para o utilizador atual
          const visibleItems = dept.items.filter(item => hasAccess(item.id));
          
          // Se não houver itens visíveis (por permissão), esconde o grupo inteiro
          if (visibleItems.length === 0) return null;

          return (
            <div key={dept.id} className="space-y-1">
              
              {/* Título do Departamento */}
              <button 
                onClick={() => toggleGroup(dept.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-white/40 hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-amber-500 transition-colors">
                    {dept.title}
                  </span>
                </div>
                {openGroups[dept.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {/* Lista de Itens do Departamento */}
              {openGroups[dept.id] && (
                <div className="space-y-1 pl-2 border-l border-white/5 ml-2 animate-in slide-in-from-top-2 duration-200">
                  {visibleItems.map((item) => {
                    const isActive = activeSection === item.id;
                    const Icon = item.icon;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative overflow-hidden group
                          ${isActive 
                            ? 'bg-amber-500/10 text-amber-500 font-bold shadow-[inset_4px_0_0_0_#d97706]' 
                            : 'text-white/60 hover:bg-white/5 hover:text-white font-medium'}`}
                      >
                        <Icon 
                          size={16} 
                          className={`transition-transform duration-300 ${isActive ? 'text-amber-500 scale-110' : 'text-white/40 group-hover:text-white group-hover:scale-105'}`} 
                        />
                        <span className="text-xs truncate tracking-wide">{item.label}</span>
                        
                        {/* Indicador Ativo */}
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-full"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      
      {/* RODAPÉ DA SIDEBAR */}
      <div className="p-6 border-t border-white/5 bg-[#0b1220]/30">
        <div className="flex flex-col gap-1">
          <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">
            Instância Ativa
          </p>
          <p className="text-[10px] text-amber-500 font-bold truncate">
            {config?.empresaNome || 'Carregando...'}
          </p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ffffff10; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ffffff20; }
      `}</style>
    </div>
  );
}
