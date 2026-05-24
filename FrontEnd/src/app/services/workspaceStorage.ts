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

import api from '../../services/api';

let activeAdminEmail = 'admin@modo-teste.com';
let workspaceCache = new Map<string, WorkspaceData>();

async function fetchWorkspaceFromBackend(adminEmail: string) {
  try {
    const res = await api.get(`workspaces/${encodeURIComponent(adminEmail)}/`);
    // Backend serializer returns an object with a `data` field containing the workspace payload
    return res.data && res.data.data ? res.data.data : res.data;
  } catch (err) {
    // Network/backend unavailable
    return null;
  }
}

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
  const cached = workspaceCache.get(adminEmail);
  if (cached) return cached;

  // Return a default-shaped workspace until `loadWorkspace` fetches remote data
  const shaped = ensureWorkspaceShape(null);
  workspaceCache.set(adminEmail, shaped);
  return shaped;
}

export function setCachedWorkspace(adminEmail: string, workspace: WorkspaceData) {
  const shaped = ensureWorkspaceShape(workspace);
  workspaceCache.set(adminEmail, shaped);
}

export async function loadWorkspace(adminEmail = activeAdminEmail): Promise<WorkspaceData> {
  const remote = await fetchWorkspaceFromBackend(adminEmail);
  const workspace = ensureWorkspaceShape(remote || {});
  setCachedWorkspace(adminEmail, workspace);
  return workspace;
}

export async function saveWorkspace(adminEmail = activeAdminEmail, workspace: WorkspaceData): Promise<WorkspaceData> {
  const savedWorkspace = ensureWorkspaceShape(workspace);
  // Persist to backend; prefer PATCH so existing record is updated
  try {
    await api.patch(`workspaces/${encodeURIComponent(adminEmail)}/`, { data: savedWorkspace });
  } catch (err) {
    // If PATCH fails, try POST (create)
    try {
      await api.post(`workspaces/${encodeURIComponent(adminEmail)}/`, { data: savedWorkspace });
    } catch (err2) {
      // Swallow error - keep in-memory cache so UI remains responsive
    }
  }

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
