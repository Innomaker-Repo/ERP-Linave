import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, Select, Textarea, UploadBox, Btn } from '../finUi';
import { SEED_OS, SEED_DEPTS, todayStr } from '../finData';

const TIPOS = ['Passagem', 'Almoço', 'Abastecimento', 'Fornecedor', 'Material', 'Outro'];

export function SolicitacaoView() {
  const [vinculo, setVinculo] = useState<'OS' | 'Departamento'>('OS');

  return (
    <FinCard>
      <Toolbar title="Solicitação de Pagamento" hint="Sem regra de cotação. Banco só entra em Contas a Pagar." />
      <form className="grid grid-cols-12 gap-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Empresa" span={3}>
          <Select><option>Linave</option><option>Servinave</option></Select>
        </Field>
        <Field label="Solicitante" span={3}><Input placeholder="Nome do solicitante" /></Field>
        <Field label="Tipo" span={3}>
          <Select>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field label="Vincular a" span={3}>
          <Select value={vinculo} onChange={(e) => setVinculo(e.target.value as any)}>
            <option value="OS">OS emitida</option>
            <option value="Departamento">Departamento</option>
          </Select>
        </Field>

        {vinculo === 'OS' ? (
          <Field label="OS emitida" span={3}>
            <Select>{SEED_OS.map((o) => <option key={o.numero}>{o.numero} - {o.cliente}</option>)}</Select>
          </Field>
        ) : (
          <Field label="Departamento" span={3}>
            <Select>{SEED_DEPTS.map((d) => <option key={d.nome}>{d.nome}</option>)}</Select>
          </Field>
        )}
        <Field label="Fornecedor / beneficiário" span={6}><Input placeholder="Fornecedor" /></Field>
        <Field label="Documento" span={3}><Input placeholder="NF / cupom" /></Field>

        <Field label="Valor" span={3}><Input type="number" step="0.01" placeholder="0,00" /></Field>
        <Field label="Data compra" span={3}><Input type="date" defaultValue={todayStr} /></Field>
        <Field label="Vencimento" span={3}><Input type="date" defaultValue={todayStr} /></Field>
        <Field label="Forma solicitada" span={3}><Input placeholder="PIX / Boleto..." /></Field>

        <Field label="Anexar documento / imagem" span={12}>
          <UploadBox label="Anexar NF, boleto, recibo, PDF ou foto" />
        </Field>
        <Field label="Descrição" span={12}><Textarea placeholder="Detalhes da solicitação..." /></Field>

        <div className="col-span-12">
          <Btn variant="amber" type="submit"><Send size={15} /> Enviar para aprovação</Btn>
        </div>
      </form>
    </FinCard>
  );
}
