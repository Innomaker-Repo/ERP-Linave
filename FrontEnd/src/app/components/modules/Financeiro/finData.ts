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

// ---------- Listas fixas (Financeiro) ----------
// Formas de pagamento/recebimento — fixas em todo o módulo Financeiro.
export const FORMAS_PAGAMENTO = [
  'Pix',
  'Cartão de crédito',
  'Cartão de débito',
  'Dinheiro',
  'Boleto bancário',
  'Transferência bancária',
];

// Tipo de reembolso / adiantamento (usado em Solicitação e Contas a Pagar).
export const TIPOS_REEMBOLSO = [
  'Viagens',
  'Salário',
  'Adiantamento',
  'Passagem',
  'Alimentação',
  'Abastecimento',
  'Material',
  'Fornecedor',
  'Outro',
];

// Natureza da despesa (classificação contábil) — dropdown em Contas a Pagar.
export const NATUREZAS_CONTA_PAGAR = [
  'Custo Direto',
  'Custo Indireto',
  'Despesas Administrativa',
  'Despesas Financeira',
  'Impostos e Taxas',
  'Investimentos',
  'Folha de Pagamento',
];

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
  natureza?: string;
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
  receber: ['Contas a Receber', 'Recebíveis por NFe ou lançamento manual.'],
  previsao: ['Previsão de Receita', 'Baseada nos serviços/OS abertas.'],
  bancos: ['Bancos', 'Cadastro e filtro financeiro por banco.'],
  departamentos: ['Departamentos', 'Vínculo e aprovação por área.'],
  historico: ['Histórico', 'Rastreamento das ações.'],
};

// Status de recebível derivado.
export const recStatus = (r: ContaReceber) =>
  r.recebido ? 'Recebido' : isOld(r.vencimentoRecebimento) ? 'Vencido' : 'A receber';

// ---------- Adaptação de dados reais do ERP ----------
// O centro de custo / cc das OS usa prefixo LN (Linave) ou VTS (Servinave).
// 'SN' é o prefixo legado da Servinave (dados antigos) — mantido para retrocompatibilidade.
export const empresaFromCC = (cc?: string, fallback: Empresa = 'Linave'): Empresa => {
  const s = String(cc || '').trim().toUpperCase();
  if (s.startsWith('VTS') || s.startsWith('SN')) return 'Servinave';
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
  medicaoId?: string;      // vínculo com a medição (para mesclar NF + recibo no recebível)
  medicaoNumero?: string;
}

// Discriminador dos registros financeiros guardados na coleção `financeiro` do workspace.
export type FinTipo = 'solicitacao' | 'contaPagar' | 'contaReceber' | 'nfeReq' | 'nfe' | 'banco' | 'locEstudo' | 'custoOsHH' | 'reciboLocacao';

export const genFinId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

// ---------- Recibo de Locação: numeração por OS + montagem a partir da medição ----------
// A numeração do recibo é POR OS (não global): toda OS começa em 001/YY e só incrementa quando
// outra medição da mesma OS é aprovada. O vínculo com a OS (`ordemServicoBackendId`) é uma variável
// própria do recibo, independente do seu id (`REC-...`).
const anoYY = () => String(new Date().getFullYear()).slice(-2);
const seqNumero = (numero: any) => parseInt(String(numero || '').split('/')[0], 10) || 0;

export const recibosLocacaoDaOs = (financeiro: any[], osBackendId: any): any[] =>
  (Array.isArray(financeiro) ? financeiro : []).filter(
    (r: any) => r?.tipo === 'reciboLocacao' && String(r?.ordemServicoBackendId ?? '') === String(osBackendId ?? ''),
  );

// Próximo número do recibo daquela OS no ano corrente: `${maior+1}/YY` (primeiro = 001/YY).
export const proximoNumeroReciboLocacao = (financeiro: any[], osBackendId: any, ano: string = anoYY()): string => {
  const doAno = recibosLocacaoDaOs(financeiro, osBackendId).filter((r: any) => String(r.numero || '').endsWith(`/${ano}`));
  const maior = doAno.reduce((m: number, r: any) => Math.max(m, seqNumero(r.numero)), 0);
  return `${String(maior + 1).padStart(3, '0')}/${ano}`;
};

// Recibo de maior número já existente para a OS (ou null) — usado para herdar o cabeçalho.
export const ultimoReciboLocacaoDaOs = (financeiro: any[], osBackendId: any): any | null => {
  const daOs = recibosLocacaoDaOs(financeiro, osBackendId);
  if (!daOs.length) return null;
  return daOs.reduce((a: any, b: any) => (seqNumero(b.numero) >= seqNumero(a.numero) ? b : a));
};

// Campos de cabeçalho herdados do recibo anterior da OS (cliente / emitente / banco / obs).
const CAMPOS_CABECALHO_RECIBO = [
  'empresa',
  'emitenteNome', 'emitenteEndereco', 'emitenteCep', 'emitenteCidadeUf', 'emitenteCnpj',
  'emitenteInscMunicipal', 'emitenteInscEstadual', 'atendimento', 'banco', 'formaPagamento',
  'clienteNome', 'clienteLogradouro', 'clienteBairro', 'clienteMunicipio', 'clienteUf',
  'clienteCep', 'clienteCnpj', 'clienteInscEst', 'clienteIncMun', 'obs',
] as const;

