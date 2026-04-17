import React, { useState, useEffect } from 'react';
import { UserPlus, Save, X, Edit2, Trash2, Building2, User, MapPin, Phone, Calendar, UserCheck, History, Eye } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';

const CLIENTES_MOCK = [
  {
    id: 'CLI-1',
    tipoPessoa: 'PJ',
    razaoSocial: 'Linave Construções LTDA',
    nomeFantasia: 'Linave',
    cpfCnpj: '12.345.678/0001-90',
    inscricaoEstadual: '123.456.789.012',
    status: 'Ativo',
    contato: '(41) 3333-4444 / contato@linave.com.br',
    endereco: 'Rua das Construções, 123, Curitiba - PR',
    dataCadastro: '2024-01-15',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-2',
    tipoPessoa: 'PJ',
    razaoSocial: 'Construtora Alpha S.A.',
    nomeFantasia: 'Alpha Construtora',
    cpfCnpj: '23.456.789/0001-01',
    inscricaoEstadual: '234.567.890.123',
    status: 'Ativo',
    contato: '(41) 3333-5555 / vendas@alpha.com.br',
    endereco: 'Av. Principal, 456, Curitiba - PR',
    dataCadastro: '2024-02-10',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-3',
    tipoPessoa: 'PJ',
    razaoSocial: 'TC Engenharia e Consultoria',
    nomeFantasia: 'TC Engenharia',
    cpfCnpj: '34.567.890/0001-12',
    inscricaoEstadual: '345.678.901.234',
    status: 'Ativo',
    contato: '(41) 3333-6666 / tech@tcengenharia.com.br',
    endereco: 'Rua da Tecnologia, 789, Curitiba - PR',
    dataCadastro: '2024-03-05',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-4',
    tipoPessoa: 'PJ',
    razaoSocial: 'Projetos Marítimos LTDA',
    nomeFantasia: 'ProMar',
    cpfCnpj: '45.678.901/0001-23',
    inscricaoEstadual: '456.789.012.345',
    status: 'Ativo',
    contato: '(41) 3333-7777 / projetos@promar.com.br',
    endereco: 'Porto Boulevard, 321, Paranaguá - PR',
    dataCadastro: '2024-01-20',
    usuarioResponsavel: 'Sistema'
  },
  {
    id: 'CLI-5',
    tipoPessoa: 'PJ',
    razaoSocial: 'Estaleiro Industrial do Sudeste',
    nomeFantasia: 'EISE',
    cpfCnpj: '56.789.012/0001-34',
    inscricaoEstadual: '567.890.123.456',
    status: 'Ativo',
    contato: '(41) 3333-8888 / comercial@eise.com.br',
    endereco: 'Distrito Industrial, 654, Paranaguá - PR',
    dataCadastro: '2024-01-25',
    usuarioResponsavel: 'Sistema'
  }
];

