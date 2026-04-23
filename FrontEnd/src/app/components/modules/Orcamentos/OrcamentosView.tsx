import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Plus, X, DollarSign, FileText, Trash2, Lock, Eye, Download } from 'lucide-react';

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

export function OrcamentosView({ searchQuery }: OrcamentosViewProps) {
  const { obras, clientes, saveEntity } = useErp();
  const listaClientes = Array.isArray(clientes) ? clientes : [];
  const [showForm, setShowForm] = useState(false);
  const [selectedObra, setSelectedObra] = useState<any>(null);

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

  const proximaVersaoOrcamento = (orcamentos: any[] = []) => {
    if (orcamentos.length === 0) return 'A';

    const ultimoIndice = orcamentos.reduce((maior, orcamento) => {
      const indice = versaoAlfabeticaToIndex(formatarVersaoOrcamento(orcamento?.versao));
      return Math.max(maior, indice);
    }, -1);

    return indexToVersaoAlfabetica(ultimoIndice + 1);
  };

  const getInitialOrcamentoData = () => ({
    numeroOrcamento: `BM-${new Date().getFullYear()}-001`,
    solicitante: '',
    responsavelComercial: '',
    escopoOrcamento: '',
    documentosReferencia: '',
    dadosServicos: [] as ServicoOrcamento[],
    maoDeObra: [{ id: '1', funcao: 'Encarregado', quantidade: '', dias: '', custoUnitDia: '', valorTotal: '0.00', observacao: '' }],
    atividades: [{ id: '1', atividade: 'Levantamento / Inspeção', dias: '', observacao: '' }],
    materiais: [{ id: '1', descricao: 'Consumível ou material', unidade: 'un', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '0.00', observacao: '', origemTerceiros: 'Nao' as const }] as Material[],
    terceirizados: [{ id: '1', descricao: 'Jateamento / pintura terceirizada', unidade: 'serv', quantidade: '', pesoFator: '1', custoUnit: '', valorTotal: '0.00', observacao: '' }],
    observacoes: '',
    margem: '15',
    oh: '5',
    impostos: '18',
    quantidadeItensProduzidos: ''
  });

  const [orcamentoData, setOrcamentoData] = useState(getInitialOrcamentoData);

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
        versao: 'A',
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

  // Topo: apenas negócios aguardando orçamento (sem orçamento ou com última versão recusada).
  const projetosAOrcar = (obras || [])
    .filter((obra: any) => {
      if (obra.categoria !== 'Planejamento') return false;
      const ultimoOrcamento = obterUltimoOrcamento(obra);
      return !ultimoOrcamento
        || ultimoOrcamento.status === 'recusado'
        || ultimoOrcamento.status === 'pendente_reorcamento'
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

  // Histórico: apenas negócios cujo último orçamento não está recusado.
  const obrasComOrcamentos = (obras || []).filter((obra: any) => {
    const ultimoOrcamento = obterUltimoOrcamento(obra);
    if (obra.requerReorcamento) return false;
    return Boolean(
      ultimoOrcamento
      && ultimoOrcamento.status !== 'recusado'
      && ultimoOrcamento.status !== 'pendente_reorcamento'
    );
  });

  const handleSelectObra = (obra: any) => {
    if (!isOrcamentoEditavel(obra)) {
      alert('Este orçamento está imutável. Apenas projetos em Planejamento podem receber novo orçamento.');
      return;
    }

    setSelectedObra(obra);
    const orcamentosExistentes = normalizarOrcamentos(obra);
    const ultimoOrcamento = orcamentosExistentes.length > 0 ? orcamentosExistentes[orcamentosExistentes.length - 1] : null;
    const reorcamentoPendente = Boolean(obra.requerReorcamento && ultimoOrcamento?.status === 'pendente_reorcamento');
    const proximaVersao = reorcamentoPendente
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
    
    const baseData = reorcamentoPendente && ultimoOrcamento?.data
      ? { ...getInitialOrcamentoData(), ...ultimoOrcamento.data }
      : getInitialOrcamentoData();

    setOrcamentoData({
      ...baseData,
      numeroOrcamento: reorcamentoPendente
        ? (ultimoOrcamento?.numeroOrcamento || `BM-${new Date().getFullYear()}-${proximaVersao}`)
        : `BM-${new Date().getFullYear()}-${proximaVersao}`,
      escopoOrcamento: servicosInfo,
      solicitante: obra.solicitante || baseData.solicitante || '',
      responsavelComercial: obra.responsavelComercial || baseData.responsavelComercial || '',
      dadosServicos
    });
    
    setShowForm(true);
  };

  const handleSaveOrcamento = () => {
    if (!selectedObra) return alert("Nenhum projeto selecionado.");
    if (!isOrcamentoEditavel(selectedObra)) {
      return alert('Não é possível alterar orçamento após Planejamento.');
    }

    const orcamentosExistentes = normalizarOrcamentos(selectedObra);
    const ultimoOrcamento = orcamentosExistentes.length > 0 ? orcamentosExistentes[orcamentosExistentes.length - 1] : null;
    const reorcamentoPendente = Boolean(selectedObra.requerReorcamento && ultimoOrcamento?.status === 'pendente_reorcamento');
    const proximaVersao = reorcamentoPendente
      ? formatarVersaoOrcamento(ultimoOrcamento?.versao)
      : proximaVersaoOrcamento(orcamentosExistentes);

    // Calcular valores
    const totalMaoDeObra = orcamentoData.maoDeObra.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0);
    const totalMateriais = orcamentoData.materiais.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0);
    const totalTerceirizados = orcamentoData.terceirizados.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0);
    const totalBruto = totalMaoDeObra + totalMateriais + totalTerceirizados;
    const margemPercentual = parseFloat(orcamentoData.margem) || 0;
    const ohPercentual = parseFloat(orcamentoData.oh) || 0;
    const impostosPercentual = parseFloat(orcamentoData.impostos) || 0;
    const margemValor = (totalBruto * margemPercentual) / 100;
    const ohValor = (totalBruto * ohPercentual) / 100;
    const totalSemImposto = totalBruto + margemValor + ohValor;
    const impostoValor = (totalSemImposto * impostosPercentual) / 100;
    const precoFinal = totalSemImposto + impostoValor;
    const quantidadeItensProduzidos = Number(orcamentoData.quantidadeItensProduzidos) || 0;
    const valorPorUnidade = quantidadeItensProduzidos > 0 ? precoFinal / quantidadeItensProduzidos : 0;

    // Criar novo orçamento com versão
    const novoOrcamento = {
      versao: proximaVersao,
      dataCriacao: new Date().toISOString().split('T')[0],
      status: 'pendente' as const,
      numeroOrcamento: orcamentoData.numeroOrcamento || `BM-${new Date().getFullYear()}-${proximaVersao}`,
      data: orcamentoData,
      valores: {
        totalMaoDeObra,
        totalMateriais,
        totalTerceirizados,
        totalBruto,
        totalSemImposto,
        subtotal: totalBruto,
        margem: margemPercentual,
        oh: ohPercentual,
        impostos: impostosPercentual,
        valorMargem: margemValor,
        valorOH: ohValor,
        valorImpostos: impostoValor,
        precoFinal,
        quantidadeItensProduzidos,
        valorPorUnidade
      }
    };

    // Atualizar a obra com o novo orçamento
    const obraAtualizada = {
      ...selectedObra,
      requerReorcamento: false,
      orcamentoRealizado: true,
      orcamentos: reorcamentoPendente
        ? [...orcamentosExistentes.slice(0, -1), novoOrcamento]
        : [...orcamentosExistentes, novoOrcamento]
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === selectedObra.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert("Orçamento salvo com sucesso! Projeto mantido em Planejamento.");
    setShowForm(false);
    setSelectedObra(null);
    setOrcamentoData(getInitialOrcamentoData());
  };

  const handleConcluirOrcamento = () => {
    handleSaveOrcamento();
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

  const parseDecimal = (value: string) => {
    const normalized = String(value || '').replace(',', '.');
    const numeric = parseFloat(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const toMoneyString = (value: number) => value.toFixed(2);

  const recalcularMaoDeObraItem = (item: MaoDeObra): MaoDeObra => {
    const total = parseDecimal(item.quantidade) * parseDecimal(item.dias) * parseDecimal(item.custoUnitDia);
    return { ...item, valorTotal: toMoneyString(total) };
  };

  const recalcularMaterialItem = (item: Material): Material => {
    const total = parseDecimal(item.quantidade) * parseDecimal(item.pesoFator) * parseDecimal(item.custoUnit);
    return { ...item, valorTotal: toMoneyString(total) };
  };

  const recalcularTerceirizadoItem = (item: Terceirizado): Terceirizado => {
    const pesoFator = String(item.pesoFator ?? '').trim() === '' ? 1 : parseDecimal(item.pesoFator);
    const total = parseDecimal(item.quantidade) * pesoFator * parseDecimal(item.custoUnit);
    return { ...item, valorTotal: toMoneyString(total) };
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
  const totalMaoDeObra = orcamentoData.maoDeObra.reduce((sum, item) => sum + (parseFloat(item.valorTotal) || 0), 0);
  const totalMateriais = orcamentoData.materiais.reduce((sum, item) => sum + (parseFloat(item.valorTotal) || 0), 0);
  const totalTerceirizados = orcamentoData.terceirizados.reduce((sum, item) => sum + (parseFloat(item.valorTotal) || 0), 0);
  const totalDiasAtividades = orcamentoData.atividades.reduce((sum, item) => sum + parseDecimal(item.dias), 0);
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
                  const cliente = listaClientes.find((c: any) => c.id === obra.clienteId);
                  const ultimoOrcamento = obterUltimoOrcamento(obra);
                  const reorcamentoArquivos = obra.requerReorcamento || ultimoOrcamento?.status === 'pendente_reorcamento';
                  
                  return (
                    <div 
                      key={obra.id}
                      className="bg-[#101f3d] border border-white/10 rounded-2xl p-6 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-900/20 transition-all"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-black text-white uppercase line-clamp-2">{obra.nome}</h3>
                            <p className="text-amber-400 text-sm font-bold mt-1">{cliente?.razaoSocial || 'Cliente Desconhecido'}</p>
                          </div>
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-black whitespace-nowrap">
                            {reorcamentoArquivos || ultimoOrcamento?.status === 'recusado' ? 'Reorçar' : 'A Orçar'}
                          </span>
                        </div>

                        <div className="bg-[#0b1220] rounded-xl p-4 space-y-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/50">Tipo:</span>
                            <span className="text-white font-bold">{obra.tipo}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Responsável:</span>
                            <span className="text-white font-bold">{obra.responsavelTecnico}</span>
                          </div>
                          {(ultimoOrcamento?.status === 'recusado' || reorcamentoArquivos) && (
                            <div className="flex justify-between">
                              <span className="text-white/50">Última versão:</span>
                              <span className="text-red-300 font-bold">
                                {reorcamentoArquivos ? `${formatarVersaoOrcamento(ultimoOrcamento?.versao)} aguardando revisão` : `${formatarVersaoOrcamento(ultimoOrcamento.versao)} recusada`}
                              </span>
                            </div>
                          )}

                          {obra.motivoRecusaProposta && (
                            <div className="pt-2 border-t border-white/10 space-y-1">
                              <p className="text-white/50 text-[11px] font-black uppercase tracking-widest">Motivo da recusa da proposta</p>
                              <p className="text-amber-200 text-xs leading-relaxed">{obra.motivoRecusaProposta}</p>
                              <p className="text-white/40 text-[11px]">
                                Documentos alterados/adicionados: {obra.houveAlteracaoDocumentosRecusa ? 'Sim' : 'Não'}
                              </p>
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => handleSelectObra(obra)}
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0b1220] py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-amber-900/30"
                        >
                          Fazer Orçamento
                        </button>
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

          {/* SEÇÃO 2: HISTÓRICO DE ORÇAMENTOS */}
          {obrasComOrcamentos.length > 0 && (
            <div className="border-t border-white/10 pt-8">
              <h2 className="text-2xl font-black text-white uppercase mb-4">Histórico de Orçamentos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {obrasComOrcamentos.map((obra: any) => {
                  const cliente = listaClientes.find((c: any) => c.id === obra.clienteId);
                  const orcamentos = normalizarOrcamentos(obra);
                  const ultimoOrcamento = orcamentos[orcamentos.length - 1];
                  const podeNovoOrcamento = isOrcamentoEditavel(obra);
                  
                  return (
                    <div 
                      key={obra.id}
                      className="bg-[#101f3d] border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-900/20 transition-all"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-black text-white uppercase line-clamp-2">{obra.nome}</h3>
                            <p className="text-amber-400 text-sm font-bold mt-1">{cliente?.razaoSocial || 'Cliente Desconhecido'}</p>
                          </div>
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-black whitespace-nowrap">
                            Orçado
                          </span>
                        </div>

                        <div className="bg-[#0b1220] rounded-xl p-4 space-y-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/50">Versão:</span>
                            <span className="text-white font-bold">{formatarVersaoOrcamento(ultimoOrcamento.versao)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Preço Final:</span>
                            <span className="text-white font-bold">R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Criado em:</span>
                            <span className="text-white font-bold text-xs">{new Date(ultimoOrcamento.dataCriacao).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>

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
            <button onClick={() => setShowForm(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
              <X size={24} className="text-white/60" />
            </button>
          </div>

          {/* SECTION 1: LEVANTAMENTO DE ORÇAMENTO */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-8">
            <h2 className="text-2xl font-black text-white uppercase mb-6">Levantamento de Orçamento</h2>

            {/* Dados do Negócio */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className={labelClass}>Cliente</label>
                <input type="text" className={inputClass} disabled value={listaClientes.find(c => c.id === selectedObra?.clienteId)?.razaoSocial || ''} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Negócio</label>
                <input type="text" className={inputClass} disabled value={selectedObra?.nome || ''} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Solicitante</label>
                <input 
                  type="text" 
                  className={inputClass}
                  value={orcamentoData.solicitante}
                  onChange={e => setOrcamentoData({...orcamentoData, solicitante: e.target.value})}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Responsável Comercial</label>
                <input 
                  type="text" 
                  className={inputClass}
                  value={orcamentoData.responsavelComercial}
                  onChange={e => setOrcamentoData({...orcamentoData, responsavelComercial: e.target.value})}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Nº Orçamento</label>
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

            {/* Escopo e Documentos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Escopo do Orçamento</label>
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
                <p className="text-amber-400 font-black text-lg text-right">{totalDiasAtividades.toFixed(2)} dias</p>
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
                <label className={labelClass}>Margem (%)</label>
                <input 
                  type="number" 
                  className={inputClass}
                  value={orcamentoData.margem}
                  onChange={e => setOrcamentoData({...orcamentoData, margem: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>O.H (%)</label>
                <input 
                  type="number" 
                  className={inputClass}
                  value={orcamentoData.oh}
                  onChange={e => setOrcamentoData({...orcamentoData, oh: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Impostos (%)</label>
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
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5 space-y-2.5">
                <label className={labelClass}>Quantidade de itens produzidos</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={orcamentoData.quantidadeItensProduzidos}
                  onChange={e => setOrcamentoData({ ...orcamentoData, quantidadeItensProduzidos: e.target.value })}
                  placeholder="0"
                />
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
              onClick={handleSaveOrcamento}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition border border-white/20"
            >
              Salvar Orçamento
            </button>
            <button 
              onClick={handleConcluirOrcamento}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-[#0b1220] py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-amber-900/30"
            >
              <Lock size={16} className="inline mr-2" /> Concluir Orçamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
