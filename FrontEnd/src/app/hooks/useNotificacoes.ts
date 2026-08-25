import { useEffect, useMemo, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { matchesSolicitante as matchesSolicitanteFin, money } from '../components/modules/Financeiro/finData';
import { toItemRecords, matchesSolicitante as matchesSolicitanteCompra } from '../components/modules/Compras/comprasLocal';

/* =========================================================================================
 * NOTIFICAÇÕES — sino do cabeçalho.
 * Sem tabela própria no backend: deriva "eventos que valem notificação" a partir do que já
 * existe (financeiro + histórico de compras), só do que pertence ao usuário logado. O estado
 * "visto" fica no localStorage, por usuário (cpf/e-mail), pra sobreviver a reload sem precisar
 * de backend novo — a contagem no sino é só o que ainda não foi visto.
 * =======================================================================================*/

export interface Notificacao {
  id: string;
  titulo: string;
  data: string;
  destino: string;
}

// Prefixo "notif." (não "erp.notificacoes..."): clearLegacyCommercialLocalStorage() (main.tsx)
// apaga toda chave que bater com /workspace|linave|comercial|crm|erp/i a cada carregamento —
// "erp" no começo cairia nessa varredura e o "visto" seria perdido a cada F5.
const chaveVistos = (userSession: any): string => {
  const ident = userSession?.cpf || userSession?.email || 'anonimo';
  return `notif.vistos.${ident}`;
};

const lerVistos = (chave: string): Set<string> => {
  try {
    const raw = localStorage.getItem(chave);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

export function useNotificacoes() {
  const { userSession, financeiro, comprasHistorico } = useErp() as any;
  const chave = chaveVistos(userSession);
  const [vistos, setVistos] = useState<Set<string>>(() => lerVistos(chave));

  // Troca de usuário (login diferente no mesmo navegador) — recarrega o set certo.
  useEffect(() => {
    setVistos(lerVistos(chave));
  }, [chave]);

  const notificacoes = useMemo<Notificacao[]>(() => {
    if (!userSession) return [];

    const pagamentos: Notificacao[] = (Array.isArray(financeiro) ? financeiro : [])
      .filter((r: any) => r?.tipo === 'solicitacao'
        && (r.status === 'Aprovado' || r.status === 'Reprovado')
        && matchesSolicitanteFin(r, userSession))
      .map((r: any) => ({
        id: `pagamento-${r.id}-${r.status}`,
        titulo: r.status === 'Aprovado'
          ? `Pagamento aprovado — ${r.fornecedor || 'solicitação'} (${money(Number(r.valor) || 0)})`
          : `Pagamento reprovado — ${r.fornecedor || 'solicitação'}`,
        data: r.createdAt || '',
        destino: 'meusPagamentos',
      }));

    const compras: Notificacao[] = toItemRecords(Array.isArray(comprasHistorico) ? comprasHistorico : [])
      .filter((it: any) => matchesSolicitanteCompra(it, userSession))
      .map((it: any) => ({
        id: `compra-${it.id}`,
        titulo: `Compra concluída — ${it.itemDescricao || it.itemNome || 'item'}`,
        data: it.compradoEm || '',
        destino: 'minhasCompras',
      }));

    return [...pagamentos, ...compras].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [financeiro, comprasHistorico, userSession]);

  const naoVistas = useMemo(
    () => notificacoes.filter((n) => !vistos.has(n.id)),
    [notificacoes, vistos],
  );

  // Abrir o painel = "visto": marca tudo que existe agora como lido (a contagem zera).
  const marcarTodasVistas = () => {
    const novoSet = new Set(notificacoes.map((n) => n.id));
    setVistos(novoSet);
    try { localStorage.setItem(chave, JSON.stringify(Array.from(novoSet))); } catch { /* sem storage disponível */ }
  };

  return { notificacoes, quantidadeNaoVista: naoVistas.length, marcarTodasVistas };
}
