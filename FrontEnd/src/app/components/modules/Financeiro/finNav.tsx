/* =========================================================================================
 * FINANCEIRO — Navegação entre seções
 * O sidebar do ERP guarda a seção ativa no App (setActiveSection). Este contexto entrega
 * essa função às views do Financeiro, para que uma tela possa mandar o usuário para outra
 * (ex.: Contas a Receber → Solicitar NFe, já que o recebível não é mais lançado à mão).
 *
 * Fica em arquivo próprio, e não no index do módulo, para não criar import circular:
 * o index importa as views, e as views precisam importar isto.
 * =======================================================================================*/
import React, { createContext, useContext } from 'react';

// Chaves de seção do sidebar (ver SECTION_MAP no App.tsx).
export const FIN_SECTIONS = {
  dashboard: 'finDashboard',
  solicitacao: 'finSolicitacao',
  aprovacoes: 'finAprovacoes',
  pagar: 'finPagar',
  nfe: 'finNfe',
  receber: 'finReceber',
} as const;

const NavCtx = createContext<(section: string) => void>(() => {});

export function FinNavProvider({ onNavigate, children }: {
  onNavigate?: (section: string) => void;
  children: React.ReactNode;
}) {
  const navegar = React.useCallback((section: string) => onNavigate?.(section), [onNavigate]);
  return <NavCtx.Provider value={navegar}>{children}</NavCtx.Provider>;
}

/** Navega para outra seção do ERP a partir de uma view do Financeiro. */
export const useFinNavigate = () => useContext(NavCtx);
