import * as XLSX from 'xlsx-js-style';
import type { ItemCompra, OrdemCompraExtraDados, QuoteFornecedor, RequisicaoCompra } from './comprasLocal';
import { formatNumeroOsDisplay } from '../../../../services/ordensServico';

/* =========================================================================================
 * ORDEM DE COMPRA (Excel) — substitui o antigo PDF de "Pedido de Compra" no card de Compras
 * do Kanban. Réplica (com `xlsx-js-style`, já que o `xlsx` puro usado no resto do app não
 * aplica cor/borda/mescla ao gravar) do modelo comercial de Ordem de Compra em duas variantes
 * de papel timbrado — Linave e Servinave — decididas por `empresaFromCC(centroCusto)`.
 *
 * Os dados vêm de três lugares:
 *  - Empresa COMPRADORA (Linave/Servinave): `config.empresasPrestadoras` (Configurações) —
 *    campo deixado em branco se a empresa ainda não tiver CNPJ/endereço cadastrado lá.
 *  - FORNECEDOR: procurado por nome na lista real de Fornecedores (CNPJ/endereço/inscrição
 *    estadual) — o nome do fornecedor na cotação é digitado a partir dessa mesma lista.
 *  - Itens/preços/impostos: cotação já aprovada (QuoteItem/QuoteFornecedor do item, já com o
 *    fornecedor selecionado) — valor unitário e % de IPI/ICMS entram na cotação; os VALORES de
 *    IPI/ICMS são sempre calculados aqui (nunca digitados).
 *  - Condições comerciais (venda/transporte/porto/embarque/entrega/desconto/acréscimo/frete/
 *    vendedor/dados bancários/local de entrega): `OrdemCompraExtraDados`, preenchido no modal
 *    "Dados complementares da Ordem de Compra" antes de gerar o arquivo.
 * =======================================================================================*/

export interface EmpresaCompradoraDados {
  nome: string;
  cnpj: string;
  enderecoLinha: string;
  email: string;
}

export interface FornecedorDocumentoDados {
  razaoSocial: string;
  cnpj: string;
  enderecoLinha: string;
  inscricaoEstadual: string;
}

interface GerarOrdemCompraParams {
  numero: string;
  revisao?: number;
  centroCusto: string;
  solicitante: string;
  solicitanteEmail?: string;
  itens: ItemCompra[];
  budgetDetails: { itemId: string; fornecedorSelecionado: string; fornecedores: QuoteFornecedor[] }[];
  empresaCompradora: EmpresaCompradoraDados;
  fornecedor: FornecedorDocumentoDados;
  extra: OrdemCompraExtraDados;
  data?: string;
}

