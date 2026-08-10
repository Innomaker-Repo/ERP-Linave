/* =========================================================================================
 * FINANCEIRO — Filtros globais (empresa / banco / período)
 * Estado compartilhado entre a barra de filtros e as views. Filtragem frontend.
 * O período é uma FAIXA de datas (início → fim, com dia) aplicada a todas as telas.
 * =======================================================================================*/
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Landmark, CalendarRange, ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import { Select } from './finUi';
import { useFin } from './useFin';
import { days, todayStr } from './finData';

export interface FinFilterState {
  empresa: string;
  banco: string;
  dataInicio: string; // YYYY-MM-DD (inclusive) — vazio = sem limite inferior
  dataFim: string;    // YYYY-MM-DD (inclusive) — vazio = sem limite superior
}

interface FinFiltersCtx {
  filters: FinFilterState;
  setFilters: React.Dispatch<React.SetStateAction<FinFilterState>>;
  // Predicado: o registro passa pelos filtros atuais?
  match: (rec: any) => boolean;
}

const DEFAULTS: FinFilterState = { empresa: 'Todas', banco: 'Todos', dataInicio: '', dataFim: '' };

// Data (qualquer formato ...YYYY-MM-DD...) relevante de um registro financeiro.
const dataDoRegistro = (rec: any): string =>
  String(
    rec?.vencimento ||
    rec?.vencimentoRecebimento ||
    rec?.dataEmitir ||
    rec?.dataTermino ||
    rec?.dataPagamento ||
    rec?.createdAt ||
    '',
  ).slice(0, 10);

const Ctx = createContext<FinFiltersCtx | null>(null);

// Fallback seguro caso alguma view seja usada fora do provider.
export const useFinFilters = (): FinFiltersCtx =>
  useContext(Ctx) || { filters: DEFAULTS, setFilters: () => {}, match: () => true };

export function FinFiltersProvider({ view = '', children }: { view?: string; children: React.ReactNode }) {
  const [filters, setFilters] = useState<FinFilterState>(() => {
    const [ini, fim] = periodoPadraoDaView(view);
    return { ...DEFAULTS, dataInicio: ini, dataFim: fim };
  });

  // Ao trocar de tela, o período volta para o padrão daquela tela (Contas a Receber abre
  // em "de hoje em diante"; as demais, sem limite). Empresa e banco continuam grudados,
  // porque são recorte de contexto e não de janela de tempo.
  const viewAnterior = useRef(view);
  useEffect(() => {
    if (viewAnterior.current === view) return;
    viewAnterior.current = view;
    const [ini, fim] = periodoPadraoDaView(view);
    setFilters((f) => ({ ...f, dataInicio: ini, dataFim: fim }));
  }, [view]);

  const match = (rec: any): boolean => {
    const empresa = rec?.empresa;
    if (filters.empresa !== 'Todas' && empresa && empresa !== 'Ambas' && empresa !== filters.empresa) return false;
    if (filters.banco !== 'Todos') {
      const b = rec?.banco || rec?.bancoRecebimento;
      if (b && b !== filters.banco) return false; // só exclui registros que têm banco
    }
    if (filters.dataInicio || filters.dataFim) {
      const d = dataDoRegistro(rec);
      // Registros sem data ficam visíveis (mesma regra do filtro antigo por mês).
      if (d) {
        if (filters.dataInicio && d < filters.dataInicio) return false;
        if (filters.dataFim && d > filters.dataFim) return false;
      }
    }
    return true;
  };

  return <Ctx.Provider value={{ filters, setFilters, match }}>{children}</Ctx.Provider>;
}

/* ---------------------------------------------------------------------------------------
 * Atalhos de período (presets) — computados a partir de hoje.
 * ------------------------------------------------------------------------------------- */
