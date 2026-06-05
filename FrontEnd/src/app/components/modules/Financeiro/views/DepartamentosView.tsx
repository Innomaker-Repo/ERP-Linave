import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, Select, Btn, DataTable, Th, Td, CompanyTag, Pill, EmptyRow } from '../finUi';
import { SEED_DEPTS, type Departamento, type Empresa } from '../finData';

export function DepartamentosView() {
  const [depts, setDepts] = useState<Departamento[]>(SEED_DEPTS);
  const [form, setForm] = useState({ nome: '', empresa: 'Linave' as Empresa, email: '' });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setDepts((prev) => [...prev, { ...form, email: form.email || '-' }]);
    setForm({ nome: '', empresa: 'Linave', email: '' });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <FinCard>
        <Toolbar title="Departamentos" />
        <form className="grid grid-cols-12 gap-4" onSubmit={add}>
          <Field label="Departamento" span={6}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do departamento" />
          </Field>
          <Field label="Empresa" span={3}>
            <Select value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value as Empresa })}>
              <option>Linave</option><option>Servinave</option><option>Ambas</option>
            </Select>
          </Field>
          <Field label="E-mail aprovador" span={3}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
          </Field>
          <div className="col-span-12">
            <Btn variant="amber" type="submit"><Plus size={15} /> Cadastrar departamento</Btn>
          </div>
        </form>
      </FinCard>

      <FinCard>
        <Toolbar title="Departamentos cadastrados" />
        <DataTable head={<><Th>Departamento</Th><Th>Empresa</Th><Th>E-mail</Th></>}>
          {depts.length === 0 ? (
            <EmptyRow cols={3} text="Nenhum departamento cadastrado" />
          ) : depts.map((d, i) => (
            <tr key={`${d.nome}-${i}`} className="transition-colors hover:bg-white/5">
              <Td><Pill tone="wait">{d.nome}</Pill></Td>
              <Td><CompanyTag empresa={d.empresa} /></Td>
              <Td className="text-white/60">{d.email || '-'}</Td>
            </tr>
          ))}
        </DataTable>
      </FinCard>
    </div>
  );
}
