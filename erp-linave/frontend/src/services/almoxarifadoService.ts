import api from './api';

/**
 * Serviço do Estoque/Almoxarifado. O estado é um objeto agregado único
 * (tables, gasTypes, allocations, históricos, romaneios...) que as telas manipulam
 * em conjunto. O backend guarda numa linha singleton e faz replace do objeto inteiro,
 * preservando o shape — EstoqueView e as demais telas seguem inalteradas.
 *   GET  /comercial/almoxarifado/ -> objeto (ou null)
 *   POST /comercial/almoxarifado/ -> substitui o objeto
 *
 * Obs.: a chave usada no contexto/telas é `almoxerifado` (grafia legada com "e");
 * mantida para não quebrar os consumidores.
 */

export const getAlmoxarifado = async (): Promise<any | null> => {
  try {
    const response = await api.get('almoxarifado/');
    return response.data && typeof response.data === 'object' ? response.data : null;
  } catch (error) {
    console.error('Erro ao carregar almoxarifado SQL:', error);
    return null;
  }
};

export const syncAlmoxarifado = async (obj: any): Promise<any> => {
  const response = await api.post('almoxarifado/', obj || {});
  return response.data;
};
