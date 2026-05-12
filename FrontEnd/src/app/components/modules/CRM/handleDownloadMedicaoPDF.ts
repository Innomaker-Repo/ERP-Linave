import jsPDF from 'jspdf';

// Função auxiliar para carregar a imagem da pasta public antes de gerar o PDF
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
};

export const handleDownloadMedicaoPDF = async (
  documentoMediacaoForm: any,
  cliente: any, 
  obra: any,    
) => {
  if (!documentoMediacaoForm) return;

  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    let y = 15;

    // --- FUNÇÕES UTILITÁRIAS ---
    const parseBrFloat = (val: any) => {
      if (typeof val === 'number') return val;
      const str = String(val || '').replace(/\./g, '').replace(',', '.');
      return parseFloat(str) || 0;
    };

    const formatCurrency = (value: any) => {
      const num = parseBrFloat(value);
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatNumber = (value: any) => {
      const num = parseBrFloat(value);
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatarDataParaBr = (dataISO: string) => {
      if (!dataISO) return '';
      if (dataISO.includes('/')) return dataISO;
      const data = new Date(dataISO + 'T00:00:00');
      return data.toLocaleDateString('pt-BR');
    };

    const drawCellWithAutoWrap = (
      x: number, y: number, width: number, height: number,
      text: string, align: 'left' | 'center' | 'right' = 'left',
      bold = false, border = true, valign: 'top' | 'middle' = 'middle'
    ) => {
      doc.setFont('Arial', bold ? 'bold' : 'normal');
      doc.setTextColor(0, 0, 0);

      if (border) doc.rect(x, y, width, height);
      if (!text) return;

      const padding = 2;
      const textWidth = width - padding * 2;
      const lines = doc.splitTextToSize(String(text), textWidth);
      
      let fontSize = 9;
      let displayLines = lines;

      if (lines.length > 3) {
        fontSize = 7;
        doc.setFontSize(fontSize);
        displayLines = doc.splitTextToSize(String(text), textWidth);
      } else if (lines.length > 2) {
        fontSize = 8;
        doc.setFontSize(fontSize);
        displayLines = doc.splitTextToSize(String(text), textWidth);
      } else {
        doc.setFontSize(fontSize);
      }

      const lineHeightText = fontSize * 0.35;
      const totalTextHeight = displayLines.length * lineHeightText + (displayLines.length - 1) * 1;
      
      let textY = y + padding + lineHeightText;
      if (valign === 'middle') {
        textY = y + (height - totalTextHeight) / 2 + lineHeightText - 0.5;
      }

      displayLines.forEach((line: string) => {
        let textX = x + padding;
        if (align === 'center') textX = x + width / 2;
        else if (align === 'right') textX = x + width - padding;
        doc.text(line, textX, textY, { align: align });
        textY += lineHeightText + 1;
      });
    };

    // ===== 1. LÓGICA DE EMPRESA E CARREGAMENTO DA LOGO =====
    const empresaNome = documentoMediacaoForm.empresa || 'Linave';
    const isLinave = String(empresaNome).toLowerCase().includes('linave');
    
    const nomeHeader = isLinave ? 'BM- LINAVE7.6+9iços Navais & Offshore' : 'BM- SERVINAVE';
    const razaoSocialPrestadora = isLinave ? 'W.L.M LINAVE Serviços Navais e Offshore' : 'SERVINAVE';
    const cnpjPrestadora = isLinave ? '34.282.247/0001-60' : documentoMediacaoForm.cnpj || '';
    
    const logoUrl = isLinave ? '/image2.jpg' : '/image1.png';
    let logoImg: HTMLImageElement | null = null;
    
    try {
      logoImg = await loadImage(logoUrl);
    } catch (error) {
      console.warn('Aviso: Não foi possível carregar a logo do diretório public:', error);
    }

    // ===== 2. CABEÇALHO FORMATO DE TABELA =====
    let x = margin;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);

    const colLogoW = 55;
    const colTitleW = usableWidth - colLogoW; 
    const row0Height = 15; 

    doc.rect(x, y, colLogoW, row0Height);
    if (logoImg) {
      doc.addImage(logoImg, isLinave ? 'JPEG' : 'PNG', x + 5, y + 2, colLogoW - 10, row0Height - 4);
    }

    doc.rect(x + colLogoW, y, colTitleW, row0Height);
    doc.setFont('Arial', 'bold');
    doc.setFontSize(11);
    doc.text(nomeHeader, x + colLogoW + (colTitleW / 2), y + 9, { align: 'center' });

    y += row0Height;

    const rowHeight = 6;
    const col1W = 28; 
    const col2W = 67; 
    const col3W = 28; 
    const col4W = 67; 

    const drawRowFields = (
      labelEsq: string, valorEsq: string, 
      labelDir: string, valorDir: string, 
      isLabelBoldEsq = true, isValueBoldEsq = true
    ) => {
      doc.rect(x, y, col1W, rowHeight);
      doc.setFont('Arial', isLabelBoldEsq ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.text(labelEsq, x + 2, y + 4.2);
      
      doc.rect(x + col1W, y, col2W, rowHeight);
      doc.setFont('Arial', isValueBoldEsq ? 'bold' : 'normal');
      let splitEsq = doc.splitTextToSize(String(valorEsq || ''), col2W - 4);
      doc.text(splitEsq, x + col1W + 2, y + (splitEsq.length > 1 ? 2.6 : 4.2));

      doc.rect(x + col1W + col2W, y, col3W, rowHeight);
      doc.setFont('Arial', 'bold');
      doc.text(labelDir, x + col1W + col2W + 2, y + 4.2);

      doc.rect(x + col1W + col2W + col3W, y, col4W, rowHeight);
      doc.setFont('Arial', 'normal');
      let splitDir = doc.splitTextToSize(String(valorDir || ''), col4W - 4);
      doc.text(splitDir, x + col1W + col2W + col3W + 2, y + (splitDir.length > 1 ? 2.6 : 4.2));

      y += rowHeight;
    };

    drawRowFields('Empresa:', razaoSocialPrestadora, 'Cliente:', documentoMediacaoForm.cliente || '', true, true);
    drawRowFields('CNPJ:', cnpjPrestadora, 'CNPJ:', documentoMediacaoForm.clienteCnpj || '12.345.678/0001-90', true, false);
    drawRowFields('Data emissao:', formatarDataParaBr(documentoMediacaoForm.dataEmissao) || '', 'Embarcaçao:', documentoMediacaoForm.embarcacao || '', true, false);
    drawRowFields('Nr. BM:', documentoMediacaoForm.numeroBM || '', 'Periodo:', documentoMediacaoForm.periodo || '', true, false);

    y += 8;

    // ===== 3. TABELA DE ITENS =====
    const colWidths = [12, 78, 20, 15, 30, 35];
    const headerHeight = 8;
    x = margin;
    doc.setFont('Arial', 'bold');
    doc.setFontSize(9);
    
    ['Ítem', 'Descrição dos Serviços', 'Quantid.', 'Unid.', 'Valor unit. R$', 'Valor total (R$)'].forEach((header, i) => {
      doc.rect(x, y, colWidths[i], headerHeight);
      doc.text(header, x + colWidths[i] / 2, y + 5.5, { align: 'center' });
      x += colWidths[i];
    });

    y += headerHeight;

    let totalGeral = 0;
    if (documentoMediacaoForm.tabelaItens && Array.isArray(documentoMediacaoForm.tabelaItens)) {
      documentoMediacaoForm.tabelaItens.forEach((linha: any, index: number) => {
        doc.setFont('Arial', 'normal');
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(linha.descricao || '', colWidths[1] - 4);
        const itemRowHeight = Math.max(8, lines.length * 4 + 4);

        if (y + itemRowHeight > pageHeight - 60) {
          doc.addPage();
          y = margin;
        }

        x = margin;
        const total = parseBrFloat(linha.total);
        totalGeral += total;

        drawCellWithAutoWrap(x, y, colWidths[0], itemRowHeight, String(linha.item || index + 1), 'center');
        drawCellWithAutoWrap(x + colWidths[0], y, colWidths[1], itemRowHeight, linha.descricao || '');
        drawCellWithAutoWrap(x + colWidths[0] + colWidths[1], y, colWidths[2], itemRowHeight, formatNumber(linha.quantidadeProduzida), 'center');
        drawCellWithAutoWrap(x + 110, y, colWidths[3], itemRowHeight, linha.unidade || '', 'center');
        drawCellWithAutoWrap(x + 125, y, colWidths[4], itemRowHeight, formatCurrency(linha.valorUnitario), 'right');
        drawCellWithAutoWrap(x + 155, y, colWidths[5], itemRowHeight, formatCurrency(total), 'right');

        y += itemRowHeight;
      });
    }

    // ===== 4. RODAPÉ E ASSINATURAS =====
    y += 10;
    if (y + 50 > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
    }

    x = margin;
    doc.setFont('Arial', 'bold');
    doc.setFontSize(11);
    doc.text(`Valor total desta medição: R$ ${formatCurrency(totalGeral)}`, x, y);
    
    y += 25;
    doc.setFont('Arial', 'normal');
    doc.setFontSize(10);
    doc.text('Aprovado por:', x, y);
    
    y += 15; // Coordenada da linha

    const sigWidth = 75;
    const spacing = 35;
    const lineY = y;

    // --- NOMES DO INPUT (ACIMA DA LINHA) ---
    doc.setFontSize(9);
    const nomeRepCliente = documentoMediacaoForm.representanteCliente || '';
    const nomeRepPrestadora = documentoMediacaoForm.representanteLinave || documentoMediacaoForm.representantePrestadora || '';

    doc.text(nomeRepCliente, x + sigWidth / 2, lineY - 2, { align: 'center' });
    doc.text(nomeRepPrestadora, x + sigWidth + spacing + sigWidth / 2, lineY - 2, { align: 'center' });

    // --- DESENHO DAS LINHAS ---
    doc.setLineWidth(0.3);
    doc.line(x, lineY, x + sigWidth, lineY); 
    doc.line(x + sigWidth + spacing, lineY, x + sigWidth + spacing + sigWidth, lineY); 
    
    // --- TÍTULOS FIXOS (ABAIXO DA LINHA) ---
    doc.setFont('Arial', 'bold');
    doc.setFontSize(8);
    doc.text('Representante do Cliente', x + sigWidth / 2, lineY + 4, { align: 'center' });
    
    const tituloFixoPrestadora = isLinave ? 'Representante Linave Enga. Serviços' : 'Representante Servinave';
    doc.text(tituloFixoPrestadora, x + sigWidth + spacing + sigWidth / 2, lineY + 4, { align: 'center' });

    // ===== 5. SALVAR =====
    const prefixo = isLinave ? 'LN' : 'SN';
    const numeroBMSanitizado = (documentoMediacaoForm.numeroBM || '001').replace(/[/\\]/g, '-');
    const nomeArquivo = `${prefixo}_Medicao_${numeroBMSanitizado}_${Date.now()}.pdf`;
    
    doc.save(nomeArquivo);

    return { nomeArquivo, conteudoDataUrl: doc.output('datauristring') };
  } catch (error) {
    console.error('Erro ao gerar o PDF:', error);
    throw error;
  }
};