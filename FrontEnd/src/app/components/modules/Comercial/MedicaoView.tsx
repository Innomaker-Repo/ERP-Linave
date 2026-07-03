import React, { useEffect, useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Ruler, Plus, X, Save, Download, Check, Ban, Filter, Clock, CheckCircle2, Copy, FilePlus, Send, FileText, Lock, Unlock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { isOsAprovada } from '../../../../services/ordensServico';
import { criarMedicao, atualizarStatusMedicao } from '../../../../services/medicoesService';
import { uploadDocumento } from '../../../../services/documentosService';
import { atualizarOrdemServico } from '../../../../services/comercialService';
import { handleDownloadMedicaoPDF } from '../CRM/handleDownloadMedicaoPDF';
import { genFinId, todayStr, FORMAS_PAGAMENTO } from '../Financeiro/finData';
import { temServico, temLocacao } from '../../../utils/modalidade';
import { formatDateBR } from '../../../utils/formatDate';

const TIPOS_NFE = ['NFe Serviço', 'NFe Alocado', 'Nota de débito', 'Outro'];

const parseDecimal = (v: any): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
const money = (v: any) => parseDecimal(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Arredonda para 2 casas evitando lixo de ponto flutuante (ex.: 0.1*0.2 = 0.020000000000000004).
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const novaLinha = (categoria: 'servico' | 'locacao' = 'servico') => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  item: '', descricao: '', unidade: '', quantidadeProduzida: '', valorUnitario: '',
  dias: '1', categoria, extras: {} as Record<string, string>, total: '', observacoes: '',
});

// Total da linha: serviço = Qtd × Dias × Valor/unid.; locação = Qtd × Valor/unid. (sem dias).
const calcularTotalLinha = (l: any): number => {
  const q = parseDecimal(l.quantidadeProduzida);
  const u = parseDecimal(l.valorUnitario);
  const d = l.categoria === 'locacao' ? 1 : (parseDecimal(l.dias) || 1);
  return round2(q * d * u);
};

const formInicial = () => ({
  dataEmissao: new Date().toISOString().split('T')[0],
  embarcacao: '', numeroBM: '', periodo: '',
  representanteCliente: '', representanteLinave: '',
  itens: [novaLinha()],
});

