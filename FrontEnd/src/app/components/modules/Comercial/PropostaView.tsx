import { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Plus, X, FileText, CheckCircle, XCircle, ArrowLeft, Save, Download } from 'lucide-react';
import { handleDownloadPropostaPDF } from '../CRM/handleDownloadPropostaPDF';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

interface EscopoLinha {
  id: string;
  valores: Record<string, string>;
}

interface EscopoServico {
  id: string;
  servicoId: string;
  titulo: string;
  descricaoServico: string;
  textosDepois: string[];
  colunas: string[];
  linhas: EscopoLinha[];
}

interface PropostaFormData {
  dataProposta: string;
  numeroProposta: string;
  cliente: string;
  atribuidoA: string;
  cargoContato: string;
  referencia: string;
  saudacao: string;
  assunto: string;
  textoAbertura: string;
  escopoA: string;
  escopoBasicoServicos: EscopoServico[];
  responsabilidadeContratada: string;
  escopoC: string;
  preco: string;
  condicoesGerais: string;
  condicoesPagamento: string;
  prazo: string;
  encerramento: string;
}

// --- FUNÇÕES AUXILIARES ---
const getPrefixoEmpresa = (empresaPrestadora?: string) => {
  if (!empresaPrestadora) return 'LN';
  return empresaPrestadora.toLowerCase().includes('servinave') ? 'SN' : 'LN';
};

const indexToVersaoAlfabetica = (index: number) => {
  if (index < 0) return 'A';
  let value = index;
  let output = '';
  while (value >= 0) {
    output = String.fromCharCode((value % 26) + 65) + output;
    value = Math.floor(value / 26) - 1;
  }
  return output;
};
// --------------------------


