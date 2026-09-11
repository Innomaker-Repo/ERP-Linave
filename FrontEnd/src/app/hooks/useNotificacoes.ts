import { useEffect, useMemo, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { matchesSolicitante as matchesSolicitanteFin, money, CP_STATUS } from '../components/modules/Financeiro/finData';
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
 * resolvida por junção indireta (ver blocos correspondentes). Conta a Receber fica fora do
 * escopo: não tem status persistido nem campo de pessoa. OS e Negócio têm `criadoPorCpf`/
 * `criadoPorEmail` (gravados automaticamente na criação, ver OsView.tsx/CrmViewNew.tsx) —
 * registros criados antes desse campo existir ficam sem identidade e não notificam.
 *
 * Exceção ao filtro por identidade: o alerta de "devolução atrasada" do Almoxarifado
 * (item alugado de fornecedor) não tem NENHUM campo de pessoa (só `fornecedor`, texto
 * livre) — esse bloco notifica todo mundo logado, não só quem "é dono" do registro.
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

    // ---- Solicitação de Pagamento aprovada/reprovada ----
    const pagamentos: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'solicitacao'
        && (r.status === 'Aprovado' || r.status === 'Reprovado')
        && matchesSolicitanteFin(r, userSession))
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

    // ---- Financeiro: NFe emitida — identidade resolvida via OS vinculada ----
    const nfesEmitidasIds = new Set(
      listaFinanceiro.filter((r: any) => r?.tipo === 'nfe').map((r: any) => r.sourceId).filter(Boolean),
    );
    const nfesEmitidas: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'nfeReq' && nfesEmitidasIds.has(r.id))
      .filter((r: any) => matchesCriador(listaOs.find((o: any) => String(o?.id || '') === String(r.os || '')), userSession))
      .map((r: any) => ({
        id: `nfe-${r.id}-emitida`,
        titulo: `NFe emitida — OS ${r.os || '—'}`,
        data: r.dataEmitir || '',
        destino: 'finNfe',
      }));

    // ---- Financeiro: Recibo de Locação emitido — identidade resolvida via OS vinculada ----
    const recibosEmitidos: Notificacao[] = listaFinanceiro
      .filter((r: any) => r?.tipo === 'reciboLocacao' && r.status === 'emitido')
      .filter((r: any) => matchesCriador(
        listaOs.find((o: any) => String(o?.id || '') === String(r.ordemServicoNumero || '')),
        userSession,
      ))
      .map((r: any) => ({
        id: `recibo-${r.id}-emitido`,
        titulo: `Recibo de locação emitido — OS ${r.ordemServicoNumero || '—'}`,
        data: r.dataEmissao || '',
        destino: 'finNfe',
      }));

    // Conta a Receber fica fora do escopo: `status` é derivado na tela (não persistido no
    // registro) e não existe nenhum campo de pessoa pra identificar quem notificar.

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
      ...pagamentos,
      ...comprasConcluidas,
      ...comprasEstagios,
      ...contasPagar,
      ...nfesEmitidas,
      ...recibosEmitidos,
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
