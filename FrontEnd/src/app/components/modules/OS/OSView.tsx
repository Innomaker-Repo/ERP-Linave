import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { extrairIdProjetoDoNumero } from '../../../context/ErpContext';
import { Plus, X, Check, Clock, Zap, Download, Eye, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

// ==========================================
// FUNÇÕES AUXILIARES GERAIS
// ==========================================
const getBase64FromUrl = async (url: string): Promise<string> => {
  try {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return '';
  }
};

const getPrefixoEmpresa = (empresaPrestadora?: string) => {
  if (!empresaPrestadora) return 'LN';
  return empresaPrestadora.toLowerCase().includes('servinave') ? 'SN' : 'LN';
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

// ==========================================
// INTERFACES
// ==========================================
interface DocumentoAssinatura {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  dataUpload: string;
  conteudo: string;
}

interface HoraServicoLinha {
  id: string;
  servico: string;
  hora: number;
}

interface OsResumoConsolidado {
  negocio: {
    nome: string;
    solicitante: string;
    responsavelComercial: string;
    responsavelTecnico: string;
    dataSolicitacao: string;
    servicos: Array<{
      ordem: number;
      tipo: string;
      categoria: string;
      localExecucao: string;
      porto: string;
      descricao: string;
      observacoes: string;
    }>;
  };
  orcamento: {
    numeroOrcamento: string;
    versao: string;
    dataCriacao: string;
    solicitante: string;
    responsavelComercial: string;
    documentosReferencia: string;
    escopoOrcamento: string;
    dadosServicos: Array<{
      ordem: number;
      tipo: string;
      categoria: string;
      embarcacao: string;
      localExecucao: string;
      porto: string;
      prazoDes: string;
      descricao: string;
      observacoes: string;
    }>;
    maoDeObra: Array<{
      funcao: string;
      quantidade: string;
      dias: string;
      observacao: string;
    }>;
    atividades: Array<{
      atividade: string;
      dias: string;
      observacao: string;
    }>;
    materiais: Array<{
      descricao: string;
      unidade: string;
      quantidade: string;
      pesoFator: string;
      observacao: string;
      origemTerceiros: string;
    }>;
    terceirizados: Array<{
      descricao: string;
      unidade: string;
      quantidade: string;
      pesoFator: string;
      observacao: string;
    }>;
    observacoes: string;
  };
  proposta: {
    numeroProposta: string;
    versao: string;
    status: string;
    dataCriacao: string;
    assunto: string;
    textoAbertura: string;
    escopoA: string;
    escopoBasicoServicos: Array<{
      titulo: string;
      descricaoServico: string;
      texto: string;
      colunas: string[];
      linhas: Array<{ valores: Record<string, string> }>;
    }>;
    responsabilidadeContratada: string;
    escopoC: string;
    referencias: string;
    condicoesGerais: string;
    condicoesPagamento: string;
    prazo: string;
    encerramento: string;
    assinaturaNome: string;
    assinaturaCargo: string;
  };
}

interface OsFormData {
  id: string;
  obraId: string;
  clienteId: string;
  cliente: string;
  projeto: string;
  equipamento: string;
  local: string;
  dataEmissao: string;
  cc: string;
  dataInicioPrevisto: string;
  dataTerminoPrevisto: string;
  ordemServicoNumero: string;
  supervisorEncarregado: string;
  descricaoGeralServico: string;
  aSerIncluido: {
    certificadoGas: boolean;
    ventilacao: boolean;
    limpezaAntes: boolean;
    limpezaApos: boolean;
    andaimes: boolean;
    apoioGuindastes: boolean;
    transporteExterno: boolean;
    testesPressao: boolean;
    pintura: boolean;
    lpPm: boolean;
    testeUltrassom: boolean;
    inspecaoDimensional: boolean;
    visualSolda: boolean;
    soldadorCertificado: boolean;
    procedimentoSolda: boolean;
    certificacaoMaterial: boolean;
    vigiaFogo: boolean;
  };
  maoObra: {
    estrutura: number;
    tubulacao: number;
    andaimes: number;
    mecanica: number;
    pintura: number;
    eletrica: number;
    cq: number;
    sms: number;
  };
  horasTrabalhadasPorServico: HoraServicoLinha[];
  statusOs: 'rascunho' | 'emproducao' | 'concluida';
  tipoDocumento?: 'consolidada';
  statusEnvio?: 'pendente' | 'enviada';
  statusAprovacao?: 'pendente' | 'aprovada';
  dataAprovacao?: string;
  documentoAssinaturaAprovacao?: DocumentoAssinatura | null;
  resumoConsolidado?: OsResumoConsolidado;
}

interface OSViewProps {
  searchQuery: string;
}

const A_SER_INCLUIDO_DEFAULT: OsFormData['aSerIncluido'] = {
  certificadoGas: false,
  ventilacao: false,
  limpezaAntes: false,
  limpezaApos: false,
  andaimes: false,
  apoioGuindastes: false,
  transporteExterno: false,
  testesPressao: false,
  pintura: false,
  lpPm: false,
  testeUltrassom: false,
  inspecaoDimensional: false,
  visualSolda: false,
  soldadorCertificado: false,
  procedimentoSolda: false,
  certificacaoMaterial: false,
  vigiaFogo: false
};

const A_SER_INCLUIDO_OPTIONS = [
  { key: 'certificadoGas', label: 'Certificado de Gás Free' },
  { key: 'ventilacao', label: 'Ventilação' },
  { key: 'limpezaAntes', label: 'Limpeza antes' },
  { key: 'limpezaApos', label: 'Limpeza após conclusão' },
  { key: 'andaimes', label: 'Andaimes' },
  { key: 'apoioGuindastes', label: 'Apoio de guindaste' },
  { key: 'transporteExterno', label: 'Transporte externo' },
  { key: 'testesPressao', label: 'Testes de pressão' },
  { key: 'pintura', label: 'Pintura' },
  { key: 'lpPm', label: 'LP / PM' },
  { key: 'testeUltrassom', label: 'Teste de ultrassom' },
  { key: 'inspecaoDimensional', label: 'Inspeção dimensional' },
  { key: 'visualSolda', label: 'Visual de solda' },
  { key: 'soldadorCertificado', label: 'Soldador certificado' },
  { key: 'procedimentoSolda', label: 'Procedimento de solda' },
  { key: 'certificacaoMaterial', label: 'Certificação do material' },
  { key: 'vigiaFogo', label: 'Vigia de fogo' }
] as const;

const listarItensASerIncluido = (aSerIncluido: OsFormData['aSerIncluido']) =>
  A_SER_INCLUIDO_OPTIONS
    .filter((item) => aSerIncluido[item.key])
    .map((item) => item.label);

const criarInitialOsData = (): OsFormData => ({
  id: `OS-CONS-${Date.now()}`,
  obraId: '',
  clienteId: '',
  cliente: '',
  projeto: '',
  equipamento: '',
  local: '',
  dataEmissao: new Date().toISOString().split('T')[0],
  cc: '',
  dataInicioPrevisto: '',
  dataTerminoPrevisto: '',
  ordemServicoNumero: `OS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
  supervisorEncarregado: '',
  descricaoGeralServico: '',
  aSerIncluido: {
    ...A_SER_INCLUIDO_DEFAULT
  },
  maoObra: {
    estrutura: 0,
    tubulacao: 0,
    andaimes: 0,
    mecanica: 0,
    pintura: 0,
    eletrica: 0,
    cq: 0,
    sms: 0
  },
  horasTrabalhadasPorServico: [],
  statusOs: 'rascunho',
  tipoDocumento: 'consolidada',
  statusEnvio: 'pendente',
  statusAprovacao: 'pendente',
  documentoAssinaturaAprovacao: null,
  resumoConsolidado: {
    negocio: {
      nome: '',
      solicitante: '',
      responsavelComercial: '',
      responsavelTecnico: '',
      dataSolicitacao: '',
      servicos: []
    },
    orcamento: {
      numeroOrcamento: '',
      versao: '',
      dataCriacao: '',
      solicitante: '',
      responsavelComercial: '',
      documentosReferencia: '',
      escopoOrcamento: '',
      dadosServicos: [],
      maoDeObra: [],
      atividades: [],
      materiais: [],
      terceirizados: [],
      observacoes: ''
    },
    proposta: {
      numeroProposta: '',
      versao: '',
      status: '',
      dataCriacao: '',
      assunto: '',
      textoAbertura: '',
      escopoA: '',
      escopoBasicoServicos: [],
      responsabilidadeContratada: '',
      escopoC: '',
      referencias: '',
      condicoesGerais: '',
      condicoesPagamento: '',
      prazo: '',
      encerramento: '',
      assinaturaNome: '',
      assinaturaCargo: ''
    }
  }
});

export function OsView({ searchQuery }: OSViewProps) {
  const { obras, clientes, os, saveEntity } = useErp();
  const [showFormNovaOS, setShowFormNovaOS] = useState(false);
  const [showDetalhesOS, setShowDetalhesOS] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OsFormData | null>(null);
  const [formData, setFormData] = useState<OsFormData>(criarInitialOsData());

  const inputClass = 'w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20';
  const labelClass = 'text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block';

  const listaOS = (Array.isArray(os) ? os : []) as OsFormData[];
  const obrasEmAndamento = (Array.isArray(obras) ? obras : []).filter((o: any) => o.categoria === 'Em Andamento');
  const osConsolidadas = listaOS.filter((item: any) => item.tipoDocumento === 'consolidada');
  const obrasSemOsConsolidada = obrasEmAndamento.filter((obra: any) => !osConsolidadas.some((registro) => registro.obraId === obra.id));

  const normalizarHorasTrabalhadas = (linhas: any): HoraServicoLinha[] => {
    if (!Array.isArray(linhas)) return [];
    return linhas
      .map((linha: any, idx: number) => ({
        id: String(linha?.id || `hora-servico-${Date.now()}-${idx}`),
        servico: String(linha?.servico || '').trim(),
        hora: Number(linha?.hora || 0)
      }))
      .filter((linha: HoraServicoLinha) => linha.servico || linha.hora > 0);
  };

  const calcularTotalHoras = (linhas: HoraServicoLinha[]) => (
    normalizarHorasTrabalhadas(linhas).reduce((acc, item) => acc + (Number.isFinite(item.hora) ? item.hora : 0), 0)
  );

  const atualizarHoraServico = (id: string, campo: 'servico' | 'hora', valor: string) => {
    setFormData((prev) => ({
      ...prev,
      horasTrabalhadasPorServico: (prev.horasTrabalhadasPorServico || []).map((linha) => {
        if (linha.id !== id) return linha;
        if (campo === 'hora') {
          const hora = Number(valor);
          return { ...linha, hora: Number.isFinite(hora) ? hora : 0 };
        }
        return { ...linha, servico: valor };
      })
    }));
  };

  const adicionarLinhaHoraServico = () => {
    setFormData((prev) => ({
      ...prev,
      horasTrabalhadasPorServico: [
        ...(prev.horasTrabalhadasPorServico || []),
        { id: `hora-servico-${Date.now()}`, servico: '', hora: 0 }
      ]
    }));
  };

  const removerLinhaHoraServico = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      horasTrabalhadasPorServico: (prev.horasTrabalhadasPorServico || []).filter((linha) => linha.id !== id)
    }));
  };

  const extrairResumoOrcamentoSemValores = (obra: any) => {
    const ultimoOrcamento = Array.isArray(obra?.orcamentos) && obra.orcamentos.length > 0
      ? obra.orcamentos[obra.orcamentos.length - 1]
      : null;
    const data = ultimoOrcamento?.data || {};

    return {
      numeroOrcamento: ultimoOrcamento?.numeroOrcamento || '',
      versao: String(ultimoOrcamento?.versao || ''),
      dataCriacao: ultimoOrcamento?.dataCriacao || '',
      solicitante: data.solicitante || '',
      responsavelComercial: data.responsavelComercial || '',
      documentosReferencia: data.documentosReferencia || '',
      escopoOrcamento: data.escopoOrcamento || '',
      dadosServicos: (Array.isArray(data.dadosServicos) ? data.dadosServicos : []).map((item: any) => ({
        ordem: item.ordem || 0,
        tipo: item.tipo || '',
        categoria: item.categoria || '',
        embarcacao: item.embarcacao || '',
        localExecucao: item.localExecucao || '',
        porto: item.porto || '',
        prazoDes: item.prazoDes || '',
        descricao: item.descricao || '',
        observacoes: item.observacoes || ''
      })),
      maoDeObra: (Array.isArray(data.maoDeObra) ? data.maoDeObra : [])
        .filter((item: any) => item.funcao)
        .map((item: any) => ({
          funcao: item.funcao || '',
          quantidade: String(item.quantidade || ''),
          dias: String(item.dias || ''),
          observacao: item.observacao || ''
        })),
      atividades: (Array.isArray(data.atividades) ? data.atividades : [])
        .filter((item: any) => item.atividade)
        .map((item: any) => ({
          atividade: item.atividade || '',
          dias: String(item.dias || ''),
          observacao: item.observacao || ''
        })),
      materiais: (Array.isArray(data.materiais) ? data.materiais : [])
        .filter((item: any) => item.descricao)
        .map((item: any) => ({
          descricao: item.descricao || '',
          unidade: item.unidade || '',
          quantidade: String(item.quantidade || ''),
          pesoFator: String(item.pesoFator || ''),
          observacao: item.observacao || '',
          origemTerceiros: item.origemTerceiros || ''
        })),
      terceirizados: (Array.isArray(data.terceirizados) ? data.terceirizados : [])
        .filter((item: any) => item.descricao)
        .map((item: any) => ({
          descricao: item.descricao || '',
          unidade: item.unidade || '',
          quantidade: String(item.quantidade || ''),
          pesoFator: String(item.pesoFator || ''),
          observacao: item.observacao || ''
        })),
      observacoes: data.observacoes || ''
    };
  };

  const extrairResumoProposta = (obra: any) => {
    const ultimaProposta = Array.isArray(obra?.propostas) && obra.propostas.length > 0
      ? obra.propostas[obra.propostas.length - 1]
      : null;

    if (!ultimaProposta) {
      return {
        numeroProposta: '',
        versao: '',
        status: '',
        dataCriacao: '',
        assunto: '',
        textoAbertura: '',
        escopoA: '',
        escopoBasicoServicos: [],
        responsabilidadeContratada: '',
        escopoC: '',
        referencias: '',
        condicoesGerais: '',
        condicoesPagamento: '',
        prazo: '',
        encerramento: '',
        assinaturaNome: '',
        assinaturaCargo: ''
      };
    }

    return {
      numeroProposta: ultimaProposta.numeroProposta || '',
      versao: String(ultimaProposta.versao || ''),
      status: ultimaProposta.status || '',
      dataCriacao: ultimaProposta.dataCriacao || '',
      assunto: ultimaProposta.assunto || '',
      textoAbertura: ultimaProposta.textoAbertura || '',
      escopoA: ultimaProposta.escopoA || '',
      escopoBasicoServicos: (Array.isArray(ultimaProposta.escopoBasicoServicos) ? ultimaProposta.escopoBasicoServicos : []).map((escopo: any) => ({
        titulo: escopo.titulo || '',
        descricaoServico: escopo.descricaoServico || '',
        texto: escopo.texto || '',
        colunas: Array.isArray(escopo.colunas) ? escopo.colunas : [],
        linhas: (Array.isArray(escopo.linhas) ? escopo.linhas : []).map((linha: any) => ({
          valores: linha.valores || {}
        }))
      })),
      responsabilidadeContratada: ultimaProposta.responsabilidadeContratada || '',
      escopoC: ultimaProposta.escopoC || '',
      referencias: ultimaProposta.referencias || '',
      condicoesGerais: ultimaProposta.condicoesGerais || '',
      condicoesPagamento: ultimaProposta.condicoesPagamento || '',
      prazo: ultimaProposta.prazo || '',
      encerramento: ultimaProposta.encerramento || '',
      assinaturaNome: ultimaProposta.assinaturaNome || '',
      assinaturaCargo: ultimaProposta.assinaturaCargo || ''
    };
  };

  const gerarDescricaoConsolidada = (obra: any, resumoOrcamento: any, resumoProposta: any) => {
    const servicosNegocio = (Array.isArray(obra?.servicos) ? obra.servicos : [])
      .map((servico: any, index: number) => `${index + 1}. ${servico.tipo || 'Serviço'}${servico.descricao ? ` - ${servico.descricao}` : ''}`)
      .join('\n');

    const servicosOrcamento = (Array.isArray(resumoOrcamento?.dadosServicos) ? resumoOrcamento.dadosServicos : [])
      .map((item: any) => `${item.ordem || '-'} - ${item.tipo || 'Serviço'}${item.localExecucao ? ` (${item.localExecucao})` : ''}`)
      .join('\n');

    const resumoEscopo = (Array.isArray(resumoProposta?.escopoBasicoServicos) ? resumoProposta.escopoBasicoServicos : [])
      .map((escopo: any) => `${escopo.titulo}${escopo.descricaoServico ? ` - ${escopo.descricaoServico}` : ''}`)
      .join('\n');

    return [
      'OS Consolidada gerada automaticamente a partir dos dados do negócio, orçamento e proposta.',
      servicosNegocio ? `\nServiços do negócio:\n${servicosNegocio}` : '',
      servicosOrcamento ? `\nItens do orçamento:\n${servicosOrcamento}` : '',
      resumoEscopo ? `\nEscopo básico da proposta:\n${resumoEscopo}` : ''
    ].join('\n').trim();
  };

  const handleObraChange = (obraId: string) => {
    const obra = obrasEmAndamento.find((item: any) => item.id === obraId);
    if (!obra) return;

    const cliente = (clientes || []).find((item: any) => item.id === obra.clienteId);
    const dataInicioNegocio = obra.dataPrevistaInicio || obra.inicioPrevisto || '';
    const dataTerminoNegocio = obra.dataPrevistaFinal || obra.fimPrevisto || '';

    let ordemServicoNumero = `OS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
    if (Array.isArray(obra.propostas) && obra.propostas.length > 0) {
      const ultimaProposta = obra.propostas[obra.propostas.length - 1];
      const numeroCompleto = ultimaProposta.numeroProposta || ultimaProposta.numero || '';
      ordemServicoNumero = extrairIdProjetoDoNumero(numeroCompleto);
    }

    const resumoConsolidado = {
      negocio: {
        nome: obra.nome || '',
        solicitante: obra.solicitante || '',
        responsavelComercial: obra.responsavelComercial || '',
        responsavelTecnico: obra.responsavelTecnico || '',
        dataSolicitacao: obra.dataSolicitacao || obra.dataCadastro || '',
        servicos: (Array.isArray(obra.servicos) ? obra.servicos : []).map((servico: any, index: number) => ({
          ordem: index + 1,
          tipo: servico.tipo || '',
          categoria: servico.categoria || '',
          localExecucao: servico.localExecucao || '',
          porto: servico.porto || '',
          descricao: servico.descricao || '',
          observacoes: servico.observacoes || ''
        }))
      },
      orcamento: extrairResumoOrcamentoSemValores(obra),
      proposta: extrairResumoProposta(obra)
    };

    setFormData((prev) => ({
      ...prev,
      obraId: obra.id,
      clienteId: obra.clienteId,
      cliente: cliente?.razaoSocial || '',
      projeto: obra.nome || '',
      local: cliente?.endereco || '',
      dataInicioPrevisto: dataInicioNegocio,
      dataTerminoPrevisto: dataTerminoNegocio,
      ordemServicoNumero,
      descricaoGeralServico: gerarDescricaoConsolidada(obra, resumoConsolidado.orcamento, resumoConsolidado.proposta),
      horasTrabalhadasPorServico: (Array.isArray(obra.servicos) ? obra.servicos : []).map((servico: any, index: number) => ({
        id: `hora-servico-${Date.now()}-${index}`,
        servico: servico.tipo || servico.descricao || `Serviço ${index + 1}`,
        hora: 0
      })),
      resumoConsolidado
    }));
  };

  const handleSaveOS = () => {
    if (!formData.obraId) {
      return alert('Selecione uma obra para criar a OS.');
    }

    if (!formData.dataInicioPrevisto || !formData.dataTerminoPrevisto) {
      return alert('Defina as datas previstas no negócio antes de criar a OS.');
    }

    const jaExisteConsolidada = osConsolidadas.some((item) => item.obraId === formData.obraId);
    if (jaExisteConsolidada) {
      return alert('Já existe uma OS consolidada para este negócio.');
    }

    const mao = formData.maoObra || {};
    const hhTotal = (
      Number(mao.estrutura || 0) +
      Number(mao.tubulacao || 0) +
      Number(mao.andaimes || 0) +
      Number(mao.mecanica || 0) +
      Number(mao.pintura || 0) +
      Number(mao.eletrica || 0) +
      Number(mao.cq || 0) +
      Number(mao.sms || 0)
    );

    if (hhTotal === 0) {
      return alert('Adicione pelo menos um valor em MÃO OBRA (H/H) antes de criar a OS.');
    }

    const horasTrabalhadasPorServico = [
      { id: `hora-estrutura-${Date.now()}`, servico: 'Estrutura', hora: Number(mao.estrutura || 0) },
      { id: `hora-tubulacao-${Date.now()}`, servico: 'Tubulação', hora: Number(mao.tubulacao || 0) },
      { id: `hora-andaimes-${Date.now()}`, servico: 'Andaimes', hora: Number(mao.andaimes || 0) },
      { id: `hora-mecanica-${Date.now()}`, servico: 'Mecânica', hora: Number(mao.mecanica || 0) },
      { id: `hora-pintura-${Date.now()}`, servico: 'Pintura', hora: Number(mao.pintura || 0) },
      { id: `hora-eletrica-${Date.now()}`, servico: 'Elétrica', hora: Number(mao.eletrica || 0) },
      { id: `hora-cq-${Date.now()}`, servico: 'C.Q', hora: Number(mao.cq || 0) },
      { id: `hora-sms-${Date.now()}`, servico: 'SMS', hora: Number(mao.sms || 0) }
    ].filter((r) => Number(r.hora) > 0);

    const novaOS: OsFormData = {
      ...formData,
      id: `OS-CONS-${Date.now()}`,
      statusOs: 'emproducao',
      statusEnvio: 'enviada',
      statusAprovacao: 'pendente',
      documentoAssinaturaAprovacao: null,
      horasTrabalhadasPorServico,
      maoObra: {
        ...formData.maoObra
      }
    };

    saveEntity('os', [...listaOS, novaOS]);
    setShowFormNovaOS(false);
    setFormData(criarInitialOsData());
    alert('OS consolidada criada e enviada para produção com sucesso!');
  };

  const handleDeleteOS = (osId: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta OS consolidada?')) return;
    saveEntity('os', listaOS.filter((item) => item.id !== osId));
  };

  const handleDownloadOSFromList = (osParam: OsFormData) => {
    setSelectedOS(osParam);
    setShowDetalhesOS(true);
    setTimeout(() => {
      alert('A OS foi aberta. Clique em "Download PDF" para fazer o download.');
    }, 500);
  };

  const handleShowDetalhes = (item: OsFormData) => {
    setSelectedOS(item);
    setShowDetalhesOS(true);
  };

  // ==========================================
  // FUNÇÃO DE DOWNLOAD PDF (IGUAL CRM VIEW)
  // ==========================================
  const handleDownloadOSPDF = async (osParam?: any) => {
    const osPrincipal = osParam || selectedOS;
    if (!osPrincipal) {
      toast.error('Nenhuma OS selecionada.');
      return;
    }

    const selectedObraDetalhes = (obras || []).find((o: any) => o.id === osPrincipal.obraId);
    
    const orcamentosBase = Array.isArray(osPrincipal?.orcamentos) && osPrincipal.orcamentos.length > 0
      ? osPrincipal.orcamentos
      : Array.isArray(selectedObraDetalhes?.orcamentos) && selectedObraDetalhes.orcamentos.length > 0
        ? selectedObraDetalhes.orcamentos
        : [];
        
    const propostasBase = Array.isArray(osPrincipal?.propostas) && osPrincipal.propostas.length > 0
      ? osPrincipal.propostas
      : Array.isArray(selectedObraDetalhes?.propostas) && selectedObraDetalhes.propostas.length > 0
        ? selectedObraDetalhes.propostas
        : [];
        
    const ultimoOrcamento = orcamentosBase.length > 0 ? orcamentosBase[orcamentosBase.length - 1] : null;
    const ultimaProposta = propostasBase.length > 0 ? propostasBase[propostasBase.length - 1] : null;
    const cliente = (clientes || []).find((c: any) => c.id === (selectedObraDetalhes?.clienteId || osPrincipal.clienteId));
    
    let logoBase64 = await getBase64FromUrl('/image2.jpg');

    const formatDateISO = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
      } catch {
        return dateStr;
      }
    };
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      let y = margin;
      
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, pageWidth - 2 * margin, 35);        
      doc.line(margin + 50, y, margin + 50, y + 15); 
      doc.line(margin + 130, y, margin + 130, y + 15); 
      doc.line(margin, y + 15, pageWidth - margin, y + 15); 
      
      if (logoBase64) {
        const logoFormat = logoBase64.match(/^data:image\/(png|jpe?g)/i)?.[1]?.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(logoBase64, logoFormat, margin + 2, y + 2, 46, 11);
      } else {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('LINAVE', margin + 5, y + 10);
      }
      
      doc.setFontSize(12);
      doc.setFont('Helvetica', 'bold');
      doc.text('ORDEM DE SERVIÇO\nDE PRODUÇÃO', margin + 90, y + 6.5, { align: 'center' });
      
      doc.setFontSize(7);
      doc.text('Data Emissão:', margin + 132, y + 5);
      doc.setFont('Helvetica', 'normal');
      doc.text(formatDateISO(osPrincipal.dataEmissao) || formatDateISO(new Date().toISOString()), margin + 155, y + 5);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('CC.:', margin + 132, y + 10);
      doc.setFont('Helvetica', 'normal');
      doc.text(osPrincipal.cc || 'Não inf.', margin + 142, y + 10);
      y += 15;
      
      const rowH = 5;
      doc.line(margin, y + rowH, pageWidth - margin, y + rowH);
      doc.line(margin, y + rowH * 2, pageWidth - margin, y + rowH * 2);
      doc.line(margin, y + rowH * 3, pageWidth - margin, y + rowH * 3);
      doc.line(margin + 100, y, margin + 100, y + 20); 
      
      doc.setFontSize(8);
      const printDado = (lbl: string, val: string, vx: number, vy: number) => {
        doc.setFont('Helvetica', 'bold');
        doc.text(lbl, vx, vy);
        doc.setFont('Helvetica', 'normal');
        doc.text(val || ' ', vx + 25, vy);
      };
      
      const dataInicio = osPrincipal.dataInicioPrevisto || selectedObraDetalhes?.dataPrevistaInicio;
      const dataTermino = osPrincipal.dataTerminoPrevisto || selectedObraDetalhes?.dataPrevistaFinal;
      
      let idProjetoForPrint = '';
      if (ultimaProposta?.numeroProposta || ultimaProposta?.numero) {
        idProjetoForPrint = extrairIdProjetoDoNumero(ultimaProposta.numeroProposta || ultimaProposta.numero);
      } else if (selectedObraDetalhes?.id) {
        idProjetoForPrint = selectedObraDetalhes.id;
      }
      
      printDado('CLIENTE:', cliente?.razaoSocial || osPrincipal.cliente || '', margin + 2, y + 3.5);
      printDado('Início Previsto:', dataInicio ? formatDateISO(dataInicio) : '', margin + 102, y + 3.5);
      y += rowH;
      
      printDado('PROJETO:', `${selectedObraDetalhes?.nome || osPrincipal.projeto || ''}${idProjetoForPrint ? ' • ' + idProjetoForPrint : ''}`, margin + 2, y + 3.5);
      printDado('Térm. Previsto:', dataTermino ? formatDateISO(dataTermino) : '', margin + 102, y + 3.5);
      y += rowH;
      
      printDado('EQUIPAMENTO:', osPrincipal.equipamento || osPrincipal.tipo || '', margin + 2, y + 3.5);
      printDado('OS Nº:', osPrincipal.ordemServicoNumero || '', margin + 102, y + 3.5);
      y += rowH;
      
      printDado('LOCAL:', osPrincipal.local || osPrincipal.localExecucao || '', margin + 2, y + 3.5);
      printDado('Encarregado:', osPrincipal.supervisorEncarregado || '', margin + 102, y + 3.5);
      y += rowH;
      y += 5; 
      
      const leftW = 120;
      const rightW = (pageWidth - 2 * margin) - leftW;
      
      doc.setFont('Helvetica', 'bold');
      doc.setFillColor(230, 230, 230);
      doc.rect(margin, y, leftW, 6, 'FD');
      doc.rect(margin + leftW, y, rightW, 6, 'FD');
      
      doc.text('DESCRIÇÃO DO SERVIÇO', margin + leftW/2, y + 4, { align: 'center' });
      doc.text('A SER INCLUIDO', margin + leftW + rightW/2, y + 4, { align: 'center' });
      y += 6;
      
      const bodyY = y;
      
      doc.setFont('Helvetica', 'normal');
      const descTexto = ultimaProposta ? formatarEscopoBasicoParaTexto(ultimaProposta.escopoBasicoServicos || ultimaProposta.escopoA) : (osPrincipal.descricao || osPrincipal.descricaoGeralServico || '');
      const descLines = doc.splitTextToSize(descTexto, leftW - 4);
      
      let cursorEsq = bodyY + 5;
      descLines.forEach((l: string) => {
        doc.text(l, margin + 2, cursorEsq);
        cursorEsq += 4;
      });
      
      let baseChecks = osPrincipal?.aSerIncluido || selectedObraDetalhes?.aSerIncluido || {};
      if (typeof baseChecks === 'string') {
        try { baseChecks = JSON.parse(baseChecks); } catch(e) { baseChecks = {}; }
      }

      const getCheck = (uiLabel: string, dbKey: string) => {
        let isChecked = false;
        try {
          const checkboxes = document.querySelectorAll('input[type="checkbox"]');
          for (let i = 0; i < checkboxes.length; i++) {
            const input = checkboxes[i] as HTMLInputElement;
            if (input.parentElement && input.parentElement.textContent && input.parentElement.textContent.includes(uiLabel)) {
              if (input.checked) isChecked = true;
            }
          }
        } catch (e) {}

        if (!isChecked && (baseChecks[dbKey] === true || String(baseChecks[dbKey]) === 'true')) {
          isChecked = true;
        }
        return isChecked;
      };

      const chk = (val: boolean) => val ? '[ X ]' : '[   ]';
      
      const listChecks = [
        { lbl: 'CERTIFICADO DE GÁS FREE', v: getCheck('Certificado de Gás', 'certificadoGas') },
        { lbl: 'VENTILAÇÃO', v: getCheck('Ventilação', 'ventilacao') },
        { lbl: 'LIMPEZA ANTES', v: getCheck('Limpeza antes', 'limpezaAntes') },
        { lbl: 'LIMPEZA APÓS CONCLUSÃO', v: getCheck('Limpeza após', 'limpezaApos') },
        { lbl: 'ANDAIMES', v: getCheck('Andaimes', 'andaimes') },
        { lbl: 'APOIO DE GUINDASTE', v: getCheck('Apoio de guindaste', 'apoioGuindastes') },
        { lbl: 'TRANSPORTE EXTERNO', v: getCheck('Transporte externo', 'transporteExterno') },
        { lbl: 'TESTE DE PRESSÃO', v: getCheck('Testes de pressão', 'testesPressao') },
        { lbl: 'PINTURA', v: getCheck('Pintura', 'pintura') },
        { lbl: 'LP / PM', v: getCheck('LP / PM', 'lpPm') },
        { lbl: 'TESTE DE ULTRASSOM', v: getCheck('Teste de ultrassom', 'testeUltrassom') },
        { lbl: 'INSPEÇÃO DIMENSIONAL', v: getCheck('Inspeção dimensional', 'inspecaoDimensional') },
        { lbl: 'VISUAL DE SOLDA', v: getCheck('Visual de solda', 'visualSolda') },
        { lbl: 'SOLDADOR CERTIFICADO', v: getCheck('Soldador certificado', 'soldadorCertificado') },
        { lbl: 'PROCEDIMENTO DE SOLDA', v: getCheck('Procedimento de solda', 'procedimentoSolda') },
        { lbl: 'CERTIFICAÇÃO DO MATERIAL', v: getCheck('Certificação do material', 'certificacaoMaterial') },
        { lbl: 'VIGIA DE FOGO', v: getCheck('Vigia de fogo', 'vigiaFogo') }
      ];
      
      let cursorDir = bodyY + 5;
      doc.setFontSize(7);
      listChecks.forEach(c => {
        doc.setFont('Helvetica', 'bold');
        doc.text(chk(c.v), margin + leftW + 2, cursorDir);
        doc.setFont('Helvetica', 'normal');
        doc.text(c.lbl, margin + leftW + 10, cursorDir);
        cursorDir += 4;
      });
      
      const maxH = Math.max(cursorEsq, cursorDir) - bodyY + 5;
      doc.rect(margin, bodyY, leftW, maxH);
      doc.rect(margin + leftW, bodyY, rightW, maxH);
      
      y = bodyY + maxH + 5;

      // --- NOVA TABELA DE MÃO DE OBRA ---
      const maoDeObraOS = ultimoOrcamento?.data?.maoDeObra || [];
      if (maoDeObraOS.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['MÃO DE OBRA', 'QTDE', 'DIAS', 'ATIVIDADE', 'OBS.']],
          body: maoDeObraOS.map((mo: any) => [
            mo.cargo || mo.funcao || mo.maoDeObra || '',
            mo.quantidade || mo.qtde || '',
            mo.dias || '',
            mo.atividade || '',
            mo.obs || mo.observacao || '-'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [230, 230, 230], textColor: [0,0,0], fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2, textColor: [0,0,0] },
          margin: { left: margin, right: margin }
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }

      const mao = osPrincipal?.maoObra || selectedObraDetalhes?.maoObra || {};
      const maoRows = [
        ['Estrutura', String(mao.estrutura || 0)],
        ['Tubulação', String(mao.tubulacao || 0)],
        ['Andaimes', String(mao.andaimes || 0)],
        ['Mecânica', String(mao.mecanica || 0)],
        ['Pintura', String(mao.pintura || 0)],
        ['Elétrica', String(mao.eletrica || 0)],
        ['C.Q', String(mao.cq || 0)],
        ['SMS', String(mao.sms || 0)]
      ];

      const totalMao = maoRows.reduce((acc, r) => acc + (Number(r[1]) || 0), 0);

      // Render MÃO OBRA table with header and total
      autoTable(doc, {
        startY: y,
        head: [['MÃO OBRA ( H/H )', '']],
        body: [
          ...maoRows,
          ['HH TOTAL', String(totalMao)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', cellWidth: 30 } },
        margin: { left: margin, right: margin }
      });
      y = (doc as any).lastAutoTable.finalY + 5;
      
      // --- TABELA DE MATERIAIS ATUALIZADA (SEM VALORES) ---
      const isConsolidada = osPrincipal.tipoDocumento === 'consolidada';
      const materiaisOS = isConsolidada && osPrincipal.resumoConsolidado?.orcamento?.materiais?.length > 0
        ? osPrincipal.resumoConsolidado.orcamento.materiais 
        : (ultimoOrcamento?.data?.materiais || []);

      if (materiaisOS.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['QUANT', 'UN', 'ESPECIFICAÇÃO DE MATERIAL']],
          body: materiaisOS.map((m: any) => [
            m.quantidade || '',
            m.unidade || '',
            m.descricao || ''
          ]),
          theme: 'grid',
          headStyles: { fillColor: [230, 230, 230], textColor: [0,0,0], fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2, textColor: [0,0,0] },
          margin: { left: margin, right: margin }
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }
      
      // --- TABELA DE TERCEIRIZADOS ATUALIZADA (SEM VALORES) ---
      const terceirizadosOS = isConsolidada && osPrincipal.resumoConsolidado?.orcamento?.terceirizados?.length > 0
        ? osPrincipal.resumoConsolidado.orcamento.terceirizados
        : (ultimoOrcamento?.data?.terceirizados || ultimoOrcamento?.data?.terceiros || []);
        
      if (terceirizadosOS.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['ITEM', 'TERCEIRIZAÇÃO OU SUB-CONTRATAÇÃO']],
          body: terceirizadosOS.map((t: any, idx: number) => [
            idx + 1,
            t.descricao || ''
          ]),
          theme: 'grid',
          headStyles: { fillColor: [230, 230, 230], textColor: [0,0,0], fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2, textColor: [0,0,0] },
          margin: { left: margin, right: margin }
        });
      }
      
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(6);
        doc.setTextColor(150);
        doc.text(`Documento gerado pelo Linave ERP em ${new Date().toLocaleString('pt-BR')}`, margin, pageHeight - 5);
        doc.text(`Pag. ${i} / ${pageCount}`, pageWidth - margin - 15, pageHeight - 5);
      }
      
      const prefixo = getPrefixoEmpresa(selectedObraDetalhes?.empresaPrestadora);
      doc.save(`${prefixo || 'ERP'}_OS_${osPrincipal.ordemServicoNumero || '001'}_${new Date().getTime()}.pdf`);
      
      toast.success('OS baixada em PDF com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar OS em PDF');
    }
  };

  const obrasOrdenadas = obrasEmAndamento.filter((obra: any) => {
    if (!searchQuery) return true;
    const termo = searchQuery.toLowerCase();
    const cliente = (clientes || []).find((item: any) => item.id === obra.clienteId);
    return (obra.nome || '').toLowerCase().includes(termo) || (cliente?.razaoSocial || '').toLowerCase().includes(termo);
  });

  return (
    <div className="p-12 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">ORDEM DE SERVIÇO CONSOLIDADA</h1>
          <p className="text-white/50 text-xs mt-1">OS com dados unificados do negócio, orçamento e proposta</p>
        </div>
        <button
          onClick={() => {
            setFormData(criarInitialOsData());
            setShowFormNovaOS(true);
          }}
          disabled={obrasSemOsConsolidada.length === 0}
          className={`px-6 py-3 ${obrasSemOsConsolidada.length > 0 ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white' : 'bg-white/5 text-white/50 cursor-not-allowed'} rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-900/30`}
        >
          <Plus size={18} className="inline mr-2" /> Criar OS
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {obrasOrdenadas.length > 0 ? (
          obrasOrdenadas.map((obra: any) => {
            const cliente = (clientes || []).find((item: any) => item.id === obra.clienteId);
            const osExistente = osConsolidadas.find((item) => item.obraId === obra.id);
            const idProjetoOS = Array.isArray(obra.propostas) && obra.propostas.length > 0
              ? extrairIdProjetoDoNumero(obra.propostas[obra.propostas.length - 1].numeroProposta || '')
              : '';

            return (
              <div
                key={obra.id}
                className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/30 rounded-xl p-6 hover:border-blue-400/60 hover:shadow-lg hover:shadow-blue-900/20 transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-white font-black text-lg">{obra.nome} {idProjetoOS && <span className="text-cyan-400">• {idProjetoOS}</span>}</h3>
                    <p className="text-white/70 text-sm mt-1">{cliente?.razaoSocial}</p>
                    <p className="text-white/50 text-xs mt-2">Previsto: {obra.dataPrevistaInicio || obra.inicioPrevisto || '-'} até {obra.dataPrevistaFinal || obra.fimPrevisto || '-'}</p>
                  </div>

                  {osExistente ? (
                    <div className="flex gap-2 flex-wrap justify-end">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${osExistente.statusAprovacao === 'aprovada' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}>
                        {osExistente.statusAprovacao === 'aprovada' ? 'Aprovada' : 'Pendente'}
                      </span>
                      <button
                        onClick={() => handleDownloadOSFromList(osExistente)}
                        className="px-4 py-2 bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded-lg font-black text-xs hover:bg-blue-500/30 transition flex items-center gap-2"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={() => handleShowDetalhes(osExistente)}
                        className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-lg font-black text-xs hover:bg-cyan-500/30 transition flex items-center gap-2"
                      >
                        <Eye size={14} /> Ver OS
                      </button>
                      <button
                        onClick={() => handleDeleteOS(osExistente.id)}
                        className="px-4 py-2 bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg font-black text-xs hover:bg-red-500/30 transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setFormData(criarInitialOsData());
                        handleObraChange(obra.id);
                        setShowFormNovaOS(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-green-500/30 to-emerald-500/30 hover:from-green-500/50 hover:to-emerald-500/50 border border-green-400/40 text-green-300 rounded-lg font-black text-xs transition flex items-center gap-2"
                    >
                      <Plus size={14} /> Criar OS
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-white/40">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Nenhum projeto em andamento disponível</p>
          </div>
        )}
      </div>

      {showFormNovaOS && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 max-h-screen overflow-y-auto">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-6xl w-full my-8">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-orange-500/40 to-amber-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white uppercase">Ordem de Serviço Consolidada</h2>
                <p className="text-white/50 text-sm mt-2">Nº {formData.ordemServicoNumero}</p>
              </div>
              <button onClick={() => setShowFormNovaOS(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition">
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6 space-y-4">
                <h3 className="text-lg font-black text-white uppercase">Dados Principais</h3>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Projeto *</label>
                    <select className={inputClass} value={formData.obraId} onChange={(e) => handleObraChange(e.target.value)}>
                      <option value="">Selecione o projeto</option>
                      {obrasSemOsConsolidada.map((obra: any) => (
                        <option key={obra.id} value={obra.id}>{obra.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Cliente</label>
                    <input type="text" className={`${inputClass} bg-white/5 cursor-not-allowed`} disabled value={formData.cliente} />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Data Início Previsto</label>
                    <input type="date" className={`${inputClass} bg-white/5 cursor-not-allowed`} disabled value={formData.dataInicioPrevisto} />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Data Término Previsto</label>
                    <input type="date" className={`${inputClass} bg-white/5 cursor-not-allowed`} disabled value={formData.dataTerminoPrevisto} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Superv./Encarreg.</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.supervisorEncarregado}
                      onChange={(e) => setFormData({ ...formData, supervisorEncarregado: e.target.value })}
                      placeholder="Nome"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Equipamento</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.equipamento}
                      onChange={(e) => setFormData({ ...formData, equipamento: e.target.value })}
                      placeholder="Ex: Plataforma"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Centro de Custo (CC)</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.cc}
                      onChange={(e) => setFormData({ ...formData, cc: e.target.value })}
                      placeholder="Centro de Custo"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Descrição Geral do Serviço</label>
                  <textarea
                    className={`${inputClass} h-28 resize-none`}
                    value={formData.descricaoGeralServico}
                    onChange={(e) => setFormData({ ...formData, descricaoGeralServico: e.target.value })}
                  />
                </div>

                <div className="bg-[#0b1220] border border-white/10 rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-black text-sm uppercase">MÃO OBRA ( H/H )</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Estrutura</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.estrutura}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, estrutura: Number(e.target.value || 0) } })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Tubulação</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.tubulacao}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, tubulacao: Number(e.target.value || 0) } })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Andaimes</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.andaimes}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, andaimes: Number(e.target.value || 0) } })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Mecânica</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.mecanica}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, mecanica: Number(e.target.value || 0) } })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Pintura</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.pintura}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, pintura: Number(e.target.value || 0) } })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Elétrica</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.eletrica}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, eletrica: Number(e.target.value || 0) } })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>C.Q</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.cq}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, cq: Number(e.target.value || 0) } })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>SMS</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className={inputClass}
                        value={formData.maoObra.sms}
                        onChange={(e) => setFormData({ ...formData, maoObra: { ...formData.maoObra, sms: Number(e.target.value || 0) } })}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <div className="bg-white/5 p-3 rounded-lg inline-block">
                      <div className="text-white/60 text-xs">HH TOTAL</div>
                      <div className="text-white font-black text-xl">{(
                        Number(formData.maoObra.estrutura || 0) +
                        Number(formData.maoObra.tubulacao || 0) +
                        Number(formData.maoObra.andaimes || 0) +
                        Number(formData.maoObra.mecanica || 0) +
                        Number(formData.maoObra.pintura || 0) +
                        Number(formData.maoObra.eletrica || 0) +
                        Number(formData.maoObra.cq || 0) +
                        Number(formData.maoObra.sms || 0)
                      ).toString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20 p-6 space-y-4">
                <h3 className="text-lg font-black text-white uppercase">A Ser Incluído</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {A_SER_INCLUIDO_OPTIONS.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:border-cyan-400/40 transition">
                      <input
                        type="checkbox"
                        checked={formData.aSerIncluido[item.key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          aSerIncluido: {
                            ...formData.aSerIncluido,
                            [item.key]: e.target.checked
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <span className="text-white/80 text-xs font-bold">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-3xl border border-violet-500/20 p-8 space-y-6">
                <h3 className="text-2xl font-black text-white uppercase flex items-center gap-3">
                  <FileText size={18} /> Consolidação Automática
                </h3>

                <div className="space-y-8">
                  <div className="bg-[#0b1220] rounded-3xl border border-cyan-500/25 p-7 space-y-5 shadow-lg shadow-cyan-900/20">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <p className="text-sm text-cyan-300 font-black uppercase tracking-wider">Negócio</p>
                      <span className="px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-xs font-black uppercase">
                        {(formData.resumoConsolidado?.negocio.servicos || []).length} serviço(s)
                      </span>
                    </div>
                    <p className="text-white text-xl font-black">{formData.resumoConsolidado?.negocio.nome || '-'}</p>
                    <div className="grid grid-cols-1 gap-4 max-h-[420px] overflow-y-auto pr-2">
                      {(formData.resumoConsolidado?.negocio.servicos || []).map((servico) => (
                        <div key={`${servico.ordem}-${servico.tipo}`} className="bg-[#101f3d] rounded-2xl p-4 border border-white/10 space-y-1">
                          <p className="font-black text-white text-base">{servico.ordem}. {servico.tipo || 'Serviço'}</p>
                          {servico.descricao && <p className="text-white/80 text-sm mt-1">{servico.descricao}</p>}
                          {servico.localExecucao && <p className="text-white/60 text-sm mt-1">{servico.localExecucao}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0b1220] rounded-3xl border border-amber-500/25 p-7 space-y-5 shadow-lg shadow-amber-900/20">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <p className="text-sm text-amber-300 font-black uppercase tracking-wider">Orçamento</p>
                      <span className="px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-black uppercase">
                        {formData.resumoConsolidado?.orcamento.numeroOrcamento || 'Sem orçamento'}
                      </span>
                    </div>
                    <div className="bg-[#101f3d] rounded-2xl p-4 border border-white/10 text-sm text-white/80 space-y-1">
                      <p>Solicitante: {formData.resumoConsolidado?.orcamento.solicitante || '-'}</p>
                      <p>Resp. Comercial: {formData.resumoConsolidado?.orcamento.responsavelComercial || '-'}</p>
                      <p>Documentos: {formData.resumoConsolidado?.orcamento.documentosReferencia || '-'}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 max-h-[420px] overflow-y-auto pr-2">
                      {(formData.resumoConsolidado?.orcamento.dadosServicos || []).map((item, index) => (
                        <div key={`srv-orc-${index}`} className="bg-[#101f3d] rounded-2xl p-4 border border-white/10 text-sm text-white/80">
                          <p className="font-black text-white text-base">Serviço {item.ordem || index + 1}: {item.tipo || '-'}</p>
                          <p className="mt-1">Categoria: {item.categoria || '-'} | Local: {item.localExecucao || '-'}</p>
                          <p className="mt-1">Descrição: {item.descricao || '-'}</p>
                        </div>
                      ))}
                      {(formData.resumoConsolidado?.orcamento.materiais || []).map((item, index) => (
                        <div key={`mat-${index}`} className="bg-[#101f3d] rounded-2xl p-4 border border-white/10 text-sm text-white/80">
                          <p className="font-black text-white text-base">Material: {item.descricao}</p>
                          <p className="mt-1">{item.quantidade || '-'} {item.unidade || ''}</p>
                        </div>
                      ))}
                      {(formData.resumoConsolidado?.orcamento.terceirizados || []).map((item, index) => (
                        <div key={`ter-${index}`} className="bg-[#101f3d] rounded-2xl p-4 border border-white/10 text-sm text-white/80">
                          <p className="font-black text-white text-base">Terceirizado: {item.descricao}</p>
                          <p className="mt-1">{item.quantidade || '-'} {item.unidade || ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0b1220] rounded-3xl border border-emerald-500/25 p-7 space-y-5 shadow-lg shadow-emerald-900/20">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <p className="text-sm text-emerald-300 font-black uppercase tracking-wider">Proposta</p>
                      <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-black uppercase">
                        {formData.resumoConsolidado?.proposta.numeroProposta || 'Sem proposta'}
                      </span>
                    </div>
                    <div className="bg-[#101f3d] rounded-2xl p-4 border border-white/10 text-sm text-white/80">
                      <p className="font-black text-white text-base mb-1">Item A - Escopo Básico</p>
                      <p className="whitespace-pre-wrap">{formData.resumoConsolidado?.proposta.escopoA || '-'}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 max-h-[420px] overflow-y-auto pr-2">
                      {(formData.resumoConsolidado?.proposta.escopoBasicoServicos || []).map((escopo, index) => (
                        <div key={`escopo-${index}`} className="bg-[#101f3d] rounded-2xl p-4 border border-white/10 text-sm text-white/80">
                          <p className="font-black text-white text-base">{escopo.titulo || `Escopo ${index + 1}`}</p>
                          {escopo.descricaoServico && <p className="mt-1">{escopo.descricaoServico}</p>}
                          <p className="text-white/60 mt-1">Itens: {Array.isArray(escopo.linhas) ? escopo.linhas.length : 0}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button
                  onClick={handleSaveOS}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                >
                  <Zap size={18} /> Enviar para Produção
                </button>
                <button
                  onClick={() => setShowFormNovaOS(false)}
                  className="px-12 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetalhesOS && selectedOS && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-[96vw] w-full max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-orange-500/40 to-amber-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-white">Detalhes da OS Consolidada</h2>
                <p className="text-white/60 text-base mt-2">{selectedOS.ordemServicoNumero}</p>
              </div>
              <button onClick={() => setShowDetalhesOS(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-10 space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-white font-black text-lg">INFORMAÇÕES BÁSICAS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-base">
                  <div>
                    <p className="text-white/50 text-sm mb-1">Cliente</p>
                    <p className="text-white font-bold text-lg">{selectedOS.cliente}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Projeto</p>
                    <p className="text-white font-bold text-lg">{selectedOS.projeto}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Supervisor/Encarregado</p>
                    <p className="text-white font-bold text-lg">{selectedOS.supervisorEncarregado || '-'}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Status de Envio</p>
                    <p className="text-emerald-300 font-black uppercase text-base">{selectedOS.statusEnvio || 'pendente'}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Status de Aprovação</p>
                    <p className={`font-black uppercase text-base ${selectedOS.statusAprovacao === 'aprovada' ? 'text-emerald-300' : 'text-amber-300'}`}>{selectedOS.statusAprovacao || 'pendente'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <h3 className="text-white font-black text-lg">DESCRIÇÃO GERAL DO SERVIÇO</h3>
                <p className="text-white/85 text-base whitespace-pre-wrap leading-relaxed">{selectedOS.descricaoGeralServico || 'Sem descrição.'}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-white font-black text-lg">A SER INCLUÍDO</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/85">
                  {listarItensASerIncluido(selectedOS.aSerIncluido || A_SER_INCLUIDO_DEFAULT).length > 0 ? (
                    listarItensASerIncluido(selectedOS.aSerIncluido || A_SER_INCLUIDO_DEFAULT).map((item) => (
                      <div key={item} className="bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2">
                        {item}
                      </div>
                    ))
                  ) : (
                    <p className="text-white/50 text-sm">Nenhum item selecionado.</p>
                  )}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-white font-black text-lg">ORÇAMENTO</h3>
                <div className="bg-[#0b1220] p-4 rounded-lg border border-white/10 text-sm text-white/85 space-y-1">
                  <p><span className="text-white/50">Número:</span> {selectedOS.resumoConsolidado?.orcamento.numeroOrcamento || '-'}</p>
                  <p><span className="text-white/50">Versão:</span> {selectedOS.resumoConsolidado?.orcamento.versao || '-'}</p>
                  <p><span className="text-white/50">Solicitante:</span> {selectedOS.resumoConsolidado?.orcamento.solicitante || '-'}</p>
                  <p><span className="text-white/50">Responsável Comercial:</span> {selectedOS.resumoConsolidado?.orcamento.responsavelComercial || '-'}</p>
                  <p><span className="text-white/50">Documentos Referência:</span> {selectedOS.resumoConsolidado?.orcamento.documentosReferencia || '-'}</p>
                  <p><span className="text-white/50">Escopo:</span> {selectedOS.resumoConsolidado?.orcamento.escopoOrcamento || '-'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
                  {(selectedOS.resumoConsolidado?.orcamento.dadosServicos || []).map((item, index) => (
                    <div key={`dados-servico-${index}`} className="bg-[#0b1220] p-4 rounded-lg border border-white/10">
                      <p className="text-white font-bold text-base">Serviço {item.ordem || index + 1}: {item.tipo || '-'}</p>
                      <p className="text-white/60 text-sm">Categoria: {item.categoria || '-'} | Local: {item.localExecucao || '-'}</p>
                      <p className="text-white/60 text-sm">Descrição: {item.descricao || '-'}</p>
                    </div>
                  ))}
                  {(selectedOS.resumoConsolidado?.orcamento.maoDeObra || []).map((item, index) => (
                    <div key={`mao-${index}`} className="bg-[#0b1220] p-4 rounded-lg border border-white/10">
                      <p className="text-white font-bold text-base">Mão de obra: {item.funcao || '-'}</p>
                      <p className="text-white/60 text-sm">Qtde: {item.quantidade || '-'} | Dias: {item.dias || '-'}</p>
                    </div>
                  ))}
                  {(selectedOS.resumoConsolidado?.orcamento.atividades || []).map((item, index) => (
                    <div key={`atividade-${index}`} className="bg-[#0b1220] p-4 rounded-lg border border-white/10">
                      <p className="text-white font-bold text-base">Atividade: {item.atividade || '-'}</p>
                      <p className="text-white/60 text-sm">Dias: {item.dias || '-'} | Obs.: {item.observacao || '-'}</p>
                    </div>
                  ))}
                  {(selectedOS.resumoConsolidado?.orcamento.materiais || []).map((item, index) => (
                    <div key={`material-${index}`} className="bg-[#0b1220] p-4 rounded-lg border border-white/10">
                      <p className="text-white font-bold text-base">Material: {item.descricao || '-'}</p>
                      <p className="text-white/60 text-sm">{item.quantidade || '-'} {item.unidade || ''} | Fator: {item.pesoFator || '-'}</p>
                    </div>
                  ))}
                  {(selectedOS.resumoConsolidado?.orcamento.terceirizados || []).map((item, index) => (
                    <div key={`terceirizado-${index}`} className="bg-[#0b1220] p-4 rounded-lg border border-white/10">
                      <p className="text-white font-bold text-base">Terceirizado: {item.descricao || '-'}</p>
                      <p className="text-white/60 text-sm">{item.quantidade || '-'} {item.unidade || ''} | Fator: {item.pesoFator || '-'}</p>
                    </div>
                  ))}
                </div>

                {selectedOS.resumoConsolidado?.orcamento.observacoes && (
                  <div className="bg-[#0b1220] p-4 rounded-lg border border-white/10">
                    <p className="text-white font-bold text-base mb-1">Observações do Orçamento</p>
                    <p className="text-white/75 text-sm whitespace-pre-wrap">{selectedOS.resumoConsolidado?.orcamento.observacoes}</p>
                  </div>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-white font-black text-lg">HORAS TRABALHADAS POR SERVIÇO</h3>
                {normalizarHorasTrabalhadas(selectedOS.horasTrabalhadasPorServico || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-white/10">
                      <thead className="bg-white/5 text-white/70">
                        <tr>
                          <th className="px-3 py-2 border border-white/10 text-left">Serviço</th>
                          <th className="px-3 py-2 border border-white/10 text-left">Hora (H/H)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {normalizarHorasTrabalhadas(selectedOS.horasTrabalhadasPorServico || []).map((item) => (
                          <tr key={item.id} className="text-white/85">
                            <td className="px-3 py-2 border border-white/10">{item.servico}</td>
                            <td className="px-3 py-2 border border-white/10">{item.hora}</td>
                          </tr>
                        ))}
                        <tr className="bg-white/5 text-white font-black">
                          <td className="px-3 py-2 border border-white/10 uppercase">HH Total</td>
                          <td className="px-3 py-2 border border-white/10">{calcularTotalHoras(selectedOS.horasTrabalhadasPorServico || [])}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">Nenhuma hora trabalhada cadastrada para esta OS.</p>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-white font-black text-lg">PROPOSTA (ESCOPOS E PLANILHAS)</h3>
                <div className="bg-[#0b1220] p-4 rounded-lg border border-white/10">
                  <p className="text-white font-bold text-base mb-1">Item A - Escopo Básico</p>
                  <p className="text-white/75 text-sm whitespace-pre-wrap">{selectedOS.resumoConsolidado?.proposta.escopoA || '-'}</p>
                </div>
                <div className="space-y-3">
                  {(selectedOS.resumoConsolidado?.proposta.escopoBasicoServicos || []).map((escopo, index) => (
                    <div key={`escopo-view-${index}`} className="bg-[#0b1220] p-4 rounded-lg border border-white/10 space-y-2">
                      <p className="text-white font-black text-base">{escopo.titulo || `Escopo ${index + 1}`}</p>
                      {escopo.descricaoServico && <p className="text-white/75 text-sm">{escopo.descricaoServico}</p>}
                      {Array.isArray(escopo.colunas) && escopo.colunas.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border border-white/10">
                            <thead className="bg-white/5 text-white/60">
                              <tr>
                                <th className="px-2 py-1 border border-white/10">Item</th>
                                {escopo.colunas.map((coluna) => (
                                  <th key={coluna} className="px-2 py-1 border border-white/10">{coluna}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(escopo.linhas || []).map((linha, linhaIdx) => (
                                <tr key={`linha-${linhaIdx}`} className="text-white/80">
                                  <td className="px-2 py-1 border border-white/10">{linhaIdx + 1}</td>
                                  {escopo.colunas.map((coluna) => (
                                    <td key={`${coluna}-${linhaIdx}`} className="px-2 py-1 border border-white/10">{linha.valores?.[coluna] || '-'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button onClick={() => handleDownloadOSPDF(selectedOS)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Download PDF
                </button>
                <button onClick={() => setShowDetalhesOS(false)} className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/15 transition">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}