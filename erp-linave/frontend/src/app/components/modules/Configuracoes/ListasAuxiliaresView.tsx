import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { List, Plus, Trash2, Save, Settings, Info } from 'lucide-react';

export function ListasAuxiliaresView() {
  const { listas, saveListas } = useErp();
  
  // Estado local para edição, inicializado com os dados do contexto ou padrões
  const [config, setConfig] = useState(listas || { departamentos: [], categorias: [], prioridades: [] });
  const [novoItem, setNovoItem] = useState({ departamento: '', categoria: '', prioridade: '' });

  const addItem = (tipo: 'departamentos' | 'categorias' | 'prioridades', valor: string) => {
    if (!valor) return;
    const novaLista = [...(config[tipo] || []), valor];
    setConfig({ ...config, [tipo]: novaLista });
    setNovoItem({ ...novoItem, [tipo === 'departamentos' ? 'departamento' : tipo === 'categorias' ? 'categoria' : 'prioridade']: '' });
  };

  const removeItem = (tipo: 'departamentos' | 'categorias' | 'prioridades', index: number) => {
    const novaLista = config[tipo].filter((_: any, i: number) => i !== index);
    setConfig({ ...config, [tipo]: novaLista });
  };

  const salvarAlteracoes = () => {
    saveListas(config);
    alert("Listas atualizadas com sucesso no Drive!");
  };

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-500 rounded-2xl text-white">
            <Settings size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Menus Suspensos</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
              Personalize as opções disponíveis nos formulários
            </p>
          </div>
        </div>
        <button 
          onClick={salvarAlteracoes}
          className="bg-amber-500 text-[#0b1220] px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-amber-500/20"
        >
          <Save size={18} /> Salvar Alterações
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLUNA DEPARTAMENTOS */}
        <div className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 flex flex-col h-[500px]">
          <div className="mb-4">
            <h3 className="text-white font-bold uppercase text-sm flex items-center gap-2">
              <List size={16} className="text-blue-400"/> Departamentos
            </h3>
            <p className="text-[9px] text-blue-400/60 mt-1 font-mono uppercase tracking-wide flex gap-1">
              <Info size={10} /> Usado em: Funcionários, Compras
            </p>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              className="bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-xs w-full outline-none focus:border-blue-500"
              placeholder="Novo Depto..."
              value={novoItem.departamento}
              onChange={e => setNovoItem({...novoItem, departamento: e.target.value})}
            />
            <button onClick={() => addItem('departamentos', novoItem.departamento)} className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-400 transition-colors">
              <Plus size={16}/>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(config.departamentos || []).map((item: string, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
                <span className="text-white/80 text-xs">{item}</span>
                <button onClick={() => removeItem('departamentos', idx)} className="text-white/20 hover:text-red-500 transition-colors">
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA CATEGORIAS */}
        <div className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 flex flex-col h-[500px]">
          <div className="mb-4">
            <h3 className="text-white font-bold uppercase text-sm flex items-center gap-2">
              <List size={16} className="text-purple-400"/> Categorias
            </h3>
            <p className="text-[9px] text-purple-400/60 mt-1 font-mono uppercase tracking-wide flex gap-1">
              <Info size={10} /> Usado em: Compras, Financeiro
            </p>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              className="bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-xs w-full outline-none focus:border-purple-500"
              placeholder="Nova Categoria..."
              value={novoItem.categoria}
              onChange={e => setNovoItem({...novoItem, categoria: e.target.value})}
            />
            <button onClick={() => addItem('categorias', novoItem.categoria)} className="bg-purple-500 text-white p-3 rounded-xl hover:bg-purple-400 transition-colors">
              <Plus size={16}/>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(config.categorias || []).map((item: string, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded-xl border border-white/5 group hover:border-purple-500/30 transition-all">
                <span className="text-white/80 text-xs">{item}</span>
                <button onClick={() => removeItem('categorias', idx)} className="text-white/20 hover:text-red-500 transition-colors">
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA PRIORIDADES */}
        <div className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 flex flex-col h-[500px]">
          <div className="mb-4">
            <h3 className="text-white font-bold uppercase text-sm flex items-center gap-2">
              <List size={16} className="text-amber-400"/> Prioridades
            </h3>
            <p className="text-[9px] text-amber-400/60 mt-1 font-mono uppercase tracking-wide flex gap-1">
              <Info size={10} /> Usado em: Compras, Obras, OS
            </p>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              className="bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-xs w-full outline-none focus:border-amber-500"
              placeholder="Nova Prioridade..."
              value={novoItem.prioridade}
              onChange={e => setNovoItem({...novoItem, prioridade: e.target.value})}
            />
            <button onClick={() => addItem('prioridades', novoItem.prioridade)} className="bg-amber-500 text-[#0b1220] p-3 rounded-xl hover:bg-amber-400 transition-colors">
              <Plus size={16}/>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(config.prioridades || []).map((item: string, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded-xl border border-white/5 group hover:border-amber-500/30 transition-all">
                <span className="text-white/80 text-xs">{item}</span>
                <button onClick={() => removeItem('prioridades', idx)} className="text-white/20 hover:text-red-500 transition-colors">
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: #0b1220; rounded: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { bg: #ffffff10; rounded: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { bg: #ffffff20; }
      `}</style>
    </div>
  );
}
