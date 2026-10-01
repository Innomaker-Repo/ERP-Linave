import { useEffect, useMemo, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { matchesSolicitante as matchesSolicitanteFin, money, br, CP_STATUS } from '../components/modules/Financeiro/finData';
import { toItemRecords, matchesSolicitante as matchesSolicitanteCompra, stageLabel, type BoardStage } from '../components/modules/Compras/comprasLocal';

/* =========================================================================================
 * NOTIFICAÇÕES — sino do cabeçalho.
 * Sem tabela própria no backend: deriva "eventos que valem notificação" a partir do que já
 * existe no workspace (compras, financeiro, OS, negócios), só do que envolve o usuário
 * logado. O estado "visto" fica no localStorage, por usuário (cpf/e-mail), pra sobreviver a
 * reload sem precisar de backend novo — a contagem no sino é só o que ainda não foi visto.
 *
 * Padrão usado em TODOS os blocos abaixo: 1 notificação por (registro, estágio ATUAL), com
 * id estável `${dominio}-${registroId}-${estagio}`. Quando o estágio muda, o id muda (vira
 * não-lida); enquanto o estágio se mantém, o id se mantém (já visto, não reaparece). Isso
 * evita precisar de um log de transições — só o estado atual dos dados já basta.
 *
 * Identidade: Compras e a Solicitação de Pagamento (Financeiro) já têm
 * solicitante+solicitanteCpf+solicitanteEmail (ver `matchesSolicitante` em cada domínio).
 * Conta a Pagar, NFe e Recibo de Locação não têm campo de pessoa próprio — a identidade é
 * resolvida por junção indireta (ver blocos correspondentes). OS e Negócio têm `criadoPorCpf`/
 * `criadoPorEmail` (gravados automaticamente na criação, ver OsView.tsx/CrmViewNew.tsx) —
 * registros criados antes desse campo existir ficam sem identidade e não notificam.
 *
 * Exceção ao filtro por identidade: o alerta de "devolução atrasada" do Almoxarifado
 * (item alugado de fornecedor) não tem NENHUM campo de pessoa (só `fornecedor`, texto
 * livre) — esse bloco notifica todo mundo logado, não só quem "é dono" do registro.
 *
 * Todo bloco do domínio FINANCEIRO (pedido de pagamento, conta a pagar, conta a receber,
 * NFe/recibo de locação) notifica DOIS públicos: quem fez a movimentação (identidade do
 * bloco) E a gerência financeira (ADMIN/GERENTE — `isGerenciaFinanceira` abaixo, vê tudo,
 * independente de ter relação com o registro) — é ela quem precisa acompanhar o financeiro
 * como um todo, não só o que ela mesma criou. Compras, OS e Negócios ficam fora dessa regra
 * (cada um já tem sua própria fila de aprovação/kanban visível pra quem precisa agir).
 * =======================================================================================*/

export interface Notificacao {
  id: string;
  titulo: string;
  data: string;
  destino: string;
}

// Prefixo "notif." (não "erp.notificacoes..."): clearLegacyCommercialLocalStorage() (main.tsx)
// apaga toda chave que bater com /workspace|linave|comercial|crm|erp/i a cada carregamento —
// "erp" no começo cairia nessa varredura e o "visto" seria perdido a cada F5.
const chaveVistos = (userSession: any): string => {
  const ident = userSession?.cpf || userSession?.email || 'anonimo';
  return `notif.vistos.${ident}`;
};

const lerVistos = (chave: string): Set<string> => {
  try {
    const raw = localStorage.getItem(chave);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

// Identidade estável (cpf/e-mail) de quem CRIOU o registro — usada por OS e Negócios, que
// só gravam o criador (sem o fallback por nome que Compras/Financeiro usam para dados
// legados, porque aqui o campo é novo e não existe versão "digitada à mão" pra cair).
const matchesCriador = (
  registro: { criadoPorCpf?: string; criadoPorEmail?: string } | null | undefined,
  session: { cpf?: string; email?: string } | null | undefined,
): boolean => {
  if (!registro || !session) return false;
  const norm = (v?: string) => String(v || '').trim().toLowerCase();
  const cpf = norm(session.cpf);
  const email = norm(session.email);
  if (cpf && registro.criadoPorCpf && norm(registro.criadoPorCpf) === cpf) return true;
  if (email && registro.criadoPorEmail && norm(registro.criadoPorEmail) === email) return true;
  return false;
};

// Estágios de Compras que não geram notificação: são o ponto de partida do próprio
// solicitante (criação, ou reenvio depois de um "Solicitar reajuste") — notificar aqui
// seria só ecoar a ação que a própria pessoa acabou de fazer.
const ESTAGIOS_COMPRA_SEM_NOTIFICAR = new Set(['SOLICITACOES', 'SELECAO_GERENTE']);

// Status de Conta a Pagar que não gera notificação: nasce assim no momento da criação
// (aprovação de compra ou de solicitação de pagamento) — mesmo raciocínio acima.
const CP_STATUS_SEM_NOTIFICAR = new Set([CP_STATUS.semDoc]);

const OS_EIXOS: Array<{ campo: 'statusOs' | 'statusEnvio' | 'statusAprovacao'; inicial: string; labels: Record<string, string> }> = [
  { campo: 'statusOs', inicial: 'rascunho', labels: { emproducao: 'Em produção', concluida: 'Concluída' } },
  { campo: 'statusEnvio', inicial: 'pendente', labels: { enviada: 'Enviada' } },
  { campo: 'statusAprovacao', inicial: 'pendente', labels: { aprovada: 'Aprovada' } },
];

// Tabelas do Almoxarifado que representam item alugado DE fornecedor (ver EstoqueView.tsx,
// mesma constante duplicada lá) — só nelas faz sentido "Data de Devolução".
const TABELAS_ALUGADOS = new Set(['Alugados - Gases', 'Alugados - Equipamentos']);

// "Data de Devolução" (YYYY-MM-DD) já passou? Mesma lógica de `isOld` (finData.ts) e de
// `isDataDevolucaoAtrasada` (EstoqueView.tsx), duplicada aqui de propósito — é uma
// comparação de data trivial, não vale criar um import cruzado só por causa dela.
const dataJaPassou = (dataIso?: string): boolean => {
  if (!dataIso) return false;
  const data = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(data.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return data < hoje;
};

// Dias até uma data (negativo = já venceu) — mesmo cálculo de `diasAteVencimento` (finData.ts),
// duplicado aqui pelo mesmo motivo de `dataJaPassou` acima.
const diasAte = (dataIso?: string): number => {
  const alvo = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return Infinity;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
};

// Janela de aviso pra parcela de fatura (Faturado) perto do vencimento — mesmo padrão de
// antecedência das Contas Fixas (finData.ts: avisosContasFixas), só que sem campo próprio de
// configuração: o vencimento de cada parcela já foi definido no momento do faturamento
// (SolicitacaoView.tsx), então basta um limiar fixo.
const DIAS_AVISO_VENCIMENTO_FATURADO = 5;

export function useNotificacoes() {
  const { userSession, financeiro, comprasHistorico, compras, os, obras, almoxerifado } = useErp() as any;
  const chave = chaveVistos(userSession);
  const [vistos, setVistos] = useState<Set<string>>(() => lerVistos(chave));

  // Troca de usuário (login diferente no mesmo navegador) — recarrega o set certo.
  useEffect(() => {
    setVistos(lerVistos(chave));
  }, [chave]);

  const notificacoes = useMemo<Notificacao[]>(() => {
    if (!userSession) return [];

    const listaFinanceiro = Array.isArray(financeiro) ? financeiro : [];
    const listaCompras = Array.isArray(compras) ? compras : [];
    const listaOs = Array.isArray(os) ? os : [];
    const listaObras = Array.isArray(obras) ? obras : [];
    const historicoCompras = toItemRecords(Array.isArray(comprasHistorico) ? comprasHistorico : []);

    // Gerência financeira (ADMIN/GERENTE) — mesmo critério de "quem aprova" usado em
    // AprovacoesView.tsx. Some ao filtro por identidade (não substitui) em todo bloco do
    // domínio Financeiro: ela precisa ver TODA movimentação, não só a que ela mesma originou.
    const isGerenciaFinanceira = ['ADMIN', 'GERENTE'].includes(String(userSession?.role || '').toUpperCase());

    // ---- Solicitação de Pagamento: criada (aguardando aprovação) ----
    const pagamentosCriados: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'solicitacao' && r.status === 'Aguardando aprovação')
      .filter((r: any) => isGerenciaFinanceira || matchesSolicitanteFin(r, userSession))
      .map((r: any) => ({
        id: `pagamento-novo-${r.id}`,
        titulo: `Novo pedido de pagamento — ${r.fornecedor || 'solicitação'} (${money(Number(r.valor) || 0)})`,
        data: r.createdAt || '',
        destino: isGerenciaFinanceira ? 'finAprovacoes' : 'meusPagamentos',
      }));

    // ---- Solicitação de Pagamento: aprovada/reprovada ----
    const pagamentos: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'solicitacao' && (r.status === 'Aprovado' || r.status === 'Reprovado'))
      .filter((r: any) => isGerenciaFinanceira || matchesSolicitanteFin(r, userSession))
      .map((r: any) => ({
        id: `pagamento-${r.id}-${r.status}`,
        titulo: r.status === 'Aprovado'
          ? `Pagamento aprovado — ${r.fornecedor || 'solicitação'} (${money(Number(r.valor) || 0)})`
          : `Pagamento reprovado — ${r.fornecedor || 'solicitação'}`,
        data: r.createdAt || '',
        destino: 'meusPagamentos',
      }));

    // ---- Compra concluída (item marcado como comprado/contratado no histórico) ----
    const comprasConcluidas: Notificacao[] = historicoCompras
      .filter((it: any) => matchesSolicitanteCompra(it, userSession))
      .map((it: any) => ({
        id: `compra-${it.id}`,
        titulo: `Compra concluída — ${it.itemDescricao || it.itemNome || 'item'}`,
        data: it.compradoEm || '',
        destino: 'minhasCompras',
      }));

    // ---- Compras: mudança de estágio do pedido no Kanban ----
    const comprasEstagios: Notificacao[] = listaCompras
      .filter((r: any) => matchesSolicitanteCompra(r, userSession) && !ESTAGIOS_COMPRA_SEM_NOTIFICAR.has(r?.stage))
      .map((r: any) => {
        const numero = r.pedidoCompraNumero ? `Pedido ${r.pedidoCompraNumero}` : 'Seu pedido de compra';
        const titulo = r.stage === 'RECUSADO'
          ? `${numero} recusado${r.motivoRecusa ? ` — ${r.motivoRecusa}` : ''}`
          : `${numero} — ${stageLabel[r.stage as BoardStage] || r.stage}`;
        return {
          id: `compra-stage-${r.id}-${r.stage}`,
          titulo,
          data: r.updatedAt || r.createdAt || '',
          destino: r.stage === 'RECUSADO' ? 'minhasCompras' : 'kanbanCompras',
        };
      });

    // ---- Financeiro: Conta a Pagar — identidade resolvida por junção indireta ----
    // (a) originada de uma Solicitação de Pagamento (`origemSolicitacao`); (b) originada de
    // uma Compra aprovada (`comprasHistorico[].contaPagarId`). Sem nenhum dos dois vínculos
    // (conta lançada direto, só com nome do fornecedor) não há destinatário identificável.
    const contasPagar: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'contaPagar' && r.status && !CP_STATUS_SEM_NOTIFICAR.has(r.status))
      .filter((r: any) => {
        if (isGerenciaFinanceira) return true;
        if (r.origemSolicitacao) {
          const solicitacao = listaFinanceiro.find(
            (s: any) => s?.tipo === 'solicitacao' && String(s.id) === String(r.origemSolicitacao),
          );
          if (solicitacao) return matchesSolicitanteFin(solicitacao, userSession);
        }
        const itemCompra = historicoCompras.find((it: any) => String(it.contaPagarId || '') === String(r.id));
        if (itemCompra) return matchesSolicitanteCompra(itemCompra, userSession);
        return false;
      })
      .map((r: any) => ({
        id: `contapagar-${r.id}-${r.status}`,
        titulo: `Conta a pagar — ${r.fornecedor || 'fornecedor'} agora ${r.status}`,
        data: r.vencimento || r.dataPagamento || '',
        destino: 'finPagar',
      }));

    // ---- Financeiro: parcela de fatura (Faturado) perto do vencimento ----
    // Cada parcela vira sua PRÓPRIA conta a pagar (filha), com o vencimento definido no
    // momento do faturamento (SolicitacaoView.tsx) — dentro da janela de aviso e ainda não
    // paga, avisa os DOIS: quem solicitou o pagamento (mesma identidade do bloco acima,
    // via `origemSolicitacao`) e a gerência financeira (ADMIN/GERENTE, vê todas — mesmo
    // critério de "quem aprova" usado em AprovacoesView.tsx). O id inclui os dias restantes
    // de propósito: ao contrário do resto do arquivo, aqui a notificação deve MESMO reaparecer
    // a cada dia que passa dentro da janela (é um lembrete de prazo, não um evento único).
    const parcelasFaturadoAVencer: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'contaPagar' && r.forma === 'Parcelado' && r.type === 'child' && r.status !== CP_STATUS.pago)
      .map((r: any) => ({ r, dias: diasAte(r.vencimento) }))
      .filter(({ dias }) => dias >= 0 && dias <= DIAS_AVISO_VENCIMENTO_FATURADO)
      .filter(({ r }) => {
        if (isGerenciaFinanceira) return true;
        if (!r.origemSolicitacao) return false;
        const solicitacao = listaFinanceiro.find(
          (s: any) => s?.tipo === 'solicitacao' && String(s.id) === String(r.origemSolicitacao),
        );
        return solicitacao ? matchesSolicitanteFin(solicitacao, userSession) : false;
      })
      .map(({ r, dias }) => ({
        id: `faturado-vencimento-${r.id}-${dias}`,
        titulo: `Parcela ${r.parcela || ''} da fatura vence ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`} (${br(r.vencimento)}) — ${r.fornecedor || 'fornecedor'} (${money(Number(r.valor) || 0)})`,
        data: r.vencimento || '',
        destino: 'finPagar',
      }));

    // ---- Financeiro: NFe emitida — identidade resolvida via OS vinculada ----
    const nfesEmitidasIds = new Set(
      listaFinanceiro.filter((r: any) => r?.tipo === 'nfe').map((r: any) => r.sourceId).filter(Boolean),
    );
    const nfesEmitidas: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'nfeReq' && nfesEmitidasIds.has(r.id))
      .filter((r: any) => isGerenciaFinanceira
        || matchesCriador(listaOs.find((o: any) => String(o?.id || '') === String(r.os || '')), userSession))
      .map((r: any) => ({
        id: `nfe-${r.id}-emitida`,
        titulo: `NFe emitida — OS ${r.os || '—'}`,
        data: r.dataEmitir || '',
        destino: 'finNfe',
      }));

    // ---- Financeiro: Recibo de Locação emitido — identidade resolvida via OS vinculada ----
    const recibosEmitidos: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'reciboLocacao' && r.status === 'emitido')
      .filter((r: any) => isGerenciaFinanceira || matchesCriador(
        listaOs.find((o: any) => String(o?.id || '') === String(r.ordemServicoNumero || '')),
        userSession,
      ))
      .map((r: any) => ({
        id: `recibo-${r.id}-emitido`,
        titulo: `Recibo de locação emitido — OS ${r.ordemServicoNumero || '—'}`,
        data: r.dataEmissao || '',
        destino: 'finNfe',
      }));

    // ---- Financeiro: Conta a Receber — gerada / recebida — identidade via OS vinculada ----
    // `recebido` é persistido no registro (ContasReceberView.tsx, ação "Registrar
    // recebimento") — serve de estágio direto, sem precisar do status derivado (que mistura
    // "vencido", baseado na data de hoje, e reabriria a notificação todo dia à toa).
    const contasReceber: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'contaReceber')
      .filter((r: any) => isGerenciaFinanceira || matchesCriador(
        listaOs.find((o: any) => String(o?.id || '') === String(r.ordemServicoNumero || '')),
        userSession,
      ))
      .map((r: any) => ({
        id: `receber-${r.id}-${r.recebido ? 'recebido' : 'pendente'}`,
        titulo: r.recebido
          ? `Recebimento confirmado — ${r.cliente || 'cliente'} (${money(Number(r.valorLiquido) || 0)})`
          : `Nova conta a receber — ${r.cliente || 'cliente'} (${money(Number(r.valorLiquido) || 0)})`,
        data: r.dataRecebimento || r.vencimentoRecebimento || r.createdAt || '',
        destino: 'finReceber',
      }));

    // ---- OS: mudança de status (statusOs/statusEnvio/statusAprovacao) — só quem criou ----
    const osNotificacoes: Notificacao[] = listaOs
      .filter((o: any) => matchesCriador(o, userSession))
      .flatMap((o: any) => OS_EIXOS
        .filter((eixo) => o[eixo.campo] && o[eixo.campo] !== eixo.inicial)
        .map((eixo) => ({
          id: `os-${eixo.campo}-${o.id}-${o[eixo.campo]}`,
          titulo: `OS ${o.ordemServicoNumero || o.id} — ${eixo.labels[o[eixo.campo]] || o[eixo.campo]}`,
          data: o.dataAprovacao || o.dataEmissao || '',
          destino: 'fazerOs',
        })));

    // ---- Negócios: mudança de categoria no kanban — só quem criou ----
    const negociosNotificacoes: Notificacao[] = listaObras
      .filter((n: any) => n.categoria && n.categoria !== 'Planejamento' && matchesCriador(n, userSession))
      .map((n: any) => ({
        id: `negocio-${n.id}-${n.categoria}`,
        titulo: `Negócio ${n.id} — ${n.categoria}`,
        data: n.dataSolicitacao || '',
        destino: 'crm',
      }));

    // ---- Almoxarifado: item alugado (de fornecedor) com devolução atrasada ----
    // Sem campo de pessoa (só `fornecedor`, um texto livre) — diferente de todos os blocos
    // acima, este NÃO filtra por identidade: qualquer usuário logado vê o alerta, porque não
    // há como saber "de quem" é esse item alugado dentro do próprio registro.
    const listaTabelasAlmoxarifado = Array.isArray(almoxerifado?.tables) ? almoxerifado.tables : [];
    const alugadosAtrasados: Notificacao[] = listaTabelasAlmoxarifado
      .filter((t: any) => TABELAS_ALUGADOS.has(t?.name))
      .flatMap((t: any) => (Array.isArray(t.rows) ? t.rows : [])
        .filter((r: any) => dataJaPassou(r?.values?.dataDevolucao))
        .map((r: any) => ({
          id: `almoxarifado-alugado-${r.id}-${r.values.dataDevolucao}`,
          titulo: `Devolução atrasada — ${r.values.equipamento || r.values.item || 'item alugado'}${r.values.fornecedor ? ` (${r.values.fornecedor})` : ''}`,
          data: r.values.dataDevolucao,
          destino: 'estoque',
        })));

    return [
      ...pagamentosCriados,
      ...pagamentos,
      ...comprasConcluidas,
      ...comprasEstagios,
      ...contasPagar,
      ...parcelasFaturadoAVencer,
      ...nfesEmitidas,
      ...recibosEmitidos,
      ...contasReceber,
      ...osNotificacoes,
      ...negociosNotificacoes,
      ...alugadosAtrasados,
    ].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [financeiro, comprasHistorico, compras, os, obras, almoxerifado, userSession]);

  const naoVistas = useMemo(
    () => notificacoes.filter((n) => !vistos.has(n.id)),
    [notificacoes, vistos],
  );

  // Abrir o painel = "visto": marca tudo que existe agora como lido (a contagem zera).
  const marcarTodasVistas = () => {
    const novoSet = new Set(notificacoes.map((n) => n.id));
    setVistos(novoSet);
    try { localStorage.setItem(chave, JSON.stringify(Array.from(novoSet))); } catch { /* sem storage disponível */ }
  };

  return { notificacoes, quantidadeNaoVista: naoVistas.length, marcarTodasVistas };
}
