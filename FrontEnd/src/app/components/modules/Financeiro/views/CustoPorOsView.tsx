import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { FinCard, Toolbar, Kpi, DataTable, Th, Td, EmptyRow } from '../finUi';
import { money, br, num } from '../finData';
import { useErp } from '../../../../context/ErpContext';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

interface LinhaCusto {
  id?: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  removivel?: boolean;
}

// Aba "Custo por OS": seleciona uma OS e agrega TODOS os custos dela (serviço/MDO,
// materiais, terceirizados, alocação, contas a pagar vinculadas) + permite adicionar
// custos de H.H quando a OS ainda está aberta. OS fechada = somente leitura.
export function CustoPorOsView() {
  const { os, obras, financeiro, compras, saveEntity } = useErp() as any;

  const [osNumero, setOsNumero] = useState<string>('');
  const [de, setDe] = useState<string>('');
  const [ate, setAte] = useState<string>('');
  const [hh, setHh] = useState({ funcao: '', quantidade: '', dias: '', custoUnitDia: '' });
  const [salvando, setSalvando] = useState(false);

  // Lista de OS com embarcação + status de fechamento.
  const osList = useMemo(() => {
    const obrasArr = Array.isArray(obras) ? obras : [];
    return (Array.isArray(os) ? os : []).map((o: any) => {
      const obra = obrasArr.find(
        (b: any) => String(b?.id) === String(o?.obraId) ||
          (o?.negocioBackendId != null && String(b?.negocioBackendId) === String(o?.negocioBackendId)),
      );
      const embarcacao = (Array.isArray(obra?.servicos) ? obra.servicos : [])
        .map((s: any) => s?.embarcacao || s?.embarcacaoNome)
        .find(Boolean) || o?.equipamento || '—';
      return {
        numero: String(o?.ordemServicoNumero || o?.numero_os || o?.id || ''),
        fechada: Boolean(o?.fechada),
        embarcacao,
        dataEmissao: String(o?.dataEmissao || o?.data_emissao || '').slice(0, 10),
        obra,
      };
    }).filter((o: any) => o.numero);
  }, [os, obras]);

  const selected = useMemo(() => osList.find((o: any) => o.numero === osNumero) || null, [osList, osNumero]);

  // Custos vindos do orçamento do negócio (valores agregados por categoria).
  const custosOrcamento: LinhaCusto[] = useMemo(() => {
    if (!selected?.obra) return [];
    const orcs = Array.isArray(selected.obra.orcamentos) ? selected.obra.orcamentos : [];
    const ultimo = orcs.length ? orcs[orcs.length - 1] : null;
    const v = ultimo?.valores || {};
    const data = selected.dataEmissao;
    const linhas: LinhaCusto[] = [];
    const push = (tipo: string, descricao: string, valor: number) => {
      if (num(valor) > 0) linhas.push({ tipo, descricao, valor: num(valor), data });
    };
    push('Mão de obra (serviço)', 'Mão de obra do orçamento', v.totalMaoDeObra);
    push('Materiais', 'Consumíveis + materiais do orçamento', v.totalMateriais);
    push('Terceirizados', 'Serviços terceirizados do orçamento', v.totalTerceirizados);
    push('Alocação', 'Itens de locação (c/ imposto)', v.subtotalLocacao);
    return linhas;
  }, [selected]);

  // Contas a pagar vinculadas à OS.
  const custosContas: LinhaCusto[] = useMemo(() => {
    return (Array.isArray(financeiro) ? financeiro : [])
      .filter((r: any) => r?.tipo === 'contaPagar' && (String(r?.vinculoValor) === osNumero || String(r?.os) === osNumero))
      .map((r: any) => ({
        tipo: 'Conta a pagar',
        descricao: r?.descricao || r?.fornecedor || 'Conta a pagar',
        valor: num(r?.valor),
        data: String(r?.vencimento || r?.createdAt || '').slice(0, 10),
      }));
  }, [financeiro, osNumero]);

  // Compras APROVADAS (stage COMPRADOS) vinculadas à obra desta OS (centro de custo = nome da obra).
  const custosCompras: LinhaCusto[] = useMemo(() => {
    const nomeObra = String(selected?.obra?.nome || '').trim();
    if (!nomeObra) return [];
    return (Array.isArray(compras) ? compras : [])
      .filter((c: any) => c?.stage === 'COMPRADOS' && String(c?.centroCusto || '').trim() === nomeObra)
      .map((c: any) => {
        const details = Array.isArray(c?.budgetDetails) ? c.budgetDetails : [];
        const soma = details.reduce((s: number, d: any) => s + num(d?.valorSelecionado), 0);
        const valor = soma > 0 ? soma : num(c?.budgetValue);
        const qtdItens = Array.isArray(c?.itens) ? c.itens.length : 0;
        return {
          tipo: 'Compra',
          descricao: `Compra (${qtdItens} item(ns))${c?.solicitante ? ` — ${c.solicitante}` : ''}`,
          valor: num(valor),
          data: String(c?.updatedAt || c?.createdAt || '').slice(0, 10),
        } as LinhaCusto;
      })
      .filter((l: LinhaCusto) => l.valor > 0);
  }, [compras, selected]);

  // Custos de H.H adicionados manualmente nesta tela.
  const custosHH: LinhaCusto[] = useMemo(() => {
    return (Array.isArray(financeiro) ? financeiro : [])
      .filter((r: any) => r?.tipo === 'custoOsHH' && String(r?.os) === osNumero)
      .map((r: any) => ({
        id: r?.id,
        tipo: 'H.H (mão de obra)',
        descricao: r?.descricao || `H.H: ${r?.funcao || ''}`,
        valor: num(r?.valor),
        data: String(r?.data || r?.createdAt || '').slice(0, 10),
        removivel: !selected?.fechada,
      }));
  }, [financeiro, osNumero, selected]);

  const dentroPeriodo = (d: string) => {
    if (!de && !ate) return true;
    const dd = String(d || '').slice(0, 10);
    if (!dd) return true; // sem data conhecida → não filtra fora
    if (de && dd < de) return false;
    if (ate && dd > ate) return false;
    return true;
  };

  const linhas = useMemo(
    () => [...custosOrcamento, ...custosContas, ...custosCompras, ...custosHH].filter((l) => dentroPeriodo(l.data)),
    [custosOrcamento, custosContas, custosCompras, custosHH, de, ate],
  );
  const totalCusto = round2(linhas.reduce((s, l) => s + l.valor, 0));
  const totalHH = round2(linhas.filter((l) => l.tipo === 'H.H (mão de obra)').reduce((s, l) => s + l.valor, 0));

  const hhValorPreview = round2(num(hh.quantidade) * num(hh.dias) * num(hh.custoUnitDia));

  const adicionarHH = async () => {
    if (!selected || selected.fechada) return;
    if (!hh.funcao.trim() || hhValorPreview <= 0) {
      window.alert('Informe a função e os valores (Qtd × Dias × Custo) do H.H.');
      return;
    }
    setSalvando(true);
    try {
      const rec = {
        id: `CHH-${Date.now()}`,
        tipo: 'custoOsHH' as const,
        os: osNumero,
        funcao: hh.funcao.trim(),
        descricao: `H.H: ${hh.funcao.trim()}`,
        quantidade: num(hh.quantidade),
        dias: num(hh.dias),
        custoUnitDia: num(hh.custoUnitDia),
        valor: hhValorPreview,
        data: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };
      await saveEntity('financeiro', [rec, ...(Array.isArray(financeiro) ? financeiro : [])]);
      setHh({ funcao: '', quantidade: '', dias: '', custoUnitDia: '' });
    } finally {
      setSalvando(false);
    }
  };

  const removerHH = async (id?: string) => {
    if (!id || selected?.fechada) return;
    await saveEntity('financeiro', (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => r?.id !== id));
  };

  const inputCls = 'w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30';

  return (
    <FinCard>
      <Toolbar title="Custo por OS" hint="Todos os custos da OS: serviço (mão de obra/materiais/terceirizados), alocação, compras aprovadas, contas a pagar vinculadas e H.H. OS fechada fica somente leitura." />

      {/* Filtros: OS + período */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Ordem de Serviço</label>
          <select value={osNumero} onChange={(e) => setOsNumero(e.target.value)} className={inputCls}>
            <option value="">Selecione a OS…</option>
            {osList.map((o: any) => (
              <option key={o.numero} value={o.numero}>
                {o.numero} · {o.embarcacao}{o.fechada ? ' (fechada)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Período — de</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Período — até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} />
        </div>
      </div>

      {!selected ? (
        <p className="text-white/40 text-sm bg-[#0b1220] rounded-xl border border-white/5 p-6">Selecione uma OS para listar os custos.</p>
      ) : (
        <>
          {/* Cabeçalho da OS: id + embarcação + status */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Kpi label="OS" value={selected.numero} />
            <Kpi label="Embarcação" value={selected.embarcacao} />
            <Kpi label="Custo total (período)" value={money(totalCusto)} />
            <Kpi label="Status" value={selected.fechada ? 'Fechada' : 'Aberta'} />
          </div>

          {/* Adicionar H.H — só quando a OS está ABERTA */}
          {selected.fechada ? (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-xs">
              <Lock size={14} /> OS fechada — somente leitura. Não é possível adicionar novos custos.
            </div>
          ) : (
            <div className="mb-5 rounded-xl border border-white/10 bg-[#0b1220] p-4">
              <p className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-3">Adicionar H.H (mão de obra)</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6 items-end">
                <div className="md:col-span-2">
                  <label className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1 block">Função</label>
                  <input value={hh.funcao} onChange={(e) => setHh({ ...hh, funcao: e.target.value })} className={inputCls} placeholder="Ex.: Soldador" />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1 block">Qtd</label>
                  <input type="number" min="0" step="0.5" value={hh.quantidade} onChange={(e) => setHh({ ...hh, quantidade: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1 block">Dias</label>
                  <input type="number" min="0" step="0.5" value={hh.dias} onChange={(e) => setHh({ ...hh, dias: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1 block">Custo/dia</label>
                  <input type="number" min="0" step="0.01" value={hh.custoUnitDia} onChange={(e) => setHh({ ...hh, custoUnitDia: e.target.value })} className={inputCls} />
                </div>
                <button
                  onClick={adicionarHH}
                  disabled={salvando}
                  className="h-[42px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus size={14} /> {salvando ? '...' : `Add (${money(hhValorPreview)})`}
                </button>
              </div>
            </div>
          )}

          {/* Tabela de custos */}
          <DataTable
            minWidth={720}
            head={<><Th>Data</Th><Th>Tipo</Th><Th>Descrição</Th><Th>Valor</Th><Th></Th></>}
          >
            {linhas.length === 0 ? (
              <EmptyRow cols={5} text="Nenhum custo para esta OS no período." />
            ) : linhas.map((l, i) => (
              <tr key={l.id || `${l.tipo}-${i}`} className="transition-colors hover:bg-white/5">
                <Td>{l.data ? br(l.data) : '—'}</Td>
                <Td className="text-white/70">{l.tipo}</Td>
                <Td className="text-white">{l.descricao}</Td>
                <Td className="font-bold text-white">{money(l.valor)}</Td>
                <Td>
                  {l.removivel && l.id ? (
                    <button onClick={() => removerHH(l.id)} className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300" title="Remover H.H"><Trash2 size={13} /></button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </DataTable>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-6 border-t border-white/10 pt-4">
            <p className="text-white/50 text-xs uppercase font-black tracking-widest">H.H adicionado: <span className="text-emerald-300">{money(totalHH)}</span></p>
            <p className="text-white/50 text-xs uppercase font-black tracking-widest">Custo total da OS: <span className="text-emerald-300 text-lg">{money(totalCusto)}</span></p>
          </div>
        </>
      )}
    </FinCard>
  );
}
