import api from './api';

/**
 * Serviço do Financeiro. O estado financeiro é uma lista de "FinRecord"
 * discriminados por `tipo` (ver useFin.ts/finData.ts). O backend expõe:
 *   GET  /comercial/financeiro/  -> lista unificada de FinRecord
 *   POST /comercial/financeiro/  -> substitui todo o estado (replace-all)
 *
 * Mantemos o shape FinRecord intacto, então useFin e todas as telas do Financeiro
 * continuam funcionando sem alteração — só a persistência mudou (blob -> SQL).
 */

export const getFinanceiro = async (): Promise<any[]> => {
  try {
    const response = await api.get('financeiro/');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Erro ao carregar financeiro SQL:', error);
    return [];
  }
};

export const syncFinanceiro = async (records: any[]): Promise<any[]> => {
  const response = await api.post('financeiro/', records);
  return Array.isArray(response.data?.financeiro) ? response.data.financeiro : records;
};

/**
 * Cria UMA solicitação de pagamento (append-only). O endpoint é aberto a todo
 * usuário autenticado — diferente do replace-all acima, que exige permissão do
 * módulo Financeiro. Retorna a lista completa atualizada de FinRecord.
 */
export const criarSolicitacaoPagamento = async (record: any): Promise<any[]> => {
  const response = await api.post('financeiro/solicitacao/', record);
  return Array.isArray(response.data?.financeiro) ? response.data.financeiro : [];
};
