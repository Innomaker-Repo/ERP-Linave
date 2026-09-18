import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Download, Save, Banknote, Split, Paperclip, CalendarClock, Repeat, AlertTriangle, Power, Files, RefreshCw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, TypeTag, Pill, EmptyRow,
  FinModal, Field, Input, MoneyInput, Select, Textarea, Kpi, DeleteBtn, labelCls, boldOS, FileInput,
} from '../finUi';
import {
  br, money, num, todayStr, genFinId, days, FORMAS_PAGAMENTO, TIPOS_REEMBOLSO,
  NATUREZAS_CONTA_PAGAR, CP_STATUS, documentoDuplicado, bancoLabel,
  PERIODICIDADES, CATEGORIAS_CONTA_FIXA, avisosContasFixas, contaVencida, contaPaga,
  diasAteVencimento, type AvisoContaFixa,
} from '../finData';
import { useFin, type FinRecord } from '../useFin';
import { useFinFilters } from '../finFilters';
import { uploadDocumento, listarDocumentos, excluirDocumento } from '../../../../../services/documentosService';
import { confirmDialog, promptDialog } from '../../../ui/feedback';
import { toast } from 'sonner';

// Deriva um nome de arquivo amigável a partir da URL salva (`anexos`/`comprovantes` guardam
// só a URL, sem metadado de nome) — é só o basename decodificado, mas já é o suficiente pra
// diferenciar "boleto.pdf" de "nf_entrada.pdf" na hora de listar os documentos anexados.
const nomeDoArquivo = (url: string): string => {
  try {
    const semQuery = url.split('?')[0];
    const base = semQuery.split('/').pop() || url;
    return decodeURIComponent(base);
  } catch {
    return url;
  }
};

