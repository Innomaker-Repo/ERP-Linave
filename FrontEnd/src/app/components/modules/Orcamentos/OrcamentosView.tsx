import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Plus, X, DollarSign, FileText, Trash2, Lock } from 'lucide-react';

// Clientes mockados
const CLIENTES_MOCK = [
  {
    id: 'CLI-1',
    razaoSocial: 'Linave Construções LTDA',
    nomeFantasia: 'Linave'
  },
  {
    id: 'CLI-2',
    razaoSocial: 'Construtora Alpha S.A.',
    nomeFantasia: 'Alpha Construtora'
  },
  {
    id: 'CLI-3',
    razaoSocial: 'TC Engenharia e Consultoria',
    nomeFantasia: 'TC Engenharia'
  },
  {
    id: 'CLI-4',
    razaoSocial: 'Projetos Marítimos LTDA',
    nomeFantasia: 'ProMar'
  },
  {
    id: 'CLI-5',
    razaoSocial: 'Estaleiro Industrial do Sudeste',
    nomeFantasia: 'EISE'
  }
];

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
}

interface Terceirizado {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  custoUnit: string;
  valorTotal: string;
  observacao: string;
}

interface OrcamentosViewProps {
  searchQuery: string;
}

export function OrcamentosView({ searchQuery }: OrcamentosViewProps) {
  const { obras, saveEntity } = useErp();
  const [showForm, setShowForm] = useState(false);
  const [selectedObra, setSelectedObra] = useState<any>(null);

  const [orcamentoData, setOrcamentoData] = useState({
    numeroOrcamento: `BM-${new Date().getFullYear()}-001`,
    solicitante: '',
    responsavelComercial: '',
    escopoOrcamento: '',
    documentosReferencia: '',
    maoDeObra: [{ id: '1', funcao: 'Encarregado', quantidade: '', dias: '', custoUnitDia: '', valorTotal: '', observacao: '' }],
    atividades: [{ id: '1', atividade: 'Levantamento / Inspeção', dias: '', observacao: '' }],
    materiais: [{ id: '1', descricao: 'Chapas / perfis / tubos', unidade: 'kg', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '', observacao: '' }],
    terceirizados: [{ id: '1', descricao: 'Jateamento / pintura terceirizada', unidade: 'serv', quantidade: '', custoUnit: '', valorTotal: '', observacao: '' }],
    observacoes: '',
    margem: '15',
    impostos: '18'
  });

  // Função para converter dados antigos em novo formato
  const normalizarOrcamentos = (obra: any) => {
    const orcamentos = obra.orcamentos || [];
    
    // Se tem dados antigos, converter para novo formato
    if (obra.orcamentoRealizado && obra.orcamentoData && obra.orcamentoValores && orcamentos.length === 0) {
      return [{
        versao: 1,
        dataCriacao: obra.dataCadastro,
        status: 'pendente',
        numeroOrcamento: obra.orcamentoData.numeroOrcamento,
        data: obra.orcamentoData,
        valores: obra.orcamentoValores
      }];
    }
    
    return orcamentos;
  };

  // Filtrar apenas obras na categoria "Planejamento" SEM orçamentos
  const projetosAOrcarse = obras?.filter((obra: any) => obra.categoria === 'Planejamento') || [];

  // Filtrar TODAS as obras COM orçamentos (de qualquer categoria) para o histórico
  const obrasComOrcamentos = obras?.filter((obra: any) => {
    const orcamentos = normalizarOrcamentos(obra);
    return orcamentos && orcamentos.length > 0;
  }) || [];

  const handleSelectObra = (obra: any) => {
    setSelectedObra(obra);
    
    // Preencher escopo automaticamente com informações dos serviços
    const servicosInfo = obra.servicos?.map((s: any) => `• ${s.tipo}${s.categoria ? ` (${s.categoria})` : ''}${s.localExecucao ? ` em ${s.localExecucao}` : ''}`).join('\n') || '';
    
    setOrcamentoData({
      ...orcamentoData,
      escopoOrcamento: servicosInfo,
      solicitante: obra.solicitante || '',
      responsavelComercial: obra.responsavelComercial || ''
    });
    
    setShowForm(true);
  };

  const handleSaveOrcamento = () => {
    if (!selectedObra) return alert("Nenhum projeto selecionado.");

    const proximaVersao = (selectedObra.orcamentos?.length || 0) + 1;

    // Calcular valores
    const totalMaoDeObra = orcamentoData.maoDeObra.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0);
    const totalMateriais = orcamentoData.materiais.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0);
    const totalTerceirizados = orcamentoData.terceirizados.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0);
    const subtotal = totalMaoDeObra + totalMateriais + totalTerceirizados;
    const margemValor = (subtotal * parseFloat(orcamentoData.margem)) / 100;
    const impostoValor = ((subtotal + margemValor) * parseFloat(orcamentoData.impostos)) / 100;
    const precoFinal = subtotal + margemValor + impostoValor;

    // Criar novo orçamento com versão
    const novoOrcamento = {
      versao: proximaVersao,
      dataCriacao: new Date().toISOString().split('T')[0],
      status: 'pendente' as const,
      numeroOrcamento: `BM-${new Date().getFullYear()}-${String(proximaVersao).padStart(3, '0')}`,
      data: orcamentoData,
      valores: {
        totalMaoDeObra,
        totalMateriais,
        totalTerceirizados,
        subtotal,
        margem: parseFloat(orcamentoData.margem),
        impostos: parseFloat(orcamentoData.impostos),
        precoFinal
      }
    };

    // Atualizar a obra com o novo orçamento
    const obraAtualizada = {
      ...selectedObra,
      orcamentos: [...(selectedObra.orcamentos || []), novoOrcamento]
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === selectedObra.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert("Orçamento salvo com sucesso! Projeto mantido em Planejamento.");
    setShowForm(false);
    setSelectedObra(null);
    setOrcamentoData({
      numeroOrcamento: `BM-${new Date().getFullYear()}-001`,
      solicitante: '',
      responsavelComercial: '',
      escopoOrcamento: '',
      documentosReferencia: '',
      maoDeObra: [{ id: '1', funcao: 'Encarregado', quantidade: '', dias: '', custoUnitDia: '', valorTotal: '', observacao: '' }],
      atividades: [{ id: '1', atividade: 'Levantamento / Inspeção', dias: '', observacao: '' }],
      materiais: [{ id: '1', descricao: 'Chapas / perfis / tubos', unidade: 'kg', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '', observacao: '' }],
      terceirizados: [{ id: '1', descricao: 'Jateamento / pintura terceirizada', unidade: 'serv', quantidade: '', custoUnit: '', valorTotal: '', observacao: '' }],
      observacoes: '',
      margem: '15',
      impostos: '18'
    });
  };

  const handleConcluirOrcamento = () => {
    handleSaveOrcamento();
  };

  const addMaoDeObra = () => {
    setOrcamentoData({
      ...orcamentoData,
      maoDeObra: [...orcamentoData.maoDeObra, { id: Date.now().toString(), funcao: '', quantidade: '', dias: '', custoUnitDia: '', valorTotal: '', observacao: '' }]
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
      materiais: [...orcamentoData.materiais, { id: Date.now().toString(), descricao: '', unidade: '', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '', observacao: '' }]
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
      terceirizados: [...orcamentoData.terceirizados, { id: Date.now().toString(), descricao: '', unidade: '', quantidade: '', custoUnit: '', valorTotal: '', observacao: '' }]
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
  const subtotal = totalMaoDeObra + totalMateriais + totalTerceirizados;
  const margemValor = (subtotal * parseFloat(orcamentoData.margem)) / 100;
  const impostoValor = ((subtotal + margemValor) * parseFloat(orcamentoData.impostos)) / 100;
  const precoFinal = subtotal + margemValor + impostoValor;

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
            <h2 className="text-2xl font-black text-white uppercase mb-4">📋 Projetos à Orçar</h2>
            
            {projetosAOrcarse.filter((obra: any) => {
              const orcamentos = normalizarOrcamentos(obra);
              return !orcamentos || orcamentos.length === 0;
            }).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projetosAOrcarse.filter((obra: any) => {
                  const orcamentos = normalizarOrcamentos(obra);
                  return !orcamentos || orcamentos.length === 0;
                }).map((obra: any) => {
                  const cliente = CLIENTES_MOCK.find((c: any) => c.id === obra.clienteId);
                  
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
                            A Orçar
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
                        </div>

                        <button 
                          onClick={() => handleSelectObra(obra)}
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0b1220] py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-amber-900/30"
                        >
                          💰 Fazer Orçamento
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
              <h2 className="text-2xl font-black text-white uppercase mb-4">📊 Histórico de Orçamentos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {obrasComOrcamentos.map((obra: any) => {
                  const cliente = CLIENTES_MOCK.find((c: any) => c.id === obra.clienteId);
                  const orcamentos = normalizarOrcamentos(obra);
                  const ultimoOrcamento = orcamentos[orcamentos.length - 1];
                  
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
                            <span className="text-white font-bold">{ultimoOrcamento.versao}</span>
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

                        <button 
                          onClick={() => handleSelectObra(obra)}
                          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                        >
                          📝 Novo Orçamento
                        </button>
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
                <input type="text" className={inputClass} disabled value={CLIENTES_MOCK.find(c => c.id === selectedObra?.clienteId)?.razaoSocial || ''} />
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
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.funcao} onChange={e => {
                        const updated = orcamentoData.maoDeObra.map(i => i.id === item.id ? {...i, funcao: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, maoDeObra: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.quantidade} onChange={e => {
                        const updated = orcamentoData.maoDeObra.map(i => i.id === item.id ? {...i, quantidade: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, maoDeObra: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.dias} onChange={e => {
                        const updated = orcamentoData.maoDeObra.map(i => i.id === item.id ? {...i, dias: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, maoDeObra: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.custoUnitDia} onChange={e => {
                        const updated = orcamentoData.maoDeObra.map(i => i.id === item.id ? {...i, custoUnitDia: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, maoDeObra: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.valorTotal} onChange={e => {
                        const updated = orcamentoData.maoDeObra.map(i => i.id === item.id ? {...i, valorTotal: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, maoDeObra: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.observacao} onChange={e => {
                        const updated = orcamentoData.maoDeObra.map(i => i.id === item.id ? {...i, observacao: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, maoDeObra: updated});
                      }} /></td>
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

          {/* SECTION 3: ATIVIDADES PREVISTAS */}
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
          </div>

          {/* SECTION 4: CONSUMÍVEIS E MATERIAIS */}
          <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase">Consumíveis e Materiais</h3>
                <p className="text-white/50 text-xs mt-1">Levante os materiais, quantidade, custo unitário e total</p>
              </div>
              <button 
                onClick={addMaterial}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition"
              >
                <Plus size={16} className="inline mr-2" /> Adicionar Material
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
                  {orcamentoData.materiais.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.descricao} onChange={e => {
                        const updated = orcamentoData.materiais.map(i => i.id === item.id ? {...i, descricao: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, materiais: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.unidade} onChange={e => {
                        const updated = orcamentoData.materiais.map(i => i.id === item.id ? {...i, unidade: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, materiais: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.quantidade} onChange={e => {
                        const updated = orcamentoData.materiais.map(i => i.id === item.id ? {...i, quantidade: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, materiais: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.pesoFator} onChange={e => {
                        const updated = orcamentoData.materiais.map(i => i.id === item.id ? {...i, pesoFator: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, materiais: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.custoUnit} onChange={e => {
                        const updated = orcamentoData.materiais.map(i => i.id === item.id ? {...i, custoUnit: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, materiais: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.valorTotal} onChange={e => {
                        const updated = orcamentoData.materiais.map(i => i.id === item.id ? {...i, valorTotal: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, materiais: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.observacao} onChange={e => {
                        const updated = orcamentoData.materiais.map(i => i.id === item.id ? {...i, observacao: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, materiais: updated});
                      }} /></td>
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

          {/* SECTION 5: SERVIÇOS TERCEIRIZADOS */}
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
                    <th className="px-4 py-3 text-left text-white font-black">CUSTO UNIT.</th>
                    <th className="px-4 py-3 text-left text-white font-black">VALOR TOTAL</th>
                    <th className="px-4 py-3 text-left text-white font-black">OBSERVAÇÃO</th>
                    <th className="px-4 py-3 text-center text-white font-black w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentoData.terceirizados.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.descricao} onChange={e => {
                        const updated = orcamentoData.terceirizados.map(i => i.id === item.id ? {...i, descricao: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, terceirizados: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.unidade} onChange={e => {
                        const updated = orcamentoData.terceirizados.map(i => i.id === item.id ? {...i, unidade: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, terceirizados: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.quantidade} onChange={e => {
                        const updated = orcamentoData.terceirizados.map(i => i.id === item.id ? {...i, quantidade: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, terceirizados: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.custoUnit} onChange={e => {
                        const updated = orcamentoData.terceirizados.map(i => i.id === item.id ? {...i, custoUnit: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, terceirizados: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="number" className={tableInputClass} value={item.valorTotal} onChange={e => {
                        const updated = orcamentoData.terceirizados.map(i => i.id === item.id ? {...i, valorTotal: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, terceirizados: updated});
                      }} /></td>
                      <td className="px-4 py-3"><input type="text" className={tableInputClass} value={item.observacao} onChange={e => {
                        const updated = orcamentoData.terceirizados.map(i => i.id === item.id ? {...i, observacao: e.target.value} : i);
                        setOrcamentoData({...orcamentoData, terceirizados: updated});
                      }} /></td>
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

            <div className="grid grid-cols-2 gap-4 mb-6">
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
                <p className="text-white/50 text-xs font-bold mb-2">TOTAL MATERIAIS</p>
                <p className="text-white font-black text-lg">R$ {totalMateriais.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">TOTAL TERCEIRIZADOS</p>
                <p className="text-white font-black text-lg">R$ {totalTerceirizados.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">SUBTOTAL</p>
                <p className="text-white font-black text-lg">R$ {subtotal.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-white/5">
                <p className="text-white/50 text-xs font-bold mb-2">IMPOSTOS</p>
                <p className="text-white font-black text-lg">R$ {impostoValor.toFixed(2)}</p>
              </div>
              <div className="bg-[#101f3d] rounded-lg p-4 border border-amber-500/30 shadow-lg shadow-amber-500/10">
                <p className="text-amber-400 text-xs font-black mb-2 uppercase">PREÇO FINAL</p>
                <p className="text-amber-400 font-black text-2xl">R$ {precoFinal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 8: BOTÕES DE AÇÃO */}
          <div className="flex gap-4">
            <button 
              onClick={handleSaveOrcamento}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition border border-white/20"
            >
              💾 Salvar Orçamento
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
