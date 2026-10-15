/* =========================================================================================
 * ALMOXARIFADO — escrita segura (replace-all)
 * Mesmo padrão de comprasSeguro.ts/financeiroSeguro.ts: o objeto de almoxerifado é um
 * agregado único (tables, manutencaoHistorico, etc.) substituído por inteiro a cada save, e
 * sofre do mesmo risco de cópia desatualizada — o contexto reidrata `almoxerifado` a cada 45s/
 * foco de aba (ErpContext.tsx), e perder o foco pra escolher uma foto (seletor de arquivo/
 * câmera) é um jeito trivial e comum do usuário disparar esse refresh bem no meio de um
 * registro de entrada/saída de manutenção. Se esse refresh busca o estado ANTES da escrita e a
 * resposta só chega DEPOIS, o próximo save que montar o payload em cima do estado do contexto
 * (em vez de buscar na hora) escreve por cima com uma cópia sem a mudança recém-feita —
 * confirmado isso ser a causa de precisar registrar a saída da manutenção mais de uma vez pro
 * item realmente ficar disponível.
 *
 * `comAlmoxarifadoAtual` busca o estado mais recente do servidor imediatamente antes de montar
 * o objeto final, e cobre as duas pontas que podem falhar: a busca em si, e a gravação
 * (ctx.saveEntity('almoxerifado', ...), que propaga erro em vez de engolir — ver ErpContext.tsx).
 * Nos dois casos, aborta sem meio-termo e avisa o usuário por toast.
 * =======================================================================================*/
import { toast } from 'sonner';
import api from './api';

export async function comAlmoxarifadoAtual<T>(fn: (base: any) => Promise<T>): Promise<T | undefined> {
  try {
    const response = await api.get('almoxarifado/');
    const base = response.data && typeof response.data === 'object' ? response.data : {};
    return await fn(base);
  } catch (error) {
    console.error('Erro ao salvar no Almoxarifado:', error);
    const mensagem = (error as any)?.response?.data?.error;
    toast.error(typeof mensagem === 'string' ? mensagem : 'Não foi possível salvar no Almoxarifado. Verifique sua conexão e tente novamente.');
    return undefined;
  }
}
