import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface VehicleData {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  askingPrice: number;
}

interface PriceAssessment {
  fairMarketPrivate: number;
  fairMarketTradeIn: number;
  dealRating: string;
  priceDifference: number;
}

interface RiskAssessment {
  level: string;
  fairOfferPrice: number;
  expertOpinion: string;
  depreciationRisk: string;
  reliabilityConcerns: string[];
}

interface HistoryAnalysis {
  healthScore: number;
  positives: string[];
  concerns: string[];
}

interface DepreciationRow {
  year: number;
  privateValue: number;
  tradeInValue: number;
  loanBalance: number;
  repairCosts: number;
}

interface ReportData {
  vehicle: VehicleData;
  priceAssessment: PriceAssessment;
  riskAssessment: RiskAssessment;
  historyAnalysis: HistoryAnalysis;
  depreciationTable: DepreciationRow[];
}

export async function generateReportPDF(
  data: ReportData,
  elementId?: string
): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const { vehicle, priceAssessment, riskAssessment, historyAnalysis, depreciationTable } = data;

  // Helper functions
  const addText = (text: string, fontSize: number, isBold = false, color: [number, number, number] = [0, 0, 0]) => {
    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", isBold ? "bold" : "normal");
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
    
    // Check if we need a new page
    const lineHeight = fontSize * 0.4;
    if (yPosition + lines.length * lineHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
    
    pdf.text(lines, margin, yPosition);
    yPosition += lines.length * lineHeight + 2;
  };

  const addSection = (title: string) => {
    yPosition += 5;
    addText(title, 14, true, [59, 130, 246]); // Primary blue color
    yPosition += 2;
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  // Header
  pdf.setFillColor(59, 130, 246);
  pdf.rect(0, 0, pageWidth, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text("CarWise Vehicle Report", margin, 20);
  yPosition = 40;

  // Vehicle Info
  addText(`${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`, 18, true);
  addText(`${vehicle.mileage.toLocaleString()} miles • Asking ${formatCurrency(vehicle.askingPrice)}`, 11, false, [100, 100, 100]);
  yPosition += 5;

  // Quick Stats Box
  pdf.setFillColor(245, 247, 250);
  pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 30, 3, 3, "F");
  
  const statsY = yPosition + 12;
  const colWidth = (pageWidth - 2 * margin) / 4;
  
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text("Fair Market", margin + 5, statsY);
  pdf.text("Deal Rating", margin + colWidth + 5, statsY);
  pdf.text("Risk Level", margin + colWidth * 2 + 5, statsY);
  pdf.text("Fair Offer", margin + colWidth * 3 + 5, statsY);
  
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text(formatCurrency(priceAssessment.fairMarketPrivate), margin + 5, statsY + 8);
  
  // Deal rating color
  const ratingColors: Record<string, [number, number, number]> = {
    excellent: [34, 197, 94],
    good: [16, 185, 129],
    fair: [234, 179, 8],
    poor: [249, 115, 22],
    overpriced: [239, 68, 68],
  };
  pdf.setTextColor(...(ratingColors[priceAssessment.dealRating] || [0, 0, 0]));
  pdf.text(priceAssessment.dealRating.charAt(0).toUpperCase() + priceAssessment.dealRating.slice(1), margin + colWidth + 5, statsY + 8);
  
  // Risk level color
  const riskColors: Record<string, [number, number, number]> = {
    low: [34, 197, 94],
    medium: [234, 179, 8],
    high: [239, 68, 68],
  };
  pdf.setTextColor(...(riskColors[riskAssessment.level] || [0, 0, 0]));
  pdf.text(riskAssessment.level.charAt(0).toUpperCase() + riskAssessment.level.slice(1), margin + colWidth * 2 + 5, statsY + 8);
  
  pdf.setTextColor(34, 197, 94);
  pdf.text(formatCurrency(riskAssessment.fairOfferPrice), margin + colWidth * 3 + 5, statsY + 8);
  
  yPosition += 40;

  // Price Assessment
  addSection("Price Assessment");
  pdf.setTextColor(0, 0, 0);
  addText(`Asking Price: ${formatCurrency(vehicle.askingPrice)}`, 11);
  const diffColor: [number, number, number] = priceAssessment.priceDifference > 0 ? [239, 68, 68] : [34, 197, 94];
  addText(`vs Fair Market: ${priceAssessment.priceDifference > 0 ? "+" : ""}${formatCurrency(priceAssessment.priceDifference)}`, 11, false, diffColor);
  addText(`Private Sale Value: ${formatCurrency(priceAssessment.fairMarketPrivate)}`, 11);
  addText(`Trade-In Value: ${formatCurrency(priceAssessment.fairMarketTradeIn)}`, 11);

  // Vehicle Health
  addSection("Vehicle Health Score");
  addText(`Score: ${historyAnalysis.healthScore}/100`, 12, true);
  
  addText("Positives:", 11, true, [34, 197, 94]);
  historyAnalysis.positives.forEach((item) => {
    addText(`• ${item}`, 10);
  });
  
  addText("Concerns:", 11, true, [239, 68, 68]);
  historyAnalysis.concerns.forEach((item) => {
    addText(`• ${item}`, 10);
  });

  // Risk Assessment
  addSection("Risk Assessment");
  addText("Depreciation Risk:", 11, true);
  addText(riskAssessment.depreciationRisk, 10, false, [80, 80, 80]);
  
  addText("Reliability Concerns:", 11, true);
  riskAssessment.reliabilityConcerns.forEach((concern) => {
    addText(`• ${concern}`, 10);
  });

  // Depreciation Table
  pdf.addPage();
  yPosition = margin;
  addSection("5-Year Depreciation Forecast");
  
  // Table header
  const tableStartY = yPosition;
  const cols = ["Year", "Private Value", "Trade-In", "Loan Balance", "Repairs", "Net Equity"];
  const colWidths = [20, 35, 30, 35, 25, 30];
  let xPos = margin;
  
  pdf.setFillColor(59, 130, 246);
  pdf.rect(margin, tableStartY, pageWidth - 2 * margin, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  
  cols.forEach((col, i) => {
    pdf.text(col, xPos + 2, tableStartY + 5);
    xPos += colWidths[i];
  });
  
  yPosition = tableStartY + 10;
  
  // Table rows
  let cumulativeRepairs = 0;
  depreciationTable.forEach((row, index) => {
    cumulativeRepairs += row.repairCosts;
    const netEquity = row.tradeInValue - row.loanBalance - cumulativeRepairs;
    
    if (index % 2 === 0) {
      pdf.setFillColor(245, 247, 250);
      pdf.rect(margin, yPosition - 3, pageWidth - 2 * margin, 7, "F");
    }
    
    xPos = margin;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    
    const rowData = [
      `Year ${row.year}`,
      formatCurrency(row.privateValue),
      formatCurrency(row.tradeInValue),
      formatCurrency(row.loanBalance),
      formatCurrency(cumulativeRepairs),
      `${netEquity >= 0 ? "+" : ""}${formatCurrency(netEquity)}`,
    ];
    
    rowData.forEach((cell, i) => {
      if (i === 5) {
        pdf.setTextColor(netEquity >= 0 ? 34 : 239, netEquity >= 0 ? 197 : 68, netEquity >= 0 ? 94 : 68);
        pdf.setFont("helvetica", "bold");
      }
      pdf.text(cell, xPos + 2, yPosition);
      xPos += colWidths[i];
    });
    
    yPosition += 7;
  });

  // Expert Opinion
  yPosition += 10;
  addSection("Expert Opinion");
  pdf.setTextColor(80, 80, 80);
  addText(riskAssessment.expertOpinion, 10);

  // Footer
  const footerY = pageHeight - 10;
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generated by CarWise on ${new Date().toLocaleDateString()}`, margin, footerY);
  pdf.text("www.carwise.com", pageWidth - margin - 30, footerY);

  // Save the PDF
  const fileName = `CarWise_Report_${vehicle.year}_${vehicle.make}_${vehicle.model}.pdf`;
  pdf.save(fileName);
}

// Alternative: Generate PDF from HTML element
export async function generatePDFFromElement(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}
