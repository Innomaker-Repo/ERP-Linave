import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { 
  Anchor, Plus, Calendar, DollarSign, Users, User, Save, X, Edit2, Trash2, 
  FileText, Briefcase, Activity, Hash, FolderOpen, Download, Link as LinkIcon, CheckCircle2, ChevronDown, ChevronRight, Eye
} from 'lucide-react';

const A_SER_INCLUIDO_LABELS: Record<string, string> = {
  certificadoGas: 'Certificado de Gás Free',
  ventilacao: 'Ventilação',
  limpezaAntes: 'Limpeza antes',
  limpezaApos: 'Limpeza após conclusão',
  andaimes: 'Andaimes',
  apoioGuindastes: 'Apoio de guindaste',
  transporteExterno: 'Transporte externo',
  testesPressao: 'Testes de pressão',
  pintura: 'Pintura',
  lpPm: 'LP / PM',
  testeUltrassom: 'Teste de ultrassom',
  inspecaoDimensional: 'Inspeção dimensional',
  visualSolda: 'Visual de solda',
  soldadorCertificado: 'Soldador certificado',
  procedimentoSolda: 'Procedimento de solda',
  certificacaoMaterial: 'Certificação do material',
  vigiaFogo: 'Vigia de fogo'
};

// A exportação tem de ser assim para o App.tsx encontrar
export function ObrasView({ searchQuery }: { searchQuery: string }) {
  const { obras, clientes, funcionarios, equipes, os, saveEntity } = useErp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'docs'>('geral');
  const [showOSConsolidadaModal, setShowOSConsolidadaModal] = useState(false);
  const [selectedOSConsolidada, setSelectedOSConsolidada] = useState<any>(null);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({
    'Comercial': true,
    'Engenharia': true,
    'Fabricacao': false,
    'Operacao': false,
    'PosVenda': false
  });

  const togglePhase = (phase: string) => setOpenPhases(prev => ({...prev, [phase]: !prev[phase]}));

  const initialForm = {
    nome: '', tipo: 'Obra', clienteId: '', status: 'Planejamento',
    inicioPrevisto: '', fimPrevisto: '', responsavelTecnico: '', equipeId: '',
    valorPrevisto: '', centroCusto: '', descricao: '',
    docs: {} as Record<string, string>
  };

  const [formData, setFormData] = useState(initialForm);

  const mapaDocumental = {
    'Comercial': [
      { nome: 'Relatório de Requisitos do Cliente', key: 'req_cliente', tipo: 'Pré-Venda' },
      { nome: 'Plano de Trabalho do Edital', key: 'plano_edital', tipo: 'Análise Edital' },
      { nome: 'Proposta Final', key: 'proposta_final', tipo: 'Venda' },
      { nome: 'Contrato de Prestação de Serviço', key: 'contrato', tipo: 'Venda' },
    ],
    'Engenharia': [
      { nome: 'Termo de Abertura (TAP)', key: 'tap', tipo: 'Plano Serviço' },
      { nome: 'Escopo do Projeto', key: 'escopo', tipo: 'Plano Serviço' },
      { nome: 'Matriz de Riscos', key: 'matriz_risco', tipo: 'Plano Serviço' },
      { nome: 'Matriz de Rastreabilidade', key: 'matriz_rastreabilidade', tipo: 'Plano Serviço' },
      { nome: 'Plano de Projeto', key: 'plano_projeto', tipo: 'Ante Projeto' },
      { nome: 'Solicitação de Contratação', key: 'solic_contratacao', tipo: 'Ante Projeto' },
      { nome: 'Solicitação de Capacitação', key: 'solic_capacitacao', tipo: 'Ante Projeto' },
      { nome: 'Memorial Descritivo', key: 'memorial', tipo: 'Projeto' },
      { nome: 'Estrutura Analítica (EAP)', key: 'eap', tipo: 'Projeto' },
      { nome: 'Cronograma de Execução', key: 'cronograma', tipo: 'Projeto' },
      { nome: 'BOM (Lista de Materiais)', key: 'bom', tipo: 'Projeto' },
      { nome: 'Lista de Compra', key: 'lista_compra', tipo: 'Projeto' },
      { nome: 'Validação com Cliente', key: 'validacao_cliente', tipo: 'Projeto' },
    ],
    'Fabricacao': [
      { nome: 'Relatório de Teste', key: 'relatorio_teste', tipo: 'Qualidade' },
      { nome: 'Relatório de Falha', key: 'relatorio_falha', tipo: 'Controle' },
      { nome: 'Conclusão de Atividade', key: 'conclusao_atividade', tipo: 'Execução' },
    ],
    'Operacao': [
      { nome: 'Plano de Prestação de Serviço', key: 'plano_servico', tipo: 'Planejamento' },
      { nome: 'Relatório Pós-Operacional', key: 'rel_pos_op', tipo: 'Execução' },
      { nome: 'Dados Brutos Tratados', key: 'dados_tratados', tipo: 'Entrega' },
      { nome: 'Relatório Gastos (Planejado x Real)', key: 'rel_gastos', tipo: 'Controle' },
    ],
    'PosVenda': [
      { nome: 'Termo de Conclusão Assinado', key: 'termo_conclusao', tipo: 'Encerramento' },
    ]
  };

  const listaObras = Array.isArray(obras) ? obras : [];
  const listaClientes = Array.isArray(clientes) ? clientes : [];
  const listaFuncionarios = Array.isArray(funcionarios) ? funcionarios : [];
  const listaEquipes = Array.isArray(equipes) ? equipes : [];
  const listaOS = Array.isArray(os) ? os : [];

  const handleOpenForm = (obra: any = null) => {
    setActiveTab('geral');
    if (obra) { setFormData(obra); setEditingId(obra.id); } 
    else { setFormData(initialForm); setEditingId(null); }
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.nome || !formData.clienteId) return alert("Nome e Cliente são obrigatórios.");
    let novaLista = editingId 
      ? listaObras.map((o: any) => o.id === editingId ? { ...formData, id: editingId } : o)
      : [...listaObras, { ...formData, id: `OBR-${Date.now()}` }];
    saveEntity('obras', novaLista);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir obra?")) saveEntity('obras', listaObras.filter((o: any) => o.id !== id));
  };

  const updateDocLink = (key: string, value: string) => {
    setFormData({
      ...formData,
      docs: { ...formData.docs, [key]: value }
    });
  };

  const isOsDisponivelProducao = (item: any) => {
    if (!item?.obraId) return false;
    return (
      item.statusEnvio === 'enviada' ||
      item.tipoDocumento === 'consolidada' ||
      item.statusOs === 'emproducao' ||
      item.statusOs === 'concluida'
    );
  };

  const obrasComOSEnviada = new Set(
    listaOS
      .filter((item: any) => isOsDisponivelProducao(item))
      .map((item: any) => item.obraId)
  );

  const filtradas = listaObras.filter((o: any) => {
    const termo = (searchQuery || '').toLowerCase();
    const clienteNome = (listaClientes.find((c: any) => c.id === o.clienteId)?.razaoSocial || '').toLowerCase();
    const correspondeBusca = !termo ||
      (o.nome || '').toLowerCase().includes(termo) ||
      clienteNome.includes(termo);

    return correspondeBusca && obrasComOSEnviada.has(o.id);
  });

  const formatDocSize = (bytes?: number) => {
    if (!bytes) return 'Tamanho não informado';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const listarItensASerIncluido = (aSerIncluido?: Record<string, boolean>) => {
    if (!aSerIncluido) return [];
    return Object.keys(aSerIncluido)
      .filter((key) => aSerIncluido[key])
      .map((key) => A_SER_INCLUIDO_LABELS[key] || key);
  };

  const normalizarEscopoBasicoServicos = (proposta?: any) => {
    if (Array.isArray(proposta?.escopoBasicoServicos)) {
      return proposta.escopoBasicoServicos;
    }

    const textoEscopo = typeof proposta?.escopoBasicoServicos === 'string'
      ? proposta.escopoBasicoServicos.trim()
      : '';

    if (!textoEscopo) {
      return [];
    }

    return [
      {
        id: 'escopo-basico-texto',
        servicoId: 'escopo-basico-texto',
        titulo: proposta?.escopoA || 'A - Escopo Básico de Serviços',
        descricaoServico: textoEscopo.split('\n')[0] || textoEscopo,
        texto: textoEscopo,
        colunas: ['Descrição'],
        linhas: [
          {
            id: 'linha-1',
            valores: { Descrição: textoEscopo }
          }
        ]
      }
    ];
  };

  const construirResumoConsolidado = (item: any) => {
    const obraRelacionada = listaObras.find((obra: any) => obra.id === item?.obraId);
    const orcamentoBase = (Array.isArray(obraRelacionada?.orcamentos) && obraRelacionada.orcamentos.length > 0)
      ? obraRelacionada.orcamentos[obraRelacionada.orcamentos.length - 1]
      : (Array.isArray(item?.orcamentos) && item.orcamentos.length > 0)
        ? item.orcamentos[item.orcamentos.length - 1]
        : null;
    const propostaBase = (Array.isArray(obraRelacionada?.propostas) && obraRelacionada.propostas.length > 0)
      ? obraRelacionada.propostas[obraRelacionada.propostas.length - 1]
      : (Array.isArray(item?.propostas) && item.propostas.length > 0)
        ? item.propostas[item.propostas.length - 1]
        : null;

    const servicosDoNegocio = Array.isArray(obraRelacionada?.servicos)
      ? obraRelacionada.servicos
      : Array.isArray(item?.servicos)
        ? item.servicos
        : [];

    const dadosServicos = Array.isArray(orcamentoBase?.data?.dadosServicos) && orcamentoBase.data.dadosServicos.length > 0
      ? orcamentoBase.data.dadosServicos
      : servicosDoNegocio.map((servico: any, idx: number) => ({
          ordem: idx + 1,
          tipo: servico.tipo || 'Serviço',
          categoria: servico.categoria || '',
          embarcacao: servico.embarcacao || '',
          localExecucao: servico.localExecucao || '',
          porto: servico.porto || '',
          prazoDes: servico.prazoDes || '',
          descricao: servico.descricao || '',
          observacoes: servico.observacoes || ''
        }));

    return {
      negocio: {
        nome: item?.projeto || obraRelacionada?.nome || '',
        solicitante: obraRelacionada?.solicitante || orcamentoBase?.data?.solicitante || '',
        responsavelComercial: obraRelacionada?.responsavelComercial || orcamentoBase?.data?.responsavelComercial || '',
        responsavelTecnico: obraRelacionada?.responsavelTecnico || '',
        dataSolicitacao: obraRelacionada?.dataSolicitacao || obraRelacionada?.dataCadastro || orcamentoBase?.dataCriacao || '',
        servicos: servicosDoNegocio.map((servico: any, idx: number) => ({
          ordem: idx + 1,
          tipo: servico.tipo || 'Serviço',
          categoria: servico.categoria || '',
          localExecucao: servico.localExecucao || '',
          porto: servico.porto || '',
          descricao: servico.descricao || '',
          observacoes: servico.observacoes || ''
        }))
      },
      orcamento: {
        numeroOrcamento: orcamentoBase?.numeroOrcamento || '',
        versao: orcamentoBase?.versao || '',
        dataCriacao: orcamentoBase?.dataCriacao || '',
        escopoOrcamento: orcamentoBase?.data?.escopoOrcamento || '',
        documentosReferencia: orcamentoBase?.data?.documentosReferencia || '',
        dadosServicos,
        maoDeObra: Array.isArray(orcamentoBase?.data?.maoDeObra)
          ? orcamentoBase.data.maoDeObra.map((itemMao: any) => ({
              funcao: itemMao.funcao || '',
              quantidade: itemMao.quantidade || '',
              dias: itemMao.dias || '',
              observacao: itemMao.observacao || ''
            }))
          : [],
        atividades: Array.isArray(orcamentoBase?.data?.atividades)
          ? orcamentoBase.data.atividades.map((atividade: any) => ({
              atividade: atividade.atividade || '',
              dias: atividade.dias || '',
              observacao: atividade.observacao || ''
            }))
          : [],
        materiais: Array.isArray(orcamentoBase?.data?.materiais)
          ? orcamentoBase.data.materiais.map((material: any) => ({
              descricao: material.descricao || '',
              unidade: material.unidade || '',
              quantidade: material.quantidade || '',
              pesoFator: material.pesoFator || '',
              observacao: material.observacao || '',
              origemTerceiros: material.origemTerceiros || ''
            }))
          : [],
        terceirizados: Array.isArray(orcamentoBase?.data?.terceirizados)
          ? orcamentoBase.data.terceirizados.map((terceirizado: any) => ({
              descricao: terceirizado.descricao || '',
              unidade: terceirizado.unidade || '',
              quantidade: terceirizado.quantidade || '',
              pesoFator: terceirizado.pesoFator || '',
              observacao: terceirizado.observacao || ''
            }))
          : [],
        observacoes: orcamentoBase?.data?.observacoes || ''
      },
      proposta: {
        numeroProposta: propostaBase?.numeroProposta || '',
        versao: propostaBase?.versao || '',
        status: propostaBase?.status || '',
        dataCriacao: propostaBase?.dataCriacao || '',
        assunto: propostaBase?.assunto || '',
        textoAbertura: propostaBase?.textoAbertura || '',
        escopoA: propostaBase?.escopoA || propostaBase?.escopoBasicoServicos || '',
        escopoBasicoServicos: normalizarEscopoBasicoServicos(propostaBase),
        responsabilidadeContratada: propostaBase?.responsabilidadeContratada || '',
        escopoC: propostaBase?.escopoC || '',
        referencias: propostaBase?.referencias || '',
        condicoesGerais: propostaBase?.condicoesGerais || '',
        condicoesPagamento: propostaBase?.condicoesPagamento || '',
        prazo: propostaBase?.prazo || '',
        encerramento: propostaBase?.encerramento || '',
        assinaturaNome: propostaBase?.assinaturaNome || '',
        assinaturaCargo: propostaBase?.assinaturaCargo || ''
      }
    };
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

  const handleVerDocumento = (doc: any) => {
    const href = doc?.conteudo || doc?.url;
    if (!href) {
      alert('Documento indisponível para visualização.');
      return;
    }

    if (href.startsWith('data:')) {
      const blob = dataUrlToBlob(href);
      if (!blob) {
        alert('Falha ao abrir documento.');
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      return;
    }

    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleVisualizarOSConsolidada = (item: any) => {
    const resumoConsolidado = construirResumoConsolidado(item);
    setSelectedOSConsolidada({
      ...item,
      cliente: item?.cliente || listaClientes.find((cliente: any) => cliente.id === item?.clienteId)?.razaoSocial || '-',
      projeto: item?.projeto || listaObras.find((obra: any) => obra.id === item?.obraId)?.nome || '-',
      dataInicioPrevisto: item?.dataInicioPrevisto || item?.inicioPrevisto || listaObras.find((obra: any) => obra.id === item?.obraId)?.dataPrevistaInicio || '-',
      dataTerminoPrevisto: item?.dataTerminoPrevisto || item?.fimPrevisto || listaObras.find((obra: any) => obra.id === item?.obraId)?.dataPrevistaFinal || '-',
      descricaoGeralServico: item?.descricaoGeralServico || resumoConsolidado.orcamento.escopoOrcamento || resumoConsolidado.negocio.servicos.map((servico: any) => servico.descricao).filter(Boolean).join('\n') || '',
      resumoConsolidado
    });
    setShowOSConsolidadaModal(true);
  };

  const inputClass = "w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelClass = "text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 mb-2 block";

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            <Anchor className="text-amber-500" size={32} /> Gestão de Projetos
          </h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mt-2 ml-1">Serviços (Produção): apenas negócios com OS enviada</p>
        </div>
      </div>

      {/* FORMULÁRIO COM ABAS */}
      {showForm && (
        <div className="bg-[#101f3d] p-10 rounded-[48px] border border-amber-500/30 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-white uppercase italic">{editingId ? 'Painel do Projeto' : 'Novo Projeto'}</h3>
            <button onClick={() => setShowForm(false)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 text-white transition-all"><X size={20} /></button>
          </div>

          <div className="flex gap-4 mb-8 border-b border-white/5 pb-4">
            <button onClick={() => setActiveTab('geral')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'geral' ? 'bg-amber-500 text-[#0b1220]' : 'text-white/40 hover:text-white'}`}>Dados Gerais</button>
            <button onClick={() => setActiveTab('docs')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'docs' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white'}`}>Documentação & Processos</button>
          </div>

          {activeTab === 'geral' ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in slide-in-from-left-4">
              <div className="xl:col-span-8 space-y-6">
                <div className="bg-[#0b1220]/50 p-8 rounded-[32px] border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Nome do Projeto *</label>
                    <input className={inputClass} value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Ex: USV Traveller V2" />
                  </div>
                  <div>
                    <label className={labelClass}>Cliente *</label>
                    <select className={`${inputClass} appearance-none cursor-pointer`} value={formData.clienteId} onChange={e => setFormData({...formData, clienteId: e.target.value})}>
                      <option value="">Selecione...</option>
                      {listaClientes.map((c: any) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Fase Atual</label>
                    <select className={`${inputClass} appearance-none cursor-pointer`} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option>Pré-Venda</option><option>Anteprojeto</option><option>Projeto</option><option>Fabricação</option><option>Teste</option><option>Operação</option><option>Pós Venda</option>
                    </select>
                  </div>
                </div>
                <div className="bg-[#0b1220]/50 p-8 rounded-[32px] border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className={labelClass}>Responsável Técnico</label>
                      <select className={`${inputClass} appearance-none cursor-pointer`} value={formData.responsavelTecnico} onChange={e => setFormData({...formData, responsavelTecnico: e.target.value})}>
                        <option value="">Selecione...</option>
                        {listaFuncionarios.map((f: any) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className={labelClass}>Equipe</label>
                      <select className={`${inputClass} appearance-none cursor-pointer`} value={formData.equipeId} onChange={e => setFormData({...formData, equipeId: e.target.value})}>
                        <option value="">Selecione...</option>
                        {listaEquipes.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                      </select>
                   </div>
                </div>
              </div>

              <div className="xl:col-span-4 space-y-6">
                <div className="bg-[#0b1220]/50 p-8 rounded-[32px] border border-white/5 space-y-4">
                   <div><label className={labelClass}>Início</label><input type="date" className={inputClass} value={formData.inicioPrevisto} onChange={e => setFormData({...formData, inicioPrevisto: e.target.value})} /></div>
                   <div><label className={labelClass}>Fim</label><input type="date" className={inputClass} value={formData.fimPrevisto} onChange={e => setFormData({...formData, fimPrevisto: e.target.value})} /></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-right-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {Object.entries(mapaDocumental).map(([fase, docs]) => (
                <div key={fase} className="bg-[#0b1220]/30 rounded-[24px] border border-white/5 overflow-hidden">
                  <button onClick={() => togglePhase(fase)} className="w-full flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-white font-bold uppercase tracking-widest text-sm">{fase}</span>
                    </div>
                    {openPhases[fase] ? <ChevronDown size={16} className="text-white/40"/> : <ChevronRight size={16} className="text-white/40"/>}
                  </button>

                  {openPhases[fase] && (
                    <div className="p-6 space-y-3">
                      {docs.map((doc: any) => (
                        <div key={doc.key} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-[#0b1220] rounded-xl border border-white/5 hover:border-white/10 transition-all">
                          <div className="flex-1">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">{doc.tipo}</p>
                            <p className="text-white font-bold text-xs">{doc.nome}</p>
                          </div>
                          <div className="flex-1 w-full relative group">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-500" size={12} />
                            <input className="w-full bg-[#101f3d] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-blue-500 transition-all placeholder:text-white/20" value={(formData.docs as any)[doc.key] || ''} onChange={(e) => updateDocLink(doc.key, e.target.value)} placeholder="Link do Documento..." />
                          </div>
                          <div className="w-6 flex justify-center">
                            {(formData.docs as any)[doc.key] ? <CheckCircle2 className="text-amber-500" size={16} /> : <div className="w-4 h-4 rounded-full border border-white/10"></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4 mt-8 pt-8 border-t border-white/5">
            <button onClick={handleSave} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"><Save size={18}/> {editingId ? 'Salvar Alterações' : 'Cadastrar Projeto'}</button>
            <button onClick={() => setShowForm(false)} className="px-10 bg-white/5 hover:bg-white/10 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all">Cancelar</button>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filtradas.length > 0 ? filtradas.map((o: any) => {
            const cliente = listaClientes.find((c: any) => c.id === o.clienteId);
            const docsEntregues = o.docs ? Object.values(o.docs).filter(Boolean).length : 0;
            const osDoNegocio = listaOS.filter((item: any) => item.obraId === o.id && isOsDisponivelProducao(item));
            const totalOSEnviada = osDoNegocio.length;
            const osConsolidadaEnviada = osDoNegocio.find((item: any) => item.tipoDocumento === 'consolidada') || osDoNegocio[0];
            return (
              <div key={o.id} className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 hover:border-amber-500/20 transition-all">
                <div className="flex justify-between items-start mb-6"><div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500"><Anchor size={28} /></div><span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/40">{o.status}</span></div>
                <h3 className="text-xl font-black text-white uppercase italic mb-1">{o.nome}</h3>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Cliente: <span className="text-white">{cliente?.razaoSocial || 'N/A'}</span></p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#0b1220] p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">Solicitante</p>
                    <p className="text-white text-xs font-bold truncate">{o.solicitante || '-'}</p>
                  </div>
                  <div className="bg-[#0b1220] p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">Responsável Comercial</p>
                    <p className="text-white text-xs font-bold truncate">{o.responsavelComercial || '-'}</p>
                  </div>
                  <div className="bg-[#0b1220] p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">Contato</p>
                    <p className="text-white text-xs font-bold truncate">{o.telefone || '-'} {o.email ? `| ${o.email}` : ''}</p>
                  </div>
                  <div className="bg-[#0b1220] p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">Data da Solicitação</p>
                    <p className="text-white text-xs font-bold">{o.dataSolicitacao || o.dataCadastro || '-'}</p>
                  </div>
                </div>

                {Array.isArray(o.servicos) && o.servicos.length > 0 && (
                  <div className="bg-[#0b1220] p-3 rounded-xl border border-white/5 mb-4">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-2">Detalhes do Negócio</p>
                    <div className="space-y-1.5">
                      {o.servicos.slice(0, 3).map((servico: any, idx: number) => (
                        <p key={`${o.id}-srv-${idx}`} className="text-white/80 text-xs truncate">
                          {servico.tipo || 'Serviço'} - {servico.localExecucao || 'Local não informado'}
                        </p>
                      ))}
                      {o.servicos.length > 3 && (
                        <p className="text-white/40 text-xs">+{o.servicos.length - 3} serviço(s)</p>
                      )}
                    </div>
                  </div>
                )}

                {Array.isArray(o.documentosNegocio) && o.documentosNegocio.length > 0 && (
                  <div className="bg-[#0b1220] p-3 rounded-xl border border-white/5 mb-4">
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-2">Documentos do Negócio ({o.documentosNegocio.length})</p>
                    <div className="space-y-2">
                      {o.documentosNegocio.map((doc: any) => (
                        <div key={doc.id || doc.nome} className="flex items-center justify-between gap-2 bg-[#101f3d] border border-white/10 rounded-lg p-2">
                          <div className="min-w-0">
                            <p className="text-white text-xs font-bold truncate">{doc.nome || 'Documento'}</p>
                            <p className="text-white/40 text-[10px]">{formatDocSize(doc.tamanho)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVerDocumento(doc)}
                              className="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-black uppercase"
                            >
                              Ver
                            </button>
                            <a
                              href={doc.conteudo || doc.url}
                              download={doc.nome}
                              className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="w-full bg-[#0b1220] p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-4">
                  <p className="text-[9px] text-white/30 font-black uppercase flex items-center gap-2"><Hash size={12}/> OS enviadas</p>
                  <span className="text-emerald-400 text-xs font-bold">{totalOSEnviada}/{osDoNegocio.length}</span>
                </div>

                {osConsolidadaEnviada && (
                  <button
                    onClick={() => handleVisualizarOSConsolidada(osConsolidadaEnviada)}
                    className="w-full mb-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={14} /> Visualizar OS
                  </button>
                )}

                <div className="w-full bg-[#0b1220] p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-4">
                  <p className="text-[9px] text-white/30 font-black uppercase flex items-center gap-2"><FolderOpen size={12}/> GED (Gestão Docs)</p>
                  <span className={docsEntregues > 0 ? "text-amber-500 text-xs font-bold" : "text-red-500 text-xs font-bold"}>{docsEntregues} Arquivos</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0b1220] p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-2 text-amber-500 mb-1"><Calendar size={14} /> <span className="text-[9px] font-black uppercase">Prazos</span></div><p className="text-white text-xs font-bold">{o.inicioPrevisto || '-'} <span className="text-white/20">até</span> {o.fimPrevisto || '-'}</p></div>
                </div>
              </div>
            );
          }) : (
            <div className="xl:col-span-2 bg-[#101f3d] p-10 rounded-3xl border border-white/5 text-center">
              <p className="text-white/60 text-xs font-black uppercase tracking-widest">Nenhum negócio com OS enviada</p>
            </div>
          )}
        </div>
      )}

      {showOSConsolidadaModal && selectedOSConsolidada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-[96vw] w-full max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-white uppercase">OS Consolidada</h2>
                <p className="text-white/60 text-base mt-2">{selectedOSConsolidada.ordemServicoNumero}</p>
              </div>
              <button
                onClick={() => {
                  setShowOSConsolidadaModal(false);
                  setSelectedOSConsolidada(null);
                }}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-10 space-y-8">
              <div className="bg-[#0b1220] rounded-2xl border border-white/10 p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-base">
                <div>
                  <p className="text-white/50 text-sm mb-1">Cliente</p>
                  <p className="text-white font-bold text-lg">{selectedOSConsolidada.cliente || '-'}</p>
                </div>
                <div>
                  <p className="text-white/50 text-sm mb-1">Projeto</p>
                  <p className="text-white font-bold text-lg">{selectedOSConsolidada.projeto || '-'}</p>
                </div>
                <div>
                  <p className="text-white/50 text-sm mb-1">Período Previsto</p>
                  <p className="text-white font-bold text-base">{selectedOSConsolidada.dataInicioPrevisto || '-'} até {selectedOSConsolidada.dataTerminoPrevisto || '-'}</p>
                </div>
                <div>
                  <p className="text-white/50 text-sm mb-1">Status de Aprovação</p>
                  <p className={`font-black uppercase text-base ${selectedOSConsolidada.statusAprovacao === 'aprovada' ? 'text-emerald-300' : 'text-amber-300'}`}>{selectedOSConsolidada.statusAprovacao || 'pendente'}</p>
                </div>
              </div>

              <div className="bg-[#0b1220] rounded-2xl border border-white/10 p-6 space-y-3">
                <h3 className="text-white font-black text-lg uppercase tracking-wider">Descrição Geral</h3>
                <p className="text-white/85 text-base whitespace-pre-wrap leading-relaxed">{selectedOSConsolidada.descricaoGeralServico || 'Sem descrição.'}</p>
              </div>

              <div className="bg-[#0b1220] rounded-2xl border border-white/10 p-6 space-y-4">
                <h3 className="text-white font-black text-lg uppercase tracking-wider">A Ser Incluído</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {listarItensASerIncluido(selectedOSConsolidada.aSerIncluido).length > 0 ? (
                    listarItensASerIncluido(selectedOSConsolidada.aSerIncluido).map((item) => (
                      <div key={item} className="bg-[#101f3d] rounded-lg border border-white/10 p-3 text-sm text-white/85">
                        {item}
                      </div>
                    ))
                  ) : (
                    <p className="text-white/40 text-sm">Nenhum item selecionado.</p>
                  )}
                </div>
              </div>

              <div className="bg-[#0b1220] rounded-2xl border border-white/10 p-6 space-y-4">
                <h3 className="text-white font-black text-lg uppercase tracking-wider">Orçamento (Sem Valores)</h3>
                <div className="bg-[#101f3d] rounded-lg border border-white/10 p-4 text-sm text-white/80 space-y-1">
                  <p>Número: {selectedOSConsolidada.resumoConsolidado?.orcamento?.numeroOrcamento || '-'}</p>
                  <p>Versão: {selectedOSConsolidada.resumoConsolidado?.orcamento?.versao || '-'}</p>
                  <p>Solicitante: {selectedOSConsolidada.resumoConsolidado?.orcamento?.solicitante || '-'}</p>
                  <p>Responsável Comercial: {selectedOSConsolidada.resumoConsolidado?.orcamento?.responsavelComercial || '-'}</p>
                  <p>Documentos Referência: {selectedOSConsolidada.resumoConsolidado?.orcamento?.documentosReferencia || '-'}</p>
                </div>

                {(selectedOSConsolidada.resumoConsolidado?.orcamento?.dadosServicos || []).length > 0 && (
                  <div className="space-y-2">
                    {(selectedOSConsolidada.resumoConsolidado?.orcamento?.dadosServicos || []).map((servico: any, idx: number) => (
                      <div key={`orc-srv-${idx}`} className="bg-[#101f3d] rounded-lg border border-white/10 p-4 text-sm text-white/85">
                        <p className="text-white font-bold text-base">Serviço {servico.ordem || idx + 1}: {servico.tipo || '-'}</p>
                        <p>Categoria: {servico.categoria || '-'} | Local: {servico.localExecucao || '-'} | Porto: {servico.porto || '-'}</p>
                        <p>Descrição: {servico.descricao || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(selectedOSConsolidada.resumoConsolidado?.orcamento?.maoDeObra || []).map((item: any, idx: number) => (
                    <div key={`orc-mao-${idx}`} className="bg-[#101f3d] rounded-lg border border-white/10 p-3 text-sm text-white/85">
                      <p className="text-white font-bold">Mão de obra: {item.funcao || '-'}</p>
                      <p>Qtde: {item.quantidade || '-'} | Dias: {item.dias || '-'}</p>
                    </div>
                  ))}
                  {(selectedOSConsolidada.resumoConsolidado?.orcamento?.atividades || []).map((item: any, idx: number) => (
                    <div key={`orc-atv-${idx}`} className="bg-[#101f3d] rounded-lg border border-white/10 p-3 text-sm text-white/85">
                      <p className="text-white font-bold">Atividade: {item.atividade || '-'}</p>
                      <p>Dias: {item.dias || '-'} | Obs.: {item.observacao || '-'}</p>
                    </div>
                  ))}
                  {(selectedOSConsolidada.resumoConsolidado?.orcamento?.materiais || []).map((item: any, idx: number) => (
                    <div key={`orc-mat-${idx}`} className="bg-[#101f3d] rounded-lg border border-white/10 p-3 text-sm text-white/85">
                      <p className="text-white font-bold">Material: {item.descricao || '-'}</p>
                      <p>{item.quantidade || '-'} {item.unidade || ''} | Fator: {item.pesoFator || '-'}</p>
                    </div>
                  ))}
                  {(selectedOSConsolidada.resumoConsolidado?.orcamento?.terceirizados || []).map((item: any, idx: number) => (
                    <div key={`orc-ter-${idx}`} className="bg-[#101f3d] rounded-lg border border-white/10 p-3 text-sm text-white/85">
                      <p className="text-white font-bold">Terceirizado: {item.descricao || '-'}</p>
                      <p>{item.quantidade || '-'} {item.unidade || ''} | Fator: {item.pesoFator || '-'}</p>
                    </div>
                  ))}
                </div>

                {selectedOSConsolidada.resumoConsolidado?.orcamento?.observacoes && (
                  <div className="bg-[#101f3d] rounded-lg border border-white/10 p-3 text-sm text-white/85">
                    <p className="text-white font-bold">Observações do Orçamento</p>
                    <p className="whitespace-pre-wrap">{selectedOSConsolidada.resumoConsolidado?.orcamento?.observacoes}</p>
                  </div>
                )}
              </div>

              <div className="bg-[#0b1220] rounded-2xl border border-white/10 p-6 space-y-4">
                <h3 className="text-white font-black text-lg uppercase tracking-wider">Proposta (Escopos)</h3>
                <div className="bg-[#101f3d] rounded-lg border border-white/10 p-4 text-sm text-white/80">
                  <p className="text-white font-bold text-base mb-1">Item A - Escopo Básico</p>
                  <p className="whitespace-pre-wrap">{selectedOSConsolidada.resumoConsolidado?.proposta?.escopoA || '-'}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setShowOSConsolidadaModal(false);
                    setSelectedOSConsolidada(null);
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
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #ffffff20; rounded: 4px; }`}</style>
    </div>
  );
}
