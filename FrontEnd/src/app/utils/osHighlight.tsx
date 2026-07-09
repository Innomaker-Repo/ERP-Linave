import React from 'react';

// Realça o acrônimo "OS" (ordem de serviço) no amarelo do tema/logo Linave, para deixar claro
// que é uma sigla. Casa apenas "OS" isolado (\bOS\b) — não pega substrings como "custos"/"OSView".
// Aceita ReactNode e repassa qualquer coisa que não seja string sem alterar (uso defensivo).
export const boldOS = (texto: React.ReactNode): React.ReactNode => {
  if (typeof texto !== 'string') return texto;
  return texto.split(/(\bOS\b)/g).map((parte, i) =>
    parte === 'OS' ? <strong key={i} className="font-black text-amber-400">OS</strong> : parte,
  );
};
