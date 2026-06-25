// Função corrigida handleDownloadOSPDF para CrmViewNew.tsx
export function generateHandleDownloadOSPDFCode() {
  return `const handleDownloadOSPDF = () => {
    const osDoNegocio = (os || []).filter(o => o.obraId === selectedObraDetalhes.id);
    if (osDoNegocio.length === 0) return;

<<<<<<< HEAD
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
=======
const getPrefixoEmpresa = (empresaPrestadora?: string) => {
  if (!empresaPrestadora) return 'LN';
  return empresaPrestadora.toLowerCase().includes('servinave') ? 'VTS' : 'LN';
};
>>>>>>> fccd5af (ultimas alterações)

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
<<<<<<< HEAD
=======

/**
 * Gera e baixa o PDF "bonito" da Ordem de Serviço de Produção.
 * Totalmente orientado a dados (lê os itens "A SER INCLUÍDO" do aSerIncluido salvo na OS/negócio).
 * Devolve o arquivo gerado para a tela que chamou decidir o que fazer.
 */
export const handleDownloadOSPDF = ({
  osPrincipal,
  ultimoOrcamento,
  ultimaProposta,
  cliente,
  obra,
  logoBase64,
}: OSPdfParams) => {
  if (!osPrincipal) return undefined;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageWidth - 2 * margin, 35);
  doc.line(margin + 50, y, margin + 50, y + 15);
  doc.line(margin + 130, y, margin + 130, y + 15);
  doc.line(margin, y + 15, pageWidth - margin, y + 15);

  if (logoBase64) {
    const logoFormat = logoBase64.match(/^data:image\/(png|jpe?g)/i)?.[1]?.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
    doc.addImage(logoBase64, logoFormat, margin + 2, y + 2, 46, 11);
  } else {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('LINAVE', margin + 5, y + 10);
  }

  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO\nDE PRODUÇÃO', margin + 90, y + 6.5, { align: 'center' });

  doc.setFontSize(7);
  doc.text('Data Emissão:', margin + 132, y + 5);
  doc.setFont('Helvetica', 'normal');
  doc.text(osPrincipal.dataEmissao || new Date().toLocaleDateString('pt-BR'), margin + 155, y + 5);

  doc.setFont('Helvetica', 'bold');
  doc.text('CC.:', margin + 132, y + 10);
  doc.setFont('Helvetica', 'normal');
  doc.text(osPrincipal.cc || 'Não inf.', margin + 142, y + 10);
  y += 15;

  const rowH = 5;
  doc.line(margin, y + rowH, pageWidth - margin, y + rowH);
  doc.line(margin, y + rowH * 2, pageWidth - margin, y + rowH * 2);
  doc.line(margin, y + rowH * 3, pageWidth - margin, y + rowH * 3);
  doc.line(margin + 100, y, margin + 100, y + 20);

  doc.setFontSize(8);
  const printDado = (lbl: string, val: string, vx: number, vy: number) => {
    doc.setFont('Helvetica', 'bold');
    doc.text(lbl, vx, vy);
    doc.setFont('Helvetica', 'normal');
    doc.text(val || ' ', vx + 25, vy);
  };

  const dataInicio = osPrincipal.dataInicioPrevisto || obra?.dataPrevistaInicio;
  const dataTermino = osPrincipal.dataTerminoPrevisto || obra?.dataPrevistaFinal;
  const idProjetoForPrint = obra?.id || '';
  const localOS = osPrincipal.local || osPrincipal.localExecucao || '';
  // A OS é identificada pela EMBARCAÇÃO (do negócio); sem embarcação, usa o Local.
  const embarcacaoOS = (Array.isArray(obra?.servicos) ? (obra.servicos.find((s: any) => s?.embarcacao)?.embarcacao) : '') || osPrincipal.embarcacao || '';
  const projetoTexto = `${obra?.nome || ''}${idProjetoForPrint ? ' • ' + idProjetoForPrint : ''}`;

  printDado('CLIENTE:', cliente?.razaoSocial || '', margin + 2, y + 3.5);
  printDado('Início Previsto:', dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : '', margin + 102, y + 3.5);
  y += rowH;

  printDado('EMBARCAÇÃO:', embarcacaoOS || localOS, margin + 2, y + 3.5);
  printDado('Térm. Previsto:', dataTermino ? new Date(dataTermino).toLocaleDateString('pt-BR') : '', margin + 102, y + 3.5);
  y += rowH;

  printDado('PROJETO:', projetoTexto, margin + 2, y + 3.5);
  printDado('OS Nº:', osPrincipal.ordemServicoNumero || '', margin + 102, y + 3.5);
  y += rowH;

  printDado('LOCAL:', localOS, margin + 2, y + 3.5);
  printDado('Encarregado:', osPrincipal.supervisorEncarregado || '', margin + 102, y + 3.5);
  y += rowH;
  y += 5;

  const leftW = 120;
  const rightW = (pageWidth - 2 * margin) - leftW;

  doc.setFont('Helvetica', 'bold');
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, leftW, 6, 'FD');
  doc.rect(margin + leftW, y, rightW, 6, 'FD');

  doc.text('DESCRIÇÃO DO SERVIÇO', margin + leftW / 2, y + 4, { align: 'center' });
  doc.text('A SER INCLUIDO', margin + leftW + rightW / 2, y + 4, { align: 'center' });
  y += 6;

  const bodyY = y;

  doc.setFont('Helvetica', 'normal');
  const descTexto = ultimaProposta
    ? formatarEscopoBasicoParaTexto(ultimaProposta.escopoBasicoServicos || ultimaProposta.escopoA)
    : (osPrincipal.descricao || osPrincipal.descricaoGeralServico || '');
  const descLines = doc.splitTextToSize(descTexto, leftW - 4);

  let cursorEsq = bodyY + 5;
  descLines.forEach((l: string) => {
    doc.text(l, margin + 2, cursorEsq);
    cursorEsq += 4;
  });

  // "A SER INCLUÍDO": lê diretamente do aSerIncluido salvo na OS (ou no negócio).
  let baseChecks: any = osPrincipal?.aSerIncluido || obra?.aSerIncluido || {};
  if (typeof baseChecks === 'string') {
    try { baseChecks = JSON.parse(baseChecks); } catch (e) { baseChecks = {}; }
  }
  const isChecked = (dbKey: string) => baseChecks?.[dbKey] === true || String(baseChecks?.[dbKey]) === 'true';
  const chk = (val: boolean) => (val ? '[ X ]' : '[   ]');

  const listChecks = [
    { lbl: 'CERTIFICADO DE GÁS FREE', v: isChecked('certificadoGas') },
    { lbl: 'VENTILAÇÃO', v: isChecked('ventilacao') },
    { lbl: 'LIMPEZA ANTES', v: isChecked('limpezaAntes') },
    { lbl: 'LIMPEZA APÓS CONCLUSÃO', v: isChecked('limpezaApos') },
    { lbl: 'ANDAIMES', v: isChecked('andaimes') },
    { lbl: 'APOIO DE GUINDASTE', v: isChecked('apoioGuindastes') },
    { lbl: 'TRANSPORTE EXTERNO', v: isChecked('transporteExterno') },
    { lbl: 'TESTE DE PRESSÃO', v: isChecked('testesPressao') },
    { lbl: 'PINTURA', v: isChecked('pintura') },
    { lbl: 'LP / PM', v: isChecked('lpPm') },
    { lbl: 'TESTE DE ULTRASSOM', v: isChecked('testeUltrassom') },
    { lbl: 'INSPEÇÃO DIMENSIONAL', v: isChecked('inspecaoDimensional') },
    { lbl: 'VISUAL DE SOLDA', v: isChecked('visualSolda') },
    { lbl: 'SOLDADOR CERTIFICADO', v: isChecked('soldadorCertificado') },
    { lbl: 'PROCEDIMENTO DE SOLDA', v: isChecked('procedimentoSolda') },
    { lbl: 'CERTIFICAÇÃO DO MATERIAL', v: isChecked('certificacaoMaterial') },
    { lbl: 'VIGIA DE FOGO', v: isChecked('vigiaFogo') }
  ];

  let cursorDir = bodyY + 5;
  doc.setFontSize(7);
  listChecks.forEach((c) => {
    doc.setFont('Helvetica', 'bold');
    doc.text(chk(c.v), margin + leftW + 2, cursorDir);
    doc.setFont('Helvetica', 'normal');
    doc.text(c.lbl, margin + leftW + 10, cursorDir);
    cursorDir += 4;
  });

  const maxH = Math.max(cursorEsq, cursorDir) - bodyY + 5;
  doc.rect(margin, bodyY, leftW, maxH);
  doc.rect(margin + leftW, bodyY, rightW, maxH);

  y = bodyY + maxH + 5;

  const maoDeObraOS = ultimoOrcamento?.data?.maoDeObra || [];
  if (maoDeObraOS.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['MÃO DE OBRA', 'QTDE', 'DIAS', 'ATIVIDADE', 'OBS.']],
      body: maoDeObraOS.map((mo: any) => [
        mo.cargo || mo.funcao || mo.maoDeObra || '',
        mo.quantidade || mo.qtde || '',
        mo.dias || '',
        mo.atividade || '',
        mo.obs || mo.observacao || '-'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2, textColor: [0, 0, 0] },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  const horasServicoOS = Array.isArray(osPrincipal?.horasTrabalhadasPorServico)
    ? osPrincipal.horasTrabalhadasPorServico
        .map((item: any, idx: number) => ({
          id: String(item?.id || `hora-servico-${idx}`),
          servico: String(item?.servico || '').trim(),
          hora: Number(item?.hora || 0)
        }))
        .filter((item: any) => item.servico || item.hora > 0)
    : [];
  if (horasServicoOS.length > 0) {
    const totalHorasServico = horasServicoOS.reduce((acc: number, item: any) => acc + (Number.isFinite(item.hora) ? item.hora : 0), 0);
    autoTable(doc, {
      startY: y,
      head: [['SERVIÇO', 'HORA (H/H)']],
      body: [
        ...horasServicoOS.map((item: any) => [item.servico, String(item.hora)]),
        ['HH TOTAL', String(totalHorasServico)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2, textColor: [0, 0, 0] },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  const materiaisOS = ultimoOrcamento?.data?.materiais || [];
  if (materiaisOS.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['QUANT', 'UN', 'ESPECIFICAÇÃO DE MATERIAL']],
      body: materiaisOS.map((m: any) => [
        m.quantidade || '',
        m.unidade || '',
        m.descricao || ''
      ]),
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2, textColor: [0, 0, 0] },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // Locação: itens alocados (resumão da OS). Fonte = negócio (obra) ou orçamento.
  const itensAlocacaoOS = (Array.isArray(obra?.itensAlocacao) && obra.itensAlocacao.length > 0)
    ? obra.itensAlocacao
    : (ultimoOrcamento?.data?.itensAlocacao || []);
  const locacaoOS = (itensAlocacaoOS || []).filter((it: any) => it.equipamento);
  if (locacaoOS.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['EQUIPAMENTO (LOCAÇÃO)', 'UN', 'QTDE', 'VL. INDENIZ.', 'VL. LOCAÇÃO']],
      body: locacaoOS.map((it: any) => [
        it.equipamento || '',
        it.unidade || '',
        String(it.quantidade ?? ''),
        (Number(it.valorIndenizacao) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        (Number(it.valorLocacao) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2, textColor: [0, 0, 0] },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  const terceirizadosOS = ultimoOrcamento?.data?.terceirizados || [];
  if (terceirizadosOS.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['ITEM', 'TERCEIRIZAÇÃO OU SUB-CONTRATAÇÃO']],
      body: terceirizadosOS.map((t: any, idx: number) => [
        idx + 1,
        t.descricao || ''
      ]),
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2, textColor: [0, 0, 0] },
      margin: { left: margin, right: margin }
    });
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(`Documento gerado pelo Linave ERP em ${new Date().toLocaleString('pt-BR')}`, margin, pageHeight - 5);
    doc.text(`Pag. ${i} / ${pageCount}`, pageWidth - margin - 15, pageHeight - 5);
  }

  const prefixo = getPrefixoEmpresa(obra?.empresaPrestadora);
  const nomeArquivo = `OS_${String(osPrincipal.ordemServicoNumero || '001').replace(/[\\/]/g, '-')}.pdf`;
  const conteudoDataUrl = doc.output('datauristring');
  doc.save(nomeArquivo);

  return {
    nomeArquivo,
    conteudoDataUrl,
    tamanho: Math.max(0, Math.round((conteudoDataUrl.length * 3) / 4)),
  };
};
>>>>>>> fccd5af (ultimas alterações)
