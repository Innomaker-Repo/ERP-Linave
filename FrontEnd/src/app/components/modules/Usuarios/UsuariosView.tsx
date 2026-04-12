import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { UserPlus, Users, ShieldCheck, Mail, Key, Trash2, Edit, CheckSquare, Square, X, Save, AlertCircle } from 'lucide-react';

// Lista de módulos que podem ser bloqueados/liberados para utilizadores comuns
const MODULOS_DISPONIVEIS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Clientes (CRM)' },
  { id: 'obras', label: 'Engenharia (Obras)' },
  { id: 'servicos', label: 'Operação (Serviços)' },
  { id: 'compras', label: 'Compras' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'financeiro', label: 'Financeiro (Restrito)' },
  { id: 'relatorios', label: 'Relatórios BI' },
  { id: 'config', label: 'Configurações' }
];

export function UsuariosView() {
  const { usuarios, saveEntity, userSession } = useErp();
  const [view, setView] = useState<'dashboard' | 'lista'>('dashboard');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // --- ESTADOS DE EDIÇÃO ---
  const [editingUser, setEditingUser] = useState<any>(null);
  const [tempPermissoes, setTempPermissoes] = useState<Record<string, boolean>>({});

  const listaUsuarios = Array.isArray(usuarios) ? usuarios : [];
  
  const stats = {
    total: listaUsuarios.length,
    admins: listaUsuarios.filter((u: any) => u.role === 'ADMIN').length,
    users: listaUsuarios.filter((u: any) => u.role === 'USER').length,
  };

  // --- FUNÇÕES DE AÇÃO ---

  const handleInvite = async () => {
    if (!inviteEmail.includes('@')) return alert("E-mail inválido");
    setLoading(true);
    try {
      await axios.post('http://localhost:3001/api/invite-user', {
        adminEmail: userSession.email,
        empresaNome: 'Linave SaaS',
        userEmail: inviteEmail
      });
      alert(`Convite enviado com sucesso para ${inviteEmail}`);
      setInviteEmail('');
    } catch (e: any) {
      alert("Erro ao enviar convite. Verifique o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // APAGAR UTILIZADOR
  const handleDeleteUser = (emailToDelete: string) => {
    if (confirm(`Tem a certeza que deseja remover o acesso de ${emailToDelete}? Esta ação não pode ser desfeita.`)) {
      const novaLista = listaUsuarios.filter((u: any) => u.email !== emailToDelete);
      saveEntity('usuarios', novaLista); // Salva no Drive imediatamente
    }
  };

  // ABRIR EDIÇÃO
  const handleEditPermissions = (user: any) => {
    setEditingUser(user);
    setTempPermissoes(user.permissoes || {});
  };

  // ALTERNAR PERMISSÃO (CHECKBOX)
  const togglePermission = (moduleId: string) => {
    setTempPermissoes(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  // SALVAR EDIÇÃO
  const handleSavePermissions = () => {
    if (!editingUser) return;
    const novaLista = listaUsuarios.map((u: any) => {
      if (u.email === editingUser.email) {
        return { ...u, permissoes: tempPermissoes };
      }
      return u;
    });
    saveEntity('usuarios', novaLista);
    setEditingUser(null);
    alert(`Permissões atualizadas para ${editingUser.email}!`);
  };

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500 relative">
      
      {/* --- MODAL DE EDIÇÃO (OVERLAY) --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101f3d] border border-white/10 rounded-[32px] p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-white italic uppercase">Gerir Acessos</h3>
                <p className="text-white/40 text-sm mt-1">Utilizador: <span className="text-emerald-500 font-bold">{editingUser.email}</span></p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                <X size={20} className="text-white/60" />
              </button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-6 flex items-center gap-3">
               <AlertCircle className="text-amber-500" size={20} />
               <p className="text-amber-200 text-xs">Marque os módulos que este colaborador pode visualizar e editar.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {MODULOS_DISPONIVEIS.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => togglePermission(mod.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    tempPermissoes[mod.id]
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                      : 'bg-[#0b1220] border-white/5 text-white/40 hover:border-white/20'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">{mod.label}</span>
                  {tempPermissoes[mod.id] ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              ))}
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-4 rounded-2xl border border-white/10 text-white/40 font-black uppercase text-xs hover:bg-white/5 transition-all">
                Cancelar
              </button>
              <button onClick={handleSavePermissions} className="flex-1 py-4 rounded-2xl bg-emerald-500 text-[#0b1220] font-black uppercase text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                <Save size={16} /> Salvar Permissões
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER: SELEÇÃO DE VISTA */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setView('dashboard')}
          className={`p-8 rounded-[32px] border font-black uppercase tracking-widest transition-all ${
            view === 'dashboard' ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20' : 'bg-[#101f3d] text-white/40 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck size={24} />
            CONVIDAR / DASHBOARD
          </div>
        </button>
        <button 
          onClick={() => setView('lista')}
          className={`p-8 rounded-[32px] border font-black uppercase tracking-widest transition-all ${
            view === 'lista' ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20' : 'bg-[#101f3d] text-white/40 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <Users size={24} />
            ACESSOS ATIVOS
          </div>
        </button>
      </div>

      {/* PAINEL PRINCIPAL */}
      <div className="bg-[#101f3d] p-8 rounded-[48px] border border-white/5 min-h-[400px]">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-white/20 font-black uppercase tracking-[0.3em] flex items-center gap-2 text-[10px]">
             <Key size={18} className="text-purple-500" /> GESTÃO DE ACESSOS
           </h3>
           <span className="text-xs font-bold text-white bg-white/5 px-3 py-1 rounded-full">{stats.total} Contas</span>
        </div>

        {view === 'dashboard' ? (
          <div className="space-y-8 animate-in fade-in">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-[#0b1220] p-6 rounded-3xl border border-white/5 text-center">
                <p className="text-purple-500 font-black text-4xl">{stats.total}</p>
                <p className="text-[10px] text-white/40 uppercase mt-2 font-bold tracking-tighter">Total</p>
              </div>
              <div className="bg-[#0b1220] p-6 rounded-3xl border border-white/5 text-center">
                <p className="text-emerald-500 font-black text-4xl">{stats.admins}</p>
                <p className="text-[10px] text-white/40 uppercase mt-2 font-bold tracking-tighter">Admins</p>
              </div>
              <div className="bg-[#0b1220] p-6 rounded-3xl border border-white/5 text-center">
                <p className="text-blue-500 font-black text-4xl">{stats.users}</p>
                <p className="text-[10px] text-white/40 uppercase mt-2 font-bold tracking-tighter">Staff</p>
              </div>
            </div>

            {/* Painel de Convite */}
            <div className="p-8 bg-purple-500/5 border border-purple-500/10 rounded-[32px] flex flex-col md:flex-row items-center gap-6">
              <div className="p-4 bg-purple-500/10 rounded-full text-purple-400">
                <Mail size={32} />
              </div>
              <div className="flex-1 w-full">
                <h4 className="text-white font-black text-lg uppercase">Novo Convite</h4>
                <p className="text-white/40 text-xs mb-4">Envie um link de acesso seguro para um novo membro.</p>
                <div className="flex gap-2">
                  <input 
                    placeholder="E-mail corporativo" 
                    className="flex-1 bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-purple-500 transition-all placeholder:text-white/20"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                  <button 
                    onClick={handleInvite} 
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20"
                  >
                    {loading ? "A Enviar..." : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0b1220] rounded-[32px] overflow-hidden border border-white/5 animate-in slide-in-from-right-8">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 text-[9px] font-black text-white/20 uppercase tracking-widest border-b border-white/5">
                <tr>
                  <th className="p-6">Utilizador / E-mail</th>
                  <th className="p-6">Nível</th>
                  <th className="p-6 text-right">Permissões</th>
                </tr>
              </thead>
              <tbody className="text-sm text-white font-bold divide-y divide-white/5">
                {listaUsuarios.map((u: any, idx: number) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${u.role === 'ADMIN' ? 'bg-emerald-500 text-[#0b1220]' : 'bg-blue-500 text-white'}`}>
                        {u.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span>{u.email}</span>
                        {/* Resumo de permissões */}
                        {u.role !== 'ADMIN' && u.permissoes && (
                           <span className="text-[9px] text-white/30 font-normal">
                             {Object.values(u.permissoes).filter(Boolean).length} Módulos Ativos
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        u.role === 'ADMIN' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}>
                        {u.role === 'ADMIN' ? 'Administrador' : 'Colaborador'}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      {/* Botões de Ação (Apenas para não-admins) */}
                      {u.role !== 'ADMIN' ? (
                        <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEditPermissions(u)} 
                            className="p-2 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-500 rounded-lg transition-all"
                            title="Editar Acessos"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.email)} 
                            className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all"
                            title="Remover Utilizador"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] text-white/20 uppercase font-bold mr-2">Acesso Total</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listaUsuarios.length === 0 && (
               <div className="p-10 text-center text-white/20 text-xs font-bold uppercase tracking-widest">Nenhum utilizador encontrado.</div>
            )}
          </div>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ffffff10; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ffffff20; }
      `}</style>
    </div>
  );
}
