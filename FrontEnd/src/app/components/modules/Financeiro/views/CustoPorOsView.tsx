import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, ClipboardList, CalendarClock, Lock, Plus, Save, Download } from 'lucide-react';
import { FinCard, Toolbar, Kpi, DataTable, Th, Td, EmptyRow, boldOS, Input, Select, Btn } from '../finUi';
import { money, br, num, download } from '../finData';
import { useErp } from '../../../../context/ErpContext';
import { findObraDaOs, formatOsLabel, getEmbarcacaoDaOs, getOsNumero } from '../../../../../services/ordensServico';
import { AlocarHhView } from './AlocarHhView';
import { toast } from 'sonner';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Origem de cada linha (só rótulo/referência — TODAS as linhas são editáveis):
//  - compra:  veio de uma compra APROVADA (kanban).
//  - hh:      mão de obra vinda do timesheet (aba "Alocar HH").
//  - medicao: item discretizado da última medição APROVADA (já com impostos).
//  - manual:  linha adicionada à mão nesta planilha.
type Origem = 'compra' | 'hh' | 'medicao' | 'manual';

interface LinhaCusto {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  origem: Origem;
  quantidade?: number;   // discretização: qtd medida
  unidade?: string;      // discretização: unidade (un, kg, serv…)
  valorUnitario?: number; // discretização: valor unitário JÁ com impostos
  removido?: boolean; // linha derivada removida pelo usuário (não volta no merge).
}

const CATEGORIAS = ['Materiais', 'Serviços Terceirizados', 'Alocação/Locação', 'Mão de obra', 'Outros'];
const ORDEM_CATEGORIAS = ['Materiais', 'Serviços Terceirizados', 'Alocação/Locação', 'Mão de obra', 'Outros'];
const categoriaCompra = (natureza?: string) => (natureza === 'ITEM' ? 'Materiais' : 'Serviços Terceirizados');

// Chave de comparação de descrições (casa item da medição ↔ tabela do orçamento).
const chaveDesc = (s: any) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Ids das linhas-resumo da versão antiga (3 lump sums do orçamento). Precisam ser descartadas
// ao carregar uma planilha salva, senão somariam junto com os itens discretizados de agora.
const LEGACY_MED_IDS = new Set(['med-Materiais', 'med-Serviços Terceirizados', 'med-Alocação/Locação']);

