import React from 'react';
import { Search, LogOut, User } from 'lucide-react';

export function Topbar({ meta, onSearch, onLogout }: any) {
  return (
    <header className="h-24 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b1220]">
      <div className="flex flex-col">
        <h2 className="text-lg font-black text-white tracking-tight uppercase">{meta.title}</h2>
        <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <input 
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Pesquisar no Drive..." 
            className="w-80 bg-[#101f3d] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-amber-500/30"
          />
        </div>

        <div className="flex items-center gap-4 pl-6 border-l border-white/5">
          <div className="text-right">
            <p className="text-xs font-bold text-white uppercase">Rebeca</p>
            <p className="text-[9px] text-white/20 font-mono">UFF ADMIN</p>
          </div>
          <button onClick={onLogout} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
