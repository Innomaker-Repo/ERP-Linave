import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { FinCard, Toolbar, Btn } from '../finUi';
import { SEED_HIST, type HistItem } from '../finData';

export function HistoricoView() {
  const [rows] = useState<HistItem[]>(SEED_HIST);

  return (
    <FinCard>
      <Toolbar
        title="Histórico"
        hint="Rastreamento de todas as ações."
        actions={<Btn variant="secondary"><Download size={15} /> Exportar histórico</Btn>}
      />
      <div className="grid grid-cols-1 gap-3">
        {rows.map((h, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-[#0b1220] p-4">
            <b className="text-white">{h.title}</b>
            <p className="mt-1 text-sm text-white/45">{h.detail}</p>
            <small className="mt-2 block text-xs text-white/30">
              <b className="text-white/50">{h.user}</b> • {h.date}
            </small>
          </div>
        ))}
      </div>
    </FinCard>
  );
}
