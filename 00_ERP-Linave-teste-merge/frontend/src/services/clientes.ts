import api from './api';

type ClientePayload = {
  tipo: 'Fisica' | 'Juridica';
  razao_social: string;
  nome_fantasia?: string;
  documento: string;
  inscricao_estadual?: string;
  status?: 'Ativo' | 'Inativo';
  contato_geral?: string;
  endereco_completo?: string;
  usuario_responsavel?: string | null;
};

type ClienteFrontend = {
  id?: string;
  tipoPessoa: 'PJ' | 'PF';
  razaoSocial: string;
  nomeFantasia?: string;
  cpfCnpj: string;
  inscricaoEstadual?: string;
  status?: 'Ativo' | 'Inativo';
  contato?: string;
  endereco?: string;
  dataCadastro?: string;
  usuarioResponsavel?: string;
};

const normalizeCpfCnpj = (value: any): string => {
  if (!value) return '';
  const str = String(value).trim();
  if (str.length === 0) return `DOC-${Date.now()}`;
  return str;
};

const isValidDocumento = (value: any): boolean => {
  const str = String(value || '').trim();
  return str.length > 0 && !str.startsWith('DOC-');
};

/**
 * Mapeia dados do frontend para o formato esperado pelo backend
 */
export const mapClienteFrontendToBackend = (cliente: ClienteFrontend): ClientePayload => {
  // usuario_responsavel deve ser um email válido ou null
  let usuarioResponsavel = null;
  if (cliente.usuarioResponsavel && cliente.usuarioResponsavel.includes('@')) {
    usuarioResponsavel = cliente.usuarioResponsavel;
  }
  
  // Garantir que campos obrigatórios nunca sejam undefined
  const razaoSocial = (cliente.razaoSocial || '').trim();
  const documento = normalizeCpfCnpj(cliente.cpfCnpj);
  const contato = (cliente.contato || '').trim();
  const endereco = (cliente.endereco || '').trim();
  
  if (!razaoSocial) {
    throw new Error('Razão Social é obrigatória');
  }
  if (!documento) {
    throw new Error('Documento (CPF/CNPJ) é obrigatório');
  }
  if (!contato) {
    throw new Error('Contato é obrigatório');
  }
  if (!endereco) {
    throw new Error('Endereço é obrigatório');
  }

  return {
    tipo: cliente.tipoPessoa === 'PJ' ? 'Juridica' : 'Fisica',
    razao_social: razaoSocial,
    nome_fantasia: cliente.nomeFantasia?.trim() || undefined,
    documento: documento,
    inscricao_estadual: cliente.inscricaoEstadual?.trim() || undefined,
    status: (cliente.status || 'Ativo') as 'Ativo' | 'Inativo',
    contato_geral: contato,
    endereco_completo: endereco,
    usuario_responsavel: usuarioResponsavel
  };
};

/**
 * Mapeia dados do backend para o formato do frontend
 */
export const mapClienteBackendToFrontend = (cliente: any): ClienteFrontend => ({
  id: String(cliente.id),
  tipoPessoa: cliente.tipo === 'Juridica' ? 'PJ' : 'PF',
  razaoSocial: cliente.razao_social || '',
  nomeFantasia: cliente.nome_fantasia || '',
  cpfCnpj: cliente.documento || '',
  inscricaoEstadual: cliente.inscricao_estadual || '',
  status: cliente.status || 'Ativo',
  contato: cliente.contato_geral || '',
  endereco: cliente.endereco_completo || '',
  dataCadastro: cliente.data_cadastro || new Date().toISOString().split('T')[0],
  usuarioResponsavel: cliente.usuario_responsavel || ''
});

/**
 * Busca todos os clientes do backend
 */
export const getClientes = async () => {
  try {
    const response = await api.get('clientes/');
    return response.data.map(mapClienteBackendToFrontend);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return [];
  }
};

/**
 * Cria um novo cliente no backend
 */
export const createCliente = async (cliente: ClienteFrontend) => {
  const payload = mapClienteFrontendToBackend(cliente);
  const response = await api.post('clientes/', payload);
  return mapClienteBackendToFrontend(response.data);
};

/**
 * Atualiza um cliente existente
 */
export const updateCliente = async (clienteId: string, cliente: ClienteFrontend) => {
  const payload = mapClienteFrontendToBackend(cliente);
  const response = await api.patch(`clientes/${clienteId}/`, payload);
  return mapClienteBackendToFrontend(response.data);
};

/**
 * Deleta um cliente
 */
export const deleteCliente = async (clienteId: string) => {
  await api.delete(`clientes/${clienteId}/`);
};

/**
 * Sincroniza clientes locais com o backend
 * Cria ou atualiza clientes que ainda não existem no backend
 */
export const sincronizarClientesComBackend = async (clientesLocais: ClienteFrontend[]) => {
  const sincronizados: ClienteFrontend[] = [];
  const erros: Array<{ cliente: string; erro: string }> = [];

  for (const cliente of clientesLocais) {
    try {
      if (cliente.id?.startsWith('CLI-')) {
        // Novo cliente, criar no backend
        const novo = await createCliente(cliente);
        sincronizados.push(novo);
      } else if (cliente.id && !isNaN(Number(cliente.id))) {
        // Cliente existente, atualizar
        const atualizado = await updateCliente(cliente.id, cliente);
        sincronizados.push(atualizado);
      } else {
        // ID inválido, trata como novo
        const novo = await createCliente(cliente);
        sincronizados.push(novo);
      }
    } catch (error: any) {
      const nomeCliente = cliente.razaoSocial || cliente.nomeFantasia || 'Desconhecido';
      erros.push({
        cliente: nomeCliente,
        erro: error?.response?.data?.detail || error?.message || 'Erro desconhecido'
      });
    }
  }

  return { sincronizados, erros };
};
