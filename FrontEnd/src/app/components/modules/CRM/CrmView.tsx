import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { 
  Plus, X, FileText, LinkIcon, Anchor, ChevronDown, Trash2, TrendingUp
} from 'lucide-react';

// Fases do Fluxo Linave
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

interface Servico {
  id: string;
  tipo: string;
  categoria: string;
  embarcacao: string;
  localExecucao: string;
  porto: string;
  urgencia: 'Baixa' | 'Normal' | 'Alta' | 'Crítica';
  prazoDes: string;
  descricao: string;
  observacoes?: string;
}

interface CrmViewProps {
  searchQuery: string;
}

export function CrmView({ searchQuery }: CrmViewProps) {
  const { os, clientes, obras, saveEntity, userSession } = useErp();
  const listaClientes = Array.isArray(clientes) ? clientes : [];
  const [showForm, setShowForm] = useState(false);
  const [showRequisitosModal, setShowRequisitosModal] = useState(false);
  const [showPropostaModal, setShowPropostaModal] = useState(false);
  const [showOrcamentoModal, setShowOrcamentoModal] = useState(false);
  const [showObraDetalhesModal, setShowObraDetalhesModal] = useState(false);
  const [selectedObra, setSelectedObra] = useState<any>(null);
  
  const initialServico: Servico = {
    id: '',
    tipo: '',
    categoria: '',
    embarcacao: '',
    localExecucao: '',
    porto: '',
    urgencia: 'Normal',
    prazoDes: '',
    descricao: '',
    observacoes: ''
  };

  const initialForm = {
    empresaPrestadora: 'Linave',
    clienteId: '',
    cnpj: '',
    origemLead: '',
    solicitante: '',
    cargo: '',
    telefone: '',
    email: '',
    responsavelComercial: '',
    servicos: [{ ...initialServico }],
    fase: 'Pre-Venda' as FaseOS,
    docs: {
      orcamento: '',
      relatorioRequisitos: '',
      proposta: ''
    }
  };

  const initialOrcamento = {
    maoDeObra: [{ item: '', descricao: '', custo: '', unidade: 'dia', dias: '', quantidade: '', valorTotal: '' }],
    atividades: [{ data: '', atividade: '', tempo: '', horasTrabalhadas: '' }],
    consumiveis: [{ item: '', descricao: '', precoUnitario: '', unidade: '', fator: '', quantidade: '', valorTotal: '' }],
    servicos: [{ item: '', descricao: '', valorTotal: '' }],
    custoTotal: {
      maoDeObra: '0',
      consumivel: '0',
      servicosTerceirizados: '0',
      total: '0',
      oh: '0',
      margem: '30',
      pv: '0',
      imposto: '0',
      pvFinal: '0'
    }
  };

  const initialRequisitos = {
    nomeProjeto: '',
    gerente: '',
    patrocinador: '',
    data: new Date().toISOString().split('T')[0],
    objetivo: '',
    beneficios: '',
    prazo: '',
    premissas: '',
    restricoes: '',
    escopoMacro: '',
    estruturaEquipe: ''
  };

  const initialProposta = {
    numero: '',
    condicoes: '',
    prazo: '',
    valor: '',
    observacoes: ''
  };

  const [formData, setFormData] = useState(initialForm);
  const [requisitosData, setRequisitosData] = useState(initialRequisitos);
  const [propostaData, setPropostaData] = useState(initialProposta);
  const [orcamentoData, setOrcamentoData] = useState(initialOrcamento);

  const handleSave = () => {
    if (!formData.clienteId || !formData.solicitante || formData.servicos.length === 0) {
      return alert("Cliente, Solicitante e pelo menos um Serviço são obrigatórios.");
    }

    // Validar se pelo menos um serviço tem descrição
    if (!formData.servicos.some(s => s.descricao.trim())) {
      return alert("Pelo menos um serviço deve ter uma descrição.");
    }

    const novoProjetoId = `PROJ-${Date.now()}`;
    const nomeObra = listaClientes.find(c => c.id === formData.clienteId)?.razaoSocial || 'Projeto';
    const primeiroServico = formData.servicos[0];

    const novaObra = {
      id: novoProjetoId,
      nome: `${primeiroServico.tipo || 'Projeto'} - ${primeiroServico.localExecucao || 'A Definir'}`,
      clienteId: formData.clienteId,
      status: 'Planejamento',
      categoria: 'Planejamento',
      tipo: primeiroServico.tipo || 'Serviço',
      responsavelTecnico: formData.solicitante,
      dataCadastro: new Date().toISOString().split('T')[0],
      origemOS: true,
      orcamento: 0
    };

    // Criar uma OS para cada serviço adicionado
    const novasOS = formData.servicos.map((servico, idx) => ({
      id: `OS-${Date.now()}-${idx}`,
      clienteId: formData.clienteId,
      solicitante: formData.solicitante,
      email: formData.email,
      telefone: formData.telefone,
      tipo: servico.tipo,
      embarcacao: servico.embarcacao,
      local: servico.localExecucao,
      urgencia: servico.urgencia,
      prazoDes: servico.prazoDes,
      descricao: servico.descricao,
      observacoes: servico.observacoes,
      porto: servico.porto,
      fase: formData.fase,
      obraId: novoProjetoId,
      obraNome: nomeObra,
      dataCriacao: new Date().toISOString().split('T')[0],
      status: 'Ativo',
      docs: formData.docs
    }));

    saveEntity('obras', [...(obras || []), novaObra]);
    saveEntity('os', [...(os || []), ...novasOS]);

    alert(`${novasOS.length} Serviço(s) criado(s) com sucesso!`);
    setShowForm(false);
    setFormData(initialForm);
  };

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

  const handleUpdateServico = (idx: number, key: keyof Servico, value: any) => {
    const newServicos = [...formData.servicos];
    newServicos[idx] = { ...newServicos[idx], [key]: value };
    setFormData({ ...formData, servicos: newServicos });
  };

  const handleSaveRequisitos = () => {
    if (!requisitosData.nomeProjeto || !requisitosData.gerente) {
      return alert("Nome do Projeto e Gerente são obrigatórios.");
    }
    setFormData({ 
      ...formData, 
      docs: { ...formData.docs, relatorioRequisitos: `REQ-${Date.now()}` } 
    });
    alert("Relatório de Requisitos criado!");
    setShowRequisitosModal(false);
  };

  const handleSaveProposta = () => {
    if (!propostaData.numero || !propostaData.valor) {
      return alert("Número da Proposta e Valor são obrigatórios.");
    }
    setFormData({ 
      ...formData, 
      docs: { ...formData.docs, proposta: `PROP-${propostaData.numero}` } 
    });
    alert("Proposta Comercial criada!");
    setShowPropostaModal(false);
  };

  const handleSaveOrcamento = () => {
    // Calcula custos totais
    const totalMaoDeObra = orcamentoData.maoDeObra.reduce((sum, item) => 
      sum + (parseFloat(item.valorTotal) || 0), 0
    );
    const totalConsumiveis = orcamentoData.consumiveis.reduce((sum, item) => 
      sum + (parseFloat(item.valorTotal) || 0), 0
    );
    const totalServicos = orcamentoData.servicos.reduce((sum, item) => 
      sum + (parseFloat(item.valorTotal) || 0), 0
    );
    
    const subtotal = totalMaoDeObra + totalConsumiveis + totalServicos;
    const margem = (subtotal * (parseFloat(orcamentoData.custoTotal.margem) || 30)) / 100;
    const pv = subtotal + margem;
    const imposto = (pv * 0.0525) || 0; // ISS + PIS/COFINS aprox 5.25%
    const pvFinal = pv + imposto;

    setFormData({ 
      ...formData, 
      docs: { ...formData.docs, orcamento: `ORC-${Date.now()}` } 
    });
    alert(`Orçamento criado! PV Final: R$ ${pvFinal.toFixed(2)}`);
    setShowOrcamentoModal(false);
  };

  const updateDoc = (key: string, value: string) => {
    setFormData({ ...formData, docs: { ...formData.docs, [key]: value } });
  };

  const inputClass = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelClass = "text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block";

  return (
    <div className="p-12 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white">CRM - Negócios</h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Gerencie oportunidades e crie novos projetos</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-amber-500 text-[#0b1220] px-6 py-3 rounded-lg font-black text-sm uppercase flex items-center gap-2 hover:bg-amber-400 transition-all shadow-lg shadow-amber-900/20">
            <Plus size={18} /> Novo Negócio
          </button>
        )}
      </div>

      {/* FORMULÁRIO DE NOVO NEGÓCIO */}
      {showForm && (
        <div className="bg-[#0b1220] p-8 rounded-2xl border border-white/10 shadow-2xl relative animate-in slide-in-from-bottom-4">
          <div className="flex justify-end mb-6">
            <button onClick={() => setShowForm(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
              <X size={20} className="text-white/60"/>
            </button>
          </div>

          {/* HEADER DO FORMULÁRIO */}
          <div className="flex items-start gap-4 pb-8 border-b border-white/10 mb-8">
            <div className="bg-amber-500 p-3 rounded-lg">
              <FileText size={24} className="text-[#0b1220]" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white">Abertura de Novo Negócio</h2>
              <p className="text-white/50 text-sm mt-2">Cadastro inicial com cliente vindo do banco de dados e possibilidade de mais de um serviço no mesmo negócio.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* PAINEL ESQUERDO - DADOS DO CLIENTE E CONTATO */}
            <div className="space-y-6">
              {/* EMPRESA PRESTADORA */}
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg border border-amber-500/30 p-3">
                <label className="text-[8px] font-black text-amber-400 uppercase tracking-widest block mb-1.5">Empresa Prestadora</label>
                <select className={`${inputClass} text-sm`} 
                  value={formData.empresaPrestadora} 
                  onChange={e => setFormData({...formData, empresaPrestadora: e.target.value})}>
                  <option value="Linave">Linave</option>
                  <option value="Servinave">Servinave</option>
                </select>
              </div>

              <div>
                <h2 className="text-xl font-black text-white uppercase mb-2">Dados do Cliente</h2>
              </div>
              
              <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6 space-y-4">
                
                {/* Linha 1: Cliente, CNPJ e Origem do Lead */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Cliente *</label>
                    <select className={`${inputClass} appearance-none cursor-pointer`} 
                      value={formData.clienteId} 
                      onChange={e => setFormData({...formData, clienteId: e.target.value})}>
                      <option value="">Selecione um cliente no banco</option>
                      {listaClientes.map((c:any) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>CNPJ</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="00.000.000/0000-00"
                      value={formData.cnpj}
                      onChange={e => setFormData({...formData, cnpj: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Origem do Lead</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Indicação, Site, etc"
                      value={formData.origemLead}
                      onChange={e => setFormData({...formData, origemLead: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* CONTATO */}
              <div>
                <h2 className="text-xl font-black text-white uppercase mb-2">Contato</h2>
              </div>

              <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6 space-y-4">
                
                {/* Linha 1: Solicitante, Cargo, Telefone */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Solicitante</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Nome"
                      value={formData.solicitante}
                      onChange={e => setFormData({...formData, solicitante: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Cargo</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Cargo"
                      value={formData.cargo}
                      onChange={e => setFormData({...formData, cargo: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Telefone</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="(XX) XXXXX-XXXX"
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: e.target.value})}
                    />
                  </div>
                </div>

                {/* Linha 2: Email, Responsável Comercial */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Email</label>
                    <input 
                      type="email"
                      className={inputClass}
                      placeholder="email@cliente.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Responsável Comercial</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Nome do responsável"
                      value={formData.responsavelComercial}
                      onChange={e => setFormData({...formData, responsavelComercial: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* RESUMO DOS SERVIÇOS CRIADOS */}
              <div>
                <h2 className="text-xl font-black text-white uppercase mb-2">Serviços Criados</h2>
              </div>

              <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6 space-y-3 max-h-[300px] overflow-y-auto">
                {formData.servicos.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-4">Nenhum serviço adicionado ainda</p>
                ) : (
                  formData.servicos.map((servico, idx) => (
                    <div key={idx} className="bg-[#0b1220] rounded-lg p-4 border border-amber-500/20 hover:border-amber-500/40 transition-all group">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-amber-400 font-black text-sm mb-2">
                            {servico.tipo || 'Tipo não definido'}
                          </p>
                          <div className="space-y-1.5 text-xs">
                            {servico.categoria && (
                              <p className="text-white/70">
                                <span className="text-white/50">Categoria:</span>{' '}
                                <span className="text-white font-bold">{servico.categoria}</span>
                              </p>
                            )}
                            {servico.localExecucao && (
                              <p className="text-white/70">
                                <span className="text-white/50">Local:</span>{' '}
                                <span className="text-white font-bold">{servico.localExecucao}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        {formData.servicos.length > 1 && (
                          <button
                            onClick={() => handleRemoveServico(idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PAINEL DIREITO - SERVIÇOS DO NEGÓCIO */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-white uppercase mb-2">Serviços do Negócio</h2>
                  <p className="text-white/40 text-xs font-bold">Você pode cadastrar mais de um serviço dentro do mesmo negócio para o mesmo cliente.</p>
                </div>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {formData.servicos.map((servico, idx) => (
                  <div key={idx} className="bg-[#101f3d] rounded-2xl border border-white/5 p-6 space-y-4 hover:border-amber-500/30 transition-all">
                    
                    {/* Header do Serviço */}
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <span className="text-sm font-black text-amber-400">Serviço {idx + 1}</span>
                      {formData.servicos.length > 1 && (
                        <button 
                          onClick={() => handleRemoveServico(idx)}
                          className="p-1.5 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Linha 1: Tipo e Categoria */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Tipo de Serviço</label>
                        <input 
                          type="text"
                          className={inputClass}
                          placeholder="Manutenção, Reparo..."
                          value={servico.tipo}
                          onChange={e => handleUpdateServico(idx, 'tipo', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Categoria</label>
                        <input 
                          type="text"
                          className={inputClass}
                          placeholder="Elétrica, Mecânica..."
                          value={servico.categoria}
                          onChange={e => handleUpdateServico(idx, 'categoria', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Linha 2: Embarcação */}
                    <div className="space-y-1.5">
                      <label className={labelClass}>Embarcação</label>
                      <input 
                        type="text"
                        className={inputClass}
                        placeholder="Ex: Navio WS-12"
                        value={servico.embarcacao}
                        onChange={e => handleUpdateServico(idx, 'embarcacao', e.target.value)}
                      />
                    </div>

                    {/* Linha 3: Local Execução e Porto */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Local Execução</label>
                        <input 
                          type="text"
                          className={inputClass}
                          placeholder="Porto de Santos"
                          value={servico.localExecucao}
                          onChange={e => handleUpdateServico(idx, 'localExecucao', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Porto</label>
                        <input 
                          type="text"
                          className={inputClass}
                          placeholder="Porto"
                          value={servico.porto}
                          onChange={e => handleUpdateServico(idx, 'porto', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Linha 4: Urgência e Prazo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Urgência</label>
                        <select className={`${inputClass} appearance-none cursor-pointer`} 
                          value={servico.urgencia}
                          onChange={e => handleUpdateServico(idx, 'urgencia', e.target.value as any)}>
                          <option value="Baixa">Baixa</option>
                          <option value="Normal">Normal</option>
                          <option value="Alta">Alta</option>
                          <option value="Crítica">Crítica</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass}>Prazo Desejado</label>
                        <input 
                          type="date"
                          className={inputClass}
                          value={servico.prazoDes}
                          onChange={e => handleUpdateServico(idx, 'prazoDes', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Linha 5: Descrição */}
                    <div className="space-y-1.5">
                      <label className={labelClass}>Descrição da Solicitação *</label>
                      <textarea 
                        className={`${inputClass} h-20 resize-none`}
                        placeholder="Descreva os detalhes do serviço..."
                        value={servico.descricao}
                        onChange={e => handleUpdateServico(idx, 'descricao', e.target.value)}
                      />
                    </div>

                    {/* Linha 6: Observações */}
                    <div className="space-y-1.5">
                      <label className={labelClass}>Observações Internas</label>
                      <textarea 
                        className={`${inputClass} h-16 resize-none`}
                        placeholder="Notas internas..."
                        value={servico.observacoes || ''}
                        onChange={e => handleUpdateServico(idx, 'observacoes', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão Adicionar Serviço */}
              <button 
                onClick={handleAddServico}
                className="w-full px-4 py-3 text-sm text-[#0b1220] bg-amber-500 hover:bg-amber-400 rounded-lg font-black uppercase tracking-wide transition shadow-lg shadow-amber-900/20"
              >
                <Plus size={16} className="inline mr-2" /> Adicionar Serviço
              </button>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex gap-4 mt-12 pt-8 border-t border-white/5">
            <button 
              onClick={handleSave} 
              className="flex-1 bg-emerald-500 text-[#0b1220] py-3 rounded-lg font-black uppercase text-sm tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-900/20"
            >
              Criar Negócio
            </button>
            <button 
              onClick={() => setShowForm(false)} 
              className="px-8 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE REQUISITOS */}
      {showRequisitosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-white">Termo de Abertura</h3>
                <button onClick={() => setShowRequisitosModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                  <X size={20} className="text-white/60"/>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Nome do Projeto *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Ex: Manutenção Convés"
                      value={requisitosData.nomeProjeto}
                      onChange={e => setRequisitosData({...requisitosData, nomeProjeto: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Gerente *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Nome do gerente"
                      value={requisitosData.gerente}
                      onChange={e => setRequisitosData({...requisitosData, gerente: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Patrocinador</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Nome do patrocinador"
                      value={requisitosData.patrocinador}
                      onChange={e => setRequisitosData({...requisitosData, patrocinador: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Data</label>
                    <input 
                      type="date"
                      className={inputClass}
                      value={requisitosData.data}
                      onChange={e => setRequisitosData({...requisitosData, data: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Objetivo</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Descreva o objetivo"
                    value={requisitosData.objetivo}
                    onChange={e => setRequisitosData({...requisitosData, objetivo: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Benefícios</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Liste os benefícios"
                    value={requisitosData.beneficios}
                    onChange={e => setRequisitosData({...requisitosData, beneficios: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Prazo</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Ex: 6 meses"
                      value={requisitosData.prazo}
                      onChange={e => setRequisitosData({...requisitosData, prazo: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Custo Estimado</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Ex: R$ 500.000,00"
                      value={requisitosData.restricoes}
                      onChange={e => setRequisitosData({...requisitosData, restricoes: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Premissas</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Liste as premissas"
                    value={requisitosData.premissas}
                    onChange={e => setRequisitosData({...requisitosData, premissas: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Restrições</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Liste as restrições"
                    value={requisitosData.restricoes}
                    onChange={e => setRequisitosData({...requisitosData, restricoes: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Escopo Macro</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Descreva o escopo"
                    value={requisitosData.escopoMacro}
                    onChange={e => setRequisitosData({...requisitosData, escopoMacro: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Estrutura da Equipe</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Descreva a equipe"
                    value={requisitosData.estruturaEquipe}
                    onChange={e => setRequisitosData({...requisitosData, estruturaEquipe: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button 
                  onClick={handleSaveRequisitos}
                  className="flex-1 bg-amber-500 text-[#0b1220] py-3 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-900/20"
                >
                  Salvar
                </button>
                <button 
                  onClick={() => setShowRequisitosModal(false)}
                  className="px-8 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-xs hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ORÇAMENTO */}
      {showOrcamentoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#101f3d] to-[#0b1220] rounded-3xl border border-amber-500/20 shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
            {/* HEADER */}
            <div className="sticky top-0 bg-gradient-to-r from-[#101f3d] to-[#0b1220] border-b border-amber-500/20 px-8 py-6 flex justify-between items-center z-10">
              <div>
                <h3 className="text-3xl font-black text-white">Formulário de Orçamento</h3>
                <p className="text-white/40 text-xs uppercase tracking-widest mt-1 font-bold">Memória de cálculo para serviços</p>
              </div>
              <button onClick={() => setShowOrcamentoModal(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition">
                <X size={24} className="text-white/60"/>
              </button>
            </div>

            <div className="p-8 space-y-10">
              
              {/* MÃO DE OBRA */}
              <div className="space-y-5">
                <div className="flex justify-between items-center pb-4 border-b-2 border-amber-500/30">
                  <div>
                    <h4 className="text-xl font-black text-amber-500 uppercase">Mão de Obra</h4>
                    <p className="text-white/30 text-xs mt-1">Profissionais envolvidos na execução</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setOrcamentoData({
                      ...orcamentoData,
                      maoDeObra: [...orcamentoData.maoDeObra, { item: '', descricao: '', custo: '', unidade: 'dia', dias: '', quantidade: '', valorTotal: '' }]
                    })}
                    className="px-4 py-2.5 text-xs text-[#0b1220] bg-amber-500 hover:bg-amber-400 rounded-lg font-black uppercase transition shadow-lg shadow-amber-500/30"
                  >
                    <Plus size={16} className="inline mr-2" /> Nova Linha
                  </button>
                </div>
                <div className="bg-[#0b1220]/50 rounded-2xl border border-amber-500/10 overflow-hidden overflow-x-auto backdrop-blur">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-amber-500/10 border-b border-amber-500/20">
                        <th className="px-4 py-3 text-left text-amber-400 font-black">Item</th>
                        <th className="px-4 py-3 text-left text-amber-400 font-black">Descrição</th>
                        <th className="px-4 py-3 text-left text-amber-400 font-black">Custo/Unid</th>
                        <th className="px-4 py-3 text-left text-amber-400 font-black">Unid</th>
                        <th className="px-4 py-3 text-left text-amber-400 font-black">Dias</th>
                        <th className="px-4 py-3 text-left text-amber-400 font-black">Quant</th>
                        <th className="px-4 py-3 text-left text-amber-400 font-black">Valor Total</th>
                        <th className="px-4 py-3 text-center text-amber-400 font-black w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orcamentoData.maoDeObra.map((item, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-amber-500/20 p-2 rounded text-white text-xs focus:border-amber-500 outline-none" placeholder="1" value={item.item} onChange={e => {
                            const newMO = [...orcamentoData.maoDeObra];
                            newMO[idx].item = e.target.value;
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-amber-500/20 p-2 rounded text-white text-xs focus:border-amber-500 outline-none" placeholder="Encanador" value={item.descricao} onChange={e => {
                            const newMO = [...orcamentoData.maoDeObra];
                            newMO[idx].descricao = e.target.value;
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-amber-500/20 p-2 rounded text-white text-xs focus:border-amber-500 outline-none" placeholder="500" value={item.custo} onChange={e => {
                            const newMO = [...orcamentoData.maoDeObra];
                            newMO[idx].custo = e.target.value;
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }} /></td>
                          <td className="px-4 py-3"><select className="w-full bg-[#101f3d] border border-amber-500/20 p-2 rounded text-white text-xs focus:border-amber-500 outline-none" value={item.unidade} onChange={e => {
                            const newMO = [...orcamentoData.maoDeObra];
                            newMO[idx].unidade = e.target.value;
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }}>
                            <option>dia</option>
                            <option>hora</option>
                            <option>empreitada</option>
                          </select></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-amber-500/20 p-2 rounded text-white text-xs focus:border-amber-500 outline-none" placeholder="5" value={item.dias} onChange={e => {
                            const newMO = [...orcamentoData.maoDeObra];
                            newMO[idx].dias = e.target.value;
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-amber-500/20 p-2 rounded text-white text-xs focus:border-amber-500 outline-none" placeholder="2" value={item.quantidade} onChange={e => {
                            const newMO = [...orcamentoData.maoDeObra];
                            newMO[idx].quantidade = e.target.value;
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-amber-500/20 p-2 rounded text-white text-xs focus:border-amber-500 outline-none font-bold text-amber-400" placeholder="5000" value={item.valorTotal} onChange={e => {
                            const newMO = [...orcamentoData.maoDeObra];
                            newMO[idx].valorTotal = e.target.value;
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }} /></td>
                          <td className="px-4 py-3 text-center"><button onClick={() => {
                            const newMO = orcamentoData.maoDeObra.filter((_, i) => i !== idx);
                            setOrcamentoData({...orcamentoData, maoDeObra: newMO});
                          }} className="p-1.5 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={16} />
                          </button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ATIVIDADES */}
              <div className="space-y-5">
                <div className="flex justify-between items-center pb-4 border-b-2 border-cyan-500/30">
                  <div>
                    <h4 className="text-xl font-black text-cyan-400 uppercase">Atividades</h4>
                    <p className="text-white/30 text-xs mt-1">Cronograma de execução do trabalho</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setOrcamentoData({
                      ...orcamentoData,
                      atividades: [...orcamentoData.atividades, { data: '', atividade: '', tempo: '', horasTrabalhadas: '' }]
                    })}
                    className="px-4 py-2.5 text-xs text-[#0b1220] bg-cyan-500 hover:bg-cyan-400 rounded-lg font-black uppercase transition shadow-lg shadow-cyan-500/30"
                  >
                    <Plus size={16} className="inline mr-2" /> Nova Linha
                  </button>
                </div>
                <div className="bg-[#0b1220]/50 rounded-2xl border border-cyan-500/10 overflow-hidden overflow-x-auto backdrop-blur">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-cyan-500/10 border-b border-cyan-500/20">
                        <th className="px-4 py-3 text-left text-cyan-300 font-black">Data</th>
                        <th className="px-4 py-3 text-left text-cyan-300 font-black">Atividade</th>
                        <th className="px-4 py-3 text-left text-cyan-300 font-black">Tempo</th>
                        <th className="px-4 py-3 text-left text-cyan-300 font-black">Horas Trabalhadas</th>
                        <th className="px-4 py-3 text-center text-cyan-300 font-black w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orcamentoData.atividades.map((item, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="px-4 py-3"><input type="date" className="w-full bg-[#101f3d] border border-cyan-500/20 p-2 rounded text-white text-xs focus:border-cyan-500 outline-none" value={item.data} onChange={e => {
                            const newAt = [...orcamentoData.atividades];
                            newAt[idx].data = e.target.value;
                            setOrcamentoData({...orcamentoData, atividades: newAt});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-cyan-500/20 p-2 rounded text-white text-xs focus:border-cyan-500 outline-none" placeholder="Descrição da atividade" value={item.atividade} onChange={e => {
                            const newAt = [...orcamentoData.atividades];
                            newAt[idx].atividade = e.target.value;
                            setOrcamentoData({...orcamentoData, atividades: newAt});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-cyan-500/20 p-2 rounded text-white text-xs focus:border-cyan-500 outline-none" placeholder="Ex: 2h" value={item.tempo} onChange={e => {
                            const newAt = [...orcamentoData.atividades];
                            newAt[idx].tempo = e.target.value;
                            setOrcamentoData({...orcamentoData, atividades: newAt});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-cyan-500/20 p-2 rounded text-white text-xs focus:border-cyan-500 outline-none" placeholder="8" value={item.horasTrabalhadas} onChange={e => {
                            const newAt = [...orcamentoData.atividades];
                            newAt[idx].horasTrabalhadas = e.target.value;
                            setOrcamentoData({...orcamentoData, atividades: newAt});
                          }} /></td>
                          <td className="px-4 py-3 text-center"><button onClick={() => {
                            const newAt = orcamentoData.atividades.filter((_, i) => i !== idx);
                            setOrcamentoData({...orcamentoData, atividades: newAt});
                          }} className="p-1.5 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={16} />
                          </button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CONSUMÍVEIS E MATERIAIS */}
              <div className="space-y-5">
                <div className="flex justify-between items-center pb-4 border-b-2 border-emerald-500/30">
                  <div>
                    <h4 className="text-xl font-black text-emerald-400 uppercase">Consumíveis e Materiais</h4>
                    <p className="text-white/30 text-xs mt-1">Produtos utilizados na execução</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setOrcamentoData({
                      ...orcamentoData,
                      consumiveis: [...orcamentoData.consumiveis, { item: '', descricao: '', precoUnitario: '', unidade: '', fator: '', quantidade: '', valorTotal: '' }]
                    })}
                    className="px-4 py-2.5 text-xs text-[#0b1220] bg-emerald-500 hover:bg-emerald-400 rounded-lg font-black uppercase transition shadow-lg shadow-emerald-500/30"
                  >
                    <Plus size={16} className="inline mr-2" /> Nova Linha
                  </button>
                </div>
                <div className="bg-[#0b1220]/50 rounded-2xl border border-emerald-500/10 overflow-hidden overflow-x-auto backdrop-blur">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-emerald-500/10 border-b border-emerald-500/20">
                        <th className="px-4 py-3 text-left text-emerald-300 font-black">Item</th>
                        <th className="px-4 py-3 text-left text-emerald-300 font-black">Descrição</th>
                        <th className="px-4 py-3 text-left text-emerald-300 font-black">Preço Unit</th>
                        <th className="px-4 py-3 text-left text-emerald-300 font-black">Unid</th>
                        <th className="px-4 py-3 text-left text-emerald-300 font-black">Fator</th>
                        <th className="px-4 py-3 text-left text-emerald-300 font-black">Quant</th>
                        <th className="px-4 py-3 text-left text-emerald-300 font-black">Valor Total</th>
                        <th className="px-4 py-3 text-center text-emerald-300 font-black w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orcamentoData.consumiveis.map((item, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-emerald-500/20 p-2 rounded text-white text-xs focus:border-emerald-500 outline-none" placeholder="1" value={item.item} onChange={e => {
                            const newCons = [...orcamentoData.consumiveis];
                            newCons[idx].item = e.target.value;
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-emerald-500/20 p-2 rounded text-white text-xs focus:border-emerald-500 outline-none" placeholder="Cabo aço" value={item.descricao} onChange={e => {
                            const newCons = [...orcamentoData.consumiveis];
                            newCons[idx].descricao = e.target.value;
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-emerald-500/20 p-2 rounded text-white text-xs focus:border-emerald-500 outline-none" placeholder="50" value={item.precoUnitario} onChange={e => {
                            const newCons = [...orcamentoData.consumiveis];
                            newCons[idx].precoUnitario = e.target.value;
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-emerald-500/20 p-2 rounded text-white text-xs focus:border-emerald-500 outline-none" placeholder="metro" value={item.unidade} onChange={e => {
                            const newCons = [...orcamentoData.consumiveis];
                            newCons[idx].unidade = e.target.value;
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-emerald-500/20 p-2 rounded text-white text-xs focus:border-emerald-500 outline-none" placeholder="1" value={item.fator} onChange={e => {
                            const newCons = [...orcamentoData.consumiveis];
                            newCons[idx].fator = e.target.value;
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-emerald-500/20 p-2 rounded text-white text-xs focus:border-emerald-500 outline-none" placeholder="100" value={item.quantidade} onChange={e => {
                            const newCons = [...orcamentoData.consumiveis];
                            newCons[idx].quantidade = e.target.value;
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-emerald-500/20 p-2 rounded text-white text-xs focus:border-emerald-500 outline-none font-bold text-emerald-400" placeholder="5000" value={item.valorTotal} onChange={e => {
                            const newCons = [...orcamentoData.consumiveis];
                            newCons[idx].valorTotal = e.target.value;
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} /></td>
                          <td className="px-4 py-3 text-center"><button onClick={() => {
                            const newCons = orcamentoData.consumiveis.filter((_, i) => i !== idx);
                            setOrcamentoData({...orcamentoData, consumiveis: newCons});
                          }} className="p-1.5 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={16} />
                          </button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SERVIÇOS TERCEIRIZADOS */}
              <div className="space-y-5">
                <div className="flex justify-between items-center pb-4 border-b-2 border-orange-500/30">
                  <div>
                    <h4 className="text-xl font-black text-orange-400 uppercase">Serviços Terceirizados</h4>
                    <p className="text-white/30 text-xs mt-1">Serviços contratados de terceiros</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setOrcamentoData({
                      ...orcamentoData,
                      servicos: [...orcamentoData.servicos, { item: '', descricao: '', valorTotal: '' }]
                    })}
                    className="px-4 py-2.5 text-xs text-[#0b1220] bg-orange-500 hover:bg-orange-400 rounded-lg font-black uppercase transition shadow-lg shadow-orange-500/30"
                  >
                    <Plus size={16} className="inline mr-2" /> Nova Linha
                  </button>
                </div>
                <div className="bg-[#0b1220]/50 rounded-2xl border border-orange-500/10 overflow-hidden overflow-x-auto backdrop-blur">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-orange-500/10 border-b border-orange-500/20">
                        <th className="px-4 py-3 text-left text-orange-300 font-black">Item</th>
                        <th className="px-4 py-3 text-left text-orange-300 font-black">Descrição</th>
                        <th className="px-4 py-3 text-left text-orange-300 font-black">Valor Total</th>
                        <th className="px-4 py-3 text-center text-orange-300 font-black w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orcamentoData.servicos.map((item, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-orange-500/20 p-2 rounded text-white text-xs focus:border-orange-500 outline-none" placeholder="1" value={item.item} onChange={e => {
                            const newServ = [...orcamentoData.servicos];
                            newServ[idx].item = e.target.value;
                            setOrcamentoData({...orcamentoData, servicos: newServ});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-orange-500/20 p-2 rounded text-white text-xs focus:border-orange-500 outline-none" placeholder="Pinturas exteriores" value={item.descricao} onChange={e => {
                            const newServ = [...orcamentoData.servicos];
                            newServ[idx].descricao = e.target.value;
                            setOrcamentoData({...orcamentoData, servicos: newServ});
                          }} /></td>
                          <td className="px-4 py-3"><input type="text" className="w-full bg-[#101f3d] border border-orange-500/20 p-2 rounded text-white text-xs focus:border-orange-500 outline-none font-bold text-orange-400" placeholder="3000" value={item.valorTotal} onChange={e => {
                            const newServ = [...orcamentoData.servicos];
                            newServ[idx].valorTotal = e.target.value;
                            setOrcamentoData({...orcamentoData, servicos: newServ});
                          }} /></td>
                          <td className="px-4 py-3 text-center"><button onClick={() => {
                            const newServ = orcamentoData.servicos.filter((_, i) => i !== idx);
                            setOrcamentoData({...orcamentoData, servicos: newServ});
                          }} className="p-1.5 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300">
                            <Trash2 size={16} />
                          </button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CUSTO TOTAL DIRETO */}
              <div className="bg-gradient-to-r from-[#0b1220] to-[#101f3d] p-8 rounded-2xl border border-red-500/20">
                <h4 className="text-2xl font-black text-red-400 uppercase mb-6">Resumo Financeiro</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">Valor Mão de Obra</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold focus:border-amber-500 outline-none"
                      value={orcamentoData.custoTotal.maoDeObra}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, maoDeObra: e.target.value}})}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">Consumível e Material</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold focus:border-emerald-500 outline-none"
                      value={orcamentoData.custoTotal.consumivel}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, consumivel: e.target.value}})}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">Valor Terceirizados</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold focus:border-orange-500 outline-none"
                      value={orcamentoData.custoTotal.servicosTerceirizados}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, servicosTerceirizados: e.target.value}})}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">Subtotal</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold focus:border-white/10 outline-none"
                      value={orcamentoData.custoTotal.total}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, total: e.target.value}})}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">O.H. %</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold outline-none"
                      value={orcamentoData.custoTotal.oh}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, oh: e.target.value}})}
                      placeholder="0%"
                    />
                  </div>
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">Margem %</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold outline-none"
                      value={orcamentoData.custoTotal.margem}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, margem: e.target.value}})}
                      placeholder="30%"
                    />
                  </div>
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">PV S/ Imposto</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold outline-none"
                      value={orcamentoData.custoTotal.pv}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, pv: e.target.value}})}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="bg-[#101f3d]/50 p-4 rounded-xl border border-white/5 backdrop-blur">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-2">Imposto 5,25%</label>
                    <input 
                      type="text"
                      className="w-full bg-[#0b1220] border border-white/10 p-2 rounded-lg text-white font-bold outline-none"
                      value={orcamentoData.custoTotal.imposto}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, imposto: e.target.value}})}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="md:col-span-4 bg-gradient-to-r from-yellow-900 to-yellow-800 p-5 rounded-xl border-2 border-yellow-500">
                    <label className="text-[9px] font-black text-yellow-200 uppercase tracking-widest block mb-2">PV Final R$</label>
                    <input 
                      type="text"
                      className="w-full bg-yellow-950 border-2 border-yellow-500 p-3 rounded-lg text-yellow-300 font-black text-lg outline-none"
                      value={orcamentoData.custoTotal.pvFinal}
                      onChange={e => setOrcamentoData({...orcamentoData, custoTotal: {...orcamentoData.custoTotal, pvFinal: e.target.value}})}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block">Observações e Notas</label>
                <textarea 
                  className={`${inputClass} h-20 resize-none`}
                  placeholder="Adicione observações importantes sobre o orçamento..."
                />
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="flex gap-4 pt-8 border-t border-white/10 sticky bottom-0 bg-gradient-to-t from-[#0b1220]">
                <button 
                  onClick={handleSaveOrcamento}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-[#0b1220] py-4 rounded-xl font-black uppercase text-sm tracking-widest hover:from-amber-400 hover:to-orange-400 transition-all shadow-2xl shadow-amber-900/30"
                >
                  Salvar Orçamento
                </button>
                <button 
                  onClick={() => setShowOrcamentoModal(false)}
                  className="px-8 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-black uppercase text-sm transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PROPOSTA */}
      {showPropostaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-white">Proposta Comercial</h3>
                <button onClick={() => setShowPropostaModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                  <X size={20} className="text-white/60"/>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Número da Proposta *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="Ex: PROP-001"
                      value={propostaData.numero}
                      onChange={e => setPropostaData({...propostaData, numero: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Valor Total *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      placeholder="R$ 0,00"
                      value={propostaData.valor}
                      onChange={e => setPropostaData({...propostaData, valor: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Condições de Pagamento</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Descreva as condições"
                    value={propostaData.condicoes}
                    onChange={e => setPropostaData({...propostaData, condicoes: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Prazo de Validade</label>
                  <input 
                    type="text"
                    className={inputClass}
                    placeholder="Ex: 30 dias"
                    value={propostaData.prazo}
                    onChange={e => setPropostaData({...propostaData, prazo: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Observações</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    placeholder="Observações gerais"
                    value={propostaData.observacoes}
                    onChange={e => setPropostaData({...propostaData, observacoes: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button 
                  onClick={handleSaveProposta}
                  className="flex-1 bg-cyan-500 text-[#0b1220] py-3 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-900/20"
                >
                  Criar Proposta
                </button>
                <button 
                  onClick={() => setShowPropostaModal(false)}
                  className="px-8 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-xs hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO NEGOCIANDO */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <TrendingUp className="text-amber-400" size={28} />
          <div>
            <h2 className="text-2xl font-black text-white">Negociando</h2>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Negociações em andamento</p>
          </div>
          <span className="ml-auto bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-black">
            {obras?.length || 0}
          </span>
        </div>

        {obras && obras.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {obras.map((obra: any) => {
              const cliente = listaClientes.find((c: any) => c.id === obra.clienteId);
              const osRelacionados = os?.filter((o: any) => o.obraId === obra.id) || [];
              
              return (
                <div 
                  key={obra.id}
                  className="bg-[#101f3d] border border-white/10 rounded-2xl p-6 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-900/20 transition-all"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-white uppercase line-clamp-2">{obra.nome}</h3>
                        <p className="text-amber-400 text-sm font-bold mt-1">{cliente?.razaoSocial || 'Cliente Desconhecido'}</p>
                      </div>
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-black whitespace-nowrap">
                        {obra.status}
                      </span>
                    </div>

                    {/* Detalhes */}
                    <div className="bg-[#0b1220] rounded-xl p-4 space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/50">Tipo:</span>
                        <span className="text-white font-bold">{obra.tipo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Responsável:</span>
                        <span className="text-white font-bold">{obra.responsavelTecnico}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Cadastrado em:</span>
                        <span className="text-white font-bold">{obra.dataCadastro}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-white/5">
                        <span className="text-white/50">OS(s):</span>
                        <span className="text-cyan-400 font-black">{osRelacionados.length}</span>
                      </div>
                    </div>

                    {/* Footer - Botão */}
                    <button 
                      onClick={() => {
                        setSelectedObra(obra);
                        setShowObraDetalhesModal(true);
                      }}
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0b1220] py-2.5 rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-amber-900/30">
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#101f3d] p-12 rounded-2xl border border-white/5 text-center py-16">
            <p className="text-white/40 text-sm">Clique em "Novo Negócio" acima para criar uma negociação</p>
          </div>
        )}
      </div>

      {/* MODAL DETALHES DA OBRA */}
      {showObraDetalhesModal && selectedObra && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white uppercase">{selectedObra.nome}</h2>
                <p className="text-white/50 text-sm mt-2">{listaClientes.find((c: any) => c.id === selectedObra.clienteId)?.razaoSocial || 'Cliente Desconhecido'}</p>
              </div>
              <button 
                onClick={() => setShowObraDetalhesModal(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-8 space-y-8">
              {/* Informações Gerais */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-amber-400 uppercase">Informações Gerais</h3>
                <div className="bg-[#0b1220] rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-white/50 text-sm font-bold">ID da Obra</p>
                      <p className="text-white text-lg font-black mt-2">{selectedObra.id}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm font-bold">Status</p>
                      <p className="text-amber-400 text-lg font-black mt-2">{selectedObra.status}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm font-bold">Tipo de Serviço</p>
                      <p className="text-white text-lg font-black mt-2">{selectedObra.tipo}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm font-bold">Data de Cadastro</p>
                      <p className="text-white text-lg font-black mt-2">{selectedObra.dataCadastro}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm font-bold">Responsável Técnico</p>
                      <p className="text-white text-lg font-black mt-2">{selectedObra.responsavelTecnico}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm font-bold">Orçamento</p>
                      <p className="text-white text-lg font-black mt-2">R$ {(selectedObra.orcamento || 0).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordens de Serviço Relacionadas */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-cyan-400 uppercase">Ordens de Serviço ({os?.filter((o: any) => o.obraId === selectedObra.id).length || 0})</h3>
                {os && os.filter((o: any) => o.obraId === selectedObra.id).length > 0 ? (
                  <div className="space-y-3">
                    {os.filter((o: any) => o.obraId === selectedObra.id).map((ordem: any) => (
                      <div key={ordem.id} className="bg-[#0b1220]/50 border border-cyan-500/20 rounded-lg p-4 hover:border-cyan-500/40 transition">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <p className="text-cyan-400 font-black text-sm">{ordem.id}</p>
                            <p className="text-white mt-1">{ordem.tipo}</p>
                            <p className="text-white/50 text-xs mt-2">Solicitante: {ordem.solicitante}</p>
                          </div>
                          <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs font-bold whitespace-nowrap">
                            {ordem.fase}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0b1220]/50 border border-white/5 rounded-lg p-6 text-center">
                    <p className="text-white/40 text-sm">Nenhuma OS criada para esta obra ainda</p>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button 
                  onClick={() => setShowObraDetalhesModal(false)}
                  className="flex-1 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Fechar
                </button>
                <button className="flex-1 bg-amber-500 text-[#0b1220] py-3 rounded-lg font-black uppercase text-sm hover:bg-amber-400 transition shadow-lg shadow-amber-900/20">
                  Editar Obra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
