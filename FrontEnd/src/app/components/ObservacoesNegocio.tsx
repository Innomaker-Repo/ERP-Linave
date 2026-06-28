// Box somente-leitura com as observações dos serviços do Negócio.
// É APENAS referência para quem está montando o documento (Orçamento/Proposta/OS) —
// NÃO é persistido junto com o documento. Não renderiza nada se não houver observações.

interface ObservacoesNegocioProps {
  servicos?: any[];
  className?: string;
}

export function ObservacoesNegocio({ servicos, className = '' }: ObservacoesNegocioProps) {
  const obs = (Array.isArray(servicos) ? servicos : [])
    .map((s: any) => ({
      tipo: String(s?.tipo || s?.tipo_servico || '').trim(),
      texto: String(s?.observacoes ?? s?.observacao ?? '').trim(),
    }))
    .filter((o) => o.texto);

  if (obs.length === 0) return null;

  return (
    <div className={`bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 ${className}`}>
      <p className="text-amber-300 font-black text-[11px] uppercase tracking-widest mb-2 flex flex-wrap items-center gap-2">
        Observações do Negócio
        <span className="text-amber-300/50 font-semibold normal-case tracking-normal text-[11px]">
          (apenas referência — não vai para o documento)
        </span>
      </p>
      <ul className="space-y-1.5">
        {obs.map((o, i) => (
          <li key={i} className="text-amber-100/90 text-sm">
            {o.tipo ? <span className="font-bold">{o.tipo}: </span> : null}
            <span className="whitespace-pre-wrap">{o.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
