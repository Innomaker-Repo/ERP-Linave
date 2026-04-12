import React from 'react';
import { useErp } from '../context/ErpContext';
import { Search, Bell, UserCircle } from 'lucide-react';

interface HeaderProps {
  activeSection: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function Header({ activeSection, searchQuery, setSearchQuery }: HeaderProps) {
  const { userSession, empresa } = useErp();

  return (
    <header className="h-20 border-b border-white/5 bg-[#0b1220] flex items-center justify-between px-8">
      <div className="flex items-center gap-8 flex-1">
        <h1 className="text-white font-black uppercase tracking-tighter text-xl">
          {activeSection}
        </h1>
        
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar no sistema..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 p-3 pl-12 rounded-2xl text-white text-xs outline-none focus:border-amber-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-white font-black text-xs uppercase">{empresa?.nome || 'Linave'}</p>
          <p className="text-amber-500 font-bold text-[10px] uppercase tracking-widest">
            {userSession?.email === 'rebeca.carvalho@gmail.com' ? 'UFF ADMIN' : 'COLABORADOR'}
          </p>
        </div>
        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20">
          <UserCircle size={24} />
        </div>
      </div>
    </header>
  );
}
