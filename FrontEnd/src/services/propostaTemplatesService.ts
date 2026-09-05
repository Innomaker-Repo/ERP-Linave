import api from './api';

/**
 * Templates de texto da Proposta (tabela SQL `comercialapp_templateproposta`).
 *
 * O backend já expõe os campos em camelCase iguais aos do formulário da
 * PropostaView (textoAbertura, escopoC, condicoesPagamento, ...), então aqui só
 * garantimos o shape e o fallback de lista paginada — sem tradução de nomes.
 *
 * De propósito o template NÃO tem preço nem escopo: preço vem do orçamento e
 * escopo é levantado a bordo, logo são sempre específicos do negócio.
 */

export const CAMPOS_TEMPLATE_PROPOSTA = [
  'referencia',
  'saudacao',
  'assunto',
  'textoAbertura',
  'responsabilidadeContratada',
  'escopoC',
  'condicoesGerais',
  'prazo',
  'efetivoPrevisto',
  'condicoesPagamento',
  'encerramento',
] as const;

export type CampoTemplateProposta = typeof CAMPOS_TEMPLATE_PROPOSTA[number];

// Rótulos exibidos nos formulários (Fazer Proposta e a tela de gerenciamento de templates).
// Preço e escopo ficam DE FORA de propósito: preço vem do orçamento e escopo é levantado
// a bordo, então são sempre específicos de cada negócio, nunca de um template reutilizável.
export const ROTULOS_CAMPO_TEMPLATE: Record<CampoTemplateProposta, string> = {
  referencia: 'Referência',
  saudacao: 'Saudação',
  assunto: 'Assunto',
  textoAbertura: 'Texto de Abertura',
  responsabilidadeContratada: 'B - Resp. da Contratada',
  escopoC: 'C - Resp. da Contratante',
  condicoesGerais: 'E - Condições Gerais',
  prazo: 'F - Prazo',
  efetivoPrevisto: 'G - Efetivo Previsto',
  condicoesPagamento: 'H - Cond. de Pagamento',
  encerramento: 'Encerramento',
};

export interface PropostaTemplate {
  id: number | string;
  nome: string;
  criadoPor?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  campos: Partial<Record<CampoTemplateProposta, string>>;
}

const mapFromApi = (t: any): PropostaTemplate => {
  const campos: Partial<Record<CampoTemplateProposta, string>> = {};
  CAMPOS_TEMPLATE_PROPOSTA.forEach((campo) => {
    const valor = String(t?.[campo] ?? '');
    if (valor.trim()) campos[campo] = valor;
  });
  return {
    id: t?.id,
    nome: t?.nome || '',
    criadoPor: t?.criadoPor || '',
    criadoEm: t?.criadoEm || '',
    atualizadoEm: t?.atualizadoEm || '',
    campos,
  };
};

const mapToApi = (nome: string, campos: Partial<Record<CampoTemplateProposta, string>>, criadoPor?: string) => {
  const payload: Record<string, string> = { nome };
  CAMPOS_TEMPLATE_PROPOSTA.forEach((campo) => { payload[campo] = String(campos?.[campo] ?? ''); });
  if (criadoPor) payload.criadoPor = criadoPor;
  return payload;
};

export const getPropostaTemplates = async (): Promise<PropostaTemplate[]> => {
  try {
    const response = await api.get('templates-proposta/');
    const items = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.results)
        ? response.data.results
        : [];
    return items.map(mapFromApi);
  } catch (error) {
    console.error('Erro ao buscar templates de proposta:', error);
    return [];
  }
};

export const createPropostaTemplate = async (
  nome: string,
  campos: Partial<Record<CampoTemplateProposta, string>>,
  criadoPor?: string,
): Promise<PropostaTemplate> => {
  const response = await api.post('templates-proposta/', mapToApi(nome, campos, criadoPor));
  return mapFromApi(response.data);
};

export const updatePropostaTemplate = async (
  id: number | string,
  nome: string,
  campos: Partial<Record<CampoTemplateProposta, string>>,
  criadoPor?: string,
): Promise<PropostaTemplate> => {
  const response = await api.put(`templates-proposta/${id}/`, mapToApi(nome, campos, criadoPor));
  return mapFromApi(response.data);
};

export const deletePropostaTemplate = async (id: number | string): Promise<void> => {
  await api.delete(`templates-proposta/${id}/`);
};
