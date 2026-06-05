/* =========================================================================================
 * FINANCEIRO — Dados, tipos e helpers compartilhados
 * Esqueleto do "Super App Financeiro" portado para o ERP. Mock em memória (sem backend).
 * Cada aba/seção tem seu próprio componente em ./views, consumindo estes tipos/seed.
 * =======================================================================================*/

// ---------- Helpers de formatação / data ----------
export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v: number | string) => brl.format(num(v));
export const todayStr = new Date().toISOString().slice(0, 10);

export const num = (v: any) => Number(String(v ?? 0).replace(',', '.')) || 0;

export const days = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export const d0 = (d: any) => {
  if (!d) return null;
  const x = new Date(d + 'T00:00:00');
  x.setHours(0, 0, 0, 0);
  return x;
};

export const isOld = (d: any) => {
  const x = d0(d);
  if (!x) return false;
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return x < n;
};

// Data no formato dd/mm/aaaa.
export const br = (d: any) => {
  if (!d) return '-';
  const [y, m, da] = String(d).slice(0, 10).split('-');
  return da && m && y ? `${da}/${m}/${y}` : '-';
};

export const tax = (v: any, p: any) => num(v) * (num(p) / 100);

// ---------- Tipos ----------
export type Empresa = 'Linave' | 'Servinave' | 'Ambas';

export interface OS {
  numero: string;
  empresa: Empresa;
  cliente: string;
  descricao: string;
  valor: number;
  dataTermino: string;
  status: string;
}

export interface Departamento {
  nome: string;
  empresa: Empresa;
  email: string;
}

export interface Banco {
  nome: string;
  empresa: Empresa;
  tipo: string;
  pix: string;
}

export interface Solicitacao {
  id: string;
  empresa: Empresa;
  solicitante: string;
  tipo: string;
  vinculoTipo: 'OS' | 'Departamento';
  vinculoValor: string;
  fornecedor: string;
  documento: string;
  valor: number;
  compra: string;
  vencimento: string;
  forma: string;
  status: string;
  descricao: string;
  anexos: string[];
}

export interface ContaPagar {
  id: string;
  type: 'single' | 'parent' | 'child';
  parentId: string | null;
  parcela: string;
  totalParcelas: number;
  empresa: Empresa;
  vinculoTipo: 'OS' | 'Departamento';
  vinculoValor: string;
  fornecedor: string;
  tipo: string;
  documento: string;
  valor: number;
  vencimento: string;
  banco: string;
  forma: string;
  status: string;
  anexos: string[];
  comprovantes: string[];
  valorPago: number;
  dataPagamento: string;
  jurosPago: number;
}

export interface NfeReq {
  id: string;
  os: string;
  empresa: Empresa;
  cliente: string;
  valor: number;
  forma: string;
  dataEmitir: string;
  tipoNfe: string;
  status: string;
  anexos: string[];
}

export interface ContaReceber {
  id: string;
  origem: string;
  empresa: Empresa;
  cliente: string;
  referencia: string;
  valorOriginal: number;
  valorLiquido: number;
  vencimentoRecebimento: string;
  recebido: boolean;
  dataRecebimento: string;
  valorRecebido: number;
  bancoRecebimento: string;
}

export interface EstudoLocacao {
  id: string;
  empresa: Empresa;
  tipo: string;
  unidade: string;
  vinculaOS: string;
  cobranca: string;
}

export interface HistItem {
  title: string;
  detail: string;
  user: string;
  date: string;
}

// ---------- Dados iniciais (mock / seed) ----------
export const SEED_OS: OS[] = [
  { numero: 'OS-2408', empresa: 'Linave', cliente: 'CONSTELLATION S/A', descricao: 'Serviço de locação operacional', valor: 28500, dataTermino: days(todayStr, 20), status: 'Em andamento' },
  { numero: 'OS-2410', empresa: 'Servinave', cliente: 'SOLSTAD OFFSHORE', descricao: 'Serviço offshore', valor: 43603.75, dataTermino: days(todayStr, 35), status: 'Aberta' },
  { numero: 'OS-2413', empresa: 'Linave', cliente: 'ESTALEIRO MAUÁ', descricao: 'Serviço técnico', valor: 5830, dataTermino: days(todayStr, -5), status: 'Aberta' },
];

