import React from 'react';
import { Plus } from 'lucide-react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, Pill, AlertBar, EmptyRow } from '../finUi';
import { br, money, num } from '../finData';
import { useFin } from '../useFin';

// Leitura real: solicitações de NFe em `financeiro` (tipo 'nfeReq'). A solicitação nasce
// da medição aprovada; ao emitir e arquivar, cria-se uma Conta a Receber.
export function NfeView() {
  const { records } = useFin();
  const rows = records('nfeReq');

  return (
    <FinCard>
      <Toolbar
        title="Solicitações e Emissão de NFe"
        hint="A medição aprovada cria a solicitação. Os cálculos de impostos abrem ao clicar em Emitir NFe."
        actions={<Btn variant="amber"><Plus size={15} /> Solicitar NFe</Btn>}
      />
      <AlertBar>Toda NFe emitida exige vencimento do recebimento e anexo da NFe. Ao arquivar, cria Conta a Receber.</AlertBar>
      <DataTable
        minWidth={1200}
        head={<>
          <Th>Solicitação</Th><Th>OS</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Valor</Th>
          <Th>Forma recebimento</Th><Th>Data emitir</Th><Th>Tipo NFe</Th><Th>Status</Th><Th>Anexos</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={11} text="Nenhuma solicitação de NFe (aprove uma medição para gerar)" />
        ) : rows.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-white/5">
            <Td className="font-black text-white">{r.id}</Td>
            <Td>{r.os}</Td>
            <Td><CompanyTag empresa={String(r.empresa)} /></Td>
            <Td className="text-white">{r.cliente}</Td>
            <Td className="font-bold text-white">{money(num(r.valor))}</Td>
            <Td className="text-white/60">{r.forma}</Td>
            <Td>{br(r.dataEmitir)}</Td>
            <Td>{r.tipoNfe}</Td>
            <Td><StatusTag status={r.status || 'Aguardando emissão'} /></Td>
            <Td>{(r.anexos || []).length ? <Pill tone="info">{r.anexos.length}</Pill> : '-'}</Td>
            <Td>
              <div className="flex gap-2">
                <Btn small variant="secondary">Ver mais</Btn>
                {(r.status === 'Aguardando emissão' || !r.status) && <Btn small variant="amber">Emitir NFe</Btn>}
              </div>
            </Td>
          </tr>
        ))}
      </DataTable>
    </FinCard>
  );
}
