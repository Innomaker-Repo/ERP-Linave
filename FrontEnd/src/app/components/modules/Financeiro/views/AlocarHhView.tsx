/* =========================================================================================
 * FINANCEIRO — Alocar H.H (sub-aba de Custo por OS)
 * Folha de ponto tabular (pessoas × dias, cada dia com Normal / HE 0,5 / HE 1,0 / HE 0,2) →
 * resumo por cargo (HN / HE 0,5 / HE 1,0 / HE 0,2) → valor por cargo → custo de H.H da OS +
 * documento de custo.
 * Regras (da planilha): HN = qtd×valor; HE 100% (1,0) = qtd×valor×2; HE 50% (0,5) = qtd×valor×1,5;
 * HE 0,2 (adicional noturno, +20%) = qtd×valor×1,2.
 * =======================================================================================*/
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Save, Download, Lock, Users, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { money, num, todayStr } from '../finData';
import {
  CARGOS_HH, FOLHA_VAZIA, HORAS_ZERO, custosDoResumo, folhaDoRegistro, folhasIguais, mesclarFolha, removerDia,
  resumoDaFolha, taxaDoCargo, temHoras, totaisPessoa, totalDaFolha, trocarDataDaColuna,
  type Folha, type Horas, type Pessoa,
} from '../alocarHhFolha';
import { MoneyInput } from '../finUi';
import { isEmpresaLinave } from '../../../../utils/company';
import { handleDownloadCustoHhPDF } from '../custoHhPdf';
import { useErp } from '../../../../context/ErpContext';
import { comFinanceiroAtual } from '../../../../../services/financeiroSeguro';
import { confirmDialog } from '../../../ui/feedback';
import { ScrollXTop } from '../../../ui/scrollXTop';

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
  // Folha como está salva AGORA no servidor (o contexto recarrega o Financeiro a cada 45s/foco).
  const folhaServidor = useMemo(() => folhaDoRegistro(registro), [registro]);

  // `base` = versão salva que esta tela carregou por último. Comparar a tela com ela diz se há
  // edição não salva; comparar o servidor com ela diz se alguém salvou depois que abri.
  const [base, setBase] = useState<Folha>(FOLHA_VAZIA);
  const [outraVersaoSalva, setOutraVersaoSalva] = useState(false);
  const folhaLocal: Folha = useMemo(() => ({ mes, escopo, dias, pessoas, rates }), [mes, escopo, dias, pessoas, rates]);
  const sujo = !folhasIguais(folhaLocal, base);

  const carregarFolha = (f: Folha) => {
    setMes(f.mes); setEscopo(f.escopo); setDias(f.dias); setPessoas(f.pessoas); setRates(f.rates);
    setBase(f);
    setOutraVersaoSalva(false);
  };

  // Trocou de OS: carrega a folha salva dela. Mesma OS, mas alguém salvou uma versão nova (ex.:
  // o RH lançou mais dias enquanto o admin estava com a tela aberta): antes a tela ficava presa
  // na cópia de quando a OS foi aberta — por isso dias lançados "não apareciam". Sem edição em
  // andamento, atualiza na hora; com edição, avisa (o salvar já combina as duas, ver mesclarFolha).
  const osCarregadaRef = useRef<string | null>(null);
  useEffect(() => {
    if (osCarregadaRef.current !== osNumero) {
      osCarregadaRef.current = osNumero;
      carregarFolha(folhaServidor);
      return;
    }
    if (folhasIguais(folhaServidor, base)) return;
    if (!sujo) carregarFolha(folhaServidor);
    else setOutraVersaoSalva(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osNumero, folhaServidor]);

  // ---- edição da folha de ponto ----
  const addPessoa = () => setPessoas((ps) => [...ps, { id: `hh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nome: '', cargo: '', horas: {} }]);
  const removePessoa = (id: string) => setPessoas((ps) => ps.filter((p) => p.id !== id));
  const setPessoaCampo = (id: string, campo: 'nome' | 'cargo', v: string) => setPessoas((ps) => ps.map((p) => (p.id === id ? { ...p, [campo]: v } : p)));
  const setHora = (id: string, dia: string, campo: keyof Horas, v: string) =>
    setPessoas((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      const atual = p.horas[dia] || HORAS_ZERO;
      return { ...p, horas: { ...p.horas, [dia]: { ...atual, [campo]: num(v) } } };
    }));

  const addDia = () => setDias((d) => {
    const ultimo = d[d.length - 1];
    let novo = ultimo ? proximoDia(ultimo) : (mes ? `${mes}-01` : todayStr);
    while (d.includes(novo)) novo = proximoDia(novo); // nunca duas colunas com a mesma data
    return [...d, novo];
  });
  const aplicarDias = (f: Folha) => { setDias(f.dias); setPessoas(f.pessoas); };
  // Coluna com horas nunca é movida nem apagada ao trocar a data: a nova vira outro dia.
  const setDiaData = (idx: number, v: string) => {
    const novo = v.slice(0, 10);
    const antigo = dias[idx];
    if (novo === antigo) return true;
    if (!novo) return false;
    if (dias.includes(novo)) { toast.error(`O dia ${dataBr(novo)} já está na folha.`); return false; }
    aplicarDias(trocarDataDaColuna(folhaLocal, antigo, novo));
    return false; // a coluna é redesenhada pela lista de dias; o campo volta à data dela
  };
  const removeDia = async (idx: number) => {
    const dia = dias[idx];
    if (pessoas.some((p) => temHoras(p.horas[dia]))) {
      const ok = await confirmDialog({
        title: 'Remover dia',
        message: `O dia ${dataBr(dia)} tem horas lançadas. Remover o dia apaga essas horas da folha.`,
        confirmText: 'Remover', cancelText: 'Cancelar', danger: true,
      });
      if (!ok) return;
    }
    aplicarDias(removerDia(folhaLocal, dia));
  };

  const resumo = useMemo(() => resumoDaFolha(pessoas, dias), [pessoas, dias]);
  const totResumo = useMemo(() => resumo.reduce((s, r) => ({ hn: s.hn + r.hn, he05: s.he05 + r.he05, he10: s.he10 + r.he10, he02: s.he02 + r.he02 }), { hn: 0, he05: 0, he10: 0, he02: 0 }), [resumo]);
  const custos = useMemo(() => custosDoResumo(resumo, rates), [resumo, rates]);
  const totalHH = round2(custos.reduce((s, c) => s + c.total, 0));

  // ---- persistência ----
  // Combina com a versão MAIS NOVA do servidor (buscada na hora por comFinanceiroAtual): só o
  // que este usuário mudou desde que abriu a folha é aplicado. Antes a folha inteira da tela
  // sobrescrevia a salva — quem salvava por último apagava o que o outro tinha lançado.
  const salvar = async () => {
    if (fechada) return;
    setSalvando(true);
    try {
      const resultado = await comFinanceiroAtual(async (financeiroAtual) => {
        const regAtual = financeiroAtual.find((r: any) => r?.tipo === 'hhAlocacao' && String(r?.os) === String(osNumero)) || null;
        const mesclada = mesclarFolha(base, folhaLocal, folhaDoRegistro(regAtual));
        const rec = {
          id: regAtual?.id || registro?.id || `HHA-${Date.now()}`,
          tipo: 'hhAlocacao' as const,
          os: osNumero,
          mes: mesclada.mes,
          escopo: mesclada.escopo,
          dias: mesclada.dias,
          pessoas: mesclada.pessoas,
          rates: Object.fromEntries(Object.entries(mesclada.rates).map(([k, v]) => [k, num(v)])),
          valor: totalDaFolha(mesclada),
          data: new Date().toISOString().slice(0, 10),
          createdAt: regAtual?.createdAt || registro?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const resto = financeiroAtual.filter((r: any) => !(r?.tipo === 'hhAlocacao' && String(r?.os) === String(osNumero)));
        await saveEntity('financeiro', [rec, ...resto]);
        return rec;
      });
      if (!resultado) return; // comFinanceiroAtual já avisou o usuário do erro
      // A tela passa a mostrar exatamente o que foi gravado (inclui o que outra pessoa salvou).
      carregarFolha(folhaDoRegistro(resultado));
      toast.success(`Alocação de H.H salva (${money(resultado.valor)}).`);
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
      empresaRazao: linave ? 'LINAVE Serviços Navais e Offshore' : (prestadora?.nome || empresaNome),
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

      {outraVersaoSalva && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sky-100 text-xs">
          <span>Outra pessoa salvou alterações nesta folha enquanto você editava. Ao salvar, as suas alterações são combinadas com as dela — nada do que ela lançou se perde.</span>
          <button onClick={() => carregarFolha(folhaServidor)} className="flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 font-black uppercase tracking-widest hover:bg-sky-500/30">
            <RefreshCw size={12} /> Descartar minhas edições e ver a versão salva
          </button>
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
        <p className="text-white/30 text-[10px] mb-2">Cada dia tem 4 campos: <span className="text-white/60 font-bold">N</span> (normal), <span className="text-white/60 font-bold">0,5</span> (HE 50%), <span className="text-white/60 font-bold">1,0</span> (HE 100%) e <span className="text-white/60 font-bold">0,2</span> (adicional noturno, +20%).</p>

        <ScrollXTop>
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70">
                <th className="border border-white/10 px-2 py-2 text-left sticky left-0 bg-[#0e1a30] min-w-[150px]">Nome</th>
                <th className="border border-white/10 px-2 py-2 text-left min-w-[160px]">Cargo</th>
                {dias.map((d, idx) => (
                  <th key={d} className="border border-white/10 px-1 py-1 text-center min-w-[150px]">
                    <div className="flex items-center justify-center gap-1">
                      <input type="date" defaultValue={d} onBlur={(e) => { if (!setDiaData(idx, e.target.value)) e.target.value = d; }} disabled={fechada} className="w-[110px] bg-[#101f3d] border border-white/10 rounded px-1 py-0.5 text-white text-[10px] [color-scheme:dark]" />
                      {!fechada && <button onClick={() => removeDia(idx)} className="text-red-300 hover:text-red-200" title="Remover dia"><X size={11} /></button>}
                    </div>
                    <div className="mt-1 flex justify-center gap-1 text-[9px] text-white/40 font-bold"><span className="w-14">N</span><span className="w-14">0,5</span><span className="w-14">1,0</span><span className="w-14">0,2</span></div>
                  </th>
                ))}
                <th className="border border-white/10 px-2 py-2 text-center bg-emerald-500/10 min-w-[60px]">HN</th>
                <th className="border border-white/10 px-2 py-2 text-center bg-amber-500/10 min-w-[60px]">HE 0,5</th>
                <th className="border border-white/10 px-2 py-2 text-center bg-sky-500/10 min-w-[60px]">HE 1,0</th>
                <th className="border border-white/10 px-2 py-2 text-center bg-violet-500/10 min-w-[60px]">HE 0,2</th>
                <th className="border border-white/10 px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pessoas.length === 0 && (
                <tr><td colSpan={7 + dias.length} className="border border-white/10 px-3 py-4 text-white/40 text-center">Nenhuma pessoa. Clique em "+ Pessoa" e "+ Dia" para montar a folha.</td></tr>
              )}
              {pessoas.map((p) => {
                const t = totaisPessoa(p, dias);
                return (
                  <tr key={p.id} className="text-white">
                    <td className="border border-white/10 p-1 sticky left-0 bg-[#0b1220]">
                      <input value={p.nome} onChange={(e) => setPessoaCampo(p.id, 'nome', e.target.value)} disabled={fechada} className="w-full min-w-[140px] bg-[#101f3d] border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Nome" />
                    </td>
                    <td className="border border-white/10 p-1">
                      <input list="cargos-hh" value={p.cargo} onChange={(e) => setPessoaCampo(p.id, 'cargo', e.target.value)} disabled={fechada} className="w-full min-w-[150px] bg-[#101f3d] border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Cargo" />
                    </td>
                    {dias.map((d) => {
                      const h = p.horas[d] || { hn: 0, he05: 0, he10: 0, he02: 0 };
                      return (
                        <td key={d} className="border border-white/10 p-1">
                          <div className="flex justify-center gap-1">
                            <input type="number" min="0" step="0.5" value={h.hn || ''} onChange={(e) => setHora(p.id, d, 'hn', e.target.value)} disabled={fechada} className={cellInput} />
                            <input type="number" min="0" step="0.5" value={h.he05 || ''} onChange={(e) => setHora(p.id, d, 'he05', e.target.value)} disabled={fechada} className={`${cellInput} text-amber-200`} />
                            <input type="number" min="0" step="0.5" value={h.he10 || ''} onChange={(e) => setHora(p.id, d, 'he10', e.target.value)} disabled={fechada} className={`${cellInput} text-sky-200`} />
                            <input type="number" min="0" step="0.5" value={h.he02 || ''} onChange={(e) => setHora(p.id, d, 'he02', e.target.value)} disabled={fechada} className={`${cellInput} text-violet-200`} />
                          </div>
                        </td>
                      );
                    })}
                    <td className="border border-white/10 px-2 py-1 text-center font-black text-emerald-300">{t.hn}</td>
                    <td className="border border-white/10 px-2 py-1 text-center font-black text-amber-300">{t.he05}</td>
                    <td className="border border-white/10 px-2 py-1 text-center font-black text-sky-300">{t.he10}</td>
                    <td className="border border-white/10 px-2 py-1 text-center font-black text-violet-300">{t.he02}</td>
                    <td className="border border-white/10 px-1 py-1 text-center">
                      {!fechada && <button onClick={() => removePessoa(p.id)} className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300"><Trash2 size={12} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="cargos-hh">{CARGOS_HH.map((c) => <option key={c} value={c} />)}</datalist>
        </ScrollXTop>
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
                <th className="border border-white/10 px-3 py-2 text-right">HE 0,2 (noturno)</th>
              </tr>
            </thead>
            <tbody>
              {resumo.length === 0 ? (
                <tr><td colSpan={5} className="border border-white/10 px-3 py-3 text-white/40 text-center">Sem horas lançadas.</td></tr>
              ) : resumo.map((r) => (
                <tr key={r.cargo} className="text-white">
                  <td className="border border-white/10 px-3 py-2">{r.cargo}</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-emerald-300 font-bold">{r.hn}</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-amber-300 font-bold">{r.he05}</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-sky-300 font-bold">{r.he10}</td>
                  <td className="border border-white/10 px-3 py-2 text-right text-violet-300 font-bold">{r.he02}</td>
                </tr>
              ))}
              {resumo.length > 0 && (
                <tr className="bg-white/5 text-white font-black">
                  <td className="border border-white/10 px-3 py-2 uppercase">Total</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{round2(totResumo.hn)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{round2(totResumo.he05)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{round2(totResumo.he10)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{round2(totResumo.he02)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Valor por cargo → custo */}
      <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <h3 className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Valor por cargo → custo de H.H</h3>
        <p className="text-white/30 text-[10px] mb-3">Informe o valor da hora (R$) de cada cargo. HN = qtd×valor · HE 50% = qtd×valor×1,5 · HE 100% = qtd×valor×2 · HE 0,2 (adicional noturno) = qtd×valor×1,2.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70 uppercase">
                <th className="border border-white/10 px-3 py-2 text-left">Cargo</th>
                <th className="border border-white/10 px-3 py-2 text-center">Valor/hora (R$)</th>
                <th className="border border-white/10 px-3 py-2 text-right">Custo HN</th>
                <th className="border border-white/10 px-3 py-2 text-right">Custo HE 50%</th>
                <th className="border border-white/10 px-3 py-2 text-right">Custo HE 100%</th>
                <th className="border border-white/10 px-3 py-2 text-right">Custo HE 0,2 (noturno)</th>
                <th className="border border-white/10 px-3 py-2 text-right">Total cargo</th>
              </tr>
            </thead>
            <tbody>
              {custos.length === 0 ? (
                <tr><td colSpan={7} className="border border-white/10 px-3 py-3 text-white/40 text-center">Sem horas lançadas.</td></tr>
              ) : custos.map((c) => (
                <tr key={c.cargo} className="text-white">
                  <td className="border border-white/10 px-3 py-2">{c.cargo}</td>
                  <td className="border border-white/10 px-3 py-2 text-center">
                    <MoneyInput bare className={rateInput} value={taxaDoCargo(rates, c.cargo) ?? ''} onChange={(v) => setRates((r) => ({ ...r, [c.cargo]: v }))} disabled={fechada} />
                  </td>
                  <td className="border border-white/10 px-3 py-2 text-right">{money(c.custoHN)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{money(c.custoHE05)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{money(c.custoHE10)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right">{money(c.custoHE02)}</td>
                  <td className="border border-white/10 px-3 py-2 text-right font-black text-emerald-300">{money(c.total)}</td>
                </tr>
              ))}
              {custos.length > 0 && (
                <tr className="bg-white/5 text-white font-black">
                  <td colSpan={6} className="border border-white/10 px-3 py-2 uppercase text-right">Total de mão de obra (H.H)</td>
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
