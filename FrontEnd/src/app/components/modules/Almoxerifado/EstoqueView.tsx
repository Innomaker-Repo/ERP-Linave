import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Anchor, Cable, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Gauge, Hammer, Layers3, MapPin, Microscope, Package, Plus, Search, Table2, TrendingUp, Trash2, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../modules/shared/ui/select';
import { useErp } from '../../../context/ErpContext';
import { getOrdensServico, getOsOptionLabel, getOsOptionValue, type OrdemServicoResumo } from '../../../../services/ordensServico';

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
}

interface GasAllocation {
  id: string;
  supplierRowId: string;
  gasName: string;
  quantity: number;
  local: string;
  serviceOS: string;
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

// Tipos de gases iniciais simulados
const INITIAL_GAS_TYPES = ['Oxigênio', 'Acetileno'];

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

export function EstoqueView({ searchQuery }: StockViewProps) {
  const { os, almoxerifado, saveEntity, loading } = useErp();
  const hasHydratedPersistedState = useRef(false);
  const [ordensServicoBackend, setOrdensServicoBackend] = useState<OrdemServicoResumo[]>([]);

  const [tables, setTables] = useState<StockTable[]>(() => STOCK_TABLES.map((table) => ({
    ...table,
    columns: [...table.columns],
    rows: table.rows.map((row) => ({ ...row, values: { ...row.values } }))
  })));
  
  const [selectedCategory, setSelectedCategory] = useState<'Materiais' | 'Equipamentos' | 'Alugados'>('Materiais');
  const [selectedType, setSelectedType] = useState<string>('');
  const [filtro, setFiltro] = useState<string>(searchQuery || '');
  const [selectedOsFilter, setSelectedOsFilter] = useState<string>('');
  
  // Modais de Criação/Edição
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerTableName, setRegisterTableName] = useState<string>(tables[0]?.name || '');
  const [registerValues, setRegisterValues] = useState<Record<string, string>>(() => createRegisterValues(tables[0]));
  const [activeRowTarget, setActiveRowTarget] = useState<{ tableName: string; rowId: string } | null>(null);
  const [editingRowTarget, setEditingRowTarget] = useState<{ tableName: string; rowId: string } | null>(null);

  // Estados dos Gases e Alocações
  const [gasTypes, setGasTypes] = useState<string[]>(INITIAL_GAS_TYPES);
  const [newGasName, setNewGasName] = useState('');
  const [expandedGasRows, setExpandedGasRows] = useState<Set<string>>(new Set());
  
  // Modal de Alocação Gases
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [allocations, setAllocations] = useState<GasAllocation[]>([]);
  const [allocateForm, setAllocateForm] = useState({
    supplierRowId: '',
    gasName: '',
    quantity: '1',
    local: '',
    serviceOS: ''
  });

