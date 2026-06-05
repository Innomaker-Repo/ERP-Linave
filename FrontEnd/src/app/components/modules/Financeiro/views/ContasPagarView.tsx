import React from 'react';
import { Plus, Download } from 'lucide-react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, TypeTag, Pill, EmptyRow } from '../finUi';
import { br, money, num } from '../finData';
import { useFin } from '../useFin';

// Leitura real: contas a pagar guardadas em `financeiro` (tipo 'contaPagar'), criadas
// pela aprovação de solicitações ou lançamento manual.
export function ContasPagarView() {
  const { records } = useFin();
  const rows = records('contaPagar');

  return (
    <FinCard>
      <Toolbar
        title="Contas a Pagar"
        hint="Obrigações da empresa. Aprovar uma solicitação cria uma conta aqui. Banco, juros e comprovante são definidos no pagamento."
        actions={<>
          <Btn variant="amber"><Plus size={15} /> Conta a pagar</Btn>
          <Btn variant="secondary"><Download size={15} /> Exportar CSV</Btn>
        </>}
      />
      <DataTable
        minWidth={1500}
        head={<>
          <Th>Tipo</Th><Th>ID</Th><Th>Parcela</Th><Th>Empresa</Th><Th>Vínculo</Th>
          <Th>Fornecedor</Th><Th>Doc</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Banco</Th>
          <Th>Status</Th><Th>Pago em</Th><Th>Juros</Th><Th>Comprov.</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={15} text="Nenhuma conta a pagar (aprove uma solicitação para gerar)" />
        ) : rows.map((p) => (
          <tr key={p.id} className="transition-colors hover:bg-white/5">
            <Td><TypeTag type={p.type || 'single'} /></Td>
            <Td className="font-black text-white">{p.id}</Td>
            <Td>{p.parcela || '-'}</Td>
            <Td><CompanyTag empresa={String(p.empresa)} /></Td>
            <Td className="text-white/60">{p.vinculoTipo}: {p.vinculoValor || '-'}</Td>
            <Td className="text-white">{p.fornecedor}</Td>
            <Td>{p.documento || '-'}</Td>
            <Td className="font-bold text-white">{money(num(p.valor))}</Td>
            <Td>{br(p.vencimento)}</Td>
            <Td className="text-white/60">{p.banco || '—'}</Td>
            <Td><StatusTag status={p.status || 'Aberto'} /></Td>
            <Td>{p.dataPagamento ? br(p.dataPagamento) : '-'}</Td>
            <Td>{p.jurosPago ? money(num(p.jurosPago)) : '-'}</Td>
            <Td>{(p.comprovantes || []).length ? <Pill tone="ok">{p.comprovantes.length}</Pill> : '-'}</Td>
            <Td>
              <div className="flex gap-2">
                <Btn small variant="secondary">Ver mais</Btn>
                {p.status !== 'Pago' && <>
                  <Btn small variant="blue">Parcelar</Btn>
                  <Btn small variant="green">Pagar</Btn>
                </>}
              </div>
            </Td>
          </tr>
        ))}
      </DataTable>
    </FinCard>
  );
}
