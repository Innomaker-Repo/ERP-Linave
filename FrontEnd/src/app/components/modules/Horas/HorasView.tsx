import React, { useState, useEffect } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Clock, Plus, Save, Trash2, Calendar, User, Briefcase, Calculator, Hourglass, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface Intervalo {
  id: number;
  entrada: string;
  saida: string;
}

export function HorasView() {
  const { funcionarios, obras, financeiro, saveEntity, userSession } = useErp();
  
  // Abas internas
  const [activeTab, setActiveTab] = useState<'registro' | 'banco'>('registro');

  // Estado do Formulário
  const [modoEntrada, setModoEntrada] = useState<'intervalos' | 'total'>('intervalos');
  const [intervalos, setIntervalos] = useState<Intervalo[]>([{ id: 1, entrada: '08:00', saida: '12:00' }, { id: 2, entrada: '13:00', saida: '17:00' }]);
  const [horasTotaisManual, setHorasTotaisManual] = useState<string>('');
  
  const [formData, setFormData] = useState({
    funcionarioId: '',
    obraId: '',
    data: new Date().toISOString().split('T')[0],
    tipoHora: 'Normal', // Normal, 50%, 100%, Noturna
    destino: 'Banco', // Padrão 'Banco' ou 'Pagamento'
    descricao: ''
  });

  // Estados Calculados
  const [cargaDiaria, setCargaDiaria] = useState(8); // Meta padrão de 8h
  const [horasTrabalhadas, setHorasTrabalhadas] = useState(0);
  const [saldoDia, setSaldoDia] = useState(0);

  // 1. Ao selecionar funcionário, define a meta diária (Pode vir do cadastro do funcionário futuramente)
  useEffect(() => {
    if (formData.funcionarioId) {
      // Aqui você poderia buscar func.cargaHoraria se existisse no cadastro.
      // Por enquanto, fixamos 8h como padrão de engenharia, ou 0 se for fim de semana/feriado.
      const date = new Date(formData.data);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      setCargaDiaria(isWeekend ? 0 : 8); 
    }
  }, [formData.funcionarioId, formData.data]);

  // 2. Cálculo em Tempo Real (Onde a mágica acontece)
  useEffect(() => {
    let decimalTotal = 0;

    if (modoEntrada === 'intervalos') {
      let minutosTotais = 0;
      intervalos.forEach(int => {
        if (int.entrada && int.saida) {
          const [hE, mE] = int.entrada.split(':').map(Number);
          const [hS, mS] = int.saida.split(':').map(Number);
          
          const inicio = hE * 60 + mE;
          const fim = hS * 60 + mS;
          
          if (fim > inicio) {
            minutosTotais += (fim - inicio);
          }
        }
      });
      decimalTotal = minutosTotais / 60;
    } else {
      decimalTotal = Number(horasTotaisManual);
    }

    setHorasTrabalhadas(decimalTotal);
    setSaldoDia(decimalTotal - cargaDiaria);

  }, [intervalos, horasTotaisManual, modoEntrada, cargaDiaria]);

  // Manipulação dos Intervalos
  const addIntervalo = () => setIntervalos([...intervalos, { id: Date.now(), entrada: '', saida: '' }]);
  const removeIntervalo = (id: number) => {
    if (intervalos.length > 1) setIntervalos(intervalos.filter(i => i.id !== id));
  };
  const updateIntervalo = (id: number, field: 'entrada' | 'saida', value: string) => {
    setIntervalos(intervalos.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  // Salvar
  const handleSave = () => {
    if (!formData.funcionarioId || !formData.obraId) return alert("Preencha os campos obrigatórios.");
    if (horasTrabalhadas <= 0) return alert("Nenhuma hora registrada.");

    const func = funcionarios.find((f: any) => f.id === Number(formData.funcionarioId));
    const obra = obras.find((o: any) => o.id === formData.obraId);

    // Multiplicador de Custo (Financeiro)
    let multiplicador = 1;
    if (formData.tipoHora.includes('50%')) multiplicador = 1.5;
    if (formData.tipoHora.includes('100%')) multiplicador = 2;
    if (formData.tipoHora.includes('Noturna')) multiplicador = 1.2;

    const horasCompensaveis = horasTrabalhadas * multiplicador;
    const custoFinanceiro = (func?.valorHora || 0) * horasCompensaveis;

    if (formData.destino === 'Pagamento') {
      // Cria despesa no Financeiro se for para pagar
      const novaDespesa = {
        id: `FIN-HH-${Date.now()}`,
        descricao: `Mão de Obra: ${func?.nome} (${formData.tipoHora})`,
        valor: custoFinanceiro,
        tipo: 'despesa',
        categoria: 'Mão de Obra',
        obraId: obra?.nome,
        entidadeId: func?.nome,
        dataPrevista: formData.data,
        status: 'Pendente',
        origem: 'Registro de Horas'
      };
      saveEntity('financeiro', [...(financeiro || []), novaDespesa]);
      alert(`Registrado! Custo de R$ ${custoFinanceiro.toFixed(2)} enviado ao Financeiro.`);
    } else {
      // Lógica de Banco de Horas
      alert(`Registrado! ${horasCompensaveis.toFixed(2)}h creditadas no Banco de Horas de ${func?.nome}.`);
    }

    // Limpa formulário levemente
    setFormData({ ...formData, descricao: '' });
  };

  // Listas seguras
  const listaFunc = Array.isArray(funcionarios) ? funcionarios : [];
  const listaObras = Array.isArray(obras) ? obras : [];

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-white/5 pb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-500 rounded-2xl text-white"><Clock size={32} /></div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Apontamento</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Controle de Horas e Produtividade</p>
          </div>
        </div>
        <div className="flex bg-[#101f3d] p-1 rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('registro')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'registro' ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>Registro Diário</button>
          <button onClick={() => setActiveTab('banco')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'banco' ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>Extrato Banco</button>
        </div>
      </div>

      {activeTab === 'registro' && (
        <div className="bg-[#101f3d] border border-white/10 rounded-[40px] p-8 shadow-2xl">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* COLUNA ESQUERDA: DADOS + REGISTRO DE TEMPO */}
            <div className="xl:col-span-7 space-y-6">
              <div className="bg-[#0b1220]/50 p-8 rounded-[32px] border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2">
                  <label className="label-erp">Colaborador *</label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"/>
                    <select className="input-erp pl-12 appearance-none cursor-pointer" value={formData.funcionarioId} onChange={e => setFormData({...formData, funcionarioId: e.target.value})}>
                      <option value="">Quem executou?</option>
                      {listaFunc.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-erp">Centro de Custo (Obra) *</label>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"/>
                    <select className="input-erp pl-12 appearance-none cursor-pointer" value={formData.obraId} onChange={e => setFormData({...formData, obraId: e.target.value})}>
                      <option value="">Onde foi feito?</option>
                      {listaObras.map((o: any) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-erp">Data da Execução *</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"/>
                    <input type="date" className="input-erp pl-12 cursor-pointer" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-erp">Tipo de Hora *</label>
                  <select className="input-erp font-bold appearance-none cursor-pointer text-amber-400" value={formData.tipoHora} onChange={e => setFormData({...formData, tipoHora: e.target.value})}>
                    <option className="text-white">Normal (100%)</option>
                    <option className="text-amber-400">Extra 50%</option>
                    <option className="text-red-400">Extra 100%</option>
                    <option className="text-purple-400">Noturna</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label-erp">Descrição das Atividades</label>
                <textarea 
                  className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-purple-500 transition-all placeholder:text-white/20 resize-none h-32"
                  placeholder="Detelhe o que foi feito, imprevistos ou progressos..."
                  value={formData.descricao}
                  onChange={e => setFormData({...formData, descricao: e.target.value})}
                />
              </div>

              {/* REGISTRO DE TEMPO (PICADO OU TOTAL) - AGORA AQUI */}
              <div className="bg-[#0b1220]/50 p-6 rounded-[32px] border border-white/5 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="label-erp mb-0">Registro de Tempo</label>
                  <div className="flex bg-[#101f3d] rounded-lg p-0.5">
                    <button onClick={() => setModoEntrada('intervalos')} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${modoEntrada === 'intervalos' ? 'bg-purple-500 text-white' : 'text-white/40'}`}>Picado</button>
                    <button onClick={() => setModoEntrada('total')} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${modoEntrada === 'total' ? 'bg-purple-500 text-white' : 'text-white/40'}`}>Total</button>
                  </div>
                </div>

                {modoEntrada === 'intervalos' ? (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                    {intervalos.map((int, idx) => (
                      <div key={int.id} className="flex items-center gap-3 animate-in slide-in-from-left-2">
                        <span className="text-white/20 text-xs font-mono w-4">{idx + 1}.</span>
                        <input type="time" className="input-time" value={int.entrada} onChange={e => updateIntervalo(int.id, 'entrada', e.target.value)} />
                        <ArrowRight size={14} className="text-white/20" />
                        <input type="time" className="input-time" value={int.saida} onChange={e => updateIntervalo(int.id, 'saida', e.target.value)} />
                        {idx === 0 ? <button onClick={addIntervalo} className="p-3 bg-amber-500/20 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-[#0b1220] transition-colors"><Plus size={16}/></button> : <button onClick={() => removeIntervalo(int.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={16}/></button>}
                      </div>
                    ))}
                    <p className="text-[9px] text-white/30 italic text-center mt-2">Intervalos de almoço não devem ser inseridos.</p>
                  </div>
                ) : (
                  <div>
                    <input type="number" placeholder="Ex: 8.5" className="w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-center font-black text-2xl outline-none focus:border-purple-500" value={horasTotaisManual} onChange={e => setHorasTotaisManual(e.target.value)} />
                    <p className="text-[9px] text-white/30 italic text-center mt-2">Digite o total de horas trabalhadas.</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA DIREITA: CÁLCULO E DECISÃO */}
            <div className="xl:col-span-5 flex flex-col gap-6">
              
              {/* CARD DE CÁLCULO (VISUAL DA IMAGEM) */}
              <div className="bg-[#0b1220] p-8 rounded-[32px] border border-white/5 text-center relative overflow-hidden h-full flex flex-col justify-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                
                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Total Trabalhado</p>
                    <p className="text-7xl font-black text-white mt-2 tracking-tighter">{horasTrabalhadas.toFixed(2)}<span className="text-xl text-white/20 ml-1">h</span></p>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-white/5 pt-6">
                    <div className="text-left">
                      <p className="text-[9px] text-white/30 uppercase font-bold">Meta Diária</p>
                      <p className="text-white font-bold text-xl">{cargaDiaria}h</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-white/30 uppercase font-bold">Saldo do Dia</p>
                      <p className={`font-black text-2xl ${saldoDia >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {saldoDia > 0 ? '+' : ''}{saldoDia.toFixed(2)}h
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* DESTINO DAS HORAS (BOTÕES DA IMAGEM) */}
              <div className="space-y-3">
                <label className="label-erp ml-1">Destino das Horas</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setFormData({...formData, destino: 'Pagamento'})}
                    className={`p-4 rounded-xl text-[10px] font-black uppercase border transition-all ${formData.destino === 'Pagamento' ? 'bg-emerald-500 text-[#0b1220] border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-transparent text-white/20 border-white/10 hover:border-amber-500/50'}`}
                  >
                    Pagamento
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, destino: 'Banco'})}
                    className={`p-4 rounded-xl text-[10px] font-black uppercase border transition-all ${formData.destino === 'Banco' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-transparent text-white/20 border-white/10 hover:border-blue-600/50'}`}
                  >
                    Banco Horas
                  </button>
                </div>
              </div>

              <button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-purple-900/30 transition-all flex items-center justify-center gap-3 mt-auto">
                <Save size={18} /> Confirmar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA BANCO DE HORAS */}
      {activeTab === 'banco' && (
        <div className="bg-[#101f3d] border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-4 mb-4">
            <Hourglass className="text-blue-400" size={24} />
            <h3 className="text-xl font-bold text-white uppercase italic">Extrato de Banco de Horas</h3>
          </div>
          <p className="text-white/40 text-sm">Visualização de saldo acumulado por colaborador.</p>
          {/* Tabela de Banco de Horas viria aqui */}
        </div>
      )}

      <style>{`
        .label-erp { @apply text-[9px] font-black text-white/30 uppercase tracking-widest ml-2 block mb-1.5; }
        .input-erp { @apply w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-purple-500 focus:bg-[#0e1623] transition-all placeholder:text-white/20; }
        .input-time { @apply w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-center font-mono text-sm outline-none focus:border-purple-500 focus:bg-[#0e1623] transition-all; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ffffff20; border-radius: 4px; }
      `}</style>
    </div>
  );
}
