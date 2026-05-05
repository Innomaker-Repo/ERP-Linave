import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const normalizarEscopoBasico = (escopo: any) => {
  if (!escopo) return [];

  const normalizarLinha = (linha: any, index: number) => { // <-- Adicione o index aqui
    if (!linha?.valores || typeof linha.valores !== 'object') return [];
    const colunas = Object.entries(linha.valores)
      .map(([chave, valor]) => ({
        chave: String(chave),
        valor: String(valor ?? '').trim(),
      }))
      .filter((coluna) => coluna.valor);

    if (colunas.length === 0) return [];

    return [
      // Correção aqui: Usa linha.item se existir, senão usa index + 1 (1, 2, 3...)
      { chave: 'Item', valor: String(linha.item || (index + 1)) }, 
      ...colunas,
    ];
  };

  const normalizarItem = (item: any, index: number) => {
    if (!item) return null;
    if (typeof item === 'string') {
      return {
        titulo: item.trim() || `Item ${index + 1}`,
        textosAntes: [],
        tabela: [],
        textosDepois: [],
      };
    }

    const titulo = [item.titulo, item.descricaoServico, item.descricao, item.texto]
      .find((valor) => typeof valor === 'string' && valor.trim());

    return {
      titulo: titulo?.trim() || `Item ${index + 1}`,
      textosAntes: [
        ...(typeof item.descricaoServico === 'string' && item.descricaoServico.trim() ? [item.descricaoServico] : []),
        ...(typeof item.textoLivre === 'string' && item.textoLivre.trim() ? [item.textoLivre] : []),
      ].filter((texto: any) => typeof texto === 'string' && texto.trim()).map((texto: string) => texto.trim()),
      tabela: Array.isArray(item.linhas)
        // Correção aqui: pegamos o index do map e passamos pro normalizarLinha
        ? item.linhas.map((linha: any, idx: number) => normalizarLinha(linha, idx)).filter((linha: any[]) => linha.length > 0)
        : [],
      textosDepois: (Array.isArray(item.textosDepoisTabela) ? item.textosDepoisTabela : [])
        .filter((texto: any) => typeof texto === 'string' && texto.trim())
        .map((texto: string) => texto.trim()),
    };
  };

  if (typeof escopo === 'string') {
    return [{ titulo: '', textosAntes: [escopo], tabela: [], textosDepois: [] }];
  }

  if (Array.isArray(escopo)) {
    return escopo.map((item, index) => normalizarItem(item, index)).filter(Boolean);
  }

  if (typeof escopo === 'object') {
    const item = normalizarItem(escopo, 0);
    return item ? [item] : [];
  }

  return [{ titulo: '', textosAntes: [String(escopo)], tabela: [], textosDepois: [] }];
};

