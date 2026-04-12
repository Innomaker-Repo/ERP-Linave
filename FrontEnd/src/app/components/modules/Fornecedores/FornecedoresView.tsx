import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Factory, Plus, Save, X, Edit2, Trash2, Phone, MapPin } from 'lucide-react';

export function FornecedoresView({ searchQuery }: { searchQuery: string }) {
  const { fornecedores, saveEntity } = useErp();
  const [showForm, setShowForm] = useState(false);
  const [fornecedor, setFornecedor] = useState({ razaoSocial: '', cnpj: '', contato: '', endereco: '', status: 'Ativo' });

  const salvar = () => {
    const novo = [...(fornecedores || []), { ...fornecedor, id: `FOR-${Date.now()}` }];
    saveEntity('fornecedores', novo);
    setShowForm(false);
  };

  const lista = (fornecedores || []).filter((f: any) => f.razaoSocial?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div><h1 className="text-3xl font-black text-white uppercase italic">Fornecedores</h1><p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Gestão de Parceiros e Suprimentos</p></div>
        <button onClick={() => setShowForm(true)} className="bg-amber-500 text-[#0b1220] px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 hover:scale-105 transition-all"><Plus size={16}/> Novo Fornecedor</button>
      </div>

      {showForm && (
        <div className="bg-[#101f3d] p-8 rounded-[32px] border border-amber-500/30 grid grid-cols-2 gap-6 shadow-2xl">
          <input placeholder="Razão Social" className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, razaoSocial: e.target.value})} />
          <input placeholder="CNPJ" className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, cnpj: e.target.value})} />
          <input placeholder="Contato (Tel/Email)" className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, contato: e.target.value})} />
          <input placeholder="Endereço" className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, endereco: e.target.value})} />
          <div className="col-span-2 flex justify-end gap-4 mt-4">
            <button onClick={() => setShowForm(false)} className="text-white/40 font-bold text-xs uppercase px-6 py-3 rounded-xl border border-white/5 hover:bg-white/5">Cancelar</button>
            <button onClick={salvar} className="bg-emerald-500 text-[#0b1220] px-8 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2"><Save size={16}/> Salvar Registro</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lista.map((f: any) => (
          <div key={f.id} className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 group hover:border-amber-500/20 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 rounded-xl text-amber-500"><Factory size={20}/></div>
              <span className="text-[9px] bg-white/5 px-2 py-1 rounded text-white/40 uppercase font-mono">{f.status}</span>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">{f.razaoSocial}</h3>
            <p className="text-white/30 text-xs font-mono mb-4">{f.cnpj}</p>
            <div className="space-y-2 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-white/50 text-xs"><Phone size={12}/> {f.contato}</div>
              <div className="flex items-center gap-2 text-white/50 text-xs"><MapPin size={12}/> {f.endereco}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
