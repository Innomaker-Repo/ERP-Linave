import api from './api';

export type OrdemServicoResumo = {
  id: string;
  ordemServicoNumero: string;
  numeroOs: string;
  cliente: string;
  projeto: string;
  cc: string;
  statusOs: string;
  statusEnvio: string;
  statusAprovacao: string;
  fechada: boolean;
};

// OS fechada (bloqueada pela diretoria após as medições): some de TODAS as listas de uso
// (estoque/compras/alocação/produção). Aceita variações de origem (backend snake / contexto camel).
export const isOsFechada = (os: any) => Boolean(os?.fechada ?? os?.fechado ?? os?.os_fechada);

export const isOsAlvo = (os: any) => {
  if (isOsFechada(os)) return false;
  // Accept multiple naming variants from different sources (backend vs local context)
  const statusEnvio = String(os?.status_envio ?? os?.statusEnvio ?? '').toLowerCase();
  const statusOs = String(os?.status_os ?? os?.statusOs ?? os?.statusOs ?? '').toLowerCase();
  // Eligible when it was sent to production and not finalized
  const sentToProduction = statusEnvio === 'enviada' || statusEnvio === 'enviado' || statusEnvio === 'enviada para producao';
  const isFinalized = statusOs === 'concluida' || statusOs === 'concluído' || statusOs === 'concluido';
  return sentToProduction && !isFinalized;
};

// Mesma regra usada na aba de Produção (ObrasView): a OS só "vale" depois de
// APROVADA (ou se já estiver concluída). Usada para liberar a OS na alocação/baixa
// do estoque/almoxarifado e no centro de custo das requisições de compra.
// OS fechada NUNCA vale (mesmo concluída) — o bloqueio é definitivo.
export const isOsAprovada = (os: any) => {
  if (isOsFechada(os)) return false;
  const statusAprovacao = String(os?.status_aprovacao ?? os?.statusAprovacao ?? '').toLowerCase();
  const statusOs = String(os?.status_os ?? os?.statusOs ?? '').toLowerCase();
  const isFinalized = statusOs === 'concluida' || statusOs === 'concluído' || statusOs === 'concluido';
  return statusAprovacao === 'aprovada' || isFinalized;
};

// OS FINALIZADA = terminou o ciclo e não aceita mais movimento (compra/estoque/alocação):
// `fechada` (bloqueio definitivo feito na tela de Medições) ou status "concluída".
// Ter medição feita NÃO finaliza a OS — só fechar/concluir finaliza.
export const isOsFinalizada = (os: any) => {
  if (isOsFechada(os)) return true;
  const statusOs = String(os?.status_os ?? os?.statusOs ?? '').toLowerCase();
  return statusOs === 'concluida' || statusOs === 'concluído' || statusOs === 'concluido';
};

// OS que aceita NOVA COMPRA: aprovada e ainda não finalizada. Diferente de `isOsAprovada`,
// que devolve true para OS concluída (lá "concluída" conta como aprovada) — em compras uma
// OS concluída/fechada tem que ficar de fora.
export const podeComprarNaOs = (os: any) => {
  if (isOsFinalizada(os)) return false;
  const statusAprovacao = String(os?.status_aprovacao ?? os?.statusAprovacao ?? '').toLowerCase();
  return statusAprovacao === 'aprovada';
};

export const getOsStableValue = (os: any) => String(
  os?.ordemServicoNumero ??
  os?.ordem_servico_numero ??
  os?.numero_os ??
  os?.numeroOs ??
  os?.cc ??
  ''
).trim();

// ---- Identidade visual da OS em TODO o ERP ------------------------------------------------
// Regra única: a OS é sempre exibida como "<número> — <embarcação>". Só o número não diz de
// qual barco se trata; só a embarcação não identifica a OS (o mesmo barco tem várias OS ao
// longo do tempo). Antes cada tela escolhia um dos dois, o que gerava confusão.

export const getOsNumero = (os: any) => String(
  os?.ordemServicoNumero ?? os?.ordem_servico_numero ?? os?.numero_os ?? os?.numeroOs ?? os?.id ?? ''
).trim();

// Liga a OS à obra/negócio. Prioriza `negocioBackendId` (id numérico do SQL, estável) sobre
// `obraId` — este último é um id FORMATADO ("LN-0004/26") que depende do prefixo da empresa e
// do ano corrente, e por isso falha quando as duas pontas derivam de fontes diferentes.
export const findObraDaOs = (os: any, obras: any): any =>
  (Array.isArray(obras) ? obras : []).find((b: any) =>
    (os?.negocioBackendId != null && b?.negocioBackendId != null
      && String(b.negocioBackendId) === String(os.negocioBackendId))
    || (os?.obraId && String(b?.id) === String(os.obraId)),
  ) || null;

// Embarcação da OS: vem dos serviços do negócio; cai no equipamento da própria OS.
export const getEmbarcacaoDaOs = (os: any, obras: any = []) => {
  const obra = findObraDaOs(os, obras);
  const daObra = (Array.isArray(obra?.servicos) ? obra.servicos : [])
    .map((s: any) => s?.embarcacao || s?.embarcacaoNome)
    .find(Boolean);
  return String(daObra || os?.equipamento || os?.embarcacao || '').trim();
};

// Rótulo canônico de OS para dropdowns, cards e cabeçalhos.
export const formatOsLabel = (os: any, obras: any = []) => {
  const numero = getOsNumero(os) || 'OS';
  const embarcacao = getEmbarcacaoDaOs(os, obras);
  return embarcacao ? `${numero} — ${embarcacao}` : numero;
};

const normalizeOs = (item: any): OrdemServicoResumo => ({
  id: String(item?.id ?? ''),
  ordemServicoNumero: String(item?.ordemServicoNumero ?? item?.ordem_servico_numero ?? item?.numero_os ?? item?.numeroOs ?? item?.cc ?? item?.id ?? ''),
  numeroOs: String(item?.numero_os ?? item?.numeroOs ?? item?.id ?? ''),
  cliente: String(item?.cliente_detalhes?.razao_social ?? item?.cliente_detalhes?.razaoSocial ?? item?.cliente ?? ''),
  projeto: String(item?.projeto ?? ''),
  cc: String(item?.cc ?? ''),
  statusOs: String(item?.status_os ?? item?.statusOs ?? 'rascunho'),
  statusEnvio: String(item?.status_envio ?? item?.statusEnvio ?? 'pendente'),
  statusAprovacao: String(item?.status_aprovacao ?? item?.statusAprovacao ?? 'pendente'),
  fechada: Boolean(item?.fechada ?? item?.fechado)
});

export const getOsOptionLabel = (os: OrdemServicoResumo) => {
  return String(os.ordemServicoNumero || os.cc || os.numeroOs || os.id || '').trim();
};

export const getOsOptionValue = (os: OrdemServicoResumo) => String(os.ordemServicoNumero || os.cc || os.numeroOs || os.id || '').trim();

export async function getOrdensServico(): Promise<OrdemServicoResumo[]> {
  const response = await api.get('ordens-servico/');
  const items = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.results)
      ? response.data.results
      : [];

  return items.map(normalizeOs).filter(isOsAlvo);
}