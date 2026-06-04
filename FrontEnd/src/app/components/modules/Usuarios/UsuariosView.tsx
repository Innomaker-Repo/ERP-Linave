import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Key, Info } from 'lucide-react';

// Abas/áreas do sistema que um departamento pode acessar (colunas da matriz).
const ABAS_PERMISSAO = [
  { id: 'comercial', label: 'Comercial' },
  { id: 'engenharia', label: 'Engenharia' },
  { id: 'operacao', label: 'Operação' },
  { id: 'admin', label: 'Admin' },
];

const normalizar = (valor: string) =>
  String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export function UsuariosView() {
  const { listas } = useErp();

  // Linhas da matriz = departamentos cadastrados na aba Departamentos.
  const departamentos: string[] = Array.isArray(listas?.departamentos) ? listas.departamentos : [];

  // Estado local apenas das células alteradas manualmente (visual; ainda não persiste).
  const [permissoesAbas, setPermissoesAbas] = useState<Record<string, Record<string, boolean>>>({});

  // Padrão quando o admin ainda não mexeu na célula:
  // - departamento "Admin" acessa todas as abas;
  // - os demais já vêm marcados na aba de mesmo nome (ex.: Comercial -> Comercial).
  const padraoChecado = (departamento: string, abaLabel: string) => {
    const nd = normalizar(departamento);
    if (nd === 'admin') return true;
    return nd === normalizar(abaLabel);
  };

  const estaChecado = (departamento: string, abaId: string, abaLabel: string) => {
    const explicito = permissoesAbas[departamento]?.[abaId];
    if (explicito !== undefined) return explicito;
    return padraoChecado(departamento, abaLabel);
  };

  const toggleAbaPermissao = (departamento: string, abaId: string, abaLabel: string) => {
    // Admin sempre mantém acesso à própria aba Admin.
    if (normalizar(departamento) === 'admin' && abaId === 'admin') return;
    const atual = estaChecado(departamento, abaId, abaLabel);
    setPermissoesAbas((prev) => ({
      ...prev,
      [departamento]: { ...(prev[departamento] || {}), [abaId]: !atual },
    }));
  };

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      {/* MATRIZ DE PERMISSÕES DE ABAS (visual) */}
      <div className="bg-[#101f3d] p-8 rounded-[48px] border border-white/5">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-white font-black text-lg flex items-center gap-2">
              <Key size={18} className="text-purple-500" /> Permissões de abas
            </h3>
            <p className="text-white/40 text-xs mt-1">Defina quais abas cada departamento acessa. As linhas vêm da aba Departamentos. (Visual — ainda não aplicado.)</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-full">Admin</span>
        </div>

        <div className="bg-[#0b1220] rounded-[24px] overflow-hidden border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[9px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
              <tr>
                <th className="p-5">Usuário / Perfil</th>
                {ABAS_PERMISSAO.map((aba) => (
                  <th key={aba.id} className="p-5 text-center">{aba.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {departamentos.length === 0 ? (
                <tr>
                  <td colSpan={ABAS_PERMISSAO.length + 1} className="p-10 text-center">
                    <p className="inline-flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
                      <Info size={14} /> Nenhum departamento cadastrado. Adicione na aba Departamentos.
                    </p>
                  </td>
                </tr>
              ) : (
                departamentos.map((departamento, idx) => (
                  <tr key={`${departamento}-${idx}`} className="hover:bg-white/5 transition-colors">
                    <td className="p-5">
                      <p className="text-white font-bold text-sm">{departamento}</p>
                      <p className="text-white/30 text-[11px] mt-0.5">Permissões de acesso às abas</p>
                    </td>
                    {ABAS_PERMISSAO.map((aba) => {
                      const travado = normalizar(departamento) === 'admin' && aba.id === 'admin';
                      const checado = estaChecado(departamento, aba.id, aba.label);
                      return (
                        <td key={aba.id} className="p-5 text-center">
                          <input
                            type="checkbox"
                            checked={checado}
                            disabled={travado}
                            onChange={() => toggleAbaPermissao(departamento, aba.id, aba.label)}
                            className="h-5 w-5 accent-purple-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
