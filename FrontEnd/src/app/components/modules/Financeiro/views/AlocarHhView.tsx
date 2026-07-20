/* =========================================================================================
 * FINANCEIRO — Alocar H.H (sub-aba de Custo por OS)
 * Folha de ponto tabular (pessoas × dias, cada dia com Normal / HE 0,5 / HE 1,0) → resumo por
 * cargo (HN / HE 0,5 / HE 1,0) → valor por cargo → custo de H.H da OS + documento de custo.
 * Regras (da planilha): HN = qtd×valor; HE 100% (1,0) = qtd×valor×2; HE 50% (0,5) = qtd×valor×1,5.
 * =======================================================================================*/
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Save, Download, Lock, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { money, num, todayStr } from '../finData';
import { isEmpresaLinave } from '../../../../utils/company';
import { handleDownloadCustoHhPDF } from '../custoHhPdf';
import { useErp } from '../../../../context/ErpContext';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const proximoDia = (iso: string) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return todayStr;
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const dataBr = (iso: string) => {
  const m = String(iso || '').slice(0, 10).split('-');
  return m.length === 3 && m[0] ? `${m[2]}/${m[1]}/${m[0]}` : '';
};
const mesLabel = (mes: string) => {
  const [y, m] = String(mes || '').split('-');
  return m && y ? `${m}/${y}` : '';
};
// Chave de agrupamento do cargo (campo LIVRE): mesma string (ignorando espaços/caixa) soma junto.
const normCargoKey = (c: string) => String(c || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Sugestões de cargo (o campo é livre — isto é só um datalist de conveniência).
const CARGOS_HH = [
  'Supervisor de obra', 'Caldeireiro/encanador', 'Soldador', 'Ajudante de caldeiraria / firewatch',
  'Eletricista', 'Pintor', 'Maçariqueiro', '1/2 Oficial', 'TST', 'Esmerilhador', 'Mecânico',
];

type Horas = { hn: number; he05: number; he10: number };
type Pessoa = { id: string; nome: string; cargo: string; horas: Record<string, Horas> };

const normHoras = (h: any): Horas => ({ hn: num(h?.hn), he05: num(h?.he05), he10: num(h?.he10) });
const normPessoa = (p: any): Pessoa => ({
  id: String(p?.id || `hh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
  nome: String(p?.nome || ''),
  cargo: String(p?.cargo || CARGOS_HH[0]),
  horas: p?.horas && typeof p.horas === 'object'
    ? Object.fromEntries(Object.entries(p.horas).map(([k, v]) => [k, normHoras(v)]))
    : {},
});

export function AlocarHhView({ osNumero, selected, outrosCustos = [] }: { osNumero: string; selected: any; outrosCustos?: Array<{ tipo: string; descricao: string; valor: number }> }) {
  const { financeiro, saveEntity, clientes, config } = useErp() as any;
  const fechada = Boolean(selected?.fechada);

  const [mes, setMes] = useState<string>('');
  const [escopo, setEscopo] = useState('');
  const [dias, setDias] = useState<string[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const registro = useMemo(
    () => (Array.isArray(financeiro) ? financeiro : []).find((r: any) => r?.tipo === 'hhAlocacao' && String(r?.os) === String(osNumero)) || null,
    [financeiro, osNumero],
  );

  // Carrega o registro salvo ao TROCAR de OS (não a cada mudança de `financeiro`, para não
  // sobrescrever a edição em andamento logo após salvar).
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadedRef.current === osNumero) return;
    loadedRef.current = osNumero;
    const reg = (Array.isArray(financeiro) ? financeiro : []).find((r: any) => r?.tipo === 'hhAlocacao' && String(r?.os) === String(osNumero));
    if (reg) {
      const diasReg = Array.isArray(reg.dias) ? reg.dias.map((d: any) => String(d).slice(0, 10)) : [];
      // mês: do registro; senão deriva do 1º dia ou do início da apuração legada.
      setMes(String(reg.mes || (diasReg[0] || reg.periodo?.de || '').slice(0, 7) || ''));
      setEscopo(String(reg.escopo || ''));
      setDias(diasReg);
      setPessoas(Array.isArray(reg.pessoas) ? reg.pessoas.map(normPessoa) : []);
      setRates(reg.rates && typeof reg.rates === 'object'
        ? Object.fromEntries(Object.entries(reg.rates).map(([k, v]) => [k, String(v ?? '')]))
        : {});
    } else {
      setMes(''); setEscopo(''); setDias([]); setPessoas([]); setRates({});
    }
  }, [osNumero, financeiro]);

  // ---- edição da folha de ponto ----
  const addPessoa = () => setPessoas((ps) => [...ps, { id: `hh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nome: '', cargo: '', horas: {} }]);
  const removePessoa = (id: string) => setPessoas((ps) => ps.filter((p) => p.id !== id));
  const setPessoaCampo = (id: string, campo: 'nome' | 'cargo', v: string) => setPessoas((ps) => ps.map((p) => (p.id === id ? { ...p, [campo]: v } : p)));
  const setHora = (id: string, dia: string, campo: keyof Horas, v: string) =>
    setPessoas((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      const atual = p.horas[dia] || { hn: 0, he05: 0, he10: 0 };
      return { ...p, horas: { ...p.horas, [dia]: { ...atual, [campo]: num(v) } } };
    }));

  const addDia = () => setDias((d) => {
    const ultimo = d[d.length - 1];
    const novo = ultimo ? proximoDia(ultimo) : (mes ? `${mes}-01` : todayStr);
    return [...d, novo];
  });
  const setDiaData = (idx: number, v: string) => setDias((d) => d.map((x, i) => (i === idx ? v.slice(0, 10) : x)));
  const removeDia = (idx: number) => setDias((d) => d.filter((_, i) => i !== idx));

  const totaisPessoa = (p: Pessoa): Horas => {
    let hn = 0, he05 = 0, he10 = 0;
    dias.forEach((dia) => { const h = p.horas[dia]; if (h) { hn += num(h.hn); he05 += num(h.he05); he10 += num(h.he10); } });
    return { hn: round2(hn), he05: round2(he05), he10: round2(he10) };
  };

  // ---- resumo por cargo (campo LIVRE: agrupa por string igual, ignorando espaços/caixa) ----
  const resumo = useMemo(() => {
    const map = new Map<string, { label: string; hn: number; he05: number; he10: number }>();
    pessoas.forEach((p) => {
      const label = (p.cargo || '').trim() || '(sem cargo)';
      const key = normCargoKey(label);
      const t = totaisPessoa(p);
      const cur = map.get(key) || { label, hn: 0, he05: 0, he10: 0 };
      map.set(key, { label: cur.label, hn: round2(cur.hn + t.hn), he05: round2(cur.he05 + t.he05), he10: round2(cur.he10 + t.he10) });
    });
    return Array.from(map.values()).map((v) => ({ cargo: v.label, hn: v.hn, he05: v.he05, he10: v.he10 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas, dias]);

  const totResumo = useMemo(() => resumo.reduce((s, r) => ({ hn: s.hn + r.hn, he05: s.he05 + r.he05, he10: s.he10 + r.he10 }), { hn: 0, he05: 0, he10: 0 }), [resumo]);

  // ---- custo por cargo (HN×v ; HE1,0×v×2 ; HE0,5×v×1,5) ----
  const custos = useMemo(() => resumo.map((r) => {
    const rate = num(rates[r.cargo]);
    const custoHN = round2(r.hn * rate);
    const custoHE10 = round2(r.he10 * rate * 2);
    const custoHE05 = round2(r.he05 * rate * 1.5);
    return { ...r, rate, custoHN, custoHE10, custoHE05, total: round2(custoHN + custoHE10 + custoHE05) };
  }), [resumo, rates]);
  const totalHH = round2(custos.reduce((s, c) => s + c.total, 0));

  // ---- persistência ----
  const salvar = async () => {
    if (fechada) return;
    setSalvando(true);
    try {
      const rec = {
        id: registro?.id || `HHA-${Date.now()}`,
        tipo: 'hhAlocacao' as const,
        os: osNumero,
        mes,
        escopo,
        dias,
        pessoas,
        rates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, num(v)])),
        valor: totalHH,
        data: new Date().toISOString().slice(0, 10),
        createdAt: registro?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const resto = (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => !(r?.tipo === 'hhAlocacao' && String(r?.os) === String(osNumero)));
      await saveEntity('financeiro', [rec, ...resto]);
      toast.success(`Alocação de H.H salva (${money(totalHH)}).`);
    } catch (e) {
      console.error('Erro ao salvar alocação de H.H:', e);
      toast.error('Erro ao salvar a alocação de H.H.');
    } finally {
      setSalvando(false);
    }
  };

  const empresaNome = String(selected?.obra?.empresaPrestadora || 'Linave');
  const clienteNome = useMemo(() => {
    const obra = selected?.obra;
    const cli = (Array.isArray(clientes) ? clientes : []).find((c: any) => String(c?.id) === String(obra?.clienteId));
    return obra?.nomeClienteResolvido || cli?.razaoSocial || cli?.razao_social || selected?.cliente || '';
  }, [selected, clientes]);

  // Período textual do documento: intervalo dos dias lançados, senão o mês de apuração.
  const periodoTxt = useMemo(() => {
    const ord = [...dias].filter(Boolean).sort();
    if (ord.length) return `${dataBr(ord[0])} a ${dataBr(ord[ord.length - 1])}`;
    return mesLabel(mes);
  }, [dias, mes]);

  // completo = inclui a parte de serviço (materiais/terceirizados/outros) + custo total do projeto.
  // resumão (completo=false) = só a mão de obra (H.H): HN + HE 50% + HE 100%.
  const baixarDoc = (completo: boolean) => {
    if (custos.length === 0) { toast.error('Sem dados de H.H para gerar o documento.'); return; }
    const linave = isEmpresaLinave(empresaNome);
    const prestadora = (config?.empresasPrestadoras || []).find((e: any) => String(e?.nome || '').toLowerCase() === empresaNome.toLowerCase());
    handleDownloadCustoHhPDF({
      os: osNumero,
      empresaNome,
      empresaRazao: linave ? 'W.L.M LINAVE Serviços Navais e Offshore' : (prestadora?.nome || empresaNome),
      cnpj: linave ? '34.282.247/0001-60' : (prestadora?.cnpj || ''),
      cliente: clienteNome,
      escopo,
      embarcacao: selected?.embarcacao || '',
      periodoTxt,
      mes: mesLabel(mes),
      custos,
      totalHH,
      completo,
      outrosCustos: completo ? outrosCustos : [],
    });
  };

  const cellInput = 'w-14 bg-[#101f3d] border border-white/10 rounded px-1 py-1 text-white text-xs text-center outline-none focus:border-emerald-500';
  const rateInput = 'w-24 bg-[#101f3d] border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-emerald-500';

  if (!osNumero) {
    return <p className="text-white/40 text-sm bg-[#0b1220] rounded-xl border border-white/5 p-6">Selecione uma OS acima para alocar H.H.</p>;
  }

  return (
    <div className="space-y-6">
      {fechada && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-xs">
          <Lock size={14} /> OS fechada — a alocação de H.H fica somente leitura.
        </div>
      )}

      {/* Cabeçalho da apuração */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Escopo do serviço</label>
          <input value={escopo} onChange={(e) => setEscopo(e.target.value)} disabled={fechada} placeholder="Ex.: Fornecimento de mão de obra de caldeiraria" className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30" />
        </div>
        <div>
          <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Mês de apuração</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} disabled={fechada} className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-sm [color-scheme:dark]" />
        </div>
      </div>

      {/* Folha de ponto */}
      <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-emerald-300 text-xs font-black uppercase tracking-widest flex items-center gap-2"><Users size={14} /> Folha de ponto (horas por dia)</h3>
          <div className="flex gap-2">
            <button onClick={addDia} disabled={fechada} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase disabled:opacity-40">+ Dia</button>
            <button onClick={addPessoa} disabled={fechada} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-black uppercase disabled:opacity-40">+ Pessoa</button>
          </div>
        </div>
        <p className="text-white/30 text-[10px] mb-2">Cada dia tem 3 campos: <span className="text-white/60 font-bold">N</span> (normal), <span className="text-white/60 font-bold">0,5</span> (HE 50%) e <span className="text-white/60 font-bold">1,0</span> (HE 100%).</p>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70">
                <th className="border border-white/10 px-2 py-2 text-left sticky left-0 bg-[#0e1a30] min-w-[150px]">Nome</th>
                <th className="border border-white/10 px-2 py-2 text-left min-w-[160px]">Cargo</th>
                {dias.map((d, idx) => (
                  <th key={idx} className="border border-white/10 px-1 py-1 text-center min-w-[150px]">
                    <div className="flex items-center justify-center gap-1">
                      <input type="date" value={d} onChange={(e) => setDiaData(idx, e.target.value)} disabled={fechada} className="w-[110px] bg-[#101f3d] border border-white/10 rounded px-1 py-0.5 text-white text-[10px] [color-scheme:dark]" />
                      {!fechada && <button onClick={() => removeDia(idx)} className="text-red-300 hover:text-red-200" title="Remover dia"><X size={11} /></button>}
                    </div>
                    <div className="mt-1 flex justify-center gap-1 text-[9px] text-white/40 font-bold"><span className="w-14">N</span><span className="w-14">0,5</span><span className="w-14">1,0</span></div>
                  </th>
                ))}
                <th className="border border-white/10 px-2 py-2 text-center bg-emerald-500/10 min-w-[60px]">HN</th>
                <th className="border border-white/10 px-2 py-2 text-center bg-amber-500/10 min-w-[60px]">HE 0,5</th>
                <th className="border border-white/10 px-2 py-2 text-center bg-sky-500/10 min-w-[60px]">HE 1,0</th>
                <th className="border border-white/10 px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pessoas.length === 0 && (
                <tr><td colSpan={6 + dias.length} className="border border-white/10 px-3 py-4 text-white/40 text-center">Nenhuma pessoa. Clique em "+ Pessoa" e "+ Dia" para montar a folha.</td></tr>
              )}
              {pessoas.map((p) => {
                const t = totaisPessoa(p);
                return (
                  <tr key={p.id} className="text-white">
                    <td className="border border-white/10 p-1 sticky left-0 bg-[#0b1220]">
                      <input value={p.nome} onChange={(e) => setPessoaCampo(p.id, 'nome', e.target.value)} disabled={fechada} className="w-full min-w-[140px] bg-[#101f3d] border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Nome" />
                    </td>
                    <td className="border border-white/10 p-1">
                      <input list="cargos-hh" value={p.cargo} onChange={(e) => setPessoaCampo(p.id, 'cargo', e.target.value)} disabled={fechada} className="w-full min-w-[150px] bg-[#101f3d] border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Cargo" />
                    </td>
                    {dias.map((d) => {
                      const h = p.horas[d] || { hn: 0, he05: 0, he10: 0 };
                      return (
                        <td key={d} className="border border-white/10 p-1">
                          <div className="flex justify-center gap-1">
                            <input type="number" min="0" step="0.5" value={h.hn || ''} onChange={(e) => setHora(p.id, d, 'hn', e.target.value)} disabled={fechada} className={cellInput} />
                            <input type="number" min="0" step="0.5" value={h.he05 || ''} onChange={(e) => setHora(p.id, d, 'he05', e.target.value)} disabled={fechada} className={`${cellInput} text-amber-200`} />
                            <input type="number" min="0" step="0.5" value={h.he10 || ''} onChange={(e) => setHora(p.id, d, 'he10', e.target.value)} disabled={fechada} className={`${cellInput} text-sky-200`} />
                          </div>
                        </td>
                      );
                    })}
                    <td className="border border-white/10 px-2 py-1 text-center font-black text-emerald-300">{t.hn}</td>
                    <td className="border border-white/10 px-2 py-1 text-center font-black text-amber-300">{t.he05}</td>
                    <td className="border border-white/10 px-2 py-1 text-center font-black text-sky-300">{t.he10}</td>
                    <td className="border border-white/10 px-1 py-1 text-center">
                      {!fechada && <button onClick={() => removePessoa(p.id)} className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300"><Trash2 size={12} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="cargos-hh">{CARGOS_HH.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </div>

      {/* Resumo por cargo */}
      <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <h3 className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-3">Resumo por cargo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70 uppercase">
                <th className="border border-white/10 px-3 py-2 text-left">Cargo</th>
                <th className="border border-white/10 px-3 py-2 text-right">HN</th>
                <th className="border border-white/10 px-3 py-2 text-right">HE 0,5 (50%)</th>
                <th className="border border-white/10 px-3 py-2 text-right">HE 1,0 (100%)</th>
              </tr>
            </thead>
            <tbody>
              {resumo.length === 0 ? (
                <tr><td colSpan={4} className="border border-white/10 px-3 py-3 text-white/40 text-center">Sem horas lançadas.</td></tr>
              ) : resumo.map((r) => (
                <tr key={r.cargo} className="text-white">
                  <td className="border border-white/10 px-3 py-2">{r.cargo}</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-emerald-300 font-bold">{r.hn}</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-amber-300 font-bold">{r.he05}</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-sky-300 font-bold">{r.he10}</td>
                </tr>
              ))}
              {resumo.length > 0 && (
                <tr className="bg-white/5 text-white font-black">
                  <td className="border border-white/10 px-3 py-2 uppercase">Total</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{round2(totResumo.hn)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{round2(totResumo.he05)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{round2(totResumo.he10)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Valor por cargo → custo */}
      <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <h3 className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Valor por cargo → custo de H.H</h3>
        <p className="text-white/30 text-[10px] mb-3">Informe o valor da hora (R$) de cada cargo. HN = qtd×valor · HE 50% = qtd×valor×1,5 · HE 100% = qtd×valor×2.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70 uppercase">
                <th className="border border-white/10 px-3 py-2 text-left">Cargo</th>
                <th className="border border-white/10 px-3 py-2 text-center">Valor/hora (R$)</th>
                <th className="border border-white/10 px-3 py-2 text-right">Custo HN</th>
                <th className="border border-white/10 px-3 py-2 text-right">Custo HE 50%</th>
                <th className="border border-white/10 px-3 py-2 text-right">Custo HE 100%</th>
                <th className="border border-white/10 px-3 py-2 text-right">Total cargo</th>
              </tr>
            </thead>
            <tbody>
              {custos.length === 0 ? (
                <tr><td colSpan={6} className="border border-white/10 px-3 py-3 text-white/40 text-center">Sem horas lançadas.</td></tr>
              ) : custos.map((c) => (
                <tr key={c.cargo} className="text-white">
                  <td className="border border-white/10 px-3 py-2">{c.cargo}</td>
                  <td className="border border-white/10 px-3 py-2 text-center">
                    <input type="number" min="0" step="0.01" value={rates[c.cargo] ?? ''} onChange={(e) => setRates((r) => ({ ...r, [c.cargo]: e.target.value }))} disabled={fechada} className={rateInput} placeholder="0,00" />
                  </td>
                  <td className="border border-white/10 px-3 py-2 text-right">{money(c.custoHN)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{money(c.custoHE05)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{money(c.custoHE10)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right font-black text-emerald-300">{money(c.total)}</td>
                </tr>
              ))}
              {custos.length > 0 && (
                <tr className="bg-white/5 text-white font-black">
                  <td colSpan={5} className="border border-white/10 px-3 py-2 uppercase text-right">Total de mão de obra (H.H)</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-emerald-300 text-sm">{money(totalHH)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button onClick={() => baixarDoc(false)} className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2" title="Só mão de obra: HN + HE 50% + HE 100%"><Download size={15} /> Resumão H.H</button>
        <button onClick={() => baixarDoc(true)} className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2" title="H.H + materiais/terceirizados + custo total do projeto"><Download size={15} /> Custo completo</button>
        <button onClick={salvar} disabled={salvando || fechada} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
          <Save size={15} /> {salvando ? 'Salvando…' : `Salvar alocação (${money(totalHH)})`}
        </button>
      </div>
    </div>
  );
}
