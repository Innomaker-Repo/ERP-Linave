import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
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
      descricaoGeralServico: gerarDescricaoConsolidada(obra, resumoConsolidado.orcamento, resumoConsolidado.proposta),
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

    const hhTotal =
      formData.maoObra.estrutura +
      formData.maoObra.tubulacao +
      formData.maoObra.andaimes +
      formData.maoObra.mecanica +
      formData.maoObra.pintura +
      formData.maoObra.eletrica +
      formData.maoObra.cq +
      formData.maoObra.sms;

    const novaOS: OsFormData = {
      ...formData,
      id: `OS-CONS-${Date.now()}`,
      statusOs: 'emproducao',
      statusEnvio: 'enviada',
      statusAprovacao: 'pendente',
      documentoAssinaturaAprovacao: null,
      maoObra: {
        ...formData.maoObra,
        cq: hhTotal
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

  const handleShowDetalhes = (item: OsFormData) => {
    setSelectedOS(item);
    setShowDetalhesOS(true);
  };

  const handleDownloadOSTXT = (item: OsFormData) => {
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

Terceirizados:
${(resumo?.orcamento?.terceirizados || []).map((ter: any) => `- ${ter.descricao || '-'} | ${ter.quantidade || '-'} ${ter.unidade || ''}`).join('\n') || '-'}

Atividades:
${(resumo?.orcamento?.atividades || []).map((atividade: any) => `- ${atividade.atividade || '-'} | Dias: ${atividade.dias || '-'}`).join('\n') || '-'}

Observações do Orçamento:
${resumo?.orcamento?.observacoes || '-'}

--------------------------------------------------------------------------------
PROPOSTA COMERCIAL
--------------------------------------------------------------------------------
Número: ${resumo?.proposta?.numeroProposta || '-'}
Versão: ${resumo?.proposta?.versao || '-'}
Status: ${resumo?.proposta?.status || '-'}
Assunto: ${resumo?.proposta?.assunto || '-'}

Item A - Escopo Básico Consolidado:
${resumo?.proposta?.escopoA || '-'}

Escopo Básico (planilha por serviço):
${escopoServicosTexto || '-'}

--------------------------------------------------------------------------------
Descrição Geral da OS
--------------------------------------------------------------------------------
${item.descricaoGeralServico || '-'}

================================================================================
Documento gerado automaticamente pelo Linave ERP
Geração: ${new Date().toLocaleString('pt-BR')}
================================================================================
    `;

    const elemento = document.createElement('a');
    const arquivo = new Blob([conteudo], { type: 'text/plain' });
    elemento.href = URL.createObjectURL(arquivo);
    elemento.download = `OS_Consolidada_${item.ordemServicoNumero}.txt`;
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);
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

            return (
              <div
                key={obra.id}
                className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/30 rounded-xl p-6 hover:border-blue-400/60 hover:shadow-lg hover:shadow-blue-900/20 transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-white font-black text-lg">{obra.nome}</h3>
                    <p className="text-white/70 text-sm mt-1">{cliente?.razaoSocial}</p>
                    <p className="text-white/50 text-xs mt-2">Previsto: {obra.dataPrevistaInicio || obra.inicioPrevisto || '-'} até {obra.dataPrevistaFinal || obra.fimPrevisto || '-'}</p>
                  </div>

                  {osExistente ? (
                    <div className="flex gap-2 flex-wrap justify-end">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${osExistente.statusAprovacao === 'aprovada' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}>
                        {osExistente.statusAprovacao === 'aprovada' ? 'Aprovada' : 'Pendente'}
                      </span>
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