import React, { useState } from 'react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, EmptyRow } from '../finUi';
import { br, money } from '../finData';
import { useFin } from '../useFin';

// Leitura real: solicitações guardadas na coleção `financeiro` (tipo 'solicitacao').
// Aprovar transforma a solicitação em Conta a Pagar (escrita via saveEntity).
export function AprovacoesView() {
  const { records, approveSolicitacao, rejectSolicitacao } = useFin();
  const rows = records('solicitacao');
  const [busy, setBusy] = useState('');

  const run = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusy(id);
    try { await fn(id); } finally { setBusy(''); }
  };

  return (
    <FinCard>
      <Toolbar title="Aprovações" hint="Aprovar transforma a solicitação em Conta a Pagar." />
      <DataTable
        minWidth={1100}
        head={<>
          <Th>Solicitação</Th><Th>Empresa</Th><Th>Solicitante</Th><Th>Vínculo</Th>
          <Th>Fornecedor</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={9} text="Nenhuma solicitação enviada" />
        ) : rows.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-white/5">
            <Td className="font-black text-white">{r.id}</Td>
            <Td><CompanyTag empresa={String(r.empresa)} /></Td>
            <Td className="text-white">{r.solicitante}</Td>
            <Td className="text-white/60">{r.vinculoTipo}: {r.vinculoValor || '—'}</Td>
            <Td className="text-white">{r.fornecedor}</Td>
            <Td className="font-bold text-white">{money(r.valor)}</Td>
            <Td>{br(r.vencimento)}</Td>
            <Td><StatusTag status={r.status || 'Aguardando aprovação'} /></Td>
            <Td>
              <div className="flex gap-2">
                <Btn small variant="secondary">Ver mais</Btn>
                {(r.status === 'Aguardando aprovação' || !r.status) && (
                  <>
                    <Btn small variant="green" disabled={busy === r.id} onClick={() => run(r.id, approveSolicitacao)}>Aprovar</Btn>
                    <Btn small variant="red" disabled={busy === r.id} onClick={() => run(r.id, rejectSolicitacao)}>Reprovar</Btn>
                  </>
                )}
              </div>
            </Td>
          </tr>
        ))}
      </DataTable>
    </FinCard>
  );
}