const normalizeLinha = (l: any): LinhaCusto => ({
  id: String(l?.id || `lin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
  categoria: String(l?.categoria || 'Outros'),
  descricao: String(l?.descricao || ''),
  valor: num(l?.valor),
  data: String(l?.data || '').slice(0, 10),
  origem: (['compra', 'hh', 'medicao', 'manual'].includes(l?.origem) ? l.origem : 'manual') as Origem,
  ...(l?.quantidade != null ? { quantidade: num(l.quantidade) } : {}),
  ...(l?.unidade ? { unidade: String(l.unidade) } : {}),
  ...(l?.valorUnitario != null ? { valorUnitario: num(l.valorUnitario) } : {}),
  removido: Boolean(l?.removido),
});

// Aba "Custo por OS": planilha 100% editável e persistida (registro `custoOsSheet` por OS).
// As linhas de COMPRA (aprovadas no kanban), de H.H (folha de ponto) e de MEDIÇÃO (orçamento) são
// puxadas automaticamente como linhas editáveis; o usuário pode alterar valor/descrição/categoria,
// remover e adicionar linhas manuais. Novas compras aprovadas entram no próximo carregamento da OS.
export function CustoPorOsView() {
  const { os, obras, financeiro, compras, comprasHistorico, medicoes, saveEntity } = useErp() as any;

  const [aba, setAba] = useState<'custos' | 'alocarHh'>('custos');
  const [osNumero, setOsNumero] = useState<string>('');
  const [de, setDe] = useState<string>('');
  const [ate, setAte] = useState<string>('');

  // Lista de OS com embarcação + status de fechamento.
  const osList = useMemo(() => {
    const obrasArr = Array.isArray(obras) ? obras : [];
    return (Array.isArray(os) ? os : []).map((o: any) => {
      const obra = findObraDaOs(o, obrasArr);
      const embarcacao = getEmbarcacaoDaOs(o, obrasArr) || '—';
      return {
        numero: getOsNumero(o),
        label: formatOsLabel(o, obrasArr),
        backendId: o?.backendId,
        fechada: Boolean(o?.fechada),
        embarcacao,
        cliente: o?.cliente || '',
        dataEmissao: String(o?.dataEmissao || o?.data_emissao || '').slice(0, 10),
        obra,
      };
    }).filter((o: any) => o.numero);
  }, [os, obras]);

  const selected = useMemo(() => osList.find((o: any) => o.numero === osNumero) || null, [osList, osNumero]);
  const fechada = Boolean(selected?.fechada);

  // ---- DERIVADO: compras APROVADAS vinculadas a esta OS -----------------------------------
  // O vínculo compra→OS é o Centro de Custo da requisição. Hoje a solicitação de compra grava
  // o NÚMERO DA OS; requisições antigas gravavam o NOME DA OBRA — as duas formas são aceitas
  // aqui para o histórico não sumir. Conta como custo assim que a compra é APROVADA no kanban
  // (estágio APROVACAO) ou já foi comprada (COMPRADOS / histórico).
  const linhasCompra = useMemo<LinhaCusto[]>(() => {
    const aceitos = new Set(
      [String(selected?.numero || '').trim(), String(selected?.obra?.nome || '').trim()].filter(Boolean),
    );
    if (aceitos.size === 0) return [];
    const daOs = (r: any) => aceitos.has(String(r?.centroCusto || '').trim());
    const out: LinhaCusto[] = [];

    // (a) Itens ainda dentro de requisições aprovadas/em compra (valor = cotação selecionada).
    (Array.isArray(compras) ? compras : [])
      .filter((r: any) => ['APROVACAO', 'COMPRADOS'].includes(r?.stage) && daOs(r))
      .forEach((r: any) => {
        const details = Array.isArray(r?.budgetDetails) ? r.budgetDetails : [];
        (Array.isArray(r?.itens) ? r.itens : []).forEach((it: any) => {
          const d = details.find((x: any) => x.itemId === it.id) || null;
          const valor = num(d?.valorSelecionado);
          if (valor <= 0) return;
          const natureza = d?.naturezaFornecimento || it?.naturezaFornecimento || 'SERVICO';
          out.push({
            id: `cmp-${r.id}-${it.id}`,
            categoria: categoriaCompra(natureza),
            descricao: `Compra: ${it.descricao || it.nome || 'item'}`,
            valor,
            data: String(r?.updatedAt || r?.createdAt || '').slice(0, 10),
            origem: 'compra',
          });
        });
      });

    // (b) Itens já comprados (saíram das requisições) — vêm do histórico de compras.
    (Array.isArray(comprasHistorico) ? comprasHistorico : [])
      .filter((h: any) => daOs(h) && num(h?.valor) > 0)
      .forEach((h: any) => {
        const natureza = h?.naturezaFornecimento || 'SERVICO';
        out.push({
          id: `cmph-${h.id}`,
          categoria: categoriaCompra(natureza),
          descricao: `Compra: ${h.itemDescricao || h.itemNome || 'item'}`,
          valor: num(h.valor),
          data: String(h?.compradoEm || '').slice(0, 10),
          origem: 'compra',
        });
      });

    return out;
  }, [selected, compras, comprasHistorico]);

  // ---- DERIVADO: mão de obra (H.H) da aba "Alocar HH" (folha de ponto) ---------------------
  const linhaHH = useMemo<LinhaCusto[]>(() => {
    const reg = (Array.isArray(financeiro) ? financeiro : []).find((r: any) => r?.tipo === 'hhAlocacao' && String(r?.os) === osNumero);
    if (!reg || num(reg.valor) <= 0) return [];
    const nPessoas = Array.isArray(reg.pessoas) ? reg.pessoas.length : 0;
    return [{
      id: `hh-${osNumero}`,
      categoria: 'Mão de obra',
      descricao: `Mão de obra (H.H) — ${nPessoas} pessoa(s) · ver aba "Alocar HH"`,
      valor: num(reg.valor),
      data: String(reg.data || reg.updatedAt || '').slice(0, 10),
      origem: 'hh',
    }];
  }, [financeiro, osNumero]);

  // ---- Último orçamento da obra (fonte do preço da proposta e da classificação dos itens) ---
  const ultimoOrcamento = useMemo(() => {
    const orcs = Array.isArray(selected?.obra?.orcamentos) ? selected.obra.orcamentos : [];
    return orcs.length ? orcs[orcs.length - 1] : null;
  }, [selected]);

  // Preço TOTAL da proposta = serviço (com margem/O.H/imposto) + locação (com imposto).
  const valorProposta = useMemo(() => {
    const v = ultimoOrcamento?.valores || {};
    const total = num(v.totalGeral) || (num(v.precoFinal) + num(v.subtotalLocacao));
    return round2(total);
  }, [ultimoOrcamento]);

  // Dicionários de classificação: a medição é gerada da tabela macro do orçamento, que copia
  // as descrições de maoDeObra[] / materiais[] / terceirizados[]. Casando a descrição de volta
  // sabemos a categoria de cada item medido — e quais são MÃO DE OBRA (que NÃO entram aqui).
  const dicionario = useMemo(() => {
    const d = ultimoOrcamento?.data || {};
    const setDe = (arr: any, campo: string) =>
      new Set((Array.isArray(arr) ? arr : []).map((i: any) => chaveDesc(i?.[campo])).filter(Boolean));
    return {
      maoDeObra: setDe(d.maoDeObra, 'funcao'),
      materiais: setDe(d.materiais, 'descricao'),
      terceirizados: setDe(d.terceirizados, 'descricao'),
    };
  }, [ultimoOrcamento]);

  // Categoria de um item medido — `null` = mão de obra, que só pode vir do timesheet.
  const categoriaDoItemMedido = (it: any): string | null => {
    if (String(it?.categoria || 'servico') === 'locacao') return 'Alocação/Locação';
    // A tabela macro marca as linhas de mão de obra com unidade "MDO" — sinal mais forte que
    // a descrição, pois sobrevive à edição do texto na medição.
    if (String(it?.unidade || '').trim().toUpperCase() === 'MDO') return null;
    const k = chaveDesc(it?.descricao);
    if (dicionario.maoDeObra.has(k)) return null;
    if (dicionario.materiais.has(k)) return 'Materiais';
    if (dicionario.terceirizados.has(k)) return 'Serviços Terceirizados';
    return 'Outros'; // linha criada à mão na medição: entra (só mão de obra fica de fora).
  };

  // ---- DERIVADO: última medição APROVADA da OS -------------------------------------------
  const medicaoAtual = useMemo(() => {
    const backendId = selected?.backendId;
    if (backendId == null) return null;
    const aprovadas = (Array.isArray(medicoes) ? medicoes : []).filter(
      (m: any) => String(m?.ordemServicoBackendId) === String(backendId) && String(m?.status).toLowerCase() === 'aprovada',
    );
    if (!aprovadas.length) return null;
    const ordem = (m: any) => `${String(m?.dataEmissao || m?.createdAt || '').slice(0, 10)}|${String(m?.id || '').padStart(12, '0')}`;
    return aprovadas.reduce((a: any, b: any) => (ordem(b) >= ordem(a) ? b : a));
  }, [medicoes, selected]);

  // Itens da medição DISCRETIZADOS: 1 linha por item, com qtd/unidade/valor unitário. Os valores
  // da medição já vêm do preço da proposta, ou seja, JÁ COM impostos (margem + O.H + imposto no
  // serviço; imposto de locação nos alocados). Mão de obra é filtrada — vem só do timesheet.
  const seedMedicao = useMemo<LinhaCusto[]>(() => {
    if (!medicaoAtual) return [];
    const data = String(medicaoAtual.dataEmissao || '').slice(0, 10) || selected?.dataEmissao || '';
    const out: LinhaCusto[] = [];
    (Array.isArray(medicaoAtual.itens) ? medicaoAtual.itens : []).forEach((it: any, idx: number) => {
      const categoria = categoriaDoItemMedido(it);
      if (!categoria) return; // mão de obra → só do timesheet
      const qtd = num(it?.quantidadeProduzida);
      const dias = String(it?.categoria || 'servico') === 'locacao' ? 1 : (num(it?.dias) || 1);
      const vu = num(it?.valorUnitario);
      const valor = round2(num(it?.total) || qtd * dias * vu);
      if (valor <= 0) return;
      out.push({
        id: `med-${medicaoAtual.id}-${it?.id || idx}`,
        categoria,
        descricao: String(it?.descricao || 'Item medido'),
        valor,
        data,
        origem: 'medicao',
        // Qtd efetiva embute os dias no serviço, para qtd × valor unitário fechar com o total.
        quantidade: round2(qtd * dias) || undefined,
        unidade: String(it?.unidade || '') || undefined,
        valorUnitario: vu || undefined,
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicaoAtual, dicionario, selected]);

  // Todas as linhas derivadas do sistema (usadas para semear/mesclar na planilha).
  const derivadas = useMemo<LinhaCusto[]>(() => [...linhasCompra, ...linhaHH, ...seedMedicao], [linhasCompra, linhaHH, seedMedicao]);

  // ---- Planilha persistida (todas as linhas ficam aqui e são editáveis) --------------------
  const sheetRecord = useMemo(
    () => (Array.isArray(financeiro) ? financeiro : []).find((r: any) => r?.tipo === 'custoOsSheet' && String(r?.os) === osNumero) || null,
    [financeiro, osNumero],
  );

  const [linhas, setLinhas] = useState<LinhaCusto[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  // Carrega a planilha ao TROCAR de OS: parte das linhas salvas e MESCLA as linhas derivadas
  // que ainda não estão na planilha (por id) — novas compras aprovadas entram aqui. Linhas
  // derivadas removidas ficam salvas com `removido:true`, então não voltam. Não recarrega a cada
  // mudança de `financeiro` para não sobrescrever edições em andamento.
  // A chave inclui a medição vigente: se as medições chegarem depois (carga assíncrona) ou uma
  // nova for aprovada com a tela aberta, a planilha é remontada com os itens da medição certa.
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    const chave = `${osNumero}::${medicaoAtual?.id ?? ''}`;
    if (loadedRef.current === chave) return;
    loadedRef.current = chave;
    const brutas: LinhaCusto[] = (sheetRecord && Array.isArray(sheetRecord.linhas)) ? sheetRecord.linhas.map(normalizeLinha) : [];
    // Só valem as linhas de medição da medição ATUAL: as dos resumos antigos (3 lump sums) e as
    // de medições anteriores são descartadas, senão somariam junto com os itens discretizados.
    const prefixoAtual = medicaoAtual ? `med-${medicaoAtual.id}-` : null;
    const salvas = brutas.filter((l) => {
      if (l.origem !== 'medicao') return true;
      if (LEGACY_MED_IDS.has(l.id)) return false;
      return prefixoAtual != null && l.id.startsWith(prefixoAtual);
    });
    const idsSalvos = new Set(salvas.map((l) => l.id));
    const novas = derivadas.filter((d) => !idsSalvos.has(d.id));
    setLinhas([...salvas, ...novas]);
    setSujo(false);
  }, [osNumero, sheetRecord, derivadas, medicaoAtual]);

  // Edita um campo da linha. Mexer em quantidade/valor unitário recalcula o total (qtd × unit.);
  // editar o total direto é sempre permitido e simplesmente sobrescreve o valor.
  const setLinha = (id: string, campo: 'categoria' | 'descricao' | 'valor' | 'quantidade' | 'unidade' | 'valorUnitario', valor: string) => {
    setLinhas((ls) => ls.map((l) => {
      if (l.id !== id) return l;
      if (campo === 'categoria' || campo === 'descricao' || campo === 'unidade') return { ...l, [campo]: valor };
      if (campo === 'valor') return { ...l, valor: num(valor) };
      const next = { ...l, [campo]: num(valor) };
      const q = num(next.quantidade);
      const vu = num(next.valorUnitario);
      return (q > 0 && vu > 0) ? { ...next, valor: round2(q * vu) } : next;
    }));
    setSujo(true);
  };
  const addLinha = () => {
    setLinhas((ls) => [...ls, { id: `man-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, categoria: 'Outros', descricao: '', valor: 0, data: selected?.dataEmissao || '', origem: 'manual' }]);
    setSujo(true);
  };
  // Manual → apaga de vez. Derivada (compra/hh/medição) → marca removida para não voltar no merge.
  const removerLinha = (id: string) => {
    setLinhas((ls) => ls.flatMap((l) => {
      if (l.id !== id) return [l];
      return l.origem === 'manual' ? [] : [{ ...l, removido: true }];
    }));
    setSujo(true);
  };

  const salvarPlanilha = async () => {
    if (fechada || !osNumero) return;
    setSalvando(true);
    try {
      const total = round2(linhas.filter((l) => !l.removido).reduce((s, l) => s + num(l.valor), 0));
      const rec = {
        id: sheetRecord?.id || `COS-${Date.now()}`,
        tipo: 'custoOsSheet' as const,
        os: osNumero,
        valor: total,
        linhas: linhas.map((l) => ({
          id: l.id, categoria: l.categoria, descricao: l.descricao, valor: num(l.valor), data: l.data, origem: l.origem,
          ...(l.quantidade != null ? { quantidade: num(l.quantidade) } : {}),
          ...(l.unidade ? { unidade: l.unidade } : {}),
          ...(l.valorUnitario != null ? { valorUnitario: num(l.valorUnitario) } : {}),
          ...(l.removido ? { removido: true } : {}),
        })),
        createdAt: sheetRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const resto = (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => !(r?.tipo === 'custoOsSheet' && String(r?.os) === osNumero));
      await saveEntity('financeiro', [rec, ...resto]);
      setSujo(false);
      toast.success('Planilha de custo da OS salva.');
    } catch (e) {
      console.error('Erro ao salvar custo por OS:', e);
      toast.error('Erro ao salvar a planilha de custo.');
    } finally {
      setSalvando(false);
    }
  };

  // Export CSV da planilha inteira (todas as linhas ativas), agrupada por categoria com
  // subtotais e total geral. Inclui materiais, terceirizados, H.H, medição e manuais.
  const exportarCsv = () => {
    const ativas = linhas.filter((l) => !l.removido);
    const brNum = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',');
    const origemLabel: Record<Origem, string> = { compra: 'Compra', hh: 'Timesheet (H.H)', medicao: 'Medição', manual: 'Manual' };
    const categorias = [...ORDEM_CATEGORIAS, ...Array.from(new Set(ativas.map((l) => l.categoria))).filter((c) => !ORDEM_CATEGORIAS.includes(c))];

    const out: string[][] = [];
    out.push(['Custo por OS', selected?.numero || '']);
    out.push(['Embarcação', selected?.embarcacao || '']);
    out.push(['Cliente', selected?.cliente || '']);
    out.push(['Gerado em', new Date().toLocaleString('pt-BR')]);
    out.push([]);
    out.push(['Data', 'Categoria', 'Descrição', 'Qtd', 'Unid.', 'Valor unit. (R$)', 'Total (R$)', 'Origem']);

    let totalGeral = 0;
    categorias.forEach((cat) => {
      const doGrupo = ativas.filter((l) => l.categoria === cat);
      if (doGrupo.length === 0) return;
      let subtotal = 0;
      doGrupo.forEach((l) => {
        subtotal += num(l.valor);
        out.push([
          l.data ? br(l.data) : '', l.categoria, l.descricao,
          l.quantidade != null ? brNum(num(l.quantidade)) : '',
          l.unidade || '',
          l.valorUnitario != null ? brNum(num(l.valorUnitario)) : '',
          brNum(num(l.valor)), origemLabel[l.origem],
        ]);
      });
      totalGeral += subtotal;
      out.push(['', `Subtotal ${cat}`, '', '', '', '', brNum(subtotal), '']);
      out.push([]);
    });
    out.push(['', 'TOTAL GERAL (REAL)', '', '', '', '', brNum(totalGeral), '']);
    out.push([]);
    out.push(['', 'Valor da proposta (preço)', '', '', '', '', brNum(valorProposta), '']);
    out.push(['', valorProposta - totalGeral >= 0 ? 'Saldo da proposta' : 'Estouro da proposta', '', '', '', '', brNum(Math.abs(round2(valorProposta - totalGeral))), '']);

    const csv = out.map((linha) => linha.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    download(csv, `custo_os_${String(selected?.numero || 'OS').replace(/[\\/]/g, '-')}.csv`, 'text/csv;charset=utf-8');
  };

  const dentroPeriodo = (d: string) => {
    if (!de && !ate) return true;
    const dd = String(d || '').slice(0, 10);
    if (!dd) return true; // sem data conhecida → não filtra fora
    if (de && dd < de) return false;
    if (ate && dd > ate) return false;
    return true;
  };

  const linhasVisiveis = useMemo(() => linhas.filter((l) => !l.removido && dentroPeriodo(l.data)), [linhas, de, ate]);
  const somaDe = (pred: (l: LinhaCusto) => boolean) => round2(linhasVisiveis.filter(pred).reduce((s, l) => s + num(l.valor), 0));
  const totalCusto = round2(linhasVisiveis.reduce((s, l) => s + num(l.valor), 0));
  const totalHH = somaDe((l) => l.origem === 'hh');
  const totalCompra = somaDe((l) => l.origem === 'compra');
  const totalMedicao = somaDe((l) => l.origem === 'medicao');
  const totalManual = somaDe((l) => l.origem === 'manual');
  // Real = tudo que está na planilha (medição + timesheet + compras + manuais).
  const saldoProposta = round2(valorProposta - totalCusto);

  // Linhas agrupadas por categoria (com subtotal) — é o que dá a leitura discretizada.
  const grupos = useMemo(() => {
    const extras = Array.from(new Set(linhasVisiveis.map((l) => l.categoria))).filter((c) => !ORDEM_CATEGORIAS.includes(c));
    return [...ORDEM_CATEGORIAS, ...extras]
      .map((categoria) => {
        const itens = linhasVisiveis.filter((l) => l.categoria === categoria);
        return { categoria, itens, subtotal: round2(itens.reduce((s, l) => s + num(l.valor), 0)) };
      })
      .filter((g) => g.itens.length > 0);
  }, [linhasVisiveis]);

  // Custos de SERVIÇO (tudo menos a mão de obra H.H) para o documento "Custo completo" da aba Alocar HH.
  const outrosCustos = useMemo(
    () => linhas.filter((l) => !l.removido && l.origem !== 'hh').map((l) => ({ tipo: l.categoria, descricao: l.descricao, valor: num(l.valor) })),
    [linhas],
  );

  // ---- Proposta × Real por categoria --------------------------------------------------------
  // A proposta por categoria vai a PREÇO (mesmo nível do Real, que já vem da medição com
  // impostos): serviço × (1 + margem% + O.H%) × (1 + imposto%); locação já é o subtotal com
  // imposto. Somadas, as 4 categorias fecham exatamente com `valorProposta`.
  const propostaPorCategoria = useMemo<Record<string, number>>(() => {
    const v = ultimoOrcamento?.valores || {};
    const fator = (1 + (num(v.margem) + num(v.oh)) / 100) * (1 + num(v.impostos) / 100);
    return {
      'Mão de obra': round2(num(v.totalMaoDeObra) * fator),
      'Materiais': round2(num(v.totalMateriais) * fator),
      'Serviços Terceirizados': round2(num(v.totalTerceirizados) * fator),
      'Alocação/Locação': round2(num(v.subtotalLocacao)),
    };
  }, [ultimoOrcamento]);

  // Real = planilha atual (timesheet + compras + medição já com as modificações + manuais).
  const realPorCategoria = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    linhas.filter((l) => !l.removido).forEach((l) => { map[l.categoria] = round2((map[l.categoria] || 0) + num(l.valor)); });
    return map;
  }, [linhas]);

  const comparativo = useMemo(() => {
    const extras = Object.keys(realPorCategoria).filter((c) => !ORDEM_CATEGORIAS.includes(c));
    const rows = [...ORDEM_CATEGORIAS, ...extras]
      .map((categoria) => {
        const orcado = round2(propostaPorCategoria[categoria] || 0);
        const real = round2(realPorCategoria[categoria] || 0);
        return { categoria, orcado, real, variacao: round2(real - orcado) };
      })
      .filter((r) => r.orcado !== 0 || r.real !== 0);
    const orcadoTotal = round2(rows.reduce((s, r) => s + r.orcado, 0));
    const realTotal = round2(rows.reduce((s, r) => s + r.real, 0));
    return { rows, orcadoTotal, realTotal, variacaoTotal: round2(realTotal - orcadoTotal) };
  }, [propostaPorCategoria, realPorCategoria]);

  const inputCls = 'w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30';
  const tabCls = (ativo: boolean) => `px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${ativo ? 'bg-emerald-500 text-[#0b1220]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`;

  const origemTag = (origem: Origem) => (
    origem === 'compra' ? <span className="text-[11px] font-bold text-violet-300">Compra</span>
      : origem === 'hh' ? <span className="text-[11px] font-bold text-sky-300">Timesheet</span>
      : origem === 'medicao' ? <span className="text-[11px] font-bold text-emerald-300/80">Medição</span>
      : <span className="text-[11px] font-bold text-white/50">Manual</span>
  );

  return (
    <FinCard>
      <Toolbar title={boldOS('Custo por OS')} hint={boldOS('Planilha 100% editável e discretizada: cada item da última medição aprovada (materiais, terceirizados e alocação, já com impostos) vira uma linha; a mão de obra vem só do timesheet e as compras aprovadas entram automaticamente. OS fechada fica somente leitura.')} />

      {/* OS (compartilhada pelas duas abas) */}
      <div className="mb-4">
        <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Ordem de Serviço</label>
        <select value={osNumero} onChange={(e) => setOsNumero(e.target.value)} className={inputCls}>
          <option value="">Selecione a OS…</option>
          {osList.map((o: any) => (
            <option key={o.numero} value={o.numero}>{o.label}{o.fechada ? ' (fechada)' : ''}</option>
          ))}
        </select>
      </div>

      {/* Abas */}
      <div className="mb-5 flex gap-2">
        <button onClick={() => setAba('custos')} className={tabCls(aba === 'custos')}><ClipboardList size={13} className="inline mr-1.5" /> Custos por OS</button>
        <button onClick={() => setAba('alocarHh')} className={tabCls(aba === 'alocarHh')}><CalendarClock size={13} className="inline mr-1.5" /> Alocar HH</button>
      </div>

      {aba === 'alocarHh' ? (
        <AlocarHhView osNumero={osNumero} selected={selected} outrosCustos={outrosCustos} />
      ) : !selected ? (
        <p className="text-white/40 text-sm bg-[#0b1220] rounded-xl border border-white/5 p-6">{boldOS('Selecione uma OS para listar os custos.')}</p>
      ) : (
        <>
          {/* Período */}
          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Período — de</label>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
            </div>
            <div>
              <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Período — até</label>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
            </div>
          </div>

          {/* Cabeçalho da OS */}
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Kpi label={boldOS('OS')} value={selected.numero} />
            <Kpi label="Embarcação" value={selected.embarcacao} />
            <Kpi label="Custo total (período)" value={money(totalCusto)} />
            <Kpi label="Status" value={fechada ? 'Fechada' : 'Aberta'} />
          </div>

          {/* Proposta (preço) × Real — o Real é o somatório desta planilha (medição + timesheet). */}
          <div className="mb-5 rounded-xl border border-white/10 bg-[#0b1220] p-4">
            <h3 className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-3">Proposta × Real</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1">Valor da proposta (preço)</p>
                <p className="text-white font-black text-2xl">{money(valorProposta)}</p>
                <p className="text-white/30 text-[10px] mt-0.5">Serviço + locação, com impostos</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1">Real (medição + timesheet)</p>
                <p className="text-emerald-300 font-black text-2xl">{money(totalCusto)}</p>
                <p className="text-white/30 text-[10px] mt-0.5">Somatório desta planilha</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1">{saldoProposta >= 0 ? 'Saldo da proposta' : 'Estouro da proposta'}</p>
                <p className={`font-black text-2xl ${saldoProposta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{saldoProposta < 0 ? '−' : ''}{money(Math.abs(saldoProposta))}</p>
                <p className="text-white/30 text-[10px] mt-0.5">
                  {valorProposta > 0 ? `${round2((totalCusto / valorProposta) * 100)}% da proposta consumido` : 'Sem orçamento com preço'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-[11px] font-bold uppercase tracking-widest">
              <span className="text-white/40">Medição: <span className="text-emerald-300/80">{money(totalMedicao)}</span></span>
              <span className="text-white/40">Timesheet: <span className="text-sky-300">{money(totalHH)}</span></span>
              <span className="text-white/40">Compras: <span className="text-violet-300">{money(totalCompra)}</span></span>
              <span className="text-white/40">Manuais: <span className="text-white/70">{money(totalManual)}</span></span>
            </div>
          </div>

          {!medicaoAtual && (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/50 text-xs">
              Nenhuma medição <strong className="text-white/70">aprovada</strong> para esta {boldOS('OS')} — os itens de materiais, terceirizados e alocação aparecem aqui assim que uma medição for aprovada.
            </div>
          )}

          {fechada && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-xs">
              <Lock size={14} /> OS fechada — a planilha de custo fica somente leitura.
            </div>
          )}

          {/* Tabela de custos discretizada (100% editável), agrupada por categoria */}
          <DataTable
            minWidth={1180}
            head={<><Th>Data</Th><Th>Categoria</Th><Th>Descrição</Th><Th className="text-right">Qtd</Th><Th>Unid.</Th><Th className="text-right">Valor unit.</Th><Th className="text-right">Total</Th><Th>Origem</Th><Th></Th></>}
          >
            {linhasVisiveis.length === 0 ? (
              <EmptyRow cols={9} text={boldOS('Nenhum custo para esta OS no período.')} />
            ) : grupos.map((g) => (
              <React.Fragment key={g.categoria}>
                <tr className="bg-white/5">
                  <td colSpan={6} className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-300">{g.categoria}</td>
                  <td className="px-4 py-2 text-right text-[11px] font-black text-emerald-300">{money(g.subtotal)}</td>
                  <td colSpan={2} className="px-4 py-2 text-[10px] uppercase tracking-widest text-white/30">{g.itens.length} item(ns)</td>
                </tr>
                {g.itens.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-white/5">
                    <Td>{l.data ? br(l.data) : '—'}</Td>
                    <Td>
                      <div className="w-44">
                        <Select value={l.categoria} onChange={(e) => setLinha(l.id, 'categoria', e.target.value)} disabled={fechada}>
                          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                        </Select>
                      </div>
                    </Td>
                    <Td>
                      <Input value={l.descricao} onChange={(e) => setLinha(l.id, 'descricao', e.target.value)} disabled={fechada} placeholder="Descrição" />
                    </Td>
                    <Td>
                      <div className="w-20">
                        <Input type="number" step="0.01" value={l.quantidade != null ? String(l.quantidade) : ''} onChange={(e) => setLinha(l.id, 'quantidade', e.target.value)} disabled={fechada} placeholder="—" />
                      </div>
                    </Td>
                    <Td>
                      <div className="w-20">
                        <Input value={l.unidade || ''} onChange={(e) => setLinha(l.id, 'unidade', e.target.value)} disabled={fechada} placeholder="—" />
                      </div>
                    </Td>
                    <Td>
                      <div className="w-28">
                        <Input type="number" step="0.01" value={l.valorUnitario != null ? String(l.valorUnitario) : ''} onChange={(e) => setLinha(l.id, 'valorUnitario', e.target.value)} disabled={fechada} placeholder="—" />
                      </div>
                    </Td>
                    <Td>
                      <div className="w-32">
                        <Input type="number" step="0.01" value={String(l.valor ?? '')} onChange={(e) => setLinha(l.id, 'valor', e.target.value)} disabled={fechada} />
                      </div>
                    </Td>
                    <Td>{origemTag(l.origem)}</Td>
                    <Td>
                      {!fechada ? (
                        <button onClick={() => removerLinha(l.id)} className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300" title="Remover linha"><Trash2 size={13} /></button>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </DataTable>
          <p className="mt-2 text-[10px] text-white/40">
            Valores de medição já vêm <strong className="text-white/60">com impostos</strong> (margem, O.H e imposto no serviço; imposto de locação nos alocados).
            Mão de obra <strong className="text-white/60">não</strong> vem da medição — entra apenas pelo timesheet da aba “Alocar HH”.
          </p>

          {/* Ações da planilha */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={addLinha} disabled={fechada} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40"><Plus size={14} /> Linha manual</button>
              <button onClick={exportarCsv} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2"><Download size={14} /> Exportar CSV</button>
            </div>
            <div className="flex items-center gap-3">
              {sujo && <span className="text-amber-300/80 text-[11px] font-bold uppercase tracking-widest">Alterações não salvas</span>}
              <Btn variant="green" onClick={salvarPlanilha} disabled={salvando || fechada || !sujo}><Save size={14} /> {salvando ? 'Salvando…' : 'Salvar planilha'}</Btn>
            </div>
          </div>

          {/* Orçado × Real */}
          <div className="mt-5 rounded-xl border border-white/10 bg-[#0b1220] p-4">
            <h3 className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-3">Proposta × Real por categoria</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-white/5 text-white/70 uppercase">
                    <th className="border border-white/10 px-3 py-2 text-left">Categoria</th>
                    <th className="border border-white/10 px-3 py-2 text-right">Proposta (preço)</th>
                    <th className="border border-white/10 px-3 py-2 text-right">Real</th>
                    <th className="border border-white/10 px-3 py-2 text-right">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.rows.length === 0 ? (
                    <tr><td colSpan={4} className="border border-white/10 px-3 py-3 text-white/40 text-center">Sem valores para comparar.</td></tr>
                  ) : comparativo.rows.map((r) => (
                    <tr key={r.categoria} className="text-white">
                      <td className="border border-white/10 px-3 py-2">{r.categoria}</td>
                      <td className="border border-white/10 px-3 py-2 text-right text-white/70">{money(r.orcado)}</td>
                      <td className="border border-white/10 px-3 py-2 text-right font-bold">{money(r.real)}</td>
                      <td className={`border border-white/10 px-3 py-2 text-right font-bold ${r.variacao > 0 ? 'text-red-300' : r.variacao < 0 ? 'text-emerald-300' : 'text-white/50'}`}>{r.variacao > 0 ? '+' : ''}{money(r.variacao)}</td>
                    </tr>
                  ))}
                  {comparativo.rows.length > 0 && (
                    <tr className="bg-white/5 text-white font-black">
                      <td className="border border-white/10 px-3 py-2 uppercase">Total</td>
                      <td className="border border-white/10 px-3 py-2 text-right">{money(comparativo.orcadoTotal)}</td>
                      <td className="border border-white/10 px-3 py-2 text-right">{money(comparativo.realTotal)}</td>
                      <td className={`border border-white/10 px-3 py-2 text-right ${comparativo.variacaoTotal > 0 ? 'text-red-300' : comparativo.variacaoTotal < 0 ? 'text-emerald-300' : ''}`}>{comparativo.variacaoTotal > 0 ? '+' : ''}{money(comparativo.variacaoTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-white/40">
              Proposta = preço do último orçamento por categoria (com margem, O.H e impostos) — o total fecha com o valor da proposta acima.
              Real = medição (com suas modificações) + timesheet + compras + linhas manuais.
              Na linha de <strong className="text-white/60">mão de obra</strong>, a proposta está a preço e o real é o custo do timesheet: a variação negativa é a margem da mão de obra.
              Variação em <span className="text-red-300 font-bold">vermelho</span> = acima da proposta; em <span className="text-emerald-300 font-bold">verde</span> = folga.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-6 border-t border-white/10 pt-4">
            <p className="text-white/50 text-xs uppercase font-black tracking-widest">Medição: <span className="text-emerald-300/80">{money(totalMedicao)}</span></p>
            <p className="text-white/50 text-xs uppercase font-black tracking-widest">Compras: <span className="text-violet-300">{money(totalCompra)}</span></p>
            <p className="text-white/50 text-xs uppercase font-black tracking-widest">H.H (mão de obra): <span className="text-sky-300">{money(totalHH)}</span></p>
            <p className="text-white/50 text-xs uppercase font-black tracking-widest">{boldOS('Custo total da OS: ')}<span className="text-emerald-300 text-lg">{money(totalCusto)}</span></p>
          </div>
        </>
      )}
    </FinCard>
  );
}
