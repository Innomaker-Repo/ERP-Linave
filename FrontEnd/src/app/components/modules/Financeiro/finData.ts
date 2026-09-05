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

// Rótulo do banco nos menus suspensos: "Itaú - Linave". Usado em todo lugar que lista
// bancos pra escolher (filtros, pagamento, recebimento) — o valor selecionado continua
// sendo só o nome do banco, isso é só o texto exibido na opção.
export const bancoLabel = (b: { nome?: string; empresa?: string }): string =>
  b?.empresa ? `${b.nome} - ${b.empresa}` : String(b?.nome || '');

export interface Solicitacao {
  id: string;
  empresa: Empresa;
  solicitante: string;
  solicitanteCpf?: string;
  solicitanteEmail?: string;
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
  motivoReprovacao?: string;
}

// Identifica se o registro (solicitação, requisição etc.) foi criado pelo usuário logado.
// Confere primeiro por CPF/e-mail (estável mesmo se o nome digitado mudar); cai para o nome
// em texto livre só quando não há esses campos (registros antigos, sem vínculo de usuário).
export const matchesSolicitante = (
  record: { solicitante?: string; solicitanteCpf?: string; solicitanteEmail?: string },
  session: { cpf?: string; email?: string; nome?: string; username?: string } | null | undefined,
): boolean => {
  if (!session) return false;
  const norm = (v?: string) => String(v || '').trim().toLowerCase();
  const cpf = norm(session.cpf);
  const email = norm(session.email);
  const nome = norm(session.nome || session.username);
  if (cpf && norm(record.solicitanteCpf) === cpf) return true;
  if (email && norm(record.solicitanteEmail) === email) return true;
  const s = norm(record.solicitante);
  if (!s) return false;
  return (!!nome && s === nome) || (!!email && s === email);
};

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
export const TAX_DEFAULTS = { cofins: 3, csll: 1, inss: 5.5, ir: 1.5, pis: 0.65, iss: 0 };

export const calcNfeLiquido = (original: number, taxes: Record<string, number>): number => {
  const totalImpostos = Object.values(taxes).reduce((s, p) => s + tax(original, p), 0);
  return Math.max(0, num(original) - totalImpostos);
};

// ---------- Impostos retidos da NFe ----------
// Ordem fixa: é a mesma do formulário de emissão, das colunas do CSV e dos cartões na
// tela de Contas a Receber — assim os três não saem de sincronia.
export const IMPOSTOS_NFE = ['cofins', 'csll', 'inss', 'ir', 'pis', 'iss'] as const;
export type ImpostoNfe = typeof IMPOSTOS_NFE[number];
export const IMPOSTO_LABEL: Record<ImpostoNfe, string> = {
  cofins: 'COFINS', csll: 'CSLL', inss: 'INSS', ir: 'IR', pis: 'PIS', iss: 'ISS',
};

// Detalhamento dos impostos de uma NFe: guarda a alíquota E o valor em reais de cada um.
// Guardar o valor (e não só o %) é proposital: a alíquota padrão pode mudar depois, e o
// recebível tem que continuar refletindo o que foi retido na nota daquela época.
export interface ImpostosNfe {
  percentuais: Record<string, number>;
  valores: Record<string, number>;
  total: number;
}

export const calcImpostosNfe = (original: number, percentuais: Record<string, number>): ImpostosNfe => {
  const base = num(original);
  const pcts: Record<string, number> = {};
  const valores: Record<string, number> = {};
  let total = 0;
  IMPOSTOS_NFE.forEach((k) => {
    const pct = num(percentuais?.[k]);
    const valor = tax(base, pct);
    pcts[k] = pct;
    valores[k] = valor;
    total += valor;
  });
  return { percentuais: pcts, valores, total: Math.round(total * 100) / 100 };
};

// Soma o detalhamento de várias fontes (uma conta a receber pode mesclar NF + recibo).
// Os percentuais só fazem sentido quando há uma única fonte; com mais de uma ficam o da
// primeira que informou, e o que vale para conferência é o valor somado.
export const somarImpostos = (lista: (ImpostosNfe | undefined | null)[]): ImpostosNfe => {
  const validas = lista.filter(Boolean) as ImpostosNfe[];
  if (validas.length === 0) return { percentuais: {}, valores: {}, total: 0 };
  const valores: Record<string, number> = {};
  IMPOSTOS_NFE.forEach((k) => {
    valores[k] = validas.reduce((s, imp) => s + num(imp.valores?.[k]), 0);
  });
  const total = Object.values(valores).reduce((s, v) => s + v, 0);
  return {
    percentuais: validas[0].percentuais || {},
    valores,
    total: Math.round(total * 100) / 100,
  };
};

