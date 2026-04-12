import React, { useState } from "react";

export function RequestAccountView({ onRequested }: { onRequested: () => void }) {
  const [email, setEmail] = useState("");

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const pending = JSON.parse(localStorage.getItem("pendingUsers") || "[]");
    pending.push({
      email,
      code,
      approved: false,
    });

    localStorage.setItem("pendingUsers", JSON.stringify(pending));

    alert(
      `Solicitação enviada!\n\nCódigo gerado: ${code}\n\nEste código deve ser validado pelo admin (admin@linave.com.br).`
    );

    onRequested();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white">
      <form
        onSubmit={handleRequest}
        className="bg-[#101f3d] p-8 rounded-2xl w-full max-w-sm space-y-4"
      >
        <h2 className="text-xl font-bold">Solicitar Conta</h2>

        <input
          type="email"
          required
          placeholder="Seu e-mail"
          className="w-full p-3 rounded-xl bg-black/20 border border-white/10"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button className="w-full p-3 rounded-xl bg-emerald-600 font-bold">
          Solicitar Acesso
        </button>
      </form>
    </div>
  );
}
