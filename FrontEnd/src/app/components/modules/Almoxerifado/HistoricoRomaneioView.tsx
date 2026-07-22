import React, { useMemo, useState } from 'react';
import { ClipboardList, Download, History, RotateCcw, Search, X } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';
import { gerarRomaneioPdf, loadRomaneioLogoBase64 } from './romaneioPdf';
import { toast } from 'sonner';

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
  };

  // Regera e baixa o documento (modelo FLN 026) de um romaneio já feito.
  const handleDownloadRomaneio = async (romaneio: RomaneioHistoricoItem) => {
    try {
      const logoBase64 = await loadRomaneioLogoBase64();
      const doc = gerarRomaneioPdf({
        cliente: romaneio.osCliente || '',
        osLabel: romaneio.osLabel || romaneio.osId,
        enderecoEntrega: romaneio.osLocal || '',
        dataEmissao: romaneio.createdAt,
        items: romaneio.items.map((item) => ({
          descricao: item.itemLabel,
          quantidade: item.quantidade || '1',
        })),
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
      const nextTables = previousTables.map((table: any) => {
        const tableItems = romaneio.items.filter((item) => item.tableName === table.name);
        if (tableItems.length === 0) return table;

        const existingIds = new Set((table.rows || []).map((row: any) => row.id));

        // 1. Atualiza linhas existentes (incrementa quantidade ou restaura item inteiro)
        const rows = (table.rows || []).map((row: any) => {
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
          }

          return { ...row, values, searchText: buildSearchText(values) };
        });

        // 2. Recria materiais que saíram totalmente (linha removida do estoque)
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
        } else {
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

      await saveEntity('almoxerifado', {
        ...(almoxerifado || {}),
        version: 2,
        tables: nextTables,
        romaneiosHistorico: nextRomaneios,
        alocacoesHistorico: [...novosEventos, ...previousAlocacoesHistorico],
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
                      <p className="mt-3 text-right text-[11px] text-white/40">Será devolvido por inteiro.</p>
                    )}
                  </div>
                );
              })}
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
    </div>
  );
}
