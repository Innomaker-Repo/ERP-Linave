import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateBR } from '../../../utils/formatDate';

const getPrefixoEmpresa = (empresaPrestadora?: string) => {
  if (!empresaPrestadora) return 'LN';
  return empresaPrestadora.toLowerCase().includes('servinave') ? 'VTS' : 'LN';
};

const formatarEscopoBasicoParaTexto = (escopo: any): string => {
  if (!escopo) return '−';
  if (typeof escopo === 'string') return escopo;

  const formatarItemEscopo = (item: any, index: number) => {
    if (!item) return '';
    if (typeof item === 'string') return item;

    const partes = [item.titulo, item.descricaoServico, item.texto].filter(
      (valor) => typeof valor === 'string' && valor.trim(),
    );

    if (Array.isArray(item.linhas) && item.linhas.length > 0) {
      const linhas = item.linhas
        .map((linha: any) => {
          if (!linha?.valores || typeof linha.valores !== 'object') return '';
          const valores = Object.values(linha.valores)
            .filter((valor) => (typeof valor === 'string' ? valor.trim() : Boolean(valor)))
            .map((valor) => String(valor).trim())
            .filter(Boolean);
          return valores.length > 0 ? `- ${valores.join(' | ')}` : '';
        })
        .filter(Boolean);
      if (linhas.length > 0) partes.push(linhas.join('\n'));
    }

    if (partes.length === 0) return `Item ${index + 1}`;
    return partes.join('\n');
  };

  if (Array.isArray(escopo)) {
    return escopo.map((item, index) => formatarItemEscopo(item, index)).filter(Boolean).join('\n\n');
  }
  if (typeof escopo === 'object') return formatarItemEscopo(escopo, 0);
  return String(escopo);
};

