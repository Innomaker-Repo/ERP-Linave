import React, { useEffect, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { gerarIdOrcamento, extrairIdProjetoDoNumero, extrairComponentesDoId } from '../../../context/ErpContext';
import { Plus, X, DollarSign, FileText, Trash2, Lock, Eye, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import {
  buildOrcamentoPayload,
  createOrcamento
} from '../../../../services/comercial';

import { getNegocios, getClientes, getOrdensPorNegocio, atualizarNegocio } from '../../../../services/comercialService';
import { getBackendUrl } from '../../../../services/network';

interface MaoDeObra {
  id: string;
  funcao: string;
  quantidade: string;
  dias: string;
  custoUnitDia: string;
  valorTotal: string;
  observacao: string;
}

interface Atividade {
  id: string;
  atividade: string;
  dias: string;
  observacao: string;
}

interface Material {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  pesoFator: string;
  custoUnit: string;
  valorTotal: string;
  observacao: string;
  origemTerceiros: 'Sim' | 'Nao';
}

interface Terceirizado {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  pesoFator: string;
  custoUnit: string;
  valorTotal: string;
  observacao: string;
}

interface ServicoOrcamento {
  id: string;
  ordem: number;
  tipo: string;
  categoria: string;
  embarcacao: string;
  localExecucao: string;
  porto: string;
  prazoDes: string;
  descricao: string;
  observacoes: string;
}

interface OrcamentosViewProps {
  searchQuery: string;
}

const parseNumber = (value: any): number => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  let s = String(value).trim();
  if (!s) return NaN;
  
  // Lida com formatos brasileiros: '.' como separador de milhar e ',' como decimal
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  
  // Remover espaços residuais
  s = s.replace(/\s+/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
};


export function OrcamentosView({ searchQuery }: OrcamentosViewProps) {
  const { obras, saveEntity } = useErp() as any;
  const [listaClientesOrc, setListaClientesOrc] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedObra, setSelectedObra] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detalhesModal, setDetalhesModal] = useState<{ obra: any; orc: any } | null>(null);

  const getRascunhoKey = (obraId: string | number) => `orcamento_rascunho_${obraId}`;

  const fecharOrcamentoComoX = () => {
    setShowForm(false);
    setSelectedObra(null);
  };
 


    useEffect(() => {
    const carregarDadosSQL = async () => {
      setLoadingData(true);
      try {
        // 2. Busca os clientes
        const clientesBackend = await getClientes();
        const clientesMapa: any = {};
        if (Array.isArray(clientesBackend)) {
          setListaClientesOrc(clientesBackend);
          clientesBackend.forEach((c: any) => { clientesMapa[c.id] = c; });
        }

        // 3. Busca os negócios (projetos)
        const dados = await getNegocios();
        if (Array.isArray(dados)) {
          const formatados = dados.map((n: any) => ({
            id: `ID ${n.id}`,
            nome: n.nome_negocio,
            clienteId: n.cliente || n.cliente_id || n.clienteId,
            nomeCliente: (clientesMapa[n.cliente]?.razaoSocial || clientesMapa[n.cliente]?.razao_social) || '',
            empresaPrestadora: n.empresa_prestadora || 'Linave',
            categoria: n.categoria || 'Planejamento',
            status: n.status || 'Aguardando orçamento',
            solicitante: n.solicitante || '',
            responsavelTecnico: n.solicitante || '',
            tipo: (n.servicos?.[0]?.tipo_servico) || n.tipo_servico || '',
            requerReorcamento: n.requer_reorcamento !== undefined ? n.requer_reorcamento : true,
            orcamentoRealizado: n.orcamento_realizado || false,
            servicos: n.servicos || [],
            negocioBackendId: n.id,
            orcamentos: n.orcamentos || [],
            propostas: n.propostas || [],
            documentosNegocio: n.documentos || n.arquivos || [],
            dataPrevistaInicio: n.data_prevista_inicio || null,
            dataPrevistaFinal: n.data_prevista_final || null,
          }));

          // 4. Salva apenas UMA VEZ no contexto global
          saveEntity('obras', formatados);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do SQL:", error);
      } finally {
        setLoadingData(false);
      }
    };

    carregarDadosSQL();
  }, []); // A dependência vazia [] é o que trava a execução apenas para a montagem inicial.

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
    if (versao === null || versao === undefined) return '';

    const texto = String(versao).trim();
    if (!texto) return '';
    if (/^[A-Za-z]+$/.test(texto)) {
      return texto.toUpperCase();
    }

    const versaoNumero = Number(texto);
    if (Number.isFinite(versaoNumero) && versaoNumero > 0) {
      return String(Math.floor(versaoNumero));
    }

    return texto;
  };

  const labelVersaoOrcamento = (versao: any) => {
    const versaoNormalizada = formatarVersaoOrcamento(versao);
    return versaoNormalizada ? `v${versaoNormalizada}` : 'Original';
  };

  const proximaVersaoOrcamento = (orcamentos: any[] = []) => {
    const versoesAlfabeticas = orcamentos
      .map((orcamento) => formatarVersaoOrcamento(orcamento?.versao))
      .filter((versao) => /^[A-Z]+$/.test(versao));

    if (versoesAlfabeticas.length === 0) {
      return 'A';
    }

    const ultimoIndice = versoesAlfabeticas.reduce((maior, versao) => {
      const indice = versaoAlfabeticaToIndex(versao);
      return Math.max(maior, indice);
    }, -1);

    return indexToVersaoAlfabetica(ultimoIndice + 1);
  };

  const getEmpresaPrefixo = (obra: any) => {
    const rawEmpresa = obra?.empresaPrestadora || '';
    const cleaned = (typeof rawEmpresa === 'string' ? rawEmpresa : (rawEmpresa.nome || '')).toLowerCase();
    return cleaned.includes('servi') ? 'SN' : 'LN';
  };

  const getInitialOrcamentoData = () => ({
    numeroOrcamento: `LN-0001/${new Date().getFullYear().toString().slice(-2)}`,
    solicitante: '',
    escopoOrcamento: '',
    documentosReferencia: '',
    dadosServicos: [] as ServicoOrcamento[],
    equipamento: '',
    supervisor: '',
    centroCusto: '',
    maoDeObra: [{ id: '1', funcao: '', quantidade: '', dias: '', custoUnitDia: '', valorTotal: '0.00', observacao: '' }],
    atividades: [{ id: '1', atividade: '', dias: '', observacao: '' }],
    materiais: [{ id: '1', descricao: '', unidade: 'un', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '0.00', observacao: '', origemTerceiros: 'Nao' as const }] as Material[],
    terceirizados: [{ id: '1', descricao: '', unidade: 'serv', quantidade: '', pesoFator: '1', custoUnit: '', valorTotal: '0.00', observacao: '' }],
    observacoes: '',
    margem: '15',
    oh: '5',
    impostos: '18',
    quantidadeItensProduzidos: ''
  });

  const [orcamentoData, setOrcamentoData] = useState(getInitialOrcamentoData);

  useEffect(() => {
    if (!showForm || !selectedObra) return;

    try {
      localStorage.setItem(getRascunhoKey(selectedObra.id), JSON.stringify(orcamentoData));
    } catch (error) {
      console.warn('Não foi possível salvar o rascunho do orçamento:', error);
    }
  }, [orcamentoData, selectedObra, showForm]);

  useEffect(() => {
    const handleFecharSolicitado = () => {
      if (!showForm) return;
      fecharOrcamentoComoX();
    };

    window.addEventListener('fecharOrcamentoSolicitado', handleFecharSolicitado);
    return () => window.removeEventListener('fecharOrcamentoSolicitado', handleFecharSolicitado);
  }, [showForm]);

  // Função para converter dados antigos em novo formato
  const normalizarOrcamentos = (obra: any) => {
    const orcamentos = obra.orcamentos || [];
    const ultimaProposta = Array.isArray(obra.propostas) && obra.propostas.length > 0
      ? obra.propostas[obra.propostas.length - 1]
      : null;
    const statusNegocio = String(obra.status || '').toLowerCase();
    const legadoRecusado = statusNegocio.includes('aguardando orçamento') || ultimaProposta?.status === 'recusada';
    
    // Se tem dados antigos, converter para novo formato
    if (obra.orcamentoRealizado && obra.orcamentoData && obra.orcamentoValores && orcamentos.length === 0) {
      return [{
        versao: '',
        dataCriacao: obra.dataCadastro,
        status: legadoRecusado ? 'recusado' : 'pendente',
        dataRecusa: legadoRecusado ? (obra.dataCadastro || new Date().toISOString().split('T')[0]) : undefined,
        numeroOrcamento: obra.orcamentoData.numeroOrcamento,
        data: obra.orcamentoData,
        valores: obra.orcamentoValores
      }];
    }
    
    return orcamentos.map((orcamento: any) => ({
      ...orcamento,
      versao: formatarVersaoOrcamento(orcamento?.versao),
      status: orcamento?.status || 'pendente'
    }));
  };

  const obterUltimoOrcamento = (obra: any) => {
    const orcamentos = normalizarOrcamentos(obra);
    return orcamentos.length > 0 ? orcamentos[orcamentos.length - 1] : null;
  };

  const isOrcamentoEditavel = (obra: any) => obra?.categoria === 'Planejamento';

  // Topo: negócios sem orçamento, com orçamento recusado, pendente de reorçamento, ou com rascunho.
  const projetosAOrcar = (obras || [])
    .filter((obra: any) => {
      if (obra.categoria !== 'Planejamento') return false;
      const ultimoOrcamento = obterUltimoOrcamento(obra);
      // Pendente sem flag de reorçamento → está em aguardando aprovação
      if (ultimoOrcamento?.status === 'pendente' && !obra.requerReorcamento) return false;
      return !ultimoOrcamento
        || ultimoOrcamento.status === 'recusado'
        || ultimoOrcamento.status === 'pendente_reorcamento'
        || ultimoOrcamento.status === 'rascunho'
        || obra.requerReorcamento;
    })
    .sort((a: any, b: any) => { 
      const ultimoA = obterUltimoOrcamento(a);
      const ultimoB = obterUltimoOrcamento(b);
      const prioridadeA = a.requerReorcamento || ultimoA?.status === 'pendente_reorcamento' ? 0 : (ultimoA?.status === 'recusado' ? 1 : 2);
      const prioridadeB = b.requerReorcamento || ultimoB?.status === 'pendente_reorcamento' ? 0 : (ultimoB?.status === 'recusado' ? 1 : 2);
      if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;

      const dataA = new Date(ultimoA?.dataRecusa || ultimoA?.dataCriacao || a.dataCadastro || 0).getTime();
      const dataB = new Date(ultimoB?.dataRecusa || ultimoB?.dataCriacao || b.dataCadastro || 0).getTime();
      return dataB - dataA;
    });

  // Aguardando aprovação interna: negócios em Planejamento com orçamento pendente.
  const projetosAguardandoAprovacao = (obras || []).filter((obra: any) => {
    if (obra.categoria !== 'Planejamento') return false;
    if (obra.requerReorcamento) return false; // marcado para reorçamento → sai daqui
    const ultimoOrcamento = obterUltimoOrcamento(obra);
    return ultimoOrcamento?.status === 'pendente';
  });

  // Histórico: negócios com orçamento aprovado (fora do Planejamento).
  const obrasComOrcamentos = (obras || []).filter((obra: any) => {
    const ultimoOrcamento = obterUltimoOrcamento(obra);
    if (obra.requerReorcamento) return false;
    if (obra.categoria === 'Planejamento') return false;
    return Boolean(
      ultimoOrcamento
      && ultimoOrcamento.status !== 'recusado'
      && ultimoOrcamento.status !== 'pendente_reorcamento'
      && ultimoOrcamento.status !== 'rascunho'
    );
  });

  const handleSelectObra = async (obra: any) => {
    if (!isOrcamentoEditavel(obra)) {
      alert('Este orçamento está imutável. Apenas projetos em Planejamento podem receber novo orçamento.');
      return;
    }

    setSelectedObra(obra);
    const orcamentosExistentes = normalizarOrcamentos(obra);
    const ultimoOrcamento = orcamentosExistentes.length > 0 ? orcamentosExistentes[orcamentosExistentes.length - 1] : null;
    const ultimoEhRascunho = ultimoOrcamento?.status === 'rascunho';
    const reorcamentoPendente = Boolean(obra.requerReorcamento && ultimoOrcamento?.status === 'pendente_reorcamento');
    const proximaVersao = (reorcamentoPendente || ultimoEhRascunho)
      ? formatarVersaoOrcamento(ultimoOrcamento?.versao)
      : proximaVersaoOrcamento(orcamentosExistentes);

    const dadosServicos: ServicoOrcamento[] = (obra.servicos || []).map((s: any, idx: number) => ({
      id: s.id || `${obra.id}-servico-${idx + 1}`,
      ordem: idx + 1,
      tipo: s.tipo || '',
      categoria: s.categoria || '',
      embarcacao: s.embarcacao || '',
      localExecucao: s.localExecucao || '',
      porto: s.porto || '',
      prazoDes: s.prazoDes || '',
      descricao: s.descricao || '',
      observacoes: s.observacoes || ''
    }));
    
    // Preencher escopo automaticamente com informações dos serviços
    const servicosInfo = dadosServicos
      .map((s) => `• Serviço ${s.ordem}: ${s.tipo || 'Sem tipo'}${s.categoria ? ` (${s.categoria})` : ''}${s.localExecucao ? ` em ${s.localExecucao}` : ''}${s.prazoDes ? ` | Prazo: ${s.prazoDes}` : ''}`)
      .join('\n');
    
    // Normaliza itens vindos do backend (campo snake_case) para o formato esperado pelo formulário
    const normMateriais = (arr: any[]): Material[] =>
      (arr || []).map((item: any) => ({
        id: String(item.id || Date.now() + Math.random()),
        descricao: item.descricao || item.item || '',
        unidade: item.unidade || '',
        quantidade: String(item.quantidade ?? item.qnt ?? ''),
        pesoFator: String(item.pesoFator ?? item.peso ?? ''),
        custoUnit: String(item.custoUnit ?? item.custo_unit ?? ''),
        valorTotal: String(item.valorTotal ?? '0.00'),
        observacao: item.observacao || '',
        origemTerceiros: (item.origemTerceiros || (item.terceirizado ? 'Sim' : 'Nao')) as 'Sim' | 'Nao',
      }));

    const normTerceirizados = (arr: any[]) =>
      (arr || []).map((item: any) => ({
        id: String(item.id || Date.now() + Math.random()),
        descricao: item.descricao || '',
        unidade: item.unidade || '',
        quantidade: String(item.quantidade ?? item.qnt ?? ''),
        pesoFator: String(item.pesoFator ?? item.peso ?? '1'),
        custoUnit: String(item.custoUnit ?? item.valor_unit ?? ''),
        valorTotal: String(item.valorTotal ?? '0.00'),
        observacao: item.observacao || '',
      }));

    const normMaoDeObra = (arr: any[]): MaoDeObra[] =>
      (arr || []).map((item: any) => ({
        id: String(item.id || Date.now() + Math.random()),
        funcao: item.funcao || item.fnc || '',
        quantidade: String(item.quantidade ?? item.qnt ?? ''),
        dias: String(item.dias ?? ''),
        custoUnitDia: String(item.custoUnitDia ?? item.custo_unit_dia ?? ''),
        valorTotal: String(item.valorTotal ?? '0.00'),
        observacao: item.observacao || '',
      }));

    const normAtividades = (arr: any[]): Atividade[] =>
      (arr || []).map((item: any) => ({
        id: String(item.id || Date.now() + Math.random()),
        atividade: item.atividade || '',
        dias: String(item.dias ?? item.duracao ?? ''),
        observacao: item.observacao || '',
      }));

    // Sempre aproveita o último orçamento disponível para pré-preencher o formulário
    const initialDefaults = getInitialOrcamentoData();
    const rawBase = ultimoOrcamento?.data
      ? { ...initialDefaults, ...ultimoOrcamento.data }
      : ultimoOrcamento
        // Fallback para quando o orçamento veio do backend (sem .data): usa campos top-level
        ? {
            ...initialDefaults,
            maoDeObra: ultimoOrcamento.mao_de_obra || ultimoOrcamento.maoDeObra || [],
            materiais: ultimoOrcamento.materiais || [],
            atividades: ultimoOrcamento.atividades || [],
            terceirizados: ultimoOrcamento.terceirizados || [],
            observacoes: ultimoOrcamento.observacoes_setor_orcamento || '',
            margem: String(ultimoOrcamento.resumo?.margem ?? initialDefaults.margem),
            oh: String(ultimoOrcamento.resumo?.OH ?? initialDefaults.oh),
            impostos: String(ultimoOrcamento.resumo?.impostos ?? initialDefaults.impostos),
            quantidadeItensProduzidos: String(ultimoOrcamento.resumo?.qnt || ''),
          }
        : initialDefaults;

    // Normaliza campos do backend e garante ao menos uma linha em cada seção
    const baseData = {
      ...rawBase,
      materiais: rawBase.materiais?.length
        ? normMateriais(rawBase.materiais)
        : initialDefaults.materiais,
      terceirizados: rawBase.terceirizados?.length
        ? normTerceirizados(rawBase.terceirizados)
        : initialDefaults.terceirizados,
      atividades: rawBase.atividades?.length
        ? normAtividades(rawBase.atividades)
        : initialDefaults.atividades,
      maoDeObra: rawBase.maoDeObra?.length
        ? normMaoDeObra(rawBase.maoDeObra)
        : initialDefaults.maoDeObra,
    };

    // Extrair componentes do ID do projeto (já tem formato correto: LN-0731/26 ou SN-0001/26)
    const componentesId = extrairComponentesDoId(obra.id);
    const prefixo = componentesId?.prefixo || 'LN';
    const numeroServico = componentesId?.numero || '0001';

    // Busca ordens de serviço vinculadas ao negócio para preencher campos adicionais
    let ordem = null;
    try {
      const ordens = await getOrdensPorNegocio(obra.negocioBackendId || (obra.id && parseInt(String(obra.id).replace(/[^0-9]/g, ''))));
      if (Array.isArray(ordens) && ordens.length > 0) ordem = ordens[0];
    } catch (err) {
      console.warn('Falha ao buscar ordens de serviço para preencher campos extras:', err);
    }

    const formularioBase = {
      ...baseData,
      numeroOrcamento: reorcamentoPendente
        ? (ultimoOrcamento?.numeroOrcamento || gerarIdOrcamento(prefixo, numeroServico, proximaVersao))
        : gerarIdOrcamento(prefixo, numeroServico, proximaVersao),
      escopoOrcamento: servicosInfo,
      solicitante: obra.solicitante || baseData.solicitante || '',
      equipamento: ordem?.equipamento || obra.equipamento || baseData.equipamento || '',
      supervisor: ordem?.supervisor_encarregado || ordem?.supervisor || obra.supervisor || baseData.supervisor || '',
      centroCusto: ordem?.cc || ordem?.centro_custo || obra.centroCusto || baseData.centroCusto || '',
      dadosServicos
    };

    try {
      const salvo = localStorage.getItem(getRascunhoKey(obra.id));
      if (salvo) {
        const rascunho = JSON.parse(salvo);
        setOrcamentoData({
          ...formularioBase,
          ...rascunho,
          // Sempre usa o numero/versão calculada, nunca o do rascunho
          numeroOrcamento: formularioBase.numeroOrcamento,
          dadosServicos: Array.isArray(rascunho?.dadosServicos) && rascunho.dadosServicos.length > 0
            ? rascunho.dadosServicos
            : formularioBase.dadosServicos,
        });
      } else {
        setOrcamentoData(formularioBase);
      }
    } catch {
      setOrcamentoData(formularioBase);
    }
    // Preencher valores financeiros caso exista último orçamento
    if (ultimoOrcamento?.valores) {
      setOrcamentoData(prev => ({
        ...prev,
        margem: String(ultimoOrcamento.valores.margem ?? prev.margem),
        oh: String(ultimoOrcamento.valores.oh ?? prev.oh),
        impostos: String(ultimoOrcamento.valores.impostos ?? prev.impostos),
        quantidadeItensProduzidos: String(ultimoOrcamento.valores.quantidadeItensProduzidos ?? prev.quantidadeItensProduzidos)
      }));
    }
    
    setShowForm(true);
  };

  const formatApiErrorMessage = (error: any) => {
    if (!error) return 'Falha na integração com backend.';
    const responseData = error?.response?.data;

    if (responseData) {
      if (typeof responseData === 'string') return responseData;
      if (responseData.detail) return String(responseData.detail);
      if (responseData.error) return String(responseData.error);
      if (typeof responseData === 'object') {
        try {
          return JSON.stringify(responseData);
        } catch {
          return String(responseData);
        }
      }
    }

    return error?.message || 'Falha na integração com backend.';
  };

  // Calcula os totais do orçamento atual (sem depender de parseDecimal definido abaixo,
  // pois este helper é chamado em runtime, não em tempo de definição)
  const calcularValoresOrcamento = () => {
    const pd = (v: any) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
    const totalMDO = orcamentoData.maoDeObra.reduce((s: number, i: any) => s + pd(i.valorTotal), 0);
    const totalMat = orcamentoData.materiais.reduce((s: number, i: any) => s + pd(i.valorTotal), 0);
    const totalTer = orcamentoData.terceirizados.reduce((s: number, i: any) => s + pd(i.valorTotal), 0);
    const totalBruto = totalMDO + totalMat + totalTer;
    const margemPct = pd(orcamentoData.margem);
    const ohPct = pd(orcamentoData.oh);
    const impostosPct = pd(orcamentoData.impostos);
    const margemVal = (totalBruto * margemPct) / 100;
    const ohVal = (totalBruto * ohPct) / 100;
    const semImposto = totalBruto + margemVal + ohVal;
    const impostoVal = (semImposto * impostosPct) / 100;
    const precoFinal = semImposto + impostoVal;
    const qtd = Number(orcamentoData.quantidadeItensProduzidos) || 0;
    return {
      totalMaoDeObra: totalMDO, totalMateriais: totalMat, totalTerceirizados: totalTer,
      totalBruto, totalSemImposto: semImposto, subtotal: totalBruto,
      margem: margemPct, oh: ohPct, impostos: impostosPct,
      valorMargem: margemVal, valorOH: ohVal, valorImpostos: impostoVal,
      precoFinal, quantidadeItensProduzidos: qtd,
      valorPorUnidade: qtd > 0 ? precoFinal / qtd : 0,
    };
  };

  const construirNovoOrcamento = (statusOrc: string) => {
    const orcamentosExistentes = normalizarOrcamentos(selectedObra);
    const ultimoOrc = orcamentosExistentes.length > 0 ? orcamentosExistentes[orcamentosExistentes.length - 1] : null;
    const ultimoEhRascunho = ultimoOrc?.status === 'rascunho';
    const reorcPendente = Boolean(selectedObra?.requerReorcamento && ultimoOrc?.status === 'pendente_reorcamento');
    const proxVersao = (reorcPendente || ultimoEhRascunho)
      ? formatarVersaoOrcamento(ultimoOrc?.versao)
      : proximaVersaoOrcamento(orcamentosExistentes);
    return {
      novoOrcamento: {
        versao: proxVersao,
        dataCriacao: new Date().toISOString().split('T')[0],
        status: statusOrc,
        numeroOrcamento: orcamentoData.numeroOrcamento,
        data: { ...orcamentoData },
        valores: calcularValoresOrcamento(),
      },
      orcamentosExistentes,
      reorcPendente,
      ultimoEhRascunho,
    };
  };

  // SALVAR RASCUNHO — sem validações rígidas, mantém o negócio em Planejamento
  const handleSalvarOrcamentoClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!selectedObra) return alert("Nenhum projeto selecionado.");

    const negocioId = selectedObra.negocioBackendId || extrairIdProjetoDoNumero(selectedObra.id);
    const clienteId = Number(selectedObra.clienteId);
    if (!negocioId || !clienteId) {
      alert("Não foi possível identificar o negócio ou cliente. Recarregue a página.");
      return;
    }

    setSaving(true);
    try {
      const { novoOrcamento, orcamentosExistentes, reorcPendente, ultimoEhRascunho } = construirNovoOrcamento('rascunho');

      const obraAtualizada = {
        ...selectedObra,
        orcamentos: (reorcPendente || ultimoEhRascunho)
          ? [...orcamentosExistentes.slice(0, -1), novoOrcamento]
          : [...orcamentosExistentes, novoOrcamento],
      };
      const obrasAtualizadas = (obras || []).map((o: any) => o.id === selectedObra.id ? obraAtualizada : o);
      saveEntity('obras', obrasAtualizadas);

      // Tenta persistir no backend sem bloquear em caso de erro
      try {
        const payload = buildOrcamentoPayload(orcamentoData, selectedObra, negocioId, clienteId);
        await createOrcamento({ ...payload, finalizar: false, versao: novoOrcamento.versao });
      } catch (backendErr) {
        console.warn('Rascunho salvo localmente; erro no backend:', backendErr);
      }

      try {
        localStorage.removeItem(getRascunhoKey(selectedObra.id));
      } catch {
        // ignore
      }

      alert("Rascunho salvo! O negócio permanece em Planejamento.");
      fecharOrcamentoComoX();
      setOrcamentoData(getInitialOrcamentoData());
    } finally {
      setSaving(false);
    }
  };

  // CONCLUIR ORÇAMENTO — validação completa + move para Negociação
  const handleConcluirOrcamento = async () => {
    if (!selectedObra) return alert("Nenhum projeto selecionado.");
    if (!isOrcamentoEditavel(selectedObra)) return alert('Não é possível alterar orçamento após Planejamento.');

    if (!orcamentoData.numeroOrcamento.trim()) { alert("Número do orçamento é obrigatório."); return; }
    if (!orcamentoData.solicitante.trim()) { alert("Solicitante é obrigatório."); return; }
    if (!orcamentoData.escopoOrcamento.trim()) { alert("Escopo do orçamento é obrigatório."); return; }
    const qtdItens = Number(orcamentoData.quantidadeItensProduzidos);
    if (!qtdItens || qtdItens < 1) { alert("Quantidade de itens produzidos é obrigatória para concluir o orçamento."); return; }
    const atividadesPreenchidas = orcamentoData.atividades.filter(i => i.atividade?.trim());
    if (atividadesPreenchidas.length === 0) { alert("É obrigatório preencher pelo menos uma atividade prevista para concluir o orçamento."); return; }

    // Mão de obra: pelo menos um item com funcao preenchida
    const mdoPreenchido = orcamentoData.maoDeObra.filter((item: MaoDeObra) => item.funcao?.trim());
    if (mdoPreenchido.length === 0) {
      alert("É necessário informar pelo menos uma função de mão de obra para concluir o orçamento.");
      return;
    }
    for (const item of mdoPreenchido) {
      const qVal = parseNumber(item.quantidade);
      const diasVal = parseNumber(item.dias);
      const custoVal = parseNumber(item.custoUnitDia);
      if (!Number.isFinite(qVal) || qVal <= 0) { alert(`Quantidade inválida para a função "${item.funcao}".`); return; }
      if (!Number.isFinite(diasVal) || diasVal <= 0) { alert(`Dias inválido para a função "${item.funcao}".`); return; }
      if (!Number.isFinite(custoVal) || custoVal <= 0) { alert(`Custo por dia inválido para a função "${item.funcao}".`); return; }
    }

    // Validar apenas linhas de materiais que foram preenchidas
    for (const item of orcamentoData.materiais) {
      if (!isMaterialRowFilled(item)) continue;
      if (!item.descricao.trim()) { alert("Descrição obrigatória para materiais preenchidos."); return; }
      const q = parseNumber(item.quantidade); if (isNaN(q) || q <= 0) { alert(`Quantidade inválida para o material "${item.descricao}".`); return; }
      const c = parseNumber(item.custoUnit); if (isNaN(c) || c <= 0) { alert(`Custo unitário inválido para o material "${item.descricao}".`); return; }
    }

    // Validar apenas linhas de terceirizados que foram preenchidas
    for (const item of orcamentoData.terceirizados) {
      if (!isTerceirizadoRowFilled(item)) continue;
      if (!item.descricao.trim()) { alert("Descrição obrigatória para terceirizados preenchidos."); return; }
      const q = parseNumber(item.quantidade); if (isNaN(q) || q <= 0) { alert(`Quantidade inválida para "${item.descricao}".`); return; }
      const c = parseNumber(item.custoUnit); if (isNaN(c) || c <= 0) { alert(`Custo inválido para "${item.descricao}".`); return; }
    }

    // Validar apenas linhas de atividades que foram preenchidas
    for (const item of orcamentoData.atividades) {
      if (!isAtividadeRowFilled(item)) continue;
      if (!item.atividade.trim()) { alert("Nome da atividade obrigatório."); return; }
      const d = parseNumber(item.dias); if (isNaN(d) || d <= 0) { alert(`Dias inválido para a atividade "${item.atividade}".`); return; }
    }

    const negocioId = selectedObra.negocioBackendId || extrairIdProjetoDoNumero(selectedObra.id);
    const clienteId = Number(selectedObra.clienteId);
    if (!negocioId || !clienteId) {
      alert("Não foi possível identificar o negócio ou cliente. Recarregue a página.");
      return;
    }

    setSaving(true);
    try {
      // Constrói antes do backend para ter a versão correta disponível no payload
      const { novoOrcamento, orcamentosExistentes, reorcPendente, ultimoEhRascunho } = construirNovoOrcamento('pendente');

      const payload = buildOrcamentoPayload(orcamentoData, selectedObra, negocioId, clienteId);
      await createOrcamento({ ...payload, finalizar: true, versao: novoOrcamento.versao });

      const obraAtualizada = {
        ...selectedObra,
        requerReorcamento: false,
        orcamentoRealizado: true,
        categoria: 'Planejamento',
        orcamentos: (reorcPendente || ultimoEhRascunho)
          ? [...orcamentosExistentes.slice(0, -1), novoOrcamento]
          : [...orcamentosExistentes, novoOrcamento],
      };
      const obrasAtualizadas = (obras || []).map((o: any) => o.id === selectedObra.id ? obraAtualizada : o);
      saveEntity('obras', obrasAtualizadas);

      try {
        localStorage.removeItem(getRascunhoKey(selectedObra.id));
      } catch {
        // ignore
      }

      alert("Orçamento enviado para aprovação!");
      fecharOrcamentoComoX();
      setOrcamentoData(getInitialOrcamentoData());
    } catch (error: any) {
      console.error("Erro ao concluir orçamento:", error);
      alert(`Erro ao concluir orçamento: ${formatApiErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAprovarOrcamento = async (obra: any) => {
    if (!window.confirm(`Confirma a APROVAÇÃO do orçamento de "${obra.nome}"?\n\nApós aprovado, o negócio avançará para Proposta.`)) return;
    const orcamentosExistentes = normalizarOrcamentos(obra);
    const ultimoOrcamento = orcamentosExistentes[orcamentosExistentes.length - 1];
    if (!ultimoOrcamento) return;
    const orcamentoAtualizado = { ...ultimoOrcamento, status: 'aprovado' };
    const novosOrcamentos = [...orcamentosExistentes.slice(0, -1), orcamentoAtualizado];
    const obraAtualizada = { ...obra, categoria: 'Negociação', status: 'Negociação', orcamentos: novosOrcamentos };
    try {
      const negocioId = obra.negocioBackendId || extrairIdProjetoDoNumero(obra.id);
      if (negocioId) await atualizarNegocio(negocioId, { categoria: 'Negociação', status: 'Negociação' });
    } catch (err) {
      console.error("Erro ao atualizar negócio no backend:", err);
    }
    const obrasAtualizadas = (obras || []).map((o: any) => o.id === obra.id ? obraAtualizada : o);
    saveEntity('obras', obrasAtualizadas);
    alert("Orçamento aprovado! Negócio avançado para Proposta.");
  };

  const handleRecusarOrcamento = async (obra: any) => {
    const motivo = window.prompt('Informe o motivo da recusa do orçamento:');
    if (motivo === null) return;
    if (!motivo.trim()) { alert('O motivo da recusa é obrigatório.'); return; }
    const orcamentosExistentes = normalizarOrcamentos(obra);
    const ultimoOrcamento = orcamentosExistentes[orcamentosExistentes.length - 1];
    if (!ultimoOrcamento) return;
    const orcamentoAtualizado = {
      ...ultimoOrcamento,
      status: 'recusado',
      dataRecusa: new Date().toISOString().split('T')[0],
      motivoRecusa: motivo.trim(),
    };
    const novosOrcamentos = [...orcamentosExistentes.slice(0, -1), orcamentoAtualizado];
    const obraAtualizada = { ...obra, categoria: 'Planejamento', requerReorcamento: true, orcamentos: novosOrcamentos };
    const obrasAtualizadas = (obras || []).map((o: any) => o.id === obra.id ? obraAtualizada : o);
    saveEntity('obras', obrasAtualizadas);
    try { localStorage.removeItem(getRascunhoKey(obra.id)); } catch {}
    // Persiste no backend para sobreviver à remontagem do componente
    try {
      const negocioId = obra.negocioBackendId || extrairIdProjetoDoNumero(obra.id);
      if (negocioId) await atualizarNegocio(negocioId, { requer_reorcamento: true, status: 'Orçamento recusado' });
    } catch (err) {
      console.warn('Erro ao persistir recusa no backend:', err);
    }
    alert("Orçamento recusado. Projeto retornou para reorçamento.");
  };

  const handleArquivarNegocio = async (obra: any) => {
    if (!window.confirm(`Confirma o arquivamento do negócio "${obra.nome}"?\n\nO negócio será marcado como Arquivado e não aparecerá mais nos fluxos ativos.`)) return;
    const obraAtualizada = { ...obra, categoria: 'Arquivado', status: 'Arquivado' };
    const obrasAtualizadas = (obras || []).map((o: any) => o.id === obra.id ? obraAtualizada : o);
    saveEntity('obras', obrasAtualizadas);
    try {
      const negocioId = obra.negocioBackendId || extrairIdProjetoDoNumero(obra.id);
      if (negocioId) await atualizarNegocio(negocioId, { categoria: 'Arquivado', status: 'Arquivado' });
    } catch (err) {
      console.warn('Erro ao arquivar negócio no backend:', err);
    }
  };

  const abrirDocumentoNegocio = (documento: any) => {
    if (!documento?.conteudo) return;

    const href = String(documento.conteudo);
    const [meta, payload] = href.split(',', 2);

    if (meta?.includes(';base64') && payload) {
      const mime = meta.match(/^data:(.*?);base64$/)?.[1] || documento.tipo || 'application/octet-stream';
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      return;
    }

    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const baixarDocumentoNegocio = (documento: any) => {
    if (!documento?.conteudo) return;
    const link = document.createElement('a');
    link.href = documento.conteudo;
    link.download = documento.nome || 'documento';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const safeNumber = (value: any): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const handleDownloadOrcamentoPDF = (orcamento: any, obraParam: any) => {
    if (!orcamento || !obraParam) return;

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const lineHeight = 5;
      const cellHeight = lineHeight;
      let y = 10;
      const margin = 8;
      const baseColWidth = (pageWidth - margin * 2) / 10;
      const laborColWidths = [
        baseColWidth,
        baseColWidth * 2.7,
        baseColWidth,
        baseColWidth,
        baseColWidth * 1.4,
        baseColWidth * 1.6,
        baseColWidth * 1.3
      ];
      const materialsColWidths = [
        baseColWidth,
        baseColWidth * 3.3,
        baseColWidth * 0.8,
        baseColWidth * 0.9,
        baseColWidth * 1.3,
        baseColWidth * 1.4,
        baseColWidth * 1.3
      ];
      const activitiesColWidths = [
        baseColWidth,
        baseColWidth * 3,
        baseColWidth,
        baseColWidth * 5
      ];
      const sumWidths = (widths: number[]) => widths.reduce((sum, width) => sum + width, 0);

      // Função para desenhar célula com quebra de texto dinâmica
      const drawCellWithAutoWrap = (x: number, y: number, width: number, height: number, text: string, bold = false, red = false) => {
        doc.setFont('Arial', bold ? 'bold' : 'normal');
        
        if (red) {
          doc.setTextColor(255, 0, 0);
        } else {
          doc.setTextColor(0, 0, 0);
        }

        const lines = doc.splitTextToSize(text || '', width - 2);
        
        let fontSize = 8;
        let displayLines = lines.slice(0, 2);
        
        if (lines.length > 2) {
          fontSize = 6;
          doc.setFontSize(fontSize);
          const newLines = doc.splitTextToSize(text || '', width - 2);
          displayLines = newLines.slice(0, 3);
        } else {
          doc.setFontSize(fontSize);
        }

        doc.rect(x, y, width, height);
        
        const lineHeightText = fontSize * 0.35;
        const totalTextHeight = displayLines.length * lineHeightText;
        let textY = y + (height - totalTextHeight) / 2 + lineHeightText * 0.7;
        
        displayLines.forEach((line: string) => {
          doc.text(line, x + 1, textY, { maxWidth: width - 2 });
          textY += lineHeightText;
        });
        
        doc.setTextColor(0, 0, 0);
      };

      // Função para desenhar célula simples
      const drawCell = (x: number, y: number, width: number, height: number, text: string, bold = false, red = false) => {
        doc.rect(x, y, width, height);
        doc.setFont('Arial', bold ? 'bold' : 'normal');
        doc.setFontSize(9);
        if (red) {
          doc.setTextColor(255, 0, 0);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        const maxChars = Math.floor(width / 1.5);
        const wrappedText = text.length > maxChars ? text.substring(0, maxChars - 3) + '...' : text;
        doc.text(wrappedText, x + 1, y + 3.5, { maxWidth: width - 2 });
        doc.setTextColor(0, 0, 0);
      };

     // Cabeçalho compacto
      let x = margin;
      const cliente = listaClientesOrc.find((c: any) => String(c.id) === String(obraParam.clienteId));
      drawCell(x, y, baseColWidth, cellHeight, 'Cliente:', true);
      x += baseColWidth;
      drawCell(x, y, baseColWidth * 3, cellHeight, cliente?.razaoSocial || '');
      x += baseColWidth * 3;
      drawCell(x, y, baseColWidth, cellHeight, '');
      x += baseColWidth;
      drawCell(x, y, baseColWidth * 5, cellHeight, `Data: ${new Date().toLocaleDateString('pt-BR')}`);
      y += cellHeight;

      x = margin;
      drawCell(x, y, baseColWidth, cellHeight, 'Ship:', true);
      x += baseColWidth;
      drawCell(x, y, baseColWidth * 9, cellHeight, obraParam.nome);
      y += cellHeight;

      x = margin;
      drawCell(x, y, baseColWidth, cellHeight, 'Escopo:', true);
      x += baseColWidth;
      drawCell(x, y, baseColWidth * 9, cellHeight, 'Serviços conforme descrito abaixo');
      y += cellHeight + 2;

      // Calcular valores
      const base = safeNumber(orcamento.valores.totalBruto ?? orcamento.valores.subtotal);
      const margemPercent = safeNumber(orcamento.valores.margem);
      const ohPercent = safeNumber(orcamento.valores.oh);
      const impostosPercent = safeNumber(orcamento.valores.impostos);
      const valorMargem = safeNumber(orcamento.valores.valorMargem ?? ((base * margemPercent) / 100));
      const valorOH = safeNumber(orcamento.valores.valorOH ?? ((base * ohPercent) / 100));
      const semImposto = safeNumber(orcamento.valores.totalSemImposto ?? (base + valorMargem + valorOH));
      const valorImposto = safeNumber(orcamento.valores.valorImpostos ?? ((semImposto * impostosPercent) / 100));
      const precoFinal = safeNumber(orcamento.valores.precoFinal);

      // Dados
      const maoDeObraData = (orcamento.data.maoDeObra || []).filter((item: any) => item.funcao);
      const totalMaoDeObra = maoDeObraData.reduce((sum: number, item: any) => sum + parseDecimal(item.valorTotal || '0'), 0);
      const materiaisData = (orcamento.data.materiais || []).filter((item: any) => item.descricao);
      const totalMateriais = materiaisData.reduce((sum: number, item: any) => sum + parseDecimal(item.valorTotal || '0'), 0);
      const terceirizadosData = (orcamento.data.terceirizados || []).filter((item: any) => item.descricao);
      const totalTerceiros = terceirizadosData.reduce((sum: number, item: any) => sum + parseDecimal(item.valorTotal || '0'), 0);
      const atividadesData = (orcamento.data.atividades || []).filter((item: any) => item.atividade);
      const totalDias = atividadesData.reduce((sum: number, item: any) => sum + parseDecimal(item.dias || '0'), 0);
      
      const totalItens = maoDeObraData.length + materiaisData.length + terceirizadosData.length;
      const precoPorItem = totalItens > 0 ? precoFinal / totalItens : 0;

      // ===== Seção A - MÃO DE OBRA =====
      x = margin;
      doc.setFont('Arial', 'bold');
      doc.setFontSize(9);
      doc.text('A', x + 2, y + 3);
      doc.rect(x, y, baseColWidth, cellHeight);
      x += baseColWidth;
      doc.setTextColor(255, 0, 0);
      doc.text('MÃO DE OBRA', x + 2, y + 3);
      doc.rect(x, y, baseColWidth * 9, cellHeight);
      doc.setTextColor(0, 0, 0);
      y += cellHeight;

      // Cabeçalho tabela A
      x = margin;
      const headersMaoDeObra = ['Item', 'Função', 'Qtd', 'Dias', 'Custo/Dia', 'Obs', 'Valor Total'];
      headersMaoDeObra.forEach((h, index) => {
        const colWidth = laborColWidths[index];
        doc.setFont('Arial', 'bold');
        doc.setFontSize(7);
        doc.text(h, x + 0.5, y + 2.5, { maxWidth: colWidth - 1 });
        doc.rect(x, y, colWidth, cellHeight);
        x += colWidth;
      });
      y += cellHeight;

      // Linhas de mão de obra
      maoDeObraData.forEach((item: any, idx: number) => {
        x = margin;
        doc.setFont('Arial', 'normal');
        doc.setFontSize(7);

        doc.text(String(idx + 1), x + 0.5, y + 2.5);
        doc.rect(x, y, laborColWidths[0], cellHeight);
        x += laborColWidths[0];

        drawCellWithAutoWrap(x, y, laborColWidths[1], cellHeight, item.funcao || '');
        x += laborColWidths[1];

        doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
        doc.rect(x, y, laborColWidths[2], cellHeight);
        x += laborColWidths[2];

        doc.text(String(item.dias || ''), x + 0.5, y + 2.5);
        doc.rect(x, y, laborColWidths[3], cellHeight);
        x += laborColWidths[3];

        doc.text(String(item.custoUnitDia ? parseFloat(item.custoUnitDia).toFixed(2) : ''), x + 0.5, y + 2.5);
        doc.rect(x, y, laborColWidths[4], cellHeight);
        x += laborColWidths[4];

        drawCellWithAutoWrap(x, y, laborColWidths[5], cellHeight, item.observacoes || '');
        x += laborColWidths[5];

        doc.setFont('Arial', 'bold');
        doc.setTextColor(255, 0, 0);
        doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('Arial', 'normal');
        doc.rect(x, y, laborColWidths[6], cellHeight);
        x += laborColWidths[6];

        y += cellHeight;
      });

      // Sub-total MÃO DE OBRA
      x = margin;
      doc.setFont('Arial', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 0, 0);
      doc.text('Sub-total', x + 0.5, y + 2.5);
      doc.setTextColor(0, 0, 0);
      doc.rect(x, y, sumWidths(laborColWidths.slice(0, -1)), cellHeight);
      x += sumWidths(laborColWidths.slice(0, -1));
      doc.setTextColor(255, 0, 0);
      doc.text(totalMaoDeObra.toFixed(2), x + 0.5, y + 2.5);
      doc.setTextColor(0, 0, 0);
      doc.rect(x, y, laborColWidths[6], cellHeight);
      y += cellHeight + 2;

      // ===== Seção B - CONSUMÍVEIS E MATERIAIS =====
      if (materiaisData && materiaisData.length > 0) {
        const headersMateriais = ['Item', 'Descrição', 'Un', 'Qtd', 'Peso/Fat', 'Custo Un', 'Total'];

        x = margin;
        doc.setFont('Arial', 'bold');
        doc.setFontSize(9);
        doc.text('B', x + 2, y + 3);
        doc.rect(x, y, baseColWidth, cellHeight);
        x += baseColWidth;
        doc.setTextColor(255, 0, 0);
        doc.text('CONSUMÍVEIS E MATERIAIS', x + 2, y + 3);
        doc.rect(x, y, baseColWidth * 9, cellHeight);
        doc.setTextColor(0, 0, 0);
        y += cellHeight;

        x = margin;
        headersMateriais.forEach((h, index) => {
          const colWidth = materialsColWidths[index];
          doc.setFont('Arial', 'bold');
          doc.setFontSize(7);
          doc.text(h, x + 0.5, y + 2.5, { maxWidth: colWidth - 1 });
          doc.rect(x, y, colWidth, cellHeight);
          x += colWidth;
        });
        y += cellHeight;

        materiaisData.forEach((item: any, idx: number) => {
          x = margin;
          doc.setFont('Arial', 'normal');
          doc.setFontSize(7);

          doc.text(String(idx + 1), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[0], cellHeight);
          x += materialsColWidths[0];

          drawCellWithAutoWrap(x, y, materialsColWidths[1], cellHeight, item.descricao || '');
          x += materialsColWidths[1];

          doc.text(item.unidade || '', x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[2], cellHeight);
          x += materialsColWidths[2];

          doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[3], cellHeight);
          x += materialsColWidths[3];

          doc.text(String(item.pesoFator || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[4], cellHeight);
          x += materialsColWidths[4];

          doc.text(String(item.custoUnit ? parseFloat(item.custoUnit).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[5], cellHeight);
          x += materialsColWidths[5];

          doc.setFont('Arial', 'bold');
          doc.setTextColor(255, 0, 0);
          doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('Arial', 'normal');
          doc.rect(x, y, materialsColWidths[6], cellHeight);
          x += materialsColWidths[6];

          y += cellHeight;
        });

        // Total materiais
        x = margin;
        doc.setFont('Arial', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 0, 0);
        doc.text('Valor total', x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, sumWidths(materialsColWidths.slice(0, -1)), cellHeight);
        x += sumWidths(materialsColWidths.slice(0, -1));
        doc.setTextColor(255, 0, 0);
        doc.text(totalMateriais.toFixed(2), x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, materialsColWidths[6], cellHeight);
        y += cellHeight + 2;
      }

      // ===== Seção C - SERVIÇOS TERCEIRIZADOS =====
      if (terceirizadosData && terceirizadosData.length > 0) {
        const headersTerceiros = ['Item', 'Descrição', 'Un', 'Qtd', 'Peso/Fat', 'Custo Un', 'Total'];

        x = margin;
        doc.setFont('Arial', 'bold');
        doc.setFontSize(9);
        doc.text('C', x + 2, y + 3);
        doc.rect(x, y, baseColWidth, cellHeight);
        x += baseColWidth;
        doc.setTextColor(255, 0, 0);
        doc.text('SERVIÇOS TERCEIRIZADOS', x + 2, y + 3);
        doc.rect(x, y, baseColWidth * 9, cellHeight);
        doc.setTextColor(0, 0, 0);
        y += cellHeight;

        x = margin;
        headersTerceiros.forEach((h, index) => {
          const colWidth = materialsColWidths[index];
          doc.setFont('Arial', 'bold');
          doc.setFontSize(7);
          doc.text(h, x + 0.5, y + 2.5, { maxWidth: colWidth - 1 });
          doc.rect(x, y, colWidth, cellHeight);
          x += colWidth;
        });
        y += cellHeight;

        terceirizadosData.forEach((item: any, idx: number) => {
          x = margin;
          doc.setFont('Arial', 'normal');
          doc.setFontSize(7);

          doc.text(String(idx + 1), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[0], cellHeight);
          x += materialsColWidths[0];

          drawCellWithAutoWrap(x, y, materialsColWidths[1], cellHeight, item.descricao || '');
          x += materialsColWidths[1];

          doc.text(item.unidade || '', x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[2], cellHeight);
          x += materialsColWidths[2];

          doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[3], cellHeight);
          x += materialsColWidths[3];

          doc.text(String(item.pesoFator || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[4], cellHeight);
          x += materialsColWidths[4];

          doc.text(String(item.custoUnit ? parseFloat(item.custoUnit).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.rect(x, y, materialsColWidths[5], cellHeight);
          x += materialsColWidths[5];

          doc.setFont('Arial', 'bold');
          doc.setTextColor(255, 0, 0);
          doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('Arial', 'normal');
          doc.rect(x, y, materialsColWidths[6], cellHeight);
          x += materialsColWidths[6];

          y += cellHeight;
        });

        // Sub-total terceiros
        x = margin;
        doc.setFont('Arial', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 0, 0);
        doc.text('Sub-total', x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, sumWidths(materialsColWidths.slice(0, -1)), cellHeight);
        x += sumWidths(materialsColWidths.slice(0, -1));
        doc.setTextColor(255, 0, 0);
        doc.text(totalTerceiros.toFixed(2), x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, materialsColWidths[6], cellHeight);
        y += cellHeight + 2;
      }

      // ===== Seção E - CUSTO TOTAL =====
      x = margin;
      doc.setFont('Arial', 'bold');
      doc.setFontSize(9);
      doc.text('E', x + 2, y + 3);
      doc.rect(x, y, baseColWidth, cellHeight);
      x += baseColWidth;
      doc.text('Cálculos Finais', x + 2, y + 3);
      doc.rect(x, y, baseColWidth * 9, cellHeight);
      y += cellHeight;

      // Dados de cálculo
      const calculos = [
        ['1', 'Valor mão de obra', totalMaoDeObra.toFixed(2)],
        ['2', 'Valor consumível e material', totalMateriais.toFixed(2)],
        ['3', 'Valor terceirizados', totalTerceiros.toFixed(2)],
        ['4', 'Total', base.toFixed(2)],
        ['5', `O.H (${ohPercent}%)`, valorOH.toFixed(2)],
        ['6', `Margem (${margemPercent}%)`, valorMargem.toFixed(2)],
        ['7', 'PV S/ imposto', semImposto.toFixed(2)],
        ['8', `Imposto S/ NF (${impostosPercent}%)`, valorImposto.toFixed(2)],
        ['9', 'PV FINAL R$', precoFinal.toFixed(2)]
      ];

      calculos.forEach((row, idx) => {
        const isLastRow = idx === calculos.length - 1;
        x = margin;
        doc.setFont('Arial', 'normal');
        doc.setFontSize(8);
        
        if (isLastRow) {
          doc.setFont('Arial', 'bold');
          doc.setTextColor(255, 0, 0);
        }

        doc.text(row[0], x + 0.5, y + 2.5);
        doc.rect(x, y, baseColWidth, cellHeight);
        x += baseColWidth;

        doc.text(row[1], x + 0.5, y + 2.5, { maxWidth: baseColWidth * 8 - 2 });
        doc.rect(x, y, baseColWidth * 8, cellHeight);
        x += baseColWidth * 8;

        doc.text(row[2], x + 0.5, y + 2.5);
        doc.rect(x, y, baseColWidth, cellHeight);

        if (isLastRow) {
          doc.setTextColor(0, 0, 0);
        }
        y += cellHeight;
      });

      // ===== RESUMO FINAL =====
      x = margin;
      doc.setFont('Arial', 'bold');
      doc.setFontSize(8);
      doc.text('RESUMO:', x + 0.5, y + 2.5);
      doc.rect(x, y, baseColWidth * 10, cellHeight);
      y += cellHeight;

      x = margin;
      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      doc.text('Qtd. de Itens:', x + 0.5, y + 2.5);
      doc.rect(x, y, baseColWidth * 5, cellHeight);
      x += baseColWidth * 5;
      doc.setFont('Arial', 'bold');
      doc.text(String(totalItens), x + 0.5, y + 2.5);
      doc.rect(x, y, baseColWidth * 5, cellHeight);
      y += cellHeight;

      x = margin;
      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      doc.text('Preço por Item:', x + 0.5, y + 2.5);
      doc.rect(x, y, baseColWidth * 5, cellHeight);
      x += baseColWidth * 5;
      doc.setFont('Arial', 'bold');
      doc.text(`R$ ${precoPorItem.toFixed(2)}`, x + 0.5, y + 2.5);
      doc.rect(x, y, baseColWidth * 5, cellHeight);
      y += cellHeight;

      x = margin;
      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      doc.text('Valor Total:', x + 0.5, y + 2.5);
      doc.rect(x, y, baseColWidth * 5, cellHeight);
      x += baseColWidth * 5;
      doc.setFont('Arial', 'bold');
      doc.setTextColor(255, 0, 0);
      doc.text(`R$ ${precoFinal.toFixed(2)}`, x + 0.5, y + 2.5);
      doc.setTextColor(0, 0, 0);
      doc.rect(x, y, baseColWidth * 5, cellHeight);

      // Download
      const versaoArquivo = formatarVersaoOrcamento(orcamento.versao);
      doc.save(`Orcamento_${orcamento.numeroOrcamento}${versaoArquivo ? `_v${versaoArquivo}` : ''}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF do orçamento');
    }
  };

  const parseDecimal = (value: string) => {
    const s = String(value ?? '').trim();
    if (s === '') return 0;
    // pt-BR formatted numbers use '.' as thousands separator and ',' as decimal
    if (s.includes(',')) {
      const cleaned = s.replace(/\./g, '').replace(',', '.');
      const numeric = parseFloat(cleaned);
      return Number.isFinite(numeric) ? numeric : 0;
    }
    // fallback: remove non-numeric chars except dot and minus
    const cleaned = s.replace(/[^0-9.-]/g, '');
    const numeric = parseFloat(cleaned);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const toMoneyString = (value: number) => value.toFixed(2);

  const formatNumber = (value: number) => Number.isFinite(value) ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
  const formatMoney = (value: number) => `R$ ${formatNumber(value)}`;

  const recalcularMaoDeObraItem = (item: MaoDeObra): MaoDeObra => {
    const total = parseDecimal(item.quantidade) * parseDecimal(item.dias) * parseDecimal(item.custoUnitDia);
    return { ...item, valorTotal: toMoneyString(total) };
  };

  const recalcularMaterialItem = (item: Material): Material => {
    const total = parseDecimal(item.quantidade) * parseDecimal(item.pesoFator) * parseDecimal(item.custoUnit);
    return { ...item, valorTotal: toMoneyString(total) };
  };

  const recalcularTerceirizadoItem = (item: Terceirizado): Terceirizado => {
    const pf = parseDecimal(String(item.pesoFator ?? '').trim());
    const pesoFator = pf <= 0 ? 1 : pf;
    const total = parseDecimal(item.quantidade) * pesoFator * parseDecimal(item.custoUnit);
    return { ...item, valorTotal: toMoneyString(total) };
  };

  const isMaterialRowFilled = (item: Material) => {
    const descricao = String(item.descricao || '').trim();
    const observacao = String(item.observacao || '').trim();
    const isPlaceholderDescricao = descricao === 'Consumível ou material';
    const hasMeaningfulValue =
      (descricao !== '' && !isPlaceholderDescricao) ||
      item.quantidade !== '' ||
      item.custoUnit !== '' ||
      item.pesoFator !== '' ||
      observacao !== '';

    return hasMeaningfulValue;
  };

  const isTerceirizadoRowFilled = (item: Terceirizado) => {
    const descricao = String(item.descricao || '').trim();
    const observacao = String(item.observacao || '').trim();
    const isPlaceholderDescricao = descricao === 'Jateamento / pintura terceirizada';
    return (descricao !== '' && !isPlaceholderDescricao) ||
      item.quantidade !== '' ||
      item.custoUnit !== '' ||
      observacao !== '';
  };

  const isAtividadeRowFilled = (item: Atividade) => {
    const atividade = String(item.atividade || '').trim();
    const observacao = String(item.observacao || '').trim();
    const isPlaceholderAtividade = atividade === 'Levantamento / Inspeção';
    return (atividade !== '' && !isPlaceholderAtividade)
      || item.dias !== ''
      || observacao !== '';
  };

  const updateMaoDeObraItem = (id: string, changes: Partial<MaoDeObra>) => {
    setOrcamentoData(prev => ({
      ...prev,
      maoDeObra: prev.maoDeObra.map(item => item.id === id ? recalcularMaoDeObraItem({ ...item, ...changes }) : item)
    }));
  };

  const updateMaterialItem = (id: string, changes: Partial<Material>) => {
    setOrcamentoData(prev => ({
      ...prev,
      materiais: prev.materiais.map(item => item.id === id ? recalcularMaterialItem({ ...item, ...changes }) : item)
    }));
  };

  const updateTerceirizadoItem = (id: string, changes: Partial<Terceirizado>) => {
    setOrcamentoData(prev => ({
      ...prev,
      terceirizados: prev.terceirizados.map(item => item.id === id ? recalcularTerceirizadoItem({ ...item, ...changes }) : item)
    }));
  };

  const addMaoDeObra = () => {
    setOrcamentoData({
      ...orcamentoData,
      maoDeObra: [...orcamentoData.maoDeObra, { id: Date.now().toString(), funcao: '', quantidade: '', dias: '', custoUnitDia: '', valorTotal: '0.00', observacao: '' }]
    });
  };

  const removeMaoDeObra = (id: string) => {
    setOrcamentoData({
      ...orcamentoData,
      maoDeObra: orcamentoData.maoDeObra.filter(i => i.id !== id)
    });
  };

  const addAtividade = () => {
    setOrcamentoData({
      ...orcamentoData,
      atividades: [...orcamentoData.atividades, { id: Date.now().toString(), atividade: '', dias: '', observacao: '' }]
    });
  };

  const removeAtividade = (id: string) => {
    setOrcamentoData({
      ...orcamentoData,
      atividades: orcamentoData.atividades.filter(i => i.id !== id)
    });
  };

  const addMaterial = () => {
    setOrcamentoData({
      ...orcamentoData,
      materiais: [...orcamentoData.materiais, { id: Date.now().toString(), descricao: '', unidade: '', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '0.00', observacao: '', origemTerceiros: 'Nao' }]
    });
  };

  const removeMaterial = (id: string) => {
    setOrcamentoData({
      ...orcamentoData,
      materiais: orcamentoData.materiais.filter(i => i.id !== id)
    });
  };

  const addTerceirizado = () => {
    setOrcamentoData({
      ...orcamentoData,
      terceirizados: [...orcamentoData.terceirizados, { id: Date.now().toString(), descricao: '', unidade: '', quantidade: '', pesoFator: '1', custoUnit: '', valorTotal: '0.00', observacao: '' }]
    });
  };

  const removeTerceirizado = (id: string) => {
    setOrcamentoData({
      ...orcamentoData,
      terceirizados: orcamentoData.terceirizados.filter(i => i.id !== id)
    });
  };

  // Calcular totais
  const totalMaoDeObra = orcamentoData.maoDeObra.reduce((sum, item) => sum + (parseDecimal(item.valorTotal) || 0), 0);
  const totalMateriais = orcamentoData.materiais.reduce((sum, item) => sum + (parseDecimal(item.valorTotal) || 0), 0);
  const totalTerceirizados = orcamentoData.terceirizados.reduce((sum, item) => sum + (parseDecimal(item.valorTotal) || 0), 0);
  const totalDiasAtividades = orcamentoData.atividades
    .reduce((sum, item) => sum + parseDecimal(item.dias), 0);
  const totalBruto = totalMaoDeObra + totalMateriais + totalTerceirizados;
  const margemPercentual = parseFloat(orcamentoData.margem) || 0;
  const ohPercentual = parseFloat(orcamentoData.oh) || 0;
  const impostosPercentual = parseFloat(orcamentoData.impostos) || 0;
  const margemValor = (totalBruto * margemPercentual) / 100;
  const ohValor = (totalBruto * ohPercentual) / 100;
  const totalSemImposto = totalBruto + margemValor + ohValor;
  const impostoValor = (totalSemImposto * impostosPercentual) / 100;
  const precoFinal = totalSemImposto + impostoValor;

  const inputClass = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelClass = "text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block";
  const tableInputClass = "w-full bg-[#0b1220] border border-white/10 p-2 rounded text-white text-xs outline-none focus:border-amber-500";

  // Função para abrir o documento gerado
  const visualizarDocumento = (filename: string) => {
    const url = getBackendUrl(`visualizar/${filename}/`);
    window.open(url, '_blank');
  };

  return (
    <div className="p-12 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="bg-amber-500 p-3 rounded-lg">
          <DollarSign size={24} className="text-[#0b1220]" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">ORÇAMENTOS</h1>
          <p className="text-white/50 text-xs mt-1">Depar tamento financeiro - Levantamento de Orçamentos</p>
        </div>
      </div>

      {/* PROJETOS À ORÇAR */}
      {!showForm ? (
        <div className="space-y-8">
          {/* SEÇÃO 1: PROJETOS SEM ORÇAMENTO */}
          <div>
            <h2 className="text-2xl font-black text-white uppercase mb-4">Projetos à Orçar</h2>
            
            {projetosAOrcar.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projetosAOrcar.map((obra: any) => {
                  const nomeExibicaoCliente = obra.nomeCliente || obra.nome_cliente || obra.cliente_nome || "Cliente Identificado";

                  const orcamentosExistentesCard = normalizarOrcamentos(obra);
                  const ultimoOrcamento = orcamentosExistentesCard.length > 0 ? orcamentosExistentesCard[orcamentosExistentesCard.length - 1] : null;
                  const ehRascunho = ultimoOrcamento?.status === 'rascunho';
                  const ultimaProposta = Array.isArray(obra.propostas) && obra.propostas.length > 0
                    ? obra.propostas[obra.propostas.length - 1] : null;
                  const propostaRecusada = ultimaProposta?.status === 'recusada' && obra.requerReorcamento;
                  const ehRecusado = ultimoOrcamento?.status === 'recusado' || propostaRecusada;
                  const reorcamentoArquivos = !ehRecusado && (obra.requerReorcamento || ultimoOrcamento?.status === 'pendente_reorcamento');
                  // Versão que será criada no próximo orçamento
                  const proximaVersaoCard = ehRascunho
                    ? labelVersaoOrcamento(ultimoOrcamento?.versao)
                    : labelVersaoOrcamento(proximaVersaoOrcamento(orcamentosExistentesCard));
                  const idProjetoOrc = Array.isArray(obra.propostas) && obra.propostas.length > 0
                    ? extrairIdProjetoDoNumero(obra.propostas[obra.propostas.length - 1].numeroProposta || '')
                    : '';

                  return (
                    <div
                      key={obra.id}
                      className={`bg-[#101f3d] border rounded-2xl p-6 transition-all hover:shadow-lg ${ehRascunho ? 'border-yellow-500/40 hover:border-yellow-400/60 hover:shadow-yellow-900/20' : ehRecusado ? 'border-red-500/30 hover:border-red-400/60 hover:shadow-red-900/20' : 'border-white/10 hover:border-amber-500/30 hover:shadow-amber-900/20'}`}
                    >
                      <div className="space-y-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-black text-white uppercase line-clamp-2">{obra.nome} {idProjetoOrc && <span className="text-cyan-400">• {idProjetoOrc}</span>}</h3>
                          <p className="text-amber-400 text-sm font-bold mt-1">{nomeExibicaoCliente}</p>
                        </div>

                        <div className="bg-[#0b1220] rounded-xl p-4 space-y-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/50">Tipo:</span>
                            <span className="text-white font-bold">{obra.tipo || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Responsável:</span>
                            <span className="text-white font-bold">{obra.responsavelTecnico || obra.solicitante || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Status:</span>
                            {ehRascunho ? (
                              <span className="text-yellow-300 font-bold">
                                {proximaVersaoCard} em edição
                              </span>
                            ) : !ultimoOrcamento ? (
                              <span className="text-blue-300 font-bold">Aguardando orçamento</span>
                            ) : ehRecusado ? (
                              <span className="text-red-400 font-bold">
                                {proximaVersaoCard} — {propostaRecusada ? 'Proposta Recusada' : 'Orçamento Recusado'}
                              </span>
                            ) : reorcamentoArquivos ? (
                              <span className="text-orange-300 font-bold">
                                {proximaVersaoCard} aguardando revisão
                              </span>
                            ) : (
                              <span className="text-blue-300 font-bold">Aguardando orçamento</span>
                            )}
                          </div>
                          {(ultimoOrcamento?.motivoRecusa || ultimaProposta?.motivoRecusaProposta) && ehRecusado && (
                            <div className="pt-2 border-t border-red-500/20 space-y-1">
                              <p className="text-red-400/70 text-[11px] font-black uppercase tracking-widest">Motivo da recusa</p>
                              <p className="text-red-200 text-xs leading-relaxed">
                                {ultimoOrcamento?.motivoRecusa || ultimaProposta?.motivoRecusaProposta}
                              </p>
                            </div>
                          )}
                          {obra.motivoRecusaProposta && (
                            <div className="pt-2 border-t border-white/10 space-y-1">
                              <p className="text-white/50 text-[11px] font-black uppercase tracking-widest">Motivo da recusa da proposta</p>
                              <p className="text-amber-200 text-xs leading-relaxed">{obra.motivoRecusaProposta}</p>
                            </div>
                          )}
                        </div>

                        {(ehRecusado || reorcamentoArquivos) ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSelectObra(obra)}
                              className="flex-1 py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-[#0b1220] shadow-lg shadow-amber-900/30"
                            >
                              {ehRascunho ? 'Continuar Rascunho' : ehRecusado ? 'Refazer Orçamento' : 'Fazer Orçamento'}
                            </button>
                            <button
                              onClick={() => handleArquivarNegocio(obra)}
                              className="px-4 py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 hover:border-red-500/40 hover:text-red-400"
                              title="Arquivar negócio → move para Finalizados"
                            >
                              Arquivar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSelectObra(obra)}
                            className={`w-full py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg ${ehRascunho ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-[#0b1220] shadow-yellow-900/30' : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0b1220] shadow-amber-900/30'}`}
                          >
                            {ehRascunho ? 'Continuar Rascunho' : 'Fazer Orçamento'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#101f3d] p-12 rounded-2xl border border-white/5 text-center py-16">
                <DollarSign size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/40 text-sm">Nenhum projeto aguardando orçamento no momento</p>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: AGUARDANDO APROVAÇÃO */}
          {projetosAguardandoAprovacao.length > 0 && (
            <div className="border-t border-white/10 pt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-8 bg-blue-500 rounded-full" />
                <h2 className="text-2xl font-black text-white uppercase">Aguardando Aprovação</h2>
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-black">
                  {projetosAguardandoAprovacao.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projetosAguardandoAprovacao.map((obra: any) => {
                  const orcamentos = normalizarOrcamentos(obra);
                  const ultimoOrcamento = orcamentos[orcamentos.length - 1];
                  const versao = labelVersaoOrcamento(ultimoOrcamento?.versao);
                  const precoFinal = Number(ultimoOrcamento?.valores?.precoFinal ?? 0);
                  const nomeCliente = obra.nomeCliente || obra.nome_cliente || obra.cliente_nome || 'Cliente';

                  return (
                    <div
                      key={obra.id}
                      className="bg-[#101f3d] border border-blue-500/30 rounded-2xl p-6 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-900/20 transition-all"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-black text-white uppercase line-clamp-2">{obra.nome}</h3>
                            <p className="text-amber-400 text-sm font-bold mt-1">{nomeCliente}</p>
                          </div>
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-black whitespace-nowrap">
                            {versao}
                          </span>
                        </div>

                        <div className="bg-[#0b1220] rounded-xl p-4 space-y-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/50">Responsável:</span>
                            <span className="text-white font-bold">{obra.responsavelTecnico || obra.solicitante || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Valor Total:</span>
                            <span className="text-emerald-400 font-black">R$ {precoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Enviado em:</span>
                            <span className="text-white font-bold text-xs">
                              {ultimoOrcamento?.dataCriacao ? new Date(ultimoOrcamento.dataCriacao).toLocaleDateString('pt-BR') : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-white/50">Status:</span>
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[11px] font-black uppercase tracking-widest">
                              Aguardando Aprovação
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadOrcamentoPDF(ultimoOrcamento, obra)}
                            title="Download PDF"
                            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => handleRecusarOrcamento(obra)}
                            className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                          >
                            Recusar
                          </button>
                          <button
                            onClick={() => handleAprovarOrcamento(obra)}
                            className="flex-1 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                          >
                            Aprovar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO 3: HISTÓRICO DE ORÇAMENTOS */}
          {obrasComOrcamentos.length > 0 && (
            <div className="border-t border-white/10 pt-8">
              <h2 className="text-2xl font-black text-white uppercase mb-4">Histórico de Orçamentos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {obrasComOrcamentos.map((obra: any) => {
                  const cliente = listaClientesOrc.find((c: any) => String(c.id) === String(obra.clienteId));
                  const orcamentos = normalizarOrcamentos(obra);
                  const ultimoOrcamento = orcamentos[orcamentos.length - 1];
                  const precoFinalHistorico = Number(ultimoOrcamento?.valores?.precoFinal ?? 0);
                  const podeNovoOrcamento = isOrcamentoEditavel(obra);
                  const idProjetoHistorico = Array.isArray(obra.propostas) && obra.propostas.length > 0
                    ? extrairIdProjetoDoNumero(obra.propostas[obra.propostas.length - 1].numeroProposta || '')
                    : '';
                  const versaoAtiva = labelVersaoOrcamento(ultimoOrcamento.versao);
                  const temRevisoes = orcamentos.length > 1;

                  return (
                    <div
                      key={obra.id}
                      className="bg-[#101f3d] border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-900/20 transition-all"
                    >
                      <div className="space-y-4">
                        {/* Cabeçalho */}
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-black text-white uppercase line-clamp-2">
                              {obra.nome} {idProjetoHistorico && <span className="text-cyan-400">• {idProjetoHistorico}</span>}
                            </h3>
                            <p className="text-amber-400 text-sm font-bold mt-1">{cliente?.razaoSocial || 'Cliente Desconhecido'}</p>
                          </div>
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-black whitespace-nowrap">
                            {versaoAtiva}
                          </span>
                        </div>

                        {/* Dados da versão ativa */}
                        <div className="bg-[#0b1220] rounded-xl p-4 space-y-2.5 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-white/50">Versão ativa:</span>
                            <span className="text-emerald-400 font-black">{versaoAtiva}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Preço Final:</span>
                            <span className="text-white font-bold">R$ {precoFinalHistorico.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Criado em:</span>
                            <span className="text-white font-bold text-xs">
                              {ultimoOrcamento.dataCriacao ? new Date(ultimoOrcamento.dataCriacao).toLocaleDateString('pt-BR') : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Histórico de versões (quando há mais de uma) */}
                        {temRevisoes && (
                          <div className="bg-[#0b1220] rounded-xl p-3">
                            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">
                              Histórico de Revisões ({orcamentos.length} versões)
                            </p>
                            <div className="space-y-1.5">
                              {orcamentos.map((orc: any, idx: number) => {
                                const isAtivo = idx === orcamentos.length - 1;
                                const versao = labelVersaoOrcamento(orc.versao);
                                const preco = Number(orc.valores?.precoFinal ?? 0);
                                const statusLabel =
                                  orc.status === 'recusado' ? 'Recusado' :
                                  orc.status === 'pendente' ? 'Ativo' :
                                  orc.status === 'rascunho' ? 'Rascunho' : orc.status;
                                const statusClass =
                                  orc.status === 'recusado' ? 'bg-red-500/20 text-red-400' :
                                  orc.status === 'pendente' ? 'bg-emerald-500/20 text-emerald-400' :
                                  'bg-white/10 text-white/50';
                                return (
                                  <div key={idx} className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 ${isAtivo ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}`}>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-black text-sm ${isAtivo ? 'text-emerald-400' : 'text-white/40'}`}>
                                        v{versao}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${statusClass}`}>
                                        {statusLabel}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold ${isAtivo ? 'text-white' : 'text-white/40'}`}>
                                        R$ {preco.toFixed(2)}
                                      </span>
                                      <button
                                        onClick={() => handleDownloadOrcamentoPDF(orc, obra)}
                                        title={`Download v${versao}`}
                                        className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400/60 hover:text-emerald-300 transition"
                                      >
                                        <Download size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Download da versão ativa (quando há apenas uma versão) */}
                        {!temRevisoes && (
                          <button
                            onClick={() => handleDownloadOrcamentoPDF(ultimoOrcamento, obra)}
                            className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 py-2 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            <Download size={14} /> Download Orçamento
                          </button>
                        )}

                        <button
                          onClick={() => setDetalhesModal({ obra, orc: ultimoOrcamento })}
                          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white py-2.5 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Eye size={14} /> Detalhes
                        </button>

                        {podeNovoOrcamento ? (
                          <button
                            onClick={() => handleSelectObra(obra)}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                          >
                            Novo Orçamento
                          </button>
                        ) : (
                          <div className="w-full bg-white/5 border border-white/10 text-white/60 py-3 rounded-lg font-black uppercase text-xs tracking-widest text-center">
                            Orçamento Imutável
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        // FORMULÁRIO DE LEVANTAMENTO DE ORÇAMENTO
        <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-end">
            <button onClick={fecharOrcamentoComoX} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
              <X size={24} className="text-white/60" />
            </button>
          </div>

          {/* SECTION 1: LEVANTAMENTO DE ORÇAMENTO */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                Levantamento de Orçamento: <span className="text-amber-400">{selectedObra?.nome}</span>
              </h2>
              {/* EXIBE O NOME DO CLIENTE LOGO ABAIXO DO TÍTULO */}
              <p className="text-amber-500/80 font-bold text-sm uppercase tracking-widest mt-1">
                Cliente: {selectedObra?.nomeCliente || "Não identificado"}
              </p>
            </div>

            {/* Dados do Negócio */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className={labelClass}>Cliente</label>
                <input type="text" className={inputClass} disabled value={selectedObra?.nomeCliente || ''} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Negócio</label>
                <input type="text" className={inputClass} disabled value={selectedObra?.nome || ''} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Solicitante <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  className={inputClass}
                  value={orcamentoData.solicitante}
                  onChange={e => setOrcamentoData({...orcamentoData, solicitante: e.target.value})}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Nº Orçamento <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  className={inputClass}
                  value={orcamentoData.numeroOrcamento}
                  onChange={e => setOrcamentoData({...orcamentoData, numeroOrcamento: e.target.value})}
                />
              </div>
            </div>

            {selectedObra?.motivoRecusaProposta && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                <p className="text-red-300 text-xs font-black uppercase tracking-widest">Recusa da proposta anterior</p>
                <p className="text-white text-sm">{selectedObra.motivoRecusaProposta}</p>
                <p className="text-white/70 text-xs">
                  Documentos alterados/adicionados: {selectedObra.houveAlteracaoDocumentosRecusa ? 'Sim' : 'Não'}
                </p>
              </div>
            )}

            {/* Campos adicionais: equipamento, supervisor e centro de custo (auto-preenchidos via OS) */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className={labelClass}>Equipamento</label>
                <input
                  type="text"
                  className={inputClass}
                  value={orcamentoData.equipamento || ''}
                  onChange={e => setOrcamentoData({...orcamentoData, equipamento: e.target.value})}
                  placeholder="Ex: Plataforma"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Superv./Encarreg.</label>
                <input
                  type="text"
                  className={inputClass}
                  value={orcamentoData.supervisor || ''}
                  onChange={e => setOrcamentoData({...orcamentoData, supervisor: e.target.value})}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Centro de Custo (CC)</label>
                <input
                  type="text"
                  className={inputClass}
                  value={orcamentoData.centroCusto || ''}
                  onChange={e => setOrcamentoData({...orcamentoData, centroCusto: e.target.value})}
                  placeholder="Centro de Custo"
                />
              </div>
            </div>

            {/* Escopo e Documentos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Escopo do Orçamento <span className="text-red-400">*</span></label>
                <textarea 
                  className={`${inputClass} h-24 resize-none`}
                  value={orcamentoData.escopoOrcamento}
                  onChange={e => setOrcamentoData({...orcamentoData, escopoOrcamento: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Documentos de Referência</label>
                <textarea 
                  className={`${inputClass} h-24 resize-none`}
                  value={orcamentoData.documentosReferencia}
                  onChange={e => setOrcamentoData({...orcamentoData, documentosReferencia: e.target.value})}
                />
              </div>
            </div>

            <div className="mt-6 bg-[#101f3d] rounded-xl border border-white/10 p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-black uppercase text-sm">Dados dos Serviços do Negócio</h3>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-black">
                  {orcamentoData.dadosServicos.length} serviço(s)
                </span>
              </div>

              {orcamentoData.dadosServicos.length > 0 ? (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {orcamentoData.dadosServicos.map((servico) => (
                    <div key={servico.id} className="bg-[#0b1220] border border-white/10 rounded-lg p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-black">Serviço {servico.ordem}</p>
                        <span className="text-amber-400 font-bold">{servico.tipo || 'Sem tipo'}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-white/70">
                        <p>Categoria: <span className="text-white">{servico.categoria || '−'}</span></p>
                        <p>Local: <span className="text-white">{servico.localExecucao || '−'}</span></p>
                        <p>Porto: <span className="text-white">{servico.porto || '−'}</span></p>
                        <p>Embarcação: <span className="text-white">{servico.embarcacao || '−'}</span></p>
                        <p>Prazo: <span className="text-white">{servico.prazoDes || '−'}</span></p>
                      </div>
                      <div>
                        <p className="text-white/50 mb-1">Descrição</p>
                        <p className="text-white whitespace-pre-wrap">{servico.descricao || '−'}</p>
                      </div>
                      {servico.observacoes && (
                        <div>
                          <p className="text-white/50 mb-1">Observações</p>
                          <p className="text-white/80 whitespace-pre-wrap">{servico.observacoes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#0b1220] border border-dashed border-white/15 rounded-lg p-4 text-center">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Este negócio não possui serviços cadastrados</p>
                </div>
              )}
            </div>

            <div className="mt-6 bg-[#101f3d] rounded-xl border border-white/10 p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-black uppercase text-sm">Arquivos Anexados no Negócio</h3>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-black">
                  {(selectedObra?.documentosNegocio || []).length} arquivo(s)
                </span>
              </div>

              {(selectedObra?.documentosNegocio || []).length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(selectedObra?.documentosNegocio || []).map((documento: any) => (
                    <div key={documento.id} className="bg-[#0b1220] border border-white/10 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{documento.nome}</p>
                        <p className="text-white/50 text-xs mt-1">
                          {(documento.tipo || 'arquivo').toUpperCase()} • {((documento.tamanho || 0) / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => abrirDocumentoNegocio(documento)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1"
                        >
                          <Eye size={13} /> Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => baixarDocumentoNegocio(documento)}
                          className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1"
                        >
                          <Download size={13} /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#0b1220] border border-dashed border-white/15 rounded-lg p-4 text-center">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Sem anexos no negócio</p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: MÃO DE OBRA */}
          <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase">Mão de Obra</h3>
                <p className="text-white/50 text-xs mt-1">Levante as funções, quantidade, dias, custo unitário por dia e total</p>
              </div>
              <button 
                onClick={addMaoDeObra}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition"
              >
                <Plus size={16} className="inline mr-2" /> Adicionar Função
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-4 py-3 text-left text-white font-black">FUNÇÃO</th>
                    <th className="px-4 py-3 text-left text-white font-black">QUANTIDADE</th>
                    <th className="px-4 py-3 text-left text-white font-black">DIAS</th>
                    <th className="px-4 py-3 text-left text-white font-black">CUSTO UNIT./DIA</th>
                    <th className="px-4 py-3 text-left text-white font-black">VALOR TOTAL</th>
                    <th className="px-4 py-3 text-left text-white font-black">OBSERVAÇÃO</th>
                    <th className="px-4 py-3 text-center text-white font-black w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentoData.maoDeObra.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.funcao} onChange={e => updateMaoDeObraItem(item.id, { funcao: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.quantidade} onChange={e => updateMaoDeObraItem(item.id, { quantidade: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.dias} onChange={e => updateMaoDeObraItem(item.id, { dias: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.custoUnitDia} onChange={e => updateMaoDeObraItem(item.id, { custoUnitDia: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={`${tableInputClass} bg-white/5 cursor-not-allowed`} value={item.valorTotal} readOnly disabled /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.observacao} onChange={e => updateMaoDeObraItem(item.id, { observacao: e.target.value })} /></td>
                      <td className="px-4 py-3 text-center">
                        {orcamentoData.maoDeObra.length > 1 && (
                          <button onClick={() => removeMaoDeObra(item.id)} className="p-1 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
              <div className="bg-[#0b1220] border border-white/10 rounded-lg px-4 py-2.5">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Subtotal Mão de Obra</p>
                <p className="text-amber-400 font-black text-lg text-right">R$ {totalMaoDeObra.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* SECTION 3: CONSUMÍVEIS E MATERIAIS */}
          <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase">Consumíveis e Materiais</h3>
                <p className="text-white/50 text-xs mt-1">Itens em uma única aba com indicação de terceiros</p>
              </div>
              <button 
                onClick={addMaterial}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition"
              >
                <Plus size={16} className="inline mr-2" /> Adicionar Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-4 py-3 text-left text-white font-black">DESCRIÇÃO</th>
                    <th className="px-4 py-3 text-left text-white font-black">UNIDADE</th>
                    <th className="px-4 py-3 text-left text-white font-black">QUANTIDADE</th>
                    <th className="px-4 py-3 text-left text-white font-black">PESO / FATOR</th>
                    <th className="px-4 py-3 text-left text-white font-black">CUSTO UNIT.</th>
                    <th className="px-4 py-3 text-left text-white font-black">VALOR TOTAL</th>
                    <th className="px-4 py-3 text-left text-white font-black">TERCEIROS?</th>
                    <th className="px-4 py-3 text-left text-white font-black">OBSERVAÇÃO</th>
                    <th className="px-4 py-3 text-center text-white font-black w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentoData.materiais.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.descricao} onChange={e => updateMaterialItem(item.id, { descricao: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.unidade} onChange={e => updateMaterialItem(item.id, { unidade: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.quantidade} onChange={e => updateMaterialItem(item.id, { quantidade: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.pesoFator} onChange={e => updateMaterialItem(item.id, { pesoFator: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.custoUnit} onChange={e => updateMaterialItem(item.id, { custoUnit: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={`${tableInputClass} bg-white/5 cursor-not-allowed`} value={item.valorTotal} readOnly disabled /></td>
                      <td className="px-4 py-3">
                        <select className={tableInputClass} value={item.origemTerceiros || 'Nao'} onChange={e => updateMaterialItem(item.id, { origemTerceiros: e.target.value as 'Sim' | 'Nao' })}>
                          <option value="Nao">Não</option>
                          <option value="Sim">Sim</option>
                        </select>
                      </td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.observacao} onChange={e => updateMaterialItem(item.id, { observacao: e.target.value })} /></td>
                      <td className="px-4 py-3 text-center">
                        {orcamentoData.materiais.length > 1 && (
                          <button onClick={() => removeMaterial(item.id)} className="p-1 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
              <div className="bg-[#0b1220] border border-white/10 rounded-lg px-4 py-2.5">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Subtotal Consumíveis + Materiais</p>
                <p className="text-amber-400 font-black text-lg text-right">R$ {totalMateriais.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* SECTION 4: SERVIÇOS TERCEIRIZADOS */}
          <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase">Serviços Terceirizados</h3>
                <p className="text-white/50 text-xs mt-1">Levante os custo de terceiros necessários para a execução</p>
              </div>
              <button 
                onClick={addTerceirizado}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition"
              >
                <Plus size={16} className="inline mr-2" /> Adicionar Terceirizado
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-4 py-3 text-left text-white font-black">DESCRIÇÃO</th>
                    <th className="px-4 py-3 text-left text-white font-black">UNIDADE</th>
                    <th className="px-4 py-3 text-left text-white font-black">QUANTIDADE</th>
                    <th className="px-4 py-3 text-left text-white font-black">PESO / FATOR</th>
                    <th className="px-4 py-3 text-left text-white font-black">CUSTO UNIT.</th>
                    <th className="px-4 py-3 text-left text-white font-black">VALOR TOTAL</th>
                    <th className="px-4 py-3 text-left text-white font-black">OBSERVAÇÃO</th>
                    <th className="px-4 py-3 text-center text-white font-black w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentoData.terceirizados.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.descricao} onChange={e => updateTerceirizadoItem(item.id, { descricao: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.unidade} onChange={e => updateTerceirizadoItem(item.id, { unidade: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.quantidade} onChange={e => updateTerceirizadoItem(item.id, { quantidade: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.pesoFator} onChange={e => updateTerceirizadoItem(item.id, { pesoFator: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.custoUnit} onChange={e => updateTerceirizadoItem(item.id, { custoUnit: e.target.value })} /></td>
                      <td className="px-4 py-3"><input type="number" className={`${tableInputClass} bg-white/5 cursor-not-allowed`} value={item.valorTotal} readOnly disabled /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.observacao} onChange={e => updateTerceirizadoItem(item.id, { observacao: e.target.value })} /></td>
                      <td className="px-4 py-3 text-center">
                        {orcamentoData.terceirizados.length > 1 && (
                          <button onClick={() => removeTerceirizado(item.id)} className="p-1 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
              <div className="bg-[#0b1220] border border-white/10 rounded-lg px-4 py-2.5">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Subtotal Serviços Terceirizados</p>
                <p className="text-amber-400 font-black text-lg text-right">R$ {totalTerceirizados.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* SECTION 5: ATIVIDADES PREVISTAS */}
          <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase">Atividades Previstas</h3>
                <p className="text-white/50 text-xs mt-1">Lista das etapas do serviço para base do levantamento do orçamento</p>
              </div>
              <button 
                onClick={addAtividade}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition"
              >
                <Plus size={16} className="inline mr-2" /> Adicionar Atividade
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-4 py-3 text-left text-white font-black">ATIVIDADE</th>
                    <th className="px-4 py-3 text-left text-white font-black">DIAS</th>
                    <th className="px-4 py-3 text-left text-white font-black">OBSERVAÇÃO</th>
                    <th className="px-4 py-3 text-center text-white font-black w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentoData.atividades.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.atividade} onChange={e => {
                        const updated = orcamentoData.atividades.map(i => i.id === item.id ? {...i, atividade: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, atividades: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.dias} onChange={e => {
                        const updated = orcamentoData.atividades.map(i => i.id === item.id ? {...i, dias: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, atividades: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.observacao} onChange={e => {
                        const updated = orcamentoData.atividades.map(i => i.id === item.id ? {...i, observacao: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, atividades: updated});
                      }} /></td>
                      <td className="px-4 py-3 text-center">
                        {orcamentoData.atividades.length > 1 && (
                          <button onClick={() => removeAtividade(item.id)} className="p-1 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
              <div className="bg-[#0b1220] border border-white/10 rounded-lg px-4 py-2.5">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Total de dias previstos</p>
                <p className="text-amber-400 font-black text-lg text-right">{Number.isInteger(totalDiasAtividades) ? totalDiasAtividades : totalDiasAtividades.toFixed(2)} dias</p>
              </div>
            </div>
          </div>

          {/* SECTION 6: OBSERVAÇÕES */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-8">
            <h3 className="text-xl font-black text-white uppercase mb-4 flex items-center gap-2">
              <FileText size={20} /> Observações para o Setor de Orçamento
            </h3>
            <textarea 
              className={`${inputClass} h-32 resize-none`}
              value={orcamentoData.observacoes}
              onChange={e => setOrcamentoData({...orcamentoData, observacoes: e.target.value})}
              placeholder="Campo livre para informar premissas, riscos, necessidades específicas e pontos de atenção."
            />
          </div>

          {/* SECTION 7: RESUMO FINANCEIRO */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-2xl border border-emerald-500/20 p-8">
            <h3 className="text-xl font-black text-white uppercase mb-6 flex items-center gap-2">
              <DollarSign size={20} /> Resumo Financeiro do Orçamento
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className={labelClass}>Margem (%) <span className="text-red-400">*</span></label>
                <input 
                  type="number" 
                  className={inputClass}
                  value={orcamentoData.margem}
                  onChange={e => setOrcamentoData({...orcamentoData, margem: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>O.H (%) <span className="text-red-400">*</span></label>
                <input 
                  type="number" 
                  className={inputClass}
                  value={orcamentoData.oh}
                  onChange={e => setOrcamentoData({...orcamentoData, oh: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Impostos (%) <span className="text-red-400">*</span></label>
                <input 
                  type="number" 
                  className={inputClass}
                  value={orcamentoData.impostos}
                  onChange={e => setOrcamentoData({...orcamentoData, impostos: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">TOTAL MÃO DE OBRA</p>
                <p className="text-white font-black text-lg">R$ {totalMaoDeObra.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">TOTAL CONSUMÍVEIS + MATERIAIS</p>
                <p className="text-white font-black text-lg">R$ {totalMateriais.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">TOTAL TERCEIRIZADOS</p>
                <p className="text-white font-black text-lg">R$ {totalTerceirizados.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">TOTAL BRUTO</p>
                <p className="text-white font-black text-lg">R$ {totalBruto.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">TOTAL S/ IMPOSTO</p>
                <p className="text-white font-black text-lg">R$ {totalSemImposto.toFixed(2)}</p>
                <p className="text-white/40 text-[10px] mt-1">Margem: R$ {margemValor.toFixed(2)} + O.H: R$ {ohValor.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">IMPOSTO ({impostosPercentual}%)</p>
                <p className="text-white font-black text-lg">R$ {impostoValor.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-amber-500/30 shadow-lg shadow-amber-500/10">
                <p className="text-amber-400 text-xs font-black mb-2 uppercase">TOTAL C/ IMPOSTO</p>
                <p className="text-amber-400 font-black text-2xl">R$ {precoFinal.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className={`rounded-lg p-4 border space-y-2.5 ${Number(orcamentoData.quantidadeItensProduzidos) < 1 ? 'bg-red-500/5 border-red-500/30' : 'bg-[#101f3d] border-white/5'}`}>
                <label className={labelClass}>
                  Quantidade de itens produzidos <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={`${inputClass} ${Number(orcamentoData.quantidadeItensProduzidos) < 1 ? 'border-red-500/50' : ''}`}
                  value={orcamentoData.quantidadeItensProduzidos}
                  onChange={e => setOrcamentoData({ ...orcamentoData, quantidadeItensProduzidos: e.target.value })}
                  placeholder="Obrigatório para concluir"
                />
                {Number(orcamentoData.quantidadeItensProduzidos) < 1 && (
                  <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">
                    Obrigatório para concluir o orçamento
                  </p>
                )}
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5 space-y-2.5">
                <p className={labelClass}>Valor por unidade</p>
                <div className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-4 py-3 text-white font-black text-lg">
                  R$ {(Number(orcamentoData.quantidadeItensProduzidos) > 0 ? precoFinal / Number(orcamentoData.quantidadeItensProduzidos) : 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 8: BOTÕES DE AÇÃO */}
          <div className="flex gap-4">
            <button 
              onClick={handleSalvarOrcamentoClick}
              disabled={saving}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : 'Salvar Orçamento'}
            </button>
            <button
              onClick={handleConcluirOrcamento}
              disabled={saving || Number(orcamentoData.quantidadeItensProduzidos) < 1 || orcamentoData.atividades.filter(i => i.atividade?.trim()).length === 0}
              title={Number(orcamentoData.quantidadeItensProduzidos) < 1 ? 'Informe a quantidade de itens produzidos para concluir' : orcamentoData.atividades.filter(i => i.atividade?.trim()).length === 0 ? 'Preencha pelo menos uma atividade prevista para concluir' : ''}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-[#0b1220] py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:from-amber-500 disabled:to-orange-500"
            >
              <Lock size={16} className="inline mr-2" /> Concluir Orçamento
            </button>
          </div>

          <div className="text-center mt-4">
            <p className="text-white/50 text-xs">
              <span className="text-red-400">*</span> Campos obrigatórios
            </p>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO ORÇAMENTO */}
      {detalhesModal && (() => {
        const { obra, orc } = detalhesModal;
        const d = orc.data || {};
        const v = orc.valores || {};
        const pd = (val: any) => Number(val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const mdo: any[] = (d.maoDeObra || []).filter((i: any) => i.funcao?.trim());
        const mats: any[] = (d.materiais || []).filter((i: any) => i.descricao?.trim());
        const ters: any[] = (d.terceirizados || []).filter((i: any) => i.descricao?.trim());
        const ativs: any[] = (d.atividades || []).filter((i: any) => i.atividade?.trim());
        const totalDiasDetalhes = [
          ...(d.atividades || []).map((i: any) => Number(i.duracao || i.dias || 0)),
          ...(d.maoDeObra || []).map((i: any) => Number(i.dias || 0)),
        ].reduce((a, b) => a + b, 0);
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="bg-[#0d1b35] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl">
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">{obra.nome}</h2>
                  <p className="text-amber-400 font-bold text-sm mt-1">{obra.nomeCliente || '—'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-black">{labelVersaoOrcamento(orc.versao)}</span>
                    <span className="text-white/50 text-xs">{orc.numeroOrcamento || '—'}</span>
                    <span className="text-white/50 text-xs">{orc.dataCriacao ? new Date(orc.dataCriacao).toLocaleDateString('pt-BR') : '—'}</span>
                  </div>
                </div>
                <button onClick={() => setDetalhesModal(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition">
                  <X size={20} className="text-white/60" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Resumo Financeiro */}
                <div className="bg-[#101f3d] rounded-xl p-5 border border-white/5">
                  <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Resumo Financeiro</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Mão de Obra', val: v.totalMaoDeObra ?? v.totalMDO },
                      { label: 'Materiais', val: v.totalMateriais },
                      { label: 'Terceirizados', val: v.totalTerceirizados },
                      { label: 'Total Bruto', val: v.totalBruto ?? v.subtotal },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-[#0b1220] rounded-lg p-3">
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{label}</p>
                        <p className="text-white font-black mt-1">R$ {pd(val)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div className="bg-[#0b1220] rounded-lg p-3">
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Margem {v.margem || d.margem}%</p>
                      <p className="text-amber-400 font-black mt-1">+ R$ {pd(v.valorMargem)}</p>
                    </div>
                    <div className="bg-[#0b1220] rounded-lg p-3">
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">OH {v.oh || d.oh}%</p>
                      <p className="text-amber-400 font-black mt-1">+ R$ {pd(v.valorOH)}</p>
                    </div>
                    <div className="bg-[#0b1220] rounded-lg p-3">
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Impostos {v.impostos || d.impostos}%</p>
                      <p className="text-amber-400 font-black mt-1">+ R$ {pd(v.valorImpostos)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <div>
                      <p className="text-white/50 text-xs">Preço Final</p>
                      <p className="text-emerald-400 font-black text-2xl">R$ {pd(v.precoFinal)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/50 text-xs">Dias Previstos</p>
                      <p className="text-amber-400 font-black text-2xl">{totalDiasDetalhes > 0 ? totalDiasDetalhes : '—'}</p>
                    </div>
                    {Number(v.quantidadeItensProduzidos) > 0 && (
                      <div className="text-right">
                        <p className="text-white/50 text-xs">{v.quantidadeItensProduzidos} unid. × R$ {pd(v.valorPorUnidade)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mão de Obra */}
                {mdo.length > 0 && (
                  <div>
                    <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">Mão de Obra</h3>
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-xs">
                        <thead className="bg-[#101f3d]">
                          <tr>{['Função','Qtd','Dias','Custo/Dia','Total','Obs'].map(h => <th key={h} className="px-3 py-2 text-left text-white/40 font-black uppercase tracking-widest">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {mdo.map((i: any, idx: number) => (
                            <tr key={idx} className="bg-[#0b1220]">
                              <td className="px-3 py-2 text-white font-bold">{i.funcao}</td>
                              <td className="px-3 py-2 text-white/70">{i.quantidade ?? i.qnt}</td>
                              <td className="px-3 py-2 text-white/70">{i.dias}</td>
                              <td className="px-3 py-2 text-white/70">R$ {pd(i.custoUnitDia ?? i.custo_unit_dia)}</td>
                              <td className="px-3 py-2 text-emerald-400 font-bold">R$ {pd(i.valorTotal)}</td>
                              <td className="px-3 py-2 text-white/40">{i.observacao || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Materiais */}
                {mats.length > 0 && (
                  <div>
                    <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">Materiais / Consumíveis</h3>
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-xs">
                        <thead className="bg-[#101f3d]">
                          <tr>{['Item','Un','Qtd','Peso','Custo Un.','Total','Obs'].map(h => <th key={h} className="px-3 py-2 text-left text-white/40 font-black uppercase tracking-widest">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {mats.map((i: any, idx: number) => (
                            <tr key={idx} className="bg-[#0b1220]">
                              <td className="px-3 py-2 text-white font-bold">{i.descricao || i.item}</td>
                              <td className="px-3 py-2 text-white/70">{i.unidade}</td>
                              <td className="px-3 py-2 text-white/70">{i.quantidade ?? i.qnt}</td>
                              <td className="px-3 py-2 text-white/70">{i.pesoFator ?? i.peso}</td>
                              <td className="px-3 py-2 text-white/70">R$ {pd(i.custoUnit ?? i.custo_unit)}</td>
                              <td className="px-3 py-2 text-emerald-400 font-bold">R$ {pd(i.valorTotal)}</td>
                              <td className="px-3 py-2 text-white/40">{i.observacao || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Terceirizados */}
                {ters.length > 0 && (
                  <div>
                    <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">Serviços Terceirizados</h3>
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-xs">
                        <thead className="bg-[#101f3d]">
                          <tr>{['Descrição','Un','Qtd','Valor Un.','Total','Obs'].map(h => <th key={h} className="px-3 py-2 text-left text-white/40 font-black uppercase tracking-widest">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {ters.map((i: any, idx: number) => (
                            <tr key={idx} className="bg-[#0b1220]">
                              <td className="px-3 py-2 text-white font-bold">{i.descricao}</td>
                              <td className="px-3 py-2 text-white/70">{i.unidade}</td>
                              <td className="px-3 py-2 text-white/70">{i.quantidade ?? i.qnt}</td>
                              <td className="px-3 py-2 text-white/70">R$ {pd(i.custoUnit ?? i.valor_unit)}</td>
                              <td className="px-3 py-2 text-emerald-400 font-bold">R$ {pd(i.valorTotal)}</td>
                              <td className="px-3 py-2 text-white/40">{i.observacao || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Atividades */}
                {ativs.length > 0 && (
                  <div>
                    <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">Atividades Previstas</h3>
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-xs">
                        <thead className="bg-[#101f3d]">
                          <tr>{['Atividade','Dias','Obs'].map(h => <th key={h} className="px-3 py-2 text-left text-white/40 font-black uppercase tracking-widest">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {ativs.map((i: any, idx: number) => (
                            <tr key={idx} className="bg-[#0b1220]">
                              <td className="px-3 py-2 text-white font-bold">{i.atividade}</td>
                              <td className="px-3 py-2 text-amber-400 font-bold">{i.dias ?? i.duracao}</td>
                              <td className="px-3 py-2 text-white/40">{i.observacao || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Observações */}
                {(d.observacoes || orc.observacoes) && (
                  <div className="bg-[#101f3d] rounded-xl p-4 border border-white/5">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Observações</p>
                    <p className="text-white/80 text-sm">{d.observacoes || orc.observacoes}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleDownloadOrcamentoPDF(orc, obra)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                  >
                    <Download size={14} /> Download PDF
                  </button>
                  <button
                    onClick={() => setDetalhesModal(null)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

