import React, { useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { formatDateBR } from '../../../utils/formatDate';
import {
  CheckCircle2, Download, FileCheck2, FileText, ClipboardList,
  Wrench, Trash2, X, Eye, ChevronDown, ChevronUp, Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadDocument, getDocumentHref } from '../../../utils/documentDownload';
import { handleDownloadOrcamentoPDF } from '../CRM/handleDownloadOrcamentoPDF';
import { handleDownloadOSPDF } from '../CRM/handleDownloadOSPDF';
import { handleDownloadPropostaPDF } from '../CRM/handleDownloadPropostaPDF';
import { handleDownloadMedicaoPDF } from '../CRM/handleDownloadMedicaoPDF';
import { isEmpresaLinave, getLogoUrlForEmpresa } from '../../../utils/company';
import { boldOS } from '../../../utils/osHighlight';

interface FinalizadosComercialViewProps {
  searchQuery: string;
}

export function FinalizadosComercialView({ searchQuery }: FinalizadosComercialViewProps) {
  const { obras, clientes, os, saveEntity, medicoes, config } = useErp() as any;
  const [selectedObra, setSelectedObra] = useState<any>(null);

  // Negócios (por id de backend) que têm ao menos uma medição registrada no SQL.
  const negociosComMedicaoSql = useMemo(() => {
    const set = new Set<string>();
    (Array.isArray(medicoes) ? medicoes : []).forEach((m: any) => {
      if (m?.negocioBackendId != null) set.add(String(m.negocioBackendId));
    });
    return set;
  }, [medicoes]);

  const safeNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const formatDate = (value: any) => {
    if (!value) return '-';
    return formatDateBR(value) || '-';
  };

  const isDocumentoValido = (doc: any) => Boolean(getDocumentHref(doc));

  const handleDownloadDocumento = (doc: any, obraId: string, fallbackName: string) => {
    downloadDocument(doc, {
      fallbackName,
      onInvalid: () => toast.error(`Documento inválido para o negócio ${obraId}. Gere novamente.`),
    });
  };

  const obterDocumentos = (obra: any) =>
    Array.isArray(obra?.documentosNegocio) ? obra.documentosNegocio : [];

  const encontrarDocumento = (obra: any, palavras: string[]) => {
    const docs = obterDocumentos(obra);
    return docs
      .filter((doc: any) => {
        const id = String(doc?.id || '').toLowerCase();
        const nome = String(doc?.nome || '').toLowerCase();
        return palavras.some((p) => id.includes(p) || nome.includes(p));
      })
      .sort((a: any, b: any) =>
        new Date(b?.dataUpload || 0).getTime() - new Date(a?.dataUpload || 0).getTime()
      )[0] || null;
  };

  const obterDocsMediacao = (obra: any) =>
    obterDocumentos(obra).filter((doc: any) => {
      const id = String(doc?.id || '').toLowerCase();
      const nome = String(doc?.nome || '').toLowerCase();
      return id.includes('mediacao') || nome.includes('medi') || nome.includes('medição');
    });

  const handleHideCard = (obra: any) => {
    if (!window.confirm(`Remover "${obra?.nome || 'este negócio'}" da lista de finalizados?`)) return;
    const obrasAtualizadas = (Array.isArray(obras) ? obras : []).map((item: any) =>
      item.id === obra.id ? { ...item, ocultarDosFinalizados: true } : item
    );
    saveEntity('obras', obrasAtualizadas);
    toast.success('Card removido da lista de finalizados.');
  };

  const obrasFinalizadas = useMemo(() => {
    return (Array.isArray(obras) ? obras : [])
      .filter((obra: any) => {
        if (obra?.ocultarDosFinalizados) return false;
        const isArquivado = obra?.categoria === 'Arquivado';
        const temMediacao =
          obterDocsMediacao(obra).length > 0 ||
          Boolean(obra?.finalizadoComMediacao) ||
          negociosComMedicaoSql.has(String(obra?.negocioBackendId));
        if (!isArquivado && !temMediacao) return false;
        if (!searchQuery) return true;
        const termo = searchQuery.toLowerCase();
        const clienteNome =
          (clientes || []).find((c: any) => c.id === obra.clienteId)?.razaoSocial?.toLowerCase() || '';
        const nomeCliente = (obra.nomeCliente || '').toLowerCase();
        return (
          String(obra?.nome || '').toLowerCase().includes(termo) ||
          clienteNome.includes(termo) ||
          nomeCliente.includes(termo)
        );
      })
      .sort((a: any, b: any) => {
        const da = new Date(a?.dataArquivamento || a?.dataFinalizacaoLocal || a?.dataCadastro || 0).getTime();
        const db = new Date(b?.dataArquivamento || b?.dataFinalizacaoLocal || b?.dataCadastro || 0).getTime();
        return db - da;
      });
  }, [obras, clientes, searchQuery, negociosComMedicaoSql]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-white">NEGÓCIOS FINALIZADOS</h1>
        <p className="text-white/50 text-xs mt-1">
          Negócios arquivados do Kanban e negócios com documento de medição
        </p>
      </div>

      {obrasFinalizadas.length === 0 ? (
        <div className="bg-[#101f3d] p-12 rounded-2xl border border-white/5 text-center py-16">
          <Archive size={48} className="text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">Nenhum negócio finalizado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {obrasFinalizadas.map((obra: any) => {
            const clienteCtx = (clientes || []).find((c: any) => c.id === obra.clienteId);
            const nomeCliente =
              obra.nomeCliente ||
              clienteCtx?.razaoSocial ||
              clienteCtx?.razao_social ||
              'Cliente não informado';
            const isArquivado = obra?.categoria === 'Arquivado';
            const docsMediacao = obterDocsMediacao(obra);
            const ultimoOrcamento =
              Array.isArray(obra?.orcamentos) && obra.orcamentos.length > 0
                ? obra.orcamentos[obra.orcamentos.length - 1]
                : null;
            const ultimaProposta =
              Array.isArray(obra?.propostas) && obra.propostas.length > 0
                ? obra.propostas[obra.propostas.length - 1]
                : null;
            const osDoNegocio = (Array.isArray(os) ? os : []).filter(
              (item: any) => item.obraId === obra.id
            );
            const valorOrcamento = safeNumber(
              ultimoOrcamento?.valores?.precoFinal ??
              ultimoOrcamento?.valores?.valorTotalServico ??
              obra?.orcamentoValores?.precoFinal ??
              obra?.orcamento
            );

            return (
              <div
                key={obra.id}
                className="rounded-xl border-2 bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-900/20 transition-all overflow-hidden"
              >
                {/* Card header */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black text-white uppercase truncate">
                        {obra.nome}
                        {obra?.id ? <span className="text-cyan-400 ml-2">• {obra.id}</span> : null}
                      </h3>
                      <p className="text-white/70 text-xs font-bold mt-0.5">{nomeCliente}</p>
                      <p className="text-white/40 text-[11px] mt-0.5">
                        {isArquivado
                          ? `Arquivado em: ${formatDate(obra?.dataArquivamento)}`
                          : `Finalizado em: ${formatDate(obra?.dataFinalizacaoLocal || obra?.dataCadastro)}`}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                        isArquivado
                          ? 'bg-gray-500/20 border-gray-500/40 text-gray-300'
                          : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      {isArquivado ? 'Arquivado' : 'Finalizado'}
                    </span>
                  </div>

                  {/* Summary pills */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-white/50">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      Serviços: {Array.isArray(obra?.servicos) ? obra.servicos.length : 0}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      OS: {osDoNegocio.length}
                    </span>
                    {ultimoOrcamento && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        R$ {valorOrcamento.toFixed(2)}
                      </span>
                    )}
                    {docsMediacao.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                        {docsMediacao.length} medição
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedObra(obra)}
                      className="flex-1 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-[11px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                    >
                      <Eye size={13} /> Ver Detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHideCard(obra)}
                      className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-[11px] font-black uppercase tracking-wider transition flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL DETAIL MODAL */}
      {selectedObra && (
        <NegocioDetalheModal
          obra={selectedObra}
          clientes={clientes}
          os={os}
          medicoes={medicoes}
          config={config}
          onClose={() => setSelectedObra(null)}
          onDownload={handleDownloadDocumento}
          encontrarDocumento={encontrarDocumento}
          obterDocsMediacao={obterDocsMediacao}
          isDocumentoValido={isDocumentoValido}
          formatDate={formatDate}
          safeNumber={safeNumber}
        />
      )}
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function Section({
  title,
  color = 'white',
  children,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const colors: Record<string, string> = {
    emerald: 'text-emerald-300 border-emerald-500/30',
    amber: 'text-amber-300 border-amber-500/30',
    cyan: 'text-cyan-300 border-cyan-500/30',
    violet: 'text-violet-300 border-violet-500/30',
    white: 'text-white/70 border-white/10',
  };
  const cls = colors[color] || colors.white;
  return (
    <div className={`border rounded-xl overflow-hidden ${cls.split(' ')[1]}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/8 transition text-left ${cls.split(' ')[0]} font-black text-xs uppercase tracking-widest`}
      >
        {title}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="px-4 py-4 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: React.ReactNode; value: any }) {
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-white text-sm font-bold">{value || '-'}</p>
    </div>
  );
}

export function NegocioDetalheModal({
  obra,
  clientes,
  os,
  medicoes,
  config,
  onClose,
  onDownload,
  encontrarDocumento,
  obterDocsMediacao,
  isDocumentoValido,
  formatDate,
  safeNumber,
}: any) {
  const clienteCtx = (clientes || []).find((c: any) => c.id === obra.clienteId);
  const nomeCliente =
    obra.nomeCliente || clienteCtx?.razaoSocial || clienteCtx?.razao_social || 'Não informado';

  const ultimoOrcamento =
    Array.isArray(obra?.orcamentos) && obra.orcamentos.length > 0
      ? obra.orcamentos[obra.orcamentos.length - 1]
      : null;
  const ultimaProposta =
    Array.isArray(obra?.propostas) && obra.propostas.length > 0
      ? obra.propostas[obra.propostas.length - 1]
      : null;
  const osDoNegocio = (Array.isArray(os) ? os : []).filter(
    (item: any) => item.obraId === obra.id
  );
  const ultimaOs = osDoNegocio.length > 0 ? osDoNegocio[osDoNegocio.length - 1] : null;
  const docsMediacao = obterDocsMediacao(obra);
  const docPrincipalMediacao = docsMediacao[docsMediacao.length - 1] || null;

  const docOrcamento = encontrarDocumento(obra, ['doc-orcamento', 'orcamento', 'orçamento', 'orc_']);
  const docProposta = encontrarDocumento(obra, ['doc-proposta', 'proposta', 'proposta_']);
  const docOsDireto = encontrarDocumento(obra, ['doc-os', '_os_', 'ordem de servico', 'ordem de serviço', 'os_']);
  const docOs = docOsDireto || ultimaOs?.documentoAssinaturaAprovacao || null;

  const valorOrcamento = safeNumber(
    ultimoOrcamento?.valores?.precoFinal ??
    ultimoOrcamento?.valores?.valorTotalServico ??
    obra?.orcamentoValores?.precoFinal ??
    obra?.orcamento
  );

  const isArquivado = obra?.categoria === 'Arquivado';

  // Início/Término previsto do NEGÓCIO: o negócio não guarda essas datas, então as
  // derivamos das OS dele (menor início, maior término). Datas ISO ordenam lexicograficamente.
  const datasInicioOs = osDoNegocio.map((o: any) => o.dataInicioPrevisto).filter(Boolean).sort();
  const datasTerminoOs = osDoNegocio.map((o: any) => o.dataTerminoPrevisto).filter(Boolean).sort();
  const inicioPrevistoNegocio =
    obra.dataPrevistaInicio || obra.inicioPrevisto || datasInicioOs[0] || '';
  const terminoPrevistoNegocio =
    obra.dataPrevistaFinal || obra.fimPrevisto || datasTerminoOs[datasTerminoOs.length - 1] || '';

  // Medições registradas no SQL para este negócio (a medição virou tela própria/SQL).
  const medicoesDoNegocio = (Array.isArray(medicoes) ? medicoes : []).filter(
    (m: any) => String(m?.negocioBackendId) === String(obra?.negocioBackendId),
  );

  const baixarMedicaoPDF = async (medicao: any) => {
    const prestadora = (config?.empresasPrestadoras || []).find(
      (e: any) => String(e?.nome || '').toLowerCase() === String(medicao.empresa || '').toLowerCase(),
    );
    try {
      await handleDownloadMedicaoPDF(
        {
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
        },
        clienteCtx || {},
        { id: medicao.ordemServicoNumero },
      );
      toast.success('PDF da medição gerado!');
    } catch {
      toast.error('Erro ao gerar o PDF da medição.');
    }
  };

  const pd = (v: any) => safeNumber(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const gerarPDFOrcamento = () => {
    if (!ultimoOrcamento) return toast.error('Sem orçamento para gerar.');
    handleDownloadOrcamentoPDF(ultimoOrcamento, clienteCtx, obra);
    toast.success('PDF do orçamento gerado!');
  };

  const gerarPDFProposta = async () => {
    if (!ultimaProposta) return toast.error('Sem proposta para gerar.');
    const isLinave = isEmpresaLinave(obra?.empresaPrestadora);
    const logoBase64 = await carregarLogoBase64();
    const fundoLinaveBase64 = isLinave ? await carregarLogoBase64('/linave-rodape.png') : undefined;
    handleDownloadPropostaPDF(ultimaProposta, clienteCtx, obra, logoBase64, isLinave, fundoLinaveBase64);
    toast.success('PDF da proposta gerado!');
  };

  const carregarLogoBase64 = async (url?: string): Promise<string | undefined> => {
    try {
      const res = await fetch(url || getLogoUrlForEmpresa(obra?.empresaPrestadora));
      if (!res.ok) return undefined;
      const blob = await res.blob();
      if (blob.size === 0) return undefined;
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('' as any);
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  };

  const gerarPDFOs = async () => {
    if (osDoNegocio.length === 0) return toast.error('Sem OS para gerar.');
    const osPrincipal = [...osDoNegocio].reverse().find(
      (o: any) => o.tipoDocumento === 'consolidada' || (o.aSerIncluido && Object.keys(o.aSerIncluido).length > 0)
    ) || osDoNegocio[osDoNegocio.length - 1];
    const logoBase64 = await carregarLogoBase64();
    handleDownloadOSPDF({ osPrincipal, ultimoOrcamento, ultimaProposta, cliente: clienteCtx, obra, logoBase64 });
    toast.success('PDF da OS gerado!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#101f3d] shadow-2xl my-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 border-b border-white/10 bg-[#101f3d] rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-black text-white uppercase">{obra.nome}</h2>
            <p className="text-white/50 text-xs mt-1">{nomeCliente} • {obra.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                isArquivado
                  ? 'bg-gray-500/20 border-gray-500/40 text-gray-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {isArquivado ? 'Arquivado' : 'Finalizado'}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* NEGÓCIO */}
          <Section title="Negócio" color="white">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome" value={obra.nome} />
              <Field label="Cliente" value={nomeCliente} />
              <Field label="Categoria" value={obra.categoria} />
              <Field label="Status" value={obra.status} />
              <Field label="Solicitante" value={obra.solicitante} />
              <Field label="Empresa Prestadora" value={obra.empresaPrestadora} />
              <Field label="Início Previsto" value={inicioPrevistoNegocio ? formatDate(inicioPrevistoNegocio) : '-'} />
              <Field label="Término Previsto" value={terminoPrevistoNegocio ? formatDate(terminoPrevistoNegocio) : '-'} />
              {isArquivado && (
                <Field label="Arquivado em" value={formatDate(obra.dataArquivamento)} />
              )}
            </div>
            {Array.isArray(obra.servicos) && obra.servicos.length > 0 && (
              <div className="mt-3">
                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Serviços</p>
                <div className="space-y-1.5">
                  {obra.servicos.map((srv: any, i: number) => (
                    <div
                      key={i}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80"
                    >
                      <span className="font-bold text-white">{srv.tipo_servico || srv.tipo || `Serviço ${i + 1}`}</span>
                      {srv.descricao && <span className="text-white/50 ml-2">— {srv.descricao}</span>}
                      {srv.local_execucao && (
                        <span className="text-white/40 ml-2 text-xs">{srv.local_execucao}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ORÇAMENTO */}
          <Section title="Orçamento" color="emerald">
            {ultimoOrcamento ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Número" value={ultimoOrcamento.numeroOrcamento || ultimoOrcamento.numero_orcamento || ultimoOrcamento?.data?.numeroOrcamento} />
                  <Field label="Versão" value={ultimoOrcamento.versao || ultimoOrcamento?.data?.versao} />
                  <Field label="Status" value={ultimoOrcamento.status} />
                  <Field label="Data Criação" value={formatDate(ultimoOrcamento.dataCriacao)} />
                  <div className="col-span-2">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Valor Total</p>
                    <p className="text-emerald-300 text-xl font-black">
                      R$ {valorOrcamento.toFixed(2)}
                    </p>
                  </div>
                </div>
                {ultimoOrcamento?.data?.observacoes && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white/70 whitespace-pre-wrap mt-2">
                    {ultimoOrcamento.data.observacoes}
                  </div>
                )}
                <button
                  onClick={gerarPDFOrcamento}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download size={13} /> Download Orçamento
                </button>
              </>
            ) : (
              <p className="text-white/40 text-sm">Sem orçamento registrado</p>
            )}
          </Section>

          {/* PROPOSTA */}
          <Section title="Proposta Comercial" color="cyan">
            {ultimaProposta ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Número" value={ultimaProposta.numeroProposta} />
                  <Field label="Versão" value={ultimaProposta.versao} />
                  <Field label="Status" value={ultimaProposta.status} />
                  <Field label="Data Criação" value={formatDate(ultimaProposta.dataCriacao)} />
                  <Field label="Assunto" value={ultimaProposta.assunto} />
                  <Field label="Prazo" value={ultimaProposta.prazo} />
                </div>
                {ultimaProposta.textoAbertura && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white/70 whitespace-pre-wrap mt-2">
                    {ultimaProposta.textoAbertura}
                  </div>
                )}
                {ultimaProposta.escopoA && (
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Escopo Básico</p>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white/70 whitespace-pre-wrap">
                      {ultimaProposta.escopoA}
                    </div>
                  </div>
                )}
                <button
                  onClick={gerarPDFProposta}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download size={13} /> Download Proposta
                </button>
              </>
            ) : (
              <p className="text-white/40 text-sm">Sem proposta registrada</p>
            )}
          </Section>

          {/* OS */}
          <Section title={`Ordens de Serviço (${osDoNegocio.length})`} color="violet">
            {osDoNegocio.length > 0 ? (
              <div className="space-y-3">
                {osDoNegocio.map((osItem: any, idx: number) => (
                  <div
                    key={osItem.id || idx}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={boldOS('Número OS')} value={osItem.ordemServicoNumero} />
                      <Field label="Status Envio" value={osItem.statusEnvio} />
                      <Field label="Status Aprovação" value={osItem.statusAprovacao} />
                      <Field label="Supervisor" value={osItem.supervisorEncarregado} />
                      <Field label="Início Previsto" value={osItem.dataInicioPrevisto} />
                      <Field label="Término Previsto" value={osItem.dataTerminoPrevisto} />
                    </div>
                    {osItem.descricaoGeralServico && (
                      <div className="bg-black/20 rounded p-2 text-xs text-white/60 whitespace-pre-wrap">
                        {osItem.descricaoGeralServico}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={gerarPDFOs}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download size={13} /> Download OS
                </button>
              </div>
            ) : (
              <p className="text-white/40 text-sm">{boldOS('Sem OS registrada')}</p>
            )}
          </Section>

          {/* MEDIÇÃO */}
          {docsMediacao.length > 0 && (
            <Section title="Documentos de Medição" color="amber">
              <div className="space-y-2">
                {docsMediacao.map((doc: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5"
                  >
                    <div>
                      <p className="text-white text-sm font-bold">{doc.nome || `Medição ${idx + 1}`}</p>
                      <p className="text-white/40 text-xs">{formatDate(doc.dataUpload)}</p>
                    </div>
                    <button
                      onClick={() => onDownload(doc, obra.id, doc.nome || `medicao-${idx + 1}.pdf`)}
                      disabled={!isDocumentoValido(doc)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-black uppercase transition ${
                        isDocumentoValido(doc)
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-white/10 text-white/40 cursor-not-allowed'
                      }`}
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* MEDIÇÕES (SQL) — a medição virou tela própria com tabela SQL; aqui listamos as
              do negócio e geramos o documento sob demanda (sempre atualizado, sem preview em branco). */}
          {medicoesDoNegocio.length > 0 && (
            <Section title={`Medições (${medicoesDoNegocio.length})`} color="amber">
              <div className="space-y-2">
                {medicoesDoNegocio.map((med: any) => (
                  <div
                    key={med.id}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-white text-sm font-bold truncate">
                        {med.numeroMedicao || med.ordemServicoNumero || 'Medição'}
                        <span className="text-white/40 font-normal ml-2">BM {med.numeroBM || '—'}</span>
                      </p>
                      <p className="text-white/40 text-xs">
                        {med.periodo || 'sem período'} • {formatDate(med.dataEmissao)} • R$ {pd(med.valorTotal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                          med.status === 'aprovada'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : med.status === 'recusada'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {med.status || 'pendente'}
                      </span>
                      <button
                        onClick={() => baixarMedicaoPDF(med)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-black uppercase transition bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Download size={12} /> Documento
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* DOCUMENTOS GERAIS */}
          {(() => {
            const docs = (Array.isArray(obra?.documentosNegocio) ? obra.documentosNegocio : []).filter(
              (doc: any) => !obterDocsMediacao(obra).includes(doc)
            );
            if (docs.length === 0) return null;
            return (
              <Section title={`Outros Documentos (${docs.length})`} color="white">
                <div className="space-y-2">
                  {docs.map((doc: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-white text-sm">{doc.nome || `Documento ${idx + 1}`}</p>
                        <p className="text-white/40 text-xs">{doc.tipo} • {formatDate(doc.dataUpload)}</p>
                      </div>
                      <button
                        onClick={() => onDownload(doc, obra.id, doc.nome || `doc-${idx + 1}.pdf`)}
                        disabled={!isDocumentoValido(doc)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-black uppercase transition ${
                          isDocumentoValido(doc)
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-white/10 text-white/40 cursor-not-allowed'
                        }`}
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </Section>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
