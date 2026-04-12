import React, { useState } from "react";

export function ApproveUsersView() {
  const [pending, setPending] = useState(
    JSON.parse(localStorage.getItem("pendingUsers") || "[]")
  );

  function approve(email: string) {
    const updated = pending.map((p: any) =>
      p.email === email ? { ...p, approved: true } : p
    );

    localStorage.setItem("pendingUsers", JSON.stringify(updated));
    setPending(updated);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="text-xl font-bold">Aprovação de Usuários</h2>

      {pending.map((p: any) => (
        <div
          key={p.email}
          className="p-4 rounded-xl bg-[#101f3d]/70 border border-white/10 flex justify-between"
        >
          <div>
            <div>{p.email}</div>
            <div className="text-xs text-white/40">Código: {p.code}</div>
          </div>

          {!p.approved && (
            <button
              onClick={() => approve(p.email)}
              className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400"
            >
              Aprovar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
