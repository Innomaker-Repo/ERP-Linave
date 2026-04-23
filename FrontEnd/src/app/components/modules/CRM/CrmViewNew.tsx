import React, { useState, useEffect } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Plus, X, FileText, DollarSign, CheckCircle, Clock, ArrowRight, Edit2, ChevronDown, Zap, AlertCircle, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Servico {
  id: string;
  tipo: string;
  categoria: string;
  embarcacao: string;
  localExecucao: string;
  porto: string;
  prazoDes: string;
  descricao: string;
  observacoes?: string;
}

interface DocumentoNegocio {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  dataUpload: string;
  conteudo: string;
}

interface LinhaTabelaMediacao {
  id: string;
  item: string;
  descricao: string;
  unidade: string;
  quantidadeProduzida: string;
  valorUnitario: string;
  total: string;
  observacoes: string;
}

interface LinhaTabelaRecursosMediacao {
  id: string;
  recurso: string;
  funcao: string;
  periodo: string;
  horas: string;
  observacoes: string;
}

interface DocumentoMediacaoForm {
  obraId: string;
  empresa: string;
  cliente: string;
  cnpj: string;
  dataEmissao: string;
  embarcacao: string;
  numeroBM: string;
  periodo: string;
  tabelaItens: LinhaTabelaMediacao[];
  tabelaRecursos: LinhaTabelaRecursosMediacao[];
}

type FaseOS = 
  | 'Pre-Venda' 
  | 'PlanoServico' 
  | 'VendaFechada' 
  | 'Operacao' 
  | 'AnteProjeto' 
  | 'Projeto'
  | 'Fabricacao'
  | 'Teste'
  | 'PrestacaoServico' 
  | 'PosVenda';

interface CrmViewProps {
  searchQuery: string;
}

type CategoriaObra = 'Planejamento' | 'Negociação' | 'Em Andamento' | 'Finalização';

const COLUNAS: { id: CategoriaObra; titulo: string; icon: any; cor: string }[] = [
  { id: 'Planejamento', titulo: 'Planejamento', icon: FileText, cor: 'blue' },
  { id: 'Negociação', titulo: 'Negociação', icon: Clock, cor: 'amber' },
  { id: 'Em Andamento', titulo: 'Em Andamento', icon: ArrowRight, cor: 'purple' },
  { id: 'Finalização', titulo: 'Finalização', icon: CheckCircle, cor: 'emerald' }
];

