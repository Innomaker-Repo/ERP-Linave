import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, Select, Btn, DataTable, Th, Td, CompanyTag, EmptyRow } from '../finUi';
import { SEED_BANKS, type Banco, type Empresa } from '../finData';

export function BancosView() {
  const [banks, setBanks] = useState<Banco[]>(SEED_BANKS);
  const [form, setForm] = useState({ nome: '', empresa: 'Linave' as Empresa, tipo: 'Conta corrente', pix: '' });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setBanks((prev) => [...prev, { ...form, pix: form.pix || '-' }]);
    setForm({ nome: '', empresa: 'Linave', tipo: 'Conta corrente', pix: '' });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <FinCard>
        <Toolbar title="Cadastro de Bancos" />
        <form className="grid grid-cols-12 gap-4" onSubmit={add}>
          <Field label="Banco" span={6}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do banco" />
          </Field>
          <Field label="Empresa" span={3}>
            <Select value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value as Empresa })}>
              <option>Linave</option><option>Servinave</option><option>Ambas</option>
            </Select>
          </Field>
          <Field label="Tipo" span={3}>
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Conta corrente</option><option>Conta pagamento</option><option>Caixa interno</option>
            </Select>
          </Field>
          <Field label="PIX" span={6}>
            <Input value={form.pix} onChange={(e) => setForm({ ...form, pix: e.target.value })} placeholder="Chave PIX" />
          </Field>
          <div className="col-span-12">
            <Btn variant="amber" type="submit"><Plus size={15} /> Cadastrar banco</Btn>
          </div>
        </form>
      </FinCard>

      <FinCard>
        <Toolbar title="Bancos cadastrados" />
        <DataTable head={<><Th>Banco</Th><Th>Empresa</Th><Th>Tipo</Th><Th>PIX</Th></>}>
          {banks.length === 0 ? (
            <EmptyRow cols={4} text="Nenhum banco cadastrado" />
          ) : banks.map((b, i) => (
            <tr key={`${b.nome}-${i}`} className="transition-colors hover:bg-white/5">
              <Td className="font-bold text-white">{b.nome}</Td>
              <Td><CompanyTag empresa={b.empresa} /></Td>
              <Td className="text-white/70">{b.tipo}</Td>
              <Td className="text-white/60">{b.pix || '-'}</Td>
            </tr>
          ))}
        </DataTable>
      </FinCard>
    </div>
  );
}
