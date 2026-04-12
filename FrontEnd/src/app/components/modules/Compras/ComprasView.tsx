import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { ShoppingCart, Plus, Trash2, Upload, Send, Eraser, Link as LinkIcon, Download, Truck } from 'lucide-react';

interface ItemCompra {
  id: number;
  nome: string;
  descricao: string;
  categoria: string;
  dataDesejada: string;
  prioridade: string;
  qtd: number;
  un: string;
  precoPrevisto: number;
  fretePrevisto: number;
  link: string;
  fornecedor: string;
}

export function ComprasView({ searchQuery }: { searchQuery: string }) {
  // Agora importamos 'listas' do contexto
  const { obras, saveEntity, userSession, listas } = useErp();
  
  const [formData, setFormData] = useState({
    solicitante: userSession?.email || '',
    email: userSession?.email || '',
    departamento: '',
    centroCusto: ''
  });

  const [itens, setItens] = useState<ItemCompra[]>([
    { id: Date.now(), nome: '', descricao: '', categoria: '', dataDesejada: '', prioridade: 'Normal', qtd: 1, un: 'un', precoPrevisto: 0, fretePrevisto: 0, link: '', fornecedor: '' }
  ]);

  const handleAddItem = () => {
    setItens([...itens, { id: Date.now(), nome: '', descricao: '', categoria: '', dataDesejada: '', prioridade: 'Normal', qtd: 1, un: 'un', precoPrevisto: 0, fretePrevisto: 0, link: '', fornecedor: '' }]);
  };

  const handleRemoveItem = (id: number) => {
    if (itens.length > 1) {
      setItens(itens.filter(i => i.id !== id));
    }
  };

  const updateItem = (id: number, field: keyof ItemCompra, value: any) => {
    setItens(itens.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleReset = () => {
    if (confirm("Deseja limpar todo o formulário?")) {
      setFormData({
        solicitante: userSession?.email || '',
        email: userSession?.email || '',
        departamento: '',
        centroCusto: ''
      });
      setItens([{ id: Date.now(), nome: '', descricao: '', categoria: '', dataDesejada: '', prioridade: 'Normal', qtd: 1, un: 'un', precoPrevisto: 0, fretePrevisto: 0, link: '', fornecedor: '' }]);
    }
  };

  const handleSubmit = () => {
    if (!formData.solicitante || !formData.email || !formData.departamento || !formData.centroCusto) {
      return alert("Por favor, preencha todos os campos obrigatórios (*).");
    }

    const itensValidos = itens.filter(i => i.nome.trim() !== '');
    if (itensValidos.length === 0) {
      return alert("Preencha ao menos um item na tabela.");
    }
    
    const novaSolicitacao = {
      ...formData,
      itens: itensValidos,
      status: 'Aguardando Aprovação',
      dataSolicitacao: new Date().toISOString(),
      totalEstimado: itensValidos.reduce((acc, item) => acc + (item.qtd * item.precoPrevisto) + item.fretePrevisto, 0)
    };

    saveEntity('compras', novaSolicitacao);
    alert("Solicitação enviada com sucesso!");
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl shadow-lg shadow-amber-500/20 text-white">
            <ShoppingCart size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Nova Requisição</h1>
            <p className="text-white/50 text-sm mt-1">Preencha os dados abaixo para iniciar o processo de compra.</p>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO PRINCIPAL */}
      <section className="bg-[#101f3d]/50 border border-white/5 rounded-3xl p-8 shadow-xl">
        <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">1. Detalhes da Solicitação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Solicitante <span className="text-red-400">*</span></label>
            <input 
              className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all" 
              placeholder="Seu nome completo" 
              value={formData.solicitante}
              onChange={e => setFormData({...formData, solicitante: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Departamento <span className="text-red-400">*</span></label>
            <div className="relative">
              <select 
                className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                value={formData.departamento}
                onChange={e => setFormData({...formData, departamento: e.target.value})}
              >
                <option value="">Selecione o departamento...</option>
                {/* MENU DINÂMICO DE DEPARTAMENTOS */}
                {listas?.departamentos?.map((dep: string) => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">▼</div>
            </div>
          </div>

          {/* ... (restante do form igual) ... */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Email <span className="text-red-400">*</span></label>
            <input 
              className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all" 
              type="email"
              placeholder="seu.email@empresa.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 ml-1">Centro de Custo (Obra) <span className="text-red-400">*</span></label>
            <div className="relative">
              <select 
                className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                value={formData.centroCusto}
                onChange={e => setFormData({...formData, centroCusto: e.target.value})}
              >
                <option value="">Vincular a um projeto...</option>
                {obras?.map((obra: any) => (
                  <option key={obra.id} value={obra.nome}>{obra.nome}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">▼</div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2 pt-2">
            <label className="text-sm font-medium text-white/70 ml-1">Importar Planilha (Opcional)</label>
            <div className="flex items-center gap-4 bg-[#0b1220] p-3 rounded-xl border border-white/10 border-dashed">
              <label className="cursor-pointer bg-white/5 hover:bg-amber-500 hover:text-[#0b1220] text-amber-500 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-wider">
                <Upload size={16}/>
                <span>Carregar CSV</span>
                <input type="file" className="hidden" accept=".csv" onChange={(e) => alert("Importação de CSV em breve.")} />
              </label>
              <span className="text-xs text-white/30">ou</span>
              <a 
                href="https://docs.google.com/spreadsheets/d/1cTnNkF_dKfpiih_Rub5H5XbgpuF7cKN4CdmHfiJKVAw/export?format=csv" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/50 underline flex items-center gap-1 hover:text-white transition-colors"
              >
                <Download size={14} /> Baixar modelo padrão
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* LISTA DE ITENS */}
      <section className="space-y-4">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest">2. Itens da Requisição</h3>
          <button onClick={handleAddItem} className="flex items-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-900/20 active:scale-95">
            <Plus size={16} /> Adicionar Linha
          </button>
        </div>
        
        <div className="bg-[#101f3d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px]">
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
                  <th className="p-4 w-28 text-right">R$ Unit.</th>
                  <th className="p-4 w-28 text-right">Frete</th>
                  <th className="p-4 w-32">Link Ref.</th>
                  <th className="p-4 w-16 text-center pr-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {itens.map((item, index) => (
                  <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 pl-6">
                      <input className="input-table font-medium text-white" placeholder="Nome" value={item.nome} onChange={e => updateItem(item.id, 'nome', e.target.value)} />
                    </td>
                    <td className="p-3">
                      <input className="input-table text-white/70" placeholder="Detalhes" value={item.descricao} onChange={e => updateItem(item.id, 'descricao', e.target.value)} />
                    </td>
                    <td className="p-3">
                      <div className="relative">
                        <Truck size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input className="input-table pl-8 text-white/80" placeholder="Fornecedor" value={item.fornecedor} onChange={e => updateItem(item.id, 'fornecedor', e.target.value)} />
                      </div>
                    </td>
                    <td className="p-3">
                      <select className="input-table cursor-pointer appearance-none text-amber-400" value={item.categoria} onChange={e => updateItem(item.id, 'categoria', e.target.value)}>
                        <option value="">Selecione...</option>
                        {/* MENU DINÂMICO DE CATEGORIAS */}
                        {listas?.categorias?.map((cat: string) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <input type="date" className="input-table cursor-pointer text-white/80" value={item.dataDesejada} onChange={e => updateItem(item.id, 'dataDesejada', e.target.value)} />
                    </td>
                    <td className="p-3">
                      <select 
                        className={`input-table cursor-pointer appearance-none font-bold ${
                          item.prioridade === 'Urgente' ? 'text-red-400' : 
                          item.prioridade === 'Alta' ? 'text-orange-400' : 'text-amber-400'
                        }`} 
                        value={item.prioridade} 
                        onChange={e => updateItem(item.id, 'prioridade', e.target.value)}
                      >
                        {/* MENU DINÂMICO DE PRIORIDADES */}
                        {listas?.prioridades?.map((prio: string) => (
                          <option key={prio} value={prio} className="text-white">{prio}</option>
                        ))}
                      </select>
                    </td>
                    {/* ... (restante dos campos de qtd, valor, etc. mantidos igual) ... */}
                    <td className="p-3 text-center">
                      <input type="number" className="input-table text-center font-bold bg-white/5 rounded-lg" min="1" value={item.qtd} onChange={e => updateItem(item.id, 'qtd', Number(e.target.value))} />
                    </td>
                    <td className="p-3 text-center">
                      <input className="input-table text-center uppercase text-xs" placeholder="UN" value={item.un} onChange={e => updateItem(item.id, 'un', e.target.value)} />
                    </td>
                    <td className="p-3 text-right">
                      <input type="number" className="input-table text-right font-mono text-amber-400" placeholder="0.00" min="0" step="0.01" value={item.precoPrevisto || ''} onChange={e => updateItem(item.id, 'precoPrevisto', Number(e.target.value))} />
                    </td>
                    <td className="p-3 text-right">
                      <input type="number" className="input-table text-right font-mono text-white/60" placeholder="0.00" min="0" step="0.01" value={item.fretePrevisto || ''} onChange={e => updateItem(item.id, 'fretePrevisto', Number(e.target.value))} />
                    </td>
                    <td className="p-3">
                      <div className="relative group/link">
                        <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/link:text-blue-400" />
                        <input className="input-table pl-8 text-blue-400 hover:underline cursor-pointer" placeholder="Link..." value={item.link} onChange={e => updateItem(item.id, 'link', e.target.value)} />
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
              <tfoot className="bg-[#0b1220]/50 border-t border-white/10">
                <tr>
                  <td colSpan={8} className="p-4 text-right text-[10px] uppercase font-bold text-white/50 tracking-widest">Total Estimado do Pedido:</td>
                  <td colSpan={2} className="p-4 text-right font-black text-amber-400 text-lg pr-8">
                    {itens.reduce((acc, item) => acc + (item.qtd * item.precoPrevisto) + item.fretePrevisto, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* FOOTER ACTIONS */}
      <div className="flex gap-4 pt-6">
        <button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center gap-3 transition-all shadow-lg shadow-amber-900/30 hover:-translate-y-1">
          <Send size={18} /> Enviar para Aprovação
        </button>
        <button onClick={handleReset} className="bg-transparent text-white/40 hover:text-white px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center gap-3 hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
          <Eraser size={18} /> Limpar
        </button>
      </div>

      <style>{`
        .input-table { 
          @apply w-full bg-transparent border border-transparent p-2 rounded-lg text-sm outline-none focus:bg-[#0b1220] focus:border-amber-500/50 transition-all placeholder:text-white/10 focus:shadow-lg; 
        }
      `}</style>
    </div>
  );
}
