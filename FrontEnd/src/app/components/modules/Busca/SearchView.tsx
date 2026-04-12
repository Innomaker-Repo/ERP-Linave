import React, { useMemo } from "react";
import { Section } from "../../../App";

interface SearchViewProps {
  query: string;
}

export function SearchView({ query }: SearchViewProps) {
  const currentUser = localStorage.getItem("currentUser");
  const admin = localStorage.getItem("currentAdmin");

  if (!currentUser || !admin) return null;

  const db = JSON.parse(localStorage.getItem(`db_${admin}`) || "{}");

  const isAdmin = currentUser === admin;

  const permissoes: Record<Section, boolean> = isAdmin
    ? {
        dashboard: true,
        clientes: true,
        funcionarios: true,
        equipes: true,
        obras: true,
        os: true,
        alocacoes: true,
        horas: true,
        folha: true,
        financeiro: true,
        relatorios: true,
        busca: true,
      }
    : db.usuarios?.find((u: any) => u.email === currentUser)
        ?.permissoes || {};

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    const items: any[] = [];

    function search(
      section: Section,
      list: any[],
      label: (i: any) => string
    ) {
      if (!permissoes[section]) return;
      list.forEach((item) => {
        if (JSON.stringify(item).toLowerCase().includes(q)) {
          items.push({
            section,
            label: label(item),
          });
        }
      });
    }

    search("clientes", db.clientes || [], (c) => c.nome || c.razaoSocial);
    search("funcionarios", db.funcionarios || [], (f) => f.nome);
    search("obras", db.obras || [], (o) => o.nome);
    search("os", db.os || [], (o) => o.id);
    search("financeiro", db.financeiro || [], (f) => f.descricao);

    return items;
  }, [query, permissoes, db]);

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-bold">
        Resultados para: “{query}”
      </h2>

      {results.length === 0 && (
        <div className="text-sm text-white/40">
          Nenhum resultado encontrado.
        </div>
      )}

      {results.map((r, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-[#101f3d]/70 border border-white/10"
        >
          <div className="text-[11px] uppercase tracking-wider text-amber-400">
            {r.section}
          </div>
          <div className="text-sm">{r.label}</div>
        </div>
      ))}
    </div>
  );
}
