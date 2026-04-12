import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { HardHat, Save, Folder, FileSpreadsheet, Plus, Search, ChevronDown, ChevronUp, ExternalLink, User, Calendar, CreditCard, BookOpen } from 'lucide-react';

export function FuncionariosView({ searchQuery }: { searchQuery: string }) {
  const { funcionarios, userSession, saveEntity } = useErp();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pessoais');

  // Estado inicial com TODOS os campos solicitados
  const initialForm = {
    matricula: '', // Será gerada automaticamente pelo backend se vazia, mas deixamos campo visual
    situacao: 'Ativo',
    nomeCompleto: '',
    sexo: 'M',
    dataNascimento: '',
    idade: '', // Calculado ou manual
    mesAniversario: '', // Calculado
    cpf: '',
    rg: '',
    rgOrgao: '',
    cnh: '',
    cnhOrgao: '',
    ctps: '',
    ctpsOrgao: '',
    telefone: '',
    email: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: 'Niterói',
    estado: 'RJ',
    dataMatricula: new Date().toISOString().split('T')[0],
    auxilio: '',
    bolsa: '',
    responsavel: '',
    entidadeVinculada: '',
    dataInicialBolsa: '',
    dataFinalBolsa: '',
    salarioBrutoLinave: '',
    obsSalario: '',
    funcao: '',
    departamento: '',
    setor: '',
    horarioTrabalho: '',
    dataEfetivacao: '',
    dataFinalContrato: '',
    obsFuncionario: '',
    curriculoLattes: '',
    grauInstrucao: '',
    areaFormacao: '',
    instituicaoEnsino: '',
    cr: '',
    emailLinave: ''
  };

  const [formData, setFormData] = useState(initialForm);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    // Cálculos automáticos simples
    if (name === 'dataNascimento') {
       const date = new Date(value);
       if (!isNaN(date.getTime())) {
          newFormData.mesAniversario = date.toLocaleString('default', { month: 'long' });
          // Cálculo idade
          const today = new Date();
          let age = today.getFullYear() - date.getFullYear();
          const m = today.getMonth() - date.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < date.getDate())) { age--; }
          newFormData.idade = age.toString();
       }
    }

    setFormData(newFormData);
  };

  const handleSave = async () => {
    if (!formData.nomeCompleto || !formData.cpf) {
      return alert("Nome e CPF são obrigatórios para gerar a documentação.");
    }
    
    setLoading(true);
    try {
      // Chama a rota especial do backend que cria pastas e planilhas
      const res = await axios.post('http://localhost:3001/api/create-employee', {
        accessToken: userSession.token, // Usa token do Admin para criar no Drive correto
        data: formData
      });

      if (res.data.success) {
        alert(`Funcionário cadastrado com sucesso!\nMatrícula Gerada: ${res.data.data.matricula}\n\nAs pastas e planilhas foram criadas no Google Drive.`);
        setShowForm(false);
        setFormData(initialForm);
        // Recarrega para atualizar a lista com os links novos
        window.location.reload(); 
      }
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao criar: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtro de Busca
  const listaFiltrada = (funcionarios || []).filter((f: any) => 
    f.nomeCompleto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.cpf?.includes(searchQuery) ||
    f.matricula?.includes(searchQuery)
  );

  // Componente de Aba do Formulário
  const TabButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-4 rounded-t-2xl text-xs font-black uppercase tracking-wider transition-all ${
        activeTab === id 
        ? 'bg-[#0b1220] text-amber-500 border-t-2 border-x border-white/5 relative top-[1px]' 
        : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Gestão de Pessoas</h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">RH & Documentação Linave</p>
        </div>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)} 
            className="bg-amber-500 text-[#0b1220] px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus size={18} /> Novo Colaborador
          </button>
        )}
      </div>

      {/* FORMULÁRIO COMPLEXO */}
      {showForm && (
        <div className="bg-[#101f3d] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative">
           {/* Barra de título do form */}
           <div className="bg-[#0f192a] px-8 py-4 flex justify-between items-center border-b border-white/5">
             <h3 className="text-white font-bold uppercase text-sm flex items-center gap-2">
               <User className="text-amber-500" size={18} /> Ficha de Cadastro
             </h3>
             <div className="text-[10px] text-white/30 font-mono">MATRÍCULA SERÁ GERADA AUTOMATICAMENTE</div>
           </div>

          {/* Abas de Navegação */}
          <div className="flex overflow-x-auto px-8 pt-6 border-b border-white/5 bg-[#101f3d] gap-1 custom-scrollbar">
            <TabButton id="pessoais" label="Dados Pessoais" icon={User} />
            <TabButton id="documentos" label="Documentação" icon={Folder} />
            <TabButton id="bolsa" label="Bolsa / Auxílio" icon={CreditCard} />
            <TabButton id="linave" label="Contrato Linave" icon={HardHat} />
            <TabButton id="academico" label="Acadêmico" icon={BookOpen} />
          </div>

          <div className="p-10 bg-[#0b1220] min-h-[500px]">
            
            {/* ABA 1: DADOS PESSOAIS */}
            {activeTab === 'pessoais' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in slide-in-from-right-4">
                <div className="md:col-span-8"><label className="label-form">Nome Completo *</label><input name="nomeCompleto" className="input-form font-bold text-lg" value={formData.nomeCompleto} onChange={handleChange} placeholder="Nome do Funcionário" /></div>
                <div className="md:col-span-4"><label className="label-form">Situação</label><select name="situacao" className="input-form cursor-pointer appearance-none text-amber-500 font-bold" value={formData.situacao} onChange={handleChange}><option>Ativo</option><option>Inativo</option><option>Férias</option><option>Afastado</option></select></div>
                
                <div className="md:col-span-3"><label className="label-form">Data Nascimento</label><input type="date" name="dataNascimento" className="input-form" value={formData.dataNascimento} onChange={handleChange} /></div>
                <div className="md:col-span-3"><label className="label-form">Idade</label><input name="idade" className="input-form bg-white/5" readOnly value={formData.idade} /></div>
                <div className="md:col-span-3"><label className="label-form">Mês Aniversário</label><input name="mesAniversario" className="input-form bg-white/5" readOnly value={formData.mesAniversario} /></div>
                <div className="md:col-span-3"><label className="label-form">Sexo</label><select name="sexo" className="input-form" value={formData.sexo} onChange={handleChange}><option>M</option><option>F</option><option>Outro</option></select></div>
                
                <div className="md:col-span-6"><label className="label-form">E-mail Pessoal</label><input name="email" className="input-form" value={formData.email} onChange={handleChange} /></div>
                <div className="md:col-span-6"><label className="label-form">Telefone / WhatsApp</label><input name="telefone" className="input-form" value={formData.telefone} onChange={handleChange} /></div>
                
                <div className="md:col-span-12 pt-4 border-t border-white/5"><p className="text-amber-500 font-bold text-xs uppercase mb-4">Endereço Residencial</p></div>
                <div className="md:col-span-2"><label className="label-form">CEP</label><input name="cep" className="input-form" value={formData.cep} onChange={handleChange} /></div>
                <div className="md:col-span-6"><label className="label-form">Logradouro</label><input name="endereco" className="input-form" value={formData.endereco} onChange={handleChange} /></div>
                <div className="md:col-span-4"><label className="label-form">Bairro</label><input name="bairro" className="input-form" value={formData.bairro} onChange={handleChange} /></div>
                <div className="md:col-span-6"><label className="label-form">Cidade</label><input name="cidade" className="input-form" value={formData.cidade} onChange={handleChange} /></div>
                <div className="md:col-span-6"><label className="label-form">Estado</label><input name="estado" className="input-form" value={formData.estado} onChange={handleChange} /></div>
              </div>
            )}

            {/* ABA 2: DOCUMENTOS */}
            {activeTab === 'documentos' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-4">
                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                   <h4 className="text-amber-500 font-bold text-sm uppercase mb-2">Documentos Principais</h4>
                   <div><label className="label-form">CPF *</label><input name="cpf" className="input-form font-mono" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" /></div>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="label-form">RG</label><input name="rg" className="input-form" value={formData.rg} onChange={handleChange} /></div>
                      <div><label className="label-form">Orgão Exp/UF</label><input name="rgOrgao" className="input-form" value={formData.rgOrgao} onChange={handleChange} /></div>
                   </div>
                </div>

                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                   <h4 className="text-blue-500 font-bold text-sm uppercase mb-2">Carteira de Trabalho / CNH</h4>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="label-form">CTPS</label><input name="ctps" className="input-form" value={formData.ctps} onChange={handleChange} /></div>
                      <div><label className="label-form">Série/UF</label><input name="ctpsOrgao" className="input-form" value={formData.ctpsOrgao} onChange={handleChange} /></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="label-form">CNH</label><input name="cnh" className="input-form" value={formData.cnh} onChange={handleChange} /></div>
                      <div><label className="label-form">Categoria/UF</label><input name="cnhOrgao" className="input-form" value={formData.cnhOrgao} onChange={handleChange} /></div>
                   </div>
                </div>
                
                <div className="col-span-2">
                   <label className="label-form">Data da Matrícula / Admissão</label>
                   <input type="date" name="dataMatricula" className="input-form w-1/3" value={formData.dataMatricula} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* Outras abas seguem o mesmo padrão de grid... */}
            {/* ABA 3: BOLSA */}
            {activeTab === 'bolsa' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4">
                <div><label className="label-form">Valor Auxílio (R$)</label><input name="auxilio" className="input-form" value={formData.auxilio} onChange={handleChange} /></div>
                <div><label className="label-form">Valor Bolsa (R$)</label><input name="bolsa" className="input-form" value={formData.bolsa} onChange={handleChange} /></div>
                <div className="md:col-span-2"><label className="label-form">Responsável / Supervisor</label><input name="responsavel" className="input-form" value={formData.responsavel} onChange={handleChange} /></div>
                <div className="md:col-span-2"><label className="label-form">Entidade Vinculada (Ex: FAPERJ, CNPq)</label><input name="entidadeVinculada" className="input-form" value={formData.entidadeVinculada} onChange={handleChange} /></div>
                <div><label className="label-form">Início Vigência</label><input type="date" name="dataInicialBolsa" className="input-form" value={formData.dataInicialBolsa} onChange={handleChange} /></div>
                <div><label className="label-form">Fim Vigência</label><input type="date" name="dataFinalBolsa" className="input-form" value={formData.dataFinalBolsa} onChange={handleChange} /></div>
              </div>
            )}

            {/* ABA 4: CONTRATO LINAVE */}
            {activeTab === 'linave' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4">
                 <div><label className="label-form">E-mail Corporativo</label><input name="emailLinave" className="input-form" value={formData.emailLinave} onChange={handleChange} /></div>
                 <div><label className="label-form">Salário Bruto</label><input name="salarioBrutoLinave" className="input-form font-mono text-amber-400" value={formData.salarioBrutoLinave} onChange={handleChange} /></div>
                 <div><label className="label-form">Função</label><input name="funcao" className="input-form" value={formData.funcao} onChange={handleChange} /></div>
                 <div><label className="label-form">Departamento</label><input name="departamento" className="input-form" value={formData.departamento} onChange={handleChange} /></div>
                 <div><label className="label-form">Setor</label><input name="setor" className="input-form" value={formData.setor} onChange={handleChange} /></div>
                 <div><label className="label-form">Horário de Trabalho</label><input name="horarioTrabalho" className="input-form" value={formData.horarioTrabalho} onChange={handleChange} placeholder="08:00 às 17:00" /></div>
                 <div className="md:col-span-2"><label className="label-form">Observações Gerais</label><textarea name="obsFuncionario" className="input-form h-32 resize-none" value={formData.obsFuncionario} onChange={handleChange} /></div>
              </div>
            )}

            {/* ABA 5: ACADÊMICO */}
            {activeTab === 'academico' && (
              <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-right-4">
                 <div><label className="label-form">Link Currículo Lattes</label><div className="relative"><ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16}/><input name="curriculoLattes" className="input-form pl-12 text-blue-400" value={formData.curriculoLattes} onChange={handleChange} /></div></div>
                 <div className="grid grid-cols-2 gap-6">
                    <div><label className="label-form">Grau de Instrução</label><input name="grauInstrucao" className="input-form" value={formData.grauInstrucao} onChange={handleChange} /></div>
                    <div><label className="label-form">CR (Coeficiente Rendimento)</label><input name="cr" className="input-form" value={formData.cr} onChange={handleChange} /></div>
                 </div>
                 <div><label className="label-form">Área de Formação</label><input name="areaFormacao" className="input-form" value={formData.areaFormacao} onChange={handleChange} /></div>
                 <div><label className="label-form">Instituição de Ensino</label><input name="instituicaoEnsino" className="input-form" value={formData.instituicaoEnsino} onChange={handleChange} /></div>
              </div>
            )}

          </div>

          {/* FOOTER ACTIONS */}
          <div className="p-8 bg-[#101f3d] flex justify-end gap-4 border-t border-white/10">
            <button onClick={() => setShowForm(false)} className="px-8 py-4 rounded-2xl text-white/40 font-bold text-xs uppercase hover:text-white transition-colors border border-transparent hover:border-white/10">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] px-10 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100">
              {loading ? (
                <> <div className="w-4 h-4 border-2 border-[#0b1220] border-t-transparent rounded-full animate-spin"></div> A Criar Pastas e Planilhas... </>
              ) : (
                <> <Save size={18} /> Salvar e Gerar Docs </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* LISTAGEM DE FUNCIONÁRIOS (GRID) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {listaFiltrada.map((f: any) => (
          <div key={f.matricula || f.id} className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 group hover:border-amber-500/20 transition-all relative">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-900/50">
                  <span className="font-black text-2xl">{f.nomeCompleto?.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">{f.nomeCompleto}</h3>
                  <p className="text-white/40 text-xs font-mono uppercase mt-1 tracking-wider">MATRÍCULA: <span className="text-amber-500 font-bold">{f.matricula}</span></p>
                </div>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${f.situacao === 'Ativo' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {f.situacao}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="p-4 bg-[#0b1220] rounded-2xl border border-white/5">
                 <p className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-1">Cargo</p>
                 <p className="text-white text-xs font-bold truncate" title={f.funcao}>{f.funcao || 'N/D'}</p>
               </div>
               <div className="p-4 bg-[#0b1220] rounded-2xl border border-white/5">
                 <p className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-1">Departamento</p>
                 <p className="text-white text-xs font-bold truncate" title={f.departamento}>{f.departamento || 'N/D'}</p>
               </div>
            </div>

            {/* LINKS DE AUTOMAÇÃO */}
            {f.driveLinks && (
              <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                <div className="flex justify-between items-center">
                   <p className="text-[9px] text-amber-500 font-black uppercase tracking-[0.2em]">Pasta no Drive</p>
                   <a href={f.driveLinks.pasta} target="_blank" className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 hover:underline"><Folder size={12}/> Abrir Diretório</a>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <a href={f.driveLinks.planilhaHorario} target="_blank" className="bg-[#0b1220] hover:bg-amber-500 hover:text-[#0b1220] border border-white/5 p-3 rounded-xl flex items-center justify-center gap-2 text-white text-[10px] font-bold uppercase transition-all group/btn">
                    <Calendar size={14} className="group-hover/btn:scale-110 transition-transform"/> Planilha Horas
                  </a>
                  <a href={f.driveLinks.planilhaRegistro} target="_blank" className="bg-[#0b1220] hover:bg-purple-500 hover:text-white border border-white/5 p-3 rounded-xl flex items-center justify-center gap-2 text-white text-[10px] font-bold uppercase transition-all group/btn">
                    <FileSpreadsheet size={14} className="group-hover/btn:scale-110 transition-transform"/> Registo Geral
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .label-form { @apply text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-2 block; }
        .input-form { @apply w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20; }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ffffff20; rounded: 4px; }
      `}</style>
    </div>
  );
}
