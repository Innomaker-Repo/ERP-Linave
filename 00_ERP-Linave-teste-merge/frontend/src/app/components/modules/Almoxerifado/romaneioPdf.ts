import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateBR } from '../../../utils/formatDate';

// Logo da Linave servido a partir de /public.
const LINAVE_LOGO_URL = '/image2.jpg';

export interface RomaneioPdfItem {
  descricao: string;
  quantidade: string | number;
  peso?: string | number; // peso (kg) que sai nessa linha (peso unit × qtd)
}

export interface RomaneioPdfParams {
  cliente?: string;
  osLabel?: string;
  enderecoEntrega?: string;
  placaMotorista?: string;
  dataEntrega?: string;
  peso?: string;
  pesoTotal?: string | number; // peso total (kg) do romaneio
  dataEmissao?: string; // ISO ou texto livre; formatado para dd/mm/aaaa
  items: RomaneioPdfItem[];
  logoBase64?: string;
}

// Formata peso (kg) em pt-BR, sem casas desnecessárias. Vazio quando 0/indefinido.
const formatPeso = (value?: string | number): string => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// Carrega o logo (de /public) como dataURL para embutir no PDF.
export const loadRomaneioLogoBase64 = async (url = LINAVE_LOGO_URL): Promise<string | undefined> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (blob.size === 0) return undefined;
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

const formatarData = (value?: string) => {
  if (!value) return new Date().toLocaleDateString('pt-BR');
  return formatDateBR(value) || value;
};

const getLogoFormat = (logoBase64?: string): 'PNG' | 'JPEG' => {
  const match = logoBase64?.match(/^data:image\/(png|jpe?g)/i);
  return match && match[1]?.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
};

/**
 * Gera o PDF do Romaneio de Material seguindo o modelo FLN 026 (cabeçalho com logo Linave,
 * campos do cabeçalho, tabela ITEM / MATERIAL DESCRIPTION / QTD e rodapé padrão).
 */
export const gerarRomaneioPdf = (params: RomaneioPdfParams): jsPDF => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  doc.setTextColor(0, 0, 0);

  // Data (canto superior direito)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Data: ${formatarData(params.dataEmissao)}`, pageWidth - margin, margin + 4, { align: 'right' });

  // Logo da Linave centralizado
  let y = margin;
  if (params.logoBase64) {
    const logoW = 120;
    const logoH = 38;
    try {
      doc.addImage(params.logoBase64, getLogoFormat(params.logoBase64), (pageWidth - logoW) / 2, y, logoW, logoH);
    } catch {
      // se a imagem falhar, segue sem logo
    }
    y += logoH + 6;
  } else {
    y += 18;
  }

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ROMANEIO DE MATERIAL', pageWidth / 2, y + 10, { align: 'center' });
  y += 22;

  // Cabeçalho (campos): label em negrito | valor
  const labelWidth = 200;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.6, textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: labelWidth, fontStyle: 'bold' },
      1: { cellWidth: contentWidth - labelWidth },
    },
    body: [
      ['Cliente:', params.cliente || ''],
      ['O.S:', params.osLabel || ''],
      ['Endereço de entrega do material:', params.enderecoEntrega || ''],
      ['PLACA/MOTORISTA:', params.placaMotorista || ''],
      ['Data para Entrega do material:', params.dataEntrega || ''],
      ['PESO TOTAL (kg):', formatPeso(params.pesoTotal ?? params.peso) || '—'],
    ],
  });
  y = (doc as any).lastAutoTable.finalY;

  // Total de peso (soma das linhas) para a linha-resumo da tabela.
  const pesoTotalCalc = params.items.reduce((soma, item) => {
    const n = typeof item.peso === 'number' ? item.peso : parseFloat(String(item.peso ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
    return soma + (Number.isFinite(n) ? n : 0);
  }, 0);
  const pesoTotalStr = formatPeso(params.pesoTotal ?? pesoTotalCalc);

  // Tabela de itens: ITEM | MATERIAL DESCRIPTION | QTD | PESO (kg)
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['ITEM', 'MATERIAL DESCRIPTION', 'QTD', 'PESO (kg)']],
    body: [
      ...params.items.map((item, index) => [
        String(index + 1),
        item.descricao || '',
        String(item.quantidade ?? ''),
        formatPeso(item.peso),
      ]),
      [
        { content: 'PESO TOTAL (kg)', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: pesoTotalStr || '0', styles: { halign: 'center', fontStyle: 'bold' } },
      ],
    ],
    styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.6, textColor: [0, 0, 0] },
    headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 50, halign: 'center' },
      1: { cellWidth: contentWidth - 50 - 55 - 70 },
      2: { cellWidth: 55, halign: 'center' },
      3: { cellWidth: 70, halign: 'center' },
    },
  });

  // Rodapé padrão FLN 026 em todas as páginas
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const footerY = pageHeight - 24;
    doc.text('Código: FLN 026', margin, footerY);
    doc.text('Rev. 00', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Pág: ${String(page).padStart(2, '0')}`, pageWidth - margin, footerY, { align: 'right' });
  }

  return doc;
};