const primeiroDoMes = (d: string) => `${d.slice(0, 7)}-01`;
const ultimoDoMes = (d: string) => {
  const [y, m] = d.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${d.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`;
};
const ano = todayStr.slice(0, 4);

type Preset = { id: string; label: string; range: [string, string] };

// Telas de histórico (o que já aconteceu): contas a pagar, aprovações, histórico...
const PRESETS_PASSADO: Preset[] = [
  { id: 'tudo', label: 'Tudo', range: ['', ''] },
  { id: 'hoje', label: 'Hoje', range: [todayStr, todayStr] },
  { id: '7d', label: '7 dias', range: [days(todayStr, -6), todayStr] },
  { id: '30d', label: '30 dias', range: [days(todayStr, -29), todayStr] },
  { id: 'mes', label: 'Este mês', range: [primeiroDoMes(todayStr), ultimoDoMes(todayStr)] },
  { id: 'ano', label: 'Este ano', range: [`${ano}-01-01`, `${ano}-12-31`] },
];

// Telas de previsão (o que ainda vai vencer): Contas a Receber. Aqui olhar para trás não
// ajuda — o que importa é o que está por receber de hoje em diante.
const PRESETS_FUTURO: Preset[] = [
  { id: 'tudo', label: 'Tudo', range: ['', ''] },
  { id: 'aPartirDeHoje', label: 'De hoje em diante', range: [todayStr, ''] },
  { id: 'hoje', label: 'Hoje', range: [todayStr, todayStr] },
  { id: 'prox7d', label: 'Próximos 7 dias', range: [todayStr, days(todayStr, 6)] },
  { id: 'prox30d', label: 'Próximos 30 dias', range: [todayStr, days(todayStr, 29)] },
  { id: 'mes', label: 'Este mês', range: [primeiroDoMes(todayStr), ultimoDoMes(todayStr)] },
  { id: 'ano', label: 'Este ano', range: [`${ano}-01-01`, `${ano}-12-31`] },
];

// Telas que olham para frente e o período padrão que cada uma assume ao ser aberta.
const VIEWS_FUTURO = new Set(['receber', 'previsao']);
export const presetsDaView = (view: string): Preset[] =>
  VIEWS_FUTURO.has(view) ? PRESETS_FUTURO : PRESETS_PASSADO;
export const periodoPadraoDaView = (view: string): [string, string] =>
  VIEWS_FUTURO.has(view) ? [todayStr, ''] : ['', ''];

/* ---------------------------------------------------------------------------------------
 * Primitivos visuais da barra.
 * ------------------------------------------------------------------------------------- */
const grpLabel = 'mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40';

// Campo de data "cru" (sem borda própria) usado dentro do bloco de período.
// O rótulo (DE/ATÉ) fica antes do campo; o input mostra o placeholder nativo (dd/mm/aaaa).
function DateField({ tag, value, onChange, min, max }: {
  tag: string; value: string; onChange: (v: string) => void; min?: string; max?: string;
}) {
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{tag}</span>
      <input
        type="date"
        value={value}
        min={min || undefined}
        max={max || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold text-white outline-none [color-scheme:dark] focus:bg-white/5"
      />
    </div>
  );
}

function PresetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
        active
          ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/10'
          : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80'
      }`}
    >
      {label}
    </button>
  );
}

export function FinFiltersBar({ view = '' }: { view?: string }) {
  const { filters, setFilters } = useFinFilters();
  const { empresas, records } = useFin();
  const bancos = records('banco').map((b) => b.nome).filter(Boolean) as string[];
  const presets = presetsDaView(view);

  const ativos =
    (filters.empresa !== 'Todas' ? 1 : 0) +
    (filters.banco !== 'Todos' ? 1 : 0) +
    (filters.dataInicio || filters.dataFim ? 1 : 0);

  // Mantém a faixa coerente: fim nunca antes do início (e vice-versa).
  const setInicio = (v: string) =>
    setFilters((f) => ({ ...f, dataInicio: v, dataFim: f.dataFim && v && f.dataFim < v ? v : f.dataFim }));
  const setFim = (v: string) =>
    setFilters((f) => ({ ...f, dataFim: v, dataInicio: f.dataInicio && v && f.dataInicio > v ? v : f.dataInicio }));

  const presetAtivo = useMemo(
    () => presets.find((p) => p.range[0] === filters.dataInicio && p.range[1] === filters.dataFim)?.id,
    [presets, filters.dataInicio, filters.dataFim],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#12244a] to-[#0d1a35] px-4 py-3.5 shadow-lg shadow-black/20">
      {/* Cabeçalho da barra */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white/70">
          <SlidersHorizontal size={15} className="text-amber-400" />
          <span className="text-[11px] font-black uppercase tracking-widest">Filtros</span>
          {ativos > 0 && (
            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-[#0b1220]">
              {ativos}
            </span>
          )}
        </div>
        {ativos > 0 && (
          <button
            onClick={() => setFilters(DEFAULTS)}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-bold text-white/60 transition-colors hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Empresa */}
        <div className="min-w-[168px] flex-1">
          <span className={grpLabel}><Building2 size={12} /> Empresa</span>
          <Select value={filters.empresa} onChange={(e) => setFilters((f) => ({ ...f, empresa: e.target.value }))}>
            <option value="Todas">Todas as empresas</option>
            {empresas.map((emp) => <option key={emp}>{emp}</option>)}
          </Select>
        </div>

        {/* Banco */}
        <div className="min-w-[168px] flex-1">
          <span className={grpLabel}><Landmark size={12} /> Banco</span>
          <Select value={filters.banco} onChange={(e) => setFilters((f) => ({ ...f, banco: e.target.value }))}>
            <option value="Todos">Todos os bancos</option>
            {bancos.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </div>

        {/* Período (faixa de datas) */}
        <div className="min-w-[300px] flex-[2]">
          <span className={grpLabel}>
            <CalendarRange size={12} /> Período (início → fim)
            {periodoPadraoDaView(view)[0] && <span className="text-amber-300/60">· a partir de hoje</span>}
          </span>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0b1220] px-2 py-1 transition-colors focus-within:border-amber-500/60">
            <DateField tag="De" value={filters.dataInicio} onChange={setInicio} max={filters.dataFim} />
            <ArrowRight size={15} className="flex-shrink-0 text-white/30" />
            <DateField tag="Até" value={filters.dataFim} onChange={setFim} min={filters.dataInicio} />
          </div>
        </div>
      </div>

      {/* Atalhos de período */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-black uppercase tracking-widest text-white/30">Atalhos</span>
        {presets.map((p) => (
          <PresetChip
            key={p.id}
            label={p.label}
            active={p.id === 'tudo' ? !filters.dataInicio && !filters.dataFim : presetAtivo === p.id}
            onClick={() => setFilters((f) => ({ ...f, dataInicio: p.range[0], dataFim: p.range[1] }))}
          />
        ))}
      </div>
    </section>
  );
}
