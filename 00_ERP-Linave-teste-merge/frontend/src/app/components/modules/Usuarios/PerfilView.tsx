import React, { useState } from 'react';
import { UserCog, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { updateUsuario, storeSession } from '../../../../services/authService';
import { PasswordStrength, senhaValida } from '../../PasswordStrength';

export function PerfilView() {
  const { userSession, setUserSession } = useErp();

  const [email, setEmail] = useState(userSession?.email || '');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  if (!userSession) return null;

  const handleSalvar = async () => {
    if (!email.trim()) {
      setMensagem({ tipo: 'erro', texto: 'E-mail é obrigatório.' });
      return;
    }
    if (senha && !senhaValida(senha)) {
      setMensagem({ tipo: 'erro', texto: 'A senha não atende aos requisitos de segurança.' });
      return;
    }
    if (senha && senha !== confirmarSenha) {
      setMensagem({ tipo: 'erro', texto: 'As senhas não coincidem.' });
      return;
    }
    setSalvando(true);
    setMensagem(null);
    try {
      const payload: any = { email: email.trim() };
      if (senha) payload.password = senha;
      const atualizado = await updateUsuario(userSession.cpf, payload);
      const novaSession = { ...userSession, email: atualizado.email || email };
      setUserSession(novaSession);
      storeSession(novaSession);
      setSenha('');
      setConfirmarSenha('');
      setMensagem({ tipo: 'sucesso', texto: 'Perfil atualizado com sucesso.' });
    } catch (e: any) {
      const detail = e?.response?.data;
      if (typeof detail === 'object') {
        const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setMensagem({ tipo: 'erro', texto: msgs.join(' | ') });
      } else {
        setMensagem({ tipo: 'erro', texto: 'Erro ao salvar.' });
      }
    } finally {
      setSalvando(false);
    }
  };

  const inputCls = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelCls = "block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1.5";

  const nivelLabel: Record<string, string> = {
    ADMIN: 'Administrador',
    GERENTE: 'Gerente',
    USUARIO: 'Usuário',
  };

  return (
    <div className="p-6 max-w-lg animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
          <UserCog size={20} />
        </div>
        <div>
          <h2 className="text-white font-black text-lg">Meu Perfil</h2>
          <p className="text-white/30 text-xs mt-0.5">Altere seu e-mail e senha de acesso</p>
        </div>
      </div>

      {/* Dados somente-leitura */}
      <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-5 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Nome</span>
          <span className="text-white font-bold text-sm">{userSession.nome}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">CPF</span>
          <span className="text-white/60 text-xs font-mono">{userSession.cpf}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Cargo</span>
          <span className="text-white/60 text-xs">{userSession.cargo || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Nível</span>
          <span className="text-amber-400 text-xs font-black uppercase tracking-widest">
            {nivelLabel[userSession.role] || userSession.role}
          </span>
        </div>
      </div>

      {/* Formulário editável */}
      <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6 space-y-5">
        {mensagem && (
          <div className={`p-3 rounded-xl border text-xs font-bold ${
            mensagem.tipo === 'sucesso'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {mensagem.texto}
          </div>
        )}

        <div>
          <label className={labelCls}>E-mail</label>
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <label className={labelCls}>Nova Senha (deixe em branco para não alterar)</label>
          <div className="relative">
            <input
              type={mostrarSenha ? 'text' : 'password'}
              className={inputCls + ' pr-12'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Nova senha"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <PasswordStrength senha={senha} />
        </div>

        {senha && (
          <div>
            <label className={labelCls}>Confirmar Nova Senha</label>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              className={inputCls}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Confirme a nova senha"
            />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0b1220] text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
