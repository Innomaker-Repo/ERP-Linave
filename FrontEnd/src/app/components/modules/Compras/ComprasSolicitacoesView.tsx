import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Eraser, Plus, Send, ShoppingCart, Trash2 } from 'lucide-react';
import { createDefaultRequest, createEmptyItem, createId, type ItemCompra } from './comprasLocal';

export function ComprasSolicitacoesView({ searchQuery: _searchQuery }: { searchQuery: string }) {
  const { obras, userSession } = useErp();
  const [formData, setFormData] = useState(() =>
    createDefaultRequest(userSession?.nome || userSession?.email || '', '', '')
  );
  const [itens, setItens] = useState<ItemCompra[]>([createEmptyItem()]);
  const { compras, saveEntity } = useErp();

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
    if (!formData.solicitante || !formData.centroCusto) {
      return window.alert('Por favor, preencha todos os campos obrigatórios (*).');
    }

    const itensValidos = itens
      .filter((item) => item.descricao.trim() !== '')
      .map((item) => ({
        ...item,
        nome: item.descricao.trim(),
      }));
    if (itensValidos.length === 0) {
      return window.alert('Preencha ao menos uma descrição na tabela.');
    }

    const novaRequisicao = {
      id: createId(),
      solicitante: formData.solicitante,
      departamento: '',
      centroCusto: formData.centroCusto,
      itens: itensValidos,
      stage: 'SOLICITACOES' as const,
      approvalRoute: null,
      purchaseState: 'comprado' as const,
      budgetValue: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // persist into workspace-wide compras list
    const existing = Array.isArray(compras) ? compras : [];
    void saveEntity?.('compras', [novaRequisicao, ...existing]);
    setItens([createEmptyItem()]);
    window.alert('Solicitação criada e disponível para o kanban de compras.');
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl shadow-lg shadow-amber-500/20 text-white">
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Requisições de Compra</h1>
            <p className="text-white/50 text-sm mt-1">Qualquer colaborador pode criar solicitações. O fluxo interno fica na página do kanban.</p>
          </div>
        </div>
      </div>

      <section className="bg-[#101f3d]/50 border border-white/5 rounded-3xl p-8 shadow-xl">
        <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">1. Nova Solicitação</h3>
        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Solicitante <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              placeholder="Seu nome completo"
              value={formData.solicitante}
              onChange={(event) => setFormData({ ...formData, solicitante: event.target.value })}
            />
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
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-[#0b1220] text-xs font-bold text-white/40 uppercase tracking-wider text-left border-b border-white/10">
                  <th className="p-4 w-24 pl-6">Item</th>
                  <th className="p-4 w-48">Descrição / Detalhes</th>
                  <th className="p-4 w-20 text-center">Qtd</th>
                  <th className="p-4 w-20 text-center">Un</th>
                  <th className="p-4 w-16 text-center pr-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {itens.map((item, index) => (
                  <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 pl-6">
                      <div className="input-table flex items-center justify-center font-black text-amber-400 bg-white/5">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                    </td>
                    <td className="p-3">
                      <input className="input-table text-white/70" placeholder="Descrição do item" value={item.descricao} onChange={(event) => updateItem(item.id, 'descricao', event.target.value)} />
                    </td>
                    <td className="p-3 text-center">
                      <input type="number" className="input-table text-center font-bold bg-white/5 rounded-lg" min="1" value={item.qtd} onChange={(event) => updateItem(item.id, 'qtd', Number(event.target.value))} />
                    </td>
                    <td className="p-3 text-center">
                      <input className="input-table text-center uppercase text-xs" placeholder="UN" value={item.un} onChange={(event) => updateItem(item.id, 'un', event.target.value)} />
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

      <style>{`
        .input-table {
          @apply w-full bg-transparent border border-transparent p-2 rounded-lg text-sm outline-none focus:bg-[#0b1220] focus:border-amber-500/50 transition-all placeholder:text-white/10 focus:shadow-lg;
        }
      `}</style>
    </div>
  );
}
