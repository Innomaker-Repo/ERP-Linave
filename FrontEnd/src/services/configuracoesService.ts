import api from './api';

/**
 * Serviço de Configurações (empresa + listas auxiliares). São objetos singleton
 * (`config` e `listas`) guardados numa linha dedicada no SQL. `ctx.config`/`ctx.listas`
 * continuam sendo objetos para os leitores; só a persistência muda (blob -> SQL).
 *   GET  /comercial/configuracoes/ -> { config, listas }
 *   POST /comercial/configuracoes/ -> substitui o(s) objeto(s) enviado(s)
 */

export const getConfiguracoes = async (): Promise<{ config: any | null; listas: any | null }> => {
  try {
    const response = await api.get('configuracoes/');
    return {
      config: response.data && typeof response.data.config === 'object' ? response.data.config : null,
      listas: response.data && typeof response.data.listas === 'object' ? response.data.listas : null,
    };
  } catch (error) {
    console.error('Erro ao carregar configurações SQL:', error);
    return { config: null, listas: null };
  }
};

export const syncConfig = async (config: any): Promise<any> => {
  const response = await api.post('configuracoes/', { config });
  return response.data?.config ?? config;
};

export const syncListas = async (listas: any): Promise<any> => {
  const response = await api.post('configuracoes/', { listas });
  return response.data?.listas ?? listas;
};
