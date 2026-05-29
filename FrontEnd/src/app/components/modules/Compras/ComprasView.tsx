import React, { useEffect, useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CircleDollarSign,
  Clock3,
  Eraser,
  Link as LinkIcon,
  Package,
  Plus,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
} from 'lucide-react';

type BoardStage = 'SOLICITACOES' | 'APROVACAO' | 'COMPRADOS';
type ApprovalRoute = 'direta' | 'gerente' | null;
type PurchaseState = 'comprado' | 'entregue' | 'estoque';

interface ItemCompra {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  dataDesejada: string;
  prioridade: string;
  qtd: number;
  un: string;
  link: string;
  fornecedor: string;
}

interface RequisicaoCompra {
  id: string;
  solicitante: string;
  departamento: string;
  centroCusto: string;
  itens: ItemCompra[];
  stage: BoardStage;
  approvalRoute: ApprovalRoute;
  purchaseState: PurchaseState;
  budgetValue: number | null;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  solicitante: string;
  departamento: string;
  centroCusto: string;
}


const BOARD_COLUMNS: Array<{ id: BoardStage; title: string; subtitle: string; icon: React.ElementType; accent: string }> = [
  {
    id: 'SOLICITACOES',
    title: 'Solicitações',
    subtitle: 'Orçamento é levantado aqui',
    icon: ClipboardList,
    accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-300',
  },
  {
    id: 'APROVACAO',
    title: 'Aprovações',
    subtitle: 'Direta ou com gerente acima de R$ 500',
    icon: Clock3,
    accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-300',
  },
  {
    id: 'COMPRADOS',
    title: 'Comprados',
    subtitle: 'Comprado, entregue ou em estoque',
    icon: CheckCircle2,
    accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-300',
  },
];

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyItem = (): ItemCompra => ({
  id: createId(),
  nome: '',
  descricao: '',
  categoria: '',
  dataDesejada: '',
  prioridade: 'Normal',
  qtd: 1,
  un: 'un',
  link: '',
  fornecedor: '',
});

const createDefaultRequest = (solicitante = '', departamento = '', centroCusto = ''): FormState => ({
  solicitante,
  departamento,
  centroCusto,
});

const normalizeRequests = (value: unknown): RequisicaoCompra[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item: any) => ({
      id: String(item.id || createId()),
      solicitante: String(item.solicitante || ''),
      departamento: String(item.departamento || ''),
      centroCusto: String(item.centroCusto || ''),
      itens: Array.isArray(item.itens)
        ? item.itens.map((it: any) => ({
            id: String(it.id || createId()),
            nome: String(it.nome || ''),
            descricao: String(it.descricao || ''),
            categoria: String(it.categoria || ''),
            dataDesejada: String(it.dataDesejada || ''),
            prioridade: String(it.prioridade || 'Normal'),
            qtd: Number(it.qtd || 1),
            un: String(it.un || 'un'),
            link: String(it.link || ''),
            fornecedor: String(it.fornecedor || ''),
          }))
        : [],
      stage: item.stage === 'APROVACAO' || item.stage === 'COMPRADOS' ? item.stage : 'SOLICITACOES',
      approvalRoute: item.approvalRoute === 'direta' || item.approvalRoute === 'gerente' ? item.approvalRoute : null,
      purchaseState: item.purchaseState === 'entregue' || item.purchaseState === 'estoque' ? item.purchaseState : 'comprado',
      budgetValue: typeof item.budgetValue === 'number' ? item.budgetValue : null,
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    }))
    .filter((item) => item.itens.length > 0);
};


const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const purchaseStateLabel: Record<PurchaseState, string> = {
  comprado: 'Comprado',
  entregue: 'Entregue',
  estoque: 'Estoque',
};

