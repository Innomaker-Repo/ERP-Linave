import React, { useState } from "react";
import { loadWorkspace, saveWorkspace, setActiveAdminEmail, ensureWorkspaceShape } from "../services/workspaceStorage";

interface RegisterAdminViewProps {
  onRegister: () => void;
}

export function RegisterAdminView({ onRegister }: RegisterAdminViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    setActiveAdminEmail(email);
    const workspace = ensureWorkspaceShape(await loadWorkspace(email));

    if (workspace.users.find((u: any) => u.email === email)) {
      alert("Usuário já existe");
      return;
    }

    const adminUser = {
      email,
      password,
      role: "admin",
      adminEmail: email,
    };

    workspace.users.push(adminUser);
    workspace.empresa = {
      nome: empresa,
      email,
    };

    await saveWorkspace(email, workspace);
    setActiveAdminEmail(email);

    onRegister();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white">
      <form
        onSubmit={handleRegister}
        className="bg-[#101f3d] p-8 rounded-2xl w-full max-w-sm space-y-4"
      >
        <h2 className="text-xl font-bold">Cadastro do Admin</h2>

        <input
          type="text"
          placeholder="Nome da Empresa"
          className="w-full p-3 rounded-xl bg-black/20 border border-white/10"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="E-mail do Admin"
          className="w-full p-3 rounded-xl bg-black/20 border border-white/10"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Senha"
          className="w-full p-3 rounded-xl bg-black/20 border border-white/10"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="w-full p-3 rounded-xl bg-emerald-600 font-bold">
          Criar Empresa
        </button>
      </form>
    </div>
  );
}
