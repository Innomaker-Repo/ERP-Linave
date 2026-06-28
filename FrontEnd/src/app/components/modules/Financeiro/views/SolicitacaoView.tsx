import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, Select, Textarea, FileInput, Btn } from '../finUi';
import { todayStr, genFinId, num, FORMAS_PAGAMENTO, TIPOS_REEMBOLSO } from '../finData';
import { useFin } from '../useFin';
import { uploadDocumento } from '../../../../../services/documentosService';
import { toast } from 'sonner';

const fornecedorNome = (f: any) =>
  f?.razaoSocial || f?.razao_social || f?.nomeFantasia || f?.nome_fantasia || f?.nome || '';

export function SolicitacaoView() {
  const { empresas, oss, fornecedores, addRecord } = useFin();
  const vinculo = 'OS' as const;
  const [anexos, setAnexos] = useState<File[]>([]);
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
      // Gera o id primeiro para vincular os documentos; sobe os anexos e guarda as URLs.
      const id = genFinId('SP');
      let anexosUrls: string[] = [];
      if (anexos.length) {
        const resultados = await Promise.allSettled(
          anexos.map((file) => uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: id, categoria: 'fin_anexo' }))
        );
        anexosUrls = resultados
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value.url);
        const falhas = resultados.length - anexosUrls.length;
        if (falhas > 0) toast.error(`${falhas} anexo(s) não puderam ser enviados.`);
      }
      await addRecord({
        id,
        tipo: 'solicitacao',
        status: 'Aguardando aprovação',
        empresa: form.empresa,
        solicitante: form.solicitante,
        tipoPagamento: form.tipo,
        vinculoTipo: vinculo,
        vinculoValor: form.vinculoValor || oss[0]?.numero || '',
        fornecedor: form.fornecedor,
        documento: form.documento,
        valor: num(form.valor),
        compra: form.compra,
        vencimento: form.vencimento,
        forma: form.forma,
        descricao: form.descricao,
        anexos: anexosUrls,
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
        <Field label="Tipo (reembolso/adiantamento)" span={3}>
          <Select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>{TIPOS_REEMBOLSO.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field label="OS emitida" span={3}>
          <Select value={form.vinculoValor} onChange={(e) => set('vinculoValor', e.target.value)}>
            <option value="">{oss.length ? 'Selecione...' : 'Nenhuma OS no ERP'}</option>
            {oss.map((o, i) => <option key={`${o.numero}-${i}`} value={o.numero}>{o.numero} - {o.cliente}</option>)}
          </Select>
        </Field>
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
        <Field label="Forma solicitada" span={3}>
          <Select value={form.forma} onChange={(e) => set('forma', e.target.value)}>
            <option value="">Selecione...</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
          </Select>
        </Field>

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
