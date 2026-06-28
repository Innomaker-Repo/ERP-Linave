import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, RefreshCw, LogIn, Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../../../../services/api';

interface LogEntry {
  id: number;
  usuario_cpf: string;
  usuario_nome: string;
  acao: 'login' | 'criacao' | 'atualizacao' | 'exclusao';
  acao_display: string;
  modulo: string;
  descricao: string;
  timestamp: string;
  timestamp_fmt: string;
}

const ACAO_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  login:      { icon: <LogIn size={12} />,   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20' },
  criacao:    { icon: <Plus size={12} />,     color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20' },
  atualizacao:{ icon: <Edit2 size={12} />,    color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20' },
  exclusao:   { icon: <Trash2 size={12} />,   color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20' },
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

export function LogAtividadesView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [dataInicio, setDataInicio] = useState(thirtyDaysAgo());
  const [dataFim, setDataFim] = useState(today());
  const [filtroTexto, setFiltroTexto] = useState('');

  const buscarLogs = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const params: Record<string, string> = {};
      if (dataInicio) params.data_inicio = dataInicio;
      if (dataFim) params.data_fim = dataFim;
      const res = await api.get('logs/', { params });
      setLogs(res.data);
    } catch (e: any) {
      setErro('Erro ao carregar os logs. Verifique a conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    buscarLogs();
  }, [buscarLogs]);

  const logsFiltrados = filtroTexto
    ? logs.filter(l =>
        l.usuario_nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        l.usuario_cpf.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        l.modulo.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        l.descricao.toLowerCase().includes(filtroTexto.toLowerCase())
      )
    : logs;

  const inputCls = 'bg-[#0b1220] border border-white/10 p-2.5 rounded-xl text-white text-xs outline-none focus:border-amber-500 transition-all';
  const labelCls = 'block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1';

  return (
    <div className="p-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
          <History size={20} />
        </div>
        <div>
          <h2 className="text-white font-black text-lg">Log de Atividades</h2>
          <p className="text-white/30 text-xs mt-0.5">Histórico completo de alterações do sistema</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Data início</label>
            <input type="date" className={inputCls + ' w-full'} value={dataInicio}
              onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data fim</label>
            <input type="date" className={inputCls + ' w-full'} value={dataFim}
              onChange={e => setDataFim(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                className={inputCls + ' w-full pl-8'}
                placeholder="Usuário, módulo ou descrição..."
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={buscarLogs}
            disabled={carregando}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0b1220] text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
            {carregando ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {erro && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
          {erro}
        </div>
      )}

      <div className="bg-[#101f3d] rounded-2xl border border-white/5 overflow-hidden">
        {/* Cabeçalho da tabela */}
        <div className="grid grid-cols-[120px_1fr_100px_1fr_1fr] gap-3 px-5 py-3 border-b border-white/5">
          {['Data/Hora', 'Usuário', 'Ação', 'Módulo', 'Descrição'].map(h => (
            <span key={h} className="text-white/30 text-[10px] font-bold uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {/* Linhas */}
        {carregando ? (
          <div className="py-16 text-center text-white/30 text-sm">Carregando...</div>
        ) : logsFiltrados.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[calc(100vh-360px)] overflow-y-auto">
            {logsFiltrados.map(log => {
              const cfg = ACAO_CONFIG[log.acao] || ACAO_CONFIG.atualizacao;
              return (
                <div key={log.id} className="grid grid-cols-[120px_1fr_100px_1fr_1fr] gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors items-center">
                  <span className="text-white/40 text-[10px] font-mono">{log.timestamp_fmt}</span>
                  <div>
                    <p className="text-white text-xs font-bold truncate">{log.usuario_nome || '—'}</p>
                    <p className="text-white/30 text-[10px] font-mono">{log.usuario_cpf}</p>
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
                      {cfg.icon}
                      {log.acao_display}
                    </span>
                  </div>
                  <span className="text-white/60 text-xs truncate">{log.modulo}</span>
                  <span className="text-white/40 text-xs truncate" title={log.descricao}>{log.descricao}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé com contagem */}
        {!carregando && logsFiltrados.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 flex justify-between items-center">
            <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
              {logsFiltrados.length} registro{logsFiltrados.length !== 1 ? 's' : ''}
              {filtroTexto ? ' (filtrado)' : ''}
            </span>
            {logs.length >= 500 && (
              <span className="text-amber-400/60 text-[10px]">Exibindo últimos 500 registros.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
