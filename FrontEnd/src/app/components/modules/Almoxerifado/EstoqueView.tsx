import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Anchor, Cable, CheckCircle2, ClipboardList, Gauge, Hammer, Layers3, Microscope, Package, Plus, Search, Table2, TrendingUp, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../modules/shared/ui/select';

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
  { key: 'status', label: 'Status', align: 'center' }
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
      return {
        Icon: Zap,
        badgeClass: 'bg-amber-500/15 ring-amber-500/20',
        iconClass: 'text-amber-300'
      };
    case 'extensaocabos':
      return {
        Icon: Cable,
        badgeClass: 'bg-cyan-500/15 ring-cyan-500/20',
        iconClass: 'text-cyan-300'
      };
    case 'bombahidrojato':
      return {
        Icon: Gauge,
        badgeClass: 'bg-blue-500/15 ring-blue-500/20',
        iconClass: 'text-blue-300'
      };
    case 'instrumentos':
      return {
        Icon: Microscope,
        badgeClass: 'bg-violet-500/15 ring-violet-500/20',
        iconClass: 'text-violet-300'
      };
    case 'ferramentas':
      return {
        Icon: Hammer,
        badgeClass: 'bg-orange-500/15 ring-orange-500/20',
        iconClass: 'text-orange-300'
      };
    case 'talhas':
      return {
        Icon: Anchor,
        badgeClass: 'bg-emerald-500/15 ring-emerald-500/20',
        iconClass: 'text-emerald-300'
      };
    case 'controledeferramentas':
      return {
        Icon: ClipboardList,
        badgeClass: 'bg-pink-500/15 ring-pink-500/20',
        iconClass: 'text-pink-300'
      };
    default:
      return {
        Icon: Table2,
        badgeClass: 'bg-cyan-500/15 ring-cyan-500/20',
        iconClass: 'text-cyan-300'
      };
  }
};

type StatusRule = {
  defaultStatus: string;
  positive: string[];
  negative: string[];
  options: string[];
};

const STATUS_RULES: Record<string, StatusRule> = {
  equipamentoseletricos: {
    defaultStatus: 'Funcionando',
    positive: ['Funcionando'],
    negative: ['Manutenção'],
    options: ['Funcionando', 'Manutenção']
  },
  extensaocabos: {
    defaultStatus: 'Funcionando',
    positive: ['Funcionando'],
    negative: ['Manutenção'],
    options: ['Funcionando', 'Manutenção']
  },
  bombahidrojato: {
    defaultStatus: 'Apto para uso',
    positive: ['Apto para uso'],
    negative: ['Não apto'],
    options: ['Apto para uso', 'Não apto']
  },
  instrumentos: {
    defaultStatus: 'Ok',
    positive: ['Ok'],
    negative: ['Aguardando calibração', 'Com defeito'],
    options: ['Ok', 'Aguardando calibração', 'Com defeito']
  },
  ferramentas: {
    defaultStatus: 'Adequada',
    positive: ['Adequada'],
    negative: ['Não para o uso'],
    options: ['Adequada', 'Não para o uso']
  },
  talhas: {
    defaultStatus: 'Ok',
    positive: ['Ok'],
    negative: ['Não consta'],
    options: ['Ok', 'Não consta']
  },
  controledeferramentas: {
    defaultStatus: 'Conferido',
    positive: ['Conferido'],
    negative: ['Pendente'],
    options: ['Conferido', 'Pendente']
  }
};

const getStatusRule = (tableName?: string) => STATUS_RULES[normalizeKey(tableName || '')] || {
  defaultStatus: 'Normal',
  positive: ['Normal'],
  negative: ['Crítico', 'Baixo', 'Manutenção', 'Pendente'],
  options: ['Normal', 'Baixo', 'Crítico']
};

const matchesStatusValue = (status: string, candidates: string[]) => {
  const normalizedStatus = normalizeKey(status);
  return candidates.some((candidate) => normalizedStatus.includes(normalizeKey(candidate)));
};

const isNegativeStatus = (tableName: string, status: string) => matchesStatusValue(status, getStatusRule(tableName).negative);

const isPositiveStatus = (tableName: string, status: string) => matchesStatusValue(status, getStatusRule(tableName).positive);