const money = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = (value: number) => `${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
// Datas "yyyy-mm-dd" (sem hora) via `new Date(...)` são lidas como meia-noite UTC — formatar
// direto pro fuso local (Brasil, UTC-3) joga pro dia anterior. Monta "dd/mm/aaaa" a partir dos
// componentes da própria string, sem passar por Date/UTC.
const dataBr = (valor?: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const THIN = { style: 'thin' as const, color: { rgb: '000000' } };
const BORDER_ALL = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const COR_CREME = 'FFF2CC';
const COR_CINZA_CLARO = 'D9D9D9';
const COR_CINZA_ESCURO = 'BFBFBF';
const FONTE = 'Calibri';

const estiloBase = (extra?: any) => ({
  font: { name: FONTE, sz: 10, ...(extra?.font || {}) },
  border: BORDER_ALL,
  alignment: { vertical: 'center', wrapText: true, ...(extra?.alignment || {}) },
  ...(extra?.fill ? { fill: extra.fill } : {}),
});

const estiloTitulo = estiloBase({ font: { bold: true, sz: 15 }, alignment: { horizontal: 'left' } });
const estiloTituloCentro = estiloBase({ font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
const estiloBarraSecao = estiloBase({ font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: COR_CINZA_ESCURO } }, alignment: { horizontal: 'left' } });
const estiloRotulo = estiloBase({ font: { bold: true, sz: 9 }, alignment: { horizontal: 'left' } });
const estiloValor = estiloBase({ fill: { fgColor: { rgb: COR_CREME } }, alignment: { horizontal: 'left' } });
const estiloCabecalhoTabela = estiloBase({ font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: COR_CINZA_CLARO } }, alignment: { horizontal: 'center' } });
const estiloCelulaTabela = estiloBase({ alignment: { horizontal: 'left' } });
const estiloCelulaTabelaCentro = estiloBase({ alignment: { horizontal: 'center' } });
const estiloCelulaTabelaMoeda = estiloBase({ alignment: { horizontal: 'right' } });
const estiloTotalRotulo = estiloBase({ font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: COR_CINZA_CLARO } }, alignment: { horizontal: 'right' } });
const estiloTotalValor = estiloBase({ font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: COR_CREME } }, alignment: { horizontal: 'right' } });
const estiloTotalGeralRotulo = estiloBase({ font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: COR_CINZA_ESCURO } }, alignment: { horizontal: 'right' } });
const estiloTotalGeralValor = estiloBase({ font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: COR_CINZA_ESCURO } }, alignment: { horizontal: 'right' } });
const estiloTextoLivre = estiloBase({ font: { sz: 9 }, alignment: { horizontal: 'left', vertical: 'top' } });
const estiloAssinatura = estiloBase({ font: { bold: true, sz: 9 }, alignment: { horizontal: 'center', vertical: 'top' } });

const NUM_COLS = 13; // A..M

export const handleDownloadOrdemCompraExcel = (params: GerarOrdemCompraParams) => {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  let r = 0;

  const addr = (c: number, row: number) => XLSX.utils.encode_cell({ r: row, c });

  const setCell = (c: number, row: number, value: string | number, style: any = estiloCelulaTabela) => {
    const isNum = typeof value === 'number';
    ws[addr(c, row)] = { v: value, t: isNum ? 'n' : 's', s: style };
  };

  // Aplica o mesmo estilo (borda/preenchimento) em todas as células do intervalo — garante que
  // a borda externa de uma região mesclada apareça completa em qualquer leitor de planilha, não
  // só na célula superior-esquerda.
  const setRange = (c1: number, row1: number, c2: number, row2: number, value: string | number, style: any) => {
    for (let rr = row1; rr <= row2; rr += 1) {
      for (let cc = c1; cc <= c2; cc += 1) {
        setCell(cc, rr, rr === row1 && cc === c1 ? value : '', style);
      }
    }
    if (c1 !== c2 || row1 !== row2) merges.push({ s: { r: row1, c: c1 }, e: { r: row2, c: c2 } });
  };

  const linhaVazia = () => { r += 1; };

  // ---------------------------------------------------------------------
  // Cabeçalho: nome da empresa + título + bloco OC Nº/Rev./OS/Emissão/Pág.
  // ---------------------------------------------------------------------
  setRange(0, r, 5, r + 1, params.empresaCompradora.nome, estiloTitulo);
  setRange(6, r, 12, r, 'ORDEM DE COMPRA', estiloTituloCentro);
  r += 1;
  const colunasOc = ['OC Nº', 'Rev.', 'OS / RC', 'Emissão', 'Pág.'];
  colunasOc.forEach((label, index) => setCell(8 + index, r, label, estiloCabecalhoTabela));
  r += 1;
  const valoresOc = [
    params.numero || '',
    params.revisao ?? 0,
    formatNumeroOsDisplay(params.centroCusto) || '',
    params.data ? new Date(params.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    1,
  ];
  valoresOc.forEach((valor, index) => setCell(8 + index, r, valor, estiloValor));
  r += 1;
  linhaVazia();

  // ---------------------------------------------------------------------
  // EMPRESA (Comprador) × FORNECEDOR
  // ---------------------------------------------------------------------
  setRange(0, r, 5, r, 'EMPRESA (Comprador)', estiloBarraSecao);
  setRange(6, r, 12, r, 'FORNECEDOR', estiloBarraSecao);
  r += 1;

  const linhaDupla = (rotuloEsq: string, valorEsq: string, rotuloDir: string, valorDir: string) => {
    setCell(0, r, rotuloEsq, estiloRotulo);
    setRange(1, r, 5, r, valorEsq, estiloValor);
    setCell(6, r, rotuloDir, estiloRotulo);
    setRange(7, r, 12, r, valorDir, estiloValor);
    r += 1;
  };

  linhaDupla('Razão Social:', params.empresaCompradora.nome, 'Razão Social:', params.fornecedor.razaoSocial);
  linhaDupla('CNPJ:', params.empresaCompradora.cnpj, 'CNPJ:', params.fornecedor.cnpj);
  linhaDupla('Insc. Estadual:', '', 'Insc. Estadual:', params.fornecedor.inscricaoEstadual);
  linhaDupla('Endereço:', params.empresaCompradora.enderecoLinha, 'Endereço:', params.fornecedor.enderecoLinha);
  linhaDupla('CEP / Cidade / UF:', '', 'CEP / Cidade / UF:', '');
  linhaDupla('Dados Bancários (do Fornecedor):', params.extra.dadosBancariosFornecedor, '', '');
  linhaDupla('Todas as Correspondências para:', params.empresaCompradora.email, 'Local de Entrega:', params.extra.localEntrega);
  linhaVazia();

  // ---------------------------------------------------------------------
  // Comprador × Vendedor
  // ---------------------------------------------------------------------
  setRange(0, r, 5, r, 'Comprador', estiloBarraSecao);
  setRange(6, r, 12, r, 'Vendedor', estiloBarraSecao);
  r += 1;
  linhaDupla('Nome:', params.solicitante, 'Nome:', params.extra.vendedorNome);
  linhaDupla('E-mail / Tel:', params.solicitanteEmail || '', 'Tel / Cel:', params.extra.vendedorTelefone);
  linhaVazia();

  // ---------------------------------------------------------------------
  // Tabela de itens
  // ---------------------------------------------------------------------
  const colunasItens = [
    { label: 'Item', c1: 0, c2: 0 },
    { label: 'Qtd.', c1: 1, c2: 1 },
    { label: 'Unid.', c1: 2, c2: 2 },
    { label: 'Código / Descrição', c1: 3, c2: 5 },
    { label: 'Data de Entrega', c1: 6, c2: 6 },
    { label: 'Preço Unitário', c1: 7, c2: 7 },
    { label: 'Preço Total', c1: 8, c2: 8 },
    { label: 'IPI %', c1: 9, c2: 9 },
    { label: 'IPI Valor', c1: 10, c2: 10 },
    { label: 'ICMS %', c1: 11, c2: 11 },
    { label: 'ICMS Valor', c1: 12, c2: 12 },
  ];
  colunasItens.forEach((col) => setRange(col.c1, r, col.c2, r, col.label, estiloCabecalhoTabela));
  r += 1;

  let subtotalItens = 0;
  let totalIpi = 0;
  let totalIcms = 0;

  params.itens.forEach((item, index) => {
    const detail = params.budgetDetails.find((d) => d.itemId === item.id) || null;
    const quote = detail?.fornecedores.find((f) => f.fornecedor === detail.fornecedorSelecionado) || null;
    const qtd = item.qtd || 0;
    // Cotações salvas antes do campo "valor unitário" existir só têm o total (`valor`) — nesse
    // caso deriva o unitário dali em vez de mostrar zerado.
    const valorUnitario = quote?.valorUnitario || (qtd > 0 ? (quote?.valor || 0) / qtd : (quote?.valor || 0));
    const valorTotal = quote?.valorUnitario ? qtd * quote.valorUnitario : (quote?.valor || 0);
    const ipiValor = valorTotal * ((quote?.ipiPercentual || 0) / 100);
    const icmsValor = valorTotal * ((quote?.icmsPercentual || 0) / 100);
    subtotalItens += valorTotal;
    totalIpi += ipiValor;
    totalIcms += icmsValor;

    setCell(0, r, index + 1, estiloCelulaTabelaCentro);
    setCell(1, r, qtd, estiloCelulaTabelaCentro);
    setCell(2, r, item.un || '', estiloCelulaTabelaCentro);
    setRange(3, r, 5, r, item.descricao || item.nome || '', estiloCelulaTabela);
    setCell(6, r, dataBr(item.dataDesejada), estiloCelulaTabelaCentro);
    setCell(7, r, money(valorUnitario), estiloCelulaTabelaMoeda);
    setCell(8, r, money(valorTotal), estiloCelulaTabelaMoeda);
    setCell(9, r, percent(quote?.ipiPercentual || 0), estiloCelulaTabelaCentro);
    setCell(10, r, money(ipiValor), estiloCelulaTabelaMoeda);
    setCell(11, r, percent(quote?.icmsPercentual || 0), estiloCelulaTabelaCentro);
    setCell(12, r, money(icmsValor), estiloCelulaTabelaMoeda);
    r += 1;
  });

  const desconto = params.extra.desconto || 0;
  const acrescimo = params.extra.acrescimo || 0;
  const frete = params.extra.frete || 0;
  const totalGeral = subtotalItens - desconto + acrescimo + frete + totalIpi;

  linhaVazia();

  // ---------------------------------------------------------------------
  // Observação obrigatória (esquerda) + totais (direita)
  // ---------------------------------------------------------------------
  const linhaImportante = r;
  setRange(
    0, linhaImportante, 6, linhaImportante + 4,
    'IMPORTANTE: é obrigatório constar o número desta Ordem de Compra (OC) na Nota Fiscal, sob pena de não recebimento da mercadoria/serviço pelo Almoxarifado.\n\nObs.: ICMS destacado é informativo (já incluso no preço) e não é somado ao total.',
    estiloTextoLivre,
  );

  const totaisLinhas: Array<[string, number]> = [
    ['Subtotal Itens', subtotalItens],
    ['Desconto (-)', desconto],
    ['Acréscimo (+)', acrescimo],
    ['Frete (+)', frete],
    ['IPI (+)', totalIpi],
  ];
  totaisLinhas.forEach(([label, valor], index) => {
    setRange(7, linhaImportante + index, 10, linhaImportante + index, label, estiloTotalRotulo);
    setRange(11, linhaImportante + index, 12, linhaImportante + index, money(valor), estiloTotalValor);
  });
  setRange(7, linhaImportante + 5, 10, linhaImportante + 5, 'ICMS (informativo)', estiloTotalRotulo);
  setRange(11, linhaImportante + 5, 12, linhaImportante + 5, money(totalIcms), estiloTotalValor);
  setRange(7, linhaImportante + 6, 10, linhaImportante + 6, 'TOTAL GERAL', estiloTotalGeralRotulo);
  setRange(11, linhaImportante + 6, 12, linhaImportante + 6, money(totalGeral), estiloTotalGeralValor);
  r = linhaImportante + 7;
  linhaVazia();

  // ---------------------------------------------------------------------
  // Condições comerciais
  // ---------------------------------------------------------------------
  const blocoCondicoes = (campos: Array<[string, string, number, number]>) => {
    campos.forEach(([label, valor, c1, c2]) => setRange(c1, r, c2, r, label, estiloBarraSecao));
    r += 1;
    campos.forEach(([, valor, c1, c2]) => setRange(c1, r, c2, r, valor, estiloValor));
    r += 1;
  };

  blocoCondicoes([
    ['Condição de Venda', params.extra.condicaoVenda, 0, 4],
    ['Transporte', params.extra.transporte, 5, 8],
    ['Porto de Origem', params.extra.portoOrigem, 9, 12],
  ]);
  blocoCondicoes([
    ['Condição de Embarque', params.extra.condicaoEmbarque, 0, 6],
    ['Condição de Entrega', params.extra.condicaoEntrega, 7, 12],
  ]);
  blocoCondicoes([
    ['Condição de Pagamento', '', 0, 12],
  ]);
  // A linha de valor do bloco acima ficou vazia (não há 1 condição de pagamento fixa por
  // fornecedor nesta etapa — reaproveita o texto já cotado por item quando só há 1 fornecedor
  // selecionado em todos os itens; senão fica em branco pra preenchimento manual).
  const condicoesPagamento = Array.from(new Set(
    params.budgetDetails
      .map((d) => d.fornecedores.find((f) => f.fornecedor === d.fornecedorSelecionado)?.condicaoPagamento)
      .filter((v): v is string => Boolean(v)),
  ));
  if (condicoesPagamento.length) {
    ws[addr(0, r - 1)].v = condicoesPagamento.join(' | ');
  }
  linhaVazia();

  // ---------------------------------------------------------------------
  // Observações / Escopo de Fornecimento
  // ---------------------------------------------------------------------
  setRange(0, r, 12, r, 'Observações / Escopo de Fornecimento', estiloBarraSecao);
  r += 1;
  const textoEscopo = [
    '01 - ESCOPO DE FORNECIMENTO',
    'O objetivo desta Ordem de Compra é outorgar o fornecimento descrito no corpo deste documento, além dos seus respectivos anexos.',
    '',
    '02 - DOCUMENTOS APLICÁVEIS',
    'Proposta técnica e comercial conforme e-mail/anexo datado em ___/___/___.',
    '',
    '03 - IMPORTANTE',
    `Prazo/local de entrega: ${params.extra.localEntrega || '___________________________'}`,
  ].join('\n');
  setRange(0, r, 12, r + 7, textoEscopo, estiloTextoLivre);
  r += 8;
  linhaVazia();

  // ---------------------------------------------------------------------
  // Mensagens ao Fornecedor
  // ---------------------------------------------------------------------
  setRange(0, r, 12, r, 'Mensagens ao Fornecedor', estiloBarraSecao);
  r += 1;
  const emailNf = params.empresaCompradora.nome.toLowerCase().includes('servinave') ? 'nf@servinave.com.br' : 'nf@linave.com.br';
  const mensagens = [
    '1 - As Notas Fiscais emitidas só poderão fazer menção a apenas uma Ordem de Compra (OC). NF que não atenderem esta instrução serão devolvidas juntamente com a mercadoria.',
    '2 - Todos os pagamentos serão realizados exclusivamente por depósito em conta corrente, obrigatoriamente informada pelo Fornecedor no faturamento.',
    '3 - Foro fica eleito o Foro da Cidade de Niterói - RJ para dirimir quaisquer questões decorrentes desta Ordem de Compra.',
    '4 - Fornecedores devem seguir a regulamentação do SPED na emissão de Notas Fiscais/Faturas, sob pena da impossibilidade de recebimento e de liberação do pagamento.',
    '5 - Quando a condição de entrega for FOB, o Fornecedor deverá entrar em contato previamente com o setor de Compras.',
    '6 - O fornecimento será avaliado, quando aplicável, quanto a: Pontualidade, Qualidade, Cooperação, Documentação e Certificados.',
    '7 - Canal de Denúncias: confidencialidade e segurança garantidas; não é obrigatório identificar-se; vedada qualquer forma de retaliação a denúncias de boa-fé.',
    `8 - Enviar a Nota Fiscal para a Fiscalização e também para o e-mail: ${emailNf}`,
  ].join('\n');
  setRange(0, r, 12, r + 8, mensagens, estiloTextoLivre);
  r += 9;
  linhaVazia();

  // ---------------------------------------------------------------------
  // Assinaturas + rodapé
  // ---------------------------------------------------------------------
  setRange(0, r, 5, r + 3, 'Autorização (Comprador)', estiloAssinatura);
  setRange(6, r, 12, r + 3, 'Assinatura / Data (Fornecedor)', estiloAssinatura);
  r += 4;
  setRange(0, r, 5, r, params.empresaCompradora.nome, estiloBarraSecao);
  setRange(6, r, 12, r, 'Fornecedor', estiloBarraSecao);
  r += 1;
  setRange(0, r, 5, r, 'Emitido por: _______________________', estiloTextoLivre);
  setRange(6, r, 12, r, `Data: ${new Date().toLocaleDateString('pt-BR')}`, estiloTextoLivre);
  r += 1;

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: NUM_COLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 6 }, { wch: 7 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 9 }, { wch: 11 }, { wch: 9 }, { wch: 11 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ordem de Compra');
  const nomeArquivo = `Ordem_Compra_${params.numero}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
  return { nomeArquivo };
};