export function CrmViewNew({ searchQuery }: CrmViewProps) {
  const { obras, os, clientes, saveEntity, userSession } = useErp();
  const [showFormNovoNegocio, setShowFormNovoNegocio] = useState(false);
  const [novoNegocioTab, setNovoNegocioTab] = useState<'dados' | 'servicos' | 'documentos'>('dados');
  const [selectedObraDetalhes, setSelectedObraDetalhes] = useState<any>(null);
  const [showDetalhesObrraModal, setShowDetalhesObraModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingObra, setEditingObra] = useState<any>(null);
  const [expandedOrcamentosummary, setExpandedOrcamentoSummary] = useState(false);
  const [expandedPropostaDetalhes, setExpandedPropostaDetalhes] = useState(false);
  const [showPropostaFullModal, setShowPropostaFullModal] = useState(false);
  const [showOSFullModal, setShowOSFullModal] = useState(false);
  const [showOrcamentoFullModal, setShowOrcamentoFullModal] = useState(false);
  const [showArquivosModal, setShowArquivosModal] = useState(false);
  const [selectedObraArquivos, setSelectedObraArquivos] = useState<any>(null);
  const [showDocumentoMediacaoModal, setShowDocumentoMediacaoModal] = useState(false);
  const [documentoMediacaoForm, setDocumentoMediacaoForm] = useState<DocumentoMediacaoForm | null>(null);
  const [showDocumentoPreviewModal, setShowDocumentoPreviewModal] = useState(false);
  const [documentoVisualizado, setDocumentoVisualizado] = useState<any>(null);

  const indexToVersaoAlfabetica = (index: number) => {
    if (index < 0) return 'A';
    let value = index;
    let output = '';

    while (value >= 0) {
      output = String.fromCharCode((value % 26) + 65) + output;
      value = Math.floor(value / 26) - 1;
    }

    return output;
  };

  const versaoAlfabeticaToIndex = (versao: string) => {
    const cleaned = versao.toUpperCase().replace(/[^A-Z]/g, '');
    if (!cleaned) return -1;

    let index = 0;
    for (let i = 0; i < cleaned.length; i += 1) {
      index = (index * 26) + (cleaned.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const formatarVersaoOrcamento = (versao: any) => {
    if (typeof versao === 'string' && /^[A-Za-z]+$/.test(versao.trim())) {
      return versao.trim().toUpperCase();
    }

    const versaoNumero = Number(versao);
    if (Number.isFinite(versaoNumero) && versaoNumero > 0) {
      return indexToVersaoAlfabetica(Math.floor(versaoNumero) - 1);
    }

    return 'A';
  };

  const formatarEscopoBasicoParaTexto = (escopo: any) => {
    if (!escopo) {
      return '−';
    }

    if (typeof escopo === 'string') {
      return escopo;
    }

    const formatarItemEscopo = (item: any, index: number) => {
      if (!item) return '';
      if (typeof item === 'string') return item;

      const partes = [item.titulo, item.descricaoServico, item.texto].filter(
        (valor) => typeof valor === 'string' && valor.trim(),
      );

      if (Array.isArray(item.linhas) && item.linhas.length > 0) {
        const linhas = item.linhas
          .map((linha: any) => {
            if (!linha?.valores || typeof linha.valores !== 'object') {
              return '';
            }

            const valores = Object.values(linha.valores)
              .filter((valor) => typeof valor === 'string' ? valor.trim() : Boolean(valor))
              .map((valor) => String(valor).trim())
              .filter(Boolean);

            return valores.length > 0 ? `- ${valores.join(' | ')}` : '';
          })
          .filter(Boolean);

        if (linhas.length > 0) {
          partes.push(linhas.join('\n'));
        }
      }

      if (partes.length === 0) {
        return `Item ${index + 1}`;
      }

      return partes.join('\n');
    };

    if (Array.isArray(escopo)) {
      return escopo
        .map((item, index) => formatarItemEscopo(item, index))
        .filter(Boolean)
        .join('\n\n');
    }

    if (typeof escopo === 'object') {
      return formatarItemEscopo(escopo, 0);
    }

    return String(escopo);
  };

  const initialServico: Servico = {
    id: '',
    tipo: '',
    categoria: '',
    embarcacao: '',
    localExecucao: '',
    porto: '',
    prazoDes: '',
    descricao: '',
    observacoes: ''
  };

  const initialForm = {
    empresaPrestadora: 'Linave',
    nomeNegocio: '',
    clienteId: '',
    cnpj: '',
    origemLead: '',
    solicitante: '',
    cargo: '',
    telefone: '',
    email: '',
    dataSolicitacao: new Date().toISOString().split('T')[0],
    dataPrevistaInicio: '',
    dataPrevistaFinal: '',
    servicos: [{ ...initialServico, id: `servico-${Date.now()}` }],
    fase: 'Pre-Venda' as FaseOS,
    docs: {
      requisitos: false,
      proposta: false,
      orcamento: false
    },
    documentosNegocio: [] as DocumentoNegocio[]
  };

  const [formData, setFormData] = useState(initialForm);

  const handleAddServico = () => {
    setFormData({
      ...formData,
      servicos: [...formData.servicos, { ...initialServico, id: `servico-${Date.now()}` }]
    });
  };

  const handleRemoveServico = (idx: number) => {
    if (formData.servicos.length === 1) {
      return alert("Você precisa manter pelo menos um serviço.");
    }
    setFormData({
      ...formData,
      servicos: formData.servicos.filter((_, i) => i !== idx)
    });
  };

  const handleUpdateServico = (idx: number, field: string, value: any) => {
    const updatedServicos = [...formData.servicos];
    updatedServicos[idx] = { ...updatedServicos[idx], [field]: value };
    setFormData({ ...formData, servicos: updatedServicos });
  };

  const handleClienteChange = (clienteId: string) => {
    const cliente = (clientes || []).find(c => c.id === clienteId);
    setFormData({
      ...formData,
      clienteId,
      cnpj: cliente?.cpfCnpj || ''
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseDecimal = (value: string) => {
    const normalized = String(value || '').trim();
    const parsed = normalized.includes(',')
      ? Number(normalized.replace(/\./g, '').replace(',', '.'))
      : Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatDecimal = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

  const gerarIdLinha = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const novaLinhaTabelaMediacao = (): LinhaTabelaMediacao => ({
    id: gerarIdLinha(),
    item: '',
    descricao: '',
    unidade: '',
    quantidadeProduzida: '',
    valorUnitario: '',
    total: '0.00',
    observacoes: ''
  });

  const novaLinhaTabelaRecursosMediacao = (): LinhaTabelaRecursosMediacao => ({
    id: gerarIdLinha(),
    recurso: '',
    funcao: '',
    periodo: '',
    horas: '',
    observacoes: ''
  });

  const formatarDataInputParaBr = (data: string) => {
    if (!data) return 'Nao informado';
    const partes = data.split('-');
    if (partes.length !== 3) return data;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const montarPeriodoMediacao = (obra: any) => {
    const inicio = obra?.dataPrevistaInicio || obra?.inicioPrevisto || obra?.dataSolicitacao || '';
    const fim = obra?.dataPrevistaFinal || obra?.fimPrevisto || '';

    if (inicio && fim) {
      return `${formatarDataInputParaBr(inicio)} a ${formatarDataInputParaBr(fim)}`;
    }
    if (inicio) {
      return `${formatarDataInputParaBr(inicio)} a definir`;
    }
    return '';
  };

  const obterCnpjCliente = (cliente: any) => cliente?.cpfCnpj || cliente?.cnpj || '';

  const handleAbrirDocumentoMediacao = (obra: any) => {
    const obraAtual = (obras || []).find((item: any) => item.id === obra.id) || obra;
    const cliente = (clientes || []).find((item: any) => item.id === obraAtual.clienteId);

    setSelectedObraDetalhes(obraAtual);
    setDocumentoMediacaoForm({
      obraId: obraAtual.id,
      empresa: 'Linave',
      cliente: cliente?.razaoSocial || '',
      cnpj: obterCnpjCliente(cliente),
      dataEmissao: new Date().toISOString().split('T')[0],
      embarcacao: '',
      numeroBM: '',
      periodo: montarPeriodoMediacao(obraAtual),
      tabelaItens: [novaLinhaTabelaMediacao()],
      tabelaRecursos: [novaLinhaTabelaRecursosMediacao()]
    });
    setShowDocumentoMediacaoModal(true);
  };

  const atualizarCampoMediacao = (campo: keyof DocumentoMediacaoForm, valor: any) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [campo]: valor };
    });
  };

  const atualizarLinhaTabelaItens = (linhaId: string, campo: keyof LinhaTabelaMediacao, valor: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      const tabelaItens = prev.tabelaItens.map((linha) => {
        if (linha.id !== linhaId) return linha;

        const proximaLinha = { ...linha, [campo]: valor };
        const quantidade = parseDecimal(proximaLinha.quantidadeProduzida);
        const valorUnitario = parseDecimal(proximaLinha.valorUnitario);
        const total = quantidade * valorUnitario;

        return {
          ...proximaLinha,
          total: formatDecimal(total)
        };
      });

      return {
        ...prev,
        tabelaItens
      };
    });
  };

  const atualizarLinhaTabelaRecursos = (linhaId: string, campo: keyof LinhaTabelaRecursosMediacao, valor: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabelaRecursos: prev.tabelaRecursos.map((linha) => (
          linha.id === linhaId ? { ...linha, [campo]: valor } : linha
        ))
      };
    });
  };

  const adicionarLinhaTabelaItens = () => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabelaItens: [...prev.tabelaItens, novaLinhaTabelaMediacao()]
      };
    });
  };

  const removerLinhaTabelaItens = (linhaId: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      const listaAtualizada = prev.tabelaItens.filter((linha) => linha.id !== linhaId);
      return {
        ...prev,
        tabelaItens: listaAtualizada.length > 0 ? listaAtualizada : [novaLinhaTabelaMediacao()]
      };
    });
  };

  const adicionarLinhaTabelaRecursos = () => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabelaRecursos: [...prev.tabelaRecursos, novaLinhaTabelaRecursosMediacao()]
      };
    });
  };

  const removerLinhaTabelaRecursos = (linhaId: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      const listaAtualizada = prev.tabelaRecursos.filter((linha) => linha.id !== linhaId);
      return {
        ...prev,
        tabelaRecursos: listaAtualizada.length > 0 ? listaAtualizada : [novaLinhaTabelaRecursosMediacao()]
      };
    });
  };

  const handleGerarDocumentoMediacao = () => {
    if (!documentoMediacaoForm) return;

    if (!documentoMediacaoForm.embarcacao.trim()) {
      toast.error('Preencha a embarcação para gerar o documento de medição.');
      return;
    }

    const obraReferencia = (obras || []).find((item: any) => item.id === documentoMediacaoForm.obraId) || selectedObraDetalhes;
    const nomeNegocio = obraReferencia?.nome || 'Negocio';
    const dataGeracao = new Date().toLocaleString('pt-BR');
    const totalGeralMediacao = documentoMediacaoForm.tabelaItens.reduce((soma, linha) => soma + parseDecimal(linha.total), 0);

    const blocoItens = documentoMediacaoForm.tabelaItens
      .map((linha, index) => (
        `${index + 1}. Item: ${linha.item || '-'}\n` +
        `   Descricao: ${linha.descricao || '-'}\n` +
        `   Unidade: ${linha.unidade || '-'}\n` +
        `   Quantidade produzida: ${linha.quantidadeProduzida || '-'}\n` +
        `   Valor por unidade: ${linha.valorUnitario || '-'}\n` +
        `   Total: ${linha.total || '0.00'}\n` +
        `   Observacoes: ${linha.observacoes || '-'}\n`
      ))
      .join('\n');

    const conteudo = `
================================================================================
                    DOCUMENTO DE MEDIÇÃO
================================================================================

Empresa: ${documentoMediacaoForm.empresa}
Cliente: ${documentoMediacaoForm.cliente}
CNPJ: ${documentoMediacaoForm.cnpj || '-'}
Negocio: ${nomeNegocio}
Data de emissão: ${formatarDataInputParaBr(documentoMediacaoForm.dataEmissao)}
Embarcação: ${documentoMediacaoForm.embarcacao}
Nr. BM: ${documentoMediacaoForm.numeroBM || '-'}
Período: ${documentoMediacaoForm.periodo || '-'}

================================================================================
TABELA DE MEDIÇÃO DE SERVIÇOS
================================================================================

${blocoItens || 'Sem registros.'}

================================================================================
RESUMO FINAL DA MEDIÇÃO
================================================================================

Total da medição: R$ ${formatDecimal(totalGeralMediacao)}

================================================================================
Documento gerado automaticamente pelo Linave ERP
Geração: ${dataGeracao}
================================================================================
    `;

    const nomeArquivo = `Mediacao_${documentoMediacaoForm.numeroBM || documentoMediacaoForm.obraId}_${Date.now()}.txt`;
    const conteudoDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(conteudo)}`;

    const obraAtual = (obras || []).find((item: any) => item.id === documentoMediacaoForm.obraId);
    if (obraAtual) {
      const documentosAtuais = Array.isArray(obraAtual.documentosNegocio) ? obraAtual.documentosNegocio : [];
      const novoDocumento: DocumentoNegocio = {
        id: `doc-mediacao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nome: nomeArquivo,
        tipo: 'text/plain',
        tamanho: conteudo.length,
        dataUpload: new Date().toISOString(),
        conteudo: conteudoDataUrl
      };
      persistirObraAtualizada({
        ...obraAtual,
        documentosNegocio: [...documentosAtuais, novoDocumento]
      });
    }

    const elemento = document.createElement('a');
    elemento.href = conteudoDataUrl;
    elemento.download = nomeArquivo;
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);

    toast.success('Documento de medição criado, anexado e baixado com sucesso.');
    setShowDocumentoMediacaoModal(false);
  };

  const dataUrlToBlob = (dataUrl: string) => {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;

    const metadata = parts[0];
    const dataPart = parts[1];
    const mimeMatch = metadata.match(/data:(.*?)(;|$)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const isBase64 = metadata.includes(';base64');
    const raw = isBase64 ? atob(dataPart) : decodeURIComponent(dataPart);
    const bytes = new Uint8Array(raw.length);

    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  };

  const handleVerDocumentoNegocio = (doc: any) => {
    const href = doc?.conteudo || doc?.url;
    if (!href) {
      toast.error('Documento indisponível para visualização.');
      return;
    }
    setDocumentoVisualizado({ ...doc, href });
    setShowDocumentoPreviewModal(true);
  };

  const handleDownloadDocumento = (doc: any) => {
    const href = doc?.conteudo || doc?.url;
    if (!href) {
      toast.error('Documento indisponível para download.');
      return;
    }

    const elemento = document.createElement('a');
    elemento.href = href;
    elemento.download = doc?.nome || 'documento';
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);
  };

  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Falha ao ler arquivo ${file.name}`));
    reader.readAsDataURL(file);
  });

  const handleUploadDocumentosNegocio = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const arquivos = Array.from(files);
    const arquivosPermitidos = arquivos.filter((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isCsv = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv');
      return isPdf || isCsv;
    });

    if (arquivosPermitidos.length !== arquivos.length) {
      toast.error('Apenas arquivos PDF e CSV são permitidos.');
    }

    if (arquivosPermitidos.length === 0) return;

    try {
      const novosDocumentos: DocumentoNegocio[] = await Promise.all(
        arquivosPermitidos.map(async (file) => ({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          nome: file.name,
          tipo: file.type || (file.name.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/pdf'),
          tamanho: file.size,
          dataUpload: new Date().toISOString(),
          conteudo: await fileToDataUrl(file)
        }))
      );

      setFormData(prev => ({
        ...prev,
        documentosNegocio: [...prev.documentosNegocio, ...novosDocumentos]
      }));
      toast.success(`${novosDocumentos.length} documento(s) anexado(s) ao negócio.`);
    } catch (error) {
      toast.error('Não foi possível anexar os documentos. Tente novamente.');
    }
  };

  const handleRemoverDocumentoNegocio = (docId: string) => {
    setFormData(prev => ({
      ...prev,
      documentosNegocio: prev.documentosNegocio.filter(doc => doc.id !== docId)
    }));
  };

  const normalizarOrcamentosDaObra = (obra: any) => {
    const orcamentos = obra?.orcamentos || [];
    if (orcamentos.length > 0) {
      return orcamentos.map((orcamento: any) => ({
        ...orcamento,
        versao: formatarVersaoOrcamento(orcamento?.versao),
        status: orcamento?.status || 'pendente'
      }));
    }

    if (obra?.orcamentoRealizado && obra?.orcamentoData && obra?.orcamentoValores) {
      return [{
        versao: 'A',
        dataCriacao: obra.dataCadastro,
        status: 'pendente',
        numeroOrcamento: obra.orcamentoData.numeroOrcamento,
        data: obra.orcamentoData,
        valores: obra.orcamentoValores
      }];
    }

    return [];
  };

  const persistirObraAtualizada = (obraAtualizada: any, moverParaTopo = false) => {
    const listaBase = obras || [];
    const obrasAtualizadas = moverParaTopo
      ? [obraAtualizada, ...listaBase.filter((o: any) => o.id !== obraAtualizada.id)]
      : listaBase.map((o: any) => (o.id === obraAtualizada.id ? obraAtualizada : o));

    saveEntity('obras', obrasAtualizadas);

    if (selectedObraDetalhes?.id === obraAtualizada.id) {
      setSelectedObraDetalhes(obraAtualizada);
    }
    if (editingObra?.id === obraAtualizada.id) {
      setEditingObra(obraAtualizada);
    }
    if (selectedObraArquivos?.id === obraAtualizada.id) {
      setSelectedObraArquivos(obraAtualizada);
    }
  };

  const criarReorcamentoPorAlteracaoArquivos = (obra: any) => {
    const hoje = new Date().toISOString().split('T')[0];
    const orcamentos = normalizarOrcamentosDaObra(obra);

    if (orcamentos.length === 0) {
      return {
        ...obra,
        orcamentoRealizado: false,
        requerReorcamento: true,
        categoria: 'Planejamento' as CategoriaObra,
        status: 'Aguardando orçamento'
      };
    }

    const ultimoOrcamento = orcamentos[orcamentos.length - 1];
    const jaTemReorcamentoPendente = ultimoOrcamento?.status === 'pendente_reorcamento';

    if (jaTemReorcamentoPendente) {
      return {
        ...obra,
        orcamentos,
        orcamentoRealizado: false,
        requerReorcamento: true,
        categoria: 'Planejamento' as CategoriaObra,
        status: 'Aguardando orçamento'
      };
    }

    const orcamentosRecusados = orcamentos.map((orcamento: any, idx: number, lista: any[]) => (
      idx === lista.length - 1
        ? { ...orcamento, status: 'recusado' as const, dataRecusa: hoje, motivoRecusa: 'Alteração de arquivos' }
        : orcamento
    ));

    const maiorIndiceVersao = orcamentosRecusados.reduce((maior: number, orcamento: any) => {
      const indice = versaoAlfabeticaToIndex(formatarVersaoOrcamento(orcamento?.versao));
      return Math.max(maior, indice);
    }, -1);

    const novaVersao = indexToVersaoAlfabetica(maiorIndiceVersao + 1);

    const novoOrcamentoPendente = {
      versao: novaVersao,
      dataCriacao: hoje,
      status: 'pendente_reorcamento' as const,
      numeroOrcamento: `BM-${new Date().getFullYear()}-${novaVersao}`,
      data: ultimoOrcamento?.data || {},
      valores: ultimoOrcamento?.valores || {
        totalMaoDeObra: 0,
        totalMateriais: 0,
        totalTerceirizados: 0,
        totalBruto: 0,
        totalSemImposto: 0,
        subtotal: 0,
        margem: 0,
        oh: 0,
        impostos: 0,
        valorMargem: 0,
        valorOH: 0,
        valorImpostos: 0,
        precoFinal: 0
      },
      origemRevisao: 'alteracao_arquivos'
    };

    return {
      ...obra,
      orcamentos: [...orcamentosRecusados, novoOrcamentoPendente],
      orcamentoRealizado: false,
      requerReorcamento: true,
      categoria: 'Planejamento' as CategoriaObra,
      status: 'Aguardando orçamento'
    };
  };

  const aplicarAlteracaoDocumentosNoNegocio = (
    obra: any,
    documentosAtualizados: DocumentoNegocio[],
    documentosArquivadosNovos: any[] = []
  ) => {
    const historicoAtual = Array.isArray(obra.documentosNegocioArquivados) ? obra.documentosNegocioArquivados : [];
    const obraComDocumentos = {
      ...obra,
      documentosNegocio: documentosAtualizados,
      documentosNegocioArquivados: [...historicoAtual, ...documentosArquivadosNovos]
    };

    const possuiOrcamento = normalizarOrcamentosDaObra(obraComDocumentos).length > 0;
    if (!possuiOrcamento) {
      persistirObraAtualizada(obraComDocumentos);
      toast.success('Arquivos atualizados com sucesso.');
      return;
    }

    const fazerNovoOrcamento = window.confirm('Fazer novo orçamento?');
    if (!fazerNovoOrcamento) {
      persistirObraAtualizada(obraComDocumentos);
      toast.success('Arquivos atualizados sem alterar orçamento.');
      return;
    }

    const obraReorcamento = criarReorcamentoPorAlteracaoArquivos(obraComDocumentos);
    persistirObraAtualizada(obraReorcamento, true);
    toast.success('Arquivos alterados. Negócio voltou para aguardando orçamento.');
  };

  const handleUploadDocumentoClienteAssinado = async (obra: any, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const arquivo = Array.from(files)[0];
    const isPdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
    const isImagem = arquivo.type === 'image/png' || arquivo.type === 'image/jpeg'
      || arquivo.name.toLowerCase().endsWith('.png')
      || arquivo.name.toLowerCase().endsWith('.jpg')
      || arquivo.name.toLowerCase().endsWith('.jpeg');

    if (!isPdf && !isImagem) {
      toast.error('Apenas arquivos PDF, PNG ou JPG são permitidos.');
      return;
    }

    try {
      const documentoClienteAssinado: DocumentoNegocio = {
        id: `doc-cliente-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nome: arquivo.name,
        tipo: arquivo.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        tamanho: arquivo.size,
        dataUpload: new Date().toISOString(),
        conteudo: await fileToDataUrl(arquivo)
      };

      const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
      persistirObraAtualizada({
        ...obraAtual,
        documentoClienteAssinado
      });

      toast.success('Documento assinado do cliente anexado com sucesso.');
    } catch (error) {
      toast.error('Não foi possível anexar o documento do cliente.');
    }
  };

  const handleRemoverDocumentoClienteAssinado = (obra: any) => {
    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    if (!obraAtual.documentoClienteAssinado) return;

    persistirObraAtualizada({
      ...obraAtual,
      documentoClienteAssinado: null
    });

    toast.success('Documento assinado do cliente removido.');
  };

  const handleAdicionarArquivosNoCard = async (obra: any, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    const arquivos = Array.from(files);
    const arquivosPermitidos = arquivos.filter((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isCsv = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv');
      return isPdf || isCsv;
    });

    if (arquivosPermitidos.length !== arquivos.length) {
      toast.error('Apenas arquivos PDF e CSV são permitidos.');
    }

    if (arquivosPermitidos.length === 0) return;

    try {
      const novosDocumentos: DocumentoNegocio[] = await Promise.all(
        arquivosPermitidos.map(async (file) => ({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          nome: file.name,
          tipo: file.type || (file.name.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/pdf'),
          tamanho: file.size,
          dataUpload: new Date().toISOString(),
          conteudo: await fileToDataUrl(file)
        }))
      );

      const documentosAtuais = Array.isArray(obraAtual.documentosNegocio) ? obraAtual.documentosNegocio : [];
      aplicarAlteracaoDocumentosNoNegocio(obraAtual, [...documentosAtuais, ...novosDocumentos]);
    } catch (error) {
      toast.error('Não foi possível anexar os documentos.');
    }
  };

  const handleRemoverArquivoNoCard = (obra: any, docId: string) => {
    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    const documentosAtuais = Array.isArray(obraAtual.documentosNegocio) ? obraAtual.documentosNegocio : [];
    const documentosAtualizados = documentosAtuais.filter((doc: DocumentoNegocio) => doc.id !== docId);
    const documentosRemovidos = documentosAtuais.filter((doc: DocumentoNegocio) => doc.id === docId);
    const documentosArquivados = documentosRemovidos.map((doc: DocumentoNegocio) => ({
      ...doc,
      statusArquivo: 'arquivado',
      motivoArquivo: 'removido_do_negocio',
      dataArquivamento: new Date().toISOString()
    }));

    if (documentosAtualizados.length === documentosAtuais.length) return;
    aplicarAlteracaoDocumentosNoNegocio(obraAtual, documentosAtualizados, documentosArquivados);
  };

  const handleOpenArquivosModal = (obra: any) => {
    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    setSelectedObraArquivos(obraAtual);
    setShowArquivosModal(true);
  };

  const handleSave = () => {
    if (!formData.nomeNegocio.trim() || !formData.clienteId || !formData.solicitante || formData.servicos.length === 0) {
      return alert("Nome do Negócio, Cliente, Solicitante e pelo menos um Serviço são obrigatórios.");
    }

    if (
      formData.dataPrevistaInicio &&
      formData.dataPrevistaFinal &&
      formData.dataPrevistaFinal < formData.dataPrevistaInicio
    ) {
      return alert('A Data Prevista Final não pode ser anterior à Data Prevista de Início.');
    }

    if (!formData.servicos.some(s => s.descricao.trim())) {
      return alert("Pelo menos um serviço deve ter uma descrição.");
    }

    const novoProjetoId = `PROJ-${Date.now()}`;
    const nomeObra = formData.nomeNegocio.trim();
    const primeiroServico = formData.servicos[0];

    const novaObra = {
      id: novoProjetoId,
      nome: nomeObra,
      clienteId: formData.clienteId,
      status: 'Planejamento',
      categoria: 'Planejamento' as CategoriaObra,
      tipo: primeiroServico.tipo || 'Serviço',
      responsavelTecnico: formData.solicitante,
      responsavelComercial: formData.solicitante,
      solicitante: formData.solicitante,
      telefone: formData.telefone,
      email: formData.email,
      dataCadastro: new Date().toISOString().split('T')[0],
      dataSolicitacao: formData.dataSolicitacao,
      dataPrevistaInicio: formData.dataPrevistaInicio,
      dataPrevistaFinal: formData.dataPrevistaFinal,
      inicioPrevisto: formData.dataPrevistaInicio,
      fimPrevisto: formData.dataPrevistaFinal,
      origemOS: true,
      orcamento: 0,
      orcamentos: [],
      propostas: [],
      documentosNegocio: formData.documentosNegocio,
      servicos: formData.servicos
    };

    const novasOS = formData.servicos.map((servico, idx) => ({
      id: `OS-${Date.now()}-${idx}`,
      clienteId: formData.clienteId,
      solicitante: formData.solicitante,
      email: formData.email,
      telefone: formData.telefone,
      tipo: servico.tipo,
      embarcacao: servico.embarcacao,
      local: servico.localExecucao,
      descricao: servico.descricao,
      observacoes: servico.observacoes,
      porto: servico.porto,
      fase: formData.fase,
      obraId: novoProjetoId,
      obraNome: nomeObra,
      dataCriacao: new Date().toISOString().split('T')[0],
      status: 'Ativo',
      statusEnvio: 'pendente',
      docs: formData.docs
    }));

    saveEntity('obras', [...(obras || []), novaObra]);
    saveEntity('os', [...(os || []), ...novasOS]);

    alert(`${novasOS.length} Serviço(s) criado(s) com sucesso!`);
    setShowFormNovoNegocio(false);
    setNovoNegocioTab('dados');
    setFormData(initialForm);
  };

  const handleShowDetalhes = (obra: any) => {
    setSelectedObraDetalhes(obra);
    setShowDetalhesObraModal(true);
    // Deixar o resumo financeiro sempre fechado quando abrir detalhes
    setExpandedOrcamentoSummary(false);
  };

  const handleEditObra = (obra: any) => {
    setEditingObra(obra);
    setShowEditModal(true);
  };

  const handleSaveEditObra = () => {
    if (!editingObra) return;

    const dataInicio = editingObra.dataPrevistaInicio || editingObra.inicioPrevisto;
    const dataFinal = editingObra.dataPrevistaFinal || editingObra.fimPrevisto;
    if (dataInicio && dataFinal && dataFinal < dataInicio) {
      return alert('A Data Prevista Final não pode ser anterior à Data Prevista de Início.');
    }

    const obrasAtualizadas = obras?.map((o: any) => o.id === editingObra.id ? editingObra : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert("Negócio atualizado com sucesso!");
    setShowEditModal(false);
    setEditingObra(null);
  };

  const handleAprovarOrcamento = () => {
    if (!selectedObraDetalhes) return;

    let proximaCategoria: CategoriaObra = 'Negociação';
    let mensagem = '';

    // Determinar próxima categoria baseado na categoria atual
    if (selectedObraDetalhes.categoria === 'Planejamento') {
      proximaCategoria = 'Negociação';
      mensagem = "Orçamento aprovado! Negócio movido para Negociação.";
    } else if (selectedObraDetalhes.categoria === 'Negociação') {
      const ultimaProposta = Array.isArray(selectedObraDetalhes.propostas) && selectedObraDetalhes.propostas.length > 0
        ? selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1]
        : null;
      const propostaAceita = ultimaProposta?.status === 'aceita';

      if (!propostaAceita) {
        return alert('Para iniciar o trabalho é obrigatório ter proposta aceita.');
      }

      proximaCategoria = 'Em Andamento';
      mensagem = "Orçamento aprovado! Negócio movido para Em Andamento.";
    }

    // Marcar última versão de orçamento como aceita
    const orcamentosAtualizados = selectedObraDetalhes.orcamentos?.map((o: any, idx: number) => 
      idx === selectedObraDetalhes.orcamentos.length - 1 ? { ...o, status: 'aceito' as const } : o
    ) || [];

    const obraAtualizada = {
      ...selectedObraDetalhes,
      orcamentos: orcamentosAtualizados,
      requerReorcamento: false,
      categoria: proximaCategoria as CategoriaObra,
      status: proximaCategoria
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === selectedObraDetalhes.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert(mensagem);
    setShowDetalhesObraModal(false);
    setSelectedObraDetalhes(null);
  };

  const handleRecusarOrcamento = () => {
    if (!selectedObraDetalhes) return;

    const confirmacao = window.confirm("Tem certeza que deseja recusar este orçamento? O negócio voltará para Aguardando orçamento.");
    if (!confirmacao) return;

    const dataRecusa = new Date().toISOString().split('T')[0];
    const orcamentosBase = (selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0)
      ? selectedObraDetalhes.orcamentos
      : (selectedObraDetalhes.orcamentoRealizado && selectedObraDetalhes.orcamentoData && selectedObraDetalhes.orcamentoValores)
        ? [{
            versao: 'A',
            dataCriacao: selectedObraDetalhes.dataCadastro,
            status: 'pendente' as const,
            numeroOrcamento: selectedObraDetalhes.orcamentoData.numeroOrcamento,
            data: selectedObraDetalhes.orcamentoData,
            valores: selectedObraDetalhes.orcamentoValores
          }]
        : [];

    if (orcamentosBase.length === 0) return;
    
    // Marcar última versão como recusada
    const orcamentosAtualizados = orcamentosBase.map((o: any, idx: number, lista: any[]) => 
      idx === lista.length - 1 ? { ...o, status: 'recusado' as const, dataRecusa } : o
    );

    const obraAtualizada = {
      ...selectedObraDetalhes,
      orcamentos: orcamentosAtualizados,
      orcamentoRealizado: false,
      requerReorcamento: false,
      categoria: 'Planejamento' as CategoriaObra,
      status: 'Aguardando orçamento'
    };

    const obrasAtualizadas = [
      obraAtualizada,
      ...((obras || []).filter((o: any) => o.id !== selectedObraDetalhes.id))
    ];
    saveEntity('obras', obrasAtualizadas);

    alert("Orçamento recusado. Negócio retornou para Aguardando orçamento.");
    setShowDetalhesObraModal(false);
    setSelectedObraDetalhes(null);
  };

  const handleDownloadPropostaPDF = () => {
    if (!selectedObraDetalhes?.propostas || selectedObraDetalhes.propostas.length === 0) return;
    
    const ultimaProposta = selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1];
    const cliente = (clientes || []).find(c => c.id === selectedObraDetalhes.clienteId);

    // Gerar conteúdo do PDF em texto
    const conteudo = `
================================================================================
                         PROPOSTA COMERCIAL
================================================================================

Data: ${new Date().toLocaleDateString('pt-BR')}
Número: ${ultimaProposta.numeroProposta}
Versão: ${ultimaProposta.versao}
Status: ${ultimaProposta.status === 'pendente' ? 'Pendente' : ultimaProposta.status === 'aceita' ? 'Aceita' : 'Recusada'}

================================================================================
INFORMAÇÕES BÁSICAS
================================================================================

Cliente: ${cliente?.razaoSocial}
CNPJ: ${cliente?.cnpj}
Negócio: ${selectedObraDetalhes.nome}
Data Criação: ${new Date(ultimaProposta.dataCriacao).toLocaleDateString('pt-BR')}

================================================================================
DETALHES DA PROPOSTA
================================================================================

Atribuído A: ${ultimaProposta.atribuidoA}
Cargo: ${ultimaProposta.cargoContato}
Referência: ${ultimaProposta.referencia}

Saudação: ${ultimaProposta.saudacao}
Assunto: ${ultimaProposta.assunto}

${ultimaProposta.textoAbertura ? `Texto de Abertura:\n${ultimaProposta.textoAbertura}\n` : ''}

================================================================================
ESCOPO DE SERVIÇOS
================================================================================

A - Escopo Básico:
${formatarEscopoBasicoParaTexto(ultimaProposta.escopoBasicoServicos || ultimaProposta.escopoA || 'Não preenchido')}

================================================================================
CONDIÇÕES COMERCIAIS
================================================================================

D - Preço:
${ultimaProposta.preco || 'Não preenchido'}

Impostos/Observações Fiscais:
${ultimaProposta.impostos || 'Não preenchido'}

E - Condições Gerais:
${ultimaProposta.condicoesGerais || 'Não preenchido'}

F - Condições de Pagamento:
${ultimaProposta.condicoesPagamento || 'Não preenchido'}

G - Prazo:
${ultimaProposta.prazo || 'Não preenchido'}

================================================================================
REFERÊNCIAS E ENCERRAMENTO
================================================================================

Referências:
${ultimaProposta.referencias || 'Não preenchido'}

Encerramento:
${ultimaProposta.encerramento || 'Não preenchido'}

Assinado por: ${ultimaProposta.assinaturaNome} (${ultimaProposta.assinaturaCargo})

================================================================================
Documento gerado automaticamente pelo Linave ERP
Geração: ${new Date().toLocaleString('pt-BR')}
================================================================================
    `;

    // Criar blob e baixar
    const elemento = document.createElement('a');
    const arquivo = new Blob([conteudo], { type: 'text/plain' });
    elemento.href = URL.createObjectURL(arquivo);
    elemento.download = `Proposta_${ultimaProposta.numeroProposta}_v${ultimaProposta.versao}.txt`;
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);
  };

  const handleDownloadOSPDF = () => {
    const osDoNegocio = (os || []).filter(o => o.obraId === selectedObraDetalhes.id);
    if (osDoNegocio.length === 0) return;

    // Gerar conteúdo combinado de todas as OS
    const conteudo = `
================================================================================
                    ORDEM(NS) DE SERVIÇO
================================================================================

Data: ${new Date().toLocaleDateString('pt-BR')}
Negócio: ${selectedObraDetalhes.nome}
Cliente: ${(clientes || []).find(c => c.id === selectedObraDetalhes.clienteId)?.razaoSocial}

================================================================================
DETALHES DAS ORDENS
================================================================================

${osDoNegocio.map((o, idx) => `
--- ORDEM ${idx + 1} ---
ID: ${o.id}
Tipo: ${o.tipo}
Status: ${o.status}
Data Criação: ${o.dataCriacao}

Local: ${o.local || o.localExecucao || 'Não especificado'}
Porto: ${o.porto || 'Não especificado'}
Embarcação: ${o.embarcacao || 'Não especificado'}

Descrição:
${o.descricao}

${o.observacoes ? `Observações:\n${o.observacoes}` : ''}

Solicitante: ${o.solicitante}
Contato: ${o.telefone} / ${o.email}
`).join('\n')}

================================================================================
Documento gerado automaticamente pelo Linave ERP
Geração: ${new Date().toLocaleString('pt-BR')}
================================================================================
    `;

    // Criar e fazer download
    const elemento = document.createElement('a');
    const arquivo = new Blob([conteudo], { type: 'text/plain' });
    elemento.href = URL.createObjectURL(arquivo);
    elemento.download = `OS_${selectedObraDetalhes.id}_${new Date().getTime()}.txt`;
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);
    toast.success('OS baixada com sucesso!');
  };

  const handleEnviarOS = () => {
    if (!selectedObraDetalhes) return;

    const osDoNegocio = (os || []).filter(o => o.obraId === selectedObraDetalhes.id);
    if (osDoNegocio.length === 0) return;

    // Marcar todas as OS como enviadas
    const osAtualizadas = osDoNegocio.map((o: any) => ({
      ...o,
      statusEnvio: 'enviada'
    }));

    // Atualizar a lista de OS
    const novaListaOS = os?.map((o: any) => 
      osDoNegocio.some((os: any) => os.id === o.id) 
        ? osAtualizadas.find((oa: any) => oa.id === o.id)
        : o
    ) || osAtualizadas;

    saveEntity('os', novaListaOS);
    toast.success('Ordem(ns) de Serviço enviada(s) com sucesso!');
  };

  const atualizarOSPorId = (osId: string, atualizacao: any) => {
    const listaAtual = Array.isArray(os) ? os : [];
    const novaLista = listaAtual.map((item: any) => (
      item.id === osId ? { ...item, ...atualizacao } : item
    ));
    saveEntity('os', novaLista);
  };

  const handleAprovarOSNoCard = (osId: string) => {
    atualizarOSPorId(osId, {
      statusAprovacao: 'aprovada',
      dataAprovacao: new Date().toISOString().split('T')[0]
    });
    toast.success('OS aprovada com sucesso.');
  };

  const handleUploadAssinaturaAprovacaoOS = async (osId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const arquivo = Array.from(files)[0];
    const isPdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
    const isImagem = arquivo.type === 'image/png' || arquivo.type === 'image/jpeg'
      || arquivo.name.toLowerCase().endsWith('.png')
      || arquivo.name.toLowerCase().endsWith('.jpg')
      || arquivo.name.toLowerCase().endsWith('.jpeg');

    if (!isPdf && !isImagem) {
      toast.error('A assinatura da OS deve ser PDF, PNG ou JPG.');
      return;
    }

    try {
      const documentoAssinaturaAprovacao = {
        id: `assinatura-os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nome: arquivo.name,
        tipo: arquivo.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        tamanho: arquivo.size,
        dataUpload: new Date().toISOString(),
        conteudo: await fileToDataUrl(arquivo)
      };

      atualizarOSPorId(osId, { documentoAssinaturaAprovacao });
      toast.success('Assinatura da OS anexada com sucesso.');
    } catch (error) {
      toast.error('Não foi possível anexar a assinatura da OS.');
    }
  };

  const possuiOSAprovadaParaFinalizacao = (obraId: string) => {
    const osDoNegocio = (os || []).filter((item: any) => item.obraId === obraId);
    return osDoNegocio.some((item: any) => (
      item.statusEnvio === 'enviada'
      && item.statusAprovacao === 'aprovada'
    ));
  };

  const handleAvancarParaFinalizacao = () => {
    if (!selectedObraDetalhes) return;

    const podeFinalizar = possuiOSAprovadaParaFinalizacao(selectedObraDetalhes.id);
    if (!podeFinalizar) {
      return alert('Para avançar para Finalização é obrigatório ter OS enviada e aprovada.');
    }

    const obraAtualizada = {
      ...selectedObraDetalhes,
      categoria: 'Finalização' as CategoriaObra,
      status: 'Finalização'
    };

    const obrasAtualizadas = (obras || []).map((item: any) => (
      item.id === selectedObraDetalhes.id ? obraAtualizada : item
    ));

    saveEntity('obras', obrasAtualizadas);
    setSelectedObraDetalhes(obraAtualizada);
    toast.success('Negócio movido para Finalização.');
  };

  const obrasOrdenadas = (obras || []).filter((obra: any) => 
    !searchQuery || 
    obra.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (clientes || []).find(c => c.id === obra.clienteId)?.razaoSocial.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inputClass = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelClass = "text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block";

  return (
    <div className="p-12 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER COM BOTÃO NOVO NEGÓCIO */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">CRM - NEGÓCIOS</h1>
          <p className="text-white/50 text-xs mt-1">Acompanhe os negócios em cada fase do funil comercial</p>
        </div>
        <button 
          onClick={() => {
            setNovoNegocioTab('dados');
            setShowFormNovoNegocio(true);
          }}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus size={18} className="inline mr-2" /> Novo Negócio
        </button>
      </div>

      {/* KANBAN BOARD */}
      <div className="flex gap-4 sm:gap-5 lg:gap-6 min-h-[600px] overflow-x-auto overflow-y-hidden pb-4 pr-2 snap-x snap-mandatory">
        {COLUNAS.map((coluna) => {
          const IconColuna = coluna.icon;
          const obrasNaColuna = obrasOrdenadas.filter((obra: any) => obra.categoria === coluna.id);
          const corClasse = {
            blue: 'border-blue-500/30 bg-blue-500/5',
            amber: 'border-amber-500/30 bg-amber-500/5',
            purple: 'border-purple-500/30 bg-purple-500/5',
            emerald: 'border-emerald-500/30 bg-emerald-500/5'
          }[coluna.cor];
          const corTexto = {
            blue: 'text-blue-400',
            amber: 'text-amber-400',
            purple: 'text-purple-400',
            emerald: 'text-emerald-400'
          }[coluna.cor];
          const corBg = {
            blue: 'bg-blue-500/20',
            amber: 'bg-amber-500/20',
            purple: 'bg-purple-500/20',
            emerald: 'bg-emerald-500/20'
          }[coluna.cor];

          return (
            <div key={coluna.id} className={`rounded-2xl border ${corClasse} p-4 sm:p-5 lg:p-6 flex flex-col flex-none w-[280px] sm:w-[300px] lg:w-[320px] xl:w-[340px] 2xl:w-[360px] snap-start`}>
              {/* Header da Coluna */}
              <div className="flex items-center gap-3 mb-4 sm:mb-5 lg:mb-6 pb-3 sm:pb-4 border-b border-white/10">
                <div className={`p-2 rounded-lg ${corBg}`}>
                  <IconColuna size={20} className={corTexto} />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-white uppercase text-sm">{coluna.titulo}</h3>
                  <p className={`text-xs font-bold ${corTexto}`}>{obrasNaColuna.length} negócios</p>
                </div>
              </div>

              {/* Cards dos Projetos */}
              <div className="space-y-4 flex-1 overflow-y-auto">
                {obrasNaColuna.length > 0 ? (
                  obrasNaColuna.map((obra: any) => {
                    const cliente = (clientes || []).find(c => c.id === obra.clienteId);
                    const ultimaPropostaCard = Array.isArray(obra.propostas) && obra.propostas.length > 0
                      ? obra.propostas[obra.propostas.length - 1]
                      : null;
                    const propostaAtiva = Boolean(ultimaPropostaCard && ultimaPropostaCard.status !== 'recusada');
                    
                    // Compatibilidade com dados antigos: converter orcamentoRealizado em orcamentos array
                    let temOrcamento = obra.orcamentos && obra.orcamentos.length > 0;
                    let ultimoOrcamento = temOrcamento ? obra.orcamentos[obra.orcamentos.length - 1] : null;
                    
                    // Se não tem novo formato mas tem formato antigo, converter
                    if (!temOrcamento && obra.orcamentoRealizado && obra.orcamentoData && obra.orcamentoValores) {
                      const ultimaProposta = Array.isArray(obra.propostas) && obra.propostas.length > 0
                        ? obra.propostas[obra.propostas.length - 1]
                        : null;
                      const statusNegocio = String(obra.status || '').toLowerCase();
                      const legadoRecusado = obra.requerReorcamento || statusNegocio.includes('aguardando orçamento') || ultimaProposta?.status === 'recusada';
                      temOrcamento = true;
                      ultimoOrcamento = {
                        versao: 'A',
                        dataCriacao: obra.dataCadastro,
                        status: legadoRecusado ? 'recusado' : 'pendente',
                        numeroOrcamento: obra.orcamentoData.numeroOrcamento,
                        data: obra.orcamentoData,
                        valores: obra.orcamentoValores
                      };
                    }

                    const temOrcamentoAtivo = temOrcamento
                      && !obra.requerReorcamento
                      && ultimoOrcamento?.status !== 'recusado'
                      && ultimoOrcamento?.status !== 'pendente_reorcamento';
                    
                    const podeEditar = obra.categoria === 'Planejamento';
                    const podAprovar = obra.categoria === 'Negociação' && temOrcamentoAtivo;
                    const osDoNegocio = (os || []).filter((o: any) => o.obraId === obra.id);

                    return (
                      <div 
                        key={obra.id}
                        onClick={() => handleShowDetalhes(obra)}
                        className={`rounded-xl p-4 transition-all cursor-pointer border-2 ${
                          coluna.cor === 'blue' ? 'bg-blue-500/5 border-blue-500/30 hover:border-blue-400/60 hover:shadow-lg hover:shadow-blue-900/20' :
                          coluna.cor === 'amber' ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-900/20' :
                          coluna.cor === 'purple' ? 'bg-purple-500/5 border-purple-500/30 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/20' :
                          'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-900/20'
                        }`}
                      >
                        {/* Header com Nome e Badge de Status + Editar */}
                        <div className="mb-2 space-y-2">
                          <h4 className="font-black text-white text-sm leading-tight line-clamp-2 break-words">
                            {obra.nome}
                          </h4>
                          {/* Badge + Botão Editar na Direita */}
                          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                            {/* Badge Orçado/Pendente em Planejamento */}
                            {coluna.id === 'Planejamento' && (
                              <>
                                {temOrcamentoAtivo ? (
                                  <div className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-emerald-300 text-[10px] font-black">Orçado</span>
                                  </div>
                                ) : (
                                  <div className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-amber-300 text-[10px] font-black">Aguard. orçamento</span>
                                  </div>
                                )}
                              </>
                            )}
                            {/* Badge Proposta/Pendente em Negociação */}
                            {coluna.id === 'Negociação' && (
                              <>
                                {propostaAtiva ? (
                                  <div className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-cyan-300 text-[10px] font-black">Proposta</span>
                                  </div>
                                ) : (
                                  <div className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-amber-300 text-[10px] font-black">Aguard. proposta</span>
                                  </div>
                                )}
                              </>
                            )}
                            {/* Badge Status OS em 'Em Andamento' */}
                            {coluna.id === 'Em Andamento' && (() => {
                              const osDoNegocio = (os || []).filter((o: any) => o.obraId === obra.id);
                              if (osDoNegocio.length === 0) return null;
                              const osEnviada = osDoNegocio.some((o: any) => o.statusEnvio === 'enviada');
                              const osProntaFinalizacao = osDoNegocio.some((o: any) =>
                                o.statusEnvio === 'enviada'
                                && o.statusAprovacao === 'aprovada'
                                && Boolean(o.documentoAssinaturaAprovacao?.conteudo || o.documentoAssinaturaAprovacao?.url)
                              );
                              return (
                                <>
                                  {osProntaFinalizacao ? (
                                    <div className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full whitespace-nowrap">
                                      <span className="text-emerald-300 text-[10px] font-black">Pronta Finalização</span>
                                    </div>
                                  ) : osEnviada ? (
                                    <div className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 rounded-full whitespace-nowrap">
                                      <span className="text-green-300 text-[10px] font-black">OS Enviada</span>
                                    </div>
                                  ) : (
                                    <div className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap">
                                      <span className="text-amber-300 text-[10px] font-black">Aguard. OS</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            {/* Botão Editar */}
                            {podeEditar && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditObra(obra);
                                }}
                                className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-gradient-to-r from-blue-500/30 to-blue-600/30 hover:from-blue-500/50 hover:to-blue-600/50 border border-blue-400/40 text-blue-300 hover:text-blue-200 rounded transition-all text-[10px] sm:text-xs font-black uppercase tracking-wide"
                              >
                                <Edit2 size={12} className="inline mr-1" /> Editar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cliente */}
                        <p className="text-white/70 text-xs font-bold mb-2 truncate">
                          {cliente?.razaoSocial}
                        </p>

                        {/* Responsável */}
                        {obra.responsavelComercial && (
                          <div className="text-xs text-white/50 mb-2 truncate">
                            {obra.responsavelComercial}
                          </div>
                        )}

                        {/* Serviços Badge (apenas quantidade) */}
                        {obra.servicos && obra.servicos.length > 0 && (
                          <div className="text-[10px] font-bold mb-2">
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              {obra.servicos.length} serv.
                            </span>
                          </div>
                        )}

                        {coluna.id === 'Planejamento' && temOrcamentoAtivo && ultimoOrcamento && (
                          <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-2.5 mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-emerald-400 text-[11px] font-black">ORÇADO</p>
                              <span className="text-emerald-300 font-black text-xs">v{formatarVersaoOrcamento(ultimoOrcamento.versao)}</span>
                            </div>
                            <p className="text-emerald-200 font-black text-base">
                              R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Resumo de Orçamento (apenas em Negociação - se ainda não tem proposta) */}
                        {coluna.id === 'Negociação' && temOrcamentoAtivo && ultimoOrcamento && !propostaAtiva && (
                          <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-2.5 mb-3">
                            <div className="flex justify-between items-center">
                              <p className="text-emerald-400 text-xs font-black">Orçamento v{formatarVersaoOrcamento(ultimoOrcamento.versao)}</p>
                              <span className="text-emerald-300 font-black text-xs">R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {/* Resumo da Proposta (apenas em Negociação) */}
                        {coluna.id === 'Negociação' && propostaAtiva && (() => {
                          const ultimaProposta = obra.propostas[obra.propostas.length - 1];
                          const possuiDocumentoCliente = Boolean(obra.documentoClienteAssinado?.conteudo || obra.documentoClienteAssinado?.url);
                          return (
                            <div className={`rounded-lg p-2.5 mb-3 border ${
                              ultimaProposta.status === 'pendente' 
                                ? 'bg-amber-500/20 border-amber-500/30' 
                                : ultimaProposta.status === 'aceita'
                                ? 'bg-emerald-500/20 border-emerald-500/30'
                                : 'bg-red-500/20 border-red-500/30'
                            }`}>
                              <div className="flex justify-between items-center">
                                <p className="text-xs font-black uppercase">
                                  {ultimaProposta.status === 'pendente' && 'Proposta Pendente'}
                                  {ultimaProposta.status === 'aceita' && 'Proposta Aceita'}
                                  {ultimaProposta.status === 'recusada' && 'Proposta Recusada'}
                                </p>
                                <span className="text-xs font-black">v{ultimaProposta.versao}</span>
                              </div>
                              {ultimaProposta.preco && (
                                <p className="text-xs text-white/80 mt-1">Preço: {ultimaProposta.preco}</p>
                              )}

                              <div className="mt-2.5 pt-2 border-t border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-white/60 font-black uppercase tracking-widest">Doc. cliente</p>
                                  <span className={`text-[10px] font-black ${possuiDocumentoCliente ? 'text-emerald-300' : 'text-amber-300'}`}>
                                    {possuiDocumentoCliente ? 'Anexado' : 'Pendente'}
                                  </span>
                                </div>
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleUploadDocumentoClienteAssinado(obra, e.target.files);
                                    e.currentTarget.value = '';
                                  }}
                                  className="w-full text-[10px] text-white/70 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-500 file:px-2.5 file:py-1 file:text-[10px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-cyan-400"
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Resumo da Proposta (Em Andamento) */}
                        {coluna.id === 'Em Andamento' && obra.propostas && obra.propostas.length > 0 && (() => {
                          const ultimaProposta = obra.propostas[obra.propostas.length - 1];
                          const possuiDocumentoCliente = Boolean(obra.documentoClienteAssinado?.conteudo || obra.documentoClienteAssinado?.url);
                          return (
                            <div className="rounded-lg p-2.5 mb-3 border bg-purple-500/15 border-purple-500/30">
                              <div className="flex justify-between items-center">
                                <p className="text-xs font-black uppercase text-purple-200">Proposta v{ultimaProposta.versao}</p>
                                <span className={`text-[10px] font-black ${
                                  ultimaProposta.status === 'aceita'
                                    ? 'text-emerald-300'
                                    : ultimaProposta.status === 'pendente'
                                      ? 'text-amber-300'
                                      : 'text-red-300'
                                }`}>
                                  {ultimaProposta.status === 'aceita' ? 'Aceita' : ultimaProposta.status === 'pendente' ? 'Pendente' : 'Recusada'}
                                </span>
                              </div>
                              <div className="mt-1.5 flex justify-between items-center text-[10px] text-white/70">
                                <span>Doc. cliente:</span>
                                <span className={possuiDocumentoCliente ? 'text-emerald-300 font-black' : 'text-amber-300 font-black'}>
                                  {possuiDocumentoCliente ? 'Anexado' : 'Pendente'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Resumo de Finalizacao: Orcamento + Proposta + OS */}
                        {coluna.id === 'Finalização' && (() => {
                          const ultimaProposta = Array.isArray(obra.propostas) && obra.propostas.length > 0
                            ? obra.propostas[obra.propostas.length - 1]
                            : null;
                          const temOS = osDoNegocio.length > 0;
                          const osAprovadas = osDoNegocio.filter((item: any) => item.statusAprovacao === 'aprovada').length;

                          return (
                            <div className="space-y-2.5 mb-3">
                              {ultimoOrcamento && (
                                <div className="rounded-lg p-2.5 border bg-emerald-500/15 border-emerald-500/30">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-emerald-200 font-black uppercase">Orcamento</span>
                                    <span className="text-emerald-300 font-black">v{formatarVersaoOrcamento(ultimoOrcamento.versao)}</span>
                                  </div>
                                  <p className="text-emerald-100 text-xs mt-1">{ultimoOrcamento.numeroOrcamento || 'Sem numero'} • R$ {Number(ultimoOrcamento?.valores?.precoFinal || 0).toFixed(2)}</p>
                                </div>
                              )}

                              {ultimaProposta && (
                                <div className="rounded-lg p-2.5 border bg-cyan-500/15 border-cyan-500/30">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-cyan-200 font-black uppercase">Proposta</span>
                                    <span className="text-cyan-300 font-black">v{ultimaProposta.versao || '-'}</span>
                                  </div>
                                  <p className="text-cyan-100 text-xs mt-1">{ultimaProposta.numeroProposta || 'Sem numero'} • {String(ultimaProposta.status || 'pendente').toUpperCase()}</p>
                                </div>
                              )}

                              <div className="rounded-lg p-2.5 border bg-purple-500/15 border-purple-500/30">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-purple-200 font-black uppercase">OS</span>
                                  <span className="text-purple-300 font-black">{temOS ? `${osDoNegocio.length} total` : '0 total'}</span>
                                </div>
                                <p className="text-purple-100 text-xs mt-1">{temOS ? `${osAprovadas} aprovada(s)` : 'Nenhuma OS vinculada'}</p>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirDocumentoMediacao(obra);
                                }}
                                className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-200 text-[11px] font-black uppercase tracking-wider transition-all"
                              >
                                <FileText size={14} className="inline mr-1" /> Criar Documento de Medição
                              </button>
                            </div>
                          );
                        })()}

                        {/* Botão Ver Detalhes */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowDetalhes(obra);
                          }}
                          className="w-full py-2 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 text-white rounded-lg font-black text-xs uppercase tracking-wide transition-all border border-white/10 hover:border-white/20 flex items-center justify-center gap-2"
                        >
                          Ver Detalhes
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <div className="text-white/20 text-2xl mb-2">−</div>
                    <p className="text-white/40 text-xs">Nenhum negócio</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL - NOVO NEGÓCIO */}
      {showFormNovoNegocio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white uppercase">Novo Negócio</h2>
                <p className="text-white/50 text-sm mt-2">Criar e registrar um novo projeto comercial</p>
              </div>
              <button 
                onClick={() => setShowFormNovoNegocio(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-8 space-y-6">

              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-1 flex gap-1">
                <button
                  onClick={() => setNovoNegocioTab('dados')}
                  className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition ${novoNegocioTab === 'dados' ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Dados
                </button>
                <button
                  onClick={() => setNovoNegocioTab('servicos')}
                  className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition ${novoNegocioTab === 'servicos' ? 'bg-purple-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Serviços
                </button>
                <button
                  onClick={() => setNovoNegocioTab('documentos')}
                  className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition ${novoNegocioTab === 'documentos' ? 'bg-amber-500 text-[#0b1220]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Upload Documentos
                </button>
              </div>
              
              {/* SEÇÃO 1: DADOS PRINCIPAIS */}
              {novoNegocioTab === 'dados' && (
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6">
                <h3 className="text-lg font-black text-white uppercase mb-4">Dados Principais</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Empresa Prestadora *</label>
                    <select 
                      className={inputClass}
                      value={formData.empresaPrestadora}
                      onChange={e => setFormData({...formData, empresaPrestadora: e.target.value})}
                    >
                      <option value="Linave">Linave</option>
                      <option value="Nao">Não</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Cliente *</label>
                    <select 
                      className={inputClass}
                      value={formData.clienteId}
                      onChange={e => handleClienteChange(e.target.value)}
                    >
                      <option value="">Selecione um cliente</option>
                      {(clientes || []).map(c => (
                        <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <label className={labelClass}>Nome do Negócio *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.nomeNegocio}
                    onChange={e => setFormData({...formData, nomeNegocio: e.target.value})}
                    placeholder="Ex: Docagem Preventiva Q3 - Navio Aurora"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>CPF/CNPJ</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={formData.cnpj}
                      placeholder="Preenchido automaticamente"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Solicitante *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.solicitante}
                      onChange={e => setFormData({...formData, solicitante: e.target.value})}
                      placeholder="Nome completo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Cargo</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.cargo}
                      onChange={e => setFormData({...formData, cargo: e.target.value})}
                      placeholder="Cargo"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Telefone</label>
                    <input 
                      type="tel"
                      className={inputClass}
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: e.target.value})}
                      placeholder="(11) 9999-9999"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Email</label>
                    <input 
                      type="email"
                      className={inputClass}
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Data da Solicitação</label>
                    <input 
                      type="date"
                      className={inputClass}
                      value={formData.dataSolicitacao}
                      onChange={e => setFormData({...formData, dataSolicitacao: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Data Prevista de Início</label>
                    <input 
                      type="date"
                      className={inputClass}
                      value={formData.dataPrevistaInicio}
                      onChange={e => setFormData({...formData, dataPrevistaInicio: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Data Prevista de Final</label>
                    <input 
                      type="date"
                      className={inputClass}
                      value={formData.dataPrevistaFinal}
                      onChange={e => setFormData({...formData, dataPrevistaFinal: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              )}

              {/* SEÇÃO 2: SERVIÇOS */}
              {novoNegocioTab === 'servicos' && (
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-white uppercase">Serviços a Prestar *</h3>
                  <button 
                    onClick={handleAddServico}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg font-black text-xs uppercase transition"
                  >
                    <Plus size={16} className="inline mr-2" /> Adicionar Serviço
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.servicos.map((servico, idx) => (
                    <div key={servico.id} className="bg-[#0b1220] p-4 rounded-lg border border-white/5 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-white/70 font-bold text-xs">SERVIÇO {idx + 1}</p>
                        {formData.servicos.length > 1 && (
                          <button 
                            onClick={() => handleRemoveServico(idx)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

<div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className={labelClass}>Tipo *</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.tipo}
                            onChange={e => handleUpdateServico(idx, 'tipo', e.target.value)}
                            placeholder="Ex: Pintura"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className={labelClass}>Categoria</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.categoria}
                            onChange={e => handleUpdateServico(idx, 'categoria', e.target.value)}
                            placeholder="Ex: Acabamento"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className={labelClass}>Local Execução</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.localExecucao}
                            onChange={e => handleUpdateServico(idx, 'localExecucao', e.target.value)}
                            placeholder="Ex: Estaleiro"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Descrição *</label>
                        <textarea 
                          className={`${inputClass} h-20 resize-none`}
                          value={servico.descricao}
                          onChange={e => handleUpdateServico(idx, 'descricao', e.target.value)}
                          placeholder="Descreva o serviço em detalhes"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className={labelClass}>Embarcação</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.embarcacao}
                            onChange={e => handleUpdateServico(idx, 'embarcacao', e.target.value)}
                            placeholder="Nome da embarcação"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className={labelClass}>Porto</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.porto}
                            onChange={e => handleUpdateServico(idx, 'porto', e.target.value)}
                            placeholder="Porto"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Observações</label>
                        <textarea 
                          className={`${inputClass} h-12 resize-none`}
                          value={servico.observacoes}
                          onChange={e => handleUpdateServico(idx, 'observacoes', e.target.value)}
                          placeholder="Observações adicionais"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {novoNegocioTab === 'documentos' && (
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-black text-white uppercase mb-1">Documentos do Negócio</h3>
                  <p className="text-white/60 text-xs">Anexe PDFs e CSVs que devem acompanhar o negócio até a finalização.</p>
                </div>

                <div className="bg-[#0b1220] rounded-xl border border-white/10 p-4 space-y-3">
                  <input
                    type="file"
                    accept=".pdf,.csv,application/pdf,text/csv,application/vnd.ms-excel"
                    multiple
                    onChange={(e) => {
                      handleUploadDocumentosNegocio(e.target.files);
                      e.currentTarget.value = '';
                    }}
                    className="w-full text-xs text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-[11px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-amber-400"
                  />
                  <p className="text-[11px] text-white/40">Formatos permitidos: PDF e CSV.</p>
                </div>

                <div className="space-y-2">
                  {formData.documentosNegocio.length > 0 ? (
                    formData.documentosNegocio.map((doc) => (
                      <div key={doc.id} className="bg-[#0b1220] rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{doc.nome}</p>
                          <p className="text-white/40 text-xs">{formatFileSize(doc.tamanho)} • {new Date(doc.dataUpload).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <button
                          onClick={() => handleRemoverDocumentoNegocio(doc.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-black uppercase transition"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="bg-[#0b1220] rounded-lg border border-dashed border-white/15 p-6 text-center">
                      <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Nenhum documento anexado</p>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* BOTÕES */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30"
                >
                  Criar Negócio
                </button>
                <button 
                  onClick={() => setShowFormNovoNegocio(false)}
                  className="px-12 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - DETALHES DA OBRA */}
      {showDetalhesObrraModal && selectedObraDetalhes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="sticky top-0 z-40 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Detalhes do Negócio</h2>
                <p className="text-white/50 text-sm mt-2">{selectedObraDetalhes.nome}</p>
              </div>
              <button 
                onClick={() => setShowDetalhesObraModal(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              
              {/* Informações Básicas */}
              <div className="bg-[#0b1220] rounded-xl p-4 border border-white/5 space-y-3">
                <h3 className="text-white font-black">INFORMAÇÕES BÁSICAS</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/50 text-xs mb-1">Cliente</p>
                    <p className="text-white font-bold">{(clientes || []).find(c => c.id === selectedObraDetalhes.clienteId)?.razaoSocial}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Responsável</p>
                    <p className="text-white font-bold">{selectedObraDetalhes.responsavelComercial || selectedObraDetalhes.solicitante}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Categoria</p>
                    <p className="text-amber-400 font-black">{selectedObraDetalhes.categoria}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Data da Solicitação</p>
                    <p className="text-white font-bold">{selectedObraDetalhes.dataSolicitacao}</p>
                  </div>
                </div>
              </div>

              {/* Serviços */}
              {selectedObraDetalhes.servicos && selectedObraDetalhes.servicos.length > 0 && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20 space-y-3">
                  <h3 className="text-purple-400 font-black">SERVIÇOS ({selectedObraDetalhes.servicos.length})</h3>
                  <div className="space-y-2">
                    {selectedObraDetalhes.servicos.map((servico: any, idx: number) => (
                      <div key={idx} className="bg-[#0b1220] p-3 rounded text-xs border border-white/5">
                        <p className="text-white font-bold mb-2">{servico.tipo} {servico.categoria && `- ${servico.categoria}`}</p>
                        <p className="text-white/70 mb-2">{servico.descricao}</p>
                        <div className="grid grid-cols-3 gap-2 text-white/50 text-xs">
                          {servico.embarcacao && <span>{servico.embarcacao}</span>}
                          {servico.localExecucao && <span>{servico.localExecucao}</span>}
                          {servico.porto && <span>{servico.porto}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(selectedObraDetalhes.documentosNegocio) && selectedObraDetalhes.documentosNegocio.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20 space-y-3">
                  <h3 className="text-amber-400 font-black">DOCUMENTOS ANEXADOS ({selectedObraDetalhes.documentosNegocio.length})</h3>
                  <div className="space-y-2">
                    {selectedObraDetalhes.documentosNegocio.map((doc: any) => (
                      <div key={doc.id || doc.nome} className="bg-[#0b1220] rounded-lg p-3 border border-white/5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                          <p className="text-white/40 text-xs">{doc.tamanho ? formatFileSize(doc.tamanho) : 'Tamanho não informado'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleVerDocumentoNegocio(doc)}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                          >
                            Ver
                          </button>
                          <a
                            href={doc.conteudo || doc.url}
                            download={doc.nome}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-black uppercase transition"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RESUMO DO ORÇAMENTO (Colapsável) */}
              {selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (() => {
                const ultimoOrcamento = selectedObraDetalhes.orcamentos[selectedObraDetalhes.orcamentos.length - 1];
                return (
                  <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl p-6 border border-emerald-500/30 space-y-4">
                    <button
                      onClick={() => setExpandedOrcamentoSummary(!expandedOrcamentosummary)}
                      className="w-full flex justify-between items-center mb-4"
                    >
                      <h3 className="text-emerald-400 font-black text-lg">RESUMO DO ORÇAMENTO (v{formatarVersaoOrcamento(ultimoOrcamento.versao)})</h3>
                      <ChevronDown size={20} className={`text-emerald-400 transition-transform ${expandedOrcamentosummary ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Resumo Financeiro (Sempre Visível) */}
                    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-4 border border-amber-500/30 space-y-2">
                      {(() => {
                        const base = ultimoOrcamento.valores.totalBruto ?? ultimoOrcamento.valores.subtotal;
                        const margemPercent = ultimoOrcamento.valores.margem || 0;
                        const ohPercent = ultimoOrcamento.valores.oh || 0;
                        const impostosPercent = ultimoOrcamento.valores.impostos || 0;
                        const valorMargem = ultimoOrcamento.valores.valorMargem ?? ((base * margemPercent) / 100);
                        const valorOH = ultimoOrcamento.valores.valorOH ?? ((base * ohPercent) / 100);
                        const semImposto = ultimoOrcamento.valores.totalSemImposto ?? (base + valorMargem + valorOH);
                        const valorImposto = ultimoOrcamento.valores.valorImpostos ?? ((semImposto * impostosPercent) / 100);
                        return (
                          <>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">Total Bruto:</span>
                        <span className="text-white font-black">R$ {base.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">Margem ({ultimoOrcamento.valores.margem}%):</span>
                        <span className="text-white font-black">R$ {valorMargem.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">O.H ({ohPercent}%):</span>
                        <span className="text-white font-black">R$ {valorOH.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-amber-500/20 mb-3">
                        <span className="text-white font-bold">Impostos ({ultimoOrcamento.valores.impostos}%):</span>
                        <span className="text-white font-black">R$ {valorImposto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-amber-300 font-black text-lg">TOTAL S/ IMPOSTO:</span>
                        <span className="text-amber-300 font-black text-2xl">R$ {semImposto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-amber-300 font-black text-lg">PREÇO FINAL:</span>
                        <span className="text-amber-300 font-black text-2xl">R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}</span>
                      </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Detalhes Completos (Expandido) */}
                    {expandedOrcamentosummary && (
                      <div className="space-y-4">
                        {/* Dados do Orçamento */}
                        <div className="bg-[#0b1220] rounded-lg p-4 grid grid-cols-3 gap-4 text-sm border border-white/5">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Número</p>
                          <p className="text-white font-black">{ultimoOrcamento.numeroOrcamento}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Solicitante</p>
                          <p className="text-white font-bold">{ultimoOrcamento.data.solicitante || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Responsável Comercial</p>
                          <p className="text-white font-bold">{ultimoOrcamento.data.responsavelComercial || '−'}</p>
                        </div>
                      </div>

                      {/* Mão de Obra */}
                      {ultimoOrcamento.data.maoDeObra && ultimoOrcamento.data.maoDeObra.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">MÃO DE OBRA</h4>
                          <div className="space-y-1 text-xs">
                            {ultimoOrcamento.data.maoDeObra.map((item: any, idx: number) => (
                              item.funcao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.funcao} ({item.quantidade}x {item.dias}d)</span>
                                  <span className="text-white font-bold">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm font-black">
                            <span className="text-white">Total:</span>
                            <span className="text-emerald-400">R$ {(ultimoOrcamento.data.maoDeObra.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Materiais */}
                      {ultimoOrcamento.data.materiais && ultimoOrcamento.data.materiais.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">MATERIAIS</h4>
                          <div className="space-y-1 text-xs">
                            {ultimoOrcamento.data.materiais.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm font-black">
                            <span className="text-white">Total:</span>
                            <span className="text-cyan-400">R$ {(ultimoOrcamento.data.materiais.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Terceirizados */}
                      {ultimoOrcamento.data.terceirizados && ultimoOrcamento.data.terceirizados.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">SERVIÇOS TERCEIRIZADOS</h4>
                          <div className="space-y-1 text-xs">
                            {ultimoOrcamento.data.terceirizados.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm font-black">
                            <span className="text-white">Total:</span>
                            <span className="text-orange-400">R$ {(ultimoOrcamento.data.terceirizados.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Botão Ver Orçamento Completo */}
                    <button
                      onClick={() => setShowOrcamentoFullModal(true)}
                      className="w-full mt-4 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-300 hover:text-emerald-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Eye size={16} /> Ver Orçamento Completo
                    </button>
                  </div>
                );
              })()}

              {/* RESUMO DA PROPOSTA (Negociacao, Em Andamento e Finalizacao) */}
              {['Negociação', 'Em Andamento', 'Finalização'].includes(selectedObraDetalhes.categoria) && selectedObraDetalhes.propostas && selectedObraDetalhes.propostas.length > 0 && (() => {
                const ultimaProposta = selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1];
                const isNegociacao = selectedObraDetalhes.categoria === 'Negociação';
                const documentoClienteAssinado = selectedObraDetalhes.documentoClienteAssinado;
                const possuiDocumentoCliente = Boolean(documentoClienteAssinado?.conteudo || documentoClienteAssinado?.url);
                return (
                  <div className={`rounded-xl p-6 border space-y-4 ${
                    ultimaProposta.status === 'pendente' 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : ultimaProposta.status === 'aceita'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-black text-lg">
                        {ultimaProposta.status === 'pendente' && 'PROPOSTA'}
                        {ultimaProposta.status === 'aceita' && 'PROPOSTA ACEITA'}
                        {ultimaProposta.status === 'recusada' && 'PROPOSTA RECUSADA'}
                      </h3>
                      <span className="text-white font-black text-sm">v{ultimaProposta.versao}</span>
                    </div>
                    
                    <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-3 text-sm">
                      <div>
                        <p className="text-white/50 text-xs mb-1">Status</p>
                        <div className={`px-3 py-1.5 rounded-full w-fit ${
                          ultimaProposta.status === 'pendente' 
                            ? 'bg-amber-500/20 border border-amber-500/40' 
                            : ultimaProposta.status === 'aceita'
                            ? 'bg-emerald-500/20 border border-emerald-500/40'
                            : 'bg-red-500/20 border border-red-500/40'
                        }`}>
                          <span className={`text-xs font-black ${
                            ultimaProposta.status === 'pendente' 
                              ? 'text-amber-300' 
                              : ultimaProposta.status === 'aceita'
                              ? 'text-emerald-300'
                              : 'text-red-300'
                          }`}>
                            {ultimaProposta.status === 'pendente' && 'Pendente'}
                            {ultimaProposta.status === 'aceita' && 'Aceita'}
                            {ultimaProposta.status === 'recusada' && 'Recusada'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-white/50 text-xs mb-1">Número da Proposta</p>
                        <p className="text-white font-bold">{ultimaProposta.numeroProposta}</p>
                      </div>

                      <div>
                        <p className="text-white/50 text-xs mb-1">Data de Criação</p>
                        <p className="text-white font-bold">{new Date(ultimaProposta.dataCriacao).toLocaleDateString('pt-BR')}</p>
                      </div>

                      {ultimaProposta.preco && (
                        <div>
                          <p className="text-white/50 text-xs mb-1">Preço</p>
                          <p className="text-white font-bold">{ultimaProposta.preco}</p>
                        </div>
                      )}

                      {ultimaProposta.prazo && (
                        <div>
                          <p className="text-white/50 text-xs mb-1">Prazo</p>
                          <p className="text-white font-bold">{ultimaProposta.prazo}</p>
                        </div>
                      )}

                      {ultimaProposta.assunto && (
                        <div>
                          <p className="text-white/50 text-xs mb-1">Assunto</p>
                          <p className="text-white font-bold">{ultimaProposta.assunto}</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-white font-black text-sm">Documento do Cliente</p>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-500/20 border border-slate-500/40 text-slate-300">
                          Opcional
                        </span>
                      </div>

                      {isNegociacao && (
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                          onChange={(e) => {
                            handleUploadDocumentoClienteAssinado(selectedObraDetalhes, e.target.files);
                            e.currentTarget.value = '';
                          }}
                          className="w-full text-xs text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-[11px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-amber-400"
                        />
                      )}

                      {documentoClienteAssinado && (
                        <div className="bg-[#101f3d] rounded-lg border border-white/10 p-3 space-y-2">
                          <p className="text-white text-xs font-bold truncate">{documentoClienteAssinado.nome}</p>
                          <p className="text-white/50 text-[11px]">{documentoClienteAssinado.tamanho ? formatFileSize(documentoClienteAssinado.tamanho) : 'Tamanho não informado'}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVerDocumentoNegocio(documentoClienteAssinado)}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-[11px] font-black uppercase transition"
                            >
                              <Eye size={13} className="inline mr-1" /> Ver
                            </button>
                            <button
                              onClick={() => handleDownloadDocumento(documentoClienteAssinado)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase transition"
                            >
                              <Download size={13} className="inline mr-1" /> Download
                            </button>
                            {isNegociacao && (
                              <button
                                onClick={() => handleRemoverDocumentoClienteAssinado(selectedObraDetalhes)}
                                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-[11px] font-black uppercase transition"
                              >
                                <X size={13} className="inline mr-1" /> Remover
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {isNegociacao ? (
                        <p className="text-[11px] text-white/40">
                          O início do trabalho depende apenas de proposta aceita.
                        </p>
                      ) : (
                        <p className="text-[11px] text-white/40">
                          Em andamento: visualização da proposta e dos documentos do negócio.
                        </p>
                      )}
                    </div>

                    {/* Botões de Ação da Proposta */}
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={handleDownloadPropostaPDF}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} /> Download PDF
                      </button>
                      <button
                        onClick={() => setShowPropostaFullModal(true)}
                        className="flex-1 bg-white/10 hover:bg-white/15 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={16} /> Ver Mais
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* SECAO OS - Em Andamento e Finalizacao */}
              {['Em Andamento', 'Finalização'].includes(selectedObraDetalhes.categoria) && (() => {
                const osDoNegocio = (os || []).filter(o => o.obraId === selectedObraDetalhes.id);
                if (osDoNegocio.length === 0) return null;
                
                const osEnviada = osDoNegocio.some((o: any) => o.statusEnvio === 'enviada');
                const osProntaFinalizacao = osDoNegocio.some((o: any) =>
                  o.statusEnvio === 'enviada'
                  && o.statusAprovacao === 'aprovada'
                  && Boolean(o.documentoAssinaturaAprovacao?.conteudo || o.documentoAssinaturaAprovacao?.url)
                );
                return (
                  <div className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl p-6 border border-purple-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-purple-400 font-black text-lg">ORDEM DE SERVIÇO ({osDoNegocio.length})</h3>
                      <div className="flex items-center gap-2">
                        {osProntaFinalizacao ? (
                          <span className="px-2 py-0.5 bg-emerald-500/30 border border-emerald-500/50 rounded-full text-emerald-300 text-[10px] font-black">Pronta p/ Finalização</span>
                        ) : osEnviada ? (
                          <span className="px-2 py-0.5 bg-green-500/30 border border-green-500/50 rounded-full text-green-300 text-[10px] font-black">OS Enviada</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/30 border border-amber-500/50 rounded-full text-amber-300 text-[10px] font-black">Aguard. OS</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {osDoNegocio.map((osbatch, idx) => (
                        <div key={idx} className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-white font-black text-sm mb-1">OS #{idx + 1}: {osbatch.tipo}</p>
                              <p className="text-white/70 text-xs mb-2">{osbatch.local || osbatch.localExecucao}</p>
                            </div>
                            <span className="text-xs text-white/50">{osbatch.dataCriacao}</span>
                          </div>
                          <p className="text-white/70 text-xs">{osbatch.descricao}</p>

                          {osbatch.statusEnvio === 'enviada' && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${osbatch.statusAprovacao === 'aprovada' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}>
                                  {osbatch.statusAprovacao === 'aprovada' ? 'OS Aprovada' : 'OS Pendente'}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${(osbatch.documentoAssinaturaAprovacao?.conteudo || osbatch.documentoAssinaturaAprovacao?.url) ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-red-500/20 border-red-500/40 text-red-300'}`}>
                                  {(osbatch.documentoAssinaturaAprovacao?.conteudo || osbatch.documentoAssinaturaAprovacao?.url) ? 'Assinatura Anexada' : 'Sem Assinatura'}
                                </span>
                              </div>

                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                onChange={(e) => {
                                  handleUploadAssinaturaAprovacaoOS(osbatch.id, e.target.files);
                                  e.currentTarget.value = '';
                                }}
                                className="w-full text-[10px] text-white/70 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-500 file:px-2.5 file:py-1 file:text-[10px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-cyan-400"
                              />

                              {(osbatch.documentoAssinaturaAprovacao?.conteudo || osbatch.documentoAssinaturaAprovacao?.url) && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleVerDocumentoNegocio(osbatch.documentoAssinaturaAprovacao)}
                                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-[11px] font-black uppercase transition"
                                  >
                                    <Eye size={13} className="inline mr-1" /> Ver Assinatura
                                  </button>
                                  <button
                                    onClick={() => handleDownloadDocumento(osbatch.documentoAssinaturaAprovacao)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase transition"
                                  >
                                    <Download size={13} className="inline mr-1" /> Download
                                  </button>
                                </div>
                              )}

                              {osbatch.statusAprovacao !== 'aprovada' && (
                                <button
                                  onClick={() => handleAprovarOSNoCard(osbatch.id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase transition"
                                >
                                  <CheckCircle size={13} className="inline mr-1" /> Aprovar OS
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Botões de Ação para OS */}
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={() => setShowOSFullModal(true)}
                        className="flex-1 bg-gradient-to-r from-purple-500/30 to-purple-600/30 hover:from-purple-500/50 hover:to-purple-600/50 border border-purple-400/40 text-purple-300 hover:text-purple-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={16} /> Ver OS
                      </button>
                      {Array.isArray(selectedObraDetalhes.orcamentos) && selectedObraDetalhes.orcamentos.length > 0 && (
                        <button
                          onClick={() => setShowOrcamentoFullModal(true)}
                          className="flex-1 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-300 hover:text-emerald-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Eye size={16} /> Ver Orçamento
                        </button>
                      )}
                      <button
                        onClick={handleDownloadOSPDF}
                        className="flex-1 bg-gradient-to-r from-blue-500/30 to-blue-600/30 hover:from-blue-500/50 hover:to-blue-600/50 border border-blue-400/40 text-blue-300 hover:text-blue-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} /> Download
                      </button>
                      {!osEnviada && (
                        <button
                          onClick={() => handleEnviarOS()}
                          className="flex-1 bg-gradient-to-r from-green-500/30 to-emerald-600/30 hover:from-green-500/50 hover:to-emerald-600/50 border border-green-400/40 text-green-300 hover:text-green-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={16} /> Enviar OS
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-white/50">
                      Para avançar para Finalização: a OS precisa estar enviada e aprovada.
                    </p>

                    {selectedObraDetalhes.categoria === 'Finalização' && (
                      <button
                        onClick={() => handleAbrirDocumentoMediacao(selectedObraDetalhes)}
                        className="w-full bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-300 hover:text-emerald-100 rounded-lg py-2.5 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <FileText size={16} /> Criar Documento de Medição
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Botões de Ação */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                {selectedObraDetalhes.categoria === 'Planejamento' && selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (
                  <>
                    <button 
                      onClick={handleAprovarOrcamento}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} /> Aprovar Orçamento
                    </button>
                    <button 
                      onClick={handleRecusarOrcamento}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                    >
                      <X size={18} /> Recusar Orçamento
                    </button>
                  </>
                )}
                {selectedObraDetalhes.categoria === 'Negociação' && selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (() => {
                  const ultimaProposta = Array.isArray(selectedObraDetalhes.propostas) && selectedObraDetalhes.propostas.length > 0
                    ? selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1]
                    : null;
                  const podeIniciar = ultimaProposta?.status === 'aceita';

                  if (!podeIniciar) return null;

                  return (
                    <button 
                      onClick={handleAprovarOrcamento}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                    >
                      <Zap size={18} /> Aprovar e Iniciar
                    </button>
                  );
                })()}
                {selectedObraDetalhes.categoria === 'Em Andamento' && (() => {
                  const podeFinalizar = possuiOSAprovadaParaFinalizacao(selectedObraDetalhes.id);
                  return (
                    <button
                      onClick={handleAvancarParaFinalizacao}
                      disabled={!podeFinalizar}
                      className={`flex-1 py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${podeFinalizar
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-emerald-900/30'
                        : 'bg-white/10 text-white/40 cursor-not-allowed shadow-transparent'}`}
                    >
                      <CheckCircle size={18} /> Avançar para Finalização
                    </button>
                  );
                })()}
                <button 
                  onClick={() => setShowDetalhesObraModal(false)}
                  className="flex-1 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - DOCUMENTO DE MEDIÇÃO */}
      {showDocumentoMediacaoModal && documentoMediacaoForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-emerald-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">DOCUMENTO DE MEDIÇÃO</h2>
                <p className="text-white/60 text-sm mt-2">Preencha os dados para gerar a medição do período.</p>
              </div>
              <button
                onClick={() => setShowDocumentoMediacaoModal(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Empresa</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.empresa}
                    readOnly
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Cliente</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.cliente}
                    readOnly
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">CNPJ</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.cnpj}
                    readOnly
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Data de emissão</p>
                  <input
                    type="date"
                    value={documentoMediacaoForm.dataEmissao}
                    onChange={(e) => atualizarCampoMediacao('dataEmissao', e.target.value)}
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Embarcação</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.embarcacao}
                    onChange={(e) => atualizarCampoMediacao('embarcacao', e.target.value)}
                    placeholder="Preencher"
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Nr. BM</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.numeroBM}
                    onChange={(e) => atualizarCampoMediacao('numeroBM', e.target.value)}
                    placeholder="Vazio"
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Período</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.periodo}
                    onChange={(e) => atualizarCampoMediacao('periodo', e.target.value)}
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-emerald-300 text-lg font-black uppercase">Tabela de Medição de Serviços</h3>
                  <button
                    onClick={adicionarLinhaTabelaItens}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-black uppercase"
                  >
                    + Linha
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 text-white/70 uppercase tracking-wider">
                        <th className="border border-white/10 px-3 py-2 text-left">Item</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Descrição</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Unidade</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Quantidade produzida</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Valor / unidade</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Total</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Observações</th>
                        <th className="border border-white/10 px-3 py-2 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentoMediacaoForm.tabelaItens.map((linha) => (
                        <tr key={linha.id} className="text-white">
                          <td className="border border-white/10 p-1.5"><input value={linha.item} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'item', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.descricao} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'descricao', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.unidade} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'unidade', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.quantidadeProduzida} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'quantidadeProduzida', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.valorUnitario} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'valorUnitario', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.total} readOnly className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1 text-emerald-300 font-black" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.observacoes} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'observacoes', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5 text-center">
                            <button
                              onClick={() => removerLinhaTabelaItens(linha.id)}
                              className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300"
                            >
                              <X size={12} className="inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-[#101f3d] rounded-xl border border-white/10 p-4">
                    <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Total da medição</p>
                    <p className="text-emerald-300 font-black text-lg">
                      {`R$ ${formatDecimal(documentoMediacaoForm.tabelaItens.reduce((total, linha) => total + parseDecimal(linha.total), 0))}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2 border-t border-white/10">
                <button
                  onClick={handleGerarDocumentoMediacao}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black uppercase text-sm tracking-widest"
                >
                  <Download size={16} className="inline mr-2" /> Gerar Documento de Medição
                </button>
                <button
                  onClick={() => setShowDocumentoMediacaoModal(false)}
                  className="px-8 py-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-black uppercase text-sm tracking-widest"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - PREVIEW DE DOCUMENTO */}
      {showDocumentoPreviewModal && documentoVisualizado && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 backdrop-blur-md p-6 border-b border-white/10 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-white truncate">{documentoVisualizado.nome || 'Documento'}</h2>
                <p className="text-white/60 text-sm mt-2 truncate">{documentoVisualizado.tipo || 'Tipo não informado'}</p>
              </div>
              <button
                onClick={() => {
                  setShowDocumentoPreviewModal(false);
                  setDocumentoVisualizado(null);
                }}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10 shrink-0"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-0 max-h-[calc(92vh-92px)]">
              <div className="bg-[#0b1220] border-r border-white/10 min-h-[60vh]">
                <iframe
                  title={documentoVisualizado.nome || 'Documento'}
                  src={documentoVisualizado.href}
                  className="w-full h-[70vh] lg:h-[calc(92vh-92px)] bg-white"
                />
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-92px)]">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-white/50 text-xs uppercase font-black tracking-widest">Informações</p>
                  <div className="text-sm space-y-1">
                    <p className="text-white"><span className="text-white/50">Nome:</span> {documentoVisualizado.nome || '-'}</p>
                    <p className="text-white"><span className="text-white/50">Tipo:</span> {documentoVisualizado.tipo || '-'}</p>
                    <p className="text-white"><span className="text-white/50">Tamanho:</span> {documentoVisualizado.tamanho ? formatFileSize(documentoVisualizado.tamanho) : 'Não informado'}</p>
                    <p className="text-white"><span className="text-white/50">Data:</span> {documentoVisualizado.dataUpload ? new Date(documentoVisualizado.dataUpload).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase font-black tracking-widest mb-2">Ações</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleDownloadDocumento(documentoVisualizado)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={16} /> Download
                    </button>
                    <button
                      onClick={() => {
                        setShowDocumentoPreviewModal(false);
                        setDocumentoVisualizado(null);
                      }}
                      className="w-full bg-white/10 hover:bg-white/15 text-white py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - PROPOSTA COMPLETA */}
      {showPropostaFullModal && selectedObraDetalhes?.propostas && selectedObraDetalhes.propostas.length > 0 && (() => {
        const ultimaProposta = selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1];
        const cliente = (clientes || []).find(c => c.id === selectedObraDetalhes.clienteId);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              
              <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">PROPOSTA COMERCIAL - DETALHES COMPLETOS</h2>
                  <p className="text-white/50 text-sm mt-2">Versão {ultimaProposta.versao} • {ultimaProposta.numeroProposta}</p>
                </div>
                <button 
                  onClick={() => setShowPropostaFullModal(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={24} className="text-white/60" />
                </button>
              </div>

              <div className="p-8 space-y-6">

                {/* Informações Básicas */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">INFORMAÇÕES BÁSICAS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cliente</p>
                      <p className="text-white font-bold">{(clientes || []).find(c => c.id === selectedObraDetalhes.clienteId)?.razaoSocial}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Negócio</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.nome}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Status</p>
                      <div className={`px-3 py-1 rounded-full w-fit ${
                        ultimaProposta.status === 'pendente' 
                          ? 'bg-amber-500/20 border border-amber-500/40' 
                          : ultimaProposta.status === 'aceita'
                          ? 'bg-emerald-500/20 border border-emerald-500/40'
                          : 'bg-red-500/20 border border-red-500/40'
                      }`}>
                        <span className={`text-xs font-black ${
                          ultimaProposta.status === 'pendente' 
                            ? 'text-amber-300' 
                            : ultimaProposta.status === 'aceita'
                            ? 'text-emerald-300'
                            : 'text-red-300'
                        }`}>
                          {ultimaProposta.status === 'pendente' && 'Pendente'}
                          {ultimaProposta.status === 'aceita' && 'Aceita'}
                          {ultimaProposta.status === 'recusada' && 'Recusada'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Data de Criação</p>
                      <p className="text-white font-bold">{new Date(ultimaProposta.dataCriacao).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </div>

                {/* Contato e Referências */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">CONTATO E REFERÊNCIAS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Atribuído A</p>
                      <p className="text-white font-bold">{ultimaProposta.atribuidoA}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cargo</p>
                      <p className="text-white font-bold">{ultimaProposta.cargoContato}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-white/50 text-xs mb-1">Referência</p>
                      <p className="text-white font-bold">{ultimaProposta.referencia || '−'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-white/50 text-xs mb-1">Saudação</p>
                      <p className="text-white">{ultimaProposta.saudacao || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Assunto e Abertura */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">ASSUNTO E ABERTURA</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Assunto</p>
                      <p className="text-white font-bold">{ultimaProposta.assunto || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Texto de Abertura</p>
                      <p className="text-white whitespace-pre-wrap">{ultimaProposta.textoAbertura || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Escopos */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                  <h3 className="text-white font-black text-lg">ESCOPOS DE SERVIÇOS</h3>
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black">A - Escopo Básico de Serviços</p>
                    <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.escopoA || '−'}</p>
                  </div>
                </div>

                {/* Condições Comerciais */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                  <h3 className="text-white font-black text-lg">CONDIÇÕES COMERCIAIS</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">D - Preço</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.preco || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">Impostos / Observações Fiscais</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.impostos || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">E - Condições Gerais</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.condicoesGerais || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">F - Condições de Pagamento</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.condicoesPagamento || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">G - Prazo</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.prazo || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Referências e Encerramento */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">REFERÊNCIAS E ENCERRAMENTO</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-white/50 text-xs mb-1 font-black">Referências</p>
                      <p className="text-white whitespace-pre-wrap">{ultimaProposta.referencias || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1 font-black">Encerramento</p>
                      <p className="text-white whitespace-pre-wrap">{ultimaProposta.encerramento || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Assinatura */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">ASSINATURA</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Nome</p>
                      <p className="text-white font-bold">{ultimaProposta.assinaturaNome || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cargo</p>
                      <p className="text-white font-bold">{ultimaProposta.assinaturaCargo || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button
                    onClick={handleDownloadPropostaPDF}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} /> Download PDF
                  </button>
                  <button 
                    onClick={() => setShowPropostaFullModal(false)}
                    className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black text-sm hover:bg-white/15 transition"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL - OS COMPLETA */}
      {showOSFullModal && selectedObraDetalhes && (() => {
        const osDoNegocio = (os || []).filter(o => o.obraId === selectedObraDetalhes.id);
        if (osDoNegocio.length === 0) return null;
        const osPrincipal = osDoNegocio[0];
        const orcamentosBase = Array.isArray(osPrincipal?.orcamentos) && osPrincipal.orcamentos.length > 0
          ? osPrincipal.orcamentos
          : Array.isArray(selectedObraDetalhes.orcamentos) && selectedObraDetalhes.orcamentos.length > 0
            ? selectedObraDetalhes.orcamentos
            : [];
        const propostasBase = Array.isArray(osPrincipal?.propostas) && osPrincipal.propostas.length > 0
          ? osPrincipal.propostas
          : Array.isArray(selectedObraDetalhes.propostas) && selectedObraDetalhes.propostas.length > 0
            ? selectedObraDetalhes.propostas
            : [];
        const ultimoOrcamento = orcamentosBase.length > 0 ? orcamentosBase[orcamentosBase.length - 1] : null;
        const ultimaProposta = propostasBase.length > 0 ? propostasBase[propostasBase.length - 1] : null;
        const documentoClienteAssinado = osPrincipal?.documentoAssinaturaAprovacao || selectedObraDetalhes.documentoClienteAssinado;
        const documentosDaOS = Array.isArray(osPrincipal?.documentosNegocio) && osPrincipal.documentosNegocio.length > 0
          ? osPrincipal.documentosNegocio
          : Array.isArray(selectedObraDetalhes.documentosNegocio) ? selectedObraDetalhes.documentosNegocio : [];
        const servicosDoNegocio = Array.isArray(selectedObraDetalhes.servicos) ? selectedObraDetalhes.servicos : [];
        const maoDeObraOS = Array.isArray(ultimoOrcamento?.data?.maoDeObra) ? ultimoOrcamento.data.maoDeObra : [];
        const materiaisOS = Array.isArray(ultimoOrcamento?.data?.materiais) ? ultimoOrcamento.data.materiais : [];
        const terceirizadosOS = Array.isArray(ultimoOrcamento?.data?.terceirizados) ? ultimoOrcamento.data.terceirizados : [];
        const escopoBasicoProposta = formatarEscopoBasicoParaTexto(ultimaProposta?.escopoBasicoServicos || ultimaProposta?.escopoA || '−');
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              
              <div className="sticky top-0 z-40 bg-gradient-to-r from-purple-500/40 to-violet-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">ORDEM(NS) DE SERVIÇO</h2>
                  <p className="text-white/50 text-sm mt-2">{osDoNegocio.length} ordem(ns) criada(s)</p>
                </div>
                <button 
                  onClick={() => setShowOSFullModal(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={24} className="text-white/60" />
                </button>
              </div>

              <div className="p-8 space-y-6">

                {/* Informações do Negócio */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">NEGÓCIO</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cliente</p>
                      <p className="text-white font-bold">{(clientes || []).find(c => c.id === selectedObraDetalhes.clienteId)?.razaoSocial}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Projeto</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.nome}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Responsável</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.responsavelComercial || selectedObraDetalhes.solicitante}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Data Criação</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.dataCadastro}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">SUMÁRIO CONSOLIDADO DA OS</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">CC</p>
                      <p className="text-white font-bold">{osPrincipal?.cc || 'LN-0731A/26'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Número OS</p>
                      <p className="text-white font-bold">{osPrincipal?.ordemServicoNumero || '0731A'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Emissão</p>
                      <p className="text-white font-bold">{osPrincipal?.dataEmissao || '02/02/2026'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Término previsto</p>
                      <p className="text-white font-bold">{osPrincipal?.dataTerminoPrevisto || '24/02/2026'}</p>
                    </div>
                  </div>
                </div>

                {/* Orçamento */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-emerald-300 font-black text-lg uppercase">Orçamento</h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                      {ultimoOrcamento ? `v${formatarVersaoOrcamento(ultimoOrcamento.versao)}` : 'Sem orçamento'}
                    </span>
                  </div>
                  {ultimoOrcamento ? (
                    <div className="space-y-4 text-sm">
                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Número</p>
                          <p className="text-white font-bold">{ultimoOrcamento.numeroOrcamento || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Solicitante</p>
                          <p className="text-white font-bold">{osPrincipal?.solicitante || selectedObraDetalhes.solicitante || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Responsável Comercial</p>
                          <p className="text-white font-bold">{selectedObraDetalhes.responsavelComercial || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Documentos referência</p>
                          <p className="text-white font-bold">Request SOS26M0047 | Request SOS26M0046</p>
                        </div>
                      </div>

                      {servicosDoNegocio.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">SERVIÇOS</h4>
                          <div className="space-y-2">
                            {servicosDoNegocio.map((servico: any, idx: number) => (
                              <div key={idx} className="bg-[#111b2f] p-3 rounded text-xs border border-white/5">
                                <p className="text-white font-bold mb-2">{servico.tipo} {servico.categoria && `- ${servico.categoria}`}</p>
                                <p className="text-white/70 mb-2 whitespace-pre-wrap">{servico.descricao}</p>
                                <div className="grid grid-cols-3 gap-2 text-white/50 text-xs">
                                  {servico.embarcacao && <span>{servico.embarcacao}</span>}
                                  {servico.localExecucao && <span>{servico.localExecucao}</span>}
                                  {servico.porto && <span>{servico.porto}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {maoDeObraOS.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">MÃO DE OBRA</h4>
                          <div className="space-y-1 text-xs">
                            {maoDeObraOS.map((item: any, idx: number) => (
                              item.funcao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.funcao} ({item.quantidade}x {item.dias}d)</span>
                                  <span className="text-white font-bold">Item listado</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {materiaisOS.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">ITENS COMPRADOS</h4>
                          <div className="space-y-1 text-xs">
                            {materiaisOS.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">Item listado</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {terceirizadosOS.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">SERVIÇOS TERCEIRIZADOS</h4>
                          <div className="space-y-1 text-xs">
                            {terceirizadosOS.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">Item listado</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm">Nenhum orçamento vinculado a esta OS.</p>
                  )}
                </div>

                {/* Proposta */}
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-cyan-300 font-black text-lg uppercase">Proposta</h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                      {ultimaProposta ? `v${ultimaProposta.versao}` : 'Sem proposta'}
                    </span>
                  </div>
                  {ultimaProposta ? (
                    <div className="space-y-4 text-sm">
                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Número</p>
                          <p className="text-white font-bold">{ultimaProposta.numeroProposta || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Status</p>
                          <p className="text-white font-bold">{String(ultimaProposta.status || 'pendente').toUpperCase()}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Referência</p>
                          <p className="text-white font-bold">{ultimaProposta.referencia || 'Seven Ocean - UBU'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Responsável</p>
                          <p className="text-white font-bold">{ultimaProposta.atribuidoA || '−'}</p>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                        <h4 className="text-white font-black text-sm uppercase">Escopo de Serviços</h4>
                        <div>
                          <p className="text-white/50 text-xs mb-2 font-black">A - Escopo Básico de Serviços</p>
                          <p className="text-white whitespace-pre-wrap text-sm">{escopoBasicoProposta}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm">Nenhuma proposta vinculada a esta OS.</p>
                  )}
                </div>

                {documentoClienteAssinado && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-white font-black text-lg">Documento assinado do cliente</h3>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                        Anexado
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-[#0b1220] border border-white/5 rounded-lg p-4">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{documentoClienteAssinado.nome || 'Documento assinado'}</p>
                        <p className="text-white/50 text-xs">{documentoClienteAssinado.tamanho ? formatFileSize(documentoClienteAssinado.tamanho) : 'Tamanho não informado'}</p>
                      </div>
                      <button
                        onClick={() => handleVerDocumentoNegocio(documentoClienteAssinado)}
                        className="px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                      >
                        Ver documento
                      </button>
                    </div>
                  </div>
                )}

                {documentosDaOS.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                    <h3 className="text-white font-black text-lg">DOCUMENTOS DA OS</h3>
                    <div className="space-y-2">
                      {documentosDaOS.map((doc: any) => (
                        <div key={doc.id || doc.nome} className="bg-[#0b1220] rounded-lg p-3 border border-white/5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                            <p className="text-white/40 text-xs">{doc.tamanho ? formatFileSize(doc.tamanho) : 'Tamanho não informado'}</p>
                          </div>
                          <button
                            onClick={() => handleVerDocumentoNegocio(doc)}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                          >
                            Ver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ordens de Serviço */}
                <div className="space-y-4">
                  {osDoNegocio.map((osbatch, idx) => (
                    <div key={idx} className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl p-6 border border-purple-500/30 space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="text-purple-400 font-black text-lg">OS #{idx + 1}</h4>
                        <span className="px-3 py-1 bg-purple-500/30 border border-purple-500/50 rounded-full text-purple-300 text-xs font-black">{osbatch.status}</span>
                      </div>

                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-white/50 text-xs mb-1">ID</p>
                          <p className="text-white font-bold">{osbatch.id}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Tipo de Serviço</p>
                          <p className="text-white font-bold">{osbatch.tipo}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Local</p>
                          <p className="text-white font-bold">{osbatch.local || osbatch.localExecucao || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Porto</p>
                          <p className="text-white font-bold">{osbatch.porto || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Embarcação</p>
                          <p className="text-white font-bold">{osbatch.embarcacao || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Data Criação</p>
                          <p className="text-white font-bold">{osbatch.dataCriacao}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-white/50 text-xs font-black">Descrição</p>
                        <p className="text-white bg-[#0b1220] rounded-lg p-4 border border-white/5 text-sm whitespace-pre-wrap">{osbatch.descricao}</p>
                      </div>

                      {osbatch.observacoes && (
                        <div className="space-y-2">
                          <p className="text-white/50 text-xs font-black">Observações</p>
                          <p className="text-white bg-[#0b1220] rounded-lg p-4 border border-white/5 text-sm whitespace-pre-wrap">{osbatch.observacoes}</p>
                        </div>
                      )}

                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Solicitante</p>
                          <p className="text-white font-bold">{osbatch.solicitante}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Telefone</p>
                          <p className="text-white font-bold">{osbatch.telefone}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Email</p>
                          <p className="text-white font-bold text-xs">{osbatch.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button
                    onClick={handleDownloadOSPDF}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} /> Download TXT
                  </button>
                  <button 
                    onClick={() => setShowOSFullModal(false)}
                    className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black text-sm hover:bg-white/15 transition"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL - ORÇAMENTO COMPLETO */}
      {showOrcamentoFullModal && selectedObraDetalhes?.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (() => {
        const ultimoOrcamento = selectedObraDetalhes.orcamentos[selectedObraDetalhes.orcamentos.length - 1];
        const cliente = (clientes || []).find(c => c.id === selectedObraDetalhes.clienteId);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              
              <div className="sticky top-0 z-40 bg-gradient-to-r from-emerald-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">ORÇAMENTO - DETALHES COMPLETOS</h2>
                  <p className="text-white/50 text-sm mt-2">Versão {formatarVersaoOrcamento(ultimoOrcamento.versao)} • {ultimoOrcamento.numeroOrcamento}</p>
                </div>
                <button 
                  onClick={() => setShowOrcamentoFullModal(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={24} className="text-white/60" />
                </button>
              </div>

              <div className="p-8 space-y-6">

                {/* Informações Básicas */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">INFORMAÇÕES BÁSICAS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cliente</p>
                      <p className="text-white font-bold">{cliente?.razaoSocial}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Número</p>
                      <p className="text-white font-bold">{ultimoOrcamento.numeroOrcamento}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Negócio</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.nome}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Data</p>
                      <p className="text-white font-bold">{ultimoOrcamento.dataCriacao}</p>
                    </div>
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-6 border border-amber-500/30 space-y-3">
                  <h3 className="text-amber-400 font-black text-lg">RESUMO FINANCEIRO</h3>
                  {(() => {
                    const base = ultimoOrcamento.valores.totalBruto ?? ultimoOrcamento.valores.subtotal;
                    const margemPercent = ultimoOrcamento.valores.margem || 0;
                    const ohPercent = ultimoOrcamento.valores.oh || 0;
                    const impostosPercent = ultimoOrcamento.valores.impostos || 0;
                    const valorMargem = ultimoOrcamento.valores.valorMargem ?? ((base * margemPercent) / 100);
                    const valorOH = ultimoOrcamento.valores.valorOH ?? ((base * ohPercent) / 100);
                    const semImposto = ultimoOrcamento.valores.totalSemImposto ?? (base + valorMargem + valorOH);
                    const valorImposto = ultimoOrcamento.valores.valorImpostos ?? ((semImposto * impostosPercent) / 100);
                    return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Total Bruto:</span>
                      <span className="text-white font-black">R$ {base.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Margem ({ultimoOrcamento.valores.margem}%):</span>
                      <span className="text-white font-black">R$ {valorMargem.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">O.H ({ohPercent}%):</span>
                      <span className="text-white font-black">R$ {valorOH.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-amber-500/20">
                      <span className="text-white font-bold">Impostos ({ultimoOrcamento.valores.impostos}%):</span>
                      <span className="text-white font-black">R$ {valorImposto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-white font-bold">TOTAL S/ IMPOSTO:</span>
                      <span className="text-white font-black text-lg">R$ {semImposto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-amber-300 font-black text-lg">PREÇO FINAL:</span>
                      <span className="text-amber-300 font-black text-2xl">R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}</span>
                    </div>
                  </div>
                    );
                  })()}
                </div>

                {/* Mão de Obra */}
                {ultimoOrcamento.data.maoDeObra && ultimoOrcamento.data.maoDeObra.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-black text-lg">MÃO DE OBRA</h3>
                    <div className="space-y-2">
                      {ultimoOrcamento.data.maoDeObra.map((item: any, idx: number) => (
                        item.funcao && (
                          <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded border border-white/5 text-sm">
                            <div>
                              <p className="text-white font-bold">{item.funcao}</p>
                              <p className="text-white/50 text-xs">{item.quantidade}x • {item.dias} dias</p>
                            </div>
                            <span className="text-emerald-400 font-black">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between font-black">
                      <span className="text-white">Total Mão de Obra:</span>
                      <span className="text-emerald-400">R$ {(ultimoOrcamento.data.maoDeObra.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Materiais */}
                {ultimoOrcamento.data.materiais && ultimoOrcamento.data.materiais.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-black text-lg">MATERIAIS</h3>
                    <div className="space-y-2">
                      {ultimoOrcamento.data.materiais.map((item: any, idx: number) => (
                        item.descricao && (
                          <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded border border-white/5 text-sm">
                            <div>
                              <p className="text-white font-bold">{item.descricao}</p>
                              <p className="text-white/50 text-xs">{item.quantidade} {item.unidade}</p>
                            </div>
                            <span className="text-cyan-400 font-black">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between font-black">
                      <span className="text-white">Total Materiais:</span>
                      <span className="text-cyan-400">R$ {(ultimoOrcamento.data.materiais.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Terceirizados */}
                {ultimoOrcamento.data.terceirizados && ultimoOrcamento.data.terceirizados.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-black text-lg">SERVIÇOS TERCEIRIZADOS</h3>
                    <div className="space-y-2">
                      {ultimoOrcamento.data.terceirizados.map((item: any, idx: number) => (
                        item.descricao && (
                          <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded border border-white/5 text-sm">
                            <div>
                              <p className="text-white font-bold">{item.descricao}</p>
                              <p className="text-white/50 text-xs">{item.quantidade} {item.unidade}</p>
                            </div>
                            <span className="text-orange-400 font-black">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between font-black">
                      <span className="text-white">Total Terceirizados:</span>
                      <span className="text-orange-400">R$ {(ultimoOrcamento.data.terceirizados.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button 
                    onClick={() => setShowOrcamentoFullModal(false)}
                    className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black text-sm hover:bg-white/15 transition"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL - GERENCIAR ARQUIVOS DO NEGÓCIO */}
      {showArquivosModal && selectedObraArquivos && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-500/40 to-orange-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Alterar Arquivos do Negócio</h2>
                <p className="text-white/50 text-sm mt-2">{selectedObraArquivos.nome}</p>
              </div>
              <button
                onClick={() => {
                  setShowArquivosModal(false);
                  setSelectedObraArquivos(null);
                }}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-4 space-y-3">
                <p className="text-white/70 text-xs">
                  Ao adicionar ou remover arquivos, você poderá escolher se deseja abrir um novo orçamento.
                </p>
                <input
                  type="file"
                  accept=".pdf,.csv,application/pdf,text/csv,application/vnd.ms-excel"
                  multiple
                  onChange={(e) => {
                    handleAdicionarArquivosNoCard(selectedObraArquivos, e.target.files);
                    e.currentTarget.value = '';
                  }}
                  className="w-full text-xs text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-[11px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-amber-400"
                />
                <p className="text-[11px] text-white/40">Formatos permitidos: PDF e CSV.</p>
              </div>

              <div className="space-y-2">
                {Array.isArray(selectedObraArquivos.documentosNegocio) && selectedObraArquivos.documentosNegocio.length > 0 ? (
                  selectedObraArquivos.documentosNegocio.map((doc: any) => (
                    <div key={doc.id || doc.nome} className="bg-[#0b1220] rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                        <p className="text-white/40 text-xs">{doc.tamanho ? formatFileSize(doc.tamanho) : 'Tamanho não informado'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleVerDocumentoNegocio(doc)}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                        >
                          <Eye size={14} className="inline mr-1" /> Ver
                        </button>
                        <button
                          onClick={() => handleRemoverArquivoNoCard(selectedObraArquivos, doc.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-black uppercase transition"
                        >
                          <X size={14} className="inline mr-1" /> Remover
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#0b1220] rounded-lg border border-dashed border-white/15 p-6 text-center">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Nenhum documento anexado</p>
                  </div>
                )}
              </div>

              {Array.isArray(selectedObraArquivos.documentosNegocioArquivados) && selectedObraArquivos.documentosNegocioArquivados.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-white/60 text-xs font-black uppercase tracking-widest">Documentos Arquivados</p>
                    <span className="text-[11px] text-white/40">{selectedObraArquivos.documentosNegocioArquivados.length} item(ns)</span>
                  </div>

                  {selectedObraArquivos.documentosNegocioArquivados.map((doc: any) => (
                    <div key={`${doc.id}-arquivado-${doc.dataArquivamento || ''}`} className="bg-[#0b1220] rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3 opacity-80">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                        <p className="text-white/40 text-xs">
                          Arquivado em {doc.dataArquivamento ? new Date(doc.dataArquivamento).toLocaleDateString('pt-BR') : 'data não informada'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleVerDocumentoNegocio(doc)}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                      >
                        <Eye size={14} className="inline mr-1" /> Ver
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setShowArquivosModal(false);
                    setSelectedObraArquivos(null);
                  }}
                  className="px-8 bg-white/10 hover:bg-white/15 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - EDITAR NEGÓCIO (apenas em Planejamento) */}
      {showEditModal && editingObra && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Editar Negócio</h2>
                <p className="text-white/50 text-sm mt-2">{editingObra.nome}</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-12">
              
              {/* Informações para editar */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6 space-y-8">
                <h3 className="text-lg font-black text-white uppercase">Dados do Negócio</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <label className={labelClass}>Nome do Negócio</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.nome}
                      onChange={e => setEditingObra({...editingObra, nome: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Cliente</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={(clientes || []).find(c => c.id === editingObra.clienteId)?.razaoSocial || ''}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Responsável Técnico</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.responsavelTecnico}
                      onChange={e => setEditingObra({...editingObra, responsavelTecnico: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Responsável Comercial</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.responsavelComercial}
                      onChange={e => setEditingObra({...editingObra, responsavelComercial: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className={labelClass}>Tipo de Serviço</label>
                  <input 
                    type="text"
                    className={inputClass}
                    value={editingObra.tipo}
                    onChange={e => setEditingObra({...editingObra, tipo: e.target.value})}
                  />
                </div>

                <div className="space-y-2.5">
                  <label className={labelClass}>Contato</label>
                  <div className="grid grid-cols-2 gap-5">
                    <input 
                      type="tel"
                      className={inputClass}
                      placeholder="Telefone"
                      value={editingObra.telefone}
                      onChange={e => setEditingObra({...editingObra, telefone: e.target.value})}
                    />
                    <input 
                      type="email"
                      className={inputClass}
                      placeholder="Email"
                      value={editingObra.email}
                      onChange={e => setEditingObra({...editingObra, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <label className={labelClass}>Data da Solicitação</label>
                    <input 
                      type="date"
                      className={inputClass}
                      value={editingObra.dataSolicitacao || ''}
                      onChange={e => setEditingObra({...editingObra, dataSolicitacao: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Data de Cadastro</label>
                    <input 
                      type="date"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={editingObra.dataCadastro || ''}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <label className={labelClass}>Data Prevista de Início</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={editingObra.dataPrevistaInicio || editingObra.inicioPrevisto || ''}
                      onChange={e => setEditingObra({
                        ...editingObra,
                        dataPrevistaInicio: e.target.value,
                        inicioPrevisto: e.target.value
                      })}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Data Prevista de Final</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={editingObra.dataPrevistaFinal || editingObra.fimPrevisto || ''}
                      onChange={e => setEditingObra({
                        ...editingObra,
                        dataPrevistaFinal: e.target.value,
                        fimPrevisto: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    handleOpenArquivosModal(editingObra);
                  }}
                  className="px-6 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 py-3 rounded-lg font-black uppercase text-sm tracking-widest transition flex items-center gap-2"
                >
                  <FileText size={16} /> Alterar Arquivos
                </button>
                <button 
                  onClick={handleSaveEditObra}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-blue-900/30"
                >
                  Salvar Alterações
                </button>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="px-12 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
