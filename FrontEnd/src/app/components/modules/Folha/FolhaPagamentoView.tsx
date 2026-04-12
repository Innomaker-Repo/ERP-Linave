import React, { useMemo } from "react";
import { useErp } from "../../context/ErpContext";

export function FolhaPagamentoView() {
  const { registrosHoras, funcionarios, adicionarLancamentoFinanceiro } = useErp();
  const [mesFiltro, setMesFiltro] = React.useState("2026-02");

  const resumoFolha = useMemo(() => {
    return funcionarios.map(func => {
      // CONEXÃO: Filtra horas apenas deste funcionário no mês selecionado
      const horasMes = registrosHoras.filter(r => 
        r.funcionarioId === func.id && r.data.startsWith(mesFiltro)
      );

      const totalNormal = horasMes.filter(h => h.tipo === 'Normal').reduce((acc, h) => acc + h.horas, 0);
      const totalExtra = horasMes.filter(h => h.tipo === 'Extra').reduce((acc, h) => acc + h.horas, 0);
      
      const salarioBruto = (totalNormal * func.valorHora) + (totalExtra * (func.valorHora * 1.5));

      return { ...func, totalNormal, totalExtra, salarioBruto };
    });
  }, [registrosHoras, funcionarios, mesFiltro]);

  const fecharMes = async () => {
    const totalGeral = resumoFolha.reduce((acc, f) => acc + f.salarioBruto, 0);
    
    // CONEXÃO: Gera custo no financeiro automaticamente
    await adicionarLancamentoFinanceiro({
      tipo: 'Custo',
      categoria: 'Folha de Pagamento',
      valor: totalGeral,
      descricao: `Folha referente a ${mesFiltro}`,
      data: new Date().toISOString()
    });
    alert("Folha fechada e enviada ao Financeiro!");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#101f3d] p-6 rounded-3xl border border-white/10">
        <div>
          <h2 className="text-xl font-bold">Consolidação de Folha</h2>
          <p className="text-sm text-white/40">Cálculo automático baseado em registros de ponto.</p>
        </div>
        <button onClick={fecharMes} className="btn-primary">Fechar Mês e Lançar Custos</button>
      </div>

      <div className="overflow-x-auto bg-[#101f3d] rounded-3xl border border-white/10">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase text-white/40">
              <th className="p-4">Funcionário</th>
              <th className="p-4">Horas Regulares</th>
              <th className="p-4">Horas Extras</th>
              <th className="p-4">Provento Bruto</th>
            </tr>
          </thead>
          <tbody>
            {resumoFolha.map(f => (
              <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 font-medium">{f.nome}</td>
                <td className="p-4">{f.totalNormal}h</td>
                <td className="p-4 text-amber-400">+{f.totalExtra}h</td>
                <td className="p-4 text-amber-400 font-bold">R$ {f.salarioBruto.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
