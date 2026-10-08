/* =========================================================================================
 * FINANCEIRO — escrita segura (replace-all)
 * Toda escrita no Financeiro (Banco, Solicitação, Conta a Pagar, NFe, Conta a Receber,
 * Locação...) é um replace-all: o array enviado substitui a tabela inteira no servidor
 * (ver financeiro_sync.replace_all no backend). Por isso NUNCA se deve montar esse array em
 * cima de uma cópia que pode estar desatualizada (o `financeiro` carregado no login/contexto)
 * — se estiver, a escrita apaga silenciosamente tudo que não estava nela. Foi exatamente
 * isso que causou uma perda real de dados em produção.
 *
 * `comFinanceiroAtual` busca o estado mais recente do servidor imediatamente antes de montar
 * o array final, e cobre as duas pontas que podem falhar: a busca em si, e a gravação
 * (ctx.saveEntity('financeiro', ...), que propaga erro em vez de engolir — ver ErpContext.tsx).
 * Nos dois casos, aborta sem meio-termo (nada é salvo) e avisa o usuário por toast.
 * =======================================================================================*/
import { toast } from 'sonner';
import api from './api';

export async function comFinanceiroAtual<T>(fn: (base: any[]) => Promise<T>): Promise<T | undefined> {
  try {
    const response = await api.get('financeiro/');
    const base = Array.isArray(response.data) ? response.data : [];
    return await fn(base);
  } catch (error) {
    console.error('Erro ao salvar no Financeiro:', error);
    const mensagem = (error as any)?.response?.data?.error;
    toast.error(typeof mensagem === 'string' ? mensagem : 'Não foi possível salvar no Financeiro. Verifique sua conexão e tente novamente.');
    return undefined;
  }
}
