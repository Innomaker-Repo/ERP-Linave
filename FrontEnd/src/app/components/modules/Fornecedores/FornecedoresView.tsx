import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Factory, Plus, Save, X, Edit2, Trash2, Phone, MapPin } from 'lucide-react';

export function FornecedoresView({ searchQuery }: { searchQuery: string }) {
  const { fornecedores, saveEntity, userSession } = useErp();
  const [showForm, setShowForm] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<any | null>(null);
  const [fornecedor, setFornecedor] = useState({
    razaoSocial: '',
    cnpj: '',
    contato: '',
    endereco: '',
    status: 'Ativo',
    tipo: 'Serviços',
    descricaoEstadual: '',
  });

  const validar = () => {
    if (!fornecedor.razaoSocial.trim()) return 'Razão Social é obrigatória.';
    if (!fornecedor.cnpj.trim()) return 'CNPJ é obrigatório.';
    if (!fornecedor.contato.trim()) return 'Contato é obrigatório.';
    if (!fornecedor.endereco.trim()) return 'Endereço é obrigatório.';
    if (!fornecedor.status.trim()) return 'Status é obrigatório.';
    if (!fornecedor.tipo.trim()) return 'Tipo é obrigatório.';
    if (fornecedor.tipo === 'Empresas' && !fornecedor.descricaoEstadual.trim()) return 'Descrição estadual é obrigatória para empresas.';
    return null;
  };

  const resolveNaturezaFornecimento = (tipo: string) => (tipo === 'Empresas' ? 'ITEM' : 'SERVICO');

  const salvar = () => {
    const erro = validar();
    if (erro) return window.alert(erro);

    const novoRegistro = {
      ...fornecedor,
      naturezaFornecimento: resolveNaturezaFornecimento(fornecedor.tipo),
      id: `FOR-${Date.now()}`,
      criadoPor: userSession?.username || 'sistema',
      criadoEm: new Date().toISOString(),
    };

    const novo = [...(fornecedores || []), novoRegistro];
    saveEntity('fornecedores', novo);
    setShowForm(false);
    setFornecedor({ razaoSocial: '', cnpj: '', contato: '', endereco: '', status: 'Ativo', tipo: 'Serviços', descricaoEstadual: '' });
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
          <input placeholder="Razão Social *" value={fornecedor.razaoSocial} className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, razaoSocial: e.target.value})} />
          <input placeholder="CNPJ *" value={fornecedor.cnpj} className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, cnpj: e.target.value})} />
          <input placeholder="Contato (Tel/Email) *" value={fornecedor.contato} className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, contato: e.target.value})} />
          <input placeholder="Endereço *" value={fornecedor.endereco} className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, endereco: e.target.value})} />
          <select value={fornecedor.tipo} onChange={e => setFornecedor({...fornecedor, tipo: e.target.value})} className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none">
            <option value="Serviços">Serviços</option>
            <option value="Empresas">Empresas</option>
          </select>
          {fornecedor.tipo === 'Empresas' && (
            <input placeholder="Descrição estadual" value={fornecedor.descricaoEstadual} className="bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none" onChange={e => setFornecedor({...fornecedor, descricaoEstadual: e.target.value})} />
          )}
          <select value={fornecedor.status} onChange={e => setFornecedor({...fornecedor, status: e.target.value})} className="col-span-2 bg-[#0b1220] p-4 rounded-xl text-white text-sm border border-white/10 focus:border-amber-500 outline-none">
            <option>Ativo</option>
            <option>Inativo</option>
          </select>
          <div className="col-span-2 flex justify-end gap-4 mt-4">
            <button onClick={() => setShowForm(false)} className="text-white/40 font-bold text-xs uppercase px-6 py-3 rounded-xl border border-white/5 hover:bg-white/5">Cancelar</button>
            <button onClick={salvar} className="bg-emerald-500 text-[#0b1220] px-8 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2"><Save size={16}/> Salvar Registro</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lista.map((f: any) => {
          const naturezaFornecimento = f.naturezaFornecimento || (f.tipo === 'Empresas' ? 'ITEM' : 'SERVICO');

          return (
          <div key={f.id} onClick={() => setSelectedFornecedor(f)} className="cursor-pointer bg-[#101f3d] p-6 rounded-[32px] border border-white/5 group hover:border-amber-500/20 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 rounded-xl text-amber-500"><Factory size={20}/></div>
              <span className="text-[9px] bg-white/5 px-2 py-1 rounded text-white/40 uppercase font-mono">{f.status}</span>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">{f.razaoSocial}</h3>
            <p className="text-amber-300 text-[10px] font-black uppercase tracking-widest mb-2">{naturezaFornecimento === 'ITEM' ? 'ITEM' : 'SERVIÇO'}</p>
            <p className="text-white/30 text-xs font-mono mb-4">{f.cnpj}</p>
            <div className="space-y-2 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-white/50 text-xs"><Phone size={12}/> {f.contato}</div>
              <div className="flex items-center gap-2 text-white/50 text-xs"><MapPin size={12}/> {f.endereco}</div>
            </div>
          </div>
          );
        })}
      </div>
      {selectedFornecedor && (
        (() => {
          const naturezaFornecimento = selectedFornecedor.naturezaFornecimento || (selectedFornecedor.tipo === 'Empresas' ? 'ITEM' : 'SERVICO');

          return (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0b1220] rounded-2xl border border-white/10 p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-black">{selectedFornecedor.razaoSocial}</h3>
                <p className="text-white/40 text-sm mt-1">{selectedFornecedor.tipo} • {selectedFornecedor.status}</p>
                <p className="text-amber-300 text-xs font-bold uppercase tracking-widest mt-2">Classificação: {naturezaFornecimento === 'ITEM' ? 'ITEM' : 'SERVIÇO'}</p>
              </div>
              <button onClick={() => setSelectedFornecedor(null)} className="text-white/40 hover:text-white transition-colors">Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase">CNPJ</p>
                <p className="font-semibold">{selectedFornecedor.cnpj}</p>

                <p className="text-white/40 text-xs uppercase mt-3">Contato</p>
                <p className="font-semibold">{selectedFornecedor.contato}</p>

                <p className="text-white/40 text-xs uppercase mt-3">Endereço</p>
                <p className="font-semibold">{selectedFornecedor.endereco}</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase">Descrição estadual</p>
                <p className="font-semibold">{selectedFornecedor.descricaoEstadual || '-'}</p>

                <p className="text-white/40 text-xs uppercase mt-3">Natureza do fornecimento</p>
                <p className="font-semibold">{naturezaFornecimento === 'ITEM' ? 'ITEM' : 'SERVIÇO'}</p>

                <p className="text-white/40 text-xs uppercase mt-3">Metadados</p>
                <p className="text-sm text-white/50">Criado por: {selectedFornecedor.criadoPor || '-'}</p>
                <p className="text-sm text-white/50">Criado em: {selectedFornecedor.criadoEm ? new Date(selectedFornecedor.criadoEm).toLocaleString('pt-BR') : '-'}</p>
              </div>
            </div>
          </div>
        </div>
          );
        })()
      )}
    </div>
  );
}
