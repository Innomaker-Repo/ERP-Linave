import jsPDF from 'jspdf';

export const handleDownloadMedicaoPDF = (
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

    // --- FUNÇÕES UTILITÁRIAS SEGURAS ---
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

    // ===== 1. LÓGICA DE EMPRESA E LOGO =====
    const empresaNome = documentoMediacaoForm.empresa || 'Linave';
    const isLinave = String(empresaNome).toLowerCase().includes('linave');
    
    // Títulos dinâmicos baseados na empresa[cite: 1, 4]
    const nomeHeader = isLinave ? 'LINAVE Enga. Serviços Navais & Offshore' : 'SERVINAVE';
    // const logoBase64 = isLinave ? base64LogoLinave : base64LogoServinave;

    // ===== 2. CABEÇALHO (TIPO TABELA) =====
    const logoWidth = 50;
    const rowHeightInfo = 7;
    let x = margin;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);

    // Bloco da Logo (mescla 4 linhas virtuais)[cite: 4]
    doc.rect(x, y, logoWidth, rowHeightInfo * 4);
    doc.setFont('Arial', 'bold');
    doc.setFontSize(10);
    doc.text('LOGO DA EMPRESA', x + logoWidth / 2, y + (rowHeightInfo * 4) / 2, { align: 'center' });
    // Se você tiver as imagens em base64, substitua a linha acima por:
    // doc.addImage(logoBase64, 'JPEG', x + 2, y + 2, logoWidth - 4, (rowHeightInfo * 4) - 4);

    // Linha 1: Título BM[cite: 4]
    doc.rect(x + logoWidth, y, usableWidth - logoWidth, rowHeightInfo);
    doc.setFontSize(11);
    doc.text(`BM - ${nomeHeader}`, x + logoWidth + 2, y + 5);
    y += rowHeightInfo;

    // Linha 2: Empresa[cite: 4]
    doc.rect(x + logoWidth, y, usableWidth - logoWidth, rowHeightInfo);
    doc.setFontSize(9);
    doc.setFont('Arial', 'bold');
    doc.text('Empresa:', x + logoWidth + 2, y + 5);
    doc.setFont('Arial', 'normal');
    doc.text(empresaNome.toUpperCase(), x + logoWidth + 20, y + 5);
    y += rowHeightInfo;

    // Linha 3: CNPJ[cite: 4]
    doc.rect(x + logoWidth, y, usableWidth - logoWidth, rowHeightInfo);
    doc.setFont('Arial', 'bold');
    doc.text('CNPJ:', x + logoWidth + 2, y + 5);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.cnpj || '', x + logoWidth + 15, y + 5);
    y += rowHeightInfo;

    // Linha 4: Data Emissão[cite: 4]
    doc.rect(x + logoWidth, y, usableWidth - logoWidth, rowHeightInfo);
    doc.setFont('Arial', 'bold');
    doc.text('Data emissao:', x + logoWidth + 2, y + 5);
    doc.setFont('Arial', 'normal');
    doc.text(formatarDataParaBr(documentoMediacaoForm.dataEmissao) || '', x + logoWidth + 27, y + 5);
    y += rowHeightInfo;

    // Linha 5: Nr. BM e Período (Abaixo da logo e das informações)[cite: 4]
    const wBm = 90;
    doc.rect(x, y, wBm, rowHeightInfo);
    doc.setFont('Arial', 'bold');
    doc.text('Nr. BM:', x + 2, y + 5);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.numeroBM || '', x + 16, y + 5);

    doc.rect(x + wBm, y, usableWidth - wBm, rowHeightInfo);
    doc.setFont('Arial', 'bold');
    doc.text('Periodo:', x + wBm + 2, y + 5);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.periodo || '', x + wBm + 18, y + 5);
    
    y += rowHeightInfo + 8; // Espaço antes da tabela

    // ===== 3. TABELA DE MEDIÇÃO - CABEÇALHOS =====
    const colWidths = [12, 78, 20, 15, 30, 35]; // Total = 190 (usableWidth)
    const headerHeight = 8;
    x = margin;
    
    doc.setFont('Arial', 'bold');
    doc.setFontSize(9);
    
    // Nomes exatos do Modelo[cite: 4]
    const headers = [
      'Ítem', 
      'Descrição dos Serviços', 
      'Quantid.', 
      'Unid.', 
      'Valor unit. R$', 
      'Valor total (R$)'
    ];

    headers.forEach((header, i) => {
      doc.rect(x, y, colWidths[i], headerHeight);
      doc.text(header, x + colWidths[i] / 2, y + 5.5, { align: 'center' });
      x += colWidths[i];
    });

    y += headerHeight;

    // ===== 4. TABELA DE MEDIÇÃO - DADOS =====
    let totalGeral = 0;
    
    documentoMediacaoForm.tabelaItens.forEach((linha: any, index: number) => {
      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      
      const textWidth = colWidths[1] - 4;
      const lines = doc.splitTextToSize(linha.descricao || '', textWidth);
      const rowHeight = Math.max(8, lines.length * 4 + 4);

      if (y + rowHeight > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }

      x = margin;
      
      const itemText = linha.item ? String(linha.item) : String(index + 1);
      const valorUnitStr = linha.valorUnitario ? formatCurrency(linha.valorUnitario) : '';
      const qtdStr = linha.quantidadeProduzida ? formatNumber(linha.quantidadeProduzida) : '';
      
      const total = parseBrFloat(linha.total);
      totalGeral += total;
      const totalStr = formatCurrency(total);

      drawCellWithAutoWrap(x, y, colWidths[0], rowHeight, itemText, 'center', false);
      x += colWidths[0];
      
      drawCellWithAutoWrap(x, y, colWidths[1], rowHeight, linha.descricao || '', 'left', false);
      x += colWidths[1];
      
      drawCellWithAutoWrap(x, y, colWidths[2], rowHeight, qtdStr, 'center', false);
      x += colWidths[2];

      drawCellWithAutoWrap(x, y, colWidths[3], rowHeight, linha.unidade || '', 'center', false);
      x += colWidths[3];

      drawCellWithAutoWrap(x, y, colWidths[4], rowHeight, valorUnitStr, 'right', false);
      x += colWidths[4];

      drawCellWithAutoWrap(x, y, colWidths[5], rowHeight, totalStr, 'right', false);

      y += rowHeight;
    });

    // ===== 5. RODAPÉ DE INFORMAÇÕES DO CLIENTE =====
    y += 10;
    
    if (y + 50 > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
    }

    doc.setFontSize(10);
    x = margin;

    // Informações do Cliente[cite: 4]
    doc.setFont('Arial', 'bold');
    doc.text('Cliente:', x, y);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.cliente || '', x + 15, y);
    y += 6;

    doc.setFont('Arial', 'bold');
    doc.text('CNPJ:', x, y);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.clienteCnpj || '', x + 12, y);
    y += 6;

    doc.setFont('Arial', 'bold');
    doc.text('Embarcaçao:', x, y);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.embarcacao || '', x + 25, y);
    y += 12;

    // Valor Total[cite: 4]
    doc.setFont('Arial', 'bold');
    doc.setFontSize(11);
    doc.text(`Valor total desta medição: R$ ${formatCurrency(totalGeral)}`, x, y);
    y += 25;

    // ===== 6. ASSINATURAS =====
    const sigWidth = 75;
    const spacing = 35;
    
    doc.setFont('Arial', 'normal');
    doc.setFontSize(10);
    
    // Título acima das linhas[cite: 4]
    doc.text('Aprovado por:', x, y);
    y += 15;
    
    // Linhas de Assinatura
    doc.setLineWidth(0.3);
    doc.line(x, y, x + sigWidth, y); // Linha Cliente
    doc.line(x + sigWidth + spacing, y, x + sigWidth + spacing + sigWidth, y); // Linha Linave/Servinave
    
    y += 5;
    
    // Títulos abaixo das linhas[cite: 4]
    doc.text('Representante do Cliente', x + sigWidth / 2, y, { align: 'center' });
    
    const repTexto = isLinave ? 'Representante Linave Enga. Serviços' : 'Representante Servinave';
    doc.text(repTexto, x + sigWidth + spacing + sigWidth / 2, y, { align: 'center' });

    // ===== 7. SALVAR ARQUIVO =====
    const prefixo = isLinave ? 'LN' : 'SN';
    // Sanitizar numeroBM para nome de arquivo (remover caracteres inválidos como /)
    const numeroBMSanitizado = (documentoMediacaoForm.numeroBM || '001').replace(/[/\\]/g, '-');
    const nomeArquivo = `${prefixo}_Medicao_${numeroBMSanitizado}_${Date.now()}.pdf`;
    
    const conteudoDataUrl = doc.output('datauristring');
    doc.save(nomeArquivo);

    return {
      nomeArquivo,
      conteudoDataUrl,
      tamanho: conteudoDataUrl.length,
    };
  } catch (error) {
    console.error('Erro ao gerar PDF de medição:', error);
    throw error;
  }
};