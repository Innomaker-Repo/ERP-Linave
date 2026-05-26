import api from './api';

const normalizeEmail = (value: any): string => {
    const email = String(value || '').trim();
    if (email.includes('@')) return email;
    return 'comercial@linave.com.br';
};

/**
 * Funções de busca para o CRM e Módulo Comercial
 */

// Busca todos os negócios (Tabela comercialapp_negocio)
export const getNegocios = async () => {
    try {
        const response = await api.get('negocios/');
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar negócios:", error);
        return [];
    }
};

// ==========================================
// NOVAS FUNÇÕES ADICIONADAS AQUI:
// ==========================================

// Cria um novo negócio no Django (POST)
export const criarNegocio = async (dadosNegocio) => {
    try {
        const payload = {
            ...dadosNegocio,
            email: normalizeEmail(dadosNegocio?.email),
        };

        const response = await api.post('negocios/', payload);
        return response.data;
    } catch (error) {
        // Log detalhado do erro que volta do Django (ex: campos obrigatórios faltando)
        console.error("Erro ao criar negócio:", error.response?.data || error.message);
        throw error; // Joga o erro para a tela do React exibir o alerta vermelho
    }
};

// Atualiza um negócio existente no Django (PATCH)
export const atualizarNegocio = async (id, dadosAtualizados) => {
    try {
        // Usamos PATCH para permitir atualizações parciais (ex: só adicionar um arquivo)
        const response = await api.patch(`negocios/${id}/`, dadosAtualizados);
        return response.data;
    } catch (error) {
        console.error(`Erro ao atualizar negócio ${id}:`, error.response?.data || error.message);
        throw error;
    }
};

// Exclui um negócio no Django (DELETE)
export const excluirNegocio = async (id) => {
    try {
        const response = await api.delete(`negocios/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao excluir negócio ${id}:`, error.response?.data || error.message);
        throw error;
    }
};

// ==========================================
// FIM DAS NOVAS FUNÇÕES
// ==========================================

// Busca todos os clientes (Tabela comercialapp_cliente)
const mapClienteFromApi = (cliente) => ({
  id: cliente.id,
  tipoPessoa: cliente.tipo === 'Juridica' ? 'PJ' : 'PF',
  razaoSocial: cliente.razao_social,
  nomeFantasia: cliente.nome_fantasia || '',
  cpfCnpj: cliente.documento,
  inscricaoEstadual: cliente.inscricao_estadual || '',
  status: cliente.status,
  contato: cliente.contato_geral,
  endereco: cliente.endereco_completo,
  dataCadastro: cliente.data_cadastro,
  usuarioResponsavel: cliente.usuario_responsavel || null,
  negocios: Array.isArray(cliente.negocios) ? cliente.negocios : []
});

const mapClienteToApi = (cliente) => ({
  tipo: cliente.tipoPessoa === 'PJ' ? 'Juridica' : 'Fisica',
  razao_social: cliente.razaoSocial,
  nome_fantasia: cliente.nomeFantasia || '',
  documento: cliente.cpfCnpj,
  inscricao_estadual: cliente.inscricaoEstadual || '',
  status: cliente.status,
  contato_geral: cliente.contato || '',
  endereco_completo: cliente.endereco || '',
  usuario_responsavel: cliente.usuarioResponsavel || null,
});

export const getClientes = async () => {
    try {
        const response = await api.get('clientes/');
        if (Array.isArray(response.data)) {
            return response.data.map(mapClienteFromApi);
        }
        return [];
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        return [];
    }
};

export const createCliente = async (cliente) => {
    try {
        const response = await api.post('clientes/', mapClienteToApi(cliente));
        return mapClienteFromApi(response.data);
    } catch (error) {
        console.error("Erro ao criar cliente:", error);
        throw error;
    }
};

export const updateCliente = async (id, cliente) => {
    try {
        const response = await api.put(`clientes/${id}/`, mapClienteToApi(cliente));
        return mapClienteFromApi(response.data);
    } catch (error) {
        console.error("Erro ao atualizar cliente:", error);
        throw error;
    }
};

export const deleteCliente = async (id) => {
    try {
        await api.delete(`clientes/${id}/`);
    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        throw error;
    }
};

// Busca negócios específicos de um cliente (Endpoint customizado)
export const getNegociosDoCliente = async (clienteId) => {
    try {
        const response = await api.get(`os-por-cliente/${clienteId}/`);
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar negócios do cliente:", error);
        return [];
    }
};

// Busca ordens de serviço por negócio (endpoint customizado)
export const getOrdensPorNegocio = async (negocioId) => {
    try {
        const response = await api.get(`os-por-negocio/${negocioId}/`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao buscar OS por negócio ${negocioId}:`, error?.response?.data || error.message);
        return [];
    }
};

// Busca todas as Ordens de Serviço
export const getOrdensServico = async () => {
    try {
        const response = await api.get('ordens-servico/');
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar OS:", error);
        return [];
    }
};

/**
 * Funções de persistência (POST/PATCH)
 */

// Cria um novo orçamento resolvendo o erro de IntegrityError (Duplicate Entry)
export const criarOrcamentoCompleto = async (dadosOrcamento) => {
    try {
        const response = await api.post('orcamentos/criar/', dadosOrcamento);
        return response.data;
    } catch (error) {
        console.error("Erro ao salvar orçamento:", error);
        throw error;
    }
};

// Cria uma nova Ordem de Serviço no backend
export const criarOrdemServico = async (dadosOS: any) => {
    try {
        const response = await api.post('ordens-servico/', dadosOS);
        return response.data;
    } catch (error) {
        console.error("Erro ao criar OS:", (error as any)?.response?.data || error);
        throw error;
    }
};

// Busca todas as Ordens de Serviço
export const getOrdensServicoPorNegocio = async (negocioId: number) => {
    try {
        const response = await api.get(`os-por-negocio/${negocioId}/`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao buscar OS do negócio ${negocioId}:`, error);
        return { ordens_servico: [] };
    }
};

export const criarProposta = async (payload: any) => {
    try {
        const response = await api.post('propostas-comerciais/', payload);
        return response.data;
    } catch (error) {
        console.error('Erro ao criar proposta:', (error as any)?.response?.data || error);
        throw error;
    }
};

export const atualizarProposta = async (id: number, payload: any) => {
    try {
        const response = await api.patch(`propostas-comerciais/${id}/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Erro ao atualizar proposta ${id}:`, (error as any)?.response?.data || error);
        throw error;
    }
};