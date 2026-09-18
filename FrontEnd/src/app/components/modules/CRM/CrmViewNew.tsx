import React, { useState, useEffect, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { extrairIdProjetoDoNumero } from '../../../context/ErpContext';
import { Plus, X, FileText, DollarSign, CheckCircle, Clock, ArrowRight, Edit2, ChevronDown, Zap, AlertCircle, Download, Eye, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '../../ui/feedback';
import { handleDownloadMedicaoPDF } from './handleDownloadMedicaoPDF';
import { handleDownloadPropostaPDF } from './handleDownloadPropostaPDF';
import { handleDownloadOrcamentoPDF as gerarOrcamentoPDF } from './handleDownloadOrcamentoPDF';
import { handleDownloadOSPDF as gerarOSPDF } from './handleDownloadOSPDF';
import { getCachedWorkspace } from '../../../services/workspaceStorage';
import { boldOS } from '../../../utils/osHighlight';
import { downloadDocument, getDocumentHref } from '../../../utils/documentDownload';
import { formatDateBR } from '../../../utils/formatDate';
import { isEmpresaLinave, getLogoUrlForEmpresa } from '../../../utils/company';
import { uploadDocumento, excluirDocumento } from '../../../../services/documentosService';
import { formatarNumeroSequencial } from '../../../../services/numeroSequencial';
import { MODALIDADES, temServico, temLocacao, modalidadeLabel } from '../../../utils/modalidade';
// Substitua as importações antigas por esta única:
import {
    getNegocios,
    getClientes,
    getNegociosDoCliente,
    criarNegocio,
    atualizarNegocio,
    excluirNegocio, // Adicionado aqui!
    atualizarStatusOs,
    criarProposta,
    getNegocioPorId,
} from '../../../../services/comercialService';
import { createOrcamento, buildOrcamentoPayload } from '../../../../services/comercial';
import { mapNegocioToObra } from '../../../../services/obrasMapper';



interface Servico {
  id: string;
  tipo: string;
  embarcacao: string;
  localExecucao: string;
  porto: string;
  prazoDes: string;
  descricao: string;
  observacoes?: string;
}

interface ItemAlocacaoForm {
  id: string;
  equipamento: string;
  estoqueRef: string;
  unidade: string;
  quantidade: string;
  observacao: string;
}

interface DocumentoNegocio {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  dataUpload: string;
  conteudo?: string;     // base64 (legado) OU = url (documentos persistidos no SQL)
  url?: string;          // URL relativa /media/... do documento persistido
  backendId?: number;    // id da linha Documento no SQL (para excluir)
  file?: File;           // arquivo bruto, só enquanto o negócio ainda não foi criado
}

// --- Estruturas do bloco "Importar negócio já fechado" (toggle "Deseja ir
// direto para OS?") — espelham os shapes reais de OrcamentosView.tsx
// (Material/Terceirizado) e PropostaView.tsx (EscopoServico/precoItens), mas
// como tipos próprios: são estado privado deste formulário, não das telas
// de Orçamento/Proposta.
interface ImportarEscopoLinha {
  id: string;
  valores: Record<string, string>;
}

interface ImportarEscopoServico {
  id: string;
  titulo: string;
  descricaoServico: string;
  colunas: string[];
  linhas: ImportarEscopoLinha[];
  textosDepois: string[];
}

interface ImportarPrecoItem {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  dias: number;
  total: number;
}

interface ImportarMaterial {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  pesoFator: string;
  custoUnit: string;
  valorTotal: string;
  origemTerceiros: 'Sim' | 'Nao';
  observacao: string;
}

interface ImportarTerceirizado {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  pesoFator: string;
  custoUnit: string;
  valorTotal: string;
  observacao: string;
}

interface ImportarOsData {
  orcamentoNumero: string;
  orcamentoVersao: string;
  orcamentoArquivo: DocumentoNegocio | null;
  propostaNumero: string;
  propostaVersao: string;
  propostaArquivo: DocumentoNegocio | null;
  escopoServicos: ImportarEscopoServico[];
  precoItens: ImportarPrecoItem[];
  precoTextoLivre: string;
  materiais: ImportarMaterial[];
  terceirizados: ImportarTerceirizado[];
}

// Input + botão "Adicionar" para nomear uma nova coluna da planilha de escopo.
// Componente à parte (com seu próprio estado local) pra não precisar de um
// mapa de "texto digitado por escopo" no componente pai.
function ColunaAdder({ onAdd }: { onAdd: (nome: string) => void }) {
  const [valor, setValor] = useState('');
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <input
        className="w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20"
        placeholder="Nome da coluna"
        value={valor}
        onChange={e => setValor(e.target.value)}
      />
      <button
        type="button"
        onClick={() => { if (valor.trim()) { onAdd(valor.trim()); setValor(''); } }}
        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition"
      >
        <Plus size={14} className="inline mr-1" /> Adicionar
      </button>
    </div>
  );
}

interface LinhaTabelaMediacao {
  id: string;
  item: string;
  descricao: string;
  unidade: string;
  quantidadeProduzida: string;
  valorUnitario: string;
  total: string;
  observacoes: string;
}

interface LinhaTabelaRecursosMediacao {
  id: string;
  recurso: string;
  funcao: string;
  periodo: string;
  horas: string;
  observacoes: string;
}

interface DocumentoMediacaoForm {
  obraId: string;
  empresa: string;
  cliente: string;
  cnpj: string;
  dataEmissao: string;
  embarcacao: string;
  numeroBM: string;
  periodo: string;
  representanteCliente: string; // Novo campo
  representanteLinave: string;  // Novo campo
  tabelaItens: LinhaTabelaMediacao[];
  tabelaRecursos: LinhaTabelaRecursosMediacao[];
}

type FaseOS =
  | 'Pre-Venda'
  | 'PlanoServico'
  | 'VendaFechada'
  | 'Operacao'
  | 'AnteProjeto'
  | 'Projeto'
  | 'Fabricacao'
  | 'Teste'
  | 'PrestacaoServico'
  | 'PosVenda';

interface CrmViewProps {
  searchQuery: string;
}

type CategoriaObra = 'Planejamento' | 'Negociação' | 'Em Andamento' | 'Finalização';

const COLUNAS: { id: CategoriaObra; titulo: string; icon: any; cor: string }[] = [
  { id: 'Planejamento', titulo: 'Planejamento', icon: FileText, cor: 'blue' },
  { id: 'Negociação', titulo: 'Negociação', icon: Clock, cor: 'amber' },
  { id: 'Em Andamento', titulo: 'Em Andamento', icon: ArrowRight, cor: 'purple' },
  { id: 'Finalização', titulo: 'Finalização', icon: CheckCircle, cor: 'emerald' }
];

export const getPrefixoEmpresa = (empresaPrestadora?: string) => {
  if (!empresaPrestadora) return 'LN';
  return empresaPrestadora.toLowerCase().includes('servinave') ? 'VTS' : 'LN';
};

export const indexToVersaoAlfabetica = (index: number) => {
  if (index < 0) return 'A';
  let value = index;
  let output = '';
  while (value >= 0) {
    output = String.fromCharCode((value % 26) + 65) + output;
    value = Math.floor(value / 26) - 1;
  }
  return output;
};

export function CrmViewNew({ searchQuery }: CrmViewProps) {
  const { os, saveEntity, userSession, config, obras, medicoes } = useErp() as any;

  const [listaClientesCRM, setListaClientesCRM] = useState<any[]>([]);
  const [negociosBackend, setNegociosBackend] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [showFormNovoNegocio, setShowFormNovoNegocio] = useState(false);
  const [novoNegocioTab, setNovoNegocioTab] = useState<'dados' | 'servicos' | 'alocacao' | 'documentos'>('dados');
  const [selectedObraDetalhes, setSelectedObraDetalhes] = useState<any>(null);
  const [showDetalhesObraModal, setShowDetalhesObraModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingObra, setEditingObra] = useState<any>(null);
  const [expandedOrcamentoSummary, setExpandedOrcamentoSummary] = useState(false);
  const [showPropostaFullModal, setShowPropostaFullModal] = useState(false);
  const [showOSFullModal, setShowOSFullModal] = useState(false);
  const [showOrcamentoFullModal, setShowOrcamentoFullModal] = useState(false);
  const [showArquivosModal, setShowArquivosModal] = useState(false);
  const [selectedObraArquivos, setSelectedObraArquivos] = useState<any>(null);
  const [showDocumentoMediacaoModal, setShowDocumentoMediacaoModal] = useState(false);
  const [documentoMediacaoForm, setDocumentoMediacaoForm] = useState<DocumentoMediacaoForm | null>(null);
  const [showDocumentoPreviewModal, setShowDocumentoPreviewModal] = useState(false);
  const [documentoVisualizado, setDocumentoVisualizado] = useState<any>(null);

    const empresasPrestadoras = useMemo(() => {
    const empresasCadastradas = Array.isArray(config?.empresasPrestadoras)
      ? config.empresasPrestadoras
      : [];

    const empresasPadrao = [
      { id: 'EMP-LINAVE', nome: 'Linave', cnpj: '' },
      { id: 'EMP-SERVINAVE', nome: 'Servinave', cnpj: '' }
    ];

    const fallbackNome = config?.empresaNome && config.empresaNome !== 'Linave ERP Demo'
      ? config.empresaNome
      : 'Linave';

    const origem = empresasCadastradas.length > 0
      ? [...empresasCadastradas]
      : [{ id: 'EMP-LINAVE', nome: fallbackNome }];

    empresasPadrao.forEach((empresaPadrao) => {
      // Contém (não só igualdade exata): a empresa já cadastrada costuma ter o nome completo
      // ("Servinave Serviços Marítimos"), não só "Servinave" — comparar por igualdade estrita
      // não reconhecia isso como a mesma empresa e injetava um "Servinave" fantasma duplicado,
      // com o mesmo id da empresa real (causava o warning de key duplicada no <select>).
      const jaExiste = origem.some((empresa: any) => {
        const nomeBase = typeof empresa === 'string'
          ? empresa
          : empresa?.nome || empresa?.razaoSocial || empresa?.empresaNome || '';

        const nomeNormalizado = String(nomeBase).trim().toLowerCase();
        return !!nomeNormalizado && nomeNormalizado.includes(empresaPadrao.nome.toLowerCase());
      });

      if (!jaExiste) {
        origem.push(empresaPadrao);
      }
    });

    const empresasUnicas = new Map<string, { id: string; nome: string; cnpj: string }>();
    const idsUsados = new Set<string>();

    origem.forEach((empresa: any, index: number) => {
      const nomeBase = typeof empresa === 'string'
        ? empresa
        : empresa?.nome || empresa?.razaoSocial || empresa?.empresaNome || '';
      const nome = String(nomeBase).trim();

      if (!nome) return;

      const chave = nome.toLowerCase();
      if (empresasUnicas.has(chave)) return;

      // Defesa extra: se por algum motivo o id já foi usado por outra empresa nesta lista
      // (dado antigo/mal migrado), gera um id alternativo em vez de repetir a key no <select>.
      let id = typeof empresa === 'object' && empresa?.id ? String(empresa.id) : `empresa-${index}`;
      if (idsUsados.has(id)) id = `${id}-${index}`;
      idsUsados.add(id);

      empresasUnicas.set(chave, {
        id,
        nome,
        cnpj: typeof empresa === 'object' ? empresa?.cnpj || empresa?.empresaCnpj || '' : ''
      });
    });

    const empresasNormalizadas = Array.from(empresasUnicas.values());

    return empresasNormalizadas.length > 0
      ? empresasNormalizadas
      : [{ id: 'EMP-LINAVE', nome: fallbackNome || 'Linave', cnpj: '' }];
  }, [config?.empresasPrestadoras, config?.empresaNome]);

  const empresaPrestadoraPadrao = empresasPrestadoras[0]?.nome || 'Linave';
  
const initialServico: Servico = {
    id: '',
    tipo: '',
    embarcacao: '',
    localExecucao: '',
    porto: '',
    prazoDes: '',
    descricao: '',
    observacoes: ''
  };

  const initialItemAlocacao: ItemAlocacaoForm = {
    id: '',
    equipamento: '',
    estoqueRef: '',
    unidade: 'un',
    quantidade: '',
    observacao: ''
  };

  // Estado vazio do bloco "Importar negócio já fechado" (só relevante quando
  // desejaIrDiretoParaOs === true) — fábrica isolada pra não duplicar a
  // estrutura nas duas inicializações de formData (initialForm/createInitialForm).
  const createInitialImportarOsData = (): ImportarOsData => ({
    orcamentoNumero: '',
    orcamentoVersao: '',
    orcamentoArquivo: null,
    propostaNumero: '',
    propostaVersao: '',
    propostaArquivo: null,
    escopoServicos: [],
    precoItens: [],
    precoTextoLivre: '',
    materiais: [{ id: `material-${Date.now()}`, descricao: '', unidade: '', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '0.00', origemTerceiros: 'Nao', observacao: '' }],
    terceirizados: [{ id: `terceirizado-${Date.now()}`, descricao: '', unidade: '', quantidade: '', pesoFator: '1', custoUnit: '', valorTotal: '0.00', observacao: '' }],
  });

  const initialForm = {
    // Vazio de propósito: obriga a escolha explícita da empresa (o Nº do Negócio só
    // aparece depois disso, já que a numeração é uma sequência separada por empresa).
    empresaPrestadora: '',
    numeroNegocio: '',
    nomeNegocio: '',
    clienteId: '',
    cnpj: '',
    origemLead: '',
    modalidade: 'servico',
    solicitante: '',
    cargo: '',
    telefone: '',
    email: '',
    dataSolicitacao: new Date().toISOString().split('T')[0],
    // "Deseja ir direto para OS?" — pula o quadro do CRM e vai direto pra criação da OS
    // assim que o negócio for salvo (com confirmação antes, ver handleSave).
    desejaIrDiretoParaOs: false,
    importarOs: createInitialImportarOsData(),
    servicos: [{ ...initialServico, id: `servico-${Date.now()}` }],
    itensAlocacao: [] as ItemAlocacaoForm[],
    fase: 'Pre-Venda' as FaseOS,
    docs: {
      requisitos: false,
      proposta: false,
      orcamento: false
    },
    documentosNegocio: [] as DocumentoNegocio[]
  };

  // --- FORMULÁRIO DE NOVO NEGÓCIO ---
  const createInitialForm = () => ({
  // Vazio de propósito: obriga a escolha explícita da empresa (o Nº do Negócio só
  // aparece depois disso, já que a numeração é uma sequência separada por empresa).
  empresaPrestadora: '',
  // Vazio = usa a sugestão automática (calculada ao vivo em numeroNegocioSugerido);
  // só passa a valer o texto digitado quando o usuário efetivamente edita o campo.
  numeroNegocio: '',
  nomeNegocio: '',
  clienteId: '',
  cnpj: '',
  origemLead: '',
  modalidade: 'servico',
  solicitante: '',
  cargo: '',
  telefone: '',
  email: '',
  dataSolicitacao: new Date().toISOString().split('T')[0],
  // "Deseja ir direto para OS?" — pula o quadro do CRM e vai direto pra criação da OS
  // assim que o negócio for salvo (com confirmação antes, ver handleSave).
  desejaIrDiretoParaOs: false,
  importarOs: createInitialImportarOsData(),
  servicos: [{ ...initialServico, id: `servico-${Date.now()}` }],
  itensAlocacao: [] as ItemAlocacaoForm[],
  fase: 'Pre-Venda' as FaseOS,
  docs: {
    requisitos: false,
    proposta: false,
    orcamento: false
  },
  documentosNegocio: [] as DocumentoNegocio[]
});
 
 const [formData, setFormData] = useState(createInitialForm);

  // Piso de cada sequência: 0934/26 foi o último negócio da Linave e 0380/26 o último da
  // Servinave no controle anterior (fora deste sistema) — cada empresa continua a partir
  // do número seguinte ao seu próprio último (935 e 381), numeração independente por empresa.
  const NUMERO_NEGOCIO_PISO_LINAVE = 934;
  const NUMERO_NEGOCIO_PISO_SERVINAVE = 380;

  // Sugestão de "Nº do Negócio" pro form de Novo Negócio: próximo número da sequência DA
  // EMPRESA SELECIONADA (maior número já em uso entre os negócios daquele prefixo + 1, nunca
  // abaixo do piso da empresa). Só existe depois que o usuário escolhe a Empresa Prestadora —
  // sem empresa não há como saber qual sequência usar. O usuário pode digitar por cima —
  // nesse caso o valor digitado é o que vai (ver handleSave).
  // Nota: 1000 (Linave) e 2000 (Servinave) são números de OS reservados para uso interno
  // (ver seed_os_interna no backend), não de negócio — a numeração de negócio não pula eles.
  const numeroNegocioSugerido = useMemo(() => {
    if (!formData.empresaPrestadora) return '';
    const prefixo = getPrefixoEmpresa(formData.empresaPrestadora);
    const piso = prefixo === 'VTS' ? NUMERO_NEGOCIO_PISO_SERVINAVE : NUMERO_NEGOCIO_PISO_LINAVE;
    const extrairNumero = (id: string): number => {
      const m = new RegExp(`^${prefixo}-(\\d+)/`).exec(String(id || '').trim().toUpperCase());
      return m ? parseInt(m[1], 10) : 0;
    };
    const maiorNumero = (Array.isArray(obras) ? obras : []).reduce(
      (max: number, o: any) => Math.max(max, extrairNumero(o.id)), piso,
    );
    const numero = formatarNumeroSequencial(maiorNumero + 1);
    const ano = String(new Date().getFullYear()).slice(-2);
    return `${prefixo}-${numero}/${ano}`;
  }, [obras, formData.empresaPrestadora]);

  // --- FUNÇÕES DE MANIPULAÇÃO DE SERVIÇOS (Corrigindo o ReferenceError) ---
  const handleAddServico = () => {
    setFormData(prev => ({
      ...prev,
      servicos: [...prev.servicos, { ...initialServico, id: `servico-${Date.now()}` }]
    }));
  };

  const handleRemoveServico = (idx: number) => {
    if (formData.servicos.length === 1) {
      return toast.error("Você precisa manter pelo menos um serviço.");
    }
    setFormData(prev => ({
      ...prev,
      servicos: prev.servicos.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateServico = (idx: number, field: string, value: any) => {
    setFormData(prev => {
      const updatedServicos = [...prev.servicos];
      updatedServicos[idx] = { ...updatedServicos[idx], [field]: value };
      return { ...prev, servicos: updatedServicos };
    });
  };

  // --- FUNÇÕES DE MANIPULAÇÃO DE ITENS DE ALOCAÇÃO (LOCAÇÃO) ---
  const handleAddItemAlocacao = () => {
    setFormData(prev => ({
      ...prev,
      itensAlocacao: [...(prev.itensAlocacao || []), { ...initialItemAlocacao, id: `aloc-${Date.now()}` }]
    }));
  };

  const handleRemoveItemAlocacao = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      itensAlocacao: (prev.itensAlocacao || []).filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateItemAlocacao = (idx: number, field: string, value: any) => {
    setFormData(prev => {
      const itens = [...(prev.itensAlocacao || [])];
      itens[idx] = { ...itens[idx], [field]: value };
      return { ...prev, itensAlocacao: itens };
    });
  };

  // --- EFEITO DE CARREGAMENTO SQL PURO ---
  // --- EFEITO DE CARREGAMENTO SQL PURO ---
  useEffect(() => {
    const carregarDadosExclusivosSQL = async () => {
      setIsLoading(true);
      try {
        // 1. Garante que temos a lista de clientes atualizada na memória
        const clientesBackend = await getClientes();
        const clientesMapa: Record<string, string> = {};
        
        if (Array.isArray(clientesBackend)) {
          setListaClientesCRM(clientesBackend);
          clientesBackend.forEach((c: any) => {
            clientesMapa[String(c.id)] = c.razaoSocial || c.razao_social || '';
          });
        }

        // 2. Busca os negócios do banco
        const dados = await getNegocios();
        if (Array.isArray(dados)) {
          // Lê o contexto atual para preservar campos que só existem no frontend
          const obrasContextoAtual: any[] = Array.isArray(obras) ? obras : [];

          const formatados = dados.map((n: any) => {
            const prefixo = String(n.empresa_prestadora || '').toLowerCase().includes('servinave') ? 'VTS' : 'LN';
            const numeroCustomizadoAtual = String(n.numero_customizado || '').trim();
            const idFormatado = numeroCustomizadoAtual || `${prefixo}-${formatarNumeroSequencial(n.id)}/${String(new Date().getFullYear()).slice(-2)}`;
            const idClienteStr = String(n.cliente || '');
            // Preserva campos frontend-only (dadosMediacao, finalizadoComMediacao, documentosNegocio, etc.)
            const obraExistente = obrasContextoAtual.find(
              (o: any) => o.id === idFormatado || o.negocioBackendId === n.id
            ) || {};

            return {
              ...obraExistente,
              id: idFormatado,
              numeroCustomizado: numeroCustomizadoAtual || undefined,
              nome: n.nome_negocio,
              clienteId: n.cliente,
              nomeClienteResolvido: clientesMapa[idClienteStr] || n.cliente_nome || n.nome_cliente || "Cliente Identificado",
              empresaPrestadora: n.empresa_prestadora || 'Linave',
              categoria: n.categoria || obraExistente.categoria || 'Planejamento',
              status: n.status || obraExistente.status || 'Aguardando orçamento',
              solicitante: n.solicitante,
              dataSolicitacao: n.data_solicitacao || n.created_at || '',
              tipo: n.tipo_servico || (n.servicos?.[0]?.tipo_servico) || '',
              responsavelTecnico: n.solicitante || '',
              servicos: n.servicos || [],
              modalidade: n.modalidade || obraExistente.modalidade || 'servico',
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
                : (obraExistente.itensAlocacao || []),
              negocioBackendId: n.id,
              orcamentos: n.orcamentos || [],
              propostas: n.propostas || [],
              documentosNegocio: obraExistente.documentosNegocio || n.documentos || n.arquivos || [],
              usoInterno: Boolean(n.uso_interno),
            };
          });

          setNegociosBackend(formatados);
          // Sincroniza com o ErpContext global para as outras abas lerem a mesma estrutura
          saveEntity('obras', formatados);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do SQL:", error);
        toast.error("Erro ao conectar com o banco de dados.");
      } finally {
        setIsLoading(false);
      }
    };

    carregarDadosExclusivosSQL();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proximaVersao = (v: string): string => {
    const char = (v || '').toUpperCase().slice(-1);
    if (!char) return 'A';
    return char < 'Z' ? String.fromCharCode(char.charCodeAt(0) + 1) : 'AA';
  };

  const formatarIdCard = (obra: any): string => {
    const idBase = extrairIdProjetoDoNumero(String(obra.id || ''));
    if (idBase) {
      return idBase;
    }
    if (obra.numeroCustomizado) return String(obra.numeroCustomizado);

    const numericId = obra.negocioBackendId
      || parseInt(String(obra.id || '').replace(/\D/g, ''), 10)
      || 0;
    const emp = String(obra.empresaPrestadora || '').toLowerCase();
    const prefixo = emp.includes('servinave') ? 'VTS'
      : emp.includes('linave') ? 'LN'
      : getPrefixoEmpresa(obra.empresaPrestadora || 'LN');
    const idPadded = formatarNumeroSequencial(numericId);
    const ano = String(new Date().getFullYear()).slice(-2);
    return `${prefixo}-${idPadded}/${ano}`;
  };

  const obraTemDocumentoMediacao = (obra: any) => {
    const docs = Array.isArray(obra?.documentosNegocio) ? obra.documentosNegocio : [];
    return docs.some((doc: any) => {
      const id = String(doc?.id || '').toLowerCase();
      const nome = String(doc?.nome || '').toLowerCase();
      return id.includes('mediacao') || nome.includes('medi') || nome.includes('medição');
    }) || Boolean(obra?.finalizadoComMediacao);
  };

  const versaoAlfabeticaToIndex = (versao: string) => {
    const cleaned = versao.toUpperCase().replace(/[^A-Z]/g, '');
    if (!cleaned) return -1;

    let index = 0;
    for (let i = 0; i < cleaned.length; i += 1) {
      index = (index * 26) + (cleaned.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const formatarVersaoOrcamento = (versao: any) => {
    if (typeof versao === 'string' && /^[A-Za-z]+$/.test(versao.trim())) {
      return versao.trim().toUpperCase();
    }

    const versaoNumero = Number(versao);
    if (Number.isFinite(versaoNumero) && versaoNumero > 0) {
      return String(Math.floor(versaoNumero));
    }

    return '1';
  };

  const formatarEscopoBasicoParaTexto = (escopo: any) => {
    if (!escopo) {
      return '−';
    }

    if (typeof escopo === 'string') {
      return escopo;
    }

    const formatarItemEscopo = (item: any, index: number) => {
      if (!item) return '';
      if (typeof item === 'string') return item;

      const partes = [item.titulo, item.descricaoServico, item.texto].filter(
        (valor) => typeof valor === 'string' && valor.trim(),
      );

      if (Array.isArray(item.linhas) && item.linhas.length > 0) {
        const linhas = item.linhas
          .map((linha: any) => {
            if (!linha?.valores || typeof linha.valores !== 'object') {
              return '';
            }

            const valores = Object.values(linha.valores)
              .filter((valor) => typeof valor === 'string' ? valor.trim() : Boolean(valor))
              .map((valor) => String(valor).trim())
              .filter(Boolean);

            return valores.length > 0 ? `- ${valores.join(' | ')}` : '';
          })
          .filter(Boolean);

        if (linhas.length > 0) {
          partes.push(linhas.join('\n'));
        }
      }

      if (partes.length === 0) {
        return `Item ${index + 1}`;
      }

      return partes.join('\n');
    };

    if (Array.isArray(escopo)) {
      return escopo
        .map((item, index) => formatarItemEscopo(item, index))
        .filter(Boolean)
        .join('\n\n');
    }

    if (typeof escopo === 'object') {
      return formatarItemEscopo(escopo, 0);
    }

    return String(escopo);
  };

  const normalizarEscopoBasicoEstruturado = (escopo: any) => {
    if (!escopo) return [];

    const normalizarLinha = (linha: any) => {
      if (!linha?.valores || typeof linha.valores !== 'object') return [];
      return Object.entries(linha.valores)
        .map(([chave, valor]) => ({
          chave: String(chave),
          valor: String(valor ?? '').trim(),
        }))
        .filter((coluna) => coluna.valor);
    };

    const normalizarItem = (item: any, index: number) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return {
          titulo: item.trim() || `Item ${index + 1}`,
          textosAntes: [],
          tabela: [],
          textosDepois: [],
        };
      }

      const titulo = [item.titulo, item.descricaoServico, item.descricao, item.texto]
        .find((valor) => typeof valor === 'string' && valor.trim());

      return {
        titulo: titulo?.trim() || `Item ${index + 1}`,
        textosAntes: [
          ...(Array.isArray(item.textosAntesTabela) ? item.textosAntesTabela : []),
          ...(typeof item.textoLivre === 'string' && item.textoLivre.trim() ? [item.textoLivre] : []),
        ].filter((texto: any) => typeof texto === 'string' && texto.trim()).map((texto: string) => texto.trim()),
        tabela: Array.isArray(item.linhas)
          ? item.linhas.map((linha: any) => normalizarLinha(linha)).filter((linha: any[]) => linha.length > 0)
          : [],
        textosDepois: (Array.isArray(item.textosDepoisTabela) ? item.textosDepoisTabela : [])
          .filter((texto: any) => typeof texto === 'string' && texto.trim())
          .map((texto: string) => texto.trim()),
      };
    };

    if (typeof escopo === 'string') {
      return [{ titulo: '', textosAntes: [escopo], tabela: [], textosDepois: [] }];
    }

    if (Array.isArray(escopo)) {
      return escopo.map((item, index) => normalizarItem(item, index)).filter(Boolean);
    }

    if (typeof escopo === 'object') {
      const item = normalizarItem(escopo, 0);
      return item ? [item] : [];
    }

    return [{ titulo: '', textosAntes: [String(escopo)], tabela: [], textosDepois: [] }];
  };



  const getEmpresaPrestadoraNome = (nome?: string) => {
    const valor = String(nome || '').trim();
    if (!valor) return 'Não informado';

    const empresaEncontrada = empresasPrestadoras.find((empresa) =>
      String(empresa.nome || '').toLowerCase() === valor.toLowerCase() ||
      String(empresa.id || '').toLowerCase() === valor.toLowerCase()
    );

    return empresaEncontrada?.nome || valor;
  };

 useEffect(() => {
  const empresasDisponiveis = empresasPrestadoras.map((empresa) => empresa.nome);
  // Só corrige um valor INVÁLIDO (empresa que não existe mais na lista) — vazio é um
  // estado válido aqui (o usuário ainda não escolheu a empresa de propósito).
  if (empresasDisponiveis.length > 0 && formData.empresaPrestadora && !empresasDisponiveis.includes(formData.empresaPrestadora)) {
    setFormData((prev) => ({ ...prev, empresaPrestadora: empresasDisponiveis[0] }));
  }
}, [empresasPrestadoras, formData.empresaPrestadora]); // Adicione a dependência para validação segura

  const handleClienteChange = (clienteId: string) => {
    const cliente = listaClientesCRM.find((c: any) => String(c.id) === String(clienteId));
    setFormData({
      ...formData,
      clienteId,
      cnpj: cliente?.cpfCnpj || ''
    });
  };


  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const parseDecimal = (value: string) => {
    const normalized = String(value || '').trim();
    const parsed = normalized.includes(',')
      ? Number(normalized.replace(/\./g, '').replace(',', '.'))
      : Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatDecimal = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');
  const safeNumber = (value: any) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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
      console.warn('[CRM] Erro ao carregar logo:', url, error);
      return undefined;
    }
  };

  const gerarIdLinha = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const novaLinhaTabelaMediacao = (): LinhaTabelaMediacao => ({
    id: gerarIdLinha(),
    item: '',
    descricao: '',
    unidade: '',
    quantidadeProduzida: '',
    valorUnitario: '',
    total: '0.00',
    observacoes: ''
  });

  const novaLinhaTabelaRecursosMediacao = (): LinhaTabelaRecursosMediacao => ({
    id: gerarIdLinha(),
    recurso: '',
    funcao: '',
    periodo: '',
    horas: '',
    observacoes: ''
  });

  const formatarDataInputParaBr = (data: string) => {
    if (!data) return 'Nao informado';
    const partes = data.split('-');
    if (partes.length !== 3) return data;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const montarPeriodoMediacao = (obra: any) => {
    const inicio = obra?.dataPrevistaInicio || obra?.inicioPrevisto || obra?.dataSolicitacao || '';
    const fim = obra?.dataPrevistaFinal || obra?.fimPrevisto || '';

    if (inicio && fim) {
      return `${formatarDataInputParaBr(inicio)} a ${formatarDataInputParaBr(fim)}`;
    }
    if (inicio) {
      return `${formatarDataInputParaBr(inicio)} a definir`;
    }
    return '';
  };

  const obterCnpjCliente = (cliente: any) => cliente?.cpfCnpj || cliente?.cnpj || '';

  const handleAbrirDocumentoMediacao = (obra: any) => {
    const obraAtual = (negociosBackend || []).find((item: any) => item.id === obra.id) || obra;
    const cliente = listaClientesCRM.find((item: any) => String(item.id) === String(obraAtual.clienteId));

    // Usar o ID do projeto diretamente (já tem formato correto: LN-0731/26)
    const idProjetoFormatado = obraAtual.id || '';

    setSelectedObraDetalhes(obraAtual);
    setDocumentoMediacaoForm({
      obraId: obraAtual.id,
      empresa: obraAtual.empresaPrestadora || empresaPrestadoraPadrao,
      cliente: cliente?.razaoSocial || '',
      cnpj: obterCnpjCliente(cliente),
      dataEmissao: new Date().toISOString().split('T')[0],
      embarcacao: '',
      numeroBM: idProjetoFormatado,
      periodo: montarPeriodoMediacao(obraAtual),
      representanteCliente: cliente?.razaoSocial || '', // Sugestão inicial
      representanteLinave: 'Linave', // Sugestão inicial
      tabelaItens: [novaLinhaTabelaMediacao()],
      tabelaRecursos: [novaLinhaTabelaRecursosMediacao()]
    });
    setShowDocumentoMediacaoModal(true);
  };

  const handleEditarMediacao = (obra: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const obraAtual = (negociosBackend || []).find((item: any) => item.id === obra.id) || obra;
    setSelectedObraDetalhes(obraAtual);
    if (obraAtual.dadosMediacao) {
      setDocumentoMediacaoForm(obraAtual.dadosMediacao);
    } else {
      handleAbrirDocumentoMediacao(obra);
      return;
    }
    setShowDocumentoMediacaoModal(true);
  };

  const atualizarCampoMediacao = (campo: keyof DocumentoMediacaoForm, valor: any) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [campo]: valor };
    });
  };

  const atualizarLinhaTabelaItens = (linhaId: string, campo: keyof LinhaTabelaMediacao, valor: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      const tabelaItens = prev.tabelaItens.map((linha) => {
        if (linha.id !== linhaId) return linha;

        const proximaLinha = { ...linha, [campo]: valor };
        const quantidade = parseDecimal(proximaLinha.quantidadeProduzida);
        const valorUnitario = parseDecimal(proximaLinha.valorUnitario);
        const total = quantidade * valorUnitario;

        return {
          ...proximaLinha,
          total: formatDecimal(total)
        };
      });

      return {
        ...prev,
        tabelaItens
      };
    });
  };

  const atualizarLinhaTabelaRecursos = (linhaId: string, campo: keyof LinhaTabelaRecursosMediacao, valor: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabelaRecursos: prev.tabelaRecursos.map((linha) => (
          linha.id === linhaId ? { ...linha, [campo]: valor } : linha
        ))
      };
    });
  };

  const adicionarLinhaTabelaItens = () => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabelaItens: [...prev.tabelaItens, novaLinhaTabelaMediacao()]
      };
    });
  };

  const removerLinhaTabelaItens = (linhaId: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      const listaAtualizada = prev.tabelaItens.filter((linha) => linha.id !== linhaId);
      return {
        ...prev,
        tabelaItens: listaAtualizada.length > 0 ? listaAtualizada : [novaLinhaTabelaMediacao()]
      };
    });
  };

  const adicionarLinhaTabelaRecursos = () => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabelaRecursos: [...prev.tabelaRecursos, novaLinhaTabelaRecursosMediacao()]
      };
    });
  };

  const removerLinhaTabelaRecursos = (linhaId: string) => {
    setDocumentoMediacaoForm((prev) => {
      if (!prev) return prev;
      const listaAtualizada = prev.tabelaRecursos.filter((linha) => linha.id !== linhaId);
      return {
        ...prev,
        tabelaRecursos: listaAtualizada.length > 0 ? listaAtualizada : [novaLinhaTabelaRecursosMediacao()]
      };
    });
  };

  const handleGerarDocumentoMediacao = async () => {
    if (!documentoMediacaoForm) return;

    // 1. Verificação mais clara para a embarcação
    if (!documentoMediacaoForm.embarcacao || !documentoMediacaoForm.embarcacao.trim()) {
      toast.error('⚠️ Por favor, preencha o campo "Embarcação" antes de gerar o documento.');
      toast.error('Preencha a embarcação para gerar o documento de medição.');
      return;
    }

    try {
      const obraAtual = (obras || []).find((item: any) => item.id === documentoMediacaoForm.obraId);
      const clienteAtual = listaClientesCRM.find((c: any) => String(c.id) === String(obraAtual?.clienteId));

      console.log("Iniciando geração de PDF de medição...", { documentoMediacaoForm });

      // 2. Chama a função EXTERNA para gerar o PDF (Não tenta desenhar o PDF aqui dentro)
      const resultadoPdf = await handleDownloadMedicaoPDF(
        documentoMediacaoForm,
        clienteAtual,
        obraAtual
      );

      if (!resultadoPdf || typeof resultadoPdf !== 'object') {
        throw new Error('A função de PDF não retornou os dados esperados.');
      }

      const nomeArquivo = String((resultadoPdf as any).nomeArquivo || '').trim();
      const conteudoDataUrl = String((resultadoPdf as any).conteudoDataUrl || '').trim();
      const tamanhoPdf = Number((resultadoPdf as any).tamanho || conteudoDataUrl.length || 0);

      if (!nomeArquivo || !conteudoDataUrl.startsWith('data:application/pdf')) {
        throw new Error('PDF gerado inválido. Tente novamente.');
      }

      // 3. Salvar documento na obra
      if (obraAtual) {
        const documentosAtuais = Array.isArray(obraAtual.documentosNegocio) ? obraAtual.documentosNegocio : [];
        
        const novoDocumento: DocumentoNegocio = {
          id: `doc-mediacao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          nome: nomeArquivo,
          tipo: 'application/pdf',
          tamanho: tamanhoPdf,
          dataUpload: new Date().toISOString(),
          conteudo: conteudoDataUrl
        };

        persistirObraAtualizada({
          ...obraAtual,
          documentosNegocio: [...documentosAtuais, novoDocumento],
          finalizadoComMediacao: true,
          dadosMediacao: documentoMediacaoForm,
          dataFinalizacaoLocal: new Date().toISOString().split('T')[0],
          status: 'Finalizado',
        });
      }

      toast.success('Documento de medição gerado e baixado com sucesso!');
      setShowDocumentoMediacaoModal(false);
      
    } catch (error: any) {
      console.error('Erro ao gerar documento de medição:', error);
      toast.error('❌ Erro ao gerar o PDF: ' + (error.message || 'Verifique o console para mais detalhes.'));
      toast.error('Erro ao gerar o documento de medição.');
    }
  };
  
  const handleVerDocumentoNegocio = (doc: any) => {
    const href = getDocumentHref(doc);
    if (!href) {
      toast.error('Documento indisponível para visualização.');
      return;
    }
    setDocumentoVisualizado({ ...doc, href });
    setShowDocumentoPreviewModal(true);
  };

  const handleDownloadDocumento = (doc: any) => {
    downloadDocument(doc, {
      fallbackName: 'documento',
      onInvalid: () => {
        toast.error('Documento indisponível para download.');
      }
    });
  };

  const handleGerarPropostaPDF = async () => {
    if (!selectedObraDetalhes || !Array.isArray(selectedObraDetalhes.propostas) || selectedObraDetalhes.propostas.length === 0) {
      toast.error('Nenhuma proposta disponivel para este negocio.');
      return;
    }

    const ultimaProposta = selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1];
    const clienteAtual = listaClientesCRM.find((c: any) => String(c.id) === String(selectedObraDetalhes.clienteId));

    try {
      let logoBase64: string | undefined;
      const isLinave = isEmpresaLinave(selectedObraDetalhes.empresaPrestadora);
      const logoUrl = getLogoUrlForEmpresa(selectedObraDetalhes.empresaPrestadora);

      logoBase64 = await getBase64FromUrl(logoUrl);
      const fundoLinaveBase64 = isLinave ? await getBase64FromUrl('/linave-rodape.png') : undefined;

      const resultadoPdf = handleDownloadPropostaPDF(
        ultimaProposta,
        clienteAtual,
        selectedObraDetalhes,
        logoBase64,
        isLinave,
        fundoLinaveBase64,
      );

      if (!resultadoPdf) {
        throw new Error('A funcao de PDF da proposta nao retornou os dados esperados.');
      }

      const documentosAtuais = Array.isArray(selectedObraDetalhes.documentosNegocio)
        ? selectedObraDetalhes.documentosNegocio
        : [];

      const novoDocumento = {
        id: `doc-proposta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nome: resultadoPdf.nomeArquivo,
        tipo: 'application/pdf',
        tamanho: resultadoPdf.tamanho,
        dataUpload: new Date().toISOString(),
        conteudo: resultadoPdf.conteudoDataUrl
      };

      persistirObraAtualizada({
        ...selectedObraDetalhes,
        documentosNegocio: [...documentosAtuais, novoDocumento]
      });

      toast.success('Proposta em PDF gerada e baixada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar proposta:', error);
      toast.error(`Erro ao gerar PDF da proposta${error?.message ? `: ${error.message}` : ''}`);
    }
  };

  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Falha ao ler arquivo ${file.name}`));
    reader.readAsDataURL(file);
  });

  const handleUploadDocumentosNegocio = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const arquivos = Array.from(files);
    const arquivosPermitidos = arquivos.filter((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isCsv = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv');
      return isPdf || isCsv;
    });

    if (arquivosPermitidos.length !== arquivos.length) {
      toast.error('Apenas arquivos PDF e CSV são permitidos.');
    }

    if (arquivosPermitidos.length === 0) return;

    try {
      // Negócio ainda não existe no banco: guardamos o File bruto e só fazemos o
      // upload de verdade depois que o negócio é criado (handleSave), quando temos o id.
      const novosDocumentos: DocumentoNegocio[] = arquivosPermitidos.map((file) => ({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nome: file.name,
        tipo: file.type || (file.name.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/pdf'),
        tamanho: file.size,
        dataUpload: new Date().toISOString(),
        file,
      }));

      setFormData(prev => ({
        ...prev,
        documentosNegocio: [...prev.documentosNegocio, ...novosDocumentos]
      }));
      toast.success(`${novosDocumentos.length} documento(s) anexado(s) ao negócio.`);
    } catch (error) {
      toast.error('Não foi possível anexar os documentos. Tente novamente.');
    }
  };

  const handleRemoverDocumentoNegocio = (docId: string) => {
    setFormData(prev => ({
      ...prev,
      documentosNegocio: prev.documentosNegocio.filter(doc => doc.id !== docId)
    }));
  };

  // ==========================================================
  // BLOCO "IMPORTAR NEGÓCIO JÁ FECHADO" (toggle "Deseja ir direto para OS?")
  // Preenche, no próprio Novo Negócio, os dados de Orçamento/Proposta de um
  // negócio fechado fora do sistema, pra cair direto na criação da OS já
  // consolidada — ver handleSave para a sequência de criação no backend.
  // ==========================================================

  const handleSelecionarArquivoImportarOs = (tipo: 'orcamento' | 'proposta', file: File | null) => {
    const documento: DocumentoNegocio | null = file ? {
      id: `doc-importar-${tipo}-${Date.now()}`,
      nome: file.name,
      tipo: file.type || 'application/octet-stream',
      tamanho: file.size,
      dataUpload: new Date().toISOString(),
      file,
    } : null;
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        [tipo === 'orcamento' ? 'orcamentoArquivo' : 'propostaArquivo']: documento,
      },
    }));
  };

  // --- A - Escopo Básico de Serviços (mesmo padrão de PropostaView.tsx) ---
  const criarLinhaEscopoImportarOs = (colunas: string[]): ImportarEscopoLinha => ({
    id: `linha-importar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    valores: colunas.reduce((acc, coluna) => ({ ...acc, [coluna]: '' }), {} as Record<string, string>),
  });

  const adicionarServicoImportarOs = () => {
    const colunasPadrao = ['Descrição'];
    const novo: ImportarEscopoServico = {
      id: `escopo-importar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: `${formData.importarOs.escopoServicos.length + 1}. Novo Serviço`,
      descricaoServico: '',
      colunas: colunasPadrao,
      linhas: [criarLinhaEscopoImportarOs(colunasPadrao)],
      textosDepois: [],
    };
    setFormData(prev => ({
      ...prev,
      importarOs: { ...prev.importarOs, escopoServicos: [...prev.importarOs.escopoServicos, novo] },
    }));
  };

  const removerServicoImportarOs = (escopoId: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: { ...prev.importarOs, escopoServicos: prev.importarOs.escopoServicos.filter(e => e.id !== escopoId) },
    }));
  };

  const atualizarTituloServicoImportarOs = (escopoId: string, titulo: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(e => e.id === escopoId ? { ...e, titulo } : e),
      },
    }));
  };

  const atualizarDescricaoServicoImportarOs = (escopoId: string, descricaoServico: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(e => e.id === escopoId ? { ...e, descricaoServico } : e),
      },
    }));
  };

  const adicionarColunaServicoImportarOs = (escopoId: string, nomeColuna: string) => {
    const nome = nomeColuna.trim();
    if (!nome) return;
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(escopo => {
          if (escopo.id !== escopoId) return escopo;
          if (escopo.colunas.some(c => c.toLowerCase() === nome.toLowerCase())) return escopo;
          return {
            ...escopo,
            colunas: [...escopo.colunas, nome],
            linhas: escopo.linhas.map(linha => ({ ...linha, valores: { ...linha.valores, [nome]: '' } })),
          };
        }),
      },
    }));
  };

  const removerColunaServicoImportarOs = (escopoId: string, coluna: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(escopo => {
          if (escopo.id !== escopoId) return escopo;
          const novosValores = (linha: ImportarEscopoLinha) => {
            const v = { ...linha.valores };
            delete v[coluna];
            return v;
          };
          return {
            ...escopo,
            colunas: escopo.colunas.filter(c => c !== coluna),
            linhas: escopo.linhas.map(linha => ({ ...linha, valores: novosValores(linha) })),
          };
        }),
      },
    }));
  };

  const adicionarItemServicoImportarOs = (escopoId: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(escopo =>
          escopo.id === escopoId
            ? { ...escopo, linhas: [...escopo.linhas, criarLinhaEscopoImportarOs(escopo.colunas)] }
            : escopo
        ),
      },
    }));
  };

  const removerItemServicoImportarOs = (escopoId: string, linhaId: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(escopo =>
          escopo.id === escopoId
            ? { ...escopo, linhas: escopo.linhas.filter(l => l.id !== linhaId) }
            : escopo
        ),
      },
    }));
  };

  const atualizarCelulaServicoImportarOs = (escopoId: string, linhaId: string, coluna: string, valor: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(escopo => {
          if (escopo.id !== escopoId) return escopo;
          return {
            ...escopo,
            linhas: escopo.linhas.map(l => l.id === linhaId ? { ...l, valores: { ...l.valores, [coluna]: valor } } : l),
          };
        }),
      },
    }));
  };

  const adicionarTextoServicoImportarOs = (escopoId: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(e =>
          e.id === escopoId ? { ...e, textosDepois: [...e.textosDepois, ''] } : e
        ),
      },
    }));
  };

  const atualizarTextoServicoImportarOs = (escopoId: string, index: number, valor: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(e => {
          if (e.id !== escopoId) return e;
          const arr = [...e.textosDepois];
          arr[index] = valor;
          return { ...e, textosDepois: arr };
        }),
      },
    }));
  };

  const removerTextoServicoImportarOs = (escopoId: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        escopoServicos: prev.importarOs.escopoServicos.map(e => {
          if (e.id !== escopoId) return e;
          const arr = [...e.textosDepois];
          arr.splice(index, 1);
          return { ...e, textosDepois: arr };
        }),
      },
    }));
  };

  // --- B - Preço (mesmo cálculo de PropostaView.tsx: quantidade × valorUnitario × dias) ---
  const totalItemPrecoImportarOs = (it: Partial<ImportarPrecoItem>) =>
    (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0) * (Number(it.dias) || 0);

  const adicionarItemPrecoImportarOs = () => {
    const novo: ImportarPrecoItem = {
      id: `preco-importar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      descricao: '',
      quantidade: 1,
      unidade: 'serv.',
      valorUnitario: 0,
      dias: 1,
      total: 0,
    };
    setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, precoItens: [...prev.importarOs.precoItens, novo] } }));
  };

  const removerItemPrecoImportarOs = (id: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: { ...prev.importarOs, precoItens: prev.importarOs.precoItens.filter(it => it.id !== id) },
    }));
  };

  const atualizarItemPrecoImportarOs = (id: string, campo: 'descricao' | 'quantidade' | 'unidade' | 'valorUnitario' | 'dias', valor: string) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        precoItens: prev.importarOs.precoItens.map(it => {
          if (it.id !== id) return it;
          const atualizado = { ...it } as ImportarPrecoItem;
          if (campo === 'descricao' || campo === 'unidade') {
            (atualizado as any)[campo] = valor;
          } else {
            const limpo = valor.replace(/[^0-9.,]/g, '').replace(',', '.');
            (atualizado as any)[campo] = parseFloat(limpo) || 0;
          }
          atualizado.total = totalItemPrecoImportarOs(atualizado);
          return atualizado;
        }),
      },
    }));
  };

  // --- Consumíveis e Materiais / Serviços Terceirizados (mesmo cálculo de OrcamentosView.tsx) ---
  const recalcularMaterialImportarOs = (item: ImportarMaterial): ImportarMaterial => {
    const total = (parseFloat(item.quantidade) || 0) * (parseFloat(item.pesoFator) || 0) * (parseFloat(item.custoUnit) || 0);
    return { ...item, valorTotal: total.toFixed(2) };
  };

  const recalcularTerceirizadoImportarOs = (item: ImportarTerceirizado): ImportarTerceirizado => {
    const pesoFator = (parseFloat(item.pesoFator) || 0) <= 0 ? 1 : parseFloat(item.pesoFator);
    const total = (parseFloat(item.quantidade) || 0) * pesoFator * (parseFloat(item.custoUnit) || 0);
    return { ...item, valorTotal: total.toFixed(2) };
  };

  const adicionarMaterialImportarOs = () => {
    const novo: ImportarMaterial = { id: `material-importar-${Date.now()}`, descricao: '', unidade: '', quantidade: '', pesoFator: '', custoUnit: '', valorTotal: '0.00', origemTerceiros: 'Nao', observacao: '' };
    setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, materiais: [...prev.importarOs.materiais, novo] } }));
  };

  const removerMaterialImportarOs = (id: string) => {
    setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, materiais: prev.importarOs.materiais.filter(i => i.id !== id) } }));
  };

  const atualizarMaterialImportarOs = (id: string, changes: Partial<ImportarMaterial>) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        materiais: prev.importarOs.materiais.map(item => item.id === id ? recalcularMaterialImportarOs({ ...item, ...changes }) : item),
      },
    }));
  };

  const adicionarTerceirizadoImportarOs = () => {
    const novo: ImportarTerceirizado = { id: `terceirizado-importar-${Date.now()}`, descricao: '', unidade: '', quantidade: '', pesoFator: '1', custoUnit: '', valorTotal: '0.00', observacao: '' };
    setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, terceirizados: [...prev.importarOs.terceirizados, novo] } }));
  };

  const removerTerceirizadoImportarOs = (id: string) => {
    setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, terceirizados: prev.importarOs.terceirizados.filter(i => i.id !== id) } }));
  };

  const atualizarTerceirizadoImportarOs = (id: string, changes: Partial<ImportarTerceirizado>) => {
    setFormData(prev => ({
      ...prev,
      importarOs: {
        ...prev.importarOs,
        terceirizados: prev.importarOs.terceirizados.map(item => item.id === id ? recalcularTerceirizadoImportarOs({ ...item, ...changes }) : item),
      },
    }));
  };

  const normalizarOrcamentosDaObra = (obra: any) => {
    const orcamentos = obra?.orcamentos || [];
    if (orcamentos.length > 0) {
      return orcamentos.map((orcamento: any) => ({
        ...orcamento,
        versao: formatarVersaoOrcamento(orcamento?.versao),
        status: orcamento?.status || 'pendente'
      }));
    }

    if (obra?.orcamentoRealizado && obra?.orcamentoData && obra?.orcamentoValores) {
      return [{
        versao: '',
        dataCriacao: obra.dataCadastro,
        status: 'pendente',
        numeroOrcamento: obra.orcamentoData.numeroOrcamento,
        data: obra.orcamentoData,
        valores: obra.orcamentoValores
      }];
    }

    return [];
  };

  // Devolve true/false pro chamador saber se a gravação no backend realmente aconteceu —
  // sem isso, um erro aqui (ex.: campo obrigatório faltando) fica só no toast desta função,
  // e quem chamou segue achando que deu certo e mostra "sucesso" + fecha a tela mesmo assim.
  const persistirObraAtualizada = async (obraAtualizada: any, moverParaTopo = false, payloadUpdate: Record<string, any> | null = null): Promise<boolean> => {
    try {
      // 1. Monta o payload para o Django
      const payloadParaBackend = payloadUpdate || {
        categoria: obraAtualizada.categoria,
        status: obraAtualizada.status,
      };

      // 2. Chama a API do Django passando a Chave Primária (negocioBackendId)
      if (obraAtualizada.negocioBackendId) {
        await atualizarNegocio(obraAtualizada.negocioBackendId, payloadParaBackend);
      }

      // 3. Atualiza a tela localmente
      setNegociosBackend(prev => {
      const listaAtualizada = prev.map(o =>
        o.id === obraAtualizada.id ? obraAtualizada : o
      );
      if (!moverParaTopo) return listaAtualizada;
      return [
        obraAtualizada,
        ...listaAtualizada.filter(o => o.id !== obraAtualizada.id)
      ];
    });

      //  Sincroniza qualquer edição/movimentação com as outras telas
      saveEntity('obras', (obras || []).map((o: any) => o.id === obraAtualizada.id ? obraAtualizada : o));

      if (selectedObraDetalhes?.id === obraAtualizada.id) setSelectedObraDetalhes(obraAtualizada);
      if (editingObra?.id === obraAtualizada.id) setEditingObra(obraAtualizada);
      if (selectedObraArquivos?.id === obraAtualizada.id) setSelectedObraArquivos(obraAtualizada);

      return true;
    } catch (error) {
      console.error('Erro ao atualizar no banco de dados:', error);
      toast.error('Erro ao salvar alteração no banco de dados.');
      return false;
    }
  };
  
  const criarReorcamentoPorAlteracaoArquivos = (obra: any) => {
  const hoje = new Date().toISOString().split('T')[0];
  const orcamentos = normalizarOrcamentosDaObra(obra);
  
  if (orcamentos.length === 0) {
    return {
      ...obra,
      orcamentoRealizado: false,
      requerReorcamento: true,
      categoria: 'Planejamento' as CategoriaObra,
      status: 'Aguardando orçamento'
    };
  }
  
  const ultimoOrcamento = orcamentos[orcamentos.length - 1];
  const jaTemReorcamentoPendente = ultimoOrcamento?.status === 'pendente_reorcamento';
  
  if (jaTemReorcamentoPendente) {
    return {
      ...obra,
      orcamentos,
      orcamentoRealizado: false,
      requerReorcamento: true,
      categoria: 'Planejamento' as CategoriaObra,
      status: 'Aguardando orçamento'
    };
  }
  
  const orcamentosRecusados = orcamentos.map((orcamento: any, idx: number, lista: any[]) => (
    idx === lista.length - 1
      ? { ...orcamento, status: 'recusado' as const, dataRecusa: hoje, motivoRecusa: 'Alteração de arquivos' }
      : orcamento
  ));
  
  const maiorIndiceVersao = orcamentosRecusados.reduce((maior: number, orcamento: any) => {
    const indice = versaoAlfabeticaToIndex(formatarVersaoOrcamento(orcamento?.versao));
    return Math.max(maior, indice);
  }, -1);
  
  const novaVersao = indexToVersaoAlfabetica(maiorIndiceVersao + 1);
  const prefixo = getPrefixoEmpresa(obra.empresaPrestadora);
  
  const novoOrcamentoPendente = {
    versao: novaVersao,
    dataCriacao: hoje,
    status: 'pendente_reorcamento' as const,
    numeroOrcamento: `${prefixo}-${new Date().getFullYear()}-${novaVersao}`,
    data: ultimoOrcamento?.data || {},
    valores: ultimoOrcamento?.valores || {
      totalMaoDeObra: 0,
      totalMateriais: 0,
      totalTerceirizados: 0,
      totalBruto: 0,
      totalSemImposto: 0,
      subtotal: 0,
      margem: 0,
      oh: 0,
      impostos: 0,
      valorMargem: 0,
      valorOH: 0,
      valorImpostos: 0,
      precoFinal: 0
    },
    origemRevisao: 'alteracao_arquivos'
  };
  
  return {
    ...obra,
    orcamentos: [...orcamentosRecusados, novoOrcamentoPendente],
    orcamentoRealizado: false,
    requerReorcamento: true,
    categoria: 'Planejamento' as CategoriaObra,
    status: 'Aguardando orçamento'
  };
};

  const aplicarAlteracaoDocumentosNoNegocio = async (
    obra: any,
    documentosAtualizados: DocumentoNegocio[],
    documentosArquivadosNovos: any[] = []
  ) => {
    const historicoAtual = Array.isArray(obra.documentosNegocioArquivados) ? obra.documentosNegocioArquivados : [];
    const obraComDocumentos = {
      ...obra,
      documentosNegocio: documentosAtualizados,
      documentosNegocioArquivados: [...historicoAtual, ...documentosArquivadosNovos]
    };

    const possuiOrcamento = normalizarOrcamentosDaObra(obraComDocumentos).length > 0;
    if (!possuiOrcamento) {
      if (!(await persistirObraAtualizada(obraComDocumentos))) return;
      toast.success('Arquivos atualizados com sucesso.');
      return;
    }

    const fazerNovoOrcamento = await confirmDialog('Fazer novo orçamento?');
    if (!fazerNovoOrcamento) {
      if (!(await persistirObraAtualizada(obraComDocumentos))) return;
      toast.success('Arquivos atualizados sem alterar orçamento.');
      return;
    }

    const obraReorcamento = criarReorcamentoPorAlteracaoArquivos(obraComDocumentos);
    if (!(await persistirObraAtualizada(obraReorcamento, true))) return;
    toast.success('Arquivos alterados. Negócio voltou para aguardando orçamento.');
  };

  const handleUploadDocumentoClienteAssinado = async (obra: any, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const arquivo = Array.from(files)[0];
    const isPdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
    const isImagem = arquivo.type === 'image/png' || arquivo.type === 'image/jpeg'
      || arquivo.name.toLowerCase().endsWith('.png')
      || arquivo.name.toLowerCase().endsWith('.jpg')
      || arquivo.name.toLowerCase().endsWith('.jpeg');

    if (!isPdf && !isImagem) {
      toast.error('Apenas arquivos PDF, PNG ou JPG são permitidos.');
      return;
    }

    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    const negocioId = obraAtual.negocioBackendId;
    if (!negocioId) {
      toast.error('Negócio sem identificador no banco — não foi possível anexar.');
      return;
    }

    try {
      // Substitui o anterior (slot único): remove o documento assinado antigo do banco.
      const anterior = obraAtual.documentoClienteAssinado;
      if (anterior?.backendId) {
        try { await excluirDocumento(anterior.backendId); } catch { /* segue mesmo se falhar */ }
      }

      const documentoClienteAssinado = await uploadDocumento(arquivo, {
        vinculoTipo: 'negocio',
        vinculoId: negocioId,
        categoria: 'cliente_assinado',
      });

      const salvo = await persistirObraAtualizada({
        ...obraAtual,
        documentoClienteAssinado
      });
      if (!salvo) return;

      toast.success('Documento assinado do cliente anexado e salvo no banco.');
    } catch (error) {
      toast.error('Não foi possível anexar o documento do cliente.');
    }
  };

  const handleRemoverDocumentoClienteAssinado = async (obra: any) => {
    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    if (!obraAtual.documentoClienteAssinado) return;

    const backendId = obraAtual.documentoClienteAssinado.backendId;
    if (backendId) {
      try { await excluirDocumento(backendId); } catch { /* prossegue mesmo se falhar */ }
    }

    const salvo = await persistirObraAtualizada({
      ...obraAtual,
      documentoClienteAssinado: null
    });
    if (!salvo) return;

    toast.success('Documento assinado do cliente removido.');
  };

  const handleAdicionarArquivosNoCard = async (obra: any, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    const arquivos = Array.from(files);
    const arquivosPermitidos = arquivos.filter((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isCsv = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv');
      return isPdf || isCsv;
    });

    if (arquivosPermitidos.length !== arquivos.length) {
      toast.error('Apenas arquivos PDF e CSV são permitidos.');
    }

    if (arquivosPermitidos.length === 0) return;

    const negocioId = obraAtual.negocioBackendId;
    if (!negocioId) {
      toast.error('Negócio sem identificador no banco — não foi possível anexar.');
      return;
    }

    try {
      const resultados = await Promise.allSettled(
        arquivosPermitidos.map((file) =>
          uploadDocumento(file, { vinculoTipo: 'negocio', vinculoId: negocioId, categoria: 'negocio' })
        )
      );
      const novosDocumentos = resultados
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value);
      const falhas = resultados.length - novosDocumentos.length;
      if (falhas > 0) toast.error(`${falhas} documento(s) não puderam ser enviados.`);
      if (novosDocumentos.length === 0) return;

      const documentosAtuais = Array.isArray(obraAtual.documentosNegocio) ? obraAtual.documentosNegocio : [];
      await aplicarAlteracaoDocumentosNoNegocio(obraAtual, [...documentosAtuais, ...novosDocumentos]);
      toast.success(`${novosDocumentos.length} documento(s) anexado(s) e salvo(s) no banco.`);
    } catch (error) {
      toast.error('Não foi possível anexar os documentos.');
    }
  };

  const handleRemoverArquivoNoCard = async (obra: any, docId: string) => {
    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    const documentosAtuais = Array.isArray(obraAtual.documentosNegocio) ? obraAtual.documentosNegocio : [];
    const documentosAtualizados = documentosAtuais.filter((doc: DocumentoNegocio) => doc.id !== docId);
    const documentosRemovidos = documentosAtuais.filter((doc: DocumentoNegocio) => doc.id === docId);
    const documentosArquivados = documentosRemovidos.map((doc: DocumentoNegocio) => ({
      ...doc,
      statusArquivo: 'arquivado',
      motivoArquivo: 'removido_do_negocio',
      dataArquivamento: new Date().toISOString()
    }));

    if (documentosAtualizados.length === documentosAtuais.length) return;
    await aplicarAlteracaoDocumentosNoNegocio(obraAtual, documentosAtualizados, documentosArquivados);
  };

  const handleOpenArquivosModal = (obra: any) => {
    const obraAtual = (obras || []).find((o: any) => o.id === obra.id) || obra;
    setSelectedObraArquivos(obraAtual);
    setShowArquivosModal(true);
  };

  const handleSave = async () => {
    const incluiServico = temServico(formData.modalidade);
    const incluiLocacao = temLocacao(formData.modalidade);

    if (!formData.empresaPrestadora) {
      return toast.error('Selecione a Empresa Prestadora.');
    }
    if (!formData.nomeNegocio.trim() || !formData.clienteId || !formData.solicitante) {
      return toast.error("Nome do Negócio, Cliente e Solicitante são obrigatórios.");
    }

    // Nº do Negócio: usa a sugestão se o usuário não mexeu no campo. Precisa seguir o
    // padrão PREFIXO-NÚMERO/ANO e não pode colidir com um negócio que já existe — os dois
    // checados aqui, antes de gastar uma chamada ao backend (que também valida a duplicidade
    // como rede de segurança, ver validate_numero_customizado no serializer).
    const numeroNegocioFinal = (formData.numeroNegocio || numeroNegocioSugerido).trim();
    if (!numeroNegocioFinal) {
      return toast.error('Informe o número do negócio.');
    }
    if (!/^[A-Za-z]+-\d+\/\d{2,4}$/.test(numeroNegocioFinal)) {
      return toast.error('Número do negócio fora do padrão. Use PREFIXO-NÚMERO/ANO (ex.: LN-0009/26).');
    }
    const numeroJaExiste = (Array.isArray(obras) ? obras : []).some(
      (o: any) => String(o.id || '').trim().toUpperCase() === numeroNegocioFinal.toUpperCase(),
    );
    if (numeroJaExiste) {
      return toast.error(`Já existe um negócio com o número "${numeroNegocioFinal}". Escolha outro número.`);
    }

    if (incluiServico && (formData.servicos.length === 0 || !formData.servicos.some(s => s.descricao.trim()))) {
      return toast.error("Adicione pelo menos um serviço com descrição na aba Serviços.");
    }

    if (incluiLocacao && !(formData.itensAlocacao || []).some(it => it.equipamento.trim())) {
      return toast.error("Adicione pelo menos um item de equipamento na aba Alocação.");
    }

    // "Deseja ir direto para OS?" — exige que o bloco de importação (Escopo A) tenha
    // pelo menos um serviço com algo preenchido, senão criaríamos uma proposta vazia.
    if (formData.desejaIrDiretoParaOs) {
      const temServicoPreenchido = formData.importarOs.escopoServicos.some(escopo =>
        escopo.descricaoServico.trim() || escopo.linhas.some(linha => Object.values(linha.valores).some(v => v.trim()))
      );
      if (!temServicoPreenchido) {
        return toast.error('Preencha pelo menos um serviço no "A - Escopo Básico de Serviços" antes de criar o negócio direto para OS.');
      }
    }

    // "Deseja ir direto para OS?" — confirma a intenção antes de criar o negócio. Se o
    // usuário recuar aqui, o negócio ainda é criado normalmente, só sem o redirecionamento
    // e sem o orçamento/proposta serem gerados a partir do bloco de importação.
    let navegarParaOsAoConcluir = formData.desejaIrDiretoParaOs;
    if (navegarParaOsAoConcluir) {
      navegarParaOsAoConcluir = await confirmDialog({
        title: 'Deseja ir direto para OS?',
        message: 'Ao confirmar, o orçamento e a proposta informados abaixo serão criados automaticamente e, assim que o negócio for salvo, você será levado direto para a criação da Ordem de Serviço já pré-preenchida.',
        confirmText: 'Sim, ir para OS',
      });
    }

    // 1. Mapeamento para o formato exato que o NegocioSerializer (Django) exige
    // Não enviamos o 'id', deixamos o MySQL gerar o ID numérico (AUTO_INCREMENT)
   const incluiServicoPayload = temServico(formData.modalidade);
   const incluiLocacaoPayload = temLocacao(formData.modalidade);
   const servicosPayload = incluiServicoPayload
     ? formData.servicos.filter(s => s.descricao.trim() || s.tipo.trim())
     : [];
   const itensAlocacaoPayload = incluiLocacaoPayload
     ? (formData.itensAlocacao || [])
         .filter(it => it.equipamento.trim())
         .map(it => ({
           equipamento: it.equipamento.trim(),
           estoque_ref: it.estoqueRef || it.equipamento.trim(),
           unidade: it.unidade || 'un',
           quantidade: parseFloat(String(it.quantidade).replace(',', '.')) || 0,
           observacao: it.observacao || '',
         }))
     : [];

   const payloadDjango = {
      nome_negocio: formData.nomeNegocio.trim(),
      numero_customizado: numeroNegocioFinal,
      cliente: parseInt(formData.clienteId, 10),
      empresa_prestadora: formData.empresaPrestadora,
      categoria: 'Planejamento',
      status: 'Aguardando orçamento', //  FORÇA O STATUS INICIAL PARA A TELA DE ORÇAMENTOS
      modalidade: formData.modalidade,
      solicitante: formData.solicitante,

      cargo: formData.cargo,
      telefone: formData.telefone,
      email: formData.email,
      data_solicitacao: formData.dataSolicitacao || null,

      //  ADICIONADO: O campo exato que o Django exigiu!
      // Usamos o tipo do primeiro serviço; em locação pura, rotulamos como "Locação".
      tipo_servico: servicosPayload.length > 0
        ? servicosPayload[0].tipo
        : (incluiLocacaoPayload ? 'Locação' : 'Não informado'),

      servicos: servicosPayload.map(s => ({
        tipo_servico: s.tipo, //  Alterado aqui também por segurança
        tipo: s.tipo,         // Mantido caso o seu backend use ambos
        embarcacao: s.embarcacao || '',
        local_execucao: s.localExecucao || '',
        porto: s.porto || '',
        descricao: s.descricao,
        observacoes: s.observacoes || ''
      })),

      itens_alocacao: itensAlocacaoPayload,

      // Identidade de quem criou o negócio (usuário interno logado) — separada de
      // `solicitante`/`email`/`telefone` acima, que são o CONTATO DO CLIENTE preenchido
      // à mão no formulário. Só usada pelo sino de notificações pra avisar quem criou
      // quando o negócio muda de categoria.
      criado_por_nome: userSession?.nome || '',
      criado_por_cpf: userSession?.cpf || '',
      criado_por_email: userSession?.email || '',
    };

    try {
          // 2. Dispara a requisição HTTP POST para a API do Django
          const respostaBackend = await criarNegocio(payloadDjango);

          // BLINDAGEM: O Django pode devolver o objeto de duas formas. Isso garante que o React não quebre lendo 'undefined'
          const dadosNegocio = respostaBackend.negocio || respostaBackend;
          const dadosServicos = respostaBackend.servicos || servicosPayload;

          // Itens de alocação em camelCase para o restante do funil (Orçamento/Proposta/OS/Medição).
          const itensAlocacaoFormatados = Array.isArray(dadosNegocio.itens_alocacao)
            ? dadosNegocio.itens_alocacao.map((it: any) => ({
                id: String(it.id ?? `aloc-${Math.random().toString(36).slice(2, 8)}`),
                equipamento: it.equipamento || '',
                estoqueRef: it.estoque_ref || '',
                unidade: it.unidade || 'un',
                quantidade: Number(it.quantidade) || 0,
                observacao: it.observacao || '',
                valorIndenizacao: Number(it.valor_indenizacao) || 0,
                valorLocacao: Number(it.valor_locacao) || 0,
                valorTotal: Number(it.valor_total) || 0,
              }))
            : itensAlocacaoPayload.map((it, i) => ({
                id: `aloc-${Date.now()}-${i}`,
                equipamento: it.equipamento,
                estoqueRef: it.estoque_ref,
                unidade: it.unidade,
                quantidade: it.quantidade,
                observacao: it.observacao,
                valorIndenizacao: 0,
                valorLocacao: 0,
                valorTotal: 0,
              }));

          // Agora que o negócio existe no banco, sobe os documentos anexados no form
          // (guardados como File) para a tabela Documento, vinculados ao id do negócio.
          let documentosPersistidos: any[] = [];
          if (dadosNegocio.id) {
            const arquivosParaSubir = formData.documentosNegocio.filter((d) => d.file instanceof File);
            const resultados = await Promise.allSettled(
              arquivosParaSubir.map((d) =>
                uploadDocumento(d.file as File, {
                  vinculoTipo: 'negocio',
                  vinculoId: dadosNegocio.id,
                  categoria: 'negocio',
                })
              )
            );
            documentosPersistidos = resultados
              .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
              .map((r) => r.value);
            const falhas = resultados.length - documentosPersistidos.length;
            if (falhas > 0) toast.error(`${falhas} documento(s) não puderam ser enviados.`);
          }

          // "Deseja ir direto para OS?" confirmado — cria, na sequência, o orçamento
          // (finalizado) e a proposta (já aceita) a partir do bloco de importação, marca
          // o negócio como "Em Andamento" (mesmo efeito que a aprovação manual do cliente
          // provocaria) e busca o negócio hidratado pra alimentar a tela de OS já
          // pré-preenchida. Se algo falhar aqui, o negócio já criado continua existindo
          // normalmente — só não navegamos automaticamente para a OS.
          let obraHidratadaParaOs: any = null;
          if (navegarParaOsAoConcluir && dadosNegocio.id) {
            try {
              const negocioIdNum = Number(dadosNegocio.id);
              const clienteIdNum = Number(dadosNegocio.cliente || formData.clienteId);

              if (formData.importarOs.orcamentoArquivo?.file) {
                await uploadDocumento(formData.importarOs.orcamentoArquivo.file, {
                  vinculoTipo: 'negocio',
                  vinculoId: dadosNegocio.id,
                  categoria: 'orcamento_importado',
                });
              }
              if (formData.importarOs.propostaArquivo?.file) {
                await uploadDocumento(formData.importarOs.propostaArquivo.file, {
                  vinculoTipo: 'negocio',
                  vinculoId: dadosNegocio.id,
                  categoria: 'proposta_importada',
                });
              }

              const orcamentoPayload = buildOrcamentoPayload(
                {
                  margem: 0,
                  oh: 0,
                  impostos: 0,
                  impostosLocacao: 0,
                  quantidadeItensProduzidos: 1,
                  atividadesMacro: [],
                  maoDeObra: [],
                  materiais: formData.importarOs.materiais,
                  terceirizados: formData.importarOs.terceirizados,
                  atividades: [],
                  itensAlocacao: [],
                  observacoes: '',
                },
                null,
                negocioIdNum,
                clienteIdNum,
              );
              await createOrcamento({
                ...orcamentoPayload,
                finalizar: true,
                numeroOrcamento: formData.importarOs.orcamentoNumero,
                versao: formData.importarOs.orcamentoVersao,
              });

              const totalPropostaImportada = formData.importarOs.precoItens.reduce((s, it) => s + (Number(it.total) || 0), 0);
              await criarProposta({
                cliente: clienteIdNum,
                negocio: negocioIdNum,
                numeroProposta: formData.importarOs.propostaNumero || numeroNegocioFinal,
                status: 'aceita',
                referencias: '',
                saudacao: '',
                assunto: '',
                textoAbertura: '',
                responsabilidadeContratada: '',
                responsabilidadeContratante: '',
                preco: totalPropostaImportada,
                condicoesGerais: '',
                condicoesPagamento: '',
                prazo: '',
                efetivoPrevisto: '',
                encerramento: '',
                escopoBasicoServicos: formData.importarOs.escopoServicos,
                precoItens: formData.importarOs.precoItens,
                precoColunasOcultas: [],
              });

              // Mesmo efeito colateral que a aprovação manual do cliente causaria
              // (ver PropostaView.tsx) — sem isso o negócio ficaria com orçamento/proposta
              // prontos mas preso em "Planejamento" e não apareceria pronto em "Fazer OS".
              await atualizarNegocio(dadosNegocio.id, { categoria: 'Em Andamento', status: 'Em andamento' });

              // Busca o negócio já hidratado com orçamento/proposta reais (a cópia local
              // criada logo abaixo, em negocioFormatado, não tem esses dados ainda).
              const negocioFresco = await getNegocioPorId(dadosNegocio.id);
              if (negocioFresco) {
                obraHidratadaParaOs = mapNegocioToObra(negocioFresco, {});
              }
            } catch (errImportacao: any) {
              console.error('Erro ao importar orçamento/proposta do negócio:', errImportacao);
              toast.error('O negócio foi criado, mas não foi possível gerar o orçamento/proposta automaticamente. Complete-os manualmente em Orçar Negócios e Fazer Proposta.');
              obraHidratadaParaOs = null;
            }
          }

          // 3. Monta o objeto de forma totalmente segura ANTES de fechar a tela
          const negocioFormatado = {
            id: dadosNegocio.numero_customizado || numeroNegocioFinal
              || `${getPrefixoEmpresa(dadosNegocio.empresa_prestadora || formData.empresaPrestadora)}-${formatarNumeroSequencial(dadosNegocio.id || Date.now())}/${String(new Date().getFullYear()).slice(-2)}`,
            numeroCustomizado: dadosNegocio.numero_customizado || numeroNegocioFinal || undefined,
            nome: dadosNegocio.nome_negocio || formData.nomeNegocio,
            clienteId: String(dadosNegocio.cliente || formData.clienteId), 
            nomeClienteResolvido: listaClientesCRM.find((c: any) => String(c.id) === String(dadosNegocio.cliente || formData.clienteId))?.razaoSocial || 'Cliente Identificado',
            empresaPrestadora: dadosNegocio.empresa_prestadora || formData.empresaPrestadora,
            categoria: dadosNegocio.categoria || 'Planejamento',
            status: 'Aguardando orçamento', 
            requerReorcamento: true,        
            orcamentoRealizado: false,      
            solicitante: dadosNegocio.solicitante || formData.solicitante,
            modalidade: dadosNegocio.modalidade || formData.modalidade,
            servicos: dadosServicos || [],
            itensAlocacao: itensAlocacaoFormatados,
            negocioBackendId: dadosNegocio.id || Date.now(),
            versaoNegocio: 'A',
            tipo: dadosNegocio.tipo_servico || (dadosServicos?.[0]?.tipo) || '',
            responsavelTecnico: dadosNegocio.solicitante || formData.solicitante || '',
            dataSolicitacao: dadosNegocio.data_solicitacao || formData.dataSolicitacao || new Date().toISOString().split('T')[0],
            orcamentos: [],
            propostas: [],
            documentosNegocio: documentosPersistidos
          };

          toast.success(`${formData.servicos.length} Serviço(s) criado(s) com sucesso no Banco de Dados!`);
          
          setShowFormNovoNegocio(false);
          setNovoNegocioTab('dados');
          setFormData(initialForm);

          // Atualiza o Kanban imediatamente
          setNegociosBackend(prev => [...prev, negocioFormatado]);

          // Atualiza a memória global para a tela de Orçamentos enxergar! Quando o
          // orçamento/proposta foram importados com sucesso (obraHidratadaParaOs), usa a
          // versão já hidratada do backend no lugar da versão "crua" — é ela que a tela de
          // OS precisa pra pré-preencher o formulário corretamente.
          saveEntity('obras', [...(obras || []), obraHidratadaParaOs || negocioFormatado]);

          // "Deseja ir direto para OS?" confirmado E o orçamento/proposta foram criados
          // com sucesso — pula o quadro do CRM e vai direto pra tela de criação de OS já
          // mirando no negócio recém-importado (mesmo padrão de navegação cross-módulo já
          // usado nesta tela para "orcamentos" e "clientes", agora carregando o obraId).
          if (navegarParaOsAoConcluir && obraHidratadaParaOs) {
            window.dispatchEvent(new CustomEvent('mudarTelaERP', { detail: { section: 'fazerOs', obraId: obraHidratadaParaOs.id } }));
          }

        } catch (error: any) {
      console.error('Erro detalhado do Backend:', error);
      const dadosErro = error?.response?.data;
      const mensagemNumero = Array.isArray(dadosErro?.numero_customizado) ? dadosErro.numero_customizado[0] : undefined;
      const mensagemEspecifica = mensagemNumero
        || (typeof dadosErro === 'string' ? dadosErro : undefined)
        || (typeof dadosErro?.detail === 'string' ? dadosErro.detail : undefined);
      toast.error(mensagemEspecifica || 'Erro ao salvar novo serviço! Verifique os dados e tente novamente.');
    }
  };

  const handleShowDetalhes = (obra: any) => {
    console.log('handleShowDetalhes called for obra:', obra?.id || obra?.nome || obra);
    setSelectedObraDetalhes(obra);
    setShowDetalhesObraModal(true);
    // Deixar o resumo financeiro sempre fechado quando abrir detalhes
    setExpandedOrcamentoSummary(false);
  };

  const handleEditObra = (obra: any) => {
    setEditingObra(obra);
    setShowEditModal(true);
  };

  const handleSaveEditObra = async () => {
    if (!editingObra) return;

    const nomeNegocio = String(editingObra.nome || '').trim();
    const empresaPrestadora = String(editingObra.empresaPrestadora || '').trim();
    const solicitante = String(editingObra.solicitante || '').trim();
    const email = String(editingObra.email || '').trim() || 'comercial@linave.com.br';

    if (!nomeNegocio || !empresaPrestadora || !solicitante) {
      return toast.error('Nome do Negócio, Empresa Prestadora e Solicitante são obrigatórios.');
    }

    const payloadUpdate = {
      nome_negocio: nomeNegocio,
      empresa_prestadora: empresaPrestadora,
      solicitante,
      cargo: String(editingObra.cargo || '').trim() || null,
      telefone: String(editingObra.telefone || '').trim() || null,
      email,
      tipo_servico: String(editingObra.tipo || editingObra.tipo_servico || '').trim() || null,
    };

    // Chama a função da API e só fecha o modal se a gravação realmente aconteceu — antes disso
    // o toast de sucesso e o fechamento aconteciam mesmo quando o backend rejeitava a alteração.
    const salvo = await persistirObraAtualizada(editingObra, false, payloadUpdate);
    if (!salvo) return;
    toast.success("Negócio atualizado com sucesso!");
    setShowEditModal(false);
    setEditingObra(null);
  };

  const handleDeleteNegocio = async (idBackend: number) => {
    const confirmacao = await confirmDialog({ title: 'Excluir negócio', message: 'ATENÇÃO: Tem certeza que deseja excluir permanentemente este negócio? Esta ação não pode ser desfeita.', danger: true, confirmText: 'Excluir' });
    if (!confirmacao) return;

    try {
      await excluirNegocio(idBackend);
      
      // Remove o negócio da tela instantaneamente sem precisar dar F5
      setNegociosBackend(prev => prev.filter(n => n.negocioBackendId !== idBackend));
      
      toast.success('Negócio excluído com sucesso!');
      setShowEditModal(false);
      setEditingObra(null);
    } catch (error) {
      toast.error('Erro ao excluir negócio. Verifique o console.');
    }
  };

   const handleAprovarOrcamento = async () => {
    if (!selectedObraDetalhes) return;

    let proximaCategoria: CategoriaObra = 'Negociação';
    let mensagem = '';

    if (selectedObraDetalhes.categoria === 'Planejamento') {
      proximaCategoria = 'Negociação';
      mensagem = "Orçamento aprovado! Negócio movido para Negociação.";
    } else if (selectedObraDetalhes.categoria === 'Negociação') {
      const ultimaProposta = Array.isArray(selectedObraDetalhes.propostas) && selectedObraDetalhes.propostas.length > 0
        ? selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1]
        : null;
      const propostaAceita = ultimaProposta?.status === 'aceita';

      if (!propostaAceita) {
        return toast.error('Para iniciar o trabalho é obrigatório ter proposta aceita.');
      }

      proximaCategoria = 'Em Andamento';
      mensagem = "Orçamento aprovado! Negócio movido para Em Andamento.";
    }

    const orcamentosAtualizados = selectedObraDetalhes.orcamentos?.map((o: any, idx: number) => 
      idx === selectedObraDetalhes.orcamentos.length - 1 ? { ...o, status: 'aceito' as const } : o
    ) || [];

    const obraAtualizada = {
      ...selectedObraDetalhes,
      orcamentos: orcamentosAtualizados,
      requerReorcamento: false,
      categoria: proximaCategoria as CategoriaObra,
      status: proximaCategoria
    };

    // Usando await e só fechando a tela se a gravação realmente aconteceu
    const salvo = await persistirObraAtualizada(obraAtualizada);
    if (!salvo) return;
    setNegociosBackend(prev =>
      prev.map(o => o.id === obraAtualizada.id ? obraAtualizada : o)
    );
    toast.success(mensagem);
    setShowDetalhesObraModal(false);
    setSelectedObraDetalhes(null);
  };

  const handleRecusarOrcamento = async () => {
    if (!selectedObraDetalhes) return;

    const confirmacao = await confirmDialog({ title: 'Recusar orçamento', message: 'Tem certeza que deseja recusar este orçamento? O negócio voltará para Aguardando orçamento.', danger: true, confirmText: 'Recusar' });
    if (!confirmacao) return;

    const dataRecusa = new Date().toISOString().split('T')[0];
    const orcamentosBase = (selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0)
      ? selectedObraDetalhes.orcamentos
      : (selectedObraDetalhes.orcamentoRealizado && selectedObraDetalhes.orcamentoData && selectedObraDetalhes.orcamentoValores)
        ? [{
            versao: '',
            dataCriacao: selectedObraDetalhes.dataCadastro,
            status: 'pendente' as const,
            numeroOrcamento: selectedObraDetalhes.orcamentoData.numeroOrcamento,
            data: selectedObraDetalhes.orcamentoData,
            valores: selectedObraDetalhes.orcamentoValores
          }]
        : [];

    if (orcamentosBase.length === 0) return;
    
    const orcamentosAtualizados = orcamentosBase.map((o: any, idx: number, lista: any[]) => 
      idx === lista.length - 1 ? { ...o, status: 'recusado' as const, dataRecusa } : o
    );

    const obraAtualizada = {
      ...selectedObraDetalhes,
      orcamentos: orcamentosAtualizados,
      orcamentoRealizado: false,
      requerReorcamento: false,
      categoria: 'Planejamento' as CategoriaObra,
      status: 'Aguardando orçamento',
      versaoNegocio: proximaVersao(selectedObraDetalhes.versaoNegocio || ''),
    };

    // Usando await e só fechando a tela se a gravação realmente aconteceu
    const salvo = await persistirObraAtualizada(obraAtualizada, true);
    if (!salvo) return;
    toast.success("Orçamento recusado. Negócio retornou para Aguardando orçamento.");
    setShowDetalhesObraModal(false);
    setSelectedObraDetalhes(null);
  };

  const handleDownloadOSPDF = async () => {
    const osDoNegocio = (os || []).filter((o: any) => o.obraId === selectedObraDetalhes?.id);
    if (osDoNegocio.length === 0 && !selectedObraDetalhes) {
      toast.error('Nenhuma OS vinculada a este negócio.');
      return;
    }

    const osPrincipal = [...osDoNegocio].reverse().find((o: any) => o.tipoDocumento === 'consolidada' || (o.aSerIncluido && Object.keys(o.aSerIncluido).length > 0)) || osDoNegocio[0] || selectedObraDetalhes;

    const orcamentosBase = Array.isArray(osPrincipal?.orcamentos) && osPrincipal.orcamentos.length > 0
      ? osPrincipal.orcamentos
      : Array.isArray(selectedObraDetalhes?.orcamentos) && selectedObraDetalhes.orcamentos.length > 0
        ? selectedObraDetalhes.orcamentos
        : [];

    const propostasBase = Array.isArray(osPrincipal?.propostas) && osPrincipal.propostas.length > 0
      ? osPrincipal.propostas
      : Array.isArray(selectedObraDetalhes?.propostas) && selectedObraDetalhes.propostas.length > 0
        ? selectedObraDetalhes.propostas
        : [];

    const ultimoOrcamento = orcamentosBase.length > 0 ? orcamentosBase[orcamentosBase.length - 1] : null;
    const ultimaProposta = propostasBase.length > 0 ? propostasBase[propostasBase.length - 1] : null;
    const cliente = listaClientesCRM.find((c: any) => String(c.id) === String(selectedObraDetalhes?.clienteId));
    const logoBase64 = await getBase64FromUrl(getLogoUrlForEmpresa(selectedObraDetalhes?.empresaPrestadora));

    try {
      const resultado = gerarOSPDF({ osPrincipal, ultimoOrcamento, ultimaProposta, cliente, obra: selectedObraDetalhes, logoBase64 });
      if (selectedObraDetalhes && resultado?.conteudoDataUrl) {
        const documentosAtuais = Array.isArray(selectedObraDetalhes.documentosNegocio)
          ? selectedObraDetalhes.documentosNegocio
          : [];
        const documentosSemOs = documentosAtuais.filter((docItem: any) => {
          const id = String(docItem?.id || '').toLowerCase();
          const nome = String(docItem?.nome || '').toLowerCase();
          return !(id.includes('doc-os') || nome.includes('_os_') || nome.includes('ordem de serviço') || nome.includes('ordem de servico'));
        });
        await persistirObraAtualizada({
          ...selectedObraDetalhes,
          documentosNegocio: [
            ...documentosSemOs,
            {
              id: `doc-os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              nome: resultado.nomeArquivo,
              tipo: 'application/pdf',
              tamanho: resultado.tamanho,
              dataUpload: new Date().toISOString(),
              conteudo: resultado.conteudoDataUrl,
            },
          ],
        });
      }
      toast.success('OS baixada em PDF com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar OS em PDF');
    }
  };

  const handleDownloadOrcamentoPDF = () => {
    if (!selectedObraDetalhes?.orcamentos || selectedObraDetalhes.orcamentos.length === 0) return;

    const ultimoOrcamento = selectedObraDetalhes.orcamentos[selectedObraDetalhes.orcamentos.length - 1];
    const cliente = listaClientesCRM.find(c => String(c.id) === String(selectedObraDetalhes.clienteId));

    try {
      const resultado = gerarOrcamentoPDF(ultimoOrcamento, cliente, selectedObraDetalhes);
      if (selectedObraDetalhes && resultado?.conteudoDataUrl) {
        const documentosAtuais = Array.isArray(selectedObraDetalhes.documentosNegocio)
          ? selectedObraDetalhes.documentosNegocio
          : [];
        const documentosSemOrcamento = documentosAtuais.filter((docItem: any) => {
          const id = String(docItem?.id || '').toLowerCase();
          const nome = String(docItem?.nome || '').toLowerCase();
          return !(id.includes('doc-orcamento') || nome.includes('orcamento') || nome.includes('orçamento'));
        });
        persistirObraAtualizada({
          ...selectedObraDetalhes,
          documentosNegocio: [
            ...documentosSemOrcamento,
            {
              id: `doc-orcamento-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              nome: resultado.nomeArquivo,
              tipo: 'application/pdf',
              tamanho: resultado.tamanho,
              dataUpload: new Date().toISOString(),
              conteudo: resultado.conteudoDataUrl,
            },
          ],
        });
      }
      toast.success('Orçamento baixado em PDF com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF do orçamento');
    }
  };

  const handleEnviarOS = async () => {
    if (!selectedObraDetalhes) return;

    const osDoNegocio = (os || []).filter((o: any) => o.obraId === selectedObraDetalhes.id);
    if (osDoNegocio.length === 0) return;

    // Persiste o envio no SQL (atualizar-status) usando o backendId de cada OS.
    for (const o of osDoNegocio) {
      const backendId = (o as any)?.backendId;
      if (backendId != null) {
        try {
          await atualizarStatusOs(backendId, { status_envio: 'enviada' });
        } catch (err) {
          console.error('Erro ao enviar OS no backend:', err);
        }
      }
    }

    // Marcar todas as OS como enviadas
    const osAtualizadas = osDoNegocio.map((o: any) => ({
      ...o,
      statusEnvio: 'enviada'
    }));

    // Atualizar a lista de OS
    const novaListaOS = os?.map((o: any) =>
      osDoNegocio.some((os: any) => os.id === o.id)
        ? osAtualizadas.find((oa: any) => oa.id === o.id)
        : o
    ) || osAtualizadas;

    saveEntity('os', novaListaOS);
    toast.success('Ordem(ns) de Serviço enviada(s) com sucesso!');
  };

  const atualizarOSPorId = async (osId: string, atualizacao: any) => {
    const listaAtual = Array.isArray(os) ? os : [];
    // Persiste a mudança de status no SQL (atualizar-status) via backendId.
    const osItem = listaAtual.find((item: any) => String(item.id) === String(osId));
    const backendId = (osItem as any)?.backendId;
    if (backendId != null) {
      const payload: any = {};
      if (atualizacao.statusOs !== undefined) payload.status_os = atualizacao.statusOs;
      if (atualizacao.statusEnvio !== undefined) payload.status_envio = atualizacao.statusEnvio;
      if (atualizacao.statusAprovacao !== undefined) payload.status_aprovacao = atualizacao.statusAprovacao;
      if (Object.keys(payload).length > 0) {
        try {
          await atualizarStatusOs(backendId, payload);
        } catch (err) {
          console.error('Erro ao atualizar status da OS no backend:', err);
        }
      }
    }
    const novaLista = listaAtual.map((item: any) => (
      item.id === osId ? { ...item, ...atualizacao } : item
    ));
    saveEntity('os', novaLista);
  };

  const handleArquivarNegocio = async (obra: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await confirmDialog({ title: 'Arquivar negócio', message: `Arquivar "${obra.nome}"?\n\nO negócio será removido do Kanban e listado em Negócios → Finalizados.`, confirmText: 'Arquivar' }))) return;
    const salvo = await persistirObraAtualizada({
      ...obra,
      categoria: 'Arquivado',
      status: 'Arquivado',
      dataArquivamento: new Date().toISOString().split('T')[0],
    });
    if (!salvo) return;
    toast.success(`"${obra.nome}" arquivado com sucesso.`);
  };

  const handleAvancarParaFinalizacao = async () => {
    if (!selectedObraDetalhes) return;

    const podeFinalizar = possuiOSAprovadaParaFinalizacao(selectedObraDetalhes.id);
    if (!podeFinalizar) {
      toast.error('Para avançar para Finalização, a OS precisa estar enviada e aprovada.');
      return;
    }

    const obraAtualizada = {
      ...selectedObraDetalhes,
      categoria: 'Finalização' as CategoriaObra,
      status: 'Finalização'
    };

    const salvo = await persistirObraAtualizada(obraAtualizada);
    if (!salvo) return;
    toast.success('Negócio movido para Finalização.');
  };

  // Retorna a medição APROVADA do negócio (criada/aprovada na aba Comercial → Medição).
  const medicaoAprovadaDe = (obra: any) => (Array.isArray(medicoes) ? medicoes : []).find(
    (m: any) => String(m.negocioBackendId) === String(obra?.negocioBackendId) && m.status === 'aprovada',
  );

  // Baixa o PDF de uma medição aprovada.
  const handleBaixarMedicaoAprovada = async (med: any) => {
    if (!med) return;
    const cliente = listaClientesCRM.find((c: any) => c.razaoSocial === med.cliente);
    try {
      await handleDownloadMedicaoPDF({
        empresa: med.empresa, cliente: med.cliente, cnpj: med.cnpj, clienteCnpj: med.cnpj,
        dataEmissao: med.dataEmissao, embarcacao: med.embarcacao, numeroBM: med.numeroBM,
        periodo: med.periodo, representanteCliente: med.representanteCliente,
        representanteLinave: med.representanteLinave, tabelaItens: med.itens,
      }, cliente || {}, { id: med.ordemServicoNumero });
    } catch (e) {
      toast.error('Erro ao gerar o PDF da medição.');
    }
  };

  const possuiOSAprovadaParaFinalizacao = (obraId: string) => {
    const osDoNegocio = (os || []).filter((item: any) => item.obraId === obraId);
    const osOk = osDoNegocio.some((item: any) => (
      item.statusEnvio === 'enviada' && item.statusAprovacao === 'aprovada'
    ));
    if (!osOk) return false;
    // Novo fluxo: só uma medição APROVADA (feita na aba Medição) libera a finalização.
    const obra = negociosBackend.find((o: any) => o.id === obraId);
    return Boolean(medicaoAprovadaDe(obra));
  };


