import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, X, Check, Shield, ShieldOff, Loader2 } from 'lucide-react';
import { fetchUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../../../../services/authService';

interface Usuario {
  cpf: string;
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
}

const EMPTY_FORM: Omit<Usuario, 'is_staff' | 'is_superuser' | 'is_active'> & { password: string } = {
  cpf: '',
  nome: '',
  email: '',
  cargo: '',
  departamento: '',
  password: '',
};

export function UsuariosView() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const carregarUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await fetchUsuarios();
      setUsuarios(lista);
    } catch (e) {
      setErro('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarUsuarios(); }, [carregarUsuarios]);

  const abrirCriar = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setErro('');
    setModalAberto(true);
  };

  const abrirEditar = (u: Usuario) => {
    setEditando(u);
    setForm({
      cpf: u.cpf,
      nome: u.nome,
      email: u.email,
      cargo: u.cargo,
      departamento: u.departamento,
      password: '',
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setErro('');
  };

  const handleSalvar = async () => {
    if (!form.cpf.trim()) { setErro('CPF é obrigatório.'); return; }
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return; }
    setErro('');
    setSalvando(true);
    try {
      const payload: any = {
        cpf: form.cpf.trim(),
        nome: form.nome.trim(),
        email: form.email.trim(),
        cargo: form.cargo.trim(),
        departamento: form.departamento.trim(),
      };
      if (form.password) payload.password = form.password;

      if (editando) {
        const atualizado = await updateUsuario(editando.cpf, payload);
        setUsuarios((prev) => prev.map((u) => (u.cpf === editando.cpf ? atualizado : u)));
      } else {
        if (!form.password) { setErro('Senha é obrigatória para novo usuário.'); setSalvando(false); return; }
        const criado = await createUsuario(payload);
        setUsuarios((prev) => [...prev, criado]);
      }
      fecharModal();
    } catch (e: any) {
      const detail = e?.response?.data;
      if (typeof detail === 'object') {
        const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setErro(msgs.join(' | '));
      } else {
        setErro('Erro ao salvar usuário.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (u: Usuario) => {
    if (u.is_superuser) { alert('Não é possível excluir o administrador principal.'); return; }
    if (!confirm(`Excluir usuário "${u.nome}" (${u.cpf})?`)) return;
    try {
      await deleteUsuario(u.cpf);
      setUsuarios((prev) => prev.filter((x) => x.cpf !== u.cpf));
    } catch {
      alert('Erro ao excluir usuário.');
    }
  };

  const inputCls = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelCls = "block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1.5";

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-white font-black text-lg">Usuários do Sistema</h2>
            <p className="text-white/30 text-xs mt-0.5">{usuarios.length} cadastrado{usuarios.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={abrirCriar}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0b1220] px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
        >
          <Plus size={15} /> Novo Usuário
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-[#101f3d] rounded-[28px] border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-white/40">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest">Carregando...</span>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/30">
            <Users size={32} />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[9px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
              <tr>
                <th className="p-4">CPF</th>
                <th className="p-4">Nome</th>
                <th className="p-4">Cargo</th>
                <th className="p-4">Departamento</th>
                <th className="p-4">Email</th>
                <th className="p-4 text-center">Nível</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {usuarios.map((u) => (
                <tr key={u.cpf} className="hover:bg-white/3 transition-colors">
                  <td className="p-4 text-white/60 text-xs font-mono">{u.cpf}</td>
                  <td className="p-4">
                    <p className="text-white font-bold text-sm">{u.nome}</p>
                  </td>
                  <td className="p-4 text-white/50 text-xs">{u.cargo || '—'}</td>
                  <td className="p-4 text-white/50 text-xs">{u.departamento || '—'}</td>
                  <td className="p-4 text-white/50 text-xs">{u.email || '—'}</td>
                  <td className="p-4 text-center">
                    {u.is_superuser ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                        <Shield size={10} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                        <ShieldOff size={10} /> Usuário
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 text-white/40 hover:text-amber-400 transition-all"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      {!u.is_superuser && (
                        <button
                          onClick={() => handleExcluir(u)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101f3d] border border-white/10 rounded-[28px] w-full max-w-lg shadow-2xl">

            {/* Header modal */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                  <Users size={16} />
                </div>
                <h3 className="text-white font-black text-base">
                  {editando ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
              </div>
              <button onClick={fecharModal} className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Body modal */}
            <div className="p-6 space-y-4">
              {erro && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-xs font-bold">{erro}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>CPF *</label>
                  <input
                    className={inputCls}
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                    disabled={!!editando}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Nome *</label>
                  <input
                    className={inputCls}
                    placeholder="Nome completo"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  />
                </div>

                <div>
                  <label className={labelCls}>Cargo</label>
                  <input
                    className={inputCls}
                    placeholder="Ex.: Analista"
                    value={form.cargo}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  />
                </div>

                <div>
                  <label className={labelCls}>Departamento</label>
                  <input
                    className={inputCls}
                    placeholder="Ex.: Comercial"
                    value={form.departamento}
                    onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="email@empresa.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>
                    {editando ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha *'}
                  </label>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder={editando ? 'Nova senha (opcional)' : 'Senha inicial'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Footer modal */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
              <button
                onClick={fecharModal}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0b1220] text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editando ? 'Salvar' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
