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
const STORAGE_PREFIX = 'erp-workspace:';

const getStorageKey = (adminEmail: string) => `${STORAGE_PREFIX}${adminEmail.trim() || activeAdminEmail}`;

const readFromLocalStorage = (adminEmail: string): WorkspaceData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(adminEmail));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeToLocalStorage = (adminEmail: string, workspace: WorkspaceData) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getStorageKey(adminEmail), JSON.stringify(workspace));
  } catch {
    // Ignore quota / access errors and keep the in-memory cache as fallback.
  }
};

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

  return normalized;
}

export function getCachedWorkspace(adminEmail = activeAdminEmail) {
  const cached = workspaceCache.get(adminEmail);
  if (cached) return cached;

  const persisted = readFromLocalStorage(adminEmail);
  if (persisted) {
    const shaped = ensureWorkspaceShape(persisted);
    workspaceCache.set(adminEmail, shaped);
    return shaped;
  }

  return ensureWorkspaceShape(null);
}

export function setCachedWorkspace(adminEmail: string, workspace: WorkspaceData) {
  const shaped = ensureWorkspaceShape(workspace);
  workspaceCache.set(adminEmail, shaped);
  writeToLocalStorage(adminEmail, shaped);
}

export async function loadWorkspace(adminEmail = activeAdminEmail): Promise<WorkspaceData> {
  const workspace = ensureWorkspaceShape(readFromLocalStorage(adminEmail));
  setCachedWorkspace(adminEmail, workspace);
  return workspace;
}

export async function saveWorkspace(adminEmail = activeAdminEmail, workspace: WorkspaceData): Promise<WorkspaceData> {
  const savedWorkspace = ensureWorkspaceShape(workspace);
  setCachedWorkspace(adminEmail, savedWorkspace);
  return savedWorkspace;
}
