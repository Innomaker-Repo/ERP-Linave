import api from './api';

/**
 * Serviço de Medições (tabela SQL `comercialapp_medicao` + `medicaoitem`).
 * Uma medição é por OS; uma OS pode ter várias (histórico). Só medição aprovada
 * libera a finalização do serviço.
 *   GET  /comercial/medicoes/?ordem_servico=&negocio=&status=
 *   POST /comercial/medicoes/                      (cria com itens aninhados)
 *   PATCH /comercial/medicoes/<id>/atualizar-status/  (aprovar/recusar)
 */

const num = (v: any): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const mapItemFromApi = (i: any) => ({
  item: i.item || '',
  descricao: i.descricao || '',
  unidade: i.unidade || '',
  quantidadeProduzida: i.quantidade_produzida ?? '',
  valorUnitario: i.valor_unitario ?? '',
  total: i.total ?? '',
  observacoes: i.observacoes || '',
});

const mapFromApi = (m: any) => ({
  id: m.id,
  numeroMedicao: m.numero_medicao || '',
  versao: m.versao || 1,
  negocioBackendId: m.negocio,
  ordemServicoBackendId: m.ordem_servico,
  ordemServicoNumero: m.ordem_servico_numero || '',
  clienteNegocio: m.cliente_negocio || '',
  numeroBM: m.numero_bm || '',
  empresa: m.empresa || '',
  cliente: m.cliente || '',
  cnpj: m.cnpj || '',
  dataEmissao: m.data_emissao || '',
  embarcacao: m.embarcacao || '',
  periodo: m.periodo || '',
  representanteCliente: m.representante_cliente || '',
  representanteLinave: m.representante_prestadora || '',
  valorTotal: num(m.valor_total),
  status: m.status || 'pendente',
  motivoRecusa: m.motivo_recusa || '',
  dataAprovacao: m.data_aprovacao || '',
  createdAt: m.created_at || '',
  itens: Array.isArray(m.itens) ? m.itens.map(mapItemFromApi) : [],
});

const mapToApi = (m: any) => ({
  negocio: m.negocioBackendId ?? m.negocio,
  ordem_servico: m.ordemServicoBackendId ?? m.ordemServico ?? null,
  numero_bm: m.numeroBM || '',
  empresa: m.empresa || '',
  cliente: m.cliente || '',
  cnpj: m.cnpj || '',
  data_emissao: m.dataEmissao || '',
  embarcacao: m.embarcacao || '',
  periodo: m.periodo || '',
  representante_cliente: m.representanteCliente || '',
  representante_prestadora: m.representanteLinave || m.representantePrestadora || '',
  valor_total: num(m.valorTotal),
  status: m.status || 'pendente',
  itens: (Array.isArray(m.itens) ? m.itens : []).map((i: any) => ({
    item: String(i.item || ''),
    descricao: i.descricao || '',
    unidade: i.unidade || '',
    quantidade_produzida: num(i.quantidadeProduzida),
    valor_unitario: num(i.valorUnitario),
    total: num(i.total),
    observacoes: i.observacoes || '',
  })),
});

export const getMedicoes = async (filtros: { ordemServico?: any; negocio?: any; status?: string } = {}): Promise<any[]> => {
  try {
    const params: Record<string, string> = {};
    if (filtros.ordemServico) params.ordem_servico = String(filtros.ordemServico);
    if (filtros.negocio) params.negocio = String(filtros.negocio);
    if (filtros.status) params.status = filtros.status;
    const response = await api.get('medicoes/', { params });
    const items = Array.isArray(response.data)
      ? response.data
      : (Array.isArray(response.data?.results) ? response.data.results : []);
    return items.map(mapFromApi);
  } catch (error) {
    console.error('Erro ao carregar medições SQL:', error);
    return [];
  }
};

export const criarMedicao = async (medicao: any) => {
  const response = await api.post('medicoes/', mapToApi(medicao));
  return mapFromApi(response.data);
};

export const atualizarMedicao = async (id: any, medicao: any) => {
  const response = await api.put(`medicoes/${id}/`, mapToApi(medicao));
  return mapFromApi(response.data);
};

export const atualizarStatusMedicao = async (id: any, status: string, motivoRecusa = '') => {
  const response = await api.patch(`medicoes/${id}/atualizar-status/`, { status, motivo_recusa: motivoRecusa });
  return mapFromApi(response.data);
};

export const deleteMedicao = async (id: any) => {
  await api.delete(`medicoes/${id}/`);
};