  // Modal de Alocação Equipamentos
  const [isEquipAllocateModalOpen, setIsEquipAllocateModalOpen] = useState(false);
  const [equipAllocateForm, setEquipAllocateForm] = useState({
    rowId: '',
    tableName: '',
    equipName: '',
    local: '',
    osId: ''
  });

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
    const source = ordensServicoBackend.length > 0 ? ordensServicoBackend : (Array.isArray(os) ? os : []);
    return source.filter((item: any) => {
      const statusEnvio = item.statusEnvio || item.status_envio || '';
      const statusOs = item.statusOs || item.status_os || '';
      const statusAprovacao = item.statusAprovacao || item.status_aprovacao || '';
      return statusEnvio === 'enviada' || statusOs === 'emproducao' || statusAprovacao === 'aprovada';
    });
  }, [ordensServicoBackend, os]);

  useEffect(() => {
    if (loading || hasHydratedPersistedState.current) return;

    if (almoxerifado?.version === 1) {
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

      hasHydratedPersistedState.current = true;
      return;
    }

    hasHydratedPersistedState.current = true;
    void saveEntity('almoxerifado', { version: 1, tables, gasTypes, allocations });
  }, [loading, almoxerifado, saveEntity, tables, gasTypes, allocations]);

  useEffect(() => {
    if (!hasHydratedPersistedState.current) return;
    void saveEntity('almoxerifado', { version: 1, tables, gasTypes, allocations });
  }, [tables, gasTypes, allocations, saveEntity]);

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

  const stats = useMemo(() => {
    const criticalItems = visibleRows.filter((row) => normalizeKey(row.values.status || '').includes('crit')).length;
    return {
      totalTables: tables.length,
      visibleRows: visibleRows.length,
      visibleColumns: visibleColumns.length,
      criticalItems
    };
  }, [tables.length, visibleColumns.length, visibleRows]);

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

  const handleDarBaixa = (row: StockRow) => {
    const itemName = row.values.material || row.values.fornecedor || row.values.equipamento || row.values.item || 'item';
    const shouldDelete = window.confirm(
      `Dar baixa no item "${itemName}"?\n\nEsta ação remove o item do sistema e não pode ser desfeita.`
    );

    if (!shouldDelete) return;

    setTables((previous) => previous.map((table) => {
      if (table.name !== row.tableName) return table;
      return {
        ...table,
        rows: table.rows.filter((currentRow) => currentRow.id !== row.id)
      };
    }));

    if (row.tableName === 'Alugados - Gases') {
      setAllocations((previous) => previous.filter((allocation) => allocation.supplierRowId !== row.id));
      setExpandedGasRows((previous) => {
        const next = new Set(previous);
        next.delete(row.id);
        return next;
      });
    }

    if (activeRowTarget?.tableName === row.tableName && activeRowTarget?.rowId === row.id) {
      setActiveRowTarget(null);
    }

    if (editingRowTarget?.tableName === row.tableName && editingRowTarget?.rowId === row.id) {
      setEditingRowTarget(null);
      setIsRegisterOpen(false);
    }

    if (equipAllocateForm.tableName === row.tableName && equipAllocateForm.rowId === row.id) {
      setEquipAllocateForm({ rowId: '', tableName: '', equipName: '', local: '', osId: '' });
      setIsEquipAllocateModalOpen(false);
    }
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

  const handleRegisterChange = (columnKey: string, value: string) => {
    setRegisterValues((previous) => {
      const next = { ...previous, [columnKey]: value };

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
      local,
      serviceOS,
    };

    setAllocations((prev) => [...prev, newAlloc]);
    setIsAllocateModalOpen(false);
    setAllocateForm({ supplierRowId: '', gasName: '', quantity: '1', local: '', serviceOS: '' });
    setExpandedGasRows(prev => new Set(prev).add(supplierRowId));
  };

  const handleSaveEquipAllocation = () => {
    if (!equipAllocateForm.local || !equipAllocateForm.osId) {
      alert('Por favor, preencha o local e selecione a OS.');
      return;
    }

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
                    localizacao: equipAllocateForm.local,
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

    setIsEquipAllocateModalOpen(false);
    setEquipAllocateForm({ rowId: '', tableName: '', equipName: '', local: '', osId: '' });
  };

  const renderCell = (row: StockRow, column: StockColumn) => {
    if (column.key === 'actions') {
      const isGasTable = row.tableName === 'Alugados - Gases';
      const isEquipamentosCategory = selectedCategory === 'Equipamentos';
      const isAlocado = normalizeKey(row.values.status || '') === 'alocado';
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
              className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-300 transition hover:bg-red-500/25 hover:text-white"
            >
              Alocados {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {isEquipamentosCategory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isAlocado) return;

                setEquipAllocateForm({
                  rowId: row.id,
                  tableName: row.tableName,
                  equipName: row.values.material || row.values.modelo || row.values.item || 'Equipamento',
                  local: '',
                  osId: ''
                });
                setIsEquipAllocateModalOpen(true);
              }}
              disabled={isAlocado}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${isAlocado ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' : 'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 hover:text-white'}`}
            >
              <MapPin size={14} />
              {isAlocado ? 'Alocado' : 'Alocar'}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDarBaixa(row);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-300 transition hover:bg-red-500/25 hover:text-white"
          >
            <Trash2 size={14} />
            Dar baixa
          </button>
        </div>
      );
    }

    const value = row.values[column.key] || '—';
    const rowIsNegative = isNegativeStatus(row.tableName, row.values.status || '');
    const textTone = rowIsNegative ? 'text-red-100' : 'text-white/80';

    if (column.key === 'status') {
      return (
        <Badge variant="outline" className={`rounded-full border px-3 py-1 ${getStatusTone(value, row.tableName)}`}>
          {value}
        </Badge>
      );
    }


    return (
      <span className={`block whitespace-pre-wrap text-xs leading-relaxed ${textTone} ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''}`}>
        {value}
      </span>
    );
  };

  const renderRegisterField = (column: StockColumn, table: StockTable) => {
    const value = registerValues[column.key] || '';
    const isTextarea = /descricao|observacao|texto|detalhe|conteudo/.test(column.key);
    const baseClass = 'w-full rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-amber-400';

    if (column.key === 'item') {
      return <Input value={value} readOnly className={`${baseClass} h-12 opacity-80`} placeholder="ID automático do item" />;
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
              <SelectItem key={option} value={option} className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (column.key === 'total' && table.name === 'Alugados - Gases') {
      return (
        <Input
          value={value}
          readOnly
          className={`${baseClass} h-12 border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-bold opacity-90`}
          placeholder="0"
        />
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
      <div className="border-b border-white/5 p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wide text-white">
              <Package className="mr-3 inline-block text-amber-400" size={32} />
              Controle de Estoque
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/40">
              Gerenciamento de estoque com alocação em cascata
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openRegisterModal}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-5 py-3 text-xs font-black uppercase tracking-widest text-emerald-200 transition hover:from-emerald-500/30 hover:to-cyan-500/30"
            >
              <Plus size={16} />
              Novo item
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 pt-8 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">Tabelas</p>
          <p className="text-3xl font-black text-white">{stats.totalTables}</p>
          <div className="mt-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400">Abas disponíveis</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">Registros Visíveis</p>
          <p className="text-3xl font-black text-white">{stats.visibleRows}</p>
          <div className="mt-2 flex items-center gap-2">
            <Layers3 size={14} className="text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400">Aba atual / Todos</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">Colunas Visíveis</p>
          <p className="text-3xl font-black text-white">{stats.visibleColumns}</p>
          <div className="mt-2 flex items-center gap-2">
            <Table2 size={14} className="text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400">Campos em exibição</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">Itens Críticos</p>
          <p className="text-3xl font-black text-white">{stats.criticalItems}</p>
          <div className="mt-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-[10px] font-bold text-red-400">Status crítico</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 pt-8 xl:grid-cols-[1.05fr_1.05fr_1fr_220px] xl:items-end">
        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Categoria</label>
          <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as 'Materiais' | 'Equipamentos' | 'Alugados')}>
            <SelectTrigger className="group min-h-[55px] rounded-[24px] border border-white/10 bg-gradient-to-r from-white/8 to-white/5 px-5 py-5 text-white shadow-lg shadow-black/15 backdrop-blur transition hover:border-amber-400/40 hover:from-white/12 hover:to-white/8">
              <div className="flex min-w-0 items-center gap-4 text-left">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20">
                  <Package size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase leading-none tracking-widest text-white/40">Categoria</p>
                  <SelectValue placeholder="Selecione" className="mt-1 text-sm font-semibold leading-tight" />
                </div>
              </div>
            </SelectTrigger>
            <SelectContent className="border border-white/10 bg-[#0b1220]/95 text-white shadow-2xl backdrop-blur">
              <SelectItem value="Materiais" className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                Materiais
              </SelectItem>
              <SelectItem value="Equipamentos" className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                Equipamentos
              </SelectItem>
              <SelectItem value="Alugados" className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                Alugados
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(selectedCategory === 'Equipamentos' || selectedCategory === 'Alugados') && (
          <div className="space-y-2">
            <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Tipo</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="group min-h-[55px] rounded-[24px] border border-white/10 bg-gradient-to-r from-white/8 to-white/5 px-5 py-5 text-white shadow-lg shadow-black/15 backdrop-blur transition hover:border-amber-400/40 hover:from-white/12 hover:to-white/8">
                <div className="flex min-w-0 items-center gap-4 text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/20">
                    <Layers3 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase leading-none tracking-widest text-white/40">Tipo</p>
                    <SelectValue placeholder="Selecione" className="mt-1 text-sm font-semibold leading-tight" />
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent className="border border-white/10 bg-[#0b1220]/95 text-white shadow-2xl backdrop-blur">
                {(categoryMap[selectedCategory] as string[]).map((type) => (
                  <SelectItem key={type} value={type} className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Busca</label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
              <Input
                placeholder="Buscar por nome, categoria, fornecedor..."
                value={filtro}
                onChange={(event) => setFiltro(event.target.value)}
                className="h-14 border-white/10 bg-white/5 pl-12 text-white placeholder:text-white/40"
              />
            </div>

            <Select value={selectedOsFilter || '__all__'} onValueChange={(value) => setSelectedOsFilter(value === '__all__' ? '' : value)}>
              <SelectTrigger className="h-14 border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Filtrar por OS" />
              </SelectTrigger>
              <SelectContent className="border border-white/10 bg-[#0b1220] text-white shadow-2xl">
                <SelectItem value="__all__" className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                  Todas as OS
                </SelectItem>
                {availableOS.map((ordemServico: any) => (
                  <SelectItem
                    key={getOsOptionValue(ordemServico)}
                    value={getOsOptionValue(ordemServico)}
                    className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white"
                  >
                    {getOsOptionLabel(ordemServico)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Ação Rápida</label>
          <div className="flex items-center gap-2">
            {selectedTable.name === 'Alugados - Gases' ? (
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(true)}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[24px] border border-red-500/30 bg-red-500/15 px-4 text-xs font-black uppercase tracking-widest text-red-200 transition hover:bg-red-500/25 hover:text-white"
              >
                <MapPin size={16} />
                Alocar
              </button>
            ) : (
              <button
                type="button"
                onClick={openRegisterModal}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[24px] border border-emerald-500/30 bg-emerald-500/15 px-4 text-xs font-black uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white"
              >
                <Plus size={16} />
                Reg. Item
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 px-8 pt-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50">
          <Layers3 size={14} className="text-amber-400" />
          {selectedCategory === 'Materiais'
            ? 'Visualizando Materiais - Categoria simples sem tipos'
            : selectedCategory === 'Equipamentos'
            ? `Equipamentos - Tipo: ${selectedType}`
            : `Alugados - Tipo: ${selectedType}`}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          Exibindo {visibleRows.length} de {selectedTable.rows.length} registros
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {visibleRows.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="text-center">
              <Package size={48} className="mx-auto mb-4 text-white/20" />
              <p className="font-bold text-white/40">Nenhum registro encontrado</p>
              <p className="mt-2 text-sm text-white/20">Ajuste o filtro ou escolha outra tabela</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="overflow-auto">
              <table className="min-w-max w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#101f3d]">
                  <tr className="border-b border-white/10">
                    {visibleColumns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-white/40 ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''}`}
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
                          className={`cursor-pointer transition-colors ${rowIsNegative ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-white/5'}`}
                        >
                          {visibleColumns.map((column) => (
                            <td
                              key={`${row.id}-${column.key}`}
                              className={`px-6 py-4 align-middle ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''}`}
                            >
                              {renderCell(row, column)}
                            </td>
                          ))}
                        </tr>

                        {/* SUBTABELA DE ALOCAÇÕES */}
                        {isExpanded && row.tableName === 'Alugados - Gases' && (
                          <tr className="bg-[#080d18] cursor-default" onClick={(e) => e.stopPropagation()}>
                            <td colSpan={visibleColumns.length} className="p-0 border-b border-white/5">
                              <div className="p-6 pt-5 pb-6 pl-12 shadow-inner border-l-2 border-red-500/30">
                                <h4 className="text-[10px] font-black text-white/50 mb-4 uppercase tracking-widest">
                                  Detalhamento de Alocação - Fornecedor: {row.values.fornecedor}
                                </h4>

                                <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 py-1">
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
                                          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{g}</p>
                                          <p className="text-xl font-bold text-emerald-400">{available}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <h5 className="text-[10px] font-black text-white/50 mb-3 uppercase tracking-widest">
                                  Cilindros Alocados (Em campo)
                                </h5>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                                      <th className="py-2 text-left w-24">Status</th>
                                      <th className="py-2 text-left">Local</th>
                                      <th className="py-2 text-left">Serviço (OS)</th>
                                      {gasTypes.map(g => <th key={g} className="py-2 text-center">{g}</th>)}
                                      <th className="py-2 text-center">Total Linha</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                    {allocations.filter(a => a.supplierRowId === row.id).length === 0 && (
                                      <tr>
                                        <td colSpan={gasTypes.length + 4} className="py-6 text-center text-white/30 text-xs">
                                          Nenhum cilindro alocado para este fornecedor.
                                        </td>
                                      </tr>
                                    )}
                                    {allocations.filter(a => a.supplierRowId === row.id).map(alloc => (
                                      <tr key={alloc.id} className="hover:bg-white/5 transition-colors">
                                        <td className="py-3">
                                          <Badge className="bg-red-500/15 text-red-300 border-red-500/30">Alocado</Badge>
                                        </td>
                                        <td className="py-3 text-white/80">{alloc.local}</td>
                                        <td className="py-3 text-white/80">{alloc.serviceOS}</td>
                                        {gasTypes.map(g => (
                                          <td key={g} className="py-3 text-center text-white/60">
                                            {alloc.gasName === g ? (
                                              <span className="font-bold text-white/90">{alloc.quantity}</span>
                                            ) : '—'}
                                          </td>
                                        ))}
                                        <td className="py-3 text-center text-red-300 font-bold">
                                          {alloc.quantity}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/40">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 p-6 backdrop-blur-md">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{editingRowTarget ? 'Editar registro' : 'Novo registro'}</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-white">
                  {editingRowTarget ? 'Editar item no estoque' : 'Cadastrar item no estoque'}
                </h2>
                <p className="mt-1 text-xs text-white/60">Selecione o tipo e os campos da aba mudam conforme a tabela escolhida.</p>
              </div>
              <button
                type="button"
                onClick={closeRegisterModal}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-100px)] overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                <div className="space-y-2">
                  <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Tipo do item</label>
                  <Select value={registerTableName} onValueChange={setRegisterTableName} disabled={Boolean(editingRowTarget)}>
                    <SelectTrigger className="min-h-[92px] rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-white shadow-lg shadow-black/15 backdrop-blur transition hover:border-emerald-400/40 hover:bg-white/10">
                      <div className="flex min-w-0 items-center gap-4 text-left">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${registerTableIcon.badgeClass}`}>
                          <registerTableIcon.Icon size={20} className={registerTableIcon.iconClass} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Tabela selecionada</p>
                          <SelectValue placeholder="Escolha o tipo" />
                        </div>
                      </div>
                    </SelectTrigger>
                    {editingRowTarget && (
                      <p className="ml-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
                        A tabela fica fixa enquanto o item é editado.
                      </p>
                    )}
                    <SelectContent className="border border-white/10 bg-[#0b1220]/95 p-2 text-white shadow-2xl backdrop-blur">
                      {tables.map((table) => (
                        <SelectItem key={table.name} value={table.name} className="cursor-pointer rounded-2xl px-3 py-3 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                          {(() => {
                            const tableIcon = getTableIconConfig(table.name);
                            return (
                              <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${tableIcon.badgeClass}`}>
                                  <tableIcon.Icon size={17} className={tableIcon.iconClass} />
                                </div>
                                <span className="min-w-0 flex-1 truncate">{table.name}</span>
                              </div>
                            );
                          })()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Campos do tipo selecionado</p>
                      <p className="text-sm text-white/70">Os campos abaixo se adaptam à tabela {currentRegisterTable.name}.</p>
                    </div>
                    <div className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                      {currentRegisterTable.columns.length} campos
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="mb-5 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-300" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Preenchimento do item</h3>
                </div>

                {currentRegisterTable.name === 'Alugados - Gases' && (
                  <div className="col-span-full mb-6 space-y-6">
                    <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/5 p-5">
                      <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-cyan-400">
                        Configuração de Colunas de Gases
                      </h4>
                      <div className="flex flex-wrap items-center gap-3">
                        <Input
                          value={newGasName}
                          onChange={(e) => setNewGasName(e.target.value)}
                          placeholder="Ex: Hidrogênio, Argônio..."
                          className="h-12 w-full max-w-xs border-cyan-500/20 bg-[#0b1220]/50 text-sm text-white focus:border-cyan-400"
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
                          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-cyan-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-cyan-500"
                        >
                          <Plus size={16} />
                          Adicionar Gás
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/5 bg-white/5 p-5">
                      <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-red-400">
                        Gases Ativos (Clique no X para remover a coluna)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gasTypes.map((gas) => (
                          <div 
                            key={gas} 
                            className="flex items-center gap-2 rounded-xl bg-[#0b1220] border border-white/10 pl-4 pr-2 py-2"
                          >
                            <span className="text-xs font-bold text-white/80">{gas}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveGas(gas)}
                              className="p-1 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition"
                              title={`Remover coluna de ${gas}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {currentRegisterTable.columns.map((column) => {
                    if (column.key === 'actions') return null;
                    return (
                      <div key={column.key} className={column.key === 'status' ? 'md:col-span-1' : ''}>
                        <label className="ml-1 mb-2 block text-[10px] font-black uppercase tracking-widest text-white/40">
                          {column.label}
                        </label>
                        {renderRegisterField(column, currentRegisterTable)}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={closeRegisterModal}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRegister}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-emerald-500"
                >
                  <CheckCircle2 size={16} />
                  {editingRowTarget ? 'Salvar alterações' : 'Salvar item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALOCAÇÃO DE GASES */}
      {isAllocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/40">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6 backdrop-blur-md">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Alocação de Cilindros</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-white">Alocar Gás</h2>
                <p className="mt-1 text-xs text-white/60">Selecione o fornecedor, o gás e para qual OS ele será enviado.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Fornecedor</label>
                  <Select 
                    value={allocateForm.supplierRowId} 
                    onValueChange={(val) => setAllocateForm(prev => ({ ...prev, supplierRowId: val }))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border border-white/10 bg-[#0b1220] h-12 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      {tables.find(t => t.name === 'Alugados - Gases')?.rows.map(row => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.values.fornecedor || row.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Substância (Gás)</label>
                  <Select 
                    value={allocateForm.gasName} 
                    onValueChange={(val) => setAllocateForm(prev => ({ ...prev, gasName: val }))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border border-white/10 bg-[#0b1220] h-12 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      {gasTypes.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">
                    Quantidade
                  </label>
                  <Input 
                    type="number"
                    value={allocateForm.quantity}
                    onChange={(e) => setAllocateForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1220] h-12 text-white"
                  />

                  {allocateForm.supplierRowId && allocateForm.gasName && (
                    <div className="mt-1 ml-1">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Serviço (OS)</label>
                  <Select
                    value={allocateForm.serviceOS}
                    onValueChange={(val) => setAllocateForm((prev) => ({ ...prev, serviceOS: val }))}
                  >
                    <SelectTrigger className="w-full rounded-2xl border border-white/10 bg-[#0b1220] h-12 text-white">
                      <SelectValue placeholder="Selecione a OS..." />
                    </SelectTrigger>
                    <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                      {availableOS.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhuma OS elegível encontrada
                        </SelectItem>
                      ) : (
                        availableOS.map((ordemServico: any) => (
                          <SelectItem key={getOsOptionValue(ordemServico)} value={getOsOptionValue(ordemServico)}>
                            {getOsOptionLabel(ordemServico)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Local</label>
                  <Input 
                    placeholder="Ex: Estaleiro"
                    value={allocateForm.local}
                    onChange={(e) => setAllocateForm(prev => ({ ...prev, local: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1220] h-12 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-white/10 p-6 bg-white/5">
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAllocation}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500"
              >
                <MapPin size={16} />
                Confirmar Alocação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALOCAÇÃO DE EQUIPAMENTOS */}
      {isEquipAllocateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Alocação de Equipamento</p>
                <h2 className="text-xl font-black uppercase tracking-wide text-white">Alocar Item</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEquipAllocateModalOpen(false)}
                className="rounded-full bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl bg-white/5 p-4 border border-white/10 mb-2">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Equipamento Selecionado</p>
                 <p className="font-bold text-white text-lg">{equipAllocateForm.equipName}</p>
              </div>

              <div className="space-y-2">
                <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Ordem de Serviço (OS)</label>
                <Select 
                  value={equipAllocateForm.osId} 
                  onValueChange={(val) => setEquipAllocateForm(prev => ({ ...prev, osId: val }))}
                >
                  <SelectTrigger className="w-full rounded-2xl border border-white/10 bg-[#0b1220] h-12 text-white">
                    <SelectValue placeholder="Selecione uma OS em produção..." />
                  </SelectTrigger>
                  <SelectContent className="border border-white/10 bg-[#0b1220] text-white">
                    {availableOS.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhuma OS em produção</SelectItem>
                    ) : (
                      availableOS.map((ordemServico: any) => (
                        <SelectItem key={getOsOptionValue(ordemServico)} value={getOsOptionValue(ordemServico)} className="cursor-pointer">
                          {getOsOptionLabel(ordemServico)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Local / Destino</label>
                <Input 
                  placeholder="Ex: Canteiro 3, Bordo..."
                  value={equipAllocateForm.local}
                  onChange={(e) => setEquipAllocateForm(prev => ({ ...prev, local: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1220] h-12 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-white/10 p-6 bg-white/5">
              <button
                type="button"
                onClick={() => setIsEquipAllocateModalOpen(false)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEquipAllocation}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-900/30 hover:bg-red-500 transition"
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
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/55 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fechar detalhes do item"
            className="absolute inset-0 cursor-default"
            onClick={closeRowDetails}
          />

          <aside className="relative h-full w-full max-w-xl overflow-hidden border-l border-white/10 bg-[#101f3d] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/5 p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Detalhes do item</p>
                <h3 className="mt-1 text-2xl font-black uppercase tracking-wide text-white">
                  {activeRow.row.values.material || activeRow.row.values.fornecedor || activeRow.row.values.item || 'Item selecionado'}
                </h3>
                <p className="mt-2 text-xs text-white/60">Clique em editar para abrir o formulário já preenchido.</p>
              </div>
              <button
                type="button"
                onClick={closeRowDetails}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-6">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/60">
                  {activeRow.table.name}
                </div>
                {activeRow.table.name !== 'Alugados - Gases' && (
                  <Badge variant="outline" className={`rounded-full border px-3 py-1 ${getStatusTone(activeRow.row.values.status || '—', activeRow.row.tableName)}`}>
                    {activeRow.row.values.status || '—'}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeRow.table.columns.filter(col => col.key !== 'actions').map((column) => (
                  <div key={column.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/35">{column.label}</p>
                    <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''} ${isNegativeStatus(activeRow.row.tableName, activeRow.row.values.status || '') ? 'text-red-100' : 'text-white/85'}`}>
                      {activeRow.row.values[column.key] || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-white/10 p-6">
              <button
                type="button"
                onClick={closeRowDetails}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={openEditFromRow}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-5 py-3 text-xs font-black uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white"
              >
                Editar item
              </button>
              <button
                type="button"
                onClick={() => handleDarBaixa(activeRow.row)}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/15 px-5 py-3 text-xs font-black uppercase tracking-widest text-red-300 transition hover:bg-red-500/25 hover:text-white"
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