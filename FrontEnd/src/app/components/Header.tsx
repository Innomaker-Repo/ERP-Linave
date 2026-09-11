import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { Search, UserCircle, LogOut, PanelLeft, Bell } from 'lucide-react';
import { useNotificacoes } from '../hooks/useNotificacoes';
import { DEPARTMENTS, hasAccess } from '../navigation';

// Extrai o texto puro de um label de navegação — a maioria já é string, mas alguns (ex.:
// "Fazer OS", "Custo por OS") passam por `boldOS()` e viram ReactNode (array de string +
// <strong>OS</strong>). Busca/realce precisam do texto puro, não da árvore de elementos.
const textoDoLabel = (node: React.ReactNode): string => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textoDoLabel).join('');
  if (React.isValidElement(node)) return textoDoLabel((node.props as { children?: React.ReactNode })?.children);
  return '';
};

const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface SugestaoBusca {
  id: string;
  label: React.ReactNode;
  labelTexto: string;
  departamento: string;
}

interface HeaderProps {
  activeSection: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onToggleSidebar?: () => void;
  onNavigate?: (section: string) => void;
}

export function Header({ activeSection, searchQuery, setSearchQuery, onToggleSidebar, onNavigate }: HeaderProps) {
  const { userSession, empresa, logout } = useErp();
  const { notificacoes, quantidadeNaoVista, marcarTodasVistas } = useNotificacoes();
  const [painelAberto, setPainelAberto] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const buscaRef = useRef<HTMLDivElement>(null);

  // Fecha o painel ao clicar fora dele.
  useEffect(() => {
    if (!painelAberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) setPainelAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [painelAberto]);

  // Fecha as sugestões de busca ao clicar fora — mesmo padrão do painel de notificações.
  useEffect(() => {
    if (!buscaAberta) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setBuscaAberta(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [buscaAberta]);

  const abrirPainel = () => {
    const abrindo = !painelAberto;
    setPainelAberto(abrindo);
    // Abrir = "visto": some a contagem de novas até surgir outra atualização.
    if (abrindo) marcarTodasVistas();
  };

  const irParaNotificacao = (destino: string) => {
    setPainelAberto(false);
    onNavigate?.(destino);
  };

  // Índice plano de módulos/abas acessíveis ao usuário logado — mesma filtragem de
  // permissão que a Home usa pra montar "Seus Acessos" (`hasAccess`, navigation.tsx).
  const indiceBusca = useMemo<SugestaoBusca[]>(
    () => DEPARTMENTS.flatMap((dept) => dept.items
      .filter((item) => hasAccess(userSession, item.id))
      .map((item) => ({ id: item.id, label: item.label, labelTexto: textoDoLabel(item.label), departamento: dept.title }))),
    [userSession],
  );

  const sugestoes = useMemo<SugestaoBusca[]>(() => {
    const termo = normalizar(searchQuery);
    if (!termo) return [];
    // Nome do item bate primeiro (mais relevante); nome do departamento só entra depois
    // (ex.: digitar "compras" também sugere "Fornecedores", que é do departamento Compras).
    const porItem = indiceBusca.filter((s) => normalizar(s.labelTexto).includes(termo));
    const porDepartamento = indiceBusca.filter(
      (s) => !normalizar(s.labelTexto).includes(termo) && normalizar(s.departamento).includes(termo),
    );
    return [...porItem, ...porDepartamento].slice(0, 8);
  }, [searchQuery, indiceBusca]);

  const irParaSugestao = (id: string) => {
    setBuscaAberta(false);
    setSearchQuery('');
    onNavigate?.(id);
  };

  return (
    <header className="h-20 border-b border-white/5 bg-[#0b1220] flex items-center justify-between px-8">
      <div className="flex items-center gap-6 flex-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all shrink-0"
            title="Mostrar/ocultar menu"
            aria-label="Mostrar/ocultar menu"
          >
            <PanelLeft size={18} />
          </button>
        )}
        <h1 className="text-white font-black uppercase tracking-tighter text-xl">
          {activeSection === 'home' ? 'Início' : activeSection}
        </h1>

        <div className="relative w-full max-w-md" ref={buscaRef}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <input
            type="text"
            placeholder="Pesquisar no sistema..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setBuscaAberta(true);
            }}
            onFocus={() => setBuscaAberta(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBuscaAberta(false);
              if (e.key === 'Enter' && sugestoes[0]) irParaSugestao(sugestoes[0].id);
            }}
            className="w-full bg-white/5 border border-white/5 p-3 pl-12 rounded-2xl text-white text-xs outline-none focus:border-amber-500/50 transition-all"
          />

          {buscaAberta && searchQuery.trim() !== '' && (
            <div className="absolute left-0 top-full mt-2 w-full max-h-96 overflow-y-auto rounded-2xl border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/40 z-50">
              {sugestoes.length === 0 ? (
                <p className="px-4 py-6 text-center text-white/40 text-xs">Nenhum módulo ou aba encontrado.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {sugestoes.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => irParaSugestao(s.id)}
                      className="w-full flex items-center justify-between gap-3 text-left px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-white text-xs font-semibold leading-snug">{s.label}</span>
                      <span className="shrink-0 text-white/35 text-[10px] uppercase tracking-widest">{s.departamento}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative" ref={painelRef}>
          <button
            onClick={abrirPainel}
            className="relative p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
            title="Notificações"
            aria-label="Notificações"
          >
            <Bell size={18} />
            {quantidadeNaoVista > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#0b1220]">
                {quantidadeNaoVista > 9 ? '9+' : quantidadeNaoVista}
              </span>
            )}
          </button>

          {painelAberto && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/40 z-50">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-white font-black text-xs uppercase tracking-widest">Notificações</p>
              </div>
              {notificacoes.length === 0 ? (
                <p className="px-4 py-6 text-center text-white/40 text-xs">Nenhuma notificação por enquanto.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {notificacoes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => irParaNotificacao(n.destino)}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <p className="text-white text-xs font-semibold leading-snug">{n.titulo}</p>
                      {n.data && (
                        <p className="text-white/35 text-[10px] mt-1">
                          {new Date(n.data).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-right">
          <p className="text-white font-black text-xs uppercase">{empresa?.nome || 'Linave/Servinave'}</p>
          <p className="text-amber-500 font-bold text-[10px] uppercase tracking-widest">
            {userSession?.nome?.split(' ')[0] || 'Usuário'}
          </p>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
          title="Sair"
        >
          <LogOut size={14} /> Sair
        </button>
        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20">
          <UserCircle size={24} />
        </div>
      </div>
    </header>
  );
}
