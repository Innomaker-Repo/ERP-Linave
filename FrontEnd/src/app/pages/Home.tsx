import React, { useMemo } from 'react';
import { useErp } from '../context/ErpContext';
import { DEPARTMENTS, hasAccess } from '../navigation';
import { ShoppingCart, FilePlus, ArrowRight, Compass, ListChecks } from 'lucide-react';
import { normalizeRequests, stageLabel, matchesSolicitante as matchesSolicitanteCompra } from '../components/modules/Compras/comprasLocal';
import { matchesSolicitante as matchesSolicitanteFin, money, br } from '../components/modules/Financeiro/finData';

/* =========================================================================================
 * HOME — primeira tela após o login, para TODOS os usuários.
 * Mostra no centro: as duas ações liberadas a todo colaborador (solicitar compra e
 * solicitar pagamento) em destaque, e a grade de tudo que o usuário tem acesso
 * (mesma fonte de verdade da Sidebar: navigation.tsx).
 * =======================================================================================*/

interface HomePageProps {
  onNavigate: (section: string) => void;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  USUARIO: 'Colaborador',
};

function saudacaoPorHora(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

type Tone = 'ok' | 'wait' | 'bad' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  wait: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  bad: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  info: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
};

const toneDaSolicitacaoPagamento = (status: string): Tone =>
  status === 'Aprovado' ? 'ok' : status === 'Reprovado' ? 'bad' : 'wait';

const toneDoPedidoCompra = (stage: string): Tone =>
  stage === 'COMPRADOS' ? 'ok' : stage === 'APROVACAO' ? 'info' : 'wait';

interface MinhaSolicitacaoResumo {
  id: string;
  modulo: 'Compra' | 'Pagamento';
  titulo: string;
  subtitulo: string;
  status: string;
  tone: Tone;
  data: string;
  destino: string;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { userSession, financeiro, compras } = useErp() as any;

  const primeiroNome = String(userSession?.nome || 'Usuário').trim().split(' ')[0];
  const role = String(userSession?.role || '').toUpperCase();
  const roleLabel = ROLE_LABEL[role] || 'Colaborador';