// Monta o objeto do recibo de locação a partir de uma medição aprovada. Devolve null se a medição
// não tiver itens de locação. Cabeçalho vem do recibo anterior da OS (se houver); itens vêm SEMPRE
// da medição informada. Reutilizado tanto na aprovação da medição quanto no dropdown de "Novo recibo".
export const construirReciboDeMedicao = (financeiro: any[], med: any): any | null => {
  const itensLoc = (Array.isArray(med?.itens) ? med.itens : []).filter(
    (l: any) => (l?.categoria || 'servico') === 'locacao',
  );
  if (itensLoc.length === 0) return null;

  const osBackendId = med?.ordemServicoBackendId ?? null;
  const anterior = ultimoReciboLocacaoDaOs(financeiro, osBackendId);
  const hoje = new Date().toISOString().slice(0, 10);

  const cabecalho: Record<string, any> = anterior
    ? CAMPOS_CABECALHO_RECIBO.reduce((acc, k) => ({ ...acc, [k]: anterior[k] }), {})
    : { empresa: med?.empresa || '', clienteNome: med?.cliente || '', clienteCnpj: med?.cnpj || '', obs: '' };

  return {
    id: `REC-${Date.now()}`,
    tipo: 'reciboLocacao' as FinTipo,
    status: 'pendente',
    numero: proximoNumeroReciboLocacao(financeiro, osBackendId),
    // Vínculo com a OS (variável própria, independente do id do recibo).
    ordemServicoBackendId: osBackendId,
    ordemServicoNumero: med?.ordemServicoNumero || '',
    medicaoId: med?.id,
    medicaoNumero: med?.numeroMedicao,
    ...cabecalho,
    dataEmissao: hoje,
    dataVencimento: hoje,
    // Itens sempre da nova medição (é o que motiva o novo recibo).
    itens: itensLoc.map((l: any, i: number) => ({
      id: `it-${Date.now()}-${i}`,
      item: String(i + 1).padStart(2, '0'),
      qtd: String(l.quantidadeProduzida ?? ''),
      descricao: [l.descricao, med?.embarcacao, med?.periodo ? `Período: ${med.periodo}` : ''].filter(Boolean).join(' — '),
      valorUnitario: String(l.valorUnitario ?? ''),
      total: String(l.total ?? ''),
    })),
    createdAt: new Date().toISOString(),
  };
};

// ---------- Conta a Receber: mescla NFe (serviço) + Recibo de Locação por medição ----------
// Cada medição vira UMA conta a receber que soma a NF (serviço) e o recibo (locação) daquele BM.
// As contribuições ficam em `fontes` (uma por origem), o que torna o upsert idempotente: reemitir a
// NF ou regerar o recibo substitui a fonte da mesma origem, sem duplicar valor. O vencimento do
// recebível é o MAIS DISTANTE entre as fontes.
export interface AporteReceber {
  medicaoId?: string;
  medicaoNumero?: string;
  ordemServicoNumero?: string;
  empresa?: string;
  cliente?: string;
  origem: 'NFe' | 'Recibo';
  fonteId: string;
  valorOriginal: number;
  valorLiquido: number;
  vencimento?: string;
  referencia?: string;
  baixado?: number;          // valor já recebido na emissão (NFe); semeia o recebimento na criação
}

const _maxData = (a?: string, b?: string): string => {
  const da = String(a || '').slice(0, 10);
  const db = String(b || '').slice(0, 10);
  if (!da) return db;
  if (!db) return da;
  return da >= db ? da : db;
};

