import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { 
  CheckCircle2, Clock, Calendar, User, 
  LayoutList, Kanban, AlertCircle, Wrench 
} from 'lucide-react';

export function ServicosView({ searchQuery }: { searchQuery: string }) {
  const { os, saveEntity } = useErp();
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  // Filtra apenas OS que foram enviadas (statusEnvio === 'enviada')
  const tarefasOperacionais = (os || []).filter((item: any) => 
    item.statusEnvio === 'enviada' &&
    item.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (prio: string) => {
    switch(prio) {
      case 'Urgente': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'Alta': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const concluirTarefa = (task: any) => {
    if(confirm("Marcar esta tarefa operacional como Concluída?")) {
      const novaLista = os.map((o: any) => o.id === task.id ? { ...o, status: 'Concluído', fase: 'PosVenda' } : o);
      saveEntity('os', novaLista);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER ESPECÍFICO DE OPERAÇÃO */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 p-3 rounded-xl text-amber-500">
            <Wrench size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Frente de Trabalho</h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Execução & Campo</p>
          </div>
        </div>

        <div className="flex bg-[#101f3d] p-1 rounded-xl border border-white/5">
          <button 
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
          >
            <LayoutList size={14} /> Lista
          </button>
          <button 
            onClick={() => setViewMode('board')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'board' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
          >
            <Kanban size={14} /> Quadro
          </button>
        </div>
      </div>

      {/* VISUALIZAÇÃO EM LISTA (CLICKUP STYLE) */}
      {viewMode === 'list' && (
        <div className="bg-[#101f3d] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-[#0b1220]/50 text-[10px] font-black text-white/30 uppercase tracking-widest">
            <div className="col-span-6 pl-2">Tarefa / Atividade</div>
            <div className="col-span-2">Responsável</div>
            <div className="col-span-2">Prazo</div>
            <div className="col-span-2 text-center">Prioridade</div>
          </div>

          <div className="divide-y divide-white/5">
            {tarefasOperacionais.length > 0 ? tarefasOperacionais.map((task: any) => (
              <div key={task.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/[0.02] transition-colors group">
                
                {/* Checkbox Concluir */}
                <div className="col-span-6 flex items-center gap-4 pl-2">
                  <button 
                    onClick={() => concluirTarefa(task)}
                    className="w-5 h-5 rounded-full border-2 border-white/20 hover:border-emerald-500 hover:bg-emerald-500/20 transition-all flex items-center justify-center text-transparent hover:text-emerald-500"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <div>
                    <p className="text-white text-sm font-bold truncate">{task.descricao}</p>
                    <p className="text-[10px] text-white/30 font-mono mt-0.5 flex items-center gap-2">
                      <span className="bg-white/5 px-1.5 rounded">{task.id}</span>
                      {task.obraNome}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[9px] font-bold text-white border border-[#101f3d]">
                    {task.responsavel.charAt(0)}
                  </div>
                  <span className="text-xs text-white/60 truncate">{task.responsavel}</span>
                </div>

                <div className="col-span-2 flex items-center gap-2 text-white/40 text-xs font-mono">
                  <Calendar size={12} />
                  <span>{task.dataEntrega || 'S/ Data'}</span>
                </div>

                <div className="col-span-2 flex justify-center">
                  <div className={`px-3 py-1 rounded-md text-[10px] font-black uppercase border ${getPriorityColor(task.prioridade)}`}>
                    {task.prioridade || 'Normal'}
                  </div>
                </div>

              </div>
            )) : (
              <div className="p-12 text-center flex flex-col items-center justify-center text-white/20">
                <CheckCircle2 size={48} className="mb-4 opacity-20"/>
                <p className="font-bold text-xs uppercase tracking-widest">Tudo limpo por aqui</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISUALIZAÇÃO EM QUADRO (KANBAN SIMPLES) */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-x-auto">
          {['A Fazer', 'Em Progresso', 'Bloqueado'].map((status, idx) => (
            <div key={status} className="bg-[#101f3d] p-4 rounded-3xl border border-white/5 min-h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-4 px-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-white/40' : idx === 1 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                  {status}
                </h4>
                <span className="bg-white/10 text-white/60 text-[10px] px-2 py-0.5 rounded-md font-mono">0</span>
              </div>
              
              {/* Área de Drop (Futura implementação de DnD) */}
              <div className="flex-1 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center text-white/10 text-[10px] font-black uppercase tracking-widest">
                Sem tarefas
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
