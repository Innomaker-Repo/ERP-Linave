function pad(num: number, size = 4) {
  return num.toString().padStart(size, "0");
}

/* CLIENTE */
export function generateClienteId(database: any) {
  database._counters = database._counters || {};
  database._counters.cliente = (database._counters.cliente || 0) + 1;
  return `CLI-${pad(database._counters.cliente)}`;
}

/* ORDEM DE SERVIÇO (FILHA DO CLIENTE) */
export function generateOSId(database: any, clienteId: string) {
  database._osCounters = database._osCounters || {};
  database._osCounters[clienteId] = (database._osCounters[clienteId] || 0) + 1;
  return `${clienteId}-OS-${pad(database._osCounters[clienteId], 3)}`;
}

/* FORNECEDOR */
export function generateFornecedorId(database: any) {
  database._counters = database._counters || {};
  database._counters.fornecedor = (database._counters.fornecedor || 0) + 1;
  return `FOR-${pad(database._counters.fornecedor)}`;
}

/* FINANCEIRO */
export function generateFinanceiroId(database: any) {
  database._counters = database._counters || {};
  database._counters.financeiro = (database._counters.financeiro || 0) + 1;
  return `FIN-${pad(database._counters.financeiro)}`;
}

/* ALOCAÇÃO (Funcionário -> Obra/OS) */
export function generateAlocacaoId(database: any) {
  database._counters = database._counters || {};
  database._counters.alocacao = (database._counters.alocacao || 0) + 1;
  return `ALO-${pad(database._counters.alocacao)}`;
}

/* REGISTRO DE HORAS */
export function generateHorasId(database: any) {
  database._counters = database._counters || {};
  database._counters.horas = (database._counters.horas || 0) + 1;
  return `HRS-${pad(database._counters.horas)}`;
}

/* FOLHA (por mês/ano) */
export function generateFolhaId(_database: any, year: number, month: number) {
  // month: 1-12
  const mm = month.toString().padStart(2, "0");
  return `FOL-${year}-${mm}`;
}
