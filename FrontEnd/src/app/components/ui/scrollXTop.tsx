import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Envolve uma tabela/conteúdo largo com uma barra de rolagem horizontal própria (desenhada
 * em divs, não a nativa do navegador) no topo, para que ela fique visível sem precisar rolar
 * a página até o fim de listas longas. A barra nativa (embaixo) continua funcional, só oculta.
 *
 * Não usamos `::-webkit-scrollbar` pra estilizar uma barra nativa espelhada: em alguns
 * navegadores/monitores ela renderiza cortada/incompleta dentro do card arredondado
 * (`overflow: hidden` nos cantos). Desenhando a própria faixa não há essa dependência.
 */
export function ScrollXTop({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const [metrics, setMetrics] = useState({ thumbPct: 1, leftPct: 0, visible: false });
  // Espelha `metrics` fora do estado pra `recompute` comparar sem precisar entrar na lista de
  // dependências do useCallback (senão cada `setMetrics` recriaria a função, invalidando os
  // listeners que a usam). Só chama `setMetrics` quando o valor REALMENTE muda — um objeto
  // novo a cada chamada, mesmo com os mesmos números, nunca passa no Object.is do React e
  // re-renderiza pra sempre (o efeito abaixo roda em todo render, sem lista de dependências).
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const recompute = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const { scrollWidth, clientWidth, scrollLeft } = body;
    const next = scrollWidth <= clientWidth + 1
      ? { thumbPct: 1, leftPct: 0, visible: false }
      : (() => {
        const thumbPct = Math.max(clientWidth / scrollWidth, 0.04);
        const maxScroll = scrollWidth - clientWidth;
        const leftPct = maxScroll > 0 ? (scrollLeft / maxScroll) * (1 - thumbPct) : 0;
        return { thumbPct, leftPct, visible: true };
      })();
    const prev = metricsRef.current;
    const mudou = prev.visible !== next.visible
      || Math.abs(prev.thumbPct - next.thumbPct) > 0.001
      || Math.abs(prev.leftPct - next.leftPct) > 0.001;
    if (mudou) setMetrics(next);
  }, []);

  useLayoutEffect(() => {
    recompute();
    const body = bodyRef.current;
    if (!body) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(body);
    Array.from(body.children).forEach((c) => ro.observe(c));
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  });

  const scrollToClientX = (clientX: number) => {
    const track = trackRef.current;
    const body = bodyRef.current;
    if (!track || !body) return;
    const rect = track.getBoundingClientRect();
    const thumbWidthPx = rect.width * metrics.thumbPct;
    const usable = rect.width - thumbWidthPx;
    const ratio = usable > 0 ? Math.min(1, Math.max(0, (clientX - rect.left - thumbWidthPx / 2) / usable)) : 0;
    body.scrollLeft = ratio * (body.scrollWidth - body.clientWidth);
  };

  const onTrackClick = (e: React.MouseEvent) => {
    if (e.target !== trackRef.current) return; // clique no thumb: quem trata é o drag
    scrollToClientX(e.clientX);
  };

  const onThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = { startX: e.clientX, startScrollLeft: bodyRef.current?.scrollLeft || 0 };
  };

  const onThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !trackRef.current || !bodyRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const body = bodyRef.current;
    const thumbWidthPx = rect.width * metrics.thumbPct;
    const usable = rect.width - thumbWidthPx;
    const deltaX = e.clientX - draggingRef.current.startX;
    const deltaScroll = usable > 0 ? (deltaX / usable) * (body.scrollWidth - body.clientWidth) : 0;
    body.scrollLeft = draggingRef.current.startScrollLeft + deltaScroll;
  };

  const onThumbPointerUp = () => { draggingRef.current = null; };

  return (
    <div className={className}>
      <div
        ref={trackRef}
        onClick={onTrackClick}
        className={`relative overflow-hidden ${metrics.visible ? 'mx-2 mt-2 mb-1 h-2.5 rounded-full bg-white/5' : 'h-0'}`}
      >
        <div
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
          onPointerCancel={onThumbPointerUp}
          className="absolute top-0 h-full select-none rounded-full bg-white/25 transition-colors hover:bg-white/35 active:bg-white/45"
          style={{ width: `${metrics.thumbPct * 100}%`, left: `${metrics.leftPct * 100}%`, touchAction: 'none' }}
        />
      </div>
      <div ref={bodyRef} onScroll={recompute} className="scroll-x-hide overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