const obrasOrdenadas = useMemo(() => {
    return negociosBackend.filter((obra: any) => {
      if (obra.categoria === 'Arquivado') return false;
      if (obra.usoInterno) return false; // negócios de uso interno não aparecem no CRM
      if (!searchQuery) return true;

      const termo = searchQuery.toLowerCase();
      const cliente = listaClientesCRM.find(c => String(c.id) === String(obra.clienteId));
      
      return (
        obra.nome?.toLowerCase().includes(termo) || 
        obra.id?.toLowerCase().includes(termo) ||
        cliente?.razaoSocial?.toLowerCase().includes(termo)
      );
    }).map((obra: any) => {
      // 🚀 BLINDAGEM DE CATEGORIA: Corrige o texto que vem do banco para bater com o ID da coluna
      let categoriaTratada = String(obra.categoria || '').trim();
      
      if (categoriaTratada.toLowerCase().includes('andamento')) {
        categoriaTratada = 'Em Andamento';
      } else if (categoriaTratada.toLowerCase().includes('negocia')) {
        categoriaTratada = 'Negociação';
      } else if (categoriaTratada.toLowerCase().includes('planeja')) {
        categoriaTratada = 'Planejamento';
      } else if (categoriaTratada.toLowerCase().includes('finaliza')) {
        categoriaTratada = 'Finalização';
      }

      return {
        ...obra,
        categoria: categoriaTratada
      };
    });
}, [negociosBackend, searchQuery, listaClientesCRM]);

  const inputClass = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelClass = "text-[9px] font-black text-white/40 uppercase tracking-widest ml-1 mb-1.5 block";
  const cellInputClass = "w-full bg-[#101f3d] border border-white/10 p-2 rounded text-white text-xs outline-none focus:border-amber-500";

  const totalPrecoImportarOs = formData.importarOs.precoItens.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const totalMateriaisImportarOs = formData.importarOs.materiais.reduce((s, it) => s + (parseFloat(it.valorTotal) || 0), 0);
  const totalTerceirizadosImportarOs = formData.importarOs.terceirizados.reduce((s, it) => s + (parseFloat(it.valorTotal) || 0), 0);

  return (
    <div className="p-12 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER COM BOTÃO NOVO NEGÓCIO */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">CRM - NEGÓCIOS</h1>
          <p className="text-white/50 text-xs mt-1">Acompanhe os negócios em cada fase do funil comercial</p>
        </div>
        <button 
          onClick={() => {
            setNovoNegocioTab('dados');
            setShowFormNovoNegocio(true);
          }}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus size={18} className="inline mr-2" /> Novo Negócio
        </button>
      </div>

      {/* KANBAN BOARD */}
      <div className="flex gap-4 sm:gap-5 lg:gap-6 min-h-[600px] overflow-x-auto overflow-y-hidden pb-4 pr-2 snap-x snap-mandatory">
        {COLUNAS.map((coluna) => {
          const IconColuna = coluna.icon;
          const obrasNaColuna = obrasOrdenadas.filter((obra: any) => obra.categoria === coluna.id);
          const corClasse = {
            blue: 'border-blue-500/30 bg-blue-500/5',
            amber: 'border-amber-500/30 bg-amber-500/5',
            purple: 'border-purple-500/30 bg-purple-500/5',
            emerald: 'border-emerald-500/30 bg-emerald-500/5'
          }[coluna.cor];
          const corTexto = {
            blue: 'text-blue-400',
            amber: 'text-amber-400',
            purple: 'text-purple-400',
            emerald: 'text-emerald-400'
          }[coluna.cor];
          const corBg = {
            blue: 'bg-blue-500/20',
            amber: 'bg-amber-500/20',
            purple: 'bg-purple-500/20',
            emerald: 'bg-emerald-500/20'
          }[coluna.cor];

          return (
            <div key={coluna.id} className={`rounded-2xl border ${corClasse} p-4 sm:p-5 lg:p-6 flex flex-col flex-none w-[280px] sm:w-[300px] lg:w-[320px] xl:w-[340px] 2xl:w-[360px] snap-start`}>
              {/* Header da Coluna */}
              <div className="flex items-center gap-3 mb-4 sm:mb-5 lg:mb-6 pb-3 sm:pb-4 border-b border-white/10">
                <div className={`p-2 rounded-lg ${corBg}`}>
                  <IconColuna size={20} className={corTexto} />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-white uppercase text-sm">{coluna.titulo}</h3>
                  <p className={`text-xs font-bold ${corTexto}`}>{obrasNaColuna.length} negócios</p>
                </div>
              </div>

              {/* Cards dos Projetos */}
              <div className="space-y-4 flex-1 overflow-y-auto">
                {obrasNaColuna.length > 0 ? (
                  obrasNaColuna.map((obra: any) => {
                    const cliente = listaClientesCRM.find(c => String(c.id) === String(obra.clienteId));
                    const ultimaPropostaCard = Array.isArray(obra.propostas) && obra.propostas.length > 0
                      ? obra.propostas[obra.propostas.length - 1]
                      : null;
                    const propostaAtiva = Boolean(ultimaPropostaCard && ultimaPropostaCard.status !== 'recusada');
                    
                    // Compatibilidade com dados antigos: converter orcamentoRealizado em orcamentos array
                    let temOrcamento = obra.orcamentos && obra.orcamentos.length > 0;
                    let ultimoOrcamento = temOrcamento ? obra.orcamentos[obra.orcamentos.length - 1] : null;
                    
                    // Se não tem novo formato mas tem formato antigo, converter
                    if (!temOrcamento && obra.orcamentoRealizado && obra.orcamentoData && obra.orcamentoValores) {
                      const ultimaProposta = Array.isArray(obra.propostas) && obra.propostas.length > 0
                        ? obra.propostas[obra.propostas.length - 1]
                        : null;
                      const statusNegocio = String(obra.status || '').toLowerCase();
                      const legadoRecusado = obra.requerReorcamento || statusNegocio.includes('aguardando orçamento') || ultimaProposta?.status === 'recusada';
                      temOrcamento = true;
                      ultimoOrcamento = {
                        versao: '',
                        dataCriacao: obra.dataCadastro,
                        status: legadoRecusado ? 'recusado' : 'pendente',
                        numeroOrcamento: obra.orcamentoData.numeroOrcamento,
                        data: obra.orcamentoData,
                        valores: obra.orcamentoValores
                      };
                    }

                    const temOrcamentoAtivo = temOrcamento
                      && !obra.requerReorcamento
                      && ultimoOrcamento?.status !== 'recusado'
                      && ultimoOrcamento?.status !== 'pendente_reorcamento';
                    
                    const podeEditar = obra.categoria === 'Planejamento';
                    const podAprovar = obra.categoria === 'Negociação' && temOrcamentoAtivo;
                    const osDoNegocio = (os || []).filter((o: any) => o.obraId === obra.id);

                    // Usar ID do projeto diretamente (já tem formato correto: LN-0731/26)
                    const idProjeto = obra.id || ''; 

                    return (
                      <div 
                        key={obra.id}
                        onClick={() => handleShowDetalhes(obra)}
                        className={`rounded-xl p-4 transition-all cursor-pointer border-2 ${
                          coluna.cor === 'blue' ? 'bg-blue-500/5 border-blue-500/30 hover:border-blue-400/60 hover:shadow-lg hover:shadow-blue-900/20' :
                          coluna.cor === 'amber' ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-900/20' :
                          coluna.cor === 'purple' ? 'bg-purple-500/5 border-purple-500/30 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/20' :
                          'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-900/20'
                        }`}
                      >
                        {/* Header com Nome e Badge de Status + Editar */}
                                              <div className="mb-2 space-y-2">
                        <h4 className="font-black text-white text-sm leading-tight line-clamp-2 break-words uppercase">
                          {obra.nome} 
                          <span className="text-cyan-400 ml-1">• {formatarIdCard(obra)}</span>
                        </h4>
                         {/* Badge + Botão Editar na Direita */}
                          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                            {/* Badge Orçado/Pendente em Planejamento */}
                            {coluna.id === 'Planejamento' && (
                              <>
                                {temOrcamentoAtivo ? (
                                  <div className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-emerald-300 text-[10px] font-black">Orçado</span>
                                  </div>
                                ) : (
                                  <button 
                                  onClick={(e) => {
                                    e.stopPropagation(); //  Impede que o modal abra
                                    //  CORREÇÃO: Dispara a mudança de tela para o App.tsx escutar
                                    window.dispatchEvent(new CustomEvent('mudarTelaERP', { detail: 'orcamentos' }));
                                  }}
                                  className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap hover:bg-amber-500/40 hover:scale-105 transition-all cursor-pointer"
                                  title="Clique para orçar este negócio"
                                >
                                  <span className="text-amber-300 text-[10px] font-black">Aguard. orçamento</span>
                                </button>
                                )}
                              </>
                            )}
                            {/* Badge Proposta/Pendente em Negociação */}
                            {coluna.id === 'Negociação' && (
                              <>
                                {propostaAtiva ? (
                                  <div className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-cyan-300 text-[10px] font-black">Proposta</span>
                                  </div>
                                ) : (
                                  <div className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap">
                                    <span className="text-amber-300 text-[10px] font-black">Aguard. proposta</span>
                                  </div>
                                )}
                              </>
                            )}
                            {/* Badge Status OS em 'Em Andamento' */}
                            {coluna.id === 'Em Andamento' && (() => {
                              const osDoNegocio = (os || []).filter((o: any) => o.obraId === obra.id);
                              if (osDoNegocio.length === 0) return null;
                              const osEnviada = osDoNegocio.some((o: any) => o.statusEnvio === 'enviada');
                              const osProntaFinalizacao = osDoNegocio.some((o: any) =>
                                o.statusEnvio === 'enviada'
                                && o.statusAprovacao === 'aprovada'
                              );
                              return (
                                <>
                                  {osProntaFinalizacao ? (
                                    <div className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full whitespace-nowrap">
                                      <span className="text-emerald-300 text-[10px] font-black">Pronta Finalização</span>
                                    </div>
                                  ) : osEnviada ? (
                                    <div className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 rounded-full whitespace-nowrap">
                                      <span className="text-green-300 text-[10px] font-black">{boldOS('OS Enviada')}</span>
                                    </div>
                                  ) : (
                                    <div className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full whitespace-nowrap">
                                      <span className="text-amber-300 text-[10px] font-black">{boldOS('Aguard. OS')}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            {/* Botão Editar */}
                            {podeEditar && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditObra(obra);
                                }}
                                className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-gradient-to-r from-blue-500/30 to-blue-600/30 hover:from-blue-500/50 hover:to-blue-600/50 border border-blue-400/40 text-blue-300 hover:text-blue-200 rounded transition-all text-[10px] sm:text-xs font-black uppercase tracking-wide"
                              >
                                <Edit2 size={12} className="inline mr-1" /> Editar
                              </button>
                            )}
                          </div>
                        </div>

                       {/* Altere para buscar a propriedade direta e segura que mapeamos: */}
                        <p className="text-amber-400 text-xs font-bold mb-2 truncate">
                          {obra.nomeClienteResolvido}
                        </p>

                        {/* Prestador */}
                        <p className="text-white/50 text-[11px] mb-2 truncate">
                          <span className="font-black text-white/80">Prestador:</span> {getEmpresaPrestadoraNome(obra.empresaPrestadora)}
                        </p>

                        {/* Responsável */}
                        {obra.responsavelComercial && (
                          <div className="text-xs text-white/50 mb-2 truncate">
                            {obra.responsavelComercial}
                          </div>
                        )}

                        {/* Serviços Badge (apenas quantidade) */}
                        {obra.servicos && obra.servicos.length > 0 && (
                          <div className="text-[10px] font-bold mb-2">
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              {obra.servicos.length} serv.
                            </span>
                          </div>
                        )}

                        {coluna.id === 'Planejamento' && temOrcamentoAtivo && ultimoOrcamento && (
                          <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-2.5 mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-emerald-400 text-[11px] font-black">ORÇADO</p>
                              <span className="text-emerald-300 font-black text-xs">v{formatarVersaoOrcamento(ultimoOrcamento.versao)}</span>
                            </div>
                            <p className="text-emerald-200 font-black text-base">
                              R$ {safeNumber(ultimoOrcamento.valores.precoFinal).toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Resumo de Orçamento (apenas em Negociação - se ainda não tem proposta) */}
                        {coluna.id === 'Negociação' && temOrcamentoAtivo && ultimoOrcamento && !propostaAtiva && (
                          <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg p-2.5 mb-3">
                            <div className="flex justify-between items-center">
                              <p className="text-emerald-400 text-xs font-black">Orçamento v{formatarVersaoOrcamento(ultimoOrcamento.versao)}</p>
                              <span className="text-emerald-300 font-black text-xs">R$ {safeNumber(ultimoOrcamento.valores.precoFinal).toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {/* Resumo da Proposta (apenas em Negociação) */}
                        {coluna.id === 'Negociação' && propostaAtiva && (() => {
                          const ultimaProposta = obra.propostas[obra.propostas.length - 1];
                          const possuiDocumentoCliente = Boolean(obra.documentoClienteAssinado?.conteudo || obra.documentoClienteAssinado?.url);
                          return (
                            <div className={`rounded-lg p-2.5 mb-3 border ${
                              ultimaProposta.status === 'pendente' 
                                ? 'bg-amber-500/20 border-amber-500/30' 
                                : ultimaProposta.status === 'aceita'
                                ? 'bg-emerald-500/20 border-emerald-500/30'
                                : 'bg-red-500/20 border-red-500/30'
                            }`}>
                              <div className="flex justify-between items-center">
                                <p className="text-xs font-black uppercase">
                                  {ultimaProposta.status === 'pendente' && 'Proposta Pendente'}
                                  {ultimaProposta.status === 'aceita' && 'Proposta Aceita'}
                                  {ultimaProposta.status === 'recusada' && 'Proposta Recusada'}
                                </p>
                                <span className="text-xs font-black">v{ultimaProposta.versao || ultimaProposta.numeroProposta?.match(/[A-Z]+$/)?.[0] || 'A'}</span>
                              </div>
                              <div className="mt-2.5 pt-2 border-t border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-white/60 font-black uppercase tracking-widest">Doc. cliente</p>
                                  <span className={`text-[10px] font-black ${possuiDocumentoCliente ? 'text-emerald-300' : 'text-amber-300'}`}>
                                    {possuiDocumentoCliente ? 'Anexado' : 'Pendente'}
                                  </span>
                                </div>
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleUploadDocumentoClienteAssinado(obra, e.target.files);
                                    e.currentTarget.value = '';
                                  }}
                                  className="w-full text-[10px] text-white/70 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-500 file:px-2.5 file:py-1 file:text-[10px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-cyan-400"
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Resumo da Proposta (Em Andamento) */}
                        {coluna.id === 'Em Andamento' && obra.propostas && obra.propostas.length > 0 && (() => {
                          const ultimaProposta = obra.propostas[obra.propostas.length - 1];
                          const possuiDocumentoCliente = Boolean(obra.documentoClienteAssinado?.conteudo || obra.documentoClienteAssinado?.url);
                          const versaoProposta = ultimaProposta.versao || ultimaProposta.numeroProposta?.match(/[A-Z]+$/)?.[0] || 'A';
                          return (
                            <div className="rounded-lg p-2.5 mb-3 border bg-purple-500/15 border-purple-500/30">
                              <div className="flex justify-between items-center">
                                <p className="text-xs font-black uppercase text-purple-200">Proposta v{versaoProposta}</p>
                                <span className={`text-[10px] font-black ${
                                  ultimaProposta.status === 'aceita'
                                    ? 'text-emerald-300'
                                    : ultimaProposta.status === 'pendente'
                                      ? 'text-amber-300'
                                      : 'text-red-300'
                                }`}>
                                  {ultimaProposta.status === 'aceita' ? 'Aceita' : ultimaProposta.status === 'pendente' ? 'Pendente' : 'Recusada'}
                                </span>
                              </div>
                              <div className="mt-1.5 flex justify-between items-center text-[10px] text-white/70">
                                <span>Doc. cliente:</span>
                                <span className={possuiDocumentoCliente ? 'text-emerald-300 font-black' : 'text-amber-300 font-black'}>
                                  {possuiDocumentoCliente ? 'Anexado' : 'Pendente'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Resumo de Finalizacao: Orcamento + Proposta + OS */}
                        {coluna.id === 'Finalização' && (() => {
                          const ultimaProposta = Array.isArray(obra.propostas) && obra.propostas.length > 0
                            ? obra.propostas[obra.propostas.length - 1]
                            : null;
                          const temOS = osDoNegocio.length > 0;
                          const osAprovadas = osDoNegocio.filter((item: any) => item.statusAprovacao === 'aprovada').length;

                          return (
                            <div className="space-y-2.5 mb-3">
                              {ultimoOrcamento && (
                                <div className="rounded-lg p-2.5 border bg-emerald-500/15 border-emerald-500/30">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-emerald-200 font-black uppercase">Orcamento</span>
                                    <span className="text-emerald-300 font-black">v{formatarVersaoOrcamento(ultimoOrcamento.versao)}</span>
                                  </div>
                                  <p className="text-emerald-100 text-xs mt-1">{ultimoOrcamento.numeroOrcamento || 'Sem numero'} • R$ {Number(ultimoOrcamento?.valores?.precoFinal || 0).toFixed(2)}</p>
                                </div>
                              )}

                              {ultimaProposta && (
                                <div className="rounded-lg p-2.5 border bg-cyan-500/15 border-cyan-500/30">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-cyan-200 font-black uppercase">Proposta</span>
                                    <span className="text-cyan-300 font-black">v{ultimaProposta.versao || ultimaProposta.numeroProposta?.match(/[A-Z]+$/)?.[0] || 'A'}</span>
                                  </div>
                                  <p className="text-cyan-100 text-xs mt-1">{ultimaProposta.numeroProposta || 'Sem numero'} • {String(ultimaProposta.status || 'pendente').toUpperCase()}</p>
                                </div>
                              )}

                              <div className="rounded-lg p-2.5 border bg-purple-500/15 border-purple-500/30">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-purple-200 font-black uppercase">{boldOS('OS')}</span>
                                  <span className="text-purple-300 font-black">{temOS ? `${osDoNegocio.length} total` : '0 total'}</span>
                                </div>
                                <p className="text-purple-100 text-xs mt-1">{temOS ? `${osAprovadas} aprovada(s)` : 'Nenhuma OS vinculada'}</p>
                              </div>

                              {(() => {
                                const medApr = medicaoAprovadaDe(obra);
                                return medApr ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleBaixarMedicaoAprovada(medApr); }}
                                    className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-200 text-[11px] font-black uppercase tracking-wider transition-all"
                                  >
                                    <FileText size={14} className="inline mr-1" /> Baixar Medição
                                  </button>
                                ) : (
                                  <p className="text-[10px] text-white/40 text-center px-1 py-1">Medição é feita na aba Medição.</p>
                                );
                              })()}
                              <button
                                onClick={(e) => handleArquivarNegocio(obra, e)}
                                className="w-full py-2 rounded-lg bg-gradient-to-r from-gray-500/20 to-gray-600/20 hover:from-amber-500/20 hover:to-amber-600/20 border border-gray-500/30 hover:border-amber-400/50 text-gray-300 hover:text-amber-200 text-[11px] font-black uppercase tracking-wider transition-all"
                              >
                                Arquivar Negócio
                              </button>
                            </div>
                          );
                        })()}

                        {/* Botão Ver Detalhes */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Ver Detalhes button clicked for obra:', obra?.id || obra?.nome || obra);
                            handleShowDetalhes(obra);
                          }}
                          className="w-full py-2 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 text-white rounded-lg font-black text-xs uppercase tracking-wide transition-all border border-white/10 hover:border-white/20 flex items-center justify-center gap-2"
                        >
                          Ver Detalhes
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <div className="text-white/20 text-2xl mb-2">−</div>
                    <p className="text-white/40 text-xs">Nenhum negócio</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL - NOVO NEGÓCIO */}
      {showFormNovoNegocio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white uppercase">Novo Negócio</h2>
                <p className="text-white/50 text-sm mt-2">Criar e registrar um novo projeto comercial</p>
              </div>
              <button 
                onClick={() => setShowFormNovoNegocio(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-8 space-y-6">

              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-1 flex gap-1">
                <button
                  onClick={() => setNovoNegocioTab('dados')}
                  className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition ${novoNegocioTab === 'dados' ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Dados
                </button>
                <button
                  onClick={() => setNovoNegocioTab('servicos')}
                  className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition ${novoNegocioTab === 'servicos' ? 'bg-purple-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Serviços
                </button>
                <button
                  onClick={() => setNovoNegocioTab('alocacao')}
                  className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition ${novoNegocioTab === 'alocacao' ? 'bg-cyan-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Alocação
                </button>
                <button
                  onClick={() => setNovoNegocioTab('documentos')}
                  className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition ${novoNegocioTab === 'documentos' ? 'bg-amber-500 text-[#0b1220]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Upload Documentos
                </button>
              </div>
              
              {/* SEÇÃO 1: DADOS PRINCIPAIS */}
              {novoNegocioTab === 'dados' && (
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6">
                <h3 className="text-lg font-black text-white uppercase mb-4">Dados Principais</h3>
                
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Empresa Prestadora *</label>
                    <select
                      className={inputClass}
                      value={formData.empresaPrestadora}
                      onChange={e => setFormData({...formData, empresaPrestadora: e.target.value})}
                    >
                      <option value="" disabled>Selecione a empresa</option>
                      {empresasPrestadoras.map((empresa) => (
                        <option key={empresa.id} value={empresa.nome}>
                          {empresa.nome}{empresa.cnpj ? ` - ${empresa.cnpj}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Cliente *</label>
                    <select
                      className={inputClass}
                      value={formData.clienteId}
                      onChange={e => handleClienteChange(e.target.value)}
                    >
                      <option value="" disabled>
                        {clientesLoading ? 'Carregando clientes...' : 'Selecione um cliente'}
                      </option>
                      {listaClientesCRM.map(c => (
                        <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Modalidade *</label>
                    <select
                      className={inputClass}
                      value={formData.modalidade}
                      onChange={e => {
                        const novaModalidade = e.target.value;
                        setFormData({ ...formData, modalidade: novaModalidade });
                      }}
                    >
                      {MODALIDADES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Nº do Negócio *</label>
                    <input
                      type="text"
                      className={inputClass}
                      disabled={!formData.empresaPrestadora}
                      value={formData.numeroNegocio || numeroNegocioSugerido}
                      onChange={e => setFormData({ ...formData, numeroNegocio: e.target.value })}
                      placeholder={formData.empresaPrestadora ? numeroNegocioSugerido : 'Selecione a empresa primeiro'}
                      title={formData.empresaPrestadora ? 'Sugestão automática — edite se precisar seguir outra numeração' : 'Escolha a Empresa Prestadora para ver o próximo número'}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <label className={labelClass}>Nome do Negócio *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.nomeNegocio}
                    onChange={e => setFormData({...formData, nomeNegocio: e.target.value})}
                    placeholder="Ex: Docagem Preventiva Q3 - Navio Aurora"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>CPF/CNPJ</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      value={formData.cnpj}
                      placeholder="Preenchido automaticamente"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Solicitante *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.solicitante}
                      onChange={e => setFormData({...formData, solicitante: e.target.value})}
                      placeholder="Nome completo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Cargo</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={formData.cargo}
                      onChange={e => setFormData({...formData, cargo: e.target.value})}
                      placeholder="Cargo"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Telefone</label>
                    <input 
                      type="tel"
                      className={inputClass}
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: e.target.value})}
                      placeholder="(11) 9999-9999"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Email</label>
                    <input 
                      type="email"
                      className={inputClass}
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Data da Solicitação</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={formData.dataSolicitacao}
                      onChange={e => setFormData({...formData, dataSolicitacao: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0b1220] p-5">
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-wide">Deseja ir direto para OS?</p>
                    <p className="mt-1 text-xs text-white/50">Ao marcar esta opção, serão abertos os anexos de Orçamento/Proposta e os campos da Ordem de Serviço.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.desejaIrDiretoParaOs}
                    onClick={() => setFormData({ ...formData, desejaIrDiretoParaOs: !formData.desejaIrDiretoParaOs })}
                    className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors ${formData.desejaIrDiretoParaOs ? 'bg-emerald-500' : 'bg-white/15'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${formData.desejaIrDiretoParaOs ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              )}

              {/* BLOCO "IMPORTAR NEGÓCIO JÁ FECHADO" — só quando o toggle "Deseja ir
                  direto para OS?" está ligado. Permite trazer pro sistema um negócio
                  cujo orçamento e proposta já foram feitos fora dele (papel/PDF/planilha),
                  e cair direto na criação da OS já com tudo pré-preenchido. */}
              {novoNegocioTab === 'dados' && formData.desejaIrDiretoParaOs && temServico(formData.modalidade) && (
              <div className="space-y-6">

                {/* DOCUMENTOS PARA A OS */}
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6">
                  <h3 className="text-lg font-black text-white uppercase mb-4">Documentos para a OS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { tipo: 'orcamento' as const, titulo: 'Orçamento Feito', numero: formData.importarOs.orcamentoNumero, versao: formData.importarOs.orcamentoVersao, arquivo: formData.importarOs.orcamentoArquivo },
                      { tipo: 'proposta' as const, titulo: 'Proposta Feita', numero: formData.importarOs.propostaNumero, versao: formData.importarOs.propostaVersao, arquivo: formData.importarOs.propostaArquivo },
                    ].map(card => (
                      <div key={card.tipo} className="bg-[#0b1220] border border-white/10 rounded-xl p-4">
                        <p className="text-xs font-black text-white uppercase tracking-wide mb-3">{card.titulo}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Nº {card.tipo === 'orcamento' ? 'do Orçamento' : 'da Proposta'}</label>
                            <input
                              className={inputClass}
                              placeholder={card.tipo === 'orcamento' ? 'Ex: 2345/26' : 'Ex: 5678/26'}
                              value={card.numero}
                              onChange={e => setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, [card.tipo === 'orcamento' ? 'orcamentoNumero' : 'propostaNumero']: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Versão</label>
                            <input
                              className={inputClass}
                              placeholder="Ex: v1.0"
                              value={card.versao}
                              onChange={e => setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, [card.tipo === 'orcamento' ? 'orcamentoVersao' : 'propostaVersao']: e.target.value } }))}
                            />
                          </div>
                        </div>
                        <label className="mt-3 flex items-center justify-between gap-3 border border-dashed border-white/20 rounded-lg px-3 py-2.5 cursor-pointer hover:border-blue-400/50 transition">
                          <span className="text-xs text-white/70 font-semibold">
                            {card.tipo === 'orcamento' ? 'Anexar Orçamento Feito' : 'Anexar Proposta Feita'}
                          </span>
                          <span className="text-[11px] text-white/40 truncate max-w-[140px]">{card.arquivo?.nome || 'Nenhum arquivo'}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                            onChange={e => handleSelecionarArquivoImportarOs(card.tipo, e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* A - ESCOPO BÁSICO DE SERVIÇOS */}
                <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-white uppercase">A - Escopo Básico de Serviços</h3>
                    <button type="button" onClick={adicionarServicoImportarOs} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition">
                      <Plus size={14} className="inline mr-1" /> Adicionar Serviço
                    </button>
                  </div>

                  {formData.importarOs.escopoServicos.length === 0 && (
                    <p className="text-white/40 text-sm">Nenhum serviço adicionado. Clique em "Adicionar Serviço".</p>
                  )}

                  <div className="space-y-4">
                    {formData.importarOs.escopoServicos.map(escopo => (
                      <div key={escopo.id} className="bg-[#081225] border border-white/10 rounded-xl p-4">
                        <div className="flex gap-3 items-center mb-3">
                          <input
                            className={`${cellInputClass} font-black`}
                            value={escopo.titulo}
                            onChange={e => atualizarTituloServicoImportarOs(escopo.id, e.target.value)}
                          />
                          <span className="text-[11px] text-white/50 font-black whitespace-nowrap">{escopo.linhas.length} ITEM(NS)</span>
                        </div>

                        <label className={labelClass}>Descrição do serviço</label>
                        <textarea
                          className={`${inputClass} min-h-[70px]`}
                          value={escopo.descricaoServico}
                          onChange={e => atualizarDescricaoServicoImportarOs(escopo.id, e.target.value)}
                          placeholder="Descreva o serviço"
                        />

                        <div className="mt-3">
                          <label className={labelClass}>Colunas da planilha</label>
                          <ColunaAdder onAdd={(nome) => adicionarColunaServicoImportarOs(escopo.id, nome)} />
                          <div className="flex flex-wrap gap-2 mt-2">
                            {escopo.colunas.map(coluna => (
                              <span key={coluna} className="inline-flex items-center gap-2 bg-[#142348] border border-[#3d5f9d] text-[#dce7ff] rounded-full px-3 py-1 text-[11px]">
                                {coluna}
                                {escopo.colunas.length > 1 && (
                                  <button type="button" onClick={() => removerColunaServicoImportarOs(escopo.id, coluna)} className="text-red-300 hover:text-red-200">
                                    <X size={12} />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="overflow-x-auto mt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/10">
                                <th className="px-2 py-2 text-left text-white font-black w-10">Item</th>
                                {escopo.colunas.map(coluna => (
                                  <th key={coluna} className="px-2 py-2 text-left text-white font-black">{coluna}</th>
                                ))}
                                <th className="px-2 py-2 w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {escopo.linhas.map((linha, idx) => (
                                <tr key={linha.id} className="border-b border-white/5">
                                  <td className="px-2 py-2 text-white/60 text-center">{idx + 1}</td>
                                  {escopo.colunas.map(coluna => (
                                    <td key={coluna} className="px-2 py-2">
                                      <input
                                        className={cellInputClass}
                                        value={linha.valores[coluna] || ''}
                                        onChange={e => atualizarCelulaServicoImportarOs(escopo.id, linha.id, coluna, e.target.value)}
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 text-center">
                                    <button type="button" onClick={() => removerItemServicoImportarOs(escopo.id, linha.id)} className="text-red-300 p-1">
                                      <X size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
                          <button type="button" onClick={() => adicionarItemServicoImportarOs(escopo.id)} className="px-3 py-1.5 bg-[#3a58ff] text-white rounded-lg font-black text-[11px] uppercase">
                            <Plus size={12} className="inline mr-1" /> Adicionar Item
                          </button>
                          <button type="button" onClick={() => removerServicoImportarOs(escopo.id)} className="px-3 py-1.5 bg-[#ef1424] text-white rounded-lg font-black text-[11px] uppercase">
                            Remover Serviço
                          </button>
                        </div>

                        <div className="mt-4">
                          <label className={labelClass}>Textos após a tabela</label>
                          {escopo.textosDepois.map((texto, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 mt-2">
                              <textarea
                                className={`${inputClass} min-h-[60px]`}
                                value={texto}
                                onChange={e => atualizarTextoServicoImportarOs(escopo.id, idx, e.target.value)}
                                placeholder="Texto complementar do escopo"
                              />
                              <button type="button" onClick={() => removerTextoServicoImportarOs(escopo.id, idx)} className="px-3 bg-[#ef1424] text-white rounded-lg font-black text-[11px] uppercase h-fit self-start">
                                Remover
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => adicionarTextoServicoImportarOs(escopo.id)} className="mt-2 px-3 py-1.5 bg-emerald-500 text-[#0b1220] rounded-lg font-black text-[11px] uppercase">
                            <Plus size={12} className="inline mr-1" /> Adicionar Texto
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* B - PREÇO */}
                <div className="bg-[#081225] border border-[#253550] rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-white uppercase">B - Preço</h3>
                    <button type="button" onClick={adicionarItemPrecoImportarOs} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition">
                      <Plus size={14} className="inline mr-1" /> Adicionar Item
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-2 py-2 text-left text-white font-black w-10">Item</th>
                          <th className="px-2 py-2 text-left text-white font-black">Descrição</th>
                          <th className="px-2 py-2 text-left text-white font-black w-20">Quant.</th>
                          <th className="px-2 py-2 text-left text-white font-black w-20">Unid.</th>
                          <th className="px-2 py-2 text-left text-white font-black w-28">Vl. Unit. R$</th>
                          <th className="px-2 py-2 text-left text-white font-black w-16">Dias</th>
                          <th className="px-2 py-2 text-left text-white font-black w-32">Valor total R$</th>
                          <th className="px-2 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {formData.importarOs.precoItens.length === 0 && (
                          <tr><td colSpan={8} className="px-2 py-3 text-white/40">Nenhum item. Clique em "Adicionar Item".</td></tr>
                        )}
                        {formData.importarOs.precoItens.map((it, idx) => (
                          <tr key={it.id} className="border-b border-white/5">
                            <td className="px-2 py-2 text-white/60 text-center">{idx + 1}</td>
                            <td className="px-2 py-2"><input className={cellInputClass} value={it.descricao} onChange={e => atualizarItemPrecoImportarOs(it.id, 'descricao', e.target.value)} placeholder="Descrição" /></td>
                            <td className="px-2 py-2"><input type="number" min="0" className={cellInputClass} value={String(it.quantidade)} onChange={e => atualizarItemPrecoImportarOs(it.id, 'quantidade', e.target.value)} /></td>
                            <td className="px-2 py-2"><input className={cellInputClass} value={it.unidade} onChange={e => atualizarItemPrecoImportarOs(it.id, 'unidade', e.target.value)} placeholder="serv." /></td>
                            <td className="px-2 py-2"><input className={cellInputClass} value={String(it.valorUnitario)} onChange={e => atualizarItemPrecoImportarOs(it.id, 'valorUnitario', e.target.value)} placeholder="0,00" /></td>
                            <td className="px-2 py-2"><input type="number" min="0" className={cellInputClass} value={String(it.dias)} onChange={e => atualizarItemPrecoImportarOs(it.id, 'dias', e.target.value)} /></td>
                            <td className="px-2 py-2 text-white font-black whitespace-nowrap">R$ {(Number(it.total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-2 py-2 text-center"><button type="button" onClick={() => removerItemPrecoImportarOs(it.id)} className="text-red-300 p-1"><X size={13} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-right mt-3 text-xs text-white/70">
                    Subtotal Serviços: <span className="text-white font-black">R$ {totalPrecoImportarOs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-end mt-2 pt-3 border-t border-white/10">
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Total da Proposta</p>
                      <p className="text-emerald-400 font-black text-xl">R$ {totalPrecoImportarOs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={labelClass}>Texto livre do preço</label>
                    <textarea
                      className={`${inputClass} min-h-[70px]`}
                      value={formData.importarOs.precoTextoLivre}
                      onChange={e => setFormData(prev => ({ ...prev, importarOs: { ...prev.importarOs, precoTextoLivre: e.target.value } }))}
                      placeholder="Observações, condições, detalhes comerciais ou qualquer texto complementar do preço"
                    />
                  </div>
                </div>

                {/* C - CONSUMÍVEIS E MATERIAIS */}
                <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase">C - Consumíveis e Materiais</h3>
                      <p className="text-white/50 text-xs mt-1">Itens em uma única aba com indicação de terceiros</p>
                    </div>
                    <button type="button" onClick={adicionarMaterialImportarOs} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition">
                      <Plus size={14} className="inline mr-1" /> Adicionar Item
                    </button>
                  </div>
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-2 py-2 text-left text-white font-black">Descrição</th>
                          <th className="px-2 py-2 text-left text-white font-black">Unidade</th>
                          <th className="px-2 py-2 text-left text-white font-black">Quantidade</th>
                          <th className="px-2 py-2 text-left text-white font-black">Peso / Fator</th>
                          <th className="px-2 py-2 text-left text-white font-black">Custo Unit.</th>
                          <th className="px-2 py-2 text-left text-white font-black">Valor Total</th>
                          <th className="px-2 py-2 text-left text-white font-black">Terceiros?</th>
                          <th className="px-2 py-2 text-left text-white font-black">Observação</th>
                          <th className="px-2 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {formData.importarOs.materiais.map(item => (
                          <tr key={item.id} className="border-b border-white/5">
                            <td className="px-2 py-2"><input className={cellInputClass} value={item.descricao} onChange={e => atualizarMaterialImportarOs(item.id, { descricao: e.target.value })} /></td>
                            <td className="px-2 py-2"><input className={cellInputClass} value={item.unidade} onChange={e => atualizarMaterialImportarOs(item.id, { unidade: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={cellInputClass} value={item.quantidade} onChange={e => atualizarMaterialImportarOs(item.id, { quantidade: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={cellInputClass} value={item.pesoFator} onChange={e => atualizarMaterialImportarOs(item.id, { pesoFator: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={cellInputClass} value={item.custoUnit} onChange={e => atualizarMaterialImportarOs(item.id, { custoUnit: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={`${cellInputClass} bg-white/5 cursor-not-allowed`} value={item.valorTotal} readOnly disabled /></td>
                            <td className="px-2 py-2">
                              <select className={cellInputClass} value={item.origemTerceiros} onChange={e => atualizarMaterialImportarOs(item.id, { origemTerceiros: e.target.value as 'Sim' | 'Nao' })}>
                                <option value="Nao">Não</option>
                                <option value="Sim">Sim</option>
                              </select>
                            </td>
                            <td className="px-2 py-2"><input className={cellInputClass} value={item.observacao} onChange={e => atualizarMaterialImportarOs(item.id, { observacao: e.target.value })} /></td>
                            <td className="px-2 py-2 text-center">
                              {formData.importarOs.materiais.length > 1 && (
                                <button type="button" onClick={() => removerMaterialImportarOs(item.id)} className="text-red-300 p-1"><X size={13} /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end mt-3">
                    <div className="bg-[#0b1220] border border-white/10 rounded-lg px-4 py-2.5">
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Subtotal Consumíveis + Materiais</p>
                      <p className="text-amber-400 font-black text-lg text-right">R$ {totalMateriaisImportarOs.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* D - SERVIÇOS TERCEIRIZADOS */}
                <div className="bg-[#101f3d] rounded-2xl border border-white/5 p-6">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase">D - Serviços Terceirizados</h3>
                      <p className="text-white/50 text-xs mt-1">Levante o custo de terceiros necessários para a execução</p>
                    </div>
                    <button type="button" onClick={adicionarTerceirizadoImportarOs} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] rounded-lg font-black text-xs uppercase transition">
                      <Plus size={14} className="inline mr-1" /> Adicionar Terceirizado
                    </button>
                  </div>
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-2 py-2 text-left text-white font-black">Descrição</th>
                          <th className="px-2 py-2 text-left text-white font-black">Unidade</th>
                          <th className="px-2 py-2 text-left text-white font-black">Quantidade</th>
                          <th className="px-2 py-2 text-left text-white font-black">Peso / Fator</th>
                          <th className="px-2 py-2 text-left text-white font-black">Custo Unit.</th>
                          <th className="px-2 py-2 text-left text-white font-black">Valor Total</th>
                          <th className="px-2 py-2 text-left text-white font-black">Observação</th>
                          <th className="px-2 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {formData.importarOs.terceirizados.map(item => (
                          <tr key={item.id} className="border-b border-white/5">
                            <td className="px-2 py-2"><input className={cellInputClass} value={item.descricao} onChange={e => atualizarTerceirizadoImportarOs(item.id, { descricao: e.target.value })} /></td>
                            <td className="px-2 py-2"><input className={cellInputClass} value={item.unidade} onChange={e => atualizarTerceirizadoImportarOs(item.id, { unidade: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={cellInputClass} value={item.quantidade} onChange={e => atualizarTerceirizadoImportarOs(item.id, { quantidade: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={cellInputClass} value={item.pesoFator} onChange={e => atualizarTerceirizadoImportarOs(item.id, { pesoFator: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={cellInputClass} value={item.custoUnit} onChange={e => atualizarTerceirizadoImportarOs(item.id, { custoUnit: e.target.value })} /></td>
                            <td className="px-2 py-2"><input type="number" className={`${cellInputClass} bg-white/5 cursor-not-allowed`} value={item.valorTotal} readOnly disabled /></td>
                            <td className="px-2 py-2"><input className={cellInputClass} value={item.observacao} onChange={e => atualizarTerceirizadoImportarOs(item.id, { observacao: e.target.value })} /></td>
                            <td className="px-2 py-2 text-center">
                              {formData.importarOs.terceirizados.length > 1 && (
                                <button type="button" onClick={() => removerTerceirizadoImportarOs(item.id)} className="text-red-300 p-1"><X size={13} /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end mt-3">
                    <div className="bg-[#0b1220] border border-white/10 rounded-lg px-4 py-2.5">
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Subtotal Serviços Terceirizados</p>
                      <p className="text-amber-400 font-black text-lg text-right">R$ {totalTerceirizadosImportarOs.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* SEÇÃO 2: SERVIÇOS — aviso quando a modalidade é somente Locação */}
              {novoNegocioTab === 'servicos' && !temServico(formData.modalidade) && (
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20 p-6">
                <h3 className="text-lg font-black text-white uppercase mb-3">Serviços a Prestar</h3>
                <div className="bg-[#0b1220] border border-purple-500/30 rounded-xl p-4 text-sm text-purple-200 font-semibold">
                  Esta modalidade é somente Locação. Os serviços ficam desativados e a tabela de locação será montada no Orçamento.
                </div>
              </div>
              )}

              {/* SEÇÃO 2: SERVIÇOS — editor */}
              {novoNegocioTab === 'servicos' && temServico(formData.modalidade) && (
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-white uppercase">Serviços a Prestar *</h3>
                  <button 
                    onClick={handleAddServico}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg font-black text-xs uppercase transition"
                  >
                    <Plus size={16} className="inline mr-2" /> Adicionar Serviço
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.servicos.map((servico, idx) => (
                    <div key={servico.id} className="bg-[#0b1220] p-4 rounded-lg border border-white/5 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-white/70 font-bold text-xs">SERVIÇO {idx + 1}</p>
                        {formData.servicos.length > 1 && (
                          <button 
                            onClick={() => handleRemoveServico(idx)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

<div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className={labelClass}>Tipo *</label>
                          <input
                            type="text"
                            className={inputClass}
                            value={servico.tipo}
                            onChange={e => handleUpdateServico(idx, 'tipo', e.target.value)}
                            placeholder="Ex: Pintura"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className={labelClass}>Local Execução</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.localExecucao}
                            onChange={e => handleUpdateServico(idx, 'localExecucao', e.target.value)}
                            placeholder="Ex: Estaleiro"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Descrição *</label>
                        <textarea 
                          className={`${inputClass} h-20 resize-none`}
                          value={servico.descricao}
                          onChange={e => handleUpdateServico(idx, 'descricao', e.target.value)}
                          placeholder="Descreva o serviço em detalhes"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className={labelClass}>Embarcação</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.embarcacao}
                            onChange={e => handleUpdateServico(idx, 'embarcacao', e.target.value)}
                            placeholder="Nome da embarcação"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className={labelClass}>Porto</label>
                          <input 
                            type="text"
                            className={inputClass}
                            value={servico.porto}
                            onChange={e => handleUpdateServico(idx, 'porto', e.target.value)}
                            placeholder="Porto"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Observações</label>
                        <textarea 
                          className={`${inputClass} h-12 resize-none`}
                          value={servico.observacoes}
                          onChange={e => handleUpdateServico(idx, 'observacoes', e.target.value)}
                          placeholder="Observações adicionais"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* SEÇÃO: ALOCAÇÃO — aviso quando a modalidade é somente Serviço */}
              {novoNegocioTab === 'alocacao' && !temLocacao(formData.modalidade) && (
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20 p-6">
                <h3 className="text-lg font-black text-white uppercase mb-3">Itens a Alocar</h3>
                <div className="bg-[#0b1220] border border-cyan-500/30 rounded-xl p-4 text-sm text-cyan-200 font-semibold">
                  Esta modalidade é somente Serviço. A alocação fica disponível para Locação ou Locação + Serviço.
                </div>
              </div>
              )}

              {/* SEÇÃO: ALOCAÇÃO — editor de itens */}
              {novoNegocioTab === 'alocacao' && temLocacao(formData.modalidade) && (
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20 p-6">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-lg font-black text-white uppercase">Itens a Alocar *</h3>
                  <button
                    onClick={handleAddItemAlocacao}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-black text-xs uppercase transition"
                  >
                    <Plus size={16} className="inline mr-2" /> Adicionar Item
                  </button>
                </div>
                <p className="text-white/50 text-xs mb-4">Materiais e equipamentos previstos para esta locação.</p>

                <div className="space-y-3">
                  {(formData.itensAlocacao || []).length === 0 && (
                    <p className="text-white/40 text-sm">Nenhum item adicionado. Clique em "Adicionar Item".</p>
                  )}
                  {(formData.itensAlocacao || []).map((item, idx) => (
                    <div key={item.id} className="bg-[#0b1220] p-4 rounded-lg border border-white/5">
                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-6 space-y-1.5">
                          <label className={labelClass}>Descrição *</label>
                          <input
                            type="text"
                            className={inputClass}
                            value={item.equipamento}
                            onChange={e => handleUpdateItemAlocacao(idx, 'equipamento', e.target.value)}
                            placeholder="Descreva o item a alocar"
                          />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <label className={labelClass}>Unidade</label>
                          <input
                            className={inputClass}
                            value={item.unidade}
                            onChange={e => handleUpdateItemAlocacao(idx, 'unidade', e.target.value)}
                            placeholder="un"
                          />
                        </div>
                        <div className="col-span-3 space-y-1.5">
                          <label className={labelClass}>Quantidade</label>
                          <input
                            type="number"
                            min="0"
                            className={inputClass}
                            value={item.quantidade}
                            onChange={e => handleUpdateItemAlocacao(idx, 'quantidade', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center pb-1">
                          <button
                            onClick={() => handleRemoveItemAlocacao(idx)}
                            className="p-2 hover:bg-red-500/20 rounded text-red-400"
                            title="Remover"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {novoNegocioTab === 'documentos' && (
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-black text-white uppercase mb-1">Documentos do Negócio</h3>
                  <p className="text-white/60 text-xs">Anexe PDFs e CSVs que devem acompanhar o negócio até a finalização.</p>
                </div>

                <div className="bg-[#0b1220] rounded-xl border border-white/10 p-4 space-y-3">
                  <input
                    type="file"
                    accept=".pdf,.csv,application/pdf,text/csv,application/vnd.ms-excel"
                    multiple
                    onChange={(e) => {
                      handleUploadDocumentosNegocio(e.target.files);
                      e.currentTarget.value = '';
                    }}
                    className="w-full text-xs text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-[11px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-amber-400"
                  />
                  <p className="text-[11px] text-white/40">Formatos permitidos: PDF e CSV.</p>
                </div>

                <div className="space-y-2">
                  {formData.documentosNegocio.length > 0 ? (
                    formData.documentosNegocio.map((doc) => (
                      <div key={doc.id} className="bg-[#0b1220] rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{doc.nome}</p>
                          <p className="text-white/40 text-xs">{formatFileSize(doc.tamanho)} • {new Date(doc.dataUpload).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <button
                          onClick={() => handleRemoverDocumentoNegocio(doc.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-black uppercase transition"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="bg-[#0b1220] rounded-lg border border-dashed border-white/15 p-6 text-center">
                      <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Nenhum documento anexado</p>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Botões */}
              <div className="flex gap-4 pt-6 border-t border-white/5 flex-wrap">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30"
                >
                  Criar Negócio
                </button>
                <button 
                  onClick={() => setShowFormNovoNegocio(false)}
                  className="px-12 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - DETALHES DA OBRA */}
      {showDetalhesObraModal && selectedObraDetalhes && (() => {
        const idProjetoDetalhes = formatarIdCard(selectedObraDetalhes);

        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="sticky top-0 z-40 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Detalhes do Negócio</h2>
                <p className="text-white/50 text-sm mt-2">{selectedObraDetalhes.nome} {idProjetoDetalhes && <span className="text-cyan-400">• {idProjetoDetalhes}</span>}</p>
              </div>
              <button 
                onClick={() => setShowDetalhesObraModal(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              
              {/* Informações Básicas */}
              <div className="bg-[#0b1220] rounded-xl p-4 border border-white/5 space-y-3">
                <h3 className="text-white font-black">INFORMAÇÕES BÁSICAS</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/50 text-xs mb-1">Cliente</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold">
                        {listaClientesCRM.find(c => String(c.id) === String(selectedObraDetalhes.clienteId))?.razaoSocial
                          || <span className="text-white/30 italic font-normal">Cliente não encontrado no cadastro</span>}
                      </p>
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('mudarTelaERP', { detail: 'clientes' }))}
                        className="text-cyan-400 hover:text-cyan-300 text-[10px] font-black uppercase tracking-widest underline underline-offset-2 flex-shrink-0"
                        title="Ir para Base de Clientes para reeditar o cadastro"
                      >
                        Editar cadastro
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Responsável</p>
                    <p className="text-white font-bold">{selectedObraDetalhes.responsavelComercial || selectedObraDetalhes.solicitante}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Categoria</p>
                    <p className="text-amber-400 font-black">{selectedObraDetalhes.categoria}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Data da Solicitação</p>
                    <p className="text-white font-bold">
                      {selectedObraDetalhes.dataSolicitacao
                        ? formatDateBR(selectedObraDetalhes.dataSolicitacao)
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Serviços */}
              {selectedObraDetalhes.servicos && selectedObraDetalhes.servicos.length > 0 && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20 space-y-3">
                  <h3 className="text-purple-400 font-black">SERVIÇOS ({selectedObraDetalhes.servicos.length})</h3>
                  <div className="space-y-3">
                    {selectedObraDetalhes.servicos.map((servico: any, idx: number) => (
                      <div key={idx} className="bg-[#0b1220] rounded-xl border border-purple-500/20 overflow-hidden">
                        <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20">
                          <span className="text-purple-300 font-black text-xs uppercase tracking-widest">
                            Serviço {selectedObraDetalhes.servicos.length > 1 ? idx + 1 : ''}
                          </span>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                          {[
                            ['Tipo',           servico.tipo          || servico.tipo_servico],
                            ['Local de Execução', servico.localExecucao || servico.local_execucao],
                            ['Embarcação',     servico.embarcacao],
                            ['Porto',          servico.porto],
                            ['Descrição',      servico.descricao],
                            ['Observações',    servico.observacoes   || servico.observacao],
                          ].map(([label, value]) => (
                            <div key={label as string} className={label === 'Descrição' || label === 'Observações' ? 'col-span-2' : ''}>
                              <p className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-0.5">{label}</p>
                              <p className="text-white/80 text-xs font-semibold whitespace-pre-wrap">{(value as string) || <span className="text-white/20 italic font-normal">—</span>}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(selectedObraDetalhes.documentosNegocio) && selectedObraDetalhes.documentosNegocio.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20 space-y-3">
                  <h3 className="text-amber-400 font-black">DOCUMENTOS ANEXADOS ({selectedObraDetalhes.documentosNegocio.length})</h3>
                  <div className="space-y-2">
                    {selectedObraDetalhes.documentosNegocio.map((doc: any) => (
                      <div key={doc.id || doc.nome} className="bg-[#0b1220] rounded-lg p-3 border border-white/5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                          <p className="text-white/40 text-xs">{doc.tamanho ? formatFileSize(doc.tamanho) : 'Tamanho não informado'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleVerDocumentoNegocio(doc)}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                          >
                            Ver
                          </button>
                          <button
                            onClick={() => handleDownloadDocumento(doc)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-black uppercase transition"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RESUMO DO ORÇAMENTO (Colapsável) */}
              {selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (() => {
                const ultimoOrcamento = selectedObraDetalhes.orcamentos[selectedObraDetalhes.orcamentos.length - 1];
                return (
                  <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl p-6 border border-emerald-500/30 space-y-4">
                    <button
                      onClick={() => setExpandedOrcamentoSummary(!expandedOrcamentoSummary)}
                      className="w-full flex justify-between items-center mb-4"
                    >
                      <h3 className="text-emerald-400 font-black text-lg">RESUMO DO ORÇAMENTO (v{formatarVersaoOrcamento(ultimoOrcamento.versao)})</h3>
                      <ChevronDown size={20} className={`text-emerald-400 transition-transform ${expandedOrcamentoSummary ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Resumo Financeiro (Sempre Visível) */}
                    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-4 border border-amber-500/30 space-y-2">
                      {(() => {
                        const base = safeNumber(ultimoOrcamento.valores.totalBruto ?? ultimoOrcamento.valores.subtotal);
                        const margemPercent = safeNumber(ultimoOrcamento.valores.margem);
                        const ohPercent = safeNumber(ultimoOrcamento.valores.oh);
                        const impostosPercent = safeNumber(ultimoOrcamento.valores.impostos);
                        const valorMargem = safeNumber(ultimoOrcamento.valores.valorMargem ?? ((base * margemPercent) / 100));
                        const valorOH = safeNumber(ultimoOrcamento.valores.valorOH ?? ((base * ohPercent) / 100));
                        const semImposto = safeNumber(ultimoOrcamento.valores.totalSemImposto ?? (base + valorMargem + valorOH));
                        const valorImposto = safeNumber(ultimoOrcamento.valores.valorImpostos ?? ((semImposto * impostosPercent) / 100));
                        const precoFinal = safeNumber(ultimoOrcamento.valores.precoFinal);
                        return (
                          <>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">Total Bruto:</span>
                        <span className="text-white font-black">R$ {base.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">Margem ({ultimoOrcamento.valores.margem}%):</span>
                        <span className="text-white font-black">R$ {valorMargem.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-white font-bold">O.H ({ohPercent}%):</span>
                        <span className="text-white font-black">R$ {valorOH.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-amber-500/20 mb-3">
                        <span className="text-white font-bold">Impostos ({ultimoOrcamento.valores.impostos}%):</span>
                        <span className="text-white font-black">R$ {valorImposto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-amber-300 font-black text-lg">TOTAL S/ IMPOSTO:</span>
                        <span className="text-amber-300 font-black text-2xl">R$ {semImposto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-amber-300 font-black text-lg">PREÇO FINAL:</span>
                        <span className="text-amber-300 font-black text-2xl">R$ {precoFinal.toFixed(2)}</span>
                      </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Detalhes Completos (Expandido) */}
                    {expandedOrcamentoSummary && (
                      <div className="space-y-4">
                        {/* Dados do Orçamento */}
                        <div className="bg-[#0b1220] rounded-lg p-4 grid grid-cols-3 gap-4 text-sm border border-white/5">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Número</p>
                          <p className="text-white font-black">{ultimoOrcamento.numeroOrcamento}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Solicitante</p>
                          <p className="text-white font-bold">{ultimoOrcamento.data.solicitante || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Responsável Comercial</p>
                          <p className="text-white font-bold">{ultimoOrcamento.data.responsavelComercial || '−'}</p>
                        </div>
                      </div>

                      {/* Mão de Obra */}
                      {ultimoOrcamento.data.maoDeObra && ultimoOrcamento.data.maoDeObra.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">MÃO DE OBRA</h4>
                          <div className="space-y-1 text-xs">
                            {ultimoOrcamento.data.maoDeObra.map((item: any, idx: number) => (
                              item.funcao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.funcao} ({item.quantidade}x {item.dias}d)</span>
                                  <span className="text-white font-bold">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm font-black">
                            <span className="text-white">Total:</span>
                            <span className="text-emerald-400">R$ {(ultimoOrcamento.data.maoDeObra.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Materiais */}
                      {ultimoOrcamento.data.materiais && ultimoOrcamento.data.materiais.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">MATERIAIS</h4>
                          <div className="space-y-1 text-xs">
                            {ultimoOrcamento.data.materiais.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm font-black">
                            <span className="text-white">Total:</span>
                            <span className="text-cyan-400">R$ {(ultimoOrcamento.data.materiais.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Terceirizados */}
                      {ultimoOrcamento.data.terceirizados && ultimoOrcamento.data.terceirizados.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">SERVIÇOS TERCEIRIZADOS</h4>
                          <div className="space-y-1 text-xs">
                            {ultimoOrcamento.data.terceirizados.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-sm font-black">
                            <span className="text-white">Total:</span>
                            <span className="text-orange-400">R$ {(ultimoOrcamento.data.terceirizados.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Botões do Orçamento */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleDownloadOrcamentoPDF}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} /> Download PDF
                      </button>
                      <button
                        onClick={() => setShowOrcamentoFullModal(true)}
                        className="flex-1 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-300 hover:text-emerald-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={16} /> Ver Completo
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* RESUMO DA PROPOSTA (Negociacao, Em Andamento e Finalizacao) */}
              {['Negociação', 'Em Andamento', 'Finalização'].includes(selectedObraDetalhes.categoria) && selectedObraDetalhes.propostas && selectedObraDetalhes.propostas.length > 0 && (() => {
                const ultimaProposta = selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1];
                const isNegociacao = selectedObraDetalhes.categoria === 'Negociação';
                const documentoClienteAssinado = selectedObraDetalhes.documentoClienteAssinado;
                const possuiDocumentoCliente = Boolean(documentoClienteAssinado?.conteudo || documentoClienteAssinado?.url);
                return (
                  <div className={`rounded-xl p-6 border space-y-4 ${
                    ultimaProposta.status === 'pendente' 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : ultimaProposta.status === 'aceita'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-black text-lg">
                        {ultimaProposta.status === 'pendente' && 'PROPOSTA'}
                        {ultimaProposta.status === 'aceita' && 'PROPOSTA ACEITA'}
                        {ultimaProposta.status === 'recusada' && 'PROPOSTA RECUSADA'}
                      </h3>
                      <span className="text-white font-black text-sm">v{ultimaProposta.versao || ultimaProposta.numeroProposta?.match(/[A-Z]+$/)?.[0] || 'A'}</span>
                    </div>
                    
                    <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-3 text-sm">
                      <div>
                        <p className="text-white/50 text-xs mb-1">Status</p>
                        <div className={`px-3 py-1.5 rounded-full w-fit ${
                          ultimaProposta.status === 'pendente' 
                            ? 'bg-amber-500/20 border border-amber-500/40' 
                            : ultimaProposta.status === 'aceita'
                            ? 'bg-emerald-500/20 border border-emerald-500/40'
                            : 'bg-red-500/20 border border-red-500/40'
                        }`}>
                          <span className={`text-xs font-black ${
                            ultimaProposta.status === 'pendente' 
                              ? 'text-amber-300' 
                              : ultimaProposta.status === 'aceita'
                              ? 'text-emerald-300'
                              : 'text-red-300'
                          }`}>
                            {ultimaProposta.status === 'pendente' && 'Pendente'}
                            {ultimaProposta.status === 'aceita' && 'Aceita'}
                            {ultimaProposta.status === 'recusada' && 'Recusada'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-white/50 text-xs mb-1">Número da Proposta</p>
                        <p className="text-white font-bold">{ultimaProposta.numeroProposta}</p>
                      </div>

                      <div>
                        <p className="text-white/50 text-xs mb-1">Data de Criação</p>
                        <p className="text-white font-bold">{formatDateBR(ultimaProposta.dataCriacao)}</p>
                      </div>

                      {ultimaProposta.preco && (
                        <div>
                          <p className="text-white/50 text-xs mb-1">Preço</p>
                          <p className="text-white font-bold">{ultimaProposta.preco}</p>
                        </div>
                      )}

                      {ultimaProposta.prazo && (
                        <div>
                          <p className="text-white/50 text-xs mb-1">Prazo</p>
                          <p className="text-white font-bold">{ultimaProposta.prazo}</p>
                        </div>
                      )}

                      {ultimaProposta.assunto && (
                        <div>
                          <p className="text-white/50 text-xs mb-1">Assunto</p>
                          <p className="text-white font-bold">{ultimaProposta.assunto}</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-white font-black text-sm">Documento do Cliente</p>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-500/20 border border-slate-500/40 text-slate-300">
                          Opcional
                        </span>
                      </div>

                      {isNegociacao && (
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                          onChange={(e) => {
                            handleUploadDocumentoClienteAssinado(selectedObraDetalhes, e.target.files);
                            e.currentTarget.value = '';
                          }}
                          className="w-full text-xs text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-[11px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-amber-400"
                        />
                      )}

                      {documentoClienteAssinado && (
                        <div className="bg-[#101f3d] rounded-lg border border-white/10 p-3 space-y-2">
                          <p className="text-white text-xs font-bold truncate">{documentoClienteAssinado.nome}</p>
                          <p className="text-white/50 text-[11px]">{documentoClienteAssinado.tamanho ? formatFileSize(documentoClienteAssinado.tamanho) : 'Tamanho não informado'}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVerDocumentoNegocio(documentoClienteAssinado)}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-[11px] font-black uppercase transition"
                            >
                              <Eye size={13} className="inline mr-1" /> Ver
                            </button>
                            <button
                              onClick={() => handleDownloadDocumento(documentoClienteAssinado)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase transition"
                            >
                              <Download size={13} className="inline mr-1" /> Download
                            </button>
                            {isNegociacao && (
                              <button
                                onClick={() => handleRemoverDocumentoClienteAssinado(selectedObraDetalhes)}
                                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-[11px] font-black uppercase transition"
                              >
                                <X size={13} className="inline mr-1" /> Remover
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {isNegociacao ? (
                        <p className="text-[11px] text-white/40">
                          O início do trabalho depende apenas de proposta aceita.
                        </p>
                      ) : (
                        <p className="text-[11px] text-white/40">
                          Em andamento: visualização da proposta e dos documentos do negócio.
                        </p>
                      )}
                    </div>

                    {/* Botões de Ação da Proposta */}
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={handleGerarPropostaPDF}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} /> Download PDF
                      </button>
                      <button
                        onClick={() => setShowPropostaFullModal(true)}
                        className="flex-1 bg-white/10 hover:bg-white/15 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={16} /> Ver Mais
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* SECAO OS - Em Andamento e Finalizacao */}
              {['Em Andamento', 'Finalização'].includes(selectedObraDetalhes.categoria) && (() => {
                const osDoNegocio = (os || []).filter((o: any) => o.obraId === selectedObraDetalhes.id);
                if (osDoNegocio.length === 0) return null;
                
                const osEnviada = osDoNegocio.some((o: any) => o.statusEnvio === 'enviada');
                const osProntaFinalizacao = osDoNegocio.some((o: any) =>
                  o.statusEnvio === 'enviada'
                  && o.statusAprovacao === 'aprovada'
                );
                return (
                  <div className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl p-6 border border-purple-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-purple-400 font-black text-lg">ORDEM DE SERVIÇO ({osDoNegocio.length})</h3>
                      <div className="flex items-center gap-2">
                        {osProntaFinalizacao ? (
                          <span className="px-2 py-0.5 bg-emerald-500/30 border border-emerald-500/50 rounded-full text-emerald-300 text-[10px] font-black">Pronta p/ Finalização</span>
                        ) : osEnviada ? (
                          <span className="px-2 py-0.5 bg-green-500/30 border border-green-500/50 rounded-full text-green-300 text-[10px] font-black">{boldOS('OS Enviada')}</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/30 border border-amber-500/50 rounded-full text-amber-300 text-[10px] font-black">{boldOS('Aguard. OS')}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {osDoNegocio.map((osbatch: any, idx: number) => (
                        <div key={idx} className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-white font-black text-sm mb-1">OS #{idx + 1}: {osbatch.tipo}</p>
                              <p className="text-white/70 text-xs mb-2">{osbatch.local || osbatch.localExecucao}</p>
                            </div>
                            <span className="text-xs text-white/50">{osbatch.dataCriacao}</span>
                          </div>
                          <p className="text-white/70 text-xs">{osbatch.descricao}</p>

                          {osbatch.statusEnvio === 'enviada' && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${osbatch.statusAprovacao === 'aprovada' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}>
                                  {osbatch.statusAprovacao === 'aprovada' ? 'OS Aprovada' : 'OS Pendente'}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${(osbatch.documentoAssinaturaAprovacao?.conteudo || osbatch.documentoAssinaturaAprovacao?.url) ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-red-500/20 border-red-500/40 text-red-300'}`}>
                                  {(osbatch.documentoAssinaturaAprovacao?.conteudo || osbatch.documentoAssinaturaAprovacao?.url) ? 'Assinatura Anexada' : 'Sem Assinatura'}
                                </span>
                              </div>
                              {/* Anexar assinatura e aprovar a OS agora é feito em Comercial → Fazer OS
                                  (na tela "Ver OS"), não mais por aqui — evita duplicar a mesma ação
                                  em dois lugares diferentes. */}
                              <p className="text-white/35 text-[10px] uppercase tracking-widest font-bold">
                                Anexe a assinatura e aprove em {boldOS('Fazer OS')} → Ver OS.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Botões de Ação para OS */}
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={() => setShowOSFullModal(true)}
                        className="flex-1 bg-gradient-to-r from-purple-500/30 to-purple-600/30 hover:from-purple-500/50 hover:to-purple-600/50 border border-purple-400/40 text-purple-300 hover:text-purple-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={16} /> Ver OS
                      </button>
                      {Array.isArray(selectedObraDetalhes.orcamentos) && selectedObraDetalhes.orcamentos.length > 0 && (
                        <button
                          onClick={() => setShowOrcamentoFullModal(true)}
                          className="flex-1 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-300 hover:text-emerald-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Eye size={16} /> Ver Orçamento
                        </button>
                      )}
                      <button
                        onClick={handleDownloadOSPDF}
                        className="flex-1 bg-gradient-to-r from-blue-500/30 to-blue-600/30 hover:from-blue-500/50 hover:to-blue-600/50 border border-blue-400/40 text-blue-300 hover:text-blue-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} /> Download
                      </button>
                      {!osEnviada && (
                        <button
                          onClick={() => handleEnviarOS()}
                          className="flex-1 bg-gradient-to-r from-green-500/30 to-emerald-600/30 hover:from-green-500/50 hover:to-emerald-600/50 border border-green-400/40 text-green-300 hover:text-green-200 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={16} /> Enviar OS
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-white/50">
                      Para avançar para Finalização: a OS precisa estar enviada e aprovada.
                    </p>

                    {selectedObraDetalhes.categoria === 'Finalização' && (() => {
                      const medApr = medicaoAprovadaDe(selectedObraDetalhes);
                      return medApr ? (
                        <button
                          onClick={() => handleBaixarMedicaoAprovada(medApr)}
                          className="w-full bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/40 text-emerald-300 hover:text-emerald-100 rounded-lg py-2.5 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <FileText size={16} /> Baixar Documento de Medição
                        </button>
                      ) : (
                        <p className="text-[11px] text-white/40">A medição é feita na aba <b className="text-emerald-300">Comercial → Medição</b> e precisa ser aprovada.</p>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* SEÇÃO FINALIZAÇÃO — dados da medição + download */}
              {selectedObraDetalhes.dadosMediacao && (() => {
                const dm = selectedObraDetalhes.dadosMediacao;
                const docMediacao = (Array.isArray(selectedObraDetalhes.documentosNegocio)
                  ? selectedObraDetalhes.documentosNegocio
                  : []
                ).filter((d: any) => {
                  const id = String(d?.id || '').toLowerCase();
                  const nome = String(d?.nome || '').toLowerCase();
                  return id.includes('mediacao') || nome.includes('medi');
                }).sort((a: any, b: any) =>
                  new Date(b?.dataUpload || 0).getTime() - new Date(a?.dataUpload || 0).getTime()
                )[0] || null;

                return (
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-6 border border-amber-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-amber-400 font-black text-lg">FINALIZAÇÃO / MEDIÇÃO</h3>
                      <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-[10px] font-black uppercase">
                        {selectedObraDetalhes.status || 'Finalizado'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        ['Empresa', dm.empresa],
                        ['Cliente', dm.cliente],
                        ['CNPJ', dm.cnpj],
                        ['Embarcação', dm.embarcacao],
                        ['Número BM', dm.numeroBM],
                        ['Período', dm.periodo],
                        ['Data Emissão', dm.dataEmissao],
                        ['Rep. Cliente', dm.representanteCliente],
                        ['Rep. Linave', dm.representanteLinave],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label as string}>
                          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">{label}</p>
                          <p className="text-white font-bold text-xs">{value}</p>
                        </div>
                      ))}
                    </div>

                    {Array.isArray(dm.tabelaItens) && dm.tabelaItens.length > 0 && (
                      <div>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Itens Medidos</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-white/40 border-b border-white/10">
                                <th className="text-left pb-1 pr-3 font-bold">Descrição</th>
                                <th className="text-center pb-1 pr-3 font-bold">Unid.</th>
                                <th className="text-right pb-1 pr-3 font-bold">Qtd Prev.</th>
                                <th className="text-right pb-1 pr-3 font-bold">Qtd Real.</th>
                                <th className="text-right pb-1 font-bold">Val. Unit.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dm.tabelaItens.map((item: any, i: number) => (
                                <tr key={item.id || i} className="border-b border-white/5 text-white/70">
                                  <td className="py-1.5 pr-3">{item.descricao || '-'}</td>
                                  <td className="py-1.5 pr-3 text-center">{item.unidade || '-'}</td>
                                  <td className="py-1.5 pr-3 text-right">{item.quantidadePrevista || '-'}</td>
                                  <td className="py-1.5 pr-3 text-right">{item.quantidadeRealizada || '-'}</td>
                                  <td className="py-1.5 text-right">{item.valorUnitario || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {Array.isArray(dm.tabelaRecursos) && dm.tabelaRecursos.length > 0 && (
                      <div>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Recursos</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-white/40 border-b border-white/10">
                                <th className="text-left pb-1 pr-3 font-bold">Função</th>
                                <th className="text-right pb-1 pr-3 font-bold">Período</th>
                                <th className="text-right pb-1 font-bold">Horas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dm.tabelaRecursos.map((rec: any, i: number) => (
                                <tr key={rec.id || i} className="border-b border-white/5 text-white/70">
                                  <td className="py-1.5 pr-3">{rec.funcao || '-'}</td>
                                  <td className="py-1.5 pr-3 text-right">{rec.periodo || '-'}</td>
                                  <td className="py-1.5 text-right">{rec.horas || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {docMediacao && (
                      <div className="flex gap-3 pt-3 border-t border-white/10">
                        <button
                          onClick={() => handleVerDocumentoNegocio(docMediacao)}
                          className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Eye size={14} /> Ver PDF
                        </button>
                        <button
                          onClick={() => handleDownloadDocumento(docMediacao)}
                          className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg py-2 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Download size={14} /> Download
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Botões de Ação */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                {selectedObraDetalhes.categoria === 'Planejamento' && selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (
                  <>
                    <button 
                      onClick={handleAprovarOrcamento}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} /> Aprovar Orçamento
                    </button>
                    <button 
                      onClick={handleRecusarOrcamento}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                    >
                      <X size={18} /> Recusar Orçamento
                    </button>
                  </>
                )}
                {selectedObraDetalhes.categoria === 'Negociação' && selectedObraDetalhes.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (() => {
                  const ultimaProposta = Array.isArray(selectedObraDetalhes.propostas) && selectedObraDetalhes.propostas.length > 0
                    ? selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1]
                    : null;
                  const podeIniciar = ultimaProposta?.status === 'aceita';

                  if (!podeIniciar) return null;

                  return (
                    <button 
                      onClick={handleAprovarOrcamento}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                    >
                      <Zap size={18} /> Aprovar e Iniciar
                    </button>
                  );
                })()}
                {selectedObraDetalhes.categoria === 'Em Andamento' && (() => {
                  const podeFinalizar = possuiOSAprovadaParaFinalizacao(selectedObraDetalhes.id);
                  return (
                    <button
                      onClick={handleAvancarParaFinalizacao}
                      disabled={!podeFinalizar}
                      className={`flex-1 py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${podeFinalizar
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-emerald-900/30'
                        : 'bg-white/10 text-white/40 cursor-not-allowed shadow-transparent'}`}
                    >
                      <CheckCircle size={18} /> Avançar para Finalização
                    </button>
                  );
                })()}
                <button 
                  onClick={() => setShowDetalhesObraModal(false)}
                  className="flex-1 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* MODAL - DOCUMENTO DE MEDIÇÃO */}
      {showDocumentoMediacaoModal && documentoMediacaoForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-emerald-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">DOCUMENTO DE MEDIÇÃO</h2>
                <p className="text-white/60 text-sm mt-2">Preencha os dados para gerar a medição do período.</p>
              </div>
              <button
                onClick={() => setShowDocumentoMediacaoModal(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Empresa</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.empresa}
                    readOnly
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Cliente</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.cliente}
                    readOnly
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">CNPJ</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.cnpj}
                    readOnly
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Data de emissão</p>
                  <input
                    type="date"
                    value={documentoMediacaoForm.dataEmissao}
                    onChange={(e) => atualizarCampoMediacao('dataEmissao', e.target.value)}
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Embarcação</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.embarcacao}
                    onChange={(e) => atualizarCampoMediacao('embarcacao', e.target.value)}
                    placeholder="Preencher"
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30"
                  />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Nr. BM</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.numeroBM}
                    onChange={(e) => atualizarCampoMediacao('numeroBM', e.target.value)}
                    placeholder="Vazio"
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Período</p>
                  <input
                    type="text"
                    value={documentoMediacaoForm.periodo}
                    onChange={(e) => atualizarCampoMediacao('periodo', e.target.value)}
                    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <div className="col-span-1">
  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Representante Cliente</p>
  <input
    type="text"
    value={documentoMediacaoForm.representanteCliente}
    onChange={(e) => atualizarCampoMediacao('representanteCliente', e.target.value)}
    placeholder="Ex: Nome do Armador / Cliente"
    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30"
  />
</div>

<div className="col-span-1">
  <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Representante Linave</p>
  <input
    type="text"
    value={documentoMediacaoForm.representanteLinave}
    onChange={(e) => atualizarCampoMediacao('representanteLinave', e.target.value)}
    placeholder="Ex: Nome do Responsável Linave"
    className="w-full bg-[#101f3d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30"
  />
</div>

              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-emerald-300 text-lg font-black uppercase">Tabela de Medição de Serviços</h3>
                  <button
                    onClick={adicionarLinhaTabelaItens}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-black uppercase"
                  >
                    + Linha
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 text-white/70 uppercase tracking-wider">
                        <th className="border border-white/10 px-3 py-2 text-left">Item</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Descrição</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Unidade</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Quantidade produzida</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Valor / unidade</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Total</th>
                        <th className="border border-white/10 px-3 py-2 text-left">Observações</th>
                        <th className="border border-white/10 px-3 py-2 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentoMediacaoForm.tabelaItens.map((linha) => (
                        <tr key={linha.id} className="text-white">
                          <td className="border border-white/10 p-1.5"><input value={linha.item} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'item', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.descricao} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'descricao', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.unidade} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'unidade', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.quantidadeProduzida} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'quantidadeProduzida', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.valorUnitario} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'valorUnitario', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.total} readOnly className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1 text-emerald-300 font-black" /></td>
                          <td className="border border-white/10 p-1.5"><input value={linha.observacoes} onChange={(e) => atualizarLinhaTabelaItens(linha.id, 'observacoes', e.target.value)} className="w-full bg-[#101f3d] border border-white/10 rounded px-2 py-1" /></td>
                          <td className="border border-white/10 p-1.5 text-center">
                            <button
                              onClick={() => removerLinhaTabelaItens(linha.id)}
                              className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300"
                            >
                              <X size={12} className="inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-[#101f3d] rounded-xl border border-white/10 p-4">
                    <p className="text-white/50 text-xs mb-1 uppercase font-black tracking-widest">Total da medição</p>
                    <p className="text-emerald-300 font-black text-lg">
                      {`R$ ${formatDecimal(documentoMediacaoForm.tabelaItens.reduce((total, linha) => total + parseDecimal(linha.total), 0))}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2 border-t border-white/10">
                <button
                  onClick={handleGerarDocumentoMediacao}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black uppercase text-sm tracking-widest"
                >
                  <Download size={16} className="inline mr-2" /> Gerar Documento de Medição
                </button>
                <button
                  onClick={() => setShowDocumentoMediacaoModal(false)}
                  className="px-8 py-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-black uppercase text-sm tracking-widest"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - PREVIEW DE DOCUMENTO */}
      {showDocumentoPreviewModal && documentoVisualizado && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 backdrop-blur-md p-6 border-b border-white/10 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-white truncate">{documentoVisualizado.nome || 'Documento'}</h2>
                <p className="text-white/60 text-sm mt-2 truncate">{documentoVisualizado.tipo || 'Tipo não informado'}</p>
              </div>
              <button
                onClick={() => {
                  setShowDocumentoPreviewModal(false);
                  setDocumentoVisualizado(null);
                }}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10 shrink-0"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-0 max-h-[calc(92vh-92px)]">
              <div className="bg-[#0b1220] border-r border-white/10 min-h-[60vh]">
                <iframe
                  title={documentoVisualizado.nome || 'Documento'}
                  src={documentoVisualizado.href}
                  className="w-full h-[70vh] lg:h-[calc(92vh-92px)] bg-white"
                />
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-92px)]">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-white/50 text-xs uppercase font-black tracking-widest">Informações</p>
                  <div className="text-sm space-y-1">
                    <p className="text-white"><span className="text-white/50">Nome:</span> {documentoVisualizado.nome || '-'}</p>
                    <p className="text-white"><span className="text-white/50">Tipo:</span> {documentoVisualizado.tipo || '-'}</p>
                    <p className="text-white"><span className="text-white/50">Tamanho:</span> {documentoVisualizado.tamanho ? formatFileSize(documentoVisualizado.tamanho) : 'Não informado'}</p>
                    <p className="text-white"><span className="text-white/50">Data:</span> {documentoVisualizado.dataUpload ? new Date(documentoVisualizado.dataUpload).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase font-black tracking-widest mb-2">Ações</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleDownloadDocumento(documentoVisualizado)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={16} /> Download
                    </button>
                    <button
                      onClick={() => {
                        setShowDocumentoPreviewModal(false);
                        setDocumentoVisualizado(null);
                      }}
                      className="w-full bg-white/10 hover:bg-white/15 text-white py-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - PROPOSTA COMPLETA */}
      {showPropostaFullModal && selectedObraDetalhes?.propostas && selectedObraDetalhes.propostas.length > 0 && (() => {
        const ultimaProposta = selectedObraDetalhes.propostas[selectedObraDetalhes.propostas.length - 1];
        const cliente = listaClientesCRM.find(c => String(c.id) === String(selectedObraDetalhes.clienteId));
        const idProjetoModal = extrairIdProjetoDoNumero(ultimaProposta.numeroProposta || '');
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              
              <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">PROPOSTA COMERCIAL - DETALHES COMPLETOS</h2>
                  <p className="text-white/50 text-sm mt-2">Versão {ultimaProposta.versao || ultimaProposta.numeroProposta?.match(/[A-Z]+$/)?.[0] || 'A'} • {ultimaProposta.numeroProposta}</p>
                </div>
                <button 
                  onClick={() => setShowPropostaFullModal(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={24} className="text-white/60" />
                </button>
              </div>

              <div className="p-8 space-y-6">

                {/* Informações Básicas */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">INFORMAÇÕES BÁSICAS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cliente</p>
                      <p className="text-white font-bold">{listaClientesCRM.find(c => String(c.id) === String(selectedObraDetalhes.clienteId))?.razaoSocial}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Negócio</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.nome} {idProjetoModal && <span className="text-cyan-400">• {idProjetoModal}</span>}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Status</p>
                      <div className={`px-3 py-1 rounded-full w-fit ${
                        ultimaProposta.status === 'pendente' 
                          ? 'bg-amber-500/20 border border-amber-500/40' 
                          : ultimaProposta.status === 'aceita'
                          ? 'bg-emerald-500/20 border border-emerald-500/40'
                          : 'bg-red-500/20 border border-red-500/40'
                      }`}>
                        <span className={`text-xs font-black ${
                          ultimaProposta.status === 'pendente' 
                            ? 'text-amber-300' 
                            : ultimaProposta.status === 'aceita'
                            ? 'text-emerald-300'
                            : 'text-red-300'
                        }`}>
                          {ultimaProposta.status === 'pendente' && 'Pendente'}
                          {ultimaProposta.status === 'aceita' && 'Aceita'}
                          {ultimaProposta.status === 'recusada' && 'Recusada'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Data de Criação</p>
                      <p className="text-white font-bold">{formatDateBR(ultimaProposta.dataCriacao)}</p>
                    </div>
                  </div>
                </div>

                {/* Contato e Referências */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">CONTATO E REFERÊNCIAS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Atribuído A</p>
                      <p className="text-white font-bold">{ultimaProposta.atribuidoA}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cargo</p>
                      <p className="text-white font-bold">{ultimaProposta.cargoContato}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-white/50 text-xs mb-1">Referência</p>
                      <p className="text-white font-bold">{ultimaProposta.referencia || '−'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-white/50 text-xs mb-1">Saudação</p>
                      <p className="text-white">{ultimaProposta.saudacao || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Assunto e Abertura */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">ASSUNTO E ABERTURA</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Assunto</p>
                      <p className="text-white font-bold">{ultimaProposta.assunto || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Texto de Abertura</p>
                      <p className="text-white whitespace-pre-wrap">{ultimaProposta.textoAbertura || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Escopos */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                  <h3 className="text-white font-black text-lg">ESCOPOS DE SERVIÇOS</h3>
                  <div>
                    <p className="text-white/50 text-xs mb-2 font-black">A - Escopo Básico de Serviços</p>
                    {(() => {
                      const itensEscopo = normalizarEscopoBasicoEstruturado(ultimaProposta.escopoBasicoServicos || ultimaProposta.escopoA);
                      if (itensEscopo.length === 0) {
                        return <p className="text-white whitespace-pre-wrap text-sm">−</p>;
                      }

                      return (
                        <div className="space-y-4">
                          {itensEscopo.map((item: any, index: number) => (
                            <div key={`escopo-${index}`} className="space-y-2">
                              {item.titulo && (
                                <p className="text-white font-bold text-sm">{index + 1}. {item.titulo}</p>
                              )}
                              {item.textosAntes.map((texto: string, textoIndex: number) => (
                                <p key={`antes-${index}-${textoIndex}`} className="text-white whitespace-pre-wrap text-sm">{texto}</p>
                              ))}
                              {item.tabela.length > 0 && (
                                <div className="overflow-x-auto rounded-lg border border-white/10">
                                  <table className="min-w-full text-sm">
                                    <tbody>
                                      {item.tabela.map((linha: any[], linhaIndex: number) => (
                                        <tr key={`linha-${index}-${linhaIndex}`} className="border-b border-white/10 last:border-b-0">
                                          <td className="px-3 py-2 text-white font-bold border-r border-white/10 whitespace-nowrap">
                                            {linhaIndex + 1}
                                          </td>
                                          {linha.map((coluna: any, colunaIndex: number) => (
                                            <td key={`coluna-${index}-${linhaIndex}-${colunaIndex}`} className="px-3 py-2 text-white">
                                              {coluna.valor}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {item.textosDepois.map((texto: string, textoIndex: number) => (
                                <p key={`depois-${index}-${textoIndex}`} className="text-white whitespace-pre-wrap text-sm">{texto}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Condições Comerciais */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                  <h3 className="text-white font-black text-lg">CONDIÇÕES COMERCIAIS</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">D - Preço</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.preco || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">Impostos / Observações Fiscais</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.impostos || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">E - Condições Gerais</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.condicoesGerais || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">F - Condições de Pagamento</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.condicoesPagamento || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2 font-black">G - Prazo</p>
                      <p className="text-white whitespace-pre-wrap text-sm">{ultimaProposta.prazo || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Referências e Encerramento */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">REFERÊNCIAS E ENCERRAMENTO</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-white/50 text-xs mb-1 font-black">Referências</p>
                      <p className="text-white whitespace-pre-wrap">{ultimaProposta.referencias || '−'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1 font-black">Encerramento</p>
                      <p className="text-white whitespace-pre-wrap">{ultimaProposta.encerramento || '−'}</p>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button
                    onClick={handleGerarPropostaPDF}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} /> Download PDF
                  </button>
                  <button 
                    onClick={() => setShowPropostaFullModal(false)}
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

      {/* MODAL - OS COMPLETA */}
      {showOSFullModal && selectedObraDetalhes && (() => {
        const osDoNegocio = (os || []).filter((o: any) => o.obraId === selectedObraDetalhes.id);
        if (osDoNegocio.length === 0) return null;
        const osPrincipal = osDoNegocio[0];
        const orcamentosBase = Array.isArray(osPrincipal?.orcamentos) && osPrincipal.orcamentos.length > 0
          ? osPrincipal.orcamentos
          : Array.isArray(selectedObraDetalhes.orcamentos) && selectedObraDetalhes.orcamentos.length > 0
            ? selectedObraDetalhes.orcamentos
            : [];
        const propostasBase = Array.isArray(osPrincipal?.propostas) && osPrincipal.propostas.length > 0
          ? osPrincipal.propostas
          : Array.isArray(selectedObraDetalhes.propostas) && selectedObraDetalhes.propostas.length > 0
            ? selectedObraDetalhes.propostas
            : [];
        const ultimoOrcamento = orcamentosBase.length > 0 ? orcamentosBase[orcamentosBase.length - 1] : null;
        const ultimaProposta = propostasBase.length > 0 ? propostasBase[propostasBase.length - 1] : null;
        const documentoClienteAssinado = osPrincipal?.documentoAssinaturaAprovacao || selectedObraDetalhes.documentoClienteAssinado;
        const documentosDaOS = Array.isArray(osPrincipal?.documentosNegocio) && osPrincipal.documentosNegocio.length > 0
          ? osPrincipal.documentosNegocio
          : Array.isArray(selectedObraDetalhes.documentosNegocio) ? selectedObraDetalhes.documentosNegocio : [];
        const servicosDoNegocio = Array.isArray(selectedObraDetalhes.servicos) ? selectedObraDetalhes.servicos : [];
        const maoDeObraOS = Array.isArray(ultimoOrcamento?.data?.maoDeObra) ? ultimoOrcamento.data.maoDeObra : [];
        const materiaisOS = Array.isArray(ultimoOrcamento?.data?.materiais) ? ultimoOrcamento.data.materiais : [];
        const terceirizadosOS = Array.isArray(ultimoOrcamento?.data?.terceirizados) ? ultimoOrcamento.data.terceirizados : [];
        const escopoBasicoProposta = formatarEscopoBasicoParaTexto(ultimaProposta?.escopoBasicoServicos || ultimaProposta?.escopoA || '−');
        const idProjetoOS = selectedObraDetalhes.id || '';
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              
              <div className="sticky top-0 z-40 bg-gradient-to-r from-purple-500/40 to-violet-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">ORDEM(NS) DE SERVIÇO</h2>
                  <p className="text-white/50 text-sm mt-2">{osDoNegocio.length} ordem(ns) criada(s)</p>
                </div>
                <button 
                  onClick={() => setShowOSFullModal(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={24} className="text-white/60" />
                </button>
              </div>

              <div className="p-8 space-y-6">

                {/* Informações do Negócio */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">NEGÓCIO</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cliente</p>
                      <p className="text-white font-bold">{listaClientesCRM.find(c => String(c.id) === String(selectedObraDetalhes.clienteId))?.razaoSocial}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Projeto</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.nome} {idProjetoOS && <span className="text-cyan-400">• {idProjetoOS}</span>}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Responsável</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.responsavelComercial || selectedObraDetalhes.solicitante}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Data Criação</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.dataCadastro}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">{boldOS('SUMÁRIO CONSOLIDADO DA OS')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">CC</p>
                      <p className="text-white font-bold">{osPrincipal?.cc || 'LN-0731A/26'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">{boldOS('Número OS')}</p>
                      <p className="text-white font-bold">{osPrincipal?.ordemServicoNumero || '0731A'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Emissão</p>
                      <p className="text-white font-bold">{osPrincipal?.dataEmissao || '02/02/2026'}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Término previsto</p>
                      <p className="text-white font-bold">{osPrincipal?.dataTerminoPrevisto || '24/02/2026'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">HORAS PREVISTAS POR SERVIÇO</h3>
                  {Array.isArray(osPrincipal?.horasTrabalhadasPorServico) && osPrincipal.horasTrabalhadasPorServico.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-white/10">
                        <thead className="bg-white/5 text-white/60">
                          <tr>
                            <th className="px-3 py-2 border border-white/10 text-left">Serviço</th>
                            <th className="px-3 py-2 border border-white/10 text-left">Hora (H/H)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {osPrincipal.horasTrabalhadasPorServico.map((item: any, idx: number) => (
                            <tr key={item?.id || idx} className="text-white/80">
                              <td className="px-3 py-2 border border-white/10">{item?.servico || '-'}</td>
                              <td className="px-3 py-2 border border-white/10">{Number(item?.hora || 0)}</td>
                            </tr>
                          ))}
                          <tr className="bg-white/5 text-white font-black">
                            <td className="px-3 py-2 border border-white/10 uppercase">HH Total</td>
                            <td className="px-3 py-2 border border-white/10">
                              {osPrincipal.horasTrabalhadasPorServico.reduce((acc: number, item: any) => acc + Number(item?.hora || 0), 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm">{boldOS('Nenhuma hora prevista cadastrada para esta OS.')}</p>
                  )}
                </div>

                {/* Orçamento */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-emerald-300 font-black text-lg uppercase">Orçamento</h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                      {ultimoOrcamento ? `v${formatarVersaoOrcamento(ultimoOrcamento.versao)}` : 'Sem orçamento'}
                    </span>
                  </div>
                  {ultimoOrcamento ? (
                    <div className="space-y-4 text-sm">
                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Número</p>
                          <p className="text-white font-bold">{ultimoOrcamento.numeroOrcamento || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Solicitante</p>
                          <p className="text-white font-bold">{osPrincipal?.solicitante || selectedObraDetalhes.solicitante || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Responsável Comercial</p>
                          <p className="text-white font-bold">{selectedObraDetalhes.responsavelComercial || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Documentos referência</p>
                          <p className="text-white font-bold">Request SOS26M0047 | Request SOS26M0046</p>
                        </div>
                      </div>

                      {servicosDoNegocio.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">SERVIÇOS</h4>
                          <div className="space-y-2">
                            {servicosDoNegocio.map((servico: any, idx: number) => (
                              <div key={idx} className="bg-[#111b2f] p-3 rounded text-xs border border-white/5">
                                <p className="text-white font-bold mb-2">{servico.tipo}</p>
                                <p className="text-white/70 mb-2 whitespace-pre-wrap">{servico.descricao}</p>
                                <div className="grid grid-cols-3 gap-2 text-white/50 text-xs">
                                  {servico.embarcacao && <span>{servico.embarcacao}</span>}
                                  {servico.localExecucao && <span>{servico.localExecucao}</span>}
                                  {servico.porto && <span>{servico.porto}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {maoDeObraOS.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">MÃO DE OBRA</h4>
                          <div className="space-y-1 text-xs">
                            {maoDeObraOS.map((item: any, idx: number) => (
                              item.funcao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.funcao} ({item.quantidade}x {item.dias}d)</span>
                                  <span className="text-white font-bold">Item listado</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {materiaisOS.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">ITENS COMPRADOS</h4>
                          <div className="space-y-1 text-xs">
                            {materiaisOS.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">Item listado</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {terceirizadosOS.length > 0 && (
                        <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 space-y-2">
                          <h4 className="text-white font-black text-sm">SERVIÇOS TERCEIRIZADOS</h4>
                          <div className="space-y-1 text-xs">
                            {terceirizadosOS.map((item: any, idx: number) => (
                              item.descricao && (
                                <div key={idx} className="flex justify-between text-white/70">
                                  <span>{item.descricao} ({item.quantidade} {item.unidade})</span>
                                  <span className="text-white font-bold">Item listado</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm">{boldOS('Nenhum orçamento vinculado a esta OS.')}</p>
                  )}
                </div>

                {/* Proposta */}
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-cyan-300 font-black text-lg uppercase">Proposta</h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                      {ultimaProposta ? `v${ultimaProposta.versao || ultimaProposta.numeroProposta?.match(/[A-Z]+$/)?.[0] || 'A'}` : 'Sem proposta'}
                    </span>
                  </div>
                  {ultimaProposta ? (
                    <div className="space-y-4 text-sm">
                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Número</p>
                          <p className="text-white font-bold">{ultimaProposta.numeroProposta || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Status</p>
                          <p className="text-white font-bold">{String(ultimaProposta.status || 'pendente').toUpperCase()}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Referência</p>
                          <p className="text-white font-bold">{ultimaProposta.referencia || 'Seven Ocean - UBU'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Responsável</p>
                          <p className="text-white font-bold">{ultimaProposta.atribuidoA || '−'}</p>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                        <h4 className="text-white font-black text-sm uppercase">Escopo de Serviços</h4>
                        <div>
                          <p className="text-white/50 text-xs mb-2 font-black">A - Escopo Básico de Serviços</p>
                          <p className="text-white whitespace-pre-wrap text-sm">{escopoBasicoProposta}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm">{boldOS('Nenhuma proposta vinculada a esta OS.')}</p>
                  )}
                </div>

                {documentoClienteAssinado && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-white font-black text-lg">Documento assinado do cliente</h3>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                        Anexado
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-[#0b1220] border border-white/5 rounded-lg p-4">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{documentoClienteAssinado.nome || 'Documento assinado'}</p>
                        <p className="text-white/50 text-xs">{documentoClienteAssinado.tamanho ? formatFileSize(documentoClienteAssinado.tamanho) : 'Tamanho não informado'}</p>
                      </div>
                      <button
                        onClick={() => handleVerDocumentoNegocio(documentoClienteAssinado)}
                        className="px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                      >
                        Ver documento
                      </button>
                    </div>
                  </div>
                )}

                {documentosDaOS.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                    <h3 className="text-white font-black text-lg">{boldOS('DOCUMENTOS DA OS')}</h3>
                    <div className="space-y-2">
                      {documentosDaOS.map((doc: any) => (
                        <div key={doc.id || doc.nome} className="bg-[#0b1220] rounded-lg p-3 border border-white/5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                            <p className="text-white/40 text-xs">{doc.tamanho ? formatFileSize(doc.tamanho) : 'Tamanho não informado'}</p>
                          </div>
                          <button
                            onClick={() => handleVerDocumentoNegocio(doc)}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                          >
                            Ver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ordens de Serviço */}
                <div className="space-y-4">
                  {osDoNegocio.map((osbatch: any, idx: number) => (
                    <div key={idx} className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-xl p-6 border border-purple-500/30 space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="text-purple-400 font-black text-lg">OS #{idx + 1}</h4>
                        <span className="px-3 py-1 bg-purple-500/30 border border-purple-500/50 rounded-full text-purple-300 text-xs font-black">{osbatch.status}</span>
                      </div>

                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-white/50 text-xs mb-1">ID</p>
                          <p className="text-white font-bold">{osbatch.id}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Tipo de Serviço</p>
                          <p className="text-white font-bold">{osbatch.tipo}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Local</p>
                          <p className="text-white font-bold">{osbatch.local || osbatch.localExecucao || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Porto</p>
                          <p className="text-white font-bold">{osbatch.porto || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Embarcação</p>
                          <p className="text-white font-bold">{osbatch.embarcacao || '−'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Data Criação</p>
                          <p className="text-white font-bold">{osbatch.dataCriacao}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-white/50 text-xs font-black">Descrição</p>
                        <p className="text-white bg-[#0b1220] rounded-lg p-4 border border-white/5 text-sm whitespace-pre-wrap">{osbatch.descricao}</p>
                      </div>

                      {osbatch.observacoes && (
                        <div className="space-y-2">
                          <p className="text-white/50 text-xs font-black">Observações</p>
                          <p className="text-white bg-[#0b1220] rounded-lg p-4 border border-white/5 text-sm whitespace-pre-wrap">{osbatch.observacoes}</p>
                        </div>
                      )}

                      <div className="bg-[#0b1220] rounded-lg p-4 border border-white/5 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-white/50 text-xs mb-1">Solicitante</p>
                          <p className="text-white font-bold">{osbatch.solicitante}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Telefone</p>
                          <p className="text-white font-bold">{osbatch.telefone}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs mb-1">Email</p>
                          <p className="text-white font-bold text-xs">{osbatch.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button
                    onClick={handleDownloadOSPDF}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} /> Download TXT
                  </button>
                  <button 
                    onClick={() => setShowOSFullModal(false)}
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

      {/* MODAL - ORÇAMENTO COMPLETO */}
      {showOrcamentoFullModal && selectedObraDetalhes?.orcamentos && selectedObraDetalhes.orcamentos.length > 0 && (() => {
        const ultimoOrcamento = selectedObraDetalhes.orcamentos[selectedObraDetalhes.orcamentos.length - 1];
        const cliente = listaClientesCRM.find(c => String(c.id) === String(selectedObraDetalhes.clienteId));
        const idProjetoOrc = selectedObraDetalhes.id || '';
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              
              <div className="sticky top-0 z-40 bg-gradient-to-r from-emerald-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">ORÇAMENTO - DETALHES COMPLETOS</h2>
                  <p className="text-white/50 text-sm mt-2">Versão {formatarVersaoOrcamento(ultimoOrcamento.versao)} • {ultimoOrcamento.numeroOrcamento}</p>
                </div>
                <button 
                  onClick={() => setShowOrcamentoFullModal(false)}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={24} className="text-white/60" />
                </button>
              </div>

              <div className="p-8 space-y-6">

                {/* Informações Básicas */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-white font-black text-lg">INFORMAÇÕES BÁSICAS</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50 text-xs mb-1">Cliente</p>
                      <p className="text-white font-bold">{cliente?.razaoSocial}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Número</p>
                      <p className="text-white font-bold">{ultimoOrcamento.numeroOrcamento}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Negócio</p>
                      <p className="text-white font-bold">{selectedObraDetalhes.nome} {idProjetoOrc && <span className="text-cyan-400">• {idProjetoOrc}</span>}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">Data</p>
                      <p className="text-white font-bold">{ultimoOrcamento.dataCriacao}</p>
                    </div>
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-6 border border-amber-500/30 space-y-3">
                  <h3 className="text-amber-400 font-black text-lg">RESUMO FINANCEIRO</h3>
                  {(() => {
                    const base = safeNumber(ultimoOrcamento.valores.totalBruto ?? ultimoOrcamento.valores.subtotal);
                    const margemPercent = safeNumber(ultimoOrcamento.valores.margem);
                    const ohPercent = safeNumber(ultimoOrcamento.valores.oh);
                    const impostosPercent = safeNumber(ultimoOrcamento.valores.impostos);
                    const valorMargem = safeNumber(ultimoOrcamento.valores.valorMargem ?? ((base * margemPercent) / 100));
                    const valorOH = safeNumber(ultimoOrcamento.valores.valorOH ?? ((base * ohPercent) / 100));
                    const semImposto = safeNumber(ultimoOrcamento.valores.totalSemImposto ?? (base + valorMargem + valorOH));
                    const valorImposto = safeNumber(ultimoOrcamento.valores.valorImpostos ?? ((semImposto * impostosPercent) / 100));
                    const precoFinal = safeNumber(ultimoOrcamento.valores.precoFinal);
                    return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Total Bruto:</span>
                      <span className="text-white font-black">R$ {base.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Margem ({ultimoOrcamento.valores.margem}%):</span>
                      <span className="text-white font-black">R$ {valorMargem.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">O.H ({ohPercent}%):</span>
                      <span className="text-white font-black">R$ {valorOH.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-amber-500/20">
                      <span className="text-white font-bold">Impostos ({ultimoOrcamento.valores.impostos}%):</span>
                      <span className="text-white font-black">R$ {valorImposto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-white font-bold">TOTAL S/ IMPOSTO:</span>
                      <span className="text-white font-black text-lg">R$ {semImposto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-amber-300 font-black text-lg">PREÇO FINAL:</span>
                      <span className="text-amber-300 font-black text-2xl">R$ {precoFinal.toFixed(2)}</span>
                    </div>
                  </div>
                    );
                  })()}
                </div>

                {/* Mão de Obra */}
                {ultimoOrcamento.data.maoDeObra && ultimoOrcamento.data.maoDeObra.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-black text-lg">MÃO DE OBRA</h3>
                    <div className="space-y-2">
                      {ultimoOrcamento.data.maoDeObra.map((item: any, idx: number) => (
                        item.funcao && (
                          <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded border border-white/5 text-sm">
                            <div>
                              <p className="text-white font-bold">{item.funcao}</p>
                              <p className="text-white/50 text-xs">{item.quantidade}x • {item.dias} dias</p>
                            </div>
                            <span className="text-emerald-400 font-black">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between font-black">
                      <span className="text-white">Total Mão de Obra:</span>
                      <span className="text-emerald-400">R$ {(ultimoOrcamento.data.maoDeObra.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Materiais */}
                {ultimoOrcamento.data.materiais && ultimoOrcamento.data.materiais.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-black text-lg">MATERIAIS</h3>
                    <div className="space-y-2">
                      {ultimoOrcamento.data.materiais.map((item: any, idx: number) => (
                        item.descricao && (
                          <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded border border-white/5 text-sm">
                            <div>
                              <p className="text-white font-bold">{item.descricao}</p>
                              <p className="text-white/50 text-xs">{item.quantidade} {item.unidade}</p>
                            </div>
                            <span className="text-cyan-400 font-black">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between font-black">
                      <span className="text-white">Total Materiais:</span>
                      <span className="text-cyan-400">R$ {(ultimoOrcamento.data.materiais.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Terceirizados */}
                {ultimoOrcamento.data.terceirizados && ultimoOrcamento.data.terceirizados.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <h3 className="text-white font-black text-lg">SERVIÇOS TERCEIRIZADOS</h3>
                    <div className="space-y-2">
                      {ultimoOrcamento.data.terceirizados.map((item: any, idx: number) => (
                        item.descricao && (
                          <div key={idx} className="flex justify-between items-center p-3 bg-[#0b1220] rounded border border-white/5 text-sm">
                            <div>
                              <p className="text-white font-bold">{item.descricao}</p>
                              <p className="text-white/50 text-xs">{item.quantidade} {item.unidade}</p>
                            </div>
                            <span className="text-orange-400 font-black">R$ {parseFloat(item.valorTotal || 0).toFixed(2)}</span>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between font-black">
                      <span className="text-white">Total Terceirizados:</span>
                      <span className="text-orange-400">R$ {(ultimoOrcamento.data.terceirizados.reduce((sum: number, item: any) => sum + (parseFloat(item.valorTotal) || 0), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-6 border-t border-white/5">
                  <button
                    onClick={handleDownloadOrcamentoPDF}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} /> Download PDF
                  </button>
                  <button 
                    onClick={() => setShowOrcamentoFullModal(false)}
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

      {/* MODAL - GERENCIAR ARQUIVOS DO NEGÓCIO */}
      {showArquivosModal && selectedObraArquivos && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-500/40 to-orange-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Alterar Arquivos do Negócio</h2>
                <p className="text-white/50 text-sm mt-2">{selectedObraArquivos.nome}</p>
              </div>
              <button
                onClick={() => {
                  setShowArquivosModal(false);
                  setSelectedObraArquivos(null);
                }}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-[#0b1220] rounded-xl border border-white/10 p-4 space-y-3">
                <p className="text-white/70 text-xs">
                  Ao adicionar ou remover arquivos, você poderá escolher se deseja abrir um novo orçamento.
                </p>
                <input
                  type="file"
                  accept=".pdf,.csv,application/pdf,text/csv,application/vnd.ms-excel"
                  multiple
                  onChange={(e) => {
                    handleAdicionarArquivosNoCard(selectedObraArquivos, e.target.files);
                    e.currentTarget.value = '';
                  }}
                  className="w-full text-xs text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-[11px] file:font-black file:uppercase file:text-[#0b1220] hover:file:bg-amber-400"
                />
                <p className="text-[11px] text-white/40">Formatos permitidos: PDF e CSV.</p>
              </div>

              <div className="space-y-2">
                {Array.isArray(selectedObraArquivos.documentosNegocio) && selectedObraArquivos.documentosNegocio.length > 0 ? (
                  selectedObraArquivos.documentosNegocio.map((doc: any) => (
                    <div key={doc.id || doc.nome} className="bg-[#0b1220] rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                        <p className="text-white/40 text-xs">{doc.tamanho ? formatFileSize(doc.tamanho) : 'Tamanho não informado'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleVerDocumentoNegocio(doc)}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                        >
                          <Eye size={14} className="inline mr-1" /> Ver
                        </button>
                        <button
                          onClick={() => handleRemoverArquivoNoCard(selectedObraArquivos, doc.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-black uppercase transition"
                        >
                          <X size={14} className="inline mr-1" /> Remover
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#0b1220] rounded-lg border border-dashed border-white/15 p-6 text-center">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Nenhum documento anexado</p>
                  </div>
                )}
              </div>

              {Array.isArray(selectedObraArquivos.documentosNegocioArquivados) && selectedObraArquivos.documentosNegocioArquivados.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-white/60 text-xs font-black uppercase tracking-widest">Documentos Arquivados</p>
                    <span className="text-[11px] text-white/40">{selectedObraArquivos.documentosNegocioArquivados.length} item(ns)</span>
                  </div>

                  {selectedObraArquivos.documentosNegocioArquivados.map((doc: any) => (
                    <div key={`${doc.id}-arquivado-${doc.dataArquivamento || ''}`} className="bg-[#0b1220] rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3 opacity-80">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{doc.nome || 'Documento'}</p>
                        <p className="text-white/40 text-xs">
                          Arquivado em {doc.dataArquivamento ? new Date(doc.dataArquivamento).toLocaleDateString('pt-BR') : 'data não informada'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleVerDocumentoNegocio(doc)}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black uppercase transition"
                      >
                        <Eye size={14} className="inline mr-1" /> Ver
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setShowArquivosModal(false);
                    setSelectedObraArquivos(null);
                  }}
                  className="px-8 bg-white/10 hover:bg-white/15 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - EDITAR NEGÓCIO (apenas em Planejamento) */}
      {showEditModal && editingObra && ((): React.ReactNode => {
        const idProjetoEdit = editingObra.id || '';
        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101f3d] rounded-2xl border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-md p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">Editar Negócio</h2>
                <p className="text-white/50 text-sm mt-2">{editingObra.nome} {idProjetoEdit && <span className="text-cyan-400">• {idProjetoEdit}</span>}</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={24} className="text-white/60" />
              </button>
            </div>

            <div className="p-8 space-y-12">
              
              {/* Informações para editar */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6 space-y-8">
                <h3 className="text-lg font-black text-white uppercase">Dados do Negócio</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <label className={labelClass}>Empresa Prestadora *</label>
                    <select
                      className={inputClass}
                      value={editingObra.empresaPrestadora || ''}
                      onChange={e => setEditingObra({...editingObra, empresaPrestadora: e.target.value})}
                    >
                      {empresasPrestadoras.map((empresa) => (
                        <option key={empresa.id} value={empresa.nome}>
                          {empresa.nome}{empresa.cnpj ? ` - ${empresa.cnpj}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Nome do Negócio *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.nome}
                      onChange={e => setEditingObra({...editingObra, nome: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Cliente</label>
                    <input 
                      type="text"
                      className={`${inputClass} bg-white/5 cursor-not-allowed`}
                      disabled
                      //  Correção do String() para não quebrar a busca
                      value={listaClientesCRM.find(c => String(c.id) === String(editingObra.clienteId))?.razaoSocial || ''}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Solicitante *</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.solicitante || ''}
                      onChange={e => setEditingObra({...editingObra, solicitante: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Cargo</label>
                    <input 
                      type="text"
                      className={inputClass}
                      value={editingObra.cargo || ''}
                      onChange={e => setEditingObra({...editingObra, cargo: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className={labelClass}>Tipo de Serviço</label>
                  <input 
                    type="text"
                    className={inputClass}
                    value={editingObra.tipo || editingObra.tipo_servico || ''}
                    onChange={e => setEditingObra({...editingObra, tipo: e.target.value, tipo_servico: e.target.value})}
                  />
                </div>

                <div className="space-y-2.5">
                  <label className={labelClass}>Contato</label>
                  <div className="grid grid-cols-2 gap-5">
                    <input 
                      type="tel"
                      className={inputClass}
                      placeholder="Telefone"
                      value={editingObra.telefone || ''} //  Travas de segurança adicionadas
                      onChange={e => setEditingObra({...editingObra, telefone: e.target.value})}
                    />
                    <input 
                      type="email"
                      className={inputClass}
                      placeholder="Email"
                      value={editingObra.email || ''} //  Travas de segurança adicionadas
                      onChange={e => setEditingObra({...editingObra, email: e.target.value})}
                    />

                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <label className={labelClass}>Telefone</label>
                    <input 
                      type="tel"
                      className={inputClass}
                      placeholder="Telefone"
                      value={editingObra.telefone || ''}
                      onChange={e => setEditingObra({...editingObra, telefone: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className={labelClass}>Email *</label>
                    <input 
                      type="email"
                      className={inputClass}
                      placeholder="Email"
                      value={editingObra.email || ''}
                      onChange={e => setEditingObra({...editingObra, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    handleOpenArquivosModal(editingObra);
                  }}
                  className="px-6 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 py-3 rounded-lg font-black uppercase text-sm tracking-widest transition flex items-center gap-2"
                >
                  <FileText size={16} /> Alterar Arquivos
                </button>

                  {/* BOTÃO DE EXCLUIR ADICIONADO AQUI */}
                <button 
                  onClick={() => handleDeleteNegocio(editingObra.negocioBackendId)}
                  className="px-6 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 py-3 rounded-lg font-black uppercase text-sm tracking-widest transition flex items-center gap-2"
                >
                  <X size={16} /> Excluir
                </button>
                {/* --------------------------------- */}

                <button 
                  onClick={handleSaveEditObra}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 rounded-lg font-black uppercase text-sm tracking-widest transition-all shadow-lg shadow-blue-900/30"
                >
                  Salvar Alterações
                </button>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="px-12 bg-white/5 text-white py-3 rounded-lg font-black uppercase text-sm hover:bg-white/10 transition"
                >
                  Cancelar
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
