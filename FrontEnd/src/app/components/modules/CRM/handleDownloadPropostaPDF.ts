import jsPDF from 'jspdf';

// Caso você tenha a logo em base64, você pode passá-la aqui.
// Se não, o cabeçalho será gerado apenas com texto.
export const handleDownloadPropostaPDF = (
  propostaForm: any,
  cliente: any,
  obra: any,
  logoBase64?: string 
) => {
  if (!propostaForm) return;

  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const usableWidth = pageWidth - margin * 2;
    let y = margin;

    // =========================================================================
    // 1. FUNÇÃO DE CABEÇALHO (Repete em todas as páginas)
    // =========================================================================
    const drawHeader = () => {
      let currentY = 15;

      // Se você passar a imagem da logo, ele desenha. Se não, ignora.
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, currentY, 45, 20); // Ajuste W e H conforme sua logo
      }

      doc.setFont('Arial', 'bold');
      doc.setFontSize(11);
      currentY += 25; // Desce abaixo da logo
      
      const nomeEmpresa = propostaForm.empresaNome || "VTS - Servinave Engenharia e Reparos Navais";
      doc.text(nomeEmpresa, margin, currentY);
      
      doc.setFont('Arial', 'normal');
      doc.setFontSize(9);
      currentY += 5;
      doc.text("Rua Miguel de Lemos, 44 Fundos - Ponta D'areia", margin, currentY);
      currentY += 5;
      doc.text("Cep: 24040-260 - Niterói - RJ", margin, currentY);
      currentY += 5;
      doc.text("Tel: +55 (21) 2620-1850", margin, currentY);
      currentY += 5;
      doc.text("Email: comercial@servinave.com.br", margin, currentY);

      // Linha separadora do cabeçalho
      currentY += 5;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      return currentY + 15; // Retorna o Y inicial para o conteúdo da página
    };

    // Inicializa a primeira página desenhando o cabeçalho
    y = drawHeader();

    // =========================================================================
    // 2. FUNÇÃO INTELIGENTE DE ESCRITA DE TEXTO (Lida com quebra de página)
    // =========================================================================
    const writeText = (
      text: string,
      fontSize = 11,
      bold = false,
      align: 'left' | 'right' | 'center' | 'justify' = 'left',
      xOffset = 0,
      marginBottom = 4
    ) => {
      if (!text) return;

      doc.setFont('Arial', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(0, 0, 0);

      const lineHeight = fontSize * 0.45;
      const textWidth = usableWidth - xOffset;
      const lines = doc.splitTextToSize(String(text), textWidth);

      lines.forEach((line: string) => {
        // Se a próxima linha ultrapassar o limite inferior, cria nova página
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = drawHeader(); // Redesenha o cabeçalho e pega o novo Y
        }

        let posX = margin + xOffset;
        if (align === 'right') posX = pageWidth - margin;
        else if (align === 'center') posX = pageWidth / 2;

        doc.text(line, posX, y, { align });
        y += lineHeight + 1; // 1mm de espaçamento entre linhas
      });

      y += marginBottom; // Espaçamento após o parágrafo
    };

    // =========================================================================
    // 3. CONSTRUÇÃO DO DOCUMENTO (Baseado nos campos do formulário)
    // =========================================================================

    // Data e Número da Proposta (Alinhados à direita)
    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    writeText(`Niterói, ${dataAtual}`, 11, false, 'right', 0, 1);
    writeText(`Proposta ${propostaForm.numeroProposta || '001/26'}`, 11, true, 'right', 0, 15);

    // Destinatário
    writeText("À", 11, false, 'left', 0, 2);
    writeText(propostaForm.cliente || cliente?.razaoSocial || "CLIENTE", 11, true, 'left', 0, 10);

    // Att, Ref, Subject
    if (propostaForm.contato) writeText(`ATT.: ${propostaForm.contato}`, 11, true, 'left', 0, 2);
    if (propostaForm.referencia) writeText(`Ref.: ${propostaForm.referencia}`, 11, true, 'left', 0, 2);
    if (propostaForm.assunto) writeText(`Subject: ${propostaForm.assunto}`, 11, true, 'left', 0, 10);

    // Saudação e Texto de Abertura
    if (propostaForm.saudacao) writeText(propostaForm.saudacao, 11, false, 'left', 0, 4);
    if (propostaForm.textoAbertura) writeText(propostaForm.textoAbertura, 11, false, 'justify', 0, 10);

    // Primeira assinatura (opcional, como no exemplo 1)
    if (propostaForm.assinaturaAberturaNome) {
      writeText("Atenciosamente,", 11, false, 'left', 0, 2);
      writeText(propostaForm.assinaturaAberturaNome, 11, true, 'left', 0, 1);
      if (propostaForm.assinaturaAberturaCargo) writeText(propostaForm.assinaturaAberturaCargo, 11, false, 'left', 0, 1);
      y += 10;
    }

    // --- SEÇÃO A: Escopo ---
    writeText("A - Escopo - Proposta Técnica", 11, true, 'left', 0, 6);
    
    // Tratamento dinâmico para os itens do escopo (array ou texto corrido)
    if (Array.isArray(propostaForm.escopoItens) && propostaForm.escopoItens.length > 0) {
      propostaForm.escopoItens.forEach((item: any, idx: number) => {
        writeText(`${idx + 1} - ${item.descricao || 'Serviço'}`, 11, true, 'left', 5, 2);
        if (item.textoLivre) {
          writeText(item.textoLivre, 11, false, 'justify', 10, 6);
        }
      });
    } else if (propostaForm.escopoBasicoServicos) {
      // Se for apenas um campo de texto longo vindo do formulário
      writeText(propostaForm.escopoBasicoServicos, 11, false, 'justify', 5, 8);
    }

    // --- SEÇÃO B: Responsabilidade da Contratada ---
    if (propostaForm.responsabilidadeContratada) {
      writeText("B - Responsabilidade da Contratada:", 11, true, 'left', 0, 4);
      writeText(propostaForm.responsabilidadeContratada, 11, false, 'left', 5, 8);
    }

    // --- SEÇÃO C: Responsabilidade da Contratante ---
    if (propostaForm.responsabilidadeContratante) {
      writeText("C - Responsabilidade da Contratante:", 11, true, 'left', 0, 4);
      writeText(propostaForm.responsabilidadeContratante, 11, false, 'left', 5, 8);
    }

    // --- SEÇÃO D: Preço ---
    if (propostaForm.preco) {
      writeText("D - Preço:", 11, true, 'left', 0, 4);
      writeText(propostaForm.preco, 11, false, 'left', 5, 4);
      if (propostaForm.impostosObservacoes) {
         writeText(propostaForm.impostosObservacoes, 11, false, 'left', 5, 8);
      } else {
         y += 4;
      }
    }

    // --- SEÇÃO E: Condições Gerais ---
    if (propostaForm.condicoesGerais) {
      writeText("E - Condições Gerais:", 11, true, 'left', 0, 4);
      writeText(propostaForm.condicoesGerais, 11, false, 'left', 5, 8);
    }

    // --- SEÇÃO F: Prazo ---
    if (propostaForm.prazo) {
      writeText("F - Prazo:", 11, true, 'left', 0, 4);
      writeText(propostaForm.prazo, 11, false, 'left', 5, 8);
    }

    // --- SEÇÃO G: Condições de Pagamento ---
    if (propostaForm.condicoesPagamento) {
      writeText("G - Condições de Pagamento:", 11, true, 'left', 0, 4);
      writeText(propostaForm.condicoesPagamento, 11, false, 'left', 5, 12);
    }

    // --- ENCERRAMENTO E ASSINATURA FINAL ---
    writeText(propostaForm.encerramento || "Atenciosamente,", 11, false, 'left', 0, 6);
    writeText(propostaForm.assinaturaNome || "Servinave Eng. e Rep. Navais", 11, true, 'left', 0, 1);
    writeText(propostaForm.assinaturaCargo || "Setor Comercial", 11, false, 'left', 0, 10);

    // =========================================================================
    // 4. SALVAR ARQUIVO
    // =========================================================================
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