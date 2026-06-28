import React, { useState } from 'react';
import { ShieldCheck, LogIn, Lock, ArrowLeft, ChevronRight, User } from 'lucide-react';
import { login } from '../../services/authService';

const inputBaseClasses =
  "w-full bg-[#0b1220] border border-white/10 p-4 pl-12 rounded-2xl text-white text-sm outline-none focus:border-amber-500 focus:bg-[#0f1829] transition-all placeholder:text-white/20";
const btnPrimaryClasses =
  "w-full bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/30 active:scale-95 border border-emerald-400 flex items-center justify-center gap-2";

export function LoginPage({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [step, setStep] = useState<'inicial' | 'entrar'>('inicial');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async () => {
    if (!cpf || !senha) {
      setErro('Preencha todos os campos.');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      const session = await login(cpf.trim(), senha);
      onLoginSuccess(session);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setErro(detail || 'CPF ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen bg-[#050a14] flex items-center justify-center p-4 font-sans relative overflow-hidden">

      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-amber-500/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      <div className="w-full max-w-5xl bg-[#101f3d]/60 backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-2xl flex flex-col md:flex-row overflow-hidden relative z-10 transition-all duration-500">

        {/* Branding */}
        <div className="md:w-5/12 p-12 bg-gradient-to-br from-[#0b1220]/90 to-[#101f3d]/90 flex flex-col justify-between border-r border-white/5 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center font-black text-[#0b1220] text-xl shadow-lg shadow-amber-500/20">
                IN
              </div>
              <span className="text-white font-black uppercase tracking-tighter text-2xl italic">Linave</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
              Gestão <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-blue-500">
                Inteligente
              </span>
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs font-medium">
              Sistema de gestão empresarial integrado.
            </p>
          </div>

          <div className="mt-12 md:mt-0 space-y-3 relative z-10">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wide">Acesso Seguro</p>
                <p className="text-[10px] text-white/40">Autenticação JWT</p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="md:w-7/12 p-12 flex flex-col justify-center relative bg-[#0b1220]/40">

          {step !== 'inicial' && (
            <button
              onClick={() => { setStep('inicial'); setErro(''); }}
              className="absolute top-8 left-8 text-white/30 hover:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:-translate-x-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          )}

          <div className="max-w-xs mx-auto w-full animate-in fade-in slide-in-from-right-4 duration-500">

            {step === 'inicial' && (
              <div className="space-y-5">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white">Bem-vindo</h3>
                  <p className="text-white/40 text-xs mt-2 uppercase tracking-wider font-medium">
                    Faça login para acessar o sistema
                  </p>
                </div>

                <button
                  onClick={() => setStep('entrar')}
                  className="group w-full p-1 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:to-amber-400 transition-all shadow-lg shadow-amber-900/50 hover:shadow-amber-500/20"
                >
                  <div className="bg-[#0b1220] hover:bg-[#131f32] p-4 rounded-[14px] flex items-center gap-4 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <LogIn size={20} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-white font-bold text-sm">Entrar</p>
                      <p className="text-amber-500/60 text-[10px] font-bold uppercase tracking-wide">
                        Acesso com CPF
                      </p>
                    </div>
                    <ChevronRight className="text-white/10 group-hover:text-amber-500 transition-colors" size={16} />
                  </div>
                </button>
              </div>
            )}

            {step === 'entrar' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-4">
                    <LogIn size={24} />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Login</h3>
                  <p className="text-white/40 text-xs mt-2">Informe seu CPF e senha</p>
                </div>

                {erro && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                    <p className="text-red-400 text-xs font-bold">{erro}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="relative group">
                    <User
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors"
                      size={18}
                    />
                    <input
                      placeholder="CPF"
                      className={inputBaseClasses}
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                  </div>
                  <div className="relative group">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors"
                      size={18}
                    />
                    <input
                      type="password"
                      placeholder="Senha"
                      className={inputBaseClasses}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className={btnPrimaryClasses}
                  >
                    {loading ? 'Autenticando...' : 'Entrar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
