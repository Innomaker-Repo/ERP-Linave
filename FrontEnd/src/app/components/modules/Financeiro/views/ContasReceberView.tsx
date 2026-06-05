import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, AlertBar, EmptyRow } from '../finUi';
import { br, money, recStatus, SEED_RECEIVABLES, type ContaReceber } from '../finData';

export function ContasReceberView() {
  const [rows] = useState<ContaReceber[]>(SEED_RECEIVABLES);
  const vencidas = useMemo(() => rows.filter((r) => recStatus(r) === 'Vencido'), [rows]);

  return (
    <FinCard>
      <Toolbar
        title="Contas a Receber"
        hint="Por NFe, locação ou manual. Banco é definido aqui."
        actions={<Btn variant="amber"><Plus size={15} /> Conta a receber</Btn>}
      />
      {vencidas.length > 0 && (
        <AlertBar>
          ⚠️ Existem {vencidas.length} conta(s) a receber vencida(s). O vencimento é inferior a hoje e ainda não foi recebido.
        </AlertBar>
      )}
      <DataTable
        minWidth={1400}
        head={<>
          <Th>Origem</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Referência</Th><Th>Original</Th><Th>Líquido</Th>
          <Th>Vencimento</Th><Th>Recebido?</Th><Th>Data receb.</Th><Th>Valor recebido</Th><Th>Banco</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={13} text="Nenhuma conta a receber" />
        ) : rows.map((r) => {
          const st = recStatus(r);
          return (
            <tr key={r.id} className={`transition-colors hover:bg-white/5 ${st === 'Vencido' ? 'bg-rose-500/[0.06]' : ''}`}>
              <Td>{r.origem}</Td>
              <Td><CompanyTag empresa={r.empresa} /></Td>
              <Td className="text-white">{r.cliente}</Td>
              <Td className="text-white/60">{r.referencia}</Td>
              <Td>{money(r.valorOriginal)}</Td>
              <Td className="font-bold text-white">{money(r.valorLiquido)}</Td>
              <Td className={st === 'Vencido' ? 'font-bold text-rose-300' : ''}>{br(r.vencimentoRecebimento)}</Td>
              <Td>{r.recebido ? 'Sim' : 'Não'}</Td>
              <Td>{r.dataRecebimento ? br(r.dataRecebimento) : '-'}</Td>
              <Td>{r.valorRecebido ? money(r.valorRecebido) : '-'}</Td>
              <Td className="text-white/60">{r.bancoRecebimento}</Td>
              <Td><StatusTag status={st} /></Td>
              <Td><Btn small variant="amber">Editar recebimento</Btn></Td>
            </tr>
          );
        })}
      </DataTable>
    </FinCard>
  );
}
