import React, { useMemo } from 'react';
import { FinCard, Toolbar, Kpi, DataTable, Th, Td, CompanyTag, StatusTag, Pill, EmptyRow } from '../finUi';
import { br, isOld, money, SEED_OS } from '../finData';

export function PrevisaoView() {
  const rows = useMemo(() => SEED_OS.filter((o) => !['Finalizada', 'Cancelada'].includes(o.status)), []);
  const total = rows.reduce((s, o) => s + o.valor, 0);
  const vencido = rows.filter((o) => isOld(o.dataTermino)).reduce((s, o) => s + o.valor, 0);

  return (
    <FinCard>
      <Toolbar title="Previsão de Receita" hint="Vem das OS abertas: data de término e valor total." />
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi label="Valor OS abertas" value={money(total)} />
        <Kpi label="Término vencido" value={money(vencido)} />
        <Kpi label="OS futuras" value={money(total - vencido)} />
      </div>
      <DataTable
        minWidth={1050}
        head={<>
          <Th>Término</Th><Th>Empresa</Th><Th>Cliente</Th><Th>OS</Th><Th>Descrição</Th><Th>Valor</Th><Th>Status</Th><Th>Alerta</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={8} text="Nenhuma OS aberta" />
        ) : rows.map((o) => {
          const venceu = isOld(o.dataTermino);
          return (
            <tr key={o.numero} className={`transition-colors hover:bg-white/5 ${venceu ? 'bg-rose-500/[0.06]' : ''}`}>
              <Td className={venceu ? 'font-bold text-rose-300' : ''}>{br(o.dataTermino)}</Td>
              <Td><CompanyTag empresa={o.empresa} /></Td>
              <Td className="text-white">{o.cliente}</Td>
              <Td className="font-black text-white">{o.numero}</Td>
              <Td className="text-white/60">{o.descricao || '-'}</Td>
              <Td className="font-bold text-white">{money(o.valor)}</Td>
              <Td><StatusTag status={o.status} /></Td>
              <Td>{venceu ? <Pill tone="bad">Término vencido</Pill> : <Pill tone="wait">Previsto</Pill>}</Td>
            </tr>
          );
        })}
      </DataTable>
    </FinCard>
  );
}
