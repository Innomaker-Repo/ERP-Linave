import React, { useState } from "react";
import { ensureWorkspaceShape, getActiveAdminEmail, loadWorkspace, saveWorkspace, setActiveAdminEmail } from "../services/workspaceStorage";

export function RegisterUserView({ onFinish }: { onFinish: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    const adminEmail = getActiveAdminEmail();
    setActiveAdminEmail(adminEmail);
    const workspace = ensureWorkspaceShape(await loadWorkspace(adminEmail));
    const pending = workspace.pendingUsers || [];
    const match = pending.find(
      (p: any) => p.email === email && p.code === code && p.approved
    );

    if (!match) {
      alert("Código inválido ou ainda não aprovado.");
      return;
    }

    const users = workspace.users || [];
    users.push({
      email,
      password,
      role: "user",
      adminEmail,
    });

    workspace.users = users;
    await saveWorkspace(adminEmail, workspace);
    onFinish();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white">
      <form
        onSubmit={handleRegister}
        className="bg-[#101f3d] p-8 rounded-2xl w-full max-w-sm space-y-4"
      >
        <h2 className="text-xl font-bold">Finalizar Cadastro</h2>

        <input
          placeholder="E-mail"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded-xl bg-black/20 border border-white/10"
        />

        <input
          placeholder="Código de aprovação"
          value={code}
          required
          onChange={(e) => setCode(e.target.value)}
          className="w-full p-3 rounded-xl bg-black/20 border border-white/10"
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded-xl bg-black/20 border border-white/10"
        />

        <button className="w-full p-3 rounded-xl bg-emerald-600 font-bold">
          Criar Conta
        </button>
      </form>
    </div>
  );
}
