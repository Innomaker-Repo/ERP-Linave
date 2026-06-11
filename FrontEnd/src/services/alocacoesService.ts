import api from './api';

/**
 * Serviço de Alocações (funcionário ↔ obra/OS). Lista simples persistida no SQL
 * via replace-all, preservando o shape usado pela AlocacoesView.
 *   GET  /comercial/alocacoes/ -> lista
 *   POST /comercial/alocacoes/ -> substitui a lista inteira
 */

export const getAlocacoes = async (): Promise<any[]> => {
  try {
    const response = await api.get('alocacoes/');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Erro ao carregar alocações SQL:', error);
    return [];
  }
};

export const syncAlocacoes = async (alocacoes: any[]): Promise<any[]> => {
  const response = await api.post('alocacoes/', alocacoes);
  return Array.isArray(response.data) ? response.data : alocacoes;
};
