import api from './api';

type ClientePayload = {
  tipo: string;
  razao_social: string;
  nome_fantasia?: string;
  documento: string;
  inscricao_estadual?: string;
  status?: string;
  contato_geral?: string;
  endereco_completo?: string;
  usuario_responsavel?: null | string;
};

type NegocioPayload = {
  cliente: number;
  empresa_prestadora: string;
  nome_negocio: string;
  solicitante: string;
  cargo?: string;
  telefone?: string;
  email: string;
  data_prevista_inicio?: string | null;
  data_prevista_final?: string | null;
  servicos?: any[];
};

type OrcamentoPayload = {
  levantamento: {
    cliente_id: number;
    negocio_id: number;
  };
  resumo: {
    margem: number;
    OH: number;
    impostos: number;
    qnt: number;
  };
  mao_de_obra: any[];
  materiais: any[];
  terceirizados: any[];
  atividades: any[];
  observacoes?: string;
  finalizar?: boolean;
};

const parseDecimal = (value: any): number => {
  if (value === undefined || value === null || value === '') return 0;
  const normalized = String(value).replace(/\./g, '').replace(/,/g, '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeEmail = (value: any): string => {
  const email = String(value || '').trim();
  if (email.includes('@')) return email;
  return 'comercial@linave.com.br';
};

export const getClientes = async () => {
  const response = await api.get('clientes/');
  return response.data;
};

export const createCliente = async (cliente: ClientePayload) => {
  const response = await api.post('clientes/', cliente);
  return response.data;
};

export const findOrCreateCliente = async (cliente: any) => {
  const source = cliente || {};
  const documento = String(source.cpfCnpj || source.documento || '').trim();
  const razaoSocial = String(source.razaoSocial || source.razao_social || source.nomeFantasia || '').trim();

  if (!documento && !razaoSocial) {
    throw new Error('Dados de cliente insuficientes para criação.');
  }

  const clientes = await getClientes();
  const existing = clientes.find((item: any) => {
    if (documento && item.documento === documento) return true;
    if (razaoSocial && String(item.razao_social).trim().toLowerCase() === razaoSocial.toLowerCase()) return true;
    return false;
  });

  if (existing) return existing;

  const payload: ClientePayload = {
    tipo: String(source.tipoPessoa || source.tipo || 'Juridica') === 'PJ' ? 'Juridica' : 'Fisica',
    razao_social: razaoSocial || 'Cliente Sem Nome',
    nome_fantasia: String(source.nomeFantasia || source.nome_fantasia || source.razaoSocial || '').trim() || undefined,
    documento: documento || `00000000000000${Date.now()}`,
    inscricao_estadual: String(source.inscricaoEstadual || source.inscricao_estadual || '').trim() || undefined,
    status: String(source.status || 'Ativo') === 'Ativo' ? 'Ativo' : 'Inativo',
    contato_geral: String(source.contato || source.contato_geral || '').trim() || undefined,
    endereco_completo: String(source.endereco || source.endereco_completo || '').trim() || undefined,
    usuario_responsavel: null
  };

  return createCliente(payload);
};

export const getNegocios = async () => {
  const response = await api.get('negocios/');
  return response.data;
};

const mapServicoItem = (item: any) => ({
  tipo_servico: item.tipo || item.tipo_servico || '',
  categoria: item.categoria || '',
  local_execucao: item.localExecucao || item.local_execucao || '',
  descricao: item.descricao || '',
  embarcacao: item.embarcacao || '',
  porto: item.porto || '',
  observacoes: item.observacoes || ''
});

export const createNegocio = async (negocio: NegocioPayload) => {
  const response = await api.post('negocios/', negocio);
  return response.data;
};

export const findOrCreateNegocio = async (obra: any, clienteId: number) => {
  const negocios = await getNegocios();
  const nomeNegocio = String(obra.nome || obra.nome_negocio || obra.projeto || 'Negócio sem nome').trim();
  const existing = negocios.find((item: any) => {
    if (item.cliente !== clienteId) return false;
    return String(item.nome_negocio || '').trim().toLowerCase() === nomeNegocio.toLowerCase();
  });

  if (existing) return existing;

  const servicos = Array.isArray(obra.servicos) ? obra.servicos.map(mapServicoItem) : [];
  const payload: NegocioPayload = {
    cliente: clienteId,
    empresa_prestadora: String(obra.empresaPrestadora || obra.tipo || obra.empresa_prestadora || 'Linave').trim(),
    nome_negocio: nomeNegocio,
    solicitante: String(obra.solicitante || obra.responsavelComercial || obra.responsavel_comercial || '').trim() || 'Solicitante não informado',
    cargo: String(obra.cargo || obra.responsavelComercial || obra.responsavel_comercial || '').trim() || undefined,
    telefone: String(obra.telefone || '').trim() || undefined,
    email: normalizeEmail(obra.email),
    data_prevista_inicio: obra.dataPrevistaInicio || obra.inicioPrevisto || null,
    data_prevista_final: obra.dataPrevistaFinal || obra.fimPrevisto || null,
    servicos
  };

  return createNegocio(payload);
};

const mapMDOItem = (item: any) => ({
  fnc: item.funcao || item.fnc || '',
  qnt: Number(item.quantidade || item.qnt || 0),
  dias: Number(item.dias || 0),
  custo_unit_dia: parseDecimal(item.custoUnitDia || item.custo_unit_dia || item.custoUnit || 0),
  observacao: String(item.observacao || '').trim()
});

const mapMaterialItem = (item: any) => ({
  item: item.descricao || '',
  unidade: item.unidade || '',
  quantidade: Number(item.quantidade || 0),
  peso: parseDecimal(item.pesoFator || item.peso || 0),
  custo_unitario: parseDecimal(item.custoUnit || item.custo_unitario || 0),
  terceirizado: String(item.origemTerceiros || '').toLowerCase() === 'sim',
  observacao: String(item.observacao || '').trim()
});

const mapTerceirizadoItem = (item: any) => ({
  descricao: item.descricao || '',
  unidade: item.unidade || '',
  quantidade: parseDecimal(item.quantidade || 0),
  peso: parseDecimal(item.pesoFator || item.peso || 0),
  custo_unit: parseDecimal(item.custoUnit || item.custo_unit || 0),
  observacao: String(item.observacao || '').trim()
});

const mapAtividadeItem = (item: any) => ({
  atividade: item.atividade || '',
  duracao: Number(item.dias || item.duração || 0),
  observacao: String(item.observacao || '').trim()
});

export const buildOrcamentoPayload = (orcamentoData: any, obra: any, negocioId: number, clienteId: number): OrcamentoPayload => ({
  levantamento: {
    cliente_id: clienteId,
    negocio_id: negocioId
  },
  resumo: {
    margem: parseDecimal(orcamentoData.margem || 0),
    OH: parseDecimal(orcamentoData.oh || 0),
    impostos: parseDecimal(orcamentoData.impostos || 0),
    qnt: Number(orcamentoData.quantidadeItensProduzidos || 0)
  },
  mao_de_obra: Array.isArray(orcamentoData.maoDeObra) ? orcamentoData.maoDeObra.map(mapMDOItem) : [],
  materiais: Array.isArray(orcamentoData.materiais) ? orcamentoData.materiais.map(mapMaterialItem) : [],
  terceirizados: Array.isArray(orcamentoData.terceirizados) ? orcamentoData.terceirizados.map(mapTerceirizadoItem) : [],
  atividades: Array.isArray(orcamentoData.atividades) ? orcamentoData.atividades.map(mapAtividadeItem) : [],
  observacoes: String(orcamentoData.observacoes || '').trim()
});

export const createOrcamento = async (payload: OrcamentoPayload) => {
  const response = await api.post('orcamentos/criar/', payload);
  return response.data;
};
