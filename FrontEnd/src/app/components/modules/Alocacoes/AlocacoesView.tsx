import React from "react";
import { loadDatabase, saveDatabase } from "@/app/utils/db";
import { generateAlocacaoId } from "@/app/utils/idGenerator";

export function AlocacoesView() {
  const db = loadDatabase();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const data = new FormData(form);

    const funcionarioId = data.get("funcionarioId") as string;
    const obraId = (data.get("obraId") as string) || "";
    const osId = (data.get("osId") as string) || "";

    if (!funcionarioId) {
      alert("Selecione um funcionário.");
      return;
    }
    if (!obraId && !osId) {
      alert("Selecione uma Obra/Serviço ou uma OS.");
      return;
    }

    const dbNow = loadDatabase();
    const alocacaoId = generateAlocacaoId(dbNow);

    const alocacao = {
      id: alocacaoId,
      funcionarioId,
      obraId: obraId || null,
      osId: osId || null,
      dataInicio: data.get("inicio"),
      dataFim: data.get("fim") || null,
      status: "Ativa",
      criadoEm: new Date().toISOString(),
    };

    dbNow.alocacoes.push(alocacao);
    saveDatabase(dbNow);

    alert(`Alocação criada: ${alocacaoId}`);
    form.reset();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Alocação de Funcionário</h2>
        <p className="text-sm text-white/50">
          Vincule um funcionário a uma Obra/Serviço e/ou a uma OS.
        </p>
      </div>

      <section className="bg-gradient-to-b from-[#101f3d]/85 to-[#0e1a32]/72 border border-white/10 rounded-3xl p-6 shadow-2xl max-w-3xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Funcionário *</label>
            <select name="funcionarioId" className="input" required>
              <option value="">Selecione</option>
              {db.funcionarios.map((f: any) => (
                <option key={f.matricula || f.cpf || f.nome} value={f.matricula || f.cpf || f.nome}>
                  {(f.matricula ? `${f.matricula} — ` : "")}{f.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Obra / Serviço (opcional)</label>
            <select name="obraId" className="input">
              <option value="">Selecione</option>
              {db.obras.map((o: any) => (
                <option key={o.id || o.nome} value={o.id || o.nome}>
                  {(o.id ? `${o.id} — ` : "")}{o.nome || o.titulo || "Obra"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">OS (opcional)</label>
            <select name="osId" className="input">
              <option value="">Selecione</option>
              {db.os.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.id}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Data de início *</label>
              <input type="date" name="inicio" className="input" required />
            </div>
            <div>
              <label className="label">Data de fim (opcional)</label>
              <input type="date" name="fim" className="input" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="reset" className="btn-secondary">Cancelar</button>
            <button className="btn-primary">Salvar Alocação</button>
          </div>
        </form>
      </section>
    </div>
  );
}
