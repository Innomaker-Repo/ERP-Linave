/* =========================================================================================
 * FINANCEIRO — Primitivos de UI (tema escuro do ERP)
 * Tags, cartões, métricas, campos de formulário e tabela reutilizados pelas views.
 * =======================================================================================*/
import React, { useState } from 'react';
import { SEED_BANKS } from './finData';

// ---------- Tons de status (paleta escura do ERP) ----------
type Tone = 'ok' | 'wait' | 'bad' | 'info' | 'neutral' | 'mother' | 'child' | 'linave' | 'servinave';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  wait: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  bad: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
  info: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  neutral: 'border-white/15 bg-white/10 text-white/70',
  mother: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
  child: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  linave: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  servinave: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
};

const STATUS_TONE: Record<string, Tone> = {
  'Aguardando aprovação': 'wait', 'Aprovado': 'ok', 'Reprovado': 'bad', 'Aberto': 'wait',
  'Em andamento': 'info', 'Medição aprovada': 'ok', 'Finalizada': 'ok', 'Cancelada': 'bad',
  'Aguardando emissão': 'wait', 'Emitida e arquivada': 'ok', 'Vencido': 'bad', 'A receber': 'wait',
  'Recebido': 'ok', 'Pago': 'ok', 'Parcelado': 'info', 'Ativa': 'ok', 'Pausada': 'wait', 'Encerrada': 'neutral',
};

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export const StatusTag = ({ status }: { status: string }) => (
  <Pill tone={STATUS_TONE[status] || 'neutral'}>{status}</Pill>
);

export const CompanyTag = ({ empresa }: { empresa: string }) => (
  <Pill tone={empresa === 'Linave' ? 'linave' : empresa === 'Servinave' ? 'servinave' : 'neutral'}>{empresa}</Pill>
);

export const TypeTag = ({ type }: { type: string }) => (
  <Pill tone={type === 'parent' ? 'mother' : type === 'child' ? 'child' : 'neutral'}>
    {type === 'parent' ? 'Mãe' : type === 'child' ? 'Filha' : 'Única'}
  </Pill>
);

// ---------- Cartão de seção ----------
export function FinCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-[28px] border border-white/5 bg-[#101f3d] p-6 shadow-2xl shadow-black/20 ${className}`}>
      {children}
    </div>
  );
}