interface OSPdfParams {
  osPrincipal: any;
  ultimoOrcamento?: any;
  ultimaProposta?: any;
  cliente?: any;
  obra?: any;
  logoBase64?: string;
}

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

  // A altura total do cabeçalho (caixa externa) agora depende de quanto as linhas de
  // CLIENTE/EMBARCAÇÃO/PROJETO/LOCAL crescem ao quebrar texto longo — por isso a borda externa
  // só é fechada (doc.rect) depois do laço abaixo, com a altura real já calculada. Antes ela
  // era desenhada aqui com altura fixa (35mm), o que fazia a borda inferior cortar o texto do
  // LOCAL quando ele precisava de mais de uma linha.
  const headerBoxTopY = y;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
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
  doc.text(formatDateBR(osPrincipal.dataEmissao) || new Date().toLocaleDateString('pt-BR'), margin + 155, y + 5);

  doc.setFont('Helvetica', 'bold');
  doc.text('CC.:', margin + 132, y + 10);
  doc.setFont('Helvetica', 'normal');
  doc.text(osPrincipal.cc || 'Não inf.', margin + 142, y + 10);
  y += 15;

  // Cabeçalho de dados (CLIENTE/EMBARCAÇÃO/PROJETO/LOCAL à esquerda, datas/OS/Encarregado à
  // direita): altura de cada linha agora é CALCULADA a partir do texto (campos longos, como um
  // endereço extenso em LOCAL, quebram em várias linhas em vez de estourar por cima do texto da
  // coluna vizinha). As divisórias (linhas horizontais/vertical) só são desenhadas DEPOIS de
  // saber a altura real de cada linha — por isso o bloco inteiro virou um laço, não mais
  // posições fixas.
  const rowMinH = 5;
  const rowLineH = 3.3;
  const rowPadTop = 3.5;
  const rowPadBottom = 2.5;
  const colDividerX = margin + 100;
  const leftValueX = margin + 27;
  const rightValueX = margin + 127;
  const leftValueMaxW = colDividerX - leftValueX - 2;
  const rightValueMaxW = (pageWidth - margin) - rightValueX - 2;

  doc.setFontSize(8);
  // Desenha um par label/valor (quebrando o valor em várias linhas se precisar) e devolve a
  // altura que ele ocupou, para a linha da tabela usar a maior altura entre as duas colunas.
  const printDadoWrapped = (lbl: string, val: string, vx: number, vTopY: number, maxW: number): number => {
    doc.setFont('Helvetica', 'bold');
    doc.text(lbl, vx, vTopY + rowPadTop);
    doc.setFont('Helvetica', 'normal');
    const linhas = doc.splitTextToSize(val || ' ', maxW) as string[];
    linhas.forEach((linha, i) => doc.text(linha, vx + 25, vTopY + rowPadTop + i * rowLineH));
    return Math.max(linhas.length * rowLineH + rowPadTop + rowPadBottom - rowLineH, rowMinH);
  };

  const dataInicio = osPrincipal.dataInicioPrevisto || obra?.dataPrevistaInicio;
  const dataTermino = osPrincipal.dataTerminoPrevisto || obra?.dataPrevistaFinal;
  const idProjetoForPrint = obra?.id || '';
  const localOS = osPrincipal.local || osPrincipal.localExecucao || '';
  // A OS é identificada pela EMBARCAÇÃO (do negócio); sem embarcação, usa o Local.
  const embarcacaoOS = (Array.isArray(obra?.servicos) ? (obra.servicos.find((s: any) => s?.embarcacao)?.embarcacao) : '') || osPrincipal.embarcacao || '';
  const projetoTexto = `${obra?.nome || ''}${idProjetoForPrint ? ' • ' + idProjetoForPrint : ''}`;

  const linhasCabecalho: Array<[string, string, string, string]> = [
    ['CLIENTE:', cliente?.razaoSocial || '', 'Início Previsto:', dataInicio ? formatDateBR(dataInicio) : ''],
    ['EMBARCAÇÃO:', embarcacaoOS || localOS, 'Térm. Previsto:', dataTermino ? formatDateBR(dataTermino) : ''],
    ['PROJETO:', projetoTexto, 'OS Nº:', osPrincipal.ordemServicoNumero || ''],
    ['LOCAL:', localOS, 'Encarregado:', osPrincipal.supervisorEncarregado || ''],
  ];

  linhasCabecalho.forEach(([lblEsq, valEsq, lblDir, valDir], idx) => {
    const hEsq = printDadoWrapped(lblEsq, valEsq, margin + 2, y, leftValueMaxW);
    const hDir = printDadoWrapped(lblDir, valDir, margin + 102, y, rightValueMaxW);
    const rowH = Math.max(hEsq, hDir);
    doc.line(margin + 100, y, margin + 100, y + rowH);
    y += rowH;
    // Sem linha depois da última fileira (LOCAL/Encarregado) — mesmo visual de antes, que só
    // fechava embaixo com o respiro de 5mm antes do próximo bloco (DESCRIÇÃO DO SERVIÇO).
    if (idx < linhasCabecalho.length - 1) doc.line(margin, y, pageWidth - margin, y);
  });
  doc.rect(margin, headerBoxTopY, pageWidth - 2 * margin, y - headerBoxTopY);
  y += 5;

  // Cita a proposta de origem (número + versão), para deixar claro de qual documento o
  // escopo abaixo veio — e sinalizar rápido, ao olhar o impresso, quando esse vínculo não
  // foi resolvido (número em branco = proposta não encontrada para este negócio).
  if (ultimaProposta?.numeroProposta) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    const versaoTxt = ultimaProposta.versao ? ` versão ${ultimaProposta.versao}` : '';
    doc.text(`OS elaborada de acordo com a Proposta ${ultimaProposta.numeroProposta}${versaoTxt}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
  }

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

  // ESCOPO (coluna esquerda) em formato de TABELA com grade, igual à proposta.
  const escopoBlocos = Array.isArray(ultimaProposta?.escopoBasicoServicos) ? ultimaProposta.escopoBasicoServicos : [];
  const leftPad = margin + 2;
  const leftTableMarginRight = pageWidth - margin - leftW + 2; // constrange a tabela à coluna esquerda
  let cursorEsq = bodyY + 4;

  if (escopoBlocos.length > 0) {
    escopoBlocos.forEach((bloco: any, idx: number) => {
      // Título do bloco
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.splitTextToSize(`${idx + 1}. ${bloco?.titulo || 'Serviço'}`, leftW - 4)
        .forEach((l: string) => { doc.text(l, leftPad, cursorEsq); cursorEsq += 4; });
      // Descrição do serviço (texto antes da tabela)
      if (bloco?.descricaoServico && String(bloco.descricaoServico).trim()) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.splitTextToSize(String(bloco.descricaoServico).trim(), leftW - 4)
          .forEach((l: string) => { doc.text(l, leftPad, cursorEsq); cursorEsq += 3.5; });
      }
      // Tabela (colunas = cabeçalho, linhas.valores = corpo)
      const colunas = Array.isArray(bloco?.colunas) && bloco.colunas.length ? bloco.colunas : ['Descrição'];
      const body = (Array.isArray(bloco?.linhas) ? bloco.linhas : [])
        .map((linha: any) => colunas.map((col: string) => String(linha?.valores?.[col] ?? '').trim()))
        .filter((row: string[]) => row.some((c) => c));
      if (body.length > 0) {
        autoTable(doc, {
          startY: cursorEsq + 1,
          head: [colunas],
          body,
          theme: 'grid',
          margin: { left: leftPad - 1, right: leftTableMarginRight },
          headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5 },
          styles: { fontSize: 6.5, cellPadding: 1, textColor: [0, 0, 0], overflow: 'linebreak' },
        });
        cursorEsq = (doc as any).lastAutoTable.finalY + 3;
      }
    });
  } else {
    // Fallback (sem escopo estruturado): texto, como antes.
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    const descTexto = ultimaProposta
      ? formatarEscopoBasicoParaTexto(ultimaProposta.escopoBasicoServicos || ultimaProposta.escopoA)
      : (osPrincipal.descricao || osPrincipal.descricaoGeralServico || '');
    cursorEsq = bodyY + 5;
    doc.splitTextToSize(descTexto, leftW - 4).forEach((l: string) => {
      doc.text(l, margin + 2, cursorEsq);
      cursorEsq += 4;
    });
  }
  doc.setTextColor(0, 0, 0);

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

  // Itens "A SER INCLUÍDO" customizados (adicionados na OS) — sempre marcados, pois foram
  // incluídos de propósito. Antes só o PDF inline os mostrava; aqui também passam a aparecer.
  const extrasInc = (Array.isArray(baseChecks?.extras) ? baseChecks.extras : [])
    .map((e: any) => ({ lbl: String(e?.label || '').trim().toUpperCase(), v: true }))
    .filter((e: any) => e.lbl);
  listChecks.push(...extrasInc);

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
