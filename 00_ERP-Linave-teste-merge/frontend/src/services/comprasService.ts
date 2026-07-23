import api from './api';

/**
 * Serviço de Compras. As requisições do kanban (ctx.compras) e o histórico
 * (ctx.comprasHistorico) são documentos agregados; o backend faz replace-all por
 * coleção, preservando o shape exato, então o kanban e o histórico seguem inalterados.
 *   GET  /comercial/compras/ -> { compras, comprasHistorico }
 *   POST /comercial/compras/ -> substitui a(s) coleção(ões) enviada(s)
 */

export const getCompras = async (): Promise<{ compras: any[]; comprasHistorico: any[] }> => {
  try {
    const response = await api.get('compras/');
    return {
      compras: Array.isArray(response.data?.compras) ? response.data.compras : [],
      comprasHistorico: Array.isArray(response.data?.comprasHistorico) ? response.data.comprasHistorico : [],
    };
  } catch (error) {
    console.error('Erro ao carregar compras SQL:', error);
    return { compras: [], comprasHistorico: [] };
  }
};

export const syncCompras = async (compras: any[]): Promise<any[]> => {
  const response = await api.post('compras/', { compras });
  return Array.isArray(response.data?.compras) ? response.data.compras : compras;
};

export const syncComprasHistorico = async (comprasHistorico: any[]): Promise<any[]> => {
  const response = await api.post('compras/', { comprasHistorico });
  return Array.isArray(response.data?.comprasHistorico) ? response.data.comprasHistorico : comprasHistorico;
};
