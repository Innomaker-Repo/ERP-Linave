import api from './api';

type ServicoPayload = {
  tipo_servico: string;
  categoria: string;
  local_execucao: string;
  descricao: string;
  embarcacao: string;
  porto?: string;
  observacoes?: string;
};

type NegocioPayload = {
  cliente: number;
  empresa_prestadora: string;
  nome_negocio: string;
  solicitante: string;
  cargo?: string;
  telefone?: string;
  email: string;
  servicos?: ServicoPayload[];
};

type NegocioFrontend = {
  id?: string;
  clienteId?: string;
  empresaPrestadora?: string;
  nome: string;
  solicitante: string;
  cargo?: string;
  telefone?: string;
  email: string;
  servicos?: any[];
  dataSolicitacao?: string;
  status?: string;
};

const normalizeEmail = (value: any): string => {
  const email = String(value || '').trim();
  if (email.includes('@')) return email;
  return 'comercial@linave.com.br';
};

/**
 * Mapeia dados do frontend para o formato esperado pelo backend
 */
export const mapNegocioFrontendToBackend = (negocio: NegocioFrontend, clienteId: number): NegocioPayload => ({
  cliente: clienteId,
  empresa_prestadora: String(negocio.empresaPrestadora || 'Linave').trim(),
  nome_negocio: String(negocio.nome || negocio.nome_negocio || 'Negócio sem nome').trim(),
  solicitante: String(negocio.solicitante || 'Solicitante não informado').trim(),
  cargo: String(negocio.cargo || '').trim() || undefined,
  telefone: String(negocio.telefone || '').trim() || undefined,
  email: normalizeEmail(negocio.email),
  servicos: Array.isArray(negocio.servicos) ? negocio.servicos.map(mapServicoFrontendToBackend) : []
});

/**
 * Mapeia dados do backend para o formato do frontend
 */
export const mapNegocioBackendToFrontend = (negocio: any): NegocioFrontend => ({
  id: String(negocio.id),
  clienteId: String(negocio.cliente),
  empresaPrestadora: negocio.empresa_prestadora || '',
  nome: negocio.nome_negocio || '',
  solicitante: negocio.solicitante || '',
  cargo: negocio.cargo || '',
  telefone: negocio.telefone || '',
  email: negocio.email || '',
  servicos: negocio.servicos || [],
  dataSolicitacao: negocio.data_solicitacao || '',
  status: 'Ativo' // Backend não tem status, assumimos ativo
});

const mapServicoFrontendToBackend = (servico: any): ServicoPayload => ({
  tipo_servico: servico.tipo || servico.tipo_servico || '',
  categoria: servico.categoria || '',
  local_execucao: servico.localExecucao || servico.local_execucao || '',
  descricao: servico.descricao || '',
  embarcacao: servico.embarcacao || '',
  porto: servico.porto || undefined,
  observacoes: servico.observacoes || undefined
});

/**
 * Busca todos os negócios do backend
 */
export const getNegocios = async () => {
  try {
    const response = await api.get('negocios/');
    return response.data.map(mapNegocioBackendToFrontend);
  } catch (error) {
    console.error('Erro ao buscar negócios:', error);
    return [];
  }
};

/**
 * Busca negócios de um cliente específico
 */
export const getNegociosDoCliente = async (clienteId: number) => {
  try {
    const response = await api.get(`negocios/?cliente=${clienteId}`);
    return response.data.map(mapNegocioBackendToFrontend);
  } catch (error) {
    console.error('Erro ao buscar negócios do cliente:', error);
    return [];
  }
};

/**
 * Cria um novo negócio no backend
 */
export const createNegocio = async (negocio: NegocioFrontend, clienteId: number) => {
  const payload = mapNegocioFrontendToBackend(negocio, clienteId);
  const response = await api.post('negocios/', payload);
  return mapNegocioBackendToFrontend(response.data);
};

/**
 * Atualiza um negócio existente
 */
export const updateNegocio = async (negocioId: string, negocio: NegocioFrontend, clienteId: number) => {
  const payload = mapNegocioFrontendToBackend(negocio, clienteId);
  const response = await api.patch(`negocios/${negocioId}/`, payload);
  return mapNegocioBackendToFrontend(response.data);
};

/**
 * Deleta um negócio
 */
export const deleteNegocio = async (negocioId: string) => {
  await api.delete(`negocios/${negocioId}/`);
};

/**
 * Busca um negócio específico por ID
 */
export const getNegocioById = async (negocioId: string) => {
  try {
    const response = await api.get(`negocios/${negocioId}/`);
    return mapNegocioBackendToFrontend(response.data);
  } catch (error) {
    console.error('Erro ao buscar negócio:', error);
    return null;
  }
};

/**
 * Adiciona um serviço a um negócio existente
 */
export const addServicoToNegocio = async (negocioId: string, servico: any) => {
  const servicoPayload = mapServicoFrontendToBackend(servico);
  const response = await api.post(`servicos/`, {
    negocio: negocioId,
    ...servicoPayload
  });
  return response.data;
};

/**
 * Remove um serviço de um negócio
 */
export const removeServicoFromNegocio = async (servicoId: string) => {
  await api.delete(`servicos/${servicoId}/`);
};

/**
 * Sincroniza negócios locais com o backend
 */
export const sincronizarNegociosComBackend = async (negociosLocais: NegocioFrontend[], clienteId: number) => {
  const sincronizados: NegocioFrontend[] = [];
  const erros: Array<{ negocio: string; erro: string }> = [];

  for (const negocio of negociosLocais) {
    try {
      if (negocio.id?.startsWith('NEG-')) {
        // Novo negócio, criar no backend
        const novo = await createNegocio(negocio, clienteId);
        sincronizados.push(novo);
      } else if (negocio.id && !isNaN(Number(negocio.id))) {
        // Negócio existente, atualizar
        const atualizado = await updateNegocio(negocio.id, negocio, clienteId);
        sincronizados.push(atualizado);
      } else {
        // ID inválido, trata como novo
        const novo = await createNegocio(negocio, clienteId);
        sincronizados.push(novo);
      }
    } catch (error: any) {
      const nomeNegocio = negocio.nome || negocio.nome_negocio || 'Negócio desconhecido';
      erros.push({
        negocio: nomeNegocio,
        erro: error?.response?.data?.detail || error?.message || 'Erro desconhecido'
      });
    }
  }

  return { sincronizados, erros };
};
