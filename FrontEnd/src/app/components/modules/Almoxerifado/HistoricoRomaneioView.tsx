import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Download, History, Pencil, RotateCcw, Search, Trash2, Wrench, X } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';
import { gerarRomaneioPdf, loadRomaneioLogoBase64 } from './romaneioPdf';
import { toast } from 'sonner';
import {
  EntradaManutencaoModal, criarEntradaManutencao, gerarIdManutencao, itemPossuiManutencao,
  type ManutencaoHistoricoItem,
} from './manutencaoShared';

interface RomaneioHistoricoItemRow {
  tableName: string;
  rowId: string;
  itemLabel: string;
  quantidade?: string;
  mode?: 'alocacao' | 'baixa';
  kind?: 'material' | 'gas' | 'equipamento';
  // Quantidades por tipo de gás que saíram (apenas itens de gás). Ex.: { gasoxigenio: 3 }
  gasQuantities?: Record<string, number>;
  snapshotBefore: Record<string, string>;
  snapshotAfter: Record<string, string>;
}

interface RomaneioHistoricoItem {
  id: string;
  createdAt: string;
  mode?: 'alocacao' | 'baixa';
  osId: string;
  osLabel: string;
  osLocal?: string;
  osCliente?: string;
  items: RomaneioHistoricoItemRow[];
  revertedAt?: string;
  revertedBy?: string;
}

// Mesmo formato gravado em `almoxerifado.baixasHistorico` pelo fluxo de Baixa do Estoque
// (EstoqueView.tsx) — aqui devolvido pelo Romaneio usa a mesma estrutura, só muda a origem.
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

interface HistoricoRomaneioViewProps {
  searchQuery: string;
}

const cleanValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const normalizeKey = (value: string) =>
  cleanValue(value)
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const buildSearchText = (values: Record<string, string>) =>
  Object.values(values || {})
    .map((entry) => cleanValue(entry).toLowerCase())
    .join(' ');