// Impostos de um registro (conta a receber ou NFe), tolerante a registro antigo sem o campo.
export const impostosDoRegistro = (rec: any): ImpostosNfe | null => {
  const imp = rec?.impostos;
  if (!imp || typeof imp !== 'object') return null;
  const valores = (imp.valores && typeof imp.valores === 'object') ? imp.valores : {};
  const total = num(imp.total) || Object.values(valores).reduce((s: number, v: any) => s + num(v), 0);
  if (!total) return null;
  return { percentuais: imp.percentuais || {}, valores, total };
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
export type FinTipo = 'solicitacao' | 'contaPagar' | 'contaReceber' | 'nfeReq' | 'nfe' | 'banco' | 'locEstudo' | 'custoOsHH' | 'reciboLocacao' | 'contaFixa';

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
  impostos?: ImpostosNfe;    // detalhamento retido na NF que originou este aporte
  emissao?: string;          // data de emissão da NFe (origem 'NFe'), exibida em Contas a Receber
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
    impostos: aporte.impostos || null,
    emissao: aporte.emissao || '',
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
      // Impostos retidos, somados entre as fontes (NF de serviço + recibo de locação).
      // Fica no recebível para a tela e o CSV não precisarem voltar na NFe de origem.
      impostos: somarImpostos(fontes.map((f) => f.impostos)),
      vencimentoRecebimento: fontes.reduce((v, f) => _maxData(v, f.vencimento), ''),
      // Data de emissão da NFe que originou o recebível (fonte 'NFe' especificamente —
      // o recibo de locação não tem emissão de nota própria neste fluxo).
      emissaoNfe: fontes.find((f) => f.origem === 'NFe')?.emissao || base?.emissaoNfe || '',
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
  // CSV aberto no Excel (pt-BR/Windows) é lido como ANSI e "buga" os acentos (ã, õ, ç, ô, â...).
  // O BOM UTF-8 (U+FEFF) força o Excel a interpretar como UTF-8. Só entra em arquivos CSV.
  const isCsv = /csv/i.test(type) || /\.csv$/i.test(filename);
  const conteudo = isCsv ? String.fromCharCode(0xFEFF) + text : text;
  const blob = new Blob([conteudo], { type });
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

// Status possíveis de uma conta a pagar. As contas geradas por Compras começam em
// `semDoc` (sem NF/vencimento/banco); ao anexar a NF viram `comDoc`; ao pagar, `pago`.
export const CP_STATUS = {
  semDoc: 'Aberto S/Documento',
  comDoc: 'Aberto C/Documento',
  aberto: 'Aberto',
  parcelado: 'Parcelado',
  pago: 'Pago',
} as const;

const normTxt = (v?: string | null) => String(v ?? '').trim().toLowerCase();

// Uma conta "tem documento" (documento de compra: NF de entrada, boleto etc. — NÃO é a NF de
// saída que o sistema emite) quando já foi paga/parcelada, quando está em "Aberto C/Documento",
// quando tem número de documento OU quando tem algum anexo. Usada para liberar o item no
// estoque e para o fluxo de status.
export const contaTemDocumento = (conta?: { status?: string; documento?: string; anexos?: any[] } | null): boolean => {
  if (!conta) return false;
  const st = String(conta.status || '');
  if (st === CP_STATUS.comDoc || st === CP_STATUS.pago || st === CP_STATUS.parcelado) return true;
  if (normTxt(conta.documento)) return true;
  return Array.isArray(conta.anexos) && conta.anexos.length > 0;
};

// Regra: o número da NF (documento) não pode se repetir para o MESMO fornecedor. Mesmo número
// em fornecedores diferentes é permitido. Ignora as contas do mesmo grupo de parcelamento
// (mãe/filhas compartilham fornecedor+documento legitimamente) e a própria conta em edição.
export const documentoDuplicado = (
  records: Array<{ id?: string; tipo?: string; parentId?: string | null; fornecedor?: string; documento?: string }>,
  args: { fornecedor: string; documento: string; selfId?: string | null; parentId?: string | null },
): boolean => {
  const doc = normTxt(args.documento);
  const forn = normTxt(args.fornecedor);
  if (!doc || !forn) return false; // sem documento ou sem fornecedor → nada a validar

  // Ids do mesmo grupo de parcelamento da conta em edição (raiz + filhas + a própria).
  const rootId = args.parentId || args.selfId || '';
  const grupo = new Set<string>();
  if (rootId) {
    grupo.add(rootId);
    for (const r of records) if (r?.parentId === rootId && r.id) grupo.add(r.id);
  }
  if (args.selfId) grupo.add(args.selfId);

  return records.some((r) =>
    r?.tipo === 'contaPagar' &&
    !!r.id && !grupo.has(r.id) &&
    normTxt(r.fornecedor) === forn &&
    normTxt(r.documento) === doc,
  );
};

// Mesma regra do documento duplicado, mas para o momento da SOLICITAÇÃO de pagamento — o
// bloqueio precisa acontecer aqui também, senão duas solicitações da mesma nota podem ser
// aprovadas em paralelo e virar duas Contas a Pagar (pagamento em duplicidade). Considera:
// - outra solicitação ainda ativa (Aguardando aprovação/Aprovado) com o mesmo fornecedor+documento
//   — uma Reprovada não conta, porque o próprio reenvio dela passa pelo mesmo id (selfId);
// - uma Conta a Pagar já existente para esse fornecedor+documento (ex.: lançada direto, sem
//   passar por solicitação).
export const solicitacaoDuplicada = (
  records: Array<{ id?: string; tipo?: string; status?: string; fornecedor?: string; documento?: string }>,
  args: { fornecedor: string; documento: string; selfId?: string | null },
): boolean => {
  const doc = normTxt(args.documento);
  const forn = normTxt(args.fornecedor);
  if (!doc || !forn) return false; // sem documento ou sem fornecedor → nada a validar

  return records.some((r) => {
    if (!r?.id || r.id === args.selfId) return false;
    if (normTxt(r.fornecedor) !== forn || normTxt(r.documento) !== doc) return false;
    if (r.tipo === 'solicitacao') return r.status !== 'Reprovado';
    return r.tipo === 'contaPagar';
  });
};

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

/* =========================================================================================
 * CONTAS FIXAS (recorrentes) — luz, água, internet, aluguel...
 *
 * Modelo em duas camadas, de propósito:
 *   1. `contaFixa`  = a REGRA de recorrência (categoria, periodicidade, dia de vencimento).
 *                     Fica guardada no sistema e nunca é paga diretamente.
 *   2. `contaPagar` = as OCORRÊNCIAS geradas por essa regra, uma por competência, com
 *                     `contaFixaId` apontando de volta. São contas normais: entram nos
 *                     mesmos filtros, relatórios, parcelamento e fluxo de pagamento.
 *
 * Separar as duas evita o erro clássico de "editar a conta de luz de agosto" e alterar
 * junto o histórico de julho — e mantém a regra viva mesmo depois de todas as ocorrências
 * já terem sido pagas.
 * =======================================================================================*/

export type Periodicidade = 'mensal' | 'semanal' | 'diaria';

export const PERIODICIDADES: { id: Periodicidade; label: string; descricao: string }[] = [
  { id: 'mensal', label: 'Mensal', descricao: 'Todo mês, no dia escolhido' },
  { id: 'semanal', label: 'Semanal', descricao: 'A cada 7 dias, a partir do início' },
  { id: 'diaria', label: 'Diária', descricao: 'Todos os dias, a partir do início' },
];

export const CATEGORIAS_CONTA_FIXA = [
  'Luz', 'Água', 'Internet', 'Telefone', 'Aluguel', 'Condomínio', 'Gás',
  'Seguro', 'Software / Licenças', 'Contabilidade', 'Limpeza', 'Segurança', 'Outro',
];

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate();

// Um período à frente, a partir de uma data. É o passo do encadeamento.
// No mensal a base é SEMPRE o `diaVencimento` da regra, nunca o dia da ocorrência anterior:
// sem isso, uma conta do dia 31 que caiu em 28/02 seguiria presa no dia 28 para sempre.
export const proximoVencimento = (fixa: any, vencimentoAtual: string): string => {
  const atual = String(vencimentoAtual || '').slice(0, 10);
  const periodicidade: Periodicidade = fixa?.periodicidade || 'mensal';
  if (periodicidade === 'semanal') return days(atual, 7);
  if (periodicidade === 'diaria') return days(atual, 1);

  const dia = Math.min(31, Math.max(1, Number(fixa?.diaVencimento) || Number(atual.slice(8, 10)) || 1));
  const [ano, mes] = atual.split('-').map(Number);
  const idx = ano * 12 + (mes - 1) + 1;
  const a = Math.floor(idx / 12);
  const m = idx % 12;
  const d = String(Math.min(dia, ultimoDiaDoMes(a, m))).padStart(2, '0');
  return `${a}-${String(m + 1).padStart(2, '0')}-${d}`;
};

// Primeiro vencimento de uma regra recém-criada: a primeira data válida a partir do início.
export const primeiroVencimento = (fixa: any): string => {
  const inicio = String(fixa?.inicio || todayStr).slice(0, 10);
  const periodicidade: Periodicidade = fixa?.periodicidade || 'mensal';
  if (periodicidade !== 'mensal') return inicio;

  const dia = Math.min(31, Math.max(1, Number(fixa?.diaVencimento) || Number(inicio.slice(8, 10)) || 1));
  const [ano, mes] = inicio.split('-').map(Number);
  const base = ano * 12 + (mes - 1);
  for (let i = 0; i < 24; i += 1) {
    const a = Math.floor((base + i) / 12);
    const m = (base + i) % 12;
    const d = String(Math.min(dia, ultimoDiaDoMes(a, m))).padStart(2, '0');
    const data = `${a}-${String(m + 1).padStart(2, '0')}-${d}`;
    if (data >= inicio) return data;
  }
  return inicio;
};

// Id determinístico da ocorrência: regra + data. Torna a criação idempotente — se dois
// caminhos tentarem gerar a mesma competência, produzem o MESMO id e o replace-all do
// backend descarta a repetição em vez de duplicar a conta.
export const idOcorrenciaFixa = (fixaId: string, vencimento: string) =>
  `${fixaId}-${String(vencimento).replace(/-/g, '')}`;

// Campos que a ocorrência herda da REGRA (usado na primeira, quando não há anterior).
const montarOcorrenciaDaRegra = (fixa: any, vencimento: string) => ({
  id: idOcorrenciaFixa(fixa.id, vencimento),
  tipo: 'contaPagar' as FinTipo,
  type: 'single',
  parentId: null,
  parcela: '-',
  contaFixaId: fixa.id,
  contaFixaCategoria: fixa.categoria || 'Outro',
  contaFixaPeriodicidade: fixa.periodicidade || 'mensal',
  contaFixaDescricao: fixa.descricao || fixa.categoria || 'Conta fixa',
  empresa: fixa.empresa,
  vinculoTipo: 'Departamento',
  vinculoValor: fixa.departamento || fixa.categoria || '',
  fornecedor: fixa.fornecedor || fixa.descricao || 'Conta fixa',
  tipoPagamento: fixa.categoria || 'Outro',
  natureza: fixa.natureza || '',
  documento: '',
  valor: num(fixa.valor),
  vencimento,
  banco: fixa.banco || '',
  forma: fixa.forma || '',
  status: CP_STATUS.aberto,
  valorPago: 0,
  jurosPago: 0,
  comprovantes: [],
  anexos: [],
  obs: fixa.obs || '',
  createdAt: new Date().toISOString(),
});

// Cópia da ocorrência PAGA para a competência seguinte. Copia o que é da conta (fornecedor,
// natureza, banco, forma) e zera o que pertence só àquele pagamento ou varia mês a mês:
// valor, documento, anexo, comprovante, juros e datas — a nova competência nasce em aberto,
// sem repetir o valor pago na anterior (contas como água/luz variam de mês para mês).
const copiarOcorrencia = (base: any, fixa: any, vencimento: string) => ({
  ...base,
  id: idOcorrenciaFixa(fixa.id, vencimento),
  vencimento,
  status: CP_STATUS.aberto,
  valor: 0,
  // Nasce sempre como conta única: se a anterior tinha sido parcelada, a nova não herda
  // o vínculo de mãe/filha, que pertencia àquela competência.
  type: 'single',
  parentId: null,
  parcela: '-',
  totalParcelas: 1,
  documento: '',
  anexos: [],
  comprovantes: [],
  valorPago: 0,
  dataPagamento: '',
  jurosPago: 0,
  houveJuros: false,
  motivoJuros: '',
  createdAt: new Date().toISOString(),
});

const regraGeraMais = (fixa: any, vencimento: string): boolean => {
  if (!fixa || fixa.ativa === false) return false;
  const fim = String(fixa.fim || '').slice(0, 10);
  return !(fim && vencimento > fim);
};

/**
 * Próxima ocorrência a criar quando uma conta fixa é PAGA. É o coração do encadeamento:
 * a conta seguinte só nasce quando a atual é quitada, o que faz a lista virar o histórico
 * progressivo de pagamentos (uma linha paga por competência, em sequência).
 *
 * Devolve [] quando a regra foi pausada, chegou ao fim, ou a competência seguinte já existe.
 */
export const proximaOcorrenciaAposPagamento = (financeiro: any[], contaPaga: any): any[] => {
  const lista = Array.isArray(financeiro) ? financeiro : [];
  if (!contaPaga?.contaFixaId) return [];
  const fixa = lista.find((r: any) => r?.tipo === 'contaFixa' && r?.id === contaPaga.contaFixaId);
  if (!fixa) return [];

  const vencimento = proximoVencimento(fixa, contaPaga.vencimento);
  if (!regraGeraMais(fixa, vencimento)) return [];
  if (lista.some((r: any) => String(r?.id) === idOcorrenciaFixa(fixa.id, vencimento))) return [];

  return [copiarOcorrencia(contaPaga, fixa, vencimento)];
};

/**
 * Garante que toda regra ativa tenha UMA conta em aberto — nem mais, nem menos.
 *
 * Não adianta competências futuras de propósito: quem cria a próxima é o pagamento da
 * atual. Esta função existe para os dois casos em que o encadeamento não tem de onde
 * partir: a regra acabou de ser criada, ou a última ocorrência foi paga/excluída sem
 * gerar a seguinte (regra que ficou pausada e voltou, conta apagada por engano).
 */
export const garantirOcorrenciasContasFixas = (financeiro: any[]): any[] => {
  const lista = Array.isArray(financeiro) ? financeiro : [];
  const fixas = lista.filter((r: any) => r?.tipo === 'contaFixa' && r?.ativa !== false);
  if (fixas.length === 0) return [];

  const ids = new Set(lista.map((r: any) => String(r?.id)));
  const novas: any[] = [];

  fixas.forEach((fixa: any) => {
    const ocorrencias = lista.filter((r: any) => r?.tipo === 'contaPagar' && r?.contaFixaId === fixa.id);
    // Já existe conta em aberto para esta regra: nada a fazer.
    if (ocorrencias.some((r: any) => String(r.status || '') !== CP_STATUS.pago)) return;

    if (ocorrencias.length === 0) {
      const vencimento = primeiroVencimento(fixa);
      if (!regraGeraMais(fixa, vencimento) || ids.has(idOcorrenciaFixa(fixa.id, vencimento))) return;
      ids.add(idOcorrenciaFixa(fixa.id, vencimento));
      novas.push(montarOcorrenciaDaRegra(fixa, vencimento));
      return;
    }

    // Todas pagas: retoma a partir da última competência quitada.
    const ultima = ocorrencias.reduce((a: any, b: any) =>
      (String(a.vencimento || '') >= String(b.vencimento || '') ? a : b));
    const vencimento = proximoVencimento(fixa, ultima.vencimento);
    if (!regraGeraMais(fixa, vencimento) || ids.has(idOcorrenciaFixa(fixa.id, vencimento))) return;
    ids.add(idOcorrenciaFixa(fixa.id, vencimento));
    novas.push(copiarOcorrencia(ultima, fixa, vencimento));
  });

  return novas;
};


// Uma conta a pagar está vencida quando passou do vencimento e não foi paga.
export const contaVencida = (conta: any): boolean =>
  String(conta?.status || '') !== CP_STATUS.pago && isOld(conta?.vencimento);

export const contaPaga = (conta: any): boolean => String(conta?.status || '') === CP_STATUS.pago;

// Dias até o vencimento (negativo = já venceu).
export const diasAteVencimento = (vencimento: any, hoje: string = todayStr): number => {
  const alvo = d0(vencimento);
  const base = d0(hoje);
  if (!alvo || !base) return 0;
  return Math.round((alvo.getTime() - base.getTime()) / 86400000);
};

export interface AvisoContaFixa {
  conta: any;
  dias: number;         // negativo = vencida há N dias
  vencida: boolean;
}

/**
 * Ocorrências de conta fixa que merecem aviso ao abrir a tela de Contas a Pagar:
 * já vencidas e não pagas, ou vencendo dentro da antecedência configurada na regra.
 * Ordena o mais urgente primeiro.
 */
export const avisosContasFixas = (financeiro: any[], hoje: string = todayStr): AvisoContaFixa[] => {
  const lista = Array.isArray(financeiro) ? financeiro : [];
  const antecedenciaPorRegra = new Map<string, number>();
  lista
    .filter((r: any) => r?.tipo === 'contaFixa')
    .forEach((r: any) => antecedenciaPorRegra.set(String(r.id), Number(r.antecedenciaAviso) || 5));

  return lista
    .filter((r: any) => r?.tipo === 'contaPagar' && r?.contaFixaId && !contaPaga(r))
    .map((conta: any) => {
      const dias = diasAteVencimento(conta.vencimento, hoje);
      return { conta, dias, vencida: dias < 0 };
    })
    .filter(({ conta, dias }) => dias <= (antecedenciaPorRegra.get(String(conta.contaFixaId)) ?? 5))
    .sort((a, b) => a.dias - b.dias);
};
