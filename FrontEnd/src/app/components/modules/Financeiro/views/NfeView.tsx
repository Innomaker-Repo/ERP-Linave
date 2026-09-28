import React, { useMemo, useState } from 'react';
import { Plus, FileCheck2, ExternalLink, Hash, CalendarClock, Pencil } from 'lucide-react';
import {
  FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, Pill, AlertBar, EmptyRow,
  FinModal, Field, Input, MoneyInput, Select, FileInput, DeleteBtn, boldOS, AnexosCell,
} from '../finUi';
import {
  br, money, num, isOld, todayStr, genFinId, TAX_DEFAULTS, calcNfeLiquido, calcImpostosNfe,
  FORMAS_PAGAMENTO, siglaTipoNfe, isLinaveEmpresa, dadosClienteRecibo, type NfeSolicitacao,
} from '../finData';
import { useFin } from '../useFin';
import { useFinFilters } from '../finFilters';
import { useErp } from '../../../../context/ErpContext';
import { uploadDocumento } from '../../../../../services/documentosService';
import { ReciboLocacaoFormModal, ReciboLocacaoFormFields, formInicialRecibo, linhaItem, gerarEArquivarRecibo } from './ReciboLocacaoFormModal';
import { temServico, temLocacao } from '../../../../utils/modalidade';
import { toast } from 'sonner';

// As 4 combinações de solicitação possíveis (natureza x empresa prestadora — ver siglaTipoNfe
// em finData.ts, que é quem decide a sigla exibida a partir dessas mesmas 2 informações).
// Montada dentro do componente (não aqui no topo do arquivo) porque depende de `empresas`,
// a lista real de empresas prestadoras cadastradas.
const TIPOS_SOLICITACAO_BASE = [
  { value: 'servico-servinave', natureza: 'Serviço', linave: false },
  { value: 'servico-linave', natureza: 'Serviço', linave: true },
  { value: 'locacao-linave', natureza: 'Locação', linave: true },
  { value: 'locacao-servinave', natureza: 'Locação', linave: false },
] as const;

const STATUS_FILTROS_NFE = ['Todos', 'Aguardando emissão', 'Emitida e arquivada'] as const;
type StatusFiltroNfe = typeof STATUS_FILTROS_NFE[number];

// Valor sentinela do dropdown de clientes: libera o campo de texto para um cliente que
// ainda não está cadastrado (nota avulsa), sem obrigar a cadastrar antes de solicitar.
const CLIENTE_OUTRO = '__outro__';

// Nome de exibição de um cliente cadastrado (o shape varia entre camel e snake case).
const nomeCliente = (c: any): string =>
  c?.razaoSocial || c?.razao_social || c?.nomeFantasia || c?.nome_fantasia || c?.nome || '';

// Estado inicial do formulário de emissão — usado igual pra NFe (Serviço), Recibo (R/L) e Nota
// (N/D): mesmos campos e os mesmos % de imposto por padrão (o usuário ajusta caso a caso; ver
// abrirEmissao/confirmarEmissao mais abaixo).
const emptyNf = () => ({
  cliente: '', numero: '', emissao: todayStr, original: '',
  cofins: String(TAX_DEFAULTS.cofins), csll: String(TAX_DEFAULTS.csll), inss: String(TAX_DEFAULTS.inss),
  ir: String(TAX_DEFAULTS.ir), pis: String(TAX_DEFAULTS.pis), iss: String(TAX_DEFAULTS.iss),
  baixado: '0', vencido: '0', vencimento: todayStr, contrato: '',
});

