import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Anchor, Cable, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Gauge, Hammer, Layers3, MapPin, Microscope, Package, Plus, Search, Table2, Trash2, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../modules/shared/ui/select';
import { useErp } from '../../../context/ErpContext';
import { getOrdensServico, getOsOptionLabel, getOsOptionValue, type OrdemServicoResumo, isOsAlvo } from '../../../../services/ordensServico';
import api from '../../../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

interface StockRow {
  id: string;
  tableName: string;
  values: Record<string, string>;
  searchText: string;
}

interface StockTable {
  name: string;
  columns: StockColumn[];
  rows: StockRow[];
}

interface StockViewProps {
  searchQuery: string;
  mode?: 'public' | 'manage';
}

interface GasAllocation {
  id: string;
  supplierRowId: string;
  gasName: string;
  quantity: number;
  local: string;
  serviceOS: string;
}

interface BaixaHistoricoItem {
  id: string;
  dataBaixa: string;
  tableName: string;
  itemLabel: string;
  statusAnterior: string;
  motivo?: string;
  osId?: string;
  osLabel?: string;
  localizacao?: string;
  serviceOS?: string;
  snapshot: Record<string, string>;
}

interface AllocationHistoricoItem {
  id: string;
  action: 'alocar' | 'desalocar' | 'baixa';
  kind: 'gases' | 'equipamentos' | 'materiais' | 'alugaveis' | 'outros';
  dataEvento: string;
  osId: string;
  osLabel: string;
  itemLabel: string;
  tableName: string;
  quantity?: number;
  local?: string;
  gasName?: string;
}

interface RomaneioHistoricoItemRow {
  tableName: string;
  rowId: string;
  itemLabel: string;
  quantidade?: string;
  snapshotBefore: Record<string, string>;
  snapshotAfter: Record<string, string>;
}

interface RomaneioHistoricoItem {
  id: string;
  createdAt: string;
  mode: 'alocacao' | 'baixa';
  osId: string;
  osLabel: string;
  osLocal?: string;
  items: RomaneioHistoricoItemRow[];
  revertedAt?: string;
  revertedBy?: string;
}

const cleanValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const normalizeKey = (value: string) =>
  cleanValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const generateItemId = (prefix: string, index: number) => {
  const base = normalizeKey(prefix).slice(0, 6) || 'item';
  return `${base}-${String(index + 1).padStart(3, '0')}`;
};

const makeRow = (values: Record<string, string>, prefix: string, index: number, rowId?: string): StockRow => {
  const normalizedValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [normalizeKey(key), cleanValue(value)])
  );

  if (!normalizedValues.material && normalizedValues.nome) {
    normalizedValues.material = normalizedValues.nome;
  }

  normalizedValues.item = normalizedValues.item || generateItemId(prefix, index);

  return {
    id: rowId || `${normalizeKey(prefix)}-${index + 1}`,
    tableName: prefix,
    values: normalizedValues,
    searchText: Object.values(normalizedValues).join(' ').toLowerCase()
  };
};

const STOCK_STORAGE_KEY = 'erp-estoque-storage';

const loadStoredStockState = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const stored = window.localStorage.getItem(STOCK_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as {
      tables?: StockTable[];
      gasTypes?: string[];
      allocations?: GasAllocation[];
    };
  } catch {
    return null;
  }
};

const saveStoredStockState = (state: { tables: StockTable[]; gasTypes: string[]; allocations: GasAllocation[] }) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(state));
};

const sharedColumns: StockColumn[] = [
  { key: 'item', label: 'Item' },
  { key: 'material', label: 'Material' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'quantidade', label: 'Quantidade', align: 'center' },
  { key: 'unidade', label: 'Unidade', align: 'center' },
  { key: 'fornecedor', label: 'Fornecedor' },
  { key: 'localizacao', label: 'Localização' },
  { key: 'status', label: 'Status', align: 'center' },
  { key: 'serviceOS', label: 'Serviço (OS)' }
];

const makeTable = (
  name: string,
  extraColumns: StockColumn[],
  rows: Array<Record<string, string>>,
  includeSharedColumns = true
): StockTable => ({
  name,
  columns: includeSharedColumns ? [...sharedColumns, ...extraColumns] : [...extraColumns],
  rows: rows.map((row, index) => makeRow(row, name, index))
});

const getTableIconConfig = (tableName: string): { Icon: LucideIcon; badgeClass: string; iconClass: string } => {
  const normalizedName = normalizeKey(tableName);

  switch (normalizedName) {
    case 'equipamentoseletricos':
      return { Icon: Zap, badgeClass: 'bg-amber-500/15 ring-amber-500/20', iconClass: 'text-amber-300' };
    case 'extensaocabos':
      return { Icon: Cable, badgeClass: 'bg-cyan-500/15 ring-cyan-500/20', iconClass: 'text-cyan-300' };
    case 'bombahidrojato':
      return { Icon: Gauge, badgeClass: 'bg-blue-500/15 ring-blue-500/20', iconClass: 'text-blue-300' };
    case 'instrumentos':
      return { Icon: Microscope, badgeClass: 'bg-violet-500/15 ring-violet-500/20', iconClass: 'text-violet-300' };
    case 'ferramentas':
      return { Icon: Hammer, badgeClass: 'bg-orange-500/15 ring-orange-500/20', iconClass: 'text-orange-300' };
    case 'talhas':
      return { Icon: Anchor, badgeClass: 'bg-emerald-500/15 ring-emerald-500/20', iconClass: 'text-emerald-300' };
    case 'controledeferramentas':
      return { Icon: ClipboardList, badgeClass: 'bg-pink-500/15 ring-pink-500/20', iconClass: 'text-pink-300' };
    default:
      return { Icon: Table2, badgeClass: 'bg-cyan-500/15 ring-cyan-500/20', iconClass: 'text-cyan-300' };
  }
};

type StatusRule = {
  defaultStatus: string;
  positive: string[];
  negative: string[];
  options: string[];
};

const STATUS_RULES: Record<string, StatusRule> = {
  equipamentoseletricos: { defaultStatus: 'Funcionando', positive: ['Funcionando'], negative: ['Manutenção', 'Alocado'], options: ['Funcionando', 'Manutenção', 'Alocado'] },
  extensaocabos: { defaultStatus: 'Funcionando', positive: ['Funcionando'], negative: ['Manutenção', 'Alocado'], options: ['Funcionando', 'Manutenção', 'Alocado'] },
  bombahidrojato: { defaultStatus: 'Apto para uso', positive: ['Apto para uso'], negative: ['Não apto', 'Alocado'], options: ['Apto para uso', 'Não apto', 'Alocado'] },
  instrumentos: { defaultStatus: 'Ok', positive: ['Ok'], negative: ['Aguardando calibração', 'Com defeito', 'Alocado'], options: ['Ok', 'Aguardando calibração', 'Com defeito', 'Alocado'] },
  ferramentas: { defaultStatus: 'Adequada', positive: ['Adequada'], negative: ['Não para o uso', 'Alocado'], options: ['Adequada', 'Não para o uso', 'Alocado'] },
  talhas: { defaultStatus: 'Ok', positive: ['Ok'], negative: ['Não consta', 'Alocado'], options: ['Ok', 'Não consta', 'Alocado'] },
  controledeferramentas: { defaultStatus: 'Conferido', positive: ['Conferido'], negative: ['Pendente', 'Alocado'], options: ['Conferido', 'Pendente', 'Alocado'] },
  materiais: { defaultStatus: 'Normal', positive: ['Normal'], negative: ['Crítico', 'Baixo'], options: ['Normal', 'Baixo', 'Crítico'] },
  alugadosgases: { defaultStatus: 'Normal', positive: ['Normal'], negative: ['Crítico', 'Vazio'], options: ['Normal', 'Vazio', 'Crítico'] },
  alugadosequipamentos: { defaultStatus: 'Normal', positive: ['Normal'], negative: ['Danificado', 'Não retornado', 'Alocado'], options: ['Normal', 'Danificado', 'Não retornado', 'Alocado'] }
};

const getStatusRule = (tableName?: string) => STATUS_RULES[normalizeKey(tableName || '')] || {
  defaultStatus: 'Normal', positive: ['Normal'], negative: ['Crítico', 'Baixo', 'Manutenção', 'Pendente', 'Alocado'], options: ['Normal', 'Baixo', 'Crítico', 'Alocado']
};

const matchesStatusValue = (status: string, candidates: string[]) => {
  const normalizedStatus = normalizeKey(status);
  return candidates.some((candidate) => normalizedStatus.includes(normalizeKey(candidate)));
};

const isNegativeStatus = (tableName: string, status: string) => {
  if (normalizeKey(status).includes('alocad')) return true;
  return matchesStatusValue(status, getStatusRule(tableName).negative);
};
const isPositiveStatus = (tableName: string, status: string) => matchesStatusValue(status, getStatusRule(tableName).positive);

const getStatusTone = (status: string, tableName?: string) => {
  const normalized = normalizeKey(status);
  
  if (normalized.includes('alocad')) return 'bg-red-500/15 border-red-500/30 text-red-300';
  
  if (tableName && isNegativeStatus(tableName, status)) return 'bg-red-500/15 border-red-500/30 text-red-300';
  if (tableName && isPositiveStatus(tableName, status)) return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';

  if (normalized.includes('crit') || normalized.includes('baix') || normalized.includes('manut') || normalized.includes('defe') || normalized.includes('pend') || normalized.includes('naoapto') || normalized.includes('naoparaouso') || normalized.includes('naoconsta')) {
    return 'bg-red-500/15 border-red-500/30 text-red-300';
  }
  if (normalized.includes('ok') || normalized.includes('funcion') || normalized.includes('aptoparauso') || normalized.includes('adequad') || normalized.includes('confer')) {
    return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
  }
  return 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300';
};

const getStatusOptionsForTable = (tableName?: string) => getStatusRule(tableName).options;
const getDefaultStatusForTable = (tableName?: string) => getStatusRule(tableName).defaultStatus;

const getOsLocalExecution = (os: any) => cleanValue(
  os?.negocio_detalhes?.servicos?.[0]?.local_execucao
  || os?.negocio_detalhes?.servicos?.[0]?.localExecucao
  || os?.local_execucao
  || os?.localExecucao
  || os?.local
);

const INITIAL_GAS_TYPES = ['Oxigênio', 'Acetileno'];
const EMPTY_SERVICE_OS_VALUE = '__none__';

