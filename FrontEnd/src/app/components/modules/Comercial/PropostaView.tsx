import { useState, useEffect } from 'react';
import { extrairComponentesDoId, gerarIdProjeto, gerarIdProposta, gerarIdProjetoDeNegocio, useErp } from '../../../context/ErpContext';
import { formatDateBR } from '../../../utils/formatDate';
import { Plus, X, FileText, CheckCircle, XCircle, ArrowLeft, Save, Download, RefreshCw, DollarSign, AlertTriangle } from 'lucide-react';
import { handleDownloadPropostaPDF } from '../CRM/handleDownloadPropostaPDF';
import { handleDownloadOrcamentoPDF } from '../CRM/handleDownloadOrcamentoPDF';
import { isEmpresaLinave, getLogoUrlForEmpresa } from '../../../utils/company';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { getNegocios } from '../../../../services/comercial';
import { getClientes, criarProposta, atualizarProposta, atualizarNegocio } from '../../../../services/comercialService';
import { temServico, temLocacao } from '../../../utils/modalidade';
import { boldOS } from '../../../utils/osHighlight';
import { ObservacoesNegocio } from '../../ObservacoesNegocio';

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
  precoItens?: Array<{ id: string; descricao: string; quantidade: number; unidade: string; valorUnitario: number; dias: number; total: number; categoria?: 'servico' | 'locacao' }>;
  precoTextoLivre: string;
  condicoesGerais: string;
  condicoesPagamento: string;
  prazo: string;
  efetivoPrevisto: string;
  encerramento: string;
}

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


const getBase64FromUrl = async (url: string): Promise<string | undefined> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    
    const blob = await response.blob();
    if (blob.size === 0) return undefined;
    
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('' as any);
      reader.onabort = () => resolve('' as any);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[Proposta] Erro ao carregar logo:', url, error);
    return undefined;
  }
};
// --------------------------

const findClienteById = (clientes: any[], clienteId: any) =>
  (Array.isArray(clientes) ? clientes : []).find((cliente: any) => String(cliente.id) === String(clienteId));


const mapNegocioToObra = (n: any): any => ({
  backendId: n.id,
  clienteBackendId: n.cliente,
  id: gerarIdProjetoDeNegocio(n),
  nome: n.nome_negocio,
  clienteId: String(n.cliente ?? ''),
  categoria: n.categoria,
  status: n.status,
  empresaPrestadora: n.empresa_prestadora,
  responsavelComercial: n.solicitante,
  cargo: n.cargo || '',
  tipo: n.tipo_servico,
  servicos: (n.servicos || []).map((s: any) => ({
    id: s.id,
    tipo: s.tipo_servico,
    localExecucao: s.local_execucao,
    descricao: s.descricao,
    embarcacao: s.embarcacao,
    observacoes: s.observacoes,
  })),
  modalidade: n.modalidade || 'servico',
  itensAlocacao: Array.isArray(n.itens_alocacao)
    ? n.itens_alocacao.map((it: any) => ({
        id: String(it?.id ?? ''),
        equipamento: it?.equipamento || '',
        estoqueRef: it?.estoque_ref || '',
        unidade: it?.unidade || 'un',
        quantidade: Number(it?.quantidade) || 0,
        observacao: it?.observacao || '',
        valorIndenizacao: Number(it?.valor_indenizacao) || 0,
        valorLocacao: Number(it?.valor_locacao) || 0,
        valorTotal: Number(it?.valor_total) || 0,
      }))
    : [],
  propostas: (n.propostas || []).map((p: any) => ({
    id: p.id,
    versao: p.versao || '',
    dataCriacao: p.dataCriacao,
    status: p.status,
    numeroProposta: p.numeroProposta,
    motivoRecusa: p.motivoRecusaProposta,
    preco: p.preco !== null && p.preco !== undefined ? String(p.preco) : '',
    prazo: p.prazo || '',
    referencias: p.referencias || '',
    referencia: p.referencias || '',                                  // alias (form/PDF leem singular)
    saudacao: p.saudacao || '',
    assunto: p.assunto || '',
    textoAbertura: p.textoAbertura || '',
    responsabilidadeContratada: p.responsabilidadeContratada || '',
    responsabilidadeContratante: p.responsabilidadeContratante || '', // item C (PDF)
    escopoC: p.responsabilidadeContratante || '',                     // alias p/ o form
    condicoesGerais: p.condicoesGerais || '',                         // item E (PDF)
    condicoesPagamento: p.condicoesPagamento || '',                   // item H (PDF)
    efetivoPrevisto: p.efetivoPrevisto || '',                         // item G (PDF)
    encerramento: p.encerramento || '',
    escopoA: p.escopoA || '',
    escopoBasicoServicos: p.escopoBasicoServicos || [],
    precoItens: p.precoItens || [],                                   // tabela D (PDF)
  })),
  orcamentoRealizado: n.orcamento_realizado,
  orcamentoValores: n.orcamentos?.[0]?.valores || null,
  orcamentos: n.orcamentos || [],
});

