
import { AppState, DocumentType } from '../types';
import { MEMO_LEGAL_TEXT, REPORT_LOGISTICS_ITEMS, REPORT_VEHICLE_ITEMS, OCCURRENCE_CODES } from '../constants';

const { jsPDF } = window.jspdf;

const addCbmpaHeader = (doc: any, isLandscape = false) => {
  const centerX = isLandscape ? 148.5 : 105;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(isLandscape ? 10 : 11);
  doc.setTextColor(0, 0, 0);
  doc.text("CORPO DE BOMBEIROS MILITAR DO PARÁ E", centerX, 15, { align: "center" });
  doc.text("COORDENADORIA ESTADUAL DE DEFESA CIVIL", centerX, 20, { align: "center" });
  doc.text("COMANDO OPERACIONAL", centerX, 25, { align: "center" });
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    return `${months[parseInt(parts[1]) - 1]}/${parts[0]}`;
  }
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.toLowerCase().split(' ').map((word, index) => {
    if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
    if (['ii', 'iii', 'iv'].includes(word)) return word.toUpperCase();
    if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

const drawSignatureWithBoldHighlight = (doc: any, name: string, warName: string, rank: string, x: number, y: number) => {
  const rankUpper = rank.toUpperCase();
  const nameTitleCase = toTitleCase(name.trim());
  const warNameClean = warName.trim().replace(/\./g, '');
  
  const fullWords = nameTitleCase.split(' ');
  const warTokens = warNameClean.toLowerCase().split(' ');

  let segments: { text: string, bold: boolean }[] = [];

  fullWords.forEach((word, index) => {
    if (index > 0) segments.push({ text: " ", bold: false });
    const lowerWord = word.toLowerCase();
    const matchingToken = warTokens.find(token => {
      if (token === lowerWord) return true;
      if (token.length === 1 && lowerWord.startsWith(token)) return true;
      return false;
    });

    if (matchingToken) {
      if (matchingToken.length === 1 && lowerWord.length > 1) {
        segments.push({ text: word.charAt(0), bold: true });
        segments.push({ text: word.slice(1), bold: false });
      } else {
        segments.push({ text: word, bold: true });
      }
    } else {
      segments.push({ text: word, bold: false });
    }
  });

  segments.push({ text: " – ", bold: false });
  segments.push({ text: rankUpper, bold: true });

  doc.setFontSize(11);
  let totalWidth = 0;
  segments.forEach(seg => {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    totalWidth += doc.getTextWidth(seg.text);
  });

  let currentX = x - (totalWidth / 2);
  segments.forEach(seg => {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    doc.text(seg.text, currentX, y);
    currentX += doc.getTextWidth(seg.text);
  });
};

export const generatePDF = (state: AppState) => {
  const { formData } = state;
  const today = new Date();
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dateString = `${today.getDate()} DE ${months[today.getMonth()]} DE ${today.getFullYear()}`;

  if (state.currentDoc === DocumentType.MEMO) {
    const doc = new jsPDF();
    addCbmpaHeader(doc);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const startY = 45;
    const leftMargin = 25;
    const recipientLine = `Ao Srº ${formData.recipient || ''}`;
    doc.text(recipientLine, leftMargin, startY);
    doc.text("Comandante Operacional do CBMPA", leftMargin, startY + 5);
    doc.text("Assunto: Solicitação de Pagamento de Jornada Op. Extraordinária", leftMargin, startY + 15);
    doc.text("Anexo:", leftMargin, startY + 25);
    doc.text("    Relatório de prevenção", leftMargin, startY + 30);
    doc.text("    Planilha de pagamento", leftMargin, startY + 35);
    doc.text("    Escala de serviço", leftMargin, startY + 40);
    doc.text(`    NS ${formData.memoNs || '_____'} – SEOP/COP`, leftMargin, startY + 45);
    doc.text(`    BG de publicação Nº ${formData.memoBg || '_____'}`, leftMargin, startY + 50);
    doc.text("Senhor Comandante,", leftMargin, startY + 70);
    const legalText = MEMO_LEGAL_TEXT
      .replace('{{DATA}}', formData.memoEventDates || '________')
      .replace('{{NS}}', formData.memoNs || '_____')
      .replace('{{BG}}', formData.memoBg || '_____');
    const splitBody = doc.splitTextToSize(legalText, 160);
    doc.text(splitBody, leftMargin, startY + 80, { align: "justify", maxWidth: 160 });
    const endOfTextY = startY + 80 + (splitBody.length * 5);
    doc.text("Respeitosamente,", leftMargin, endOfTextY + 15);
    const sigY = endOfTextY + 50;
    
    drawSignatureWithBoldHighlight(doc, formData.issuerName, formData.issuerWarName, formData.issuerRank, 105, sigY);
    doc.setFont("helvetica", "normal");
    doc.text("Comandante da Prevenção", 105, sigY + 5, { align: "center" });
    window.open(doc.output('bloburl'), '_blank');
  }

  else if (state.currentDoc === DocumentType.COST_SHEET) {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    const aggregatedMap = new Map();
    formData.costSheetItems.forEach(item => {
      const key = item.soldierMatricula;
      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, {
          ...item,
          datesList: item.datesList && item.datesList.length > 0 ? [...item.datesList] : (item.date ? [item.date] : []),
          qtyDiversos: item.serviceType === 'DIVERSOS' ? item.quantity : 0,
          qtyPrev: item.serviceType === 'PREVENCAO' ? item.quantity : 0,
          qtyGV: item.serviceType === 'GUARDA_VIDAS' ? item.quantity : 0,
          qtyCorte: item.serviceType === 'CORTE_VEGETAL' ? item.quantity : 0,
          totalQty: item.quantity
        });
      } else {
        const existing = aggregatedMap.get(key);
        const newDates = item.datesList && item.datesList.length > 0 ? item.datesList : (item.date ? [item.date] : []);
        existing.datesList = [...new Set([...existing.datesList, ...newDates])];
        if (item.serviceType === 'DIVERSOS') existing.qtyDiversos += item.quantity;
        if (item.serviceType === 'PREVENCAO') existing.qtyPrev += item.quantity;
        if (item.serviceType === 'GUARDA_VIDAS') existing.qtyGV += item.quantity;
        if (item.serviceType === 'CORTE_VEGETAL') existing.qtyCorte += item.quantity;
        existing.totalQty += item.quantity;
        if (item.isCommander) existing.isCommander = true;
      }
    });

    const aggregatedItems = Array.from(aggregatedMap.values());
    const tableRows = aggregatedItems.map((item, index) => {
      const totalVal = item.totalQty * item.unitValue;
      let dateDisplay = item.datesList ? item.datesList.sort().map((d: string) => formatDate(d)).join('\n') : '-';
      return [
        (index + 1).toString(), item.soldierMatricula, item.soldierRank.toUpperCase(), item.soldierName, item.soldierUbm, item.totalQty.toString(),
        dateDisplay, item.qtyDiversos.toString(), item.qtyPrev.toString(), item.qtyGV.toString(), item.qtyCorte.toString(), formatCurrency(item.unitValue), formatCurrency(totalVal)
      ];
    });

    const totalQty = formData.costSheetItems.reduce((acc, i) => acc + Number(i.quantity), 0);
    const totalVal = formData.costSheetItems.reduce((acc, i) => acc + (i.quantity * i.unitValue), 0);
    const totalDiversosVal = formData.costSheetItems.filter(i => i.serviceType === 'DIVERSOS').reduce((a, b) => a + (b.unitValue * b.quantity), 0);
    const totalPrevVal = formData.costSheetItems.filter(i => i.serviceType === 'PREVENCAO').reduce((a, b) => a + (b.unitValue * b.quantity), 0);
    const totalGvVal = formData.costSheetItems.filter(i => i.serviceType === 'GUARDA_VIDAS').reduce((a, b) => a + (b.unitValue * b.quantity), 0);
    const totalCorteVal = formData.costSheetItems.filter(i => i.serviceType === 'CORTE_VEGETAL').reduce((a, b) => a + (b.unitValue * b.quantity), 0);

    const firstPageSize = 12; // Limite na 1ª página com cabeçalho
    const nextPagesSize = 22; // Limite nas demais páginas sem cabeçalho
    
    let startIdx = 0;
    let pageNum = 0;

    while (startIdx < tableRows.length) {
      if (pageNum > 0) doc.addPage();
      
      const isFirstPage = pageNum === 0;
      const currentChunkSize = isFirstPage ? firstPageSize : nextPagesSize;
      const currentChunk = tableRows.slice(startIdx, startIdx + currentChunkSize);
      startIdx += currentChunkSize;
      
      const isLastChunk = startIdx >= tableRows.length;

      let tableStartY = 15;
      if (isFirstPage) {
        addCbmpaHeader(doc, true);
        doc.setFillColor(230, 230, 230);
        doc.rect(10, 30, 277, 12, 'F'); 
        doc.setDrawColor(0);
        doc.rect(10, 30, 277, 12);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("RELAÇÃO DOS BOMBEIROS MILITARES DO SERVIÇO DE COMPLENTAÇÃO DE JORNADA OPERACIONAL LEI Nº 6.830 DE 13 DE FEVEREIRO DE 2006", 148.5, 35, { align: "center", maxWidth: 270 });
        doc.setFillColor(230, 230, 230);
        doc.rect(10, 42, 277, 8, 'F');
        doc.rect(10, 42, 277, 8);
        doc.text(`${formData.operationName || 'OPERAÇÃO'} - NS Nº ${formData.memoNs || '____'}`, 148.5, 47, { align: "center" });
        tableStartY = 50;
      }

      if (isLastChunk) {
        currentChunk.push(['', '', 'TOTAL DE JORNADAS EXTRAORDINARIAS', '', '', totalQty.toString(), '', '', '', '', '', '', formatCurrency(totalVal)]);
      }

      doc.autoTable({
        startY: tableStartY,
        head: [[
          { content: 'SERVIÇOS COP', colSpan: 6, styles: { halign: 'center' } },
          { content: 'TIPOS DE SERVIÇO E DIAS TRABALHADOS', colSpan: 6, styles: { halign: 'center' } },
          { content: '', colSpan: 1 }
        ], [
          'ORD', 'MF', 'POSTO GRADUAÇÃO', 'NOME DO MILITAR', 'UBM', 'QTD', 
          'DATA', 'SERVIÇOS\nDIVERSOS', 'PREVENÇÃO\nDESPORTIVA', 'GUARDA\nVIDAS', 'CORTE\nVEGETAL', 
          'VALOR\nUNITÁRIO', 'VALOR\nTOTAL'
        ]],
        body: currentChunk,
        theme: 'grid',
        styles: { fontSize: 7, halign: 'center', valign: 'middle', cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: 0 },
        headStyles: { fillColor: [255, 255, 0], textColor: 0, fontStyle: 'bold', lineColor: 0 },
        columnStyles: { 3: { halign: 'left', cellWidth: 70 } },
        margin: { left: 10, right: 10 }
      });

      if (isLastChunk) {
        const finalTableY = doc.lastAutoTable.finalY + 5;
        doc.autoTable({
          startY: finalTableY,
          head: [
            [{ content: 'QUANTIDADE E TIPO DE SERVIÇO', colSpan: 5, styles: { halign: 'center' } }, { content: '', colSpan: 1 }],
            ['SERVIÇOS DIVERSOS', 'PREVENÇÃO DESPORTIVA', 'GUARDA VIDAS', 'CORTE DE VEGETAL', 'TOTAL DA PLANILHA']
          ],
          body: [
            [formatCurrency(totalDiversosVal), formatCurrency(totalPrevVal), formatCurrency(totalGvVal), formatCurrency(totalCorteVal), formatCurrency(totalVal)],
            [
              totalVal > 0 ? (totalDiversosVal/totalVal * 100).toFixed(2) + '%' : '0%',
              totalVal > 0 ? (totalPrevVal/totalVal * 100).toFixed(2) + '%' : '0%',
              totalVal > 0 ? (totalGvVal/totalVal * 100).toFixed(2) + '%' : '0%',
              totalVal > 0 ? (totalCorteVal/totalVal * 100).toFixed(2) + '%' : '0%',
              "100%"
            ]
          ],
          theme: 'grid',
          styles: { fontSize: 7, halign: 'center', fontStyle: 'bold', lineColor: 0, textColor: 0 },
          headStyles: { fillColor: [255, 255, 0], textColor: 0 },
          margin: { left: 10, right: 10 },
          tableWidth: 'wrap'
        });

        const summaryTableY = doc.lastAutoTable.finalY;
        const commander = formData.costSheetItems.find(i => i.isCommander);
        const cmtName = commander ? commander.soldierName : formData.issuerName;
        const cmtWarName = formData.issuerWarName;
        const cmtRank = commander ? commander.soldierRank : formData.issuerRank;

        doc.setFillColor(255, 255, 0);
        doc.rect(10, summaryTableY, 277, 8, 'F');
        doc.rect(10, summaryTableY, 277, 8);
        doc.setFontSize(9);
        doc.text("CUSTO TOTAL", 40, summaryTableY + 5);
        doc.text(formatCurrency(totalVal), 250, summaryTableY + 5, { align: "right" });
        
        const dateY = summaryTableY + 14; 
        doc.setFontSize(8);
        doc.text(`BELÉM-PA, ${dateString.toUpperCase()}`, 280, dateY, { align: "right" });
        
        const signatureY = dateY + 20; 
        drawSignatureWithBoldHighlight(doc, cmtName, cmtWarName, cmtRank, 148.5, signatureY);
        doc.setFont("helvetica", "normal");
        doc.text("COMANDANTE DA PREVENÇÃO", 148.5, signatureY + 4, { align: "center" });
      }
      pageNum++;
    }
    window.open(doc.output('bloburl'), '_blank');
  }

  else if (state.currentDoc === DocumentType.REPORT) {
    const doc = new jsPDF();
    addCbmpaHeader(doc);
    
    const effList = formData.reportEffectiveItems || [];
    const counts = {
      f: effList.filter(i => i.status === 'F').length,
      pa: effList.filter(i => i.status === 'P/A').length,
      d: effList.filter(i => i.status === 'D').length,
      a: effList.filter(i => i.status === 'A').length,
      total: effList.length
    };

    doc.setFillColor(255, 255, 0);
    doc.rect(10, 32, 190, 10, 'F');
    doc.setDrawColor(0);
    doc.rect(10, 32, 190, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RELATÓRIO DE PREVENÇÃO – JORNADA OPERACIONAL EXTRAORDINÁRIA", 105, 38.5, { align: "center" });

    let currentY = 45;
    const drawSectionHeader = (title: string, y: number, width = 190, x = 10) => {
      doc.setFillColor(220, 220, 220);
      doc.rect(x, y, width, 6, 'F');
      doc.rect(x, y, width, 6);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(title, x + (width / 2), y + 4.5, { align: "center" });
      return y + 6;
    };
    const drawGridRow = (y: number, height: number, cols: { width: number, label: string, value: string }[]) => {
      let currentX = 10;
      doc.setFontSize(8);
      cols.forEach((col) => {
         doc.setDrawColor(0);
         doc.rect(currentX, y, col.width, height);
         doc.setFont("helvetica", "bold");
         doc.text(col.label, currentX + 2, y + 4);
         doc.setFont("helvetica", "normal");
         const labelWidth = doc.getTextWidth(col.label);
         doc.text(col.value || "", currentX + 2 + labelWidth + 2, y + 4);
         currentX += col.width;
      });
      return y + height;
    };

    currentY = drawSectionHeader("1. DADOS INICIAIS", currentY);
    currentY = drawGridRow(currentY, 7, [{ width: 190, label: "NOME DO EVENTO:", value: formData.eventName }]);
    currentY = drawGridRow(currentY, 7, [
        { width: 140, label: "CMT. DA PREVENÇÃO:", value: `${formData.issuerRank.toUpperCase()} ${formData.issuerName}` },
        { width: 50, label: "UBM:", value: formData.issuerUbm }
    ]);
    currentY = drawGridRow(currentY, 7, [{ width: 190, label: "LOCAL DO EVENTO:", value: formData.eventLocal }]);
    currentY = drawGridRow(currentY, 7, [
        { width: 95, label: "DATA DO EVENTO:", value: formatDate(formData.eventDate) },
        { width: 95, label: "DIA DA SEMANA:", value: formData.eventDayOfWeek }
    ]);
    currentY = drawGridRow(currentY, 7, [{ width: 190, label: "HORÁRIO NO EVENTO:", value: `${formData.eventStartTime} AS ${formData.eventEndTime}` }]);
    currentY = drawGridRow(currentY, 7, [
        { width: 95, label: "TOTAL EFETIVO:", value: `${counts.total} BM's` }, 
        { width: 95, label: "REFERÊNCIA:", value: `NS Nº ${formData.memoNs}` }
    ]);
    currentY = drawGridRow(currentY, 7, [{ width: 190, label: "", value: `Nº FALTAS: (${counts.f}) - Nº PERMUTA: (${counts.pa}) - Nº DISPENSA: (${counts.d}) - Nº ATRASO: (${counts.a})` }]);
    currentY = drawGridRow(currentY, 7, [
        { width: 95, label: "MÉDIA ESTIMADA DE PÚBLICO:", value: formData.eventPublicEstimate },
        { width: 95, label: "Nº SISCOB:", value: formData.siscobNumber }
    ]);
    currentY = drawGridRow(currentY, 7, [{ width: 190, label: "ANEXOS:", value: "ESCALA GERAL/CÓPIA DA NOTA/ ORDEM DE SERVIÇO." }]);
    currentY += 2;

    currentY = drawSectionHeader("2. ALTERAÇÕES NO EFETIVO EMPREGADO - SIM ( ) NÃO ( )", currentY);
    doc.autoTable({
      startY: currentY,
      head: [['ORD', 'POST/GRAD', 'NOME GUERRA DO MILITAR', 'UBM', 'MF (OBRIGATÓRIO)', 'P', 'F', 'D', 'P/A', 'A']],
      body: formData.reportEffectiveItems.map((item, i) => [
        (i+1).toString(), item.soldierRank, item.soldierName, item.soldierUbm, item.soldierMf,
        item.status === 'P' ? 'X' : '', item.status === 'F' ? 'X' : '', item.status === 'D' ? 'X' : '', item.status === 'P/A' ? 'X' : '', item.status === 'A' ? 'X' : '']
      ),
      theme: 'grid',
      styles: { fontSize: 7, halign: 'center', lineColor: 0, textColor: 0 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0 },
      margin: { left: 10, right: 10 },
    });
    currentY = doc.lastAutoTable.finalY + 1;
    doc.setFontSize(6);
    doc.text("LEGENDA: P(PRESENÇA) - F(FALTA) - D(DISPENSA) - P/A(PERMUTA/AUTORIZAÇÃO) - A(ATRASO)", 10, currentY + 2);
    currentY += 4;

    currentY = drawSectionHeader("3. ALTERAÇÕES NO SERVIÇO - SIM ( ) NÃO ( )", currentY);
    doc.autoTable({
      startY: currentY,
      head: [['ORD', 'NOME', 'ID', 'SEXO (M)(F)', 'ILS', 'FD', 'FTL', 'CÓDIGO']],
      body: formData.reportServiceItems.map((item, i) => [
        (i+1).toString(), item.name, item.age, item.sex,
        item.condition === 'ILS' ? 'X' : '', item.condition === 'FD' ? 'X' : '', item.condition === 'FTL' ? 'X' : '', item.code
      ]),
      theme: 'grid',
      styles: { fontSize: 7, halign: 'center', lineColor: 0, textColor: 0 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0 },
      margin: { left: 10, right: 10 },
    });
    currentY = doc.lastAutoTable.finalY + 2;
    doc.setFontSize(6);
    const codesText = OCCURRENCE_CODES.map(c => `${c.code}-${c.desc}`).join(' - ');
    const splitCodes = doc.splitTextToSize("CÓDIGO OCORRÊNCIAS: " + codesText, 190);
    doc.text(splitCodes, 10, currentY + 2);
    currentY += (splitCodes.length * 3) + 2;

    if (currentY > 200) { doc.addPage(); currentY = 20; }

    currentY = drawSectionHeader("4. APOIO LOGÍSTICO - SIM ( ) NÃO ( )", currentY);
    const allLogItems = [...REPORT_LOGISTICS_ITEMS];
    if (formData.reportOtherLogistics) allLogItems.push('OUTROS: ' + formData.reportOtherLogistics);
    const halfLen = Math.ceil(allLogItems.length / 2);
    const logRows = [];
    for (let i = 0; i < halfLen; i++) {
        const leftItem = allLogItems[i];
        const rightItem = allLogItems[i + halfLen];
        const row = [];
        const leftData = formData.reportLogistics[leftItem] || { used: false, qty: '' };
        if (leftItem && leftItem.startsWith('OUTROS')) { leftData.used = true; leftData.qty = '1'; }
        row.push(leftItem); row.push(leftData.used ? 'X' : ''); row.push(!leftData.used ? 'X' : ''); row.push(leftData.qty);
        if (rightItem) {
            const rightData = formData.reportLogistics[rightItem] || { used: false, qty: '' };
            if (rightItem.startsWith('OUTROS')) { rightData.used = true; rightData.qty = '1'; }
            row.push(rightItem); row.push(rightData.used ? 'X' : ''); row.push(!rightData.used ? 'X' : ''); row.push(rightData.qty);
        } else { row.push('', '', '', ''); }
        logRows.push(row);
    }

    doc.autoTable({
      startY: currentY,
      head: [['MATERIAL', 'S', 'N', 'QTD', 'MATERIAL', 'S', 'N', 'QTD']],
      body: logRows,
      theme: 'grid',
      styles: { fontSize: 7, halign: 'center', lineColor: 0, textColor: 0, cellPadding: 1 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0 },
      columnStyles: { 0: { halign: 'left', cellWidth: 40 }, 4: { halign: 'left', cellWidth: 40 } },
      margin: { left: 10, right: 10 },
    });
    currentY = doc.lastAutoTable.finalY + 1;
    doc.setFontSize(6);
    doc.text("LEGENDA: S -SIM / N - NÃO / QTD - QUANTIDADE", 10, currentY + 2);
    currentY += 4;

    if (currentY > 230) { doc.addPage(); currentY = 20; }
    currentY = drawSectionHeader("5. VIATURAS/EMBARCAÇÕES E AERONAVES - SIM ( ) NÃO ( )", currentY);
    const allVtrItems = [...REPORT_VEHICLE_ITEMS];
    if (formData.reportOtherVehicles) allVtrItems.push('OUTROS: ' + formData.reportOtherVehicles);
    const halfVtrLen = Math.ceil(allVtrItems.length / 2);
    const vtrRows = [];
    for (let i = 0; i < halfVtrLen; i++) {
        const leftItem = allVtrItems[i];
        const rightItem = allVtrItems[i + halfVtrLen];
        const row = [];
        const leftData = formData.reportVehicles[leftItem] || { used: false, qty: '', origin: '' };
        if (leftItem && leftItem.startsWith('OUTROS')) { leftData.used = true; leftData.qty = '1'; }
        row.push(leftItem); row.push(leftData.used ? 'X' : ''); row.push(!leftData.used ? 'X' : ''); row.push(leftData.qty); row.push(leftData.origin);
        if (rightItem) {
            const rightData = formData.reportVehicles[rightItem] || { used: false, qty: '', origin: '' };
            if (rightItem.startsWith('OUTROS')) { rightData.used = true; rightData.qty = '1'; }
            row.push(rightItem); row.push(rightData.used ? 'X' : ''); row.push(!rightData.used ? 'X' : ''); row.push(rightData.qty); row.push(rightData.origin);
        } else { row.push('', '', '', '', ''); }
        vtrRows.push(row);
    }
    
    doc.autoTable({
      startY: currentY,
      head: [['MATERIAL', 'S', 'N', 'QTD', 'ORIGEM', 'MATERIAL', 'S', 'N', 'QTD', 'ORIGEM']],
      body: vtrRows,
      theme: 'grid',
      styles: { fontSize: 6, halign: 'center', lineColor: 0, textColor: 0, cellPadding: 1 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0 },
      columnStyles: { 0: { halign: 'left', cellWidth: 35 }, 4: { halign: 'left', cellWidth: 15 }, 5: { halign: 'left', cellWidth: 35 }, 9: { halign: 'left', cellWidth: 15 } },
      margin: { left: 10, right: 10 },
    });
    currentY = doc.lastAutoTable.finalY + 4;

    if (currentY > 230) { doc.addPage(); currentY = 20; }
    currentY = drawSectionHeader("6. CONSIDERAÇÕES DO SERVIÇO", currentY);
    doc.setDrawColor(0);
    const sec6StartY = currentY; // Guarda a posição inicial para desenhar a borda externa no final
    doc.setFontSize(8);
    
    // Função auxiliar para criar as linhas dinâmicas moldando-se ao tamanho do texto
    const drawDynamicFieldRow = (label: string, text: string, textX: number, maxWidth: number, drawLineBelow = true) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 12, currentY + 5);
      doc.setFont("helvetica", "normal");
      
      const safeText = text || '';
      const splitText = doc.splitTextToSize(safeText, maxWidth);
      
      // Renderiza texto justificado
      doc.text(splitText, textX, currentY + 5, { align: "justify", maxWidth: maxWidth });
      
      // Calcula a altura do bloco baseado na quantidade de linhas (aprox. 4 unidades por linha)
      const blockHeight = Math.max(5, splitText.length * 4);
      currentY += blockHeight + 3; // +3 de respiro/padding
      
      if (drawLineBelow) {
          doc.line(10, currentY, 200, currentY);
      }
    };

    // 1. PONTOS POSITIVOS
    const positiveText = `SIM (${formData.reportPositive.has ? 'X' : ' '}) NÃO (${!formData.reportPositive.has ? 'X' : ' '}) - SE SIM, QUAIS: ${formData.reportPositive.text}`;
    drawDynamicFieldRow("PONTOS POSITIVO:", positiveText, 50, 145, false);
    
    // 2. PONTOS NEGATIVOS (Desenhamos uma linha simples de separação antes)
    const negativeText = `SIM (${formData.reportNegative.has ? 'X' : ' '}) NÃO (${!formData.reportNegative.has ? 'X' : ' '}) - SE SIM, QUAIS: ${formData.reportNegative.text}`;
    drawDynamicFieldRow("PONTOS NEGATIVO:", negativeText, 50, 145, true);

    // 3. QUADRO DE ATIVIDADES
    doc.setFont("helvetica", "bold");
    doc.text("QUADRO DE ATIVIDADES SERVIÇO:", 12, currentY + 5);
    doc.setFont("helvetica", "normal");
    const activitiesText = formData.reportActivities || '';
    const splitActivities = doc.splitTextToSize(activitiesText, 185);
    doc.text(splitActivities, 12, currentY + 9, { align: "justify", maxWidth: 185 });
    currentY += 9 + (splitActivities.length * 4);
    doc.line(10, currentY, 200, currentY);

    // 4. SERVIÇOS DE PREVENTIVO
    drawDynamicFieldRow("SERVIÇOS DE PREVENTIVO DE ORIENTAÇÃO E ADVERTÊNCIA:", formData.reportGuidance || '', 110, 85, true);

    // 5. DISTRIBUIÇÃO DO EFETIVO
    drawDynamicFieldRow("DISTRIBUIÇÃO DO EFETIVO:", formData.reportDistribution || '', 60, 135, true);

    // 6. SUGESTÕES
    drawDynamicFieldRow("SUGESTÕES:", formData.reportSuggestions || '', 40, 155, false);

    // Desenha o quadrado em volta de toda a Seção 6 com a altura total dinâmica calculada
    doc.rect(10, sec6StartY, 190, currentY - sec6StartY);

    currentY += 5; // Margem para a seção 7

    // 7. CONSIDERAÇÕES FINAIS
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    currentY = drawSectionHeader("7. CONSIDERAÇÕES FINAIS", currentY);
    
    const finalConsiderations = formData.reportFinalConsiderations || 'NADA A DECLARAR';
    const splitFinal = doc.splitTextToSize(finalConsiderations, 185);
    
    // Calcula a altura da caixa moldando ao tamanho do texto (mínimo de 25)
    const boxHeight = Math.max(25, (splitFinal.length * 4) + 6);
    doc.rect(10, currentY, 190, boxHeight);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    // Texto Justificado
    doc.text(splitFinal, 12, currentY + 5, { align: "justify", maxWidth: 185 });
    
    currentY += boxHeight + 5;
    
    if (currentY > 230) { doc.addPage(); currentY = 40; }
    doc.setFontSize(9);
    doc.text(`BELÉM – PA, ${dateString}`, 190, currentY, { align: "right" });
    currentY += 50; 
    drawSignatureWithBoldHighlight(doc, formData.issuerName, formData.issuerWarName, formData.issuerRank, 105, currentY);
    doc.setFont("helvetica", "normal");
    doc.text("CMT DA OPERAÇÃO/EXTRAORDINÁRIA", 105, currentY + 5, { align: "center" });

    window.open(doc.output('bloburl'), '_blank');
  }
};
