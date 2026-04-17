import React, { useState } from 'react';
import { ShieldCheck, UserPlus, LogIn, Mail, Lock, ArrowLeft, Send, CheckCircle, ChevronRight, Briefcase } from 'lucide-react';
import { useErp } from '../context/ErpContext';

export function LoginPage({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const { loginDireto } = useErp();
  
  const [step, setStep] = useState<'inicial' | 'entrar' | 'novo_usuario'>('inicial');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  // Login simples - apenas local, sem backend
  const handleLogin = () => {
    if (!email || !senha) return alert("Preencha todos os campos.");
    
    // Login de teste com admin/admin
    if (email === 'admin' && senha === 'admin') {
      loginDireto({ email: 'admin', role: 'ADMIN', nome: 'Administrador' });
      onLoginSuccess({ email: 'admin', role: 'ADMIN', nome: 'Administrador' });
      return;
    }
    
    // Login normal requer email válido
    if (!email.includes('@')) return alert("Email inválido.");
    
    // Login simulado - apenas salva localmente
    loginDireto({ email, role: 'USER', nome: email.split('@')[0] });
    onLoginSuccess({ email, role: 'USER' });
  };

  // Criar novo usuário - apenas local
  const handleCriarUsuario = () => {
    if (!email || !senha) return alert("Preencha todos os campos.");
    if (!email.includes('@')) return alert("Email inválido.");
    
    // Cria usuário local
    loginDireto({ email, role: 'USER', nome: email.split('@')[0] });
    onLoginSuccess({ email, role: 'USER' });
  };

  // --- ESTILOS VISUAIS ---
  const inputBaseClasses = "w-full bg-[#0b1220] border border-white/10 p-4 pl-12 rounded-2xl text-white text-sm outline-none focus:border-amber-500 focus:bg-[#0f1829] transition-all placeholder:text-white/20";
  const btnPrimaryClasses = "w-full bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/30 active:scale-95 border border-emerald-400 flex items-center justify-center gap-2";

  return (
    <div className="min-h-screen bg-[#050a14] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-amber-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>
      </div>

      <div className="w-full max-w-5xl bg-[#101f3d]/60 backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-2xl flex flex-col md:flex-row overflow-hidden relative z-10 transition-all duration-500">
        
        {/* LADO ESQUERDO: Branding */}
        <div className="md:w-5/12 p-12 bg-gradient-to-br from-[#0b1220]/90 to-[#101f3d]/90 flex flex-col justify-between border-r border-white/5 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center font-black text-[#0b1220] text-xl shadow-lg shadow-amber-500/20">IN</div>
              <span className="text-white font-black uppercase tracking-tighter text-2xl italic">Linave</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
              Gestão <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-blue-500">Inteligente</span>
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs font-medium">
              [VERSÃO DE TESTE] Frontend demonstrativo. Backend desabilitado.
            </p>
          </div>
          
          <div className="mt-12 md:mt-0 space-y-3 relative z-10">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4 group hover:bg-white/10 transition-colors">
              <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400"><ShieldCheck size={20} /></div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wide">Modo Teste</p>
                <p className="text-[10px] text-white/40">Sem Conexão Backend</p>
              </div>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Formulários */}
        <div className="md:w-7/12 p-12 flex flex-col justify-center relative bg-[#0b1220]/40">
          
          {step !== 'inicial' && (
            <button 
              onClick={() => setStep('inicial')} 
              className="absolute top-8 left-8 text-white/30 hover:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:-translate-x-1"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          )}

          <div className="max-w-xs mx-auto w-full animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* TELA INICIAL */}
            {step === 'inicial' && (
              <div className="space-y-5">
                <div className="text-center mb-8">
                   <h3 className="text-2xl font-bold text-white">Bem-vindo</h3>
                   <p className="text-white/40 text-xs mt-2 uppercase tracking-wider font-medium">Selecione como deseja aceder</p>
                </div>
                
                <button onClick={() => setStep('entrar')} className="group w-full p-1 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:to-amber-400 transition-all shadow-lg shadow-amber-900/50 hover:shadow-amber-500/20">
                  <div className="bg-[#0b1220] hover:bg-[#131f32] p-4 rounded-[14px] flex items-center gap-4 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <LogIn size={20} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-white font-bold text-sm">Login</p>
                      <p className="text-amber-500/60 text-[10px] font-bold uppercase tracking-wide">Já tenho conta</p>
                    </div>
                    <ChevronRight className="text-white/10 group-hover:text-amber-500 transition-colors" size={16} />
                  </div>
                </button>

                <button onClick={() => setStep('novo_usuario')} className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:text-blue-300">
                     <UserPlus size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">Criar Conta</p>
                    <p className="text-white/30 text-[10px] uppercase font-bold tracking-wide">Novo Usuário</p>
                  </div>
                </button>
              </div>
            )}

            {/* FLUXO: NOVO USUÁRIO */}
            {step === 'novo_usuario' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-4"><UserPlus size={24} /></div>
                  <h3 className="text-xl font-bold text-white">Criar Conta</h3>
                  <p className="text-white/40 text-xs mt-2">(Versão de teste - dados locais)</p>
                </div>
                <div className="space-y-3">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input placeholder="Seu E-mail" className={inputBaseClasses} value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input type="password" placeholder="Criar Senha" className={inputBaseClasses} value={senha} onChange={e => setSenha(e.target.value)} />
                  </div>
                  <button onClick={handleCriarUsuario} className={`${btnPrimaryClasses} bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20`}>Criar Acesso</button>
                </div>
              </div>
            )}

            {/* FLUXO: ENTRAR */}
            {step === 'entrar' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-4"><LogIn size={24} /></div>
                  <h3 className="text-2xl font-bold text-white">Login</h3>
                  <p className="text-white/40 text-xs mt-2">Acesse o painel(versão teste)</p>
                </div>
                
                {/* Dica de credenciais de teste */}
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
                  <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Credenciais de Teste</p>
                  <p className="text-yellow-400/70 text-xs mt-1">Usuário: <span className="font-mono font-bold">admin</span> | Senha: <span className="font-mono font-bold">admin</span></p>
                </div>
                
                <div className="space-y-4">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors" size={18} />
                    <input placeholder="E-mail" className={inputBaseClasses} value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors" size={18} />
                    <input type="password" placeholder="Senha" className={inputBaseClasses} value={senha} onChange={e => setSenha(e.target.value)} />
                  </div>
                  <button onClick={handleLogin} disabled={loading} className={btnPrimaryClasses}>{loading ? "Autenticando..." : "Entrar"}</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
