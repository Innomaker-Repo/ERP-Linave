import React, { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, TypeTag, Pill, EmptyRow } from '../finUi';
import { br, money, SEED_PAYABLES, type ContaPagar } from '../finData';

export function ContasPagarView() {
  const [rows] = useState<ContaPagar[]>(SEED_PAYABLES);

  return (
    <FinCard>
      <Toolbar
        title="Contas a Pagar"
        hint="Adicionar, editar, parcelar, pagar com banco, juros e comprovante obrigatório."
        actions={<>
          <Btn variant="amber"><Plus size={15} /> Conta a pagar</Btn>
          <Btn variant="secondary"><Download size={15} /> Exportar CSV</Btn>
        </>}
      />
      <DataTable
        minWidth={1650}
        head={<>
          <Th>Tipo</Th><Th>ID</Th><Th>Mãe</Th><Th>Parcela</Th><Th>Empresa</Th><Th>Vínculo</Th>
          <Th>Fornecedor</Th><Th>Doc</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Banco</Th>
          <Th>Status</Th><Th>Pago em</Th><Th>Valor pago</Th><Th>Juros</Th><Th>Comprov.</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={17} text="Nenhuma conta a pagar" />
        ) : rows.map((p) => (
          <tr key={p.id} className="transition-colors hover:bg-white/5">
            <Td><TypeTag type={p.type} /></Td>
            <Td className="font-black text-white">{p.id}</Td>
            <Td>{p.parentId || '-'}</Td>
            <Td>{p.parcela}</Td>
            <Td><CompanyTag empresa={p.empresa} /></Td>
            <Td className="text-white/60">{p.vinculoTipo}: {p.vinculoValor || '-'}</Td>
            <Td className="text-white">{p.fornecedor}</Td>
            <Td>{p.documento || '-'}</Td>
            <Td className="font-bold text-white">{money(p.valor)}</Td>
            <Td>{br(p.vencimento)}</Td>
            <Td className="text-white/60">{p.banco}</Td>
            <Td><StatusTag status={p.status} /></Td>
            <Td>{p.dataPagamento ? br(p.dataPagamento) : '-'}</Td>
            <Td>{p.valorPago ? money(p.valorPago) : '-'}</Td>
            <Td>{p.jurosPago ? money(p.jurosPago) : '-'}</Td>
            <Td>{p.comprovantes.length ? <Pill tone="ok">{p.comprovantes.length}</Pill> : '-'}</Td>
            <Td>
              <div className="flex gap-2">
                <Btn small variant="secondary">Ver mais</Btn>
                {p.type !== 'parent' && <Btn small variant="amber">Editar</Btn>}
                {p.type !== 'parent' && p.status !== 'Pago' && (
                  <>
                    <Btn small variant="blue">Parcelar</Btn>
                    <Btn small variant="green">Pagar</Btn>
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
