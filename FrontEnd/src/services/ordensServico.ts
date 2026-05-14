import api from './api';

export type OrdemServicoResumo = {
  id: string;
  numeroOs: string;
  cliente: string;
  projeto: string;
  cc: string;
  statusOs: string;
  statusEnvio: string;
  statusAprovacao: string;
};

const isOsAlvo = (os: OrdemServicoResumo) => {
  return os.statusEnvio === 'enviada' || os.statusOs === 'emproducao' || os.statusAprovacao === 'aprovada';
};

const normalizeOs = (item: any): OrdemServicoResumo => ({
  id: String(item?.id ?? ''),
  numeroOs: String(item?.numero_os ?? item?.numeroOs ?? item?.id ?? ''),
  cliente: String(item?.cliente_detalhes?.razao_social ?? item?.cliente_detalhes?.razaoSocial ?? item?.cliente ?? ''),
  projeto: String(item?.projeto ?? ''),
  cc: String(item?.cc ?? ''),
  statusOs: String(item?.status_os ?? item?.statusOs ?? 'rascunho'),
  statusEnvio: String(item?.status_envio ?? item?.statusEnvio ?? 'pendente'),
  statusAprovacao: String(item?.status_aprovacao ?? item?.statusAprovacao ?? 'pendente')
});

export const getOsOptionLabel = (os: OrdemServicoResumo) => {
  const parts = [os.numeroOs];
  if (os.cc) parts.push(`CC ${os.cc}`);
  if (os.projeto) parts.push(os.projeto);
  return parts.join(' - ');
};

export const getOsOptionValue = (os: OrdemServicoResumo) => os.numeroOs || os.id;

export async function getOrdensServico(): Promise<OrdemServicoResumo[]> {
  const response = await api.get('ordens-servico/');
  const items = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.results)
      ? response.data.results
      : [];

  return items.map(normalizeOs).filter(isOsAlvo);
}