import React, { useState } from 'react';
import { useErp, getPrefixoEmpresa, gerarIdProjetoDeNegocio } from '../../../context/ErpContext';
import { Plus, X, Check, Clock, Zap, Download, Eye, FileText } from 'lucide-react';
interface DocumentoAssinatura {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  dataUpload: string;
  conteudo: string;
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
  negocioBackendId?: number | null;
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
    extras?: Array<{ id: string; label: string }>; // itens "a incluir" customizáveis
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
    extras?: Array<{ id: string; nome: string; hora: number }>; // H/H customizáveis
  };
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
  extras: [],
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

const listarItensASerIncluido = (aSerIncluido: OsFormData['aSerIncluido']): string[] =>
  A_SER_INCLUIDO_OPTIONS
    .filter((item) => aSerIncluido[item.key])
    .map((item) => item.label as string)
    .concat((aSerIncluido.extras || []).map((e) => String(e.label || '').trim()).filter(Boolean));

const criarInitialOsData = (): OsFormData => ({
  id: '',
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
  ordemServicoNumero: '',
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
    sms: 0,
    extras: []
  },
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
  const [diasPrevistos, setDiasPrevistos] = useState<number>(0);
  const [tipoDias, setTipoDias] = useState<'uteis' | 'corridos'>('corridos');
  // id numérico (SQL) da OS em edição. null = criando uma nova OS.
  const [editandoOsBackendId, setEditandoOsBackendId] = useState<number | null>(null);

  const inputClass = 'w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20';
  const labelClass = 'text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block';

  const listaOS = (Array.isArray(os) ? os : []).map((item: any) => normalizarIdOs(item as OsFormData));
  const obrasEmAndamento = (Array.isArray(obras) ? obras : []).filter((o: any) => o.categoria === 'Em Andamento');
  const osConsolidadas = listaOS.filter((item: any) => item.tipoDocumento === 'consolidada');
  // Obras sem OS em produção (rascunho não bloqueia)
  const osEmProducao = osConsolidadas.filter((item) => item.statusOs !== 'rascunho');
  const obrasSemOsConsolidada = obrasEmAndamento.filter((obra: any) => !osEmProducao.some((registro) => registro.obraId === obra.id));

  const extrairResumoOrcamentoSemValores = (obra: any) => {
    const ultimoOrcamento = Array.isArray(obra?.orcamentos) && obra.orcamentos.length > 0
      ? obra.orcamentos[obra.orcamentos.length - 1]
      : null;
    const data = ultimoOrcamento?.data || {};

    return {
      numeroOrcamento: ultimoOrcamento?.numeroOrcamento || '',
      versao: String(ultimoOrcamento?.versao || ''),
      status: ultimoOrcamento?.status || '',
      dataCriacao: ultimoOrcamento?.dataCriacao || '',
      solicitante: data.solicitante || '',
      responsavelComercial: data.responsavelComercial || '',
      documentosReferencia: data.documentosReferencia || '',
      escopoOrcamento: data.escopoOrcamento || '',
      dadosServicos: (Array.isArray(data.dadosServicos) ? data.dadosServicos : []).map((item: any) => ({
        ordem: item.ordem || 0,
        tipo: item.tipo_servico || item.tipo || '',
        embarcacao: item.embarcacao || '',
        localExecucao: item.local_execucao || item.localExecucao || '',
        porto: item.porto || '',
        prazoDes: item.prazoDes || '',
        descricao: item.descricao || '',
        observacoes: item.observacoes || ''
      })),
      maoDeObra: (Array.isArray(data.maoDeObra) ? data.maoDeObra : [])
        .filter((item: any) => item.fnc || item.funcao)
        .map((item: any) => ({
          funcao: item.fnc || item.funcao || '',
          quantidade: String(item.qnt || item.quantidade || ''),
          dias: String(item.dias || ''),
          observacao: item.observacao || ''
        })),
      atividades: (Array.isArray(data.atividades) ? data.atividades : [])
        .filter((item: any) => item.atividade)
        .map((item: any) => ({
          atividade: item.atividade || '',
          dias: String(item.duracao || item.dias || ''),
          observacao: item.observacao || ''
        })),
      materiais: (Array.isArray(data.materiais) ? data.materiais : [])
        .filter((item: any) => item.item || item.descricao)
        .map((item: any) => ({
          descricao: item.item || item.descricao || '',
          unidade: item.unidade || '',
          quantidade: String(item.qnt || item.quantidade || ''),
          pesoFator: String(item.peso || item.pesoFator || ''),
          observacao: item.observacao || '',
          origemTerceiros: item.terceirizado ? 'Sim' : (item.origemTerceiros || '')
        })),
      terceirizados: (Array.isArray(data.terceirizados) ? data.terceirizados : [])
        .filter((item: any) => item.descricao)
        .map((item: any) => ({
          descricao: item.descricao || '',
          unidade: item.unidade || '',
          quantidade: String(item.qnt || item.quantidade || ''),
          pesoFator: String(item.peso || item.pesoFator || ''),
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

    const itensLocacao = (Array.isArray(obra?.itensAlocacao) ? obra.itensAlocacao : [])
      .filter((it: any) => it.equipamento)
      .map((it: any) => `• ${it.equipamento} — ${it.quantidade ?? ''} ${it.unidade || ''}`.trim())
      .join('\n');

    return [
      'OS Consolidada gerada automaticamente a partir dos dados do negócio, orçamento e proposta.',
      servicosNegocio ? `\nServiços do negócio:\n${servicosNegocio}` : '',
      servicosOrcamento ? `\nItens do orçamento:\n${servicosOrcamento}` : '',
      itensLocacao ? `\nItens em locação:\n${itensLocacao}` : '',
      resumoEscopo ? `\nEscopo básico da proposta:\n${resumoEscopo}` : ''
    ].join('\n').trim();
  };

  const handleSaveRascunhoOS = () => {
    if (!formData.obraId) return toast.error('Selecione uma obra para salvar o rascunho.');
    const semRascunhoAnterior = listaOS.filter((item) => !(item.obraId === formData.obraId && item.statusOs === 'rascunho'));
    const rascunho: OsFormData = {
      ...formData,
      id: String(formData.ordemServicoNumero || formData.id || '').trim(),
      statusOs: 'rascunho',
      statusEnvio: 'pendente',
      statusAprovacao: 'pendente',
      // Persiste dias e tipo para restaurar ao reabrir
      diasPrevistosRascunho: diasPrevistos,
      tipoDiasRascunho: tipoDias,
    } as any;
    saveEntity('os', [...semRascunhoAnterior, rascunho]);
    setShowFormNovaOS(false);
    toast.success('Rascunho da OS salvo!');
  };

  const handleObraChange = (obraId: string) => {
    const obra = obrasEmAndamento.find((item: any) => item.id === obraId);
    if (!obra) return;

    // Se existe rascunho para esta obra, carrega os dados salvos
    const rascunhoExistente = listaOS.find((item) => item.obraId === obraId && item.statusOs === 'rascunho') as any;
    if (rascunhoExistente) {
      setFormData(rascunhoExistente);
      if (rascunhoExistente.diasPrevistosRascunho > 0) setDiasPrevistos(rascunhoExistente.diasPrevistosRascunho);
      if (rascunhoExistente.tipoDiasRascunho) setTipoDias(rascunhoExistente.tipoDiasRascunho);
      return;
    }

    const clienteCtx = findClienteById(clientes || [], obra.clienteId);
    const nomeCliente = obra.nomeCliente || clienteCtx?.razaoSocial || clienteCtx?.razao_social || clienteCtx?.nomeFantasia || clienteCtx?.nome_fantasia || '';

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
          localExecucao: servico.localExecucao || '',
          porto: servico.porto || '',
          descricao: servico.descricao || '',
          observacoes: servico.observacoes || ''
        }))
      },
      orcamento: extrairResumoOrcamentoSemValores(obra),
      proposta: extrairResumoProposta(obra)
    };

    const totalDiasSeed = somarDiasDoOrcamento(resumoConsolidado.orcamento);
    setDiasPrevistos(totalDiasSeed);

    setFormData((prev) => ({
      ...prev,
      obraId: obra.id,
      clienteId: String(obra.clienteId || ''),
      negocioBackendId: obra.negocioBackendId || null,
      cliente: nomeCliente,
      projeto: obra.nome || '',
      local: clienteCtx?.endereco || '',
      dataInicioPrevisto: dataInicioNegocio,
      dataTerminoPrevisto: dataTerminoNegocio,
      descricaoGeralServico: gerarDescricaoConsolidada(obra, resumoConsolidado.orcamento, resumoConsolidado.proposta),
      resumoConsolidado
    }));
  };

  // Abre o formulário "fazer OS" já preenchido com uma OS existente, em modo edição.
  const handleEditarOS = (osItem: any) => {
    setEditandoOsBackendId(osItem?.backendId ?? null);

    // Reconstrói "dias previstos" a partir das datas salvas, para que o término continue
    // coerente caso o usuário altere a data de início durante a edição.
    const ini = osItem?.dataInicioPrevisto ? new Date(osItem.dataInicioPrevisto) : null;
    const fim = osItem?.dataTerminoPrevisto ? new Date(osItem.dataTerminoPrevisto) : null;
    if (ini && fim && !isNaN(ini.getTime()) && !isNaN(fim.getTime())) {
      const dias = Math.max(0, Math.round((fim.getTime() - ini.getTime()) / 86400000));
      setDiasPrevistos(dias);
    } else {
      setDiasPrevistos(0);
    }
    setTipoDias('corridos');

    const base = criarInitialOsData();
    setFormData({
      ...base,
      backendId: osItem?.backendId ?? null,
      id: String(osItem?.ordemServicoNumero || osItem?.id || ''),
      obraId: osItem?.obraId || '',
      clienteId: String(osItem?.clienteId || ''),
      negocioBackendId: osItem?.negocioBackendId ?? null,
      cliente: osItem?.cliente || '',
      projeto: osItem?.projeto || '',
      equipamento: osItem?.equipamento || '',
      local: osItem?.local || '',
      dataEmissao: osItem?.dataEmissao || base.dataEmissao,
      cc: osItem?.cc || '',
      dataInicioPrevisto: osItem?.dataInicioPrevisto || '',
      dataTerminoPrevisto: osItem?.dataTerminoPrevisto || '',
      ordemServicoNumero: String(osItem?.ordemServicoNumero || osItem?.id || ''),
      supervisorEncarregado: osItem?.supervisorEncarregado || '',
      descricaoGeralServico: osItem?.descricaoGeralServico || '',
      aSerIncluido: { ...base.aSerIncluido, ...(osItem?.aSerIncluido || {}) },
      maoObra: { ...base.maoObra, ...(osItem?.maoObra || {}) },
      horasTrabalhadasPorServico: Array.isArray(osItem?.horasTrabalhadasPorServico) ? osItem.horasTrabalhadasPorServico : [],
      statusOs: osItem?.statusOs || 'emproducao',
      statusEnvio: osItem?.statusEnvio || 'enviada',
      statusAprovacao: osItem?.statusAprovacao || 'pendente',
      documentoAssinaturaAprovacao: osItem?.documentoAssinaturaAprovacao || null,
    } as any);
    setShowFormNovaOS(true);
  };

  const handleSaveOS = async () => {
    if (!formData.obraId) {
      return toast.error('Selecione uma obra para criar a OS.');
    }

    if (!formData.dataInicioPrevisto) {
      return toast.error('Defina a data inicial prevista da OS.');
    }

    const editando = editandoOsBackendId != null;

    const totalDiasOrcamento = diasPrevistos > 0 ? diasPrevistos : somarDiasDoOrcamento(formData.resumoConsolidado?.orcamento);
    // Recalcula o término quando há dias previstos; ao editar sem dias, mantém o término já salvo.
    const dataTerminoPrevisto = totalDiasOrcamento > 0
      ? calcularDataTerminoPrevisto(formData.dataInicioPrevisto, totalDiasOrcamento, tipoDias)
      : formData.dataTerminoPrevisto;
    if (!dataTerminoPrevisto) {
      return toast.error('Não foi possível calcular a data final da OS. Verifique a data inicial e os dias previstos.');
    }

    // Só bloqueia duplicidade ao CRIAR; ao editar, a OS já existe e deve ser atualizada.
    if (!editando) {
      const jaExisteConsolidada = osEmProducao.some((item) => item.obraId === formData.obraId);
      if (jaExisteConsolidada) {
        return toast.error('Já existe uma OS consolidada para este negócio. Use "Editar" para alterá-la.');
      }
    }

    const hhTotal =
      formData.maoObra.estrutura +
      formData.maoObra.tubulacao +
      formData.maoObra.andaimes +
      formData.maoObra.mecanica +
      formData.maoObra.pintura +
      formData.maoObra.eletrica +
      formData.maoObra.cq +
      formData.maoObra.sms;

    // Ao editar, preserva os status atuais da OS (não regredir uma OS já aprovada/enviada).
    const novaOS: OsFormData = {
      ...formData,
      dataTerminoPrevisto,
      id: String(formData.ordemServicoNumero || formData.id || '').trim(),
      statusOs: 'emproducao',
      statusEnvio: 'enviada',
      statusAprovacao: 'pendente',
      documentoAssinaturaAprovacao: null,
      maoObra: {
        ...formData.maoObra,
        cq: hhTotal
      }
    };

    // Remove rascunho anterior da mesma obra e, em edição, a versão antiga desta OS.
    const semRascunho = listaOS.filter((item) => !(item.obraId === formData.obraId && item.statusOs === 'rascunho'));
    const semOsAntiga = editando ? semRascunho.filter((item) => item.id !== novaOS.id) : semRascunho;
    saveEntity('os', [...semOsAntiga, novaOS]);
    setShowFormNovaOS(false);
    setFormData(criarInitialOsData());
    setEditandoOsBackendId(null);
    setDiasPrevistos(0);
    toast.success(editando ? 'OS atualizada com sucesso!' : 'OS criada e enviada para produção com sucesso!');
  };

  const handleDeleteOS = async (osId: string) => {
    if (!(await confirmDialog({ message: 'Tem certeza que deseja deletar esta OS consolidada?', danger: true, confirmText: 'Deletar' }))) return;
    // Exclui no SQL usando o id numérico (backendId); o id da UI é o numero_os (LN-0001/26).
    const osItem = (Array.isArray(os) ? os : []).find((o: any) => String(o.id) === String(osId));
    const backendId = (osItem as any)?.backendId;
    if (backendId != null) {
      try {
        await deleteOrdemServico(backendId);
      } catch {
        toast.error('Erro ao excluir a OS no banco de dados.');
        return;
      }
    }
    saveEntity('os', listaOS.filter((item) => item.id !== osId));
  };

  const handleDownloadOSFromList = (os: OsFormData) => {
    // Sempre abre os detalhes para garantir que temos os dados completos
    setSelectedOS(os);
    setShowDetalhesOS(true);
    // Após abrir, o usuário pode clicar em Download TXT
    setTimeout(() => {
      alert('A OS foi aberta. Clique em "Download TXT" para fazer o download.');
    }, 500);
  };

  const handleShowDetalhes = (item: OsFormData) => {
    setSelectedOS(item);
    setShowDetalhesOS(true);
  };

  const handleDownloadOSTXT = (item: OsFormData) => {
    if (!item.ordemServicoNumero) {
      alert('Erro: Dados da OS incompletos. Não é possível fazer o download.');
      return;
    }

    const resumo = item.resumoConsolidado;
    const itensASerIncluido = listarItensASerIncluido(item.aSerIncluido || A_SER_INCLUIDO_DEFAULT);
    const itensASerIncluidoTexto = itensASerIncluido.length > 0
      ? itensASerIncluido.map((opcao) => `- ${opcao}`).join('\n')
      : '- Nenhum item selecionado';

    const dadosServicosOrcamentoTexto = (resumo?.orcamento?.dadosServicos || []).map((servico: any) => (
      `- ${servico.ordem || '-'} | ${servico.tipo || '-'} | Categoria: ${servico.categoria || '-'} | Embarcação: ${servico.embarcacao || '-'} | Local: ${servico.localExecucao || '-'} | Porto: ${servico.porto || '-'} | Prazo: ${servico.prazoDes || '-'} | Descrição: ${servico.descricao || '-'} | Obs.: ${servico.observacoes || '-'}`
    )).join('\n');

    const escopoServicosTexto = (resumo?.proposta?.escopoBasicoServicos || []).map((escopo: any, idx: number) => {
      const cabecalho = `Escopo ${idx + 1}: ${escopo.titulo || 'Sem título'}`;
      const descricao = `Descrição: ${escopo.descricaoServico || '-'}`;
      const texto = `Texto: ${escopo.texto || '-'}`;
      const colunas = `Colunas: ${(escopo.colunas || []).join(' | ') || '-'}`;
      const linhas = (escopo.linhas || []).map((linha: any, linhaIdx: number) => {
        const valores = (escopo.colunas || []).map((coluna: string) => `${coluna}: ${linha.valores?.[coluna] || '-'}`).join(' | ');
        return `  Item ${linhaIdx + 1}: ${valores}`;
      }).join('\n');
      return `${cabecalho}\n${descricao}\n${texto}\n${colunas}${linhas ? `\n${linhas}` : ''}`;
    }).join('\n\n');

    const conteudo = `
================================================================================
                    ORDEM DE SERVIÇO CONSOLIDADA
================================================================================

Número: ${item.ordemServicoNumero}
Status Envio: ${item.statusEnvio || 'pendente'}
Status Aprovação: ${item.statusAprovacao || 'pendente'}

Projeto: ${item.projeto}
Cliente: ${item.cliente}
Data Emissão: ${item.dataEmissao}
Período Previsto: ${item.dataInicioPrevisto} até ${item.dataTerminoPrevisto}

--------------------------------------------------------------------------------
A SER INCLUÍDO
--------------------------------------------------------------------------------
${itensASerIncluidoTexto}

--------------------------------------------------------------------------------
DADOS DO NEGÓCIO
--------------------------------------------------------------------------------
Solicitante: ${resumo?.negocio?.solicitante || '-'}
Responsável Comercial: ${resumo?.negocio?.responsavelComercial || '-'}
Responsável Técnico: ${resumo?.negocio?.responsavelTecnico || '-'}

Serviços:
${(resumo?.negocio?.servicos || []).map((servico: any) => `- ${servico.ordem}. ${servico.tipo || 'Serviço'} | ${servico.localExecucao || '-'} | ${servico.descricao || '-'}`).join('\n') || '-'}

--------------------------------------------------------------------------------
ORÇAMENTO
--------------------------------------------------------------------------------
Número: ${resumo?.orcamento?.numeroOrcamento || '-'}
Versão: ${resumo?.orcamento?.versao || '-'}
Solicitante: ${resumo?.orcamento?.solicitante || '-'}
Responsável Comercial: ${resumo?.orcamento?.responsavelComercial || '-'}
Documentos de Referência: ${resumo?.orcamento?.documentosReferencia || '-'}
Escopo: ${resumo?.orcamento?.escopoOrcamento || '-'}

Dados dos Serviços:
${dadosServicosOrcamentoTexto || '-'}

Mão de Obra:
${(resumo?.orcamento?.maoDeObra || []).map((itemMao: any) => `- ${itemMao.funcao || '-'} | Qtde: ${itemMao.quantidade || '-'} | Dias: ${itemMao.dias || '-'}`).join('\n') || '-'}

Materiais:
${(resumo?.orcamento?.materiais || []).map((mat: any) => `- ${mat.descricao || '-'} | ${mat.quantidade || '-'} ${mat.unidade || ''}`).join('\n') || '-'}

${(resumo?.orcamento?.terceirizados || []).map((ter: any) => `- ${ter.descricao || '-'} | ${ter.quantidade || '-'} ${ter.unidade || ''}`).join('\n') || '-'}
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
                <button
                  onClick={() => handleDownloadOSTXT(selectedOS)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Download TXT
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
