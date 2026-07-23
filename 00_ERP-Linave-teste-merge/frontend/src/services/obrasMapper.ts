/**
 * Mapeia um Negócio do backend (SQL, snake_case) para o shape "obra" que o frontend
 * consome em todas as abas (Produção, Orçamentos, Proposta, Financeiro/useFin, Dashboard).
 *
 * É a MESMA projeção que a CrmViewNew já fazia ao espelhar no blob — agora centralizada
 * para o ErpContext hidratar `ctx.obras` direto do SQL, sem blob. As coleções aninhadas
 * (`servicos`, `orcamentos`, `propostas`) já vêm do SQL via NegocioSerializer.
 */

import { mapDocsApiToFront } from './documentosService';

const prefixoEmpresa = (empresa?: string) =>
  String(empresa || '').toLowerCase().includes('servinave') ? 'VTS' : 'LN';

export const formatNegocioId = (negocio: any): string => {
  const prefixo = prefixoEmpresa(negocio?.empresa_prestadora ?? negocio?.empresaPrestadora);
  const numero = String(negocio?.id ?? '').padStart(4, '0');
  const ano = String(new Date().getFullYear()).slice(-2);
  return `${prefixo}-${numero}/${ano}`;
};

export const mapNegocioToObra = (n: any, clientesMapa: Record<string, string> = {}) => {
  const idFormatado = formatNegocioId(n);
  const idClienteStr = String(n?.cliente ?? '');
  // Documentos persistidos no SQL (tabela Documento) vêm aninhados em `n.documentos`.
  // Separamos o documento assinado pelo cliente (categoria própria) dos demais anexos.
  const docsApi = Array.isArray(n?.documentos) ? n.documentos : (Array.isArray(n?.arquivos) ? n.arquivos : []);
  const docsFront = mapDocsApiToFront(docsApi);
  const documentoClienteAssinado = docsFront.find((d) => d.categoria === 'cliente_assinado') || null;
  const documentosNegocio = docsFront.filter((d) => d.categoria !== 'cliente_assinado');
  return {
    id: idFormatado,
    nome: n?.nome_negocio,
    clienteId: n?.cliente,
    nomeClienteResolvido:
      clientesMapa[idClienteStr] || n?.cliente_nome || n?.nome_cliente ||
      n?.cliente_detalhes?.razao_social || 'Cliente Identificado',
    empresaPrestadora: n?.empresa_prestadora || 'Linave',
    categoria: n?.categoria || 'Planejamento',
    status: n?.status || 'Aguardando orçamento',
    requerReorcamento: n?.requer_reorcamento ?? true,
    orcamentoRealizado: n?.orcamento_realizado ?? false,
    solicitante: n?.solicitante,
    dataSolicitacao: n?.data_solicitacao || n?.created_at || '',
    tipo: n?.tipo_servico || n?.servicos?.[0]?.tipo_servico || '',
    responsavelTecnico: n?.solicitante || '',
    servicos: Array.isArray(n?.servicos) ? n.servicos : [],
    modalidade: n?.modalidade || 'servico',
    itensAlocacao: Array.isArray(n?.itens_alocacao)
      ? n.itens_alocacao.map((it: any) => ({
          id: String(it?.id ?? ''),
          equipamento: it?.equipamento || '',
          estoqueRef: it?.estoque_ref || '',
          unidade: it?.unidade || 'un',
          quantidade: Number(it?.quantidade) || 0,
          observacao: it?.observacao || '',
          valorIndenizacao: Number(it?.valor_indenizacao) || 0,
          valorLocacao: Number(it?.valor_locacao) || 0,
          margem: Number(it?.margem) || 0,
          oh: Number(it?.oh) || 0,
          valorTotal: Number(it?.valor_total) || 0,
        }))
      : [],
    negocioBackendId: n?.id,
    orcamentos: Array.isArray(n?.orcamentos) ? n.orcamentos : [],
    propostas: Array.isArray(n?.propostas) ? n.propostas : [],
    documentosNegocio,
    documentoClienteAssinado,
    usoInterno: Boolean(n?.uso_interno),
    os: [],
  };
};

export const mapNegociosToObras = (negocios: any[], clientesMapa: Record<string, string> = {}) =>
  (Array.isArray(negocios) ? negocios : []).map((n) => mapNegocioToObra(n, clientesMapa));

/**
 * Mapeia uma Ordem de Serviço do backend (SQL, snake_case) para o shape que a OSView /
 * CRM consomem. Pontos-chave:
 *  - `id` = `numero_os` (ex.: "LN-0001/26"), que é o id canônico usado no frontend;
 *  - `backendId` = id numérico do SQL, usado para DELETE e atualizar-status;
 *  - `obraId` = id formatado do negócio (liga a OS à obra correspondente).
 */
export const mapOrdemToOs = (o: any) => {
  const numero = String(o?.numero_os ?? o?.numeroOs ?? o?.id ?? '').trim();
  const negocioId = o?.negocio ?? o?.negocio_detalhes?.id;
  // Assinatura/aprovação da OS: persistida na tabela Documento (categoria 'os_assinatura').
  const docsOs = mapDocsApiToFront(Array.isArray(o?.documentos) ? o.documentos : []);
  const assinatura = docsOs.find((d) => d.categoria === 'os_assinatura') || null;
  const obraId = negocioId != null
    ? formatNegocioId({ id: negocioId, empresa_prestadora: o?.negocio_detalhes?.empresa_prestadora })
    : '';
  return {
    id: numero,
    backendId: o?.id,
    ordemServicoNumero: numero,
    obraId,
    negocioBackendId: negocioId ?? null,
    clienteId: String(o?.cliente ?? ''),
    cliente: o?.cliente_detalhes?.razao_social ?? o?.cliente_detalhes?.razaoSocial ?? '',
    projeto: o?.projeto ?? '',
    equipamento: o?.equipamento ?? '',
    local: o?.local ?? '',
    dataEmissao: o?.data_emissao ?? '',
    cc: o?.cc ?? '',
    dataInicioPrevisto: o?.data_inicio_previsto ?? '',
    dataTerminoPrevisto: o?.data_termino_previsto ?? '',
    supervisorEncarregado: o?.supervisor_encarregado ?? '',
    descricaoGeralServico: o?.descricao_geral_servico ?? '',
    aSerIncluido: (o?.a_ser_incluido && typeof o.a_ser_incluido === 'object') ? o.a_ser_incluido : {},
    maoObra: (o?.mao_obra && typeof o.mao_obra === 'object') ? o.mao_obra : {},
    horasTrabalhadasPorServico: Array.isArray(o?.horas_trabalhadas_servico) ? o.horas_trabalhadas_servico : [],
    statusOs: o?.status_os ?? 'emproducao',
    statusEnvio: o?.status_envio ?? 'pendente',
    statusAprovacao: o?.status_aprovacao ?? 'pendente',
    fechada: Boolean(o?.fechada),
    dataFechamento: o?.data_fechamento ?? undefined,
    dataAprovacao: o?.data_aprovacao ?? undefined,
    documentoAssinaturaAprovacao: assinatura,
    tipoDocumento: 'consolidada' as const,
    usoInterno: Boolean(o?.negocio_detalhes?.uso_interno),
  };
};

export const mapOrdensToOs = (ordens: any) => {
  const arr = Array.isArray(ordens)
    ? ordens
    : (Array.isArray(ordens?.results) ? ordens.results : []);
  return arr.map(mapOrdemToOs);
};
