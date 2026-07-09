import React, { useMemo } from 'react';
import { FinCard, Metric, boldOS } from '../finUi';
import { money, isOld, num, type Empresa } from '../finData';
import { useFin } from '../useFin';
import { useFinFilters } from '../finFilters';

// Barra horizontal de comparação (A pagar / A receber / Previsão).
function BarRow({ label, value, max }: { label: React.ReactNode; value: number; max: number }) {
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

export function DashboardView() {
  const { oss, records } = useFin();
  const { match } = useFinFilters();
  const pagar = records('contaPagar').filter(match);
  const receber = records('contaReceber').filter(match);
  const ossF = oss.filter(match);

  const kpis = useMemo(() => {
    const abertas = pagar.filter((p) => p.status !== 'Pago');
    const recAbertos = receber.filter((r) => !r.recebido);
    const recVencidos = receber.filter((r) => !r.recebido && isOld(r.vencimentoRecebimento));
    return {
      payOpen: abertas.length,
      payTotal: abertas.reduce((s, p) => s + num(p.valor), 0),
      recTotal: recAbertos.reduce((s, r) => s + num(r.valorLiquido ?? r.valor), 0),
      recOver: recVencidos.reduce((s, r) => s + num(r.valorLiquido ?? r.valor), 0),
    };
  }, [pagar, receber]);

  const empresaResumo = (empresa: Empresa) => {
    const aPagar = pagar.filter((p) => p.empresa === empresa && p.status !== 'Pago').reduce((s, p) => s + num(p.valor), 0);
    const aReceber = receber.filter((r) => r.empresa === empresa && !r.recebido).reduce((s, r) => s + num(r.valorLiquido ?? r.valor), 0);
    const previsao = ossF.filter((o) => o.empresa === empresa && !['Finalizada', 'Cancelada'].includes(o.status)).reduce((s, o) => s + o.valor, 0);
    const max = Math.max(aPagar, aReceber, previsao, 1);
    return { aPagar, aReceber, previsao, max };
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="A pagar em aberto" value={kpis.payOpen} foot="Contas e parcelas pendentes" />
        <Metric label="Total a pagar" value={money(kpis.payTotal)} foot="Contas a pagar em aberto" />
        <Metric label="A receber" value={money(kpis.recTotal)} foot="NFe, manual e locação" />
        <Metric label="Recebimentos vencidos" value={money(kpis.recOver)} foot="Vencimento menor que hoje" />
      </div>

      <FinCard>
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">Resumo por empresa</h2>
          <p className="mt-1 text-sm text-white/45">Previsão ({boldOS('OS')} reais), a pagar e a receber por empresa.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['Linave', 'Servinave'] as Empresa[]).map((empresa) => {
            const r = empresaResumo(empresa);
            return (
              <div key={empresa} className="rounded-2xl border border-white/5 bg-[#0b1220] p-4">
                <h3 className="mb-2 font-black text-white">{empresa}</h3>
                <BarRow label="A pagar" value={r.aPagar} max={r.max} />
                <BarRow label="A receber" value={r.aReceber} max={r.max} />
                <BarRow label={boldOS('Previsão OS')} value={r.previsao} max={r.max} />
              </div>
            );
          })}
        </div>
      </FinCard>
    </div>
  );
}