export const SEED_DEPTS: Departamento[] = [
  { nome: 'Comercial', empresa: 'Ambas', email: 'comercial@linave.com' },
  { nome: 'Financeiro', empresa: 'Ambas', email: 'financeiro@linave.com' },
  { nome: 'Produção', empresa: 'Linave', email: 'producao@linave.com' },
  { nome: 'Compras', empresa: 'Ambas', email: 'compras@linave.com' },
];

export const SEED_BANKS: Banco[] = [
  { nome: 'Banco Linave Principal', empresa: 'Linave', tipo: 'Conta corrente', pix: 'financeiro@linave.com' },
  { nome: 'Banco Servinave Principal', empresa: 'Servinave', tipo: 'Conta corrente', pix: 'financeiro@servinave.com' },
  { nome: 'Caixa Operacional', empresa: 'Ambas', tipo: 'Caixa interno', pix: '-' },
];

export const SEED_REQS: Solicitacao[] = [
  { id: 'SP-0001', empresa: 'Linave', solicitante: 'Mariana', tipo: 'Abastecimento', vinculoTipo: 'OS', vinculoValor: 'OS-2408', fornecedor: 'Posto Exemplo', documento: 'Cupom 1088', valor: 680, compra: todayStr, vencimento: todayStr, forma: 'PIX à vista', status: 'Aguardando aprovação', descricao: 'Abastecimento da OS.', anexos: ['cupom_1088.jpg'] },
];

export const SEED_PAYABLES: ContaPagar[] = [
  { id: 'CP-0001', type: 'single', parentId: null, parcela: '-', totalParcelas: 1, empresa: 'Linave', vinculoTipo: 'OS', vinculoValor: 'OS-2408', fornecedor: 'Fornecedor Alfa', tipo: 'Material', documento: 'NF 203', valor: 1200, vencimento: todayStr, banco: 'Banco Linave Principal', forma: 'Boleto', status: 'Aberto', anexos: ['nf_203.pdf'], comprovantes: [], valorPago: 0, dataPagamento: '', jurosPago: 0 },
];

export const SEED_NFE_REQS: NfeReq[] = [
  { id: 'SNF-0001', os: 'OS-2408', empresa: 'Linave', cliente: 'CONSTELLATION S/A', valor: 28500, forma: 'Boleto 30 dias após emissão', dataEmitir: todayStr, tipoNfe: 'NFe Serviço', status: 'Aguardando emissão', anexos: ['medicao_OS-2408.pdf'] },
];

export const SEED_RECEIVABLES: ContaReceber[] = [
  { id: 'CR-0001', origem: 'Manual', empresa: 'Linave', cliente: 'CONSTELLATION S/A', referencia: 'Rec.Loc. 001/26', valorOriginal: 2604, valorLiquido: 2604, vencimentoRecebimento: days(todayStr, -3), recebido: false, dataRecebimento: '', valorRecebido: 0, bancoRecebimento: 'Banco Linave Principal' },
];

export const SEED_HIST: HistItem[] = [
  { title: 'Sistema consolidado', detail: 'Estrutura modular com OS, pagamento, NFe, recebíveis, locação e previsão.', user: 'Sistema', date: 'Agora' },
  { title: 'NFe SNF-0001 criada', detail: 'Solicitação de NFe gerada a partir da OS-2408.', user: 'Financeiro', date: 'Hoje' },
  { title: 'Conta a Pagar CP-0001', detail: 'Lançamento de NF 203 — Fornecedor Alfa.', user: 'Financeiro', date: 'Hoje' },
];

// ---------- Navegação interna do módulo ----------
export interface FinNavItem { id: string; label: string }
export interface FinNavGroup { group: string; items: FinNavItem[] }

