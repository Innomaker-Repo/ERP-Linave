import jsPDF from 'jspdf';

const safeNumber = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDecimal = (value: string) => {
  const normalized = String(value || '').trim();
  const parsed = normalized.includes(',')
    ? Number(normalized.replace(/\./g, '').replace(',', '.'))
    : Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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

/**
 * Gera e baixa o PDF "bonito" do Orçamento.
 * Recebe apenas os dados do negócio que ele representa e devolve o arquivo gerado
 * (nome + data URL) para que a tela que chamou decida o que fazer (anexar, etc.).
 */
export const handleDownloadOrcamentoPDF = (orcamento: any, cliente: any, obra: any) => {
  if (!orcamento) return undefined;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const lineHeight = 5;
  const cellHeight = lineHeight;
  let y = 10;
  const margin = 8;
  const baseColWidth = (pageWidth - margin * 2) / 10;
  const laborColWidths = [
    baseColWidth,
    baseColWidth * 2.7,
    baseColWidth,
    baseColWidth,
    baseColWidth * 1.4,
    baseColWidth * 1.6,
    baseColWidth * 1.3
  ];
  const materialsColWidths = [
    baseColWidth,
    baseColWidth * 3.3,
    baseColWidth * 0.8,
    baseColWidth * 0.9,
    baseColWidth * 1.3,
    baseColWidth * 1.4,
    baseColWidth * 1.3
  ];
  const sumWidths = (widths: number[]) => widths.reduce((sum, width) => sum + width, 0);

  const drawCellWithAutoWrap = (x: number, y: number, width: number, height: number, text: string, bold = false, red = false) => {
    doc.setFont('Arial', bold ? 'bold' : 'normal');
    if (red) {
      doc.setTextColor(255, 0, 0);
    } else {
      doc.setTextColor(0, 0, 0);
    }
    const lines = doc.splitTextToSize(text || '', width - 2);
    let fontSize = 8;
    let displayLines = lines.slice(0, 2);
    if (lines.length > 2) {
      fontSize = 6;
      doc.setFontSize(fontSize);
      const newLines = doc.splitTextToSize(text || '', width - 2);
      displayLines = newLines.slice(0, 3);
    } else {
      doc.setFontSize(fontSize);
    }
    doc.rect(x, y, width, height);
    const lineHeightText = fontSize * 0.35;
    const totalTextHeight = displayLines.length * lineHeightText;
    let textY = y + (height - totalTextHeight) / 2 + lineHeightText * 0.7;
    displayLines.forEach((line: string) => {
      doc.text(line, x + 1, textY, { maxWidth: width - 2 });
      textY += lineHeightText;
    });
    doc.setTextColor(0, 0, 0);
  };

  const drawCell = (x: number, y: number, width: number, height: number, text: string, bold = false, red = false) => {
    doc.rect(x, y, width, height);
    doc.setFont('Arial', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    if (red) {
      doc.setTextColor(255, 0, 0);
    } else {
      doc.setTextColor(0, 0, 0);
    }
    const maxChars = Math.floor(width / 1.5);
    const wrappedText = text.length > maxChars ? text.substring(0, maxChars - 3) + '...' : text;
    doc.text(wrappedText, x + 1, y + 3.5, { maxWidth: width - 2 });
    doc.setTextColor(0, 0, 0);
  };

  let x = margin;
  drawCell(x, y, baseColWidth, cellHeight, 'Cliente:', true);
  x += baseColWidth;
  drawCell(x, y, baseColWidth * 3, cellHeight, cliente?.razaoSocial || '');
  x += baseColWidth * 3;
  drawCell(x, y, baseColWidth, cellHeight, '');
  x += baseColWidth;
  drawCell(x, y, baseColWidth * 5, cellHeight, `Data: ${new Date().toLocaleDateString('pt-BR')}`);
  y += cellHeight;

  x = margin;
  drawCell(x, y, baseColWidth, cellHeight, 'Ship:', true);
  x += baseColWidth;
  drawCell(x, y, baseColWidth * 9, cellHeight, obra?.nome || '');
  y += cellHeight;

  x = margin;
  drawCell(x, y, baseColWidth, cellHeight, 'Escopo:', true);
  x += baseColWidth;
  drawCell(x, y, baseColWidth * 9, cellHeight, 'Serviços conforme descrito abaixo');
  y += cellHeight + 2;

  const valores = orcamento.valores || {};
  const dados = orcamento.data || {};
  const base = safeNumber(valores.totalBruto ?? valores.subtotal);
  const margemPercent = safeNumber(valores.margem);
  const ohPercent = safeNumber(valores.oh);
  const impostosPercent = safeNumber(valores.impostos);
  const valorMargem = safeNumber(valores.valorMargem ?? ((base * margemPercent) / 100));
  const valorOH = safeNumber(valores.valorOH ?? ((base * ohPercent) / 100));
  const semImposto = safeNumber(valores.totalSemImposto ?? (base + valorMargem + valorOH));
  const valorImposto = safeNumber(valores.valorImpostos ?? ((semImposto * impostosPercent) / 100));
  const precoFinal = safeNumber(valores.precoFinal);

  const maoDeObraData = (dados.maoDeObra || []).filter((item: any) => item.funcao);
  const totalMaoDeObra = maoDeObraData.reduce((sum: number, item: any) => sum + parseDecimal(item.valorTotal || '0'), 0);
  const materiaisData = (dados.materiais || []).filter((item: any) => item.descricao);
  const totalMateriais = materiaisData.reduce((sum: number, item: any) => sum + parseDecimal(item.valorTotal || '0'), 0);
  const terceirizadosData = (dados.terceirizados || []).filter((item: any) => item.descricao);
  const totalTerceiros = terceirizadosData.reduce((sum: number, item: any) => sum + parseDecimal(item.valorTotal || '0'), 0);

  const totalItens = maoDeObraData.length + materiaisData.length + terceirizadosData.length;
  const precoPorItem = totalItens > 0 ? precoFinal / totalItens : 0;

  x = margin;
  doc.setFont('Arial', 'bold');
  doc.setFontSize(9);
  doc.text('A', x + 2, y + 3);
  doc.rect(x, y, baseColWidth, cellHeight);
  x += baseColWidth;
  doc.setTextColor(255, 0, 0);
  doc.text('MÃO DE OBRA', x + 2, y + 3);
  doc.rect(x, y, baseColWidth * 9, cellHeight);
  doc.setTextColor(0, 0, 0);
  y += cellHeight;

  x = margin;
  const headersMaoDeObra = ['Item', 'Função', 'Qtd', 'Dias', 'Custo/Dia', 'Obs', 'Valor Total'];
  headersMaoDeObra.forEach((h, index) => {
    const colWidth = laborColWidths[index];
    doc.setFont('Arial', 'bold');
    doc.setFontSize(7);
    doc.text(h, x + 0.5, y + 2.5, { maxWidth: colWidth - 1 });
    doc.rect(x, y, colWidth, cellHeight);
    x += colWidth;
  });
  y += cellHeight;

  maoDeObraData.forEach((item: any, idx: number) => {
    x = margin;
    doc.setFont('Arial', 'normal');
    doc.setFontSize(7);

    doc.text(String(idx + 1), x + 0.5, y + 2.5);
    doc.rect(x, y, laborColWidths[0], cellHeight);
    x += laborColWidths[0];

    drawCellWithAutoWrap(x, y, laborColWidths[1], cellHeight, item.funcao || '');
    x += laborColWidths[1];

    doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
    doc.rect(x, y, laborColWidths[2], cellHeight);
    x += laborColWidths[2];

    doc.text(String(item.dias || ''), x + 0.5, y + 2.5);
    doc.rect(x, y, laborColWidths[3], cellHeight);
    x += laborColWidths[3];

    doc.text(String(item.custoUnitDia ? parseFloat(item.custoUnitDia).toFixed(2) : ''), x + 0.5, y + 2.5);
    doc.rect(x, y, laborColWidths[4], cellHeight);
    x += laborColWidths[4];

    drawCellWithAutoWrap(x, y, laborColWidths[5], cellHeight, item.observacoes || item.observacao || '');
    x += laborColWidths[5];

    doc.setFont('Arial', 'bold');
    doc.setTextColor(255, 0, 0);
    doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('Arial', 'normal');
    doc.rect(x, y, laborColWidths[6], cellHeight);
    x += laborColWidths[6];

    y += cellHeight;
  });

  x = margin;
  doc.setFont('Arial', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 0, 0);
  doc.text('Sub-total', x + 0.5, y + 2.5);
  doc.setTextColor(0, 0, 0);
  doc.rect(x, y, sumWidths(laborColWidths.slice(0, -1)), cellHeight);
  x += sumWidths(laborColWidths.slice(0, -1));
  doc.setTextColor(255, 0, 0);
  doc.text(totalMaoDeObra.toFixed(2), x + 0.5, y + 2.5);
  doc.setTextColor(0, 0, 0);
  doc.rect(x, y, laborColWidths[6], cellHeight);
  y += cellHeight + 2;

  if (materiaisData && materiaisData.length > 0) {
    const headersMateriais = ['Item', 'Descrição', 'Un', 'Qtd', 'Peso/Fat', 'Custo Un', 'Total'];

    x = margin;
    doc.setFont('Arial', 'bold');
    doc.setFontSize(9);
    doc.text('B', x + 2, y + 3);
    doc.rect(x, y, baseColWidth, cellHeight);
    x += baseColWidth;
    doc.setTextColor(255, 0, 0);
    doc.text('CONSUMÍVEIS E MATERIAIS', x + 2, y + 3);
    doc.rect(x, y, baseColWidth * 9, cellHeight);
    doc.setTextColor(0, 0, 0);
    y += cellHeight;

    x = margin;
    headersMateriais.forEach((h, index) => {
      const colWidth = materialsColWidths[index];
      doc.setFont('Arial', 'bold');
      doc.setFontSize(7);
      doc.text(h, x + 0.5, y + 2.5, { maxWidth: colWidth - 1 });
      doc.rect(x, y, colWidth, cellHeight);
      x += colWidth;
    });
    y += cellHeight;

    materiaisData.forEach((item: any, idx: number) => {
      x = margin;
      doc.setFont('Arial', 'normal');
      doc.setFontSize(7);

      doc.text(String(idx + 1), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[0], cellHeight);
      x += materialsColWidths[0];

      drawCellWithAutoWrap(x, y, materialsColWidths[1], cellHeight, item.descricao || '');
      x += materialsColWidths[1];

      doc.text(item.unidade || '', x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[2], cellHeight);
      x += materialsColWidths[2];

      doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[3], cellHeight);
      x += materialsColWidths[3];

      doc.text(String(item.pesoFator || ''), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[4], cellHeight);
      x += materialsColWidths[4];

      doc.text(String(item.custoUnit ? parseFloat(item.custoUnit).toFixed(2) : ''), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[5], cellHeight);
      x += materialsColWidths[5];

      doc.setFont('Arial', 'bold');
      doc.setTextColor(255, 0, 0);
      doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('Arial', 'normal');
      doc.rect(x, y, materialsColWidths[6], cellHeight);
      x += materialsColWidths[6];

      y += cellHeight;
    });

    x = margin;
    doc.setFont('Arial', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 0, 0);
    doc.text('Valor total', x + 0.5, y + 2.5);
    doc.setTextColor(0, 0, 0);
    doc.rect(x, y, sumWidths(materialsColWidths.slice(0, -1)), cellHeight);
    x += sumWidths(materialsColWidths.slice(0, -1));
    doc.setTextColor(255, 0, 0);
    doc.text(totalMateriais.toFixed(2), x + 0.5, y + 2.5);
    doc.setTextColor(0, 0, 0);
    doc.rect(x, y, materialsColWidths[6], cellHeight);
    y += cellHeight + 2;
  }

  if (terceirizadosData && terceirizadosData.length > 0) {
    const headersTerceiros = ['Item', 'Descrição', 'Un', 'Qtd', 'Peso/Fat', 'Custo Un', 'Total'];

    x = margin;
    doc.setFont('Arial', 'bold');
    doc.setFontSize(9);
    doc.text('C', x + 2, y + 3);
    doc.rect(x, y, baseColWidth, cellHeight);
    x += baseColWidth;
    doc.setTextColor(255, 0, 0);
    doc.text('SERVIÇOS TERCEIRIZADOS', x + 2, y + 3);
    doc.rect(x, y, baseColWidth * 9, cellHeight);
    doc.setTextColor(0, 0, 0);
    y += cellHeight;

    x = margin;
    headersTerceiros.forEach((h, index) => {
      const colWidth = materialsColWidths[index];
      doc.setFont('Arial', 'bold');
      doc.setFontSize(7);
      doc.text(h, x + 0.5, y + 2.5, { maxWidth: colWidth - 1 });
      doc.rect(x, y, colWidth, cellHeight);
      x += colWidth;
    });
    y += cellHeight;

    terceirizadosData.forEach((item: any, idx: number) => {
      x = margin;
      doc.setFont('Arial', 'normal');
      doc.setFontSize(7);

      doc.text(String(idx + 1), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[0], cellHeight);
      x += materialsColWidths[0];

      drawCellWithAutoWrap(x, y, materialsColWidths[1], cellHeight, item.descricao || '');
      x += materialsColWidths[1];

      doc.text(item.unidade || '', x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[2], cellHeight);
      x += materialsColWidths[2];

      doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[3], cellHeight);
      x += materialsColWidths[3];

      doc.text(String(item.pesoFator || ''), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[4], cellHeight);
      x += materialsColWidths[4];

      doc.text(String(item.custoUnit ? parseFloat(item.custoUnit).toFixed(2) : ''), x + 0.5, y + 2.5);
      doc.rect(x, y, materialsColWidths[5], cellHeight);
      x += materialsColWidths[5];

      doc.setFont('Arial', 'bold');
      doc.setTextColor(255, 0, 0);
      doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('Arial', 'normal');
      doc.rect(x, y, materialsColWidths[6], cellHeight);
      x += materialsColWidths[6];

      y += cellHeight;
    });

    x = margin;
    doc.setFont('Arial', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 0, 0);
    doc.text('Sub-total', x + 0.5, y + 2.5);
    doc.setTextColor(0, 0, 0);
    doc.rect(x, y, sumWidths(materialsColWidths.slice(0, -1)), cellHeight);
    x += sumWidths(materialsColWidths.slice(0, -1));
    doc.setTextColor(255, 0, 0);
    doc.text(totalTerceiros.toFixed(2), x + 0.5, y + 2.5);
    doc.setTextColor(0, 0, 0);
    doc.rect(x, y, materialsColWidths[6], cellHeight);
    y += cellHeight + 2;
  }

  x = margin;
  doc.setFont('Arial', 'bold');
  doc.setFontSize(9);
  doc.text('E', x + 2, y + 3);
  doc.rect(x, y, baseColWidth, cellHeight);
  x += baseColWidth;
  doc.text('Cálculos Finais', x + 2, y + 3);
  doc.rect(x, y, baseColWidth * 9, cellHeight);
  y += cellHeight;

  const calculos = [
    ['1', 'Valor mão de obra', totalMaoDeObra.toFixed(2)],
    ['2', 'Valor consumível e material', totalMateriais.toFixed(2)],
    ['3', 'Valor terceirizados', totalTerceiros.toFixed(2)],
    ['4', 'Total', base.toFixed(2)],
    ['5', `O.H (${ohPercent}%)`, valorOH.toFixed(2)],
    ['6', `Margem (${margemPercent}%)`, valorMargem.toFixed(2)],
    ['7', 'PV S/ imposto', semImposto.toFixed(2)],
    ['8', `Imposto S/ NF (${impostosPercent}%)`, valorImposto.toFixed(2)],
    ['9', 'PV FINAL R$', precoFinal.toFixed(2)]
  ];

  calculos.forEach((row, idx) => {
    const isLastRow = idx === calculos.length - 1;
    x = margin;
    doc.setFont('Arial', 'normal');
    doc.setFontSize(8);
    if (isLastRow) {
      doc.setFont('Arial', 'bold');
      doc.setTextColor(255, 0, 0);
    }
    doc.text(row[0], x + 0.5, y + 2.5);
    doc.rect(x, y, baseColWidth, cellHeight);
    x += baseColWidth;
    doc.text(row[1], x + 0.5, y + 2.5, { maxWidth: baseColWidth * 8 - 2 });
    doc.rect(x, y, baseColWidth * 8, cellHeight);
    x += baseColWidth * 8;
    doc.text(row[2], x + 0.5, y + 2.5);
    doc.rect(x, y, baseColWidth, cellHeight);
    if (isLastRow) {
      doc.setTextColor(0, 0, 0);
    }
    y += cellHeight;
  });

  x = margin;
  doc.setFont('Arial', 'bold');
  doc.setFontSize(8);
  doc.text('RESUMO:', x + 0.5, y + 2.5);
  doc.rect(x, y, baseColWidth * 10, cellHeight);
  y += cellHeight;

  x = margin;
  doc.setFont('Arial', 'normal');
  doc.setFontSize(8);
  doc.text('Qtd. de Itens:', x + 0.5, y + 2.5);
  doc.rect(x, y, baseColWidth * 5, cellHeight);
  x += baseColWidth * 5;
  doc.setFont('Arial', 'bold');
  doc.text(String(totalItens), x + 0.5, y + 2.5);
  doc.rect(x, y, baseColWidth * 5, cellHeight);
  y += cellHeight;

  x = margin;
  doc.setFont('Arial', 'normal');
  doc.setFontSize(8);
  doc.text('Preço por Item:', x + 0.5, y + 2.5);
  doc.rect(x, y, baseColWidth * 5, cellHeight);
  x += baseColWidth * 5;
  doc.setFont('Arial', 'bold');
  doc.text(`R$ ${precoPorItem.toFixed(2)}`, x + 0.5, y + 2.5);
  doc.rect(x, y, baseColWidth * 5, cellHeight);
  y += cellHeight;

  x = margin;
  doc.setFont('Arial', 'normal');
  doc.setFontSize(8);
  doc.text('Valor Total:', x + 0.5, y + 2.5);
  doc.rect(x, y, baseColWidth * 5, cellHeight);
  x += baseColWidth * 5;
  doc.setFont('Arial', 'bold');
  doc.setTextColor(255, 0, 0);
  doc.text(`R$ ${precoFinal.toFixed(2)}`, x + 0.5, y + 2.5);
  doc.setTextColor(0, 0, 0);
  doc.rect(x, y, baseColWidth * 5, cellHeight);

  const nomeArquivo = `Orcamento_${orcamento.numeroOrcamento}_v${formatarVersaoOrcamento(orcamento.versao)}.pdf`;
  const conteudoDataUrl = doc.output('datauristring');
  doc.save(nomeArquivo);

  return {
    nomeArquivo,
    conteudoDataUrl,
    tamanho: Math.max(0, Math.round((conteudoDataUrl.length * 3) / 4)),
  };
};
