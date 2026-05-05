// Função corrigida handleDownloadOSPDF para CrmViewNew.tsx
export function generateHandleDownloadOSPDFCode() {
  return `const handleDownloadOSPDF = () => {
    const osDoNegocio = (os || []).filter(o => o.obraId === selectedObraDetalhes.id);
    if (osDoNegocio.length === 0) return;

    const osPrincipal = osDoNegocio[0];
    const orcamentosBase = Array.isArray(osPrincipal?.orcamentos) && osPrincipal.orcamentos.length > 0
      ? osPrincipal.orcamentos
      : Array.isArray(selectedObraDetalhes.orcamentos) && selectedObraDetalhes.orcamentos.length > 0
        ? selectedObraDetalhes.orcamentos
        : [];
    const propostasBase = Array.isArray(osPrincipal?.propostas) && osPrincipal.propostas.length > 0
      ? osPrincipal.propostas
      : Array.isArray(selectedObraDetalhes.propostas) && selectedObraDetalhes.propostas.length > 0
        ? selectedObraDetalhes.propostas
        : [];

    const ultimoOrcamento = orcamentosBase.length > 0 ? orcamentosBase[orcamentosBase.length - 1] : null;
    const ultimaProposta = propostasBase.length > 0 ? propostasBase[propostasBase.length - 1] : null;
    const cliente = (clientes || []).find(c => c.id === selectedObraDetalhes.clienteId);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const cellHeight = 5;
      let y = 10;
      const margin = 8;
      const baseColWidth = (pageWidth - margin * 2) / 10;

      const drawCellWithAutoWrap = (x: number, y: number, width: number, height: number, text: string, bold = false, red = false) => {
        doc.setFont('Arial', bold ? 'bold' : 'normal');
        if (red) {
          doc.setTextColor(255, 0, 0);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        const lines = doc.splitTextToSize(text || '', width - 2);
        let fontSize = 8;
        if (lines.length > 2) {
          fontSize = 6;
        }
        doc.setFontSize(fontSize);
        const lineSpacing = fontSize === 6 ? 2.5 : 3;
        const displayLines = lines.slice(0, 3);
        const totalHeight = displayLines.length * lineSpacing;
        const startY = y + (height - totalHeight) / 2;
        displayLines.forEach((line, idx) => {
          doc.text(line, x + 0.5, startY + idx * lineSpacing, { maxWidth: width - 1 });
        });
        doc.rect(x, y, width, height);
        doc.setFontSize(7);
      };

      // ===== CABEÇALHO COM LINHAS =====
      doc.setFont('Arial', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('LINAVE', margin, y + 5);
      y += 12;

      doc.setDrawColor(0, 0, 0);
      doc.line(margin, y, pageWidth - margin, y);
      y += 2;

      doc.setFontSize(14);
      doc.text('ORDEM DE SERVIÇO', margin, y + 5);
      y += 10;

      // ===== INFORMAÇÕES DO CABEÇALHO EM 2 COLUNAS =====
      doc.setFontSize(8);
      doc.setFont('Arial', 'normal');

      const headerInfoStartY = y;
      const colWidth = (pageWidth - margin * 2) / 2;

      // Coluna 1
      doc.setFont('Arial', 'bold');
      doc.text('Cliente:', margin, y);
      doc.setFont('Arial', 'normal');
      doc.text(cliente?.razaoSocial || '−', margin + 20, y);
      y += 4;

      doc.setFont('Arial', 'bold');
      doc.text('Projeto:', margin, y);
      doc.setFont('Arial', 'normal');
      doc.text(selectedObraDetalhes.nome || '−', margin + 20, y);
      y += 4;

      doc.setFont('Arial', 'bold');
      doc.text('Responsável:', margin, y);
      doc.setFont('Arial', 'normal');
      doc.text(osPrincipal?.solicitante || selectedObraDetalhes.solicitante || '−', margin + 20, y);
      y += 4;

      doc.setFont('Arial', 'bold');
      doc.text('Início Previsto:', margin, y);
      doc.setFont('Arial', 'normal');
      doc.text(selectedObraDetalhes.dataPrevistaInicio ? new Date(selectedObraDetalhes.dataPrevistaInicio).toLocaleDateString('pt-BR') : '−', margin + 20, y);
      y += 4;

      // Coluna 2
      const col2X = margin + colWidth;
      y = headerInfoStartY;

      doc.setFont('Arial', 'bold');
      doc.text('Data:', col2X, y);
      doc.setFont('Arial', 'normal');
      doc.text(new Date().toLocaleDateString('pt-BR'), col2X + 20, y);
      y += 4;

      doc.setFont('Arial', 'bold');
      doc.text('OS:', col2X, y);
      doc.setFont('Arial', 'normal');
      doc.text(osPrincipal?.ordemServicoNumero || '−', col2X + 20, y);
      y += 4;

      doc.setFont('Arial', 'bold');
      doc.text('Emissão:', col2X, y);
      doc.setFont('Arial', 'normal');
      doc.text(osPrincipal?.dataEmissao || new Date().toLocaleDateString('pt-BR'), col2X + 20, y);
      y += 4;

      doc.setFont('Arial', 'bold');
      doc.text('Término Previsto:', col2X, y);
      doc.setFont('Arial', 'normal');
      doc.text(selectedObraDetalhes.dataPrevistaFinal ? new Date(selectedObraDetalhes.dataPrevistaFinal).toLocaleDateString('pt-BR') : '−', col2X + 20, y);

      y = headerInfoStartY + 20;

      doc.setDrawColor(0, 0, 0);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // ===== ESCOPO DE SERVIÇOS =====
      if (ultimaProposta?.escopoA || ultimaProposta?.escopoBasicoServicos) {
        doc.setFont('Arial', 'bold');
        doc.setFontSize(9);
        doc.text('ESCOPO DE SERVIÇOS', margin, y);
        y += 4;

        doc.setFont('Arial', 'normal');
        doc.setFontSize(8);
        const escopoTexto = formatarEscopoBasicoParaTexto(ultimaProposta.escopoBasicoServicos || ultimaProposta.escopoA);
        const escopoLines = doc.splitTextToSize(escopoTexto, pageWidth - margin * 2);
        const maxEscopoLines = Math.min(escopoLines.length, 8);
        for (let i = 0; i < maxEscopoLines; i++) {
          doc.text(escopoLines[i], margin, y);
          y += 3;
        }

        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
      }

      // ===== A SER INCLUÍDO =====
      doc.setFont('Arial', 'bold');
      doc.setFontSize(9);
      doc.text('A SER INCLUÍDO', margin, y);
      y += 4;

      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      doc.text('☐ Item 1 - A ser incluído conforme necessário', margin + 2, y);
      y += 3;
      doc.text('☐ Item 2 - A ser incluído conforme necessário', margin + 2, y);
      y += 5;

      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // ===== SEÇÃO A - MÃO DE OBRA =====
      if (ultimoOrcamento?.data?.maoDeObra && ultimoOrcamento.data.maoDeObra.length > 0) {
        const maoDeObraData = (ultimoOrcamento.data.maoDeObra || []).filter((item: any) => item.funcao);
        const totalMaoDeObra = maoDeObraData.reduce((sum: number, item: any) => sum + parseFloat(item.valorTotal || 0), 0);

        doc.setFont('Arial', 'bold');
        doc.setFontSize(9);
        doc.text('A - MÃO DE OBRA', margin, y);
        y += 4;

        let x = margin;
        const headersMaoDeObra = ['Item', 'Função', 'Qtd', 'Dias', 'Custo/Dia', 'Obs', '', '', '', 'Valor Total'];
        headersMaoDeObra.forEach((h) => {
          doc.setFont('Arial', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(h, x + 0.5, y + 2.5, { maxWidth: baseColWidth - 1 });
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;
        });
        y += cellHeight;

        maoDeObraData.forEach((item: any, idx: number) => {
          x = margin;
          doc.setFont('Arial', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);

          doc.text(String(idx + 1), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          drawCellWithAutoWrap(x, y, baseColWidth, cellHeight, item.funcao || '');
          x += baseColWidth;

          doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.dias || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.custoUnitDia ? parseFloat(item.custoUnitDia).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          drawCellWithAutoWrap(x, y, baseColWidth, cellHeight, item.observacoes || '');
          x += baseColWidth;

          for (let i = 0; i < 3; i++) {
            doc.rect(x, y, baseColWidth, cellHeight);
            x += baseColWidth;
          }

          doc.setFont('Arial', 'bold');
          doc.setTextColor(255, 0, 0);
          doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('Arial', 'normal');
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          y += cellHeight;
        });

        x = margin;
        doc.setFont('Arial', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 0, 0);
        doc.text('Sub-total', x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, baseColWidth * 9, cellHeight);
        x += baseColWidth * 9;
        doc.setTextColor(255, 0, 0);
        doc.text(totalMaoDeObra.toFixed(2), x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, baseColWidth, cellHeight);
        y += cellHeight + 3;
      }

      // ===== SEÇÃO B - CONSUMÍVEIS E MATERIAIS =====
      if (ultimoOrcamento?.data?.materiais && ultimoOrcamento.data.materiais.length > 0) {
        const materiaisData = (ultimoOrcamento.data.materiais || []).filter((item: any) => item.descricao);
        const totalMateriais = materiaisData.reduce((sum: number, item: any) => sum + parseFloat(item.valorTotal || 0), 0);

        doc.setFont('Arial', 'bold');
        doc.setFontSize(9);
        doc.text('B - CONSUMÍVEIS E MATERIAIS', margin, y);
        y += 4;

        let x = margin;
        const headersMateriais = ['Item', 'Descrição', 'Un', 'Qtd', 'Peso/Fat', 'Custo Un', '3º', 'Obs', '', 'Total'];
        headersMateriais.forEach((h) => {
          doc.setFont('Arial', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(h, x + 0.5, y + 2.5, { maxWidth: baseColWidth - 1 });
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;
        });
        y += cellHeight;

        materiaisData.forEach((item: any, idx: number) => {
          x = margin;
          doc.setFont('Arial', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);

          doc.text(String(idx + 1), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          drawCellWithAutoWrap(x, y, baseColWidth, cellHeight, item.descricao || '');
          x += baseColWidth;

          doc.text(item.unidade || '', x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.pesoFator || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.custoUnit ? parseFloat(item.custoUnit).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(item.terceiros ? 'S' : 'N', x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          drawCellWithAutoWrap(x, y, baseColWidth, cellHeight, item.observacoes || '');
          x += baseColWidth;

          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.setFont('Arial', 'bold');
          doc.setTextColor(255, 0, 0);
          doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('Arial', 'normal');
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          y += cellHeight;
        });

        x = margin;
        doc.setFont('Arial', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 0, 0);
        doc.text('Valor total', x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, baseColWidth * 9, cellHeight);
        x += baseColWidth * 9;
        doc.setTextColor(255, 0, 0);
        doc.text(totalMateriais.toFixed(2), x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, baseColWidth, cellHeight);
        y += cellHeight + 3;
      }

      // ===== SEÇÃO C - SERVIÇOS TERCEIRIZADOS =====
      if (ultimoOrcamento?.data?.terceiros && ultimoOrcamento.data.terceiros.length > 0) {
        const terceirizadosData = (ultimoOrcamento.data.terceiros || []).filter((item: any) => item.descricao);
        const totalTerceiros = terceirizadosData.reduce((sum: number, item: any) => sum + parseFloat(item.valorTotal || 0), 0);

        doc.setFont('Arial', 'bold');
        doc.setFontSize(9);
        doc.text('C - SERVIÇOS TERCEIRIZADOS', margin, y);
        y += 4;

        let x = margin;
        const headersTerceiros = ['Item', 'Descrição', 'Un', 'Qtd', 'Peso/Fat', 'Custo Un', 'Obs', '', '', 'Total'];
        headersTerceiros.forEach((h) => {
          doc.setFont('Arial', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(h, x + 0.5, y + 2.5, { maxWidth: baseColWidth - 1 });
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;
        });
        y += cellHeight;

        terceirizadosData.forEach((item: any, idx: number) => {
          x = margin;
          doc.setFont('Arial', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);

          doc.text(String(idx + 1), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          drawCellWithAutoWrap(x, y, baseColWidth, cellHeight, item.descricao || '');
          x += baseColWidth;

          doc.text(item.unidade || '', x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.quantidade || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.pesoFator || ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          doc.text(String(item.custoUnit ? parseFloat(item.custoUnit).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          drawCellWithAutoWrap(x, y, baseColWidth, cellHeight, item.observacoes || '');
          x += baseColWidth;

          for (let i = 0; i < 2; i++) {
            doc.rect(x, y, baseColWidth, cellHeight);
            x += baseColWidth;
          }

          doc.setFont('Arial', 'bold');
          doc.setTextColor(255, 0, 0);
          doc.text(String(item.valorTotal ? parseFloat(item.valorTotal).toFixed(2) : ''), x + 0.5, y + 2.5);
          doc.setTextColor(0, 0, 0);
          doc.setFont('Arial', 'normal');
          doc.rect(x, y, baseColWidth, cellHeight);
          x += baseColWidth;

          y += cellHeight;
        });

        x = margin;
        doc.setFont('Arial', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 0, 0);
        doc.text('Sub-total', x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, baseColWidth * 9, cellHeight);
        x += baseColWidth * 9;
        doc.setTextColor(255, 0, 0);
        doc.text(totalTerceiros.toFixed(2), x + 0.5, y + 2.5);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, y, baseColWidth, cellHeight);
        y += cellHeight + 3;
      }

      // ===== FOOTER =====
      doc.setFontSize(7);
      doc.setFont('Arial', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(\`Documento gerado automaticamente pelo Linave ERP em \${new Date().toLocaleString('pt-BR')}\`, margin, doc.internal.pageSize.getHeight() - 5);

      doc.save(\`OS_\${selectedObraDetalhes.id}_\${new Date().getTime()}.pdf\`);
      toast.success('OS baixada com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar OS em PDF');
    }
  };`;
}
