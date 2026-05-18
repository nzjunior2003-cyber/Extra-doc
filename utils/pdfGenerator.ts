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

    const firstPageSize = 12; 
    const nextPagesSize = 22; 
    
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
        drawSignatureWithBoldHighlight(doc, cmtName, cmtWarName, cmtRank, 148.5, signatureY