import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { List, Plus, Trash2, Save, Info } from 'lucide-react';

export function DepartamentosView() {
  const { listas, saveListas } = useErp();

  // Estado local para edição, inicializado com os dados do contexto ou padrões
  const [config, setConfig] = useState(listas || { departamentos: [], categorias: [], prioridades: [] });
  const [novoDepartamento, setNovoDepartamento] = useState('');

  const addDepartamento = (valor: string) => {
    const nome = valor.trim();
    if (!nome) return;
    const novaLista = [...(config.departamentos || []), nome];
    setConfig({ ...config, departamentos: novaLista });
    setNovoDepartamento('');
  };

  const removeDepartamento = (index: number) => {
    const novaLista = (config.departamentos || []).filter((_: any, i: number) => i !== index);
    setConfig({ ...config, departamentos: novaLista });
  };

  const salvarAlteracoes = () => {
    saveListas(config);
    alert('Departamentos atualizados com sucesso!');
  };

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">

      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-500 rounded-2xl text-white">
            <List size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Departamentos</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
              Personalize os departamentos disponíveis nos formulários
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

      <div className="max-w-xl">
        <div className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 flex flex-col h-[500px]">
          <div className="mb-4">
            <h3 className="text-white font-bold uppercase text-sm flex items-center gap-2">
              <List size={16} className="text-blue-400" /> Departamentos
            </h3>
            <p className="text-[9px] text-blue-400/60 mt-1 font-mono uppercase tracking-wide flex gap-1">
              <Info size={10} /> Usado em: Funcionários, Compras
            </p>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              className="bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-xs w-full outline-none focus:border-blue-500"
              placeholder="Novo Depto..."
              value={novoDepartamento}
              onChange={e => setNovoDepartamento(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addDepartamento(novoDepartamento); }}
            />
            <button onClick={() => addDepartamento(novoDepartamento)} className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-400 transition-colors">
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(config.departamentos || []).length === 0 && (
              <p className="text-white/30 text-xs text-center mt-8">Nenhum departamento cadastrado.</p>
            )}
            {(config.departamentos || []).map((item: string, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
                <span className="text-white/80 text-xs">{item}</span>
                <button onClick={() => removeDepartamento(idx)} className="text-white/20 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
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
