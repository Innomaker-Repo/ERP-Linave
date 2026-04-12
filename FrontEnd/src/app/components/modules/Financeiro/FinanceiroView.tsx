import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  User, Factory, Briefcase, Tag, Plus, Save, Trash2, 
  CheckCircle2, AlertCircle, Filter
} from 'lucide-react';

export function FinanceiroView() {
  const { financeiro, saveEntity, clientes, fornecedores, obras, listas } = useErp();
  
  const [activeTab, setActiveTab] = useState<'receitas' | 'despesas'>('receitas');
  const [showForm, setShowForm] = useState(false);
  
  // Estado inicial genérico para o formulário
  const initialForm = {
    tipo: 'receita', // ou 'despesa'
    descricao: '',
    valor: '',
    entidadeId: '', // Cliente ID ou Fornecedor ID
    obraId: '',     // Centro de Custo
    categoria: '',
    dataPrevista: '',
    dataRealizada: '',
    status: 'Pendente'
  };

  const [formData, setFormData] = useState(initialForm);

  // Manipulação de Dados
  const handleSave = () => {
    if (!formData.descricao || !formData.valor) return alert("Descrição e Valor são obrigatórios.");
    
    const novoLancamento = {
      ...formData,
      tipo: activeTab === 'receitas' ? 'receita' : 'despesa', // Garante o tipo da aba atual
      id: `FIN-${Date.now()}`,
      valor: Number(formData.valor)
    };

    const novaLista = [...(financeiro || []), novoLancamento];
    saveEntity('financeiro', novaLista);
    setShowForm(false);
    setFormData(initialForm);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      const novaLista = financeiro.filter((item: any) => item.id !== id);
      saveEntity('financeiro', novaLista);
    }
  };

  // Cálculos de Totais
  const listaAtual = (financeiro || []).filter((item: any) => 
    activeTab === 'receitas' ? item.tipo === 'receita' : item.tipo === 'despesa'
  );

  const totalReceitas = (financeiro || []).filter((i: any) => i.tipo === 'receita').reduce((acc: number, cur: any) => acc + Number(cur.valor), 0);
  const totalDespesas = (financeiro || []).filter((i: any) => i.tipo === 'despesa').reduce((acc: number, cur: any) => acc + Number(cur.valor), 0);
  const saldo = totalReceitas - totalDespesas;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER E RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#101f3d] p-6 rounded-3xl border border-amber-500/20 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Entradas</span>
             <TrendingUp className="text-amber-500" size={20} />
          </div>
          <p className="text-3xl font-black text-white mt-2">R$ {totalReceitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-[#101f3d] p-6 rounded-3xl border border-red-500/20 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Saídas</span>
             <TrendingDown className="text-red-500" size={20} />
          </div>
          <p className="text-3xl font-black text-white mt-2">R$ {totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Saldo Líquido</span>
             <DollarSign className={saldo >= 0 ? "text-amber-500" : "text-red-500"} size={20} />
          </div>
          <p className={`text-3xl font-black mt-2 ${saldo >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
            R$ {saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
          </p>
        </div>
      </div>

      {/* CONTROLES E ABAS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/5 pb-6">
        <div className="flex gap-2 p-1 bg-[#101f3d] rounded-2xl border border-white/5">
          <button 
            onClick={() => { setActiveTab('receitas'); setShowForm(false); }}
            className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'receitas' ? 'bg-amber-500 text-[#0b1220]' : 'text-white/40 hover:text-white'}`}
          >
            Receitas
          </button>
          <button 
            onClick={() => { setActiveTab('despesas'); setShowForm(false); }}
            className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'despesas' ? 'bg-red-500 text-white' : 'text-white/40 hover:text-white'}`}
          >
            Custos / Despesas
          </button>
        </div>

        <button 
          onClick={() => { setFormData(initialForm); setShowForm(true); }}
          className={`px-6 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all shadow-lg hover:scale-105 ${activeTab === 'receitas' ? 'bg-amber-500 text-[#0b1220] shadow-amber-500/20' : 'bg-red-500 text-white shadow-red-500/20'}`}
        >
          <Plus size={16} /> Nova {activeTab === 'receitas' ? 'Receita' : 'Despesa'}
        </button>
      </div>

      {/* FORMULÁRIO DE CADASTRO */}
      {showForm && (
        <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden animate-in slide-in-from-top-4">
          <div className={`absolute top-0 left-0 w-full h-1 ${activeTab === 'receitas' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            {activeTab === 'receitas' ? <TrendingUp className="text-emerald-500"/> : <TrendingDown className="text-red-500"/>}
            Cadastrar {activeTab === 'receitas' ? 'Entrada' : 'Saída'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-2">
              <label className="label-erp">Descrição *</label>
              <input 
                className="input-erp" 
                placeholder={activeTab === 'receitas' ? "Ex: Pagamento Projeto USV" : "Ex: Compra de Material"} 
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="label-erp">Valor (R$) *</label>
              <input 
                type="number" 
                className="input-erp font-mono" 
                placeholder="0.00" 
                value={formData.valor}
                onChange={e => setFormData({...formData, valor: e.target.value})}
              />
            </div>

            {/* CAMPOS DINÂMICOS BASEADOS NA ABA */}
            {activeTab === 'receitas' ? (
              <div className="space-y-2">
                <label className="label-erp">Cliente Vinculado</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"/>
                  <select 
                    className="input-erp pl-12 appearance-none cursor-pointer"
                    value={formData.entidadeId}
                    onChange={e => setFormData({...formData, entidadeId: e.target.value})}
                  >
                    <option value="">Selecione o Cliente...</option>
                    {clientes?.map((c: any) => <option key={c.id} value={c.razaoSocial}>{c.razaoSocial}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="label-erp">Fornecedor</label>
                <div className="relative">
                  <Factory size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"/>
                  <select 
                    className="input-erp pl-12 appearance-none cursor-pointer"
                    value={formData.entidadeId}
                    onChange={e => setFormData({...formData, entidadeId: e.target.value})}
                  >
                    <option value="">Selecione o Fornecedor...</option>
                    {fornecedores?.map((f: any) => <option key={f.id} value={f.razaoSocial}>{f.razaoSocial}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="label-erp">Centro de Custo (Obra)</label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"/>
                <select 
                  className="input-erp pl-12 appearance-none cursor-pointer"
                  value={formData.obraId}
                  onChange={e => setFormData({...formData, obraId: e.target.value})}
                >
                  <option value="">Vincular a Projeto...</option>
                  {obras?.map((o: any) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                </select>
              </div>
            </div>

            {activeTab === 'despesas' && (
              <div className="space-y-2">
                <label className="label-erp">Categoria</label>
                <div className="relative">
                  <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"/>
                  <select 
                    className="input-erp pl-12 appearance-none cursor-pointer"
                    value={formData.categoria}
                    onChange={e => setFormData({...formData, categoria: e.target.value})}
                  >
                    <option value="">Classificar...</option>
                    {listas?.categorias?.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="label-erp">{activeTab === 'receitas' ? 'Previsão Recebimento' : 'Vencimento'}</label>
              <input type="date" className="input-erp cursor-pointer" value={formData.dataPrevista} onChange={e => setFormData({...formData, dataPrevista: e.target.value})} />
            </div>

            <div className="space-y-2">
              <label className="label-erp">{activeTab === 'receitas' ? 'Data Recebido' : 'Data Pagamento'}</label>
              <input type="date" className="input-erp cursor-pointer" value={formData.dataRealizada} onChange={e => setFormData({...formData, dataRealizada: e.target.value})} />
            </div>

            <div className="space-y-2">
              <label className="label-erp">Status</label>
              <select 
                className="input-erp appearance-none cursor-pointer font-bold"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
              >
                <option value="Pendente">Pendente</option>
                <option value="Confirmado" className="text-amber-400">Confirmado / Pago</option>
                <option value="Atrasado" className="text-red-400">Atrasado</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/5">
            <button onClick={() => setShowForm(false)} className="px-8 py-3 rounded-xl text-white/40 font-bold uppercase text-xs hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleSave} className={`px-10 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:scale-105 transition-all ${activeTab === 'receitas' ? 'bg-emerald-500 text-[#0b1220]' : 'bg-red-500 text-white'}`}>
              <Save size={16} /> Salvar Lançamento
            </button>
          </div>
        </div>
      )}

      {/* TABELA DE DADOS */}
      <div className="bg-[#101f3d] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0b1220]/50 text-[9px] font-black text-white/20 uppercase tracking-widest border-b border-white/5">
              <th className="p-6 pl-8">Descrição</th>
              <th className="p-6">{activeTab === 'receitas' ? 'Cliente' : 'Fornecedor'} / Projeto</th>
              <th className="p-6">Datas</th>
              <th className="p-6 text-center">Status</th>
              <th className="p-6 text-right">Valor</th>
              <th className="p-6 text-center pr-8">Ação</th>
            </tr>
          </thead>
          <tbody className="text-sm font-bold text-white divide-y divide-white/5">
            {listaAtual.length > 0 ? listaAtual.map((item: any) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-6 pl-8">
                  <p>{item.descricao}</p>
                  {item.categoria && <span className="text-[9px] text-white/30 uppercase bg-white/5 px-2 py-0.5 rounded mt-1 inline-block">{item.categoria}</span>}
                </td>
                <td className="p-6">
                  <p className="text-white/80">{item.entidadeId || '-'}</p>
                  <p className="text-[10px] text-amber-500 uppercase mt-1 flex items-center gap-1">
                    {item.obraId && <Briefcase size={10} />} {item.obraId}
                  </p>
                </td>
                <td className="p-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> Prev: {item.dataPrevista || '-'}</span>
                    {item.dataRealizada && <span className="text-[10px] text-amber-500/60 flex items-center gap-1"><CheckCircle2 size={10}/> Real: {item.dataRealizada}</span>}
                  </div>
                </td>
                <td className="p-6 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-black ${
                    item.status === 'Confirmado' ? 'bg-amber-500/10 text-amber-500' : 
                    item.status === 'Atrasado' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-white/40'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className={`p-6 text-right font-mono text-lg ${item.tipo === 'receita' ? 'text-amber-400' : 'text-red-400'}`}>
                  {item.tipo === 'receita' ? '+' : '-'} R$ {Number(item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </td>
                <td className="p-6 text-center pr-8">
                  <button onClick={() => handleDelete(item.id)} className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="p-20 text-center text-white/20 font-black uppercase tracking-widest text-xs">
                  Nenhum lançamento encontrado nesta aba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .label-erp { @apply text-[9px] font-black text-white/30 uppercase tracking-widest ml-2 block mb-1; }
        .input-erp { @apply w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:bg-[#0e1623] transition-all placeholder:text-white/10; }
      `}</style>
    </div>
  );
}
