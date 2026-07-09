import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Activity, Plus, Save, Calendar, User } from 'lucide-react';

export function AtividadesView({ searchQuery }: { searchQuery: string }) {
  const { userSession } = useErp();
  const [diario, setDiario] = useState<any[]>([]); // Futuramente ligar ao 'saveEntity'
  const [novoRegistro, setNovoRegistro] = useState('');

  const handleSave = () => {
    if (!novoRegistro) return;
    const novo = {
      id: Date.now(),
      texto: novoRegistro,
      data: new Date().toLocaleDateString(),
      hora: new Date().toLocaleTimeString(),
      autor: userSession?.email
    };
    setDiario([novo, ...diario]);
    setNovoRegistro('');
  };

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-500 rounded-2xl text-white"><Activity size={32}/></div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Diário de Bordo</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Registros de Campo e Ocorrências</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULÁRIO RÁPIDO */}
        <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 h-fit">
          <h3 className="text-white font-bold mb-4">Novo Registo</h3>
          <textarea 
            className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-purple-500 h-40 resize-none mb-4 placeholder:text-white/20"
            placeholder="Descreva a atividade ou ocorrência..."
            value={novoRegistro}
            onChange={e => setNovoRegistro(e.target.value)}
          />
          <button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg">
            <Plus size={16} /> Registar
          </button>
        </div>

        {/* TIMELINE */}
        <div className="lg:col-span-2 space-y-4">
          {diario.length === 0 ? (
            <div className="text-center py-20 opacity-30">
              <Activity size={48} className="mx-auto mb-4 text-white"/>
              <p className="text-white font-black uppercase tracking-widest">Nenhum registo hoje</p>
            </div>
          ) : (
            diario.map((item) => (
              <div key={item.id} className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 flex gap-4">
                <div className="flex flex-col items-center">
                   <div className="w-2 h-2 rounded-full bg-purple-500 mb-1"></div>
                   <div className="w-0.5 h-full bg-white/5"></div>
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] text-purple-400 font-black uppercase flex items-center gap-2">
                      <User size={12}/> {item.autor}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono flex items-center gap-2">
                      <Calendar size={12}/> {item.data} - {item.hora}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">{item.texto}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
