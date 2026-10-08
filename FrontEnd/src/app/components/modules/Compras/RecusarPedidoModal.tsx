import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { FinModal, Field, Textarea, Btn } from '../Financeiro/finUi';
import type { RequisicaoCompra } from './comprasLocal';

// Modal de recusa com motivo, reutilizado nos 3 pontos de recusa do fluxo de compras
// (Kanban/cotação, Aprovar Com., Aprovar Fin.) — ver `recusarRequisicao` em
// comprasAprovacaoShared.ts para a persistência.
export function RecusarPedidoModal({
  request, onClose, onConfirm,
}: {
  request: RequisicaoCompra;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void> | void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!motivo.trim()) return;
    setEnviando(true);
    try {
      await onConfirm(motivo.trim());
    } finally {
      setEnviando(false);
    }
  };

  return (
    <FinModal
      title="Recusar solicitação de compras"
      hint="O pedido volta para o solicitante com o motivo abaixo. Ele poderá editar e reenviar, ou cancelar."
      onClose={onClose}
    >
      <form className="grid grid-cols-12 gap-4" onSubmit={handleSubmit}>
        <div className="col-span-12 rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm">
          <span className="text-white/40 text-[10px] uppercase tracking-widest font-black">Solicitante</span>
          <p className="text-white font-semibold mt-1">{request.solicitante || '-'}</p>
        </div>

        <Field label="Motivo da recusa *" span={12}>
          <Textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explique por que a solicitação está sendo recusada..."
          />
        </Field>

        <div className="col-span-12 flex justify-end gap-2">
          <Btn type="button" variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" variant="red" disabled={enviando || !motivo.trim()}>
            <Ban size={15} /> {enviando ? 'Recusando...' : 'Confirmar recusa'}
          </Btn>
        </div>
      </form>
    </FinModal>
  );
}
