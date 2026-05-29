import React, { useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import {
  CheckCircle2, Download, FileCheck2, FileText, ClipboardList,
  Wrench, Trash2, X, Eye, ChevronDown, ChevronUp, Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadDocument, getDocumentHref } from '../../../utils/documentDownload';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FinalizadosComercialViewProps {
  searchQuery: string;
}

export function FinalizadosComercialView({ searchQuery }: FinalizadosComercialViewProps) {
  const { obras, clientes, os, saveEntity } = useErp();
  const [selectedObra, setSelectedObra] = useState<any>(null);

  const safeNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const formatDate = (value: any) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return String(value);
    }
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
          obterDocsMediacao(obra).length > 0 || Boolean(obra?.finalizadoComMediacao);
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
  }, [obras, clientes, searchQuery]);

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

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-white text-sm font-bold">{value || '-'}</p>
    </div>
  );
}

function NegocioDetalheModal({
  obra,
  clientes,
  os,
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

  const pd = (v: any) => safeNumber(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const gerarPDFOrcamento = () => {
    if (!ultimoOrcamento) return toast.error('Sem orçamento para gerar.');
    const doc = new jsPDF();
    const d = ultimoOrcamento.data || {};
    const v = ultimoOrcamento.valores || {};
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`ORÇAMENTO ${ultimoOrcamento.numeroOrcamento || ''}`, 14, 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Negócio: ${obra.nome}  |  Cliente: ${nomeCliente}  |  Versão: ${ultimoOrcamento.versao || '-'}  |  Status: ${ultimoOrcamento.status || '-'}`, 14, 26);
    let y = 36;
    const mdo: any[] = (d.maoDeObra || []).filter((i: any) => i.funcao?.trim() || i.fnc?.trim());
    if (mdo.length > 0) {
      autoTable(doc, { startY: y, head: [['Função', 'Qtd', 'Dias', 'Valor Total']], body: mdo.map((i: any) => [i.funcao || i.fnc || '-', i.quantidade || i.qnt || '-', i.dias || '-', `R$ ${pd(i.valorTotal)}`]), styles: { fontSize: 8 }, headStyles: { fillColor: [30, 60, 120] } });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    const mats: any[] = (d.materiais || []).filter((i: any) => i.descricao?.trim());
    if (mats.length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Materiais', 14, y); y += 4;
      autoTable(doc, { startY: y, head: [['Descrição', 'Qtd', 'Un', 'Valor Total']], body: mats.map((i: any) => [i.descricao, i.quantidade || i.qnt || '-', i.unidade || '-', `R$ ${pd(i.valorTotal)}`]), styles: { fontSize: 8 }, headStyles: { fillColor: [30, 60, 120] } });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    const ativs: any[] = (d.atividades || []).filter((i: any) => i.atividade?.trim());
    if (ativs.length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Atividades Previstas', 14, y); y += 4;
      autoTable(doc, { startY: y, head: [['Atividade', 'Dias', 'Obs']], body: ativs.map((i: any) => [i.atividade, i.dias || i.duracao || '-', i.observacao || '']), styles: { fontSize: 8 }, headStyles: { fillColor: [30, 60, 120] } });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    if (v.precoFinal) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`Preço Final: R$ ${pd(v.precoFinal)}`, 14, y + 4);
    }
    doc.save(`orcamento-${ultimoOrcamento.numeroOrcamento || obra.id}.pdf`);
    toast.success('PDF do orçamento gerado!');
  };

  const gerarPDFProposta = () => {
    if (!ultimaProposta) return toast.error('Sem proposta para gerar.');
    const doc = new jsPDF();
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`PROPOSTA COMERCIAL ${ultimaProposta.numeroProposta || ''}`, 14, 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Negócio: ${obra.nome}  |  Cliente: ${nomeCliente}  |  Versão: ${ultimaProposta.versao || '-'}  |  Status: ${ultimaProposta.status || '-'}`, 14, 26);
    let y = 36;
    if (ultimaProposta.assunto) { doc.setFont('helvetica', 'bold'); doc.text('Assunto:', 14, y); doc.setFont('helvetica', 'normal'); doc.text(ultimaProposta.assunto, 40, y); y += 8; }
    if (ultimaProposta.prazo) { doc.setFont('helvetica', 'bold'); doc.text('Prazo:', 14, y); doc.setFont('helvetica', 'normal'); doc.text(String(ultimaProposta.prazo), 34, y); y += 8; }
    if (ultimaProposta.textoAbertura) {
      doc.setFont('helvetica', 'bold'); doc.text('Texto de Abertura:', 14, y); y += 5;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(ultimaProposta.textoAbertura, 182);
      doc.text(lines, 14, y); y += lines.length * 5 + 4;
    }
    if (ultimaProposta.escopoA) {
      doc.setFont('helvetica', 'bold'); doc.text('Escopo Básico:', 14, y); y += 5;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(ultimaProposta.escopoA, 182);
      doc.text(lines, 14, y); y += lines.length * 5 + 4;
    }
    const escopos: any[] = Array.isArray(ultimaProposta.escopoBasicoServicos) ? ultimaProposta.escopoBasicoServicos : [];
    if (escopos.length > 0) {
      autoTable(doc, { startY: y, head: [['Item', 'Descrição']], body: escopos.map((e: any, i: number) => [`${i + 1}. ${e.titulo || ''}`, e.descricaoServico || '']), styles: { fontSize: 8 }, headStyles: { fillColor: [30, 60, 120] } });
    }
    doc.save(`proposta-${ultimaProposta.numeroProposta || obra.id}.pdf`);
    toast.success('PDF da proposta gerado!');
  };

  const gerarPDFOs = () => {
    if (osDoNegocio.length === 0) return toast.error('Sem OS para gerar.');
    const doc = new jsPDF();
    osDoNegocio.forEach((osItem: any, idx: number) => {
      if (idx > 0) doc.addPage();
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(`ORDEM DE SERVIÇO ${osItem.ordemServicoNumero || ''}`, 14, 18);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Projeto: ${osItem.projeto || obra.nome}  |  Cliente: ${osItem.cliente || nomeCliente}`, 14, 26);
      doc.text(`Início: ${osItem.dataInicioPrevisto || '-'}  |  Término: ${osItem.dataTerminoPrevisto || '-'}  |  Status: ${osItem.statusOs || '-'}`, 14, 32);
      let y = 42;
      if (osItem.supervisorEncarregado) { doc.text(`Supervisor: ${osItem.supervisorEncarregado}`, 14, y); y += 6; }
      if (osItem.equipamento) { doc.text(`Equipamento: ${osItem.equipamento}`, 14, y); y += 6; }
      if (osItem.descricaoGeralServico) {
        doc.setFont('helvetica', 'bold'); doc.text('Descrição do Serviço:', 14, y); y += 5;
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(osItem.descricaoGeralServico, 182);
        doc.text(lines, 14, y); y += lines.length * 5 + 4;
      }
      const mao = osItem.maoObra || {};
      const hhRows = [['Estrutura', mao.estrutura], ['Tubulação', mao.tubulacao], ['Andaimes', mao.andaimes], ['Mecânica', mao.mecanica], ['Pintura', mao.pintura], ['Elétrica', mao.eletrica], ['C.Q', mao.cq], ['SMS', mao.sms]].filter(([, v]) => Number(v) > 0).map(([s, v]) => [s, String(v)]);
      if (hhRows.length > 0) {
        doc.setFont('helvetica', 'bold'); doc.text('Mão de Obra (H/H):', 14, y); y += 4;
        autoTable(doc, { startY: y, head: [['Serviço', 'H/H']], body: hhRows, styles: { fontSize: 8 }, headStyles: { fillColor: [30, 60, 120] } });
      }
    });
    doc.save(`os-${obra.id}.pdf`);
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
              <Field label="Início Previsto" value={formatDate(obra.dataPrevistaInicio)} />
              <Field label="Término Previsto" value={formatDate(obra.dataPrevistaFinal)} />
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
                  <Field label="Número" value={ultimoOrcamento.numeroOrcamento} />
                  <Field label="Versão" value={ultimoOrcamento.versao} />
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
                      <Field label="Número OS" value={osItem.ordemServicoNumero} />
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
              <p className="text-white/40 text-sm">Sem OS registrada</p>
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

          {/* DADOS DE MEDIÇÃO */}
          {obra?.dadosMediacao && (
            <Section title="Dados da Medição" color="amber">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Empresa" value={obra.dadosMediacao.empresa} />
                <Field label="Cliente" value={obra.dadosMediacao.cliente} />
                <Field label="CNPJ" value={obra.dadosMediacao.cnpj} />
                <Field label="Embarcação" value={obra.dadosMediacao.embarcacao} />
                <Field label="Número BM" value={obra.dadosMediacao.numeroBM} />
                <Field label="Período" value={obra.dadosMediacao.periodo} />
                <Field label="Data Emissão" value={formatDate(obra.dadosMediacao.dataEmissao)} />
                <Field label="Representante Cliente" value={obra.dadosMediacao.representanteCliente} />
                <Field label="Representante Linave" value={obra.dadosMediacao.representanteLinave} />
              </div>

              {Array.isArray(obra.dadosMediacao.tabelaItens) && obra.dadosMediacao.tabelaItens.length > 0 && (
                <div className="mt-3">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Itens Medidos</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/40 border-b border-white/10">
                          <th className="text-left pb-1 pr-3">Descrição</th>
                          <th className="text-left pb-1 pr-3">Unid.</th>
                          <th className="text-right pb-1 pr-3">Qtd Prev.</th>
                          <th className="text-right pb-1 pr-3">Qtd Real.</th>
                          <th className="text-right pb-1">Valor Unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obra.dadosMediacao.tabelaItens.map((item: any, i: number) => (
                          <tr key={item.id || i} className="border-b border-white/5 text-white/70">
                            <td className="py-1 pr-3">{item.descricao || '-'}</td>
                            <td className="py-1 pr-3">{item.unidade || '-'}</td>
                            <td className="py-1 pr-3 text-right">{item.quantidadePrevista || '-'}</td>
                            <td className="py-1 pr-3 text-right">{item.quantidadeRealizada || '-'}</td>
                            <td className="py-1 text-right">{item.valorUnitario || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {Array.isArray(obra.dadosMediacao.tabelaRecursos) && obra.dadosMediacao.tabelaRecursos.length > 0 && (
                <div className="mt-3">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Recursos</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/40 border-b border-white/10">
                          <th className="text-left pb-1 pr-3">Função</th>
                          <th className="text-right pb-1 pr-3">Período</th>
                          <th className="text-right pb-1">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obra.dadosMediacao.tabelaRecursos.map((rec: any, i: number) => (
                          <tr key={rec.id || i} className="border-b border-white/5 text-white/70">
                            <td className="py-1 pr-3">{rec.funcao || '-'}</td>
                            <td className="py-1 pr-3 text-right">{rec.periodo || '-'}</td>
                            <td className="py-1 text-right">{rec.horas || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
