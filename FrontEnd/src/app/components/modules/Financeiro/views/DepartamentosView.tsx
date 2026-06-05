import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, Select, Btn, DataTable, Th, Td, Pill, EmptyRow } from '../finUi';
import { useFin } from '../useFin';

// Leitura/escrita reais: a lista de departamentos é a mesma de Usuários & Acessos
// (listas.departamentos). Cadastrar persiste via saveListas (infra já pronta).
export function DepartamentosView() {
  const { departamentos, empresas, addDepartamento } = useFin();
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState(empresas[0] || 'Linave');
  const [email, setEmail] = useState('');
  const [salvando, setSalvando] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await addDepartamento(nome);
      setNome(''); setEmail('');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <FinCard>
        <Toolbar title="Departamentos" hint="Setores internos. Usados quando a solicitação/conta não está vinculada a uma OS." />
        <form className="grid grid-cols-12 gap-4" onSubmit={add}>
          <Field label="Departamento" span={6}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do departamento" />
          </Field>
          <Field label="Empresa" span={3}>
            <Select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
              {empresas.map((emp) => <option key={emp}>{emp}</option>)}
              <option>Ambas</option>
            </Select>
          </Field>
          <Field label="E-mail aprovador" span={3}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
          </Field>
          <div className="col-span-12">
            <Btn variant="amber" type="submit" disabled={salvando}><Plus size={15} /> {salvando ? 'Salvando...' : 'Cadastrar departamento'}</Btn>
          </div>
        </form>
      </FinCard>

      <FinCard>
        <Toolbar title="Departamentos cadastrados" />
        <DataTable head={<><Th>Departamento</Th><Th>Vínculo</Th></>}>
          {departamentos.length === 0 ? (
            <EmptyRow cols={2} text="Nenhum departamento cadastrado" />
          ) : departamentos.map((d, i) => (
            <tr key={`${d}-${i}`} className="transition-colors hover:bg-white/5">
              <Td><Pill tone="wait">{d}</Pill></Td>
              <Td className="text-white/60">Setor interno</Td>
            </tr>
          ))}
        </DataTable>
      </FinCard>
    </div>
  );
}
