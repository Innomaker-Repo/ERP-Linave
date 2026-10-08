import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Download, Eye, Filter, Plus, Search, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useErp } from '../../../context/ErpContext';
import {
  EntradaManutencaoModal, SaidaManutencaoModal, criarEntradaManutencao, fecharSaidaManutencao,
  gerarIdManutencao, itemEstaEmManutencao, itemPossuiManutencao, nomeDoItemManutencao, patrimonioDoItem,
  type ManutencaoHistoricoItem, type ManutencaoRow,
} from './manutencaoShared';

/* =========================================================================================
 * MANUTENÇÃO — tela dedicada (Suprimentos → Manutenção). Lê/grava direto no contexto
 * (`useErp().almoxerifado`, via `saveEntity`), igual a HistoricoRomaneioView.tsx — sem o
 * padrão de "estado local espelhado + auto-save" que EstoqueView.tsx usa, porque essa tela
 * não tem edição contínua de formulário: cada ação (registrar entrada/saída) é autocontida
 * e já sobe o resultado final de uma vez.
 * =======================================================================================*/

interface StockRowLike extends ManutencaoRow {}

const br = (value?: string): string => {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : value;
};

const formatarMoeda = (valor?: string): string => {
  const num = parseFloat(String(valor || '').replace(',', '.'));
  return Number.isFinite(num) && num > 0
    ? `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
};

const ORIGEM_LABEL: Record<ManutencaoHistoricoItem['origem'], string> = {
  edicaoItem: 'Status trocado ao editar o item no Estoque',
  telaManutencao: 'Registrado direto na tela de Manutenção',
  romaneio: 'Retornou de um Romaneio marcado para manutenção',
};

type FiltroPeriodoModo = 'entrada' | 'saida' | 'ambos';

// Compara só a parte "yyyy-mm-dd" — os inputs de data e os campos entradaData/saidaData já
// vêm nesse formato, então dá pra comparar como string sem precisar de Date().
const dataDentroDoPeriodo = (data: string | undefined, de: string, ate: string): boolean => {
  if (!de && !ate) return true;
  if (!data) return false;
  const valor = data.slice(0, 10);
  if (de && valor < de) return false;
  if (ate && valor > ate) return false;
  return true;
};

export function ManutencaoView({ searchQuery }: { searchQuery?: string }) {
  const { almoxerifado, saveEntity, userSession } = useErp() as any;
  const [aba, setAba] = useState<'emManutencao' | 'historico'>('emManutencao');
  const [busca, setBusca] = useState(searchQuery || '');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');

  // Filtro por período, só na aba Histórico — o usuário escolhe se quer restringir pela data
  // de entrada, de saída, ou pelas duas ao mesmo tempo (aí precisa bater nos dois períodos).
  const [filtroPeriodoModo, setFiltroPeriodoModo] = useState<FiltroPeriodoModo>('entrada');
  const [periodoEntradaDe, setPeriodoEntradaDe] = useState('');
  const [periodoEntradaAte, setPeriodoEntradaAte] = useState('');
  const [periodoSaidaDe, setPeriodoSaidaDe] = useState('');
  const [periodoSaidaAte, setPeriodoSaidaAte] = useState('');

  const periodoFiltroAtivo = Boolean(periodoEntradaDe || periodoEntradaAte || periodoSaidaDe || periodoSaidaAte);
  const limparPeriodoFiltro = () => {
    setPeriodoEntradaDe('');
    setPeriodoEntradaAte('');
    setPeriodoSaidaDe('');
    setPeriodoSaidaAte('');
  };

  const [registrarAlvoId, setRegistrarAlvoId] = useState('');
  const [entradaAlvo, setEntradaAlvo] = useState<{ row: StockRowLike; numeroManutencao: string } | null>(null);
  const [detalheAlvo, setDetalheAlvo] = useState<StockRowLike | null>(null);
  const [saidaAberta, setSaidaAberta] = useState(false);

  const tables = useMemo(() => (Array.isArray(almoxerifado?.tables) ? almoxerifado.tables : []), [almoxerifado?.tables]);
  const manutencaoHistorico: ManutencaoHistoricoItem[] = useMemo(
    () => (Array.isArray(almoxerifado?.manutencaoHistorico) ? almoxerifado.manutencaoHistorico : []),
    [almoxerifado?.manutencaoHistorico],
  );

  // Todo item cadastrado com "possui manutenção" marcado, de todas as tabelas — mesmo padrão
  // de achatar tabelas já usado pela categoria "Todos" em EstoqueView.tsx.
  const itensElegiveis: StockRowLike[] = useMemo(() => {
    const linhas: StockRowLike[] = [];
    tables.forEach((table: any) => {
      (table.rows || []).forEach((row: any) => {
        const item: StockRowLike = { id: row.id, tableName: table.name, values: row.values || {} };
        if (itemPossuiManutencao(item)) linhas.push(item);
      });
    });
    return linhas;
  }, [tables]);

  const itensEmManutencao = useMemo(() => itensElegiveis.filter(itemEstaEmManutencao), [itensElegiveis]);
  const itensDisponiveisParaEntrada = useMemo(() => itensElegiveis.filter((r) => !itemEstaEmManutencao(r)), [itensElegiveis]);

  const categorias = useMemo(
    () => Array.from(new Set(itensElegiveis.map((r) => r.tableName))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [itensElegiveis],
  );

  // Última entrada (aberta) de manutenção de um rowId — é o que a lista "Em Manutenção" mostra.
  const entradaAbertaPorRowId = useMemo(() => {
    const mapa = new Map<string, ManutencaoHistoricoItem>();
    manutencaoHistorico
      .filter((h) => h.status === 'aberta')
      .forEach((h) => {
        const atual = mapa.get(h.rowId);
        if (!atual || h.entradaData > atual.entradaData) mapa.set(h.rowId, h);
      });
    return mapa;
  }, [manutencaoHistorico]);

  const termo = busca.trim().toLowerCase();
  const bateBusca = (row: StockRowLike) =>
    !termo || `${nomeDoItemManutencao(row)} ${patrimonioDoItem(row)}`.toLowerCase().includes(termo);

  const listaEmManutencao = useMemo(
    () => itensEmManutencao
      .filter(bateBusca)
      .filter((r) => !categoriaFiltro || r.tableName === categoriaFiltro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itensEmManutencao, termo, categoriaFiltro],
  );

  const historicoFechado = useMemo(
    () => manutencaoHistorico
      .filter((h) => h.status === 'concluida')
      .filter((h) => !termo || h.itemLabel.toLowerCase().includes(termo))
      .filter((h) => !categoriaFiltro || h.tableName === categoriaFiltro)
      .filter((h) => {
        const checarEntrada = filtroPeriodoModo === 'entrada' || filtroPeriodoModo === 'ambos';
        const checarSaida = filtroPeriodoModo === 'saida' || filtroPeriodoModo === 'ambos';
        if (checarEntrada && !dataDentroDoPeriodo(h.entradaData, periodoEntradaDe, periodoEntradaAte)) return false;
        if (checarSaida && !dataDentroDoPeriodo(h.saidaData, periodoSaidaDe, periodoSaidaAte)) return false;
        return true;
      })
      .sort((a, b) => String(b.saidaData || '').localeCompare(String(a.saidaData || ''))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manutencaoHistorico, termo, categoriaFiltro, filtroPeriodoModo, periodoEntradaDe, periodoEntradaAte, periodoSaidaDe, periodoSaidaAte],
  );

  // Exporta exatamente o que está na lista já filtrada (busca, categoria e período) — mesmo
  // princípio do "Baixar planilha" do Almoxarifado (EstoqueView.tsx): a planilha reflete
  // sempre o que está sendo exibido na tela, nunca o histórico completo sem filtro.
  const handleBaixarPlanilhaHistorico = () => {
    if (historicoFechado.length === 0) {
      toast.error('Não há itens para exportar com os filtros atuais.');
      return;
    }

    const cabecalho = [
      'Nº Manutenção', 'Equipamento', 'Categoria', 'Patrimônio',
      'Data de Entrada', 'Motivo da Entrada', 'Responsável pelo Registro', 'Observações da Entrada',
      'Data de Saída', 'Serviço Realizado', 'Peças/Materiais Utilizados', 'Custo da Manutenção',
      'Responsável pela Manutenção', 'Responsável pela Liberação', 'Observações da Saída', 'Origem',
    ];

    const linhas = historicoFechado.map((h) => {
      const row = linhaPorId(h.tableName, h.rowId);
      return [
        h.id,
        h.itemLabel,
        h.tableName,
        (row && patrimonioDoItem(row)) || '-',
        br(h.entradaData),
        h.entradaMotivo || '',
        h.entradaResponsavel || '',
        h.entradaObs || '',
        br(h.saidaData),
        h.saidaServico || '',
        h.saidaPecas || '',
        h.saidaCusto || '',
        h.saidaResponsavel || '',
        h.saidaLiberadoPor || '',
        h.saidaObs || '',
        ORIGEM_LABEL[h.origem] || h.origem,
      ];
    });

    const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, planilha, 'Historico Manutencao');

    const partesNome = ['historico-manutencao'];
    if (categoriaFiltro) partesNome.push(categoriaFiltro);
    if (filtroPeriodoModo === 'entrada' || filtroPeriodoModo === 'ambos') {
      if (periodoEntradaDe || periodoEntradaAte) partesNome.push(`entrada-${periodoEntradaDe || 'inicio'}-a-${periodoEntradaAte || 'fim'}`);
    }
    if (filtroPeriodoModo === 'saida' || filtroPeriodoModo === 'ambos') {
      if (periodoSaidaDe || periodoSaidaAte) partesNome.push(`saida-${periodoSaidaDe || 'inicio'}-a-${periodoSaidaAte || 'fim'}`);
    }
    const nomeArquivo = partesNome.join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)/g, '');

    XLSX.writeFile(workbook, `${nomeArquivo}.xlsx`);
    toast.success(`Planilha gerada com ${historicoFechado.length} registro(s).`);
  };

  const linhaPorId = (tableName: string, rowId: string): StockRowLike | undefined => {
    const table = tables.find((t: any) => t.name === tableName);
    const row = table?.rows.find((r: any) => r.id === rowId);
    return row ? { id: row.id, tableName, values: row.values || {} } : undefined;
  };

  const timelineDoItem = (row: StockRowLike): ManutencaoHistoricoItem[] =>
    manutencaoHistorico
      .filter((h) => h.rowId === row.id && h.tableName === row.tableName)
      .sort((a, b) => String(b.entradaData || '').localeCompare(String(a.entradaData || '')));

  const abrirRegistrarManutencao = () => {
    const row = itensDisponiveisParaEntrada.find((r) => r.id === registrarAlvoId);
    if (!row) {
      toast.error('Selecione um item elegível para manutenção.');
      return;
    }
    setEntradaAlvo({ row, numeroManutencao: gerarIdManutencao() });
  };

  const confirmarEntrada = async (dados: {
    data: string; motivo: string; responsavel: string; observacao: string; fotoUrl: string; fotoBackendId?: number;
  }) => {
    if (!entradaAlvo) return;
    const { row, numeroManutencao } = entradaAlvo;

    const entrada: ManutencaoHistoricoItem = {
      ...criarEntradaManutencao({ row, ...dados, origem: 'telaManutencao' }),
      id: numeroManutencao,
    };

    const nextTables = tables.map((table: any) => {
      if (table.name !== row.tableName) return table;
      return {
        ...table,
        rows: table.rows.map((r: any) => {
          if (r.id !== row.id) return r;
          const nextValues = { ...r.values, status: 'Em manutenção' };
          return { ...r, values: nextValues, searchText: Object.values(nextValues).join(' ').toLowerCase() };
        }),
      };
    });

    await saveEntity('almoxerifado', {
      ...(almoxerifado || {}),
      tables: nextTables,
      manutencaoHistorico: [entrada, ...manutencaoHistorico],
    });

    setEntradaAlvo(null);
    setRegistrarAlvoId('');
    toast.success('Item enviado para manutenção.');
  };

  const confirmarSaida = async (dados: {
    data: string; responsavel: string; liberadoPor: string; servico: string; pecas: string; custo: string;
    observacao: string; fotoUrl: string; fotoBackendId?: number;
  }) => {
    if (!detalheAlvo) return;
    const entradaAtual = entradaAbertaPorRowId.get(detalheAlvo.id);
    if (!entradaAtual) return;

    const fechada = fecharSaidaManutencao(entradaAtual, dados);
    const nextHistorico = manutencaoHistorico.map((h) => (h.id === fechada.id ? fechada : h));

    const nextTables = tables.map((table: any) => {
      if (table.name !== detalheAlvo.tableName) return table;
      return {
        ...table,
        rows: table.rows.map((r: any) => {
          if (r.id !== detalheAlvo.id) return r;
          const nextValues = { ...r.values, status: 'Disponível' };
          return { ...r, values: nextValues, searchText: Object.values(nextValues).join(' ').toLowerCase() };
        }),
      };
    });

    await saveEntity('almoxerifado', {
      ...(almoxerifado || {}),
      tables: nextTables,
      manutencaoHistorico: nextHistorico,
    });

    setSaidaAberta(false);
    setDetalheAlvo(null);
    toast.success('Manutenção finalizada — item disponível novamente.');
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 text-amber-300 text-[10px] font-black uppercase tracking-widest">
            <Wrench size={14} /> Suprimentos
          </div>
          <h1 className="text-3xl font-black text-white">Controle de Manutenção</h1>
          <p className="text-white/50 text-sm">Registro de entrada, serviço executado, fotos e saída do equipamento.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={registrarAlvoId}
            onChange={(e) => setRegistrarAlvoId(e.target.value)}
            className="h-12 min-w-[260px] rounded-xl border border-white/10 bg-[#0b1220]/80 px-4 text-sm text-white outline-none focus:border-amber-400 [&>option]:bg-[#101f3d]"
          >
            <option value="">{itensDisponiveisParaEntrada.length ? 'Selecione um item...' : 'Nenhum item elegível'}</option>
            {itensDisponiveisParaEntrada.map((row) => (
              <option key={`${row.tableName}::${row.id}`} value={row.id}>{nomeDoItemManutencao(row)} — {row.tableName}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={abrirRegistrarManutencao}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-5 text-xs font-black uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/25"
          >
            <Plus size={15} /> Registrar Manutenção
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_160px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por equipamento, patrimônio..."
            className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white text-sm outline-none focus:border-amber-500 placeholder:text-white/40"
          />
        </div>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="h-14 rounded-xl border border-white/10 bg-white/5 px-4 text-white text-sm outline-none focus:border-amber-500 [&>option]:bg-[#101f3d]"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Em manutenção</p>
          <p className="mt-1 text-2xl font-black text-amber-300">{itensEmManutencao.length}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setAba('emManutencao')}
          className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${aba === 'emManutencao' ? 'border-amber-400/60 bg-amber-500/15 text-amber-200' : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'}`}
        >
          Em Manutenção
        </button>
        <button
          onClick={() => setAba('historico')}
          className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${aba === 'historico' ? 'border-amber-400/60 bg-amber-500/15 text-amber-200' : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'}`}
        >
          Histórico
        </button>
      </div>

      {aba === 'historico' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-white/40">
              <Filter size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Filtrar por período</span>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Aplicar em</label>
              <select
                value={filtroPeriodoModo}
                onChange={(e) => setFiltroPeriodoModo(e.target.value as FiltroPeriodoModo)}
                className="h-11 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 text-sm text-white outline-none focus:border-amber-500 [&>option]:bg-[#101f3d]"
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ambos">Entrada e saída</option>
              </select>
            </div>

            {(filtroPeriodoModo === 'entrada' || filtroPeriodoModo === 'ambos') && (
              <div className="flex items-end gap-2">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Entrada de</label>
                  <input
                    type="date"
                    value={periodoEntradaDe}
                    onChange={(e) => setPeriodoEntradaDe(e.target.value)}
                    className="h-11 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">até</label>
                  <input
                    type="date"
                    value={periodoEntradaAte}
                    onChange={(e) => setPeriodoEntradaAte(e.target.value)}
                    className="h-11 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {(filtroPeriodoModo === 'saida' || filtroPeriodoModo === 'ambos') && (
              <div className="flex items-end gap-2">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Saída de</label>
                  <input
                    type="date"
                    value={periodoSaidaDe}
                    onChange={(e) => setPeriodoSaidaDe(e.target.value)}
                    className="h-11 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">até</label>
                  <input
                    type="date"
                    value={periodoSaidaAte}
                    onChange={(e) => setPeriodoSaidaAte(e.target.value)}
                    className="h-11 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {periodoFiltroAtivo && (
              <button
                type="button"
                onClick={limparPeriodoFiltro}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-[11px] font-bold uppercase tracking-widest text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Limpar período
              </button>
            )}
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            Exibindo {historicoFechado.length} registro(s)
          </p>
          <button
            type="button"
            onClick={handleBaixarPlanilhaHistorico}
            title="Baixa em Excel o histórico exibido com os filtros atuais"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 text-[11px] font-bold uppercase tracking-wider text-emerald-200 shadow-sm transition hover:bg-emerald-500/25 hover:text-white"
          >
            <Download size={14} />
            Baixar planilha
          </button>
        </div>
      )}

      <div className="overflow-auto rounded-[24px] border border-white/10 bg-white/[0.02] shadow-inner">
        {aba === 'emManutencao' ? (
          listaEmManutencao.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-14 text-center text-white/40">
              <Wrench size={36} className="text-white/20" />
              <p className="text-sm font-bold">Nenhum item em manutenção</p>
              <p className="text-xs text-white/30">Ajuste a busca/filtro ou registre uma manutenção acima.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-black/20">
                <tr className="border-b border-white/5 text-[9px] uppercase tracking-widest text-white/40">
                  <th className="px-6 py-3 text-left">Equipamento</th>
                  <th className="px-6 py-3 text-left">Patrimônio</th>
                  <th className="px-6 py-3 text-left">Categoria</th>
                  <th className="px-6 py-3 text-left">Entrada</th>
                  <th className="px-6 py-3 text-left">Motivo</th>
                  <th className="px-6 py-3 text-left">Responsável</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {listaEmManutencao.map((row) => {
                  const entrada = entradaAbertaPorRowId.get(row.id);
                  return (
                    <tr key={`${row.tableName}::${row.id}`} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-3">
                        <div className="font-black uppercase text-white text-[11px]">{nomeDoItemManutencao(row)}</div>
                        {entrada && <div className="mt-0.5 text-[10px] text-white/36">{entrada.id}</div>}
                      </td>
                      <td className="px-6 py-3 text-white/70">{patrimonioDoItem(row) || '—'}</td>
                      <td className="px-6 py-3 text-white/70">{row.tableName}</td>
                      <td className="px-6 py-3 text-white/70">{br(entrada?.entradaData)}</td>
                      <td className="px-6 py-3 max-w-[220px] truncate text-white/70">{entrada?.entradaMotivo || '—'}</td>
                      <td className="px-6 py-3 text-white/70">{entrada?.entradaResponsavel || '—'}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Em manutenção
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => setDetalheAlvo(row)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-amber-400/40 hover:text-amber-300"
                          title="Visualizar"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : historicoFechado.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center text-white/40">
            <CheckCircle2 size={36} className="text-white/20" />
            <p className="text-sm font-bold">Nenhuma manutenção concluída ainda</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-black/20">
              <tr className="border-b border-white/5 text-[9px] uppercase tracking-widest text-white/40">
                <th className="px-6 py-3 text-left">Equipamento</th>
                <th className="px-6 py-3 text-left">Categoria</th>
                <th className="px-6 py-3 text-left">Entrada</th>
                <th className="px-6 py-3 text-left">Saída</th>
                <th className="px-6 py-3 text-left">Serviço</th>
                <th className="px-6 py-3 text-left">Responsável</th>
                <th className="px-6 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {historicoFechado.map((h) => {
                const row = linhaPorId(h.tableName, h.rowId);
                return (
                  <tr key={h.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-3 font-black uppercase text-white text-[11px]">{h.itemLabel}</td>
                    <td className="px-6 py-3 text-white/70">{h.tableName}</td>
                    <td className="px-6 py-3 text-white/70">{br(h.entradaData)}</td>
                    <td className="px-6 py-3 text-white/70">{br(h.saidaData)}</td>
                    <td className="px-6 py-3 max-w-[220px] truncate text-white/70">{h.saidaServico || '—'}</td>
                    <td className="px-6 py-3 text-white/70">{h.saidaResponsavel || '—'}</td>
                    <td className="px-6 py-3">
                      {row && (
                        <button
                          onClick={() => setDetalheAlvo(row)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-amber-400/40 hover:text-amber-300"
                          title="Visualizar"
                        >
                          <Eye size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: Detalhe do item (comparação de foto + timeline) */}
      {detalheAlvo && (() => {
        const timeline = timelineDoItem(detalheAlvo);
        const aberta = entradaAbertaPorRowId.get(detalheAlvo.id);
        const maisRecente = timeline[0];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between border-b border-white/5 bg-[#101f3d] p-6">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">Registro de Manutenção</p>
                  <h2 className="text-xl font-black uppercase tracking-wide text-white">{nomeDoItemManutencao(detalheAlvo)}</h2>
                </div>
                <button type="button" onClick={() => setDetalheAlvo(null)} className="rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/5 bg-[#0b1220]/40 p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Entrada em manutenção</p>
                    {maisRecente?.entradaFotoUrl ? (
                      <img src={maisRecente.entradaFotoUrl} alt="Foto de entrada" className="h-48 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-48 place-items-center rounded-lg bg-black/20 text-[11px] uppercase tracking-widest text-white/25">Sem foto</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-white/5 bg-[#0b1220]/40 p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Saída da manutenção</p>
                    {maisRecente?.saidaFotoUrl ? (
                      <img src={maisRecente.saidaFotoUrl} alt="Foto de saída" className="h-48 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-48 place-items-center rounded-lg bg-black/20 text-[11px] uppercase tracking-widest text-white/25">Aguardando saída</div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0b1220]/40 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Histórico</p>
                  {timeline.length === 0 ? (
                    <p className="text-xs text-white/40">Nenhum ciclo de manutenção registrado ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {timeline.map((h) => (
                        <div key={h.id} className="rounded-lg border-l-2 border-amber-500 bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-white/70">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/30">Nº {h.id}</p>

                          <p className="text-base font-bold text-white">{br(h.entradaData)} — Entrada em manutenção</p>
                          <p>Motivo: {h.entradaMotivo || '—'}</p>
                          <p>Responsável pelo registro: {h.entradaResponsavel || '—'}</p>
                          <p>Observações da entrada: {h.entradaObs || '—'}</p>
                          <p className="text-white/40">Origem: {ORIGEM_LABEL[h.origem] || h.origem}</p>

                          {h.status === 'concluida' ? (
                            <div className="mt-2 border-t border-white/10 pt-2 text-emerald-200/80">
                              <p className="text-base font-bold text-emerald-200">{br(h.saidaData)} — Saída da manutenção</p>
                              <p>Serviço realizado: {h.saidaServico || '—'}</p>
                              <p>Peças / materiais utilizados: {h.saidaPecas || '—'}</p>
                              <p>Custo da manutenção: {formatarMoeda(h.saidaCusto)}</p>
                              <p>Responsável pela manutenção: {h.saidaResponsavel || '—'}</p>
                              <p>Responsável pela liberação: {h.saidaLiberadoPor || '—'}</p>
                              <p>Observações finais: {h.saidaObs || '—'}</p>
                            </div>
                          ) : (
                            <p className="mt-2 border-t border-white/10 pt-2 font-bold text-amber-300/80">Em aberto — aguardando registrar a saída</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/5 bg-[#131f37] p-6">
                <button type="button" onClick={() => setDetalheAlvo(null)} className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10">Fechar</button>
                {aberta && (
                  <button
                    type="button"
                    onClick={() => setSaidaAberta(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-emerald-500"
                  >
                    <Clock3 size={15} /> Registrar Saída da Manutenção
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Entrada em Manutenção (via "Registrar Manutenção") */}
      {entradaAlvo && (
        <EntradaManutencaoModal
          row={entradaAlvo.row}
          categoriaLabel={entradaAlvo.row.tableName}
          numeroManutencao={entradaAlvo.numeroManutencao}
          responsavelPadrao={userSession?.nome || userSession?.email || ''}
          onClose={() => setEntradaAlvo(null)}
          onConfirm={confirmarEntrada}
        />
      )}

      {/* MODAL: Saída da Manutenção */}
      {saidaAberta && detalheAlvo && (
        <SaidaManutencaoModal
          itemLabel={nomeDoItemManutencao(detalheAlvo)}
          uploadVinculoId={detalheAlvo.id}
          onClose={() => setSaidaAberta(false)}
          onConfirm={confirmarSaida}
        />
      )}
    </div>
  );
}
