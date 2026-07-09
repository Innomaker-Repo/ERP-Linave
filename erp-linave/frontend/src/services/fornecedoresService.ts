import api from './api';

/**
 * Serviço de Fornecedores (tabela SQL `comercialapp_fornecedor`).
 * Traduz entre o shape camelCase usado no frontend e o snake_case do backend,
 * preservando exatamente os campos que as telas já consomem
 * (razaoSocial, cnpj, contato, endereco, status, tipo, descricaoEstadual,
 *  naturezaFornecimento, criadoPor, criadoEm).
 */

const resolveNatureza = (tipo?: string, natureza?: string) => {
  if (natureza === 'ITEM' || natureza === 'SERVICO') return natureza;
  return tipo === 'Empresas' ? 'ITEM' : 'SERVICO';
};

const mapFromApi = (f: any) => ({
  id: f.id,
  razaoSocial: f.razao_social || '',
  cnpj: f.documento || '',
  contato: f.contato || '',
  endereco: f.endereco || '',
  status: f.status || 'Ativo',
  tipo: f.tipo || 'Serviços',
  descricaoEstadual: f.descricao_estadual || '',
  naturezaFornecimento: resolveNatureza(f.tipo, f.natureza_fornecimento),
  criadoPor: f.criado_por_nome || '',
  criadoEm: f.created_at || '',
});

const mapToApi = (f: any) => ({
  razao_social: f.razaoSocial || '',
  documento: f.cnpj || '',
  contato: f.contato || '',
  endereco: f.endereco || '',
  status: f.status || 'Ativo',
  tipo: f.tipo || 'Serviços',
  descricao_estadual: f.descricaoEstadual || '',
  natureza_fornecimento: resolveNatureza(f.tipo, f.naturezaFornecimento),
  criado_por_nome: f.criadoPor || '',
});

export const getFornecedores = async () => {
  try {
    const response = await api.get('fornecedores/');
    const items = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.results)
        ? response.data.results
        : [];
    return items.map(mapFromApi);
  } catch (error) {
    console.error('Erro ao buscar fornecedores:', error);
    return [];
  }
};

export const createFornecedor = async (fornecedor: any) => {
  const response = await api.post('fornecedores/', mapToApi(fornecedor));
  return mapFromApi(response.data);
};

export const updateFornecedor = async (id: any, fornecedor: any) => {
  const response = await api.put(`fornecedores/${id}/`, mapToApi(fornecedor));
  return mapFromApi(response.data);
};

export const deleteFornecedor = async (id: any) => {
  await api.delete(`fornecedores/${id}/`);
};
