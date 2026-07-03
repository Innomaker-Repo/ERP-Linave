import React, { useMemo, useState } from 'react';
import { Plus, X, Download, FileText, Trash2, Pencil } from 'lucide-react';
import { FinCard, Toolbar } from '../finUi';
import { money } from '../finData';
import { useErp } from '../../../../context/ErpContext';
import { gerarReciboLocacaoPDF } from '../reciboLocacaoPdf';

const isLinaveEmpresa = (empresa?: any) => {
  const s = String(empresa || '').toLowerCase();
  return s.includes('linave') || s.includes('wlm') || s.includes('w.l.m');
};

// O emitente (razão social, CNPJ, inscrições, banco) E o logo do recibo dependem da EMPRESA
// PRESTADORA (Linave × Servinave), definida lá na criação do serviço/OS. Presets abaixo.
const PRESETS: Record<'Linave' | 'Servinave', any> = {
  Servinave: {
    emitenteNome: 'VTS REPAROS NAVAIS',
    emitenteEndereco: 'RUA MIGUEL DE LEMOS, N°44, FUNDOS PONTA D`AREIA',
    emitenteCep: '24040-260',
    emitenteCidadeUf: 'NITERÓI – RJ',
    emitenteCnpj: '33.189.684/0001-70',
    emitenteInscMunicipal: '3026559',
    emitenteInscEstadual: '11.399.584',
    atendimento: '(21) 9 9179-8282 - VINICIUS TINOCO',
    banco: 'Banco Itaú – Agência 6030 C/c 47280-4',
    formaPagamento: 'Depósito em C/C',
  },
  Linave: {
    emitenteNome: 'W.L.M LINAVE Serviços Navais e Offshore',
    emitenteEndereco: '',
    emitenteCep: '',
    emitenteCidadeUf: '',
    emitenteCnpj: '34.282.247/0001-60',
    emitenteInscMunicipal: '',
    emitenteInscEstadual: '',
    atendimento: '',
    banco: '',
    formaPagamento: 'Depósito em C/C',
  },
};

// Resolve o emitente pela empresa prestadora, priorizando o cadastro (config) quando preenchido.
const resolveEmitente = (empresa: any, config: any) => {
  const linave = isLinaveEmpresa(empresa);
  const key: 'Linave' | 'Servinave' = linave ? 'Linave' : 'Servinave';
  const preset = PRESETS[key];
  const lista = Array.isArray(config?.empresasPrestadoras) ? config.empresasPrestadoras : [];
  const cfg = lista.find((e: any) => isLinaveEmpresa(e?.nome) === linave) || {};
  const ou = (a: any, b: any) => (String(a || '').trim() ? a : b);
  return {
    empresa: key,
    emitenteNome: preset.emitenteNome,
    emitenteEndereco: ou(cfg.endereco, preset.emitenteEndereco),
    emitenteCep: preset.emitenteCep,
    emitenteCidadeUf: preset.emitenteCidadeUf,
    emitenteCnpj: ou(cfg.cnpj, preset.emitenteCnpj),
    emitenteInscMunicipal: preset.emitenteInscMunicipal,
    emitenteInscEstadual: preset.emitenteInscEstadual,
    atendimento: ou(cfg.contato, preset.atendimento),
    banco: preset.banco,
    formaPagamento: preset.formaPagamento,
  };
};

const linhaItem = () => ({ id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, item: '', qtd: '', descricao: '', valorUnitario: '', total: '' });

const hoje = () => new Date().toISOString().slice(0, 10);

const novoNumero = (recibos: any[]) => {
  const ano = String(new Date().getFullYear()).slice(-2);
  const doAno = recibos.filter((r) => String(r.numero || '').endsWith(`/${ano}`));
  const maior = doAno.reduce((m, r) => Math.max(m, parseInt(String(r.numero || '').split('/')[0], 10) || 0), 0);
  return `${String(maior + 1).padStart(3, '0')}/${ano}`;
};

