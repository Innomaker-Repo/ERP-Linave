import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { Building2, MapPin, Hash, Globe, Save } from 'lucide-react';

export function EmpresaSetup() {
  const { sync, setEmpresa } = useErp();
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    logradouro: '',
    cidade: 'Niterói',
    uf: 'RJ',
    website: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Salva no arquivo empresa.json no seu Drive
    await sync('empresa', formData);
    setEmpresa(formData);
    window.location.reload(); // Recarrega para aplicar o nome no Dashboard
  };

  return (
    <div className="min-h-screen bg-[#0b1220] flex items-center justify-center p-6">
      <div className="bg-[#101f3d] p-10 rounded-[48px] border border-white/5 w-full max-w-2xl shadow-2xl">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Configuração Linave</h2>
          <p className="text-white/40 text-sm mt-2">Cadastre os dados da sua empresa para inicializar o ERP.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/20 uppercase ml-2">Nome da Organização</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-4 text-white/20" size={20} />
                <input required
                  className="w-full bg-[#0b1220] border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:border-amber-500"
                  value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/20 uppercase ml-2">CNPJ</label>
              <div className="relative">
                <Hash className="absolute left-4 top-4 text-white/20" size={20} />
                <input required
                  className="w-full bg-[#0b1220] border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:border-amber-500"
                  value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/20 uppercase ml-2">Endereço (Sede Niterói/UFF)</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-4 text-white/20" size={20} />
              <input required
                className="w-full bg-[#0b1220] border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:border-amber-500"
                value={formData.logradouro} onChange={e => setFormData({...formData, logradouro: e.target.value})}
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-emerald-500 py-5 rounded-2xl font-black text-[#0b1220] uppercase flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all">
            <Save size={20} /> FINALIZAR E ABRIR DASHBOARD
          </button>
        </form>
      </div>
    </div>
  );
}
