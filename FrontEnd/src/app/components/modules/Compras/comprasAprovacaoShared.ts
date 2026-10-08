/* =========================================================================================
 * Finalização da aprovação de um Pedido de Compra — compartilhada entre Aprovar Com. (quando
 * o total é <= APPROVAL_LIMIT, a aprovação Comercial já encerra o fluxo) e Aprovar Fin.
 * (sempre finaliza, já que só chega lá quem passou da Comercial e é > APPROVAL_LIMIT).
 *
 * Agrupa os itens com fornecedor selecionado por fornecedor e atribui a cada grupo um número
 * de Pedido de Compra (PC-XXXX), carimbado em `item.pedidoCompraNumero` — e move a requisição
 * inteira pra Comprados, AGUARDANDO a confirmação manual da compra no Kanban (1 card por PC).
 * A Conta a Pagar e o registro no Histórico de Compras só são criados nessa confirmação manual
 * (ver `handleConfirmBuy` em ComprasKanbanView.tsx), não mais aqui.
 * Itens sem seleção válida (não deveria acontecer — as duas telas exigem seleção antes de
 * aprovar) seguem pro fluxo manual item a item em Comprados, sem número de PC, como rede de
 * segurança (nesse caso o fornecedor é escolhido só na hora de marcar como comprado).
 *
 * `recusarRequisicao` é o outro lado do fluxo, compartilhado pelos 3 pontos de recusa
 * (Kanban/cotação, Aprovar Com., Aprovar Fin.): grava motivo + autoria e devolve o pedido ao
 * solicitante (stage 'RECUSADO', fora do Kanban) — ver a seção "Recusadas" em MinhasComprasView.
 * =======================================================================================*/
import { comComprasAtual } from '../../../../services/comprasSeguro';
import {
  formatPedidoCompraNumero,
  parsePedidoCompraSeqAtual,
  type ItemCompra,
  type PedidoCompraResumo,
  type RequisicaoCompra,
} from './comprasLocal';

export async function finalizarAprovacaoPedido(
  request: RequisicaoCompra,
  opts: { userSession: any; fornecedores: any[]; saveEntity: (collection: string, data: any) => Promise<void> },
): Promise<PedidoCompraResumo[] | null> {
  const { fornecedores, saveEntity } = opts;
  const detailsById = new Map((request.budgetDetails || []).map((d) => [d.itemId, d]));
  const elegiveis = request.itens.filter((item) => {
    const detail = detailsById.get(item.id);
    return detail && !detail.jaEmEstoque && detail.fornecedorSelecionado && detail.valorSelecionado !== null && detail.valorSelecionado !== undefined;
  });

  if (elegiveis.length === 0) {
    // Nenhum item elegível para agrupamento automático (sem seleção de fornecedor) — a
    // requisição inteira vai para Comprados, fluxo manual item a item, sem número de PC.
    const salvou = await comComprasAtual(async ({ compras: base }) => {
      const atualizado = base.map((r: any): RequisicaoCompra => {
        if (r.id !== request.id) return r;
        return {
          ...r,
          stage: 'COMPRADOS',
          itens: r.itens.map((item: any) => {
            const natureza = item.naturezaFornecimento === 'ITEM' ? 'ITEM' : 'SERVICO';
            return { ...item, naturezaFornecimento: natureza, purchaseState: natureza === 'ITEM' ? 'comprar' : 'aContratar' };
          }),
          purchaseState: r.purchaseState || 'comprar',
          updatedAt: new Date().toISOString(),
        };
      });
      await saveEntity('compras', atualizado);
      return true;
    });
    return salvou ? [] : null;
  }

  const gruposPorFornecedor = new Map<string, ItemCompra[]>();
  for (const item of elegiveis) {
    const fornecedor = detailsById.get(item.id)!.fornecedorSelecionado;
    if (!gruposPorFornecedor.has(fornecedor)) gruposPorFornecedor.set(fornecedor, []);
    gruposPorFornecedor.get(fornecedor)!.push(item);
  }

  const catalogoFornecedores: any[] = Array.isArray(fornecedores) ? fornecedores : [];
  const pedidosGerados: PedidoCompraResumo[] = [];
  const gruposArr = Array.from(gruposPorFornecedor.entries());
  const numerosPorItem = new Map<string, string>();

  const salvouCompras = await comComprasAtual(async ({ compras: comprasAtual, comprasHistorico }) => {
    let seq = parsePedidoCompraSeqAtual(comprasHistorico, comprasAtual);

    for (const [fornecedor, itensDoGrupo] of gruposArr) {
      seq += 1;
      const numero = formatPedidoCompraNumero(seq);
      const cnpj = catalogoFornecedores.find((f: any) => f?.razaoSocial === fornecedor)?.cnpj || '';
      const primeiroDetail = detailsById.get(itensDoGrupo[0].id)!;
      const valorTotalGrupo = itensDoGrupo.reduce((sum, item) => sum + (detailsById.get(item.id)?.valorSelecionado || 0), 0);

      for (const item of itensDoGrupo) numerosPorItem.set(item.id, numero);

      pedidosGerados.push({
        numero,
        solicitacaoId: request.id,
        centroCusto: request.centroCusto,
        solicitante: request.solicitante,
        departamento: request.departamento,
        fornecedor,
        fornecedorCnpj: cnpj,
        itens: itensDoGrupo.map((item) => {
          const detail = detailsById.get(item.id)!;
          const valorTotalItem = detail.valorSelecionado || 0;
          return {
            itemId: item.id,
            nome: item.nome,
            descricao: item.descricao,
            qtd: item.qtd,
            un: item.un,
            valorUnitario: item.qtd > 0 ? valorTotalItem / item.qtd : valorTotalItem,
            valorTotal: valorTotalItem,
          };
        }),
        valorTotal: valorTotalGrupo,
        prazoEntrega: primeiroDetail.prazoEntregaSelecionado || '',
        condicaoPagamento: primeiroDetail.condicaoPagamentoSelecionada || '',
        observacoes: '',
        data: new Date().toISOString(),
      });
    }

    // Carimba o número do PC em cada item elegível e move a requisição inteira pra Comprados
    // — os itens continuam todos lá (nada é removido: a Conta a Pagar/Histórico só nascem na
    // confirmação manual da compra, no Kanban).
    const atualizado = comprasAtual.map((r: any): RequisicaoCompra => {
      if (r.id !== request.id) return r;
      return {
        ...r,
        itens: r.itens.map((item: any) =>
          numerosPorItem.has(item.id) ? { ...item, pedidoCompraNumero: numerosPorItem.get(item.id) } : item,
        ),
        stage: 'COMPRADOS',
        purchaseState: r.purchaseState || 'comprar',
        updatedAt: new Date().toISOString(),
      };
    });
    await saveEntity('compras', atualizado);
    return true;
  });
  if (!salvouCompras) return null;

  return pedidosGerados;
}

// Recusa uma requisição com motivo (compartilhado por Kanban/cotação, Aprovar Com. e Aprovar
// Fin.) — devolve ao solicitante, que decide editar+reenviar ou cancelar em Minhas Compras.
export async function recusarRequisicao(
  requestId: string,
  motivo: string,
  userLabel: string,
  patchRequest: (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => Promise<void>,
): Promise<void> {
  await patchRequest(requestId, (r) => ({
    ...r,
    stage: 'RECUSADO',
    motivoRecusa: motivo.trim(),
    recusadoPor: userLabel,
    recusadoEm: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}
