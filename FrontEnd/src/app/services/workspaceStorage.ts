export type WorkspaceData = Record<string, any>;

const DEFAULT_WORKSPACE: WorkspaceData = {
  empresa: null,
  users: [],
  pendingUsers: [],
  clientes: [],
  funcionarios: [],
  equipes: [],
  obras: [],
  os: [],
  alocacoes: [],
  registrosHoras: [],
  folhaPagamento: [],
  financeiro: [],
  compras: [],
  fornecedores: [],
  horas: [],
  usuarios: [],
  config: {
    empresaNome: 'Linave ERP Demo',
    empresasPrestadoras: [
      {
        id: 'EMP-LINAVE',
        nome: 'Linave',
        cnpj: '',
        endereco: '',
        contato: '',
        email: '',
        ativa: true,
      },
      {
        id: 'EMP-SERVINAVE',
        nome: 'Servinave',
        cnpj: '',
        endereco: 'Rua Miguel de Lemos, 44 Fundos - Ponta D\'areia',
        contato: '+55 (21) 2620-1850',
        email: 'comercial@servinave.com.br',
        ativa: true,
      },
    ],
  },
  listas: {
    departamentos: [],
    categorias: [],
    prioridades: [],
  },
  _counters: {},
  _osCounters: {},
};

const LIST_KEYS = [
  'users',
  'pendingUsers',
  'clientes',
  'funcionarios',
  'equipes',
  'obras',
  'os',
  'alocacoes',
  'registrosHoras',
  'folhaPagamento',
  'financeiro',
  'compras',
  'fornecedores',
  'horas',
  'usuarios',
] as const;

const OBJECT_KEYS = ['empresa', 'config', 'listas', '_counters', '_osCounters'] as const;

let activeAdminEmail = 'admin@modo-teste.com';
const workspaceCache = new Map<string, WorkspaceData>();

export function setActiveAdminEmail(email: string) {
  activeAdminEmail = email.trim() || activeAdminEmail;
}

export function getActiveAdminEmail() {
  return activeAdminEmail;
}

export function ensureWorkspaceShape(workspace: any): WorkspaceData {
  const normalized: WorkspaceData = {
    ...DEFAULT_WORKSPACE,
    ...(workspace && typeof workspace === 'object' ? workspace : {}),
  };

  LIST_KEYS.forEach((key) => {
    normalized[key] = Array.isArray(workspace?.[key]) ? workspace[key] : [];
  });

  OBJECT_KEYS.forEach((key) => {
    const source = workspace?.[key];
    normalized[key] = source && typeof source === 'object' && !Array.isArray(source)
      ? { ...DEFAULT_WORKSPACE[key], ...source }
      : { ...DEFAULT_WORKSPACE[key] };
  });

  // Ignore legacy workspace-serialized commercial clients.
  normalized['clientes'] = [];

  return normalized;
}

export function getCachedWorkspace(adminEmail = activeAdminEmail) {
  return workspaceCache.get(adminEmail) || ensureWorkspaceShape(null);
}

export function setCachedWorkspace(adminEmail: string, workspace: WorkspaceData) {
  workspaceCache.set(adminEmail, ensureWorkspaceShape(workspace));
}

// API base URL - aponta para o backend Django
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function loadWorkspace(adminEmail = activeAdminEmail): Promise<WorkspaceData> {
  const url = `${API_BASE_URL}/comercial/workspaces/${encodeURIComponent(adminEmail)}/`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar workspace (${response.status})`);
  }

  const payload = await response.json();
  const workspace = ensureWorkspaceShape(payload?.data);
  setCachedWorkspace(adminEmail, workspace);
  return workspace;
}

export async function saveWorkspace(adminEmail = activeAdminEmail, workspace: WorkspaceData): Promise<WorkspaceData> {
  const url = `${API_BASE_URL}/comercial/workspaces/${encodeURIComponent(adminEmail)}/`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ensureWorkspaceShape(workspace)),
  });

  if (!response.ok) {
    throw new Error(`Falha ao salvar workspace (${response.status})`);
  }

  const payload = await response.json();
  const savedWorkspace = ensureWorkspaceShape(payload?.data);
  setCachedWorkspace(adminEmail, savedWorkspace);
  return savedWorkspace;
}

export function clearLegacyCommercialLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (/workspace|linave|comercial|crm|erp/i.test(key)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}
