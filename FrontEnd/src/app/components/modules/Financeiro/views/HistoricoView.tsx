import React, { useMemo } from 'react';
import { Download, Clock } from 'lucide-react';
import { FinCard, Toolbar, Btn, EmptyRow, DataTable, Th, Td } from '../finUi';
import { money, num, br } from '../finData';
import { useFin, type FinRecord } from '../useFin';

const TIPO_LABEL: Record<string, string> = {
  solicitacao: 'Solicitação de pagamento',
  contaPagar: 'Conta a pagar',
  contaReceber: 'Conta a receber',
  nfeReq: 'Solicitação de NFe',
  banco: 'Banco cadastrado',
  locEstudo: 'Estudo de locação',
};

const descreve = (r: FinRecord) => {
  switch (r.tipo) {
    case 'solicitacao': return `${r.fornecedor || ''} • ${money(num(r.valor))} • ${r.status || ''}`;
    case 'contaPagar': return `${r.fornecedor || ''} • ${money(num(r.valor))} • ${r.status || ''}`;
    case 'contaReceber': return `${r.cliente || ''} • ${money(num(r.valorLiquido ?? r.valor))} • ${r.status || ''}`;
    case 'nfeReq': return `${r.cliente || ''} • ${money(num(r.valor))} • ${r.status || ''}`;
    case 'banco': return `${r.nome || ''} • ${r.empresa || ''}`;
    case 'locEstudo': return `${r.tipoLocacao || ''} • ${r.unidade || ''}`;
    default: return '';
  }
};

// Leitura real: rastreio de todas as ações registradas na coleção `financeiro`.
export function HistoricoView() {
  const { financeiro } = useFin();
  const rows = useMemo(
    () => [...financeiro].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [financeiro],
  );

  return (
    <FinCard>
      <Toolbar
        title="Histórico"
        hint="Rastreamento das ações financeiras registradas no sistema."
        actions={<Btn variant="secondary"><Download size={15} /> Exportar histórico</Btn>}
      />
      <DataTable
        minWidth={800}
        head={<><Th>Quando</Th><Th>Ação</Th><Th>ID</Th><Th>Detalhe</Th></>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={4} text="Nenhuma ação registrada ainda" />
        ) : rows.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-white/5">
            <Td className="text-white/60">
              <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-amber-400" />{r.createdAt ? br(r.createdAt.slice(0, 10)) : '—'}</span>
            </Td>
            <Td className="font-bold text-white">{TIPO_LABEL[r.tipo] || r.tipo}</Td>
            <Td className="text-white/50">{r.id}</Td>
            <Td className="text-white/70">{descreve(r)}</Td>
          </tr>
        ))}
      </DataTable>
    </FinCard>
  );
}
