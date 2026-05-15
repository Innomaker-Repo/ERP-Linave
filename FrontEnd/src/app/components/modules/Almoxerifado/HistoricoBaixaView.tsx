import React, { useMemo, useState } from 'react';
import { Archive, CalendarClock, Search, Trash2 } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';

interface BaixaHistoricoItem {
  id: string;
  dataBaixa: string;
  tableName: string;
  itemLabel: string;
  statusAnterior: string;
  localizacao?: string;
  serviceOS?: string;
  snapshot?: Record<string, string>;
}

interface HistoricoBaixaViewProps {
  searchQuery: string;
}

const formatDateTime = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

export function HistoricoBaixaView({ searchQuery }: HistoricoBaixaViewProps) {
  const { almoxerifado } = useErp();
  const [filtro, setFiltro] = useState(searchQuery || '');

  const baixaHistorico = useMemo(() => {
    const source = Array.isArray(almoxerifado?.baixasHistorico) ? (almoxerifado.baixasHistorico as BaixaHistoricoItem[]) : [];
    const termo = (filtro || searchQuery || '').toLowerCase().trim();

    return source.filter((item) => {
      if (!termo) return true;
      const searchable = [item.itemLabel, item.tableName, item.statusAnterior, item.localizacao, item.serviceOS]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(termo);
    });
  }, [almoxerifado?.baixasHistorico, filtro, searchQuery]);

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-amber-300 text-[10px] font-black uppercase tracking-widest">
          <Trash2 size={14} /> Histórico de Baixa
        </div>
        <h1 className="text-3xl font-black text-white">Itens dados baixa</h1>
        <p className="text-white/50 text-sm">Os itens removidos do estoque permanecem registrados aqui com o snapshot da última situação.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
          <Input
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            placeholder="Buscar por item, tabela, OS ou local..."
            className="h-14 border-white/10 bg-white/5 pl-12 text-white placeholder:text-white/40"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total no histórico</p>
          <p className="mt-1 text-2xl font-black text-white">{baixaHistorico.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Movimentações de baixa</p>
        </div>

        {baixaHistorico.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-white/40">
            <Archive size={42} className="text-white/20" />
            <p className="text-sm font-bold">Nenhum item baixado encontrado</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-[#101f3d]">
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                  <th className="px-6 py-4 text-left">Data</th>
                  <th className="px-6 py-4 text-left">Item</th>
                  <th className="px-6 py-4 text-left">Tabela</th>
                  <th className="px-6 py-4 text-left">Status anterior</th>
                  <th className="px-6 py-4 text-left">Local / OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {baixaHistorico.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-white/70">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock size={14} className="text-amber-400" />
                        {formatDateTime(item.dataBaixa)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{item.itemLabel}</div>
                      <div className="text-xs text-white/35">{item.id}</div>
                    </td>
                    <td className="px-6 py-4 text-white/70">{item.tableName}</td>
                    <td className="px-6 py-4">
                      <Badge className="border border-red-500/30 bg-red-500/15 text-red-200">{item.statusAnterior || '—'}</Badge>
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      <div>{item.localizacao || '—'}</div>
                      <div className="text-xs text-white/35">{item.serviceOS || 'Sem OS'}</div>
                    </td>
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
