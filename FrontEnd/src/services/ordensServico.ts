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
};

export const isOsAlvo = (os: any) => {
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
export const isOsAprovada = (os: any) => {
  const statusAprovacao = String(os?.status_aprovacao ?? os?.statusAprovacao ?? '').toLowerCase();
  const statusOs = String(os?.status_os ?? os?.statusOs ?? '').toLowerCase();
  const isFinalized = statusOs === 'concluida' || statusOs === 'concluído' || statusOs === 'concluido';
  return statusAprovacao === 'aprovada' || isFinalized;
};

export const getOsStableValue = (os: any) => String(
  os?.ordemServicoNumero ??
  os?.ordem_servico_numero ??
  os?.numero_os ??
  os?.numeroOs ??
  os?.cc ??
  ''
).trim();

const normalizeOs = (item: any): OrdemServicoResumo => ({
  id: String(item?.id ?? ''),
  ordemServicoNumero: String(item?.ordemServicoNumero ?? item?.ordem_servico_numero ?? item?.numero_os ?? item?.numeroOs ?? item?.cc ?? item?.id ?? ''),
  numeroOs: String(item?.numero_os ?? item?.numeroOs ?? item?.id ?? ''),
  cliente: String(item?.cliente_detalhes?.razao_social ?? item?.cliente_detalhes?.razaoSocial ?? item?.cliente ?? ''),
  projeto: String(item?.projeto ?? ''),
  cc: String(item?.cc ?? ''),
  statusOs: String(item?.status_os ?? item?.statusOs ?? 'rascunho'),
  statusEnvio: String(item?.status_envio ?? item?.statusEnvio ?? 'pendente'),
  statusAprovacao: String(item?.status_aprovacao ?? item?.statusAprovacao ?? 'pendente')
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