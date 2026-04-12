import React, { createContext, useContext, useState, useEffect } from 'react';

// DADOS MOCK DOS CLIENTES - Inicialização padrão
const CLIENTES_MOCK = [
  {
    id: 'CLI-1',
    razaoSocial: 'Linave Construções LTDA',
    nomeFantasia: 'Linave',
    cnpj: '12.345.678/0001-90',
    tipoPessoa: 'PJ',
    inscricaoEstadual: '123.456.789.012',
    status: 'Ativo',
    contato: '(41) 3333-4444 / contato@linave.com.br',
    endereco: 'Rua das Construções, 123, Curitiba - PR',
    dataCadastro: '2024-01-15',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-2',
    razaoSocial: 'Construtora Alpha S.A.',
    nomeFantasia: 'Alpha Construtora',
    cnpj: '23.456.789/0001-01',
    tipoPessoa: 'PJ',
    inscricaoEstadual: '234.567.890.123',
    status: 'Ativo',
    contato: '(41) 3333-5555 / vendas@alpha.com.br',
    endereco: 'Av. Principal, 456, Curitiba - PR',
    dataCadastro: '2024-02-10',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-3',
    razaoSocial: 'TC Engenharia e Consultoria',
    nomeFantasia: 'TC Engenharia',
    cnpj: '34.567.890/0001-12',
    tipoPessoa: 'PJ',
    inscricaoEstadual: '345.678.901.234',
    status: 'Ativo',
    contato: '(41) 3333-6666 / tech@tcengenharia.com.br',
    endereco: 'Rua da Tecnologia, 789, Curitiba - PR',
    dataCadastro: '2024-03-05',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-4',
    razaoSocial: 'Projetos Marítimos LTDA',
    nomeFantasia: 'ProMar',
    cnpj: '45.678.901/0001-23',
    tipoPessoa: 'PJ',
    inscricaoEstadual: '456.789.012.345',
    status: 'Ativo',
    contato: '(41) 3333-7777 / projetos@promar.com.br',
    endereco: 'Porto Boulevard, 321, Paranaguá - PR',
    dataCadastro: '2024-01-20',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-5',
    razaoSocial: 'Estaleiro Industrial do Sudeste',
    nomeFantasia: 'EISE',
    cnpj: '56.789.012/0001-34',
    tipoPessoa: 'PJ',
    inscricaoEstadual: '567.890.123.456',
    status: 'Ativo',
    contato: '(41) 3333-8888 / comercial@eise.com.br',
    endereco: 'Distrito Industrial, 654, Paranaguá - PR',
    dataCadastro: '2024-01-25',
    usuarioResponsavel: 'Sistema'
  }
];

interface ErpContextData {
  userSession: any;
  setUserSession: (s: any) => void;
  loading: boolean;
  clientes: any[];
  funcionarios: any[];
  obras: any[];
  financeiro: any[];
  compras: any[];
  os: any[];
  usuarios: any[];
  equipes: any[];
  fornecedores: any[];
  horas: any[];
  config: any;
  listas: any;
  loginComGoogle: (token: string, email: string) => Promise<void>;
  loginDireto: (user: any) => void;
  logout: () => void;
  saveEntity: (collection: string, data: any) => Promise<void>;
  saveListas: (novasListas: any) => Promise<void>;
  saveConfig: (novaConfig: any) => Promise<void>;
  uploadFileToDrive: (file: File) => Promise<string | null>;
}

const ErpContext = createContext<ErpContextData>({} as ErpContextData);

export function ErpProvider({ children }: { children: React.ReactNode }) {
  // DEBUG: Injetar ADMIN imediatamente
  const [userSession, setUserSession] = useState<any>({
    email: 'admin@modo-teste.com',
    role: 'ADMIN',
    nome: 'Administrador (Teste)',
    permissoes: {}
  });
  const [loading, setLoading] = useState(false);
  
  const [data, setData] = useState(() => {
    // Tentar carregar do localStorage na inicialização
    try {
      const saved = localStorage.getItem('@ERP:data');
      if (saved) {
        const loadedData = JSON.parse(saved);
        // Migrar OS para adicionar statusEnvio se não existir
        if (loadedData.os && Array.isArray(loadedData.os)) {
          loadedData.os = loadedData.os.map((o: any) => ({
            ...o,
            statusEnvio: o.statusEnvio || 'pendente'
          }));
        }
        return loadedData;
      }
    } catch (e) {
      console.error('Erro ao carregar dados do localStorage', e);
    }
    // Se não conseguir, usar dados padrão
    return {
      clientes: CLIENTES_MOCK, funcionarios: [], obras: [], financeiro: [],
      compras: [], os: [], usuarios: [], equipes: [], fornecedores: [], horas: [],
      config: { empresaNome: 'Linave ERP' },
      listas: { departamentos: ['Engenharia', 'TI'], categorias: ['Material'], prioridades: ['Normal'] }
    };
  });

  // Salvar dados no localStorage sempre que mudam
  useEffect(() => {
    try {
      localStorage.setItem('@ERP:data', JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar dados no localStorage', e);
    }
  }, [data]);

  const showTestAlert = (operacao: string) => {
    alert(`⚠️ VERSÃO DE TESTE\n\nOperação "${operacao}" requer conexão com backend.\n\nEsta é uma versão demonstrativa apenas com frontend.`);
  };

  // Função simulada - não faz requisição real
  const refreshData = async (session: any) => {
    // Apenas mantém os dados padrão - sem requisição ao backend
    console.log('refreshData chamado (sem backend)');
  };

  // Removed: loginComGoogle - agora apenas simula
  const loginComGoogle = async (token: string, email: string) => {
    showTestAlert('Google Login');
  };

  // Login direto simples - apenas local
  const loginDireto = (user: any) => {
    const session = { ...user, token: null };
    setUserSession(session);
    // localStorage.setItem('@Linave:session', JSON.stringify(session));  // COMENTADO PARA DEBUG
  };

  // Simula salvar - agora realmente salva no estado e localStorage
  const saveEntity = async (collection: string, newData: any) => {
    // Atualiza estado local com os dados
    setData(prev => ({ ...prev, [collection]: newData }));
    console.log(`✅ ${collection} atualizado:`, newData.length || Object.keys(newData).length, 'itens');
  };

  // Simula upload de arquivo - sem enviar para nenhum lugar
  const uploadFileToDrive = async (file: File): Promise<string | null> => {
    showTestAlert('Upload de Arquivo');
    return null;
  };

  const saveListas = async (l: any) => saveEntity('listas', l);
  const saveConfig = async (c: any) => saveEntity('config', c);

  const logout = () => {
    setUserSession(null);
    // localStorage.removeItem('@Linave:session');  // COMENTADO PARA DEBUG
    window.location.href = '/';
  };

  // Carrega apenas do localStorage (não do backend)
  // COMENTADO PARA DEBUG: Desabilita carregamento do localStorage
  // useEffect(() => {
  //   const saved = localStorage.getItem('@Linave:session');
  //   if (saved) {
  //     const s = JSON.parse(saved);
  //     setUserSession(s);
  //   }
  // }, []);

  return (
    <ErpContext.Provider value={{ userSession, setUserSession, loading, loginComGoogle, loginDireto, logout, saveEntity, saveListas, saveConfig, uploadFileToDrive, ...data }}>
      {children}
    </ErpContext.Provider>
  );
}

export const useErp = () => useContext(ErpContext);
