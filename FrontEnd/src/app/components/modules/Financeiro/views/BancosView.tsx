import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, Select, Btn, DataTable, Th, Td, CompanyTag, EmptyRow } from '../finUi';
import { genFinId } from '../finData';
import { useFin } from '../useFin';

// Leitura/escrita reais: bancos guardados em `financeiro` (tipo 'banco'); empresas vêm
// das empresas prestadoras configuradas no ERP.
export function BancosView() {
  const { empresas, records, addRecord } = useFin();
  const bancos = records('banco');
  const [form, setForm] = useState({ nome: '', empresa: empresas[0] || 'Linave', tipo: 'Conta corrente', pix: '' });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await addRecord({
        id: genFinId('BNK'), tipo: 'banco',
        nome: form.nome, empresa: form.empresa, tipoConta: form.tipo, pix: form.pix || '-',
      });
      setForm((p) => ({ ...p, nome: '', pix: '' }));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <FinCard>
        <Toolbar title="Cadastro de Bancos" hint="O banco não é definido na solicitação; é escolhido aqui e usado ao pagar/receber." />
        <form className="grid grid-cols-12 gap-4" onSubmit={add}>
          <Field label="Banco" span={6}><Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome do banco" /></Field>
          <Field label="Empresa" span={3}>
            <Select value={form.empresa} onChange={(e) => set('empresa', e.target.value)}>
              {empresas.map((emp) => <option key={emp}>{emp}</option>)}
              <option>Ambas</option>
            </Select>
          </Field>
          <Field label="Tipo" span={3}>
            <Select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option>Conta corrente</option><option>Conta pagamento</option><option>Caixa interno</option>
            </Select>
          </Field>
          <Field label="PIX" span={6}><Input value={form.pix} onChange={(e) => set('pix', e.target.value)} placeholder="Chave PIX" /></Field>
          <div className="col-span-12">
            <Btn variant="amber" type="submit" disabled={salvando}><Plus size={15} /> {salvando ? 'Salvando...' : 'Cadastrar banco'}</Btn>
          </div>
        </form>
      </FinCard>

      <FinCard>
        <Toolbar title="Bancos cadastrados" />
        <DataTable head={<><Th>Banco</Th><Th>Empresa</Th><Th>Tipo</Th><Th>PIX</Th></>}>
          {bancos.length === 0 ? (
            <EmptyRow cols={4} text="Nenhum banco cadastrado" />
          ) : bancos.map((b) => (
            <tr key={b.id} className="transition-colors hover:bg-white/5">
              <Td className="font-bold text-white">{b.nome}</Td>
              <Td><CompanyTag empresa={String(b.empresa)} /></Td>
              <Td className="text-white/70">{b.tipoConta}</Td>
              <Td className="text-white/60">{b.pix || '-'}</Td>
            </tr>
          ))}
        </DataTable>
      </FinCard>
    </div>
  );
}
