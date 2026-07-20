import jsPDF from 'jspdf';
import { extrairIdProjetoDoNumero } from '../../../context/ErpContext';

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
    const numeroNegocio = obra?.id ? extrairIdProjetoDoNumero(String(obra.id)) || String(obra.id) : '';
    
    const nomeHeader = isLinave ? 'BM- LINAVE Serviços Navais & Offshore' : 'BM- SERVINAVE';
    const razaoSocialPrestadora = isLinave ? 'W.L.M LINAVE Serviços Navais e Offshore' : 'SERVINAVE';
    // CNPJ da PRESTADORA (Linave/Servinave). Linave é fixo; para as demais usamos o CNPJ
    // cadastrado da empresa prestadora (empresaCnpj/cnpjPrestadora). NUNCA o CNPJ do cliente.
    const cnpjPrestadora = isLinave
      ? '34.282.247/0001-60'
      : (documentoMediacaoForm.empresaCnpj || documentoMediacaoForm.cnpjPrestadora || '');
    // CNPJ do CLIENTE (coluna da direita). `cnpj` legado também carregava o do cliente.
    const cnpjCliente = documentoMediacaoForm.clienteCnpj || documentoMediacaoForm.cnpj || '';
    
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
    drawRowFields('CNPJ:', cnpjPrestadora, 'CNPJ:', cnpjCliente, true, false);
    drawRowFields('Data emissao:', formatarDataParaBr(documentoMediacaoForm.dataEmissao) || '', 'Embarcaçao:', documentoMediacaoForm.embarcacao || '', true, false);
    drawRowFields('Negócio / Nr. BM:', `${numeroNegocio}${documentoMediacaoForm.numeroBM ? ` • BM ${documentoMediacaoForm.numeroBM}` : ''}`, 'Periodo:', documentoMediacaoForm.periodo || '', true, false);

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

    // Itens separados: SERVIÇO (mão de obra, materiais, terceirizados) e LOCAÇÃO, cada grupo
    // com seu subtotal; o total geral vem no rodapé. Espelha a tela de medição e a proposta.
    const todosItens = Array.isArray(documentoMediacaoForm.tabelaItens) ? documentoMediacaoForm.tabelaItens : [];
    const itensServico = todosItens.filter((l: any) => (l?.categoria || 'servico') !== 'locacao');
    const itensLocacao = todosItens.filter((l: any) => (l?.categoria || 'servico') === 'locacao');

    const somaFirst = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4]; // 155
    const lastW = colWidths[5]; // 35

    // Desenha uma linha de item. Devolve o total (R$) da linha.
    const drawItemRow = (linha: any, numero: number): number => {
      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(linha.descricao || '', colWidths[1] - 4);
      const itemRowHeight = Math.max(8, lines.length * 4 + 4);
      if (y + itemRowHeight > pageHeight - 60) { doc.addPage(); y = margin; }
      const bx = margin;
      const total = parseBrFloat(linha.total);
      drawCellWithAutoWrap(bx, y, colWidths[0], itemRowHeight, String(linha.item || numero), 'center');
      drawCellWithAutoWrap(bx + colWidths[0], y, colWidths[1], itemRowHeight, linha.descricao || '');
      drawCellWithAutoWrap(bx + colWidths[0] + colWidths[1], y, colWidths[2], itemRowHeight, formatNumber(linha.quantidadeProduzida), 'center');
      drawCellWithAutoWrap(bx + 110, y, colWidths[3], itemRowHeight, linha.unidade || '', 'center');
      drawCellWithAutoWrap(bx + 125, y, colWidths[4], itemRowHeight, formatCurrency(linha.valorUnitario), 'right');
      drawCellWithAutoWrap(bx + 155, y, colWidths[5], itemRowHeight, formatCurrency(total), 'right');
      y += itemRowHeight;
      return total;
    };

    // Faixa de título do grupo (SERVIÇOS / LOCAÇÃO).
    const drawGroupHeader = (label: string) => {
      const h = 7;
      if (y + h > pageHeight - 60) { doc.addPage(); y = margin; }
      doc.setFillColor(225, 225, 225);
      doc.rect(margin, y, somaFirst + lastW, h, 'FD');
      doc.setFont('Arial', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(label, margin + 2, y + 4.8);
      y += h;
    };

    // Linha de subtotal (rótulo à direita + valor na coluna de total).
    const drawSubtotalRow = (rotulo: string, valor: number) => {
      const h = 8;
      if (y + h > pageHeight - 60) { doc.addPage(); y = margin; }
      drawCellWithAutoWrap(margin, y, somaFirst, h, rotulo, 'right', true);
      drawCellWithAutoWrap(margin + somaFirst, y, lastW, h, `R$ ${formatCurrency(valor)}`, 'right', true);
      y += h;
    };

    let numero = 0;
    let subtotalServico = 0;
    let subtotalLocacao = 0;

    if (itensServico.length > 0) {
      drawGroupHeader('SERVIÇOS — mão de obra, materiais e terceirizados');
      itensServico.forEach((linha: any) => { subtotalServico += drawItemRow(linha, ++numero); });
      drawSubtotalRow('Total Serviços', subtotalServico);
    }

    if (itensLocacao.length > 0) {
      drawGroupHeader('LOCAÇÃO — equipamentos e itens locados');
      itensLocacao.forEach((linha: any) => { subtotalLocacao += drawItemRow(linha, ++numero); });
      drawSubtotalRow('Total Locação', subtotalLocacao);
    }

    const totalGeral = subtotalServico + subtotalLocacao;

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
    const nomeRepPrestadora = documentoMediacaoForm.representanteLinave || documentoMediacaoForm.representantePrestadora || '';

    // Assinatura do CLIENTE vem em branco de propósito (é assinada fisicamente).
    doc.text(nomeRepPrestadora, x + sigWidth + spacing + sigWidth / 2, lineY - 2, { align: 'center' });

    // --- DESENHO DAS LINHAS ---
    doc.setLineWidth(0.3);
    doc.line(x, lineY, x + sigWidth, lineY); 
    doc.line(x + sigWidth + spacing, lineY, x + sigWidth + spacing + sigWidth, lineY); 
    
    // --- TÍTULOS FIXOS (ABAIXO DA LINHA) ---
    doc.setFont('Arial', 'bold');
    doc.setFontSize(8);
    doc.text('Representante do Cliente', x + sigWidth / 2, lineY + 4, { align: 'center' });
    
    // Título fixo da prestadora reflete a empresa prestadora do serviço (não é fixo na Linave).
    const tituloFixoPrestadora = isLinave ? 'Representante Linave Enga. Serviços' : `Representante ${empresaNome}`;
    doc.text(tituloFixoPrestadora, x + sigWidth + spacing + sigWidth / 2, lineY + 4, { align: 'center' });

    // ===== 5. SALVAR =====
    const prefixo = isLinave ? 'LN' : 'VTS';
    const numeroBMSanitizado = (documentoMediacaoForm.numeroBM || '001').replace(/[/\\]/g, '-');
    const negocioSanitizado = (numeroNegocio || 'negocio').replace(/[/\\]/g, '-');
    const nomeArquivo = `${prefixo}_Medicao_${negocioSanitizado}_${numeroBMSanitizado}_${Date.now()}.pdf`;

    const blob = doc.output('blob');
    const conteudoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao converter PDF para DataURL.'));
      reader.readAsDataURL(blob);
    });

    doc.save(nomeArquivo);

    return {
      nomeArquivo,
      conteudoDataUrl,
      tamanho: blob.size,
    };
  } catch (error) {
    console.error('Erro ao gerar o PDF:', error);
    throw error;
  }
};