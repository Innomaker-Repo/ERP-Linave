import jsPDF from 'jspdf';
import type { PedidoCompraResumo } from './comprasLocal';
import { formatNumeroOsDisplay } from '../../../../services/ordensServico';

const money = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Gera e baixa o PDF do Pedido de Compra (1 por fornecedor, gerado automaticamente na
 * aprovação da solicitação de compra). Retorna o arquivo gerado para quem chamou decidir
 * o que fazer com ele (anexar, etc.), no mesmo padrão dos demais documentos do sistema.
 */
export const handleDownloadPedidoCompraPDF = (pedido: PedidoCompraResumo) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Pedido de Compra ${pedido.numero}`, margin, y);
  y += 9;

  doc.setFontSize(10);
  const infoLines: Array<[string, string]> = [
    ['Fornecedor', pedido.fornecedor || '-'],
    ['CNPJ', pedido.fornecedorCnpj || '-'],
    ['Solicitação de origem', pedido.solicitacaoId || '-'],
    ['OS / Centro de Custo', formatNumeroOsDisplay(pedido.centroCusto) || '-'],
    ['Data', pedido.data ? new Date(pedido.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')],
    ['Solicitante', pedido.solicitante || '-'],
    ['Departamento', pedido.departamento || '-'],
    ['Prazo de entrega', pedido.prazoEntrega || '-'],
    ['Condição de pagamento', pedido.condicaoPagamento || '-'],
  ];

  infoLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 55, y, { maxWidth: tableWidth - 55 });
    y += 6;
  });

  y += 3;
  doc.setFont('helvetica', 'bold');
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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(c.label, x + 1.5, y + rowHeight - 2);
      x += c.width;
    });
    y += rowHeight;
  };

  drawHeader();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  pedido.itens.forEach((item) => {
    if (y > 270) {
      doc.addPage();
      y = 16;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }

    let x = margin;
    const values = [item.descricao || item.nome || '-', String(item.qtd), item.un || '-', money(item.valorUnitario), money(item.valorTotal)];
    scaledCols.forEach((c, index) => {
      doc.rect(x, y, c.width, rowHeight);
      // A linha tem altura fixa (1 linha de texto) — em vez de cortar na primeira linha
      // quebrada e jogar o resto fora sem aviso, trunca pela largura medida com reticências.
      const maxWidth = c.width - 3;
      let texto = values[index] || '';
      if (doc.getTextWidth(texto) > maxWidth) {
        while (texto.length > 1 && doc.getTextWidth(`${texto}…`) > maxWidth) {
          texto = texto.slice(0, -1);
        }
        texto += '…';
      }
      doc.text(texto, x + 1.5, y + rowHeight - 2);
      x += c.width;
    });
    y += rowHeight;
  });

  // Sem essa checagem, um pedido cujo loop de itens terminasse perto do rodapé (y > 270 só
  // impedia NOVAS linhas de item, não o bloco de total/observações abaixo) tinha o valor total
  // e/ou as observações desenhados fora da página.
  const obsLines = pedido.observacoes ? doc.splitTextToSize(pedido.observacoes, tableWidth) : [];
  const espacoNecessario = 6 + 8 + (obsLines.length > 0 ? 5 + obsLines.length * 5 : 0);
  if (y + espacoNecessario > pageHeight - margin) {
    doc.addPage();
    y = 16;
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Valor total do pedido: ${money(pedido.valorTotal)}`, margin, y);
  y += 8;

  if (obsLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Observações:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(obsLines, margin, y);
  }

  const nomeArquivo = `Pedido_Compra_${pedido.numero}.pdf`;
  const conteudoDataUrl = doc.output('datauristring');
  doc.save(nomeArquivo);

  // Tamanho real do PDF em bytes: descontando o prefixo "data:...;base64," (não é conteúdo) e
  // o padding "=" do base64, que juntos inflavam o valor reportado.
  const base64 = conteudoDataUrl.slice(conteudoDataUrl.indexOf(',') + 1);
  const padding = (base64.match(/=+$/)?.[0] || '').length;
  const tamanho = Math.max(0, Math.round((base64.length * 3) / 4) - padding);

  return {
    nomeArquivo,
    conteudoDataUrl,
    tamanho,
  };
};
