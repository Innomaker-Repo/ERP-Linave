import React, { useEffect, useMemo, useState } from 'react';

/* =========================================================================================
 * SUPER APP FINANCEIRO | Linave / Servinave
 * Porta fiel do protótipo HTML para dentro do ERP (aba Financeiro).
 * Tudo isolado sob `.fin-root` para o tema claro não vazar para o resto do ERP (escuro).
 * Estado em memória + localStorage (sobrevive à troca de abas). Mock — não integra backend.
 * =======================================================================================*/

// ---------- Helpers ----------
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const todayStr = new Date().toISOString().slice(0, 10);
const num = (v: any) => Number(String(v ?? 0).replace(',', '.')) || 0;
const days = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
const d0 = (d: any) => {
  if (!d) return null;
  const x = new Date(d + 'T00:00:00');
  x.setHours(0, 0, 0, 0);
  return x;
};
const isOld = (d: any) => {
  const x = d0(d);
  if (!x) return false;
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return x < n;
};
const br = (d: any) => {
  if (!d) return '-';
  const [y, m, da] = String(d).slice(0, 10).split('-');
  return da && m && y ? `${da}/${m}/${y}` : '-';
};
const tax = (v: any, p: any) => num(v) * (num(p) / 100);
const genId = (prefix: string, arr: any[]) => `${prefix}-${String(arr.length + 1).padStart(4, '0')}`;

const STATUS_CLASS: Record<string, string> = {
  'Aguardando aprovação': 'wait', 'Aprovado': 'ok', 'Reprovado': 'bad', 'Aberto': 'wait',
  'Em andamento': 'info', 'Medição aprovada': 'ok', 'Finalizada': 'ok', 'Cancelada': 'bad',
  'Aguardando emissão': 'wait', 'Emitida e arquivada': 'ok', 'Vencido': 'bad', 'A receber': 'wait',
  'Recebido': 'ok', 'Pago': 'ok', 'Parcelado': 'info', 'Ativa': 'ok', 'Pausada': 'wait', 'Encerrada': 'neutral',
};
const statusTag = (s: string) => <span className={`tag ${STATUS_CLASS[s] || 'neutral'}`}>{s}</span>;
const companyTag = (e: string) => <span className={`tag ${e === 'Linave' ? 'linave' : e === 'Servinave' ? 'servinave' : 'neutral'}`}>{e}</span>;
const typeTag = (t: string) => t === 'parent'
  ? <span className="tag mother">Mãe</span>
  : t === 'child' ? <span className="tag child">Filha</span> : <span className="tag neutral">Única</span>;
const recStatus = (r: any) => (r.recebido ? 'Recebido' : isOld(r.vencimentoRecebimento) ? 'Vencido' : 'A receber');

// ---------- Dados iniciais (mock) ----------
const initialState = () => ({
  os: [
    { numero: 'OS-2408', empresa: 'Linave', cliente: 'CONSTELLATION S/A', descricao: 'Serviço de locação operacional', valor: 28500, dataTermino: days(todayStr, 20), status: 'Em andamento' },
    { numero: 'OS-2410', empresa: 'Servinave', cliente: 'SOLSTAD OFFSHORE', descricao: 'Serviço offshore', valor: 43603.75, dataTermino: days(todayStr, 35), status: 'Aberta' },
    { numero: 'OS-2413', empresa: 'Linave', cliente: 'ESTALEIRO MAUÁ', descricao: 'Serviço técnico', valor: 5830, dataTermino: days(todayStr, -5), status: 'Aberta' },
  ],
  depts: [
    { nome: 'Comercial', empresa: 'Ambas', email: 'comercial@linave.com' },
    { nome: 'Financeiro', empresa: 'Ambas', email: 'financeiro@linave.com' },
    { nome: 'Produção', empresa: 'Linave', email: 'producao@linave.com' },
    { nome: 'Compras', empresa: 'Ambas', email: 'compras@linave.com' },
  ],
  banks: [
    { nome: 'Banco Linave Principal', empresa: 'Linave', tipo: 'Conta corrente', pix: 'financeiro@linave.com' },
    { nome: 'Banco Servinave Principal', empresa: 'Servinave', tipo: 'Conta corrente', pix: 'financeiro@servinave.com' },
    { nome: 'Caixa Operacional', empresa: 'Ambas', tipo: 'Caixa interno', pix: '-' },
  ],
  reqs: [
    { id: 'SP-0001', empresa: 'Linave', solicitante: 'Mariana', tipo: 'Abastecimento', vinculoTipo: 'OS', vinculoValor: 'OS-2408', fornecedor: 'Posto Exemplo', documento: 'Cupom 1088', valor: 680, compra: todayStr, vencimento: todayStr, forma: 'PIX à vista', status: 'Aguardando aprovação', descricao: 'Abastecimento da OS.', anexos: ['cupom_1088.jpg'] },
  ],
  payables: [
    { id: 'CP-0001', type: 'single', parentId: null, parcela: '-', totalParcelas: 1, empresa: 'Linave', vinculoTipo: 'OS', vinculoValor: 'OS-2408', fornecedor: 'Fornecedor Alfa', tipo: 'Material', documento: 'NF 203', valor: 1200, vencimento: todayStr, banco: 'Banco Linave Principal', forma: 'Boleto', status: 'Aberto', anexos: ['nf_203.pdf'], comprovantes: [], valorPago: 0, dataPagamento: '', jurosPago: 0, houveJuros: false, motivoJuros: '', obs: '' },
  ],
  nfeReqs: [
    { id: 'SNF-0001', os: 'OS-2408', empresa: 'Linave', cliente: 'CONSTELLATION S/A', valor: 28500, forma: 'Boleto 30 dias após emissão', dataEmitir: todayStr, tipoNfe: 'NFe Serviço', status: 'Aguardando emissão', anexos: ['medicao_OS-2408.pdf'], obs: '' },
  ],
  nfes: [] as any[],
  receivables: [
    { id: 'CR-0001', origem: 'Manual', empresa: 'Linave', cliente: 'CONSTELLATION S/A', referencia: 'Rec.Loc. 001/26', valorOriginal: 2604, valorLiquido: 2604, vencimentoRecebimento: days(todayStr, -3), recebido: false, dataRecebimento: '', valorRecebido: 0, bancoRecebimento: 'Banco Linave Principal', observacao: '' },
  ],
  locStudies: [] as any[],
  hist: [
    { title: 'Sistema consolidado', detail: 'Versão completa com OS, pagamento, NFe, recebíveis, locação e previsão.', user: 'Sistema', date: 'Agora' },
  ],
});

const STORAGE_KEY = 'erp-financeiro-superapp-v1';
const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return initialState();
};

const NAV = [
  {
    group: 'Operação', items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'os', label: 'OS Emitidas', icon: '🧾' },
      { id: 'solicitacao', label: 'Solicitação de Pagamento', icon: '📝' },
      { id: 'aprovacoes', label: 'Aprovações', icon: '✅' },
      { id: 'pagar', label: 'Contas a Pagar', icon: '💸' },
      { id: 'nfe', label: 'NFe', icon: '📄' },
      { id: 'receber', label: 'Contas a Receber', icon: '💰' },
      { id: 'locacao', label: 'Locação', icon: '🏷️' },
      { id: 'previsao', label: 'Previsão de Receita', icon: '📈' },
    ],
  },
  {
    group: 'Gestão', items: [
      { id: 'bancos', label: 'Bancos', icon: '🏦' },
      { id: 'departamentos', label: 'Departamentos', icon: '🗂️' },
      { id: 'historico', label: 'Histórico', icon: '🕓' },
    ],
  },
];
const TITLES: Record<string, [string, string]> = {
  dashboard: ['Dashboard Financeiro', 'Visão consolidada, com filtros por empresa, banco e período.'],
  os: ['OS Emitidas', 'Base para previsão, NFe, locação e solicitações.'],
  solicitacao: ['Solicitação de Pagamento', 'Sem cotação, sem banco; vínculo por OS ou departamento.'],
  aprovacoes: ['Aprovações', 'Solicitações que podem virar Contas a Pagar.'],
  pagar: ['Contas a Pagar', 'Adicionar, editar, parcelar, pagar, registrar juros e comprovante.'],
  nfe: ['Solicitações e Emissão de NFe', 'Medição aprovada cria solicitação; emissão abre cálculos e cria recebível.'],
  receber: ['Contas a Receber', 'Recebíveis por NFe, locação ou lançamento manual.'],
  locacao: ['Locação | Módulo em estudo', 'Levantamento de regras antes de gerar cobranças.'],
  previsao: ['Previsão de Receita', 'Baseada nos serviços/OS abertas.'],
  bancos: ['Bancos', 'Cadastro e filtro financeiro por banco.'],
  departamentos: ['Departamentos', 'Vínculo e aprovação por área.'],
  historico: ['Histórico', 'Rastreamento das ações.'],
};

// Contexto leve para Modal/FileBox lerem o estado vivo sem precisarem ser recriados a cada
// render (componentes estáveis = sem remontagem = inputs não perdem foco ao digitar).
const FinCtx = React.createContext<any>(null);

function Modal({ id, title, hint, children }: any) {
  const { modal, setModal } = React.useContext(FinCtx);
  if (modal !== id) return null;
  return (
    <div className="modal-bg open" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
      <div className="modal">
        <div className="mh"><div><h2>{title}</h2><p className="hint">{hint}</p></div><button className="x" type="button" onClick={() => setModal(null)}>×</button></div>
        <div className="mb">{children}</div>
      </div>
    </div>
  );
}

function FileBox({ k, label }: any) {
  const { files, onFiles } = React.useContext(FinCtx);
  return (
    <div className="full"><label>{label}</label><label className="upload">📎 {label}<input type="file" multiple onChange={(e) => onFiles(k, e.target.files)} /></label><div className="files">{(files[k] || []).map((n: string) => <span className="file" key={n}>📄 {n}</span>)}</div></div>
  );
}

