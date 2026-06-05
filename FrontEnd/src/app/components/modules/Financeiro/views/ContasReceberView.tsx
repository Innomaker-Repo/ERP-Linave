import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, AlertBar, EmptyRow } from '../finUi';
import { br, money, num, isOld } from '../finData';
import { useFin } from '../useFin';

const status = (r: any) => (r.recebido ? 'Recebido' : isOld(r.vencimentoRecebimento) ? 'Vencido' : 'A receber');

// Leitura real: recebíveis em `financeiro` (tipo 'contaReceber'), originados por NFe
// emitida, lançamento manual ou (futuramente) locação.
export function ContasReceberView() {
  const { records } = useFin();
  const rows = records('contaReceber');
  const vencidas = useMemo(() => rows.filter((r) => status(r) === 'Vencido'), [rows]);

  return (
    <FinCard>
      <Toolbar
        title="Contas a Receber"
        hint="Valores a receber dos clientes. Banco é definido aqui, no recebimento."
        actions={<Btn variant="amber"><Plus size={15} /> Conta a receber</Btn>}
      />
      {vencidas.length > 0 && (
        <AlertBar>⚠️ Existem {vencidas.length} conta(s) a receber vencida(s): vencimento anterior a hoje e ainda não recebido.</AlertBar>
      )}
      <DataTable
        minWidth={1400}
        head={<>
          <Th>Origem</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Referência</Th><Th>Original</Th><Th>Líquido</Th>
          <Th>Vencimento</Th><Th>Recebido?</Th><Th>Data receb.</Th><Th>Valor recebido</Th><Th>Banco</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={13} text="Nenhuma conta a receber (emita uma NFe ou lance manualmente)" />
        ) : rows.map((r) => {
          const st = status(r);
          return (
            <tr key={r.id} className={`transition-colors hover:bg-white/5 ${st === 'Vencido' ? 'bg-rose-500/[0.06]' : ''}`}>
              <Td>{r.origem || 'Manual'}</Td>
              <Td><CompanyTag empresa={String(r.empresa)} /></Td>
              <Td className="text-white">{r.cliente}</Td>
              <Td className="text-white/60">{r.referencia || '—'}</Td>
              <Td>{money(num(r.valorOriginal ?? r.valor))}</Td>
              <Td className="font-bold text-white">{money(num(r.valorLiquido ?? r.valor))}</Td>
              <Td className={st === 'Vencido' ? 'font-bold text-rose-300' : ''}>{br(r.vencimentoRecebimento)}</Td>
              <Td>{r.recebido ? 'Sim' : 'Não'}</Td>
              <Td>{r.dataRecebimento ? br(r.dataRecebimento) : '-'}</Td>
              <Td>{r.valorRecebido ? money(num(r.valorRecebido)) : '-'}</Td>
              <Td className="text-white/60">{r.bancoRecebimento || '—'}</Td>
              <Td><StatusTag status={st} /></Td>
              <Td><Btn small variant="amber">Editar recebimento</Btn></Td>
            </tr>
          );
        })}
      </DataTable>
    </FinCard>
  );
}
