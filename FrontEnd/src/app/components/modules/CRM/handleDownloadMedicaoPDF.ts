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

    // Funções utilitárias de formatação
    const formatCurrency = (value: any) => {
      const num = parseFloat(value) || 0;
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatNumber = (value: any) => {
      const num = parseFloat(value) || 0;
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatarDataParaBr = (dataISO: string) => {
      if (!dataISO) return '';
      if (dataISO.includes('/')) return dataISO;
      const data = new Date(dataISO + 'T00:00:00');
      return data.toLocaleDateString('pt-BR');
    };

    // Função para desenhar células com suporte a múltiplas linhas
    const drawCellWithAutoWrap = (
      x: number,
      y: number,
      width: number,
      height: number,
      text: string,
      align: 'left' | 'center' | 'right' = 'left',
      bold = false,
      border = true,
      valign: 'top' | 'middle' = 'middle'
    ) => {
      doc.setFont('Arial', bold ? 'bold' : 'normal');
      doc.setTextColor(0, 0, 0);

      if (border) {
        doc.rect(x, y, width, height);
      }

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
        if (align === 'center') {
          textX = x + width / 2;
        } else if (align === 'right') {
          textX = x + width - padding;
        }
        doc.text(line, textX, textY, { align: align });
        textY += lineHeightText + 1;
      });
    };

    // ===== 1. TÍTULO PRINCIPAL =====
    const nomeEmpresa = documentoMediacaoForm.empresa?.toUpperCase() || 'EMPRESA';
    const numBM = documentoMediacaoForm.numeroBM || '001';
    const titulo = `${nomeEmpresa} - BOLETIM DE MEDIÇÃO - ${numBM}`;
    
    doc.setFont('Arial', 'bold');
    doc.setFontSize(11);
    
    // Caixa do título (bordas mais grossas)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, usableWidth, 12);
    doc.text(titulo, pageWidth / 2, y + 7.5, { align: 'center' });
    y += 16;

    // ===== 2. INFORMAÇÕES DE CABEÇALHO =====
    const hInfoHeight = 16;
    doc.setLineWidth(0.2); // Borda padrão fina
    doc.rect(margin, y, usableWidth, hInfoHeight);
    
    // Linha horizontal no meio
    doc.line(margin, y + 8, margin + usableWidth, y + 8);
    
    doc.setFontSize(9);
    
    // Linha 1 do bloco
    let cy = y + 5.5;
    doc.setFont('Arial', 'bold');
    doc.text('Empresa:', margin + 2, cy);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.empresa || '', margin + 18, cy);

    doc.setFont('Arial', 'bold');
    doc.text('Embarcação:', margin + 85, cy);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.embarcacao || '', margin + 107, cy);

    doc.setFont('Arial', 'bold');
    doc.text('Data Emissão:', margin + 145, cy);
    doc.setFont('Arial', 'normal');
    doc.text(formatarDataParaBr(documentoMediacaoForm.dataEmissao) || '', margin + 168, cy);

    // Linha 2 do bloco
    cy = y + 13.5;
    doc.setFont('Arial', 'bold');
    doc.text('Cliente:', margin + 2, cy);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.cliente || '', margin + 15, cy);

    doc.setFont('Arial', 'bold');
    doc.text('CNPJ:', margin + 85, cy);
    doc.setFont('Arial', 'normal');
    doc.text(documentoMediacaoForm.cnpj || '', margin + 96, cy);

    doc.setFont('Arial', 'bold');
    doc.text('Mês/Ano:', margin + 145, cy);
    doc.setFont('Arial', 'normal');
    const mesAno = documentoMediacaoForm.periodo || formatarDataParaBr(documentoMediacaoForm.dataEmissao);
    doc.text(mesAno, margin + 162, cy);

    y += hInfoHeight + 6;

    // ===== 3. TABELA DE MEDIÇÃO - CABEÇALHOS =====
    // Larguras das colunas baseadas nas proporções do HTML gerado
    const colWidths = [12, 75, 22, 15, 30, 36];
    const headerHeight = 10;
    let x = margin;
    
    doc.setFont('Arial', 'bold');
    doc.setFontSize(9);
    
    // Ítem
    doc.rect(x, y, colWidths[0], headerHeight);
    doc.text('Ítem', x + colWidths[0]/2, y + 6, { align: 'center' });
    x += colWidths[0];
    
    // Descrição dos Serviços
    doc.rect(x, y, colWidths[1], headerHeight);
    doc.text('Descrição dos Serviços', x + colWidths[1]/2, y + 6, { align: 'center' });
    x += colWidths[1];
    
    // Valor
    doc.rect(x, y, colWidths[2], headerHeight);
    doc.text('Valor', x + colWidths[2]/2, y + 6, { align: 'center' });
    x += colWidths[2];

    // Unid
    doc.rect(x, y, colWidths[3], headerHeight);
    doc.text('Unid', x + colWidths[3]/2, y + 6, { align: 'center' });
    x += colWidths[3];

    // Quantidade (Dividido verticalmente)
    doc.rect(x, y, colWidths[4], headerHeight / 2);
    doc.text('Quantidade', x + colWidths[4]/2, y + 3.5, { align: 'center' });
    doc.rect(x, y + headerHeight / 2, colWidths[4], headerHeight / 2);
    doc.text('No mês', x + colWidths[4]/2, y + 8.5, { align: 'center' });
    x += colWidths[4];

    // Valor em R$ (Dividido verticalmente)
    doc.rect(x, y, colWidths[5], headerHeight / 2);
    doc.text('Valor em R$', x + colWidths[5]/2, y + 3.5, { align: 'center' });
    doc.rect(x, y + headerHeight / 2, colWidths[5], headerHeight / 2);
    doc.text('No mês', x + colWidths[5]/2, y + 8.5, { align: 'center' });

    y += headerHeight;

    // ===== 4. TABELA DE MEDIÇÃO - DADOS =====
    let totalGeral = 0;
    
    documentoMediacaoForm.tabelaItens.forEach((linha: any, index: number) => {
      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      
      // Auto-height da linha
      const textWidth = colWidths[1] - 4;
      const lines = doc.splitTextToSize(linha.descricao || '', textWidth);
      const rowHeight = Math.max(8, lines.length * 4 + 4);

      // Nova página se for cortar os dados
      if (y + rowHeight > pageHeight - 40) {
        doc.addPage();
        y = margin;
      }

      x = margin;
      
      // 1. Ítem
      drawCellWithAutoWrap(x, y, colWidths[0], rowHeight, String(index + 1), 'center', true);
      x += colWidths[0];
      
      // 2. Descrição
      drawCellWithAutoWrap(x, y, colWidths[1], rowHeight, linha.descricao || '', 'left', false);
      x += colWidths[1];
      
      // 3. Valor Unitário
      const valorStr = linha.valorUnitario ? formatCurrency(linha.valorUnitario) : '';
      drawCellWithAutoWrap(x, y, colWidths[2], rowHeight, valorStr, 'right', false);
      x += colWidths[2];

      // 4. Unid
      drawCellWithAutoWrap(x, y, colWidths[3], rowHeight, linha.unidade || '', 'center', false);
      x += colWidths[3];

      // 5. Quantidade
      const qtdStr = linha.quantidadeProduzida ? formatNumber(linha.quantidadeProduzida) : '';
      drawCellWithAutoWrap(x, y, colWidths[4], rowHeight, qtdStr, 'right', false);
      x += colWidths[4];

      // 6. Total
      const total = parseFloat(linha.total) || 0;
      totalGeral += total;
      const totalStr = formatCurrency(total);
      drawCellWithAutoWrap(x, y, colWidths[5], rowHeight, totalStr, 'right', false);

      y += rowHeight;
    });

    // ===== 5. LINHA DE TOTAL =====
    if (y + 10 > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    x = margin;
    doc.setFont('Arial', 'bold');
    doc.setFontSize(10);
    
    // Bloco mesclado "TOTAL"
    const wToUnid = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
    doc.rect(x, y, wToUnid, 8);
    doc.text('TOTAL', x + wToUnid / 2, y + 5.5, { align: 'center' });
    x += wToUnid;

    // Célula vazia Quantidade
    doc.rect(x, y, colWidths[4], 8);
    x += colWidths[4];

    // Célula final do somatório
    doc.setFillColor(242, 242, 242); // Fundo cinza claro igual do CSS (.s56)
    doc.rect(x, y, colWidths[5], 8, 'FD'); // Fill + Border
    doc.text(formatCurrency(totalGeral), x + colWidths[5] - 2, y + 5.5, { align: 'right' });

    y += 20;

    // ===== 6. ASSINATURAS =====
    if (y + 30 > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
    }

    y += 20; // Espaço antes de começar as assinaturas
    
    const sig1Width = 80;
    const gap = 20;
    const sig2Width = 80;

    // 1. Nomes em cima da linha
    doc.setFont('Arial', 'bold');
    doc.setFontSize(11);
    
    // Nome Cliente
    const txtCliente = documentoMediacaoForm.representanteCliente || '';
    doc.text(txtCliente, margin + 5 + sig1Width/2, y, { align: 'center' });
    
    // Nome Linave
    const txtLinave = documentoMediacaoForm.representanteLinave || '';
    doc.text(txtLinave, margin + sig1Width + gap + sig2Width/2, y, { align: 'center' });

    y += 2; // Espaçamento pequeno entre o nome e a linha

    // 2. Linhas de Assinatura
    doc.setLineWidth(0.3);
    doc.line(margin + 5, y, margin + sig1Width, y);
    doc.line(margin + sig1Width + gap, y, margin + sig1Width + gap + sig2Width, y);

    y += 5; // Espaçamento entre a linha e o subtítulo

    // 3. Subtítulos abaixo da linha
    doc.setFont('Arial', 'normal');
    doc.setFontSize(9);
    doc.text('Representante do Armador / Cliente', margin + 5 + sig1Width/2, y, { align: 'center' });
    doc.text(`Representante da ${documentoMediacaoForm.empresa || 'Linave'}`, margin + sig1Width + gap + sig2Width/2, y, { align: 'center' });
    
    // Rodapé Automático
    doc.setFontSize(7);
    doc.setFont('Arial', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Documento gerado automaticamente pelo ERP em ${new Date().toLocaleString('pt-BR')}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );

    // Finalizar o Arquivo
    const nomeArquivo = `Medicao_${documentoMediacaoForm.numeroBM || 'BM'}_${Date.now()}.pdf`;
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