const STOCK_TABLES: StockTable[] = [
  makeTable(
    'EQUIPAMENTOS ELETRICOS',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'Material' }, { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' }, { key: 'patrimonio', label: 'Patrimônio' }, { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'modelo', label: 'Modelo' }, { key: 'numeroSerial', label: 'N° Serial' }, { key: 'tag', label: 'TAG' },
      { key: 'marca', label: 'Marca' }, { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' }, { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' }, { key: 'observacao', label: 'Observação' }, { key: 'localizacao', label: 'Local' },
      { key: 'serviceOS', label: 'Serviço (OS)' }, { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      { material: 'Painel de Comando 380V IP65', descricao: 'Aço carbono pintado', unid: 'un', qtd: '6', patrimonio: 'PAT-EL-001', dataEntradaPlanilha: '2026-04-08', modelo: 'PC-380IP65', numeroSerial: 'SN-54821', tag: 'TAG-001', marca: 'WEG', dataCalibracaoAfericao: '2026-03-12', validadeCalibracaoAfericao: '2027-03-12', status: 'Funcionando', observacao: 'Instalado no rack A1', unidade: 'un' },
      { material: 'Cabo PP 4x2,5mm²', descricao: 'Cobre flexível', unid: 'm', qtd: '120', patrimonio: 'PAT-EL-002', dataEntradaPlanilha: '2026-04-10', modelo: 'PP-4X2,5', numeroSerial: 'SN-88214', tag: 'TAG-002', marca: 'Prysmian', dataCalibracaoAfericao: '—', validadeCalibracaoAfericao: '—', status: 'Funcionando', observacao: 'Bobina B3', unidade: 'm' },
      { material: 'Disjuntor 3P 63A', descricao: 'Termomagnético', unid: 'un', qtd: '9', patrimonio: 'PAT-EL-003', dataEntradaPlanilha: '2026-04-12', modelo: 'DJ-3P-63A', numeroSerial: 'SN-99201', tag: 'TAG-003', marca: 'Schneider', dataCalibracaoAfericao: '2026-02-20', validadeCalibracaoAfericao: '2027-02-20', status: 'Manutenção', observacao: 'Prateleira E2', unidade: 'un' }
    ], false
  ),
  makeTable(
    'EXTENSÃO-CABOS',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'Material' }, { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' }, { key: 'patrimonio', label: 'Patrimônio' }, { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'metros', label: 'METROS', align: 'center' }, { key: 'bitola', label: '(BITOLA)', align: 'center' }, { key: 'tag', label: 'TAG' },
      { key: 'marca', label: 'Marca' }, { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' }, { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' }, { key: 'observacao', label: 'Observação' }, { key: 'localizacao', label: 'Local' },
      { key: 'serviceOS', label: 'Serviço (OS)' }, { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      { material: 'Extensão Industrial 30m', unid: 'un', qtd: '18', patrimonio: 'PAT-CAB-001', dataEntradaPlanilha: '2026-04-02', metros: '30', bitola: '2,5mm²', tag: 'TAG-CAB-001', marca: 'Tramontina', dataCalibracaoAfericao: '—', validadeCalibracaoAfericao: '—', status: 'Normal', observacao: 'Parede C1', unidade: 'm' },
      { material: 'Extensão IP44 50m', unid: 'un', qtd: '8', patrimonio: 'PAT-CAB-002', dataEntradaPlanilha: '2026-04-05', metros: '50', bitola: '4mm²', tag: 'TAG-CAB-002', marca: 'Wurth', dataCalibracaoAfericao: '—', validadeCalibracaoAfericao: '—', status: 'Crítico', observacao: 'Parede C2', unidade: 'm' },
      { material: 'Cabo de Rede Industrial 25m', unid: 'un', qtd: '24', patrimonio: 'PAT-CAB-003', dataEntradaPlanilha: '2026-04-09', metros: '25', bitola: 'Cat6', tag: 'TAG-CAB-003', marca: 'Furukawa', dataCalibracaoAfericao: '—', validadeCalibracaoAfericao: '—', status: 'Normal', observacao: 'Armário de Rede', unidade: 'm' }
    ], false
  ),
  makeTable(
    'BOMBA HIDROJATO',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'Material' }, { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' }, { key: 'patrimonioIdentificacao', label: 'Patrimônio/Identificação' }, { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'identificacao', label: 'IDENTIFICAÇÃO' }, { key: 'certificacao', label: 'CERTIFICAÇÃO' }, { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' }, { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' }, { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' }, { key: 'localizacao', label: 'Local' }, { key: 'serviceOS', label: 'Serviço (OS)' }, { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      { material: 'Bomba Hidrojato LNV 0158', unid: 'un', qtd: '1', patrimonioIdentificacao: 'PAT-HJ-001', dataEntradaPlanilha: '2026-04-15', identificacao: 'HJ-0158', certificacao: 'CERT-2026-01', marca: 'LNV', dataCalibracaoAfericao: '2026-03-20', validadeCalibracaoAfericao: '2027-03-20', status: 'Apto para uso', observacao: 'Bay 3', unidade: 'un' },
      { material: 'Mangueira Alta Pressão 20m', unid: 'kit', qtd: '6', patrimonioIdentificacao: 'PAT-HJ-002', dataEntradaPlanilha: '2026-04-16', identificacao: 'HJ-MANG-20', certificacao: 'CERT-2026-02', marca: 'LNV', dataCalibracaoAfericao: '—', validadeCalibracaoAfericao: '—', status: 'Apto para uso', observacao: 'Armário Hidrojato', unidade: 'kit' }
    ], false
  ),
  makeTable(
    'INSTRUMENTOS',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'Material' }, { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' }, { key: 'patrimonio', label: 'Patrimônio' }, { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'identificacao', label: 'INDENTIFICAÇÃO' }, { key: 'certificacao', label: 'CERTIFICAÇÃO' }, { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' }, { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' }, { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' }, { key: 'localizacao', label: 'Local' }, { key: 'serviceOS', label: 'Serviço (OS)' }, { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      { material: 'Multímetro Digital', unid: 'un', qtd: '12', patrimonio: 'PAT-INS-001', dataEntradaPlanilha: '2026-04-11', identificacao: 'INS-MULT-001', certificacao: 'CERT-2026-07', marca: 'Minipa', dataCalibracaoAfericao: '2026-04-01', validadeCalibracaoAfericao: '2027-04-01', status: 'Ok', observacao: 'Armário D2', unidade: 'un' },
      { material: 'Calibrador de Pressão', unid: 'un', qtd: '5', patrimonio: 'PAT-INS-002', dataEntradaPlanilha: '2026-04-13', identificacao: 'INS-CAL-002', certificacao: 'CERT-2026-08', marca: 'Wika', dataCalibracaoAfericao: '2026-03-22', validadeCalibracaoAfericao: '2027-03-22', status: 'Aguardando calibração', observacao: 'Sala Técnica', unidade: 'un' }
    ], false
  ),
  makeTable(
    'FERRAMENTAS',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'Material' }, { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' }, { key: 'patrimonio', label: 'Patrimônio' }, { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'modelo', label: 'Modelo' }, { key: 'numeroSerial', label: 'N° Serial' }, { key: 'marca', label: 'Marca' },
      { key: 'status', label: 'STATUS', align: 'center' }, { key: 'observacao', label: 'Observação' }, { key: 'localizacao', label: 'Local' },
      { key: 'serviceOS', label: 'Serviço (OS)' }, { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      { material: 'Furadeira Industrial 850W', unid: 'un', qtd: '8', patrimonio: 'PAT-FER-001', dataEntradaPlanilha: '2026-04-07', modelo: 'GSB 16 RE', numeroSerial: 'SN-FER-850-001', marca: 'Bosch', status: 'Adequada', observacao: 'Ferramentas A3', unidade: 'un' },
      { material: 'Jogo de Chaves Allen', unid: 'jogo', qtd: '25', patrimonio: 'PAT-FER-002', dataEntradaPlanilha: '2026-04-09', modelo: 'Allen 9 peças', numeroSerial: 'SN-FER-ALLEN-002', marca: 'Vonder', status: 'Não para o uso', observacao: 'Ferramentas B1', unidade: 'jogo' }
    ], false
  ),
  makeTable(
    'TALHAS',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'Material' }, { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' }, { key: 'patrimonio', label: 'Patrimônio' }, { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'modelo', label: 'Modelo' }, { key: 'numeroSerial', label: 'N° Serial' }, { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' }, { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' }, { key: 'observacao', label: 'Observação' }, { key: 'localizacao', label: 'Local' },
      { key: 'serviceOS', label: 'Serviço (OS)' }, { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      { material: 'Talha Manual 2T', unid: 'un', qtd: '7', patrimonio: 'PAT-TAL-001', dataEntradaPlanilha: '2026-04-06', modelo: 'TM-2T', numeroSerial: 'SN-TAL-002T-001', marca: 'Vonder', dataCalibracaoAfericao: '2026-03-30', validadeCalibracaoAfericao: '2027-03-30', status: 'Normal', observacao: 'Pátio', unidade: 'un' },
      { material: 'Talha Elétrica 5T', unid: 'un', qtd: '3', patrimonio: 'PAT-TAL-002', dataEntradaPlanilha: '2026-04-08', modelo: 'TE-5T', numeroSerial: 'SN-TAL-005T-002', marca: 'Demag', dataCalibracaoAfericao: '2026-03-18', validadeCalibracaoAfericao: '2027-03-18', status: 'Crítico', observacao: 'Pátio', unidade: 'un' }
    ], false
  ),
  makeTable(
    'Controle de ferramentas',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'FERRAMENTA' }, { key: 'tagNumeroSeriePatrimonio', label: 'TAG/NUMERO SÉRIE/PATRIMÔNIO' },
      { key: 'retiradoPor', label: 'RETIRADO POR' }, { key: 'assinaturaRetirada', label: 'ASSINATURA (RETIRADA)' }, { key: 'dataRetirada', label: 'DATA (RETIRADA)', align: 'center' },
      { key: 'condicaoFerramentaRetirada', label: 'CONDIÇÃO DA FERRAMENTA (RETIRADA)' }, { key: 'lvSeAplicavel', label: 'LV (SE APLICÁVEL)' }, { key: 'dataDevolucao', label: 'DATA (DEVOLUCAO)', align: 'center' },
      { key: 'assinaturaDevolucao', label: 'ASSINATURA (DEVOLUÇÃO)' }, { key: 'status', label: 'STATUS', align: 'center' }, { key: 'condicaoFerramentaDevolucao', label: 'CONDIÇÃO DA FERRAMENTA (DEVOLUÇÃO)' },
      { key: 'localizacao', label: 'Local' }, { key: 'serviceOS', label: 'Serviço (OS)' }
    ],
    [
      { material: 'Lixadeira Angular 7"', tagNumeroSeriePatrimonio: 'TAG-CTRL-001 / SN-CTRL-001 / PAT-CTRL-001', retiradoPor: 'Equipe de Manutenção', assinaturaRetirada: 'Ass. eletrônica', dataRetirada: '2026-04-18', condicaoFerramentaRetirada: 'Boa', lvSeAplicavel: 'Não se aplica', dataDevolucao: '2026-04-18', assinaturaDevolucao: 'Ass. eletrônica', status: 'Conferido', condicaoFerramentaDevolucao: 'Boa' },
      { material: 'Serra Tico-Tico', tagNumeroSeriePatrimonio: 'TAG-CTRL-002 / SN-CTRL-002 / PAT-CTRL-002', retiradoPor: 'Almoxarifado', assinaturaRetirada: 'Ass. eletrônica', dataRetirada: '2026-04-20', condicaoFerramentaRetirada: 'Boa', lvSeAplicavel: 'Não se aplica', dataDevolucao: '—', assinaturaDevolucao: '—', status: 'Pendente', condicaoFerramentaDevolucao: '—' }
    ], false
  ),
  makeTable(
    'Materiais',
    [
      { key: 'item', label: 'Item' }, { key: 'material', label: 'Descrição' }, { key: 'quantidade', label: 'Quantidade', align: 'center' },
      { key: 'localizacao', label: 'Local' }, { key: 'serviceOS', label: 'Serviço (OS)' }
    ], [], false
  ),
  makeTable(
    'Alugados - Gases',
    [
      { key: 'item', label: 'Item' },
      { key: 'fornecedor', label: 'Fornecedor' },
      ...INITIAL_GAS_TYPES.map(g => ({ key: `gas${normalizeKey(g)}`, label: g, align: 'center' as const })),
      { key: 'total', label: 'TOTAL', align: 'center' },
      { key: 'actions', label: '', align: 'right' }
    ], [], false
  ),
  makeTable(
    'Alugados - Equipamentos',
    [
      { key: 'item', label: 'Item' }, { key: 'equipamento', label: 'Nome do Equipamento' }, { key: 'dataAluguel', label: 'Data de Aluguel', align: 'center' },
      { key: 'descricao', label: 'Descrição' }, { key: 'localizacao', label: 'Local' }, { key: 'serviceOS', label: 'Serviço (OS)' }
    ], [], false
  )
];


const getCommonColumns = (tables: StockTable[]) => {
  if (tables.length === 0) return sharedColumns;

  const commonKeys = tables.reduce<Set<string>>((accumulator, table, index) => {
    const tableKeys = new Set(table.columns.map((column) => column.key));
    if (index === 0) return tableKeys;
    return new Set([...accumulator].filter((key) => tableKeys.has(key)));
  }, new Set<string>());

  return sharedColumns.filter((column) => commonKeys.has(column.key));
};

