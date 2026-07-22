import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AlertTriangle, HelpCircle } from 'lucide-react';

// ============================================================================
// Feedback do ERP — substitui os diálogos nativos do navegador (alert/confirm/
// prompt), que apareciam com o "(host) diz..." feio, por popups DENTRO do app.
//
//   - Mensagens de sucesso/erro/aviso  -> toast.success / toast.error / ... (sonner)
//   - Pergunta Sim/Não (era `confirm`) -> await confirmDialog(...)  => Promise<boolean>
//   - Entrada de texto (era `prompt`)  -> await promptDialog(...)   => Promise<string|null>
//
// `FeedbackHost` é montado UMA vez na raiz (main.tsx) e rende tanto o Toaster
// quanto o modal de confirm/prompt. As funções confirmDialog/promptDialog são
// imperativas (não-hook) para poderem ser chamadas de dentro de qualquer handler
// sem reestruturar o componente.
// ============================================================================

type DialogReq = {
  id: number;
  kind: 'confirm' | 'prompt';
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
  resolve: (value: boolean | string | null) => void;
};

let listeners: Array<(req: DialogReq | null) => void> = [];
let currentReq: DialogReq | null = null;
let seq = 0;

function publish(req: DialogReq | null) {
  currentReq = req;
  listeners.forEach((l) => l(req));
}

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

/** Pergunta Sim/Não dentro do app. Resolve `true` (confirmou) ou `false` (cancelou). */
export function confirmDialog(opts: string | ConfirmOptions): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise<boolean>((resolve) => {
    // Se já houver um diálogo aberto, resolve o anterior como cancelado para não vazar a promise.
    if (currentReq) currentReq.resolve(currentReq.kind === 'confirm' ? false : null);
    publish({ id: ++seq, kind: 'confirm', resolve: resolve as (v: boolean | string | null) => void, ...o });
  });
}

type PromptOptions = {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
};

/** Entrada de texto dentro do app. Resolve a string digitada ou `null` (cancelou). */
export function promptDialog(opts: string | PromptOptions): Promise<string | null> {
  const o: PromptOptions = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise<string | null>((resolve) => {
    if (currentReq) currentReq.resolve(currentReq.kind === 'confirm' ? false : null);
    publish({ id: ++seq, kind: 'prompt', resolve: resolve as (v: boolean | string | null) => void, ...o });
  });
}

function DialogHost() {
  const [req, setReq] = useState<DialogReq | null>(currentReq);
  const [valor, setValor] = useState('');

  useEffect(() => {
    const l = (r: DialogReq | null) => {
      setReq(r);
      setValor(r?.defaultValue ?? '');
    };
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  if (!req) return null;

  const fechar = (value: boolean | string | null) => {
    req.resolve(value);
    publish(null);
  };
  const cancelar = () => fechar(req.kind === 'confirm' ? false : null);
  const confirmar = () => fechar(req.kind === 'confirm' ? true : valor);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
    if (e.key === 'Enter' && req.kind === 'prompt') { e.preventDefault(); confirmar(); }
  };

  const isDanger = !!req.danger;
  const confirmCls = isDanger
    ? 'bg-red-600 hover:bg-red-500 text-white'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancelar(); }}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101f3d] shadow-2xl">
        <div className="flex items-start gap-3 p-6">
          <div className={`mt-0.5 shrink-0 rounded-xl p-2 ${isDanger ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {isDanger ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            {req.title && <h3 className="text-white font-black text-base mb-1">{req.title}</h3>}
            <p className="text-white/70 text-sm whitespace-pre-line leading-relaxed">{req.message}</p>
            {req.kind === 'prompt' && (
              <input
                autoFocus
                value={valor}
                placeholder={req.placeholder || ''}
                onChange={(e) => setValor(e.target.value)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500"
              />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button
            onClick={cancelar}
            className="rounded-xl bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10 transition-colors"
          >
            {req.cancelText || 'Cancelar'}
          </button>
          <button
            onClick={confirmar}
            autoFocus={req.kind === 'confirm'}
            className={`rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${confirmCls}`}
          >
            {req.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Monte UMA vez na raiz do app (main.tsx). Rende o Toaster e o modal de confirm/prompt. */
export function FeedbackHost() {
  return (
    <>
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        duration={4000}
        toastOptions={{ style: { fontSize: '14px' } }}
      />
      <DialogHost />
    </>
  );
}

// Reexporta o toast para quem quiser importar tudo de um lugar só.
export { toast };
