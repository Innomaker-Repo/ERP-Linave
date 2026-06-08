import api from './api';

// ─── Tipos espelhando o backend ───────────────────────────────────────────────

export interface ItemEstoquePayload {
  tabela_nome: string;
  item_id: string;
  values: Record<string, string>;
  search_text?: string;
}

export interface AlocacaoGasPayload {
  fornecedor_item: number; // _dbId do ItemEstoque
  gas_nome: string;
  quantidade: number;
  local?: string;
  service_os?: string;
}

export interface HistoricoBaixaPayload {
  data_baixa: string;
  tabela_nome: string;
  item_label: string;
  status_anterior?: string;
  motivo?: string;
  os_id?: string;
  os_label?: string;
  localizacao?: string;
  service_os?: string;
  snapshot?: Record<string, string>;
}

export interface HistoricoAlocacaoPayload {
  action: 'alocar' | 'desalocar';
  kind: 'gases' | 'equipamentos' | 'materiais' | 'alugaveis' | 'outros';
  os_id?: string;
  os_label?: string;
  item_label: string;
  tabela_nome: string;
  quantidade?: number;
  local?: string;
  gas_nome?: string;
}

// ─── Helper: workspace email header ──────────────────────────────────────────

function getWorkspaceEmail(): string {
  try {
    return localStorage.getItem('userEmail') || '';
  } catch {
    return '';
  }
}

function workspaceHeaders() {
  const email = getWorkspaceEmail();
  return email ? { 'X-Workspace-Email': email } : {};
}

function workspaceParam() {
  const email = getWorkspaceEmail();
  return email ? { workspace_email: email } : {};
}

// ─── Estoque Completo (carga inicial) ────────────────────────────────────────

/**
 * Retorna todos os dados do almoxarifado em uma única requisição.
 * Usado na carga inicial do componente EstoqueView.
 */
export async function getEstoqueCompleto() {
  const { data } = await api.get('almoxarifado/estoque-completo/', {
    headers: workspaceHeaders(),
    params: workspaceParam(),
  });
  return data as {
    tables: Array<{
      _dbId: number;
      name: string;
      columns: any[];
      rows: Array<{
        id: string;
        _dbId: number;
        tableName: string;
        values: Record<string, string>;
        searchText: string;
      }>;
    }>;
    gasTypes: string[];
    allocations: Array<{
      id: string;
      supplierRowId: string;
      gasName: string;
      quantity: number;
      local: string;
      serviceOS: string;
    }>;
    baixasHistorico: any[];
    alocacoesHistorico: any[];
  };
}

// ─── Itens ────────────────────────────────────────────────────────────────────

export async function criarItem(payload: ItemEstoquePayload) {
  const { data } = await api.post('almoxarifado/itens/', payload, {
    headers: workspaceHeaders(),
  });
  return data as { id: number; item_id: string; values: Record<string, string> };
}

export async function atualizarItem(
  dbId: number,
  payload: Partial<ItemEstoquePayload>
) {
  const { data } = await api.patch(`almoxarifado/itens/${dbId}/`, payload, {
    headers: workspaceHeaders(),
  });
  return data;
}

export async function deletarItem(dbId: number) {
  await api.delete(`almoxarifado/itens/${dbId}/`, {
    headers: workspaceHeaders(),
  });
}

// ─── Tipos de Gás ─────────────────────────────────────────────────────────────

export async function getTiposGas(): Promise<Array<{ id: number; nome: string }>> {
  const { data } = await api.get('almoxarifado/tipos-gas/', {
    headers: workspaceHeaders(),
    params: workspaceParam(),
  });
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function criarTipoGas(nome: string) {
  const { data } = await api.post(
    'almoxarifado/tipos-gas/',
    { nome },
    { headers: workspaceHeaders() }
  );
  return data as { id: number; nome: string };
}

export async function deletarTipoGas(id: number) {
  await api.delete(`almoxarifado/tipos-gas/${id}/`, {
    headers: workspaceHeaders(),
  });
}

// ─── Alocações de Gás ────────────────────────────────────────────────────────

export async function criarAlocacaoGas(payload: AlocacaoGasPayload) {
  const { data } = await api.post('almoxarifado/alocacoes-gas/', payload, {
    headers: workspaceHeaders(),
  });
  return data as { id: number };
}

export async function deletarAlocacaoGas(id: number) {
  await api.delete(`almoxarifado/alocacoes-gas/${id}/`, {
    headers: workspaceHeaders(),
  });
}

// ─── Histórico de Baixas ──────────────────────────────────────────────────────

export async function criarHistoricoBaixa(payload: HistoricoBaixaPayload) {
  const { data } = await api.post('almoxarifado/historico-baixas/', payload, {
    headers: workspaceHeaders(),
  });
  return data as { id: number };
}

// ─── Histórico de Alocações ───────────────────────────────────────────────────

export async function criarHistoricoAlocacao(payload: HistoricoAlocacaoPayload) {
  const { data } = await api.post('almoxarifado/historico-alocacoes/', payload, {
    headers: workspaceHeaders(),
  });
  return data as { id: number };
}
