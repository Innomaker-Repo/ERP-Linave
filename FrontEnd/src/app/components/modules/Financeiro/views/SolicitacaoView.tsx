import React, { useMemo, useState } from 'react';
import { Send, CheckCircle2, Pencil, X } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, MoneyInput, Select, Textarea, FileInput, Btn, StatusTag, DataTable, Th, Td, EmptyRow, boldOS } from '../finUi';
import { todayStr, genFinId, num, br, money, FORMAS_PAGAMENTO, TIPOS_REEMBOLSO, matchesSolicitante, solicitacaoDuplicada } from '../finData';
import { useFin } from '../useFin';
import { uploadDocumento } from '../../../../../services/documentosService';
import { toast } from 'sonner';

const fornecedorNome = (f: any) =>
  f?.razaoSocial || f?.razao_social || f?.nomeFantasia || f?.nome_fantasia || f?.nome || '';

const formVazio = (empresaPadrao: string) => ({
  empresa: empresaPadrao,
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

export function SolicitacaoView() {
  const { empresas, oss, fornecedores, financeiro, userSession, addSolicitacao, reenviarSolicitacao } = useFin();
  const vinculo = 'OS' as const;
  const [anexos, setAnexos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState<'' | 'criada' | 'reenviada'>('');

  const [form, setForm] = useState(formVazio(empresas[0] || 'Linave'));
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Edição: reabre uma solicitação já enviada (reprovada) com os mesmos dados, pra corrigir
  // e reenviar sem perder o vínculo com o registro original (mesmo id, mesmos anexos se não trocar).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [anexosExistentes, setAnexosExistentes] = useState<string[]>([]);

  const minhasSolicitacoes = useMemo(
    () => (Array.isArray(financeiro) ? financeiro : [])
      .filter((r: any) => r?.tipo === 'solicitacao' && matchesSolicitante(r, userSession))
      .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [financeiro, userSession],
  );

  const abrirEdicao = (sol: any) => {
    setEditandoId(sol.id);
    setAnexosExistentes(Array.isArray(sol.anexos) ? sol.anexos : []);
    setAnexos([]);
    setForm({
      empresa: sol.empresa || empresas[0] || 'Linave',
      solicitante: sol.solicitante || '',
      tipo: sol.tipoPagamento || 'Material',
      vinculoValor: sol.vinculoValor || '',
      fornecedor: sol.fornecedor || '',
      documento: sol.documento || '',
      valor: String(sol.valor ?? ''),
      compra: sol.compra || todayStr,
      vencimento: sol.vencimento || todayStr,
      forma: sol.forma || '',
      descricao: sol.descricao || '',
    });
    setOk('');
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setAnexosExistentes([]);
    setAnexos([]);
    setForm(formVazio(empresas[0] || 'Linave'));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.solicitante.trim() || !form.fornecedor.trim() || !num(form.valor)) return;
    // Bloqueia duplicidade: mesma nota (documento) pro mesmo fornecedor não pode virar uma
    // segunda solicitação — evita aprovar duas vezes e pagar a mesma nota em duplicidade.
    if (solicitacaoDuplicada(financeiro, {
      fornecedor: form.fornecedor,
      documento: form.documento.trim(),
      selfId: editandoId,
    })) {
      toast.error(`Já existe uma solicitação (ou conta a pagar) com o documento "${form.documento.trim()}" para o fornecedor ${form.fornecedor.trim()}.`);
      return;
    }
    setSalvando(true);
    try {
      const idAlvo = editandoId || genFinId('SP');
      // Só sobe anexo novo se o usuário trocou o arquivo; senão mantém o que já estava salvo.
      let anexosUrls = editandoId ? anexosExistentes : [];
      if (anexos.length) {
        const resultados = await Promise.allSettled(
          anexos.map((file) => uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: idAlvo, categoria: 'fin_anexo' }))
        );
        anexosUrls = resultados
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value.url);
        const falhas = resultados.length - anexosUrls.length;
        if (falhas > 0) toast.error(`${falhas} anexo(s) não puderam ser enviados.`);
      }

      const dados = {
        empresa: form.empresa,
        solicitante: form.solicitante,
        solicitanteCpf: userSession?.cpf || '',
        solicitanteEmail: userSession?.email || '',
        tipoPagamento: form.tipo,
        vinculoTipo: vinculo,
        // Sem fallback pra "primeira OS da lista": se o campo ficar em branco, o vínculo
        // tem que ficar em branco também — do contrário a solicitação aparecia vinculada
        // a uma OS que ninguém escolheu (a primeira da lista, sempre a mesma).
        vinculoValor: form.vinculoValor,
        fornecedor: form.fornecedor,
        documento: form.documento,
        valor: num(form.valor),
        compra: form.compra,
        vencimento: form.vencimento,
        forma: form.forma,
        descricao: form.descricao,
        anexos: anexosUrls,
      };

      if (editandoId) {
        await reenviarSolicitacao(editandoId, dados);
        setOk('reenviada');
        cancelarEdicao();
      } else {
        await addSolicitacao({ id: idAlvo, tipo: 'solicitacao', status: 'Aguardando aprovação', ...dados });
        setOk('criada');
        setForm((p) => ({ ...p, solicitante: '', fornecedor: '', documento: '', valor: '', forma: '', descricao: '' }));
        setAnexos([]);
      }
      setTimeout(() => setOk(''), 3000);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <FinCard>
        <Toolbar
          title={editandoId ? `Editar solicitação ${editandoId}` : 'Solicitação de Pagamento'}
          hint={editandoId ? 'Corrija os dados e reenvie para aprovação.' : 'Sem cotação e sem banco. Após aprovada, vira Conta a Pagar. (Vínculos e fornecedores são dados reais do ERP.)'}
          actions={
            ok === 'criada' ? <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-300"><CheckCircle2 size={15} /> Enviada para aprovação</span>
              : ok === 'reenviada' ? <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-300"><CheckCircle2 size={15} /> Reenviada para aprovação</span>
              : undefined
          }
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
          <Field label={boldOS('OS emitida')} span={3}>
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
          <Field label="Documento" span={3}>
            <Input value={form.documento} onChange={(e) => set('documento', e.target.value)} placeholder="Nº único do boleto" />
            <p className="mt-1 text-[10px] leading-tight text-white/40">Se for boleto, use o Nosso Número ou a linha digitável — é o que evita pagar a mesma nota duas vezes.</p>
          </Field>

          <Field label="Valor" span={3}><MoneyInput value={form.valor} onChange={(v) => set('valor', v)} /></Field>
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
            {editandoId && anexosExistentes.length > 0 && anexos.length === 0 && (
              <p className="mt-1.5 text-xs text-white/40">Mantendo {anexosExistentes.length} anexo(s) já enviado(s). Anexe um novo arquivo acima só se quiser substituir.</p>
            )}
          </Field>
          <Field label="Descrição" span={12}><Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Detalhes da solicitação..." /></Field>

          <div className="col-span-12 flex gap-2">
            <Btn variant="amber" type="submit" disabled={salvando}>
              <Send size={15} /> {salvando ? 'Enviando...' : editandoId ? 'Reenviar para aprovação' : 'Enviar para aprovação'}
            </Btn>
            {editandoId && (
              <Btn variant="ghost" type="button" onClick={cancelarEdicao}><X size={15} /> Cancelar edição</Btn>
            )}
          </div>
        </form>
      </FinCard>

      <FinCard>
        <Toolbar title="Minhas Solicitações" hint="Solicitações enviadas por você. Reprovadas podem ser corrigidas e reenviadas." />
        <DataTable
          head={<>
            <Th>Solicitação</Th><Th>Fornecedor</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Status</Th><Th>Motivo da reprovação</Th><Th>Ação</Th>
          </>}
        >
          {minhasSolicitacoes.length === 0 ? (
            <EmptyRow cols={7} text="Você ainda não enviou nenhuma solicitação." />
          ) : minhasSolicitacoes.map((r: any) => (
            <tr key={r.id} className="transition-colors hover:bg-white/5">
              <Td className="font-black text-white">{r.id}</Td>
              <Td className="text-white">{r.fornecedor}</Td>
              <Td className="font-bold text-white">{money(num(r.valor))}</Td>
              <Td>{br(r.vencimento)}</Td>
              <Td><StatusTag status={r.status || 'Aguardando aprovação'} /></Td>
              <Td className="max-w-[240px] whitespace-normal text-white/60">{r.status === 'Reprovado' ? (r.motivoReprovacao || '—') : '—'}</Td>
              <Td>
                {r.status === 'Reprovado' && (
                  <Btn small variant="secondary" onClick={() => abrirEdicao(r)}><Pencil size={13} /> Editar e reenviar</Btn>
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
      </FinCard>
    </div>
  );
}
