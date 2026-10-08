import React, { useMemo } from 'react';
import { FinCard, Toolbar, Kpi, DataTable, Th, Td, CompanyTag, StatusTag, Pill, EmptyRow, boldOS } from '../finUi';
import { br, isOld, money } from '../finData';
import { useFin } from '../useFin';
import { useFinFilters } from '../finFilters';
import { useErp } from '../../../../context/ErpContext';

// Leitura real: previsão derivada das OS em aberto/andamento (não vem da NFe).
export function PrevisaoView() {
  const { oss } = useFin();
  const { medicoes } = useErp() as any;
  const { match } = useFinFilters();
  const rows = useMemo(() => oss.filter((o) => !['Finalizada', 'Cancelada'].includes(o.status) && match(o)), [oss, match]);

  // Realizado: soma das medições APROVADAS de cada OS — o vínculo é o número da OS (a
  // medição já guarda `ordemServicoNumero`, o mesmo número usado aqui em `o.numero`).
  // Medição pendente/recusada não conta como realizado, só previsão ainda em aberto.
  const realizadoPorOs = useMemo(() => {
    const mapa = new Map<string, number>();
    (Array.isArray(medicoes) ? medicoes : [])
      .filter((m: any) => String(m.status).toLowerCase() === 'aprovada')
      .forEach((m: any) => {
        const numero = String(m.ordemServicoNumero || '').trim();
        if (!numero) return;
        mapa.set(numero, (mapa.get(numero) || 0) + (Number(m.valorTotal) || 0));
      });
    return mapa;
  }, [medicoes]);

  const total = rows.reduce((s, o) => s + o.valor, 0);
  const vencido = rows.filter((o) => isOld(o.dataTermino)).reduce((s, o) => s + o.valor, 0);
  const totalRealizado = rows.reduce((s, o) => s + (realizadoPorOs.get(o.numero) || 0), 0);

  return (
    <FinCard>
      <Toolbar title="Previsão de Receita" hint={boldOS('Baseada nas OS abertas: valor total e data de término previstos (dados reais do ERP).')} />
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label={boldOS('Valor OS abertas')} value={money(total)} />
        <Kpi label="Realizado (medições aprovadas)" value={money(totalRealizado)} />
        <Kpi label="Término vencido" value={money(vencido)} />
        <Kpi label={boldOS('OS futuras')} value={money(total - vencido)} />
      </div>
      <DataTable
        minWidth={1200}
        head={<>
          <Th>Término</Th><Th>Empresa</Th><Th>Cliente</Th><Th><strong className="font-black text-amber-400">OS</strong></Th><Th>Descrição</Th><Th>Previsto</Th><Th>Realizado</Th><Th>Status</Th><Th>Alerta</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={9} text={boldOS('Nenhuma OS aberta para prever receita')} />
        ) : rows.map((o, i) => {
          const venceu = isOld(o.dataTermino);
          const realizado = realizadoPorOs.get(o.numero) || 0;
          return (
            <tr key={`${o.numero}-${i}`} className={`transition-colors hover:bg-white/5 ${venceu ? 'bg-rose-500/[0.06]' : ''}`}>
              <Td className={venceu ? 'font-bold text-rose-300' : ''}>{br(o.dataTermino)}</Td>
              <Td><CompanyTag empresa={o.empresa} /></Td>
              <Td className="text-white">{o.cliente}</Td>
              <Td className="font-black text-white">{o.numero}</Td>
              <Td className="max-w-[320px] truncate text-white/60">{o.descricao || '-'}</Td>
              <Td className="font-bold text-white">{money(o.valor)}</Td>
              <Td className="font-bold text-emerald-300">{realizado > 0 ? money(realizado) : <span className="text-white/30">—</span>}</Td>
              <Td><StatusTag status={o.status} /></Td>
              <Td>{venceu ? <Pill tone="bad">Término vencido</Pill> : <Pill tone="wait">Previsto</Pill>}</Td>
            </tr>
          );
        })}
      </DataTable>
    </FinCard>
  );
}