export function PropostaView() {
  const { obras, clientes, saveEntity } = useErp();
  const listaClientes = Array.isArray(clientes) ? clientes : [];
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'historico'>('list');
  const [selectedObra, setSelectedObra] = useState<any>(null);
  const [selectedPropostaVersion, setSelectedPropostaVersion] = useState<number | null>(null);

  const getInitialPropostaForm = (): PropostaFormData => ({
    dataProposta: new Date().toISOString().split('T')[0],
    numeroProposta: '',
    cliente: '',
    atribuidoA: '',
    cargoContato: '',
    referencia: '',
    saudacao: '',
    assunto: '',
    textoAbertura: `Vimos através desta apresentar nossa Proposta Técnica-Comercial, para serviços, conforme escopo e delineamento realizado a bordo, conforme solicitado para vossa avaliação e aprovação.\n\n\nEstamos à disposição para quaisquer esclarecimentos que se façam necessários.\n\n\nAtenciosamente,\n\n\nDiretoria Comercial`,
    escopoA: '',
    escopoBasicoServicos: [],
    responsabilidadeContratada: '',
    escopoC: '',
    preco: '',
    condicoesGerais: '',
    condicoesPagamento: '',
    prazo: '',
    encerramento: ''
  });

  const [propostaForm, setPropostaForm] = useState<PropostaFormData>(getInitialPropostaForm);
  const [novaColunaPorEscopo, setNovaColunaPorEscopo] = useState<Record<string, string>>({});

  // Negócios em Negociação
  const negociosNegociacao = (obras || []).filter((obra: any) => obra.categoria === 'Negociação');
  const negociosParaProposta = negociosNegociacao.filter((obra: any) => {
    if (!Array.isArray(obra.propostas) || obra.propostas.length === 0) return true;
    const ultimaProposta = obra.propostas[obra.propostas.length - 1];
    return ultimaProposta?.status === 'recusada';
  });
  
  // Todas as obras com propostas (independente do status)
  const obrasComPropostas = (obras || []).filter((obra: any) => obra.propostas && obra.propostas.length > 0);

  const criarLinhaEscopo = (colunas: string[]): EscopoLinha => ({
    id: `linha-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    valores: colunas.reduce((acc, coluna) => ({ ...acc, [coluna]: '' }), {} as Record<string, string>)
  });

  const criarEscopoBasicoServicos = (obra: any): EscopoServico[] => {
    const servicos = Array.isArray(obra?.servicos) ? obra.servicos : [];

    if (servicos.length === 0) {
      const colunasPadrao = ['Descrição'];
      return [{
        id: `escopo-${obra?.id || 'geral'}-1`,
        servicoId: '',
        titulo: 'Serviço Geral',
        descricaoServico: '',
        textosDepois: [],
        colunas: colunasPadrao,
        linhas: [criarLinhaEscopo(colunasPadrao)]
      }];
    }

    return servicos.map((servico: any, idx: number) => {
      const colunasPadrao = ['Descrição'];
      return {
        id: `escopo-${obra.id}-${servico.id || idx + 1}`,
        servicoId: String(servico.id || idx + 1),
        titulo: `${idx + 1}. ${servico.tipo || 'Serviço'}${servico.localExecucao ? ` - ${servico.localExecucao}` : ''}`,
        descricaoServico: servico.descricao || '',
        textosDepois: [],
        colunas: colunasPadrao,
        linhas: [criarLinhaEscopo(colunasPadrao)]
      };
    });
  };

  const gerarEscopoBasicoConsolidado = (escopos: EscopoServico[]): string => {
    return escopos.map((escopo) => {
      const cabecalho = escopo.titulo;
      const descricaoServico = escopo.descricaoServico?.trim() || '';
      const textosDepois = Array.isArray(escopo.textosDepois) && escopo.textosDepois.length > 0 ? escopo.textosDepois.join('\n') : '';
      const linhasTabela = escopo.linhas
        .map((linha, idx) => {
          const valores = escopo.colunas.map((coluna) => linha.valores[coluna] || '-').join(' | ');
          return `${idx + 1} | ${valores}`;
        })
        .join('\n');
      // Ordem: Título, Descrição (antes da tabela), Tabela, Textos depois
      return [cabecalho, descricaoServico, linhasTabela || 'Sem itens na planilha', textosDepois || ''].filter(Boolean).join('\n');
    }).join('\n\n');
  };

  const adicionarEscopoServico = () => {
    const novo: EscopoServico = {
      id: `escopo-adicional-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      servicoId: `ad-${Date.now()}`,
      titulo: `${propostaForm.escopoBasicoServicos.length + 1}. Serviço Adicional`,
      descricaoServico: '',
      textosDepois: [],
      colunas: ['Descrição'],
      linhas: [criarLinhaEscopo(['Descrição'])]
    };
    setPropostaForm(prev => ({ ...prev, escopoBasicoServicos: [...prev.escopoBasicoServicos, novo] }));
  };

  const removerEscopoServico = (escopoId: string) => {
    setPropostaForm(prev => ({ ...prev, escopoBasicoServicos: prev.escopoBasicoServicos.filter(e => e.id !== escopoId) }));
  };

  const adicionarTextoLivre = (escopoId: string, pos: 'depois') => {
    setPropostaForm(prev => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map(escopo => {
        if (escopo.id !== escopoId) return escopo;
        return { ...escopo, textosDepois: [...(escopo.textosDepois || []), ''] };
      })
    }));
  };

  const atualizarTextoLivre = (escopoId: string, pos: 'depois', index: number, valor: string) => {
    setPropostaForm(prev => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map(escopo => {
        if (escopo.id !== escopoId) return escopo;
        const arr2 = [...(escopo.textosDepois || [])];
        arr2[index] = valor;
        return { ...escopo, textosDepois: arr2 };
      })
    }));
  };

  const atualizarDescricaoServico = (escopoId: string, valor: string) => {
    setPropostaForm(prev => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map(escopo => (
        escopo.id === escopoId ? { ...escopo, descricaoServico: valor } : escopo
      ))
    }));
  };

  const removerTextoLivre = (escopoId: string, pos: 'depois', index: number) => {
    setPropostaForm(prev => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map(escopo => {
        if (escopo.id !== escopoId) return escopo;
        const arr2 = [...(escopo.textosDepois || [])];
        arr2.splice(index, 1);
        return { ...escopo, textosDepois: arr2 };
      })
    }));
  };

  const adicionarColunaEscopoServico = (escopoId: string) => {
    const nomeColuna = (novaColunaPorEscopo[escopoId] || '').trim();
    if (!nomeColuna) return;

    setPropostaForm((prev) => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map((escopo) => {
        if (escopo.id !== escopoId) return escopo;
        const existeColuna = escopo.colunas.some((coluna) => coluna.toLowerCase() === nomeColuna.toLowerCase());
        if (existeColuna) return escopo;

        return {
          ...escopo,
          colunas: [...escopo.colunas, nomeColuna],
          linhas: escopo.linhas.map((linha) => ({
            ...linha,
            valores: {
              ...linha.valores,
              [nomeColuna]: ''
            }
          }))
        };
      })
    }));

    setNovaColunaPorEscopo((prev) => ({ ...prev, [escopoId]: '' }));
  };

  const removerColunaEscopoServico = (escopoId: string, colunaRemover: string) => {
    setPropostaForm((prev) => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map((escopo) => {
        if (escopo.id !== escopoId) return escopo;

        return {
          ...escopo,
          colunas: escopo.colunas.filter((coluna) => coluna !== colunaRemover),
          linhas: escopo.linhas.map((linha) => {
            const novosValores = { ...linha.valores };
            delete novosValores[colunaRemover];
            return {
              ...linha,
              valores: novosValores
            };
          })
        };
      })
    }));
  };

  const adicionarLinhaEscopoServico = (escopoId: string) => {
    setPropostaForm((prev) => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map((escopo) => {
        if (escopo.id !== escopoId) return escopo;
        return {
          ...escopo,
          linhas: [...escopo.linhas, criarLinhaEscopo(escopo.colunas)]
        };
      })
    }));
  };

  const removerLinhaEscopoServico = (escopoId: string, linhaId: string) => {
    setPropostaForm((prev) => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map((escopo) => {
        if (escopo.id !== escopoId) return escopo;
        return {
          ...escopo,
          linhas: escopo.linhas.filter((linha) => linha.id !== linhaId)
        };
      })
    }));
  };

  const atualizarCelulaEscopoServico = (escopoId: string, linhaId: string, coluna: string, valor: string) => {
    setPropostaForm((prev) => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map((escopo) => {
        if (escopo.id !== escopoId) return escopo;
        return {
          ...escopo,
          linhas: escopo.linhas.map((linha) =>
            linha.id === linhaId
              ? {
                  ...linha,
                  valores: {
                    ...linha.valores,
                    [coluna]: valor
                  }
                }
              : linha
          )
        };
      })
    }));
  };

  const atualizarTituloEscopoServico = (escopoId: string, novoTitulo: string) => {
    setPropostaForm((prev) => ({
      ...prev,
      escopoBasicoServicos: prev.escopoBasicoServicos.map((escopo) =>
        escopo.id === escopoId
          ? { ...escopo, titulo: novoTitulo }
          : escopo
      )
    }));
  };

  const handleDownloadPropostaPDFWithLogo = async (proposta: any, obra: any) => {
    const cliente = listaClientes.find(c => c.id === obra.clienteId);
    const rawEmpresa = obra.empresaPrestadora || '';
    const cleaned = (typeof rawEmpresa === 'string' ? rawEmpresa : (rawEmpresa.nome || '')).toLowerCase();
    const isLinave = !cleaned.includes('servi');
    
    let logoBase64: string | undefined;
    if (isLinave) {
      try {
        const response = await fetch('/image1.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          logoBase64 = reader.result as string;
          handleDownloadPropostaPDF(proposta, cliente, obra, logoBase64, isLinave);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        handleDownloadPropostaPDF(proposta, cliente, obra, undefined, isLinave);
      }
    } else {
      handleDownloadPropostaPDF(proposta, cliente, obra, undefined, isLinave);
    }
  };

 const handleSelectObra = (obra: any) => {
    setSelectedObra(obra);
         
    // Pré-preencher dados
    const cliente = listaClientes.find(c => c.id === obra.clienteId);
    
    // Descobrir a versão alfabética e o prefixo (Ex: A, B, C...)
    const indexVersao = obra.propostas?.length || 0;
    const proximaVersaoLetra = indexToVersaoAlfabetica(indexVersao);
    const prefixo = getPrefixoEmpresa(obra.empresaPrestadora);
    const anoAtual = new Date().getFullYear().toString().slice(-2);
         
    setPropostaForm(prev => ({
      ...getInitialPropostaForm(),
      dataProposta: new Date().toISOString().split('T')[0],
      cliente: cliente?.razaoSocial || '',
      atribuidoA: obra.responsavelComercial || '',
      cargoContato: obra.tipo || '',
      // Aplica a letra no número da proposta gerado na tela
      numeroProposta: `${prefixo}-${proximaVersaoLetra}/${anoAtual}`,
      escopoBasicoServicos: criarEscopoBasicoServicos(obra)
    }));
    setNovaColunaPorEscopo({});
         
    setViewMode('form');
  };

  const handleSaveProposta = () => {
    if (!selectedObra) return;
    
    // Aqui está o segredo: Calcular a versão em LETRA na hora de salvar!
    const indexVersao = selectedObra.propostas?.length || 0;
    const proximaVersaoLetra = indexToVersaoAlfabetica(indexVersao);
    
    const escopoAConsolidado = propostaForm.escopoBasicoServicos.length > 0
      ? gerarEscopoBasicoConsolidado(propostaForm.escopoBasicoServicos)
      : propostaForm.escopoA;
           
    const novaProposta = {
      versao: proximaVersaoLetra, // <-- Agora salva como 'A', 'B', 'C', etc.
      dataCriacao: new Date().toISOString().split('T')[0],
      status: 'pendente' as const,
      ...propostaForm,
      escopoA: escopoAConsolidado
    };

    const obraAtualizada = {
      ...selectedObra,
      propostas: [...(selectedObra.propostas || []), novaProposta],
      propostaPendenteNovaVersao: false,
      motivoRecusaProposta: '',
      houveAlteracaoDocumentosRecusa: false,
      dataRecusaProposta: ''
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === selectedObra.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert('Proposta criada com sucesso!');
    setViewMode('list');
    setSelectedObra(null);
    setPropostaForm(getInitialPropostaForm());
    setNovaColunaPorEscopo({});
  };

  const handleSalvarRascunho = () => {
    if (!selectedObra) return;

    // Não criar nova versão ao salvar rascunho: armazenar rascunho separado
    const escopoAConsolidado = propostaForm.escopoBasicoServicos.length > 0
      ? gerarEscopoBasicoConsolidado(propostaForm.escopoBasicoServicos)
      : propostaForm.escopoA;

    const novaPropostaRascunho = {
      dataCriacao: new Date().toISOString().split('T')[0],
      status: 'rascunho',
      ...propostaForm,
      escopoA: escopoAConsolidado
    };

    const obraAtualizada = {
      ...selectedObra,
      propostaRascunho: novaPropostaRascunho // salva rascunho sem alterar lista de propostas/versionamento
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === selectedObra.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    // Mantém o usuário na mesma tela para continuar edição
    setSelectedObra(obraAtualizada);
    alert('Proposta salva como rascunho. (Não alterou versão)');
  };

  // Gera DOCX a partir de template .docx (deve existir em /public/templates/LINAVE.docx e SERVINAVE.docx)
  const gerarDocxTemplate = async () => {
    if (!selectedObra) return alert('Selecione uma obra antes');
    const rawEmpresa = (() => {
      const ep = selectedObra.empresaPrestadora || '';
      if (!ep) return '';
      if (typeof ep === 'string') return ep;
      return (ep.nome || ep.razaoSocial || ep.empresaNome || '').toString();
    })();
    const cleaned = (rawEmpresa || '').toString().toLowerCase();
    const isLinave = cleaned.includes('linave');

    try {
      const templateUrl = isLinave ? '/templates/LINAVE.docx' : '/templates/SERVINAVE.docx';
      const res = await fetch(templateUrl);
      if (!res.ok) return alert(`Template ${isLinave ? 'LINAVE.docx' : 'SERVINAVE.docx'} não encontrado em /public/templates/`);
      const arrayBuffer = await res.arrayBuffer();

      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      const escopoConsolidado = gerarEscopoBasicoConsolidado(propostaForm.escopoBasicoServicos);
      const dataForTemplate: Record<string, any> = {
        dataProposta: propostaForm.dataProposta,
        numeroProposta: propostaForm.numeroProposta,
        cliente: propostaForm.cliente,
        atribuidoA: propostaForm.atribuidoA,
        cargoContato: propostaForm.cargoContato,
        referencia: propostaForm.referencia,
        saudacao: propostaForm.saudacao,
        assunto: propostaForm.assunto,
        textoAbertura: propostaForm.textoAbertura,
        escopoA: escopoConsolidado,
        responsabilidadeContratada: propostaForm.responsabilidadeContratada,
        escopoC: propostaForm.escopoC,
        preco: propostaForm.preco,
        condicoesGerais: propostaForm.condicoesGerais,
        condicoesPagamento: propostaForm.condicoesPagamento,
        prazo: propostaForm.prazo,
        encerramento: propostaForm.encerramento
      };

      doc.render(dataForTemplate);
      const out = doc.getZip().generate({ type: 'blob' });
      saveAs(out, `${propostaForm.numeroProposta || selectedObra.nome || 'proposta'}.docx`);
    } catch (err) {
      console.error('Erro gerarDocxTemplate:', err);
      const msg = err?.message ? err.message : String(err);
      const details = err?.stack ? `\n\nStack:\n${err.stack}` : '';
      alert(`Erro ao gerar DOCX: ${msg}${details}`);
    }
  };

  const handleAprovacaoCliente = (obra: any) => {
    const ultimaProposta = obra.propostas?.[obra.propostas.length - 1];
    if (!ultimaProposta) return;

    const propostasAtualizadas = obra.propostas.map((p: any, idx: number) => 
      idx === obra.propostas.length - 1 ? { ...p, status: 'aceita' as const } : p
    );

    const obraAtualizada = {
      ...obra,
      propostas: propostasAtualizadas,
      propostaPendenteNovaVersao: false,
      motivoRecusaProposta: '',
      houveAlteracaoDocumentosRecusa: false,
      dataRecusaProposta: ''
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === obra.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert('Proposta aprovada pelo cliente!');
  };

  const handlePendenteCliente = (obra: any) => {
    const ultimaProposta = obra.propostas?.[obra.propostas.length - 1];
    if (!ultimaProposta) return;

    const propostasAtualizadas = obra.propostas.map((p: any, idx: number) => 
      idx === obra.propostas.length - 1 ? { ...p, status: 'pendente' as const } : p
    );

    const obraAtualizada = {
      ...obra,
      propostas: propostasAtualizadas,
      propostaPendenteNovaVersao: true,
      motivoRecusaProposta: '',
      houveAlteracaoDocumentosRecusa: false,
      dataRecusaProposta: '',
      categoria: 'Negociação',
      status: 'Aguardando proposta'
    };

    const obrasAtualizadas = obras?.map((o: any) => o.id === obra.id ? obraAtualizada : o) || [];
    saveEntity('obras', obrasAtualizadas);

    alert('Proposta marcada como pendente. Negócio retornou para Fazer Proposta.');
  };

  const handleRecusaCliente = (obra: any) => {
    const ultimaProposta = obra.propostas?.[obra.propostas.length - 1];
    if (!ultimaProposta) return;

    const motivoRecusaInput = window.prompt('Informe o motivo da recusa da proposta:');
    if (motivoRecusaInput === null) return;

    const motivoRecusa = motivoRecusaInput.trim();
    if (!motivoRecusa) {
      alert('O motivo da recusa é obrigatório.');
      return;
    }

    const houveAlteracaoDocumentos = window.confirm('Algum documento foi alterado ou adicionado pelo cliente?\n\nOK = Sim\nCancelar = Não');
    const retornarParaOrcamento = window.confirm('Deseja retornar este negócio para ORÇAMENTO agora?\n\nOK = Voltar para orçamento\nCancelar = Cancelar recusa');
    if (!retornarParaOrcamento) return;

    // Marcar última proposta como recusada
    const propostasAtualizadas = obra.propostas.map((p: any, idx: number) => 
      idx === obra.propostas.length - 1
        ? {
            ...p,
            status: 'recusada' as const,
            motivoRecusa,
            dataRecusa: new Date().toISOString().split('T')[0],
            houveAlteracaoDocumentos
          }
        : p
    );

    const dataRecusa = new Date().toISOString().split('T')[0];
    const orcamentosBase = (obra.orcamentos && obra.orcamentos.length > 0)
      ? obra.orcamentos
      : (obra.orcamentoRealizado && obra.orcamentoData && obra.orcamentoValores)
        ? [{
            versao: 'A',
            dataCriacao: obra.dataCadastro,
            status: 'pendente' as const,
            numeroOrcamento: obra.orcamentoData.numeroOrcamento,
            data: obra.orcamentoData,
            valores: obra.orcamentoValores
          }]
        : [];

    const orcamentosAtualizados = orcamentosBase.map((orcamento: any, idx: number, lista: any[]) =>
      idx === lista.length - 1
        ? { ...orcamento, status: 'recusado' as const, dataRecusa }
        : orcamento
    );

    const obraAtualizada = {
      ...obra,
      propostas: propostasAtualizadas,
      orcamentos: orcamentosAtualizados,
      orcamentoRealizado: false,
      requerReorcamento: true,
      propostaPendenteNovaVersao: true,
      motivoRecusaProposta: motivoRecusa,
      houveAlteracaoDocumentosRecusa: houveAlteracaoDocumentos,
      dataRecusaProposta: dataRecusa,
      categoria: 'Planejamento',
      status: 'Aguardando orçamento'
    };

    const obrasAtualizadas = [
      obraAtualizada,
      ...((obras || []).filter((o: any) => o.id !== obra.id))
    ];
    saveEntity('obras', obrasAtualizadas);

    alert('Proposta recusada. Negócio retornou para Aguardando orçamento.');
  };

  const inputClass = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-all placeholder:text-white/20";
  const labelClass = "text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block";
  const sectionClass = "bg-white/5 border border-white/10 rounded-lg p-6";

  // ========== VIEW: LISTA DE NEGÓCIOS E HISTÓRICO ==========
  if (viewMode === 'list') {
    return (
      <div className="w-[600px] p-12 space-y-8 animate-in fade-in duration-500">
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-black text-white">FAZER PROPOSTA</h1>
          <p className="text-white/50 text-xs mt-1">Crie propostas comerciais para negócios em negociação</p>
        </div>

        {/* SEÇÃO 1: NEGÓCIOS EM NEGOCIAÇÃO (SEM PROPOSTA) */}
        {negociosNegociacao.length > 0 && (
          <>
            <div className="border-t border-white/10 pt-8">
              <h2 className="text-xl font-black text-white mb-4">Negócios para Proposta</h2>
              <div className="space-y-4">
                {negociosParaProposta.map((obra: any) => (
                  <div key={obra.id} className={sectionClass}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-black text-white">{obra.nome}</h3>
                        <p className="text-white/70 text-sm mt-1">
                          Cliente: {listaClientes.find(c => c.id === obra.clienteId)?.razaoSocial}
                        </p>
                      </div>
                    </div>

                    {/* Informações do Orçamento */}
                    {obra.orcamentoRealizado && obra.orcamentoValores && (
                      <div className="bg-white/3 rounded-lg p-4 mb-4 space-y-2 text-xs border border-white/5">
                        <div className="flex justify-between">
                          <span className="text-white/70">Subtotal:</span>
                          <span className="text-white font-black">R$ {obra.orcamentoValores.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Margem:</span>
                          <span className="text-white font-black">R$ {((obra.orcamentoValores.subtotal * obra.orcamentoValores.margem) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-blue-300 font-black">
                          <span>Preço Final:</span>
                          <span>R$ {obra.orcamentoValores.precoFinal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleSelectObra(obra)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <FileText size={16} /> {obra.propostas && obra.propostas.length > 0 ? 'Nova Proposta' : 'Fazer Proposta'}
                    </button>
                  </div>
                ))}

                {negociosParaProposta.length === 0 && (
                  <div className="bg-white/3 rounded-lg p-4 border border-white/5 text-center">
                    <p className="text-white/50 text-xs">Nenhum negócio aguardando nova proposta.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* SEÇÃO 2: HISTÓRICO DE PROPOSTAS */}
        {obrasComPropostas.length > 0 && (
          <div className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-black text-white mb-4">Histórico de Propostas</h2>
            <div className="space-y-4">
              {obrasComPropostas.map((obra: any) => {
                const ultimaProposta = obra.propostas[obra.propostas.length - 1];
                return (
                  <div key={obra.id} className={sectionClass}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-black text-white">{obra.nome}</h3>
                        <p className="text-white/70 text-sm mt-1">
                          Cliente: {listaClientes.find(c => c.id === obra.clienteId)?.razaoSocial}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {ultimaProposta.status === 'pendente' && (
                          <div className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-full">
                            <span className="text-yellow-300 text-xs font-black">Pendente</span>
                          </div>
                        )}
                        {ultimaProposta.status === 'aceita' && (
                          <div className="px-3 py-1.5 bg-green-500/20 border border-green-500/40 rounded-full">
                            <span className="text-green-300 text-xs font-black">Aceita</span>
                          </div>
                        )}
                        {ultimaProposta.status === 'recusada' && (
                          <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded-full">
                            <span className="text-red-300 text-xs font-black">Recusada</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/3 rounded-lg p-4 mb-4 space-y-2 text-xs border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-white/70">Versão:</span>
                        <span className="text-white font-black">{ultimaProposta.versao}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Criada em:</span>
                        <span className="text-white font-black">{new Date(ultimaProposta.dataCriacao).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Número:</span>
                        <span className="text-white font-black">{ultimaProposta.numeroProposta}</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleDownloadPropostaPDFWithLogo(ultimaProposta, obra)}
                        className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={() => {
                          setSelectedObra(obra);
                          setSelectedPropostaVersion(ultimaProposta.versao);
                          setViewMode('historico');
                        }}
                        className="flex-1 bg-white/10 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all hover:bg-white/15 flex items-center justify-center gap-2"
                      >
                        Ver Histórico
                      </button>
                      {ultimaProposta.status === 'pendente' && (
                        <>
                          <button
                            onClick={() => handleAprovacaoCliente(obra)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={16} /> Aprovação
                          </button>
                          <button
                            onClick={() => handleRecusaCliente(obra)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            <XCircle size={16} /> Recusa
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {negociosNegociacao.length === 0 && obrasComPropostas.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="text-white/20 text-2xl mb-2">−</div>
            <p className="text-white/40 text-xs">Nenhum negócio para proposta</p>
          </div>
        )}
      </div>
    );
  }

  // ========== VIEW: HISTÓRICO DE PROPOSTAS ==========
  if (viewMode === 'historico' && selectedObra) {
    return (
      <div className="p-8 space-y-4 animate-in fade-in duration-500">
        {/* HEADER COM BOTÃO VOLTAR */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedObra(null);
              setSelectedPropostaVersion(null);
            }}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition text-blue-400"
            title="Voltar"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white">HISTÓRICO DE PROPOSTAS</h1>
            <p className="text-white/50 text-xs mt-1">{selectedObra?.nome}</p>
          </div>
        </div>

        {/* LISTA DE VERSÕES */}
        <div className="space-y-4">
          {selectedObra.propostas?.map((proposta: any) => (
            <div key={proposta.versao} className={`rounded-lg p-6 border bg-white/5 border-white/10`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">Versão {proposta.versao}</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {new Date(proposta.dataCriacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {proposta.status === 'pendente' && (
                    <div className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-full">
                      <span className="text-yellow-300 text-xs font-black">Pendente</span>
                    </div>
                  )}
                  {proposta.status === 'aceita' && (
                    <div className="px-3 py-1.5 bg-green-500/20 border border-green-500/40 rounded-full">
                      <span className="text-green-300 text-xs font-black">Aceita</span>
                    </div>
                  )}
                  {proposta.status === 'recusada' && (
                    <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded-full">
                      <span className="text-red-300 text-xs font-black">Recusada</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white/3 rounded-lg p-4 space-y-2 text-xs border border-white/5">
                <div className="flex justify-between">
                  <span className="text-white/70">Número:</span>
                  <span className="text-white font-black">{proposta.numeroProposta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Preço:</span>
                  <span className="text-white font-black">{proposta.preco || 'Não preenchido'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Prazo:</span>
                  <span className="text-white font-black">{proposta.prazo || 'Não preenchido'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* BOTÃO VOLTAR */}
        <div className="flex gap-4 pt-6 border-t border-white/5 sticky bottom-0 bg-[#0b1220] py-6">
          <button 
            onClick={() => {
              setViewMode('list');
              setSelectedObra(null);
              setSelectedPropostaVersion(null);
            }}
            className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/15 transition flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>
      </div>
    );
  }

  // ========== VIEW: FORMULÁRIO DE PROPOSTA (TELA NOVA COMPLETA) ==========
  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      {/* HEADER COM BOTÃO VOLTAR */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => {
            setViewMode('list');
            setSelectedObra(null);
          }}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition text-blue-400"
          title="Voltar"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white">PROPOSTA COMERCIAL</h1>
          <p className="text-white/50 text-xs mt-1">{selectedObra?.nome}</p>
        </div>
      </div>

      {/* SEÇÃO 1: DATA E NÚMERO (AUTOPREENCHIDOS) */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Cidade e Data</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Cidade e Data</label>
            <input 
              type="date"
              className={inputClass}
              value={propostaForm.dataProposta}
              onChange={e => setPropostaForm({...propostaForm, dataProposta: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Nº Proposta</label>
            <input 
              type="text"
              className={`${inputClass} bg-white/5 cursor-not-allowed`}
              disabled
              value={propostaForm.numeroProposta}
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: CLIENTE E CONTATO (AUTOPREENCHIDOS) */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Cliente</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Cliente</label>
          <input 
            type="text"
            className={`${inputClass} bg-white/5 cursor-not-allowed`}
            disabled
            value={propostaForm.cliente}
          />
        </div>
      </div>

      {/* SEÇÃO 3: ATRIBUÍDO A (AUTOPREENCHIDO) */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Atribuído A</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Atribuído a</label>
            <input 
              type="text"
              className={`${inputClass} bg-white/5 cursor-not-allowed`}
              disabled
              value={propostaForm.atribuidoA}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Cargo do Contato</label>
            <input 
              type="text"
              className={`${inputClass} bg-white/5 cursor-not-allowed`}
              disabled
              value={propostaForm.cargoContato}
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 4: REFERÊNCIA */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Referência</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Referência</label>
          <input 
            type="text"
            className={inputClass}
            value={propostaForm.referencia}
            onChange={e => setPropostaForm({...propostaForm, referencia: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 5: SAUDAÇÃO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Saudação</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Saudação</label>
          <input 
            type="text"
            className={inputClass}
            placeholder="Ex: Prezado Cliente..."
            value={propostaForm.saudacao}
            onChange={e => setPropostaForm({...propostaForm, saudacao: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 6: ASSUNTO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Assunto</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Assunto</label>
          <input 
            type="text"
            className={inputClass}
            value={propostaForm.assunto}
            onChange={e => setPropostaForm({...propostaForm, assunto: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 7: TEXTO DE ABERTURA */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Texto de Abertura</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Texto de Abertura</label>
          <textarea 
            className={`${inputClass} h-32`}
            value={propostaForm.textoAbertura}
            onChange={e => setPropostaForm({...propostaForm, textoAbertura: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 8: A - ESCOPO BÁSICO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">A - Escopo Básico de Serviços</h3>
        <div className="space-y-6">
          {propostaForm.escopoBasicoServicos.map((escopoServico) => (
            <div key={escopoServico.id} className="bg-[#0b1220] border border-white/10 rounded-xl p-4 space-y-4">

              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-white font-black text-sm uppercase outline-none focus:border-blue-400"
                  value={escopoServico.titulo}
                  onChange={(e) => atualizarTituloEscopoServico(escopoServico.id, e.target.value)}
                  placeholder="Título do serviço (ex: 1. ASASSA - ASSASA)"
                />
                <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">{escopoServico.linhas.length} item(ns)</span>
              </div>
              <div className="mt-2">
                <label className={labelClass}>Descrição do Serviço</label>
                <textarea
                  className={`${inputClass} h-20`}
                  value={escopoServico.descricaoServico || ''}
                  onChange={(e) => atualizarDescricaoServico(escopoServico.id, e.target.value)}
                  placeholder="Descrição do serviço"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => removerEscopoServico(escopoServico.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-black text-xs uppercase tracking-widest transition"
                >Remover Servi�o</button>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Colunas da Planilha</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={inputClass}
                    value={novaColunaPorEscopo[escopoServico.id] || ''}
                    onChange={(e) => setNovaColunaPorEscopo((prev) => ({ ...prev, [escopoServico.id]: e.target.value }))}
                    placeholder="Nome da coluna"
                  />
                  <button
                    type="button"
                    onClick={() => adicionarColunaEscopoServico(escopoServico.id)}
                    className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs uppercase tracking-widest transition"
                  >
                    <Plus size={14} className="inline mr-1" /> Adicionar
                  </button>
                </div>

                {escopoServico.colunas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {escopoServico.colunas.map((coluna) => (
                      <div key={`${escopoServico.id}-${coluna}`} className="px-2 py-1 bg-white/10 rounded-md text-xs text-white flex items-center gap-2">
                        <span>{coluna}</span>
                        <button
                          type="button"
                          onClick={() => removerColunaEscopoServico(escopoServico.id, coluna)}
                          className="text-red-300 hover:text-red-200"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-white/10 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-3 py-2 text-left text-white font-black w-16">Item</th>
                      {escopoServico.colunas.map((coluna) => (
                        <th key={`${escopoServico.id}-header-${coluna}`} className="px-3 py-2 text-left text-white font-black min-w-[160px]">{coluna}</th>
                      ))}
                      <th className="px-3 py-2 text-center text-white font-black w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {escopoServico.linhas.map((linha, idx) => (
                      <tr key={linha.id} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white font-black">{idx + 1}</td>
                        {escopoServico.colunas.map((coluna) => (
                          <td key={`${linha.id}-${coluna}`} className="px-3 py-2">
                            <input
                              type="text"
                              className="w-full bg-[#101f3d] border border-white/10 p-2 rounded text-white text-xs outline-none focus:border-blue-400"
                              value={linha.valores[coluna] || ''}
                              onChange={(e) => atualizarCelulaEscopoServico(escopoServico.id, linha.id, coluna, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removerLinhaEscopoServico(escopoServico.id, linha.id)}
                            className="text-red-300 hover:text-red-200"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => adicionarLinhaEscopoServico(escopoServico.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-xs uppercase tracking-widest transition"
              >
                <Plus size={14} className="inline mr-1" /> Adicionar Item
              </button>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Textos após a tabela</label>
                  <button
                    type="button"
                    onClick={() => adicionarTextoLivre(escopoServico.id, 'depois')}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs uppercase tracking-widest transition"
                  >
                    <Plus size={12} className="inline mr-1" /> Adicionar Texto
                  </button>
                </div>

                {(escopoServico.textosDepois || []).map((txt, i) => (
                  <div key={`${escopoServico.id}-depois-${i}`} className="flex gap-2">
                    <textarea
                      className={`${inputClass} h-20 flex-1`}
                      value={txt}
                      onChange={(e) => atualizarTextoLivre(escopoServico.id, 'depois', i, e.target.value)}
                      placeholder={`Texto depois #${i + 1}`}
                    />
                    <button type="button" onClick={() => removerTextoLivre(escopoServico.id, 'depois', i)} className="text-red-300 p-2">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {propostaForm.escopoBasicoServicos.length === 0 && (
            <div className="bg-white/5 border border-dashed border-white/15 rounded-lg p-4 text-center">
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Nenhum serviço encontrado para montar escopo</p>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={adicionarEscopoServico}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs uppercase tracking-widest transition"
            >
              <Plus size={14} className="inline mr-1" /> Adicionar Serviço
            </button>

            <button
              type="button"
              onClick={() => { const exemplo = gerarEscopoBasicoConsolidado(propostaForm.escopoBasicoServicos); window.alert(exemplo || 'Sem conteúdo para visualizar'); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-xs uppercase tracking-widest transition"
            >Visualização de Exemplo</button>
          </div>
        </div>
      </div>

      {/* SEÇÃO 9: B - RESPONSABILIDADE CONTRATADA */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">B - Responsabilidade da Contratada</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Responsabilidade</label>
          <textarea 
            className={`${inputClass} h-32`}
            value={propostaForm.responsabilidadeContratada}
            onChange={e => setPropostaForm({...propostaForm, responsabilidadeContratada: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 10: C - RESPONSABILIDADE CONTRATANTE */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">C - Responsabilidade da Contratante</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Responsabilidade</label>
          <textarea 
            className={`${inputClass} h-32`}
            value={propostaForm.escopoC}
            onChange={e => setPropostaForm({...propostaForm, escopoC: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 12: D - PREÇO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">D - Preço</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Preço</label>
          <textarea 
            className={`${inputClass} h-20`}
            value={propostaForm.preco}
            onChange={e => setPropostaForm({...propostaForm, preco: e.target.value})}
          />
        </div>
      </div>

      
      {/* SEÇÃO 14: E - CONDIÇÕES GERAIS */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">E - Condições Gerais</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Condições</label>
          <textarea 
            className={`${inputClass} h-32`}
            value={propostaForm.condicoesGerais}
            onChange={e => setPropostaForm({...propostaForm, condicoesGerais: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 15: F - CONDIÇÕES DE PAGAMENTO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">F - Condições de Pagamento</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Condições</label>
          <textarea 
            className={`${inputClass} h-32`}
            value={propostaForm.condicoesPagamento}
            onChange={e => setPropostaForm({...propostaForm, condicoesPagamento: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 16: G - PRAZO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">G - Prazo</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Prazo</label>
          <textarea 
            className={`${inputClass} h-20`}
            value={propostaForm.prazo}
            onChange={e => setPropostaForm({...propostaForm, prazo: e.target.value})}
          />
        </div>
      </div>

      
      {/* SEÇÃO 18: ENCERRAMENTO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Encerramento</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Encerramento</label>
          <textarea 
            className={`${inputClass} h-20`}
            value={propostaForm.encerramento}
            onChange={e => setPropostaForm({...propostaForm, encerramento: e.target.value})}
          />
        </div>
      </div>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex gap-4 pt-6 border-t border-white/5 sticky bottom-0 bg-[#0b1220] py-6">
        <button 
          onClick={() => {
            setViewMode('list');
            setSelectedObra(null);
          }}
          className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/15 transition flex items-center justify-center gap-2"
        >
          <ArrowLeft size={18} /> Voltar
        </button>
        <button 
          onClick={handleSaveProposta}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
        >
          <FileText size={18} /> Enviar Proposta
        </button>
        <button 
          onClick={handleSalvarRascunho}
          className="flex-1 bg-white/10 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/15 transition flex items-center justify-center gap-2"
        >
          <Save size={18} /> Salvar Rascunho
        </button>
        {selectedObra && (
          <button
            type="button"
            onClick={gerarDocxTemplate}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
          >Gerar DOCX</button>
        )}
      </div>
    </div>
  );
}