const formatDateTime = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const parseQty = (value: unknown): number => {
  const parsed = parseFloat(String(value ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

// Itens de quantidade (materiais e gases) retornam por quantidade; os demais voltam inteiros.
// O `kind` é gravado nos romaneios novos; para os antigos, deduz pelo modo/tabela.
const itemIsMaterial = (item: RomaneioHistoricoItemRow) =>
  item.kind === 'material' || (!item.kind && item.mode === 'baixa');
const itemIsGas = (item: RomaneioHistoricoItemRow) =>
  item.kind === 'gas' || (!item.kind && normalizeKey(item.tableName) === 'alugadosgases');

const uid = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function HistoricoRomaneioView({ searchQuery }: HistoricoRomaneioViewProps) {
  const { almoxerifado, saveEntity, userSession } = useErp();
  const [filtro, setFiltro] = useState(searchQuery || '');
  const [revertingId, setRevertingId] = useState('');

  // Estado do modal de devolução
  const [returnTarget, setReturnTarget] = useState<RomaneioHistoricoItem | null>(null);
  const [returnMaterialQty, setReturnMaterialQty] = useState<Record<string, string>>({});
  const [returnGasQty, setReturnGasQty] = useState<Record<string, Record<string, string>>>({});
  // Itens inteiros (equipamentos) marcados pra voltar já em manutenção — cada um com o
  // registro COMPLETO de entrada (motivo, responsável, foto obrigatória), coletado pelo
  // mesmo modal guiado usado em qualquer outro lugar do sistema (EntradaManutencaoModal).
  // Item ausente daqui = volta disponível, sem OS, exatamente como o snapshot de antes de sair.
  const [manutencaoDadosPorItem, setManutencaoDadosPorItem] = useState<Record<string, {
    numeroManutencao: string; data: string; motivo: string; responsavel: string; observacao: string;
    fotoUrl: string; fotoBackendId?: number;
  }>>({});
  // Itens inteiros marcados pra sair definitivamente do estoque (baixa) em vez de voltar
  // disponível — mesmo par motivo/data exigido pelo fluxo de Baixa já existente (EstoqueView.tsx),
  // só que a OS já é conhecida de contexto (a do próprio romaneio).
  const [baixaDadosPorItem, setBaixaDadosPorItem] = useState<Record<string, { motivo: string; data: string }>>({});
  // Menu "Disponível / Em manutenção / Baixa" aberto pra qual item (chave tableName::rowId), o
  // item com o modal guiado de entrada em manutenção aberto, e o item com o formulário de baixa aberto.
  const [menuRetornoAberto, setMenuRetornoAberto] = useState<string | null>(null);
  const [entradaManutencaoAlvo, setEntradaManutencaoAlvo] = useState<{ item: RomaneioHistoricoItemRow; numeroManutencao: string } | null>(null);
  const [baixaFormAlvo, setBaixaFormAlvo] = useState<RomaneioHistoricoItemRow | null>(null);
  const [baixaFormMotivo, setBaixaFormMotivo] = useState('');
  const [baixaFormData, setBaixaFormData] = useState(() => new Date().toISOString().slice(0, 10));

  const itemKey = (item: RomaneioHistoricoItemRow) => `${item.tableName}::${item.rowId}`;

  // Converte a chave de gás (ex.: "gasoxigenio") no rótulo amigável usando as colunas da tabela.
  const getGasLabel = (gasKey: string) => {
    const gasTable = (almoxerifado?.tables || []).find((table: any) => normalizeKey(table?.name) === 'alugadosgases');
    const coluna = gasTable?.columns?.find((column: any) => column.key === gasKey);
    if (coluna?.label) return coluna.label;
    const base = gasKey.replace(/^gas/, '');
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : gasKey;
  };

  const romaneios = useMemo(() => {
    const source = Array.isArray(almoxerifado?.romaneiosHistorico)
      ? (almoxerifado.romaneiosHistorico as RomaneioHistoricoItem[])
      : [];
    const termo = (filtro || searchQuery || '').toLowerCase().trim();

    return source
      .filter((entry) => {
        if (!termo) return true;

        const searchable = [
          entry.id,
          entry.osLabel,
          entry.osId,
          entry.osLocal,
          entry.createdAt,
          ...entry.items.map((item) => `${item.itemLabel} ${item.tableName} ${item.quantidade || ''}`)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(termo);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [almoxerifado?.romaneiosHistorico, filtro, searchQuery]);

  // Abre o modal de devolução, pré-preenchendo cada item com o total que saiu (devolver tudo).
  const openReturnModal = (romaneio: RomaneioHistoricoItem) => {
    if (romaneio.revertedAt) {
      toast.error('Este romaneio já foi devolvido ao estoque.');
      return;
    }

    const matInit: Record<string, string> = {};
    const gasInit: Record<string, Record<string, string>> = {};
    romaneio.items.forEach((item) => {
      const key = itemKey(item);
      if (itemIsMaterial(item)) {
        matInit[key] = String(parseQty(item.quantidade));
      } else if (itemIsGas(item)) {
        gasInit[key] = {};
        Object.entries(item.gasQuantities || {}).forEach(([gasKey, qty]) => {
          gasInit[key][gasKey] = String(qty);
        });
      }
    });

    setReturnMaterialQty(matInit);
    setReturnGasQty(gasInit);
    setReturnTarget(romaneio);
  };

  const closeReturnModal = () => {
    setReturnTarget(null);
    setReturnMaterialQty({});
    setReturnGasQty({});
    setManutencaoDadosPorItem({});
    setBaixaDadosPorItem({});
    setMenuRetornoAberto(null);
    setEntradaManutencaoAlvo(null);
    setBaixaFormAlvo(null);
    setBaixaFormMotivo('');
    setBaixaFormData(new Date().toISOString().slice(0, 10));
  };

  const openBaixaForm = (item: RomaneioHistoricoItemRow) => {
    setBaixaFormAlvo(item);
    setBaixaFormMotivo('');
    setBaixaFormData(new Date().toISOString().slice(0, 10));
  };

  const closeBaixaForm = () => {
    setBaixaFormAlvo(null);
    setBaixaFormMotivo('');
    setBaixaFormData(new Date().toISOString().slice(0, 10));
  };

  const confirmBaixaForm = () => {
    if (!baixaFormAlvo) return;
    const motivo = cleanValue(baixaFormMotivo);
    const data = cleanValue(baixaFormData);
    if (!motivo || !data) {
      toast.error('Preencha data e motivo para registrar a baixa.');
      return;
    }
    const key = itemKey(baixaFormAlvo);
    setBaixaDadosPorItem((prev) => ({ ...prev, [key]: { motivo, data } }));
    setManutencaoDadosPorItem((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    closeBaixaForm();
  };

  // Regera e baixa o documento (modelo FLN 026) de um romaneio já feito. Peso por item e peso
  // total precisam ser recalculados aqui do mesmo jeito que na emissão original (EstoqueView.tsx)
  // — sem isso o PDF reimpresso saía com a coluna de peso vazia mesmo quando a original tinha.
  const handleDownloadRomaneio = async (romaneio: RomaneioHistoricoItem) => {
    try {
      const logoBase64 = await loadRomaneioLogoBase64();
      const itemsPdf = romaneio.items.map((item) => {
        const pesoUnit = parseFloat(String(item.snapshotBefore?.peso ?? '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
        const pesoLinha = pesoUnit > 0 ? pesoUnit * (Number(item.quantidade) || 0) : 0;
        return { descricao: item.itemLabel, quantidade: item.quantidade || '1', peso: pesoLinha };
      });
      const pesoTotalRomaneio = itemsPdf.reduce((soma, it) => soma + (Number(it.peso) || 0), 0);
      const doc = gerarRomaneioPdf({
        cliente: romaneio.osCliente || '',
        osLabel: romaneio.osLabel || romaneio.osId,
        enderecoEntrega: romaneio.osLocal || '',
        dataEmissao: romaneio.createdAt,
        items: itemsPdf,
        pesoTotal: pesoTotalRomaneio,
        logoBase64,
      });
      doc.save(`romaneio-${romaneio.osLabel || romaneio.osId || romaneio.id}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar pdf do romaneio', error);
      toast.error('Não foi possível gerar o documento do romaneio.');
    }
  };

  // Quantidade efetiva a devolver, sempre limitada ao que saiu.
  const materialReturnQty = (item: RomaneioHistoricoItemRow) =>
    Math.min(parseQty(item.quantidade), Math.max(0, parseQty(returnMaterialQty[itemKey(item)] ?? '0')));
  const gasReturnQty = (item: RomaneioHistoricoItemRow, gasKey: string) =>
    Math.min(item.gasQuantities?.[gasKey] ?? 0, Math.max(0, parseQty(returnGasQty[itemKey(item)]?.[gasKey] ?? '0')));

  const handleConfirmReturn = async () => {
    if (!returnTarget) return;
    const romaneio = returnTarget;
    setRevertingId(romaneio.id);

    try {
      const previousTables = Array.isArray(almoxerifado?.tables) ? almoxerifado.tables : [];
      const novosManutencao: ManutencaoHistoricoItem[] = [];
      const novasBaixas: BaixaHistoricoItem[] = [];
      const nextTables = previousTables.map((table: any) => {
        const tableItems = romaneio.items.filter((item) => item.tableName === table.name);
        if (tableItems.length === 0) return table;

        const existingIds = new Set((table.rows || []).map((row: any) => row.id));

        // 1. Remove definitivamente as linhas marcadas pra baixa (não voltam ao estoque) e
        //    grava o registro no mesmo histórico usado pela baixa feita direto no Estoque.
        const rowsAposBaixa = (table.rows || []).filter((row: any) => {
          const item = tableItems.find((it) => it.rowId === row.id);
          if (!item) return true;
          const dadosBaixa = baixaDadosPorItem[itemKey(item)];
          if (!dadosBaixa) return true;
          novasBaixas.push({
            id: uid('baixa'),
            dataBaixa: dadosBaixa.data,
            tableName: item.tableName,
            itemLabel: item.itemLabel,
            statusAnterior: item.snapshotBefore?.status || '',
            motivo: dadosBaixa.motivo,
            osId: romaneio.osId,
            osLabel: romaneio.osLabel,
            localizacao: item.snapshotBefore?.localizacao || romaneio.osLocal || '',
            serviceOS: romaneio.osLabel,
            snapshot: { ...item.snapshotBefore },
          });
          return false;
        });

        // 2. Atualiza linhas restantes (incrementa quantidade ou restaura item inteiro)
        const rows = rowsAposBaixa.map((row: any) => {
          const item = tableItems.find((it) => it.rowId === row.id);
          if (!item) return row;

          let values: Record<string, string> = { ...row.values };

          if (itemIsMaterial(item)) {
            const ret = materialReturnQty(item);
            if (ret > 0) values.quantidade = String(parseQty(values.quantidade) + ret);
          } else if (itemIsGas(item)) {
            Object.keys(item.gasQuantities || {}).forEach((gasKey) => {
              const ret = gasReturnQty(item, gasKey);
              if (ret > 0) values[gasKey] = String(parseQty(values[gasKey]) + ret);
            });
            const total = Object.keys(values)
              .filter((key) => key.startsWith('gas'))
              .reduce((soma, key) => soma + parseQty(values[key]), 0);
            values.total = String(total);
          } else {
            // Item inteiro (equipamento/alugado): restaura o estado anterior ao romaneio.
            values = { ...item.snapshotBefore };
            const dadosManutencao = manutencaoDadosPorItem[itemKey(item)];
            if (dadosManutencao) {
              values.status = 'Em manutenção';
              novosManutencao.push({
                ...criarEntradaManutencao({
                  row: { id: row.id, tableName: table.name, values },
                  data: dadosManutencao.data,
                  motivo: dadosManutencao.motivo,
                  responsavel: dadosManutencao.responsavel,
                  observacao: dadosManutencao.observacao,
                  fotoUrl: dadosManutencao.fotoUrl,
                  fotoBackendId: dadosManutencao.fotoBackendId,
                  origem: 'romaneio',
                }),
                id: dadosManutencao.numeroManutencao,
              });
            }
          }

          return { ...row, values, searchText: buildSearchText(values) };
        });

        // 3. Recria materiais que saíram totalmente (linha removida do estoque)
        const recreated = tableItems
          .filter((item) => itemIsMaterial(item) && !existingIds.has(item.rowId) && materialReturnQty(item) > 0)
          .map((item) => {
            const restored = { ...item.snapshotBefore, quantidade: String(materialReturnQty(item)) };
            return {
              id: item.rowId,
              tableName: item.tableName,
              values: restored,
              searchText: buildSearchText(restored),
            };
          });

        return { ...table, rows: [...recreated, ...rows] };
      });

      const previousHistory = Array.isArray(almoxerifado?.romaneiosHistorico)
        ? almoxerifado.romaneiosHistorico
        : [];
      const nextRomaneios = previousHistory.map((entry: RomaneioHistoricoItem) => {
        if (entry.id !== romaneio.id) return entry;
        return {
          ...entry,
          revertedAt: new Date().toISOString(),
          revertedBy: cleanValue(userSession?.nome || userSession?.email || 'Usuário'),
        };
      });

      // Eventos de devolução para o histórico de alocações
      const timestamp = new Date().toISOString();
      const novosEventos: any[] = [];
      romaneio.items.forEach((item) => {
        const localBase = cleanValue(item.snapshotBefore?.localizacao || romaneio.osLocal || '');
        if (itemIsGas(item)) {
          Object.keys(item.gasQuantities || {}).forEach((gasKey) => {
            const ret = gasReturnQty(item, gasKey);
            if (ret <= 0) return;
            novosEventos.push({
              id: uid('desal'),
              action: 'desalocar',
              kind: 'gases',
              dataEvento: timestamp,
              osId: romaneio.osId,
              osLabel: romaneio.osLabel,
              itemLabel: `${item.itemLabel} - ${getGasLabel(gasKey)}`,
              tableName: item.tableName,
              quantity: ret,
              local: localBase,
              gasName: getGasLabel(gasKey),
            });
          });
        } else if (itemIsMaterial(item)) {
          const ret = materialReturnQty(item);
          if (ret <= 0) return;
          novosEventos.push({
            id: uid('desal'),
            action: 'desalocar',
            kind: 'materiais',
            dataEvento: timestamp,
            osId: romaneio.osId,
            osLabel: romaneio.osLabel,
            itemLabel: `${item.itemLabel} (x${ret})`,
            tableName: item.tableName,
            quantity: ret,
            local: localBase,
          });
        } else if (!baixaDadosPorItem[itemKey(item)]) {
          // Item marcado pra baixa não volta pro estoque — sem evento de "desalocar", igual ao
          // fluxo de Baixa direto do Estoque, que também não grava nada em alocacoesHistorico.
          novosEventos.push({
            id: uid('desal'),
            action: 'desalocar',
            kind: normalizeKey(item.tableName).includes('alugadosequipamentos') ? 'equipamentos' : 'outros',
            dataEvento: timestamp,
            osId: romaneio.osId,
            osLabel: romaneio.osLabel,
            itemLabel: item.itemLabel,
            tableName: item.tableName,
            local: localBase,
          });
        }
      });

      const previousAlocacoesHistorico = Array.isArray(almoxerifado?.alocacoesHistorico)
        ? almoxerifado.alocacoesHistorico
        : [];
      const previousManutencaoHistorico = Array.isArray(almoxerifado?.manutencaoHistorico)
        ? almoxerifado.manutencaoHistorico
        : [];
      const previousBaixasHistorico = Array.isArray(almoxerifado?.baixasHistorico)
        ? almoxerifado.baixasHistorico
        : [];

      await saveEntity('almoxerifado', {
        ...(almoxerifado || {}),
        version: 2,
        tables: nextTables,
        romaneiosHistorico: nextRomaneios,
        alocacoesHistorico: [...novosEventos, ...previousAlocacoesHistorico],
        manutencaoHistorico: [...novosManutencao, ...previousManutencaoHistorico],
        baixasHistorico: [...novasBaixas, ...previousBaixasHistorico],
      });

      closeReturnModal();
    } finally {
      setRevertingId('');
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-cyan-300 text-[10px] font-black uppercase tracking-widest">
          <History size={14} /> Histórico de Romaneio
        </div>
        <h1 className="text-3xl font-black text-white">Romaneios de saída em lote</h1>
        <p className="text-white/50 text-sm">Cada romaneio registra os itens que saíram em lote. No retorno, materiais e gases voltam pela quantidade escolhida (incrementando o estoque) e os equipamentos voltam por inteiro.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
          <Input
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            placeholder="Buscar por OS, item ou tabela..."
            className="h-14 border-white/10 bg-white/5 pl-12 text-white placeholder:text-white/40"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total de romaneios</p>
          <p className="mt-1 text-2xl font-black text-white">{romaneios.length}</p>
        </div>
      </div>

      <div className="space-y-4 overflow-auto pr-1">
        {romaneios.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-[#101f3d] p-10 text-center text-white/40">
            <ClipboardList size={42} className="text-white/20" />
            <p className="text-sm font-bold">Nenhum romaneio encontrado</p>
          </div>
        ) : (
          romaneios.map((romaneio) => (
            <div key={romaneio.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{romaneio.id}</p>
                  <h3 className="mt-1 text-lg font-black text-white">{romaneio.osLabel || romaneio.osId || 'OS não informada'}</h3>
                  <p className="text-xs text-white/50">Criado em {formatDateTime(romaneio.createdAt)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-cyan-500/30 bg-cyan-500/15 text-cyan-200">
                    {romaneio.items.length} itens
                  </Badge>
                  {romaneio.revertedAt ? (
                    <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-200">
                      Devolvido em {formatDateTime(romaneio.revertedAt)}
                    </Badge>
                  ) : (
                    <Badge className="border border-amber-500/30 bg-amber-500/15 text-amber-200">Saída ativa</Badge>
                  )}
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#0b1220]/40">
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-white/40">
                      <th className="px-6 py-3 text-left">Tabela</th>
                      <th className="px-6 py-3 text-left">Item</th>
                      <th className="px-6 py-3 text-left">Qtd. que saiu</th>
                      <th className="px-6 py-3 text-left">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {romaneio.items.map((item) => (
                      <tr key={`${romaneio.id}-${item.tableName}-${item.rowId}`} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-3 text-white/70">{item.tableName}</td>
                        <td className="px-6 py-3 text-white font-bold">{item.itemLabel}</td>
                        <td className="px-6 py-3 text-white/70">{item.quantidade || '1'}</td>
                        <td className="px-6 py-3 text-white/70">{itemIsMaterial(item) ? 'Material (baixa)' : itemIsGas(item) ? 'Gás' : 'Equipamento'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-6 py-4">
                <button
                  type="button"
                  onClick={() => handleDownloadRomaneio(romaneio)}
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-xs font-bold uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/25 hover:text-white"
                >
                  <Download size={14} />
                  Baixar documento
                </button>
                <button
                  type="button"
                  disabled={Boolean(romaneio.revertedAt) || revertingId === romaneio.id}
                  onClick={() => openReturnModal(romaneio)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={14} />
                  {romaneio.revertedAt ? 'Já devolvido' : revertingId === romaneio.id ? 'Devolvendo...' : 'Voltar para o estoque'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/5 bg-[#101f3d] p-6">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">Voltar para o estoque</p>
                <h2 className="text-xl font-black uppercase tracking-wide text-white">{returnTarget.osLabel || returnTarget.osId || 'Romaneio'}</h2>
              </div>
              <button type="button" onClick={closeReturnModal} className="rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-6">
              <p className="text-xs text-white/50">
                Escolha quanto de cada item volta ao estoque. Materiais e gases incrementam a quantidade no estoque (limitado ao que saiu); equipamentos voltam por inteiro.
              </p>

              {returnTarget.items.map((item) => {
                const key = itemKey(item);
                const isMaterial = itemIsMaterial(item);
                const isGas = itemIsGas(item);
                const sentMaterial = parseQty(item.quantidade);
                const gasEntries = Object.entries(item.gasQuantities || {});

                return (
                  <div key={key} className="rounded-xl border border-white/5 bg-[#0b1220]/40 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{item.itemLabel}</div>
                        <div className="text-[11px] text-white/40">{item.tableName}</div>
                      </div>
                      {isMaterial ? (
                        <span className="shrink-0 rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">Material</span>
                      ) : isGas ? (
                        <span className="shrink-0 rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">Gás</span>
                      ) : (
                        <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Equipamento</span>
                      )}
                    </div>

                    {isMaterial ? (
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <label className="text-[11px] text-white/50">Voltar ao estoque:</label>
                        <input
                          type="number"
                          min={0}
                          max={sentMaterial || undefined}
                          value={returnMaterialQty[key] ?? ''}
                          onChange={(e) => setReturnMaterialQty((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="h-9 w-24 rounded-lg border border-white/10 bg-[#0b1220]/80 px-2 text-center text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                        />
                        <span className="text-[11px] text-white/40">de {sentMaterial}</span>
                      </div>
                    ) : isGas ? (
                      <div className="mt-3 space-y-2">
                        {gasEntries.length === 0 ? (
                          <p className="text-right text-[11px] text-white/40">Nenhum gás para devolver.</p>
                        ) : (
                          gasEntries.map(([gasKey, sentQty]) => (
                            <div key={gasKey} className="flex items-center justify-end gap-2">
                              <span className="text-[11px] font-semibold text-cyan-200">{getGasLabel(gasKey)}</span>
                              <input
                                type="number"
                                min={0}
                                max={sentQty || undefined}
                                value={returnGasQty[key]?.[gasKey] ?? ''}
                                onChange={(e) => setReturnGasQty((prev) => ({
                                  ...prev,
                                  [key]: { ...(prev[key] || {}), [gasKey]: e.target.value },
                                }))}
                                className="h-9 w-24 rounded-lg border border-white/10 bg-[#0b1220]/80 px-2 text-center text-sm text-white focus:border-cyan-500/40 focus:outline-none"
                              />
                              <span className="text-[11px] text-white/40">de {sentQty}</span>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-white/40">
                            {manutencaoDadosPorItem[key] ? (
                              <span className="font-bold text-amber-200">Será devolvido em manutenção</span>
                            ) : baixaDadosPorItem[key] ? (
                              <span className="font-bold text-red-300">Será dado baixa — não retorna ao estoque</span>
                            ) : (
                              'Será devolvido por inteiro, disponível.'
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => setMenuRetornoAberto((prev) => (prev === key ? null : key))}
                            title="Clique para escolher o destino do item: disponível, manutenção ou baixa"
                            className={`flex items-center gap-2 rounded-lg border-2 px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition ${
                              manutencaoDadosPorItem[key]
                                ? 'border-amber-400 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                                : baixaDadosPorItem[key]
                                ? 'border-red-400 bg-red-500/20 text-red-100 hover:bg-red-500/30'
                                : 'border-cyan-400/60 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20'
                            }`}
                          >
                            <Pencil size={16} strokeWidth={2.5} />
                            {manutencaoDadosPorItem[key] ? 'Em manutenção' : baixaDadosPorItem[key] ? 'Baixa' : 'Disponível'}
                          </button>
                        </div>

                        {/* Fica no fluxo normal da página (não é um popover posicionado) —
                            sem isso, num item perto do fim da lista o menu abria fora da área
                            visível do modal e ficava cortado pelo scroll (overflow-y-auto). */}
                        {menuRetornoAberto === key && (
                          <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#0b1220]/60 p-2">
                            <button
                              type="button"
                              onClick={() => {
                                setManutencaoDadosPorItem((prev) => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                                setBaixaDadosPorItem((prev) => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                                setMenuRetornoAberto(null);
                              }}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/20"
                            >
                              <CheckCircle2 size={14} /> Disponível no estoque
                            </button>
                            {itemPossuiManutencao({ id: item.rowId, tableName: item.tableName, values: item.snapshotBefore }) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuRetornoAberto(null);
                                  setEntradaManutencaoAlvo({ item, numeroManutencao: gerarIdManutencao() });
                                }}
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/20"
                              >
                                <Wrench size={14} /> Enviar para manutenção
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setMenuRetornoAberto(null);
                                openBaixaForm(item);
                              }}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-red-200 transition hover:bg-red-500/20"
                            >
                              <Trash2 size={14} /> Dar baixa
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {Object.keys(manutencaoDadosPorItem).length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-200">
                    <Wrench size={12} /> Itens que vão retornar em manutenção
                  </p>
                  <ul className="space-y-1 text-xs text-amber-100/80">
                    {returnTarget.items
                      .filter((item) => manutencaoDadosPorItem[itemKey(item)])
                      .map((item) => (
                        <li key={itemKey(item)}>
                          <span className="font-bold text-white">{item.itemLabel}</span> — Nº {manutencaoDadosPorItem[itemKey(item)].numeroManutencao} · {manutencaoDadosPorItem[itemKey(item)].motivo}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {Object.keys(baixaDadosPorItem).length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-red-200">
                    <Trash2 size={12} /> Itens que vão ser dados baixa (não retornam ao estoque)
                  </p>
                  <ul className="space-y-1 text-xs text-red-100/80">
                    {returnTarget.items
                      .filter((item) => baixaDadosPorItem[itemKey(item)])
                      .map((item) => (
                        <li key={itemKey(item)}>
                          <span className="font-bold text-white">{item.itemLabel}</span> — {baixaDadosPorItem[itemKey(item)].motivo}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 bg-[#131f37] p-6">
              <button type="button" onClick={closeReturnModal} className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10">Cancelar</button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={revertingId === returnTarget.id}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-40"
              >
                {revertingId === returnTarget.id ? 'Devolvendo...' : 'Confirmar devolução'}
              </button>
            </div>
          </div>
        </div>
      )}

      {entradaManutencaoAlvo && (
        <EntradaManutencaoModal
          row={{
            id: entradaManutencaoAlvo.item.rowId,
            tableName: entradaManutencaoAlvo.item.tableName,
            values: entradaManutencaoAlvo.item.snapshotBefore,
          }}
          categoriaLabel={entradaManutencaoAlvo.item.tableName}
          numeroManutencao={entradaManutencaoAlvo.numeroManutencao}
          responsavelPadrao={cleanValue(userSession?.nome || userSession?.email || '')}
          onClose={() => setEntradaManutencaoAlvo(null)}
          onConfirm={(dados) => {
            const key = itemKey(entradaManutencaoAlvo.item);
            setManutencaoDadosPorItem((prev) => ({
              ...prev,
              [key]: { numeroManutencao: entradaManutencaoAlvo.numeroManutencao, ...dados },
            }));
            setBaixaDadosPorItem((prev) => {
              if (!prev[key]) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setEntradaManutencaoAlvo(null);
          }}
        />
      )}

      {baixaFormAlvo && returnTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-red-400">Baixa de item</p>
                <h2 className="text-xl font-black uppercase tracking-wide text-white">{baixaFormAlvo.itemLabel}</h2>
                <p className="mt-1 text-xs text-white/40">{baixaFormAlvo.tableName}</p>
              </div>
              <button type="button" onClick={closeBaixaForm} className="rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">OS de origem</p>
                <p className="mt-1 text-sm font-bold text-white">{returnTarget.osLabel || returnTarget.osId}</p>
              </div>

              <div className="space-y-2">
                <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Data da baixa</label>
                <Input
                  type="date"
                  value={baixaFormData}
                  onChange={(event) => setBaixaFormData(event.target.value)}
                  className="h-12 rounded-xl border border-white/5 bg-[#0b1220]/80 px-4 text-white shadow-sm transition hover:border-red-400/40 focus:border-red-400 focus:ring-1 focus:ring-red-400"
                />
              </div>

              <div className="space-y-2">
                <label className="ml-1 block text-[11px] font-bold uppercase tracking-wider text-white/50">Motivo</label>
                <textarea
                  value={baixaFormMotivo}
                  onChange={(event) => setBaixaFormMotivo(event.target.value)}
                  placeholder="Descreva o motivo da baixa"
                  className="min-h-[100px] w-full rounded-xl border border-white/5 bg-[#0b1220]/80 px-4 py-3 text-sm text-white outline-none shadow-sm transition placeholder:text-white/30 focus:border-red-400 focus:ring-1 focus:ring-red-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 bg-[#131f37] p-6">
              <button type="button" onClick={closeBaixaForm} className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmBaixaForm}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500"
              >
                <Trash2 size={16} />
                Confirmar baixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