// Campos da tabela de "Emitir NFe" (Serviço) — extraído pra ser reaproveitado tal e qual
// (nenhum campo diferente) dentro da modal combinada de uma OS "Locação + Serviço", que
// mostra essa MESMA tabela lado a lado com o documento de Recibo de Locação (ver
// ReciboLocacaoFormFields, o equivalente do lado da Locação).
function EmissaoServicoFields({ nf, setNfField }: { nf: any; setNfField: (k: string, v: string) => void }) {
  const original = num(nf.original);
  const liquido = useMemo(
    () => calcNfeLiquido(original, { cofins: num(nf.cofins), csll: num(nf.csll), inss: num(nf.inss), ir: num(nf.ir), pis: num(nf.pis), iss: num(nf.iss) }),
    [original, nf.cofins, nf.csll, nf.inss, nf.ir, nf.pis, nf.iss],
  );
  const impostosLista = ([
    ['COFINS', nf.cofins], ['CSLL', nf.csll], ['INSS', nf.inss],
    ['IR', nf.ir], ['PIS', nf.pis], ['ISS', nf.iss],
  ] as [string, string][]).map(([nome, pct]) => ({ nome, pct: num(pct), valor: original * num(pct) / 100 }));
  const totalImpostos = impostosLista.reduce((s, i) => s + i.valor, 0);

  return (
    <>
      <Field label="Cliente" span={6}><Input value={nf.cliente} onChange={(e) => setNfField('cliente', e.target.value)} /></Field>
      <Field label="Nº da NFe (opcional)" span={3}>
        <Input value={nf.numero} onChange={(e) => setNfField('numero', e.target.value)} placeholder="Pode preencher depois" />
      </Field>
      <Field label="Emissão" span={3}><Input type="date" value={nf.emissao} onChange={(e) => setNfField('emissao', e.target.value)} /></Field>

      <Field label="Valor original" span={6}><MoneyInput value={nf.original} onChange={(v) => setNfField('original', v)} /></Field>
      <Field label="Baixado" span={3}><MoneyInput value={nf.baixado} onChange={(v) => setNfField('baixado', v)} /></Field>
      <Field label="Valor vencido" span={3}><MoneyInput value={nf.vencido} onChange={(v) => setNfField('vencido', v)} /></Field>

      <Field label="COFINS %" span={2}><Input type="number" step="0.0001" value={nf.cofins} onChange={(e) => setNfField('cofins', e.target.value)} /></Field>
      <Field label="CSLL %" span={2}><Input type="number" step="0.0001" value={nf.csll} onChange={(e) => setNfField('csll', e.target.value)} /></Field>
      <Field label="INSS %" span={2}><Input type="number" step="0.0001" value={nf.inss} onChange={(e) => setNfField('inss', e.target.value)} /></Field>
      <Field label="IR %" span={2}><Input type="number" step="0.0001" value={nf.ir} onChange={(e) => setNfField('ir', e.target.value)} /></Field>
      <Field label="PIS %" span={2}><Input type="number" step="0.0001" value={nf.pis} onChange={(e) => setNfField('pis', e.target.value)} /></Field>
      <Field label="ISS %" span={2}><Input type="number" step="0.0001" value={nf.iss} onChange={(e) => setNfField('iss', e.target.value)} /></Field>

      <Field label="Vencimento do recebimento" span={6}><Input type="date" value={nf.vencimento} onChange={(e) => setNfField('vencimento', e.target.value)} /></Field>
      <Field label={boldOS('Contrato / OS / P.O')} span={6}><Input value={nf.contrato} onChange={(e) => setNfField('contrato', e.target.value)} /></Field>

      <div className="col-span-12 rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-amber-300">Impostos retidos (detalhado)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {impostosLista.map((imp) => (
            <div key={imp.nome} className="rounded-lg border border-white/5 bg-[#101f3d] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-white/60">{imp.nome}</span>
                <span className="text-[10px] text-white/30">{imp.pct}%</span>
              </div>
              <p className="mt-1 font-bold text-white">{money(imp.valor)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-300/70">Total de impostos</p>
            <p className="text-lg font-black text-red-300">{money(totalImpostos)}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300/70">Líquido a receber</p>
            <p className="text-lg font-black text-emerald-300">{money(liquido)}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function NfeView() {
  const {
    nfeSolicitacoes, financeiro, empresas, oss, clientes,
    emitirNfe, atualizarNfeEmitida, addRecord, updateRecord, deleteRecord,
  } = useFin();
  const { config, saveEntity } = useErp() as any;
  const { match } = useFinFilters();
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltroNfe>('Todos');
  const solicitacoes = nfeSolicitacoes.filter(match).filter((r) => statusFiltro === 'Todos' || r.status === statusFiltro);

  // As 4 opções do dropdown "Tipo" do modal "Solicitar NFe e Recibo": cada uma já resolve a
  // empresa prestadora real (cadastro) e o tipoNfe — escolher uma seta os dois de uma vez,
  // sem precisar de um campo "Empresa" separado (que antes deixava dar uma combinação
  // contraditória, ex.: Tipo "Nota de débito" com Empresa "Servinave" mostrando sigla errada).
  const tiposSolicitacao = useMemo(() => {
    const empresaLinave = empresas.find(isLinaveEmpresa) || 'Linave';
    const empresaServinave = empresas.find((e) => !isLinaveEmpresa(e)) || 'Servinave';
    return TIPOS_SOLICITACAO_BASE.map((t) => {
      const empresa = t.linave ? empresaLinave : empresaServinave;
      const tipoNfe = t.natureza === 'Serviço' ? 'NFe Serviço' : 'Nota de débito';
      const sigla = siglaTipoNfe(tipoNfe, empresa);
      return { value: t.value, empresa, tipoNfe, label: `${sigla} - ${t.natureza === 'Serviço' ? 'Serviços' : 'Locação'} ${t.linave ? 'Linave' : 'Servinave'}` };
    });
  }, [empresas]);

  // ---- Documento de verdade do Recibo de Locação (itens, emitente, destinatário, banco — o
  // que gera o PDF pelo mesmo template usado na aba "Recibo de Locação"). Independente do fluxo
  // financeiro de "Gerar Recibo" acima: aqui só se preenche/edita o documento em si e se baixa o
  // PDF; lá se lança o valor líquido/impostos e se arquiva o anexo pra criar a Conta a Receber.
  const [reciboForm, setReciboForm] = useState<any>(null);

  const recibosPorNfeReqId = useMemo(() => {
    const mapa = new Map<string, any>();
    (Array.isArray(financeiro) ? financeiro : [])
      .filter((r: any) => r?.tipo === 'reciboLocacao' && r?.nfeReqId)
      .forEach((r: any) => mapa.set(String(r.nfeReqId), r));
    return mapa;
  }, [financeiro]);

  // Monta o documento de recibo de uma solicitação — reaproveitado pelo fluxo solo
  // (abrirPreencherRecibo) E pela modal combinada de OS mista (abrirEmissaoMista) abaixo.
  const construirReciboParaSolicitacao = (r: NfeSolicitacao) => {
    // % de imposto salvos como rascunho na modal "Emitir Recibo/Nota" (ver salvarRascunhoImpostos
    // abaixo) — mesclados aqui pra "Emitir, anexar e arquivar" (gerarEArquivarRecibo) já achar
    // esses valores no form, mesmo se o recibo já existia como rascunho salvo anteriormente.
    const impostosRascunho = r.rascunhoImpostos || {};
    const existente = recibosPorNfeReqId.get(String(r.id));
    if (existente) return { ...existente, ...impostosRascunho };

    const recibosAtuais = (Array.isArray(financeiro) ? financeiro : []).filter((x: any) => x?.tipo === 'reciboLocacao');
    const base = formInicialRecibo(recibosAtuais, r.empresa, config);
    const valor = num(r.valor);
    // clienteId da OS (achada pelo número) casa o cliente pelo id — mais confiável que pelo nome.
    const osDaSolicitacao = oss.find((o) => o.numero === (r.os || r.contrato));
    return {
      ...base,
      ...impostosRascunho,
      nfeReqId: r.id,
      ordemServicoNumero: r.os || r.contrato || '',
      clienteNome: r.cliente || '',
      ...dadosClienteRecibo(clientes, { clienteId: osDaSolicitacao?.clienteId, nomeCliente: r.cliente }),
      dataEmissao: r.dataEmitir || base.dataEmissao,
      status: r.status === 'Emitida e arquivada' ? 'emitido' : 'pendente',
      itens: valor > 0
        ? [{ ...linhaItem(), item: '01', qtd: '1', descricao: r.cliente ? `Locação — ${r.cliente}` : 'Locação', valorUnitario: String(valor), total: String(valor) }]
        : [linhaItem()],
    };
  };

  const abrirPreencherRecibo = (r: NfeSolicitacao) => setReciboForm(construirReciboParaSolicitacao(r));

  // Mantém a data planejada da solicitação em dia com o que foi preenchido no documento do
  // recibo — não mexe em `valor`/`status`, que agora seguem o fluxo financeiro de "Gerar Recibo".
  const aoSalvarRecibo = async (recSalvo: any) => {
    // A modal de rascunho de imposto (Modal A) pode ter ficado aberta atrás de "Preencher/
    // editar" — depois que o recibo é salvo/arquivado ela não tem mais função, então fecha
    // junto (sem efeito se já estava fechada, ou se não é a mesma solicitação).
    if (emitindo?.id === recSalvo?.nfeReqId) setEmitindo(null);
    const idOrigem = recSalvo?.nfeReqId;
    if (!idOrigem || !recSalvo?.dataEmissao) return;
    await updateRecord(idOrigem, { dataEmitir: recSalvo.dataEmissao });
  };

  // Nota emitida de cada solicitação (o registro 'nfe' aponta para a origem por sourceId).
  // É por aqui que a linha arquivada mostra o número e permite corrigi-lo depois.
  const notaPorSolicitacao = useMemo(() => {
    const mapa = new Map<string, any>();
    financeiro.filter((r) => r.tipo === 'nfe' && r.sourceId).forEach((r) => mapa.set(String(r.sourceId), r));
    return mapa;
  }, [financeiro]);

  // Clientes cadastrados, ordenados por nome, para o dropdown da solicitação.
  const clientesOrdenados = useMemo(
    () => clientes.map(nomeCliente).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [clientes],
  );

  const [emitindo, setEmitindo] = useState<NfeSolicitacao | null>(null);
  const [nf, setNf] = useState(emptyNf());
  const [nfeAnexos, setNfeAnexos] = useState<File[]>([]);
  const setNfField = (k: string, v: string) => setNf((p) => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false);

  // Modal manual de solicitação.
  const [solicitando, setSolicitando] = useState(false);
  const [sf, setSf] = useState({
    empresa: empresas[0] || 'Linave', os: '', cliente: '', valor: '', forma: '', dataEmitir: todayStr, tipoNfe: 'NFe Serviço',
    // Só usados quando a OS escolhida é de modalidade "Locação + Serviço" (ver osMista abaixo) —
    // nesse caso o Tipo some (a natureza das 2 partes já é conhecida) e viram 2 solicitações.
    valorServico: '', valorLocacao: '',
  });
  const setSfField = (k: string, v: string) => setSf((p) => ({ ...p, [k]: v }));
  // '' = nada escolhido; CLIENTE_OUTRO = cliente não cadastrado (digita à mão);
  // qualquer outro valor = nome do cliente cadastrado escolhido na lista.
  const [clienteOpcao, setClienteOpcao] = useState('');

  // OS selecionada e se a modalidade do negócio de origem é "Locação + Serviço" — só nesse
  // caso a solicitação precisa de 2 tabelas de valor separadas (ver JSX do modal abaixo).
  const osSelecionadaSf = useMemo(() => oss.find((o) => o.numero === sf.os), [oss, sf.os]);
  const osMista = Boolean(osSelecionadaSf) && temServico(osSelecionadaSf!.modalidade) && temLocacao(osSelecionadaSf!.modalidade);

  const escolherCliente = (valor: string) => {
    setClienteOpcao(valor);
    setSfField('cliente', valor === CLIENTE_OUTRO ? '' : valor);
  };

  // Preenche o cliente sozinho ao escolher a OS, quando ele está cadastrado — evita
  // digitar de novo um dado que o sistema já tem. Se a OS for mista, já puxa os valores de
  // Serviço/Locação calculados no orçamento (usuário ainda pode ajustar antes de enviar) —
  // senão zera os campos (evita o valor da OS #1 vazar pra dentro da solicitação da OS #2).
  const escolherOs = (numero: string) => {
    const osSel = oss.find((o) => o.numero === numero);
    const mista = Boolean(osSel) && temServico(osSel!.modalidade) && temLocacao(osSel!.modalidade);
    setSf((p) => ({
      ...p,
      os: numero,
      valorServico: mista && osSel!.valorServico ? String(osSel!.valorServico) : '',
      valorLocacao: mista && osSel!.valorLocacao ? String(osSel!.valorLocacao) : '',
    }));
    const nome = String(osSel?.cliente || '').trim();
    if (!nome) return;
    const cadastrado = clientesOrdenados.find((c) => c.toLowerCase() === nome.toLowerCase());
    setClienteOpcao(cadastrado || CLIENTE_OUTRO);
    setSfField('cliente', cadastrado || nome);
  };

  // ---- Modal: informar/corrigir o número da NFe já arquivada ----
  const [editandoNota, setEditandoNota] = useState<any | null>(null);
  const [notaForm, setNotaForm] = useState({ numero: '', emissao: todayStr });

  const abrirEdicaoNota = (nota: any) => {
    setNotaForm({ numero: String(nota.numero || ''), emissao: nota.emissao || todayStr });
    setEditandoNota(nota);
  };

  const salvarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoNota) return;
    setSalvando(true);
    try {
      await atualizarNfeEmitida(editandoNota.id, { numero: notaForm.numero, emissao: notaForm.emissao });
      toast.success('Nota fiscal atualizada.');
      setEditandoNota(null);
    } catch (erro) {
      console.error('Erro ao atualizar a NFe:', erro);
      toast.error('Não foi possível atualizar a nota.');
    } finally {
      setSalvando(false);
    }
  };

  // ---- Modal: alterar a data planejada para emitir (só solicitação manual, não emitida) ----
  const [editandoData, setEditandoData] = useState<NfeSolicitacao | null>(null);
  const [dataEmitirForm, setDataEmitirForm] = useState(todayStr);

  const abrirEdicaoData = (sol: NfeSolicitacao) => {
    setDataEmitirForm(sol.dataEmitir || todayStr);
    setEditandoData(sol);
  };

  const salvarDataEmitir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoData) return;
    setSalvando(true);
    try {
      await updateRecord(editandoData.id, { dataEmitir: dataEmitirForm });
      toast.success('Data para emitir atualizada.');
      setEditandoData(null);
    } catch (erro) {
      console.error('Erro ao atualizar a data para emitir:', erro);
      toast.error('Não foi possível atualizar a data.');
    } finally {
      setSalvando(false);
    }
  };

  const fecharSolicitacao = () => {
    setSolicitando(false);
    setClienteOpcao('');
    setSf({ empresa: empresas[0] || 'Linave', os: '', cliente: '', valor: '', forma: '', dataEmitir: todayStr, tipoNfe: 'NFe Serviço', valorServico: '', valorLocacao: '' });
  };

  // Monta o estado inicial da tabela "Emitir NFe" (Serviço) de uma solicitação — reaproveitado
  // pelo fluxo solo (abrirEmissao) E pela modal combinada de OS mista (abrirEmissaoMista).
  const construirNfParaSolicitacao = (sol: NfeSolicitacao) =>
    ({ ...emptyNf(), cliente: sol.cliente, original: String(sol.valor || ''), vencimento: sol.dataEmitir || todayStr, contrato: sol.contrato || sol.os });

  // Modal única para Serviço (NFe), Locação-Linave (Nota de débito, N/D) e Locação-Servinave
  // (Recibo, R/L) — mesmos campos/impostos dos três, só o título e o botão extra "Preencher /
  // editar" variam por natureza (ver emitindoEhRecibo/emitindoSigla no JSX). Uma OS mista (par
  // Serviço+Locação, ver osEhMista) abre a modal combinada em vez desta.
  const abrirEmissao = (sol: NfeSolicitacao) => {
    setEmitindo(sol);
    setNfeAnexos([]);
    setNf(construirNfParaSolicitacao(sol));
  };

  // Sobe o(s) anexo(s) da NFe e chama emitirNfe — extraído pra ser reaproveitado tal e qual
  // pela modal combinada (confirmarEmissaoMista), que faz a mesma coisa pra parte de Serviço
  // antes de gerar o recibo da parte de Locação.
  const emitirNfeComAnexos = async (sol: NfeSolicitacao, nfForm: typeof nf, anexos: File[]): Promise<boolean> => {
    const resultados = await Promise.allSettled(
      anexos.map((file) => uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: sol.id, categoria: 'fin_anexo' }))
    );
    const anexosUrls = resultados
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value.url);
    if (anexosUrls.length === 0) {
      toast.error('Não foi possível enviar o anexo da NFe. Tente novamente.');
      return false;
    }
    const original = num(nfForm.original);
    const liquido = calcNfeLiquido(original, { cofins: num(nfForm.cofins), csll: num(nfForm.csll), inss: num(nfForm.inss), ir: num(nfForm.ir), pis: num(nfForm.pis), iss: num(nfForm.iss) });
    await emitirNfe(sol, {
      numero: nfForm.numero, emissao: nfForm.emissao, original, liquido,
      baixado: num(nfForm.baixado), vencimento: nfForm.vencimento, contrato: nfForm.contrato, cliente: nfForm.cliente,
      anexos: anexosUrls,
      // Detalhamento da retenção: segue para a NFe e para a Conta a Receber, que passa a
      // mostrar imposto por imposto sem precisar recalcular a partir das alíquotas atuais.
      impostos: calcImpostosNfe(original, {
        cofins: num(nfForm.cofins), csll: num(nfForm.csll), inss: num(nfForm.inss),
        ir: num(nfForm.ir), pis: num(nfForm.pis), iss: num(nfForm.iss),
      }),
    });
    return true;
  };

  const confirmarEmissao = async (e: React.FormEvent) => {
    e.preventDefault();
    // O número da NFe é OPCIONAL: nem sempre já saiu do emissor na hora do arquivamento,
    // e ele pode ser preenchido depois pelo botão "Nº da NF" na linha arquivada.
    // O anexo continua obrigatório — é o comprovante do que está sendo arquivado.
    if (!emitindo || nfeAnexos.length === 0) return;
    setSalvando(true);
    try {
      const ok = await emitirNfeComAnexos(emitindo, nf, nfeAnexos);
      if (ok) {
        const sigla = siglaTipoNfe(emitindo.tipoNfe, emitindo.empresa);
        const doc = emitindo.tipoNfe === 'Nota de débito' ? (sigla === 'R/L' ? 'Recibo' : 'Nota') : 'NFe';
        toast.success(`${doc} arquivado(a) — Conta a Receber gerada.`);
        setEmitindo(null);
      }
    } finally {
      setSalvando(false);
    }
  };

  // Recibo/Nota: esta modal NÃO arquiva mais (isso agora é o "Emitir, anexar e arquivar" de
  // dentro de "Preencher/editar", ver gerarEArquivarRecibo em ReciboLocacaoFormModal.tsx) — só
  // salva os % de imposto digitados como rascunho na própria solicitação, pra serem usados na
  // hora de arquivar de verdade. Sem anexo obrigatório aqui; isso também passou pra lá.
  const salvarRascunhoImpostos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emitindo) return;
    setSalvando(true);
    try {
      await updateRecord(emitindo.id, {
        rascunhoImpostos: { cofins: nf.cofins, csll: nf.csll, inss: nf.inss, ir: nf.ir, pis: nf.pis, iss: nf.iss },
      });
      toast.success('Rascunho salvo.');
      setEmitindo(null);
    } finally {
      setSalvando(false);
    }
  };

  // ---- Modal combinada: OS "Locação + Serviço" — duas tabelas (Serviço + documento de
  // Recibo de Locação), um botão só arquiva as duas de uma vez. Dispara pela MODALIDADE da OS
  // de origem, não pela existência prévia das 2 solicitações — a OS pode ter só uma das duas
  // ainda lançada (ex.: só a de Serviço), e nesse caso a outra é sintetizada a partir dos
  // valores já calculados na OS (valorServico/valorLocacao, ver finData.ts) e só vira
  // solicitação de verdade (addRecord) no momento de confirmar, não ao abrir a modal.
  const osEhMista = (numeroOs: string): boolean => {
    const os = oss.find((o) => o.numero === numeroOs);
    return Boolean(os) && temServico(os!.modalidade) && temLocacao(os!.modalidade);
  };

  const construirSolicitacaoVirtual = (os: (typeof oss)[number], tipoNfe: 'NFe Serviço' | 'Nota de débito'): NfeSolicitacao => ({
    id: genFinId('SNF'),
    os: os.numero,
    empresa: os.empresa,
    cliente: os.cliente,
    valor: tipoNfe === 'NFe Serviço' ? (os.valorServico || 0) : (os.valorLocacao || 0),
    forma: '',
    dataEmitir: todayStr,
    tipoNfe,
    status: 'Aguardando emissão',
    anexos: [],
    contrato: os.numero,
  });

  const [emitindoMista, setEmitindoMista] = useState<{ servico: NfeSolicitacao; locacao: NfeSolicitacao } | null>(null);
  const [nfMista, setNfMista] = useState(emptyNf());
  const [nfeAnexosMista, setNfeAnexosMista] = useState<File[]>([]);
  const [reciboMistaForm, setReciboMistaForm] = useState<any>(null);
  const [anexoManualMista, setAnexoManualMista] = useState<File[]>([]);

  // `r` é a linha em que o usuário clicou. Hoje uma OS mista nova sempre nasce como 1 registro
  // só (tipoNfe 'Locação + Serviço', ver confirmarSolicitacao) — as duas "visões" (Serviço/
  // Locação) apontam pro MESMO id, só o tipoNfe/valor variando; os bridges de arquivamento
  // continuam com ids diferentes (emitirNfe usa timestamp, gerarEArquivarRecibo usa o próprio
  // id) então não colidem entre si. Registro antigo de natureza única (de antes desta correção,
  // ou vindo de outro fluxo como a Medição) cai no caminho de baixo: usa o irmão já existente
  // se houver, ou sintetiza a partir dos valores calculados na OS.
  const abrirEmissaoMista = (r: NfeSolicitacao) => {
    let servicoSol: NfeSolicitacao;
    let locacaoSol: NfeSolicitacao;

    if (r.tipoNfe === 'Locação + Serviço') {
      servicoSol = { ...r, tipoNfe: 'NFe Serviço', valor: r.valorServico || 0 };
      locacaoSol = { ...r, tipoNfe: 'Nota de débito', valor: r.valorLocacao || 0 };
    } else {
      const chaveOs = r.os || r.contrato;
      const os = oss.find((o) => o.numero === chaveOs);
      if (!os) return;
      const outraNatureza = r.tipoNfe === 'Nota de débito' ? 'NFe Serviço' : 'Nota de débito';
      const outraExistente = nfeSolicitacoes.find(
        (x) => x.status === 'Aguardando emissão' && (x.os || x.contrato) === chaveOs && x.tipoNfe === outraNatureza,
      );
      servicoSol = r.tipoNfe === 'NFe Serviço' ? r : (outraExistente || construirSolicitacaoVirtual(os, 'NFe Serviço'));
      locacaoSol = r.tipoNfe === 'Nota de débito' ? r : (outraExistente || construirSolicitacaoVirtual(os, 'Nota de débito'));
    }

    setEmitindoMista({ servico: servicoSol, locacao: locacaoSol });
    setNfMista(construirNfParaSolicitacao(servicoSol));
    setNfeAnexosMista([]);
    setReciboMistaForm(construirReciboParaSolicitacao(locacaoSol));
    setAnexoManualMista([]);
  };
  const setNfMistaField = (k: string, v: string) => setNfMista((p) => ({ ...p, [k]: v }));

  const confirmarEmissaoMista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emitindoMista || nfeAnexosMista.length === 0 || !reciboMistaForm) return;
    setSalvando(true);
    try {
      // Sintetizada (id gerado agora, ainda não existe em `financeiro`) → precisa nascer como
      // solicitação de verdade ANTES de emitir/gerar em cima dela, senão a linha arquivada
      // nunca aparece na tabela (nfeSolicitacoes só deriva de registros tipo 'nfeReq' reais).
      const { servico, locacao } = emitindoMista;
      if (!nfeSolicitacoes.some((x) => x.id === servico.id)) {
        await addRecord({
          id: servico.id, tipo: 'nfeReq', status: 'Aguardando emissão', empresa: servico.empresa,
          os: servico.os, cliente: servico.cliente, valor: servico.valor, forma: servico.forma,
          dataEmitir: servico.dataEmitir, tipoNfe: 'NFe Serviço', anexos: [], contrato: servico.contrato,
        });
      }
      if (!nfeSolicitacoes.some((x) => x.id === locacao.id)) {
        await addRecord({
          id: locacao.id, tipo: 'nfeReq', status: 'Aguardando emissão', empresa: locacao.empresa,
          os: locacao.os, cliente: locacao.cliente, valor: locacao.valor, forma: locacao.forma,
          dataEmitir: locacao.dataEmitir, tipoNfe: 'Nota de débito', anexos: [], contrato: locacao.contrato,
        });
      }
      const okServico = await emitirNfeComAnexos(servico, nfMista, nfeAnexosMista);
      if (!okServico) return;
      const { ok: okLocacao, total } = await gerarEArquivarRecibo(reciboMistaForm, anexoManualMista, saveEntity);
      if (!okLocacao) {
        toast.error('NFe de Serviço arquivada, mas o Recibo de Locação não pôde ser gerado — tente novamente por esta mesma linha.');
        setEmitindoMista(null);
        return;
      }
      toast.success((total || 0) > 0
        ? 'NFe de Serviço e Recibo de Locação arquivados — Conta a Receber gerada para os dois.'
        : 'NFe de Serviço arquivada e Recibo de Locação salvo.');
      setEmitindoMista(null);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sf.cliente.trim()) return;

    // OS "Locação + Serviço": não tem um Tipo só — vira 2 solicitações (uma NFe Serviço, uma
    // Nota de débito), as duas na MESMA empresa da OS (não a que porventura ficou marcada no
    // Tipo de uma seleção anterior — a OS é que manda aqui). Cada valor é opcional: se só um
    // dos dois já é conhecido agora, solicita só esse; o outro pode ser lançado depois.
    if (osMista && osSelecionadaSf) {
      const valorServico = num(sf.valorServico);
      const valorLocacao = num(sf.valorLocacao);
      if (valorServico <= 0 && valorLocacao <= 0) return;
      setSalvando(true);
      try {
        // 1 registro só (tipoNfe 'Locação + Serviço', os 2 valores separados) — não 2 —
        // pra não duplicar linha na tabela; abrirEmissaoMista reconhece esse tipoNfe e monta
        // as duas tabelas (Serviço/Locação) a partir dele mesmo, cada uma com seu botão de
        // arquivamento reaproveitado (emitirNfe/gerarEArquivarRecibo), mas 1 clique só.
        await addRecord({
          id: genFinId('SNF'), tipo: 'nfeReq', status: 'Aguardando emissão',
          empresa: osSelecionadaSf.empresa, os: sf.os, cliente: sf.cliente,
          forma: sf.forma, dataEmitir: sf.dataEmitir, anexos: [], contrato: sf.os,
          tipoNfe: 'Locação + Serviço', valorServico, valorLocacao, valor: valorServico + valorLocacao,
        });
        fecharSolicitacao();
      } finally {
        setSalvando(false);
      }
      return;
    }

    if (!num(sf.valor)) return;
    setSalvando(true);
    try {
      await addRecord({
        id: genFinId('SNF'), tipo: 'nfeReq', status: 'Aguardando emissão',
        empresa: sf.empresa, os: sf.os, cliente: sf.cliente, valor: num(sf.valor),
        forma: sf.forma, dataEmitir: sf.dataEmitir, tipoNfe: sf.tipoNfe, anexos: [], contrato: sf.os,
      });
      fecharSolicitacao();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinCard>
      <Toolbar
        title="Solicitações e Emissão de NFe"
        hint={'Solicite a NFe/Recibo pelo popup da Medição aprovada ou pelo botão "Solicitar NFe e Recibo". Os cálculos de impostos abrem ao Emitir NFe.'}
        actions={<Btn variant="amber" onClick={() => setSolicitando(true)}><Plus size={15} /> Solicitar NFe e Recibo</Btn>}
      />
      <AlertBar>
        Toda NFe emitida exige vencimento do recebimento e o anexo da nota. Ao arquivar, cria a Conta a Receber.
        O <strong className="font-black">número da NFe é opcional</strong> na emissão — informe depois pelo botão da
        linha arquivada, e a conta a receber é atualizada junto.
      </AlertBar>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-white/30">Status</span>
        {STATUS_FILTROS_NFE.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all active:scale-95 ${
              statusFiltro === s
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/10'
                : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <DataTable
        minWidth={1200}
        head={<>
          <Th>Solicitação</Th><Th>{boldOS('OS')}</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Valor</Th>
          <Th>Data emitir</Th><Th>Tipo</Th><Th>Nº da NF</Th><Th>Emissão</Th><Th>Status</Th><Th>Anexos</Th><Th>Ação</Th>
        </>}
      >
        {solicitacoes.length === 0 ? (
          <EmptyRow cols={12} text={'Nenhuma solicitação de NFe (use o botão "Solicitar NFe e Recibo" ou peça pela Medição)'} />
        ) : solicitacoes.map((r) => {
          const nota = notaPorSolicitacao.get(r.id);
          const semNumero = Boolean(nota) && !String(nota.numero || '').trim();
          // Ainda não emitida e a data planejada já passou: chama atenção em vermelho.
          const emitirAtrasado = r.status !== 'Emitida e arquivada' && isOld(r.dataEmitir);
          const sigla = siglaTipoNfe(r.tipoNfe, r.empresa);
          const linhaLabel = sigla === 'R/L' ? 'Recibo' : sigla === 'N/D' ? 'Nota' : 'NFe';
          // OS "Locação + Serviço" (pela modalidade do negócio de origem, não pela existência
          // das 2 solicitações): qualquer uma das duas linhas abre a modal combinada.
          const linhaOsEhMista = osEhMista(r.os || r.contrato);
          return (
          <tr key={r.id} className={`transition-colors hover:bg-white/5 ${semNumero ? 'bg-amber-500/[0.06]' : ''}`}>
            <Td className="font-black text-white">{r.id}</Td>
            <Td>{r.os}</Td>
            <Td><CompanyTag empresa={String(r.empresa)} /></Td>
            <Td className="text-white">{r.cliente}</Td>
            <Td className="font-bold text-white">{money(num(r.valor))}</Td>
            {/* !text-rose-300: a base text-white/80 do Td vence a cor condicional em especificidade
                igual no Tailwind v4 — precisa do modificador important para a cor vermelha aparecer. */}
            <Td className={emitirAtrasado ? 'font-bold text-rose-300!' : ''}>{br(r.dataEmitir)}</Td>
            <Td>{sigla}</Td>
            <Td>
              {!nota
                ? <span className="text-white/30">—</span>
                : semNumero
                  ? <Pill tone="wait">Sem número</Pill>
                  : <span className="font-bold text-white">{sigla} {nota.numero}</span>}
            </Td>
            <Td>{nota?.emissao ? br(nota.emissao) : <span className="text-white/30">—</span>}</Td>
            <Td><StatusTag status={r.status} /></Td>
            <Td className="whitespace-normal"><AnexosCell anexos={r.anexos} /></Td>
            <Td>
              <div className="flex items-center gap-2">
                {/* NFe/Recibo/Nota usam a MESMA modal de emissão (abrirEmissao) — só o título e
                    o botão extra "Preencher/editar" variam por natureza (ver emitindoEhRecibo no
                    JSX da modal). OS mista: qualquer uma das duas linhas abre a modal combinada. */}
                {r.status === 'Aguardando emissão'
                  ? (
                    <Btn small variant="amber" onClick={() => (linhaOsEhMista ? abrirEmissaoMista(r) : abrirEmissao(r))}>
                      {linhaOsEhMista ? 'Emitir NFe e Recibo' : `Emitir ${linhaLabel}`}
                    </Btn>
                  )
                  : <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><FileCheck2 size={13} /> Arquivada</span>}
                {/* Nota/recibo já arquivado: permite preencher/corrigir o número depois. */}
                {nota && (
                  <Btn small variant={semNumero ? 'amber' : 'secondary'} onClick={() => abrirEdicaoNota(nota)}>
                    <Hash size={12} /> {semNumero ? 'Informar nº' : 'Editar nº'}
                  </Btn>
                )}
                {/* Ainda não emitido: dá para ajustar o prazo planejado. */}
                {r.status === 'Aguardando emissão' && (
                  <Btn small variant="secondary" onClick={() => abrirEdicaoData(r)}>
                    <CalendarClock size={12} /> Alterar data
                  </Btn>
                )}
                <DeleteBtn
                  titulo="Excluir solicitação de NFe"
                  descricao={
                    r.status === 'Emitida e arquivada'
                      ? `${r.id} — ${r.cliente} — ${money(num(r.valor))}\n\nA nota já foi emitida. Excluir remove apenas a SOLICITAÇÃO: a NFe emitida e a conta a receber gerada continuam existindo e precisam ser excluídas nas telas delas, se for o caso.`
                      : `${r.id} — ${r.cliente} — ${money(num(r.valor))}\n\nA solicitação sairá da fila de emissão.`
                  }
                  onConfirm={() => deleteRecord(r.id)}
                />
              </div>
            </Td>
          </tr>
          );
        })}
      </DataTable>

      {/* MODAL: Emitir NFe/Recibo/Nota — mesma modal pras 3 naturezas (ver abrirEmissao). */}
      {emitindo && (() => {
        const emitindoEhRecibo = emitindo.tipoNfe === 'Nota de débito';
        const emitindoSigla = siglaTipoNfe(emitindo.tipoNfe, emitindo.empresa);
        const emitindoLabel = emitindoSigla === 'R/L' ? 'Recibo' : emitindoSigla === 'N/D' ? 'Nota' : 'NFe';
        return (
          <FinModal
            wide
            title={`Emitir ${emitindoLabel} — ${emitindo.os}`}
            hint={emitindoEhRecibo
              ? 'Informe os % de imposto que se aplicam (opcional) e salve. Quem gera o documento, anexa e arquiva — criando a Conta a Receber já com esses impostos — é o botão "Emitir, anexar e arquivar" dentro de "Preencher / editar".'
              : 'Preencha os dados da nota. Ao arquivar, cria a Conta a Receber.'}
            onClose={() => setEmitindo(null)}
          >
            <form className="grid grid-cols-12 gap-4" onSubmit={emitindoEhRecibo ? salvarRascunhoImpostos : confirmarEmissao}>
              <EmissaoServicoFields nf={nf} setNfField={setNfField} />

              {/* NFe de Serviço arquiva aqui mesmo — precisa do anexo da nota. Recibo/Nota não
                  arquiva mais nesta modal (vira rascunho só de imposto); o anexo de arquivamento
                  fica pra "Emitir, anexar e arquivar" dentro de "Preencher/editar". */}
              {!emitindoEhRecibo && (
                <Field label="NFe emitida (anexo obrigatório)" span={12}>
                  <FileInput label="Anexar PDF / XML / imagem da NFe emitida" value={nfeAnexos} onChange={setNfeAnexos} />
                </Field>
              )}

              <div className="col-span-12 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Btn type="button" variant="secondary" onClick={() => window.open('https://www.nfse.gov.br/EmissorNacional/Login', '_blank', 'noopener,noreferrer')}>
                    <ExternalLink size={15} /> Emissor Nacional NFSe
                  </Btn>
                  {/* Documento de verdade do Recibo/Nota de Locação (itens, emitente,
                      destinatário) — só existe pra Recibo/Nota; NFe de Serviço não tem. É lá
                      que agora mora o "Emitir, anexar e arquivar" de verdade. */}
                  {emitindoEhRecibo && (
                    <Btn type="button" variant="secondary" onClick={() => abrirPreencherRecibo(emitindo)}>
                      <Pencil size={15} /> Preencher / editar
                    </Btn>
                  )}
                </div>
                <div className="flex gap-2">
                  <Btn type="button" variant="ghost" onClick={() => setEmitindo(null)}>Cancelar</Btn>
                  {emitindoEhRecibo ? (
                    <Btn type="submit" variant="green" disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </Btn>
                  ) : (
                    <Btn type="submit" variant="green" disabled={salvando || nfeAnexos.length === 0}>
                      <FileCheck2 size={15} /> {salvando ? 'Arquivando...' : 'Emitir, anexar e arquivar'}
                    </Btn>
                  )}
                </div>
              </div>
            </form>
          </FinModal>
        );
      })()}

      {/* MODAL: Emitir NFe e Recibo (OS "Locação + Serviço") — as duas tabelas (Serviço +
          documento de Recibo de Locação) juntas, um botão só arquiva as duas de uma vez. */}
      {emitindoMista && (
        <FinModal
          wide
          title={`Emitir NFe e Recibo — OS mista (${emitindoMista.servico.os})`}
          hint="Preencha as duas tabelas abaixo. Ao arquivar, cria a Conta a Receber da NFe de Serviço e do Recibo de Locação."
          onClose={() => setEmitindoMista(null)}
        >
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarEmissaoMista}>
            <div className="col-span-12">
              <p className="mb-3 text-sm font-black uppercase tracking-widest text-amber-300">Tabela 1 — Serviço</p>
              <div className="grid grid-cols-12 gap-4">
                <EmissaoServicoFields nf={nfMista} setNfField={setNfMistaField} />
                <Field label="NFe emitida (anexo obrigatório)" span={12}>
                  <FileInput label="Anexar PDF / XML / imagem da NFe emitida" value={nfeAnexosMista} onChange={setNfeAnexosMista} />
                </Field>
              </div>
            </div>

            <div className="col-span-12 border-t border-white/10 pt-6">
              <p className="mb-3 text-sm font-black uppercase tracking-widest text-cyan-300">Tabela 2 — Locação</p>
              <ReciboLocacaoFormFields
                form={reciboMistaForm}
                setForm={setReciboMistaForm}
                config={config}
                anexoManual={anexoManualMista}
                setAnexoManual={setAnexoManualMista}
              />
            </div>

            <div className="col-span-12 flex justify-end gap-2 border-t border-white/10 pt-4">
              <Btn type="button" variant="ghost" onClick={() => setEmitindoMista(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando || nfeAnexosMista.length === 0}>
                <FileCheck2 size={15} /> {salvando ? 'Arquivando...' : 'Emitir e arquivar (Serviço + Locação)'}
              </Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: informar / corrigir o número da NFe já arquivada */}
      {editandoNota && (
        <FinModal
          title="Número da nota fiscal"
          hint="Preencha quando o número sair do emissor. A conta a receber gerada por esta nota é atualizada junto."
          onClose={() => setEditandoNota(null)}
        >
          <form className="grid grid-cols-12 gap-4" onSubmit={salvarNota}>
            <Field label="Cliente" span={8}><Input value={String(editandoNota.cliente || '')} disabled /></Field>
            <Field label="Valor original" span={4}><Input value={money(num(editandoNota.original))} disabled /></Field>

            <Field label="Nº da NFe" span={6}>
              <Input
                autoFocus
                value={notaForm.numero}
                onChange={(e) => setNotaForm((p) => ({ ...p, numero: e.target.value }))}
                placeholder="Ex.: 1042"
              />
            </Field>
            <Field label="Data de emissão" span={6}>
              <Input type="date" value={notaForm.emissao} onChange={(e) => setNotaForm((p) => ({ ...p, emissao: e.target.value }))} />
            </Field>

            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setEditandoNota(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: alterar a data planejada para emitir */}
      {editandoData && (
        <FinModal
          title="Alterar data para emitir"
          hint="Ajusta o prazo planejado para emissão desta solicitação."
          onClose={() => setEditandoData(null)}
        >
          <form className="grid grid-cols-12 gap-4" onSubmit={salvarDataEmitir}>
            <Field label="Cliente" span={8}><Input value={String(editandoData.cliente || '')} disabled /></Field>
            <Field label="Valor" span={4}><Input value={money(num(editandoData.valor))} disabled /></Field>

            <Field label="Data para emitir" span={6}>
              <Input
                type="date"
                autoFocus
                value={dataEmitirForm}
                onChange={(e) => setDataEmitirForm(e.target.value)}
              />
            </Field>

            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setEditandoData(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: Solicitar NFe e Recibo (manual) */}
      {solicitando && (
        <FinModal title="Solicitar NFe e Recibo" hint="Lançamento manual de solicitação de NFe/Recibo." onClose={fecharSolicitacao}>
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarSolicitacao}>
            <Field label={boldOS('OS')} span={4}>
              <Select value={sf.os} onChange={(e) => escolherOs(e.target.value)}>
                <option value="">{oss.length ? 'Selecione...' : 'Nenhuma OS'}</option>
                {oss.map((o, i) => <option key={`${o.numero}-${i}`} value={o.numero}>{o.numero} - {o.cliente}</option>)}
              </Select>
            </Field>
            <Field label="Tipo" span={8}>
              {osMista ? (
                // OS de modalidade "Locação + Serviço": não tem UM tipo — a solicitação vira 2
                // (uma de cada natureza), as duas na empresa da própria OS. Ver os 2 campos de
                // valor logo abaixo, que substituem o "Valor NFe" único neste caso.
                <div className="flex h-12 items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200">
                  OS de Locação + Serviço ({osSelecionadaSf!.empresa}) — gera NFe (Serviço) + {siglaTipoNfe('Nota de débito', osSelecionadaSf!.empresa)} (Locação)
                </div>
              ) : (
                <Select
                  value={tiposSolicitacao.find((t) => t.tipoNfe === sf.tipoNfe && t.empresa === sf.empresa)?.value || tiposSolicitacao[0].value}
                  onChange={(e) => {
                    const escolhido = tiposSolicitacao.find((t) => t.value === e.target.value);
                    if (!escolhido) return;
                    setSf((p) => ({ ...p, tipoNfe: escolhido.tipoNfe, empresa: escolhido.empresa }));
                  }}
                >
                  {tiposSolicitacao.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              )}
            </Field>

            <Field label="Cliente" span={6}>
              <Select value={clienteOpcao} onChange={(e) => escolherCliente(e.target.value)}>
                <option value="">{clientesOrdenados.length ? 'Selecione o cliente...' : 'Nenhum cliente cadastrado'}</option>
                {clientesOrdenados.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={CLIENTE_OUTRO}>Outro (não cadastrado)…</option>
              </Select>
              {clienteOpcao === CLIENTE_OUTRO && (
                <Input
                  className="mt-2"
                  value={sf.cliente}
                  onChange={(e) => setSfField('cliente', e.target.value)}
                  placeholder="Nome do cliente"
                />
              )}
            </Field>
            {osMista ? (
              <>
                <Field label="Valor Serviço" span={3}><MoneyInput value={sf.valorServico} onChange={(v) => setSfField('valorServico', v)} /></Field>
                <Field label="Valor Locação" span={3}><MoneyInput value={sf.valorLocacao} onChange={(v) => setSfField('valorLocacao', v)} /></Field>
              </>
            ) : (
              <Field label="Valor NFe" span={3}><MoneyInput value={sf.valor} onChange={(v) => setSfField('valor', v)} /></Field>
            )}
            <Field label="Data para emitir" span={3}><Input type="date" value={sf.dataEmitir} onChange={(e) => setSfField('dataEmitir', e.target.value)} /></Field>
            <Field label="Forma de recebimento" span={12}>
              <Select value={sf.forma} onChange={(e) => setSfField('forma', e.target.value)}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={fecharSolicitacao}>Cancelar</Btn>
              <Btn
                type="submit"
                variant="amber"
                disabled={salvando || !sf.cliente.trim() || (osMista ? (num(sf.valorServico) <= 0 && num(sf.valorLocacao) <= 0) : !num(sf.valor))}
              >
                Enviar para NFe
              </Btn>
            </div>
          </form>
        </FinModal>
      )}

      {reciboForm && (
        <ReciboLocacaoFormModal
          reciboInicial={reciboForm}
          onClose={() => setReciboForm(null)}
          onSaved={aoSalvarRecibo}
        />
      )}
    </FinCard>
  );
}
