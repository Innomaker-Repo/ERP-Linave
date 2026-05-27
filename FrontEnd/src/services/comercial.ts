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
  versao?: string;
};

const parseDecimal = (value: any): number => {
  if (value === undefined || value === null || value === '') return 0;
  const text = String(value).trim().replace(/\s+/g, '');
  if (!text) return 0;

  let normalized = text;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

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
  const razaoSocial = String(source.razaoSocial || source.razao_social || source.nomeFantasia || 'Cliente Sem Nome').trim();

  // 1. Busca os existentes
  const clientes = await getClientes();
  const existing = clientes.find((item: any) => {
    return (documento && item.documento === documento) || 
           (razaoSocial && String(item.razao_social).trim().toLowerCase() === razaoSocial.toLowerCase());
  });

  if (existing) return existing;

  // 2. PROTEÇÃO CONTRA 400: Se não tem documento, NÃO envia POST
  if (!documento || documento === 'undefined' || documento.length < 5) {
      console.warn("Criação bloqueada: documento inválido.");
      return { id: null, razao_social: razaoSocial };
  }

  // 3. Payload
  const payload: ClientePayload = {
    tipo: String(source.tipoPessoa || 'Juridica'),
    razao_social: razaoSocial,
    documento: documento,
    contato_geral: String(source.contato || source.contato_geral || 'Não informado').trim(),
    endereco_completo: String(source.endereco || source.endereco_completo || 'Não informado').trim(),
  };

  try {
    return await createCliente(payload);
  } catch (error) {
    // Aqui é onde o seu console log deve estar revelando o erro detalhado
    console.error("Erro na criação do cliente:", error);
    return { id: null, razao_social: razaoSocial };
  }
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
    servicos
  };

  return createNegocio(payload);
};

export const buildOrcamentoPayload = (orcamentoData: any, obra: any, negocioId: number, clienteId: number): OrcamentoPayload => {
  
  // Mapeamento correto para bater com models.py
  const mapMDOItem = (item: any) => ({
    fnc: String(item.funcao || item.fnc || 'Indefinido'),
    qnt: parseInt(item.quantidade || item.qnt || 0),
    dias: parseInt(item.dias || 0),
    custo_unit_dia: parseDecimal(item.custoUnitDia || item.custo_unit_dia || 0),
    observacao: String(item.observacao || '').trim()
  });

 const mapMaterialItem = (item: any) => ({
  item: String(item.descricao || ''),
  unidade: String(item.unidade || ''),
  qnt: parseInt(item.quantidade) || 0, // Backend espera "qnt"
  peso: parseDecimal(item.pesoFator || 0),
  custo_unit: parseDecimal(item.custoUnit || 0), // Backend espera "custo_unit"
  terceirizado: item.origemTerceiros === 'Sim',
  observacao: String(item.observacao || '').trim()
});

const mapTerceirizadoItem = (item: any) => ({
  descricao: item.descricao || '',
  unidade: item.unidade || '',
  qnt: parseInt(item.quantidade) || 0, // Backend espera "qnt"
  peso: parseDecimal(item.pesoFator || 0),
  valor_unit: parseDecimal(item.custoUnit || 0), // Backend espera "valor_unit"
  observacao: String(item.observacao || item.observacoes || '').trim()
});

  const mapAtividadeItem = (item: any) => ({
    atividade: String(item.atividade || ''),
    duracao: parseInt(item.dias || item.duracao || 0), // Nome correto no models.py
    observacao: String(item.observacao || '').trim()
  });

  return {
    levantamento: { cliente_id: clienteId, negocio_id: negocioId },
    resumo: {
      margem: parseDecimal(orcamentoData.margem || 0),
      OH: parseDecimal(orcamentoData.oh || 0),
      impostos: parseDecimal(orcamentoData.impostos || 0),
      qnt: parseInt(orcamentoData.quantidadeItensProduzidos) || 0
    },
    mao_de_obra: Array.isArray(orcamentoData.maoDeObra)
      ? orcamentoData.maoDeObra.filter((mo: any) => mo.funcao && mo.funcao.trim() !== '').map(mapMDOItem)
      : [],
    materiais: Array.isArray(orcamentoData.materiais)
      ? orcamentoData.materiais.filter((mat: any) => mat.descricao && mat.descricao.trim() !== '').map(mapMaterialItem)
      : [],
    terceirizados: Array.isArray(orcamentoData.terceirizados)
      ? orcamentoData.terceirizados.filter((ter: any) => ter.descricao && ter.descricao.trim() !== '').map(mapTerceirizadoItem)
      : [],
    atividades: Array.isArray(orcamentoData.atividades)
      ? orcamentoData.atividades.filter((act: any) => act.atividade && act.atividade.trim() !== '').map(mapAtividadeItem)
      : [],
    observacoes: String(orcamentoData.observacoes || '').trim()
  };
};

export const createOrcamento = async (payload: OrcamentoPayload) => {
  const response = await api.post('orcamentos/criar/', payload);
  return response.data;
};