// ---------- Cabeçalho/Toolbar de seção ----------
export function Toolbar({ title, hint, actions }: { title: string; hint?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        {hint && <p className="mt-1 text-sm text-white/45">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Cartão métrico (KPI grande) ----------
export function Metric({ label, value, foot }: { label: string; value: React.ReactNode; foot?: string }) {
  return (
    <FinCard className="relative overflow-hidden">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/10" />
      <p className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      {foot && <p className="mt-3 text-xs text-white/35">{foot}</p>}
    </FinCard>
  );
}

// KPI compacto.
export function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0b1220] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/35">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

// ---------- Botões ----------
type BtnVariant = 'amber' | 'green' | 'red' | 'blue' | 'secondary' | 'ghost';
const BTN_CLASS: Record<BtnVariant, string> = {
  amber: 'bg-amber-500 text-[#0b1220] hover:bg-amber-400',
  green: 'bg-emerald-500 text-[#0b1220] hover:bg-emerald-400',
  red: 'bg-rose-500 text-white hover:bg-rose-400',
  blue: 'bg-sky-500 text-[#0b1220] hover:bg-sky-400',
  secondary: 'bg-white/10 text-white hover:bg-white/15',
  ghost: 'border border-white/10 bg-transparent text-white/80 hover:bg-white/5',
};

export function Btn({
  variant = 'amber', small, className = '', children, ...rest
}: { variant?: BtnVariant; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 rounded-xl font-bold transition-all active:scale-[0.98] ${BTN_CLASS[variant]} ${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} ${className}`}
    >
      {children}
    </button>
  );
}

// ---------- Campos de formulário ----------
export const labelCls = 'mb-1.5 block text-[11px] font-black uppercase tracking-widest text-white/40';
export const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-500';

export function Field({ label, span = 4, children }: { label: string; span?: number; children: React.ReactNode }) {
  const colCls: Record<number, string> = {
    2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4', 6: 'md:col-span-6', 12: 'md:col-span-12',
  };
  return (
    <div className={`col-span-12 ${colCls[span] || 'md:col-span-4'}`}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`${inputCls} ${props.className || ''}`} />
);

export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`${inputCls} min-h-[88px] resize-y ${props.className || ''}`} />
);

export function Select({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={`${inputCls} cursor-pointer appearance-none pr-9 [&>option]:bg-[#101f3d] ${rest.className || ''}`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">▼</span>
    </div>
  );
}

// Input de arquivo que mantém os arquivos brutos (File[]) selecionados. O upload de
// verdade (para a tabela Documento) é feito por quem usa, no submit, quando já se tem
// o id do registro para vincular. Aqui só capturamos os arquivos e exibimos os nomes.
export function FileInput({
  label = 'Anexar arquivo', value = [] as File[], onChange, multiple = true,
}: { label?: string; value?: File[]; onChange: (files: File[]) => void; multiple?: boolean }) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-[#0b1220] px-4 py-4 text-sm text-white/60 transition-colors hover:border-amber-500/40">
        <span className="text-lg">📎</span> {value.length ? `${value.length} arquivo(s) anexado(s)` : label}
        <input
          type="file"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const novos = Array.from(e.target.files || []);
            onChange(multiple ? [...value, ...novos] : novos);
          }}
        />
      </label>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((f, i) => (
            <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/70">📄 {f.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Caixa de upload (visual).
export function UploadBox({ label = 'Anexar documento / imagem', files = [] as string[] }) {
  return (
    <div>
      <div className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-[#0b1220] px-4 py-4 text-sm text-white/50 transition-colors hover:border-amber-500/40">
        <span className="text-lg">📎</span> {label}
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/70">📄 {f}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Tabela ----------
export function DataTable({ head, children, minWidth }: { head: React.ReactNode; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-auto rounded-2xl border border-white/5 bg-[#0b1220]">
      <table className="w-full text-left text-sm" style={minWidth ? { minWidth } : undefined}>
        <thead className="bg-white/[0.03] text-[10px] font-black uppercase tracking-widest text-white/35">
          <tr className="border-b border-white/5">{head}</tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export const Th = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <th className={`whitespace-nowrap px-4 py-3 ${className}`}>{children}</th>
);

export const Td = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <td className={`whitespace-nowrap px-4 py-3 text-white/80 ${className}`}>{children}</td>
);

// Estado vazio.
export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-xs font-bold uppercase tracking-widest text-white/30">{text}</td>
    </tr>
  );
}

// ---------- Barra de filtros (empresa / banco / período) ----------
// Visual; cada página do Financeiro a renderiza no topo. Mock — não filtra de fato ainda.
export function FinFilters() {
  const [empresa, setEmpresa] = useState('Todas');
  const [banco, setBanco] = useState('Todos');
  const [periodo, setPeriodo] = useState('all');

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="w-44">
        <Select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="Todas">Todas as empresas</option>
          <option>Linave</option>
          <option>Servinave</option>
        </Select>
      </div>
      <div className="w-44">
        <Select value={banco} onChange={(e) => setBanco(e.target.value)}>
          <option value="Todos">Todos os bancos</option>
          {SEED_BANKS.map((b) => <option key={b.nome}>{b.nome}</option>)}
        </Select>
      </div>
      <div className="w-40">
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          <option value="all">Todo período</option>
          <option value="range">Data inicial e final</option>
          <option value="month">Mês específico</option>
          <option value="year">Ano específico</option>
        </Select>
      </div>
    </div>
  );
}

// ---------- Modal ----------
export function FinModal({
  title, hint, onClose, wide, children,
}: { title: string; hint?: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[92vh] overflow-auto rounded-[24px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/40`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            {hint && <p className="mt-1 text-sm text-white/45">{hint}</p>}
          </div>
          <button onClick={onClose} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-white/5 text-lg text-white/70 transition-colors hover:bg-white/10">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// Faixa de alerta.
export function AlertBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {children}
    </div>
  );
}