const createRegisterValues = (table?: StockTable, baseValues: Record<string, string> = {}) => {
  const values: Record<string, string> = {};
  const columns = table?.columns || sharedColumns;

  columns.forEach((column) => {
    const previous = baseValues[column.key] || baseValues[normalizeKey(column.label)] || '';

    if (column.key === 'item') {
      values[column.key] = previous || generateItemId(table?.name || 'item', table?.rows.length ?? 0);
      return;
    }

    if (column.key === 'status') {
      values[column.key] = previous || getDefaultStatusForTable(table?.name);
      return;
    }

    if (table?.name === 'Alugados - Gases') {
      if (column.key.startsWith('gas') && previous === '') {
        values[column.key] = '0';
        return;
      }
      if (column.key === 'total' && previous === '') {
        values[column.key] = '0';
        return;
      }
    }

    values[column.key] = previous;
  });

  return values;
};

export function EstoqueView({ searchQuery, mode = 'manage' }: StockViewProps) {
  const { os, almoxerifado, saveEntity, loading } = useErp();
  const hasHydratedPersistedState = useRef(false);
  const [ordensServicoBackend, setOrdensServicoBackend] = useState<OrdemServicoResumo[]>([]);
  const [publicSearch, setPublicSearch] = useState<string>(searchQuery || '');

  const [tables, setTables] = useState<StockTable[]>(() => STOCK_TABLES.map((table) => ({
    ...table,
    columns: [...table.columns],
    rows: table.rows.map((row) => ({ ...row, values: { ...row.values } }))
  })));
  
  const [selectedCategory, setSelectedCategory] = useState<'Materiais' | 'Equipamentos' | 'Alugados'>('Materiais');
  const [selectedType, setSelectedType] = useState<string>('');
  const [filtro, setFiltro] = useState<string>(searchQuery || '');
  const [selectedOsFilter, setSelectedOsFilter] = useState<string>('');
  
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerTableName, setRegisterTableName] = useState<string>(tables[0]?.name || '');
  const [registerValues, setRegisterValues] = useState<Record<string, string>>(() => createRegisterValues(tables[0]));
  const [activeRowTarget, setActiveRowTarget] = useState<{ tableName: string; rowId: string } | null>(null);
  const [editingRowTarget, setEditingRowTarget] = useState<{ tableName: string; rowId: string } | null>(null);

  const [gasTypes, setGasTypes] = useState<string[]>(INITIAL_GAS_TYPES);
  const [newGasName, setNewGasName] = useState('');
  const [expandedGasRows, setExpandedGasRows] = useState<Set<string>>(new Set());
  const [baixasHistorico, setBaixasHistorico] = useState<BaixaHistoricoItem[]>([]);
  const [alocacoesHistorico, setAlocacoesHistorico] = useState<AllocationHistoricoItem[]>([]);
  const [romaneiosHistorico, setRomaneiosHistorico] = useState<RomaneioHistoricoItem[]>([]);
  const [isBaixaModalOpen, setIsBaixaModalOpen] = useState(false);
  const [baixaTargetRow, setBaixaTargetRow] = useState<StockRow | null>(null);
  const [baixaForm, setBaixaForm] = useState({
    osId: '',
    dataBaixa: new Date().toISOString().slice(0, 10),
    motivo: ''
  });
  
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [allocations, setAllocations] = useState<GasAllocation[]>(() => {
    if (almoxerifado?.allocations && Array.isArray(almoxerifado.allocations)) {
      return almoxerifado.allocations;
    }
    return [];
  });
  const [allocateForm, setAllocateForm] = useState({
    supplierRowId: '',
    gasName: '',
    quantity: '1',
    local: '',
    serviceOS: ''
  });

  const [isEquipAllocateModalOpen, setIsEquipAllocateModalOpen] = useState(false);
  const [equipAllocateForm, setEquipAllocateForm] = useState({
    rowId: '',
    tableName: '',
    equipName: '',
    local: '',
    osId: ''
  });

  const [selectedForRomaneio, setSelectedForRomaneio] = useState<Set<string>>(new Set());
  const [isRomaneioModalOpen, setIsRomaneioModalOpen] = useState(false);
  const [romaneioOsId, setRomaneioOsId] = useState<string>('');
  const [romaneioMode, setRomaneioMode] = useState<'alocacao' | 'baixa'>('alocacao');

  useEffect(() => {
    let mounted = true;

    const carregarOrdensServico = async () => {
      try {
        const ordens = await getOrdensServico();
        if (mounted) {
          setOrdensServicoBackend(ordens);
        }
      } catch (error) {
        console.error('Erro ao carregar ordens de servico do backend:', error);
        if (mounted) {
          setOrdensServicoBackend([]);
        }
      }
    };

    void carregarOrdensServico();

    return () => {
      mounted = false;
    };
  }, []);

  const availableOS = useMemo(() => {
    const backend = Array.isArray(ordensServicoBackend) ? ordensServicoBackend : [];
    const ctx = Array.isArray(os) ? os : [];

    const merged = [...backend];
    for (const item of ctx) {
      if (!isOsAlvo(item)) continue;
      const val = getOsOptionValue(item as any);
      if (!merged.some((m) => getOsOptionValue(m as any) === val)) {
        merged.push(item as any);
      }
    }

    return merged;
  }, [ordensServicoBackend, os]);

  React.useEffect(() => {
    if (isEquipAllocateModalOpen) {
      console.log('[EstoqueView] Equip allocation modal opened', { availableOS, os });
    }
  }, [isEquipAllocateModalOpen, availableOS, os]);

  useEffect(() => {
    if (loading || hasHydratedPersistedState.current) return;

    if (almoxerifado && typeof almoxerifado === 'object') {
      if (Array.isArray(almoxerifado.tables)) {
        setTables(
          almoxerifado.tables.map((table: StockTable) => ({
            ...table,
            columns: Array.isArray(table.columns) ? [...table.columns] : [],
            rows: Array.isArray(table.rows)
              ? table.rows.map((row) => ({ ...row, values: { ...(row.values || {}) } }))
              : []
          }))
        );
      }

      if (Array.isArray(almoxerifado.gasTypes)) {
        setGasTypes(almoxerifado.gasTypes);
      }

      if (Array.isArray(almoxerifado.allocations)) {
        setAllocations(almoxerifado.allocations);
      }

      if (Array.isArray(almoxerifado.baixasHistorico)) {
        setBaixasHistorico(almoxerifado.baixasHistorico);
      }

      if (Array.isArray(almoxerifado.alocacoesHistorico)) {
        setAlocacoesHistorico(almoxerifado.alocacoesHistorico);
      }
      if (Array.isArray(almoxerifado.romaneiosHistorico)) {
        setRomaneiosHistorico(almoxerifado.romaneiosHistorico);
      }
      if (Array.isArray(almoxerifado.selectedForRomaneio)) {
        try {
          setSelectedForRomaneio(new Set(almoxerifado.selectedForRomaneio));
        } catch (e) {
        }
      }

      hasHydratedPersistedState.current = true;
      return;
    }

    hasHydratedPersistedState.current = true;
  }, [loading, almoxerifado]);

  useEffect(() => {
    if (!hasHydratedPersistedState.current) return;
    void saveEntity('almoxerifado', {
      version: 2,
      tables,
      gasTypes,
      allocations,
      baixasHistorico,
      alocacoesHistorico,
      romaneiosHistorico,
      selectedForRomaneio: Array.from(selectedForRomaneio)
    });
  }, [tables, gasTypes, allocations, baixasHistorico, alocacoesHistorico, romaneiosHistorico, selectedForRomaneio]);

  const handleRemoveGas = (gasToRemove: string) => {
    setGasTypes((prev) => prev.filter((g) => g !== gasToRemove));

    const gasKeyToRemove = `gas${normalizeKey(gasToRemove)}`;
    setRegisterValues((prev) => {
      const next = { ...prev };
      delete next[gasKeyToRemove];
      
      const newTotal = gasTypes
        .filter(g => g !== gasToRemove)
        .reduce((sum, g) => sum + (Number(next[`gas${normalizeKey(g)}`]) || 0), 0);
      
      next['total'] = String(newTotal);
      return next;
    });

    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.name === 'Alugados - Gases') {
          return {
            ...table,
            rows: table.rows.map((row) => {
              const newValues = { ...row.values };
              delete newValues[gasKeyToRemove];
              return { ...row, values: newValues };
            }),
          };
        }
        return table;
      })
    );

    setAllocations((prev) => prev.filter((a) => a.gasName !== gasToRemove));
  };

  useEffect(() => {
    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.name === 'Alugados - Gases') {
          const baseCols: StockColumn[] = [
            { key: 'item', label: 'Item' },
            { key: 'fornecedor', label: 'Fornecedor' }
          ];
          const gasCols: StockColumn[] = gasTypes.map((g) => ({
            key: `gas${normalizeKey(g)}`,
            label: g,
            align: 'center'
          }));
          const endCols: StockColumn[] = [
            { key: 'total', label: 'TOTAL', align: 'center' },
            { key: 'actions', label: '', align: 'right' } 
          ];
          return { ...table, columns: [...baseCols, ...gasCols, ...endCols] };
        }
        return table;
      })
    );
  }, [gasTypes]);

  const categoryMap = {
    'Materiais': [],
    'Equipamentos': ['EQUIPAMENTOS ELETRICOS', 'EXTENSÃO-CABOS', 'BOMBA HIDROJATO', 'INSTRUMENTOS', 'FERRAMENTAS', 'TALHAS'],
    'Alugados': ['Gases', 'Equipamentos']
  };

  useEffect(() => {
    if (!selectedType && selectedCategory === 'Materiais') {
      setSelectedType('Materiais');
    } else if (!selectedType && selectedCategory !== 'Materiais') {
      const types = categoryMap[selectedCategory] as string[];
      if (types.length > 0) {
        setSelectedType(types[0]);
      }
    }
  }, []);

  useEffect(() => {
    setFiltro(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    setPublicSearch(searchQuery || '');
  }, [searchQuery, mode]);

  useEffect(() => {
    const types = categoryMap[selectedCategory] as string[];
    if (selectedCategory === 'Materiais') {
      setSelectedType('Materiais');
    } else if (types.length > 0 && !types.includes(selectedType)) {
      setSelectedType(types[0]);
    }
  }, [selectedCategory]);

  const getVisibleTables = () => {
    if (selectedCategory === 'Materiais') return tables.filter(t => t.name === 'Materiais');
    if (selectedCategory === 'Equipamentos') return tables.filter(t => t.name === selectedType);
    if (selectedCategory === 'Alugados') {
      return selectedType === 'Gases' 
        ? tables.filter(t => t.name === 'Alugados - Gases')
        : tables.filter(t => t.name === 'Alugados - Equipamentos');
    }
    return [];
  };

  const visibleTables = getVisibleTables();
  const selectedTable = useMemo(() => visibleTables[0] || { name: 'Vazio', columns: [], rows: [] }, [visibleTables]);
  
  const visibleColumns = useMemo(() => {
    const cols = [...selectedTable.columns];
    if (!cols.some(c => c.key === 'actions')) {
      cols.push({ key: 'actions', label: '', align: 'right' });
    }
    if (!cols.some(c => c.key === '__select__')) {
      cols.unshift({ key: '__select__', label: '', align: 'center' });
    }
    return cols;
  }, [selectedTable]);

  const visibleRows = useMemo(() => {
    const query = filtro.toLowerCase().trim();
    return selectedTable.rows.filter((row) => {
      const matchesOsFilter = !selectedOsFilter || (() => {
        const rowServiceOs = cleanValue(row.values.serviceOS);
        const selectedOs = availableOS.find((item: any) => getOsOptionValue(item) === selectedOsFilter);

        if (!selectedOs) {
          return normalizeKey(rowServiceOs).includes(normalizeKey(selectedOsFilter));
        }

        const selectedLabels = [
          getOsOptionValue(selectedOs),
          selectedOs.numeroOs,
          selectedOs.cc,
          selectedOs.projeto
        ].filter(Boolean).map((value) => normalizeKey(String(value)));

        if (selectedLabels.some((value) => value && normalizeKey(rowServiceOs).includes(value))) {
          return true;
        }

        if (row.tableName === 'Alugados - Gases') {
          return allocations.some((allocation) =>
            allocation.supplierRowId === row.id && selectedLabels.some((value) => value && normalizeKey(allocation.serviceOS).includes(value))
          );
        }

        return false;
      })();

      const matchesQuery = !query || (() => {
      const matchesColumns = visibleColumns.some((column) => (row.values[column.key] || '').toLowerCase().includes(query));
      return matchesColumns || row.searchText.includes(query);
      })();

      return matchesQuery && matchesOsFilter;
    });
  }, [allocations, availableOS, filtro, selectedOsFilter, selectedTable.rows, visibleColumns]);

  const publicRows = useMemo(() => {
    const query = publicSearch.toLowerCase().trim();

    return tables.flatMap((table) => table.rows.filter((row) => {
      if (!query) return true;

      const searchableName = [
        row.values.item,
        row.values.material,
        row.values.nome,
        row.values.equipamento,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableName.includes(query);
    }).map((row) => ({ ...row, tableName: table.name })));
  }, [publicSearch, tables]);

  const currentRegisterTable = useMemo(
    () => tables.find((table) => table.name === registerTableName) || tables[0],
    [registerTableName, tables]
  );
  const registerTableIcon = getTableIconConfig(currentRegisterTable?.name || '');
  
  const activeRow = useMemo(() => {
    if (!activeRowTarget) return null;
    const table = tables.find((item) => item.name === activeRowTarget.tableName);
    const row = table?.rows.find((item) => item.id === activeRowTarget.rowId);
    if (!table || !row) return null;
    return { table, row };
  }, [activeRowTarget, tables]);

  useEffect(() => {
    if (!isRegisterOpen || !currentRegisterTable) return;
    setRegisterValues((previous) => createRegisterValues(currentRegisterTable, previous));
  }, [currentRegisterTable, isRegisterOpen]);

  useEffect(() => {
    if (!isAllocateModalOpen || !allocateForm.serviceOS) return;
    const { osLocal } = resolveSelectedOsData(allocateForm.serviceOS);
    if (osLocal && allocateForm.local !== osLocal) {
      setAllocateForm((previous) => ({ ...previous, local: osLocal }));
    }
  }, [allocateForm.serviceOS, allocateForm.local, isAllocateModalOpen]);

  useEffect(() => {
    if (!isEquipAllocateModalOpen || !equipAllocateForm.osId) return;
    const { osLocal } = resolveSelectedOsData(equipAllocateForm.osId);
    if (osLocal && equipAllocateForm.local !== osLocal) {
      setEquipAllocateForm((previous) => ({ ...previous, local: osLocal }));
    }
  }, [equipAllocateForm.osId, equipAllocateForm.local, isEquipAllocateModalOpen]);

  if (mode === 'public') {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#101f3d] via-[#0d1830] to-[#0b1220]">
        <div className="border-b border-white/5 p-8 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wide text-white flex items-center drop-shadow-md">
                <Package className="mr-3 text-amber-400" size={32} />
                Estoque
              </h1>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/40">
                Consulta pública de itens disponíveis no estoque
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 pt-6">
          <div className="flex items-center gap-3 rounded-[24px] border border-white/5 bg-white/[0.03] px-4 py-3 shadow-xl backdrop-blur-md">
            <Search size={16} className="text-white/45 shrink-0" />
            <Input
              value={publicSearch}
              onChange={(event) => setPublicSearch(event.target.value)}
              placeholder="Pesquisar por nome"
              className="h-10 border-0 bg-transparent px-0 text-white placeholder:text-white/30 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-8 pt-4">
          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60 shadow-sm">
            <Layers3 size={14} className="text-amber-400" />
            Pesquisa por nome
          </div>
          <div className="rounded-full border border-white/5 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50 shadow-sm">
            Exibindo {publicRows.length} registros
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-4 pb-8">
          {publicRows.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-white/5 bg-white/[0.02] backdrop-blur shadow-inner">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-[#0b1220]/50 shadow-sm">
                  <Package size={28} className="text-white/30" />
                </div>
                <p className="font-bold text-white/60">Nenhum item encontrado</p>
                <p className="mt-2 text-sm text-white/35">Tente outro nome na busca.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-white/5 bg-[#0b1220]/40 shadow-xl backdrop-blur-md">
              <div className="overflow-auto">
                <table className="min-w-max w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[#131f37] shadow-sm">
                    <tr className="border-b border-white/10">
                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-white/50">Tabela</th>
                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-white/50">Item</th>
                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-white/50">Material</th>
                      <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-white/50">Quantidade</th>
                      <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-white/50">Unidade</th>
                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-white/50">Fornecedor</th>
                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-white/50">Local</th>
                      <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-white/50">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {publicRows.map((row) => {
                      const itemLabel = row.values.item || row.id;
                      const materialLabel = row.values.material || row.values.equipamento || row.values.nome || '—';

                      return (
                        <tr key={`${row.tableName}-${row.id}`} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-4 align-middle text-[13px] text-white/80">{row.tableName}</td>
                          <td className="px-5 py-4 align-middle text-[13px] text-white/80">{itemLabel}</td>
                          <td className="px-5 py-4 align-middle text-[13px] text-white/80">{materialLabel}</td>
                          <td className="px-5 py-4 align-middle text-center text-[13px] text-white/80">{row.values.quantidade || row.values.qtd || '—'}</td>
                          <td className="px-5 py-4 align-middle text-center text-[13px] text-white/80">{row.values.unidade || row.values.unid || '—'}</td>
                          <td className="px-5 py-4 align-middle text-[13px] text-white/80">{row.values.fornecedor || '—'}</td>
                          <td className="px-5 py-4 align-middle text-[13px] text-white/80">{row.values.localizacao || '—'}</td>
                          <td className="px-5 py-4 align-middle text-center">
                            <Badge variant="outline" className={`rounded-full border px-3 py-1 shadow-sm ${getStatusTone(row.values.status || '', row.tableName)}`}>
                              {row.values.status || '—'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const closeRegisterModal = () => {
    setIsRegisterOpen(false);
    setEditingRowTarget(null);
  };

  const openRowDetails = (row: StockRow) => {
    setActiveRowTarget({ tableName: row.tableName, rowId: row.id });
  };

  const closeRowDetails = () => {
    setActiveRowTarget(null);
  };

  const openBaixaModal = (row: StockRow) => {
    const currentOs = cleanValue(row.values.serviceOS);
    const matchedOs = availableOS.find((ordemServico: any) => {
      const osValue = getOsOptionValue(ordemServico as any);
      const osLabel = getOsOptionLabel(ordemServico as any);
      const osId = String((ordemServico as any)?.id || '');
      return currentOs && (currentOs === osValue || currentOs === osLabel || currentOs === osId);
    });

    setBaixaTargetRow(row);
    setBaixaForm({
      osId: matchedOs ? String((matchedOs as any)?.id || getOsOptionValue(matchedOs as any)) : '',
      dataBaixa: new Date().toISOString().slice(0, 10),
      motivo: ''
    });
    setIsBaixaModalOpen(true);
  };

  const closeBaixaModal = () => {
    setIsBaixaModalOpen(false);
    setBaixaTargetRow(null);
  };

  const handleConfirmBaixa = () => {
    if (!baixaTargetRow) return;

    const itemName = baixaTargetRow.values.material || baixaTargetRow.values.fornecedor || baixaTargetRow.values.equipamento || baixaTargetRow.values.item || 'item';
    const motivo = cleanValue(baixaForm.motivo);
    const osId = cleanValue(baixaForm.osId);
    const dataBaixa = cleanValue(baixaForm.dataBaixa);

    if (!osId || !dataBaixa || !motivo) {
      alert('Preencha OS, data e motivo para registrar a baixa.');
      return;
    }

    const selectedOs = availableOS.find((ordemServico: any) => {
      const osValue = getOsOptionValue(ordemServico as any);
      const osLabel = getOsOptionLabel(ordemServico as any);
      const currentId = String((ordemServico as any)?.id || '');
      return osId === osValue || osId === osLabel || osId === currentId;
    });
    const osLabel = selectedOs ? getOsOptionLabel(selectedOs as any) : osId;
    const osLocal = selectedOs ? getOsLocalExecution(selectedOs) : '';

    setBaixasHistorico((prev) => [
      {
        id: `baixa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataBaixa,
        tableName: baixaTargetRow.tableName,
        itemLabel: itemName,
        statusAnterior: baixaTargetRow.values.status || '',
        motivo,
        osId,
        osLabel,
        localizacao: baixaTargetRow.values.localizacao || osLocal || '',
        serviceOS: osLabel,
        snapshot: { ...baixaTargetRow.values }
      },
      ...prev
    ]);

    setTables((previous) => previous.map((table) => {
      if (table.name !== baixaTargetRow.tableName) return table;
      return {
        ...table,
        rows: table.rows.filter((currentRow) => currentRow.id !== baixaTargetRow.id)
      };
    }));

    if (baixaTargetRow.tableName === 'Alugados - Gases') {
      setAllocations((previous) => previous.filter((allocation) => allocation.supplierRowId !== baixaTargetRow.id));
      setExpandedGasRows((previous) => {
        const next = new Set(previous);
        next.delete(baixaTargetRow.id);
        return next;
      });
    }

    if (activeRowTarget?.tableName === baixaTargetRow.tableName && activeRowTarget?.rowId === baixaTargetRow.id) {
      setActiveRowTarget(null);
    }

    closeBaixaModal();
    setBaixaForm({
      osId: '',
      dataBaixa: new Date().toISOString().slice(0, 10),
      motivo: ''
    });
  };

  const openEditFromRow = () => {
    if (!activeRow) return;
    setEditingRowTarget({ tableName: activeRow.table.name, rowId: activeRow.row.id });
    setRegisterTableName(activeRow.table.name);
    setRegisterValues(createRegisterValues(activeRow.table, activeRow.row.values));
    setIsRegisterOpen(true);
    setActiveRowTarget(null);
  };

  const openRegisterModal = () => {
    setEditingRowTarget(null);
    let tableToUse: StockTable | undefined;
    
    if (selectedCategory === 'Materiais') {
      tableToUse = tables.find(t => t.name === 'Materiais');
    } else if (selectedCategory === 'Equipamentos') {
      tableToUse = tables.find(t => t.name === selectedType);
    } else if (selectedCategory === 'Alugados') {
      if (selectedType === 'Gases') {
        tableToUse = tables.find(t => t.name === 'Alugados - Gases');
      } else {
        tableToUse = tables.find(t => t.name === 'Alugados - Equipamentos');
      }
    }
    
    if (!tableToUse) tableToUse = tables[0];
    
    setRegisterTableName(tableToUse.name);
    setRegisterValues(createRegisterValues(tableToUse));
    setIsRegisterOpen(true);
  };

  const resolveSelectedOsData = (osId: string) => {
    const selectedOs = availableOS.find((ordemServico: any) => {
      const osValue = String(getOsOptionValue(ordemServico as any) || '');
      const currentId = String((ordemServico as any)?.id || '');
      return osValue === String(osId) || currentId === String(osId);
    });

    const osLabel = selectedOs ? getOsOptionLabel(selectedOs as any) : osId;
    const osLocal = selectedOs ? getOsLocalExecution(selectedOs) : '';

    return { selectedOs, osLabel, osLocal };
  };

  const handleRegisterChange = (columnKey: string, value: string) => {
    setRegisterValues((previous) => {
      const next = { ...previous, [columnKey]: value };

      if (columnKey === 'serviceOS') {
        const selectedOs = availableOS.find((ordemServico: any) => String(getOsOptionValue(ordemServico as any)) === String(value) || String((ordemServico as any)?.id || '') === String(value));
        next.localizacao = selectedOs ? getOsLocalExecution(selectedOs) : '';
      }

      if (registerTableName === 'Alugados - Gases' && columnKey.startsWith('gas')) {
        const newTotal = gasTypes.reduce((sum, gas) => {
          const key = `gas${normalizeKey(gas)}`;
          return sum + (Number(next[key]) || 0);
        }, 0);
        next['total'] = String(newTotal);
      }

      return next;
    });
  };

  const getRequiredFieldForTable = (tableName: string) => {
    if (tableName.includes('Alugados - Gases')) return 'fornecedor';
    if (tableName.includes('Alugados - Equipamentos')) return 'equipamento';
    return 'material';
  };

  const handleSaveRegister = () => {
    const table = tables.find((item) => item.name === registerTableName);
    if (!table) return;
    const wasEditing = Boolean(editingRowTarget && editingRowTarget.tableName === table.name);

    const missingRequiredFields = table.columns
      .filter((column) => column.key !== 'actions' && column.key !== 'item')
      .filter((column) => !cleanValue(registerValues[column.key]));

    if (missingRequiredFields.length > 0) {
      alert(`Preencha todos os campos obrigatórios antes de salvar:\n\n${missingRequiredFields.map((column) => `- ${column.label}`).join('\n')}`);
      return;
    }

    const payload = table.columns.reduce<Record<string, string>>((accumulator, column) => {
      const value = cleanValue(registerValues[column.key]);
      if (value) {
        accumulator[column.key] = value;
      }
      return accumulator;
    }, {});

    const requiredField = getRequiredFieldForTable(table.name);
    if (!payload[requiredField]) {
      return;
    }

    payload.item = payload.item || generateItemId(table.name, table.rows.length);

    const existingRowIndex = editingRowTarget && editingRowTarget.tableName === table.name
      ? table.rows.findIndex((row) => row.id === editingRowTarget.rowId)
      : -1;
    const rowIndex = existingRowIndex >= 0 ? existingRowIndex : table.rows.length;
    const nextRow = makeRow(payload, table.name, rowIndex, editingRowTarget?.rowId);

    setTables((previous) =>
      previous.map((item) => (
        item.name === table.name
          ? editingRowTarget && editingRowTarget.tableName === table.name
            ? { ...item, rows: item.rows.map((row) => (row.id === editingRowTarget.rowId ? nextRow : row)) }
            : { ...item, rows: [nextRow, ...item.rows] }
          : item
      ))
    );

    setFiltro('');
    setIsRegisterOpen(false);
    setEditingRowTarget(null);
    setActiveRowTarget(wasEditing ? { tableName: table.name, rowId: nextRow.id } : null);
  };

  const handleSaveAllocation = () => {
    const { supplierRowId, gasName, quantity, local, serviceOS } = allocateForm;

    if (!supplierRowId || !gasName || !quantity || !local || !serviceOS) {
      alert('Por favor, preencha todos os campos da alocação e selecione uma OS.');
      return;
    }

    const tableGases = tables.find(t => t.name === 'Alugados - Gases');
    const supplierRow = tableGases?.rows.find(r => r.id === supplierRowId);
    
    if (!supplierRow) return;

    const { osLabel, osLocal } = resolveSelectedOsData(serviceOS);
    const effectiveLocal = osLocal || local;

    const gasKey = `gas${normalizeKey(gasName)}`;
    const totalOwned = Number(supplierRow.values[gasKey]) || 0;
    
    const totalAlreadyAllocated = allocations
      .filter(a => a.supplierRowId === supplierRowId && a.gasName === gasName)
      .reduce((sum, a) => sum + a.quantity, 0);

    const availableNow = totalOwned - totalAlreadyAllocated;
    const requestedQuantity = Number(quantity);

    if (requestedQuantity > availableNow) {
      alert(
        `Erro: Saldo insuficiente! \n\n` +
        `Você tentou alocar ${requestedQuantity} unidade(s) de ${gasName}, ` +
        `mas existem apenas ${availableNow} disponível(eis) no estoque deste fornecedor.`
      );
      return; 
    }

    const newAlloc: GasAllocation = {
      id: Math.random().toString(36).substring(7),
      supplierRowId,
      gasName,
      quantity: requestedQuantity,
      local: effectiveLocal,
      serviceOS,
    };

    setAllocations((prev) => [...prev, newAlloc]);
    setAlocacoesHistorico((prev) => [
      {
        id: `aloc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action: 'alocar',
        kind: 'gases',
        dataEvento: new Date().toISOString(),
        osId: serviceOS,
        osLabel,
        itemLabel: gasName,
        tableName: 'Alugados - Gases',
        quantity: requestedQuantity,
        local: effectiveLocal,
        gasName
      },
      ...prev
    ]);
    setIsAllocateModalOpen(false);
    setAllocateForm({ supplierRowId: '', gasName: '', quantity: '1', local: '', serviceOS: '' });
    setExpandedGasRows(prev => new Set(prev).add(supplierRowId));
  };

  const handleRemoveAllocation = (allocationId: string, supplierRowId: string) => {
    const confirmRemoval = window.confirm('Deseja desalocar este serviço?');
    if (!confirmRemoval) return;

    const allocationToRemove = allocations.find((allocation) => allocation.id === allocationId);
    setAllocations((prev) => prev.filter((allocation) => allocation.id !== allocationId));
    if (allocationToRemove) {
      setAlocacoesHistorico((prev) => [
        {
          id: `desal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          action: 'desalocar',
          kind: 'gases',
          dataEvento: new Date().toISOString(),
          osId: allocationToRemove.serviceOS,
          osLabel: allocationToRemove.serviceOS,
          itemLabel: allocationToRemove.gasName,
          tableName: 'Alugados - Gases',
          quantity: allocationToRemove.quantity,
          local: allocationToRemove.local,
          gasName: allocationToRemove.gasName
        },
        ...prev
      ]);
    }
    setExpandedGasRows((prev) => new Set(prev).add(supplierRowId));
  };

  const handleDisallocateRow = (row: StockRow) => {
    const confirmRemoval = window.confirm('Deseja desalocar este item?');
    if (!confirmRemoval) return;

    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.name !== row.tableName) return table;

        return {
          ...table,
          rows: table.rows.map((currentRow) => {
            if (currentRow.id !== row.id) return currentRow;

            const nextValues = { ...currentRow.values };
            delete nextValues.serviceOS;
            delete nextValues.localizacao;
            if (normalizeKey(nextValues.status || '') === 'alocado') {
              nextValues.status = getDefaultStatusForTable(currentRow.tableName);
            }

            return {
              ...currentRow,
              values: nextValues,
            };
          })
        };
      })
    );

    setAlocacoesHistorico((prev) => [
      {
        id: `desal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action: 'desalocar',
        kind: row.tableName === 'Alugados - Equipamentos' ? 'equipamentos' : row.tableName === 'Materiais' ? 'materiais' : 'outros',
        dataEvento: new Date().toISOString(),
        osId: row.values.serviceOS || '',
        osLabel: row.values.serviceOS || '',
        itemLabel: row.values.material || row.values.equipamento || row.values.modelo || row.values.item || 'Item',
        tableName: row.tableName,
        local: row.values.localizacao || ''
      },
      ...prev
    ]);
  };

  const handleSaveEquipAllocation = () => {
    if (!equipAllocateForm.local || !equipAllocateForm.osId) {
      alert('Por favor, preencha o local e selecione a OS.');
      return;
    }

    const { osLabel, osLocal } = resolveSelectedOsData(equipAllocateForm.osId);
    const effectiveLocal = osLocal || equipAllocateForm.local;

    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.name === equipAllocateForm.tableName) {
          return {
            ...table,
            rows: table.rows.map((row) => {
              if (row.id === equipAllocateForm.rowId) {
                return {
                  ...row,
                  values: {
                    ...row.values,
                    status: 'Alocado',
                    localizacao: effectiveLocal,
                    serviceOS: equipAllocateForm.osId
                  }
                };
              }
              return row;
            })
          };
        }
        return table;
      })
    );

    setAlocacoesHistorico((prev) => [
      {
        id: `aloc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action: 'alocar',
        kind: equipAllocateForm.tableName === 'Alugados - Equipamentos' ? 'equipamentos' : equipAllocateForm.tableName === 'Materiais' ? 'materiais' : 'outros',
        dataEvento: new Date().toISOString(),
        osId: equipAllocateForm.osId,
        osLabel,
        itemLabel: equipAllocateForm.equipName,
        tableName: equipAllocateForm.tableName,
        local: effectiveLocal
      },
      ...prev
    ]);

    setIsEquipAllocateModalOpen(false);
    setEquipAllocateForm({ rowId: '', tableName: '', equipName: '', local: '', osId: '' });
  };

  const keyForRow = (tableName: string, rowId: string) => `${tableName}::${rowId}`;

  const getSelectedRows = () => {
    const items: { tableName: string; row: StockRow }[] = [];
    for (const key of Array.from(selectedForRomaneio)) {
      const [tableName, rowId] = key.split('::');
      const table = tables.find(t => t.name === tableName);
      const row = table?.rows.find(r => r.id === rowId);
      if (table && row) items.push({ tableName: table.name, row });
    }
    return items;
  };

  const generateRomaneioPdf = (osLabel: string, osLocal: string, selectedRows: { tableName: string; row: StockRow }[]) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const title = `Romaneio - OS: ${osLabel}`;
    doc.setFontSize(14);
    doc.text(title, 40, 50);

    const rows = selectedRows.map(({ tableName, row }) => [
      tableName,
      row.values.item || row.id,
      row.values.material || row.values.equipamento || row.values.fornecedor || '—',
      row.values.quantidade || row.values.qtd || '1',
      osLocal || row.values.localizacao || '—'
    ]);

    autoTable(doc, {
      head: [['Tabela', 'Item', 'Descrição', 'Quantidade', 'Local']],
      body: rows,
      startY: 80,
      styles: { fontSize: 10 }
    });

    return doc;
  };

  const handleConfirmRomaneio = async () => {
    const selectedRows = getSelectedRows();
    if (selectedRows.length === 0) {
      alert('Selecione ao menos um item para gerar o romaneio.');
      return;
    }

    if (!romaneioOsId) {
      alert('Selecione uma OS para executar a alocação.');
      return;
    }

    let { selectedOs, osLabel, osLocal } = resolveSelectedOsData(romaneioOsId);

    if (!selectedOs) {
      try {
        const resp = await api.get(`ordens-servico/${romaneioOsId}/`);
        const data = resp.data;
        selectedOs = data;
        osLabel = getOsOptionLabel(data as any);
        osLocal = data?.negocio_detalhes?.servicos?.[0]?.local_execucao || data?.local || '';
      } catch (e) {
      }
    }

    const effectiveOsLabel = osLabel || romaneioOsId;
    const effectiveOsLocal = osLocal || '';
    const isBaixa = romaneioMode === 'baixa';

    const romaneioItems = selectedRows.map(({ tableName, row }) => {
      const nextValues = isBaixa
        ? {
            ...row.values,
            serviceOS: effectiveOsLabel,
            localizacao: effectiveOsLocal || row.values.localizacao,
            status: 'Baixa'
          }
        : {
            ...row.values,
            serviceOS: effectiveOsLabel,
            localizacao: effectiveOsLocal || row.values.localizacao,
            status: 'Alocado'
          };

      return {
        tableName,
        rowId: row.id,
        itemLabel: row.values.material || row.values.equipamento || row.values.fornecedor || row.values.item || row.id,
        quantidade: row.values.quantidade || row.values.qtd || '1',
        snapshotBefore: { ...row.values },
        snapshotAfter: { ...nextValues }
      };
    });

    const snapshotByKey = new Map(romaneioItems.map((item) => [keyForRow(item.tableName, item.rowId), item.snapshotAfter]));

    setTables(prev => prev.flatMap(table => [{
      ...table,
      rows: table.rows.filter(row => {
        const key = keyForRow(table.name, row.id);
        return !(romaneioMode === 'baixa' && snapshotByKey.has(key));
      }).map(row => {
        const key = keyForRow(table.name, row.id);
        const nextValues = snapshotByKey.get(key);
        if (!nextValues) return row;
        return {
          ...row,
          values: nextValues,
          searchText: Object.values(nextValues).join(' ').toLowerCase()
        };
      })
    }]));

    const timestamp = new Date().toISOString();
    const newHist = selectedRows.map(({ tableName, row }) => ({
      id: `aloc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      action: (romaneioMode === 'baixa' ? 'baixa' : 'alocar') as AllocationHistoricoItem['action'],
      kind: (tableName === 'Alugados - Equipamentos' ? 'equipamentos' : tableName === 'Materiais' ? 'materiais' : 'outros') as AllocationHistoricoItem['kind'],
      dataEvento: timestamp,
      osId: romaneioOsId,
      osLabel: effectiveOsLabel,
      itemLabel: row.values.material || row.values.equipamento || row.values.item || 'Item',
      tableName,
      local: effectiveOsLocal || row.values.localizacao || ''
    }));

    setAlocacoesHistorico(prev => [...newHist, ...prev]);

    if (romaneioMode === 'baixa') {
      setBaixasHistorico((prev) => [
        ...selectedRows.map(({ tableName, row }) => ({
          id: `baixa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataBaixa: timestamp,
          tableName,
          itemLabel: row.values.material || row.values.equipamento || row.values.fornecedor || row.values.item || 'Item',
          statusAnterior: row.values.status || '',
          osId: romaneioOsId,
          osLabel: effectiveOsLabel,
          localizacao: effectiveOsLocal || row.values.localizacao || '',
          serviceOS: effectiveOsLabel,
          snapshot: { ...row.values }
        })),
        ...prev
      ]);
    }

    setRomaneiosHistorico((prev) => [
      {
        id: `rom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: timestamp,
        mode: romaneioMode,
        osId: romaneioOsId,
        osLabel: effectiveOsLabel,
        osLocal: effectiveOsLocal,
        items: romaneioItems,
      },
      ...prev
    ]);

    try {
      const doc = generateRomaneioPdf(effectiveOsLabel, effectiveOsLocal, selectedRows);
      doc.save(`romaneio-${effectiveOsLabel || romaneioOsId}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar pdf do romaneio', e);
    }

    setSelectedForRomaneio(new Set());
    setIsRomaneioModalOpen(false);
    setRomaneioOsId('');
    setRomaneioMode('alocacao');
  };

  const renderCell = (row: StockRow, column: StockColumn) => {
    if (column.key === '__select__') {
      const key = `${row.tableName}::${row.id}`;
      const checked = selectedForRomaneio.has(key);
      return (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              e.stopPropagation();
              setSelectedForRomaneio((prev) => {
                const next = new Set(prev);
                if (checked) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-white/20 bg-black/20 accent-emerald-500 transition-all cursor-pointer"
          />
        </div>
      );
    }
    if (column.key === 'actions') {
      const isGasTable = row.tableName === 'Alugados - Gases';
      const isEquipamentosCategory = selectedCategory === 'Equipamentos';
      const isAlocado = normalizeKey(row.values.status || '') === 'alocado';
      const hasServiceAllocation = Boolean(cleanValue(row.values.serviceOS));
      const isExpanded = expandedGasRows.has(row.id);

      return (
        <div className="inline-flex items-center justify-end gap-2">
          {isGasTable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const next = new Set(expandedGasRows);
                if (isExpanded) next.delete(row.id);
                else next.add(row.id);
                setExpandedGasRows(next);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-500/25 hover:text-white"
            >
              Alocados {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {isEquipamentosCategory && (
            hasServiceAllocation ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDisallocateRow(row);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white"
              >
                <Trash2 size={14} />
                Desalocar
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEquipAllocateForm({
                    rowId: row.id,
                    tableName: row.tableName,
                    equipName: row.values.material || row.values.modelo || row.values.item || 'Equipamento',
                    local: '',
                    osId: ''
                  });
                  setIsEquipAllocateModalOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-500/25 hover:text-white"
              >
                <MapPin size={14} />
                Alocar
              </button>
            )
          )}

          {!isEquipamentosCategory && hasServiceAllocation && row.tableName !== 'Alugados - Gases' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDisallocateRow(row);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white"
            >
              <Trash2 size={14} />
              Desalocar
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openBaixaModal(row);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-500/25 hover:text-white"
          >
            <Trash2 size={14} />
            Baixa
          </button>
        </div>
      );
    }

    const value = row.values[column.key] || '—';
    const rowIsNegative = isNegativeStatus(row.tableName, row.values.status || '');
    const textTone = rowIsNegative ? 'text-red-100' : 'text-white/80';

    if (column.key === 'status') {
      return (
        <Badge variant="outline" className={`rounded-full border px-3 py-1 shadow-sm ${getStatusTone(value, row.tableName)}`}>
          {value}
        </Badge>
      );
    }

    return (
      <span className={`block whitespace-pre-wrap text-[13px] leading-relaxed ${textTone} ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''}`}>
        {value}
      </span>
    );
  };

  const renderRegisterField = (column: StockColumn, table: StockTable) => {
    const value = registerValues[column.key] || '';
    const isTextarea = /descricao|observacao|texto|detalhe|conteudo/.test(column.key);
    const baseClass = 'w-full rounded-xl border border-white/10 bg-[#0b1220]/80 px-4 py-3 text-sm text-white outline-none shadow-sm transition placeholder:text-white/30 focus:border-amber-400 focus:ring-1 focus:ring-amber-400';

    if (column.key === 'item') {
      return <Input value={value} readOnly className={`${baseClass} h-12 opacity-70`} placeholder="ID automático do item" />;
    }

    if (column.key === 'status') {
      const statusOptions = getStatusOptionsForTable(table.name);
      return (
        <Select value={value} onValueChange={(nextValue) => handleRegisterChange(column.key, nextValue)}>
          <SelectTrigger className={`${baseClass} h-12 justify-between`}>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent className="border border-white/10 bg-[#0b1220] text-white shadow-2xl">
            {statusOptions.map((option) => (
              <SelectItem key={option} value={option} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (column.key === 'serviceOS') {
      return (
        <Select value={value} onValueChange={(nextValue) => handleRegisterChange(column.key, nextValue)}>
          <SelectTrigger className={`${baseClass} h-12 justify-between`}>
            <SelectValue placeholder="Selecione uma OS" />
          </SelectTrigger>
          <SelectContent className="border border-white/10 bg-[#0b1220] text-white shadow-2xl">
            {availableOS.map((ordemServico) => (
              <SelectItem key={getOsOptionValue(ordemServico)} value={getOsOptionValue(ordemServico)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                {getOsOptionLabel(ordemServico)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (isTextarea) {
      return (
        <textarea
          value={value}
          onChange={(event) => handleRegisterChange(column.key, event.target.value)}
          className={`${baseClass} min-h-[104px] resize-y`}
          placeholder={`Preencha ${column.label.toLowerCase()}`}
        />
      );
    }

    return (
      <Input
        value={value}
        onChange={(event) => handleRegisterChange(column.key, event.target.value)}
        placeholder={column.key.startsWith('gas') ? 'Qtd de cilindros' : `Preencha ${column.label.toLowerCase()}`}
        inputMode={column.key === 'quantidade' || column.key.startsWith('gas') ? 'numeric' : 'text'}
        className={`${baseClass} h-12`}
      />
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#101f3d] via-[#0d1830] to-[#0b1220]">
      <div className="border-b border-white/5 p-8 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wide text-white flex items-center drop-shadow-md">
              <Package className="mr-3 text-amber-400" size={32} />
              Controle de Estoque
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/40">
              Gerenciamento de estoque com alocação em cascata
            </p>
          </div>
        </div>
      </div>

      <div className="mx-8 mt-6 grid grid-cols-1 gap-5 rounded-[24px] border border-white/5 bg-gradient-to-r from-white/[0.03] to-transparent p-6 shadow-xl backdrop-blur-md xl:grid-cols-[1fr_1fr_2fr_auto] xl:items-end">
        <div className="space-y-2">
          <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Categoria</label>
          <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as 'Materiais' | 'Equipamentos' | 'Alugados')}>
            <SelectTrigger className="relative h-12 w-full rounded-xl border border-white/5 bg-[#0b1220]/80 pl-11 pr-4 text-white shadow-sm transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400 hover:border-white/20">
              <Package size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
              <SelectValue placeholder="Selecione" className="text-sm font-semibold" />
            </SelectTrigger>
            <SelectContent className="border border-white/10 bg-[#0b1220]/95 text-white shadow-2xl backdrop-blur">
              <SelectItem value="Materiais" className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                Materiais
              </SelectItem>
              <SelectItem value="Equipamentos" className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                Equipamentos
              </SelectItem>
              <SelectItem value="Alugados" className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                Alugados
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Tipo</label>
          {(selectedCategory === 'Equipamentos' || selectedCategory === 'Alugados') ? (
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="relative h-12 w-full rounded-xl border border-white/5 bg-[#0b1220]/80 pl-11 pr-4 text-white shadow-sm transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 hover:border-white/20">
                <Layers3 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" />
                <SelectValue placeholder="Selecione" className="text-sm font-semibold" />
              </SelectTrigger>
              <SelectContent className="border border-white/10 bg-[#0b1220]/95 text-white shadow-2xl backdrop-blur">
                {(categoryMap[selectedCategory] as string[]).map((type) => (
                  <SelectItem key={type} value={type} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-12 w-full items-center rounded-xl border border-white/5 bg-[#0b1220]/40 px-4 text-xs font-semibold uppercase tracking-widest text-white/30">
              Sem subtipo
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Busca e Filtro</label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Buscar por nome, fornecedor..."
                value={filtro}
                onChange={(event) => setFiltro(event.target.value)}
                className="h-12 w-full rounded-xl border border-white/5 bg-[#0b1220]/80 pl-11 pr-4 text-white placeholder:text-white/30 shadow-sm transition focus:border-white/30 hover:border-white/20"
              />
            </div>

            <Select value={selectedOsFilter || '__all__'} onValueChange={(value) => setSelectedOsFilter(value === '__all__' ? '' : value)}>
              <SelectTrigger className="h-12 w-full rounded-xl border border-white/5 bg-[#0b1220]/80 px-4 text-white shadow-sm transition hover:border-white/20">
                <SelectValue placeholder="Filtrar por OS" />
              </SelectTrigger>
              <SelectContent className="border border-white/10 bg-[#0b1220] text-white shadow-2xl">
                <SelectItem value="__all__" className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                  Todas as OS
                </SelectItem>
                {availableOS.map((ordemServico: any) => (
                  <SelectItem
                    key={getOsOptionValue(ordemServico)}
                    value={getOsOptionValue(ordemServico)}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white"
                  >
                    {getOsOptionLabel(ordemServico)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Ação Rápida</label>
          <div className="grid grid-cols-2 gap-2 w-full min-w-[260px]">
            {selectedTable.name === 'Alugados - Gases' ? (
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(true)}
                className="col-span-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/15 px-4 text-xs font-bold uppercase tracking-widest text-red-200 transition hover:bg-red-500/25 hover:text-white shadow-sm"
              >
                <MapPin size={16} />
                Alocar
              </button>
            ) : (
              <button
                type="button"
                onClick={openRegisterModal}
                className="col-span-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 text-xs font-bold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white shadow-sm"
              >
                <Plus size={16} />
                Registrar Item
              </button>
            )}
            
            <div className="col-span-2 flex h-12 w-full items-center justify-between rounded-xl border border-white/5 bg-[#0b1220]/60 px-3 overflow-hidden shadow-inner">
               <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 truncate mr-2">
                 Selec. <span className="ml-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-amber-400">{selectedForRomaneio.size}</span>
               </div>
               <button
                type="button"
                disabled={selectedForRomaneio.size === 0}
                onClick={() => setIsRomaneioModalOpen(true)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold uppercase tracking-widest transition whitespace-nowrap ${selectedForRomaneio.size === 0 ? 'border-transparent bg-white/5 text-white/30' : 'border-amber-500/30 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 hover:text-white shadow-sm'}`}
               >
                 <ClipboardList size={14} />
                 Romaneio
               </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 px-8 pt-6">
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60 shadow-sm">
          <Layers3 size={14} className="text-amber-400" />
          {selectedCategory === 'Materiais'
            ? 'Visualizando Materiais'
            : selectedCategory === 'Equipamentos'
            ? `Equipamentos / ${selectedType}`
            : `Alugados / ${selectedType}`}
        </div>
        <div className="rounded-full border border-white/5 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50 shadow-sm">
          Exibindo {visibleRows.length} de {selectedTable.rows.length} registros
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-4 pb-8">
        {visibleRows.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-white/5 bg-white/[0.02] backdrop-blur shadow-inner">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-[#0b1220]/50 shadow-sm">
                <Package size={28} className="text-white/30" />
              </div>
              <p className="font-bold text-white/60">Nenhum registro encontrado</p>
              <p className="mt-2 text-sm text-white/35">Ajuste a busca, o filtro de OS ou troque o tipo.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-white/5 bg-[#0b1220]/40 shadow-xl backdrop-blur-md">
            <div className="overflow-auto">
              <table className="min-w-max w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#131f37] shadow-sm">
                  <tr className="border-b border-white/10">
                    {visibleColumns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-white/50 ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visibleRows.map((row) => {
                    const rowIsNegative = isNegativeStatus(row.tableName, row.values.status || '');
                    const isExpanded = expandedGasRows.has(row.id);

                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          onClick={() => openRowDetails(row)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openRowDetails(row);
                            }
                          }}
                          className={`cursor-pointer transition-colors ${rowIsNegative ? 'bg-red-500/[0.03] hover:bg-red-500/10' : 'hover:bg-white/5'}`}
                        >
                          {visibleColumns.map((column) => (
                            <td
                              key={`${row.id}-${column.key}`}
                              className={`px-5 py-4 align-middle ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''}`}
                            >
                              {renderCell(row, column)}
                            </td>
                          ))}
                        </tr>

                        {/* SUBTABELA DE ALOCAÇÕES */}
                        {isExpanded && row.tableName === 'Alugados - Gases' && (
                          <tr className="bg-[#080d18] cursor-default" onClick={(e) => e.stopPropagation()}>
                            <td colSpan={visibleColumns.length} className="p-0 border-b border-white/5">
                              <div className="p-6 pt-5 pb-6 pl-14 shadow-inner border-l-2 border-red-500/40">
                                <h4 className="text-[11px] font-bold text-white/50 mb-4 uppercase tracking-wider flex items-center gap-2">
                                  <ChevronDown size={14} className="text-red-400" /> Detalhamento de Alocação - Fornecedor: {row.values.fornecedor}
                                </h4>

                                <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
                                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 py-1.5 px-3 rounded-lg text-xs">
                                    Disponíveis no Estoque
                                  </Badge>
                                  <div className="flex flex-wrap gap-8 ml-2">
                                    {gasTypes.map(g => {
                                      const gasKey = `gas${normalizeKey(g)}`;
                                      const totalOwned = Number(row.values[gasKey]) || 0;
                                      const totalAllocated = allocations
                                        .filter(a => a.supplierRowId === row.id && a.gasName === g)
                                        .reduce((sum, a) => sum + a.quantity, 0);
                                      const available = totalOwned - totalAllocated;
                                      return (
                                        <div key={g} className="text-center">
                                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{g}</p>
                                          <p className="text-lg font-bold text-emerald-400 drop-shadow-sm">{available}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <h5 className="text-[10px] font-bold text-white/50 mb-3 uppercase tracking-widest">
                                  Cilindros Alocados (Em campo)
                                </h5>
                                <div className="rounded-xl border border-white/5 overflow-hidden bg-[#0b1220]/80">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase tracking-widest text-white/40">
                                        <th className="py-3 px-4 text-left w-28">Status</th>
                                        <th className="py-3 px-4 text-left">Local</th>
                                        <th className="py-3 px-4 text-left">Serviço (OS)</th>
                                        {gasTypes.map(g => <th key={g} className="py-3 px-4 text-center">{g}</th>)}
                                        <th className="py-3 px-4 text-center">Total Linha</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {allocations.filter(a => a.supplierRowId === row.id).length === 0 && (
                                        <tr>
                                          <td colSpan={gasTypes.length + 5} className="py-8 text-center text-white/30 text-xs">
                                            Nenhum cilindro alocado para este fornecedor.
                                          </td>
                                        </tr>
                                      )}
                                      {allocations.filter(a => a.supplierRowId === row.id).map(alloc => (
                                        <tr key={alloc.id} className="hover:bg-white/5 transition-colors">
                                          <td className="py-3 px-4">
                                            <Badge className="bg-red-500/15 text-red-300 border-red-500/30 rounded-lg shadow-sm">Alocado</Badge>
                                          </td>
                                          <td className="py-3 px-4 text-[13px] text-white/80">{alloc.local}</td>
                                          <td className="py-3 px-4 text-[13px] text-white/80">{alloc.serviceOS}</td>
                                          {gasTypes.map(g => (
                                            <td key={g} className="py-3 px-4 text-center text-[13px] text-white/60">
                                              {alloc.gasName === g ? (
                                                <span className="font-bold text-white">{alloc.quantity}</span>
                                              ) : '—'}
                                            </td>
                                          ))}
                                          <td className="py-3 px-4 text-center text-[13px] text-red-300 font-bold">
                                            {alloc.quantity}
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveAllocation(alloc.id, row.id)}
                                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-500/20 hover:text-white"
                                            >
                                              <Trash2 size={12} />
                                              Desalocar
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE REGISTRO / EDIÇÃO PADRÃO */}
      {isRegisterOpen && currentRegisterTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-[#101f3d] to-[#0d1830] p-6 shadow-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/80 mb-1">{editingRowTarget ? 'Editar registro' : 'Novo registro'}</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-white">
                  {editingRowTarget ? 'Editar item no estoque' : 'Cadastrar item no estoque'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeRegisterModal}
                className="rounded-full bg-white/5 p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-100px)] overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Tipo do item</label>
                  <Select value={registerTableName} onValueChange={setRegisterTableName} disabled={Boolean(editingRowTarget)}>
                    <SelectTrigger className="h-16 rounded-xl border border-white/5 bg-[#0b1220]/80 px-4 text-white shadow-sm transition hover:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400">
                      <div className="flex min-w-0 items-center gap-3 text-left w-full">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 shadow-inner ${registerTableIcon.badgeClass}`}>
                          <registerTableIcon.Icon size={18} className={registerTableIcon.iconClass} />
                        </div>
                        <div className="min-w-0 flex-1">
                           <SelectValue placeholder="Escolha o tipo" className="text-sm font-semibold truncate" />
                        </div>
                      </div>
                    </SelectTrigger>
                    {editingRowTarget && (
                      <p className="ml-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
                        A tabela fica fixa na edição.
                      </p>
                    )}
                    <SelectContent className="border border-white/10 bg-[#0b1220]/95 p-2 text-white shadow-2xl backdrop-blur">
                      {tables.map((table) => (
                        <SelectItem key={table.name} value={table.name} className="cursor-pointer rounded-lg px-3 py-3 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                          {(() => {
                            const tableIcon = getTableIconConfig(table.name);
                            return (
                              <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${tableIcon.badgeClass}`}>
                                  <tableIcon.Icon size={14} className={tableIcon.iconClass} />
                                </div>
                                <span className="min-w-0 flex-1 truncate font-semibold">{table.name}</span>
                              </div>
                            );
                          })()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-inner flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1">Campos do tipo selecionado</p>
                      <p className="text-sm text-white/70">Os campos adaptam-se à tabela {currentRegisterTable.name}.</p>
                    </div>
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold tracking-wide text-emerald-300 whitespace-nowrap shadow-sm">
                      {currentRegisterTable.columns.length} campos
                    </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 shadow-inner">
                <div className="mb-6 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">Preenchimento do item</h3>
                </div>

                <p className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-amber-100">
                  Todos os campos são obrigatórios. Ao selecionar a OS, o local é preenchido automaticamente.
                </p>

                {currentRegisterTable.name === 'Alugados - Gases' && (
                  <div className="col-span-full mb-8 space-y-6">
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 shadow-sm">
                      <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                        Configuração de Colunas de Gases
                      </h4>
                      <div className="flex flex-wrap items-center gap-3">
                        <Input
                          value={newGasName}
                          onChange={(e) => setNewGasName(e.target.value)}
                          placeholder="Ex: Hidrogênio..."
                          className="h-12 w-full max-w-xs rounded-xl border border-cyan-500/30 bg-[#0b1220]/80 text-sm text-white focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newGasName.trim();
                            if (trimmed && !gasTypes.includes(trimmed)) {
                              setGasTypes((prev) => [...prev, trimmed]);
                              setNewGasName('');
                              setRegisterValues((prev) => ({ ...prev, [`gas${normalizeKey(trimmed)}`]: '0' }));
                            }
                          }}
                          className="inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-600 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-cyan-500"
                        >
                          <Plus size={16} />
                          Add Gás
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-[#0b1220]/40 p-5 shadow-inner">
                      <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-red-400/80">
                        Gases Ativos (Clique no X para remover)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gasTypes.map((gas) => (
                          <div 
                            key={gas} 
                            className="flex items-center gap-2 rounded-lg bg-[#131f37] border border-white/10 pl-3 pr-1 py-1 shadow-sm"
                          >
                            <span className="text-xs font-bold text-white/90">{gas}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveGas(gas)}
                              className="p-1.5 hover:bg-red-500/20 rounded-md text-white/50 hover:text-red-400 transition"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {currentRegisterTable.columns.map((column) => {
                    if (column.key === 'actions') return null;
                    return (
                      <div key={column.key} className={column.key === 'status' ? 'md:col-span-1' : ''}>
                        <label className="ml-1 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/50">
                          {column.label}
                        </label>
                        {renderRegisterField(column, currentRegisterTable)}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-white/5 pt-6 mt-4">
                <button
                  type="button"
                  onClick={closeRegisterModal}
                  className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRegister}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500"
                >
                  <CheckCircle2 size={16} />
                  {editingRowTarget ? 'Salvar alterações' : 'Salvar item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBaixaModalOpen && baixaTargetRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6 shadow-sm">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-red-400">Baixa de item</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-white">Registrar baixa</h2>
              </div>
              <button
                type="button"
                onClick={closeBaixaModal}
                className="rounded-full bg-white/5 p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-8">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">Item selecionado</p>
                <p className="mt-2 text-lg font-black text-white">
                  {baixaTargetRow.values.material || baixaTargetRow.values.equipamento || baixaTargetRow.values.fornecedor || baixaTargetRow.values.item || 'Item'}
                </p>
                <p className="mt-1 text-sm text-white/45">{baixaTargetRow.tableName}</p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">OS</label>
                  <Select value={baixaForm.osId} onValueChange={(value) => setBaixaForm((prev) => ({ ...prev, osId: value }))}>
                    <SelectTrigger className="h-12 rounded-xl border border-white/5 bg-[#0b1220]/80 px-4 text-white shadow-sm transition hover:border-red-400/40 focus:ring-1 focus:ring-red-400">
                      <SelectValue placeholder="Selecione a OS" />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220]/95 p-2 text-white shadow-2xl backdrop-blur">
                      {availableOS.length === 0 ? (
                        <SelectItem value="__none__" disabled className="cursor-not-allowed rounded-lg px-3 py-3 text-sm text-white/40">
                          Nenhuma OS disponível
                        </SelectItem>
                      ) : (
                        availableOS.map((ordemServico) => {
                          const value = String((ordemServico as any)?.id || getOsOptionValue(ordemServico as any));
                          return (
                            <SelectItem key={value} value={value} className="cursor-pointer rounded-lg px-3 py-3 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                              {getOsOptionLabel(ordemServico as any)}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Data da baixa</label>
                  <Input
                    type="date"
                    value={baixaForm.dataBaixa}
                    onChange={(event) => setBaixaForm((prev) => ({ ...prev, dataBaixa: event.target.value }))}
                    className="h-12 rounded-xl border border-white/5 bg-[#0b1220]/80 px-4 text-white shadow-sm transition hover:border-red-400/40 focus:border-red-400 focus:ring-1 focus:ring-red-400"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Motivo</label>
                  <textarea
                    value={baixaForm.motivo}
                    onChange={(event) => setBaixaForm((prev) => ({ ...prev, motivo: event.target.value }))}
                    placeholder="Descreva o motivo da baixa"
                    className="min-h-[120px] w-full rounded-xl border border-white/5 bg-[#0b1220]/80 px-4 py-3 text-sm text-white outline-none shadow-sm transition placeholder:text-white/30 focus:border-red-400 focus:ring-1 focus:ring-red-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-white/5 pt-6">
                <button
                  type="button"
                  onClick={closeBaixaModal}
                  className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBaixa}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500"
                >
                  <Trash2 size={16} />
                  Confirmar baixa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALOCAÇÃO DE GASES */}
      {isAllocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6 shadow-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-400 mb-1">Alocação de Cilindros</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-white">Alocar Gás</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                className="rounded-full bg-white/5 p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Fornecedor</label>
                  <Select 
                    value={allocateForm.supplierRowId} 
                    onValueChange={(val) => setAllocateForm(prev => ({ ...prev, supplierRowId: val }))}
                  >
                    <SelectTrigger className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      {tables.find(t => t.name === 'Alugados - Gases')?.rows.map(row => (
                        <SelectItem key={row.id} value={row.id} className="rounded-lg">
                          {row.values.fornecedor || row.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Substância (Gás)</label>
                  <Select 
                    value={allocateForm.gasName} 
                    onValueChange={(val) => setAllocateForm(prev => ({ ...prev, gasName: val }))}
                  >
                    <SelectTrigger className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      {gasTypes.map(g => (
                        <SelectItem key={g} value={g} className="rounded-lg">{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Quantidade</label>
                  <Input 
                    type="number"
                    value={allocateForm.quantity}
                    onChange={(e) => setAllocateForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20"
                  />

                  {allocateForm.supplierRowId && allocateForm.gasName && (
                    <div className="mt-1.5 ml-1">
                      {(() => {
                        const row = tables.find(t => t.name === 'Alugados - Gases')?.rows.find(r => r.id === allocateForm.supplierRowId);
                        const total = Number(row?.values[`gas${normalizeKey(allocateForm.gasName)}`]) || 0;
                        const allocated = allocations
                          .filter(a => a.supplierRowId === allocateForm.supplierRowId && a.gasName === allocateForm.gasName)
                          .reduce((sum, a) => sum + a.quantity, 0);
                        const diff = total - allocated;
                        
                        return (
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${diff <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {diff <= 0 ? '⚠️ Sem estoque disponível' : `Disponível: ${diff} unidades`}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Serviço (OS)</label>
                  <Select
                    value={allocateForm.serviceOS}
                    onValueChange={(val) => setAllocateForm((prev) => ({ ...prev, serviceOS: val }))}
                  >
                    <SelectTrigger className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20">
                      <SelectValue placeholder="Selecione a OS..." />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      {availableOS.length > 0 ? (
                        availableOS.map((ordemServico: any) => (
                          <SelectItem key={getOsOptionValue(ordemServico) || ordemServico?.id} value={getOsOptionValue(ordemServico) || ordemServico?.id} className="rounded-lg">
                            {getOsOptionLabel(ordemServico) || String(ordemServico?.ordemServicoNumero || ordemServico?.numeroOs || ordemServico?.id || 'OS')}
                          </SelectItem>
                        ))
                      ) : Array.isArray(os) && os.length > 0 ? (
                        os.map((ordemServico: any) => (
                          <SelectItem key={getOsOptionValue(ordemServico) || ordemServico?.id} value={getOsOptionValue(ordemServico) || ordemServico?.id} className="rounded-lg">
                            {getOsOptionLabel(ordemServico) || String(ordemServico?.ordemServicoNumero || ordemServico?.numeroOs || ordemServico?.id || 'OS')}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Nenhuma OS elegível encontrada
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Local / Destino</label>
                  <Input 
                    placeholder="Ex: Estaleiro"
                    value={allocateForm.local}
                    onChange={(e) => setAllocateForm(prev => ({ ...prev, local: e.target.value }))}
                    className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 p-6 bg-[#131f37]">
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAllocation}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500"
              >
                <MapPin size={16} />
                Confirmar Alocação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ROMANEIO / ALOCAÇÃO EM MASSA */}
      {isRomaneioModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/5 p-6 bg-[#101f3d]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1">Romaneio</p>
                <h2 className="text-xl font-black uppercase tracking-wide text-white">
                  {romaneioMode === 'baixa' ? 'Baixa em massa' : 'Alocação em massa'}
                </h2>
              </div>
              <button type="button" onClick={() => setIsRomaneioModalOpen(false)} className="rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex flex-col md:flex-row items-end justify-between gap-6">
                <div className="flex-1 w-full">
                  <label className="block ml-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">Ordem de Serviço (OS)</label>
                  <Select value={romaneioOsId} onValueChange={setRomaneioOsId}>
                    <SelectTrigger className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20">
                      <SelectValue placeholder="Selecione a OS..." />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      {availableOS.map((ordemServico: any) => (
                        <SelectItem key={ordemServico.id} value={String(ordemServico.id)} className="rounded-lg">
                          {getOsOptionLabel(ordemServico)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-56 space-y-2">
                  <label className="block ml-1 text-[11px] font-bold uppercase tracking-wider text-white/50">Tipo de romaneio</label>
                  <Select value={romaneioMode} onValueChange={(value) => setRomaneioMode(value as 'alocacao' | 'baixa')}>
                    <SelectTrigger className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      <SelectItem value="alocacao" className="rounded-lg">Alocação</SelectItem>
                      <SelectItem value="baixa" className="rounded-lg">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-auto min-w-[140px]">
                   <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center shadow-inner">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 mb-1">Selecionados</p>
                      <p className="text-2xl font-black text-amber-400">{selectedForRomaneio.size}</p>
                   </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">Local da OS</p>
                <p className="mt-2 text-sm font-semibold text-white/80">
                  {(() => {
                    const { osLocal } = resolveSelectedOsData(romaneioOsId);
                    return osLocal || 'Será preenchido automaticamente ao selecionar uma OS.';
                  })()}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-inner">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-4">Itens Selecionados</h4>
                <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {getSelectedRows().length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-4">Nenhum item selecionado.</p>
                  ) : (
                    <ul className="space-y-2">
                      {getSelectedRows().map(({ tableName, row }) => (
                        <li key={`${tableName}::${row.id}`} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0b1220]/40 p-3 shadow-sm">
                          <div className="min-w-0 pr-4">
                            <div className="text-sm font-bold text-white truncate">{row.values.material || row.values.fornecedor || row.values.item}</div>
                            <div className="text-xs text-white/50 mt-1">{tableName} • <span className="font-semibold text-white/70">{row.values.quantidade || row.values.qtd || '1'} unid.</span></div>
                          </div>
                          <div>
                            <button 
                              type="button" 
                              onClick={() => setSelectedForRomaneio(prev => { const next = new Set(prev); next.delete(`${tableName}::${row.id}`); return next; })} 
                              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-red-300 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition whitespace-nowrap"
                            >
                              Remover
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 p-6 bg-[#131f37]">
              <button type="button" onClick={() => setIsRomaneioModalOpen(false)} className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition">Cancelar</button>
              <button type="button" onClick={handleConfirmRomaneio} disabled={selectedForRomaneio.size === 0} className="rounded-xl bg-amber-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40 hover:bg-amber-500 shadow-lg transition">Alocar e Gerar Romaneio</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALOCAÇÃO DE EQUIPAMENTOS */}
      {isEquipAllocateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-400 mb-1">Alocação de Equipamento</p>
                <h2 className="text-xl font-black uppercase tracking-wide text-white">Alocar Item</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEquipAllocateModalOpen(false)}
                className="rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="rounded-xl bg-white/[0.02] p-5 border border-white/5 shadow-inner">
                 <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Equipamento Selecionado</p>
                 <p className="font-bold text-white text-base leading-tight">{equipAllocateForm.equipName}</p>
              </div>

              <div className="space-y-2">
                <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Ordem de Serviço (OS)</label>
                <Select 
                  value={equipAllocateForm.osId} 
                  onValueChange={(val) => setEquipAllocateForm(prev => ({ ...prev, osId: val }))}
                >
                  <SelectTrigger className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20">
                    <SelectValue placeholder="Selecione uma OS em produção..." />
                  </SelectTrigger>
                  <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                    {availableOS.length > 0 ? (
                      availableOS.map((ordemServico: any) => (
                        <SelectItem key={getOsOptionValue(ordemServico) || ordemServico?.id} value={getOsOptionValue(ordemServico) || ordemServico?.id} className="rounded-lg cursor-pointer">
                          {getOsOptionLabel(ordemServico) || String(ordemServico?.ordemServicoNumero || ordemServico?.numeroOs || ordemServico?.id || 'OS')}
                        </SelectItem>
                      ))
                    ) : Array.isArray(os) && os.length > 0 ? (
                      os.map((ordemServico: any) => (
                        <SelectItem key={getOsOptionValue(ordemServico) || ordemServico?.id} value={getOsOptionValue(ordemServico) || ordemServico?.id} className="rounded-lg cursor-pointer">
                          {getOsOptionLabel(ordemServico) || String(ordemServico?.ordemServicoNumero || ordemServico?.numeroOs || ordemServico?.id || 'OS')}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>Nenhuma OS em produção</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Local / Destino</label>
                <Input 
                  placeholder="Ex: Canteiro 3, Bordo..."
                  value={equipAllocateForm.local}
                  onChange={(e) => setEquipAllocateForm(prev => ({ ...prev, local: e.target.value }))}
                  className="w-full rounded-xl border border-white/5 bg-[#0b1220]/80 h-12 text-white shadow-sm focus:border-white/30 hover:border-white/20"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-white/5 p-6 bg-[#131f37]">
              <button
                type="button"
                onClick={() => setIsEquipAllocateModalOpen(false)}
                className="flex-1 rounded-xl border border-white/5 bg-[#0b1220]/80 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEquipAllocation}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-900/40 hover:bg-red-500 transition"
              >
                <MapPin size={16} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETALHES DA LINHA LATERAL */}
      {activeRow && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/70 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fechar detalhes do item"
            className="absolute inset-0 cursor-default"
            onClick={closeRowDetails}
          />

          <aside className="relative h-full w-full max-w-xl overflow-hidden border-l border-white/10 bg-[#0d1830] shadow-2xl shadow-black/60 flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-[#101f3d] p-8 shadow-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">Detalhes do item</p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-wide text-white leading-tight">
                  {activeRow.row.values.material || activeRow.row.values.fornecedor || activeRow.row.values.item || 'Item selecionado'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeRowDetails}
                className="rounded-full bg-white/5 p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="mb-8 flex flex-wrap items-center gap-3">
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/70 shadow-sm">
                  {activeRow.table.name}
                </div>
                {activeRow.table.name !== 'Alugados - Gases' && (
                  <Badge variant="outline" className={`rounded-lg border px-4 py-2 shadow-sm ${getStatusTone(activeRow.row.values.status || '—', activeRow.row.tableName)}`}>
                    {activeRow.row.values.status || '—'}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {activeRow.table.columns.filter(col => col.key !== 'actions').map((column) => (
                  <div key={column.key} className="rounded-xl border border-white/5 bg-[#0b1220]/40 p-5 shadow-inner">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{column.label}</p>
                    <p className={`mt-2.5 whitespace-pre-wrap text-[13px] font-medium leading-relaxed ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''} ${isNegativeStatus(activeRow.row.tableName, activeRow.row.values.status || '') ? 'text-red-300' : 'text-white/90'}`}>
                      {activeRow.row.values[column.key] || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-white/5 p-8 bg-[#131f37]">
              <button
                type="button"
                onClick={closeRowDetails}
                className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={openEditFromRow}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-6 py-3 text-xs font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white shadow-sm"
              >
                Editar item
              </button>
              <button
                type="button"
                onClick={() => openBaixaModal(activeRow.row)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/15 px-6 py-3 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/25 hover:text-white shadow-sm"
              >
                <Trash2 size={14} />
                Dar baixa
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}