// Modalidade do negócio comercial: governa Serviço x Locação (aluguel de equipamentos)
// ao longo de todo o funil (CRM, Orçamento, Proposta, OS, Medição).
// 'servico' é o comportamento legado (negócios antigos sem o campo são tratados como serviço).

export type Modalidade = 'servico' | 'locacao' | 'locacao_servico';

export const MODALIDADES: { value: Modalidade; label: string }[] = [
  { value: 'servico', label: 'Serviço' },
  { value: 'locacao', label: 'Locação' },
  { value: 'locacao_servico', label: 'Locação + Serviço' },
];

export const modalidadeLabel = (m?: string): string =>
  MODALIDADES.find((x) => x.value === m)?.label || 'Serviço';

/** A modalidade contempla prestação de serviço? (serviço puro ou locação+serviço, e legado vazio) */
export const temServico = (m?: string): boolean =>
  m === 'servico' || m === 'locacao_servico' || !m;

/** A modalidade contempla locação de equipamentos? */
export const temLocacao = (m?: string): boolean =>
  m === 'locacao' || m === 'locacao_servico';
