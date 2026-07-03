import jsPDF from 'jspdf';

// Carrega a imagem do logo (pasta public) antes de gerar o PDF.
const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });

const money = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dataBr = (d?: string) => {
  if (!d) return '';
  const m = String(d).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};

// --- Valor por extenso (reais) ---
const extensoGrupo = (n: number): string => {
  const u = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  if (n === 0) return '';
  if (n === 100) return 'cem';
  let s = '';
  const cent = Math.floor(n / 100);
  const resto = n % 100;
  if (cent > 0) s += c[cent];
  if (resto > 0) {
    if (s) s += ' e ';
    if (resto < 20) s += u[resto];
    else {
      s += d[Math.floor(resto / 10)];
      if (resto % 10 > 0) s += ' e ' + u[resto % 10];
    }
  }
  return s;
};

export const valorPorExtenso = (valor: number): string => {
  const v = Math.round((Number(valor) || 0) * 100) / 100;
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);
  const parte = (n: number): string => {
    if (n === 0) return 'zero';
    const mi = Math.floor(n / 1000000);
    const mil = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;
    const p: string[] = [];
    if (mi > 0) p.push(mi === 1 ? 'um milhão' : `${extensoGrupo(mi)} milhões`);
    if (mil > 0) p.push(mil === 1 ? 'mil' : `${extensoGrupo(mil)} mil`);
    if (resto > 0) p.push(extensoGrupo(resto));
    return p.join(' e ');
  };
  let s = `${parte(reais)} ${reais === 1 ? 'real' : 'reais'}`;
  if (centavos > 0) s += ` e ${parte(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
  return `${s}.`.toUpperCase();
};

export interface ReciboLocacaoData {
  numero: string;
  empresa?: string;
  emitenteNome: string;
  emitenteEndereco: string;
  emitenteCep?: string;
  emitenteCidadeUf?: string;
  emitenteCnpj: string;
  emitenteInscMunicipal: string;
  emitenteInscEstadual: string;
  atendimento: string;
  dataEmissao: string;
  dataVencimento: string;
  formaPagamento: string;
  banco: string;
  clienteNome: string;
  clienteLogradouro: string;
  clienteBairro: string;
  clienteMunicipio: string;
  clienteUf: string;
  clienteCep: string;
  clienteCnpj: string;
  clienteInscEst: string;
  clienteIncMun: string;
  itens: Array<{ item?: string; qtd?: string; descricao: string; valorUnitario: number; total: number }>;
  obs?: string;
}

export const gerarReciboLocacaoPDF = async (r: ReciboLocacaoData) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const rightX = pageW - margin;
  let y = 12;

  const G: [number, number, number] = [241, 241, 241];

  const cell = (
    x: number, cy: number, w: number, h: number, text = '',
    o: { align?: 'left' | 'center' | 'right'; bold?: boolean; size?: number; fill?: boolean; italic?: boolean; border?: boolean; valign?: 'top' | 'middle' } = {},
  ) => {
    if (o.fill) { doc.setFillColor(...G); doc.rect(x, cy, w, h, 'F'); }
    if (o.border !== false) doc.rect(x, cy, w, h);
    if (!text) return;
    doc.setFont('helvetica', o.bold ? 'bold' : (o.italic ? 'italic' : 'normal'));
    doc.setFontSize(o.size ?? 8);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(String(text), w - 3);
    const lh = (o.size ?? 8) * 0.42;
    let ty = o.valign === 'top' ? cy + 3 : cy + h / 2 - ((lines.length - 1) * lh) / 2 + lh * 0.35;
    lines.forEach((ln: string) => {
      const tx = o.align === 'center' ? x + w / 2 : o.align === 'right' ? x + w - 1.5 : x + 1.5;
      doc.text(ln, tx, ty, { align: o.align || 'left' });
      ty += lh;
    });
  };

  // ===== Logo + 1ª VIA =====
  try {
    const isLinave = String(r.empresa || '').toLowerCase().includes('linave');
    const img = await loadImage(isLinave ? '/image2.jpg' : '/image1.png');
    doc.addImage(img, isLinave ? 'JPEG' : 'PNG', margin, y, 45, 24);
  } catch { /* segue sem logo */ }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.rect(rightX - 22, y, 22, 6);
  doc.text('1ª VIA', rightX - 11, y + 4, { align: 'center' });
  y += 28;

  // ===== Cabeçalho: emitente (esq) + título/datas (dir) =====
  const leftW = 96;
  const rightW = pageW - margin * 2 - leftW;
  const topH = 44;

  // Bloco emitente (esquerda)
  doc.rect(margin, y, leftW, topH);
  const emit = [
    r.emitenteNome,
    r.emitenteEndereco,
    r.emitenteCep ? `CEP: ${r.emitenteCep}` : '',
    r.emitenteCidadeUf || '',
    `CNPJ.: ${r.emitenteCnpj}`,
    `INSCRIÇÃO MUNICIPAL: ${r.emitenteInscMunicipal}`,
    `INSCRIÇÃO ESTADUAL: ${r.emitenteInscEstadual}`,
  ].filter(Boolean);
  let ey = y + 6;
  emit.forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.splitTextToSize(String(line), leftW - 8).forEach((ln: string) => { doc.text(ln, margin + 4, ey); ey += 4; });
  });

  // Título (direita, topo)
  const rx = margin + leftW;
  cell(rx, y, rightW, 14, 'RECIBO DE LOCAÇÃO', { align: 'center', bold: true, size: 13 });
  cell(rx, y, rightW, 14, `Nº ${r.numero}`, { align: 'right', bold: true, size: 11, border: false });
  // Datas / forma (direita, rótulo + valor)
  const dyStart = y + 14;
  const dh = (topH - 14) / 3;
  const lblW = rightW * 0.55;
  const rows: [string, string][] = [
    ['DATA DA EMISSÃO:', dataBr(r.dataEmissao)],
    ['DATA DO VENCIMENTO:', dataBr(r.dataVencimento)],
    ['FORMA DE PAGAMENTO:', r.formaPagamento || ''],
  ];
  rows.forEach(([lbl, val], i) => {
    const ry = dyStart + i * dh;
    cell(rx, ry, lblW, dh, lbl, { align: 'right', bold: true, size: 8.5, fill: true });
    cell(rx + lblW, ry, rightW - lblW, dh, val, { align: 'center', bold: true, italic: true, size: 8.5 });
  });
  y += topH;

  // Linha: atendimento (esq) + banco (dir)
  const atH = 8;
  cell(margin, y, leftW, atH, `ATENDIMENTO: ${r.atendimento}`, { align: 'center', size: 8 });
  cell(rx, y, rightW, atH, r.banco, { align: 'center', bold: true, size: 8.5, fill: true });
  y += atH + 2;

  // ===== USUÁRIO FINAL / DESTINATÁRIO =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('USUÁRIO FINAL / DESTINATÁRIO', pageW / 2, y + 3, { align: 'center' });
  const uw = doc.getTextWidth('USUÁRIO FINAL / DESTINATÁRIO');
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - uw / 2, y + 4.2, pageW / 2 + uw / 2, y + 4.2);
  y += 8;

  // Destinatário
  const fullW = pageW - margin * 2;
  const rowH = 9;
  cell(margin, y, 45, rowH, 'NOME / RAZÃO SOCIAL:', { bold: true, size: 8 });
  cell(margin + 45, y, fullW - 45, rowH, r.clienteNome, { italic: true, size: 8 });
  y += rowH;
  // Endereço (logradouro + bairro)
  cell(margin, y, 24, rowH, 'ENDEREÇO:', { bold: true, size: 8 });
  cell(margin + 24, y, 26, rowH, 'LOGRADOURO:', { bold: true, size: 7.5, align: 'center' });
  cell(margin + 50, y, fullW - 50 - 60, rowH, r.clienteLogradouro, { italic: true, size: 8 });
  cell(rightX - 60, y, 18, rowH, 'BAIRRO:', { bold: true, size: 7.5, align: 'center' });
  cell(rightX - 42, y, 42, rowH, r.clienteBairro, { italic: true, size: 8 });
  y += rowH;
  // Município / UF / CEP
  cell(margin, y, 24, rowH, '', {});
  cell(margin + 24, y, 26, rowH, 'MUNICÍPIO:', { bold: true, size: 7.5, align: 'center' });
  cell(margin + 50, y, 42, rowH, r.clienteMunicipio, { italic: true, size: 8 });
  cell(margin + 92, y, 14, rowH, 'UF.:', { bold: true, size: 7.5, align: 'center' });
  cell(margin + 106, y, 24, rowH, r.clienteUf, { italic: true, size: 8 });
  cell(margin + 130, y, 16, rowH, 'CEP.:', { bold: true, size: 7.5, align: 'center' });
  cell(margin + 146, y, fullW - 146, rowH, r.clienteCep, { size: 8 });
  y += rowH;
  // CNPJ / Insc Est / Inc Mun
  const t3 = fullW / 3;
  cell(margin, y, 20, rowH, 'CNPJ:', { bold: true, size: 7.5, align: 'center' });
  cell(margin + 20, y, t3 - 20, rowH, r.clienteCnpj, { size: 8 });
  cell(margin + t3, y, 22, rowH, 'INSC. EST:', { bold: true, size: 7.5, align: 'center' });
  cell(margin + t3 + 22, y, t3 - 22, rowH, r.clienteInscEst, { italic: true, size: 8 });
  cell(margin + t3 * 2, y, 24, rowH, 'INC. MUN.:', { bold: true, size: 7.5, align: 'center' });
  cell(margin + t3 * 2 + 24, y, fullW - t3 * 2 - 24, rowH, r.clienteIncMun, { size: 8 });
  y += rowH + 2;

  // ===== Itens =====
  const cItem = 16, cQtd = 16, cUnit = 30, cTotal = 30;
  const cDesc = fullW - cItem - cQtd - cUnit - cTotal;
  const hH = 8;
  cell(margin, y, cItem, hH, 'ITEM', { bold: true, align: 'center', fill: true });
  cell(margin + cItem, y, cQtd, hH, 'QTD.', { bold: true, align: 'center', fill: true });
  cell(margin + cItem + cQtd, y, cDesc, hH, 'DESCRIÇÃO', { bold: true, align: 'center', fill: true });
  cell(margin + cItem + cQtd + cDesc, y, cUnit + cTotal, hH / 2, 'VALOR EM R$', { bold: true, align: 'center', fill: true });
  cell(margin + cItem + cQtd + cDesc, y + hH / 2, cUnit, hH / 2, 'UNITÁRIO', { bold: true, align: 'center', size: 7.5, fill: true });
  cell(margin + cItem + cQtd + cDesc + cUnit, y + hH / 2, cTotal, hH / 2, 'TOTAL', { bold: true, align: 'center', size: 7.5, fill: true });
  y += hH;

  const itens = Array.isArray(r.itens) ? r.itens : [];
  itens.forEach((it, i) => {
    const descLines = doc.splitTextToSize(String(it.descricao || ''), cDesc - 3);
    const rh = Math.max(9, descLines.length * 4 + 3);
    cell(margin, y, cItem, rh, it.item || String(i + 1).padStart(2, '0'), { align: 'center', size: 8 });
    cell(margin + cItem, y, cQtd, rh, it.qtd || '', { align: 'center', size: 8 });
    cell(margin + cItem + cQtd, y, cDesc, rh, it.descricao || '', { italic: true, size: 8, valign: 'top' });
    cell(margin + cItem + cQtd + cDesc, y, cUnit, rh, money(it.valorUnitario), { align: 'center', italic: true, size: 8 });
    cell(margin + cItem + cQtd + cDesc + cUnit, y, cTotal, rh, money(it.total), { align: 'center', italic: true, size: 8 });
    y += rh;
  });
  // linhas em branco para dar corpo (como no modelo)
  for (let i = itens.length; i < 3; i++) { cell(margin, y, fullW, 8, '', {}); y += 8; }

  const totalRecibo = itens.reduce((s, it) => s + (Number(it.total) || 0), 0);
  cell(margin, y, fullW - cTotal, 8, 'VALOR TOTAL DO RECIBO', { bold: true, align: 'center', fill: true });
  cell(margin + fullW - cTotal, y, cTotal, 8, `R$ ${money(totalRecibo)}`, { italic: true, size: 8 });
  y += 8;
  cell(margin, y, 34, 10, 'VALOR POR EXTENSO', { bold: true, size: 7.5, align: 'center' });
  cell(margin + 34, y, fullW - 34, 10, valorPorExtenso(totalRecibo), { italic: true, size: 8 });
  y += 10 + 1;

  // OBS
  cell(margin, y, 16, 9, 'OBS:', { bold: true, size: 8, align: 'center' });
  cell(margin + 16, y, fullW - 16, 9, r.obs || '', { size: 8 });
  y += 9 + 3;

  // Nota legal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const nota = 'ATIVIDADE DE LOCAÇÃO NÃO SUJEITA A EMISSÃO DA NOTA FISCAL DE SERVIÇO CONFORME LEI COMPLEMENTAR Nº 116/03 DE 31/07/2003 E PORTARIA Nº 74/2003 DA SECRETARIA DE FAZENDA.';
  const notaLines = doc.splitTextToSize(nota, fullW - 6);
  const notaH = notaLines.length * 3.2 + 3;
  doc.rect(margin, y, fullW, notaH);
  let ny = y + 3.5;
  notaLines.forEach((ln: string) => { doc.text(ln, pageW / 2, ny, { align: 'center' }); ny += 3.2; });
  y += notaH + 3;

  // Rodapé: recebido / assinatura / nº recibo
  const c1 = 55, c3 = 40;
  const c2 = fullW - c1 - c3;
  cell(margin, y, c1, 7, 'DOCUMENTO RECEBIDO EM', { bold: true, size: 6.5, align: 'center' });
  cell(margin + c1, y, c2, 7, 'ASSINATURA E IDENTIFICAÇÃO DO RECEBEDOR', { bold: true, size: 6.5, align: 'center' });
  cell(margin + c1 + c2, y, c3, 7, 'Nº DO RECIBO', { bold: true, size: 9, align: 'center' });
  y += 7;
  cell(margin, y, c1, 16, '', {});
  cell(margin + c1, y, c2, 16, '', {});
  cell(margin + c1 + c2, y, c3, 16, r.numero, { bold: true, size: 10, align: 'center' });

  doc.save(`Recibo_Locacao_${String(r.numero || 'recibo').replace(/[\\/]/g, '-')}.pdf`);
};
