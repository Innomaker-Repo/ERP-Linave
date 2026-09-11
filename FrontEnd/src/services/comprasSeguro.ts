/* =========================================================================================
 * COMPRAS — escrita segura (replace-all)
 * Toda escrita em Compras (requisições do kanban e histórico) é um replace-all: o array
 * enviado substitui a tabela inteira no servidor (ver compras_sync.replace_requisicoes /
 * replace_historico no backend). Por isso NUNCA se deve montar esse array em cima de uma
 * cópia que pode estar desatualizada (o `compras`/`comprasHistorico` carregado no
 * login/contexto) — se estiver, a escrita apaga silenciosamente qualquer mudança feita por
 * outra pessoa nesse meio-tempo. Foi exatamente esse o mecanismo por trás de itens que
 * "sumiam" entre a Seleção do Gerente e a aba Aprovações — mesma causa raiz já corrigida no
 * Financeiro (ver financeiroSeguro.ts), replicada aqui.
 *
 * `comComprasAtual` busca o estado mais recente do servidor (compras + histórico) imediatamente
 * antes de montar o array final, e cobre as duas pontas que podem falhar: a busca em si, e a
 * gravação (ctx.saveEntity('compras'|'comprasHistorico', ...), que propaga erro em vez de
 * engolir — ver ErpContext.tsx). Nos dois casos, aborta sem meio-termo (nada é salvo) e avisa
 * o usuário por toast.
 * =======================================================================================*/
import { toast } from 'sonner';
import api from './api';

export type ComprasBase = { compras: any[]; comprasHistorico: any[] };

// A aprovação virou um fluxo sequencial em duas telas (Aprovar Com. / Aprovar Fin.) — o
// estágio único antigo 'APROVACAO' e a extinta coluna 'SELECAO_GERENTE' viram
// 'AGUARDANDO_COMERCIAL' em qualquer registro lido.
const migrarStageLegado = (r: any) =>
  (r?.stage === 'APROVACAO' || r?.stage === 'SELECAO_GERENTE') ? { ...r, stage: 'AGUARDANDO_COMERCIAL' } : r;

// Busca direto via api.get (NÃO usa getCompras() do comprasService — aquele engole erro de
// rede e devolve { compras: [], comprasHistorico: [] }, o que faria a gente escrever por
// cima de tudo com uma base vazia em vez de abortar).
export async function comComprasAtual<T>(fn: (base: ComprasBase) => Promise<T>): Promise<T | undefined> {
  try {
    const response = await api.get('compras/');
    const base: ComprasBase = {
      compras: (Array.isArray(response.data?.compras) ? response.data.compras : []).map(migrarStageLegado),
      comprasHistorico: Array.isArray(response.data?.comprasHistorico) ? response.data.comprasHistorico : [],
    };
    return await fn(base);
  } catch (error) {
    console.error('Erro ao salvar em Compras:', error);
    const mensagem = (error as any)?.response?.data?.error;
    toast.error(typeof mensagem === 'string' ? mensagem : 'Não foi possível salvar em Compras. Verifique sua conexão e tente novamente.');
    return undefined;
  }
}
