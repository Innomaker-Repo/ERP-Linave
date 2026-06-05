import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, Select, Textarea, FileInput, Btn } from '../finUi';
import { todayStr, genFinId, num } from '../finData';
import { useFin } from '../useFin';

const TIPOS = ['Passagem', 'Almoço', 'Abastecimento', 'Fornecedor', 'Material', 'Outro'];

const fornecedorNome = (f: any) =>
  f?.razaoSocial || f?.razao_social || f?.nomeFantasia || f?.nome_fantasia || f?.nome || '';

export function SolicitacaoView() {
  const { empresas, oss, departamentos, fornecedores, addRecord } = useFin();
  const [vinculo, setVinculo] = useState<'OS' | 'Departamento'>('OS');
  const [anexos, setAnexos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  const [form, setForm] = useState({
    empresa: empresas[0] || 'Linave',
    solicitante: '',
    tipo: 'Material',
    vinculoValor: '',
    fornecedor: '',
    documento: '',
    valor: '',
    compra: todayStr,
    vencimento: todayStr,
    forma: '',
    descricao: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.solicitante.trim() || !form.fornecedor.trim() || !num(form.valor)) return;
    setSalvando(true);
    try {
      await addRecord({
        id: genFinId('SP'),
        tipo: 'solicitacao',
        status: 'Aguardando aprovação',
        empresa: form.empresa,
        solicitante: form.solicitante,
        tipoPagamento: form.tipo,
        vinculoTipo: vinculo,
        vinculoValor: form.vinculoValor || (vinculo === 'OS' ? oss[0]?.numero : departamentos[0]) || '',
        fornecedor: form.fornecedor,
        documento: form.documento,
        valor: num(form.valor),
        compra: form.compra,
        vencimento: form.vencimento,
        forma: form.forma,
        descricao: form.descricao,
        anexos,
      });
      setOk(true);
      setForm((p) => ({ ...p, solicitante: '', fornecedor: '', documento: '', valor: '', forma: '', descricao: '' }));
      setAnexos([]);
      setTimeout(() => setOk(false), 3000);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinCard>
      <Toolbar
        title="Solicitação de Pagamento"
        hint="Sem cotação e sem banco. Após aprovada, vira Conta a Pagar. (Vínculos e fornecedores são dados reais do ERP.)"
        actions={ok ? <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-300"><CheckCircle2 size={15} /> Enviada para aprovação</span> : undefined}
      />
      <form className="grid grid-cols-12 gap-4" onSubmit={enviar}>
        <Field label="Empresa" span={3}>
          <Select value={form.empresa} onChange={(e) => set('empresa', e.target.value)}>
            {empresas.map((emp) => <option key={emp}>{emp}</option>)}
          </Select>
        </Field>
        <Field label="Solicitante" span={3}><Input value={form.solicitante} onChange={(e) => set('solicitante', e.target.value)} placeholder="Nome do solicitante" /></Field>
        <Field label="Tipo" span={3}>
          <Select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field label="Vincular a" span={3}>
          <Select value={vinculo} onChange={(e) => { setVinculo(e.target.value as any); set('vinculoValor', ''); }}>
            <option value="OS">OS emitida</option>
            <option value="Departamento">Departamento</option>
          </Select>
        </Field>

        {vinculo === 'OS' ? (
          <Field label="OS emitida" span={3}>
            <Select value={form.vinculoValor} onChange={(e) => set('vinculoValor', e.target.value)}>
              <option value="">{oss.length ? 'Selecione...' : 'Nenhuma OS no ERP'}</option>
              {oss.map((o, i) => <option key={`${o.numero}-${i}`} value={o.numero}>{o.numero} - {o.cliente}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Departamento" span={3}>
            <Select value={form.vinculoValor} onChange={(e) => set('vinculoValor', e.target.value)}>
              <option value="">{departamentos.length ? 'Selecione...' : 'Nenhum departamento'}</option>
              {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Fornecedor / beneficiário" span={6}>
          <Input
            list="fin-fornecedores"
            value={form.fornecedor}
            onChange={(e) => set('fornecedor', e.target.value)}
            placeholder="Fornecedor / beneficiário"
          />
          <datalist id="fin-fornecedores">
            {fornecedores.map((f, i) => <option key={i} value={fornecedorNome(f)} />)}
          </datalist>
        </Field>
        <Field label="Documento" span={3}><Input value={form.documento} onChange={(e) => set('documento', e.target.value)} placeholder="NF / cupom" /></Field>

        <Field label="Valor" span={3}><Input type="number" step="0.01" value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="0,00" /></Field>
        <Field label="Data compra" span={3}><Input type="date" value={form.compra} onChange={(e) => set('compra', e.target.value)} /></Field>
        <Field label="Vencimento" span={3}><Input type="date" value={form.vencimento} onChange={(e) => set('vencimento', e.target.value)} /></Field>
        <Field label="Forma solicitada" span={3}><Input value={form.forma} onChange={(e) => set('forma', e.target.value)} placeholder="PIX / Boleto..." /></Field>

        <Field label="Anexar documento / imagem" span={12}>
          <FileInput label="Anexar NF, boleto, recibo, PDF ou foto" value={anexos} onChange={setAnexos} />
        </Field>
        <Field label="Descrição" span={12}><Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Detalhes da solicitação..." /></Field>

        <div className="col-span-12">
          <Btn variant="amber" type="submit" disabled={salvando}>
            <Send size={15} /> {salvando ? 'Enviando...' : 'Enviar para aprovação'}
          </Btn>
        </div>
      </form>
    </FinCard>
  );
}
