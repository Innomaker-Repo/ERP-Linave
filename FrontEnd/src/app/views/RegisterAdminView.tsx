import React, { useState } from "react";

interface RegisterAdminViewProps {
  onRegister: () => void;
}

export function RegisterAdminView({ onRegister }: RegisterAdminViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("");

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    const users = JSON.parse(localStorage.getItem("users") || "[]");

    if (users.find((u: any) => u.email === email)) {
      alert("Usuário já existe");
      return;
    }

    const adminUser = {
      email,
      password,
      role: "admin",
      adminEmail: email,
    };

    users.push(adminUser);
    localStorage.setItem("users", JSON.stringify(users));

    const database = {
      empresa: {
        nome: empresa,
        email,
      },
      usuarios: [],
      clientes: [],
      funcionarios: [],
      equipes: [],
      obras: [],
      os: [],
      alocacoes: [],
      registrosHoras: [],
      folhaPagamento: [],
      financeiro: [],
      fornecedores: [],
    };

    localStorage.setItem(`db_${email}`, JSON.stringify(database));
    localStorage.setItem("currentUser", email);
    localStorage.setItem("currentAdmin", email);

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
