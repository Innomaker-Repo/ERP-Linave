import React, { useState } from 'react';
import { ScrollText, FileText } from 'lucide-react';
import { NfeView } from './NfeView';
import { ReciboLocacaoView } from './ReciboLocacaoView';

// NFe e Recibo de Locação viviam em duas abas separadas do sidebar, mas seguem a mesma regra
// de origem (medição aprovada): item de SERVIÇO → NFe; item de LOCAÇÃO → Recibo de Locação
// (Nota de Débito, pra Linave). Essa regra já está implementada em cada view (NfeView deriva as
// solicitações da medição excluindo locação; ReciboLocacaoView deriva o recibo só dos itens de
// locação) — aqui só concentra as duas em uma única aba do menu, com um alternador interno,
// sem mexer em nenhuma delas.
const tabCls = (ativo: boolean) =>
  `px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${
    ativo ? 'bg-emerald-500 text-[#0b1220]' : 'bg-white/5 text-white/60 hover:bg-white/10'
  }`;

export function NfeReciboView() {
  const [aba, setAba] = useState<'nfe' | 'recibo'>('nfe');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setAba('nfe')} className={tabCls(aba === 'nfe')}>
          <ScrollText size={13} /> NFe
        </button>
        <button onClick={() => setAba('recibo')} className={tabCls(aba === 'recibo')}>
          <FileText size={13} /> Recibo de Locação
        </button>
      </div>

      {aba === 'nfe' ? <NfeView /> : <ReciboLocacaoView />}
    </div>
  );
}
