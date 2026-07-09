import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { FileText, Plus, Save, Trash2, Link as LinkIcon, ExternalLink, Settings, FolderOpen } from 'lucide-react';

export function TemplatesView() {
  const { templates, saveTemplates } = useErp();
  
  // Estado para o novo template
  const [novo, setNovo] = useState({ 
    nome: '', 
    fase: 'Engenharia', 
    link: '' 
  });

  // Fases baseadas no fluxo mapeado
  const fases = [
    'Comercial',      // Pré-Venda, Propostas
    'Iniciação',      // TAP, Escopo
    'Planejamento',   // EAP, Cronograma
    'Engenharia',     // Projetos Técnicos
    'Fabricacao',     // Testes, Prototipagem
    'Operacao',       // Serviços de Campo
    'Qualidade',      // Relatórios de Teste
    'Encerramento',   // Termos de Conclusão
    'RH',             // Contratos de Trabalho
    'Financeiro'      // Modelos de Nota Fiscal/Recibo
  ];

  const handleAdd = () => {
    if (!novo.nome || !novo.link) return alert("Por favor, preencha o nome e o link do documento.");
    
    // Garante que templates é um array
    const listaAtual = Array.isArray(templates) ? templates : [];
    
    const novaLista = [...listaAtual, { ...novo, id: Date.now().toString() }];
    saveTemplates(novaLista);
    
    // Limpa o formulário
    setNovo({ nome: '', fase: 'Engenharia', link: '' });
    alert("Template adicionado com sucesso!");
  };

  const handleRemove = (id: string) => {
    if (confirm("Tem a certeza que deseja remover este template?")) {
      const listaAtual = Array.isArray(templates) ? templates : [];
      saveTemplates(listaAtual.filter((t: any) => t.id !== id));
    }
  };

  // Agrupa templates por fase para visualização
  const listaTemplates = Array.isArray(templates) ? templates : [];

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-500 rounded-2xl text-white shadow-lg shadow-purple-500/20">
            <FolderOpen size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Biblioteca de Templates</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
              Padronização de Documentos (GED)
            </p>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE CADASTRO */}
      <div className="bg-[#101f3d] p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
        
        <h3 className="text-amber-500 font-bold text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
          <Plus size={16} /> Adicionar Novo Modelo
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Nome do Documento */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-2">Nome do Documento</label>
            <div className="relative group">
              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors" size={18} />
              <input 
                className="w-full bg-[#0b1220] border border-white/10 p-4 pl-12 rounded-2xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20"
                placeholder="Ex: Relatório de Falhas"
                value={novo.nome}
                onChange={e => setNovo({...novo, nome: e.target.value})}
              />
            </div>
          </div>

          {/* Fase / Setor */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-2">Fase / Setor</label>
            <div className="relative group">
              <Settings className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors" size={18} />
              <select 
                className="w-full bg-[#0b1220] border border-white/10 p-4 pl-12 rounded-2xl text-white text-sm outline-none focus:border-amber-500 appearance-none cursor-pointer transition-all"
                value={novo.fase}
                onChange={e => setNovo({...novo, fase: e.target.value})}
              >
                {fases.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">▼</div>
            </div>
          </div>

          {/* Link do Modelo */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-2">Link do Modelo (Drive/Docs)</label>
            <div className="relative group">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                className="w-full bg-[#0b1220] border border-white/10 p-4 pl-12 rounded-2xl text-blue-400 text-sm outline-none focus:border-blue-500 transition-all placeholder:text-white/20"
                placeholder="https://docs.google.com/..."
                value={novo.link}
                onChange={e => setNovo({...novo, link: e.target.value})}
              />
            </div>
          </div>

        </div>

        <div className="mt-8 text-right border-t border-white/5 pt-6">
          <button 
            onClick={handleAdd} 
            className="bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] px-10 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 flex items-center gap-2 ml-auto"
          >
            <Save size={18} /> Salvar Template
          </button>
        </div>
      </div>

      {/* LISTA DE TEMPLATES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listaTemplates.length > 0 ? listaTemplates.map((t: any) => (
          <div key={t.id} className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 group hover:border-amber-500/20 transition-all relative flex flex-col justify-between min-h-[180px]">
            
            <div className="flex justify-between items-start">
              <div className="p-3 bg-white/5 rounded-2xl text-amber-500 group-hover:bg-amber-500/10 transition-colors">
                <FileText size={24} />
              </div>
              <button 
                onClick={() => handleRemove(t.id)} 
                className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                title="Apagar Template"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="mt-4">
              <span className="text-[9px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg uppercase font-black tracking-wider border border-blue-500/20">
                {t.fase}
              </span>
              <h4 className="text-white font-bold text-lg mt-3 leading-tight">{t.nome}</h4>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <a 
                href={t.link} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-2 text-white/40 text-xs font-bold hover:text-blue-400 transition-colors group/link"
              >
                <ExternalLink size={14} className="group-hover/link:scale-110 transition-transform" /> Aceder ao Modelo
              </a>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
            <FolderOpen size={48} className="mx-auto text-white/10 mb-4" />
            <p className="text-white/20 font-black uppercase tracking-widest text-sm">
              Nenhum template cadastrado.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
