/* =========================================================================================
 * Geração de planilhas .xlsx (ExcelJS).
 *
 * Substitui o `xlsx` (SheetJS) e o `xlsx-js-style`: o SheetJS parou de publicar correções no
 * npm (o pacote ficou com falhas conhecidas sem atualização) e o fork com estilo é baseado
 * nele. O ExcelJS é mantido e gera a planilha formatada sozinho.
 *
 * Importado sob demanda (`import('exceljs')`): a biblioteca é grande e só é baixada pelo
 * navegador na hora de exportar, não junto com a tela.
 * =======================================================================================*/

export type ValorCelula = string | number | boolean | null | undefined;

// Estilo no mesmo formato que o gerador da Ordem de Compra já usava (herdado do
// xlsx-js-style) — convertido para o formato do ExcelJS em `converterEstilo`.
export interface EstiloCelula {
  font?: { name?: string; sz?: number; bold?: boolean; italic?: boolean; color?: { rgb?: string } };
  fill?: { fgColor?: { rgb?: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: Partial<Record<'top' | 'bottom' | 'left' | 'right', { style?: string; color?: { rgb?: string } }>>;
}

export interface CelulaEstilizada {
  valor: ValorCelula;
  estilo?: EstiloCelula;
}

export interface IntervaloMesclado {
  linhaInicio: number; colunaInicio: number; linhaFim: number; colunaFim: number; // base 0
}

const argb = (rgb?: string) => (rgb ? { argb: `FF${rgb.replace('#', '').toUpperCase()}` } : undefined);

function converterEstilo(estilo: EstiloCelula = {}) {
  const convertido: any = {};
  if (estilo.font) {
    const { sz, color, ...resto } = estilo.font;
    convertido.font = { ...resto, ...(sz ? { size: sz } : {}), ...(color?.rgb ? { color: argb(color.rgb) } : {}) };
  }
  if (estilo.fill?.fgColor?.rgb) {
    convertido.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(estilo.fill.fgColor.rgb) };
  }
  if (estilo.alignment) {
    // xlsx-js-style usava 'center'; no ExcelJS o alinhamento vertical equivalente é 'middle'.
    const { vertical, ...resto } = estilo.alignment;
    convertido.alignment = { ...resto, ...(vertical ? { vertical: vertical === 'center' ? 'middle' : vertical } : {}) };
  }
  if (estilo.border) {
    convertido.border = Object.fromEntries(
      Object.entries(estilo.border).map(([lado, b]) => [lado, { style: b?.style || 'thin', color: argb(b?.color?.rgb) }]),
    );
  }
  return convertido;
}

function nomeAbaValido(nome: string) {
  return (nome || 'Planilha').replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Planilha';
}

async function baixar(workbook: any, nomeArquivo: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Planilha simples: uma aba, primeira linha = cabeçalho (em negrito). */
export async function baixarPlanilha(nomeArquivo: string, nomeAba: string, linhas: ValorCelula[][]) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const aba = workbook.addWorksheet(nomeAbaValido(nomeAba));
  linhas.forEach((linha) => aba.addRow(linha.map((v) => (v === undefined ? null : v))));
  if (linhas.length) aba.getRow(1).font = { bold: true };
  // Largura de cada coluna pelo maior conteúdo (limitada), como o Excel faria ao "autoajustar".
  aba.columns.forEach((coluna, i) => {
    const maior = Math.max(...linhas.map((l) => String(l[i] ?? '').length), 8);
    coluna.width = Math.min(maior + 2, 60);
  });
  await baixar(workbook, nomeArquivo);
}

/** Planilha com célula a célula formatada e intervalos mesclados (Ordem de Compra). */
export async function baixarPlanilhaEstilizada(
  nomeArquivo: string,
  nomeAba: string,
  celulas: Map<string, CelulaEstilizada & { linha: number; coluna: number }>,
  mesclas: IntervaloMesclado[],
  largurasColunas: number[],
) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const aba = workbook.addWorksheet(nomeAbaValido(nomeAba));
  largurasColunas.forEach((largura, i) => { aba.getColumn(i + 1).width = largura; });
  celulas.forEach(({ linha, coluna, valor, estilo }) => {
    const celula = aba.getCell(linha + 1, coluna + 1);
    celula.value = valor === undefined || valor === '' ? null : (valor as any);
    Object.assign(celula, converterEstilo(estilo));
  });
  mesclas.forEach((m) => aba.mergeCells(m.linhaInicio + 1, m.colunaInicio + 1, m.linhaFim + 1, m.colunaFim + 1));
  await baixar(workbook, nomeArquivo);
}
