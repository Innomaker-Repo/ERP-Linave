import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { 
  LayoutDashboard, Users, HardHat, Anchor, ClipboardList,
  ShoppingCart, DollarSign, BarChart3, Settings, Factory,
  HeartHandshake, List, Clock, ChevronDown, ChevronRight,
  Briefcase, Wrench, Activity, FileText, Zap, CheckCircle2, Trash2, LayoutGrid, Package2, History,
  FilePlus, Banknote, ScrollText, Wallet, Building2, TrendingUp, Landmark, Tags
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const MOCK_GERENTE_COMERCIAL_EMAIL = 'gerente.comercial@linave.com.br';
const MOCK_DIRETOR_FINANCEIRO_EMAIL = 'diretor.financeiro@linave.com.br';

// Itens do grupo Financeiro (cada seção é uma aba própria no sidebar).
const FINANCEIRO_ITEM_IDS = new Set([
  'finDashboard', 'finOs', 'finSolicitacao', 'finAprovacoes', 'finPagar', 'finNfe',
  'finReceber', 'finLocacao', 'finPrevisao', 'finBancos', 'finDepartamentos', 'finHistorico',
]);

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const { userSession, config } = useErp();
  
  // Controle dos grupos do menu (Acordeão)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'gestao': true,
    'producao': true, // Mantém aberto por padrão para facilitar o acesso à operação
    'comercial': false,
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

        { id: 'orcamentos', label: 'Orçar Negócios', icon: FileText },
        
        // Fazer Proposta
        { id: 'proposta', label: 'Fazer Proposta', icon: FileText },
        
        // Fazer Ordem de Serviço
        { id: 'fazerOs', label: 'Fazer OS', icon: Zap },

        // Histórico local de negócios com medição concluída
        { id: 'finalizadosComercial', label: 'Finalizados', icon: CheckCircle2 },
        
        // Base de Clientes
        { id: 'clientes', label: 'Base de Clientes', icon: Users },
      ]
    },
    {
      id: 'financeiro',
      title: 'Financeiro',
      icon: DollarSign,
      items: [
        // Operação
        { id: 'finDashboard', label: 'Dashboard Financeiro', icon: LayoutDashboard },
        { id: 'finOs', label: 'OS Emitidas', icon: ClipboardList },
        { id: 'finSolicitacao', label: 'Solicitação de Pagamento', icon: FilePlus },
        { id: 'finAprovacoes', label: 'Aprovações', icon: CheckCircle2 },
        { id: 'finPagar', label: 'Contas a Pagar', icon: Banknote },
        { id: 'finNfe', label: 'NFe', icon: ScrollText },
        { id: 'finReceber', label: 'Contas a Receber', icon: Wallet },
        { id: 'finLocacao', label: 'Locação', icon: Building2 },
        { id: 'finPrevisao', label: 'Previsão de Receita', icon: TrendingUp },
        // Gestão
        { id: 'finBancos', label: 'Bancos', icon: Landmark },
        { id: 'finDepartamentos', label: 'Departamentos', icon: Tags },
        { id: 'finHistorico', label: 'Histórico', icon: History },
      ]
    },
    {
      id: 'compras',
      title: 'Compras',
      icon: ShoppingCart,
      items: [
        { id: 'compras', label: 'Compras / Requisições', icon: ShoppingCart },
        { id: 'kanbanCompras', label: 'Kanban de Compras', icon: LayoutGrid },
        { id: 'aprovacoesCompras', label: 'Aprovações', icon: Clock },
        { id: 'historicoCompras', label: 'Histórico de Compras', icon: History },
        { id: 'fornecedores', label: 'Fornecedores', icon: Factory },
      ]
    },
    {
      id: 'almoxerifado',
      title: 'Suprimentos',
      icon: ClipboardList,
      items: [
        { id: 'estoquePublico', label: 'Estoque View', icon: ClipboardList },
        { id: 'estoque', label: 'Almoxarifado', icon: ClipboardList },
        { id: 'itensAdicionar', label: 'Itens para adicionar', icon: Package2 },
        { id: 'historicoBaixa', label: 'Histórico de Baixa', icon: Trash2 },
        { id: 'historicoRomaneio', label: 'Histórico de Romaneio', icon: ClipboardList },
        { id: 'alocadosPorOS', label: 'Alocados por OS', icon: ClipboardList },
      ]
    },
    {
      id: 'config',
      title: 'Configurações',
      icon: Settings,
      items: [
        { id: 'usuarios', label: 'Usuários & Acessos', icon: Settings },
        { id: 'departamentos', label: 'Departamentos', icon: List }
      ]
    }
  ];

  // Filtra itens com base nas permissões do utilizador logado
  const hasAccess = (itemId: string) => {
    if (!userSession) return false;
    const role = userSession.role?.toUpperCase() || '';
    const email = String(userSession.email || '').toLowerCase();
    const isGerenteComercial = email === MOCK_GERENTE_COMERCIAL_EMAIL || (email.includes('gerente') && email.includes('comercial'));
    const isDiretorFinanceiro = email === MOCK_DIRETOR_FINANCEIRO_EMAIL || (email.includes('diretor') && email.includes('financeiro'));
    
    // Admin tem acesso irrestrito
    if (role === 'ADMIN') return true;

    // Financeiro: todas as seções seguem a permissão "financeiro".
    if (FINANCEIRO_ITEM_IDS.has(itemId)) {
      return userSession.permissoes?.financeiro === true || userSession.permissoes?.[itemId] === true;
    }

    if (itemId === 'compras') return true;
    if (itemId === 'kanbanCompras') {
      // Equipe de compras (permissão explícita) + gerente comercial / diretor financeiro,
      // que precisam do kanban para selecionar o fornecedor na etapa "Seleção do Gerente".
      return (
        userSession.permissoes?.kanbanCompras === true ||
        userSession.permissoes?.aprovacoesComprasGerente === true ||
        userSession.permissoes?.aprovacoesComprasFinanceiro === true ||
        isGerenteComercial ||
        isDiretorFinanceiro
      );
    }
    if (itemId === 'aprovacoesCompras') {
      return (
        userSession.permissoes?.aprovacoesComprasGerente === true ||
        userSession.permissoes?.aprovacoesComprasFinanceiro === true ||
        isGerenteComercial ||
        isDiretorFinanceiro
      );
    }
    if (itemId === 'historicoCompras') {
      // Histórico (somente leitura) das compras concluídas: visível a quem participa do
      // fluxo de compras.
      return (
        userSession.permissoes?.compras === true ||
        userSession.permissoes?.kanbanCompras === true ||
        userSession.permissoes?.historicoCompras === true ||
        userSession.permissoes?.aprovacoesComprasGerente === true ||
        userSession.permissoes?.aprovacoesComprasFinanceiro === true ||
        isGerenteComercial ||
        isDiretorFinanceiro
      );
    }
    if (itemId === 'estoquePublico') return true;
    if (itemId === 'estoque') return userSession.permissoes?.almoxerifado === true || userSession.permissoes?.[itemId] === true;
    if (itemId === 'itensAdicionar') return userSession.permissoes?.almoxerifado === true || userSession.permissoes?.[itemId] === true;
    if (itemId === 'historicoRomaneio') return userSession.permissoes?.almoxerifado === true || userSession.permissoes?.[itemId] === true;
    
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
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('fecharOrcamentoSolicitado'));
                          setActiveSection(item.id);
                        }}
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
