import React, { useMemo, useState } from 'react';
import { FinCard, Toolbar, DataTable, Th, Td, StatusTag, CompanyTag, Btn, EmptyRow } from '../finUi';
import { br, isOld, money } from '../finData';
import { useFin } from '../useFin';

// Leitura real: as OS vêm do contexto do ERP (ctx.os). Esta tela é só de consulta —
// base para previsão de receita, solicitação de NFe e vínculos financeiros.
export function OsEmitidasView() {
  const { oss } = useFin();
  const [filtro, setFiltro] = useState('');

  const rows = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return oss;
    return oss.filter((o) =>
      [o.numero, o.cliente, o.descricao, o.empresa, o.status].join(' ').toLowerCase().includes(termo),
    );
  }, [oss, filtro]);

  return (
    <FinCard>
      <Toolbar
        title="OS Emitidas"
        hint="Ordens de Serviço abertas/emitidas (dados reais do ERP). Base para previsão, NFe e vínculos financeiros."
        actions={
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar OS, cliente..."
            className="w-60 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-500"
          />
        }
      />
      <DataTable
        minWidth={1000}
        head={<>
          <Th>OS</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Descrição</Th>
          <Th>Valor</Th><Th>Data término</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={8} text={oss.length === 0 ? 'Nenhuma OS emitida no ERP ainda' : 'Nenhuma OS encontrada para o filtro'} />
        ) : rows.map((o, i) => {
          const venceu = isOld(o.dataTermino) && !['Finalizada', 'Cancelada'].includes(o.status);
          return (
            <tr key={`${o.numero}-${i}`} className={`transition-colors hover:bg-white/5 ${venceu ? 'bg-rose-500/[0.06]' : ''}`}>
              <Td className="font-black text-white">{o.numero}</Td>
              <Td><CompanyTag empresa={o.empresa} /></Td>
              <Td className="text-white">{o.cliente}</Td>
              <Td className="max-w-[320px] truncate text-white/60" >{o.descricao || '-'}</Td>
              <Td className="font-bold text-white">{money(o.valor)}</Td>
              <Td className={venceu ? 'font-bold text-rose-300' : ''}>{br(o.dataTermino)}</Td>
              <Td><StatusTag status={o.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  <Btn small variant="amber">Solicitar NFe</Btn>
                  <Btn small variant="secondary">Ver mais</Btn>
                </div>
              </Td>
            </tr>
          );
        })}
      </DataTable>
    </FinCard>
  );
}
