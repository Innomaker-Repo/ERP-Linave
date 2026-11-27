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

/** Id único para uma linha nova do estoque (nunca derivado da posição/quantidade de linhas). */
export const novoIdDeLinha = (prefixo: string) =>
  `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Corrige linhas que ficaram com o MESMO id dentro de uma tabela. Até 11/2026 o id de uma linha
 * nova era "tabela-(quantidade de linhas + 1)"; depois de qualquer linha sair da tabela (baixa,
 * exclusão) o número gerado já existia, e as duas linhas passavam a ser marcadas/desmarcadas
 * juntas no romaneio (e editadas/baixadas juntas). A 1ª ocorrência mantém o id (é a que o
 * histórico já referencia); as seguintes ganham `<id>~2`, `<id>~3`... — determinístico, então
 * todo usuário calcula os mesmos ids a partir do mesmo dado, e a correção fica gravada no
 * próximo save. Devolve o mesmo objeto quando não há nada a corrigir.
 */
export function semIdsDeLinhaRepetidos<T extends { tables?: any }>(dados: T): T {
  if (!dados || !Array.isArray(dados.tables)) return dados;
  let mudou = false;
  const tables = dados.tables.map((tabela: any) => {
    if (!tabela || !Array.isArray(tabela.rows)) return tabela;
    const existentes = new Set(tabela.rows.map((r: any) => String(r?.id)));
    const vistos = new Set<string>();
    let mudouTabela = false;
    const rows = tabela.rows.map((linha: any) => {
      const id = String(linha?.id);
      if (!vistos.has(id)) { vistos.add(id); return linha; }
      let n = 2;
      while (existentes.has(`${id}~${n}`) || vistos.has(`${id}~${n}`)) n += 1;
      const novoId = `${id}~${n}`;
      vistos.add(novoId);
      mudouTabela = true;
      return { ...linha, id: novoId };
    });
    if (!mudouTabela) return tabela;
    mudou = true;
    return { ...tabela, rows };
  });
  return mudou ? { ...dados, tables } : dados;
}

export async function comAlmoxarifadoAtual<T>(fn: (base: any) => Promise<T>): Promise<T | undefined> {
  try {
    const response = await api.get('almoxarifado/');
    const base = semIdsDeLinhaRepetidos(response.data && typeof response.data === 'object' ? response.data : {});
    return await fn(base);
  } catch (error) {
    console.error('Erro ao salvar no Almoxarifado:', error);
    const mensagem = (error as any)?.response?.data?.error;
    toast.error(typeof mensagem === 'string' ? mensagem : 'Não foi possível salvar no Almoxarifado. Verifique sua conexão e tente novamente.');
    return undefined;
  }
}