export function ClientesView({ searchQuery }: { searchQuery: string }) {
  const { clientes, obras, saveEntity, userSession } = useErp();
  
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClienteDetalhes, setSelectedClienteDetalhes] = useState<any>(null);
  const [showClienteModal, setShowClienteModal] = useState(false);
  
  // Inicializar com mock se não houver clientes
  useEffect(() => {
    if (!clientes || clientes.length === 0) {
      saveEntity('clientes', CLIENTES_MOCK);
    }
  }, []);
  
  // Estado inicial com a estrutura exata solicitada
  const initialClienteState = {
    tipoPessoa: 'PJ',
    razaoSocial: '',
    nomeFantasia: '',
    cpfCnpj: '',
    inscricaoEstadual: '',
    status: 'Ativo',
    contato: '',
    endereco: '',
    dataCadastro: new Date().toISOString().split('T')[0],
    usuarioResponsavel: userSession?.email || 'Sistema'
  };

  const [currentCliente, setCurrentCliente] = useState<any>(initialClienteState);

  const handleOpenForm = (cliente: any = null) => {
    if (cliente) {
      setCurrentCliente(cliente);
      setEditMode(true);
    } else {
      setCurrentCliente({
        ...initialClienteState,
        usuarioResponsavel: userSession?.email || 'Sistema' // Pega o usuário logado automaticamente
      });
      setEditMode(false);
    }
    setShowForm(true);
  };

  const handleSave = () => {
    let listaAtualizada;
    if (editMode) {
      listaAtualizada = clientes.map((c: any) => c.id === currentCliente.id ? currentCliente : c);
    } else {
      const newId = `CLI-${Date.now()}`;
      listaAtualizada = [...(clientes || []), { ...currentCliente, id: newId }];
    }
    
    saveEntity('clientes', listaAtualizada);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      const listaAtualizada = clientes.filter((c: any) => c.id !== id);
      saveEntity('clientes', listaAtualizada);
    }
  };

  // Filtro de busca
  const listaFiltrada = (clientes || []).filter((c: any) => 
    c.razaoSocial?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nomeFantasia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cpfCnpj?.includes(searchQuery)
  );

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Gestão de Clientes</h1>
          <p className="text-white/40 text-sm">Cadastro completo e CRM</p>
        </div>
        <button 
          onClick={() => handleOpenForm()} 
          className="bg-amber-500 text-[#0b1220] px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <UserPlus size={16} /> Novo Cliente
        </button>
      </div>

      {showForm && (
        <div className="bg-[#101f3d] p-10 rounded-[48px] border border-amber-500/30 space-y-8 shadow-2xl relative">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* LINHA 1: IDENTIFICAÇÃO BÁSICA */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Tipo</label>
              <select 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.tipoPessoa}
                onChange={e => setCurrentCliente({...currentCliente, tipoPessoa: e.target.value})}
              >
                <option value="PJ">Jurídica</option>
                <option value="PF">Física</option>
              </select>
            </div>
            <div className="md:col-span-5 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Razão Social / Nome Completo</label>
              <input 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.razaoSocial}
                onChange={e => setCurrentCliente({...currentCliente, razaoSocial: e.target.value})}
              />
            </div>
            <div className="md:col-span-5 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Nome Fantasia</label>
              <input 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.nomeFantasia}
                onChange={e => setCurrentCliente({...currentCliente, nomeFantasia: e.target.value})}
              />
            </div>

            {/* LINHA 2: DOCUMENTOS E STATUS */}
            <div className="md:col-span-4 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">CPF / CNPJ</label>
              <input 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.cpfCnpj}
                onChange={e => setCurrentCliente({...currentCliente, cpfCnpj: e.target.value})}
              />
            </div>
            <div className="md:col-span-4 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Inscrição Estadual</label>
              <input 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.inscricaoEstadual}
                onChange={e => setCurrentCliente({...currentCliente, inscricaoEstadual: e.target.value})}
              />
            </div>
            <div className="md:col-span-4 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Status</label>
              <select 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.status}
                onChange={e => setCurrentCliente({...currentCliente, status: e.target.value})}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Prospect">Prospect</option>
              </select>
            </div>

            {/* LINHA 3: CONTATO E ENDEREÇO */}
            <div className="md:col-span-6 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Contato (Tel / Email)</label>
              <input 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.contato}
                onChange={e => setCurrentCliente({...currentCliente, contato: e.target.value})}
              />
            </div>
            <div className="md:col-span-6 space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Endereço Completo</label>
              <input 
                className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500"
                value={currentCliente.endereco}
                onChange={e => setCurrentCliente({...currentCliente, endereco: e.target.value})}
              />
            </div>

            {/* LINHA 4: DADOS DO SISTEMA (AUTO) */}
            <div className="md:col-span-6 space-y-2 opacity-50 pointer-events-none">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Data Cadastro</label>
              <input readOnly className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white/50" value={currentCliente.dataCadastro} />
            </div>
            <div className="md:col-span-6 space-y-2 opacity-50 pointer-events-none">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Usuário Responsável</label>
              <input readOnly className="w-full bg-[#0b1220] border border-white/5 p-4 rounded-2xl text-white/50" value={currentCliente.usuarioResponsavel} />
            </div>

          </div>

          <div className="flex gap-4 border-t border-white/5 pt-8">
            <button onClick={handleSave} className="bg-emerald-500 text-[#0b1220] px-10 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/10 hover:bg-emerald-400 transition-all">
              <Save size={16}/> {editMode ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-white/40 font-black text-[10px] uppercase px-10 py-4 rounded-2xl border border-white/5 hover:bg-white/5 transition-all">
              <X size={16}/> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* LISTAGEM */}
      <div className="bg-[#101f3d] rounded-[48px] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#0b1220]/50 text-[9px] font-black text-white/20 uppercase tracking-widest">
            <tr>
              <th className="p-8">Empresa / Cliente</th>
              <th className="p-8">Documentação</th>
              <th className="p-8">Contato / Local</th>
              <th className="p-8">Responsável</th>
              <th className="p-8 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-white font-bold text-xs">
            {listaFiltrada.map((c: any) => (
              <tr key={c.id} className="border-t border-white/5 hover:bg-white/5 transition-all group">
                <td className="p-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-xl text-amber-500">
                      {c.tipoPessoa === 'PJ' ? <Building2 size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <p className="text-sm">{c.razaoSocial}</p>
                      <p className="text-[10px] text-white/30 uppercase mt-0.5 font-normal">{c.nomeFantasia}</p>
                    </div>
                  </div>
                </td>
                <td className="p-8">
                  <p>{c.cpfCnpj}</p>
                  <p className="text-[10px] text-white/30 uppercase mt-0.5 font-mono">IE: {c.inscricaoEstadual || 'Isento'}</p>
                </td>
                <td className="p-8 space-y-1">
                  <div className="flex items-center gap-2 text-white/60"><Phone size={12}/> {c.contato}</div>
                  <div className="flex items-center gap-2 text-white/60"><MapPin size={12}/> {c.endereco}</div>
                </td>
                <td className="p-8">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-white/40 font-black tracking-wider">
                    <UserCheck size={12} /> {c.usuarioResponsavel?.split(' ')[0]}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] uppercase text-white/40 font-mono mt-1">
                    <Calendar size={12} /> {c.dataCadastro}
                  </div>
                </td>
                <td className="p-8 text-right">
                  <div className="flex justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setSelectedClienteDetalhes(c);
                        setShowClienteModal(true);
                      }} 
                      className="p-2 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                      title="Ver histórico"
                    >
                      <History size={16}/>
                    </button>
                    <button onClick={() => handleOpenForm(c)} className="p-2 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {listaFiltrada.length === 0 && (
          <div className="p-20 text-center text-white/20 font-black uppercase tracking-widest text-xs">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>

      {/* MODAL - DETALHES E HISTÓRICO DO CLIENTE */}
      {showClienteModal && selectedClienteDetalhes && (() => {
        // Buscar todas as obras deste cliente
        const negociosDoCliente = (obras || []).filter((o: any) => o.clienteId === selectedClienteDetalhes.id);
        
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              
              <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">DETALHES DO CLIENTE</h2>
                  <p className="text-white/50 text-sm mt-2">{selectedClienteDetalhes.razaoSocial}</p>
                </div>
                <button 
                  onClick={() => setShowClienteModal(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={24} className="text-white/60" />
                </button>
              </div>

              <div className="p-8 space-y-6">

                {/* Informações Básicas */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">Razão Social</p>
                    <p className="text-white font-bold text-lg">{selectedClienteDetalhes.razaoSocial}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">Nome Fantasia</p>
                    <p className="text-white font-bold text-lg">{selectedClienteDetalhes.nomeFantasia}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">CNPJ / CPF</p>
                    <p className="text-white font-mono text-sm">{selectedClienteDetalhes.cpfCnpj}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">Status</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-black ${
                      selectedClienteDetalhes.status === 'Ativo' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : selectedClienteDetalhes.status === 'Prospect'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}>
                      {selectedClienteDetalhes.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">Contato</p>
                    <p className="text-white text-sm">{selectedClienteDetalhes.contato}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">Endereço</p>
                    <p className="text-white text-sm">{selectedClienteDetalhes.endereco}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">Data de Cadastro</p>
                    <p className="text-white text-sm">{selectedClienteDetalhes.dataCadastro}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black uppercase">Responsável</p>
                    <p className="text-white text-sm">{selectedClienteDetalhes.usuarioResponsavel}</p>
                  </div>
                </div>

                {/* Histórico de Negócios */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <History size={20} className="text-blue-400" />
                    <h3 className="text-white font-black text-lg">HISTÓRICO DE NEGÓCIOS ({negociosDoCliente.length})</h3>
                  </div>

                  {negociosDoCliente.length > 0 ? (
                    <div className="space-y-3">
                      {negociosDoCliente.map((negocio: any) => (
                        <div key={negocio.id} className="bg-[#0b1220] rounded-lg p-4 border border-white/10 hover:border-blue-500/50 transition-all space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-white font-black text-sm">{negocio.nome}</p>
                              <p className="text-white/70 text-xs mt-1">Solicitante: {negocio.solicitante}</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-black ${
                              negocio.categoria === 'Planejamento'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : negocio.categoria === 'Negociação'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : negocio.categoria === 'Em Andamento'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}>
                              {negocio.categoria}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-white/50">Tipo</p>
                              <p className="text-white font-bold">{negocio.tipo || '−'}</p>
                            </div>
                            <div>
                              <p className="text-white/50">Responsável Técnico</p>
                              <p className="text-white font-bold">{negocio.responsavelTecnico || '−'}</p>
                            </div>
                            <div>
                              <p className="text-white/50">Data Cadastro</p>
                              <p className="text-white font-bold">{negocio.dataCadastro}</p>
                            </div>
                          </div>

                          {negocio.orcamentos && negocio.orcamentos.length > 0 && (
                            <div className="bg-white/5 rounded p-2 text-xs border border-white/10">
                              <p className="text-emerald-400 font-black">Orçamentos: {negocio.orcamentos.length} (Última versão: v{negocio.orcamentos[negocio.orcamentos.length - 1].versao})</p>
                            </div>
                          )}

                          {negocio.propostas && negocio.propostas.length > 0 && (
                            <div className="bg-white/5 rounded p-2 text-xs border border-white/10">
                              <p className="text-blue-400 font-black">Propostas: {negocio.propostas.length} (Última versão: v{negocio.propostas[negocio.propostas.length - 1].versao})</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/40 text-sm">
                      Nenhum negócio realizado com este cliente ainda.
                    </div>
                  )}
                </div>

                {/* Botão de Fechar */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button 
                    onClick={() => setShowClienteModal(false)}
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
    </div>
  );
}
