import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { 
  Anchor, Plus, Calendar, DollarSign, Users, User, Save, X, Edit2, Trash2, 
  FileText, Briefcase, Activity, Hash, FolderOpen, Download, Link as LinkIcon, CheckCircle2, ChevronDown, ChevronRight
} from 'lucide-react';

// A exportação tem de ser assim para o App.tsx encontrar
export function ObrasView({ searchQuery }: { searchQuery: string }) {
  const { obras, clientes, funcionarios, equipes, saveEntity } = useErp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'docs'>('geral');
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

  const filtradas = listaObras.filter((o: any) => o.nome?.toLowerCase().includes((searchQuery || '').toLowerCase()));

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
          <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mt-2 ml-1">Ciclo de Vida: Anteprojeto &rarr; Pós Venda</p>
        </div>
        {!showForm && (
          <button onClick={() => handleOpenForm()} className="bg-amber-500 hover:bg-amber-400 text-[#0b1220] px-5 py-2 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105">
            <Plus size={16} /> Novo Projeto
          </button>
        )}
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
          {filtradas.map((o: any) => {
            const cliente = listaClientes.find((c: any) => c.id === o.clienteId);
            const docsEntregues = o.docs ? Object.values(o.docs).filter(Boolean).length : 0;
            return (
              <div key={o.id} className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 group hover:border-amber-500/20 transition-all relative">
                <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => handleOpenForm(o)} className="p-3 bg-[#0b1220] rounded-xl hover:bg-amber-500 hover:text-[#0b1220]"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(o.id)} className="p-3 bg-[#0b1220] rounded-xl hover:bg-red-500 hover:text-white"><Trash2 size={16} /></button>
                </div>
                <div className="flex justify-between items-start mb-6"><div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500"><Anchor size={28} /></div><span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/40">{o.status}</span></div>
                <h3 className="text-xl font-black text-white uppercase italic mb-1">{o.nome}</h3>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-6">Cliente: <span className="text-white">{cliente?.razaoSocial || 'N/A'}</span></p>
                <div className="w-full bg-[#0b1220] p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-4">
                  <p className="text-[9px] text-white/30 font-black uppercase flex items-center gap-2"><FolderOpen size={12}/> GED (Gestão Docs)</p>
                  <span className={docsEntregues > 0 ? "text-amber-500 text-xs font-bold" : "text-red-500 text-xs font-bold"}>{docsEntregues} Arquivos</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0b1220] p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-2 text-amber-500 mb-1"><Calendar size={14} /> <span className="text-[9px] font-black uppercase">Prazos</span></div><p className="text-white text-xs font-bold">{o.inicioPrevisto || '-'} <span className="text-white/20">até</span> {o.fimPrevisto || '-'}</p></div>

                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #ffffff20; rounded: 4px; }`}</style>
    </div>
  );
}
