import React, { useMemo } from 'react';
import { FinCard, Metric } from '../finUi';
import {
  money, recStatus, SEED_PAYABLES, SEED_RECEIVABLES, SEED_OS, type Empresa,
} from '../finData';

// Barra horizontal de comparação (A pagar / A receber / Previsão).
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(5, (value / (max || 1)) * 100);
  return (
    <div className="grid grid-cols-[110px_1fr_120px] items-center gap-3 py-1.5 text-sm">
      <b className="text-white/70">{label}</b>
      <div className="h-3 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right font-bold text-white/80">{money(value)}</span>
    </div>
  );
}

function EmpresaPanel({ empresa }: { empresa: Empresa }) {
  const aPagar = SEED_PAYABLES.filter((p) => p.empresa === empresa && p.type !== 'parent' && p.status !== 'Pago')
    .reduce((s, p) => s + p.valor, 0);
  const aReceber = SEED_RECEIVABLES.filter((r) => r.empresa === empresa && !r.recebido)
    .reduce((s, r) => s + r.valorLiquido, 0);
  const previsao = SEED_OS.filter((o) => o.empresa === empresa && !['Finalizada', 'Cancelada'].includes(o.status))
    .reduce((s, o) => s + o.valor, 0);
  const max = Math.max(aPagar, aReceber, previsao, 1);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0b1220] p-4">
      <h3 className="mb-2 font-black text-white">{empresa}</h3>
      <BarRow label="A pagar" value={aPagar} max={max} />
      <BarRow label="A receber" value={aReceber} max={max} />
      <BarRow label="Previsão OS" value={previsao} max={max} />
    </div>
  );
}

export function DashboardView() {
  const kpis = useMemo(() => {
    const pays = SEED_PAYABLES.filter((p) => p.type !== 'parent');
    const recs = SEED_RECEIVABLES;
    return {
      payOpen: pays.filter((p) => p.status !== 'Pago').length,
      payTotal: pays.filter((p) => p.status !== 'Pago').reduce((s, p) => s + p.valor, 0),
      recTotal: recs.filter((r) => !r.recebido).reduce((s, r) => s + r.valorLiquido, 0),
      recOver: recs.filter((r) => recStatus(r) === 'Vencido').reduce((s, r) => s + Math.max(0, r.valorLiquido - r.valorRecebido), 0),
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="A pagar em aberto" value={kpis.payOpen} foot="Contas e parcelas pendentes" />
        <Metric label="Total a pagar" value={money(kpis.payTotal)} foot="Filtrado por período/banco" />
        <Metric label="A receber" value={money(kpis.recTotal)} foot="NFe, manual e locação" />
        <Metric label="Recebimentos vencidos" value={money(kpis.recOver)} foot="Vencimento menor que hoje" />
      </div>

      <FinCard>
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">Resumo por empresa</h2>
          <p className="mt-1 text-sm text-white/45">Linave e Servinave separados.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EmpresaPanel empresa="Linave" />
          <EmpresaPanel empresa="Servinave" />
        </div>
      </FinCard>
    </div>
  );
}