const parsePrecoParaDecimal = (preco: string): number => {
  if (!preco) return 0;
  // Remover tudo que não seja dígito, ponto ou vírgula, remover pontos de milhares e converter vírgula para ponto
  const onlyNums = String(preco).replace(/[^0-9.,]/g, '');
  const withoutThousands = onlyNums.replace(/\./g, '');
  const normalized = withoutThousands.replace(/,/g, '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

export function PropostaView() {
  const { obras, os, saveEntity } = useErp() as any;
  const [listaNegocios, setListaNegocios] = useState<any[]>([]);
  const [filtroOs, setFiltroOs] = useState<string>('');
  const [listaClientesLocal, setListaClientesLocal] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'historico'>('list');
  const [selectedObra, setSelectedObra] = useState<any>(null);
  const [selectedPropostaVersion, setSelectedPropostaVersion] = useState<number | null>(null);
  // Modal estilizado de recusa de proposta (refazer orçamento × refazer proposta).
  const [recusaModal, setRecusaModal] = useState<{ open: boolean; obra: any | null; motivo: string; submitting: boolean }>({ open: false, obra: null, motivo: '', submitting: false });

  const proximaVersao = (v: string): string => {
    const char = (v || '').toUpperCase().slice(-1);
    if (!char) return 'A';
    return char < 'Z' ? String.fromCharCode(char.charCodeAt(0) + 1) : 'AA';
  };

  const getVersaoInicialProposta = (propostas: any[] = []) => {
    const ultimaProposta = Array.isArray(propostas) && propostas.length > 0 ? propostas[propostas.length - 1] : null;
    if (!ultimaProposta) return '';

    if (ultimaProposta.status !== 'recusada') {
      return '';
    }

    const versaoAnterior = String(
      ultimaProposta.versao
      || extrairComponentesDoId(ultimaProposta.numeroProposta || '')?.versao
      || '',
    ).toUpperCase();

    return proximaVersao(versaoAnterior);
  };

  useEffect(() => {
    const carregar = async () => {
      const [negociosRaw, clientesRaw] = await Promise.all([getNegocios(), getClientes()]);
      setListaNegocios(Array.isArray(negociosRaw) ? negociosRaw.map(mapNegocioToObra) : []);
      setListaClientesLocal(Array.isArray(clientesRaw) ? clientesRaw : []);
    };
    carregar();
  }, []);

  const refreshNegocios = async () => {
    const raw = await getNegocios();
    setListaNegocios(Array.isArray(raw) ? raw.map(mapNegocioToObra) : []);
  };

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
    precoItens: [],
    precoTextoLivre: '',
    responsabilidadeContratada: '',
    escopoC: '',
    preco: '',
    condicoesGerais: '',
    condicoesPagamento: '',
    prazo: '',
    efetivoPrevisto: '',
    encerramento: ''
  });

  const [propostaForm, setPropostaForm] = useState<PropostaFormData>(getInitialPropostaForm);
  const [novaColunaPorEscopo, setNovaColunaPorEscopo] = useState<Record<string, string>>({});

  const formatarVersaoProposta = (proposta: any) => {
    if (!proposta) return 'Original';
    const versao = String(proposta.versao || proposta.numeroProposta?.match(/[A-Z]+$/)?.[0] || '').trim().toUpperCase();
    return versao || 'Original';
  };

  // Preço (item D) - tabela macro editável: descrição, quantidade, unidade, valor unit., dias, total.
  // Total da linha = quantidade × valor unitário × dias.
  const criarPrecoItem = (override?: Partial<{ id: string; descricao: string; quantidade: number; unidade: string; valorUnitario: number; dias: number; total: number; categoria: 'servico' | 'locacao' }>) => {
    const quantidade = override?.quantidade ?? 1;
    const valorUnitario = override?.valorUnitario ?? 0;
    const dias = override?.dias ?? 1;
    return {
      id: `preco-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      descricao: override?.descricao || '',
      quantidade,
      unidade: override?.unidade || 'serv.',
      valorUnitario,
      dias,
      total: override?.total ?? (quantidade * valorUnitario * dias),
      categoria: override?.categoria || 'servico',
    };
  };

  const adicionarPrecoItem = (item?: any, categoria: 'servico' | 'locacao' = 'servico') => {
    const novo = criarPrecoItem({ ...(item || {}), categoria });
    setPropostaForm(prev => ({ ...prev, precoItens: [...(prev.precoItens || []), novo] }));
  };

  const removerPrecoItem = (id: string) => {
    setPropostaForm(prev => ({ ...prev, precoItens: (prev.precoItens || []).filter((it) => it.id !== id) }));
  };

  const atualizarPrecoItem = (id: string, campo: 'descricao' | 'quantidade' | 'unidade' | 'valorUnitario' | 'dias', valor: any) => {
    setPropostaForm(prev => {
      const itens = (prev.precoItens || []).map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it } as any;
        if (campo === 'descricao') updated.descricao = String(valor || '');
        if (campo === 'unidade') updated.unidade = String(valor || '');
        if (campo === 'quantidade') {
          const cleaned = String(valor).replace(/[^0-9.,]/g, '').replace(',', '.');
          updated.quantidade = parseFloat(cleaned) || 0;
        }
        if (campo === 'dias') {
          const cleaned = String(valor).replace(/[^0-9.,]/g, '').replace(',', '.');
          updated.dias = parseFloat(cleaned) || 0;
        }
        if (campo === 'valorUnitario') {
          const cleaned = String(valor).replace(/[^0-9.,]/g, '').replace(',', '.');
          updated.valorUnitario = parseFloat(cleaned) || 0;
        }
        updated.total = (Number(updated.quantidade) || 0) * (Number(updated.valorUnitario) || 0) * (Number(updated.dias) || 0);
        return updated;
      });
      return { ...prev, precoItens: itens };
    });
  };

  // Tabela de Preço (item D) por categoria — Serviço x Locação. Vem do orçamento (macro) e é
  // editável (add/remove linhas). Locação só aparece se houver itens; serviço some se o negócio
  // for só de locação (mostra apenas a tabela que faz sentido).
  const renderTabelaPrecoCategoria = (categoria: 'servico' | 'locacao', titulo: string, addBtnClass: string) => {
    const itens = (propostaForm.precoItens || []).filter(it => (it.categoria || 'servico') === categoria);
    const temLocacaoItens = (propostaForm.precoItens || []).some(it => (it.categoria || 'servico') === 'locacao');
    if (categoria === 'locacao' && itens.length === 0) return null;
    if (categoria === 'servico' && itens.length === 0 && temLocacaoItens) return null;
    const subtotal = itens.reduce((s, it) => s + (Number(it.total) || 0), 0);
    const cellInput = "w-full bg-[#101f3d] border border-white/10 p-2 rounded text-white text-xs outline-none";
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white/80 text-xs font-black uppercase tracking-widest">{titulo}</h4>
          <button type="button" onClick={() => adicionarPrecoItem(undefined, categoria)} className={`px-3 py-1.5 rounded-lg font-black text-[11px] uppercase ${addBtnClass}`}>
            <Plus size={12} className="inline mr-1" /> Adicionar Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-white/10 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-3 py-2 text-left text-white font-black w-12">Item</th>
                <th className="px-3 py-2 text-left text-white font-black">Descrição</th>
                <th className="px-3 py-2 text-left text-white font-black w-20">Quant.</th>
                <th className="px-3 py-2 text-left text-white font-black w-20">Unit.</th>
                <th className="px-3 py-2 text-left text-white font-black w-32">Vl. Unit. R$</th>
                <th className="px-3 py-2 text-left text-white font-black w-16">Dias</th>
                <th className="px-3 py-2 text-left text-white font-black w-36">Valor total R$</th>
                <th className="px-3 py-2 text-center text-white font-black w-12"> </th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-3 text-white/40">Nenhum item. Clique em "Adicionar Item".</td></tr>
              )}
              {itens.map((it, idx) => (
                <tr key={it.id} className="border-b border-white/5">
                  <td className="px-3 py-2 text-white/60 font-bold text-center">{idx + 1}</td>
                  <td className="px-3 py-2 min-w-[200px]"><input type="text" className={cellInput} value={it.descricao || ''} onChange={(e) => atualizarPrecoItem(it.id, 'descricao', e.target.value)} placeholder="Descrição" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" className={cellInput} value={String(it.quantidade ?? '')} onChange={(e) => atualizarPrecoItem(it.id, 'quantidade', e.target.value)} /></td>
                  <td className="px-3 py-2"><input type="text" className={cellInput} value={it.unidade || ''} onChange={(e) => atualizarPrecoItem(it.id, 'unidade', e.target.value)} placeholder="serv." /></td>
                  <td className="px-3 py-2"><input type="text" className={cellInput} value={String(it.valorUnitario ?? '')} onChange={(e) => atualizarPrecoItem(it.id, 'valorUnitario', e.target.value)} placeholder="0,00" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" className={cellInput} value={String(it.dias ?? '')} onChange={(e) => atualizarPrecoItem(it.id, 'dias', e.target.value)} /></td>
                  <td className="px-3 py-2 text-white font-black whitespace-nowrap">R$ {(Number(it.total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-center"><button type="button" onClick={() => removerPrecoItem(it.id)} className="text-red-300 p-1"><X size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right mt-2 text-xs text-white/70">Subtotal {titulo}: <span className="text-white font-black">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      </div>
    );
  };

  const calcularSomaPreco = (itens: NonNullable<PropostaFormData['precoItens']>) => {
    const soma = (itens || []).reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    return soma;
  };

  useEffect(() => {
    // atualiza campo `preco` formatado sempre que itens mudarem
    const itens = propostaForm.precoItens || [];
    const soma = calcularSomaPreco(itens as any);
    const formatted = soma.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setPropostaForm(prev => ({ ...prev, preco: `R$ ${formatted}` }));
  }, [propostaForm.precoItens]);

  // Filtro por OS: mantém apenas os negócios ligados à OS selecionada.
  const passaFiltroOs = (obra: any) => {
    if (!filtroOs) return true;
    return (Array.isArray(os) ? os : []).some((o: any) =>
      String(o.ordemServicoNumero) === String(filtroOs) &&
      (String(o.obraId) === String(obra.id) || String(o.negocioBackendId) === String(obra.negocioBackendId ?? obra.backendId)),
    );
  };
  const osDisponiveis = Array.from(new Set((Array.isArray(os) ? os : []).map((o: any) => o.ordemServicoNumero).filter(Boolean)));

  // Negócios em Negociação
  const negociosNegociacao = listaNegocios.filter((obra: any) => obra.categoria === 'Negociação');
  const negociosParaProposta = negociosNegociacao.filter(passaFiltroOs).filter((obra: any) => {
    if (!Array.isArray(obra.propostas) || obra.propostas.length === 0) return true;
    const ultimaProposta = obra.propostas[obra.propostas.length - 1];
    return ultimaProposta?.status === 'recusada';
  });

  // Todas as obras com propostas (independente do status)
  const obrasComPropostas = listaNegocios.filter(passaFiltroOs).filter((obra: any) => obra.propostas && obra.propostas.length > 0);

  const criarLinhaEscopo = (colunas: string[]): EscopoLinha => ({
    id: `linha-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    valores: colunas.reduce((acc, coluna) => ({ ...acc, [coluna]: '' }), {} as Record<string, string>)
  });

  // Bloco de escopo de Locação: tabela dos itens alocados (Equipamento/Unidade/Quantidade).
  const criarEscopoLocacao = (obra: any): EscopoServico | null => {
    const itens = Array.isArray(obra?.itensAlocacao) ? obra.itensAlocacao.filter((it: any) => it.equipamento) : [];
    if (itens.length === 0) return null;
    const colunas = ['Equipamento', 'Unidade', 'Quantidade'];
    return {
      id: `escopo-locacao-${obra?.id || 'geral'}`,
      servicoId: '',
      titulo: 'Locação de Equipamentos',
      descricaoServico: 'Itens disponibilizados em regime de locação:',
      textosDepois: [],
      colunas,
      linhas: itens.map((it: any) => ({
        id: `linha-loc-${it.id || Math.random().toString(36).slice(2, 7)}`,
        valores: { Equipamento: it.equipamento || '', Unidade: it.unidade || '', Quantidade: String(it.quantidade ?? '') }
      }))
    };
  };

  // Atividades macro do último orçamento do negócio (mesma fonte usada no item D de Preço).
  const getAtividadesMacro = (obra: any): any[] => {
    const ultimoOrc = Array.isArray(obra?.orcamentos) && obra.orcamentos.length ? obra.orcamentos[0] : null;
    return Array.isArray(ultimoOrc?.data?.atividadesMacro) ? ultimoOrc.data.atividadesMacro : [];
  };

  // Bloco de escopo de Serviços: tabela das atividades macro (categoria='servico') do orçamento.
  // Espelha o criarEscopoLocacao — a locação já puxava direto do macro; agora o serviço também.
  const criarEscopoServicosMacro = (obra: any): EscopoServico | null => {
    const macro = getAtividadesMacro(obra)
      .filter((it: any) => (it?.categoria || 'servico') !== 'locacao' && String(it?.descricao || '').trim());
    if (macro.length === 0) return null;
    const colunas = ['Descrição', 'Unidade', 'Quantidade'];
    return {
      id: `escopo-servicos-${obra?.id || 'geral'}`,
      servicoId: '',
      titulo: 'Serviços',
      descricaoServico: '',
      textosDepois: [],
      colunas,
      linhas: macro.map((it: any) => ({
        id: `linha-serv-${it.id || Math.random().toString(36).slice(2, 7)}`,
        valores: {
          'Descrição': it.descricao || '',
          'Unidade': it.unidade || '',
          'Quantidade': String(it.quantidade ?? ''),
        }
      }))
    };
  };

  const criarEscopoBasicoServicos = (obra: any): EscopoServico[] => {
    const blocos: EscopoServico[] = [];

    // Serviços: puxa as atividades macro de serviço do orçamento (mesma fonte do preço/macro),
    // como um bloco único — igual à locação. Se o orçamento ainda não tem macro de serviço,
    // cai para os serviços cadastrados no negócio (comportamento anterior).
    if (temServico(obra?.modalidade)) {
      const servBloco = criarEscopoServicosMacro(obra);
      if (servBloco) {
        blocos.push(servBloco);
      } else {
        (Array.isArray(obra?.servicos) ? obra.servicos : []).forEach((servico: any, idx: number) => {
          const colunasPadrao = ['Descrição'];
          blocos.push({
            id: `escopo-${obra.id}-${servico.id || idx + 1}`,
            servicoId: String(servico.id || idx + 1),
            titulo: `${idx + 1}. ${servico.tipo || 'Serviço'}${servico.localExecucao ? ` - ${servico.localExecucao}` : ''}`,
            descricaoServico: servico.descricao || '',
            textosDepois: [],
            colunas: colunasPadrao,
            linhas: [criarLinhaEscopo(colunasPadrao)]
          });
        });
      }
    }

    // Bloco de escopo de Locação (quando a modalidade contempla locação)
    if (temLocacao(obra?.modalidade)) {
      const locBloco = criarEscopoLocacao(obra);
      if (locBloco) blocos.push(locBloco);
    }

    // Fallback: nenhum bloco (ex.: serviço sem serviços cadastrados) → bloco genérico
    if (blocos.length === 0) {
      const colunasPadrao = ['Descrição'];
      blocos.push({
        id: `escopo-${obra?.id || 'geral'}-1`,
        servicoId: '',
        titulo: 'Serviço Geral',
        descricaoServico: '',
        textosDepois: [],
        colunas: colunasPadrao,
        linhas: [criarLinhaEscopo(colunasPadrao)]
      });
    }

    return blocos;
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
    const cliente = findClienteById(listaClientesLocal, obra.clienteId);
    const rawEmpresa = obra.empresaPrestadora || '';
    const nomeEmpresa = typeof rawEmpresa === 'string' ? rawEmpresa : (rawEmpresa.nome || '');
    const isLinave = isEmpresaLinave(nomeEmpresa);
    const logoUrl = getLogoUrlForEmpresa(nomeEmpresa);

    const logoBase64 = await getBase64FromUrl(logoUrl);
    // Fundo decorativo do rodapé — só a Linave usa (fica atrás do texto em todas as páginas).
    const fundoLinaveBase64 = isLinave ? await getBase64FromUrl('/linave-rodape.png') : undefined;
    handleDownloadPropostaPDF(proposta, cliente, obra, logoBase64, isLinave, fundoLinaveBase64);
  };

  const getRascunhoKey = (obraId: number) => `proposta_rascunho_${obraId}`;

  const handleSelectObra = (obra: any) => {
    setSelectedObra(obra);

    const cliente = findClienteById(listaClientesLocal, obra.clienteId);

    const proximaVersaoLetra = getVersaoInicialProposta(obra.propostas);

    const componentesId = extrairComponentesDoId(obra.id);
    const numeroSequencial = componentesId?.numero || '0001';

    const base: PropostaFormData = {
      ...getInitialPropostaForm(),
      dataProposta: new Date().toISOString().split('T')[0],
      cliente: cliente?.razaoSocial || cliente?.razao_social || cliente?.nomeFantasia || cliente?.nome_fantasia || '',
      atribuidoA: obra.responsavelComercial || '',
      cargoContato: obra.cargo || '',
      numeroProposta: gerarIdProposta(componentesId?.prefixo || 'LN', numeroSequencial, proximaVersaoLetra),
      // Abertura já com o ID do negócio atual logo após "Proposta Técnica-Comercial".
      textoAbertura: `Vimos através desta apresentar nossa Proposta Técnica-Comercial ${obra.id || ''}, para serviços, conforme escopo e delineamento realizado a bordo, conforme solicitado para vossa avaliação e aprovação.\n\n\nEstamos à disposição para quaisquer esclarecimentos que se façam necessários.\n\n\nAtenciosamente,\n\n\nDiretoria Comercial`,
      escopoBasicoServicos: criarEscopoBasicoServicos(obra)
    };

    // Item D (Preço): tabela macro das atividades orçadas, vinda do ORÇAMENTO. Editável aqui
    // (a proposta pode exigir mais atividades). Total da linha = quantidade × valor unit. × dias.
    try {
      const macro = getAtividadesMacro(obra);
      if (macro.length > 0) {
        const precoItens = macro.map((it: any, i: number) => {
          const quantidade = Number(it.quantidade) || 0;
          const valorUnitario = Number(it.valorUnitario) || 0;
          const dias = Number(it.dias) || 0;
          return {
            id: `preco-macro-${i}-${Date.now()}`,
            descricao: String(it.descricao || ''),
            quantidade,
            unidade: String(it.unidade || 'serv.'),
            valorUnitario,
            dias,
            total: quantidade * valorUnitario * dias,
            categoria: (it.categoria === 'locacao' ? 'locacao' : 'servico') as 'servico' | 'locacao',
          };
        });
        base.precoItens = precoItens;
        const totalProposta = precoItens.reduce((s: number, p: any) => s + (Number(p.total) || 0), 0);
        base.preco = `R$ ${totalProposta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } catch (e) {
      // ignore
    }

    // Restaura rascunho salvo se existir
    try {
      const salvo = localStorage.getItem(getRascunhoKey(obra.backendId));
      if (salvo) {
        const rascunho = JSON.parse(salvo) as PropostaFormData;
        setPropostaForm({ ...base, ...rascunho });
      } else {
        setPropostaForm(base);
      }
    } catch {
      setPropostaForm(base);
    }
    setNovaColunaPorEscopo({});
    setViewMode('form');
  };

  const handleSaveProposta = async () => {
    if (!selectedObra) return;

    const proximaVersaoLetra = getVersaoInicialProposta(selectedObra.propostas);

    const componentesId = extrairComponentesDoId(selectedObra.id);
    const numeroSequencial = componentesId?.numero || String(selectedObra.backendId).padStart(4, '0');
    const numeroProposta = gerarIdProposta(componentesId?.prefixo || 'LN', numeroSequencial, proximaVersaoLetra);

    // As chaves devem bater com os nomes dos campos do PropostaComercialSerializer (camelCase)
    const payload = {
      cliente: selectedObra.clienteBackendId,
      negocio: selectedObra.backendId,
      numeroProposta: numeroProposta,
      status: 'pendente',
      referencias: propostaForm.referencia,
      saudacao: propostaForm.saudacao,
      assunto: propostaForm.assunto,
      // Abertura REAL (não mais o escopo achatado) — o escopo vai estruturado abaixo.
      textoAbertura: propostaForm.textoAbertura,
      responsabilidadeContratada: propostaForm.responsabilidadeContratada,
      responsabilidadeContratante: propostaForm.escopoC,
      preco: parsePrecoParaDecimal(propostaForm.preco),
      condicoesGerais: propostaForm.condicoesGerais,
      condicoesPagamento: propostaForm.condicoesPagamento,
      prazo: propostaForm.prazo,
      efetivoPrevisto: propostaForm.efetivoPrevisto,
      encerramento: propostaForm.encerramento,
      // Estrutura rica persistida FIELMENTE: escopo A (tabelas) + tabela D de preço.
      escopoBasicoServicos: propostaForm.escopoBasicoServicos || [],
      precoItens: propostaForm.precoItens || [],
    };

    try {
      await criarProposta(payload);
      localStorage.removeItem(getRascunhoKey(selectedObra.backendId));
      await refreshNegocios();
      alert('Proposta criada com sucesso!');
      setViewMode('list');
      setSelectedObra(null);
      setPropostaForm(getInitialPropostaForm());
      setNovaColunaPorEscopo({});
    } catch (err: any) {
      console.error('Erro ao salvar proposta:', err?.response?.data || err);
      const data = err?.response?.data;
      const detalhe = data
        ? (typeof data === 'string' ? data : JSON.stringify(data))
        : (err?.message || '');
      alert(`Erro ao salvar proposta. Verifique os dados e tente novamente.${detalhe ? `\n\nDetalhe: ${detalhe}` : ''}`);
    }
  };

  const handleSalvarRascunho = () => {
    if (!selectedObra) return;
    try {
      localStorage.setItem(getRascunhoKey(selectedObra.backendId), JSON.stringify(propostaForm));
      alert('Rascunho salvo! Você pode sair e retornar que os dados estarão aqui.');
    } catch {
      alert('Erro ao salvar rascunho.');
    }
  };

  // Baixa o PDF usando os dados ATUAIS do formulário (sem precisar enviar/salvar).
  // Abre o PDF do orçamento do negócio (última versão) para consulta durante a proposta.
  const visualizarOrcamento = () => {
    if (!selectedObra) return alert('Selecione uma obra primeiro.');
    const orc = Array.isArray(selectedObra.orcamentos) && selectedObra.orcamentos.length ? selectedObra.orcamentos[0] : null;
    if (!orc) return alert('Nenhum orçamento encontrado para este negócio.');
    try {
      handleDownloadOrcamentoPDF(orc, { razaoSocial: selectedObra.nomeCliente || '' }, selectedObra);
    } catch (e) {
      console.error('Falha ao gerar PDF do orçamento:', e);
      alert('Não foi possível gerar o PDF do orçamento.');
    }
  };

  const handleBaixarPropostaPreview = () => {
    if (!selectedObra) return alert('Selecione uma obra primeiro.');
    // O gerador do PDF lê `responsabilidadeContratante` (item C); no form esse campo é `escopoC`.
    const propostaParaPdf = {
      ...propostaForm,
      responsabilidadeContratante: propostaForm.escopoC,
    };
    handleDownloadPropostaPDFWithLogo(propostaParaPdf, selectedObra);
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
    const isLinave = isEmpresaLinave(rawEmpresa);

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
        precoTextoLivre: propostaForm.precoTextoLivre,
        condicoesGerais: propostaForm.condicoesGerais,
        condicoesPagamento: propostaForm.condicoesPagamento,
        prazo: propostaForm.prazo,
        efetivoPrevisto: propostaForm.efetivoPrevisto,
        encerramento: propostaForm.encerramento
      };

      doc.render(dataForTemplate);
      const out = doc.getZip().generate({ type: 'blob' });
      saveAs(out, `${propostaForm.numeroProposta || selectedObra.nome || 'proposta'}.docx`);
    } catch (err: any) {
      console.error('Erro gerarDocxTemplate:', err);
      const msg = err?.message ? err.message : String(err);
      const details = err?.stack ? `\n\nStack:\n${err.stack}` : '';
      alert(`Erro ao gerar DOCX: ${msg}${details}`);
    }
  };

  const handleAprovacaoCliente = async (obra: any) => {
    const ultimaProposta = obra.propostas?.[obra.propostas.length - 1];
    if (!ultimaProposta?.id) return;
    try {
      await atualizarProposta(ultimaProposta.id, { status: 'aceita' });
      await atualizarNegocio(obra.backendId, { categoria: 'Em Andamento', status: 'Em andamento' });
      // Atualização otimista: mantém o negócio na tela já como "Aceita" (categoria Em Andamento),
      // preservando as propostas — assim ele continua no "Histórico de Propostas" mesmo que o
      // refetch demore/varie. O refresh abaixo apenas confirma com os dados do servidor.
      setListaNegocios((prev) => prev.map((o) =>
        o.backendId === obra.backendId
          ? {
              ...o,
              categoria: 'Em Andamento',
              status: 'Em andamento',
              propostas: (o.propostas || []).map((p: any, i: number, arr: any[]) =>
                i === arr.length - 1 ? { ...p, status: 'aceita' } : p),
            }
          : o));
      await refreshNegocios();
      if (selectedObra?.backendId === obra.backendId) {
        setSelectedObra(null);
        setViewMode('list');
      }
      alert('Proposta aprovada pelo cliente! Negócio movido para Em Andamento.');
    } catch (err) {
      console.error('Erro ao aprovar proposta:', err);
      alert('Erro ao processar aprovação.');
    }
  };

  const handlePendenteCliente = async (obra: any) => {
    const ultimaProposta = obra.propostas?.[obra.propostas.length - 1];
    if (!ultimaProposta?.id) return;
    try {
      await atualizarProposta(ultimaProposta.id, { status: 'pendente' });
      await refreshNegocios();
      alert('Proposta marcada como pendente.');
    } catch (err) {
      console.error('Erro ao atualizar proposta:', err);
      alert('Erro ao processar operação.');
    }
  };

  // Abre o pop-up estilizado de recusa.
  const abrirRecusaModal = (obra: any) => {
    setRecusaModal({ open: true, obra, motivo: '', submitting: false });
  };

  const fecharRecusaModal = () => {
    if (recusaModal.submitting) return;
    setRecusaModal({ open: false, obra: null, motivo: '', submitting: false });
  };

  // Monta o formulário de proposta REAPROVEITANDO os dados de uma proposta antiga
  // (usado no caminho "refazer proposta") — já com o número/versão novos.
  const montarFormDeProposta = (obra: any, propostaAntiga: any): PropostaFormData => {
    const cliente = findClienteById(listaClientesLocal, obra.clienteId);
    const proximaVersaoLetra = getVersaoInicialProposta(obra.propostas);
    const componentesId = extrairComponentesDoId(obra.id);
    const numeroSequencial = componentesId?.numero || '0001';

    const precoItens = (Array.isArray(propostaAntiga?.precoItens) ? propostaAntiga.precoItens : []).map((it: any, i: number) => {
      const quantidade = Number(it.quantidade) || 0;
      const valorUnitario = Number(it.valorUnitario ?? it.precoUnitario) || 0;
      const dias = Number(it.dias) || 1;
      return {
        id: it.id || `preco-refazer-${i}-${Date.now()}`,
        descricao: String(it.descricao || it.nome || ''),
        quantidade,
        unidade: String(it.unidade || 'serv.'),
        valorUnitario,
        dias,
        total: Number(it.total) || (quantidade * valorUnitario * dias),
      };
    });

    return {
      ...getInitialPropostaForm(),
      dataProposta: new Date().toISOString().split('T')[0],
      numeroProposta: gerarIdProposta(componentesId?.prefixo || 'LN', numeroSequencial, proximaVersaoLetra),
      cliente: cliente?.razaoSocial || cliente?.razao_social || cliente?.nomeFantasia || cliente?.nome_fantasia || propostaAntiga?.cliente || '',
      atribuidoA: obra.responsavelComercial || '',
      cargoContato: obra.cargo || '',
      referencia: propostaAntiga?.referencia || propostaAntiga?.referencias || '',
      saudacao: propostaAntiga?.saudacao || '',
      assunto: propostaAntiga?.assunto || '',
      textoAbertura: propostaAntiga?.textoAbertura || getInitialPropostaForm().textoAbertura,
      escopoA: propostaAntiga?.escopoA || '',
      escopoBasicoServicos: Array.isArray(propostaAntiga?.escopoBasicoServicos) ? propostaAntiga.escopoBasicoServicos : [],
      responsabilidadeContratada: propostaAntiga?.responsabilidadeContratada || '',
      escopoC: propostaAntiga?.escopoC || propostaAntiga?.responsabilidadeContratante || '',
      precoItens,
      condicoesGerais: propostaAntiga?.condicoesGerais || '',
      condicoesPagamento: propostaAntiga?.condicoesPagamento || '',
      prazo: propostaAntiga?.prazo || '',
      efetivoPrevisto: propostaAntiga?.efetivoPrevisto || '',
      encerramento: propostaAntiga?.encerramento || '',
    };
  };

  // Marca a proposta como recusada no backend (passo comum aos dois caminhos).
  const marcarPropostaRecusada = async (obra: any, motivoRecusa: string) => {
    const ultimaProposta = obra.propostas?.[obra.propostas.length - 1];
    if (!ultimaProposta?.id) throw new Error('Proposta inexistente.');
    await atualizarProposta(ultimaProposta.id, { status: 'recusada', motivoRecusaProposta: motivoRecusa });
    return ultimaProposta;
  };

  // CAMINHO 1: refazer o ORÇAMENTO — o negócio volta para a etapa de orçamento.
  const confirmarRefazerOrcamento = async () => {
    const obra = recusaModal.obra;
    const motivoRecusa = recusaModal.motivo.trim();
    if (!obra) return;
    if (!motivoRecusa) { alert('Informe o motivo da recusa.'); return; }

    setRecusaModal(prev => ({ ...prev, submitting: true }));
    try {
      await marcarPropostaRecusada(obra, motivoRecusa);
      await atualizarNegocio(obra.backendId, {
        categoria: 'Planejamento',
        status: 'Aguardando orçamento',
        requer_reorcamento: true,
      });

      // Atualiza contexto global: marca ultimo orcamento como recusado + requerReorcamento
      const obrasAtuais: any[] = Array.isArray(obras) ? obras : [];
      const obrasAtualizadas = obrasAtuais.map((o: any) => {
        if (o.negocioBackendId === obra.backendId || o.id === `ID ${obra.backendId}`) {
          const orcamentosExistentes: any[] = Array.isArray(o.orcamentos) ? o.orcamentos : [];
          const orcamentosAtualizados = orcamentosExistentes.length > 0
            ? orcamentosExistentes.map((orc: any, idx: number, arr: any[]) =>
                idx === arr.length - 1
                  ? { ...orc, status: 'recusado', dataRecusa: new Date().toISOString().split('T')[0], motivoRecusa: motivoRecusa }
                  : orc
              )
            : orcamentosExistentes;
          return {
            ...o,
            requerReorcamento: true,
            categoria: 'Planejamento',
            orcamentos: orcamentosAtualizados,
            versaoNegocio: proximaVersao(o.versaoNegocio || ''),
          };
        }
        return o;
      });
      saveEntity('obras', obrasAtualizadas);

      await refreshNegocios();
      if (selectedObra?.backendId === obra.backendId) {
        setSelectedObra(null);
        setViewMode('list');
      }
      setRecusaModal({ open: false, obra: null, motivo: '', submitting: false });
      alert('Proposta recusada. Negócio retornou para Aguardando orçamento.');
    } catch (err) {
      console.error('Erro ao recusar proposta:', err);
      alert('Erro ao processar recusa.');
      setRecusaModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // CAMINHO 2: refazer a PROPOSTA — abre o formulário já preenchido com os dados da antiga.
  const confirmarRefazerProposta = async () => {
    const obra = recusaModal.obra;
    const motivoRecusa = recusaModal.motivo.trim();
    if (!obra) return;
    if (!motivoRecusa) { alert('Informe o motivo da recusa.'); return; }

    setRecusaModal(prev => ({ ...prev, submitting: true }));
    try {
      await marcarPropostaRecusada(obra, motivoRecusa);
      // Recarrega os negócios para pegar a proposta já marcada como recusada
      // (necessário para o cálculo da próxima versão e p/ reaproveitar o conteúdo).
      const raw = await getNegocios();
      const mapped = Array.isArray(raw) ? raw.map(mapNegocioToObra) : [];
      setListaNegocios(mapped);
      const obraAtualizada = mapped.find((o: any) => o.backendId === obra.backendId) || obra;
      const propostaAntiga = obraAtualizada.propostas?.[obraAtualizada.propostas.length - 1] || obra.propostas?.[obra.propostas.length - 1];

      const formPreenchido = montarFormDeProposta(obraAtualizada, propostaAntiga);
      setSelectedObra(obraAtualizada);
      setPropostaForm(formPreenchido);
      setNovaColunaPorEscopo({});
      setRecusaModal({ open: false, obra: null, motivo: '', submitting: false });
      setViewMode('form');
    } catch (err) {
      console.error('Erro ao refazer proposta:', err);
      alert('Erro ao processar recusa.');
      setRecusaModal(prev => ({ ...prev, submitting: false }));
    }
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

        {/* FILTRO POR OS */}
        {osDisponiveis.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">{boldOS('Filtrar por OS')}</span>
            <select value={filtroOs} onChange={(e) => setFiltroOs(e.target.value)} className="bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              <option value="">Todas as OS</option>
              {osDisponiveis.map((n: any) => <option key={n} value={n}>{n}</option>)}
            </select>
            {filtroOs && <button onClick={() => setFiltroOs('')} className="text-white/40 text-xs underline">limpar</button>}
          </div>
        )}

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
                          Cliente: {findClienteById(listaClientesLocal, obra.clienteId)?.razaoSocial || findClienteById(listaClientesLocal, obra.clienteId)?.razao_social || ''}
                        </p>
                      </div>
                    </div>

                    {/* Informações do Orçamento */}
                    {obra.orcamentoRealizado && obra.orcamentoValores && (
                      <div className="bg-white/3 rounded-lg p-4 mb-4 space-y-2 text-xs border border-white/5">
                        <div className="flex justify-between">
                          <span className="text-white/70">Subtotal:</span>
                          <span className="text-white font-black">R$ {Number(obra.orcamentoValores.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Margem:</span>
                          <span className="text-white font-black">R$ {((Number(obra.orcamentoValores.subtotal || 0) * Number(obra.orcamentoValores.margem || 0)) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-blue-300 font-black">
                          <span>Preço Final:</span>
                          <span>R$ {Number(obra.orcamentoValores.precoFinal || 0).toFixed(2)}</span>
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
                          Cliente: {findClienteById(listaClientesLocal, obra.clienteId)?.razaoSocial || findClienteById(listaClientesLocal, obra.clienteId)?.razao_social || ''}
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
                        <span className="text-white font-black">{formatarVersaoProposta(ultimaProposta)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Criada em:</span>
                        <span className="text-white font-black">{formatDateBR(ultimaProposta.dataCriacao)}</span>
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
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center"
                          >
                            <CheckCircle size={30} /> Aprovação do Cliente
                          </button>
                          <button
                            onClick={() => abrirRecusaModal(obra)}
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

        {recusaModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-[#0b1220] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-red-600/30 to-orange-500/20 border-b border-white/10 p-6 flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-2xl text-red-300 shrink-0"><AlertTriangle size={26} /></div>
                <div className="min-w-0">
                  <h3 className="text-white font-black text-xl uppercase tracking-wide">Recusar Proposta</h3>
                  <p className="text-white/60 text-sm mt-1 truncate">
                    {recusaModal.obra?.id} — {recusaModal.obra?.nome || recusaModal.obra?.cliente || 'Negócio'}
                  </p>
                </div>
                <button
                  onClick={fecharRecusaModal}
                  disabled={recusaModal.submitting}
                  className="ml-auto p-2 rounded-full hover:bg-white/10 text-white/60 disabled:opacity-40"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 block">Motivo da recusa <span className="text-red-400">*</span></label>
                  <textarea
                    autoFocus
                    className="w-full bg-[#101f3d] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-red-500/60 transition-all h-24 resize-none placeholder:text-white/20"
                    value={recusaModal.motivo}
                    onChange={(e) => setRecusaModal(prev => ({ ...prev, motivo: e.target.value }))}
                    placeholder="Descreva o motivo informado pelo cliente..."
                  />
                </div>

                <div>
                  <p className="text-white/70 text-sm font-bold mb-3">Como deseja prosseguir?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={confirmarRefazerOrcamento}
                      disabled={recusaModal.submitting || !recusaModal.motivo.trim()}
                      className="group text-left bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl p-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2 text-amber-300 mb-2"><DollarSign size={18} /><span className="font-black text-sm uppercase tracking-wide">Refazer Orçamento</span></div>
                      <p className="text-white/50 text-xs leading-relaxed">O negócio volta para a etapa de <strong className="text-white/70">Orçamento</strong> (aguardando reorçamento).</p>
                    </button>
                    <button
                      onClick={confirmarRefazerProposta}
                      disabled={recusaModal.submitting || !recusaModal.motivo.trim()}
                      className="group text-left bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-2xl p-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2 text-cyan-300 mb-2"><RefreshCw size={18} /><span className="font-black text-sm uppercase tracking-wide">Refazer Proposta</span></div>
                      <p className="text-white/50 text-xs leading-relaxed">Abre uma <strong className="text-white/70">nova versão</strong> já preenchida com os dados da proposta atual.</p>
                    </button>
                  </div>
                </div>

                {recusaModal.submitting && (
                  <p className="text-white/50 text-xs text-center animate-pulse">Processando...</p>
                )}
              </div>
            </div>
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
                          <h3 className="text-lg font-black text-white">Versão {formatarVersaoProposta(proposta)}</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {formatDateBR(proposta.dataCriacao)}
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
              ID: {selectedObra?.id}
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
              Proposta: {propostaForm.numeroProposta || 'Original'}
            </span>
          </div>
        </div>
      </div>

      <ObservacoesNegocio servicos={selectedObra?.servicos} />

      {/* SEÇÃO 1: DATA E NÚMERO (AUTOPREENCHIDOS) */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">Data</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Data</label>
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
                >Remover Serviço</button>
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
          <div className="bg-[#071122] p-3 rounded-lg">
            {renderTabelaPrecoCategoria('servico', 'Serviços', 'bg-emerald-600 hover:bg-emerald-500 text-white')}
            {renderTabelaPrecoCategoria('locacao', 'Locação', 'bg-cyan-600 hover:bg-cyan-500 text-white')}

            <div className="flex items-center justify-end mt-3 pt-3 border-t border-white/10">
              <div className="text-right">
                <div className="text-white/70 text-[10px] uppercase tracking-widest font-black">Total da Proposta</div>
                <div className="text-emerald-400 font-black text-lg">{propostaForm.preco || 'R$ 0,00'}</div>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <label className={labelClass}>Texto livre do preço</label>
              <textarea
                className={`${inputClass} h-28`}
                value={propostaForm.precoTextoLivre || ''}
                onChange={(e) => setPropostaForm({ ...propostaForm, precoTextoLivre: e.target.value })}
                placeholder="Observações, condições, detalhes comerciais ou qualquer texto complementar do preço"
              />
            </div>
          </div>
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

      {/* SEÇÃO 15: F - PRAZO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">F - Prazo</h3>
        <div className="grid grid-cols-3 gap-4 items-start">
          <div className="col-span-2 space-y-1.5">
            <label className={labelClass}>Prazo</label>
            <textarea
              className={`${inputClass} h-20`}
              value={propostaForm.prazo}
              onChange={e => setPropostaForm({...propostaForm, prazo: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Dias Previstos (Orçamento)</label>
            {(() => {
              // Tenta: selectedObra.orcamentos (agora incluído em mapNegocioToObra),
              // fallback para obras do contexto ErpContext.
              const obraCtx = (obras || []).find((o: any) =>
                String(o.negocioBackendId) === String(selectedObra?.backendId) ||
                o.id === selectedObra?.id
              );
              const orcamentos: any[] = selectedObra?.orcamentos?.length
                ? selectedObra.orcamentos
                : (obraCtx?.orcamentos || []);
              const ultimoOrc = orcamentos[orcamentos.length - 1];
              // Backend usa "duracao" em atividades; frontend salva como "dias"
              // Dias previstos = SOMENTE o somatório das atividades previstas (não inclui dias de mão de obra)
              const atividades: any[] = ultimoOrc?.data?.atividades || [];
              const parseDias = (val: any) => parseFloat(String(val ?? 0)) || 0;
              const total = atividades.reduce((s, i) => s + parseDias(i.dias ?? i.duracao), 0);
              return (
                <div className="h-20 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-amber-400 font-black text-2xl">{Number.isInteger(total) ? total : total.toFixed(1)}</p>
                    <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">dias previstos</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* SEÇÃO 16: G - EFETIVO PREVISTO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">G - Efetivo previsto</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Efetivo previsto</label>
          <textarea
            className={`${inputClass} h-24`}
            value={propostaForm.efetivoPrevisto}
            onChange={e => setPropostaForm({...propostaForm, efetivoPrevisto: e.target.value})}
          />
        </div>
      </div>

      {/* SEÇÃO 17: H - CONDIÇÕES DE PAGAMENTO */}
      <div className={sectionClass}>
        <h3 className="text-base font-black text-white uppercase mb-4">H - Condições de Pagamento</h3>
        <div className="space-y-1.5">
          <label className={labelClass}>Condições</label>
          <textarea
            className={`${inputClass} h-32`}
            value={propostaForm.condicoesPagamento}
            onChange={e => setPropostaForm({...propostaForm, condicoesPagamento: e.target.value})}
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
          onClick={visualizarOrcamento}
          className="flex-1 bg-amber-600/80 hover:bg-amber-600 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
          title="Abre o PDF do orçamento deste negócio para consulta"
        >
          <FileText size={18} /> Visualizar Orçamento
        </button>
        <button
          onClick={handleBaixarPropostaPreview}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
          title="Baixa o PDF com os dados atuais do formulário (sem precisar enviar)"
        >
          <Download size={18} /> Baixar PDF
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
      </div>
    </div>
  );
}

