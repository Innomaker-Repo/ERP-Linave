import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Package, Search } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { Badge } from '../../../modules/shared/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../modules/shared/ui/select';
import { getOrdensServico, getOsOptionLabel, getOsOptionValue, type OrdemServicoResumo, isOsAlvo } from '../../../../services/ordensServico';

interface AllocationRow {
  id: string;
  itemLabel: string;
  tableName: string;
  type: 'gases' | 'equipamentos' | 'materiais' | 'alugaveis' | 'outros';
  osLabel: string;
  local: string;
  quantity?: string;
  details?: string;
}

interface AllocationHistoricoItem {
  id: string;
  action: 'alocar' | 'desalocar';
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

interface OsOptionItem {
  key: string;
  value: string;
  label: string;
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

interface AlocadosPorOSViewProps {
  searchQuery: string;
}

export function AlocadosPorOSView({ searchQuery }: AlocadosPorOSViewProps) {
  const { almoxerifado, os } = useErp();
  const [backendOS, setBackendOS] = useState<OrdemServicoResumo[]>([]);
  const [selectedOs, setSelectedOs] = useState('');
  const [filtro, setFiltro] = useState(searchQuery || '');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const items = await getOrdensServico();
        if (mounted) setBackendOS(items);
      } catch (error) {
        if (mounted) setBackendOS([]);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const availableOS = useMemo(() => {
    const merged: OsOptionItem[] = [];
    const seen = new Set<string>();
    const source = [...(Array.isArray(backendOS) ? backendOS : []), ...(Array.isArray(os) ? os : [])];

    source.forEach((entry) => {
      if (!isOsAlvo(entry)) return;
      const value = cleanValue(getOsOptionValue(entry as OrdemServicoResumo) || String(entry?.id || ''));
      if (!value || seen.has(value)) return;
      seen.add(value);
      merged.push({
        key: value,
        value,
        label: getOsOptionLabel(entry as OrdemServicoResumo)
      });
    });

    const historySource = Array.isArray(almoxerifado?.alocacoesHistorico)
      ? (almoxerifado.alocacoesHistorico as AllocationHistoricoItem[])
      : [];

    historySource
      .filter((entry) => entry?.action === 'alocar')
      .forEach((entry) => {
        const value = cleanValue(entry.osId || entry.osLabel);
        if (!value || seen.has(value)) return;
        seen.add(value);
        merged.push({
          key: value,
          value,
          label: entry.osLabel || entry.osId
        });
      });

    return merged;
  }, [backendOS, os, almoxerifado?.alocacoesHistorico]);

  useEffect(() => {
    if (!selectedOs && availableOS.length > 0) {
      setSelectedOs(availableOS[0].value);
    }
  }, [availableOS, selectedOs]);

  const selectedOsLabel = useMemo(() => {
    const found = availableOS.find((entry) => entry.value === selectedOs);
    return found ? found.label : selectedOs;
  }, [availableOS, selectedOs]);

  const currentAllocations = useMemo(() => {
    const termo = (filtro || searchQuery || '').toLowerCase().trim();
    const selectedTerm = normalizeKey(selectedOs);

    const historicalAllocations = (Array.isArray(almoxerifado?.alocacoesHistorico)
      ? (almoxerifado.alocacoesHistorico as AllocationHistoricoItem[])
      : [])
      .filter((entry) => entry.action === 'alocar')
      .filter((entry) => {
        const osId = normalizeKey(entry.osId || '');
        const osLabel = normalizeKey(entry.osLabel || '');
        return !selectedTerm || osId.includes(selectedTerm) || osLabel.includes(selectedTerm);
      })
      .map((entry) => ({
        id: entry.id,
        itemLabel: cleanValue(entry.itemLabel || entry.gasName || 'Item'),
        tableName: cleanValue(entry.tableName || 'Tabela'),
        type: entry.kind || 'outros',
        osLabel: cleanValue(entry.osLabel || entry.osId),
        local: cleanValue(entry.local),
        quantity: entry.quantity !== undefined ? String(entry.quantity) : undefined,
        details: `Evento: ${new Date(entry.dataEvento).toLocaleString('pt-BR')}`
      })) as AllocationRow[];

    const merged = historicalAllocations;

    if (!termo) return merged;

    return merged.filter((item) => {
      const searchable = [item.itemLabel, item.tableName, item.osLabel, item.local, item.quantity, item.details].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(termo);
    });
  }, [almoxerifado?.alocacoesHistorico, filtro, searchQuery, selectedOs]);

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-cyan-300 text-[10px] font-black uppercase tracking-widest">
          <ClipboardList size={14} /> Histórico por OS
        </div>
        <h1 className="text-3xl font-black text-white">Histórico de alocações por OS</h1>
        <p className="text-white/50 text-sm">Mostra todas as alocações já realizadas na OS, mesmo após desalocação dos itens no estoque.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Ordem de Serviço</label>
          <Select value={selectedOs} onValueChange={setSelectedOs}>
            <SelectTrigger className="h-14 border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Selecione uma OS" />
            </SelectTrigger>
            <SelectContent className="border border-white/10 bg-[#0b1220] text-white shadow-2xl">
              {availableOS.length === 0 ? (
                <SelectItem value="none" disabled>
                  Nenhuma OS disponível
                </SelectItem>
              ) : (
                availableOS.map((ordemServico) => {
                  return (
                    <SelectItem key={ordemServico.key} value={ordemServico.value} className="cursor-pointer rounded-xl px-3 py-2 text-sm text-white/80 focus:bg-white/10 focus:text-white">
                      {ordemServico.label}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Busca</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
            <input
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              placeholder="Filtrar por item, local, tabela..."
              className="h-14 w-full rounded-[24px] border border-white/10 bg-white/5 pl-12 pr-4 text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">OS selecionada</p>
          <p className="mt-1 text-lg font-black text-white">{selectedOsLabel || '—'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Itens vinculados</p>
          <p className="mt-1 text-2xl font-black text-white">{currentAllocations.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Fonte</p>
          <p className="mt-1 text-sm font-bold text-white/70">Histórico permanente de alocações</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Alocações registradas dessa OS</p>
        </div>

        {currentAllocations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-white/40">
            <Package size={42} className="text-white/20" />
            <p className="text-sm font-bold">Nenhum item encontrado para esta OS</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-[#101f3d]">
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                  <th className="px-6 py-4 text-left">Tipo</th>
                  <th className="px-6 py-4 text-left">Item</th>
                  <th className="px-6 py-4 text-left">Quantidade</th>
                  <th className="px-6 py-4 text-left">Local</th>
                  <th className="px-6 py-4 text-left">Tabela</th>
                  <th className="px-6 py-4 text-left">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {currentAllocations.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <Badge className="border border-cyan-500/30 bg-cyan-500/15 text-cyan-200 capitalize">
                        {item.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-white font-bold">{item.itemLabel}</td>
                    <td className="px-6 py-4 text-white/70">{item.quantity || '—'}</td>
                    <td className="px-6 py-4 text-white/70">{item.local || '—'}</td>
                    <td className="px-6 py-4 text-white/70">{item.tableName}</td>
                    <td className="px-6 py-4 text-white/50 text-xs">{item.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