  const dataLonga = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  );

  // Departamentos com os itens que ESTE usuário pode ver (regra idêntica à da Sidebar).
  const acessos = useMemo(
    () =>
      DEPARTMENTS
        .map((dept) => ({ ...dept, items: dept.items.filter((item) => hasAccess(userSession, item.id)) }))
        .filter((dept) => dept.items.length > 0),
    [userSession],
  );

  // "Minhas Solicitações": Compras (pedidos ainda no funil) + Solicitação de Pagamento do
  // Financeiro, do usuário logado — juntas numa lista só, mais recentes primeiro.
  const minhasSolicitacoes = useMemo<MinhaSolicitacaoResumo[]>(() => {
    const pedidosCompra: MinhaSolicitacaoResumo[] = normalizeRequests(compras)
      .filter((r) => matchesSolicitanteCompra(r, userSession))
      .map((r) => {
        const primeiroItem = r.itens?.[0];
        const titulo = primeiroItem ? (primeiroItem.descricao || primeiroItem.nome || 'Item sem nome') : 'Requisição de compra';
        const extras = (r.itens?.length || 0) > 1 ? ` +${r.itens.length - 1} item(ns)` : '';
        return {
          id: `compra-${r.id}`,
          modulo: 'Compra' as const,
          titulo: `${titulo}${extras}`,
          subtitulo: r.centroCusto ? `OS: ${r.centroCusto}` : (r.departamento || ''),
          status: stageLabel[r.stage] || r.stage,
          tone: toneDoPedidoCompra(r.stage),
          data: r.createdAt || r.updatedAt || '',
          destino: 'minhasCompras',
        };
      });

    const solicitacoesPagamento: MinhaSolicitacaoResumo[] = (Array.isArray(financeiro) ? financeiro : [])
      .filter((r: any) => r?.tipo === 'solicitacao' && matchesSolicitanteFin(r, userSession))
      .map((r: any) => {
        const status = r.status || 'Aguardando aprovação';
        return {
          id: `pagamento-${r.id}`,
          modulo: 'Pagamento' as const,
          titulo: r.fornecedor || 'Solicitação de pagamento',
          subtitulo: r.valor ? money(Number(r.valor) || 0) : '',
          status,
          tone: toneDaSolicitacaoPagamento(status),
          data: r.createdAt || '',
          destino: 'finSolicitacao',
        };
      });

    return [...pedidosCompra, ...solicitacoesPagamento]
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .slice(0, 6);
  }, [compras, financeiro, userSession]);

  const irPara = (section: string) => {
    window.dispatchEvent(new CustomEvent('fecharOrcamentoSolicitado'));
    onNavigate(section);
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Brilhos decorativos de fundo */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 w-[28rem] h-[28rem] bg-amber-500/10 rounded-full blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/2 -left-48 w-[28rem] h-[28rem] bg-sky-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto py-8 px-2 space-y-10">

        {/* SAUDAÇÃO */}
        <header className="text-center space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.25em]">{dataLonga}</p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            {saudacaoPorHora()}, <span className="text-amber-500">{primeiroNome}</span>
          </h1>
          <div className="flex items-center justify-center gap-3">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
              {roleLabel}
            </span>
            <span className="text-white/40 text-sm">O que você precisa fazer hoje?</span>
          </div>
        </header>

        {/* AÇÕES RÁPIDAS — liberadas a todos os colaboradores */}
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => irPara('compras')}
              className="group relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-6 text-left transition-all duration-300 hover:border-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="p-4 rounded-2xl bg-amber-500 text-[#0b1220] shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                  <ShoppingCart size={26} />
                </div>
                <ArrowRight size={20} className="text-amber-500/40 group-hover:text-amber-400 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <h3 className="text-white font-black text-xl mt-5">Solicitar Compra</h3>
              <p className="text-white/50 text-sm mt-1 leading-relaxed">
                Peça materiais ou serviços. Sua requisição entra direto no fluxo de cotação e aprovação de Compras.
              </p>
              <span className="inline-block mt-4 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-[9px] font-black uppercase tracking-widest">
                Aberto a todos
              </span>
            </button>

            <button
              onClick={() => irPara('finSolicitacao')}
              className="group relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/15 via-sky-500/5 to-transparent p-6 text-left transition-all duration-300 hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/10 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="p-4 rounded-2xl bg-sky-500 text-[#0b1220] shadow-lg shadow-sky-500/30 group-hover:scale-110 transition-transform duration-300">
                  <FilePlus size={26} />
                </div>
                <ArrowRight size={20} className="text-sky-500/40 group-hover:text-sky-400 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <h3 className="text-white font-black text-xl mt-5">Solicitar Pagamento</h3>
              <p className="text-white/50 text-sm mt-1 leading-relaxed">
                Reembolso ou adiantamento com anexos. Após aprovada, a solicitação vira Conta a Pagar no Financeiro.
              </p>
              <span className="inline-block mt-4 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-[9px] font-black uppercase tracking-widest">
                Aberto a todos
              </span>
            </button>
          </div>
        </section>

        {/* MINHAS SOLICITAÇÕES — Compras + Solicitação de Pagamento do usuário logado */}
        {minhasSolicitacoes.length > 0 && (
          <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-600">
            <div className="flex items-center gap-2">
              <ListChecks size={14} className="text-amber-500" />
              <h2 className="text-amber-400 text-xs font-black uppercase tracking-[0.2em]">Minhas solicitações</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#101f3d]/60 divide-y divide-white/5 overflow-hidden">
              {minhasSolicitacoes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => irPara(item.destino)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className={`shrink-0 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${item.modulo === 'Compra' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-sky-500/30 bg-sky-500/10 text-sky-300'}`}>
                      {item.modulo}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-bold truncate">{item.titulo}</p>
                      {item.subtitulo && <p className="text-white/40 text-xs truncate">{item.subtitulo}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="text-white/30 text-[10px] hidden sm:inline">{item.data ? br(item.data.slice(0, 10)) : ''}</span>
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${TONE_CLASS[item.tone]}`}>
                      {item.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* SEUS ACESSOS — tudo que o usuário pode abrir, agrupado por departamento */}
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-700">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-amber-500" />
            <h2 className="text-amber-400 text-xs font-black uppercase tracking-[0.2em]">Seus acessos</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {acessos.map((dept) => {
              const DeptIcon = dept.icon;
              return (
                <div
                  key={dept.id}
                  className="rounded-3xl border border-white/5 bg-[#101f3d]/60 p-5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-amber-500">
                        <DeptIcon size={16} />
                      </div>
                      <h3 className="text-white font-black text-sm uppercase tracking-wide">{dept.title}</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold">
                      {dept.items.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {dept.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => irPara(item.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-white/60 text-xs font-medium transition-all hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 hover:scale-[1.03]"
                        >
                          <ItemIcon size={13} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-center text-white/25 text-xs pb-4">
          Você também pode navegar a qualquer momento pelo menu lateral.
        </p>
      </div>
    </div>
  );
}
