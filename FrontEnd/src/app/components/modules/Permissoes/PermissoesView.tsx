import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext'; // Caminho corrigido
import { ShieldCheck, UserPlus, Lock, CheckCircle2, Mail } from 'lucide-react';

const MODULOS_DISPONIVEIS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "clientes", label: "Clientes" },
  { id: "funcionarios", label: "Funcionários" },
  { id: "obras", label: "Obras" },
  { id: "financeiro", label: "Financeiro" }
];

export function PermissoesView() {
  const { addEntity, usuarios, loading } = useErp();
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>(
    MODULOS_DISPONIVEIS.reduce((acc, m) => ({ ...acc, [m.id]: false }), {})
  );

  const togglePermissao = (id: string) => {
    setPermissoes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const novoFilho = {
      email: fd.get('email') as string,
      senha: fd.get('senha') as string,
      role: 'filho',
      permissoes: permissoes,
      criadoEm: new Date().toISOString()
    };

    await addEntity('usuarios', novoFilho);
    setPermissoes(MODULOS_DISPONIVEIS.reduce((acc, m) => ({ ...acc, [m.id]: false }), {}));
    e.currentTarget.reset();
  };

  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 lg:col-span-5">
        <form onSubmit={handleCreateUser} className="bg-[#101f3d] p-8 rounded-[32px] border border-white/10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
              <UserPlus size={20} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Novo Usuário Filho</h3>
          </div>

          <div className="space-y-4">
            <input name="email" type="email" placeholder="E-mail do colaborador" required className="input-base" />
            <input name="senha" type="password" placeholder="Senha de acesso" required className="input-base" />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Módulos Autorizados</p>
            <div className="grid grid-cols-1 gap-2">
              {MODULOS_DISPONIVEIS.map(modulo => (
                <button
                  key={modulo.id}
                  type="button"
                  onClick={() => togglePermissao(modulo.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    permissoes[modulo.id] 
                    ? 'border-amber-500 bg-amber-500/5 text-amber-500' 
                    : 'border-white/5 bg-[#0b1220] text-white/20'
                  }`}
                >
                  <span className="text-xs font-bold uppercase">{modulo.label}</span>
                  {permissoes[modulo.id] ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border border-white/10" />}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] font-black py-4 rounded-2xl transition-all">
            {loading ? "SINCRONIZANDO DRIVE..." : "CADASTRAR ACESSO"}
          </button>
        </form>
      </div>

      <div className="col-span-12 lg:col-span-7 space-y-4">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <ShieldCheck className="text-amber-500" size={20} /> Colaboradores Ativos
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {usuarios.filter(u => u.role === 'filho').map(u => (
            <div key={u.email} className="bg-[#101f3d] p-6 rounded-[24px] border border-white/5 flex justify-between items-center">
              <div>
                <p className="font-bold text-white text-sm">{u.email}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(u.permissoes).filter(([_, v]) => v).map(([key]) => (
                    <span key={key} className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-[10px] text-white/10 font-mono italic">FILHO</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
