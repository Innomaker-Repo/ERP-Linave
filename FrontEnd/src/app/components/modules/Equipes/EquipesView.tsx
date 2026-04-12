import React, { useState } from 'react';
import { Users, HardHat, Save, X, CheckCircle2 } from 'lucide-react';

export function EquipesView() {
  // Dados simulados de funcionários cadastrados
  const funcionariosCadastrados = [
    { id: 1, nome: "João Silva", especialidade: "Mecânica" },
    { id: 2, nome: "Maria Santos", especialidade: "Elétrica" },
    { id: 3, nome: "Carlos Lima", especialidade: "Estrutural" },
    { id: 4, nome: "Ana Souza", especialidade: "Soldagem" },
  ];

  const [equipeNome, setEquipeNome] = useState('');
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [lider, setLider] = useState('');
  const [especialidade, setEspecialidade] = useState('Mecânica');

  // Alternar seleção de funcionários
  const toggleFuncionario = (id: number) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-10 space-y-10 animate-in fade-in duration-500">
      {/* CABEÇALHO */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-8">
        <div className="p-4 bg-amber-500 rounded-2xl text-[#0b1220]">
          <HardHat size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Gestão de Equipes</h2>
          <p className="text-sm text-white/40 uppercase font-bold tracking-widest">
            Alocação de recursos humanos por especialidade técnica
          </p>
        </div>
      </div>

      <section className="bg-[#101f3d] border border-white/10 rounded-[48px] p-10 shadow-2xl max-w-6xl">
        <form className="space-y-12" onSubmit={(e) => e.preventDefault()}>
          
          {/* 1. IDENTIFICAÇÃO */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Nome da Equipe *</label>
              <input 
                type="text" 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500 transition-all"
                placeholder="Ex: Equipe de Estruturas USV"
                value={equipeNome}
                onChange={(e) => setEquipeNome(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Especialidade Principal</label>
              <select 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500 appearance-none"
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value)}
              >
                <option>Mecânica</option>
                <option>Elétrica</option>
                <option>Estrutural</option>
                <option>Soldagem</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Status</label>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 font-black text-xs text-center uppercase">
                Disponível
              </div>
            </div>
          </div>

          {/* 2. SELEÇÃO DE INTEGRANTES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-2">
                <Users size={16} /> Selecionar Integrantes
              </h3>
              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {funcionariosCadastrados.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFuncionario(f.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all
                      ${selecionados.includes(f.id) 
                        ? 'bg-emerald-500 border-emerald-500 text-[#0b1220]' 
                        : 'bg-[#0b1220] border-white/5 text-white/60 hover:border-white/20'}`}
                  >
                    <div className="text-left">
                      <div className="text-xs font-black uppercase italic">{f.nome}</div>
                      <div className={`text-[10px] font-bold uppercase ${selecionados.includes(f.id) ? 'text-[#0b1220]/60' : 'text-white/20'}`}>
                        {f.especialidade}
                      </div>
                    </div>
                    {selecionados.includes(f.id) && <CheckCircle2 size={18} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-8 bg-[#0b1220]/50 p-8 rounded-[32px] border border-white/5">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Líder da Equipe *</label>
                <select 
                  className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                  value={lider}
                  onChange={(e) => setLider(e.target.value)}
                >
                  <option value="">Selecione um líder...</option>
                  {funcionariosCadastrados.filter(f => selecionados.includes(f.id)).map((f) => (
                    <option key={f.id} value={f.nome}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Contagem de Integrantes</p>
                <div className="text-3xl font-black text-white italic">{selecionados.length} <span className="text-xs not-italic text-white/20">MEMBROS</span></div>
              </div>
            </div>
          </div>

          {/* AÇÕES */}
          <div className="flex justify-end gap-4 pt-10 border-t border-white/5">
            <button type="button" className="px-8 py-4 rounded-2xl text-white/40 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">
              Cancelar
            </button>
            <button 
              type="button" 
              className="bg-emerald-500 px-10 py-4 rounded-2xl text-[#0b1220] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/10 hover:scale-105 transition-all flex items-center gap-2"
            >
              <Save size={16} /> Salvar Equipe
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
