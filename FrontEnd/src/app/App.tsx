import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CadastroCompletoView } from './components/modules/Configuracoes/CadastroCompletoView';
import { useErp } from './context/ErpContext';

// Importação dos Módulos de Abas
import { GestaoModule } from './modules/Gestao';
import { ProducaoModule } from './modules/Producao';
import { ComercialModule } from './modules/Comercial';
import { OrcamentosModule } from './modules/Orcamentos';
import { FinanceiroModule } from './modules/Financeiro';
import { ComprasModule } from './modules/Compras';
import { AlmoxerifadoModule } from './modules/Almoxerifado';
import { ConfiguracoesModule } from './modules/Configuracoes';

// Função auxiliar para mapear qual aba cada item pertence
function getAbaForSection(section: string): { aba: string; item: string } {
  const mapping: Record<string, { aba: string; item: string }> = {
    // Gestão & Estratégia
    'dashboard': { aba: 'gestao', item: 'dashboard' },
    'relatorios': { aba: 'gestao', item: 'relatorios' },
    
    // Produção
    'obras': { aba: 'producao', item: 'obras' },
    'servicos': { aba: 'producao', item: 'obras' },
    
    // Comercial
    'crm': { aba: 'comercial', item: 'crm' },
    'clientes': { aba: 'comercial', item: 'clientes' },
    'proposta': { aba: 'comercial', item: 'proposta' },
    'fazerOs': { aba: 'comercial', item: 'fazerOs' },
    
    // Orçamentos
    'orcamentos': { aba: 'orcamentos', item: 'orcamentos' },
    
    // Financeiro
    'financeiro': { aba: 'financeiro', item: 'financeiro' },
    
    // Compras
    'compras': { aba: 'compras', item: 'compras' },
    'fornecedores': { aba: 'compras', item: 'fornecedores' },
    
    // Almoxerifado
    'estoque': { aba: 'almoxerifado', item: 'estoque' },
    
    // Configurações
    'usuarios': { aba: 'config', item: 'usuarios' },
    'listas': { aba: 'config', item: 'listas' },
    'templates': { aba: 'config', item: 'templates' },
  };
  
  return mapping[section] || { aba: 'gestao', item: 'dashboard' };
}

export default function App() {
  const { userSession, setUserSession, logout, config, loading } = useErp();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Tela de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500 mb-4"></div>
        <p className="text-amber-500 font-bold uppercase tracking-widest text-xs">A carregar dados...</p>
      </div>
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
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      <main className="flex-1 overflow-y-auto bg-[#0b1220] flex flex-col">
        <Header activeSection={activeSection} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        
        <section className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-500 relative p-6">
          {(() => {
            const { aba, item } = getAbaForSection(activeSection);
            
            switch (aba) {
              case 'gestao':
                return <GestaoModule activeItem={item} searchQuery={searchQuery} />;
              case 'producao':
                return <ProducaoModule activeItem={item} searchQuery={searchQuery} />;
              case 'comercial':
                return <ComercialModule activeItem={item} searchQuery={searchQuery} />;
              case 'orcamentos':
                return <OrcamentosModule activeItem={item} searchQuery={searchQuery} />;
              case 'financeiro':
                return <FinanceiroModule activeItem={item} searchQuery={searchQuery} />;
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