export const FIN_NAV: FinNavGroup[] = [
  {
    group: 'Operação',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'os', label: 'OS Emitidas' },
      { id: 'solicitacao', label: 'Solicitação de Pagamento' },
      { id: 'aprovacoes', label: 'Aprovações' },
      { id: 'pagar', label: 'Contas a Pagar' },
      { id: 'nfe', label: 'NFe' },
      { id: 'receber', label: 'Contas a Receber' },
      { id: 'locacao', label: 'Locação' },
      { id: 'previsao', label: 'Previsão de Receita' },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { id: 'bancos', label: 'Bancos' },
      { id: 'departamentos', label: 'Departamentos' },
      { id: 'historico', label: 'Histórico' },
    ],
  },
];

export const FIN_TITLES: Record<string, [string, string]> = {
  dashboard: ['Dashboard Financeiro', 'Visão consolidada, com filtros por empresa, banco e período.'],
  os: ['OS Emitidas', 'Base para previsão, NFe, locação e solicitações.'],
  solicitacao: ['Solicitação de Pagamento', 'Sem cotação, sem banco; vínculo por OS ou departamento.'],
  aprovacoes: ['Aprovações', 'Solicitações que podem virar Contas a Pagar.'],
  pagar: ['Contas a Pagar', 'Adicionar, editar, parcelar, pagar, registrar juros e comprovante.'],
  nfe: ['Solicitações e Emissão de NFe', 'Medição aprovada cria solicitação; emissão abre cálculos e cria recebível.'],
  receber: ['Contas a Receber', 'Recebíveis por NFe, locação ou lançamento manual.'],
  locacao: ['Locação · Módulo em estudo', 'Levantamento de regras antes de gerar cobranças.'],
  previsao: ['Previsão de Receita', 'Baseada nos serviços/OS abertas.'],
  bancos: ['Bancos', 'Cadastro e filtro financeiro por banco.'],
  departamentos: ['Departamentos', 'Vínculo e aprovação por área.'],
  historico: ['Histórico', 'Rastreamento das ações.'],
};

// Status de recebível derivado.
export const recStatus = (r: ContaReceber) =>
  r.recebido ? 'Recebido' : isOld(r.vencimentoRecebimento) ? 'Vencido' : 'A receber';

// ---------- Adaptação de dados reais do ERP ----------
// O centro de custo / cc das OS usa prefixo LN (Linave) ou SN (Servinave).
export const empresaFromCC = (cc?: string, fallback: Empresa = 'Linave'): Empresa => {
  const s = String(cc || '').trim().toUpperCase();
  if (s.startsWith('SN')) return 'Servinave';
  if (s.startsWith('LN')) return 'Linave';
  return fallback;
};

// Deriva o valor monetário de uma OS. A OS consolidada NÃO guarda os valores do
// orçamento (são extraídos "sem valores"); o valor real fica no negócio/obra vinculado.
// Mesma precedência usada na tela de Finalizados (Comercial): precoFinal do último
// orçamento → valorTotalServico → orcamentoValores → orcamento.
const orcamentoValor = (entidade: any): number => {
  const orcamentos = Array.isArray(entidade?.orcamentos) ? entidade.orcamentos : [];
  const ultimo = orcamentos.length ? orcamentos[orcamentos.length - 1] : null;
  return num(
    ultimo?.valores?.precoFinal ??
    ultimo?.valores?.valorTotalServico ??
    entidade?.orcamentoValores?.precoFinal ??
    entidade?.orcamentoValores?.valorTotalServico ??
    entidade?.orcamento ??
    0,
  );
};

const osValor = (os: any, obra?: any): number => {
  const doOs = orcamentoValor(os);
  if (doOs) return doOs;
  const doObra = orcamentoValor(obra);
  if (doObra) return doObra;
  return num(os?.valorTotal ?? os?.valor ?? 0);
};

// Documentos de medição de um negócio (mesmo critério da tela de Finalizados do Comercial).
export const docsMediacao = (obra: any): any[] =>
  (Array.isArray(obra?.documentosNegocio) ? obra.documentosNegocio : []).filter((doc: any) => {
    const id = String(doc?.id || '').toLowerCase();
    const nome = String(doc?.nome || '').toLowerCase();
    return id.includes('mediacao') || nome.includes('medi') || nome.includes('medição');
  });

