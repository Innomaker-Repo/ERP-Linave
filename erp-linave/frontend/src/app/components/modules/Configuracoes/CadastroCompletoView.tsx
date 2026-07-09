import React, { useState } from 'react';
import { User, Building2, Rocket, ShieldCheck, Mail, MapPin, Phone } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';

interface CadastroProps {
  onFinalizar: (dados: any) => void;
}

export function CadastroCompletoView({ onFinalizar }: CadastroProps) {
  const { saveConfig } = useErp();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Dados do Admin
    adminNome: '',
    adminCpf: '',
    adminTel: '',
    // Dados da Empresa
    empresaNome: '',
    empresaCnpj: '',
    empresaEnd: '',
    segmento: 'Engenharia Naval / USV'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.adminNome || !formData.empresaNome) {
      return alert("Por favor, preencha o Nome do Gestor e o Nome da Empresa.");
    }

    setLoading(true);
    try {
      // 1. Salva no Google Drive (config.json)
      await saveConfig(formData);
      
      // 2. Atualiza o estado local no App.tsx para liberar o acesso
      onFinalizar(formData);
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      alert("Erro ao salvar as configurações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Estilos reutilizáveis
  const labelClass = "text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 mb-2 block";
  const inputClass = "w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 focus:bg-[#0e1623] transition-all placeholder:text-white/20";

  return (
    <div className="min-h-screen bg-[#0b1220] flex items-center justify-center p-6 font-sans">
      
      <div className="bg-[#101f3d] p-12 rounded-[48px] border border-white/5 w-full max-w-5xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Efeito de Fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        {/* Cabeçalho */}
        <div className="flex flex-col items-center mb-12 text-center relative z-10">
          <div className="bg-amber-500 p-4 rounded-2xl mb-6 shadow-lg shadow-amber-500/20 text-[#0b1220]">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Ativação de Instância SaaS</h2>
          <p className="text-white/30 text-xs font-bold uppercase tracking-[0.2em] mt-2">
            Configuração Inicial do Ambiente
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* COLUNA 1: DADOS DO GESTOR */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <User className="text-amber-500" size={20} />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Perfil do Administrador</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Nome Completo *</label>
                  <input name="adminNome" className={inputClass} placeholder="Seu nome" value={formData.adminNome} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>CPF</label>
                    <input name="adminCpf" className={inputClass} placeholder="000.000.000-00" value={formData.adminCpf} onChange={handleChange} />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone</label>
                    <input name="adminTel" className={inputClass} placeholder="(00) 00000-0000" value={formData.adminTel} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA 2: DADOS DA EMPRESA */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <Building2 className="text-blue-500" size={20} />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Dados da Organização</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Razão Social / Projeto *</label>
                  <input name="empresaNome" className={inputClass} placeholder="Ex: Linave Tech" value={formData.empresaNome} onChange={handleChange} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className={labelClass}>CNPJ</label>
                    <input name="empresaCnpj" className={inputClass} placeholder="00.000.000/0000-00" value={formData.empresaCnpj} onChange={handleChange} />
                  </div>
                  <div>
                    <label className={labelClass}>Segmento</label>
                    <select name="segmento" className={`${inputClass} appearance-none cursor-pointer`} value={formData.segmento} onChange={handleChange}>
                      <option>Engenharia Naval</option>
                      <option>Tecnologia / SaaS</option>
                      <option>Construção Civil</option>
                      <option>Consultoria</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Localização (Sede)</label>
                  <input name="empresaEnd" className={inputClass} placeholder="Cidade, Estado" value={formData.empresaEnd} onChange={handleChange} />
                </div>
              </div>
            </div>

          </div>

          {/* BOTÃO DE AÇÃO */}
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full md:w-auto px-16 py-5 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:scale-100"
            >
              {loading ? (
                <>Configurando Base de Dados...</>
              ) : (
                <><Rocket size={18} /> Finalizar e Ativar ERP</>
              )}
            </button>
            <p className="mt-4 text-[9px] text-white/20 font-bold uppercase tracking-widest">
              Ambiente Seguro • Dados Isolados no Drive
            </p>
          </div>
        </form>

      </div>
    </div>
  );
}
