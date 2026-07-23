import React from 'react';
import { useErp } from '../../../context/ErpContext';
import { Users, Building2, HardHat, DollarSign, Activity, TrendingUp } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const agruparFinanceiroPorMes = (items: any[] = []) => {
  const agrupado = new Map<number, { mes: string; receitas: number; despesas: number }>();

  items.forEach((item: any) => {
    const dataReferencia = item?.dataRealizada || item?.dataPrevista || item?.data || item?.createdAt;
    if (!dataReferencia) return;

    const data = new Date(dataReferencia);
    if (Number.isNaN(data.getTime())) return;

    const mesIndex = data.getMonth();
    const atual = agrupado.get(mesIndex) || { mes: MESES_PT[mesIndex], receitas: 0, despesas: 0 };

    if (item?.tipo === 'receita') {
      atual.receitas += Number(item?.valor) || 0;
    }

    if (item?.tipo === 'despesa') {
      atual.despesas += Number(item?.valor) || 0;
    }

    agrupado.set(mesIndex, atual);
  });

  return [...agrupado.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value);
};

export function DashboardView() {
  const { clientes, obras, financeiro, funcionarios } = useErp();
  const listaFinanceiro = Array.isArray(financeiro) ? financeiro : [];
  const temFinanceiro = listaFinanceiro.length > 0;
  
  // Cálculos de saldo
  const totalReceitas = listaFinanceiro
    .filter((item: any) => item.tipo === 'receita')
    .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);
  
  const totalDespesas = listaFinanceiro
    .filter((item: any) => item.tipo === 'despesa')
    .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);
  
  const saldo = totalReceitas - totalDespesas;

  const pieData = temFinanceiro
    ? [
        { name: 'Receitas', value: totalReceitas || 0 },
        { name: 'Despesas', value: totalDespesas || 0 },
      ]
    : [];

  const financeiroPorMes = agruparFinanceiroPorMes(listaFinanceiro);
  const barData = financeiroPorMes;
  const lineData = financeiroPorMes.reduce((acumulado: Array<{ mes: string; saldo: number }>, item) => {
    const saldoAnterior = acumulado.length > 0 ? acumulado[acumulado.length - 1].saldo : 0;
    acumulado.push({
      mes: item.mes,
      saldo: saldoAnterior + item.receitas - item.despesas,
    });
    return acumulado;
  }, []);

  // Cores
  const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      {/* Header com título */}
      <div>
        <h1 className="text-3xl font-black text-white">Dashboard Linave</h1>
        <p className="text-white/40 text-sm mt-2">Bem-vindo ao painel de controle da sua empresa</p>
      </div>

      {/* Cards informativos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5 hover:border-white/10 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-black uppercase">Saldo Total</p>
              <h3 className={`text-2xl font-black mt-3 ${saldo >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                R$ {Math.abs(saldo).toLocaleString('pt-BR')}
              </h3>
            </div>
            <DollarSign className="w-10 h-10 text-amber-500 opacity-20" />
          </div>
        </div>

        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5 hover:border-white/10 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-black uppercase">Receitas</p>
              <h3 className="text-2xl font-black text-green-400 mt-3">R$ {totalReceitas.toLocaleString('pt-BR')}</h3>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5 hover:border-white/10 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-black uppercase">Despesas</p>
              <h3 className="text-2xl font-black text-red-400 mt-3">R$ {totalDespesas.toLocaleString('pt-BR')}</h3>
            </div>
            <Activity className="w-10 h-10 text-red-500 opacity-20" />
          </div>
        </div>

        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5 hover:border-white/10 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-black uppercase">Obras Ativas</p>
              <h3 className="text-2xl font-black text-blue-400 mt-3">{(obras || []).length}</h3>
            </div>
            <HardHat className="w-10 h-10 text-blue-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <div className="bg-[#101f3d] p-3 rounded-3xl border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-white ml-4">Distribuição Financeira</h2>
          </div>
          {temFinanceiro ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: R$ ${(Number(value) / 1000).toFixed(1)}k`}
                  outerRadius={110}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => `R$ ${(Number(value) / 1000).toFixed(1)}k`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-white/30 text-sm px-8 text-center">
              Nenhum lançamento financeiro cadastrado ainda. Cadastre receitas e despesas para visualizar a distribuição.
            </div>
          )}
        </div>

        {/* Gráfico de Barras - Receitas vs Despesas */}
        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5">
          <h2 className="text-lg font-black text-white mb-6">Receitas vs Despesas</h2>
          {temFinanceiro ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="mes" stroke="#ffffff40" />
                <YAxis stroke="#ffffff40" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => `R$ ${(Number(value) / 1000).toFixed(1)}k`}
                />
                <Legend />
                <Bar dataKey="receitas" fill="#10b981" name="Receitas" radius={[8, 8, 0, 0]} />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-white/30 text-sm px-8 text-center">
              Ainda não há movimentações para montar o gráfico mensal.
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de Linha - Evolução do Saldo */}
      <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5">
        <h2 className="text-lg font-black text-white mb-6">Evolução do Saldo Mensal</h2>
        {temFinanceiro ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="mes" stroke="#ffffff40" />
              <YAxis stroke="#ffffff40" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                formatter={(value) => `R$ ${(Number(value) / 1000).toFixed(1)}k`}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke="#f59e0b"
                dot={{ fill: '#f59e0b', r: 5 }}
                activeDot={{ r: 7 }}
                strokeWidth={2}
                name="Saldo"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-white/30 text-sm px-8 text-center">
            O saldo mensal será calculado a partir dos lançamentos cadastrados manualmente.
          </div>
        )}
      </div>

      {/* Cards adicionais de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5">
          <p className="text-white/40 text-[10px] font-black uppercase mb-3">Total de Clientes</p>
          <h3 className="text-3xl font-black text-blue-400">{(clientes || []).length}</h3>
          <p className="text-white/20 text-xs mt-2">Clientes cadastrados</p>
        </div>

        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5">
          <p className="text-white/40 text-[10px] font-black uppercase mb-3">Total de Funcionários</p>
          <h3 className="text-3xl font-black text-purple-400">{(funcionarios || []).length}</h3>
          <p className="text-white/20 text-xs mt-2">Colaboradores da empresa</p>
        </div>

        <div className="bg-[#101f3d] p-6 rounded-3xl border border-white/5">
          <p className="text-white/40 text-[10px] font-black uppercase mb-3">média por obra</p>
          <h3 className="text-3xl font-black text-amber-400">
            R$ {obras && obras.length > 0 ? (totalReceitas / obras.length).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}
          </h3>
          <p className="text-white/20 text-xs mt-2">Receita média</p>
        </div>
      </div>
    </div>
  );
}