export function ContasPagarView() {
  const {
    records, financeiro, empresas, oss, departamentos, addRecord, updateRecord, deleteRecord,
    contarDependentes, parcelarConta, pagarConta,
    sincronizarContasFixas, salvarContaFixa, excluirContaFixa, ocorrenciasFuturasDaFixa,
  } = useFin();
  const { match } = useFinFilters();
  const allContasPagar = records('contaPagar');
  const contasFixas = records('contaFixa');
  const bancos = records('banco').filter((b) => b.nome) as Array<{ id: string; nome: string; empresa?: string }>;
  const [salvando, setSalvando] = useState(false);

  // ---- Contas fixas: gera as ocorrências que faltam ao abrir a tela ----
  // Roda uma vez por entrada na tela. `sincronizarContasFixas` só escreve quando há
  // ocorrência nova, então reentrar na tela não gera tráfego nem duplica conta.
  const jaSincronizou = useRef(false);
  const [avisos, setAvisos] = useState<AvisoContaFixa[]>([]);
  const [mostrarAvisos, setMostrarAvisos] = useState(false);

  useEffect(() => {
    if (jaSincronizou.current) return;
    jaSincronizou.current = true;
    (async () => {
      try {
        const geradas = await sincronizarContasFixas();
        if (geradas > 0) toast.info(`${geradas} conta(s) fixa(s) lançada(s) para o próximo vencimento.`);
      } catch (erro) {
        console.error('Falha ao gerar ocorrências de contas fixas:', erro);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O aviso é recalculado a partir do estado já sincronizado. Abre uma vez por entrada
  // na tela — é o comportamento pedido: toda vez que o usuário entrar, ele é lembrado.
  const jaAvisou = useRef(false);
  useEffect(() => {
    if (jaAvisou.current) return;
    const pendentes = avisosContasFixas(financeiro);
    if (pendentes.length === 0) return;
    jaAvisou.current = true;
    setAvisos(pendentes);
    setMostrarAvisos(true);
  }, [financeiro]);

  // Filtro local por status (Aberto S/Documento, C/Documento, Parcelado, Pago...).
  const [statusFiltro, setStatusFiltro] = useState('Todos');
  const statusDisponiveis = useMemo(
    () => Array.from(new Set(allContasPagar.map((r) => String(r.status || 'Aberto')))).sort(),
    [allContasPagar],
  );
  // Filtro local por origem. As contas fixas ficam MISTURADAS com as normais de propósito
  // (são contas a pagar como qualquer outra, entram nos mesmos totais e no mesmo CSV);
  // este filtro serve para isolar só as recorrentes quando o financeiro quiser conferi-las.
  const [origemFiltro, setOrigemFiltro] = useState<'Todas' | 'Fixas' | 'Normais'>('Todas');

  const rows = allContasPagar
    .filter(match)
    .filter((r) => statusFiltro === 'Todos' || String(r.status || 'Aberto') === statusFiltro)
    .filter((r) => {
      if (origemFiltro === 'Fixas') return Boolean(r.contaFixaId);
      if (origemFiltro === 'Normais') return !r.contaFixaId;
      return true;
    })
    // Vencimento mais próximo primeiro (ordem crescente). `vencimento` é sempre ISO
    // YYYY-MM-DD, então dá pra comparar como string direto. Conta sem vencimento (ainda
    // sem documento) não tem data pra ordenar — fica por último, não no topo.
    .sort((a, b) => {
      const va = String(a.vencimento || '');
      const vb = String(b.vencimento || '');
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      return va < vb ? -1 : va > vb ? 1 : 0;
    });

  const totalFixasNaTela = useMemo(
    () => allContasPagar.filter(match).filter((r) => r.contaFixaId).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allContasPagar],
  );

  // ---- Modal criar/editar ----
  const formVazio = () => ({
    empresa: empresas[0] || 'Linave', vinculoTipo: 'OS' as 'OS' | 'Departamento', vinculoValor: '',
    fornecedor: '', tipoPagamento: 'Material', natureza: '', documento: '', valor: '', vencimento: todayStr, banco: '', forma: '', obs: '',
  });
  const [editId, setEditId] = useState<string | null | undefined>(undefined); // undefined=fechado, null=novo
  const [form, setForm] = useState(formVazio());
  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  // Documentos já salvos na conta (URLs) + arquivos novos ainda não enviados (File[]). O
  // upload de verdade só acontece no submit — mantém tudo (existentes + novos) em vez de
  // sobrescrever, que era o bug: anexar um documento novo apagava o boleto que já estava lá.
  const [anexosExistentes, setAnexosExistentes] = useState<string[]>([]);
  const [novosAnexos, setNovosAnexos] = useState<File[]>([]);

  const abrirNovo = () => { setForm(formVazio()); setAnexosExistentes([]); setNovosAnexos([]); setEditId(null); };
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
      // Conta de compra chega sem vencimento; só é preenchido quando a NF é anexada.
      vencimento: p.vencimento || '',
      banco: p.banco || '',
      forma: p.forma || '',
      obs: p.obs || '',
    });
    setAnexosExistentes(Array.isArray(p.anexos) ? p.anexos : []);
    setNovosAnexos([]);
    setEditId(p.id);
  };

  // Regra: editar ou excluir uma conta sem nº de boleto/NF pede o número na hora — só
  // segue (e persiste na conta) se o usuário informar; cancelar aborta a ação em silêncio.
  const garantirDocumento = async (p: FinRecord): Promise<string | null> => {
    const docAtual = String(p.documento || '').trim();
    if (docAtual) return docAtual;
    const digitado = await promptDialog({
      title: 'Nº do boleto/Nota Fiscal obrigatório',
      message: 'Esta conta ainda não tem nº de boleto/Nota Fiscal. Informe antes de continuar.',
      placeholder: 'Nº do boleto/NF',
      confirmText: 'Confirmar',
    });
    const doc = (digitado || '').trim();
    if (!doc) {
      toast.error('É obrigatório informar o nº do boleto/Nota Fiscal.');
      return null;
    }
    const st = String(p.status || '');
    const patch: Record<string, any> = { documento: doc };
    if (st !== CP_STATUS.pago && st !== CP_STATUS.parcelado) patch.status = CP_STATUS.comDoc;
    await updateRecord(p.id, patch);
    return doc;
  };

  const salvarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fornecedor.trim() || !num(form.valor)) return;

    const editingRec = editId ? allContasPagar.find((r) => r.id === editId) : null;
    const doc = form.documento.trim();

    // Ao anexar documento(s) é obrigatório informar número e vencimento (quando a conta ganha documento).
    if (novosAnexos.length > 0 && (!doc || !form.vencimento)) {
      toast.error('Ao anexar documentos, informe o número e o vencimento.');
      return;
    }
    // Duplicidade: o mesmo número de documento não pode se repetir para o MESMO fornecedor.
    if (documentoDuplicado(allContasPagar, {
      fornecedor: form.fornecedor,
      documento: doc,
      selfId: editId || null,
      parentId: (editingRec?.parentId as string | null) || null,
    })) {
      toast.error(`Já existe uma conta com o documento "${doc}" para o fornecedor ${form.fornecedor.trim()}.`);
      return;
    }

    setSalvando(true);
    try {
      // Sobe só os arquivos NOVOS agora que já se tem o id (na criação, um id novo) pra
      // vincular — e junta com os que já estavam salvos (nunca substitui, só adiciona/remove
      // pelo botão de remover no formulário).
      const idAlvo = editId || genFinId('CP');
      let anexos = anexosExistentes;
      if (novosAnexos.length > 0) {
        const resultados = await Promise.allSettled(
          novosAnexos.map((file) => uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: idAlvo, categoria: 'fin_documento' })),
        );
        const novasUrls = resultados
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value.url);
        const falhas = resultados.length - novasUrls.length;
        if (falhas > 0) toast.error(`${falhas} documento(s) não puderam ser enviados.`);
        anexos = [...anexosExistentes, ...novasUrls];
      }

      const base: Record<string, any> = {
        empresa: form.empresa, vinculoTipo: form.vinculoTipo, vinculoValor: form.vinculoValor,
        fornecedor: form.fornecedor, tipoPagamento: form.tipoPagamento, natureza: form.natureza, documento: doc,
        valor: num(form.valor), vencimento: form.vencimento, banco: form.banco, forma: form.forma, obs: form.obs,
        anexos,
      };
      if (editId) {
        // Transição de status: anexar documento(s) (ou informar o nº) leva "Aberto S/Documento"
        // → "Aberto C/Documento". Nunca rebaixa contas já Pagas/Parceladas.
        const st = String(editingRec?.status || '');
        if (st !== CP_STATUS.pago && st !== CP_STATUS.parcelado) {
          const temNf = anexos.length > 0 || !!doc;
          base.status = temNf ? CP_STATUS.comDoc : (st || CP_STATUS.aberto);
        }
        await updateRecord(editId, base);
      } else {
        await addRecord({ id: idAlvo, tipo: 'contaPagar', type: 'single', parentId: null, parcela: '-', status: CP_STATUS.aberto, valorPago: 0, jurosPago: 0, comprovantes: [], ...base });
      }
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

  // ---- Modal contas fixas (regras de recorrência) ----
  const fixaVazia = () => ({
    descricao: '', categoria: 'Luz', empresa: empresas[0] || 'Linave', fornecedor: '',
    natureza: 'Despesas Administrativa', valor: '', periodicidade: 'mensal' as string,
    diaVencimento: '10', inicio: todayStr, fim: '', forma: '', banco: '',
    antecedenciaAviso: '5', departamento: '', obs: '',
  });
  const [gerenciandoFixas, setGerenciandoFixas] = useState(false);
  const [fixaEditId, setFixaEditId] = useState<string | null | undefined>(undefined); // undefined=fechado, null=nova
  const [fixa, setFixa] = useState(fixaVazia());
  const setFixaF = (k: string, v: string) => setFixa((p) => ({ ...p, [k]: v }));

  // Antecedência em dias já normalizada, para compor o rótulo do campo e a explicação.
  const diasAviso = Math.max(0, Number(fixa.antecedenciaAviso) || 0);

  const abrirNovaFixa = () => { setFixa(fixaVazia()); setFixaEditId(null); };
  const abrirEdicaoFixa = (r: FinRecord) => {
    setFixa({
      descricao: r.descricao || '', categoria: r.categoria || 'Luz',
      empresa: String(r.empresa || empresas[0] || 'Linave'), fornecedor: r.fornecedor || '',
      natureza: r.natureza || 'Despesas Administrativa', valor: String(r.valor || ''),
      periodicidade: r.periodicidade || 'mensal', diaVencimento: String(r.diaVencimento || '10'),
      inicio: r.inicio || todayStr, fim: r.fim || '', forma: r.forma || '', banco: r.banco || '',
      antecedenciaAviso: String(r.antecedenciaAviso ?? 5), departamento: r.departamento || '', obs: r.obs || '',
    });
    setFixaEditId(r.id);
  };

  const salvarFixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixa.descricao.trim() || !num(fixa.valor)) {
      toast.error('Informe a descrição e o valor da conta fixa.');
      return;
    }
    setSalvando(true);
    try {
      await salvarContaFixa({
        id: fixaEditId || genFinId('CF'),
        tipo: 'contaFixa',
        descricao: fixa.descricao.trim(),
        categoria: fixa.categoria,
        empresa: fixa.empresa,
        fornecedor: fixa.fornecedor.trim() || fixa.descricao.trim(),
        natureza: fixa.natureza,
        valor: num(fixa.valor),
        periodicidade: fixa.periodicidade,
        diaVencimento: Number(fixa.diaVencimento) || 1,
        inicio: fixa.inicio || todayStr,
        fim: fixa.fim || '',
        forma: fixa.forma,
        banco: fixa.banco,
        antecedenciaAviso: Number(fixa.antecedenciaAviso) || 5,
        departamento: fixa.departamento,
        obs: fixa.obs,
        ativa: true,
      });
      setFixaEditId(undefined);
      // Já lança a próxima ocorrência, para a conta aparecer na lista sem recarregar.
      const geradas = await sincronizarContasFixas();
      toast.success(geradas > 0 ? `Conta fixa salva e ${geradas} vencimento(s) lançado(s).` : 'Conta fixa salva.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtiva = async (r: FinRecord) => {
    await salvarContaFixa({ ...r, ativa: r.ativa === false });
    toast.success(r.ativa === false ? 'Conta fixa reativada.' : 'Conta fixa pausada — não gera novos vencimentos.');
  };

  // ---- Modal pagar ----
  const [pagando, setPagando] = useState<FinRecord | null>(null);
  const [pay, setPay] = useState({ dataPagamento: todayStr, valorPago: '', banco: '', houveJuros: 'Não', jurosPago: '', motivoJuros: '' });
  const setPayF = (k: string, v: string) => setPay((p) => ({ ...p, [k]: v }));
  // Comprovantes já salvos na conta (de um pagamento parcial/correção anterior) + arquivos
  // novos ainda não enviados — mesmo padrão de anexosExistentes/novosAnexos acima: o upload
  // some no submit, e novos comprovantes se somam aos que já existiam, nunca substituem.
  const [comprovantesExistentes, setComprovantesExistentes] = useState<string[]>([]);
  const [novosComprovantes, setNovosComprovantes] = useState<File[]>([]);

  const abrirPagamento = (p: FinRecord) => {
    setPagando(p);
    setPay({ dataPagamento: todayStr, valorPago: String(p.valorPago || p.valor || ''), banco: p.banco || '', houveJuros: 'Não', jurosPago: '', motivoJuros: '' });
    setComprovantesExistentes(Array.isArray(p.comprovantes) ? p.comprovantes : []);
    setNovosComprovantes([]);
  };

  // ---- Excluir/substituir um documento JÁ SALVO (edição, não a criação em lote acima) ----
  // Ação imediata (não espera o "Salvar" do formulário): exclui de verdade o arquivo no
  // backend (não só a referência) e já grava a lista atualizada na conta, pra não deixar a
  // conta apontando pra um documento removido caso o usuário feche o modal sem salvar mais
  // nada. `processandoDoc` guarda a URL em andamento, só pra desabilitar o botão dela.
  const [processandoDoc, setProcessandoDoc] = useState<string | null>(null);

  const excluirDocumentoDaConta = async (contaId: string, url: string, campo: 'anexos' | 'comprovantes') => {
    const ok = await confirmDialog({
      title: 'Excluir documento',
      message: `Excluir "${nomeDoArquivo(url)}"? O arquivo é removido definitivamente.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    setProcessandoDoc(url);
    try {
      const categoria = campo === 'anexos' ? 'fin_documento' : 'fin_comprovante';
      const docs = await listarDocumentos({ vinculoTipo: 'financeiro', vinculoId: contaId, categoria });
      const alvo = docs.find((d) => d.url === url);
      if (alvo) await excluirDocumento(alvo.backendId);
      const atual = allContasPagar.find((r) => r.id === contaId);
      const novaLista = (Array.isArray(atual?.[campo]) ? (atual as any)[campo] : []).filter((u: string) => u !== url);
      await updateRecord(contaId, { [campo]: novaLista });
      if (campo === 'anexos') setAnexosExistentes((prev) => prev.filter((u) => u !== url));
      else setComprovantesExistentes((prev) => prev.filter((u) => u !== url));
      toast.success('Documento excluído.');
    } catch {
      toast.error('Não foi possível excluir o documento.');
    } finally {
      setProcessandoDoc(null);
    }
  };

  const substituirDocumentoDaConta = async (contaId: string, urlAntiga: string, campo: 'anexos' | 'comprovantes', file: File | undefined) => {
    if (!file) return;
    setProcessandoDoc(urlAntiga);
    try {
      const categoria = campo === 'anexos' ? 'fin_documento' : 'fin_comprovante';
      const novoDoc = await uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: contaId, categoria });
      const docs = await listarDocumentos({ vinculoTipo: 'financeiro', vinculoId: contaId, categoria });
      const antigo = docs.find((d) => d.url === urlAntiga && d.backendId !== novoDoc.backendId);
      if (antigo) await excluirDocumento(antigo.backendId).catch(() => {});
      const atual = allContasPagar.find((r) => r.id === contaId);
      const novaLista = (Array.isArray(atual?.[campo]) ? (atual as any)[campo] : []).map((u: string) => (u === urlAntiga ? novoDoc.url : u));
      await updateRecord(contaId, { [campo]: novaLista });
      if (campo === 'anexos') setAnexosExistentes((prev) => prev.map((u) => (u === urlAntiga ? novoDoc.url : u)));
      else setComprovantesExistentes((prev) => prev.map((u) => (u === urlAntiga ? novoDoc.url : u)));
      toast.success('Documento substituído.');
    } catch {
      toast.error('Não foi possível substituir o documento.');
    } finally {
      setProcessandoDoc(null);
    }
  };

  // ---- Modal ver documentos (anexos + comprovantes juntos, só consulta) ----
  const [verDocumentos, setVerDocumentos] = useState<FinRecord | null>(null);

  const exportarExcel = () => {
    const head = ['Tipo', 'ID', 'Parcela', 'Empresa', 'Vínculo', 'Natureza', 'Fornecedor', 'Documento', 'Valor', 'Vencimento', 'Banco', 'Status', 'Pago em', 'Valor pago', 'Juros', 'Comprovantes'];
    const linhas = rows.map((p) => [
      p.type || 'single', p.id, p.parcela || '-', p.empresa, `${p.vinculoTipo}: ${p.vinculoValor || ''}`, p.natureza || '',
      p.fornecedor, p.documento || '', num(p.valor), p.vencimento, p.banco || '', p.status || 'Aberto',
      p.dataPagamento || '', num(p.valorPago), num(p.jurosPago), (p.comprovantes || []).join('|'),
    ]);
    // Resumo (totais) na última linha da planilha.
    const totValor = rows.reduce((s, p) => s + num(p.valor), 0);
    const totPago = rows.reduce((s, p) => s + num(p.valorPago), 0);
    const totJuros = rows.reduce((s, p) => s + num(p.jurosPago), 0);
    linhas.push(['TOTAL', '', '', '', '', '', '', '', totValor, '', '', '', '', totPago, totJuros, '']);

    const planilha = XLSX.utils.aoa_to_sheet([head, ...linhas]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, planilha, 'Contas a Pagar');
    XLSX.writeFile(workbook, 'contas_a_pagar.xlsx');
  };

  const confirmarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagando || !pay.banco) return; // só o banco é obrigatório; comprovante é opcional
    setSalvando(true);
    try {
      const houveJuros = pay.houveJuros === 'Sim';
      let comprovantes = comprovantesExistentes;
      if (novosComprovantes.length > 0) {
        const resultados = await Promise.allSettled(
          novosComprovantes.map((file) => uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: pagando.id, categoria: 'fin_comprovante' })),
        );
        const novasUrls = resultados
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value.url);
        const falhas = resultados.length - novasUrls.length;
        if (falhas > 0) toast.error(`${falhas} comprovante(s) não puderam ser enviados.`);
        comprovantes = [...comprovantesExistentes, ...novasUrls];
      }
      const proxima = await pagarConta(pagando.id, {
        dataPagamento: pay.dataPagamento,
        valorPago: num(pay.valorPago),
        banco: pay.banco,
        houveJuros,
        jurosPago: houveJuros ? num(pay.jurosPago) : 0,
        motivoJuros: houveJuros ? pay.motivoJuros : '',
        comprovantes,
      });
      // Conta fixa: o pagamento encadeia a próxima competência. Avisar deixa explícito
      // que a conta "voltou" na lista de propósito, e para quando.
      if (proxima) {
        toast.success(`Pagamento registrado. Próxima conta fixa criada para ${br(proxima.vencimento)}.`);
      }
      setPagando(null);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinCard>
      <Toolbar
        title="Contas a Pagar"
        hint="Adicionar, editar, parcelar (mãe/filhas) e pagar com banco e juros (comprovante opcional)."
        actions={<>
          <label className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Status</span>
            <div className="w-48">
              <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
                <option value="Todos">Todos</option>
                {statusDisponiveis.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Tipo</span>
            <div className="w-48">
              <Select value={origemFiltro} onChange={(e) => setOrigemFiltro(e.target.value as typeof origemFiltro)}>
                <option value="Todas">Todas as contas</option>
                <option value="Fixas">Somente fixas{totalFixasNaTela ? ` (${totalFixasNaTela})` : ''}</option>
                <option value="Normais">Somente normais</option>
              </Select>
            </div>
          </label>
          <Btn variant="amber" onClick={abrirNovo}><Plus size={15} /> Conta a pagar</Btn>
          <Btn variant="blue" onClick={() => setGerenciandoFixas(true)}>
            <Repeat size={15} /> Contas fixas{contasFixas.length ? ` (${contasFixas.length})` : ''}
          </Btn>
          <Btn variant="secondary" onClick={exportarExcel}><Download size={15} /> Exportar Excel</Btn>
        </>}
      />
      <DataTable
        minWidth={1650}
        head={<>
          <Th>Tipo</Th><Th>Parcela</Th><Th>Empresa</Th><Th>Vínculo</Th><Th>Natureza</Th>
          <Th>Fornecedor</Th><Th>Doc</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Banco</Th>
          <Th>Status</Th><Th>Pago em</Th><Th>Juros</Th><Th>Comprov.</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow
            cols={15}
            text={
              origemFiltro === 'Fixas'
                ? 'Nenhuma conta fixa no período (cadastre uma regra em "Contas fixas")'
                : origemFiltro === 'Normais'
                  ? 'Nenhuma conta normal no período'
                  : 'Nenhuma conta a pagar (aprove uma solicitação ou adicione manualmente)'
            }
          />
        ) : rows.map((p) => {
          // Cor da linha, na ordem de prioridade: paga (verde) → vencida (vermelho) →
          // tom de mãe/filha do parcelamento. Vale para toda conta a pagar, mas é nas
          // fixas que ela mais importa: é o sinal de que a luz/água já passou do prazo.
          const paga = contaPaga(p);
          const vencida = contaVencida(p);
          const corLinha = paga
            ? 'bg-emerald-500/[0.07]'
            : vencida
              ? 'bg-rose-500/[0.09]'
              : p.type === 'parent' ? 'bg-violet-500/[0.05]' : p.type === 'child' ? 'bg-sky-500/[0.04]' : '';
          return (
          <tr key={p.id} className={`transition-colors hover:bg-white/5 ${corLinha}`}>
            <Td>
              <div className="flex items-center gap-2">
                <TypeTag type={p.type || 'single'} />
                {p.contaFixaId && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-sky-200" title={`Conta fixa ${p.contaFixaPeriodicidade || ''} — ${p.contaFixaDescricao || ''}`}>
                    <Repeat size={10} /> Fixa
                  </span>
                )}
              </div>
            </Td>
            <Td>{p.parcela || '-'}</Td>
            <Td><CompanyTag empresa={String(p.empresa)} /></Td>
            <Td className="text-white/60">{boldOS(p.vinculoTipo)}: {p.vinculoValor || '-'}</Td>
            <Td className="text-white/60">{p.natureza || '—'}</Td>
            <Td className="text-white">{p.fornecedor}</Td>
            <Td>{p.documento || '-'}</Td>
            <Td className="font-bold text-white">{money(num(p.valor))}</Td>
            <Td className={vencida ? 'font-bold text-rose-300' : paga ? 'text-emerald-300' : ''}>{br(p.vencimento)}</Td>
            <Td className="text-white/60">{p.banco || '—'}</Td>
            <Td><StatusTag status={vencida ? 'Vencido' : (p.status || 'Aberto')} /></Td>
            <Td>{p.dataPagamento ? br(p.dataPagamento) : '-'}</Td>
            <Td>{p.jurosPago ? money(num(p.jurosPago)) : '-'}</Td>
            <Td>
              {(p.comprovantes || []).length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(p.comprovantes || []).map((url: string, i: number, arr: string[]) => (
                    <a key={`${p.id}-comprovante-${i}`} href={url} target="_blank" rel="noopener noreferrer" title="Ver/baixar comprovante">
                      <Pill tone="ok"><Download size={11} />{arr.length > 1 ? ` ${i + 1}` : ''}</Pill>
                    </a>
                  ))}
                </div>
              ) : '-'}
            </Td>
            <Td>
              <div className="flex gap-2">
                {p.type !== 'parent' && (
                  <Btn
                    small
                    variant="secondary"
                    onClick={async () => {
                      const doc = await garantirDocumento(p);
                      if (doc === null) return;
                      abrirEdicao({ ...p, documento: doc, status: p.status === CP_STATUS.semDoc ? CP_STATUS.comDoc : p.status });
                    }}
                  >
                    Editar
                  </Btn>
                )}
                {p.type === 'single' && p.status !== 'Pago' && p.status !== CP_STATUS.semDoc && <Btn small variant="blue" onClick={() => abrirParcelar(p)}><Split size={12} /> Parcelar</Btn>}
                {p.type !== 'parent' && p.status !== 'Pago' && <Btn small variant="green" onClick={() => abrirPagamento(p)}><Banknote size={12} /> Pagar</Btn>}
                {(((p.anexos as string[] | undefined)?.length || 0) + ((p.comprovantes as string[] | undefined)?.length || 0)) > 0 && (
                  <Btn small variant="secondary" onClick={() => setVerDocumentos(p)}>
                    <Files size={12} /> Documentos ({((p.anexos as string[] | undefined)?.length || 0) + ((p.comprovantes as string[] | undefined)?.length || 0)})
                  </Btn>
                )}
                <DeleteBtn
                  titulo="Excluir conta a pagar"
                  descricao={
                    `${p.id} — ${p.fornecedor || 'sem fornecedor'} — ${money(num(p.valor))}`
                    + (p.type === 'parent'
                      ? `\n\nEsta é uma conta MÃE: as ${contarDependentes(p.id)} parcela(s) filha(s) serão excluídas junto.`
                      : '')
                    + (p.status === 'Pago'
                      ? '\n\nATENÇÃO: esta conta já foi PAGA. O pagamento e o comprovante saem do histórico financeiro.'
                      : '')
                  }
                  beforeConfirm={async () => (await garantirDocumento(p)) !== null}
                  onConfirm={() => deleteRecord(p.id)}
                />
              </div>
            </Td>
          </tr>
          );
        })}
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
            <Field label="Documento" span={3}>
              <Input value={form.documento} onChange={(e) => setF('documento', e.target.value)} placeholder="Nº único do boleto" />
              <p className="mt-1 text-[10px] leading-tight text-white/40">Se for boleto, use o Nosso Número ou a linha digitável — é o que evita pagar a mesma nota duas vezes.</p>
            </Field>
            <Field label="Valor total" span={3}><MoneyInput value={form.valor} onChange={(v) => setF('valor', v)} /></Field>

            <Field label="Vencimento" span={3}><Input type="date" value={form.vencimento} onChange={(e) => setF('vencimento', e.target.value)} /></Field>
            <Field label="Banco" span={3}>
              <Select value={form.banco} onChange={(e) => setF('banco', e.target.value)}>
                <option value="">{bancos.length ? 'A definir...' : 'Nenhum banco cadastrado'}</option>
                {bancos.map((b) => <option key={b.id} value={b.nome}>{bancoLabel(b)}</option>)}
              </Select>
            </Field>
            <Field label="Forma" span={6}>
              <Select value={form.forma} onChange={(e) => setF('forma', e.target.value)}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>

            <Field label="Observação" span={12}><Textarea value={form.obs} onChange={(e) => setF('obs', e.target.value)} /></Field>

            <div className="col-span-12">
              <label className={labelCls}>Documentos (NF, boleto, recibo... pode anexar mais de um)</label>
              {anexosExistentes.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {anexosExistentes.map((url) => (
                    <div key={url} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate underline decoration-dotted hover:text-amber-100">
                        {nomeDoArquivo(url)}
                      </a>
                      <label className="flex shrink-0 cursor-pointer items-center gap-1 text-amber-200/70 hover:text-amber-100" title="Substituir este documento">
                        <RefreshCw size={12} className={processandoDoc === url ? 'animate-spin' : ''} /> Substituir
                        <input
                          type="file"
                          className="hidden"
                          disabled={processandoDoc === url}
                          onChange={(e) => substituirDocumentoDaConta(editId as string, url, 'anexos', e.target.files?.[0])}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={processandoDoc === url}
                        onClick={() => excluirDocumentoDaConta(editId as string, url, 'anexos')}
                        title="Excluir este documento"
                        className="shrink-0 text-amber-200/60 hover:text-rose-300 disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <FileInput label="Anexar documento(s) — NF de entrada, boleto, recibo... (PDF, imagem)" value={novosAnexos} onChange={setNovosAnexos} />
              <p className="mt-2 text-[11px] text-white/40">Ao anexar documento(s) e preencher número + vencimento, a conta passa para <strong className="text-white/70">Aberto C/Documento</strong>.</p>
            </div>

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
            <Field label="Intervalo (dias)" span={4}>
              <Input type="number" min="1" value={parc.intervalo} onChange={(e) => setParc((p) => ({ ...p, intervalo: e.target.value }))} placeholder="Ex.: 30" />
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
        <FinModal title={`Pagar ${pagando.id}`} hint="Data real, banco e juros. Comprovante opcional (dá para pagar antes da nota chegar)." onClose={() => setPagando(null)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarPagamento}>
            <Field label="Conta" span={6}><Input value={`${pagando.fornecedor || ''} • ${money(num(pagando.valor))}`} disabled /></Field>
            <Field label="Quando paguei?" span={3}><Input type="date" value={pay.dataPagamento} onChange={(e) => setPayF('dataPagamento', e.target.value)} /></Field>
            <Field label="Valor pago" span={3}><MoneyInput value={pay.valorPago} onChange={(v) => setPayF('valorPago', v)} /></Field>

            <Field label="Banco usado *" span={6}>
              <Select value={pay.banco} onChange={(e) => setPayF('banco', e.target.value)}>
                <option value="">{bancos.length ? 'Selecione...' : 'Cadastre um banco na aba Bancos'}</option>
                {bancos.map((b) => <option key={b.id} value={b.nome}>{bancoLabel(b)}</option>)}
              </Select>
            </Field>
            <Field label="Houve juros?" span={6}>
              <Select value={pay.houveJuros} onChange={(e) => setPayF('houveJuros', e.target.value)}><option>Não</option><option>Sim</option></Select>
            </Field>

            {pay.houveJuros === 'Sim' && <>
              <Field label="Valor dos juros" span={4}><MoneyInput value={pay.jurosPago} onChange={(v) => setPayF('jurosPago', v)} /></Field>
              <Field label="Motivo dos juros" span={8}><Input value={pay.motivoJuros} onChange={(e) => setPayF('motivoJuros', e.target.value)} /></Field>
            </>}

            <div className="col-span-12">
              <label className={labelCls}>Comprovante(s) de pagamento (opcional, pode anexar mais de um)</label>
              {comprovantesExistentes.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {comprovantesExistentes.map((url) => (
                    <div key={url} className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate underline decoration-dotted hover:text-emerald-100">
                        {nomeDoArquivo(url)}
                      </a>
                      <label className="flex shrink-0 cursor-pointer items-center gap-1 text-emerald-200/70 hover:text-emerald-100" title="Substituir este comprovante">
                        <RefreshCw size={12} className={processandoDoc === url ? 'animate-spin' : ''} /> Substituir
                        <input
                          type="file"
                          className="hidden"
                          disabled={processandoDoc === url}
                          onChange={(e) => substituirDocumentoDaConta(pagando!.id, url, 'comprovantes', e.target.files?.[0])}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={processandoDoc === url}
                        onClick={() => excluirDocumentoDaConta(pagando!.id, url, 'comprovantes')}
                        title="Excluir este comprovante"
                        className="shrink-0 text-emerald-200/60 hover:text-rose-300 disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <FileInput label="Anexar comprovante(s) (PDF, imagem...)" value={novosComprovantes} onChange={setNovosComprovantes} />
            </div>

            <div className="col-span-12 grid grid-cols-2 gap-3">
              <Kpi label="Valor pago" value={money(num(pay.valorPago))} />
              <Kpi label="Juros" value={pay.houveJuros === 'Sim' ? money(num(pay.jurosPago)) : '—'} />
            </div>

            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setPagando(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando || !pay.banco}>
                <Banknote size={15} /> {salvando ? 'Registrando...' : 'Confirmar pagamento'}
              </Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: ver documentos (anexos + comprovantes) — só consulta, sem edição */}
      {verDocumentos && (
        <FinModal
          title={`Documentos — ${verDocumentos.id}`}
          hint={`${verDocumentos.fornecedor || 'Fornecedor não informado'} · ${money(num(verDocumentos.valor))}`}
          onClose={() => setVerDocumentos(null)}
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-amber-300">
                Documentos anexados (NF, boleto, recibo...)
              </p>
              {(verDocumentos.anexos || []).length === 0 ? (
                <p className="text-xs text-white/40">Nenhum documento anexado.</p>
              ) : (
                <div className="space-y-2">
                  {(verDocumentos.anexos as string[]).map((url, i) => (
                    <a
                      key={`${verDocumentos.id}-anexo-${i}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition hover:border-amber-500/40 hover:bg-white/5"
                    >
                      <Paperclip size={15} className="shrink-0 text-amber-300" />
                      <span className="truncate">{nomeDoArquivo(url)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-300">
                Comprovantes de pagamento
              </p>
              {(verDocumentos.comprovantes || []).length === 0 ? (
                <p className="text-xs text-white/40">Nenhum comprovante anexado.</p>
              ) : (
                <div className="space-y-2">
                  {(verDocumentos.comprovantes as string[]).map((url, i) => (
                    <a
                      key={`${verDocumentos.id}-comprovante-${i}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition hover:border-emerald-500/40 hover:bg-white/5"
                    >
                      <Download size={15} className="shrink-0 text-emerald-300" />
                      <span className="truncate">{nomeDoArquivo(url)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Btn variant="ghost" onClick={() => setVerDocumentos(null)}>Fechar</Btn>
            </div>
          </div>
        </FinModal>
      )}

      {/* POPUP: aviso de contas fixas vencendo/vencidas — abre a cada entrada na tela */}
      {mostrarAvisos && avisos.length > 0 && (
        <FinModal
          wide
          title="Contas fixas a pagar"
          hint="Lembrete automático das contas recorrentes que estão vencidas ou perto do vencimento."
          onClose={() => setMostrarAvisos(false)}
        >
          <div className="space-y-3">
            {avisos.map(({ conta, dias, vencida }) => (
              <div
                key={conta.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                  vencida ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/40 bg-amber-500/10'
                }`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-black text-white">
                    <AlertTriangle size={15} className={vencida ? 'text-rose-300' : 'text-amber-300'} />
                    {conta.contaFixaDescricao || conta.fornecedor}
                    <Pill tone="info">{conta.contaFixaCategoria || 'Fixa'}</Pill>
                  </p>
                  <p className={`mt-1 text-sm ${vencida ? 'text-rose-200' : 'text-amber-100'}`}>
                    {vencida
                      ? `Venceu em ${br(conta.vencimento)} — atrasada há ${Math.abs(dias)} dia(s). Pague o quanto antes.`
                      : dias === 0
                        ? `Vence HOJE (${br(conta.vencimento)}). Pague o quanto antes.`
                        : `Vence em ${dias} dia(s), no dia ${br(conta.vencimento)}. Pague o quanto antes.`}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">{conta.empresa} · {money(num(conta.valor))} · {conta.id}</p>
                </div>
                <Btn
                  variant="green"
                  onClick={() => { setMostrarAvisos(false); abrirPagamento(conta); }}
                >
                  <Banknote size={15} /> Pagar agora
                </Btn>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <Btn variant="ghost" onClick={() => setMostrarAvisos(false)}>Ver depois</Btn>
            </div>
          </div>
        </FinModal>
      )}

      {/* MODAL: gerenciar contas fixas (as REGRAS de recorrência) */}
      {gerenciandoFixas && (
        <FinModal
          full
          title="Contas fixas"
          hint="Regras de recorrência (luz, água, aluguel...). Cada regra lança sozinha a conta a pagar de cada vencimento."
          onClose={() => setGerenciandoFixas(false)}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <Btn variant="amber" onClick={abrirNovaFixa}><Plus size={15} /> Nova conta fixa</Btn>
            </div>

            <DataTable
              minWidth={900}
              head={<>
                <Th>Descrição</Th><Th>Categoria</Th><Th>Empresa</Th><Th>Periodicidade</Th>
                <Th>Vencimento</Th><Th>Valor</Th><Th>Situação</Th><Th>Ação</Th>
              </>}
            >
              {contasFixas.length === 0 ? (
                <EmptyRow cols={8} text="Nenhuma conta fixa cadastrada" />
              ) : contasFixas.map((r) => (
                <tr key={r.id} className={`transition-colors hover:bg-white/5 ${r.ativa === false ? 'opacity-50' : ''}`}>
                  <Td className="font-bold text-white">{r.descricao}</Td>
                  <Td><Pill tone="info">{r.categoria}</Pill></Td>
                  <Td><CompanyTag empresa={String(r.empresa)} /></Td>
                  <Td className="text-white/70">{PERIODICIDADES.find((p) => p.id === r.periodicidade)?.label || r.periodicidade}</Td>
                  <Td className="text-white/60">{r.periodicidade === 'mensal' ? `Dia ${r.diaVencimento}` : `A partir de ${br(r.inicio)}`}</Td>
                  <Td className="font-bold text-white">{money(num(r.valor))}</Td>
                  <Td>{r.ativa === false ? <Pill tone="neutral">Pausada</Pill> : <Pill tone="ok">Ativa</Pill>}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Btn small variant="secondary" onClick={() => abrirEdicaoFixa(r)}>Editar</Btn>
                      <Btn small variant="ghost" onClick={() => alternarAtiva(r)} title={r.ativa === false ? 'Voltar a gerar vencimentos' : 'Parar de gerar novos vencimentos'}>
                        <Power size={12} /> {r.ativa === false ? 'Reativar' : 'Pausar'}
                      </Btn>
                      <DeleteBtn
                        titulo="Excluir conta fixa"
                        descricao={
                          `${r.descricao} — ${r.categoria} — ${money(num(r.valor))}\n\n`
                          + `A regra para de existir e ${ocorrenciasFuturasDaFixa(r.id)} vencimento(s) futuro(s) ainda não pago(s) serão removidos.\n\n`
                          + 'As contas já pagas e as vencidas permanecem no histórico financeiro — elas não são configuração, são registro do que aconteceu.'
                        }
                        onConfirm={() => excluirContaFixa(r.id)}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </DataTable>

            <p className="text-xs text-white/40">
              Pausar mantém o histórico e só impede novos lançamentos — é o caminho seguro quando o
              contrato acaba. Excluir só faz sentido para uma regra criada por engano.
            </p>
          </div>
        </FinModal>
      )}

      {/* MODAL: criar / editar uma conta fixa */}
      {fixaEditId !== undefined && (
        <FinModal
          wide
          title={fixaEditId ? 'Editar conta fixa' : 'Nova conta fixa'}
          hint="A cada vencimento, o sistema lança sozinho a conta a pagar correspondente."
          onClose={() => setFixaEditId(undefined)}
        >
          <form className="grid grid-cols-12 gap-4" onSubmit={salvarFixa}>
            <Field label="Descrição" span={6}>
              <Input value={fixa.descricao} onChange={(e) => setFixaF('descricao', e.target.value)} placeholder="Ex.: Conta de luz — galpão" />
            </Field>
            <Field label="Categoria" span={3}>
              <Select value={fixa.categoria} onChange={(e) => setFixaF('categoria', e.target.value)}>
                {CATEGORIAS_CONTA_FIXA.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Empresa" span={3}>
              <Select value={fixa.empresa} onChange={(e) => setFixaF('empresa', e.target.value)}>
                {empresas.map((emp) => <option key={emp}>{emp}</option>)}
              </Select>
            </Field>

            <Field label="Fornecedor / concessionária" span={6}>
              <Input value={fixa.fornecedor} onChange={(e) => setFixaF('fornecedor', e.target.value)} placeholder="= descrição se vazio" />
            </Field>
            <Field label="Natureza" span={3}>
              <Select value={fixa.natureza} onChange={(e) => setFixaF('natureza', e.target.value)}>
                {NATUREZAS_CONTA_PAGAR.map((n) => <option key={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Departamento" span={3}>
              <Select value={fixa.departamento} onChange={(e) => setFixaF('departamento', e.target.value)}>
                <option value="">Nenhum</option>
                {departamentos.map((d: string) => <option key={d}>{d}</option>)}
              </Select>
            </Field>

            <Field label="Periodicidade" span={4}>
              <Select value={fixa.periodicidade} onChange={(e) => setFixaF('periodicidade', e.target.value)}>
                {PERIODICIDADES.map((p) => <option key={p.id} value={p.id}>{p.label} — {p.descricao}</option>)}
              </Select>
            </Field>
            {fixa.periodicidade === 'mensal' ? (
              <Field label="Dia do vencimento" span={4}>
                <Input
                  type="number" min="1" max="31"
                  value={fixa.diaVencimento}
                  onChange={(e) => setFixaF('diaVencimento', e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Repete a cada" span={4}>
                <Input value={fixa.periodicidade === 'semanal' ? '7 dias' : '1 dia'} disabled />
              </Field>
            )}
            {/* O rótulo acompanha o valor digitado, para o usuário ler a frase pronta
                ("avisar com antecedência de 5 dias") em vez de um campo solto. */}
            <Field label={`Avisar com antecedência de ${diasAviso} ${diasAviso === 1 ? 'dia' : 'dias'}`} span={4}>
              <Input
                type="number" min="0" max="60"
                value={fixa.antecedenciaAviso}
                onChange={(e) => setFixaF('antecedenciaAviso', e.target.value)}
                placeholder="dias"
              />
            </Field>

            <Field label="Valor" span={4}>
              <MoneyInput value={fixa.valor} onChange={(v) => setFixaF('valor', v)} />
            </Field>
            <Field label="Início" span={4}>
              <Input type="date" value={fixa.inicio} onChange={(e) => setFixaF('inicio', e.target.value)} />
            </Field>
            <Field label="Fim (opcional)" span={4}>
              <Input type="date" value={fixa.fim} onChange={(e) => setFixaF('fim', e.target.value)} />
            </Field>

            <Field label="Forma de pagamento" span={6}>
              <Select value={fixa.forma} onChange={(e) => setFixaF('forma', e.target.value)}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
            <Field label="Banco" span={6}>
              <Select value={fixa.banco} onChange={(e) => setFixaF('banco', e.target.value)}>
                <option value="">{bancos.length ? 'Selecione o banco...' : 'Nenhum banco cadastrado'}</option>
                {bancos.map((b) => <option key={b.id} value={b.nome}>{bancoLabel(b)}</option>)}
              </Select>
            </Field>

            <Field label="Observação" span={12}>
              <Textarea value={fixa.obs} onChange={(e) => setFixaF('obs', e.target.value)} />
            </Field>

            <div className="col-span-12 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-4 text-sm text-sky-100">
              <p className="flex items-center gap-2 font-black"><CalendarClock size={15} /> Como funciona</p>
              <p className="mt-1 text-sky-100/80">
                A regra em si nunca é paga. Ao salvar, o sistema lança <strong className="font-black">uma</strong> conta
                a pagar para o primeiro vencimento. <strong className="font-black">Quando você paga, a próxima é
                criada automaticamente</strong> — cópia desta, com o vencimento do{' '}
                {fixa.periodicidade === 'semanal' ? 'semana seguinte' : fixa.periodicidade === 'diaria' ? 'dia seguinte' : 'mês seguinte'} —
                e a paga fica no histórico. Assim existe sempre uma única conta em aberto, e a lista
                vai virando o histórico de pagamentos.
              </p>
              <p className="mt-2 text-sky-100/80">
                Ela aparece <strong className="font-black">junto com as demais</strong>, marcada com a etiqueta{' '}
                <strong className="font-black">Fixa</strong> (use o filtro “Tipo” para ver só as recorrentes),
                fica vermelha se atrasar e verde depois de paga. O aviso abre ao entrar nesta tela a partir
                de {diasAviso} {diasAviso === 1 ? 'dia' : 'dias'} antes do vencimento.
                {fixaEditId && ' Ao salvar, o valor e os dados são atualizados na conta em aberto — as já pagas ficam como estão.'}
              </p>
            </div>

            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setFixaEditId(undefined)}>Cancelar</Btn>
              <Btn type="submit" variant="amber" disabled={salvando}>
                <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar conta fixa'}
              </Btn>
            </div>
          </form>
        </FinModal>
      )}
    </FinCard>
  );
}
