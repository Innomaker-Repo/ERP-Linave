import React, { useState, useEffect  } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CadastroCompletoView } from './components/modules/Configuracoes/CadastroCompletoView';
import { useErp } from './context/ErpContext';
import { LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';

// Importação dos Módulos de Abas
import { GestaoModule } from './modules/Gestao';
import { ProducaoModule } from './modules/Producao';
import { ComercialModule } from './modules/Comercial';
import { FinanceiroModule } from './modules/Financeiro';
import { ComprasModule } from './modules/Compras';
import { AlmoxerifadoModule } from './modules/Almoxerifado';
import { ConfiguracoesModule } from './modules/Configuracoes';

// Função auxiliar para mapear qual aba cada item pertence
function getAbaForSection(section: string): { aba: string; item: string } {
  const mapping: Record<string, { aba: string; item: string }> = {
    // Produção
    'obras': { aba: 'producao', item: 'obras' },
    'servicos': { aba: 'producao', item: 'obras' },
    
    // Comercial
    'crm': { aba: 'comercial', item: 'crm' },
    'clientes': { aba: 'comercial', item: 'clientes' },
    'proposta': { aba: 'comercial', item: 'proposta' },
    'fazerOs': { aba: 'comercial', item: 'fazerOs' },
    'orcamentos': { aba: 'comercial', item: 'orcamentos' },
    'medicao': { aba: 'comercial', item: 'medicao' },
    'finalizadosComercial': { aba: 'comercial', item: 'finalizadosComercial' },
    
    // Financeiro (cada seção é um item próprio do sidebar)
    'finDashboard': { aba: 'financeiro', item: 'dashboard' },
    'finSolicitacao': { aba: 'financeiro', item: 'solicitacao' },
    'finAprovacoes': { aba: 'financeiro', item: 'aprovacoes' },
    'finPagar': { aba: 'financeiro', item: 'pagar' },
    'finNfe': { aba: 'financeiro', item: 'nfe' },
    'finReceber': { aba: 'financeiro', item: 'receber' },
    'finPrevisao': { aba: 'financeiro', item: 'previsao' },
    'finBancos': { aba: 'financeiro', item: 'bancos' },
    'finHistorico': { aba: 'financeiro', item: 'historico' },
    'finCustoOs': { aba: 'financeiro', item: 'custoOs' },
    'finReciboLocacao': { aba: 'financeiro', item: 'reciboLocacao' },
    
    // Compras
    'compras': { aba: 'compras', item: 'compras' },
    'minhasCompras': { aba: 'compras', item: 'minhasCompras' },
    'kanbanCompras': { aba: 'compras', item: 'kanbanCompras' },
    'aprovacoesCompras': { aba: 'compras', item: 'aprovacoesCompras' },
    'historicoCompras': { aba: 'compras', item: 'historicoCompras' },
    'fornecedores': { aba: 'compras', item: 'fornecedores' },
    
    // Almoxerifado
    'estoquePublico': { aba: 'almoxerifado', item: 'estoquePublico' },
    'estoque': { aba: 'almoxerifado', item: 'estoque' },
    'itensAdicionar': { aba: 'almoxerifado', item: 'itensAdicionar' },
    'historicoBaixa': { aba: 'almoxerifado', item: 'historicoBaixa' },
    'historicoRomaneio': { aba: 'almoxerifado', item: 'historicoRomaneio' },
    'alocadosPorOS': { aba: 'almoxerifado', item: 'alocadosPorOS' },
    
    // Configurações
    'usuarios': { aba: 'config', item: 'usuarios' },
    'empresasPrestadoras': { aba: 'config', item: 'empresasPrestadoras' },
    'logAtividades': { aba: 'config', item: 'logAtividades' },
    'meuPerfil': { aba: 'config', item: 'meuPerfil' },
  };
  
  return mapping[section] || { aba: 'gestao', item: 'dashboard' };
}

export default function App() {
  const { userSession, setUserSession, config, loading } = useErp();
  // Todos os usuários entram pela Home (página inicial com os acessos de cada um).
  const [activeSection, setActiveSection] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  //  Escuta o evento customizado para mudar a tela a partir de qualquer componente
  useEffect(() => {
    const handleNavegacao = (e: any) => setActiveSection(e.detail);
    window.addEventListener('mudarTelaERP', handleNavegacao);
    return () => window.removeEventListener('mudarTelaERP', handleNavegacao);
  }, []);

  // 1. Tela de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500 mb-4"></div>
        <p className="text-amber-500 font-bold uppercase tracking-widest text-xs">A carregar dados...</p>
      </div>
    );
  }

  if (!userSession) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setUserSession(user);
          setActiveSection('home'); // login (ou troca de usuário) sempre aterrissa na Home
        }}
      />
    );
  }

  // FLUXO DE ONBOARDING (CADASTRO DA EMPRESA)
  // Se for ADMIN e o nome da empresa ainda for o padrão 'Nova Empresa' (ou vazio),
  // mostramos o formulário de cadastro OBRIGATÓRIO.
  const precisaConfigurarEmpresa = userSession?.role === 'ADMIN' && 
    (!config?.empresaNome || config.empresaNome === 'Nova Empresa');

  if (precisaConfigurarEmpresa) {
    return (
      <CadastroCompletoView 
        onFinalizar={() => {
          // O próprio componente já atualiza o contexto e salva no Drive,
          // o que fará o 'config.empresaNome' mudar e o App renderizar o Dashboard automaticamente.
        }} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#0b1220] overflow-hidden text-white font-sans">
      {sidebarOpen && (
        <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} onClose={() => setSidebarOpen(false)} />
      )}
      <main className="flex-1 overflow-y-auto bg-[#0b1220] flex flex-col">
        <Header activeSection={activeSection} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onToggleSidebar={() => setSidebarOpen(o => !o)} />
        
        <section className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-500 relative p-6">
          {(() => {
            // Home é a tela inicial de todos os usuários — fora dos módulos por aba.
            if (activeSection === 'home') {
              return <HomePage onNavigate={setActiveSection} />;
            }

            const { aba, item } = getAbaForSection(activeSection);

            switch (aba) {
              case 'gestao':
                return <GestaoModule activeItem={item} searchQuery={searchQuery} />;
              case 'producao':
                return <ProducaoModule activeItem={item} searchQuery={searchQuery} />;
              case 'comercial':
                return <ComercialModule activeItem={item} searchQuery={searchQuery} />;
              case 'financeiro':
                return <FinanceiroModule activeItem={item} searchQuery={searchQuery} onNavigate={setActiveSection} />;
              case 'compras':
                return <ComprasModule activeItem={item} searchQuery={searchQuery} />;
              case 'almoxerifado':
                return <AlmoxerifadoModule activeItem={item} searchQuery={searchQuery} />;
              case 'config':
                return <ConfiguracoesModule activeItem={item} searchQuery={searchQuery} />;
              default:
                return <GestaoModule activeItem="dashboard" searchQuery={searchQuery} />;
            }
          })()}
        </section>
      </main>
    </div>
  );
}