const STATUS_BADGE: Record<string, string> = {
  pendente: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  aprovada: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  recusada: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const nfeInputCls = 'w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30';

export function MedicaoView({ searchQuery = '' }: { searchQuery?: string }) {
  const { os, obras, clientes, medicoes, refreshMedicoes, financeiro, saveEntity, config } = useErp() as any;

  const [osSelecionadaId, setOsSelecionadaId] = useState<string>('');
  const [form, setForm] = useState<any>(formInicial());
  const [salvando, setSalvando] = useState(false);
  const [filtroOsHistorico, setFiltroOsHistorico] = useState<string>('');
  const [versaoBase, setVersaoBase] = useState<any>(null);   // medição-base para "colar medição antiga"
  const [nfePopup, setNfePopup] = useState<any>(null);       // medição recém-aprovada → solicitar NFe
  const [nfeForm, setNfeForm] = useState<any>(null);
  const [solicitandoNfe, setSolicitandoNfe] = useState(false);

  // OS elegíveis para medição: apenas as APROVADAS (trabalho em execução/concluído),
  // excluindo as OS de uso interno (café/papel/etc.), que não são medidas.
  const osAprovadas = useMemo(
    () => (Array.isArray(os) ? os : []).filter((o: any) => isOsAprovada(o) && !o.usoInterno),
    [os],
  );

  const obrasById = useMemo(() => {
    const map = new Map<string, any>();
    (Array.isArray(obras) ? obras : []).forEach((o: any) => map.set(String(o.id), o));
    return map;
  }, [obras]);

  const osSelecionada = useMemo(
    () => osAprovadas.find((o: any) => String(o.id) === String(osSelecionadaId)) || null,
    [osAprovadas, osSelecionadaId],
  );

  // OS já fechadas (bloqueadas) — listadas na seção de fechamento; some das demais telas.
  const osFechadas = useMemo(
    () => (Array.isArray(os) ? os : []).filter((o: any) => o?.fechada && !o?.usoInterno),
    [os],
  );

  // Medições de uma OS (por backendId) e se há ao menos uma APROVADA (libera o fechamento).
  const medicoesDaOs = (osBackendId: any) =>
    (Array.isArray(medicoes) ? medicoes : []).filter((m: any) => String(m.ordemServicoBackendId) === String(osBackendId));
  const temMedicaoAprovada = (osBackendId: any) =>
    medicoesDaOs(osBackendId).some((m: any) => String(m.status).toLowerCase() === 'aprovada');

  // Modal de bloqueio/reabertura. mode 'fechar' = fechar OS; 'reabrir' = ação restrita à diretoria.
  const [bloqueioModal, setBloqueioModal] = useState<{ open: boolean; os: any; mode: 'fechar' | 'reabrir' }>({ open: false, os: null, mode: 'fechar' });
  const [bloqueando, setBloqueando] = useState(false);

  const abrirBloqueio = (alvo: any, mode: 'fechar' | 'reabrir') => setBloqueioModal({ open: true, os: alvo, mode });
  const fecharBloqueioModal = () => { if (!bloqueando) setBloqueioModal({ open: false, os: null, mode: 'fechar' }); };

  const confirmarBloqueio = async () => {
    const alvo = bloqueioModal.os;
    if (!alvo?.backendId) return;
    const fechar = bloqueioModal.mode === 'fechar';
    const hoje = new Date().toISOString().split('T')[0];
    setBloqueando(true);
    try {
      await atualizarOrdemServico(alvo.backendId, fechar
        ? { fechada: true, data_fechamento: hoje }
        : { fechada: false, data_fechamento: null });
      // Atualiza o contexto local de OS (sem refetch): liga/desliga a flag fechada.
      const novaLista = (Array.isArray(os) ? os : []).map((o: any) =>
        String(o.backendId) === String(alvo.backendId)
          ? { ...o, fechada: fechar, dataFechamento: fechar ? hoje : undefined }
          : o);
      saveEntity('os', novaLista);
      if (fechar && String(osSelecionadaId) === String(alvo.id)) setOsSelecionadaId('');
      toast.success(fechar ? 'OS fechada. Bloqueada para uso em estoque/compras/alocação.' : 'OS reaberta para uso.');
      setBloqueioModal({ open: false, os: null, mode: 'fechar' });
    } catch (e) {
      console.error('Erro ao alterar bloqueio da OS:', e);
      toast.error('Erro ao processar o bloqueio da OS.');
    } finally {
      setBloqueando(false);
    }
  };

  // Contexto (empresa/cliente/cnpj) derivado da OS/obra selecionada para os campos readonly + PDF.
  const contexto = useMemo(() => {
    if (!osSelecionada) return null;
    const obra = obrasById.get(String(osSelecionada.obraId)) || {};
    const cli = (Array.isArray(clientes) ? clientes : []).find(
      (c: any) => String(c.id) === String(obra.clienteId ?? osSelecionada.clienteId),
    );
    return {
      obra,
      empresa: obra.empresaPrestadora || 'Linave',
      cliente: obra.nomeClienteResolvido || cli?.razaoSocial || osSelecionada.cliente || '',
      cnpj: cli?.cpfCnpj || '',
    };
  }, [osSelecionada, obrasById, clientes]);

  const totalMedicao = useMemo(
    () => round2((form.itens || []).reduce((s: number, l: any) => s + parseDecimal(l.total), 0)),
    [form.itens],
  );

  const atualizarLinha = (id: string, campo: string, valor: string) => {
    setForm((f: any) => ({
      ...f,
      itens: f.itens.map((l: any) => {
        if (l.id !== id) return l;
        const next = { ...l, [campo]: valor };
        if (campo === 'quantidadeProduzida' || campo === 'valorUnitario' || campo === 'dias') {
          next.total = String(calcularTotalLinha(next));
        }
        return next;
      }),
    }));
  };
  // Valor de uma coluna customizada (só informativa, não entra no cálculo).
  const atualizarExtra = (id: string, coluna: string, valor: string) => {
    setForm((f: any) => ({ ...f, itens: f.itens.map((l: any) => l.id === id ? { ...l, extras: { ...(l.extras || {}), [coluna]: valor } } : l) }));
  };
  const addLinha = (categoria: 'servico' | 'locacao' = 'servico') => setForm((f: any) => ({ ...f, itens: [...f.itens, novaLinha(categoria)] }));
  const removerLinha = (id: string) => setForm((f: any) => ({ ...f, itens: f.itens.filter((l: any) => l.id !== id) }));

  // Colunas customizadas de uma categoria = união das chaves de `extras` das suas linhas.
  const colunasExtras = (categoria: 'servico' | 'locacao'): string[] => {
    const set = new Set<string>();
    (form.itens || []).filter((l: any) => (l.categoria || 'servico') === categoria)
      .forEach((l: any) => Object.keys(l.extras || {}).forEach((k) => set.add(k)));
    return Array.from(set);
  };
  const addColuna = (categoria: 'servico' | 'locacao') => {
    const nome = (typeof window !== 'undefined' ? window.prompt('Nome da nova coluna (informativa):') : '') || '';
    const limpo = nome.trim();
    if (!limpo) return;
    setForm((f: any) => ({ ...f, itens: f.itens.map((l: any) => (l.categoria || 'servico') === categoria ? { ...l, extras: { ...(l.extras || {}), [limpo]: l.extras?.[limpo] ?? '' } } : l) }));
  };
  const removerColuna = (categoria: 'servico' | 'locacao', nome: string) => {
    setForm((f: any) => ({ ...f, itens: f.itens.map((l: any) => {
      if ((l.categoria || 'servico') !== categoria) return l;
      const e = { ...(l.extras || {}) }; delete e[nome]; return { ...l, extras: e };
    }) }));
  };

  // Subtotais por categoria (o de serviço é o que vai para a NF).
  const subtotalServico = round2((form.itens || []).filter((l: any) => (l.categoria || 'servico') !== 'locacao').reduce((s: number, l: any) => s + parseDecimal(l.total), 0));
  const subtotalLocacao = round2((form.itens || []).filter((l: any) => (l.categoria || 'servico') === 'locacao').reduce((s: number, l: any) => s + parseDecimal(l.total), 0));

  const renderTabelaMedicao = (categoria: 'servico' | 'locacao', titulo: string, comDias: boolean) => {
    const linhas = (form.itens || []).filter((l: any) => (l.categoria || 'servico') === categoria);
    const cols = colunasExtras(categoria);
    const subtotal = categoria === 'locacao' ? subtotalLocacao : subtotalServico;
    const inputCls = 'bg-[#101f3d] border border-white/10 rounded px-2 py-1';
    return (
      <div className="bg-[#0b1220] rounded-xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-emerald-300 text-xs font-black uppercase">{titulo}</h4>
          <div className="flex gap-2">
            <button onClick={() => addColuna(categoria)} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase">+ Coluna</button>
            <button onClick={() => addLinha(categoria)} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-black uppercase">+ Linha</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70 uppercase tracking-wider">
                <th className="border border-white/10 px-2 py-2 text-left">Item</th>
                <th className="border border-white/10 px-2 py-2 text-left">Descrição</th>
                <th className="border border-white/10 px-2 py-2 text-left">Unid.</th>
                <th className="border border-white/10 px-2 py-2 text-left">{comDias ? 'Qtd. horas' : 'Qtd.'}</th>
                {comDias && <th className="border border-white/10 px-2 py-2 text-left">Dias</th>}
                <th className="border border-white/10 px-2 py-2 text-left">Valor/unid.</th>
                {cols.map((c) => (
                  <th key={c} className="border border-white/10 px-2 py-2 text-left whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">{c}
                      <button onClick={() => removerColuna(categoria, c)} className="text-red-300 hover:text-red-200 font-black" title="Remover coluna">×</button>
                    </span>
                  </th>
                ))}
                <th className="border border-white/10 px-2 py-2 text-left">Total</th>
                <th className="border border-white/10 px-2 py-2 text-left">Obs.</th>
                <th className="border border-white/10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr><td colSpan={7 + (comDias ? 1 : 0) + cols.length} className="border border-white/10 px-2 py-3 text-white/40 text-center">Sem itens. Use "Puxar itens da OS" ou "+ Linha".</td></tr>
              )}
              {linhas.map((l: any) => (
                <tr key={l.id} className="text-white">
                  <td className="border border-white/10 p-1"><input value={l.item} onChange={(e) => atualizarLinha(l.id, 'item', e.target.value)} className={`w-12 ${inputCls}`} /></td>
                  <td className="border border-white/10 p-1"><input value={l.descricao} onChange={(e) => atualizarLinha(l.id, 'descricao', e.target.value)} className={`w-full min-w-[180px] ${inputCls}`} /></td>
                  <td className="border border-white/10 p-1"><input value={l.unidade} onChange={(e) => atualizarLinha(l.id, 'unidade', e.target.value)} className={`w-16 ${inputCls}`} /></td>
                  <td className="border border-white/10 p-1"><input value={l.quantidadeProduzida} onChange={(e) => atualizarLinha(l.id, 'quantidadeProduzida', e.target.value)} className={`w-20 ${inputCls}`} /></td>
                  {comDias && <td className="border border-white/10 p-1"><input value={l.dias} onChange={(e) => atualizarLinha(l.id, 'dias', e.target.value)} className={`w-16 ${inputCls}`} /></td>}
                  <td className="border border-white/10 p-1"><input value={l.valorUnitario} onChange={(e) => atualizarLinha(l.id, 'valorUnitario', e.target.value)} className={`w-24 ${inputCls}`} /></td>
                  {cols.map((c) => (
                    <td key={c} className="border border-white/10 p-1"><input value={l.extras?.[c] ?? ''} onChange={(e) => atualizarExtra(l.id, c, e.target.value)} className={`w-24 ${inputCls}`} /></td>
                  ))}
                  <td className="border border-white/10 p-1"><input value={l.total ? money(l.total) : ''} readOnly className={`w-24 ${inputCls} text-emerald-300 font-black`} /></td>
                  <td className="border border-white/10 p-1"><input value={l.observacoes} onChange={(e) => atualizarLinha(l.id, 'observacoes', e.target.value)} className={`w-full min-w-[110px] ${inputCls}`} /></td>
                  <td className="border border-white/10 p-1 text-center"><button onClick={() => removerLinha(l.id)} className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300"><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-white/50 text-[11px] uppercase font-black tracking-widest text-right">Subtotal {titulo}: <span className="text-emerald-300">R$ {money(subtotal)}</span></p>
      </div>
    );
  };

  // Puxa os itens medíveis da OS selecionada conforme a modalidade: uma linha por
  // serviço (preço do orçamento) e/ou por item de locação (valor de locação).
  const preencherItensDaOS = () => {
    if (!contexto?.obra) return toast.error('Selecione uma OS aprovada.');
    const obra = contexto.obra;
    const linhas: any[] = [];

    if (temServico(obra.modalidade)) {
      const orcs = Array.isArray(obra.orcamentos) ? obra.orcamentos : [];
      const ultimo = orcs.length ? orcs[orcs.length - 1] : null;
      const valores = ultimo?.valores || obra.orcamentoValores || null;
      const precoServico = Number(valores?.precoFinal ?? 0) || 0;
      if (precoServico > 0) {
        linhas.push({ ...novaLinha(), item: String(linhas.length + 1), descricao: 'Serviços (conforme orçamento)', unidade: 'vb', quantidadeProduzida: '1', valorUnitario: String(round2(precoServico)), total: String(round2(precoServico)) });
      }
    }

    if (temLocacao(obra.modalidade)) {
      (Array.isArray(obra.itensAlocacao) ? obra.itensAlocacao : [])
        .filter((it: any) => it.equipamento)
        .forEach((it: any) => {
          const q = Number(it.quantidade) || 0;
          const unit = Number(it.valorLocacao) || 0;
          linhas.push({ ...novaLinha('locacao'), item: String(linhas.length + 1), descricao: it.equipamento, unidade: it.unidade || '', quantidadeProduzida: String(q), valorUnitario: String(round2(unit)), total: String(round2(q * unit)) });
        });
    }

    if (linhas.length === 0) return toast.error('Nada para puxar: cadastre o orçamento (serviço) e/ou itens de locação.');
    setForm((f: any) => ({ ...f, itens: linhas }));
    toast.success(`${linhas.length} item(ns) puxado(s) da OS.`);
  };

  // Auto-preenche a medição com os dados da OS assim que uma OS é selecionada (form vazio).
  useEffect(() => {
    if (!osSelecionadaId || !contexto?.obra) return;
    const vazio = (form.itens || []).every((l: any) => !String(l.descricao || '').trim());
    if (vazio) preencherItensDaOS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osSelecionadaId, contexto]);

  const handleSalvar = async () => {
    if (!osSelecionada || !contexto) return toast.error('Selecione uma OS aprovada.');
    const itensValidos = (form.itens || []).filter((l: any) => l.descricao?.trim());
    if (itensValidos.length === 0) return toast.error('Adicione pelo menos um item à medição.');

    setSalvando(true);
    try {
      const payload = {
        negocioBackendId: osSelecionada.negocioBackendId,
        ordemServicoBackendId: osSelecionada.backendId,
        numeroBM: form.numeroBM,
        empresa: contexto.empresa,
        cliente: contexto.cliente,
        cnpj: contexto.cnpj,
        dataEmissao: form.dataEmissao,
        embarcacao: form.embarcacao,
        periodo: form.periodo,
        representanteCliente: form.representanteCliente,
        representanteLinave: form.representanteLinave,
        valorTotal: totalMedicao,
        status: 'pendente',
        itens: itensValidos,
      };
      await criarMedicao(payload);
      await refreshMedicoes();
      toast.success('Medição criada (aguardando aprovação).');
      setForm(formInicial());
    } catch (error) {
      console.error('Erro ao salvar medição:', error);
      toast.error('Erro ao salvar a medição no banco.');
    } finally {
      setSalvando(false);
    }
  };

  const empresasDisponiveis = useMemo(() => {
    const lista = (config?.empresasPrestadoras || []).filter((e: any) => e?.ativa !== false).map((e: any) => e?.nome).filter(Boolean);
    return lista.length ? lista : ['Linave', 'Servinave'];
  }, [config]);

  const descricaoOsDe = (med: any) => {
    const osDoMed = (Array.isArray(os) ? os : []).find((o: any) => String(o.backendId) === String(med.ordemServicoBackendId));
    return osDoMed?.descricaoGeralServico || osDoMed?.projeto || '';
  };

  // Abre o popup "Medição aprovada → Solicitar NFe", pré-preenchido com os dados da medição.
  const abrirSolicitacaoNfe = (med: any) => {
    setNfePopup(med);
    // Item 8: a NF puxa APENAS o valor de SERVIÇO (locação fica de fora).
    const itensMed = Array.isArray(med.itens) ? med.itens : [];
    const valorServico = itensMed.length
      ? round2(itensMed.filter((l: any) => (l.categoria || 'servico') !== 'locacao').reduce((s: number, l: any) => s + parseDecimal(l.total), 0))
      : Number(med.valorTotal || 0);
    setNfeForm({
      empresa: med.empresa || empresasDisponiveis[0] || 'Linave',
      os: med.ordemServicoNumero || '',   // Item 6: OS puxada automaticamente da medição.
      valor: String(valorServico),
      dataEmitir: todayStr,
      forma: '',
      tipoNfe: 'NFe Serviço',
      descricao: descricaoOsDe(med),
      observacao: '',
      docsCliente: [] as any[],           // Item 5: documento(s) do cliente.
      docsNf: [] as any[],                // Item 7: NF já emitida.
    });
  };

  // Ao aprovar uma medição com itens de LOCAÇÃO, cria automaticamente uma solicitação de
  // recibo de locação (aparece na aba "Fazer Recibo de Locação" do Financeiro, pré-preenchida).
  const criarSolicitacaoRecibo = async (med: any) => {
    const itensLoc = (Array.isArray(med.itens) ? med.itens : []).filter((l: any) => (l.categoria || 'servico') === 'locacao');
    if (itensLoc.length === 0) return;
    const fin = Array.isArray(financeiro) ? financeiro : [];
    const ano = String(new Date().getFullYear()).slice(-2);
    const maior = fin.filter((r: any) => r?.tipo === 'reciboLocacao' && String(r.numero || '').endsWith(`/${ano}`))
      .reduce((m: number, r: any) => Math.max(m, parseInt(String(r.numero || '').split('/')[0], 10) || 0), 0);
    const rec = {
      id: `REC-${Date.now()}`,
      tipo: 'reciboLocacao',
      status: 'pendente',
      numero: `${String(maior + 1).padStart(3, '0')}/${ano}`,
      empresa: med.empresa || '',
      dataEmissao: new Date().toISOString().slice(0, 10),
      dataVencimento: new Date().toISOString().slice(0, 10),
      clienteNome: med.cliente || '',
      clienteCnpj: med.cnpj || '',
      itens: itensLoc.map((l: any, i: number) => ({
        id: `it-${Date.now()}-${i}`,
        item: String(i + 1).padStart(2, '0'),
        qtd: String(l.quantidadeProduzida ?? ''),
        descricao: [l.descricao, med.embarcacao, med.periodo ? `Período: ${med.periodo}` : ''].filter(Boolean).join(' — '),
        valorUnitario: String(l.valorUnitario ?? ''),
        total: String(l.total ?? ''),
      })),
      obs: '',
      medicaoId: med.id,
      medicaoNumero: med.numeroMedicao,
      createdAt: new Date().toISOString(),
    };
    await saveEntity('financeiro', [rec, ...fin]);
  };

  const handleStatus = async (medicao: any, status: 'aprovada' | 'recusada') => {
    if (status === 'recusada' && !window.confirm('Recusar esta medição?')) return;
    try {
      const atualizada = await atualizarStatusMedicao(medicao.id, status);
      await refreshMedicoes();
      toast.success(status === 'aprovada' ? 'Medição aprovada.' : 'Medição recusada.');
      if (status === 'aprovada') {
        const med = { ...medicao, ...(atualizada || {}) };
        abrirSolicitacaoNfe(med);
        await criarSolicitacaoRecibo(med); // além da NFe, solicita o recibo de locação
      }
    } catch (error) {
      console.error('Erro ao atualizar status da medição:', error);
      toast.error('Erro ao atualizar o status.');
    }
  };

  // "Fazer nova versão": pré-seleciona a OS da medição-base e guarda a base para "colar".
  const handleFazerNovaVersao = (med: any) => {
    const osDoMed = osAprovadas.find((o: any) => String(o.backendId) === String(med.ordemServicoBackendId));
    if (osDoMed) setOsSelecionadaId(String(osDoMed.id));
    setVersaoBase(med);
    setForm(formInicial());
    toast.info('Nova versão: use "Colar medição antiga" para puxar os dados.');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleColarMedicaoAntiga = () => {
    if (!versaoBase) return;
    setForm({
      dataEmissao: new Date().toISOString().split('T')[0],
      embarcacao: versaoBase.embarcacao || '',
      numeroBM: versaoBase.numeroBM || '',
      periodo: versaoBase.periodo || '',
      representanteCliente: versaoBase.representanteCliente || '',
      representanteLinave: versaoBase.representanteLinave || '',
      itens: (Array.isArray(versaoBase.itens) && versaoBase.itens.length
        ? versaoBase.itens.map((i: any) => ({ ...novaLinha(), ...i }))
        : [novaLinha()]),
    });
    toast.success('Dados da medição anterior colados. Ajuste o que precisar.');
  };

  // Anexa arquivos (documento do cliente ou NF já emitida) à solicitação de NFe.
  const handleUploadNfe = async (files: FileList | null, tipo: 'cliente' | 'nf') => {
    if (!files || !files.length || !nfePopup) return;
    const campo = tipo === 'cliente' ? 'docsCliente' : 'docsNf';
    try {
      const enviados: any[] = [];
      for (const file of Array.from(files)) {
        const doc = await uploadDocumento(file, { vinculoTipo: 'medicao', vinculoId: nfePopup.id, categoria: 'fin_anexo' });
        enviados.push(doc);
      }
      setNfeForm((f: any) => ({ ...f, [campo]: [...(f?.[campo] || []), ...enviados] }));
      toast.success('Documento anexado.');
    } catch (error) {
      console.error('Erro ao anexar documento:', error);
      toast.error('Falha ao anexar o documento.');
    }
  };

  // Solicitar NFe: cria a solicitação (nfeReq) que aparece na aba NFe do Financeiro.
  const handleSolicitarNfe = async () => {
    if (!nfePopup || !nfeForm) return;
    setSolicitandoNfe(true);
    try {
      const nfeReq = {
        id: genFinId('SNF'),
        tipo: 'nfeReq',
        status: 'Aguardando emissão',
        empresa: nfeForm.empresa,
        os: nfeForm.os,
        cliente: nfePopup.cliente,
        valor: parseDecimal(nfeForm.valor || 0),
        forma: nfeForm.forma,
        dataEmitir: nfeForm.dataEmitir,
        tipoNfe: nfeForm.tipoNfe,
        anexos: [...(nfeForm.docsCliente || []), ...(nfeForm.docsNf || [])].map((d: any) => d?.nome).filter(Boolean),
        documentosCliente: nfeForm.docsCliente || [],   // Item 5
        notasFiscaisEmitidas: nfeForm.docsNf || [],      // Item 7
        contrato: nfeForm.os,
        descricao: nfeForm.descricao,
        observacao: nfeForm.observacao,
        medicaoId: nfePopup.id,
        medicaoNumero: nfePopup.numeroMedicao,
        createdAt: new Date().toISOString(),
      };
      await saveEntity('financeiro', [nfeReq, ...(Array.isArray(financeiro) ? financeiro : [])]);
      toast.success('Solicitação de NFe enviada ao Financeiro (aba NFe).');
      setNfePopup(null);
      setNfeForm(null);
    } catch (error) {
      console.error('Erro ao solicitar NFe:', error);
      toast.error('Erro ao enviar a solicitação de NFe.');
    } finally {
      setSolicitandoNfe(false);
    }
  };

  const handleDownload = async (medicao: any) => {
    const obra = obrasById.get(`${medicao.obraId || ''}`) || obrasById.get(medicao.ordemServicoNumero) || {};
    const cli = (Array.isArray(clientes) ? clientes : []).find((c: any) => c.razaoSocial === medicao.cliente);
    // CNPJ da prestadora vem do cadastro de Empresas Prestadoras (config), nunca do cliente.
    const prestadora = (config?.empresasPrestadoras || []).find(
      (e: any) => String(e?.nome || '').toLowerCase() === String(medicao.empresa || '').toLowerCase(),
    );
    const documentoMediacaoForm = {
      empresa: medicao.empresa,
      cliente: medicao.cliente,
      empresaCnpj: prestadora?.cnpj || '',
      clienteCnpj: medicao.cnpj,
      dataEmissao: medicao.dataEmissao,
      embarcacao: medicao.embarcacao,
      numeroBM: medicao.numeroBM,
      periodo: medicao.periodo,
      representanteCliente: medicao.representanteCliente,
      representanteLinave: medicao.representanteLinave,
      tabelaItens: medicao.itens,
    };
    try {
      await handleDownloadMedicaoPDF(documentoMediacaoForm, cli || {}, { id: medicao.ordemServicoNumero });
    } catch {
      toast.error('Erro ao gerar o PDF da medição.');
    }
  };

  const osLabel = (o: any) => `${o.ordemServicoNumero || o.id} — ${o.cliente || ''}`.trim();

  // Histórico filtrado por OS (e busca).
  const historico = useMemo(() => {
    let lista = Array.isArray(medicoes) ? medicoes : [];
    if (filtroOsHistorico) lista = lista.filter((m: any) => String(m.ordemServicoBackendId) === String(filtroOsHistorico));
    const q = searchQuery.trim().toLowerCase();
    if (q) lista = lista.filter((m: any) =>
      `${m.ordemServicoNumero} ${m.cliente} ${m.numeroBM} ${m.periodo}`.toLowerCase().includes(q));
    return lista;
  }, [medicoes, filtroOsHistorico, searchQuery]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b border-white/5 pb-6">
        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><Ruler size={22} /></div>
        <div>
          <h1 className="text-3xl font-black text-white uppercase italic">Medição</h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Medição por OS · só aprovada libera finalização</p>
        </div>
      </div>

      {/* ===== NOVA MEDIÇÃO ===== */}
      <section className="bg-[#101f3d] rounded-[28px] border border-white/10 p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-emerald-300 font-black uppercase tracking-widest text-sm">
            Nova medição {versaoBase && <span className="text-violet-300 normal-case">(nova versão de {versaoBase.numeroMedicao})</span>}
          </h2>
          {versaoBase && (
            <button onClick={handleColarMedicaoAntiga} className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-xs font-black uppercase flex items-center gap-1">
              <Copy size={13} /> Colar medição antiga
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Ordem de Serviço (aprovada)</p>
            <select
              value={osSelecionadaId}
              onChange={(e) => setOsSelecionadaId(e.target.value)}
              className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm"
            >
              <option value="">Selecione a OS…</option>
              {osAprovadas.map((o: any) => (
                <option key={o.id} value={o.id}>{osLabel(o)}</option>
              ))}
            </select>
            {osAprovadas.length === 0 && (
              <p className="text-amber-300/70 text-xs mt-2">Nenhuma OS aprovada disponível para medição.</p>
            )}
          </div>

          {contexto && (
            <>
              <ReadField label="Empresa" value={contexto.empresa} />
              <ReadField label="Cliente" value={contexto.cliente} />
              <ReadField label="CNPJ" value={contexto.cnpj || '—'} />
              <Field label="Data de emissão" type="date" value={form.dataEmissao} onChange={(v) => setForm({ ...form, dataEmissao: v })} />
              <Field label="Embarcação" value={form.embarcacao} onChange={(v) => setForm({ ...form, embarcacao: v })} placeholder="Preencher" />
              <Field label="Nr. BM" value={form.numeroBM} onChange={(v) => setForm({ ...form, numeroBM: v })} placeholder="Ex.: 001" />
              <Field label="Período" value={form.periodo} onChange={(v) => setForm({ ...form, periodo: v })} className="md:col-span-2" />
              <Field label="Representante Cliente" value={form.representanteCliente} onChange={(v) => setForm({ ...form, representanteCliente: v })} />
              <Field label="Representante Linave" value={form.representanteLinave} onChange={(v) => setForm({ ...form, representanteLinave: v })} />
            </>
          )}
        </div>

        {contexto && (
          <div className="bg-[#0b1220] rounded-xl border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-emerald-300 text-sm font-black uppercase">Tabela de medição (serviços e locação)</h3>
              <div className="flex gap-2">
                <button onClick={preencherItensDaOS} className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-black uppercase">Puxar itens da OS</button>
              </div>
            </div>
            {renderTabelaMedicao('servico', 'Serviços', true)}
            {renderTabelaMedicao('locacao', 'Locação', false)}
            <div className="flex items-center justify-between pt-2">
              <p className="text-white/50 text-xs uppercase font-black tracking-widest">Total da medição: <span className="text-emerald-300 text-lg">R$ {money(totalMedicao)}</span></p>
              <button onClick={handleSalvar} disabled={salvando} className="px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black uppercase text-xs tracking-widest disabled:opacity-50 flex items-center gap-2">
                <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar Medição'}
              </button>
            </div>
          </div>
        )}

        {osSelecionada && (
          <div className="bg-[#0b1220] rounded-2xl border border-red-500/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-red-300 font-black uppercase tracking-widest text-xs flex items-center gap-2"><Lock size={14} /> Fechamento da OS</p>
              <p className="text-white/50 text-xs mt-1">
                Depois de todas as medições, feche a OS. Ela <strong className="text-white/70">some das telas de uso</strong> (estoque, compras, adicionar/alocar por OS) e fica só finalizada.
              </p>
              {!temMedicaoAprovada(osSelecionada.backendId) && (
                <p className="text-amber-300/80 text-[11px] mt-1.5">É necessária ao menos uma medição <strong>aprovada</strong> para fechar a OS.</p>
              )}
            </div>
            <button
              onClick={() => abrirBloqueio(osSelecionada, 'fechar')}
              disabled={!temMedicaoAprovada(osSelecionada.backendId)}
              className="shrink-0 px-5 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Lock size={16} /> Fechar / Bloquear OS
            </button>
          </div>
        )}
      </section>

      {/* ===== HISTÓRICO ===== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Clock size={16} /> Histórico de Medições</h2>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-white/40" />
            <select value={filtroOsHistorico} onChange={(e) => setFiltroOsHistorico(e.target.value)} className="bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              <option value="">Todas as OS</option>
              {osAprovadas.map((o: any) => (
                <option key={o.id} value={o.backendId}>{o.ordemServicoNumero || o.id}</option>
              ))}
            </select>
          </div>
        </div>

        {historico.length === 0 ? (
          <p className="text-white/40 text-sm bg-[#101f3d] rounded-2xl border border-white/5 p-6">Nenhuma medição encontrada.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {historico.map((m: any) => (
              <div key={m.id} className="bg-[#101f3d] rounded-2xl border border-white/10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-black">{m.numeroMedicao || m.ordemServicoNumero}</p>
                    <p className="text-white/40 text-xs">{m.ordemServicoNumero} · BM {m.numeroBM || '—'} · {m.cliente}</p>
                    <p className="text-white/30 text-[11px]">{m.periodo || 'sem período'}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${STATUS_BADGE[m.status] || STATUS_BADGE.pendente}`}>{m.status}</span>
                </div>
                <p className="text-emerald-300 font-black text-lg mb-4">R$ {money(m.valorTotal)}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleDownload(m)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-bold flex items-center gap-1"><Download size={13} /> Documento</button>
                  <button onClick={() => handleFazerNovaVersao(m)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-bold flex items-center gap-1"><FilePlus size={13} /> Nova versão</button>
                  {m.status === 'pendente' && (
                    <>
                      <button onClick={() => handleStatus(m, 'aprovada')} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1"><Check size={13} /> Aprovar</button>
                      <button onClick={() => handleStatus(m, 'recusada')} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1"><Ban size={13} /> Recusar</button>
                    </>
                  )}
                  {m.status === 'aprovada' && (
                    <>
                      <button onClick={() => abrirSolicitacaoNfe(m)} className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1"><Send size={13} /> Solicitar NFe</button>
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1"><CheckCircle2 size={13} /> Libera finalização</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== OS FECHADAS (BLOQUEADAS) ===== */}
      {osFechadas.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Lock size={16} className="text-red-300" /> OS Fechadas <span className="text-white/30 normal-case font-semibold">— bloqueadas para uso no sistema</span></h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {osFechadas.map((o: any) => (
              <div key={o.id} className="bg-[#101f3d] rounded-2xl border border-red-500/20 p-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-black truncate">{o.ordemServicoNumero || o.id}</p>
                  <p className="text-white/40 text-xs truncate">{o.cliente || '—'}{o.projeto ? ` · ${o.projeto}` : ''}</p>
                  <p className="text-red-300/70 text-[11px] mt-0.5">Fechada{o.dataFechamento ? ` em ${formatDateBR(o.dataFechamento)}` : ''}</p>
                </div>
                <button
                  onClick={() => abrirBloqueio(o, 'reabrir')}
                  className="shrink-0 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 text-xs font-black uppercase tracking-widest flex items-center gap-1.5"
                  title="Ação restrita à diretoria"
                >
                  <Unlock size={13} /> Reabrir
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL: fechar / reabrir OS */}
      {bloqueioModal.open && (
        <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0b1220] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <div className={`p-6 border-b border-white/10 flex items-start gap-4 ${bloqueioModal.mode === 'fechar' ? 'bg-gradient-to-r from-red-600/30 to-orange-500/20' : 'bg-gradient-to-r from-amber-600/30 to-yellow-500/20'}`}>
              <div className={`p-3 rounded-2xl shrink-0 ${bloqueioModal.mode === 'fechar' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {bloqueioModal.mode === 'fechar' ? <Lock size={24} /> : <ShieldAlert size={24} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-black text-xl uppercase tracking-wide">{bloqueioModal.mode === 'fechar' ? 'Fechar OS' : 'Reabrir OS'}</h3>
                <p className="text-white/60 text-sm mt-1 truncate">{bloqueioModal.os?.ordemServicoNumero || bloqueioModal.os?.id}</p>
              </div>
              <button onClick={fecharBloqueioModal} disabled={bloqueando} className="ml-auto p-2 rounded-full hover:bg-white/10 text-white/60 disabled:opacity-40"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              {bloqueioModal.mode === 'fechar' ? (
                <p className="text-white/70 text-sm leading-relaxed">
                  A OS será <strong className="text-white">fechada e bloqueada</strong>: vai sumir das telas de estoque, compras, adicionar/alocar por OS e produção. Ela passa a constar apenas como <strong className="text-white">finalizada</strong>. Confirmar?
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <ShieldAlert size={16} className="text-amber-300 mt-0.5 shrink-0" />
                    <p className="text-amber-200/90 text-xs leading-relaxed">Ação restrita à <strong>diretoria</strong>. Reabrir volta a OS para uso no sistema (estoque/compras/alocação).</p>
                  </div>
                  <p className="text-white/70 text-sm">Confirmar reabertura desta OS?</p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={fecharBloqueioModal} disabled={bloqueando} className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-black uppercase text-xs tracking-widest disabled:opacity-40">Cancelar</button>
                <button
                  onClick={confirmarBloqueio}
                  disabled={bloqueando}
                  className={`px-5 py-2.5 rounded-lg text-white font-black uppercase text-xs tracking-widest disabled:opacity-40 flex items-center gap-2 ${bloqueioModal.mode === 'fechar' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  {bloqueioModal.mode === 'fechar' ? <Lock size={14} /> : <Unlock size={14} />}
                  {bloqueando ? 'Processando…' : (bloqueioModal.mode === 'fechar' ? 'Fechar OS' : 'Reabrir OS')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: Medição aprovada → Solicitação de NFe */}
      {nfePopup && nfeForm && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#0b1220] rounded-2xl border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-500/30 to-amber-500/30 backdrop-blur-md p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-white">Medição aprovada → Solicitação de NFe</h2>
                <p className="text-white/50 text-xs mt-1">Cria solicitação com data para emitir.</p>
              </div>
              <button onClick={() => { setNfePopup(null); setNfeForm(null); }} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={20} className="text-white/60" /></button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-red-300 text-xs">
                Não emite a nota ainda. A solicitação aparecerá na aba NFe.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NfeField label="Empresa">
                  <select value={nfeForm.empresa} onChange={(e) => setNfeForm({ ...nfeForm, empresa: e.target.value })} className={nfeInputCls}>
                    {empresasDisponiveis.map((e: string) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </NfeField>
                <NfeField label="OS emitida (puxada da medição)">
                  <input value={nfeForm.os} readOnly className={`${nfeInputCls} opacity-70 cursor-not-allowed`} title="Puxada automaticamente da medição" />
                </NfeField>
                <NfeField label="Valor NFe">
                  <input type="number" step="0.01" value={nfeForm.valor} onChange={(e) => setNfeForm({ ...nfeForm, valor: e.target.value })} className={nfeInputCls} />
                </NfeField>
                <NfeField label="Data para emitir NFe">
                  <input type="date" value={nfeForm.dataEmitir} onChange={(e) => setNfeForm({ ...nfeForm, dataEmitir: e.target.value })} className={nfeInputCls} />
                </NfeField>
                <NfeField label="Forma pagamento/recebimento">
                  <select value={nfeForm.forma} onChange={(e) => setNfeForm({ ...nfeForm, forma: e.target.value })} className={nfeInputCls}>
                    <option value="">Selecione...</option>
                    {FORMAS_PAGAMENTO.map((f: string) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </NfeField>
                <NfeField label="Tipo NFe">
                  <select value={nfeForm.tipoNfe} onChange={(e) => setNfeForm({ ...nfeForm, tipoNfe: e.target.value })} className={nfeInputCls}>
                    {TIPOS_NFE.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </NfeField>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#101f3d] rounded-xl border border-white/10 p-4">
                <Resumo label="OS" value={nfePopup.ordemServicoNumero} />
                <Resumo label="Empresa" value={nfeForm.empresa} />
                <Resumo label="Cliente" value={nfePopup.cliente} />
                <Resumo label="Valor (só serviço)" value={`R$ ${money(nfeForm.valor)}`} accent />
              </div>
              {nfeForm.descricao && (
                <p className="text-white/60 text-sm"><span className="text-white/30 uppercase text-[10px] font-black tracking-widest">Descrição: </span>{nfeForm.descricao}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NfeField label="Documento do cliente (fiscal)">
                  <label className="flex items-center gap-2 border border-dashed border-white/15 rounded-lg p-3 text-white/50 text-xs cursor-pointer hover:border-emerald-400/40">
                    <FileText size={14} /> Anexar documento(s)
                    <input type="file" multiple className="hidden" onChange={(e) => handleUploadNfe(e.target.files, 'cliente')} />
                  </label>
                  {(nfeForm.docsCliente || []).map((d: any, i: number) => (
                    <p key={d.id || i} className="text-emerald-300/80 text-[11px] truncate mt-1">✓ {d.nome}</p>
                  ))}
                </NfeField>
                <NfeField label="NF já emitida (opcional)">
                  <label className="flex items-center gap-2 border border-dashed border-white/15 rounded-lg p-3 text-white/50 text-xs cursor-pointer hover:border-amber-400/40">
                    <FileText size={14} /> Anexar NF emitida
                    <input type="file" multiple className="hidden" onChange={(e) => handleUploadNfe(e.target.files, 'nf')} />
                  </label>
                  {(nfeForm.docsNf || []).map((d: any, i: number) => (
                    <p key={d.id || i} className="text-amber-300/80 text-[11px] truncate mt-1">✓ {d.nome}</p>
                  ))}
                </NfeField>
              </div>

              <NfeField label="Observação">
                <textarea value={nfeForm.observacao} onChange={(e) => setNfeForm({ ...nfeForm, observacao: e.target.value })} rows={3} className={`${nfeInputCls} resize-none`} />
              </NfeField>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <button onClick={() => { setNfePopup(null); setNfeForm(null); }} className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black uppercase">Agora não</button>
                <button onClick={handleSolicitarNfe} disabled={solicitandoNfe} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-[#0b1220] text-xs font-black uppercase flex items-center gap-2 disabled:opacity-50">
                  <Send size={15} /> {solicitandoNfe ? 'Enviando…' : 'Solicitar NFe'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NfeField({ label, children }: any) {
  return (
    <div>
      <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">{label}</p>
      {children}
    </div>
  );
}

function Resumo({ label, value, accent }: any) {
  return (
    <div>
      <p className="text-white/30 text-[10px] uppercase tracking-widest mb-0.5 font-black">{label}</p>
      <p className={`font-bold text-sm ${accent ? 'text-emerald-300' : 'text-white'}`}>{value || '—'}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', className = '' }: any) {
  return (
    <div className={className}>
      <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">{label}</p>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30" />
    </div>
  );
}

function ReadField({ label, value }: any) {
  return (
    <div>
      <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">{label}</p>
      <input value={value} readOnly className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-sm" />
    </div>
  );
}
