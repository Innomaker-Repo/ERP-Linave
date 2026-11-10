import jsPDF from 'jspdf';
import type { RequisicaoCompra } from './comprasLocal';
import { formatNumeroOsDisplay } from '../../../../services/ordensServico';

const money = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Gera e baixa o PDF da Cotação de uma solicitação (card de "Solicitações" no Kanban de
 * Compras) — mesmo padrão visual do PDF de Pedido de Compra (handleDownloadPedidoCompraPDF.ts):
 * cabeçalho com os dados da solicitação, seguido de uma tabela por item com TODOS os
 * fornecedores comparados (não só o vencedor), pra documentar a cotação inteira antes da
 * aprovação. O fornecedor vencedor/selecionado aparece destacado em negrito com um "★".
 */
export const handleDownloadCotacaoPDF = (request: RequisicaoCompra) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;
  let y = 16;

  const garantirEspaco = (necessario: number) => {
    if (y + necessario > pageHeight - margin) {
      doc.addPage();
      y = 16;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Cotação — ${request.pedidoCompraNumero || request.id}`, margin, y);
  y += 9;

  doc.setFontSize(10);
  const infoLines: Array<[string, string]> = [
    ['OS / Centro de Custo', formatNumeroOsDisplay(request.centroCusto) || '-'],
    ['Solicitante', request.solicitante || '-'],
    ['Departamento', request.departamento || '-'],
    ['Data da solicitação', request.createdAt ? new Date(request.createdAt).toLocaleDateString('pt-BR') : '-'],
    ['Total calculado', request.budgetValue != null ? money(request.budgetValue) : 'Seleção pendente'],
  ];
  infoLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 55, y, { maxWidth: tableWidth - 55 });
    y += 6;
  });
  y += 3;

  const cols = [
    { label: 'Fornecedor', width: 58 },
    { label: 'Vl. Unitário', width: 32 },
    { label: 'Vl. Total', width: 32 },
    { label: 'Prazo entrega', width: 38 },
    { label: 'Condição pgto.', width: 40 },
  ];
  const scale = tableWidth / cols.reduce((sum, c) => sum + c.width, 0);
  const scaledCols = cols.map((c) => ({ ...c, width: c.width * scale }));
  const rowHeight = 7;

  const truncar = (texto: string, largura: number) => {
    const maxWidth = largura - 3;
    let t = texto || '';
    if (doc.getTextWidth(t) > maxWidth) {
      while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxWidth) t = t.slice(0, -1);
      t += '…';
    }
    return t;
  };

  const drawTableHeader = () => {
    let x = margin;
    scaledCols.forEach((c) => {
      doc.setFillColor(230, 230, 230);
      doc.rect(x, y, c.width, rowHeight, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.rect(x, y, c.width, rowHeight, 'S');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(c.label, x + 1.5, y + rowHeight - 2);
      x += c.width;
    });
    y += rowHeight;
  };

  (request.itens || []).forEach((item, itemIndex) => {
    const detail = (request.budgetDetails || []).find((d) => d.itemId === item.id) || null;

    garantirEspaco(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`${itemIndex + 1}. ${item.descricao || item.nome || '-'}`, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Qtd: ${item.qtd} ${item.un || ''} • ${(detail?.naturezaFornecimento || item.naturezaFornecimento) === 'ITEM' ? 'Material' : 'Serviço'}`, margin, y);
    y += 5;

    if (detail?.jaEmEstoque) {
      doc.setFont('helvetica', 'italic');
      doc.text('Já em estoque — item dispensado de orçamento.', margin, y);
      y += 8;
      return;
    }

    const fornecedores = detail?.fornecedores || [];
    if (fornecedores.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('Sem cotação registrada para este item.', margin, y);
      y += 8;
      return;
    }

    garantirEspaco(rowHeight * (fornecedores.length + 1));
    drawTableHeader();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    fornecedores.forEach((supplier) => {
      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = 16;
        drawTableHeader();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
      }

      const selecionado = supplier.fornecedor && supplier.fornecedor === detail?.fornecedorSelecionado;
      let x = margin;
      const values = [
        `${selecionado ? '★ ' : ''}${supplier.fornecedor || '-'}`,
        supplier.valorUnitario ? money(supplier.valorUnitario) : '-',
        money(supplier.valor),
        supplier.prazoEntrega || '-',
        supplier.condicaoPagamento || '-',
      ];
      doc.setFont('helvetica', selecionado ? 'bold' : 'normal');
      if (selecionado) {
        doc.setFillColor(224, 247, 234);
        doc.rect(x, y, scaledCols.reduce((s, c) => s + c.width, 0), rowHeight, 'F');
      }
      scaledCols.forEach((c, index) => {
        doc.setDrawColor(0, 0, 0);
        doc.rect(x, y, c.width, rowHeight, 'S');
        doc.text(truncar(values[index], c.width), x + 1.5, y + rowHeight - 2);
        x += c.width;
      });
      y += rowHeight;
    });

    y += 6;
  });

  const nomeArquivo = `Cotacao_${request.pedidoCompraNumero || request.id}.pdf`;
  const conteudoDataUrl = doc.output('datauristring');
  doc.save(nomeArquivo);

  const base64 = conteudoDataUrl.slice(conteudoDataUrl.indexOf(',') + 1);
  const padding = (base64.match(/=+$/)?.[0] || '').length;
  const tamanho = Math.max(0, Math.round((base64.length * 3) / 4) - padding);

  return { nomeArquivo, conteudoDataUrl, tamanho };
};
