import React, { useEffect, useState } from 'react';
import { Send, CheckCircle2, Plus, Repeat, X } from 'lucide-react';
import { FinCard, Toolbar, Field, Input, MoneyInput, Select, Textarea, FileInput, Btn, boldOS } from '../finUi';
import {
  todayStr, genFinId, num, money, FORMAS_PAGAMENTO, TIPOS_REEMBOLSO, PERIODICIDADES_FATURADO,
  calcularValoresParcelas, gerarParcelasFaturado, proximoPeriodoFaturado, vencimentoNoMesFaturado,
  solicitacaoDuplicada, type PeriodicidadeFaturado, type FaturadoParcela,
} from '../finData';
import { useFin } from '../useFin';
import { uploadDocumento } from '../../../../../services/documentosService';
import { toast } from 'sonner';

const fornecedorNome = (f: any) =>
  f?.razaoSocial || f?.razao_social || f?.nomeFantasia || f?.nome_fantasia || f?.nome || '';

// Todo campo deste formulário é obrigatório — marca visualmente o label, mesmo padrão de
// asterisco vermelho já usado em outras telas do sistema (ex.: Compras/Requisições).
const req = (label: React.ReactNode): React.ReactNode => (
  <>{label} <span className="text-red-400">*</span></>
);

const formVazio = (empresaPadrao: string, nomeSolicitante: string) => ({
  empresa: empresaPadrao,
  // Preenchido a partir do usuário logado, não digitado — ver comentário no campo no JSX.
  solicitante: nomeSolicitante,
  tipo: 'Material',
  vinculoValor: '',
  fornecedor: '',
  documento: '',
  valor: '',
  compra: todayStr,
  vencimento: todayStr,
  forma: '',
  descricao: '',
});

// Faturado: uma única Nota Fiscal, com o valor total dividido em N parcelas — cada parcela
// com seu PRÓPRIO boleto, todos anexados já na criação (nada fica pendente pra depois).
// `boletoFile` é o arquivo escolhido nesta sessão; `anexoUrlExistente` é o que já tinha sido
// enviado antes (edição de uma solicitação reprovada) — ver abrirEdicao.
interface ParcelaFaturadoEdit {
  numero: number;
  periodo: string;    // yyyy-mm
  vencimento: string;  // yyyy-mm-dd
  valor: number;
  boletoFile: File | null;
  anexoUrlExistente?: string;
  anexoUrl?: string; // preenchido só no momento do envio, depois do upload
}

const faturadoVazio = () => ({
  notaFiscalNumero: '',
  notaFiscalValor: '',
  periodicidade: 'mensal' as PeriodicidadeFaturado,
  diaVencimento: '10',
  inicio: todayStr,
  quantidadeParcelas: '1',
});

