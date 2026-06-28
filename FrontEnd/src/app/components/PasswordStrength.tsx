import React from 'react';
import { Check, X } from 'lucide-react';

export interface PasswordRequisito {
  label: string;
  ok: boolean;
}

export function avaliarSenha(senha: string): PasswordRequisito[] {
  return [
    { label: 'Mínimo de 8 caracteres', ok: senha.length >= 8 },
    { label: 'Letra maiúscula (A-Z)', ok: /[A-Z]/.test(senha) },
    { label: 'Letra minúscula (a-z)', ok: /[a-z]/.test(senha) },
    { label: 'Caractere especial (!@#$%...)', ok: /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(senha) },
  ];
}

export function senhaValida(senha: string): boolean {
  return avaliarSenha(senha).every((r) => r.ok);
}

interface Props {
  senha: string;
}

export function PasswordStrength({ senha }: Props) {
  if (!senha) return null;

  const requisitos = avaliarSenha(senha);
  const cumpridos = requisitos.filter((r) => r.ok).length;
  const total = requisitos.length;

  const nivelCor =
    cumpridos <= 1 ? 'bg-red-500' :
    cumpridos <= 2 ? 'bg-orange-500' :
    cumpridos <= 3 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <div className="mt-2 space-y-2">
      {/* Barra de força */}
      <div className="flex gap-1">
        {requisitos.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < cumpridos ? nivelCor : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Checklist de requisitos */}
      <div className="grid grid-cols-1 gap-1">
        {requisitos.map((req) => (
          <div key={req.label} className="flex items-center gap-2">
            {req.ok
              ? <Check size={11} className="text-green-400 shrink-0" />
              : <X size={11} className="text-red-400/60 shrink-0" />}
            <span className={`text-[11px] ${req.ok ? 'text-green-400' : 'text-white/30'}`}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
