import React, { useState } from 'react';
import { User, Building2, Rocket, ShieldCheck } from 'lucide-react';

export function CadastroCompletoView({ onFinalizar }: { onFinalizar: (dados: any) => void }) {
  const [formData, setFormData] = useState({
    adminNome: '', 
    adminCpf: '', 
    adminTel: '',
    empresaNome: '', 
    empresaCnpj: '', 
    empresaEnd: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.adminNome || !formData.empresaNome) return alert("Preencha os campos principais.");
    onFinalizar(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-[#0b1220] flex items-center justify-center p-6 font-sans">
      <form onSubmit={handleSubmit} className="bg-[#101f3d] p-12 rounded-[48px] border border-white/5 w-full max-w-5xl shadow-2xl relative overflow-hidden">
        
        <div className="flex flex-col items-center mb-10 text-center relative z-10">
          <div className="bg-amber-500 p-3 rounded-2xl mb-4 text-[#0b1220] shadow-lg shadow-amber-500/20">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Ativação de Instância SaaS</h2>
          <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Configuração Inicial do Sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
          
          {/* COLUNA ADMIN */}
          <div className="space-y-6">
            <h3 className="text-amber-500 font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
              <User size={16} /> Dados do Gestor
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/40 uppercase ml-2">Nome Completo</label>
                <input 
                  name="adminNome"
                  required 
                  placeholder="Seu Nome" 
                  className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/10" 
                  onChange={handleChange} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase ml-2">CPF</label>
                  <input 
                    name="adminCpf"
                    required 
                    placeholder="000.000.000-00" 
                    className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/10" 
                    onChange={handleChange} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase ml-2">Telefone</label>
                  <input 
                    name="adminTel"
                    placeholder="(00) 00000-0000" 
                    className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/10" 
                    onChange={handleChange} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA EMPRESA */}
          <div className="space-y-6">
            <h3 className="text-blue-500 font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
              <Building2 size={16} /> Dados da Organização
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/40 uppercase ml-2">Razão Social / Projeto</label>
                <input 
                  name="empresaNome"
                  required 
                  placeholder="Nome da Empresa" 
                  className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-blue-500 transition-all placeholder:text-white/10" 
                  onChange={handleChange} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase ml-2">CNPJ</label>
                  <input 
                    name="empresaCnpj"
                    required 
                    placeholder="00.000.000/0000-00" 
                    className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-blue-500 transition-all placeholder:text-white/10" 
                    onChange={handleChange} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase ml-2">Localização</label>
                  <input 
                    name="empresaEnd"
                    placeholder="Cidade / UF" 
                    className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-blue-500 transition-all placeholder:text-white/10" 
                    onChange={handleChange} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full bg-emerald-500 py-5 rounded-2xl font-black text-[#0b1220] uppercase text-xs mt-12 flex items-center justify-center gap-3 hover:scale-[1.01] transition-transform shadow-xl shadow-emerald-500/10 relative z-10"
        >
          <Rocket size={18} /> Finalizar Cadastro e Ativar ERP
        </button>

      </form>
    </div>
  );
}