export const upsertContaReceberPorMedicao = (financeiro: any[], aporte: AporteReceber): any[] => {
  const lista = Array.isArray(financeiro) ? financeiro : [];
  const fonte = {
    origem: aporte.origem,
    id: aporte.fonteId,
    valorOriginal: num(aporte.valorOriginal),
    valorLiquido: num(aporte.valorLiquido),
    vencimento: aporte.vencimento || '',
    referencia: aporte.referencia || '',
  };

  // Reconstrói o recebível a partir das suas fontes (soma valores, vencimento = o mais distante).
  const montarRecebivel = (fontes: any[], base?: any) => {
    const valorLiquido = fontes.reduce((s, f) => s + num(f.valorLiquido), 0);
    const baixado = num(aporte.baixado);
    return {
      id: base?.id || genFinId('CR'),
      tipo: 'contaReceber' as FinTipo,
      origem: Array.from(new Set(fontes.map((f) => f.origem))).join(' + '),
      empresa: aporte.empresa ?? base?.empresa ?? '',
      cliente: aporte.cliente ?? base?.cliente ?? '',
      referencia: fontes.map((f) => f.referencia).filter(Boolean).join(' · '),
      valorOriginal: fontes.reduce((s, f) => s + num(f.valorOriginal), 0),
      valorLiquido,
      vencimentoRecebimento: fontes.reduce((v, f) => _maxData(v, f.vencimento), ''),
      // Recebível já existia → preserva o recebimento (manual ou anterior). Novo → semeia do `baixado`.
      recebido: base ? (base.recebido ?? false) : (baixado > 0 && baixado >= valorLiquido),
      dataRecebimento: base?.dataRecebimento ?? '',
      valorRecebido: base ? (base.valorRecebido ?? 0) : baixado,
      bancoRecebimento: base?.bancoRecebimento ?? '',
      observacao: base?.observacao ?? '',
      medicaoId: aporte.medicaoId || base?.medicaoId || '',
      medicaoNumero: aporte.medicaoNumero || base?.medicaoNumero || '',
      ordemServicoNumero: aporte.ordemServicoNumero || base?.ordemServicoNumero || '',
      fontes,
      createdAt: base?.createdAt || new Date().toISOString(),
    };
  };

  // Sem medição: recebível avulso (ex.: NFe derivada de obra finalizada) — nunca mescla.
  if (!aporte.medicaoId) {
    return [montarRecebivel([fonte]), ...lista];
  }

  const idx = lista.findIndex(
    (r: any) => r?.tipo === 'contaReceber' && String(r?.medicaoId ?? '') === String(aporte.medicaoId),
  );
  if (idx === -1) {
    return [montarRecebivel([fonte]), ...lista];
  }

  const atual = lista[idx];
  const fontesAtuais = Array.isArray(atual.fontes) ? atual.fontes : [];
  const fontes = [...fontesAtuais.filter((f: any) => f.origem !== aporte.origem), fonte];
  const copia = [...lista];
  copia[idx] = montarRecebivel(fontes, atual);
  return copia;
};

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

// ---------- Contas a Pagar: builder puro (única ou mãe+filhas) ----------
// Reaproveitado pelo kanban de Compras ao marcar um item como comprado. Espelha
// a lógica de useFin (addRecord / parcelarConta), porém puro: devolve os FinRecord
// prontos para um único saveEntity('financeiro', [...build, ...financeiro]).
export interface ContaPagarBase {
  empresa: Empresa | string;
  vinculoTipo: 'OS' | 'Departamento';
  vinculoValor: string;
  fornecedor: string;
  tipoPagamento: string;
  natureza?: string;
  documento: string;
  valor: number;
  vencimento: string;
  banco: string;
  forma: string;
  obs?: string;
}

export interface ParcelamentoOpcoes {
  parcelar: boolean;
  nParcelas?: number;
  intervaloDias?: number;
  dataInicio?: string;
}

export const buildContasPagar = (
  base: ContaPagarBase,
  parcelamento?: ParcelamentoOpcoes,
): Record<string, any>[] => {
  const now = new Date().toISOString();
  const ts = Date.now().toString(36).toUpperCase();
  const parentId = `CP-${ts}`;
  const total = num(base.valor);

  const comum = {
    tipo: 'contaPagar' as FinTipo,
    empresa: base.empresa,
    vinculoTipo: base.vinculoTipo,
    vinculoValor: base.vinculoValor,
    fornecedor: base.fornecedor,
    tipoPagamento: base.tipoPagamento,
    natureza: base.natureza || '',
    documento: base.documento,
    forma: base.forma,
    banco: base.banco,
    obs: base.obs || '',
  };

  if (!parcelamento?.parcelar) {
    return [{
      id: parentId,
      type: 'single',
      parentId: null,
      parcela: '-',
      totalParcelas: 1,
      valor: total,
      vencimento: base.vencimento || todayStr,
      status: 'Aberto',
      valorPago: 0,
      jurosPago: 0,
      comprovantes: [],
      dataPagamento: '',
      createdAt: now,
      ...comum,
    }];
  }

  const n = Math.max(2, Math.floor(parcelamento.nParcelas || 2));
  const intervalo = Math.max(1, Math.floor(parcelamento.intervaloDias || 30));
  const inicio = parcelamento.dataInicio || base.vencimento || todayStr;
  const baseValor = Math.floor((total / n) * 100) / 100;
  const sobra = Math.round((total - baseValor * n) * 100) / 100;

  const mae = {
    id: parentId,
    type: 'parent',
    parentId: null,
    parcela: 'Mãe',
    totalParcelas: n,
    valor: total,
    vencimento: inicio,
    status: 'Parcelado',
    valorPago: 0,
    jurosPago: 0,
    comprovantes: [],
    dataPagamento: '',
    createdAt: now,
    ...comum,
  };

  const filhas = Array.from({ length: n }, (_, i) => {
    const idx = i + 1;
    return {
      id: `${parentId}-${String(idx).padStart(2, '0')}`,
      type: 'child',
      parentId,
      parcela: `${idx}/${n}`,
      totalParcelas: n,
      valor: idx === n ? Math.round((baseValor + sobra) * 100) / 100 : baseValor,
      vencimento: days(inicio, intervalo * (idx - 1)),
      status: 'Aberto',
      valorPago: 0,
      jurosPago: 0,
      comprovantes: [],
      dataPagamento: '',
      createdAt: now,
      ...comum,
    };
  });

  return [mae, ...filhas];
};
