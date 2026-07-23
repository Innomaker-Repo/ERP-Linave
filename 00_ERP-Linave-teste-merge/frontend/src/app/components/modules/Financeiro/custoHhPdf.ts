/* =========================================================================================
 * FINANCEIRO — Documento de custo de mão de obra (H.H) por OS
 * Espelha o "LEVANTAMENTO DE CUSTOS COM MÃO DE OBRA": Item 1 = HN, Item 2 = HE 50% (×1,5),
 * Item 3 = HE 100% (×2), com subtotal de mão de obra. Apenas a parte de H.H (mão de obra).
 * =======================================================================================*/
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CustoCargo {
  cargo: string;
  hn: number; he05: number; he10: number;
  rate: number; custoHN: number; custoHE05: number; custoHE10: number; total: number;
}

interface CustoHhDados {
  os: string;
  empresaNome: string;
  empresaRazao: string;
  cnpj: string;
  cliente: string;
  escopo: string;
  embarcacao?: string;
  periodoTxt: string;
  mes?: string;
  custos: CustoCargo[];
  totalHH: number;
  // Documento "completo": inclui materiais/terceirizados/outros custos + custo total do projeto.
  completo?: boolean;
  outrosCustos?: Array<{ tipo: string; descricao: string; valor: number }>;
}

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBr = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (iso: string) => {
  const m = String(iso || '').slice(0, 10).split('-');
  return m.length === 3 && m[0] ? `${m[2]}/${m[1]}/${m[0]}` : '';
};
const letra = (i: number) => String.fromCharCode(97 + i); // a, b, c...

export const handleDownloadCustoHhPDF = (dados: CustoHhDados) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 14;

  // ===== Cabeçalho =====
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const titulo = dados.completo
    ? 'LEVANTAMENTO DE CUSTOS DO PROJETO'
    : 'RESUMO DE CUSTOS DE MÃO DE OBRA (H.H)';
  doc.text(titulo, pageWidth / 2, y, { align: 'center' });
  y += 8;

  const periodoTxt = dados.periodoTxt || dados.mes || '';
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
    body: [
      [{ content: 'Empresa:', styles: { fontStyle: 'bold' } }, dados.empresaRazao || dados.empresaNome, { content: 'Cliente:', styles: { fontStyle: 'bold' } }, dados.cliente || ''],
      [{ content: 'CNPJ:', styles: { fontStyle: 'bold' } }, dados.cnpj || '', { content: 'OS:', styles: { fontStyle: 'bold' } }, dados.os || ''],
      [{ content: 'Escopo:', styles: { fontStyle: 'bold' } }, dados.escopo || '', { content: 'Período apuração:', styles: { fontStyle: 'bold' } }, periodoTxt],
      [{ content: 'Embarcação:', styles: { fontStyle: 'bold' } }, dados.embarcacao || '', { content: 'Mês / Emissão:', styles: { fontStyle: 'bold' } }, `${dados.mes || ''}  ·  ${dataBr(new Date().toISOString())}`],
    ],
    columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 74 }, 2: { cellWidth: 30 }, 3: { cellWidth: 'auto' } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ===== Um item (HN / HE 100% / HE 50%) =====
  const head = [['Ítem', 'Descrição dos Serviços', 'Quantid.', 'Unid.', 'Valor unit. R$', 'Valor total (R$)']];
  const desenharItem = (
    titulo: string,
    unid: string,
    getQtd: (c: CustoCargo) => number,
    getTotal: (c: CustoCargo) => number,
  ): number => {
    const linhas = dados.custos.filter((c) => getQtd(c) > 0);
    const body: any[] = [[{ content: titulo, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [225, 225, 225] } }]];
    let subtotal = 0;
    linhas.forEach((c, i) => {
      const tot = getTotal(c);
      subtotal += tot;
      body.push([`${letra(i)})`, c.cargo, numBr(getQtd(c)), unid, numBr(c.rate), brl(tot)]);
    });
    if (linhas.length === 0) body.push([{ content: 'Sem horas neste item.', colSpan: 6, styles: { textColor: [120, 120, 120] } }]);
    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { halign: 'right', cellWidth: 20 }, 3: { halign: 'center', cellWidth: 14 }, 4: { halign: 'right', cellWidth: 28 }, 5: { halign: 'right', cellWidth: 32 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    return subtotal;
  };

  const s1 = desenharItem('1 — HORA NORMAL (HN)', 'HN', (c) => c.hn, (c) => c.custoHN);
  const s2 = desenharItem('2 — HORA EXTRA 50% (HE 0,5)', 'HE', (c) => c.he05, (c) => c.custoHE05);
  const s3 = desenharItem('3 — HORA EXTRA 100% (HE 1,0)', 'HE', (c) => c.he10, (c) => c.custoHE10);

  // ===== Subtotal mão de obra =====
  const subtotalMO = s1 + s2 + s3;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    body: [[
      { content: 'CUSTO TOTAL DE MÃO DE OBRA (H.H)', styles: { fontStyle: 'bold', fillColor: [198, 224, 180] } },
      { content: `R$ ${brl(subtotalMO)}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [198, 224, 180] } },
    ]],
    styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 44 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ===== Parte de serviço (materiais, terceirizados, outros) — só no documento completo =====
  const outros = Array.isArray(dados.outrosCustos) ? dados.outrosCustos : [];
  let totalGeral = subtotalMO;
  if (dados.completo) {
    const subtotalOutros = outros.reduce((s, o) => s + (Number(o.valor) || 0), 0);
    totalGeral = subtotalMO + subtotalOutros;
    const outrosBody: any[] = [[{ content: '4 — MATERIAIS, TERCEIRIZADOS E OUTROS CUSTOS', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [225, 225, 225] } }]];
    if (outros.length) outros.forEach((o) => outrosBody.push([o.tipo, o.descricao, brl(o.valor)]));
    else outrosBody.push([{ content: 'Sem outros custos vinculados a esta OS.', colSpan: 3, styles: { textColor: [120, 120, 120] } }]);
    outrosBody.push([{ content: 'Subtotal materiais/terceirizados/outros', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: brl(subtotalOutros), styles: { fontStyle: 'bold', halign: 'right' } }]);
    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Descrição', 'Valor (R$)']],
      body: outrosBody,
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 32 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      body: [[
        { content: 'CUSTO TOTAL DO PROJETO — DIRETO (mão de obra + materiais/terceirizados)', styles: { fontStyle: 'bold', fillColor: [255, 214, 153] } },
        { content: `R$ ${brl(totalGeral)}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 214, 153] } },
      ]],
      styles: { fontSize: 9.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 44 } },
      margin: { left: margin, right: margin },
    });
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(`Documento gerado pelo Linave ERP em ${new Date().toLocaleString('pt-BR')}`, margin, doc.internal.pageSize.getHeight() - 5);
  }

  const nomeArquivo = `Custo_HH_${String(dados.os || 'OS').replace(/[\\/]/g, '-')}.pdf`;
  doc.save(nomeArquivo);
};
