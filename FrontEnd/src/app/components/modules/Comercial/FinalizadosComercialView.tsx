import React, { useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { CheckCircle2, Download, FileCheck2, FileText, ClipboardList, Wrench, Trash2, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { downloadDocument, getDocumentHref } from '../../../utils/documentDownload';

interface FinalizadosComercialViewProps {
  searchQuery: string;
}

export function FinalizadosComercialView({ searchQuery }: FinalizadosComercialViewProps) {
  const { obras, clientes, os, saveEntity } = useErp();
  const [selectedDetail, setSelectedDetail] = useState<{ obra: any; section: 'orcamento' | 'proposta' | 'os' | 'mediacao' } | null>(null);

  const safeNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const formatDateTime = (value: any) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-BR');
  };

  const isDocumentoValido = (doc: any) => {
    return Boolean(getDocumentHref(doc));
  };

  const handleDownloadDocumento = (doc: any, obraId: string, fallbackName: string) => {
    downloadDocument(doc, {
      fallbackName,
      onInvalid: () => {
        toast.error(`Documento inválido para o negócio ${obraId}. Gere novamente.`);
      }
    });
  };

  const obterDocumentos = (obra: any) => (Array.isArray(obra?.documentosNegocio) ? obra.documentosNegocio : []);

  const encontrarDocumentoPorPalavras = (obra: any, palavras: string[]) => {
    const docs = obterDocumentos(obra);
    return docs
      .filter((doc: any) => {
        const id = String(doc?.id || '').toLowerCase();
        const nome = String(doc?.nome || '').toLowerCase();
        return palavras.some((palavra) => id.includes(palavra) || nome.includes(palavra));
      })
      .sort((a: any, b: any) => new Date(b?.dataUpload || 0).getTime() - new Date(a?.dataUpload || 0).getTime())[0] || null;
  };

  const obterDocumentosMediacao = (obra: any) => {
    const docs = obterDocumentos(obra);
    return docs.filter((doc: any) => {
      const id = String(doc?.id || '').toLowerCase();
      const nome = String(doc?.nome || '').toLowerCase();
      return id.includes('mediacao') || nome.includes('medi') || nome.includes('medição');
    });
  };

  const handleHideCard = (obra: any) => {
    if (!window.confirm(`Apagar o card de finalizados de ${obra?.nome || 'este negócio'}?`)) {
      return;
    }

    const obrasAtualizadas = (Array.isArray(obras) ? obras : []).map((item: any) => (
      item.id === obra.id
        ? { ...item, ocultarDosFinalizados: true }
        : item
    ));

    saveEntity('obras', obrasAtualizadas);
    toast.success('Card removido da tela de finalizados.');
  };

  const obrasFinalizadas = useMemo(() => (Array.isArray(obras) ? obras : [])
    .filter((obra: any) => {
      if (obra?.ocultarDosFinalizados) return false;
      const temMediacao = obterDocumentosMediacao(obra).length > 0 || Boolean(obra?.finalizadoComMediacao);
      if (!temMediacao) return false;

      if (!searchQuery) return true;
      const termo = searchQuery.toLowerCase();
      const clienteNome = (clientes || []).find((c: any) => c.id === obra.clienteId)?.razaoSocial?.toLowerCase() || '';
      return String(obra?.nome || '').toLowerCase().includes(termo) || clienteNome.includes(termo);
    })
    .sort((a: any, b: any) => {
      const da = new Date(a?.dataFinalizacaoLocal || a?.dataCadastro || 0).getTime();
      const db = new Date(b?.dataFinalizacaoLocal || b?.dataCadastro || 0).getTime();
      return db - da;
    }), [obras, clientes, searchQuery]);

  const getSelectedData = () => {
    if (!selectedDetail) return null;
    const { obra, section } = selectedDetail;
    const docs = obterDocumentos(obra);
    const docOrcamento = encontrarDocumentoPorPalavras(obra, ['doc-orcamento', 'orcamento', 'orçamento', 'orc_']);
    const docProposta = encontrarDocumentoPorPalavras(obra, ['doc-proposta', 'proposta', 'proposta_']);
    const osDoNegocio = (Array.isArray(os) ? os : []).filter((item: any) => item.obraId === obra.id);
    const ultimaOs = osDoNegocio.length > 0 ? osDoNegocio[osDoNegocio.length - 1] : null;
    const docOsDireto = encontrarDocumentoPorPalavras(obra, ['doc-os', '_os_', 'ordem de servico', 'ordem de serviço', 'os_']);
    const docOs = docOsDireto || ultimaOs?.documentoAssinaturaAprovacao || null;
    const docsMediacao = obterDocumentosMediacao(obra);
    const docMediacao = docsMediacao[docsMediacao.length - 1] || null;
    const ultimoOrcamento = Array.isArray(obra?.orcamentos) && obra.orcamentos.length > 0 ? obra.orcamentos[obra.orcamentos.length - 1] : null;
    const ultimaProposta = Array.isArray(obra?.propostas) && obra.propostas.length > 0 ? obra.propostas[obra.propostas.length - 1] : null;

    return {
      docOrcamento,
      docProposta,
      docOs,
      docMediacao,
      ultimoOrcamento,
      ultimaProposta,
      ultimaOs,
      docs,
    }[section];
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-white">FINALIZADOS (MEDIÇÃO)</h1>
        <p className="text-white/50 text-xs mt-1">Histórico local de negócios que já possuem documento de medição</p>
      </div>

      {obrasFinalizadas.length === 0 ? (
        <div className="bg-[#101f3d] p-12 rounded-2xl border border-white/5 text-center py-16">
          <CheckCircle2 size={48} className="text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">Nenhum negócio finalizado com medição ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {obrasFinalizadas.map((obra: any) => {
            const cliente = (clientes || []).find((c: any) => c.id === obra.clienteId);
            const docsMediacao = obterDocumentosMediacao(obra);
            const docPrincipal = docsMediacao[docsMediacao.length - 1];
            const documentoMediacaoValido = isDocumentoValido(docPrincipal);

            const docOrcamento = encontrarDocumentoPorPalavras(obra, ['doc-orcamento', 'orcamento', 'orçamento', 'orc_']);
            const docProposta = encontrarDocumentoPorPalavras(obra, ['doc-proposta', 'proposta', 'proposta_']);
            const docOsDireto = encontrarDocumentoPorPalavras(obra, ['doc-os', '_os_', 'ordem de servico', 'ordem de serviço', 'os_']);

            const ultimoOrcamento = Array.isArray(obra?.orcamentos) && obra.orcamentos.length > 0
              ? obra.orcamentos[obra.orcamentos.length - 1]
              : null;
            const ultimaProposta = Array.isArray(obra?.propostas) && obra.propostas.length > 0
              ? obra.propostas[obra.propostas.length - 1]
              : null;
            const osDoNegocio = (Array.isArray(os) ? os : []).filter((item: any) => item.obraId === obra.id);
            const ultimaOs = osDoNegocio.length > 0 ? osDoNegocio[osDoNegocio.length - 1] : null;
            const docOs = docOsDireto || ultimaOs?.documentoAssinaturaAprovacao || null;

            const valorOrcamento = safeNumber(
              ultimoOrcamento?.valores?.precoFinal
              ?? ultimoOrcamento?.valores?.valorTotalServico
              ?? obra?.orcamentoValores?.precoFinal
              ?? obra?.orcamento
            );

            return (
              <div
                key={obra.id}
                className="rounded-xl p-4 transition-all border-2 bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-900/20 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white uppercase">
                      {obra.nome} {obra?.id ? <span className="text-cyan-400">• {obra.id}</span> : null}
                    </h3>
                    <p className="text-white/70 text-xs font-bold mt-1">{cliente?.razaoSocial || 'Cliente não informado'}</p>
                    <p className="text-white/50 text-[11px] mt-1">Finalizado em: {formatDateTime(obra?.dataFinalizacaoLocal || obra?.dataCadastro)}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                    Finalizado
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDetail({ obra, section: 'orcamento' })}
                    className="px-2.5 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1"
                  >
                    <Eye size={11} /> Ver quadros
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHideCard(obra)}
                    className="px-2.5 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-200 text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Apagar card
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDetail({ obra, section: 'orcamento' })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDetail({ obra, section: 'orcamento' });
                      }
                    }}
                    className="text-left bg-[#0b1220] border border-white/10 hover:border-emerald-400/40 rounded-lg p-3 space-y-2 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase tracking-widest">
                      <ClipboardList size={14} /> Orçamento
                    </div>
                    <p className="text-white/70 text-xs">Versão: {ultimoOrcamento?.versao || 'A'}</p>
                    <p className="text-emerald-200 font-black text-sm">R$ {valorOrcamento.toFixed(2)}</p>
                    <button
                      onClick={() => handleDownloadDocumento(docOrcamento, obra.id, `orcamento-${obra.id}.pdf`)}
                      disabled={!isDocumentoValido(docOrcamento)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition ${isDocumentoValido(docOrcamento) ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDetail({ obra, section: 'proposta' })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDetail({ obra, section: 'proposta' });
                      }
                    }}
                    className="text-left bg-[#0b1220] border border-white/10 hover:border-cyan-400/40 rounded-lg p-3 space-y-2 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-cyan-300 text-xs font-black uppercase tracking-widest">
                      <FileText size={14} /> Proposta
                    </div>
                    <p className="text-white/70 text-xs">Status: {ultimaProposta?.status || '-'}</p>
                    <p className="text-white/70 text-xs">Versão: {ultimaProposta?.versao || 'A'}</p>
                    <button
                      onClick={() => handleDownloadDocumento(docProposta, obra.id, `proposta-${obra.id}.pdf`)}
                      disabled={!isDocumentoValido(docProposta)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition ${isDocumentoValido(docProposta) ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDetail({ obra, section: 'os' })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDetail({ obra, section: 'os' });
                      }
                    }}
                    className="text-left bg-[#0b1220] border border-white/10 hover:border-violet-400/40 rounded-lg p-3 space-y-2 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-violet-300 text-xs font-black uppercase tracking-widest">
                      <Wrench size={14} /> OS
                    </div>
                    <p className="text-white/70 text-xs">Número: {ultimaOs?.ordemServicoNumero || '-'}</p>
                    <p className="text-white/70 text-xs">Aprovação: {ultimaOs?.statusAprovacao || '-'}</p>
                    <button
                      onClick={() => handleDownloadDocumento(docOs, obra.id, `os-${obra.id}.pdf`)}
                      disabled={!isDocumentoValido(docOs)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition ${isDocumentoValido(docOs) ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDetail({ obra, section: 'mediacao' })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDetail({ obra, section: 'mediacao' });
                      }
                    }}
                    className="text-left bg-[#0b1220] border border-white/10 hover:border-amber-400/40 rounded-lg p-3 space-y-2 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-widest">
                      <FileCheck2 size={14} /> Medição
                    </div>
                    <p className="text-white/70 text-xs">Documento: {docPrincipal?.nome || '-'}</p>
                    <p className="text-white/50 text-[11px]">Upload: {formatDateTime(docPrincipal?.dataUpload)}</p>
                    <button
                      onClick={() => handleDownloadDocumento(docPrincipal, obra.id, `medicao-${obra.id}.pdf`)}
                      disabled={!documentoMediacaoValido}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition ${documentoMediacaoValido ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>
                </div>

                {!documentoMediacaoValido && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200 text-xs">
                    Documento de medição inválido. Gere novamente para habilitar download.
                  </div>
                )}

                <div className="flex items-center gap-2 text-white/60 text-[11px]">
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">Serviços: {Array.isArray(obra?.servicos) ? obra.servicos.length : 0}</span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">OS: {osDoNegocio.length}</span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">Docs: {obterDocumentos(obra).length}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDetail && (() => {
        const { obra, section } = selectedDetail;
        const cliente = (clientes || []).find((c: any) => c.id === obra.clienteId);
        const docOrcamento = encontrarDocumentoPorPalavras(obra, ['doc-orcamento', 'orcamento', 'orçamento', 'orc_']);
        const docProposta = encontrarDocumentoPorPalavras(obra, ['doc-proposta', 'proposta', 'proposta_']);
        const docOsDireto = encontrarDocumentoPorPalavras(obra, ['doc-os', '_os_', 'ordem de servico', 'ordem de serviço', 'os_']);
        const osDoNegocio = (Array.isArray(os) ? os : []).filter((item: any) => item.obraId === obra.id);
        const ultimaOs = osDoNegocio.length > 0 ? osDoNegocio[osDoNegocio.length - 1] : null;
        const docOs = docOsDireto || ultimaOs?.documentoAssinaturaAprovacao || null;
        const docsMediacao = obterDocumentosMediacao(obra);
        const docMediacao = docsMediacao[docsMediacao.length - 1] || null;
        const ultimoOrcamento = Array.isArray(obra?.orcamentos) && obra.orcamentos.length > 0 ? obra.orcamentos[obra.orcamentos.length - 1] : null;
        const ultimaProposta = Array.isArray(obra?.propostas) && obra.propostas.length > 0 ? obra.propostas[obra.propostas.length - 1] : null;
        const titulo = {
          orcamento: 'Dados do Orçamento',
          proposta: 'Dados da Proposta',
          os: 'Dados da OS',
          mediacao: 'Dados da Medição',
        }[section];

        const secao = {
          orcamento: (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
                <p><span className="text-white/50">Número:</span> {ultimoOrcamento?.numeroOrcamento || '-'}</p>
                <p><span className="text-white/50">Versão:</span> {ultimoOrcamento?.versao || '-'}</p>
                <p><span className="text-white/50">Status:</span> {ultimoOrcamento?.status || '-'}</p>
                <p><span className="text-white/50">Valor:</span> R$ {safeNumber(ultimoOrcamento?.valores?.precoFinal ?? ultimoOrcamento?.valores?.valorTotalServico ?? obra?.orcamento).toFixed(2)}</p>
              </div>
              <div className="bg-[#0b1220] border border-white/10 rounded-lg p-3 text-sm text-white/80 whitespace-pre-wrap">
                {(ultimoOrcamento?.data?.observacoes || obra?.orcamentoData?.observacoes || 'Sem observações do orçamento.').toString()}
              </div>
              <button onClick={() => handleDownloadDocumento(docOrcamento, obra.id, `orcamento-${obra.id}.pdf`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-widest">
                Download orçamento
              </button>
            </div>
          ),
          proposta: (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
                <p><span className="text-white/50">Número:</span> {ultimaProposta?.numeroProposta || '-'}</p>
                <p><span className="text-white/50">Versão:</span> {ultimaProposta?.versao || '-'}</p>
                <p><span className="text-white/50">Status:</span> {ultimaProposta?.status || '-'}</p>
                <p><span className="text-white/50">Assunto:</span> {ultimaProposta?.assunto || '-'}</p>
              </div>
              <div className="bg-[#0b1220] border border-white/10 rounded-lg p-3 text-sm text-white/80 whitespace-pre-wrap">
                {ultimaProposta?.textoAbertura || 'Sem texto de abertura.'}
              </div>
              <button onClick={() => handleDownloadDocumento(docProposta, obra.id, `proposta-${obra.id}.pdf`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-widest">
                Download proposta
              </button>
            </div>
          ),
          os: (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
                <p><span className="text-white/50">Número:</span> {ultimaOs?.ordemServicoNumero || '-'}</p>
                <p><span className="text-white/50">Status envio:</span> {ultimaOs?.statusEnvio || '-'}</p>
                <p><span className="text-white/50">Status aprovação:</span> {ultimaOs?.statusAprovacao || '-'}</p>
                <p><span className="text-white/50">Supervisor:</span> {ultimaOs?.supervisorEncarregado || '-'}</p>
              </div>
              <div className="bg-[#0b1220] border border-white/10 rounded-lg p-3 text-sm text-white/80 whitespace-pre-wrap">
                {ultimaOs?.descricaoGeralServico || 'Sem descrição geral da OS.'}
              </div>
              <button onClick={() => handleDownloadDocumento(docOs, obra.id, `os-${obra.id}.pdf`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-widest">
                Download OS
              </button>
            </div>
          ),
          mediacao: (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
                <p><span className="text-white/50">Documento:</span> {docMediacao?.nome || '-'}</p>
                <p><span className="text-white/50">Data:</span> {formatDateTime(docMediacao?.dataUpload)}</p>
                <p><span className="text-white/50">Finalizado em:</span> {formatDateTime(obra?.dataFinalizacaoLocal || obra?.dataCadastro)}</p>
                <p><span className="text-white/50">Card:</span> Finalizado</p>
              </div>
              <button onClick={() => handleDownloadDocumento(docMediacao, obra.id, `medicao-${obra.id}.pdf`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-widest">
                Download medição
              </button>
            </div>
          ),
        }[section];

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#101f3d] shadow-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5 border-b border-white/10 bg-white/5">
                <div>
                  <h3 className="text-xl font-black text-white uppercase">{titulo}</h3>
                  <p className="text-white/50 text-xs mt-1">{obra?.nome} • {cliente?.razaoSocial || 'Cliente não informado'}</p>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5">
                {secao}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