export function ComprasView({ searchQuery }: { searchQuery: string }) {
  const { obras, listas, userSession, compras, saveEntity } = useErp();
  const [formData, setFormData] = useState<FormState>(() =>
    createDefaultRequest(userSession?.nome || userSession?.email || '', '', '')
  );
  const [itens, setItens] = useState<ItemCompra[]>([createEmptyItem()]);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<RequisicaoCompra[]>(() => (Array.isArray(compras) ? compras : []));

  useEffect(() => {
    void saveEntity?.('compras', requests || []);
  }, [requests, saveEntity]);

  useEffect(() => {
    if (Array.isArray(compras)) setRequests(compras);
  }, [compras]);

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      solicitante: current.solicitante || userSession?.nome || userSession?.email || '',
    }));
  }, [userSession?.email, userSession?.nome]);

  const updateItem = (id: string, field: keyof ItemCompra, value: string | number) => {
    setItens((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleAddItem = () => {
    setItens((current) => [...current, createEmptyItem()]);
  };

  const handleRemoveItem = (id: string) => {
    setItens((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  };

  const handleResetForm = () => {
    if (!window.confirm('Deseja limpar todo o formulário?')) return;

    setFormData(createDefaultRequest(userSession?.nome || userSession?.email || '', '', ''));
    setItens([createEmptyItem()]);
  };

  const handleCreateRequest = () => {
    if (!formData.solicitante || !formData.departamento || !formData.centroCusto) {
      return window.alert('Por favor, preencha todos os campos obrigatórios (*).');
    }

    const itensValidos = itens.filter((item) => item.nome.trim() !== '');
    if (itensValidos.length === 0) {
      return window.alert('Preencha ao menos um item na tabela.');
    }

    const novaRequisicao: RequisicaoCompra = {
      id: createId(),
      solicitante: formData.solicitante,
      departamento: formData.departamento,
      centroCusto: formData.centroCusto,
      itens: itensValidos,
      stage: 'SOLICITACOES',
      approvalRoute: null,
      purchaseState: 'comprado',
      budgetValue: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setRequests((current) => [novaRequisicao, ...current]);
    setBudgetDrafts((current) => ({ ...current, [novaRequisicao.id]: '' }));
    setItens([createEmptyItem()]);
    window.alert('Solicitação enviada para o kanban.');
  };

  const patchRequest = (requestId: string, updater: (request: RequisicaoCompra) => RequisicaoCompra) => {
    setRequests((current) => current.map((request) => (request.id === requestId ? updater(request) : request)));
  };

  const handleSendToApproval = (requestId: string) => {
    const draft = budgetDrafts[requestId];
    const budgetValue = Number(draft);

    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      return window.alert('Informe um orçamento válido antes de enviar para aprovação.');
    }

    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'APROVACAO',
      approvalRoute: budgetValue > 500 ? 'gerente' : 'direta',
      budgetValue,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleApproveRequest = (requestId: string) => {
    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'COMPRADOS',
      purchaseState: request.purchaseState || 'comprado',
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleChangePurchaseState = (requestId: string, purchaseState: PurchaseState) => {
    patchRequest(requestId, (request) => ({
      ...request,
      purchaseState,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleReturnToSolicitations = (requestId: string) => {
    patchRequest(requestId, (request) => ({
      ...request,
      stage: 'SOLICITACOES',
      approvalRoute: null,
      updatedAt: new Date().toISOString(),
    }));
  };

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return requests;

    return requests.filter((request) => {
      const searchableText = [
        request.solicitante,
        request.departamento,
        request.centroCusto,
        request.approvalRoute || '',
        purchaseStateLabel[request.purchaseState],
        ...request.itens.flatMap((item) => [item.nome, item.descricao, item.categoria, item.fornecedor, item.link]),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [requests, searchQuery]);

  const requestsByStage = useMemo(
    () => ({
      SOLICITACOES: filteredRequests.filter((request) => request.stage === 'SOLICITACOES'),
      APROVACAO: filteredRequests.filter((request) => request.stage === 'APROVACAO'),
      COMPRADOS: filteredRequests.filter((request) => request.stage === 'COMPRADOS'),
    }),
    [filteredRequests]
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl shadow-lg shadow-amber-500/20 text-white">
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Requisições de Compra</h1>
            <p className="text-white/50 text-sm mt-1">Fluxo local em kanban para solicitar, aprovar e acompanhar compras.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white/40">
          <Users size={14} />
          <span>Armazenado apenas no navegador</span>
        </div>
      </div>

      <section className="bg-[#101f3d]/50 border border-white/5 rounded-3xl p-8 shadow-xl">
        <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">1. Nova Solicitação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Solicitante <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              placeholder="Seu nome completo"
              value={formData.solicitante}
              onChange={(event) => setFormData({ ...formData, solicitante: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Departamento <span className="text-red-400">*</span></label>
            <div className="relative">
              <select
                className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                value={formData.departamento}
                onChange={(event) => setFormData({ ...formData, departamento: event.target.value })}
              >
                <option value="">Selecione o departamento...</option>
                {listas?.departamentos?.map((dep: string) => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">▼</div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-white/70 ml-1">Centro de Custo (Obra) <span className="text-red-400">*</span></label>
            <div className="relative">
              <select
                className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                value={formData.centroCusto}
                onChange={(event) => setFormData({ ...formData, centroCusto: event.target.value })}
              >
                <option value="">Vincular a um projeto...</option>
                {obras?.map((obra: any) => (
                  <option key={obra.id} value={obra.nome}>{obra.nome}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">▼</div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">2. Itens da Requisição</h3>
          <button onClick={handleAddItem} className="flex items-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-900/20 active:scale-95">
            <Plus size={16} /> Adicionar Linha
          </button>
        </div>

        <div className="bg-[#101f3d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-[#0b1220] text-xs font-bold text-white/40 uppercase tracking-wider text-left border-b border-white/10">
                  <th className="p-4 w-40 pl-6">Item</th>
                  <th className="p-4 w-48">Descrição / Detalhes</th>
                  <th className="p-4 w-32">Fornecedor</th>
                  <th className="p-4 w-32">Categoria</th>
                  <th className="p-4 w-36">Data Limite</th>
                  <th className="p-4 w-28">Prioridade</th>
                  <th className="p-4 w-20 text-center">Qtd</th>
                  <th className="p-4 w-20 text-center">Un</th>
                  <th className="p-4 w-32">Link Ref.</th>
                  <th className="p-4 w-16 text-center pr-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {itens.map((item) => (
                  <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 pl-6">
                      <input className="input-table font-medium text-white" placeholder="Nome" value={item.nome} onChange={(event) => updateItem(item.id, 'nome', event.target.value)} />
                    </td>
                    <td className="p-3">
                      <input className="input-table text-white/70" placeholder="Detalhes" value={item.descricao} onChange={(event) => updateItem(item.id, 'descricao', event.target.value)} />
                    </td>
                    <td className="p-3">
                      <div className="relative">
                        <Truck size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input className="input-table pl-8 text-white/80" placeholder="Fornecedor" value={item.fornecedor} onChange={(event) => updateItem(item.id, 'fornecedor', event.target.value)} />
                      </div>
                    </td>
                    <td className="p-3">
                      <select className="input-table cursor-pointer appearance-none text-amber-400" value={item.categoria} onChange={(event) => updateItem(item.id, 'categoria', event.target.value)}>
                        <option value="">Selecione...</option>
                        {listas?.categorias?.map((cat: string) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <input type="date" className="input-table cursor-pointer text-white/80" value={item.dataDesejada} onChange={(event) => updateItem(item.id, 'dataDesejada', event.target.value)} />
                    </td>
                    <td className="p-3">
                      <select
                        className={`input-table cursor-pointer appearance-none font-bold ${
                          item.prioridade === 'Urgente' ? 'text-red-400'
                            : item.prioridade === 'Alta' ? 'text-orange-400'
                            : 'text-amber-400'
                        }`}
                        value={item.prioridade}
                        onChange={(event) => updateItem(item.id, 'prioridade', event.target.value)}
                      >
                        {listas?.prioridades?.map((prio: string) => (
                          <option key={prio} value={prio} className="text-white">{prio}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-center">
                      <input type="number" className="input-table text-center font-bold bg-white/5 rounded-lg" min="1" value={item.qtd} onChange={(event) => updateItem(item.id, 'qtd', Number(event.target.value))} />
                    </td>
                    <td className="p-3 text-center">
                      <input className="input-table text-center uppercase text-xs" placeholder="UN" value={item.un} onChange={(event) => updateItem(item.id, 'un', event.target.value)} />
                    </td>
                    <td className="p-3">
                      <div className="relative group/link">
                        <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/link:text-blue-400" />
                        <input className="input-table pl-8 text-blue-400 hover:underline cursor-pointer" placeholder="Link..." value={item.link} onChange={(event) => updateItem(item.id, 'link', event.target.value)} />
                      </div>
                    </td>
                    <td className="p-3 text-center pr-6">
                      <button onClick={() => handleRemoveItem(item.id)} className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Remover item">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <button onClick={handleCreateRequest} className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center gap-3 transition-all shadow-lg shadow-amber-900/30 hover:-translate-y-1">
            <Send size={18} /> Criar Solicitação
          </button>
          <button onClick={handleResetForm} className="bg-transparent text-white/40 hover:text-white px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center gap-3 hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
            <Eraser size={18} /> Limpar Formulário
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
          <div>
            <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">3. Kanban de Compras</h3>
            <p className="text-white/35 text-xs mt-2 max-w-2xl">Cada cartão fica salvo no navegador. As solicitações entram na primeira coluna, passam por aprovação e vão para o estado final de compra.</p>
          </div>
          <div className="text-xs text-white/35 uppercase tracking-widest flex items-center gap-2">
            <CircleDollarSign size={14} />
            Aprovação acima de R$ 500 vai para gerente
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          {BOARD_COLUMNS.map((column) => {
            const ColumnIcon = column.icon;
            const cards = requestsByStage[column.id];

            return (
              <div key={column.id} className={`rounded-3xl border bg-gradient-to-b ${column.accent} p-4 min-h-[360px]`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-white">
                      <ColumnIcon size={18} />
                    </div>
                    <div>
                      <h4 className="text-white font-black uppercase text-sm tracking-wider">{column.title}</h4>
                      <p className="text-white/45 text-[11px] mt-1">{column.subtitle}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-white text-[11px] font-bold">
                    {cards.length}
                  </div>
                </div>

                <div className="space-y-3 max-h-[860px] overflow-y-auto pr-1">
                  {cards.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-white/35 text-sm">
                      Nenhuma requisição nesta coluna.
                    </div>
                  ) : cards.map((request) => {
                    const budgetDraft = budgetDrafts[request.id] ?? (request.budgetValue ? String(request.budgetValue) : '');

                    return (
                      <article key={request.id} className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-4 shadow-lg shadow-black/10 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-white font-bold text-sm leading-tight">{request.centroCusto}</h5>
                            <p className="text-white/45 text-[11px] mt-1">{request.solicitante} • {request.departamento}</p>
                          </div>
                          <button
                            className="text-white/20 hover:text-white/60 transition-colors"
                            title="Voltar para solicitações"
                            onClick={() => handleReturnToSolicitations(request.id)}
                          >
                            <ArrowRight size={14} className="rotate-180" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/45">{request.itens.length} item(ns)</span>
                          <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/45">{new Date(request.createdAt).toLocaleDateString('pt-BR')}</span>
                          {request.stage === 'APROVACAO' && (
                            <span className={`px-2 py-1 rounded-full border ${request.approvalRoute === 'gerente' ? 'bg-orange-500/10 border-orange-500/20 text-orange-200' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'}`}>
                              {request.approvalRoute === 'gerente' ? 'Gerente' : 'Direta'}
                            </span>
                          )}
                          {request.stage === 'COMPRADOS' && (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">{purchaseStateLabel[request.purchaseState]}</span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {request.itens.map((item) => (
                            <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-white text-sm font-semibold">{item.nome}</p>
                                  <p className="text-white/40 text-[11px] mt-1">{item.descricao || 'Sem descrição'}</p>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest text-amber-300/80 font-bold">{item.qtd} {item.un}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[10px] text-white/35">
                                {item.categoria && <span className="px-2 py-1 rounded-full bg-white/5">{item.categoria}</span>}
                                {item.fornecedor && <span className="px-2 py-1 rounded-full bg-white/5">{item.fornecedor}</span>}
                                {item.dataDesejada && <span className="px-2 py-1 rounded-full bg-white/5">{item.dataDesejada}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {request.stage === 'SOLICITACOES' && (
                          <div className="space-y-2 pt-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Orçamento do pedido</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full bg-[#101826] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-amber-500"
                              value={budgetDraft}
                              onChange={(event) => setBudgetDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                              placeholder="Informe o valor total"
                            />
                            <button
                              onClick={() => handleSendToApproval(request.id)}
                              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                            >
                              <Send size={14} /> Enviar para aprovação
                            </button>
                          </div>
                        )}

                        {request.stage === 'APROVACAO' && (
                          <div className="space-y-2 pt-1">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-sm">
                              <span className="text-white/45 uppercase tracking-widest text-[10px] font-bold">Orçamento</span>
                              <strong className="text-white">{formatCurrency(request.budgetValue || 0)}</strong>
                            </div>
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                            >
                              <CheckCircle2 size={14} /> {request.approvalRoute === 'gerente' ? 'Aprovar no gerente' : 'Aprovar direto'}
                            </button>
                          </div>
                        )}

                        {request.stage === 'COMPRADOS' && (
                          <div className="space-y-2 pt-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Estado do item</label>
                            <select
                              className="w-full bg-[#101826] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 cursor-pointer"
                              value={request.purchaseState}
                              onChange={(event) => handleChangePurchaseState(request.id, event.target.value as PurchaseState)}
                            >
                              <option value="comprado">Comprado</option>
                              <option value="entregue">Entregue</option>
                              <option value="estoque">Estoque</option>
                            </select>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-widest text-white/45 font-bold">
                              <span>Pronto para acompanhamento</span>
                              <Package size={14} />
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <style>{`
        .input-table {
          @apply w-full bg-transparent border border-transparent p-2 rounded-lg text-sm outline-none focus:bg-[#0b1220] focus:border-amber-500/50 transition-all placeholder:text-white/10 focus:shadow-lg;
        }
      `}</style>
    </div>
  );
}
