import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { FinCard, Toolbar, Btn } from '../finUi';
import { money, num, br, download } from '../finData';
import { useFin, type FinRecord } from '../useFin';
import { useFinFilters } from '../finFilters';

type Tone = 'ok' | 'wait' | 'bad' | 'info' | 'neutral';
interface Evento { id: string; date: string; title: string; detail: string; autor: string; tone: Tone }

const DOT: Record<Tone, string> = {
  ok: 'bg-emerald-400', wait: 'bg-amber-400', bad: 'bg-rose-400', info: 'bg-sky-400', neutral: 'bg-white/40',
};

// Deriva uma linha do tempo de eventos a partir dos registros financeiros.
function eventosDe(r: FinRecord): Evento[] {
  const base = String(r.createdAt || '');
  const ev: Evento[] = [];
  switch (r.tipo) {
    case 'solicitacao':
      ev.push({ id: `${r.id}-c`, date: base, title: 'Solicitação criada', detail: `${r.fornecedor || ''} • ${money(num(r.valor))}`, autor: r.solicitante || 'Setor', tone: 'info' });
      if (r.status === 'Aprovado') ev.push({ id: `${r.id}-a`, date: base, title: 'Solicitação aprovada → Conta a Pagar', detail: `${r.id}`, autor: 'Financeiro', tone: 'ok' });
      if (r.status === 'Reprovado') ev.push({ id: `${r.id}-r`, date: base, title: 'Solicitação reprovada', detail: `${r.id}`, autor: 'Financeiro', tone: 'bad' });
      break;
    case 'contaPagar':
      ev.push({ id: `${r.id}-c`, date: base, title: 'Conta a pagar criada', detail: `${r.fornecedor || ''} • ${money(num(r.valor))}`, autor: 'Financeiro', tone: 'wait' });
      if (r.status === 'Pago') {
        ev.push({ id: `${r.id}-p`, date: r.dataPagamento || base, title: 'Pagamento realizado', detail: `${money(num(r.valorPago))} • banco ${r.banco || '—'}`, autor: 'Financeiro', tone: 'ok' });
        if (num(r.jurosPago) > 0) ev.push({ id: `${r.id}-j`, date: r.dataPagamento || base, title: 'Juros informados', detail: `${money(num(r.jurosPago))}${r.motivoJuros ? ` • ${r.motivoJuros}` : ''}`, autor: 'Financeiro', tone: 'bad' });
        if ((r.comprovantes || []).length) ev.push({ id: `${r.id}-cp`, date: r.dataPagamento || base, title: 'Comprovante anexado', detail: (r.comprovantes as string[]).join(', '), autor: 'Financeiro', tone: 'neutral' });
      }
      break;
    case 'contaReceber':
      ev.push({ id: `${r.id}-c`, date: base, title: 'Conta a receber criada', detail: `${r.cliente || ''} • ${money(num(r.valorLiquido ?? r.valor))}`, autor: 'Financeiro', tone: 'wait' });
      if (r.recebido) ev.push({ id: `${r.id}-rec`, date: r.dataRecebimento || base, title: 'Recebimento registrado', detail: `${money(num(r.valorRecebido))} • banco ${r.bancoRecebimento || '—'}`, autor: 'Financeiro', tone: 'ok' });
      break;
    case 'nfe':
      ev.push({ id: `${r.id}-e`, date: r.emissao || base, title: 'NFe emitida e arquivada', detail: `NF ${r.numero || ''} • líquido ${money(num(r.liquido))}`, autor: 'Financeiro', tone: 'ok' });
      break;
    case 'nfeReq':
      ev.push({ id: `${r.id}-c`, date: base, title: 'Solicitação de NFe', detail: `${r.cliente || ''} • ${money(num(r.valor))}`, autor: 'Financeiro', tone: 'info' });
      break;
    case 'banco':
      ev.push({ id: `${r.id}-c`, date: base, title: 'Banco cadastrado', detail: `${r.nome || ''} • ${r.empresa || ''}`, autor: 'Financeiro', tone: 'neutral' });
      break;
    case 'locEstudo':
      ev.push({ id: `${r.id}-c`, date: base, title: 'Estudo de locação salvo', detail: `${r.tipoLocacao || ''} • ${r.unidade || ''}`, autor: 'Financeiro', tone: 'neutral' });
      break;
  }
  return ev;
}

export function HistoricoView() {
  const { financeiro } = useFin();
  const { match } = useFinFilters();

  const eventos = useMemo(() => {
    return financeiro
      .filter(match)
      .flatMap(eventosDe)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [financeiro, match]);

  const exportar = () => {
    const txt = eventos.map((e) => `${e.date ? e.date.slice(0, 10) : '—'} | ${e.autor} | ${e.title} | ${e.detail}`).join('\n');
    download(txt || 'Sem eventos.', 'historico_financeiro.txt');
  };

  return (
    <FinCard>
      <Toolbar
        title="Histórico"
        hint="Linha do tempo de todas as ações financeiras: criação, aprovação, pagamento, juros, comprovantes, NFe e recebimentos."
        actions={<Btn variant="secondary" onClick={exportar}><Download size={15} /> Exportar histórico</Btn>}
      />

      {eventos.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#0b1220] p-10 text-center text-xs font-bold uppercase tracking-widest text-white/30">
          Nenhuma ação registrada ainda
        </div>
      ) : (
        <ol className="relative ml-3 space-y-4 border-l border-white/10 pl-6">
          {eventos.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-[#101f3d] ${DOT[e.tone]}`} />
              <div className="rounded-2xl border border-white/5 bg-[#0b1220] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-white">{e.title}</b>
                  <span className="text-xs text-white/40">{e.date ? br(e.date.slice(0, 10)) : '—'}</span>
                </div>
                <p className="mt-1 text-sm text-white/55">{e.detail}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-white/30">{e.autor}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </FinCard>
  );
}
