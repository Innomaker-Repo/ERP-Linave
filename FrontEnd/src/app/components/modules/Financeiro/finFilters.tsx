/* =========================================================================================
 * FINANCEIRO — Filtros globais (empresa / banco / período)
 * Estado compartilhado entre a barra de filtros e as views. Filtragem frontend.
 * =======================================================================================*/
import React, { createContext, useContext, useState } from 'react';
import { Select, inputCls } from './finUi';
import { useFin } from './useFin';

export interface FinFilterState {
  empresa: string;
  banco: string;
  mes: string;
}

interface FinFiltersCtx {
  filters: FinFilterState;
  setFilters: React.Dispatch<React.SetStateAction<FinFilterState>>;
  // Predicado: o registro passa pelos filtros atuais?
  match: (rec: any) => boolean;
}

const DEFAULTS: FinFilterState = { empresa: 'Todas', banco: 'Todos', mes: '' };

const Ctx = createContext<FinFiltersCtx | null>(null);

// Fallback seguro caso alguma view seja usada fora do provider.
export const useFinFilters = (): FinFiltersCtx =>
  useContext(Ctx) || { filters: DEFAULTS, setFilters: () => {}, match: () => true };

export function FinFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FinFilterState>(DEFAULTS);

  const match = (rec: any): boolean => {
    const empresa = rec?.empresa;
    if (filters.empresa !== 'Todas' && empresa && empresa !== 'Ambas' && empresa !== filters.empresa) return false;
    if (filters.banco !== 'Todos') {
      const b = rec?.banco || rec?.bancoRecebimento;
      if (b && b !== filters.banco) return false; // só exclui registros que têm banco
    }
    if (filters.mes) {
      const d = String(rec?.vencimento || rec?.vencimentoRecebimento || rec?.dataEmitir || rec?.dataTermino || rec?.createdAt || '');
      if (d && d.slice(0, 7) !== filters.mes) return false;
    }
    return true;
  };

  return <Ctx.Provider value={{ filters, setFilters, match }}>{children}</Ctx.Provider>;
}

export function FinFiltersBar() {
  const { filters, setFilters } = useFinFilters();
  const { empresas, records } = useFin();
  const bancos = records('banco').map((b) => b.nome).filter(Boolean) as string[];
  const ativo = filters.empresa !== 'Todas' || filters.banco !== 'Todos' || !!filters.mes;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="w-44">
        <Select value={filters.empresa} onChange={(e) => setFilters((f) => ({ ...f, empresa: e.target.value }))}>
          <option value="Todas">Todas as empresas</option>
          {empresas.map((emp) => <option key={emp}>{emp}</option>)}
        </Select>
      </div>
      <div className="w-44">
        <Select value={filters.banco} onChange={(e) => setFilters((f) => ({ ...f, banco: e.target.value }))}>
          <option value="Todos">Todos os bancos</option>
          {bancos.map((b) => <option key={b}>{b}</option>)}
        </Select>
      </div>
      <div className="w-40">
        <input
          type="month"
          value={filters.mes}
          onChange={(e) => setFilters((f) => ({ ...f, mes: e.target.value }))}
          className={inputCls}
        />
      </div>
      {ativo && (
        <button
          onClick={() => setFilters(DEFAULTS)}
          className="rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-white/5"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