// Um negócio está finalizado quando foi arquivado ou possui documento de medição.
export const obraFinalizada = (obra: any): boolean =>
  obra?.categoria === 'Arquivado' || Boolean(obra?.finalizadoComMediacao) || docsMediacao(obra).length > 0;

// Rótulo de status financeiro a partir do estado da OS (e do negócio vinculado).
const osStatusLabel = (os: any, obra?: any): string => {
  // Se o negócio foi arquivado/medido, a OS está finalizada a este ponto.
  if (obra && obraFinalizada(obra)) return 'Finalizada';
  const aprov = String(os?.status_aprovacao ?? os?.statusAprovacao ?? '').toLowerCase();
  const st = String(os?.status_os ?? os?.statusOs ?? '').toLowerCase();
  if (st === 'concluida' || st === 'concluído' || st === 'concluido') return 'Finalizada';
  if (aprov === 'aprovada') return 'Em andamento';
  if (st === 'emproducao' || st === 'em produção' || st === 'em producao') return 'Em andamento';
  if (st === 'cancelada') return 'Cancelada';
  return 'Aberta';
};

// Normaliza uma OS do contexto (formatos camelCase e snake_case) para a view-model financeira.
// `obra` é o negócio vinculado (ctx.obras), de onde vem o valor do orçamento.
export const mapOsToFinanceiro = (os: any, obra?: any): OS => {
  const numero = String(
    os?.ordemServicoNumero ?? os?.ordem_servico_numero ?? os?.numero_os ?? os?.numeroOs ?? os?.cc ?? os?.id ?? '',
  ).trim();
  const cliente = String(
    os?.cliente_detalhes?.razao_social ?? os?.cliente_detalhes?.razaoSocial ?? os?.cliente ?? os?.projeto ?? '—',
  );
  const cc = String(os?.cc ?? '');
  const empresa = os?.empresa_prestadora || os?.empresaPrestadora
    ? empresaFromCC(undefined, String(os.empresa_prestadora ?? os.empresaPrestadora).toLowerCase().includes('servi') ? 'Servinave' : 'Linave')
    : empresaFromCC(cc || numero);
  return {
    numero: numero || '—',
    empresa,
    cliente,
    descricao: String(os?.descricaoGeralServico ?? os?.descricao_geral_servico ?? os?.descricao ?? os?.projeto ?? ''),
    valor: osValor(os, obra),
    dataTermino: String(os?.dataTerminoPrevisto ?? os?.data_termino_previsto ?? os?.dataTermino ?? '').slice(0, 10),
    status: osStatusLabel(os, obra),
  };
};

// Valor do orçamento de um negócio/obra (exposto para derivar NFe a partir da medição).
export const negocioValor = (obra: any): number => orcamentoValor(obra);

// ---------- NFe: impostos e cálculo de líquido ----------
export const TAX_DEFAULTS = { cofins: 3, csll: 1, inss: 0, ir: 1.5, pis: 0.0065, iss: 5 };

export const calcNfeLiquido = (original: number, taxes: Record<string, number>): number => {
  const totalImpostos = Object.values(taxes).reduce((s, p) => s + tax(original, p), 0);
  return Math.max(0, num(original) - totalImpostos);
};

export interface NfeSolicitacao {
  id: string;
  os: string;
  empresa: Empresa;
  cliente: string;
  valor: number;
  forma: string;
  dataEmitir: string;
  tipoNfe: string;
  status: string;
  anexos: string[];
  contrato: string;
  derived: boolean;
}

// Discriminador dos registros financeiros guardados na coleção `financeiro` do workspace.
export type FinTipo = 'solicitacao' | 'contaPagar' | 'contaReceber' | 'nfeReq' | 'nfe' | 'banco' | 'locEstudo';

export const genFinId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

// Baixa um conteúdo de texto como arquivo (CSV/TXT) — frontend puro.
export const download = (text: string, filename: string, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
