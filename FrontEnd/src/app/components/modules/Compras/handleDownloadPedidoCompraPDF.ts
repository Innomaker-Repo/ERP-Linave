import jsPDF from 'jspdf';
import type { PedidoCompraResumo } from './comprasLocal';

const money = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Gera e baixa o PDF do Pedido de Compra (1 por fornecedor, gerado automaticamente na
 * aprovação da solicitação de compra). Retorna o arquivo gerado para quem chamou decidir
 * o que fazer com ele (anexar, etc.), no mesmo padrão dos demais documentos do sistema.
 */
export const handleDownloadPedidoCompraPDF = (pedido: PedidoCompraResumo) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;
  let y = 16;

  doc.setFont('Arial', 'bold');
  doc.setFontSize(16);
  doc.text(`Pedido de Compra ${pedido.numero}`, margin, y);
  y += 9;

  doc.setFontSize(10);
  const infoLines: Array<[string, string]> = [
    ['Fornecedor', pedido.fornecedor || '-'],
    ['CNPJ', pedido.fornecedorCnpj || '-'],
    ['Solicitação de origem', pedido.solicitacaoId || '-'],
    ['OS / Centro de Custo', pedido.centroCusto || '-'],
    ['Data', pedido.data ? new Date(pedido.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')],
    ['Solicitante', pedido.solicitante || '-'],
    ['Departamento', pedido.departamento || '-'],
    ['Prazo de entrega', pedido.prazoEntrega || '-'],
    ['Condição de pagamento', pedido.condicaoPagamento || '-'],
  ];

  infoLines.forEach(([label, value]) => {
    doc.setFont('Arial', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('Arial', 'normal');
    doc.text(String(value), margin + 55, y, { maxWidth: tableWidth - 55 });
    y += 6;
  });

  y += 3;
  doc.setFont('Arial', 'bold');
  doc.setFontSize(11);
  doc.text('Itens', margin, y);
  y += 5;

  const cols = [
    { label: 'Item', width: 62 },
    { label: 'Qtd', width: 18 },
    { label: 'Un', width: 16 },
    { label: 'Vl. Unitário', width: 30 },
    { label: 'Vl. Total', width: 30 },
  ];
  const scale = tableWidth / cols.reduce((sum, c) => sum + c.width, 0);
  const scaledCols = cols.map((c) => ({ ...c, width: c.width * scale }));
  const rowHeight = 7;

  const drawHeader = () => {
    let x = margin;
    scaledCols.forEach((c) => {
      doc.setFillColor(230, 230, 230);
      doc.rect(x, y, c.width, rowHeight, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.rect(x, y, c.width, rowHeight, 'S');
      doc.setTextColor(0, 0, 0);
      doc.setFont('Arial', 'bold');
      doc.setFontSize(9);
      doc.text(c.label, x + 1.5, y + rowHeight - 2);
      x += c.width;
    });
    y += rowHeight;
  };

  drawHeader();
  doc.setFont('Arial', 'normal');
  doc.setFontSize(9);

  pedido.itens.forEach((item) => {
    if (y > 270) {
      doc.addPage();
      y = 16;
      drawHeader();
      doc.setFont('Arial', 'normal');
      doc.setFontSize(9);
    }

    let x = margin;
    const values = [item.descricao || item.nome || '-', String(item.qtd), item.un || '-', money(item.valorUnitario), money(item.valorTotal)];
    scaledCols.forEach((c, index) => {
      doc.rect(x, y, c.width, rowHeight);
      const text = doc.splitTextToSize(values[index], c.width - 3);
      doc.text(text[0] || '', x + 1.5, y + rowHeight - 2);
      x += c.width;
    });
    y += rowHeight;
  });

  y += 6;
  doc.setFont('Arial', 'bold');
  doc.setFontSize(11);
  doc.text(`Valor total do pedido: ${money(pedido.valorTotal)}`, margin, y);
  y += 8;

  if (pedido.observacoes) {
    doc.setFont('Arial', 'bold');
    doc.setFontSize(10);
    doc.text('Observações:', margin, y);
    y += 5;
    doc.setFont('Arial', 'normal');
    const obsLines = doc.splitTextToSize(pedido.observacoes, tableWidth);
    doc.text(obsLines, margin, y);
  }

  const nomeArquivo = `Pedido_Compra_${pedido.numero}.pdf`;
  const conteudoDataUrl = doc.output('datauristring');
  doc.save(nomeArquivo);

  return {
    nomeArquivo,
    conteudoDataUrl,
    tamanho: Math.max(0, Math.round((conteudoDataUrl.length * 3) / 4)),
  };
};