const getStatusTone = (status: string, tableName?: string) => {
  if (tableName && isNegativeStatus(tableName, status)) {
    return 'bg-red-500/15 border-red-500/30 text-red-300';
  }

  if (tableName && isPositiveStatus(tableName, status)) {
    return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
  }

  const normalized = normalizeKey(status);

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

const STOCK_TABLES: StockTable[] = [
  makeTable(
    'EQUIPAMENTOS ELETRICOS',
    [
      { key: 'item', label: 'Item' },
      { key: 'material', label: 'Material' },
      { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' },
      { key: 'patrimonio', label: 'Patrimônio' },
      { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'modelo', label: 'Modelo' },
      { key: 'numeroSerial', label: 'N° Serial' },
      { key: 'tag', label: 'TAG' },
      { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' },
      { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' },
      { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      {
        material: 'Painel de Comando 380V IP65',
        descricao: 'Aço carbono pintado',
        unid: 'un',
        qtd: '6',
        patrimonio: 'PAT-EL-001',
        dataEntradaPlanilha: '2026-04-08',
        modelo: 'PC-380IP65',
        numeroSerial: 'SN-54821',
        tag: 'TAG-001',
        marca: 'WEG',
        dataCalibracaoAfericao: '2026-03-12',
        validadeCalibracaoAfericao: '2027-03-12',
        status: 'Funcionando',
        observacao: 'Instalado no rack A1',
        unidade: 'un'
      },
      {
        material: 'Cabo PP 4x2,5mm²',
        descricao: 'Cobre flexível',
        unid: 'm',
        qtd: '120',
        patrimonio: 'PAT-EL-002',
        dataEntradaPlanilha: '2026-04-10',
        modelo: 'PP-4X2,5',
        numeroSerial: 'SN-88214',
        tag: 'TAG-002',
        marca: 'Prysmian',
        dataCalibracaoAfericao: '—',
        validadeCalibracaoAfericao: '—',
        status: 'Funcionando',
        observacao: 'Bobina B3',
        unidade: 'm'
      },
      {
        material: 'Disjuntor 3P 63A',
        descricao: 'Termomagnético',
        unid: 'un',
        qtd: '9',
        patrimonio: 'PAT-EL-003',
        dataEntradaPlanilha: '2026-04-12',
        modelo: 'DJ-3P-63A',
        numeroSerial: 'SN-99201',
        tag: 'TAG-003',
        marca: 'Schneider',
        dataCalibracaoAfericao: '2026-02-20',
        validadeCalibracaoAfericao: '2027-02-20',
        status: 'Manutenção',
        observacao: 'Prateleira E2',
        unidade: 'un'
      }
    ],
    false
  ),
  makeTable(
    'EXTENSÃO-CABOS',
    [
      { key: 'item', label: 'Item' },
      { key: 'material', label: 'Material' },
      { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' },
      { key: 'patrimonio', label: 'Patrimônio' },
      { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'metros', label: 'METROS', align: 'center' },
      { key: 'bitola', label: '(BITOLA)', align: 'center' },
      { key: 'tag', label: 'TAG' },
      { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' },
      { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' },
      { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      {
        material: 'Extensão Industrial 30m',
        unid: 'un',
        qtd: '18',
        patrimonio: 'PAT-CAB-001',
        dataEntradaPlanilha: '2026-04-02',
        metros: '30',
        bitola: '2,5mm²',
        tag: 'TAG-CAB-001',
        marca: 'Tramontina',
        dataCalibracaoAfericao: '—',
        validadeCalibracaoAfericao: '—',
        status: 'Normal',
        observacao: 'Parede C1',
        unidade: 'm'
      },
      {
        material: 'Extensão IP44 50m',
        unid: 'un',
        qtd: '8',
        patrimonio: 'PAT-CAB-002',
        dataEntradaPlanilha: '2026-04-05',
        metros: '50',
        bitola: '4mm²',
        tag: 'TAG-CAB-002',
        marca: 'Wurth',
        dataCalibracaoAfericao: '—',
        validadeCalibracaoAfericao: '—',
        status: 'Crítico',
        observacao: 'Parede C2',
        unidade: 'm'
      },
      {
        material: 'Cabo de Rede Industrial 25m',
        unid: 'un',
        qtd: '24',
        patrimonio: 'PAT-CAB-003',
        dataEntradaPlanilha: '2026-04-09',
        metros: '25',
        bitola: 'Cat6',
        tag: 'TAG-CAB-003',
        marca: 'Furukawa',
        dataCalibracaoAfericao: '—',
        validadeCalibracaoAfericao: '—',
        status: 'Normal',
        observacao: 'Armário de Rede',
        unidade: 'm'
      }
    ],
    false
  ),
  makeTable(
    'BOMBA HIDROJATO',
    [
      { key: 'item', label: 'Item' },
      { key: 'material', label: 'Material' },
      { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' },
      { key: 'patrimonioIdentificacao', label: 'Patrimônio/Identificação' },
      { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'identificacao', label: 'IDENTIFICAÇÃO' },
      { key: 'certificacao', label: 'CERTIFICAÇÃO' },
      { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' },
      { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' },
      { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      {
        material: 'Bomba Hidrojato LNV 0158',
        unid: 'un',
        qtd: '1',
        patrimonioIdentificacao: 'PAT-HJ-001',
        dataEntradaPlanilha: '2026-04-15',
        identificacao: 'HJ-0158',
        certificacao: 'CERT-2026-01',
        marca: 'LNV',
        dataCalibracaoAfericao: '2026-03-20',
        validadeCalibracaoAfericao: '2027-03-20',
        status: 'Apto para uso',
        observacao: 'Bay 3',
        unidade: 'un'
      },
      {
        material: 'Mangueira Alta Pressão 20m',
        unid: 'kit',
        qtd: '6',
        patrimonioIdentificacao: 'PAT-HJ-002',
        dataEntradaPlanilha: '2026-04-16',
        identificacao: 'HJ-MANG-20',
        certificacao: 'CERT-2026-02',
        marca: 'LNV',
        dataCalibracaoAfericao: '—',
        validadeCalibracaoAfericao: '—',
        status: 'Apto para uso',
        observacao: 'Armário Hidrojato',
        unidade: 'kit'
      }
    ],
    false
  ),
  makeTable(
    'INSTRUMENTOS',
    [
      { key: 'item', label: 'Item' },
      { key: 'material', label: 'Material' },
      { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' },
      { key: 'patrimonio', label: 'Patrimônio' },
      { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'identificacao', label: 'INDENTIFICAÇÃO' },
      { key: 'certificacao', label: 'CERTIFICAÇÃO' },
      { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' },
      { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' },
      { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      {
        material: 'Multímetro Digital',
        unid: 'un',
        qtd: '12',
        patrimonio: 'PAT-INS-001',
        dataEntradaPlanilha: '2026-04-11',
        identificacao: 'INS-MULT-001',
        certificacao: 'CERT-2026-07',
        marca: 'Minipa',
        dataCalibracaoAfericao: '2026-04-01',
        validadeCalibracaoAfericao: '2027-04-01',
        status: 'Ok',
        observacao: 'Armário D2',
        unidade: 'un'
      },
      {
        material: 'Calibrador de Pressão',
        unid: 'un',
        qtd: '5',
        patrimonio: 'PAT-INS-002',
        dataEntradaPlanilha: '2026-04-13',
        identificacao: 'INS-CAL-002',
        certificacao: 'CERT-2026-08',
        marca: 'Wika',
        dataCalibracaoAfericao: '2026-03-22',
        validadeCalibracaoAfericao: '2027-03-22',
        status: 'Aguardando calibração',
        observacao: 'Sala Técnica',
        unidade: 'un'
      }
    ],
    false
  ),
  makeTable(
    'FERRAMENTAS',
    [
      { key: 'item', label: 'Item' },
      { key: 'material', label: 'Material' },
      { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' },
      { key: 'patrimonio', label: 'Patrimônio' },
      { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'modelo', label: 'Modelo' },
      { key: 'numeroSerial', label: 'N° Serial' },
      { key: 'marca', label: 'Marca' },
      { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' },
      { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      {
        material: 'Furadeira Industrial 850W',
        unid: 'un',
        qtd: '8',
        patrimonio: 'PAT-FER-001',
        dataEntradaPlanilha: '2026-04-07',
        modelo: 'GSB 16 RE',
        numeroSerial: 'SN-FER-850-001',
        marca: 'Bosch',
        status: 'Adequada',
        observacao: 'Ferramentas A3',
        unidade: 'un'
      },
      {
        material: 'Jogo de Chaves Allen',
        unid: 'jogo',
        qtd: '25',
        patrimonio: 'PAT-FER-002',
        dataEntradaPlanilha: '2026-04-09',
        modelo: 'Allen 9 peças',
        numeroSerial: 'SN-FER-ALLEN-002',
        marca: 'Vonder',
        status: 'Não para o uso',
        observacao: 'Ferramentas B1',
        unidade: 'jogo'
      }
    ],
    false
  ),
  makeTable(
    'TALHAS',
    [
      { key: 'item', label: 'Item' },
      { key: 'material', label: 'Material' },
      { key: 'unid', label: 'Unid.', align: 'center' },
      { key: 'qtd', label: 'Qtd.', align: 'center' },
      { key: 'patrimonio', label: 'Patrimônio' },
      { key: 'dataEntradaPlanilha', label: 'Data(ENTRADA NA PLANILHA)', align: 'center' },
      { key: 'modelo', label: 'Modelo' },
      { key: 'numeroSerial', label: 'N° Serial' },
      { key: 'marca', label: 'Marca' },
      { key: 'dataCalibracaoAfericao', label: 'Data da Calibração/Aferição', align: 'center' },
      { key: 'validadeCalibracaoAfericao', label: 'Validade da Calibração/Aferição', align: 'center' },
      { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'observacao', label: 'Observação' },
      { key: 'unidade', label: 'Unidade', align: 'center' }
    ],
    [
      {
        material: 'Talha Manual 2T',
        unid: 'un',
        qtd: '7',
        patrimonio: 'PAT-TAL-001',
        dataEntradaPlanilha: '2026-04-06',
        modelo: 'TM-2T',
        numeroSerial: 'SN-TAL-002T-001',
        marca: 'Vonder',
        dataCalibracaoAfericao: '2026-03-30',
        validadeCalibracaoAfericao: '2027-03-30',
        status: 'Normal',
        observacao: 'Pátio',
        unidade: 'un'
      },
      {
        material: 'Talha Elétrica 5T',
        unid: 'un',
        qtd: '3',
        patrimonio: 'PAT-TAL-002',
        dataEntradaPlanilha: '2026-04-08',
        modelo: 'TE-5T',
        numeroSerial: 'SN-TAL-005T-002',
        marca: 'Demag',
        dataCalibracaoAfericao: '2026-03-18',
        validadeCalibracaoAfericao: '2027-03-18',
        status: 'Crítico',
        observacao: 'Pátio',
        unidade: 'un'
      }
    ],
    false
  ),
  makeTable(
    'Controle de ferramentas',
    [
      { key: 'item', label: 'Item' },
      { key: 'material', label: 'FERRAMENTA' },
      { key: 'tagNumeroSeriePatrimonio', label: 'TAG/NUMERO SÉRIE/PATRIMÔNIO' },
      { key: 'retiradoPor', label: 'RETIRADO POR' },
      { key: 'assinaturaRetirada', label: 'ASSINATURA (RETIRADA)' },
      { key: 'dataRetirada', label: 'DATA (RETIRADA)', align: 'center' },
      { key: 'condicaoFerramentaRetirada', label: 'CONDIÇÃO DA FERRAMENTA (RETIRADA)' },
      { key: 'lvSeAplicavel', label: 'LV (SE APLICÁVEL)' },
      { key: 'dataDevolucao', label: 'DATA (DEVOLUCAO)', align: 'center' },
      { key: 'assinaturaDevolucao', label: 'ASSINATURA (DEVOLUÇÃO)' },
      { key: 'status', label: 'STATUS', align: 'center' },
      { key: 'condicaoFerramentaDevolucao', label: 'CONDIÇÃO DA FERRAMENTA (DEVOLUÇÃO)' }
    ],
    [
      {
        material: 'Lixadeira Angular 7"',
        tagNumeroSeriePatrimonio: 'TAG-CTRL-001 / SN-CTRL-001 / PAT-CTRL-001',
        retiradoPor: 'Equipe de Manutenção',
        assinaturaRetirada: 'Ass. eletrônica',
        dataRetirada: '2026-04-18',
        condicaoFerramentaRetirada: 'Boa',
        lvSeAplicavel: 'Não se aplica',
        dataDevolucao: '2026-04-18',
        assinaturaDevolucao: 'Ass. eletrônica',
        status: 'Conferido',
        condicaoFerramentaDevolucao: 'Boa'
      },
      {
        material: 'Serra Tico-Tico',
        tagNumeroSeriePatrimonio: 'TAG-CTRL-002 / SN-CTRL-002 / PAT-CTRL-002',
        retiradoPor: 'Almoxarifado',
        assinaturaRetirada: 'Ass. eletrônica',
        dataRetirada: '2026-04-20',
        condicaoFerramentaRetirada: 'Boa',
        lvSeAplicavel: 'Não se aplica',
        dataDevolucao: '—',
        assinaturaDevolucao: '—',
        status: 'Pendente',
        condicaoFerramentaDevolucao: '—'
      }
    ],
    false
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

    values[column.key] = previous;
  });

  return values;
};

export function EstoqueView({ searchQuery }: StockViewProps) {
  const [tables, setTables] = useState<StockTable[]>(() => STOCK_TABLES.map((table) => ({
    ...table,
    columns: [...table.columns],
    rows: table.rows.map((row) => ({ ...row, values: { ...row.values } }))
  })));
  const [selectedSheet, setSelectedSheet] = useState<string>(STOCK_TABLES[0]?.name || 'todos');
  const [filtro, setFiltro] = useState<string>(searchQuery || '');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerTableName, setRegisterTableName] = useState<string>(tables[0]?.name || '');
  const [registerValues, setRegisterValues] = useState<Record<string, string>>(() => createRegisterValues(tables[0]));
  const [activeRowTarget, setActiveRowTarget] = useState<{ tableName: string; rowId: string } | null>(null);
  const [editingRowTarget, setEditingRowTarget] = useState<{ tableName: string; rowId: string } | null>(null);

  useEffect(() => {
    setFiltro(searchQuery || '');
  }, [searchQuery]);

  const commonColumns = useMemo(() => getCommonColumns(tables), [tables]);
  const allRows = useMemo(() => tables.flatMap((table) => table.rows), [tables]);

  const selectedTable = useMemo(() => {
    if (selectedSheet === 'todos') {
      return {
        name: 'Todos',
        columns: [sharedColumns[0], ...commonColumns.filter((column) => column.key !== 'item')],
        rows: allRows
      } as StockTable;
    }

    return tables.find((table) => table.name === selectedSheet) || {
      name: 'Todos',
      columns: [sharedColumns[0], ...commonColumns.filter((column) => column.key !== 'item')],
      rows: allRows
    };
  }, [allRows, commonColumns, selectedSheet, tables]);

  const visibleColumns = selectedSheet === 'todos'
    ? [sharedColumns[0], ...commonColumns.filter((column) => column.key !== 'item')]
    : selectedTable.columns;

  const visibleRows = useMemo(() => {
    const query = filtro.toLowerCase().trim();
    if (!query) return selectedTable.rows;

    return selectedTable.rows.filter((row) => {
      const matchesColumns = visibleColumns.some((column) => (row.values[column.key] || '').toLowerCase().includes(query));
      return matchesColumns || row.searchText.includes(query);
    });
  }, [filtro, selectedTable.rows, visibleColumns]);

  const stats = useMemo(() => {
    const criticalItems = visibleRows.filter((row) => normalizeKey(row.values.status).includes('crit')).length;

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

  const openEditFromRow = () => {
    if (!activeRow) return;

    setEditingRowTarget({ tableName: activeRow.table.name, rowId: activeRow.row.id });
    setRegisterTableName(activeRow.table.name);
    setRegisterValues(createRegisterValues(activeRow.table, activeRow.row.values));
    setIsRegisterOpen(true);
    setActiveRowTarget(null);
  };

  const openRegisterModal = () => {
    const defaultTableName = selectedSheet === 'todos' ? tables[0]?.name || '' : selectedSheet;
    const table = tables.find((item) => item.name === defaultTableName) || tables[0];

    setEditingRowTarget(null);
    setRegisterTableName(table?.name || '');
    setRegisterValues(createRegisterValues(table));
    setIsRegisterOpen(true);
  };

  const handleRegisterChange = (columnKey: string, value: string) => {
    setRegisterValues((previous) => ({
      ...previous,
      [columnKey]: value
    }));
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

    if (!payload.material) {
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
            ? {
                ...item,
                rows: item.rows.map((row) => (row.id === editingRowTarget.rowId ? nextRow : row))
              }
            : { ...item, rows: [nextRow, ...item.rows] }
          : item
      ))
    );

    setSelectedSheet(table.name);
    setFiltro('');
    setIsRegisterOpen(false);
    setEditingRowTarget(null);
    setActiveRowTarget(wasEditing ? { tableName: table.name, rowId: nextRow.id } : null);
  };

  const renderCell = (row: StockRow, column: StockColumn) => {
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
      return (
        <Input
          value={value}
          readOnly
          className={`${baseClass} h-12 opacity-80`}
          placeholder="ID automático do item"
        />
      );
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
        placeholder={`Preencha ${column.label.toLowerCase()}`}
        inputMode={column.key === 'quantidade' ? 'numeric' : 'text'}
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
              Mock visual das abas do estoque, sem leitura de arquivo externo
            </p>
          </div>
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

      <div className="grid grid-cols-1 gap-4 px-8 pt-8 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">Tabelas</p>
          <p className="text-3xl font-black text-white">{stats.totalTables}</p>
          <div className="mt-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400">Abas mockadas</span>
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

      <div className="grid grid-cols-1 gap-4 px-8 pt-8 xl:grid-cols-[1.05fr_1fr_220px] xl:items-end">
        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Tabela</label>
          <Select value={selectedSheet} onValueChange={setSelectedSheet}>
            <SelectTrigger className="group min-h-[55px] rounded-[24px] border border-white/10 bg-gradient-to-r from-white/8 to-white/5 px-5 py-5 text-white shadow-lg shadow-black/15 backdrop-blur transition hover:border-amber-400/40 hover:from-white/12 hover:to-white/8">
              <div className="flex min-w-0 items-center gap-4 text-left">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20">
                  <Table2 size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase leading-none tracking-widest text-white/40">Selecione a tabela</p>
                  <SelectValue placeholder="Todos" className="mt-1 text-sm font-semibold leading-tight" />
                </div>
              </div>
            </SelectTrigger>
            <SelectContent className="border border-white/10 bg-[#0b1220]/95 text-white shadow-2xl backdrop-blur">
              <SelectItem value="todos" className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                Todos
              </SelectItem>
              {tables.map((table) => (
                <SelectItem key={table.name} value={table.name} className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Busca</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
            <Input
              placeholder="Buscar por nome, categoria, fornecedor, localização..."
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              className="h-14 border-white/10 bg-white/5 pl-12 text-white placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Ação</label>
          <button
            type="button"
            onClick={openRegisterModal}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[24px] border border-emerald-500/30 bg-emerald-500/15 px-5 text-xs font-black uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white"
          >
            <Plus size={16} />
            Registrar item
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 px-8 pt-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50">
          <Layers3 size={14} className="text-amber-400" />
          {selectedSheet === 'todos'
            ? 'Todos usa somente os campos compartilhados entre as abas'
            : `Visualizando a tabela ${selectedTable.name}`}
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

                    return (
                      <tr
                        key={row.id}
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
                            className={`px-6 py-4 align-top ${column.align === 'center' ? 'text-center' : ''} ${column.align === 'right' ? 'text-right' : ''}`}
                          >
                            {renderCell(row, column)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {currentRegisterTable.columns.map((column) => (
                    <div key={column.key} className={column.key === 'status' ? 'md:col-span-1' : ''}>
                      <label className="ml-1 mb-2 block text-[10px] font-black uppercase tracking-widest text-white/40">
                        {column.label}
                      </label>
                      {renderRegisterField(column, currentRegisterTable)}
                    </div>
                  ))}
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
                  {activeRow.row.values.material || activeRow.row.values.item || 'Item selecionado'}
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
                <Badge variant="outline" className={`rounded-full border px-3 py-1 ${getStatusTone(activeRow.row.values.status || '—', activeRow.row.tableName)}`}>
                  {activeRow.row.values.status || '—'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeRow.table.columns.map((column) => (
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
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
