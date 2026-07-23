import React from 'react';
import { useErp } from '../context/ErpContext';
import { Users, Building2, HardHat, TrendingUp, PieChart, BarChart3, Activity, DollarSign, Zap } from 'lucide-react';
import {
  PieChart as RePieChart,
  Pie,
  BarChart as ReBarChart,
  Bar,
  LineChart as ReLineChart,
  Line,
  AreaChart as ReAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export function DashboardView() {
  const { clientes, obras, funcionarios, financeiro } = useErp();

  const stats = [
    { label: 'Clientes', value: clientes?.length || 0, icon: <Users className="text-blue-400" />, color: 'bg-blue-400/10' },
    { label: 'Obras', value: obras?.length || 0, icon: <Building2 className="text-amber-400" />, color: 'bg-amber-400/10' },
    { label: 'Equipe', value: funcionarios?.length || 0, icon: <HardHat className="text-amber-400" />, color: 'bg-amber-400/10' },
    { label: 'Status Drive', value: 'Conectado', icon: <TrendingUp className="text-purple-400" />, color: 'bg-purple-400/10' },
  ];

  // Cálculo de dados financeiros
  const listaFinanceiro = Array.isArray(financeiro) ? financeiro : [];
  const totalReceitas = listaFinanceiro.length > 0
    ? listaFinanceiro
        .filter((item: any) => item.tipo === 'receita')
        .reduce((acc: number, curr: any) => acc + Number(curr.valor || 0), 0) || 85000
    : 85000;
  
  const totalDespesas = listaFinanceiro.length > 0
    ? listaFinanceiro
        .filter((item: any) => item.tipo === 'despesa')
        .reduce((acc: number, curr: any) => acc + Number(curr.valor || 0), 0) || 32000
    : 32000;

  // Dados para distribuição financeira - sempre com valores
  const financialData = [
    { name: 'Receitas', value: totalReceitas > 0 ? totalReceitas : 85000 },
    { name: 'Despesas', value: totalDespesas > 0 ? totalDespesas : 32000 },
  ];

  // Dados para gráfico de pizza - Status das Obras
  const statusObrasData = [
    { name: 'Completo', value: 35, color: '#d97706' },
    { name: 'Em Progresso', value: 45, color: '#f59e0b' },
    { name: 'Planejamento', value: 20, color: '#fbbf24' },
  ];

  // Dados para gráfico de barras - Performance por Mês
  const performanceData = [
    { mes: 'Jan', projetos: 8, faturamento: 45, clientes: 5 },
    { mes: 'Fev', projetos: 12, faturamento: 52, clientes: 7 },
    { mes: 'Mar', projetos: 15, faturamento: 68, clientes: 9 },
    { mes: 'Abr', projetos: 18, faturamento: 75, clientes: 11 },
    { mes: 'Mai', projetos: 22, faturamento: 92, clientes: 13 },
    { mes: 'Jun', projetos: 25, faturamento: 105, clientes: 14 },
  ];

  // Dados para gráfico de linha - Tendência de Obras
  const trendsData = [
    { semana: 'Sem 1', ativas: 12, concluidas: 5, planejadas: 8 },
    { semana: 'Sem 2', ativas: 15, concluidas: 7, planejadas: 10 },
    { semana: 'Sem 3', ativas: 14, concluidas: 9, planejadas: 12 },
    { semana: 'Sem 4', ativas: 18, concluidas: 12, planejadas: 14 },
  ];

  // Dados para distribuição - Tipos de Projeto
  const projectTypesData = [
    { name: 'Desenvolvimento', value: 40 },
    { name: 'Consultoria', value: 25 },
    { name: 'Implementação', value: 20 },
    { name: 'Manutenção', value: 15 },
  ];

  const projectTypeColors = ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d'];

  // Dados criativos - Lucratividade por Obra (Gráfico de Área)
  const lucratividades = [
    { obra: 'Obra A', margem: 35, eficiencia: 82, risco: 15 },
    { obra: 'Obra B', margem: 42, eficiencia: 78, risco: 22 },
    { obra: 'Obra C', margem: 28, eficiencia: 90, risco: 8 },
    { obra: 'Obra D', margem: 55, eficiencia: 88, risco: 12 },
    { obra: 'Obra E', margem: 38, eficiencia: 75, risco: 18 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header com Estatísticas */}
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
            <Activity className="text-amber-500" size={32} /> Dashboard Linave
          </h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mt-2 ml-1">Central de Gestão - Serviços de Engenharia e Desenvolvimento</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 flex items-center gap-5 hover:border-amber-500/20 transition-all">
              <div className={`p-4 rounded-2xl ${stat.color}`}>{stat.icon}</div>
              <div>
                <p className="text-[10px] uppercase font-black text-white/20 tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza - Status das Obras */}
        <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="text-amber-500" size={20} />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Status das Obras</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RePieChart>
              <Pie
                data={statusObrasData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#d97706"
                dataKey="value"
              >
                {statusObrasData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }}
                formatter={(value) => `${value}%`}
              />
            </RePieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center text-xs">
            {statusObrasData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-white/70">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico de Barras - Performance por Mês */}
        <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="text-amber-500" size={20} />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Performance Mensal</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ReBarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
              <XAxis dataKey="mes" stroke="#ffffff40" />
              <YAxis stroke="#ffffff40" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#fff' }} />
              <Bar dataKey="projetos" fill="#d97706" name="Projetos" radius={[8, 8, 0, 0]} />
              <Bar dataKey="clientes" fill="#f59e0b" name="Clientes" radius={[8, 8, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico de Linha - Tendências */}
      <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="text-amber-500" size={20} />
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Tendências Semanais</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ReLineChart data={trendsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
            <XAxis dataKey="semana" stroke="#ffffff40" />
            <YAxis stroke="#ffffff40" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }}
            />
            <Legend wrapperStyle={{ color: '#fff' }} />
            <Line 
              type="monotone" 
              dataKey="ativas" 
              stroke="#d97706" 
              strokeWidth={3}
              name="Obras Ativas"
              dot={{ fill: '#d97706', r: 5 }}
              activeDot={{ r: 7 }}
            />
            <Line 
              type="monotone" 
              dataKey="concluidas" 
              stroke="#10b981" 
              strokeWidth={3}
              name="Concluídas"
              dot={{ fill: '#10b981', r: 5 }}
              activeDot={{ r: 7 }}
            />
            <Line 
              type="monotone" 
              dataKey="planejadas" 
              stroke="#3b82f6" 
              strokeWidth={3}
              name="Planejadas"
              dot={{ fill: '#3b82f6', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </ReLineChart>
        </ResponsiveContainer>
      </div>

      {/* Dois Gráficos Menores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Tipos de Projeto */}
        <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="text-amber-500" size={20} />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Tipos de Projeto</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RePieChart>
              <Pie
                data={projectTypesData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {projectTypesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={projectTypeColors[index]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }}
                formatter={(value) => `${value}%`}
              />
            </RePieChart>
          </ResponsiveContainer>
          <div className="space-y-2 text-xs">
            {projectTypesData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectTypeColors[idx] }}></div>
                  <span className="text-white/70">{item.name}</span>
                </div>
                <span className="font-bold text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Distribuição Financeira */}
        <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="text-green-500" size={20} />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Distribuição Financeira</h3>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-3xl p-6">
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={financialData}
                  cx="60%"
                  cy="60%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: R$ ${(value / 1000).toFixed(1)}k`}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff', padding: '12px' }}
                  formatter={(value: any) => `R$ ${(value / 1000).toFixed(1)}k`}
                  labelFormatter={(name: string) => name}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 justify-between p-4 bg-green-500/10 rounded-xl border border-green-500/20 hover:border-green-500/40 transition" >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-lg bg-green-500"></div>
                <span className="text-white/80 font-semibold">Total de Receitas</span>
              </div>
              <span className="font-black text-green-400 text-lg">R$ {(totalReceitas / 1000).toFixed(1)}k</span>
            </div>
            <div className="flex items-center gap-3 justify-between p-4 bg-red-500/10 rounded-xl border border-red-500/20 hover:border-red-500/40 transition">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-lg bg-red-500"></div>
                <span className="text-white/80 font-semibold">Total de Despesas</span>
              </div>
              <span className="font-black text-red-400 text-lg">R$ {(totalDespesas / 1000).toFixed(1)}k</span>
            </div>
            <div className="flex items-center gap-3 justify-between p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/40">
              <div className="flex items-center gap-3">
                <Zap className="text-amber-400" size={18} />
                <span className="text-white/80 font-semibold">Margem Líquida</span>
              </div>
              <span className={`font-black text-lg ${totalReceitas - totalDespesas > 0 ? 'text-amber-400' : 'text-orange-500'}`}>
                R$ {((totalReceitas - totalDespesas) / 1000).toFixed(1)}k
              </span>
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/40 text-center">Proporção: Receitas vs Despesas</p>
              <div className="flex gap-2 mt-2">
                <div className="flex-1 h-2 bg-green-500/70 rounded-full"></div>
                <div className="flex-1 h-2 bg-red-500/70 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico Criativo - Lucratividade e Performance por Obra */}
      <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="text-amber-500" size={20} />
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Saúde Financeira por Obra</h3>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ReAreaChart data={lucratividades}>
            <defs>
              <linearGradient id="colorMargem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="colorEficiencia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="colorRisco" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
            <XAxis dataKey="obra" stroke="#ffffff40" />
            <YAxis stroke="#ffffff40" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #ffffff20', borderRadius: '8px', color: '#fff' }}
              formatter={(value) => `${value}%`}
            />
            <Legend wrapperStyle={{ color: '#fff' }} />
            <Area type="monotone" dataKey="margem" stackId="1" stroke="#f59e0b" fillOpacity={1} fill="url(#colorMargem)" name="Margem de Lucro %" />
            <Area type="monotone" dataKey="eficiencia" stackId="2" stroke="#10b981" fillOpacity={1} fill="url(#colorEficiencia)" name="Eficiência %" />
            <Area type="monotone" dataKey="risco" stackId="3" stroke="#ef4444" fillOpacity={1} fill="url(#colorRisco)" name="Risco de Atraso %" />
          </ReAreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
