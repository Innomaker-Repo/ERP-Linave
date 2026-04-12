import React, { useState, useEffect } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Plus, X, FileText, DollarSign, CheckCircle, Clock, ArrowRight, Edit2, ChevronDown, Zap, AlertCircle, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

const CLIENTES_MOCK = [
  {
    id: 'CLI-1',
    razaoSocial: 'Linave Construções LTDA',
    nomeFantasia: 'Linave',
    cnpj: '12.345.678/0001-90'
  },
  {
    id: 'CLI-2',
    razaoSocial: 'Construtora Alpha S.A.',
    nomeFantasia: 'Alpha Construtora',
    cnpj: '23.456.789/0001-01'
  },
  {
    id: 'CLI-3',
    razaoSocial: 'TC Engenharia e Consultoria',
    nomeFantasia: 'TC Engenharia',
    cnpj: '34.567.890/0001-12'
  },
  {
    id: 'CLI-4',
    razaoSocial: 'Projetos Marítimos LTDA',
    nomeFantasia: 'ProMar',
    cnpj: '45.678.901/0001-23'
  },
  {
    id: 'CLI-5',
    razaoSocial: 'Estaleiro Industrial do Sudeste',
    nomeFantasia: 'EISE',
    cnpj: '56.789.012/0001-34'
  }
];

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
  const [selectedObraDetalhes, setSelectedObraDetalhes] = useState<any>(null);
  const [showDetalhesObrraModal, setShowDetalhesObraModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingObra, setEditingObra] = useState<any>(null);
  const [expandedOrcamentosummary, setExpandedOrcamentoSummary] = useState(false);
  const [expandedPropostaDetalhes, setExpandedPropostaDetalhes] = useState(false);
  const [showPropostaFullModal, setShowPropostaFullModal] = useState(false);
  const [showOSFullModal, setShowOSFullModal] = useState(false);
  const [showOrcamentoFullModal, setShowOrcamentoFullModal] = useState(false);

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
    clienteId: '',
    cnpj: '',
    origemLead: '',
    solicitante: '',
    cargo: '',
    telefone: '',
    email: '',
    responsavelComercial: '',
    servicos: [{ ...initialServico, id: `servico-${Date.now()}` }],
    fase: 'Pre-Venda' as FaseOS,
    docs: {
      requisitos: false,
      proposta: false,
      orcamento: false
    }
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

  const handleSave = () => {
    if (!formData.clienteId || !formData.solicitante || formData.servicos.length === 0) {
      return alert("Cliente, Solicitante e pelo menos um Serviço são obrigatórios.");
    }

    if (!formData.servicos.some(s => s.descricao.trim())) {
      return alert("Pelo menos um serviço deve ter uma descrição.");
    }

    const novoProjetoId = `PROJ-${Date.now()}`;
    const nomeObra = (clientes || []).find(c => c.id === formData.clienteId)?.razaoSocial || 'Projeto';
    const primeiroServico = formData.servicos[0];

    const novaObra = {
      id: novoProjetoId,
      nome: `${primeiroServico.tipo || 'Projeto'} - ${primeiroServico.localExecucao || 'A Definir'}`,
      clienteId: formData.clienteId,
      status: 'Planejamento',
      categoria: 'Planejamento' as CategoriaObra,
      tipo: primeiroServico.tipo || 'Serviço',
      responsavelTecnico: formData.responsavelComercial || formData.solicitante,
      responsavelComercial: formData.responsavelComercial,
      solicitante: formData.solicitante,
      telefone: formData.telefone,
      email: formData.email,
      dataCadastro: new Date().toISOString().split('T')[0],
      origemOS: true,
      orcamento: 0,
      orcamentos: [],
      propostas: [],
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
      prazoDes: servico.prazoDes,
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
    setFormData(initialForm);
  };

  const handleShowDetalhes = (obra: any) => {
    setSelectedObraDetalhes(obra);
    setShowDetalhesObraModal(true);
    // Deixar o resumo financeiro sempre expandido quando abrir detalhes
    setExpandedOrcamentoSummary(true);
  };

  const handleEditObra = (obra: any) => {
    setEditingObra(obra);
    setShowEditModal(true);
  };

  const handleSaveEditObra = () => {
    if (!editingObra) return;

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

    const confirmacao = window.confirm("Tem certeza que deseja recusar este orçamento? Uma nova versão será criada automaticamente.");
    if (!confirmacao) return;

    if (!selectedObraDetalhes.orcamentos || selectedObraDetalhes.orcamentos.length === 0) return;

    const ultimoOrcamento = selectedObraDetalhes.orcamentos[selectedObraDetalhes.orcamentos.length - 1];
    
    // Marcar última versão como recusada
    const orcamentosAtualizados = selectedObraDetalhes.orcamentos.map((o: any, idx: number) => 
      idx === selectedObraDetalhes.orcamentos.length - 1 ? { ...o, status: 'recusado' as const } : o
    );

    // Criar nova versão copiando o conteúdo
    const novaVersao = orcamentosAtualizados.length + 1;
    const novoOrcamento = {
      versao: novaVersao,
      dataCriacao: new Date().toISOString().split('T')[0],
      status: 'pendente' as const,
      numeroOrcamento: `BM-${new Date().getFullYear()}-${String(novaVersao).padStart(3, '0')}`,
      data: ultimoOrcamento.data,
      valores: ultimoOrcamento.valores
    };

    const obraAtualizada = {
      ...selectedObraDetalhes,
      orcamentos: [...orcamentosAtualizados, novoOrcamento]
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === selectedObraDetalhes.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert("Orçamento recusado! Nova versão criada automaticamente.");
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
${ultimaProposta.escopoA || 'Não preenchido'}

B - Responsabilidade da Contratada:
${ultimaProposta.responsabilidadeContratada || 'Não preenchido'}

C - Responsabilidade da Contratante:
${ultimaProposta.escopoC || 'Não preenchido'}

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
    toast.success('💚 Ordem(ns) de Serviço enviada(s) com sucesso!');
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
          onClick={() => setShowFormNovoNegocio(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus size={18} className="inline mr-2" /> Novo Negócio
        </button>
      </div>

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-4 gap-6 min-h-[600px]">
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
            <div key={coluna.id} className={`rounded-2xl border ${corClasse} p-6 flex flex-col`}>
              {/* Header da Coluna */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
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
                    
                    // Compatibilidade com dados antigos: converter orcamentoRealizado em orcamentos array
                    let temOrcamento = obra.orcamentos && obra.orcamentos.length > 0;
                    let ultimoOrcamento = temOrcamento ? obra.orcamentos[obra.orcamentos.length - 1] : null;
                    
                    // Se não tem novo formato mas tem formato antigo, converter
                    if (!temOrcamento && obra.orcamentoRealizado && obra.orcamentoData && obra.orcamentoValores) {
                      temOrcamento = true;
                      ultimoOrcamento = {
                        versao: 1,
                        dataCriacao: obra.dataCadastro,
                        status: 'pendente',
                        numeroOrcamento: obra.orcamentoData.numeroOrcamento,
                        data: obra.orcamentoData,
                        valores: obra.orcamentoValores
                      };
                    }
                    
                    const podeEditar = obra.categoria === 'Planejamento';
                    const podAprovar = obra.categoria === 'Negociação' && temOrcamento;

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
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="font-black text-white text-sm line-clamp-2 flex-1">
                            {coluna.id === 'Planejamento' && '📋 '}
                            {coluna.id === 'Negociação' && temOrcamento && '💰 '}
                            {coluna.id === 'Em Andamento' && '🚀 '}
                            {coluna.id === 'Finalização' && '✅ '}
                            {obra.nome}
                          </h4>
                          {/* Badge + Botão Editar na Direita */}
                          <div className="flex items-center gap-1.5">
                            {/* Badge Orçado/Pendente */}
                            {coluna.id === 'Planejamento' && (
                              <>
                                {temOrcamento ? (
                                  <div className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-emerald-300 text-xs font-black">✓ Orçado</span>
                                  </div>
                                ) : (
                                  <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-amber-300 text-xs font-black">Aguardando orçamento</span>
                                  </div>
                                )}
                              </>
                            )}
                            {/* Botão Editar */}
                            {podeEditar && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditObra(obra);
                                }}
                                className="px-2.5 py-1 bg-gradient-to-r from-blue-500/30 to-blue-600/30 hover:from-blue-500/50 hover:to-blue-600/50 border border-blue-400/40 text-blue-300 hover:text-blue-200 rounded transition-all text-xs font-black uppercase tracking-wide"
                              >
                                <Edit2 size={13} className="inline mr-1" /> Editar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cliente */}
                        <p className="text-white/70 text-xs font-bold mb-2 truncate">
                          👥 {cliente?.razaoSocial}
                        </p>

                        {/* Responsável */}
                        {obra.responsavelComercial && (
                          <div className="text-xs text-white/50 mb-2 truncate">
                            👤 {obra.responsavelComercial}
                          </div>
                        )}

                        {/* Serviços Badge (apenas quantidade) */}
                        {obra.servicos && obra.servicos.length > 0 && (
                          <div className="text-xs font-bold mb-2">
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                              📦 {obra.servicos.length} serv.
                            </span>
                          </div>
                        )}

                        {/* Badge Proposta/Pendente em Negociação */}
                        {coluna.id === 'Negociação' && (
                          <>
                            {obra.propostas && obra.propostas.length > 0 ? (
                              <div className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded-full whitespace-nowrap mb-2">
                                <span className="text-cyan-300 text-xs font-black">✓ Proposta</span>
                              </div>
                            ) : (
                              <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap mb-2">
                                <span className="text-amber-300 text-xs font-black">Aguardando proposta</span>
                              </div>
                            )}
                          </>
                        )}


                        {coluna.id === 'Planejamento' && temOrcamento && ultimoOrcamento && (
                          <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-2.5 mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-emerald-400 text-xs font-black">💎 ORÇADO</p>
                              <span className="text-emerald-300 font-black text-xs">v{ultimoOrcamento.versao}</span>
                            </div>
                            <p className="text-emerald-200 font-black text-lg">
                              R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Resumo de Orçamento (apenas em Negociação - se ainda não tem proposta) */}
                        {coluna.id === 'Negociação' && temOrcamento && ultimoOrcamento && (!obra.propostas || obra.propostas.length === 0) && (
                          <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-2.5 mb-3">
                            <div className="flex justify-between items-center">
                              <p className="text-emerald-400 text-xs font-black">💎 Orçamento v{ultimoOrcamento.versao}</p>
                              <span className="text-emerald-300 font-black text-xs">R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {/* Resumo da Proposta (apenas em Negociação) */}
                        {coluna.id === 'Negociação' && obra.propostas && obra.propostas.length > 0 && (() => {
                          const ultimaProposta = obra.propostas[obra.propostas.length - 1];
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
                                  {ultimaProposta.status === 'pendente' && '📄 Proposta Pendente'}
                                  {ultimaProposta.status === 'aceita' && '✓ Proposta Aceita'}
                                  {ultimaProposta.status === 'recusada' && '✗ Proposta Recusada'}
                                </p>
                                <span className="text-xs font-black">v{ultimaProposta.versao}</span>
                              </div>
                              {ultimaProposta.preco && (
                                <p className="text-xs text-white/80 mt-1">Preço: {ultimaProposta.preco}</p>
                              )}
                            </div>
                          );
                        })()}

                        {/* Badge de Status da OS em 'Em Andamento' */}
                        {coluna.id === 'Em Andamento' && (() => {
                          const osDoNegocio = (os || []).filter((o: any) => o.obraId === obra.id);
                          if (osDoNegocio.length === 0) return null;
                          const osEnviada = osDoNegocio.some((o: any) => o.statusEnvio === 'enviada');
                          return (
                            <div className="mb-3 px-2 py-1 rounded-full whitespace-nowrap w-fit">
                              {osEnviada ? (
                                <span className="bg-green-500/30 border border-green-500/50 text-green-300 text-xs font-black px-2 py-1 rounded-full">✓ OS Enviada</span>
                              ) : (
                                <span className="bg-orange-500/30 border border-orange-500/50 text-orange-300 text-xs font-black px-2 py-1 rounded-full">⏳ OS Pendente</span>
                              )}
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
              
              {/* SEÇÃO 1: DADOS PRINCIPAIS */}
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
                      <option value="Servinave">Servinave</option>
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

                <div className="grid grid-cols-3 gap-4 mb-4">
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

                  <div className="space-y-1.5">
                    <label className={labelClass}>Responsável Comercial</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.responsavelComercial}
                      onChange={e => setFormData({...formData, responsavelComercial: e.target.value})}
                      placeholder="Nome"
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
              </div>

              {/* SEÇÃO 2: SERVIÇOS */}
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

              {/* BOTÕES */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30"
                >
                  ✓ Criar Negócio
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
                    <p className="text-white/50 text-xs mb-1">Data Cadastro</p>
                    <p className="text-white font-bold">{selectedObraDetalhes.dataCadastro}</p>
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
                          {servico.embarcacao && <span>🚢 {servico.embarcacao}</span>}
                          {servico.localExecucao && <span>📍 {servico.localExecucao}</span>}
                          {servico.porto && <span>⚓ {servico.porto}</span>}
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
                      <h3 className="text-emerald-400 font-black text-lg">💰 RESUMO DO ORÇAMENTO (v{ultimoOrcamento.versao})</h3>
                      <ChevronDown size={20} className={`text-emerald-400 transition-transform ${expandedOrcamentosummary ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Resumo Financeiro (Sempre Visível) */}
                    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-4 border border-amber-500/30 space-y-2">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">Subtotal:</span>
                        <span className="text-white font-black">R$ {ultimoOrcamento.valores.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">Margem ({ultimoOrcamento.valores.margem}%):</span>
                        <span className="text-white font-black">R$ {((ultimoOrcamento.valores.subtotal * ultimoOrcamento.valores.margem) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-amber-500/20 mb-3">
                        <span className="text-white font-bold">Impostos ({ultimoOrcamento.valores.impostos}%):</span>
                        <span className="text-white font-black">R$ {(((ultimoOrcamento.valores.subtotal + (ultimoOrcamento.valores.subtotal * ultimoOrcamento.valores.margem) / 100) * ultimoOrcamento.valores.impostos) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-amber-300 font-black text-lg">PREÇO FINAL:</span>
                        <span className="text-amber-300 font-black text-2xl">R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}</span>
                      </div>
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
                          <h4 className="text-white font-black text-sm">👷 MÃO DE OBRA</h4>
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
                          <h4 className="text-white font-black text-sm">📦 MATERIAIS</h4>
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
                          <h4 className="text-white font-black text-sm">🤝 SERVIÇOS TERCEIRIZADOS</h4>
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

              {/* RESUMO DA PROPOSTA (apenas em Negociação) */}
              {selectedObraDetalhes.categoria === 'Negociação' && selectedObraDetalhes.propostas && selectedObraDetalhes.propostas.length > 0 && (() => {
                const ultimaProposta = selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1];
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
                        {ultimaProposta.status === 'pendente' && '📄 PROPOSTA'}
                        {ultimaProposta.status === 'aceita' && '✓ PROPOSTA ACEITA'}
                        {ultimaProposta.status === 'recusada' && '✗ PROPOSTA RECUSADA'}
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
                            {ultimaProposta.status === 'pendente' && '⏳ Pendente'}
                            {ultimaProposta.status === 'aceita' && '✓ Aceita'}
                            {ultimaProposta.status === 'recusada' && '✗ Recusada'}
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

              {/* SEÇÃO OS - Apenas se estiver em Em Andamento E tiver OS criada */}
              {selectedObraDetalhes.categoria === 'Em Andamento' && (() => {
                const osDoNegocio = (os || []).filter(o => o.obraId === selectedObraDetalhes.id);
                if (osDoNegocio.length === 0) return null;
                
                const primeiraOS = osDoNegocio[0];
                const osEnviada = osDoNegocio.some((o: any) => o.statusEnvio === 'enviada');
                return (
                  <div className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl p-6 border border-purple-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-purple-400 font-black text-lg">📋 ORDEM DE SERVIÇO ({osDoNegocio.length})</h3>
                      <div className="flex items-center gap-2">
                        {osEnviada ? (
                          <span className="px-3 py-1 bg-green-500/30 border border-green-500/50 rounded-full text-green-300 text-xs font-black">✓ OS Enviada</span>
                        ) : (
                          <span className="px-3 py-1 bg-orange-500/30 border border-orange-500/50 rounded-full text-orange-300 text-xs font-black">⏳ OS Pendente</span>
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
                {selectedObraDetalhes.categoria === 'Negociação' && selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (
                  <button 
                    onClick={handleAprovarOrcamento}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                  >
                    <Zap size={18} /> Aprovar e Iniciar
                  </button>
                )}
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
                  <h3 className="text-white font-black text-lg">📋 INFORMAÇÕES BÁSICAS</h3>
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
                          {ultimaProposta.status === 'pendente' && '⏳ Pendente'}
                          {ultimaProposta.status === 'aceita' && '✓ Aceita'}
                          {ultimaProposta.status === 'recusada' && '✗ Recusada'}
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
                  <h3 className="text-white font-black text-lg">👤 CONTATO E REFERÊNCIAS</h3>
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
                  <h3 className="text-white font-black text-lg">📝 ASSUNTO E ABERTURA</h3>
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
                  <h3 className="text-white font-black text-lg">🎯 ESCOPOS DE SERVIÇOS</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">A - Escopo Básico de Serviços</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.escopoA || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">B - Responsabilidade da Contratada</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.responsabilidadeContratada || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">C - Responsabilidade da Contratante</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.escopoC || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Condições Comerciais */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                  <h3 className="text-white font-black text-lg">💼 CONDIÇÕES COMERCIAIS</h3>
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
                  <h3 className="text-white font-black text-lg">📚 REFERÊNCIAS E ENCERRAMENTO</h3>
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
                  <h3 className="text-white font-black text-lg">✍️ ASSINATURA</h3>
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
                  <h3 className="text-white font-black text-lg">📋 NEGÓCIO</h3>
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
                  <p className="text-white/50 text-sm mt-2">Versão {ultimoOrcamento.versao} • {ultimoOrcamento.numeroOrcamento}</p>
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
                  <h3 className="text-white font-black text-lg">📋 INFORMAÇÕES BÁSICAS</h3>
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
                  <h3 className="text-amber-400 font-black text-lg">💰 RESUMO FINANCEIRO</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Subtotal:</span>
                      <span className="text-white font-black">R$ {ultimoOrcamento.valores.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Margem ({ultimoOrcamento.valores.margem}%):</span>
                      <span className="text-white font-black">R$ {((ultimoOrcamento.valores.subtotal * ultimoOrcamento.valores.margem) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-amber-500/20">
                      <span className="text-white font-bold">Impostos ({ultimoOrcamento.valores.impostos}%):</span>
                      <span className="text-white font-black">R$ {(((ultimoOrcamento.valores.subtotal + (ultimoOrcamento.valores.subtotal * ultimoOrcamento.valores.margem) / 100) * ultimoOrcamento.valores.impostos) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-amber-300 font-black text-lg">PREÇO FINAL:</span>
                      <span className="text-amber-300 font-black text-2xl">R$ {ultimoOrcamento.valores.precoFinal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Mão de Obra */}
                {ultimoOrcamento.data.maoDeObra && ultimoOrcamento.data.maoDeObra.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-black text-lg">👷 MÃO DE OBRA</h3>
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
                    <h3 className="text-white font-black text-lg">📦 MATERIAIS</h3>
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
                    <h3 className="text-white font-black text-lg">🤝 SERVIÇOS TERCEIRIZADOS</h3>
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

            <div className="p-8 space-y-6">
              
              {/* Informações para editar */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6 space-y-4">
                <h3 className="text-lg font-black text-white uppercase">Dados do Negócio</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Nome do Negócio</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.nome}
                      onChange={e => setEditingObra({...editingObra, nome: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Cliente</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={(clientes || []).find(c => c.id === editingObra.clienteId)?.razaoSocial || ''}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Responsável Técnico</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.responsavelTecnico}
                      onChange={e => setEditingObra({...editingObra, responsavelTecnico: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Responsável Comercial</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.responsavelComercial}
                      onChange={e => setEditingObra({...editingObra, responsavelComercial: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Tipo de Serviço</label>
                  <input 
                    type="text"
                    className={inputClass}
                    value={editingObra.tipo}
                    onChange={e => setEditingObra({...editingObra, tipo: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Contato</label>
                  <div className="grid grid-cols-2 gap-3">
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
              </div>

              {/* Botões */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button 
                  onClick={handleSaveEditObra}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-blue-900/30"
                >
                  💾 Salvar Alterações
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
