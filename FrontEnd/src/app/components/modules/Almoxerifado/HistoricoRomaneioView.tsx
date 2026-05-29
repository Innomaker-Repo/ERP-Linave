import React, { useMemo, useState } from 'react';
import { ClipboardList, History, RotateCcw, Search } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';

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
  mode?: 'alocacao' | 'baixa';
  osId: string;
  osLabel: string;
  osLocal?: string;
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
    .replace(/[\u0300-\u036f]/g, '')
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

export function HistoricoRomaneioView({ searchQuery }: HistoricoRomaneioViewProps) {
  const { almoxerifado, saveEntity, userSession } = useErp();
  const [filtro, setFiltro] = useState(searchQuery || '');
  const [revertingId, setRevertingId] = useState('');

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

  const handleVoltarParaEstoque = async (romaneio: RomaneioHistoricoItem) => {
    if (romaneio.mode === 'baixa') {
      alert('Romaneios de baixa não podem ser devolvidos ao estoque.');
      return;
    }

    if (romaneio.revertedAt) {
      alert('Este romaneio já foi devolvido ao estoque.');
      return;
    }

    const confirmar = window.confirm('Deseja devolver todos os itens deste romaneio para o estoque?');
    if (!confirmar) return;

    setRevertingId(romaneio.id);

    try {
      const snapshotMap = new Map<string, RomaneioHistoricoItemRow>();
      romaneio.items.forEach((item) => {
        snapshotMap.set(`${item.tableName}::${item.rowId}`, item);
      });

      const previousTables = Array.isArray(almoxerifado?.tables) ? almoxerifado.tables : [];
      const nextTables = previousTables.map((table: any) => {
        if (!Array.isArray(table?.rows)) return table;

        return {
          ...table,
          rows: table.rows.map((row: any) => {
            const key = `${table.name}::${row.id}`;
            const historyItem = snapshotMap.get(key);
            if (!historyItem) return row;

            const restoredValues = {
              ...historyItem.snapshotBefore,
            };

            return {
              ...row,
              values: restoredValues,
              searchText: buildSearchText(restoredValues),
            };
          })
        };
      });

      const previousHistory = Array.isArray(almoxerifado?.romaneiosHistorico)
        ? almoxerifado.romaneiosHistorico
        : [];
      const nextRomaneios = previousHistory.map((entry: RomaneioHistoricoItem) => {
        if (entry.id !== romaneio.id) return entry;
        return {
          ...entry,
          revertedAt: new Date().toISOString(),
          revertedBy: cleanValue(userSession?.nome || userSession?.email || 'Usuário')
        };
      });

      const previousAlocacoesHistorico = Array.isArray(almoxerifado?.alocacoesHistorico)
        ? almoxerifado.alocacoesHistorico
        : [];
      const novosEventos = romaneio.items.map((item) => ({
        id: `desal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action: 'desalocar',
        kind: normalizeKey(item.tableName).includes('alugadosequipamentos')
          ? 'equipamentos'
          : normalizeKey(item.tableName).includes('materiais')
            ? 'materiais'
            : 'outros',
        dataEvento: new Date().toISOString(),
        osId: romaneio.osId,
        osLabel: romaneio.osLabel,
        itemLabel: item.itemLabel,
        tableName: item.tableName,
        local: cleanValue(item.snapshotBefore?.localizacao || romaneio.osLocal || ''),
      }));

      await saveEntity('almoxerifado', {
        ...(almoxerifado || {}),
        version: 2,
        tables: nextTables,
        romaneiosHistorico: nextRomaneios,
        alocacoesHistorico: [...novosEventos, ...previousAlocacoesHistorico],
      });
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
        <p className="text-white/50 text-sm">Cada romaneio registra os itens alocados em lote e permite retorno total ao estoque.</p>
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
                  <Badge className={romaneio.mode === 'baixa' ? 'border border-red-500/30 bg-red-500/15 text-red-200' : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-200'}>
                    {romaneio.mode === 'baixa' ? 'Baixa' : 'Alocação'}
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
                      <th className="px-6 py-3 text-left">Quantidade</th>
                      <th className="px-6 py-3 text-left">Status atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {romaneio.items.map((item) => (
                      <tr key={`${romaneio.id}-${item.tableName}-${item.rowId}`} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-3 text-white/70">{item.tableName}</td>
                        <td className="px-6 py-3 text-white font-bold">{item.itemLabel}</td>
                        <td className="px-6 py-3 text-white/70">{item.quantidade || '1'}</td>
                        <td className="px-6 py-3 text-white/70">{item.snapshotAfter?.status || 'Alocado'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-white/10 px-6 py-4">
                <button
                  type="button"
                  disabled={romaneio.mode === 'baixa' || Boolean(romaneio.revertedAt) || revertingId === romaneio.id}
                  onClick={() => handleVoltarParaEstoque(romaneio)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={14} />
                  {romaneio.mode === 'baixa' ? 'Sem devolução' : revertingId === romaneio.id ? 'Devolvendo...' : 'Voltar para o estoque'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
