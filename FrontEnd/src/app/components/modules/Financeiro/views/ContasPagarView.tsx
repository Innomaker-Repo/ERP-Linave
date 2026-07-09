import React, { useMemo, useState } from 'react';
import { Plus, Download, Save, Banknote, Split, Paperclip, CalendarClock } from 'lucide-react';
import {
  FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, TypeTag, Pill, EmptyRow,
  FinModal, Field, Input, Select, Textarea, Kpi, labelCls, boldOS,
} from '../finUi';
import { br, money, num, todayStr, genFinId, download, days, FORMAS_PAGAMENTO, TIPOS_REEMBOLSO, NATUREZAS_CONTA_PAGAR } from '../finData';
import { useFin, type FinRecord } from '../useFin';
import { useFinFilters } from '../finFilters';
import { uploadDocumento } from '../../../../../services/documentosService';
import { toast } from 'sonner';

export function ContasPagarView() {
  const { records, empresas, oss, addRecord, updateRecord, parcelarConta, pagarConta } = useFin();
  const { match } = useFinFilters();
  const rows = records('contaPagar').filter(match);
  const bancos = records('banco').map((b) => b.nome).filter(Boolean) as string[];
  const [salvando, setSalvando] = useState(false);

  // ---- Modal criar/editar ----
  const formVazio = () => ({
    empresa: empresas[0] || 'Linave', vinculoTipo: 'OS' as 'OS' | 'Departamento', vinculoValor: '',
    fornecedor: '', tipoPagamento: 'Material', natureza: '', documento: '', valor: '', vencimento: todayStr, banco: '', forma: '', obs: '',
  });
  const [editId, setEditId] = useState<string | null | undefined>(undefined); // undefined=fechado, null=novo
  const [form, setForm] = useState(formVazio());
  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const abrirNovo = () => { setForm(formVazio()); setEditId(null); };
  const abrirEdicao = (p: FinRecord) => {
    setForm({
      empresa: String(p.empresa || empresas[0] || 'Linave'),
      vinculoTipo: (p.vinculoTipo as any) || 'OS',
      vinculoValor: p.vinculoValor || '',
      fornecedor: p.fornecedor || '',
      tipoPagamento: p.tipoPagamento || 'Material',
      natureza: p.natureza || '',
      documento: p.documento || '',
      valor: String(p.valor || ''),
      vencimento: p.vencimento || todayStr,
      banco: p.banco || '',
      forma: p.forma || '',
      obs: p.obs || '',
    });
    setEditId(p.id);
  };

  const salvarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fornecedor.trim() || !num(form.valor)) return;
    setSalvando(true);
    try {
      const base = {
        empresa: form.empresa, vinculoTipo: form.vinculoTipo, vinculoValor: form.vinculoValor,
        fornecedor: form.fornecedor, tipoPagamento: form.tipoPagamento, natureza: form.natureza, documento: form.documento,
        valor: num(form.valor), vencimento: form.vencimento, banco: form.banco, forma: form.forma, obs: form.obs,
      };
      if (editId) await updateRecord(editId, base);
      else await addRecord({ id: genFinId('CP'), tipo: 'contaPagar', type: 'single', parentId: null, parcela: '-', status: 'Aberto', valorPago: 0, jurosPago: 0, comprovantes: [], ...base });
      setEditId(undefined);
    } finally {
      setSalvando(false);
    }
  };

  // ---- Modal parcelar ----
  const [parcelando, setParcelando] = useState<FinRecord | null>(null);
  const [parc, setParc] = useState({ n: '2', intervalo: '30', dataInicio: todayStr });

  const abrirParcelar = (p: FinRecord) => {
    setParc({ n: '2', intervalo: '30', dataInicio: p.vencimento || todayStr });
    setParcelando(p);
  };

  // Prévia dos próximos pagamentos (parcela, vencimento, valor) — espelha parcelarConta.
  const parcelasPreview = useMemo(() => {
    if (!parcelando) return [] as { parcela: string; vencimento: string; valor: number }[];
    const n = Math.max(2, Math.floor(Number(parc.n) || 0));
    const total = num(parcelando.valor);
    const base = Math.floor((total / n) * 100) / 100;
    const sobra = Math.round((total - base * n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => ({
      parcela: `${i + 1}/${n}`,
      vencimento: days(parc.dataInicio || todayStr, Number(parc.intervalo) * i),
      valor: i === n - 1 ? Math.round((base + sobra) * 100) / 100 : base,
    }));
  }, [parcelando, parc]);

  const confirmarParcelar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelando) return;
    setSalvando(true);
    try {
      await parcelarConta(parcelando.id, Number(parc.n), Number(parc.intervalo), parc.dataInicio);
      setParcelando(null);
      setParc({ n: '2', intervalo: '30', dataInicio: todayStr });
    } finally {
      setSalvando(false);
    }
  };

  // ---- Modal pagar ----
  const [pagando, setPagando] = useState<FinRecord | null>(null);
  // `comprovante` guarda a URL (/media/...) do documento persistido; `comprovanteNome`
  // é só o rótulo amigável exibido. `enviandoComprovante` controla o estado de upload.
  const [pay, setPay] = useState({ dataPagamento: todayStr, valorPago: '', banco: '', houveJuros: 'Não', jurosPago: '', motivoJuros: '', comprovante: '', comprovanteNome: '' });
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const setPayF = (k: string, v: string) => setPay((p) => ({ ...p, [k]: v }));

  const abrirPagamento = (p: FinRecord) => {
    setPagando(p);
    setPay({ dataPagamento: todayStr, valorPago: String(p.valorPago || p.valor || ''), banco: p.banco || '', houveJuros: 'Não', jurosPago: '', motivoJuros: '', comprovante: '', comprovanteNome: '' });
  };

  // Sobe o comprovante para a tabela Documento (vinculado ao id da conta) e guarda a URL.
  const handleSelecionarComprovante = async (file: File | undefined) => {
    if (!file || !pagando) return;
    setEnviandoComprovante(true);
    try {
      const doc = await uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: pagando.id, categoria: 'fin_comprovante' });
      setPay((p) => ({ ...p, comprovante: doc.url, comprovanteNome: doc.nome }));
      toast.success('Comprovante anexado e salvo no banco.');
    } catch {
      toast.error('Não foi possível enviar o comprovante.');
    } finally {
      setEnviandoComprovante(false);
    }
  };

  const exportarCsv = () => {
    const head = ['Tipo', 'ID', 'Parcela', 'Empresa', 'Vínculo', 'Natureza', 'Fornecedor', 'Documento', 'Valor', 'Vencimento', 'Banco', 'Status', 'Pago em', 'Valor pago', 'Juros', 'Comprovantes'];
    const linhas = rows.map((p) => [
      p.type || 'single', p.id, p.parcela || '-', p.empresa, `${p.vinculoTipo}: ${p.vinculoValor || ''}`, p.natureza || '',
      p.fornecedor, p.documento || '', num(p.valor), p.vencimento, p.banco || '', p.status || 'Aberto',
      p.dataPagamento || '', num(p.valorPago), num(p.jurosPago), (p.comprovantes || []).join('|'),
    ]);
    // Resumo (totais) no fim do CSV.
    const totValor = rows.reduce((s, p) => s + num(p.valor), 0);
    const totPago = rows.reduce((s, p) => s + num(p.valorPago), 0);
    const totJuros = rows.reduce((s, p) => s + num(p.jurosPago), 0);
    linhas.push(['TOTAL', '', '', '', '', '', '', '', totValor, '', '', '', '', totPago, totJuros, '']);
    const csv = [head, ...linhas].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    download(csv, 'contas_a_pagar.csv', 'text/csv;charset=utf-8');
  };

  const confirmarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagando || !pay.banco || !pay.comprovante) return; // banco e comprovante obrigatórios
    setSalvando(true);
    try {
      const houveJuros = pay.houveJuros === 'Sim';
      await pagarConta(pagando.id, {
        dataPagamento: pay.dataPagamento,
        valorPago: num(pay.valorPago),
        banco: pay.banco,
        houveJuros,
        jurosPago: houveJuros ? num(pay.jurosPago) : 0,
        motivoJuros: houveJuros ? pay.motivoJuros : '',
        comprovantes: [pay.comprovante],
      });
      setPagando(null);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinCard>
      <Toolbar
        title="Contas a Pagar"
        hint="Adicionar, editar, parcelar (mãe/filhas) e pagar com banco, juros e comprovante obrigatório."
        actions={<>
          <Btn variant="amber" onClick={abrirNovo}><Plus size={15} /> Conta a pagar</Btn>
          <Btn variant="secondary" onClick={exportarCsv}><Download size={15} /> Exportar CSV</Btn>
        </>}
      />
      <DataTable
        minWidth={1650}
        head={<>
          <Th>Tipo</Th><Th>ID</Th><Th>Parcela</Th><Th>Empresa</Th><Th>Vínculo</Th><Th>Natureza</Th>
          <Th>Fornecedor</Th><Th>Doc</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Banco</Th>
          <Th>Status</Th><Th>Pago em</Th><Th>Juros</Th><Th>Comprov.</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={16} text="Nenhuma conta a pagar (aprove uma solicitação ou adicione manualmente)" />
        ) : rows.map((p) => (
          <tr key={p.id} className={`transition-colors hover:bg-white/5 ${p.type === 'parent' ? 'bg-violet-500/[0.05]' : p.type === 'child' ? 'bg-sky-500/[0.04]' : ''}`}>
            <Td><TypeTag type={p.type || 'single'} /></Td>
            <Td className="font-black text-white">{p.id}</Td>
            <Td>{p.parcela || '-'}</Td>
            <Td><CompanyTag empresa={String(p.empresa)} /></Td>
            <Td className="text-white/60">{boldOS(p.vinculoTipo)}: {p.vinculoValor || '-'}</Td>
            <Td className="text-white/60">{p.natureza || '—'}</Td>
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
                {p.type !== 'parent' && <Btn small variant="secondary" onClick={() => abrirEdicao(p)}>Editar</Btn>}
                {p.type === 'single' && p.status !== 'Pago' && <Btn small variant="blue" onClick={() => abrirParcelar(p)}><Split size={12} /> Parcelar</Btn>}
                {p.type !== 'parent' && p.status !== 'Pago' && <Btn small variant="green" onClick={() => abrirPagamento(p)}><Banknote size={12} /> Pagar</Btn>}
              </div>
            </Td>
          </tr>
        ))}
      </DataTable>

      {/* MODAL: criar / editar */}
      {editId !== undefined && (
        <FinModal wide title={editId ? `Editar conta ${editId}` : 'Adicionar Conta a Pagar'} hint="Conta simples. Use Parcelar para gerar mãe e filhas." onClose={() => setEditId(undefined)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={salvarConta}>
            <Field label="Empresa" span={3}>
              <Select value={form.empresa} onChange={(e) => setF('empresa', e.target.value)}>{empresas.map((emp) => <option key={emp}>{emp}</option>)}</Select>
            </Field>
            <Field label={boldOS('OS')} span={3}>
              <Select value={form.vinculoValor} onChange={(e) => setF('vinculoValor', e.target.value)}>
                <option value="">{oss.length ? 'Selecione...' : 'Nenhuma OS'}</option>
                {oss.map((o, i) => <option key={`${o.numero}-${i}`} value={o.numero}>{o.numero} - {o.cliente}</option>)}
              </Select>
            </Field>
            <Field label="Tipo (reembolso/adiantamento)" span={3}>
              <Select value={form.tipoPagamento} onChange={(e) => setF('tipoPagamento', e.target.value)}>{TIPOS_REEMBOLSO.map((t) => <option key={t}>{t}</option>)}</Select>
            </Field>
            <Field label="Natureza" span={3}>
              <Select value={form.natureza} onChange={(e) => setF('natureza', e.target.value)}>
                <option value="">Selecione...</option>
                {NATUREZAS_CONTA_PAGAR.map((n) => <option key={n}>{n}</option>)}
              </Select>
            </Field>

            <Field label="Fornecedor" span={6}><Input value={form.fornecedor} onChange={(e) => setF('fornecedor', e.target.value)} /></Field>
            <Field label="Documento" span={3}><Input value={form.documento} onChange={(e) => setF('documento', e.target.value)} placeholder="NF / boleto" /></Field>
            <Field label="Valor total" span={3}><Input type="number" step="0.01" value={form.valor} onChange={(e) => setF('valor', e.target.value)} /></Field>

            <Field label="Vencimento" span={3}><Input type="date" value={form.vencimento} onChange={(e) => setF('vencimento', e.target.value)} /></Field>
            <Field label="Banco" span={3}>
              <Select value={form.banco} onChange={(e) => setF('banco', e.target.value)}>
                <option value="">{bancos.length ? 'A definir...' : 'Nenhum banco cadastrado'}</option>
                {bancos.map((b) => <option key={b}>{b}</option>)}
              </Select>
            </Field>
            <Field label="Forma" span={6}>
              <Select value={form.forma} onChange={(e) => setF('forma', e.target.value)}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>

            <Field label="Observação" span={12}><Textarea value={form.obs} onChange={(e) => setF('obs', e.target.value)} /></Field>
            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setEditId(undefined)}>Cancelar</Btn>
              <Btn type="submit" variant="amber" disabled={salvando}><Save size={15} /> {salvando ? 'Salvando...' : 'Salvar conta a pagar'}</Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: parcelar */}
      {parcelando && (
        <FinModal wide title={`Parcelar ${parcelando.id}`} hint={`Total ${money(num(parcelando.valor))} → gera conta mãe e parcelas filhas.`} onClose={() => setParcelando(null)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarParcelar}>
            <Field label="Nº de parcelas" span={4}><Input type="number" min="2" value={parc.n} onChange={(e) => setParc((p) => ({ ...p, n: e.target.value }))} /></Field>
            <Field label="Data de início das parcelas" span={4}><Input type="date" value={parc.dataInicio} onChange={(e) => setParc((p) => ({ ...p, dataInicio: e.target.value }))} /></Field>
            <Field label="Intervalo" span={4}>
              <Select value={parc.intervalo} onChange={(e) => setParc((p) => ({ ...p, intervalo: e.target.value }))}>
                <option value="30">Mensal</option><option value="15">Quinzenal</option><option value="7">Semanal</option>
              </Select>
            </Field>

            <div className="col-span-12">
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-sky-300"><CalendarClock size={14} /> Próximos pagamentos</p>
              {Number(parc.n) >= 2 ? (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
                        <th className="px-4 py-2 text-left">Parcela</th>
                        <th className="px-4 py-2 text-left">Vencimento</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasPreview.map((pr) => (
                        <tr key={pr.parcela} className="border-t border-white/5">
                          <td className="px-4 py-2 font-bold text-white">{pr.parcela}</td>
                          <td className="px-4 py-2 text-white/70">{br(pr.vencimento)}</td>
                          <td className="px-4 py-2 text-right font-bold text-emerald-300">{money(pr.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-white/45">Informe ao menos 2 parcelas.</p>
              )}
            </div>

            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setParcelando(null)}>Cancelar</Btn>
              <Btn type="submit" variant="blue" disabled={salvando || Number(parc.n) < 2}><Split size={15} /> {salvando ? 'Parcelando...' : 'Parcelar'}</Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: pagar */}
      {pagando && (
        <FinModal title={`Pagar ${pagando.id}`} hint="Data real, banco, juros e comprovante obrigatório." onClose={() => setPagando(null)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarPagamento}>
            <Field label="Conta" span={6}><Input value={`${pagando.fornecedor || ''} • ${money(num(pagando.valor))}`} disabled /></Field>
            <Field label="Quando paguei?" span={3}><Input type="date" value={pay.dataPagamento} onChange={(e) => setPayF('dataPagamento', e.target.value)} /></Field>
            <Field label="Valor pago" span={3}><Input type="number" step="0.01" value={pay.valorPago} onChange={(e) => setPayF('valorPago', e.target.value)} /></Field>

            <Field label="Banco usado *" span={6}>
              <Select value={pay.banco} onChange={(e) => setPayF('banco', e.target.value)}>
                <option value="">{bancos.length ? 'Selecione...' : 'Cadastre um banco na aba Bancos'}</option>
                {bancos.map((b) => <option key={b}>{b}</option>)}
              </Select>
            </Field>
            <Field label="Houve juros?" span={6}>
              <Select value={pay.houveJuros} onChange={(e) => setPayF('houveJuros', e.target.value)}><option>Não</option><option>Sim</option></Select>
            </Field>

            {pay.houveJuros === 'Sim' && <>
              <Field label="Valor dos juros" span={4}><Input type="number" step="0.01" value={pay.jurosPago} onChange={(e) => setPayF('jurosPago', e.target.value)} /></Field>
              <Field label="Motivo dos juros" span={8}><Input value={pay.motivoJuros} onChange={(e) => setPayF('motivoJuros', e.target.value)} /></Field>
            </>}

            <div className="col-span-12">
              <label className={labelCls}>Comprovante de pagamento * (obrigatório)</label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-[#0b1220] px-4 py-4 text-sm text-white/60 transition-colors hover:border-amber-500/40">
                <Paperclip size={16} /> {enviandoComprovante ? 'Enviando...' : (pay.comprovanteNome || 'Anexar comprovante (PDF, imagem...)')}
                <input type="file" className="hidden" disabled={enviandoComprovante} onChange={(e) => handleSelecionarComprovante(e.target.files?.[0])} />
              </label>
              {pay.comprovante && (
                <a href={pay.comprovante} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-amber-300 underline">
                  Ver comprovante anexado
                </a>
              )}
            </div>

            <div className="col-span-12 grid grid-cols-2 gap-3">
              <Kpi label="Valor pago" value={money(num(pay.valorPago))} />
              <Kpi label="Juros" value={pay.houveJuros === 'Sim' ? money(num(pay.jurosPago)) : '—'} />
            </div>

            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setPagando(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando || enviandoComprovante || !pay.banco || !pay.comprovante}>
                <Banknote size={15} /> {salvando ? 'Registrando...' : 'Confirmar pagamento'}
              </Btn>
            </div>
          </form>
        </FinModal>
      )}
    </FinCard>
  );
}