export function SolicitacaoView() {
  const {
    empresas, oss, fornecedores, financeiro, userSession, addSolicitacao, reenviarSolicitacao,
    pendingEditSolicitacaoId, setPendingEditSolicitacaoId,
  } = useFin();
  const vinculo = 'OS' as const;
  const [anexos, setAnexos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState<'' | 'criada' | 'reenviada'>('');

  const nomeUsuarioLogado = userSession?.nome || userSession?.email || '';
  const [form, setForm] = useState(formVazio(empresas[0] || 'Linave', nomeUsuarioLogado));
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Faturado: painel da Nota Fiscal + configuração das parcelas + a lista de parcelas em si
  // (cada uma com seu próprio arquivo de boleto). Trocar pra outra forma de pagamento limpa
  // tudo isso — não faz sentido carregar uma NF junto de uma solicitação que não é Faturado.
  const [faturadoForm, setFaturadoForm] = useState(faturadoVazio());
  const setFaturado = (k: string, v: string) => setFaturadoForm((p) => ({ ...p, [k]: v }));
  const [notaFiscalArquivo, setNotaFiscalArquivo] = useState<File | null>(null);
  const [notaFiscalArquivoExistente, setNotaFiscalArquivoExistente] = useState('');
  const [parcelasFaturado, setParcelasFaturado] = useState<ParcelaFaturadoEdit[]>([]);
  const setForma = (value: string) => {
    set('forma', value);
    if (value !== 'Parcelado') {
      setFaturadoForm(faturadoVazio());
      setNotaFiscalArquivo(null);
      setNotaFiscalArquivoExistente('');
      setParcelasFaturado([]);
    }
  };

  const ultimoVencimentoFaturado = parcelasFaturado.length ? parcelasFaturado[parcelasFaturado.length - 1].vencimento : '';
  const somaParcelasFaturado = parcelasFaturado.reduce((soma, p) => soma + (Number(p.valor) || 0), 0);
  const previewDivisaoFaturado = (() => {
    const valorTotal = num(faturadoForm.notaFiscalValor);
    const quantidade = Number(faturadoForm.quantidadeParcelas);
    if (valorTotal <= 0 || !quantidade) return 'Informe o valor total e a quantidade de parcelas.';
    const valores = calcularValoresParcelas(valorTotal, quantidade);
    const iguais = valores.every((v) => v === valores[0]);
    return iguais
      ? `A Nota Fiscal de ${money(valorTotal)} será dividida em ${quantidade} parcela(s) de ${money(valores[0])}.`
      : `A Nota Fiscal de ${money(valorTotal)} será dividida em ${quantidade} parcelas. Os centavos serão distribuídos automaticamente para que a soma das parcelas permaneça exatamente igual à NF.`;
  })();

  const gerarParcelas = () => {
    const valorTotal = num(faturadoForm.notaFiscalValor);
    const quantidade = Number(faturadoForm.quantidadeParcelas);
    const dia = Number(faturadoForm.diaVencimento);
    if (valorTotal <= 0) { toast.error('Informe o valor total da Nota Fiscal.'); return; }
    if (!quantidade || quantidade < 1) { toast.error('Informe a quantidade de parcelas.'); return; }
    if (!faturadoForm.inicio) { toast.error('Informe a data de início.'); return; }
    if (!dia || dia < 1 || dia > 31) { toast.error('Informe um dia de vencimento entre 1 e 31.'); return; }

    const geradas = gerarParcelasFaturado({
      periodicidade: faturadoForm.periodicidade,
      diaVencimento: dia,
      inicio: faturadoForm.inicio,
      quantidade,
      valorTotal,
    });
    setParcelasFaturado(geradas.map((p) => ({ numero: p.numero, periodo: p.periodo, vencimento: p.vencimento, valor: p.valor, boletoFile: null })));
  };

  // Adiciona uma parcela manualmente (além do "Gerar parcelas") — a próxima competência é
  // calculada a partir da última linha, e o valor total é redistribuído entre todas.
  const adicionarParcelaManual = () => {
    let periodo = '';
    let vencimento = '';
    if (parcelasFaturado.length) {
      const ultima = parcelasFaturado[parcelasFaturado.length - 1];
      const proximaReferencia = proximoPeriodoFaturado(`${ultima.periodo || faturadoForm.inicio.slice(0, 7)}-01`, faturadoForm.periodicidade);
      periodo = proximaReferencia.slice(0, 7);
      vencimento = vencimentoNoMesFaturado(proximaReferencia, Number(faturadoForm.diaVencimento) || 1);
    }
    const proximaLista = [...parcelasFaturado, { numero: parcelasFaturado.length + 1, periodo, vencimento, valor: 0, boletoFile: null }];
    const valores = calcularValoresParcelas(num(faturadoForm.notaFiscalValor), proximaLista.length);
    setFaturado('quantidadeParcelas', String(proximaLista.length));
    setParcelasFaturado(proximaLista.map((p, i) => ({ ...p, numero: i + 1, valor: valores[i] })));
  };

  const removerParcelaFaturado = (index: number) => {
    const proximaLista = parcelasFaturado.filter((_, i) => i !== index);
    const valores = calcularValoresParcelas(num(faturadoForm.notaFiscalValor), proximaLista.length || 1);
    setFaturado('quantidadeParcelas', String(proximaLista.length || 1));
    setParcelasFaturado(proximaLista.map((p, i) => ({ ...p, numero: i + 1, valor: valores[i] ?? 0 })));
  };

  const limparParcelasFaturado = () => setParcelasFaturado([]);

  const atualizarParcelaFaturado = (index: number, patch: Partial<ParcelaFaturadoEdit>) => {
    setParcelasFaturado((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  // Edição: reabre uma solicitação já enviada (reprovada) com os mesmos dados, pra corrigir
  // e reenviar sem perder o vínculo com o registro original (mesmo id, mesmos anexos se não trocar).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [anexosExistentes, setAnexosExistentes] = useState<string[]>([]);

  const abrirEdicao = (sol: any) => {
    setEditandoId(sol.id);
    setAnexosExistentes(Array.isArray(sol.anexos) ? sol.anexos : []);
    setAnexos([]);
    setForm({
      empresa: sol.empresa || empresas[0] || 'Linave',
      solicitante: sol.solicitante || '',
      tipo: sol.tipoPagamento || 'Material',
      vinculoValor: sol.vinculoValor || '',
      fornecedor: sol.fornecedor || '',
      documento: sol.documento || '',
      valor: String(sol.valor ?? ''),
      compra: sol.compra || todayStr,
      vencimento: sol.vencimento || todayStr,
      forma: sol.forma || '',
      descricao: sol.descricao || '',
    });
    if (sol.forma === 'Parcelado' && sol.faturado) {
      setFaturadoForm({
        notaFiscalNumero: sol.faturado.notaFiscal?.numero || '',
        notaFiscalValor: String(sol.faturado.notaFiscal?.valorTotal ?? ''),
        periodicidade: sol.faturado.periodicidade || 'mensal',
        diaVencimento: String(sol.faturado.diaVencimento || '10'),
        inicio: sol.faturado.inicio || todayStr,
        quantidadeParcelas: String(sol.faturado.parcelas?.length || 1),
      });
      setNotaFiscalArquivo(null);
      setNotaFiscalArquivoExistente(sol.faturado.notaFiscal?.anexoUrl || '');
      setParcelasFaturado((Array.isArray(sol.faturado.parcelas) ? sol.faturado.parcelas : []).map((p: FaturadoParcela) => ({
        numero: p.numero, periodo: p.periodo, vencimento: p.vencimento, valor: p.valor,
        boletoFile: null, anexoUrlExistente: p.anexoUrl,
      })));
    } else {
      setFaturadoForm(faturadoVazio());
      setNotaFiscalArquivo(null);
      setNotaFiscalArquivoExistente('');
      setParcelasFaturado([]);
    }
    setOk('');
  };

  // Chegou da tela "Meus Pagamentos" com o pedido de editar uma solicitação reprovada
  // específica — abre o formulário já naquele registro assim que ele existir na lista.
  useEffect(() => {
    if (!pendingEditSolicitacaoId) return;
    const alvo = (Array.isArray(financeiro) ? financeiro : []).find((r: any) => r.id === pendingEditSolicitacaoId);
    if (alvo) {
      abrirEdicao(alvo);
      setPendingEditSolicitacaoId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditSolicitacaoId, financeiro]);

  const cancelarEdicao = () => {
    setEditandoId(null);
    setAnexosExistentes([]);
    setAnexos([]);
    setForm(formVazio(empresas[0] || 'Linave', nomeUsuarioLogado));
    setFaturadoForm(faturadoVazio());
    setNotaFiscalArquivo(null);
    setNotaFiscalArquivoExistente('');
    setParcelasFaturado([]);
  };

  // Todos os campos são obrigatórios (inclusive pelo menos 1 anexo), exceto a OS emitida —
  // sem isso a solicitação chegava incompleta pra quem aprova (sem descrição, sem forma de
  // pagamento definida...) e só se descobria o que faltava depois.
  const camposFaltando = (): string[] => {
    const faltando: string[] = [];
    if (!form.empresa) faltando.push('Empresa');
    if (!form.solicitante.trim()) faltando.push('Solicitante');
    if (!form.tipo) faltando.push('Tipo (reembolso/adiantamento)');
    if (!form.fornecedor.trim()) faltando.push('Fornecedor / beneficiário');
    // Faturado usa o Número da Nota Fiscal como documento — o campo solto some do formulário
    // (ver JSX) pra não pedir a mesma informação duas vezes.
    if (form.forma !== 'Parcelado' && !form.documento.trim()) faltando.push('Documento');
    if (!form.compra) faltando.push('Data compra');
    if (!form.forma) faltando.push('Forma solicitada');
    if (!form.descricao.trim()) faltando.push('Descrição');

    if (form.forma === 'Parcelado') {
      if (!faturadoForm.notaFiscalNumero.trim()) faltando.push('Número da Nota Fiscal');
      if (!num(faturadoForm.notaFiscalValor)) faltando.push('Valor total da Nota Fiscal');
      if (!notaFiscalArquivo && !notaFiscalArquivoExistente) faltando.push('Anexar Nota Fiscal');
      const dia = Number(faturadoForm.diaVencimento);
      if (!dia || dia < 1 || dia > 31) faltando.push('Dia do vencimento');
      if (!faturadoForm.inicio) faltando.push('Início');
      if (parcelasFaturado.length === 0) {
        faltando.push('Gerar ao menos 1 parcela');
      } else {
        // Cada parcela precisa do próprio boleto — é o que diferencia Faturado de uma
        // conta parcelada comum, onde só a mãe tem documento.
        parcelasFaturado.forEach((p, i) => {
          if (!p.periodo) faltando.push(`Período da parcela ${i + 1}`);
          if (!p.vencimento) faltando.push(`Vencimento da parcela ${i + 1}`);
          if (!p.boletoFile && !p.anexoUrlExistente) faltando.push(`Boleto da parcela ${i + 1}`);
        });
      }
    } else {
      if (!num(form.valor)) faltando.push('Valor');
      if (!form.vencimento) faltando.push('Vencimento');
      if (anexos.length === 0 && anexosExistentes.length === 0) faltando.push('Anexar documento / imagem');
    }

    return faltando;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const faltando = camposFaltando();
    if (faltando.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${faltando.join(', ')}.`);
      return;
    }
    // Bloqueia duplicidade: mesma nota (documento) pro mesmo fornecedor não pode virar uma
    // segunda solicitação — evita aprovar duas vezes e pagar a mesma nota em duplicidade.
    // Faturado usa o Número da Nota Fiscal como "documento" pra essa checagem.
    const documentoParaChecagem = form.forma === 'Parcelado' ? faturadoForm.notaFiscalNumero.trim() : form.documento.trim();
    if (solicitacaoDuplicada(financeiro, {
      fornecedor: form.fornecedor,
      documento: documentoParaChecagem,
      selfId: editandoId,
    })) {
      toast.error(`Já existe uma solicitação (ou conta a pagar) com o documento "${documentoParaChecagem}" para o fornecedor ${form.fornecedor.trim()}.`);
      return;
    }
    setSalvando(true);
    try {
      const idAlvo = editandoId || genFinId('SP');
      let anexosUrls: string[] = editandoId ? anexosExistentes : [];
      let notaFiscalUrl = notaFiscalArquivoExistente;
      let parcelasFinal = parcelasFaturado;

      if (form.forma === 'Parcelado') {
        // Só sobe arquivo novo se o usuário trocou; senão mantém o que já estava salvo
        // (mesma regra do anexo genérico, aplicada aqui à NF e a cada boleto de parcela).
        if (notaFiscalArquivo) {
          const up = await uploadDocumento(notaFiscalArquivo, { vinculoTipo: 'financeiro', vinculoId: idAlvo, categoria: 'fin_anexo' });
          notaFiscalUrl = up.url;
        }
        const uploadsParcelas = await Promise.allSettled(
          parcelasFaturado.map((p) => (
            p.boletoFile
              ? uploadDocumento(p.boletoFile, { vinculoTipo: 'financeiro', vinculoId: idAlvo, categoria: 'fin_anexo' })
              : Promise.resolve(null)
          ))
        );
        const falhasParcelas = uploadsParcelas.filter((r) => r.status === 'rejected').length;
        if (falhasParcelas > 0) toast.error(`${falhasParcelas} boleto(s) de parcela não puderam ser enviados.`);
        parcelasFinal = parcelasFaturado.map((p, i) => {
          const resultado = uploadsParcelas[i];
          const url = resultado.status === 'fulfilled' && resultado.value ? (resultado.value as any).url : p.anexoUrlExistente;
          return { ...p, anexoUrl: url };
        });
      } else if (anexos.length) {
        const resultados = await Promise.allSettled(
          anexos.map((file) => uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: idAlvo, categoria: 'fin_anexo' }))
        );
        anexosUrls = resultados
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value.url);
        const falhas = resultados.length - anexosUrls.length;
        if (falhas > 0) toast.error(`${falhas} anexo(s) não puderam ser enviados.`);
      }

      const dados = {
        empresa: form.empresa,
        solicitante: form.solicitante,
        solicitanteCpf: userSession?.cpf || '',
        solicitanteEmail: userSession?.email || '',
        tipoPagamento: form.tipo,
        vinculoTipo: vinculo,
        // Sem fallback pra "primeira OS da lista": se o campo ficar em branco, o vínculo
        // tem que ficar em branco também — do contrário a solicitação aparecia vinculada
        // a uma OS que ninguém escolheu (a primeira da lista, sempre a mesma).
        vinculoValor: form.vinculoValor,
        fornecedor: form.fornecedor,
        documento: documentoParaChecagem,
        // Faturado: valor = total da NF, vencimento = vencimento da 1ª parcela (a mais
        // próxima) — a solicitação inteira (NF + todas as parcelas, já com boleto) entra
        // de uma vez na fila de aprovação.
        valor: form.forma === 'Parcelado' ? num(faturadoForm.notaFiscalValor) : num(form.valor),
        compra: form.compra,
        vencimento: form.forma === 'Parcelado' ? (parcelasFinal[0]?.vencimento || form.compra) : form.vencimento,
        forma: form.forma,
        descricao: form.descricao,
        anexos: form.forma === 'Parcelado' ? (notaFiscalUrl ? [notaFiscalUrl] : []) : anexosUrls,
        ...(form.forma === 'Parcelado' ? {
          faturado: {
            notaFiscal: { numero: faturadoForm.notaFiscalNumero.trim(), valorTotal: num(faturadoForm.notaFiscalValor), anexoUrl: notaFiscalUrl },
            periodicidade: faturadoForm.periodicidade,
            diaVencimento: Number(faturadoForm.diaVencimento) || 1,
            inicio: faturadoForm.inicio,
            parcelas: parcelasFinal.map((p) => ({ numero: p.numero, periodo: p.periodo, vencimento: p.vencimento, valor: p.valor, anexoUrl: p.anexoUrl })),
          },
        } : {}),
      };

      if (editandoId) {
        // reenviarSolicitacao pode falhar (ex.: sem permissão do módulo Financeiro) e
        // já avisa por toast sozinho (comFinanceiroAtual) — sem checar o retorno aqui,
        // a tela dizia "Reenviada" e fechava a edição mesmo sem ter salvo nada.
        const ok = await reenviarSolicitacao(editandoId, dados);
        if (!ok) return;
        setOk('reenviada');
        toast.success('Solicitação reenviada para aprovação com sucesso.');
        cancelarEdicao();
      } else {
        await addSolicitacao({ id: idAlvo, tipo: 'solicitacao', status: 'Aguardando aprovação', ...dados });
        setOk('criada');
        toast.success('Solicitação enviada para aprovação com sucesso.');
        setForm((p) => ({ ...p, fornecedor: '', documento: '', valor: '', forma: '', descricao: '' }));
        setAnexos([]);
        setFaturadoForm(faturadoVazio());
        setNotaFiscalArquivo(null);
        setNotaFiscalArquivoExistente('');
        setParcelasFaturado([]);
      }
      setTimeout(() => setOk(''), 3000);
    } catch (error: any) {
      // addSolicitacao (criação) propaga erro em vez de engolir — sem isso, um 403/409/
      // erro de rede fazia o botão "Enviar" voltar ao normal sem nenhum aviso, como se
      // o clique não tivesse feito nada.
      const mensagem = error?.response?.data?.error;
      toast.error(typeof mensagem === 'string' ? mensagem : 'Não foi possível enviar a solicitação. Verifique sua conexão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <FinCard>
        <Toolbar
          title={editandoId ? `Editar solicitação ${editandoId}` : 'Solicitação de Pagamento'}
          hint={editandoId ? 'Corrija os dados e reenvie para aprovação.' : 'Sem cotação e sem banco. Após aprovada, vira Conta a Pagar. (Vínculos e fornecedores são dados reais do ERP.)'}
          actions={
            ok === 'criada' ? <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-300"><CheckCircle2 size={15} /> Enviada para aprovação</span>
              : ok === 'reenviada' ? <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-300"><CheckCircle2 size={15} /> Reenviada para aprovação</span>
              : undefined
          }
        />
        <form className="grid grid-cols-12 gap-4" onSubmit={enviar}>
          <Field label={req('Empresa')} span={3}>
            <Select value={form.empresa} onChange={(e) => set('empresa', e.target.value)}>
              {empresas.map((emp) => <option key={emp}>{emp}</option>)}
            </Select>
          </Field>
          <Field label={req('Solicitante')} span={3}>
            <Input
              value={form.solicitante}
              disabled
              className="bg-white/5 cursor-not-allowed opacity-70"
              title="Preenchido automaticamente com o usuário logado — não pode ser digitado, pra esse campo servir de filtro confiável em Meus Pagamentos."
            />
          </Field>
          <Field label={req('Tipo (reembolso/adiantamento)')} span={3}>
            <Select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>{TIPOS_REEMBOLSO.map((t) => <option key={t}>{t}</option>)}</Select>
          </Field>
          <Field label={boldOS('OS emitida')} span={3}>
            <Select value={form.vinculoValor} onChange={(e) => set('vinculoValor', e.target.value)}>
              <option value="">{oss.length ? 'Selecione...' : 'Nenhuma OS no ERP'}</option>
              {oss.map((o, i) => <option key={`${o.numero}-${i}`} value={o.numero}>{o.numero} - {o.cliente}</option>)}
            </Select>
          </Field>
          <Field label={req('Fornecedor / beneficiário')} span={6}>
            <Input
              list="fin-fornecedores"
              value={form.fornecedor}
              onChange={(e) => set('fornecedor', e.target.value)}
              placeholder="Fornecedor / beneficiário"
            />
            <datalist id="fin-fornecedores">
              {fornecedores.map((f, i) => <option key={i} value={fornecedorNome(f)} />)}
            </datalist>
          </Field>
          {form.forma !== 'Parcelado' && (
            <Field label={req('Documento')} span={3}>
              <Input value={form.documento} onChange={(e) => set('documento', e.target.value)} placeholder="Nº único do boleto" />
              <p className="mt-1 text-[10px] leading-tight text-white/40">Se for boleto, use o Nosso Número ou a linha digitável — é o que evita pagar a mesma nota duas vezes.</p>
            </Field>
          )}

          {form.forma !== 'Parcelado' && (
            <>
              <Field label={req('Valor')} span={3}><MoneyInput value={form.valor} onChange={(v) => set('valor', v)} /></Field>
              <Field label={req('Data compra')} span={3}><Input type="date" value={form.compra} onChange={(e) => set('compra', e.target.value)} /></Field>
              <Field label={req('Vencimento')} span={3}><Input type="date" value={form.vencimento} onChange={(e) => set('vencimento', e.target.value)} /></Field>
            </>
          )}
          {form.forma === 'Parcelado' && (
            <Field label={req('Data compra')} span={3}><Input type="date" value={form.compra} onChange={(e) => set('compra', e.target.value)} /></Field>
          )}
          <Field label={req('Forma solicitada')} span={3}>
            <Select value={form.forma} onChange={(e) => setForma(e.target.value)}>
              <option value="">Selecione...</option>
              {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
            </Select>
          </Field>

          {form.forma === 'Parcelado' ? (
            <div className="col-span-12 space-y-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-base font-black text-white">Pagamento faturado</p>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/50">
                    Uma solicitação faturada possui uma única Nota Fiscal. O valor total da Nota Fiscal pode ser dividido em várias parcelas, sendo necessário anexar um boleto específico para cada parcela.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-200">1 NF • Vários boletos</span>
              </div>

              {/* Nota Fiscal */}
              <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-amber-300">Nota Fiscal</p>
                <div className="grid grid-cols-12 gap-4">
                  <Field label={req('Número da Nota Fiscal')} span={4}>
                    <Input value={faturadoForm.notaFiscalNumero} onChange={(e) => setFaturado('notaFiscalNumero', e.target.value)} placeholder="Ex.: NF 000428" />
                  </Field>
                  <Field label={req('Valor total da Nota Fiscal')} span={4}>
                    <MoneyInput value={faturadoForm.notaFiscalValor} onChange={(v) => setFaturado('notaFiscalValor', v)} />
                  </Field>
                  <Field label={req('Quantidade de parcelas')} span={4}>
                    <Input type="number" min="1" max="120" value={faturadoForm.quantidadeParcelas} onChange={(e) => setFaturado('quantidadeParcelas', e.target.value)} />
                  </Field>
                  <Field label={req('Anexar Nota Fiscal')} span={12}>
                    <FileInput label="Anexar arquivo da Nota Fiscal" value={notaFiscalArquivo ? [notaFiscalArquivo] : []} onChange={(files) => setNotaFiscalArquivo(files[0] || null)} multiple={false} />
                    {editandoId && notaFiscalArquivoExistente && !notaFiscalArquivo && (
                      <p className="mt-1.5 text-xs text-white/40">Mantendo a Nota Fiscal já enviada. Anexe um novo arquivo acima só se quiser substituir.</p>
                    )}
                  </Field>
                </div>
              </div>

              {/* Configuração das parcelas */}
              <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-amber-300">Configuração das parcelas</p>
                <div className="grid grid-cols-12 gap-4">
                  <Field label={req('Periodicidade')} span={3}>
                    <Select value={faturadoForm.periodicidade} onChange={(e) => setFaturado('periodicidade', e.target.value)}>
                      {PERIODICIDADES_FATURADO.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </Select>
                  </Field>
                  <Field label={req('Dia do vencimento')} span={3}>
                    <Input type="number" min="1" max="31" value={faturadoForm.diaVencimento} onChange={(e) => setFaturado('diaVencimento', e.target.value)} />
                  </Field>
                  <Field label={req('Início')} span={3}>
                    <Input type="date" value={faturadoForm.inicio} onChange={(e) => setFaturado('inicio', e.target.value)} />
                  </Field>
                  <Field label="Último vencimento" span={3}>
                    <Input type="date" value={ultimoVencimentoFaturado} disabled />
                  </Field>
                </div>

                <div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-500/[0.05] px-3.5 py-2.5 text-[11px] leading-relaxed text-white/65">
                  {previewDivisaoFaturado}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Btn type="button" onClick={gerarParcelas}><Repeat size={14} /> Gerar parcelas</Btn>
                  <Btn type="button" variant="secondary" onClick={adicionarParcelaManual}><Plus size={14} /> Adicionar parcela</Btn>
                  <Btn type="button" variant="ghost" onClick={limparParcelasFaturado}><X size={14} /> Limpar parcelas</Btn>
                </div>
              </div>

              {/* Lista de parcelas */}
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Parcelas da Nota Fiscal — cada parcela deve possuir seu próprio boleto</p>
                {parcelasFaturado.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/30">Nenhuma parcela gerada ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {parcelasFaturado.map((p, i) => (
                      <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-white/10 bg-[#0b1220]/60 p-3">
                        <div className="col-span-6 sm:col-span-1">
                          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Parcela</p>
                          <div className="flex h-[42px] items-center justify-center rounded-lg bg-amber-500/10 font-black text-amber-300">{p.numero}</div>
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Período</p>
                          <Input type="month" value={p.periodo} onChange={(e) => atualizarParcelaFaturado(i, { periodo: e.target.value })} />
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Vencimento</p>
                          <Input type="date" value={p.vencimento} onChange={(e) => atualizarParcelaFaturado(i, { vencimento: e.target.value })} />
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Valor</p>
                          <Input value={money(p.valor)} disabled className="text-right font-black" />
                        </div>
                        <div className="col-span-10 sm:col-span-4">
                          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Boleto da parcela</p>
                          <FileInput
                            label={p.anexoUrlExistente ? 'Substituir boleto (opcional)' : 'Anexar boleto'}
                            value={p.boletoFile ? [p.boletoFile] : []}
                            onChange={(files) => atualizarParcelaFaturado(i, { boletoFile: files[0] || null })}
                            multiple={false}
                          />
                          {p.anexoUrlExistente && !p.boletoFile && (
                            <p className="mt-1 text-[10px] text-white/40">Mantendo o boleto já enviado.</p>
                          )}
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Remover</p>
                          <button
                            type="button"
                            onClick={() => removerParcelaFaturado(i)}
                            title="Remover parcela"
                            className="grid h-[42px] w-full place-items-center rounded-lg border border-red-500/30 bg-red-500/10 text-lg text-red-300 transition hover:bg-red-500/20"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo */}
              <div className="flex justify-end">
                <div className="w-full max-w-sm rounded-xl border border-white/10 bg-black/15 p-4 text-sm">
                  <div className="flex justify-between py-1 text-white/60"><span>Nota Fiscal</span><strong className="text-white">{faturadoForm.notaFiscalNumero || '-'}</strong></div>
                  <div className="flex justify-between py-1 text-white/60"><span>Parcelas</span><strong className="text-white">{parcelasFaturado.length}</strong></div>
                  <div className="flex justify-between py-1 text-white/60"><span>Valor da NF</span><strong className="text-white">{money(num(faturadoForm.notaFiscalValor))}</strong></div>
                  <div className="mt-1.5 flex justify-between border-t border-white/10 pt-2 text-base"><span className="text-white/60">Soma das parcelas</span><strong className="text-amber-300">{money(somaParcelasFaturado)}</strong></div>
                </div>
              </div>
            </div>
          ) : (
            <Field label={req('Anexar documento / imagem')} span={12}>
              <FileInput label="Anexar NF, boleto, recibo, PDF ou foto" value={anexos} onChange={setAnexos} />
              {editandoId && anexosExistentes.length > 0 && anexos.length === 0 && (
                <div className="mt-1.5">
                  <p className="text-xs text-white/40">Mantendo {anexosExistentes.length} anexo(s) já enviado(s). Anexe um novo arquivo acima só se quiser substituir.</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {anexosExistentes.map((a, i) => {
                      const ehUrl = /^(https?:|\/media\/)/.test(String(a));
                      const nome = ehUrl ? decodeURIComponent(String(a).split('/').pop() || 'documento') : String(a);
                      return ehUrl ? (
                        <a key={i} href={a} target="_blank" rel="noopener noreferrer" className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/20">📄 {nome}</a>
                      ) : (
                        <span key={i} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-white/60">📄 {nome}</span>
                      );
                    })}
                  </div>
                </div>
              )}
            </Field>
          )}
          <Field label={req('Descrição')} span={12}><Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Detalhes da solicitação..." /></Field>

          <div className="col-span-12 flex gap-2">
            <Btn variant="amber" type="submit" disabled={salvando}>
              <Send size={15} /> {salvando ? 'Enviando...' : editandoId ? 'Reenviar para aprovação' : 'Enviar para aprovação'}
            </Btn>
            {editandoId && (
              <Btn variant="ghost" type="button" onClick={cancelarEdicao}><X size={15} /> Cancelar edição</Btn>
            )}
          </div>
        </form>
      </FinCard>
    </div>
  );
}
