import React, { useState } from 'react';
import { FileText, Download, PieChart, Anchor, Package } from 'lucide-react';

export function RelatoriosView() {
  const [selectedReport, setSelectedReport] = useState<number | null>(null);

  const relatorios = [
    { 
      id: 1, 
      title: 'Investimento Navios', 
      type: 'Financeiro', 
      icon: Anchor,
      data: {
        periodo: 'Janeiro - Março 2026',
        investimentoTotal: 8943000,
        navios: [
          { nome: 'MV Copacabana', valor: 2400000, status: 'Em Construção' },
          { nome: 'Rebocador TugMax', valor: 1850000, status: 'Finalizado' },
          { nome: 'Cargueiro Atlântico', valor: 2893000, status: 'Em Construção' },
          { nome: 'Navio Tanque', valor: 1800000, status: 'Planejamento' },
        ]
      }
    },
    { 
      id: 2, 
      title: 'Consumo de Insumos', 
      type: 'Compras', 
      icon: Package,
      data: {
        periodo: 'Janeiro - Março 2026',
        consumoTotal: 1243500,
        insumos: [
          { nome: 'Aço Naval', quantidade: 450, unidade: 'ton', valor: 450000, preco: 1000 },
          { nome: 'Tubulações', quantidade: 320, unidade: 'm', valor: 280000, preco: 875 },
          { nome: 'Equipamentos Elétricos', quantidade: 85, unidade: 'un', valor: 340000, preco: 4000 },
          { nome: 'Parafusos/Fixadores', quantidade: 2000, unidade: 'kg', valor: 120000, preco: 60 },
          { nome: 'Tinta Industrial', quantidade: 150, unidade: 'L', valor: 50000, preco: 333 },
        ]
      }
    },
  ];

  const generatePDF = (report: any) => {
    // Simular download de PDF usando blob
    const pdfContent = `
RELATÓRIO - ${report.title}
=====================================

Período: ${report.data.periodo}

${report.id === 1 ? `
INVESTIMENTO TOTAL: R$ ${report.data.investimentoTotal.toLocaleString('pt-BR')}

DETALHAMENTO POR NAVIO:
${report.data.navios.map((n: any) => 
  `- ${n.nome}: R$ ${n.valor.toLocaleString('pt-BR')} (${n.status})`
).join('\n')}

Análise: O investimento em construção naval representa grande aporte de capital
com foco em modernização da frota e expansão das operações portuárias.
` : `
CONSUMO TOTAL: R$ ${report.data.consumoTotal.toLocaleString('pt-BR')}

DETALHAMENTO POR INSUMO:
${report.data.insumos.map((i: any) => 
  `- ${i.nome}: ${i.quantidade} ${i.unidade} = R$ ${i.valor.toLocaleString('pt-BR')} (R$ ${i.preco.toLocaleString('pt-BR')}/${i.unidade})`
).join('\n')}

Análise: O consumo de insumos mostra forte demanda por materiais navais,
refletindo o aumento da produção e manutenção de embarcações.
`}

Gerado em: ${new Date().toLocaleDateString('pt-BR')}
=====================================
    `;

    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('pt-BR')}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const selected = relatorios.find(r => r.id === selectedReport);

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-700">
      <h2 className="text-2xl font-black text-white uppercase italic">Central de Relatórios BI</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de Relatórios */}
        <div className="lg:col-span-1">
          <div className="bg-[#101f3d] p-8 rounded-[48px] border border-white/5 space-y-4">
            <h3 className="text-white font-black text-sm mb-6">RELATÓRIOS DISPONÍVEIS</h3>
            {relatorios.map(rel => (
              <div 
                key={rel.id} 
                onClick={() => setSelectedReport(rel.id)}
                className={`group flex items-center justify-between p-6 rounded-3xl border transition-all cursor-pointer ${
                  selectedReport === rel.id 
                    ? 'bg-amber-500/10 border-amber-500' 
                    : 'bg-[#0b1220] border-white/5 hover:border-amber-500/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    selectedReport === rel.id 
                      ? 'bg-amber-500/20 text-amber-500' 
                      : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    <rel.icon size={20} />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{rel.title}</p>
                    <p className="text-[10px] text-white/20 uppercase font-black">{rel.type}</p>
                  </div>
                </div>
                <Download size={18} className={`transition ${
                  selectedReport === rel.id 
                    ? 'text-amber-500' 
                    : 'text-white/10 group-hover:text-amber-500'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Preview do Relatório */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-[#101f3d] p-8 rounded-[48px] border border-white/5 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-black text-2xl">{selected.title}</h3>
                  <p className="text-white/40 text-sm mt-2">{selected.data.periodo}</p>
                </div>
                <button 
                  onClick={() => generatePDF(selected)}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2 rounded-lg transition"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>

              <div className="border-t border-white/10 pt-6">
                {selected.id === 1 ? (
                  <div className="space-y-4">
                    <div className="bg-[#0b1220] p-6 rounded-2xl border border-white/5">
                      <p className="text-white/40 text-xs uppercase font-black mb-2">Investimento Total</p>
                      <p className="text-3xl font-black text-amber-500">R$ {selected.data.investimentoTotal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-white font-black text-sm uppercase">Detalhamento por Navio:</p>
                      {selected.data.navios.map((navio: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-[#0b1220] rounded-xl border border-white/5">
                          <div>
                            <p className="text-white font-black">{navio.nome}</p>
                            <p className="text-white/40 text-xs mt-1">{navio.status}</p>
                          </div>
                          <p className="text-amber-500 font-black">R$ {navio.valor.toLocaleString('pt-BR')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[#0b1220] p-6 rounded-2xl border border-white/5">
                      <p className="text-white/40 text-xs uppercase font-black mb-2">Consumo Total</p>
                      <p className="text-3xl font-black text-amber-500">R$ {selected.data.consumoTotal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-white font-black text-sm uppercase">Detalhamento por Insumo:</p>
                      {selected.data.insumos.map((insumo: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-[#0b1220] rounded-xl border border-white/5">
                          <div>
                            <p className="text-white font-black">{insumo.nome}</p>
                            <p className="text-white/40 text-xs mt-1">{insumo.quantidade} {insumo.unidade} @ R$ {insumo.preco.toLocaleString('pt-BR')}/{insumo.unidade}</p>
                          </div>
                          <p className="text-amber-500 font-black">R$ {insumo.valor.toLocaleString('pt-BR')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#101f3d] p-8 rounded-[48px] border border-white/5 flex flex-col items-center justify-center h-full">
              <PieChart size={64} className="mb-4 text-white/20" />
              <p className="font-black uppercase tracking-widest text-center text-sm text-white/40">Selecione um relatório para analisar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