export function FinanceiroView() {
  const stored = useMemo(loadStored, []);
  const [section, setSection] = useState('dashboard');

  // dados
  const [os, setOs] = useState<any[]>(stored.os);
  const [depts, setDepts] = useState<any[]>(stored.depts);
  const [banks, setBanks] = useState<any[]>(stored.banks);
  const [reqs, setReqs] = useState<any[]>(stored.reqs);
  const [payables, setPayables] = useState<any[]>(stored.payables);
  const [nfeReqs, setNfeReqs] = useState<any[]>(stored.nfeReqs);
  const [nfes, setNfes] = useState<any[]>(stored.nfes);
  const [receivables, setReceivables] = useState<any[]>(stored.receivables);
  const [locStudies, setLocStudies] = useState<any[]>(stored.locStudies);
  const [hist, setHist] = useState<any[]>(stored.hist);
  const [files, setFiles] = useState<Record<string, string[]>>({ req: [], med: [], pay: [], proof: [], nfe: [], loc: [] });

  // filtros
  const [companyFilter, setCompanyFilter] = useState('Todas');
  const [bankFilter, setBankFilter] = useState('Todos');
  const [periodMode, setPeriodMode] = useState('all');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodMonth, setPeriodMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));

  // modais / forms
  const [modal, setModal] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ title: string; body: React.ReactNode } | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const [osForm, setOsForm] = useState<any>({});
  const [medForm, setMedForm] = useState<any>({});
  const [nfeForm, setNfeForm] = useState<any>({});
  const [payForm, setPayForm] = useState<any>({});
  const [paymentForm, setPaymentForm] = useState<any>({});
  const [recForm, setRecForm] = useState<any>({});
  const [recEditForm, setRecEditForm] = useState<any>({});
  const [reqForm, setReqForm] = useState<any>({ empresa: 'Linave', tipo: 'Passagem', vinculoTipo: 'OS', compra: todayStr, vencimento: todayStr });
  const [bankForm, setBankForm] = useState<any>({ empresa: 'Linave', tipo: 'Conta corrente' });
  const [deptForm, setDeptForm] = useState<any>({ empresa: 'Linave' });
  const [locForm, setLocForm] = useState<any>({ empresa: 'Linave', tipo: 'Equipamento', unidade: 'Diária', vinculaOS: 'Sim' });

  // persistência local
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ os, depts, banks, reqs, payables, nfeReqs, nfes, receivables, locStudies, hist }));
    } catch { /* ignore */ }
  }, [os, depts, banks, reqs, payables, nfeReqs, nfes, receivables, locStudies, hist]);

  const toast = (m: string) => { setToastMsg(m); window.setTimeout(() => setToastMsg(''), 3200); };
  const pushHist = (title: string, detailTxt: string, user = 'Financeiro') => setHist((p) => [{ title, detail: detailTxt, user, date: 'Agora' }, ...p]);
  const onFiles = (key: string, fl: FileList | null) => setFiles((p) => ({ ...p, [key]: [...(fl || [])].map((f) => f.name) }));
  const bind = (form: any, set: any, key: string) => ({ value: form[key] ?? '', onChange: (e: any) => set((p: any) => ({ ...p, [key]: e.target.value })) });

  // filtros
  const range = () => {
    if (periodMode === 'all') return null;
    if (periodMode === 'range') return { start: periodStart, end: periodEnd };
    if (periodMode === 'month') {
      if (!periodMonth) return null;
      const [y, mo] = periodMonth.split('-').map(Number);
      const last = new Date(y, mo, 0).getDate();
      return { start: `${y}-${String(mo).padStart(2, '0')}-01`, end: `${y}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
    }
    if (periodMode === 'year') {
      if (!periodYear) return null;
      return { start: `${periodYear}-01-01`, end: `${periodYear}-12-31` };
    }
    return null;
  };
  const itemDate = (i: any) => i?.vencimentoRecebimento || i?.vencimento || i?.dataTermino || i?.dataEmitir || i?.emissao || i?.compra || i?.dataPagamento || i?.dataRecebimento || i?.inicio || '';
  const byPeriod = (i: any) => { const r = range(); if (!r) return true; const d = itemDate(i); if (!d) return false; return (!r.start || d >= r.start) && (!r.end || d <= r.end); };
  const itemBank = (i: any) => i?.banco || i?.bancoPagamento || i?.bancoRecebimento || '';
  const byBank = (i: any) => { if (bankFilter === 'Todos') return true; const ib = itemBank(i); return ib && ib === bankFilter; };
  const byFilters = (i: any) => (companyFilter === 'Todas' || i.empresa === companyFilter || i.empresa === 'Ambas') && byPeriod(i) && byBank(i);

  const osOptions = os.filter((o) => companyFilter === 'Todas' || o.empresa === companyFilter);

  // ---------- Aberturas de modal ----------
  const openOs = () => { setOsForm({ numero: '', empresa: 'Linave', cliente: '', valor: '', data: days(todayStr, 30), status: 'Aberta', desc: '' }); setModal('os'); };
  const openMeasurement = (osn = '') => {
    setFiles((p) => ({ ...p, med: [] }));
    const o = os.find((x) => x.numero === osn);
    setMedForm({ empresa: o?.empresa || 'Linave', os: o?.numero || osOptions[0]?.numero || '', valor: o?.valor || '', data: todayStr, forma: '', tipo: 'NFe Serviço', obs: '' });
    setModal('measurement');
  };
  const openNfe = (rid: string) => {
    const r = nfeReqs.find((x) => x.id === rid);
    if (!r) return;
    setFiles((p) => ({ ...p, nfe: [] }));
    setNfeForm({ reqId: r.id, item: 1, empresa: r.empresa, cliente: r.cliente, numero: '', emissao: todayStr, original: r.valor, pCofins: 3, pCsll: 1, pInss: 0, pIr: 1.5, pPis: 0.0065, pIss: 5, baixado: 0, vencido: 0, vencimento: r.dataEmitir, contrato: r.os });
    setModal('nfe');
  };
  const openPayable = (pid = '', mode = 'new') => {
    setFiles((p) => ({ ...p, pay: [] }));
    const p = payables.find((x) => x.id === pid);
    setPayForm({
      id: pid, mode,
      empresa: p?.empresa || 'Linave', vinculoTipo: p?.vinculoTipo || 'OS', os: p?.vinculoTipo === 'OS' ? p?.vinculoValor : (osOptions[0]?.numero || ''),
      departamento: p?.vinculoTipo === 'Departamento' ? p?.vinculoValor : (depts[0]?.nome || ''),
      fornecedor: p?.fornecedor || '', tipo: p?.tipo || 'Material', documento: p?.documento || '', valor: p?.valor || '',
      vencimento: p?.vencimento || todayStr, banco: p?.banco || banks[0]?.nome || '', forma: p?.forma || '', obs: p?.obs || '',
      parcelar: mode === 'parcel' ? 'Sim' : 'Não', parcelas: 2, intervalo: 30,
    });
    setModal('payable');
  };
  const openPayment = (pid: string) => {
    const p = payables.find((x) => x.id === pid);
    if (!p) return;
    setFiles((pp) => ({ ...pp, proof: [] }));
    setPaymentForm({ id: pid, date: todayStr, amount: p.valorPago || p.valor, bank: p.banco, hasInterest: 'Não', interestValue: 0, interestReason: '', obs: '' });
    setModal('payment');
  };
  const openRecManual = () => { setRecForm({ empresa: companyFilter === 'Todas' ? 'Linave' : companyFilter, cliente: '', ref: '', original: '', liquido: '', vencimento: todayStr, banco: banks[0]?.nome || '', recebido: 'Não', data: '', valorRecebido: '', obs: '' }); setModal('recManual'); };
  const openRecEdit = (rid: string) => {
    const r = receivables.find((x) => x.id === rid);
    if (!r) return;
    setRecEditForm({ id: rid, recebido: r.recebido ? 'Sim' : 'Não', data: r.dataRecebimento || '', valor: r.valorRecebido || r.valorLiquido, banco: r.bancoRecebimento, venc: r.vencimentoRecebimento, obs: r.observacao || '' });
    setModal('recEdit');
  };

  // ---------- Cálculo NFe ----------
  const nfeCalc = useMemo(() => {
    const o = num(nfeForm.original);
    const co = tax(o, nfeForm.pCofins), cs = tax(o, nfeForm.pCsll), ins = tax(o, nfeForm.pInss), ir = tax(o, nfeForm.pIr), pis = tax(o, nfeForm.pPis), iss = tax(o, nfeForm.pIss);
    const liq = Math.max(0, o - co - cs - ins - ir - pis - iss);
    return { original: o, cofins: co, csll: cs, outros: ins + ir + pis + iss, liquido: liq };
  }, [nfeForm]);

  // ---------- Ações ----------
  const submitOs = (e: any) => {
    e.preventDefault();
    const o = { numero: osForm.numero, empresa: osForm.empresa, cliente: osForm.cliente, descricao: osForm.desc, valor: num(osForm.valor), dataTermino: osForm.data, status: osForm.status };
    setOs((p) => [o, ...p]); pushHist('OS adicionada', `${o.numero} adicionada para ${o.cliente}.`, 'Comercial'); setModal(null); toast('OS adicionada.');
  };
  const approveReq = (idv: string) => {
    const r = reqs.find((x) => x.id === idv); if (!r) return;
    setReqs((p) => p.map((x) => (x.id === idv ? { ...x, status: 'Aprovado' } : x)));
    setPayables((p) => [{ id: genId('CP', p), type: 'single', parentId: null, parcela: '-', totalParcelas: 1, empresa: r.empresa, vinculoTipo: r.vinculoTipo, vinculoValor: r.vinculoValor, fornecedor: r.fornecedor, tipo: r.tipo, documento: r.documento, valor: r.valor, vencimento: r.vencimento, banco: banks[0]?.nome || 'A definir', forma: r.forma, status: 'Aberto', anexos: r.anexos || [], comprovantes: [], valorPago: 0, dataPagamento: '', jurosPago: 0, houveJuros: false, motivoJuros: '', obs: `Criada a partir de ${idv}` }, ...p]);
    pushHist('Solicitação aprovada', `${idv} virou Conta a Pagar.`, 'Aprovador'); toast('Solicitação aprovada e lançada em Contas a Pagar.');
  };
  const rejectReq = (idv: string) => { setReqs((p) => p.map((x) => (x.id === idv ? { ...x, status: 'Reprovado' } : x))); pushHist('Solicitação reprovada', `${idv} foi reprovada.`, 'Aprovador'); };

  const submitReq = (e: any) => {
    e.preventDefault();
    const vinculoValor = reqForm.vinculoTipo === 'OS' ? reqForm.os : reqForm.departamento;
    const r = { id: genId('SP', reqs), empresa: reqForm.empresa, solicitante: reqForm.solicitante, tipo: reqForm.tipo, vinculoTipo: reqForm.vinculoTipo, vinculoValor, fornecedor: reqForm.fornecedor, documento: reqForm.documento, valor: num(reqForm.valor), compra: reqForm.compra, vencimento: reqForm.vencimento, forma: reqForm.forma, status: 'Aguardando aprovação', descricao: reqForm.desc, anexos: files.req };
    setReqs((p) => [r, ...p]); pushHist('Solicitação criada', `${r.id} criada por ${r.solicitante || '-'}.`, r.solicitante || 'Financeiro');
    setReqForm({ empresa: 'Linave', tipo: 'Passagem', vinculoTipo: reqForm.vinculoTipo, compra: todayStr, vencimento: todayStr, os: reqForm.os, departamento: reqForm.departamento }); setFiles((p) => ({ ...p, req: [] })); toast('Solicitação enviada para aprovação.');
  };

  const submitPayable = (e: any) => {
    e.preventDefault();
    const ex = payables.find((p) => p.id === payForm.id);
    const vinculoValor = payForm.vinculoTipo === 'OS' ? payForm.os : payForm.departamento;
    const s: any = { id: payForm.id || genId('CP', payables), type: 'single', parentId: null, parcela: '-', totalParcelas: 1, empresa: payForm.empresa, vinculoTipo: payForm.vinculoTipo, vinculoValor, fornecedor: payForm.fornecedor, tipo: payForm.tipo, documento: payForm.documento, valor: num(payForm.valor), vencimento: payForm.vencimento, banco: payForm.banco, forma: payForm.forma, status: ex?.status || 'Aberto', anexos: files.pay.length ? files.pay : (ex?.anexos || []), comprovantes: ex?.comprovantes || [], valorPago: ex?.valorPago || 0, dataPagamento: ex?.dataPagamento || '', jurosPago: ex?.jurosPago || 0, houveJuros: ex?.houveJuros || false, motivoJuros: ex?.motivoJuros || '', obs: payForm.obs };
    if (payForm.parcelar === 'Sim') {
      const n = Math.max(2, parseInt(payForm.parcelas || 2));
      const interval = parseInt(payForm.intervalo || 30);
      const parent = s.id;
      let rest = payables.filter((p) => p.id !== s.id && p.parentId !== s.id);
      const base = Math.floor((s.valor / n) * 100) / 100;
      const rem = Math.round((s.valor - base * n) * 100) / 100;
      const children: any[] = [];
      for (let i = 1; i <= n; i++) children.push({ ...s, id: `${parent}-${String(i).padStart(2, '0')}`, type: 'child', parentId: parent, parcela: `${i}/${n}`, totalParcelas: n, valor: i === n ? Math.round((base + rem) * 100) / 100 : base, vencimento: days(s.vencimento, interval * (i - 1)), status: 'Aberto' });
      setPayables([{ ...s, id: parent, type: 'parent', parentId: null, parcela: 'Mãe', totalParcelas: n, status: 'Parcelado' }, ...rest, ...children]);
      pushHist('Conta parcelada', `${parent} criada com parcelas.`); toast('Conta parcelada em mãe e filhas.');
    } else {
      setPayables((p) => [s, ...p.filter((x) => x.id !== s.id && x.parentId !== s.id)]);
      pushHist('Conta a pagar salva', `${s.id} salva para ${s.fornecedor}.`); toast('Conta a pagar salva.');
    }
    setModal(null);
  };

  const updateParentArr = (arr: any[], parentId: string) => {
    const kids = arr.filter((p) => p.parentId === parentId);
    return arr.map((p) => {
      if (p.id !== parentId) return p;
      const valorPago = kids.reduce((s, k) => s + num(k.valorPago), 0);
      const jurosPago = kids.reduce((s, k) => s + num(k.jurosPago), 0);
      return { ...p, valorPago, jurosPago, houveJuros: jurosPago > 0, comprovantes: kids.flatMap((k) => k.comprovantes || []), status: kids.every((k) => k.status === 'Pago') ? 'Pago' : 'Parcelado', dataPagamento: kids.every((k) => k.status === 'Pago') ? todayStr : '' };
    });
  };
  const submitPayment = (e: any) => {
    e.preventDefault();
    const p = payables.find((x) => x.id === paymentForm.id);
    if (!files.proof.length && !(p?.comprovantes || []).length) { toast('Anexe o comprovante de pagamento.'); return; }
    setPayables((prev) => {
      let arr = prev.map((it) => it.id !== paymentForm.id ? it : {
        ...it, status: 'Pago', dataPagamento: paymentForm.date, valorPago: num(paymentForm.amount), banco: paymentForm.bank, bancoPagamento: paymentForm.bank,
        houveJuros: paymentForm.hasInterest === 'Sim', jurosPago: paymentForm.hasInterest === 'Sim' ? num(paymentForm.interestValue) : 0, motivoJuros: paymentForm.hasInterest === 'Sim' ? paymentForm.interestReason : '',
        comprovantes: files.proof.length ? files.proof : it.comprovantes, pagamentoObs: paymentForm.obs,
      });
      const paid = arr.find((x) => x.id === paymentForm.id);
      if (paid?.parentId) arr = updateParentArr(arr, paid.parentId);
      return arr;
    });
    pushHist('Conta paga', `${paymentForm.id} paga em ${br(paymentForm.date)} pelo banco ${paymentForm.bank}.`); setModal(null); toast('Pagamento registrado.');
  };

  const submitMeasurement = (e: any) => {
    e.preventDefault();
    const o = os.find((x) => x.numero === medForm.os);
    if (!o) { toast('Selecione uma OS.'); return; }
    const r = { id: genId('SNF', nfeReqs), os: o.numero, empresa: o.empresa, cliente: o.cliente, valor: num(medForm.valor), forma: medForm.forma, dataEmitir: medForm.data, tipoNfe: medForm.tipo, status: 'Aguardando emissão', anexos: files.med, obs: medForm.obs };
    setNfeReqs((p) => [r, ...p]); pushHist('Solicitação de NFe criada', `${r.id} criada a partir da ${r.os}.`); setModal(null); setSection('nfe'); toast('Solicitação de NFe criada.');
  };

  const submitNfe = (e: any) => {
    e.preventDefault();
    if (!files.nfe.length) { toast('Anexe a NFe emitida antes de arquivar.'); return; }
    if (!nfeForm.vencimento) { toast('Informe o vencimento do recebimento.'); return; }
    const t = nfeCalc;
    const n = { id: Date.now(), empresa: nfeForm.empresa, cliente: nfeForm.cliente, numero: nfeForm.numero, emissao: nfeForm.emissao, original: t.original, liquido: t.liquido, vencimento: nfeForm.vencimento, contrato: nfeForm.contrato, arquivos: files.nfe, sourceReq: nfeForm.reqId };
    setNfes((p) => [n, ...p]);
    setNfeReqs((p) => p.map((x) => (x.id === n.sourceReq ? { ...x, status: 'Emitida e arquivada', nfeNumero: n.numero } : x)));
    setReceivables((p) => [{ id: genId('CR', p), origem: 'NFe', empresa: n.empresa, cliente: n.cliente, referencia: n.numero, valorOriginal: t.original, valorLiquido: t.liquido, vencimentoRecebimento: n.vencimento, recebido: num(nfeForm.baixado) >= t.liquido && t.liquido > 0, dataRecebimento: '', valorRecebido: num(nfeForm.baixado), bancoRecebimento: 'A definir no Contas a Receber', observacao: `Criada pela NFe ${n.numero}.` }, ...p]);
    pushHist('NFe emitida', `${n.numero} emitida e Conta a Receber criada.`); setModal(null); setSection('receber'); toast('NFe arquivada e Conta a Receber criada.');
  };

  const submitRecManual = (e: any) => {
    e.preventDefault();
    const r = { id: genId('CR', receivables), origem: 'Manual', empresa: recForm.empresa, cliente: recForm.cliente, referencia: recForm.ref || 'Manual', valorOriginal: num(recForm.original), valorLiquido: num(recForm.liquido || recForm.original), vencimentoRecebimento: recForm.vencimento, recebido: recForm.recebido === 'Sim', dataRecebimento: recForm.data, valorRecebido: num(recForm.valorRecebido), bancoRecebimento: recForm.banco, observacao: recForm.obs };
    setReceivables((p) => [r, ...p]); pushHist('Conta a receber manual', `${r.id} criada para ${r.cliente}.`); setModal(null); toast('Conta a receber adicionada.');
  };
  const submitRecEdit = (e: any) => {
    e.preventDefault();
    setReceivables((p) => p.map((r) => (r.id !== recEditForm.id ? r : { ...r, recebido: recEditForm.recebido === 'Sim', dataRecebimento: recEditForm.data, valorRecebido: num(recEditForm.valor), bancoRecebimento: recEditForm.banco, vencimentoRecebimento: recEditForm.venc, observacao: recEditForm.obs })));
    pushHist('Conta a receber atualizada', `${recEditForm.id} atualizada.`); setModal(null); toast('Recebimento atualizado.');
  };

  const submitBank = (e: any) => { e.preventDefault(); setBanks((p) => [...p, { nome: bankForm.nome, empresa: bankForm.empresa, tipo: bankForm.tipo, pix: bankForm.pix || '-' }]); pushHist('Banco cadastrado', `${bankForm.nome} cadastrado.`); setBankForm({ empresa: 'Linave', tipo: 'Conta corrente' }); toast('Banco cadastrado.'); };
  const submitDept = (e: any) => { e.preventDefault(); setDepts((p) => [...p, { nome: deptForm.nome, empresa: deptForm.empresa, email: deptForm.email || '-' }]); pushHist('Departamento cadastrado', `${deptForm.nome} cadastrado.`); setDeptForm({ empresa: 'Linave' }); toast('Departamento cadastrado.'); };
  const submitLocStudy = (e: any) => {
    e.preventDefault();
    const l = { empresa: locForm.empresa, tipo: locForm.tipo, unidade: locForm.unidade, vinculaOS: locForm.vinculaOS, inicio: locForm.inicio, termino: locForm.termino, medicao: locForm.medicao, cobranca: locForm.cobranca, financeiro: locForm.financeiro, docs: locForm.docs };
    setLocStudies((p) => [l, ...p]); pushHist('Estudo de locação salvo', `Estudo (${l.tipo} / ${l.unidade}) registrado.`); setLocForm({ empresa: 'Linave', tipo: 'Equipamento', unidade: 'Diária', vinculaOS: 'Sim' }); toast('Estudo de locação salvo.');
  };

  // detalhes
  const viewOS = (o: any) => setDetail({ title: `OS ${o.numero}`, body: (<><div className="grid g3"><div className="kpi"><span>Cliente</span><strong>{o.cliente}</strong></div><div className="kpi"><span>Valor</span><strong>{brl.format(o.valor)}</strong></div><div className="kpi"><span>Status</span><strong>{o.status}</strong></div></div><div className="panel" style={{ marginTop: 14 }}><p><b>Empresa:</b> {o.empresa}</p><p><b>Término:</b> {br(o.dataTermino)}</p><p><b>Descrição:</b> {o.descricao || '-'}</p></div></>) });
  const viewReq = (r: any) => setDetail({ title: `Solicitação ${r.id}`, body: (<div className="panel"><p><b>Solicitante:</b> {r.solicitante}</p><p><b>Vínculo:</b> {r.vinculoTipo}: {r.vinculoValor}</p><p><b>Fornecedor:</b> {r.fornecedor}</p><p><b>Valor:</b> {brl.format(r.valor)}</p><p><b>Anexos:</b> {(r.anexos || []).join(', ') || '-'}</p><p><b>Descrição:</b> {r.descricao || '-'}</p></div>) });
  const viewPay = (p: any) => {
    const kids = payables.filter((x) => x.parentId === p.id);
    setDetail({ title: `Conta a Pagar ${p.id}`, body: (<><div className="grid g3"><div className="kpi"><span>Valor</span><strong>{brl.format(p.valor)}</strong></div><div className="kpi"><span>Status</span><strong>{p.status}</strong></div><div className="kpi"><span>Banco</span><strong>{p.banco}</strong></div></div><div className="panel" style={{ marginTop: 14 }}><p><b>Fornecedor:</b> {p.fornecedor}</p><p><b>Vencimento:</b> {br(p.vencimento)}</p><p><b>Pago em:</b> {p.dataPagamento ? br(p.dataPagamento) : '-'}</p><p><b>Valor pago:</b> {p.valorPago ? brl.format(p.valorPago) : '-'}</p><p><b>Juros:</b> {p.jurosPago ? brl.format(p.jurosPago) : 'Não houve'}</p><p><b>Comprovantes:</b> {(p.comprovantes || []).join(', ') || '-'}</p></div>{kids.length ? (<><h3 style={{ marginTop: 14 }}>Parcelas</h3><div className="table"><table><thead><tr><th>ID</th><th>Parcela</th><th>Valor</th><th>Status</th></tr></thead><tbody>{kids.map((k) => (<tr key={k.id}><td>{k.id}</td><td>{k.parcela}</td><td>{brl.format(k.valor)}</td><td>{statusTag(k.status)}</td></tr>))}</tbody></table></div></>) : null}</>) });
  };
  const viewNfeReq = (r: any) => setDetail({ title: `Solicitação de NFe ${r.id}`, body: (<div className="panel"><p><b>OS:</b> {r.os}</p><p><b>Cliente:</b> {r.cliente}</p><p><b>Valor:</b> {brl.format(r.valor)}</p><p><b>Data para emitir:</b> {br(r.dataEmitir)}</p><p><b>Anexos:</b> {(r.anexos || []).join(', ') || '-'}</p></div>) });

  // export
  const download = (txt: string, name: string, type: string) => { const blob = new Blob([txt], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };
  const exportPayables = () => {
    const h = ['TIPO', 'ID', 'MAE', 'PARCELA', 'EMPRESA', 'VINCULO', 'FORNECEDOR', 'DOCUMENTO', 'VALOR', 'VENCIMENTO', 'BANCO', 'STATUS', 'DATA PAGAMENTO', 'VALOR PAGO', 'JUROS', 'ANEXOS'];
    const rows = payables.filter(byFilters).map((p) => [p.type, p.id, p.parentId || '', p.parcela, p.empresa, `${p.vinculoTipo}: ${p.vinculoValor}`, p.fornecedor, p.documento, p.valor, p.vencimento, p.banco, p.status, p.dataPagamento, p.valorPago, p.jurosPago, (p.anexos || []).join('|')]);
    download([h, ...rows].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n'), 'contas_a_pagar.csv', 'text/csv;charset=utf-8');
  };
  const exportHistory = () => download(hist.map((h) => `${h.date} | ${h.user} | ${h.title} | ${h.detail}`).join('\n'), 'historico_financeiro.txt', 'text/plain;charset=utf-8');

  // ---------- Derivados ----------
  const paysDash = payables.filter(byFilters).filter((p) => p.type !== 'parent');
  const recsDash = receivables.filter(byFilters);
  const kPayOpen = paysDash.filter((p) => p.status !== 'Pago').length;
  const kPayTotal = brl.format(paysDash.filter((p) => p.status !== 'Pago').reduce((s, p) => s + p.valor, 0));
  const kRecTotal = brl.format(recsDash.filter((r) => !r.recebido).reduce((s, r) => s + r.valorLiquido, 0));
  const kRecOver = brl.format(recsDash.filter((r) => recStatus(r) === 'Vencido').reduce((s, r) => s + Math.max(0, r.valorLiquido - r.valorRecebido), 0));
  const chart = (e: string) => {
    const pays = payables.filter((p) => p.empresa === e && p.type !== 'parent' && byPeriod(p) && byBank(p));
    const recs = receivables.filter((r) => r.empresa === e && byPeriod(r) && byBank(r));
    const oss = os.filter((o) => o.empresa === e && byPeriod(o) && !['Finalizada', 'Cancelada'].includes(o.status));
    const a: [string, number][] = [['A pagar', pays.filter((p) => p.status !== 'Pago').reduce((s, p) => s + p.valor, 0)], ['A receber', recs.filter((r) => !r.recebido).reduce((s, r) => s + r.valorLiquido, 0)], ['Previsão OS', oss.reduce((s, o) => s + o.valor, 0)]];
    const max = Math.max(...a.map((x) => x[1]), 1);
    return a.map(([l, v]) => (<div className="barrow" key={l}><b>{l}</b><div className="track"><div className="bar" style={{ width: `${Math.max(5, (v / max) * 100)}%` }} /></div><span>{brl.format(v)}</span></div>));
  };
  const forecastRows = os.filter(byFilters).filter((o) => !['Finalizada', 'Cancelada'].includes(o.status));
  const prevTotal = forecastRows.reduce((s, o) => s + o.valor, 0);
  const prevOver = forecastRows.filter((o) => isOld(o.dataTermino)).reduce((s, o) => s + o.valor, 0);

  // ---------- Render ----------
  return (
    <FinCtx.Provider value={{ modal, setModal, files, onFiles }}>
    <div className="fin-root">
      <style>{CSS}</style>
      <div className="app">
        <aside>
          <div className="brand"><div className="mark">LF</div><div><strong>Super App Financeiro</strong><small>Linave / Servinave</small></div></div>
          {NAV.map((g) => (
            <React.Fragment key={g.group}>
              <div className="navlabel">{g.group}</div>
              {g.items.map((it) => (
                <button key={it.id} className={`nav ${section === it.id ? 'active' : ''}`} onClick={() => setSection(it.id)}>
                  <span className="ico">{it.icon}</span> {it.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </aside>

        <main>
          <header className="top">
            <div><h1>{TITLES[section][0]}</h1><p>{TITLES[section][1]}</p></div>
            <div className="filters">
              <select className="filter" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}><option value="Todas">Todas as empresas</option><option>Linave</option><option>Servinave</option></select>
              <select className="filter" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}><option value="Todos">Todos os bancos</option>{banks.map((b) => <option key={b.nome} value={b.nome}>{b.nome}</option>)}</select>
              <select className="filter" value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}><option value="all">Todo período</option><option value="range">Data inicial e final</option><option value="month">Mês específico</option><option value="year">Ano específico</option></select>
              {periodMode === 'range' && (<><input className="filter" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /><input className="filter" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></>)}
              {periodMode === 'month' && <input className="filter" type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />}
              {periodMode === 'year' && <input className="filter" type="number" min={2000} max={2100} value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} />}
              <button className="btn yellow" onClick={() => openMeasurement()}>+ Medição aprovada</button>
            </div>
          </header>

          {/* DASHBOARD */}
          {section === 'dashboard' && (
            <div>
              <div className="grid g4">
                <div className="card metric"><div className="label">A pagar em aberto</div><div className="value">{kPayOpen}</div><div className="foot">Contas e parcelas pendentes</div></div>
                <div className="card metric"><div className="label">Total a pagar</div><div className="value">{kPayTotal}</div><div className="foot">Filtrado por período/banco</div></div>
                <div className="card metric"><div className="label">A receber</div><div className="value">{kRecTotal}</div><div className="foot">NFe, manual e locação</div></div>
                <div className="card metric"><div className="label">Recebimentos vencidos</div><div className="value">{kRecOver}</div><div className="foot">Vencimento menor que hoje</div></div>
              </div>
              <div className="card" style={{ marginTop: 14 }}>
                <div className="toolbar"><div><h2>Resumo por empresa</h2><p className="hint">Linave e Servinave separados.</p></div></div>
                <div className="grid g2"><div className="panel"><h3>Linave</h3><div>{chart('Linave')}</div></div><div className="panel"><h3>Servinave</h3><div>{chart('Servinave')}</div></div></div>
              </div>
            </div>
          )}

          {/* OS */}
          {section === 'os' && (
            <div className="card">
              <div className="toolbar"><div><h2>OS Emitidas</h2><p className="hint">Base para previsão, NFe, locação e solicitações.</p></div><button className="btn yellow" onClick={openOs}>+ Adicionar OS</button></div>
              <div className="table"><table style={{ minWidth: 1000 }}><thead><tr><th>OS</th><th>Empresa</th><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Data término</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{os.filter(byFilters).map((o) => (<tr key={o.numero} className={isOld(o.dataTermino) && !['Finalizada', 'Cancelada'].includes(o.status) ? 'overdue' : ''}><td><b>{o.numero}</b></td><td>{companyTag(o.empresa)}</td><td>{o.cliente}</td><td>{o.descricao || '-'}</td><td>{brl.format(o.valor)}</td><td>{br(o.dataTermino)}</td><td>{statusTag(o.status)}</td><td><button className="btn small yellow" onClick={() => openMeasurement(o.numero)}>Solicitar NFe</button> <button className="btn small secondary" onClick={() => viewOS(o)}>Ver mais</button></td></tr>))}</tbody></table></div>
            </div>
          )}

          {/* SOLICITACAO */}
          {section === 'solicitacao' && (
            <div className="card"><h2>Solicitação de Pagamento</h2><p className="hint">Sem regra de cotação. Banco só entra em Contas a Pagar.</p>
              <form className="form" style={{ marginTop: 14 }} onSubmit={submitReq}>
                <div className="f3"><label>Empresa</label><select {...bind(reqForm, setReqForm, 'empresa')}><option>Linave</option><option>Servinave</option></select></div>
                <div className="f3"><label>Solicitante</label><input required {...bind(reqForm, setReqForm, 'solicitante')} /></div>
                <div className="f3"><label>Tipo</label><select {...bind(reqForm, setReqForm, 'tipo')}><option>Passagem</option><option>Almoço</option><option>Abastecimento</option><option>Fornecedor</option><option>Material</option><option>Outro</option></select></div>
                <div className="f3"><label>Vincular a</label><select {...bind(reqForm, setReqForm, 'vinculoTipo')}><option value="OS">OS emitida</option><option value="Departamento">Departamento</option></select></div>
                {reqForm.vinculoTipo === 'Departamento'
                  ? <div className="f3"><label>Departamento</label><select {...bind(reqForm, setReqForm, 'departamento')}>{depts.map((d) => <option key={d.nome}>{d.nome}</option>)}</select></div>
                  : <div className="f3"><label>OS emitida</label><select {...bind(reqForm, setReqForm, 'os')}>{osOptions.map((o) => <option key={o.numero} value={o.numero}>{o.numero} - {o.cliente}</option>)}</select></div>}
                <div className="f6"><label>Fornecedor / beneficiário</label><input required {...bind(reqForm, setReqForm, 'fornecedor')} /></div>
                <div className="f3"><label>Documento</label><input {...bind(reqForm, setReqForm, 'documento')} /></div>
                <div className="f3"><label>Valor</label><input type="number" step="0.01" required {...bind(reqForm, setReqForm, 'valor')} /></div>
                <div className="f3"><label>Data compra</label><input type="date" required {...bind(reqForm, setReqForm, 'compra')} /></div>
                <div className="f3"><label>Vencimento</label><input type="date" required {...bind(reqForm, setReqForm, 'vencimento')} /></div>
                <div className="f6"><label>Forma solicitada</label><input {...bind(reqForm, setReqForm, 'forma')} /></div>
                <FileBox k="req" label="Anexar NF, boleto, recibo, PDF ou foto" />
                <div className="full"><label>Descrição</label><textarea {...bind(reqForm, setReqForm, 'desc')} /></div>
                <div className="full"><button className="btn yellow">Enviar para aprovação</button></div>
              </form>
            </div>
          )}

          {/* APROVACOES */}
          {section === 'aprovacoes' && (
            <div className="card"><h2>Aprovações</h2><p className="hint">Aprovar transforma a solicitação em Conta a Pagar.</p>
              <div className="table" style={{ marginTop: 14 }}><table style={{ minWidth: 1100 }}><thead><tr><th>Solicitação</th><th>Empresa</th><th>Solicitante</th><th>Vínculo</th><th>Fornecedor</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{reqs.filter(byFilters).map((r) => (<tr key={r.id}><td><b>{r.id}</b></td><td>{companyTag(r.empresa)}</td><td>{r.solicitante}</td><td>{r.vinculoTipo}: {r.vinculoValor}</td><td>{r.fornecedor}</td><td>{brl.format(r.valor)}</td><td>{br(r.vencimento)}</td><td>{statusTag(r.status)}</td><td><button className="btn small secondary" onClick={() => viewReq(r)}>Ver mais</button> {r.status === 'Aguardando aprovação' && (<><button className="btn small green" onClick={() => approveReq(r.id)}>Aprovar</button> <button className="btn small red" onClick={() => rejectReq(r.id)}>Reprovar</button></>)}</td></tr>))}</tbody></table></div>
            </div>
          )}

          {/* PAGAR */}
          {section === 'pagar' && (
            <div className="card">
              <div className="toolbar"><div><h2>Contas a Pagar</h2><p className="hint">Adicionar, editar, parcelar, pagar com banco, juros e comprovante obrigatório.</p></div><div className="actions"><button className="btn yellow" onClick={() => openPayable()}>+ Conta a pagar</button><button className="btn secondary" onClick={exportPayables}>Exportar CSV</button></div></div>
              <div className="table"><table style={{ minWidth: 1650 }}><thead><tr><th>Tipo</th><th>ID</th><th>Mãe</th><th>Parcela</th><th>Empresa</th><th>Vínculo</th><th>Fornecedor</th><th>Doc</th><th>Valor</th><th>Vencimento</th><th>Banco</th><th>Status</th><th>Pago em</th><th>Valor pago</th><th>Juros</th><th>Comprovante</th><th>Ação</th></tr></thead>
                <tbody>{payables.filter(byFilters).map((p) => (<tr key={p.id}><td>{typeTag(p.type)}</td><td><b>{p.id}</b></td><td>{p.parentId || '-'}</td><td>{p.parcela}</td><td>{companyTag(p.empresa)}</td><td>{p.vinculoTipo}: {p.vinculoValor || '-'}</td><td>{p.fornecedor}</td><td>{p.documento || '-'}</td><td>{brl.format(p.valor)}</td><td>{br(p.vencimento)}</td><td>{p.banco}</td><td>{statusTag(p.status)}</td><td>{p.dataPagamento ? br(p.dataPagamento) : '-'}</td><td>{p.valorPago ? brl.format(p.valorPago) : '-'}</td><td>{p.jurosPago ? brl.format(p.jurosPago) : '-'}</td><td>{(p.comprovantes || []).length ? <span className="tag ok">{p.comprovantes.length}</span> : '-'}</td><td><button className="btn small secondary" onClick={() => viewPay(p)}>Ver mais</button> {p.type !== 'parent' && <button className="btn small yellow" onClick={() => openPayable(p.id, 'edit')}>Editar</button>} {p.type !== 'parent' && p.status !== 'Pago' && (<><button className="btn small blue" onClick={() => openPayable(p.id, 'parcel')}>Parcelar</button> <button className="btn small green" onClick={() => openPayment(p.id)}>Pagar</button></>)}</td></tr>))}</tbody></table></div>
            </div>
          )}

          {/* NFE */}
          {section === 'nfe' && (
            <div className="card">
              <div className="toolbar"><div><h2>Solicitações e Emissão de NFe</h2><p className="hint">A medição aprovada cria solicitação. Cálculos só abrem ao clicar em Emitir NFe.</p></div><button className="btn yellow" onClick={() => openMeasurement()}>+ Solicitar NFe</button></div>
              <div className="alert">Toda NFe emitida exige vencimento do recebimento e anexo da NFe emitida. Ao arquivar, cria Conta a Receber.</div>
              <div className="table"><table style={{ minWidth: 1200 }}><thead><tr><th>Solicitação</th><th>OS</th><th>Empresa</th><th>Cliente</th><th>Valor</th><th>Forma recebimento</th><th>Data emitir</th><th>Tipo NFe</th><th>Status</th><th>Anexos</th><th>Ação</th></tr></thead>
                <tbody>{nfeReqs.filter(byFilters).map((r) => (<tr key={r.id}><td><b>{r.id}</b></td><td>{r.os}</td><td>{companyTag(r.empresa)}</td><td>{r.cliente}</td><td>{brl.format(r.valor)}</td><td>{r.forma}</td><td>{br(r.dataEmitir)}</td><td>{r.tipoNfe}</td><td>{statusTag(r.status)}</td><td>{(r.anexos || []).length ? <span className="tag info">{r.anexos.length}</span> : '-'}</td><td><button className="btn small secondary" onClick={() => viewNfeReq(r)}>Ver mais</button> {r.status === 'Aguardando emissão' && <button className="btn small yellow" onClick={() => openNfe(r.id)}>Emitir NFe</button>}</td></tr>))}</tbody></table></div>
            </div>
          )}

          {/* RECEBER */}
          {section === 'receber' && (
            <div className="card">
              <div className="toolbar"><div><h2>Contas a Receber</h2><p className="hint">Por NFe, locação ou manual. Banco é definido aqui.</p></div><button className="btn yellow" onClick={openRecManual}>+ Conta a receber</button></div>
              {receivables.filter(byFilters).filter((r) => recStatus(r) === 'Vencido').length > 0 && (<div className="alert">⚠️ Existem {receivables.filter(byFilters).filter((r) => recStatus(r) === 'Vencido').length} conta(s) a receber vencida(s).</div>)}
              <div className="table"><table style={{ minWidth: 1400 }}><thead><tr><th>Origem</th><th>Empresa</th><th>Cliente</th><th>Referência</th><th>Original</th><th>Líquido</th><th>Vencimento</th><th>Recebido?</th><th>Data receb.</th><th>Valor recebido</th><th>Banco</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{receivables.filter(byFilters).map((r) => { const st = recStatus(r); return (<tr key={r.id} className={st === 'Vencido' ? 'overdue' : ''}><td>{r.origem}</td><td>{companyTag(r.empresa)}</td><td>{r.cliente}</td><td>{r.referencia}</td><td>{brl.format(r.valorOriginal)}</td><td>{brl.format(r.valorLiquido)}</td><td>{br(r.vencimentoRecebimento)}</td><td>{r.recebido ? 'Sim' : 'Não'}</td><td>{r.dataRecebimento ? br(r.dataRecebimento) : '-'}</td><td>{r.valorRecebido ? brl.format(r.valorRecebido) : '-'}</td><td>{r.bancoRecebimento}</td><td>{statusTag(st)}</td><td><button className="btn small yellow" onClick={() => openRecEdit(r.id)}>Editar recebimento</button></td></tr>); })}</tbody></table></div>
            </div>
          )}

          {/* LOCACAO (estudo) */}
          {section === 'locacao' && (
            <div className="grid-2">
              <div className="card">
                <div className="card-header"><div><h2>Locação | Módulo em estudo</h2><p className="hint">Esta área não deve gerar cobranças automaticamente ainda. Primeiro é necessário levantar as regras de negócio da locação.</p></div></div>
                <div className="notice">Antes de criar o fluxo definitivo de locação, precisamos entender como a empresa cobra, mede, renova, encerra e emite documentos para cada tipo de locação.</div>
                <form className="form-grid" onSubmit={submitLocStudy}>
                  <div className="field sm"><label>Empresa</label><select {...bind(locForm, setLocForm, 'empresa')}><option>Linave</option><option>Servinave</option><option>Ambas</option></select></div>
                  <div className="field sm"><label>Tipo de locação</label><select {...bind(locForm, setLocForm, 'tipo')}><option>Equipamento</option><option>Mão de obra / equipe alocada</option><option>Embarcação</option><option>Ferramenta</option><option>Serviço recorrente</option><option>Outro</option></select></div>
                  <div className="field sm"><label>Unidade de cobrança</label><select {...bind(locForm, setLocForm, 'unidade')}><option>Diária</option><option>Semanal</option><option>Quinzenal</option><option>Mensal</option><option>Por medição</option><option>Por evento</option></select></div>
                  <div className="field sm"><label>Vincula OS?</label><select {...bind(locForm, setLocForm, 'vinculaOS')}><option>Sim</option><option>Não</option><option>Depende do caso</option></select></div>
                  <div className="field lg"><label>Como começa a locação?</label><textarea placeholder="Ex.: contrato assinado, P.O aprovada, entrega do equipamento, mobilização da equipe..." {...bind(locForm, setLocForm, 'inicio')} /></div>
                  <div className="field lg"><label>Como termina a locação?</label><textarea placeholder="Ex.: devolução, aceite do cliente, desmobilização, fim da OS, encerramento contratual..." {...bind(locForm, setLocForm, 'termino')} /></div>
                  <div className="field lg"><label>Como é feita a medição?</label><textarea placeholder="Ex.: por dias corridos, dias úteis, horas, relatório mensal, boletim de medição aprovado..." {...bind(locForm, setLocForm, 'medicao')} /></div>
                  <div className="field lg"><label>Quando vira cobrança?</label><textarea placeholder="Ex.: no início do mês, fim do mês, após medição aprovada, após emissão de NFe..." {...bind(locForm, setLocForm, 'cobranca')} /></div>
                  <div className="field lg"><label>Regras financeiras</label><textarea placeholder="Ex.: vencimento, caução, multa, juros, reajuste, desconto, cobrança parcial, pró-rata..." {...bind(locForm, setLocForm, 'financeiro')} /></div>
                  <div className="field lg"><label>Documentos necessários</label><textarea placeholder="Ex.: contrato, P.O, termo de entrega, termo de devolução, relatório, NFe, comprovantes..." {...bind(locForm, setLocForm, 'docs')} /></div>
                  <div className="field full"><button className="btn yellow" type="submit">Salvar estudo de locação</button></div>
                </form>
              </div>
              <div className="card">
                <div className="toolbar"><div><h2>Pontos que precisam ser definidos</h2><p className="hint">Checklist de entendimento antes de desenvolver o módulo definitivo.</p></div></div>
                <div className="grid">
                  <div className="soft-panel"><strong>1. Cadastro da locação</strong><p className="hint">Quais campos são obrigatórios: cliente, OS, contrato/P.O, item locado, data início, data fim, valor, unidade de cobrança e responsável.</p></div>
                  <div className="soft-panel"><strong>2. Regra de cobrança</strong><p className="hint">Se a cobrança é mensal, diária, por medição, antecipada, pós-paga, por período fechado ou proporcional.</p></div>
                  <div className="soft-panel"><strong>3. Integração com NFe</strong><p className="hint">Definir se a locação gera solicitação de NFe, quando gera e qual documento aprova a emissão.</p></div>
                  <div className="soft-panel"><strong>4. Integração com Contas a Receber</strong><p className="hint">Definir se cria recebíveis automaticamente ou somente depois da NFe emitida.</p></div>
                  <div className="soft-panel"><strong>5. Encerramento da locação</strong><p className="hint">Como tratar devolução, avaria, multa, cobrança extra, cancelamento e encerramento parcial.</p></div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <h3>Estudos salvos</h3>
                  <div className="table-wrap" style={{ marginTop: 12, maxHeight: 300 }}>
                    <table style={{ minWidth: 900 }}><thead><tr><th>Empresa</th><th>Tipo</th><th>Unidade</th><th>Vincula OS?</th><th>Resumo cobrança</th></tr></thead>
                      <tbody>{locStudies.length === 0 ? (<tr><td colSpan={5} style={{ color: '#667085' }}>Nenhum estudo salvo ainda.</td></tr>) : locStudies.map((l, i) => (<tr key={i}><td>{companyTag(l.empresa)}</td><td>{l.tipo}</td><td>{l.unidade}</td><td>{l.vinculaOS}</td><td>{l.cobranca || '-'}</td></tr>))}</tbody></table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PREVISAO */}
          {section === 'previsao' && (
            <div className="card"><h2>Previsão de Receita</h2><p className="hint">Vem das OS abertas: data de término e valor total.</p>
              <div className="grid g3" style={{ margin: '14px 0' }}><div className="kpi"><span>Valor OS abertas</span><strong>{brl.format(prevTotal)}</strong></div><div className="kpi"><span>Término vencido</span><strong>{brl.format(prevOver)}</strong></div><div className="kpi"><span>OS futuras</span><strong>{brl.format(prevTotal - prevOver)}</strong></div></div>
              <div className="table"><table style={{ minWidth: 1050 }}><thead><tr><th>Término</th><th>Empresa</th><th>Cliente</th><th>OS</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Alerta</th></tr></thead>
                <tbody>{forecastRows.map((o) => (<tr key={o.numero} className={isOld(o.dataTermino) ? 'overdue' : ''}><td>{br(o.dataTermino)}</td><td>{companyTag(o.empresa)}</td><td>{o.cliente}</td><td>{o.numero}</td><td>{o.descricao || '-'}</td><td>{brl.format(o.valor)}</td><td>{statusTag(o.status)}</td><td>{isOld(o.dataTermino) ? <span className="tag bad">Término vencido</span> : <span className="tag wait">Previsto</span>}</td></tr>))}</tbody></table></div>
            </div>
          )}

          {/* BANCOS */}
          {section === 'bancos' && (
            <div className="grid g2">
              <div className="card"><h2>Cadastro de Bancos</h2>
                <form className="form" style={{ marginTop: 14 }} onSubmit={submitBank}>
                  <div className="f6"><label>Banco</label><input required {...bind(bankForm, setBankForm, 'nome')} /></div>
                  <div className="f3"><label>Empresa</label><select {...bind(bankForm, setBankForm, 'empresa')}><option>Linave</option><option>Servinave</option><option>Ambas</option></select></div>
                  <div className="f3"><label>Tipo</label><select {...bind(bankForm, setBankForm, 'tipo')}><option>Conta corrente</option><option>Conta pagamento</option><option>Caixa interno</option></select></div>
                  <div className="f6"><label>PIX</label><input {...bind(bankForm, setBankForm, 'pix')} /></div>
                  <div className="full"><button className="btn yellow">Cadastrar banco</button></div>
                </form>
              </div>
              <div className="card"><h2>Bancos cadastrados</h2><div className="table" style={{ marginTop: 14 }}><table><thead><tr><th>Banco</th><th>Empresa</th><th>Tipo</th><th>PIX</th></tr></thead><tbody>{banks.filter(byFilters).map((b) => (<tr key={b.nome}><td><b>{b.nome}</b></td><td>{companyTag(b.empresa)}</td><td>{b.tipo}</td><td>{b.pix || '-'}</td></tr>))}</tbody></table></div></div>
            </div>
          )}

          {/* DEPARTAMENTOS */}
          {section === 'departamentos' && (
            <div className="grid g2">
              <div className="card"><h2>Departamentos</h2>
                <form className="form" style={{ marginTop: 14 }} onSubmit={submitDept}>
                  <div className="f6"><label>Departamento</label><input required {...bind(deptForm, setDeptForm, 'nome')} /></div>
                  <div className="f3"><label>Empresa</label><select {...bind(deptForm, setDeptForm, 'empresa')}><option>Linave</option><option>Servinave</option><option>Ambas</option></select></div>
                  <div className="f3"><label>E-mail aprovador</label><input type="email" {...bind(deptForm, setDeptForm, 'email')} /></div>
                  <div className="full"><button className="btn yellow">Cadastrar departamento</button></div>
                </form>
              </div>
              <div className="card"><h2>Departamentos cadastrados</h2><div className="table" style={{ marginTop: 14 }}><table><thead><tr><th>Departamento</th><th>Empresa</th><th>E-mail</th></tr></thead><tbody>{depts.filter(byFilters).map((d) => (<tr key={d.nome}><td><span className="tag wait">{d.nome}</span></td><td>{companyTag(d.empresa)}</td><td>{d.email || '-'}</td></tr>))}</tbody></table></div></div>
            </div>
          )}

          {/* HISTORICO */}
          {section === 'historico' && (
            <div className="card"><div className="toolbar"><div><h2>Histórico</h2><p className="hint">Rastreamento de todas as ações.</p></div><button className="btn secondary" onClick={exportHistory}>Exportar histórico</button></div>
              <div className="grid">{hist.map((h, i) => (<div className="panel" key={i}><b>{h.title}</b><p className="hint">{h.detail}</p><small><b>{h.user}</b> • {h.date}</small></div>))}</div>
            </div>
          )}
        </main>
      </div>

      {/* MODAIS */}
      <Modal id="os" title="Adicionar OS Emitida" hint="Base para previsão, NFe, locação e pagamentos.">
        <form className="form" onSubmit={submitOs}>
          <div className="f3"><label>Número OS</label><input required {...bind(osForm, setOsForm, 'numero')} /></div>
          <div className="f3"><label>Empresa</label><select {...bind(osForm, setOsForm, 'empresa')}><option>Linave</option><option>Servinave</option></select></div>
          <div className="f6"><label>Cliente</label><input required {...bind(osForm, setOsForm, 'cliente')} /></div>
          <div className="f3"><label>Valor</label><input type="number" step="0.01" required {...bind(osForm, setOsForm, 'valor')} /></div>
          <div className="f3"><label>Data término</label><input type="date" required {...bind(osForm, setOsForm, 'data')} /></div>
          <div className="f3"><label>Status</label><select {...bind(osForm, setOsForm, 'status')}><option>Aberta</option><option>Em andamento</option><option>Medição aprovada</option><option>Finalizada</option><option>Cancelada</option></select></div>
          <div className="full"><label>Descrição</label><textarea {...bind(osForm, setOsForm, 'desc')} /></div>
          <div className="full"><button className="btn yellow">Salvar OS</button></div>
        </form>
      </Modal>

      <Modal id="measurement" title="Medição aprovada — Solicitação de NFe" hint="Cria solicitação com data para emitir.">
        <div className="alert">Não emite a nota ainda. A solicitação aparecerá na aba NFe.</div>
        <form className="form" onSubmit={submitMeasurement}>
          <div className="f3"><label>Empresa</label><select {...bind(medForm, setMedForm, 'empresa')}><option>Linave</option><option>Servinave</option></select></div>
          <div className="f3"><label>OS emitida</label><select value={medForm.os || ''} onChange={(e) => { const o = os.find((x) => x.numero === e.target.value); setMedForm((p: any) => ({ ...p, os: e.target.value, empresa: o?.empresa || p.empresa, valor: o?.valor ?? p.valor })); }}>{osOptions.map((o) => <option key={o.numero} value={o.numero}>{o.numero} - {o.cliente}</option>)}</select></div>
          <div className="f3"><label>Valor NFe</label><input type="number" step="0.01" required {...bind(medForm, setMedForm, 'valor')} /></div>
          <div className="f3"><label>Data para emitir NFe</label><input type="date" required {...bind(medForm, setMedForm, 'data')} /></div>
          <div className="f6"><label>Forma pagamento/recebimento</label><input required {...bind(medForm, setMedForm, 'forma')} /></div>
          <div className="f3"><label>Tipo NFe</label><select {...bind(medForm, setMedForm, 'tipo')}><option>NFe Serviço</option><option>NFe Alocado</option><option>Nota de débito</option><option>Outro</option></select></div>
          <div className="full"><div className="panel">{(() => { const o = os.find((x) => x.numero === medForm.os); if (!o) return 'Selecione uma OS.'; return (<><div className="grid g4"><div className="kpi"><span>OS</span><strong>{o.numero}</strong></div><div className="kpi"><span>Empresa</span><strong>{o.empresa}</strong></div><div className="kpi"><span>Cliente</span><strong>{o.cliente}</strong></div><div className="kpi"><span>Valor</span><strong>{brl.format(o.valor)}</strong></div></div><p className="hint" style={{ marginTop: 10 }}><b>Descrição:</b> {o.descricao || '-'}</p></>); })()}</div></div>
          <FileBox k="med" label="Anexar medição, relatório ou imagem" />
          <div className="full"><label>Observação</label><textarea {...bind(medForm, setMedForm, 'obs')} /></div>
          <div className="full"><button className="btn yellow">Enviar para NFe</button></div>
        </form>
      </Modal>

      <Modal id="nfe" title="Emitir, anexar e arquivar NFe" hint="Sem Data P.G. Pagamento real fica em Contas a Receber.">
        <form className="form" onSubmit={submitNfe}>
          <div className="f2"><label>Item</label><input type="number" {...bind(nfeForm, setNfeForm, 'item')} /></div>
          <div className="f3"><label>Empresa</label><select {...bind(nfeForm, setNfeForm, 'empresa')}><option>Linave</option><option>Servinave</option></select></div>
          <div className="f6"><label>Cliente</label><input required {...bind(nfeForm, setNfeForm, 'cliente')} /></div>
          <div className="f3"><label>Nr NF</label><input required {...bind(nfeForm, setNfeForm, 'numero')} /></div>
          <div className="f3"><label>Emissão</label><input type="date" required {...bind(nfeForm, setNfeForm, 'emissao')} /></div>
          <div className="f3"><label>Vlr original</label><input type="number" step="0.01" required {...bind(nfeForm, setNfeForm, 'original')} /></div>
          <div className="f3"><label>COFINS %</label><input type="number" step="0.0001" {...bind(nfeForm, setNfeForm, 'pCofins')} /></div>
          <div className="f3"><label>CSLL %</label><input type="number" step="0.0001" {...bind(nfeForm, setNfeForm, 'pCsll')} /></div>
          <div className="f3"><label>INSS %</label><input type="number" step="0.0001" {...bind(nfeForm, setNfeForm, 'pInss')} /></div>
          <div className="f3"><label>IR %</label><input type="number" step="0.0001" {...bind(nfeForm, setNfeForm, 'pIr')} /></div>
          <div className="f3"><label>PIS %</label><input type="number" step="0.0001" {...bind(nfeForm, setNfeForm, 'pPis')} /></div>
          <div className="f3"><label>ISS %</label><input type="number" step="0.0001" {...bind(nfeForm, setNfeForm, 'pIss')} /></div>
          <div className="f3"><label>Baixado</label><input type="number" step="0.01" {...bind(nfeForm, setNfeForm, 'baixado')} /></div>
          <div className="f3"><label>Vlr vencido</label><input type="number" step="0.01" {...bind(nfeForm, setNfeForm, 'vencido')} /></div>
          <div className="f3"><label>Vencimento recebimento</label><input type="date" required {...bind(nfeForm, setNfeForm, 'vencimento')} /></div>
          <div className="f3"><label>Contrato/OS/P.O</label><input {...bind(nfeForm, setNfeForm, 'contrato')} /></div>
          <div className="full"><div className="grid g4"><div className="kpi"><span>COFINS</span><strong>{brl.format(nfeCalc.cofins)}</strong></div><div className="kpi"><span>CSLL</span><strong>{brl.format(nfeCalc.csll)}</strong></div><div className="kpi"><span>Outros</span><strong>{brl.format(nfeCalc.outros)}</strong></div><div className="kpi"><span>Líquido</span><strong>{brl.format(nfeCalc.liquido)}</strong></div></div></div>
          <FileBox k="nfe" label="Anexar obrigatoriamente PDF/XML/imagem da NFe emitida" />
          <div className="full"><button className="btn green">Emitir, anexar e arquivar NFe</button></div>
        </form>
      </Modal>

      <Modal id="payable" title={payForm.id ? (payForm.mode === 'parcel' ? `Parcelar ${payForm.id}` : `Editar ${payForm.id}`) : 'Adicionar Conta a Pagar'} hint="Conta simples ou parcelada.">
        <form className="form" onSubmit={submitPayable}>
          <div className="f3"><label>Empresa</label><select {...bind(payForm, setPayForm, 'empresa')}><option>Linave</option><option>Servinave</option></select></div>
          <div className="f3"><label>Vincular a</label><select {...bind(payForm, setPayForm, 'vinculoTipo')}><option value="OS">OS emitida</option><option value="Departamento">Departamento</option></select></div>
          {payForm.vinculoTipo === 'Departamento'
            ? <div className="f3"><label>Departamento</label><select {...bind(payForm, setPayForm, 'departamento')}>{depts.map((d) => <option key={d.nome}>{d.nome}</option>)}</select></div>
            : <div className="f3"><label>OS</label><select {...bind(payForm, setPayForm, 'os')}>{osOptions.map((o) => <option key={o.numero} value={o.numero}>{o.numero} - {o.cliente}</option>)}</select></div>}
          <div className="f6"><label>Fornecedor</label><input required {...bind(payForm, setPayForm, 'fornecedor')} /></div>
          <div className="f3"><label>Tipo</label><select {...bind(payForm, setPayForm, 'tipo')}><option>Passagem</option><option>Almoço</option><option>Abastecimento</option><option>Fornecedor</option><option>Material</option><option>Outro</option></select></div>
          <div className="f3"><label>Documento</label><input {...bind(payForm, setPayForm, 'documento')} /></div>
          <div className="f3"><label>Valor total</label><input type="number" step="0.01" required {...bind(payForm, setPayForm, 'valor')} /></div>
          <div className="f3"><label>Primeiro vencimento</label><input type="date" required {...bind(payForm, setPayForm, 'vencimento')} /></div>
          <div className="f3"><label>Banco</label><select {...bind(payForm, setPayForm, 'banco')}>{banks.map((b) => <option key={b.nome} value={b.nome}>{b.nome}</option>)}</select></div>
          <div className="f6"><label>Forma</label><input {...bind(payForm, setPayForm, 'forma')} /></div>
          <div className="f3"><label>Parcelar?</label><select {...bind(payForm, setPayForm, 'parcelar')}><option value="Não">Não</option><option value="Sim">Sim</option></select></div>
          {payForm.parcelar === 'Sim' && (<><div className="f3"><label>Nº parcelas</label><input type="number" min={2} {...bind(payForm, setPayForm, 'parcelas')} /></div><div className="f3"><label>Intervalo</label><select {...bind(payForm, setPayForm, 'intervalo')}><option value="30">Mensal</option><option value="15">Quinzenal</option><option value="7">Semanal</option></select></div></>)}
          <FileBox k="pay" label="Anexar boleto/NF/documento" />
          <div className="full"><label>Observação</label><textarea {...bind(payForm, setPayForm, 'obs')} /></div>
          <div className="full"><button className="btn yellow">Salvar conta a pagar</button></div>
        </form>
      </Modal>

      <Modal id="payment" title="Pagar Conta a Pagar" hint="Data real, banco, juros e comprovante obrigatório.">
        <form className="form" onSubmit={submitPayment}>
          <div className="f3"><label>Conta</label><input readOnly value={paymentForm.id || ''} /></div>
          <div className="f3"><label>Quando paguei?</label><input type="date" required {...bind(paymentForm, setPaymentForm, 'date')} /></div>
          <div className="f3"><label>Valor pago</label><input type="number" step="0.01" required {...bind(paymentForm, setPaymentForm, 'amount')} /></div>
          <div className="f3"><label>Banco usado</label><select required {...bind(paymentForm, setPaymentForm, 'bank')}>{banks.map((b) => <option key={b.nome} value={b.nome}>{b.nome}</option>)}</select></div>
          <div className="f3"><label>Houve juros?</label><select {...bind(paymentForm, setPaymentForm, 'hasInterest')}><option>Não</option><option>Sim</option></select></div>
          {paymentForm.hasInterest === 'Sim' && (<><div className="f3"><label>Valor juros</label><input type="number" step="0.01" {...bind(paymentForm, setPaymentForm, 'interestValue')} /></div><div className="f6"><label>Motivo juros</label><input {...bind(paymentForm, setPaymentForm, 'interestReason')} /></div></>)}
          <FileBox k="proof" label="Anexar comprovante de pagamento" />
          <div className="full"><label>Observação</label><textarea {...bind(paymentForm, setPaymentForm, 'obs')} /></div>
          <div className="full"><button className="btn green">Confirmar pagamento</button></div>
        </form>
      </Modal>

      <Modal id="recManual" title="Adicionar Conta a Receber" hint="Lançamento manual.">
        <form className="form" onSubmit={submitRecManual}>
          <div className="f3"><label>Empresa</label><select {...bind(recForm, setRecForm, 'empresa')}><option>Linave</option><option>Servinave</option></select></div>
          <div className="f6"><label>Cliente</label><input required {...bind(recForm, setRecForm, 'cliente')} /></div>
          <div className="f3"><label>Referência</label><input {...bind(recForm, setRecForm, 'ref')} /></div>
          <div className="f3"><label>Valor original</label><input type="number" step="0.01" required {...bind(recForm, setRecForm, 'original')} /></div>
          <div className="f3"><label>Valor líquido</label><input type="number" step="0.01" required {...bind(recForm, setRecForm, 'liquido')} /></div>
          <div className="f3"><label>Vencimento</label><input type="date" required {...bind(recForm, setRecForm, 'vencimento')} /></div>
          <div className="f3"><label>Banco</label><select {...bind(recForm, setRecForm, 'banco')}>{banks.map((b) => <option key={b.nome} value={b.nome}>{b.nome}</option>)}</select></div>
          <div className="f3"><label>Recebido?</label><select {...bind(recForm, setRecForm, 'recebido')}><option>Não</option><option>Sim</option></select></div>
          <div className="f3"><label>Data recebimento</label><input type="date" {...bind(recForm, setRecForm, 'data')} /></div>
          <div className="f3"><label>Valor recebido</label><input type="number" step="0.01" {...bind(recForm, setRecForm, 'valorRecebido')} /></div>
          <div className="full"><label>Observação</label><textarea {...bind(recForm, setRecForm, 'obs')} /></div>
          <div className="full"><button className="btn yellow">Salvar conta a receber</button></div>
        </form>
      </Modal>

      <Modal id="recEdit" title="Editar recebimento" hint="Atualize se recebeu, quando, valor e banco.">
        <form className="form" onSubmit={submitRecEdit}>
          <div className="f3"><label>Conta</label><input readOnly value={recEditForm.id || ''} /></div>
          <div className="f3"><label>Recebido?</label><select {...bind(recEditForm, setRecEditForm, 'recebido')}><option>Não</option><option>Sim</option></select></div>
          <div className="f3"><label>Data recebimento</label><input type="date" {...bind(recEditForm, setRecEditForm, 'data')} /></div>
          <div className="f3"><label>Valor recebido</label><input type="number" step="0.01" {...bind(recEditForm, setRecEditForm, 'valor')} /></div>
          <div className="f3"><label>Banco</label><select {...bind(recEditForm, setRecEditForm, 'banco')}>{banks.map((b) => <option key={b.nome} value={b.nome}>{b.nome}</option>)}</select></div>
          <div className="f3"><label>Vencimento</label><input type="date" required {...bind(recEditForm, setRecEditForm, 'venc')} /></div>
          <div className="full"><label>Observação</label><textarea {...bind(recEditForm, setRecEditForm, 'obs')} /></div>
          <div className="full"><button className="btn green">Salvar recebimento</button></div>
        </form>
      </Modal>

      {/* DETALHE */}
      {detail && (
        <div className="modal-bg open" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="modal"><div className="mh"><div><h2>{detail.title}</h2><p className="hint">Informações completas.</p></div><button className="x" type="button" onClick={() => setDetail(null)}>×</button></div><div className="mb">{detail.body}</div></div>
        </div>
      )}

      {/* TOAST */}
      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </div>
    </FinCtx.Provider>
  );
}

// ---------- CSS escopado em .fin-root ----------
const CSS = `
.fin-root{--bg:#f4f6fb;--card:#fff;--ink:#172033;--muted:#667085;--line:#dfe5ef;--yellow:#f6c343;--blue:#1f4e79;--green:#169b55;--red:#d83f3f;--shadow:0 14px 38px rgba(16,42,67,.10);--r:18px;font-family:Inter,Arial,sans-serif;color:var(--ink);background:radial-gradient(circle at 10% 0%,rgba(246,195,67,.18),transparent 25%),var(--bg);border-radius:18px;overflow:hidden;display:block}
.fin-root *{box-sizing:border-box}
.fin-root .app{display:grid;grid-template-columns:280px 1fr;min-height:78vh}
.fin-root aside{background:linear-gradient(180deg,#0f243a,#071422);color:#fff;padding:22px 16px;position:relative;overflow:auto}
.fin-root .brand{display:flex;gap:12px;align-items:center;padding:10px;margin-bottom:18px}
.fin-root .mark{width:46px;height:46px;border-radius:15px;background:linear-gradient(135deg,var(--yellow),#fff2bd);color:#111;display:grid;place-items:center;font-weight:900}
.fin-root .brand small{display:block;color:#b9c7d8;margin-top:3px}
.fin-root .brand strong{font-size:15px}
.fin-root .navlabel{color:#92a9c4;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin:18px 10px 8px}
.fin-root .nav{width:100%;border:0;background:transparent;color:#dfe8f2;display:flex;gap:10px;align-items:center;padding:12px;border-radius:13px;text-align:left;cursor:pointer;margin-bottom:4px;font:inherit}
.fin-root .nav:hover,.fin-root .nav.active{background:rgba(255,255,255,.1);color:#fff}
.fin-root .nav.active{box-shadow:inset 4px 0 0 var(--yellow)}
.fin-root .ico{width:28px;height:28px;border-radius:10px;background:rgba(255,255,255,.1);display:grid;place-items:center}
.fin-root main{padding:24px;overflow:auto}
.fin-root .top{background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:18px;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}
.fin-root .top h1{margin:0;font-size:24px}
.fin-root .top p{margin:6px 0 0;color:var(--muted);font-size:13px}
.fin-root .filters{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.fin-root select,.fin-root input,.fin-root textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:10px 11px;font:inherit;background:#fff;color:var(--ink)}
.fin-root input[type=number]{text-align:right}
.fin-root textarea{min-height:88px;resize:vertical}
.fin-root label{font-size:12px;color:#536071;font-weight:800;margin-bottom:6px;display:block}
.fin-root .filter{min-width:145px;width:auto}
.fin-root .grid{display:grid;gap:14px}
.fin-root .g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.fin-root .g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.fin-root .g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.fin-root .grid-2{display:grid;gap:14px;grid-template-columns:repeat(2,minmax(0,1fr))}
.fin-root .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:18px}
.fin-root .card h2,.fin-root .card h3{margin:0}
.fin-root .hint{color:var(--muted);font-size:13px;line-height:1.45;margin:5px 0 0}
.fin-root .toolbar,.fin-root .card-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap}
.fin-root .actions{display:flex;gap:8px;flex-wrap:wrap}
.fin-root .btn{border:0;border-radius:12px;padding:10px 13px;font-weight:800;cursor:pointer;background:#102a43;color:#fff;font-family:inherit}
.fin-root .btn:hover{filter:brightness(.98);transform:translateY(-1px)}
.fin-root .yellow{background:var(--yellow);color:#16110a}
.fin-root .green{background:var(--green)}
.fin-root .red{background:var(--red)}
.fin-root .blue{background:var(--blue)}
.fin-root .secondary{background:#eef3f8;color:#102a43}
.fin-root .small{padding:7px 9px;font-size:12px;border-radius:10px}
.fin-root .metric{min-height:128px;position:relative;overflow:hidden}
.fin-root .metric:after{content:"";position:absolute;right:-24px;top:-24px;width:90px;height:90px;border-radius:50%;background:rgba(246,195,67,.25)}
.fin-root .metric .label{color:var(--muted);font-size:13px}
.fin-root .metric .value{font-size:28px;font-weight:950;margin-top:8px}
.fin-root .metric .foot{font-size:12px;color:var(--muted);margin-top:10px}
.fin-root .form{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;align-items:end}
.fin-root .form-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;align-items:start}
.fin-root .f3{grid-column:span 3}
.fin-root .f2{grid-column:span 2}
.fin-root .f6{grid-column:span 6}
.fin-root .full{grid-column:1/-1}
.fin-root .field.sm{grid-column:span 3}
.fin-root .field.lg{grid-column:span 6}
.fin-root .field.full{grid-column:1/-1}
.fin-root .table,.fin-root .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff;max-height:560px}
.fin-root table{width:100%;border-collapse:collapse;font-size:13px}
.fin-root th,.fin-root td{padding:11px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap;vertical-align:middle}
.fin-root th{background:#f8fafd;color:#5f6b7a;font-size:11px;text-transform:uppercase;letter-spacing:.06em;position:sticky;top:0;z-index:2}
.fin-root .tag{display:inline-flex;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:850}
.fin-root .linave{background:#e9f1ff;color:#1651a5}
.fin-root .servinave{background:#fff0da;color:#9a5515}
.fin-root .ok{background:#e8f8ef;color:#12733f}
.fin-root .wait{background:#fff5d9;color:#8a5a00}
.fin-root .bad{background:#ffe8e8;color:#a92828}
.fin-root .info{background:#eaf2ff;color:#1b62bd}
.fin-root .neutral{background:#eef1f6;color:#4a5568}
.fin-root .mother{background:#efe8ff;color:#5b37c7}
.fin-root .child{background:#eaf2ff;color:#1b62bd}
.fin-root .alert{background:#fff1f1;border:1px solid #ffc9c9;color:#8f1d1d;border-radius:14px;padding:12px;margin-bottom:14px;font-size:13px}
.fin-root .notice{background:#eef6ff;border:1px solid #cfe3ff;color:#1b4f8a;border-radius:14px;padding:12px;margin-bottom:14px;font-size:13px}
.fin-root .overdue td{background:#fff7f7!important;color:#8f1d1d;font-weight:800}
.fin-root .panel,.fin-root .soft-panel{background:#fbfcff;border:1px solid var(--line);border-radius:15px;padding:13px}
.fin-root .panel p,.fin-root .soft-panel p{margin:6px 0}
.fin-root .kpi{background:#f8fafd;border:1px solid var(--line);border-radius:14px;padding:11px}
.fin-root .kpi span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:850}
.fin-root .kpi strong{display:block;margin-top:5px;font-size:17px}
.fin-root .upload{border:1.5px dashed #b9c5d6;border-radius:15px;background:#fbfcff;padding:14px;cursor:pointer;display:block;color:var(--ink)}
.fin-root .upload input{display:none}
.fin-root .files{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
.fin-root .file{background:#eef3f8;border:1px solid var(--line);border-radius:999px;padding:7px 9px;font-size:12px;font-weight:800}
.fin-root .modal-bg{position:fixed;inset:0;background:rgba(7,20,34,.58);display:none;place-items:center;z-index:1000;padding:22px}
.fin-root .modal-bg.open{display:grid}
.fin-root .modal{width:min(1120px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.28)}
.fin-root .mh{padding:20px 22px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;background:linear-gradient(135deg,rgba(246,195,67,.2),transparent 45%),#fff;border-radius:24px 24px 0 0}
.fin-root .mh h2{margin:0}
.fin-root .mb{padding:20px 22px}
.fin-root .x{border:0;width:38px;height:38px;border-radius:12px;background:#eef3f8;font-size:20px;cursor:pointer;color:var(--ink)}
.fin-root .barrow{display:grid;grid-template-columns:120px 1fr 115px;gap:10px;align-items:center;margin:12px 0;font-size:13px}
.fin-root .track{height:12px;background:#edf1f7;border-radius:999px;overflow:hidden}
.fin-root .bar{height:100%;background:linear-gradient(90deg,var(--blue),var(--yellow));border-radius:999px}
.fin-root .toast{position:fixed;right:22px;bottom:22px;background:#071422;color:#fff;border-radius:14px;padding:14px 16px;box-shadow:var(--shadow);display:none;max-width:430px;z-index:1100;font-size:13px}
.fin-root .toast.show{display:block}
@media(max-width:1100px){.fin-root .app{grid-template-columns:1fr}.fin-root .g4,.fin-root .g3,.fin-root .g2,.fin-root .grid-2{grid-template-columns:1fr}.fin-root .f3,.fin-root .f2,.fin-root .f6,.fin-root .field.sm,.fin-root .field.lg{grid-column:1/-1}.fin-root .top{flex-direction:column}.fin-root .filters{justify-content:flex-start}}
`;