const formInicial = (recibos: any[], empresa: any, config: any) => ({
  id: `REC-${Date.now()}`,
  tipo: 'reciboLocacao' as const,
  status: 'pendente',
  numero: novoNumero(recibos),
  ...resolveEmitente(empresa, config),
  dataEmissao: hoje(),
  dataVencimento: hoje(),
  clienteNome: '', clienteLogradouro: '', clienteBairro: '', clienteMunicipio: '',
  clienteUf: '', clienteCep: '', clienteCnpj: '', clienteInscEst: '', clienteIncMun: '',
  itens: [linhaItem()],
  obs: '',
  createdAt: new Date().toISOString(),
});

export function ReciboLocacaoView() {
  const { financeiro, saveEntity, config } = useErp() as any;
  const [form, setForm] = useState<any>(null);

  const recibos = useMemo(
    () => (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => r?.tipo === 'reciboLocacao'),
    [financeiro],
  );

  const persistir = async (rec: any) => {
    const outros = (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => r?.id !== rec.id);
    await saveEntity('financeiro', [rec, ...outros]);
  };

  const abrirNovo = () => setForm(formInicial(recibos, 'Servinave', config));
  const editar = (r: any) => setForm({ ...formInicial(recibos, r.empresa, config), ...r, itens: (Array.isArray(r.itens) && r.itens.length ? r.itens : [linhaItem()]).map((i: any) => ({ ...linhaItem(), ...i })) });

  const set = (campo: string, valor: any) => setForm((f: any) => ({ ...f, [campo]: valor }));
  // Trocar a empresa prestadora reaplica o emitente (razão social, CNPJ, banco...) e o logo do PDF.
  const trocarEmpresa = (empresa: string) => setForm((f: any) => ({ ...f, ...resolveEmitente(empresa, config) }));
  const setItem = (id: string, campo: string, valor: any) => setForm((f: any) => ({
    ...f,
    itens: f.itens.map((i: any) => {
      if (i.id !== id) return i;
      const next = { ...i, [campo]: valor };
      if (campo === 'qtd' || campo === 'valorUnitario') {
        const q = parseFloat(String(next.qtd).replace(',', '.')) || 0;
        const u = parseFloat(String(next.valorUnitario).replace(',', '.')) || 0;
        next.total = q > 0 ? String(Math.round(q * u * 100) / 100) : String(u);
      }
      return next;
    }),
  }));
  const addItem = () => setForm((f: any) => ({ ...f, itens: [...f.itens, linhaItem()] }));
  const removeItem = (id: string) => setForm((f: any) => ({ ...f, itens: f.itens.filter((i: any) => i.id !== id) }));

  const totalRecibo = (form?.itens || []).reduce((s: number, i: any) => s + (parseFloat(String(i.total).replace(',', '.')) || 0), 0);

  const dadosPdf = (f: any) => ({
    ...f,
    itens: (f.itens || [])
      .filter((i: any) => String(i.descricao || '').trim())
      .map((i: any) => ({
        item: i.item, qtd: i.qtd, descricao: i.descricao,
        valorUnitario: parseFloat(String(i.valorUnitario).replace(',', '.')) || 0,
        total: parseFloat(String(i.total).replace(',', '.')) || 0,
      })),
  });

  const salvar = async () => {
    if (!form) return;
    await persistir(form);
    setForm(null);
  };
  const gerar = async () => {
    if (!form) return;
    await persistir({ ...form, status: 'emitido' });
    await gerarReciboLocacaoPDF(dadosPdf(form));
    setForm(null);
  };
  const excluir = async (r: any) => {
    if (!window.confirm(`Excluir o recibo ${r.numero}?`)) return;
    await saveEntity('financeiro', (Array.isArray(financeiro) ? financeiro : []).filter((x: any) => x?.id !== r.id));
  };

  const inp = 'w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30';
  const lbl = 'text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block';

  return (
    <FinCard>
      <Toolbar
        title="Fazer Recibo de Locação"
        hint="Recibo de locação (não sujeito a NFS-e). As solicitações vindas da Medição aparecem aqui pré-preenchidas."
      />

      {!form ? (
        <>
          <div className="mb-4 flex justify-end">
            <button onClick={abrirNovo} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] text-xs font-black uppercase flex items-center gap-2">
              <Plus size={15} /> Novo recibo
            </button>
          </div>
          {recibos.length === 0 ? (
            <p className="text-white/40 text-sm bg-[#0b1220] rounded-xl border border-white/5 p-6">Nenhum recibo. Crie um novo ou aprove uma medição de locação.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {recibos.map((r: any) => (
                <div key={r.id} className="bg-[#101f3d] rounded-2xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-black">Recibo {r.numero} {r.medicaoNumero ? <span className="text-cyan-300/70 text-xs">· da medição {r.medicaoNumero}</span> : null}</p>
                      <p className="text-white/50 text-xs truncate">{r.clienteNome || 'Cliente não informado'}</p>
                      <p className="text-emerald-300 text-sm font-black mt-1">R$ {money((r.itens || []).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0))}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-black uppercase border ${r.status === 'emitido' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>{r.status === 'emitido' ? 'Emitido' : 'Pendente'}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => editar(r)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase flex items-center gap-1"><Pencil size={12} /> Preencher / editar</button>
                    <button onClick={() => gerarReciboLocacaoPDF(dadosPdf({ ...formInicial(recibos, r.empresa, config), ...r }))} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-black uppercase flex items-center gap-1"><Download size={12} /> PDF</button>
                    <button onClick={() => excluir(r)} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-[11px] font-black uppercase flex items-center gap-1"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black uppercase text-sm flex items-center gap-2"><FileText size={16} /> Recibo {form.numero}</h3>
            <button onClick={() => setForm(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={18} className="text-white/60" /></button>
          </div>

          {/* Dados do recibo */}
          <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
            <p className="text-emerald-300 text-xs font-black uppercase mb-3">Dados do recibo</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={lbl}>Empresa prestadora</label>
                <select className={inp} value={isLinaveEmpresa(form.empresa) ? 'Linave' : 'Servinave'} onChange={(e) => trocarEmpresa(e.target.value)}>
                  <option value="Servinave">Servinave (VTS)</option>
                  <option value="Linave">Linave</option>
                </select>
              </div>
              <div><label className={lbl}>Nº do recibo</label><input className={inp} value={form.numero} onChange={(e) => set('numero', e.target.value)} /></div>
              <div><label className={lbl}>Data de emissão</label><input type="date" className={inp} value={form.dataEmissao} onChange={(e) => set('dataEmissao', e.target.value)} /></div>
              <div><label className={lbl}>Data de vencimento</label><input type="date" className={inp} value={form.dataVencimento} onChange={(e) => set('dataVencimento', e.target.value)} /></div>
              <div><label className={lbl}>Forma de pagamento</label><input className={inp} value={form.formaPagamento} onChange={(e) => set('formaPagamento', e.target.value)} /></div>
              <div className="md:col-span-4"><label className={lbl}>Banco</label><input className={inp} value={form.banco} onChange={(e) => set('banco', e.target.value)} /></div>
            </div>
          </section>

          {/* Emitente */}
          <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
            <p className="text-emerald-300 text-xs font-black uppercase mb-3">Emitente (prestadora)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="md:col-span-2"><label className={lbl}>Razão social</label><input className={inp} value={form.emitenteNome} onChange={(e) => set('emitenteNome', e.target.value)} /></div>
              <div><label className={lbl}>CNPJ</label><input className={inp} value={form.emitenteCnpj} onChange={(e) => set('emitenteCnpj', e.target.value)} /></div>
              <div><label className={lbl}>Atendimento</label><input className={inp} value={form.atendimento} onChange={(e) => set('atendimento', e.target.value)} /></div>
              <div className="md:col-span-2"><label className={lbl}>Endereço</label><input className={inp} value={form.emitenteEndereco} onChange={(e) => set('emitenteEndereco', e.target.value)} /></div>
              <div><label className={lbl}>CEP</label><input className={inp} value={form.emitenteCep} onChange={(e) => set('emitenteCep', e.target.value)} /></div>
              <div><label className={lbl}>Cidade / UF</label><input className={inp} value={form.emitenteCidadeUf} onChange={(e) => set('emitenteCidadeUf', e.target.value)} /></div>
              <div><label className={lbl}>Inscrição municipal</label><input className={inp} value={form.emitenteInscMunicipal} onChange={(e) => set('emitenteInscMunicipal', e.target.value)} /></div>
              <div><label className={lbl}>Inscrição estadual</label><input className={inp} value={form.emitenteInscEstadual} onChange={(e) => set('emitenteInscEstadual', e.target.value)} /></div>
            </div>
          </section>

          {/* Destinatário */}
          <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
            <p className="text-emerald-300 text-xs font-black uppercase mb-3">Usuário final / Destinatário</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="md:col-span-4"><label className={lbl}>Nome / Razão social</label><input className={inp} value={form.clienteNome} onChange={(e) => set('clienteNome', e.target.value)} /></div>
              <div className="md:col-span-2"><label className={lbl}>Logradouro</label><input className={inp} value={form.clienteLogradouro} onChange={(e) => set('clienteLogradouro', e.target.value)} /></div>
              <div><label className={lbl}>Bairro</label><input className={inp} value={form.clienteBairro} onChange={(e) => set('clienteBairro', e.target.value)} /></div>
              <div><label className={lbl}>Município</label><input className={inp} value={form.clienteMunicipio} onChange={(e) => set('clienteMunicipio', e.target.value)} /></div>
              <div><label className={lbl}>UF</label><input className={inp} value={form.clienteUf} onChange={(e) => set('clienteUf', e.target.value)} /></div>
              <div><label className={lbl}>CEP</label><input className={inp} value={form.clienteCep} onChange={(e) => set('clienteCep', e.target.value)} /></div>
              <div><label className={lbl}>CNPJ</label><input className={inp} value={form.clienteCnpj} onChange={(e) => set('clienteCnpj', e.target.value)} /></div>
              <div><label className={lbl}>Inscrição estadual</label><input className={inp} value={form.clienteInscEst} onChange={(e) => set('clienteInscEst', e.target.value)} /></div>
              <div><label className={lbl}>Inscrição municipal</label><input className={inp} value={form.clienteIncMun} onChange={(e) => set('clienteIncMun', e.target.value)} /></div>
            </div>
          </section>

          {/* Itens */}
          <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-emerald-300 text-xs font-black uppercase">Itens de locação</p>
              <button onClick={addItem} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-black uppercase">+ Item</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-white/5 text-white/70 uppercase tracking-wider">
                    {['Item', 'Qtd', 'Descrição', 'Vl. Unit.', 'Total', ''].map((h) => <th key={h} className="border border-white/10 px-2 py-2 text-left">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(form.itens || []).map((i: any) => (
                    <tr key={i.id} className="text-white">
                      <td className="border border-white/10 p-1"><input className={`w-14 ${inp}`} value={i.item} onChange={(e) => setItem(i.id, 'item', e.target.value)} placeholder="01" /></td>
                      <td className="border border-white/10 p-1"><input className={`w-16 ${inp}`} value={i.qtd} onChange={(e) => setItem(i.id, 'qtd', e.target.value)} /></td>
                      <td className="border border-white/10 p-1"><textarea rows={2} className={`w-full min-w-[240px] resize-y ${inp}`} value={i.descricao} onChange={(e) => setItem(i.id, 'descricao', e.target.value)} placeholder="Descrição (equipamento, período, P.O ...)" /></td>
                      <td className="border border-white/10 p-1"><input className={`w-24 ${inp}`} value={i.valorUnitario} onChange={(e) => setItem(i.id, 'valorUnitario', e.target.value)} placeholder="0,00" /></td>
                      <td className="border border-white/10 p-1"><input className={`w-24 ${inp}`} value={i.total} onChange={(e) => setItem(i.id, 'total', e.target.value)} placeholder="0,00" /></td>
                      <td className="border border-white/10 p-1 text-center"><button onClick={() => removeItem(i.id)} className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300"><X size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-right text-white/50 text-xs uppercase font-black tracking-widest mt-3">Valor total: <span className="text-emerald-300 text-lg">R$ {money(totalRecibo)}</span></p>
            <div className="mt-3"><label className={lbl}>Observação (OBS)</label><input className={inp} value={form.obs} onChange={(e) => set('obs', e.target.value)} /></div>
          </section>

          <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
            <button onClick={() => setForm(null)} className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black uppercase">Cancelar</button>
            <button onClick={salvar} className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase">Salvar</button>
            <button onClick={gerar} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-black uppercase flex items-center gap-2"><Download size={15} /> Gerar recibo (PDF)</button>
          </div>
        </div>
      )}
    </FinCard>
  );
}
