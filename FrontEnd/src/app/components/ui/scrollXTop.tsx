import React, { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Envolve uma tabela/conteúdo largo com uma barra de rolagem horizontal espelhada
 * no topo (além da nativa, que fica oculta), para que ela fique visível sem precisar
 * rolar a página até o fim de listas longas.
 */
export function ScrollXTop({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const topRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<'top' | 'body' | null>(null);

  const syncSpacerWidth = useCallback(() => {
    if (spacerRef.current && bodyRef.current) {
      spacerRef.current.style.width = `${bodyRef.current.scrollWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    syncSpacerWidth();
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncSpacerWidth);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    window.addEventListener('resize', syncSpacerWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncSpacerWidth);
    };
  });

  const onTopScroll = () => {
    if (syncingRef.current === 'body') { syncingRef.current = null; return; }
    if (!topRef.current || !bodyRef.current) return;
    syncingRef.current = 'top';
    bodyRef.current.scrollLeft = topRef.current.scrollLeft;
  };

  const onBodyScroll = () => {
    if (syncingRef.current === 'top') { syncingRef.current = null; return; }
    if (!topRef.current || !bodyRef.current) return;
    syncingRef.current = 'body';
    topRef.current.scrollLeft = bodyRef.current.scrollLeft;
  };

  return (
    <div className={className}>
      <div ref={topRef} onScroll={onTopScroll} className="scroll-x-mirror overflow-x-auto overflow-y-hidden" style={{ height: 12 }}>
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
      <div ref={bodyRef} onScroll={onBodyScroll} className="scroll-x-hide overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