export const handleDownloadPropostaPDF = (
  propostaForm: any,
  cliente: any,
  obra: any,
  logoBase64?: string,
  isLinave?: boolean,
) => {
  if (!propostaForm) return;

  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const usableWidth = pageWidth - margin * 2;
    let y = margin;

    const drawHeader = () => {
      let currentY = 15;

      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, currentY, 45, 20);
      }

      doc.setFont('Arial', 'bold');
      doc.setFontSize(11);
      currentY += 25;

      if (isLinave) {
        // Cabeçalho específico para Linave
        doc.text('Linave', margin, currentY);
        doc.setFont('Arial', 'normal');
        doc.setFontSize(9);
        currentY += 5;
        doc.text('End. Rua Visconde de Itaborai, 24 –', margin, currentY);
        currentY += 5;
        doc.text('Centro – Niteroi - RJ', margin, currentY);
        currentY += 5;
        doc.text('CEP 24.030-091', margin, currentY);
        currentY += 5;
        doc.text('+55 (21) 99129-3251 / 3629-1439', margin, currentY);
      } else {
        // Cabeçalho padrão para Servinave
        const nomeEmpresa = propostaForm.empresaNome || 'VTS - Servinave Engenharia e Reparos Navais';
        doc.text(nomeEmpresa, margin, currentY);

        doc.setFont('Arial', 'normal');
        doc.setFontSize(9);
        currentY += 5;
        doc.text("Rua Miguel de Lemos, 44 Fundos - Ponta D'areia", margin, currentY);
        currentY += 5;
        doc.text('Cep: 24040-260 - Niteroi - RJ', margin, currentY);
        currentY += 5;
        doc.text('Tel: +55 (21) 2620-1850', margin, currentY);
        currentY += 5;
        doc.text('Email: comercial@servinave.com.br', margin, currentY);
      }

      currentY += 5;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      return currentY + 15;
    };

    y = drawHeader();

    const ensureSpace = (neededHeight = 10) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = drawHeader();
      }
    };

    const writeText = (
      text: string,
      fontSize = 11,
      bold = false,
      align: 'left' | 'right' | 'center' | 'justify' = 'left',
      xOffset = 0,
      marginBottom = 4,
    ) => {
      if (!text) return;

      doc.setFont('Arial', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(0, 0, 0);

      const lineHeight = fontSize * 0.45;
      const textWidth = usableWidth - xOffset;
      const lines = doc.splitTextToSize(String(text), textWidth);

      lines.forEach((line: string) => {
        ensureSpace(lineHeight + 2);

        let posX = margin + xOffset;
        if (align === 'right') posX = pageWidth - margin;
        else if (align === 'center') posX = pageWidth / 2;

        doc.text(line, posX, y, { align });
        y += lineHeight + 1;
      });

      y += marginBottom;
    };

    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    writeText(`Niteroi, ${dataAtual}`, 11, false, 'right', 0, 1);
    writeText(`Proposta ${propostaForm.numeroProposta || '001/26'}`, 11, true, 'right', 0, 15);

    writeText('A', 11, false, 'left', 0, 2);
    writeText(propostaForm.cliente || cliente?.razaoSocial || 'CLIENTE', 11, true, 'left', 0, 10);

    if (propostaForm.contato) writeText(`ATT.: ${propostaForm.contato}`, 11, true, 'left', 0, 2);
    if (propostaForm.referencia) writeText(`Ref.: ${propostaForm.referencia}`, 11, true, 'left', 0, 2);
    if (propostaForm.assunto) writeText(`Subject: ${propostaForm.assunto}`, 11, true, 'left', 0, 10);
    if (propostaForm.saudacao) writeText(propostaForm.saudacao, 11, false, 'left', 0, 4);
    if (propostaForm.textoAbertura) writeText(propostaForm.textoAbertura, 11, false, 'justify', 0, 10);

    if (propostaForm.assinaturaAberturaNome) {
      writeText('Atenciosamente,', 11, false, 'left', 0, 2);
      writeText(propostaForm.assinaturaAberturaNome, 11, true, 'left', 0, 1);
      if (propostaForm.assinaturaAberturaCargo) writeText(propostaForm.assinaturaAberturaCargo, 11, false, 'left', 0, 1);
      y += 10;
    }

    writeText('A - Escopo - Proposta Tecnica', 11, true, 'left', 0, 6);

    const itensEscopo = normalizarEscopoBasico(propostaForm.escopoBasicoServicos || propostaForm.escopoA);
    itensEscopo.forEach((item: any, index: number) => {
      if (item.titulo) {
        writeText(`${index + 1}. ${item.titulo}`, 11, true, 'left', 5, 3);
      }

      item.textosAntes.forEach((texto: string) => {
        writeText(texto, 11, false, 'justify', 10, 3);
      });

      if (item.tabela.length > 0) {
        ensureSpace(20);
        const head = [item.tabela[0].map((coluna: any) => coluna.chave)];
        const body = item.tabela.map((linha: any[]) => {
          const mapaLinha = new Map(linha.map((coluna: any) => [coluna.chave, coluna.valor]));
          return head[0].map((chave: string) => mapaLinha.get(chave) || '');
        });
        autoTable(doc, {
          startY: y,
          head,
          body,
          theme: 'grid',
          margin: { left: margin + 10, right: margin },
          headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
          styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0] },
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }

      item.textosDepois.forEach((texto: string) => {
        writeText(texto, 11, false, 'justify', 10, 3);
      });

      y += 2;
    });

    if (propostaForm.responsabilidadeContratada) {
      writeText('B - Responsabilidade da Contratada:', 11, true, 'left', 0, 4);
      writeText(propostaForm.responsabilidadeContratada, 11, false, 'left', 5, 8);
    }

    if (propostaForm.responsabilidadeContratante) {
      writeText('C - Responsabilidade da Contratante:', 11, true, 'left', 0, 4);
      writeText(propostaForm.responsabilidadeContratante, 11, false, 'left', 5, 8);
    }

    if (propostaForm.preco) {
      writeText('D - Preco:', 11, true, 'left', 0, 4);
      writeText(propostaForm.preco, 11, false, 'left', 5, 4);
      if (propostaForm.impostosObservacoes) {
        writeText(propostaForm.impostosObservacoes, 11, false, 'left', 5, 8);
      } else {
        y += 4;
      }
    }

    if (propostaForm.condicoesGerais) {
      writeText('E - Condicoes Gerais:', 11, true, 'left', 0, 4);
      writeText(propostaForm.condicoesGerais, 11, false, 'left', 5, 8);
    }

    if (propostaForm.prazo) {
      writeText('F - Prazo:', 11, true, 'left', 0, 4);
      writeText(propostaForm.prazo, 11, false, 'left', 5, 8);
    }

    if (propostaForm.condicoesPagamento) {
      writeText('G - Condicoes de Pagamento:', 11, true, 'left', 0, 4);
      writeText(propostaForm.condicoesPagamento, 11, false, 'left', 5, 12);
    }

    writeText(propostaForm.encerramento || 'Atenciosamente,', 11, false, 'left', 0, 6);
    writeText(propostaForm.assinaturaNome || 'Servinave Eng. e Rep. Navais', 11, true, 'left', 0, 1);
    writeText(propostaForm.assinaturaCargo || 'Setor Comercial', 11, false, 'left', 0, 10);

    const nomeArquivo = `Proposta_${propostaForm.numeroProposta || '001'}_${Date.now()}.pdf`;
    const conteudoDataUrl = doc.output('datauristring');
    doc.save(nomeArquivo);

    return {
      nomeArquivo,
      conteudoDataUrl,
      tamanho: conteudoDataUrl.length,
    };
  } catch (error) {
    console.error('Erro ao gerar PDF de Proposta:', error);
    throw error;
  }
};
