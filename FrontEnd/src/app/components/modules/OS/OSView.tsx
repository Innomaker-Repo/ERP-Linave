import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Plus, X, Check, Clock, Zap } from 'lucide-react';

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
}

interface OSViewProps {
  searchQuery: string;
}

export function OsView({ searchQuery }: OSViewProps) {
  const { obras, clientes, saveEntity } = useErp();
  const [showFormNovaOS, setShowFormNovaOS] = useState(false);
  const [showDetalhesOS, setShowDetalhesOS] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OsFormData | null>(null);
  const [listaOS, setListaOS] = useState<OsFormData[]>([]);

  const inputClass = 'w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20';
  const labelClass = 'text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block';

  // Obras em "Em Andamento" disponíveis para OS
  const obrasEmAndamento = (obras || []).filter((o: any) => o.categoria === 'Em Andamento');
  const obrasComOS = obrasEmAndamento.filter(obra => 
    !listaOS.some(os => os.obraId === obra.id)
  );

  const initialOsData: OsFormData = {
    id: `OS-${Date.now()}`,
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
      vigiaFogo: false,
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
    },
    statusOs: 'rascunho',
  };

  const [formData, setFormData] = useState<OsFormData>(initialOsData);

  // Quando seleciona uma obra, preenche os dados automaticamente
  const handleObraChange = (obraId: string) => {
    const obra = obrasComOS.find(o => o.id === obraId);
    if (!obra) return;

    const cliente = (clientes || []).find(c => c.id === obra.clienteId);

    setFormData(prev => ({
      ...prev,
      obraId: obra.id,
      clienteId: obra.clienteId,
      cliente: cliente?.razaoSocial || '',
      projeto: obra.nome,
      local: cliente?.endereco || '',
      dataInicioPrevisto: new Date(new Date().getTime() + 86400000).toISOString().split('T')[0],
      dataTerminoPrevisto: new Date(new Date().getTime() + 7 * 86400000).toISOString().split('T')[0],
    }));
  };

  const handleSaveOS = () => {
    if (!formData.obraId) {
      return alert('Selecione uma obra para criar a OS');
    }

    const hhTotal = formData.maoObra.estrutura + formData.maoObra.tubulacao + formData.maoObra.andaimes + 
                   formData.maoObra.mecanica + formData.maoObra.pintura + formData.maoObra.eletrica + 
                   formData.maoObra.cq + formData.maoObra.sms;

    const novaOS: OsFormData = {
      ...formData,
      id: `OS-${Date.now()}`,
      maoObra: {
        ...formData.maoObra,
        cq: hhTotal, // Atualiza  como total
      }
    };

    setListaOS([...listaOS, novaOS]);
    setShowFormNovaOS(false);
    setFormData(initialOsData);
    alert('Ordem de Serviço criada com sucesso!');
  };

  const handleDeleteOS = (osId: string) => {
    if (window.confirm('Tem certeza que deseja deletar esta OS?')) {
      setListaOS(listaOS.filter(os => os.id !== osId));
    }
  };

  const handleShowDetalhes = (os: OsFormData) => {
    setSelectedOS(os);
    setShowDetalhesOS(true);
  };

  const obrasOrdenadas = obrasEmAndamento.filter((obra: any) =>
    !searchQuery ||
    obra.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (clientes || []).find(c => c.id === obra.clienteId)?.razaoSocial.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-12 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">ORDEM DE SERVIÇO DE PRODUÇÃO</h1>
          <p className="text-white/50 text-xs mt-1">Projetos em andamento disponíveis para iniciar produção</p>
        </div>
        <button 
          onClick={() => setShowFormNovaOS(true)}
          disabled={obrasComOS.length === 0}
          className={`px-6 py-3 ${obrasComOS.length > 0 ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white' : 'bg-white/5 text-white/50 cursor-not-allowed'} rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-900/30`}
        >
          <Plus size={18} className="inline mr-2" /> Criar OS
        </button>
      </div>

      {/* LISTA DE OBRAS DISPONÍVEIS */}
      <div className="grid grid-cols-1 gap-4">
        {obrasOrdenadas.length > 0 ? (
          obrasOrdenadas.map((obra: any) => {
            const cliente = (clientes || []).find(c => c.id === obra.clienteId);
            const osExistente = listaOS.find(os => os.obraId === obra.id);

            return (
              <div
                key={obra.id}
                className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/30 rounded-xl p-6 hover:border-blue-400/60 hover:shadow-lg hover:shadow-blue-900/20 transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-white font-black text-lg">{obra.nome}</h3>
                    <p className="text-white/70 text-sm mt-1">👥 {cliente?.razaoSocial}</p>
                    <p className="text-white/50 text-xs mt-2">📅 {obra.dataCadastro}</p>
                  </div>
                  
                  {osExistente ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleShowDetalhes(osExistente)}
                        className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-lg font-black text-xs hover:bg-cyan-500/30 transition flex items-center gap-2"
                      >
                        <Check size={14} /> Ver OS
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

      {/* MODAL - CRIAR OS */}
      {showFormNovaOS && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 max-h-screen overflow-y-auto">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-5xl w-full my-8">
            
            {/* Header */}
            <div className="sticky top-0 z-40 bg-gradient-to-r from-orange-500/40 to-amber-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white uppercase">Ordem de Serviço de Produção</h2>
                <p className="text-white/50 text-sm mt-2">Nº {formData.ordemServicoNumero}</p>
              </div>
              <button 
                onClick={() => setShowFormNovaOS(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-8 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
              
              {/* SEÇÃO 1: DADOS PRINCIPAIS */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6">
                <h3 className="text-lg font-black text-white uppercase mb-4">Dados Principais</h3>
                
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Cliente *</label>
                    <select 
                      className={inputClass}
                      value={formData.obraId}
                      onChange={e => handleObraChange(e.target.value)}
                    >
                      <option value="">Selecione o Projeto</option>
                      {obrasComOS.map(obra => (
                        <option key={obra.id} value={obra.id}>
                          {(clientes || []).find(c => c.id === obra.clienteId)?.razaoSocial}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Projeto *</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={formData.projeto}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Equipamento</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.equipamento}
                      onChange={e => setFormData({...formData, equipamento: e.target.value})}
                      placeholder="Ex: Plataforma"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Local *</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5`}
                      value={formData.local}
                      onChange={e => setFormData({...formData, local: e.target.value})}
                      placeholder="Local de trabalho"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Data Emissão</label>
                    <input 
                      type="date"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={formData.dataEmissao}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>CC</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.cc}
                      onChange={e => setFormData({...formData, cc: e.target.value})}
                      placeholder="Centro de Custo"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Data Início Previsto</label>
                    <input 
                      type="date"
                      className={inputClass}
                      value={formData.dataInicioPrevisto}
                      onChange={e => setFormData({...formData, dataInicioPrevisto: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Data Término Previsto</label>
                    <input 
                      type="date"
                      className={inputClass}
                      value={formData.dataTerminoPrevisto}
                      onChange={e => setFormData({...formData, dataTerminoPrevisto: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Ordem Serviço Nº</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={formData.ordemServicoNumero}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Superv./Encarreg.</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.supervisorEncarregado}
                      onChange={e => setFormData({...formData, supervisorEncarregado: e.target.value})}
                      placeholder="Nome"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 mt-4">
                  <label className={labelClass}>Descrição Geral do Serviço</label>
                  <textarea 
                    className={`${inputClass} h-20 resize-none`}
                    value={formData.descricaoGeralServico}
                    onChange={e => setFormData({...formData, descricaoGeralServico: e.target.value})}
                    placeholder="Descreva o serviço em detalhes"
                  />
                </div>
              </div>

              {/* SEÇÃO 2: A SER INCLUÍDO */}
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20 p-6">
                <h3 className="text-lg font-black text-white uppercase mb-4">A Ser Incluído</h3>
                
                <div className="grid grid-cols-3 gap-3">
                  {[
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
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={(formData.aSerIncluido as any)[item.key]}
                        onChange={e => setFormData({
                          ...formData,
                          aSerIncluido: {
                            ...formData.aSerIncluido,
                            [item.key]: e.target.checked
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <span className="text-white/70 text-xs">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 3: MÃO DE OBRA */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20 p-6">
                <h3 className="text-lg font-black text-white uppercase mb-4">Mão de Obra (H/H)</h3>
                
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { key: 'estrutura', label: 'Estrutura' },
                    { key: 'tubulacao', label: 'Tubulação' },
                    { key: 'andaimes', label: 'Andaimes' },
                    { key: 'mecanica', label: 'Mecânica' },
                    { key: 'pintura', label: 'Pintura' },
                    { key: 'eletrica', label: 'Elétrica' },
                    { key: 'cq', label: 'C.Q' },
                    { key: 'sms', label: 'SMS' },
                  ].map(item => (
                    <div key={item.key} className="space-y-1.5">
                      <label className={labelClass}>{item.label}</label>
                      <input 
                        type="number"
                        className={inputClass}
                        value={(formData.maoObra as any)[item.key]}
                        onChange={e => setFormData({
                          ...formData,
                          maoObra: {
                            ...formData.maoObra,
                            [item.key]: parseInt(e.target.value) || 0
                          }
                        })}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                  <p className="text-white font-black">HH TOTAL: {formData.maoObra.estrutura + formData.maoObra.tubulacao + formData.maoObra.andaimes + formData.maoObra.mecanica + formData.maoObra.pintura + formData.maoObra.eletrica + formData.maoObra.cq + formData.maoObra.sms}</p>
                </div>
              </div>

              {/* BOTÕES */}
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

      {/* MODAL - VER DETALHES DA OS */}
      {showDetalhesOS && selectedOS && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="sticky top-0 z-40 bg-gradient-to-r from-orange-500/40 to-amber-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Detalhes da OS</h2>
                <p className="text-white/50 text-sm mt-2">{selectedOS.ordemServicoNumero}</p>
              </div>
              <button 
                onClick={() => setShowDetalhesOS(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              
              {/* Informações Básicas */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-black">INFORMAÇÕES BÁSICAS</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/50 text-xs mb-1">Cliente</p>
                    <p className="text-white font-bold">{selectedOS.cliente}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Projeto</p>
                    <p className="text-white font-bold">{selectedOS.projeto}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Local</p>
                    <p className="text-white font-bold">{selectedOS.local}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Data Emissão</p>
                    <p className="text-white font-bold">{selectedOS.dataEmissao}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Data Início Previsto</p>
                    <p className="text-white font-bold">{selectedOS.dataInicioPrevisto}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Data Término Previsto</p>
                    <p className="text-white font-bold">{selectedOS.dataTerminoPrevisto}</p>
                  </div>
                </div>
              </div>

              {/* Descrição Geral */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="text-white font-black mb-2">DESCRIÇÃO GERAL DO SERVIÇO</h3>
                <p className="text-white/80 text-sm whitespace-pre-wrap">{selectedOS.descricaoGeralServico}</p>
              </div>

              {/* Mão de Obra */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="text-white font-black mb-3">MÃO DE OBRA (H/H)</h3>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div className="bg-[#0b1220] p-2 rounded">
                    <p className="text-white/50 text-xs">Estrutura</p>
                    <p className="text-white font-black">{selectedOS.maoObra.estrutura}</p>
                  </div>
                  <div className="bg-[#0b1220] p-2 rounded">
                    <p className="text-white/50 text-xs">Tubulação</p>
                    <p className="text-white font-black">{selectedOS.maoObra.tubulacao}</p>
                  </div>
                  <div className="bg-[#0b1220] p-2 rounded">
                    <p className="text-white/50 text-xs">Andaimes</p>
                    <p className="text-white font-black">{selectedOS.maoObra.andaimes}</p>
                  </div>
                  <div className="bg-[#0b1220] p-2 rounded">
                    <p className="text-white/50 text-xs">Mecânica</p>
                    <p className="text-white font-black">{selectedOS.maoObra.mecanica}</p>
                  </div>
                  <div className="bg-[#0b1220] p-2 rounded">
                    <p className="text-white/50 text-xs">Pintura</p>
                    <p className="text-white font-black">{selectedOS.maoObra.pintura}</p>
                  </div>
                  <div className="bg-[#0b1220] p-2 rounded">
                    <p className="text-white/50 text-xs">Elétrica</p>
                    <p className="text-white font-black">{selectedOS.maoObra.eletrica}</p>
                  </div>
                  <div className="bg-[#0b1220] p-2 rounded">
                    <p className="text-white/50 text-xs">C.Q</p>
                    <p className="text-white font-black">{selectedOS.maoObra.cq}</p>
                  </div>
                  <div className="bg-emerald-500/20 border border-emerald-500/30 p-2 rounded">
                    <p className="text-emerald-300 text-xs font-black">HH TOTAL</p>
                    <p className="text-emerald-300 font-black">{selectedOS.maoObra.estrutura + selectedOS.maoObra.tubulacao + selectedOS.maoObra.andaimes + selectedOS.maoObra.mecanica + selectedOS.maoObra.pintura + selectedOS.maoObra.eletrica + selectedOS.maoObra.cq + selectedOS.maoObra.sms}</p>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button 
                  onClick={() => setShowDetalhesOS(false)}
                  className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/15 transition"
                >
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
