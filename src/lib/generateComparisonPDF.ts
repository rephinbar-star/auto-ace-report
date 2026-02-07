import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";
import { calculateTCO, calculateMonthlyOwnershipCost } from "@/lib/tco-calculations";
import { scoreAndRankVehicles, getYearFiveEquity } from "@/components/compare/scoring-utils";

type VehicleReport = Tables<"vehicle_reports">;

interface ComparisonPDFData {
  vehicles: VehicleReport[];
  generatedDate?: Date;
}

export async function generateComparisonPDF(data: ComparisonPDFData): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const { vehicles, generatedDate = new Date() } = data;

  // Score vehicles
  const scoredVehicles = scoreAndRankVehicles(vehicles);
  const winner = scoredVehicles[0];

  // Helper functions
  const addText = (text: string, fontSize: number, isBold = false, color: [number, number, number] = [0, 0, 0]) => {
    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", isBold ? "bold" : "normal");
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
    
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
    addText(title, 14, true, [59, 130, 246]);
    yPosition += 2;
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  // Header
  pdf.setFillColor(59, 130, 246);
  pdf.rect(0, 0, pageWidth, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text("CarWise Comparison Report", margin, 20);
  yPosition = 40;

  // Summary
  addText(`Comparing ${vehicles.length} vehicles`, 12, false, [100, 100, 100]);
  yPosition += 5;

  // Winner announcement
  if (winner) {
    pdf.setFillColor(34, 197, 94);
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 3, 3, "F");
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text("🏆 BEST BUY", margin + 5, yPosition + 8);
    
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    const winnerTitle = `${winner.vehicle.year} ${winner.vehicle.make} ${winner.vehicle.model}`;
    pdf.text(winnerTitle, margin + 5, yPosition + 17);
    
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Score: ${winner.totalScore}/100`, pageWidth - margin - 35, yPosition + 15);
    
    yPosition += 35;
  }

  // Vehicle Comparison Table
  addSection("Vehicle Comparison");
  
  // Table headers
  const tableStartY = yPosition;
  const cols = ["Vehicle", "Price", "Mileage", "Deal", "Risk", "Score"];
  const colWidths = [55, 30, 30, 25, 25, 20];
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
  scoredVehicles.forEach((scored, index) => {
    const v = scored.vehicle;
    const isWinner = index === 0;
    
    if (isWinner) {
      pdf.setFillColor(220, 252, 231);
    } else if (index % 2 === 0) {
      pdf.setFillColor(245, 247, 250);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(margin, yPosition - 3, pageWidth - 2 * margin, 8, "F");
    
    xPos = margin;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", isWinner ? "bold" : "normal");
    pdf.setFontSize(9);
    
    const rowData = [
      `${v.year} ${v.make} ${v.model}`.substring(0, 28),
      formatCurrency(Number(v.asking_price)),
      `${v.mileage.toLocaleString()} mi`,
      (v.deal_rating || "fair").charAt(0).toUpperCase() + (v.deal_rating || "fair").slice(1),
      (v.risk_level || "medium").charAt(0).toUpperCase() + (v.risk_level || "medium").slice(1),
      `${scored.totalScore}`,
    ];
    
    rowData.forEach((cell, i) => {
      // Color coding for deal and risk
      if (i === 3) {
        const dealColors: Record<string, [number, number, number]> = {
          Excellent: [34, 197, 94], Good: [16, 185, 129], Fair: [234, 179, 8],
          Poor: [249, 115, 22], Overpriced: [239, 68, 68],
        };
        pdf.setTextColor(...(dealColors[cell] || [0, 0, 0]));
      } else if (i === 4) {
        const riskColors: Record<string, [number, number, number]> = {
          Low: [34, 197, 94], Medium: [234, 179, 8], High: [239, 68, 68],
        };
        pdf.setTextColor(...(riskColors[cell] || [0, 0, 0]));
      } else if (i === 5 && isWinner) {
        pdf.setTextColor(34, 197, 94);
        pdf.setFont("helvetica", "bold");
      } else {
        pdf.setTextColor(0, 0, 0);
      }
      pdf.text(cell, xPos + 2, yPosition + 2);
      xPos += colWidths[i];
    });
    
    yPosition += 8;
  });

  yPosition += 10;

  // TCO Comparison
  addSection("5-Year Total Cost of Ownership");
  
  const tcoTableY = yPosition;
  const tcoCols = ["Vehicle", "Purchase", "Fuel", "Repairs", "Total TCO"];
  const tcoColWidths = [55, 35, 30, 30, 35];
  xPos = margin;
  
  pdf.setFillColor(59, 130, 246);
  pdf.rect(margin, tcoTableY, pageWidth - 2 * margin, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  
  tcoCols.forEach((col, i) => {
    pdf.text(col, xPos + 2, tcoTableY + 5);
    xPos += tcoColWidths[i];
  });
  
  yPosition = tcoTableY + 10;
  
  // Find lowest TCO
  const lowestTCO = Math.min(...scoredVehicles.filter(s => s.tco).map(s => s.tco!.totalTCO));
  
  scoredVehicles.forEach((scored, index) => {
    const v = scored.vehicle;
    const isLowestTCO = scored.tco?.totalTCO === lowestTCO;
    
    if (isLowestTCO) {
      pdf.setFillColor(220, 252, 231);
    } else if (index % 2 === 0) {
      pdf.setFillColor(245, 247, 250);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(margin, yPosition - 3, pageWidth - 2 * margin, 8, "F");
    
    xPos = margin;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    
    const tcoData = [
      `${v.year} ${v.make} ${v.model}`.substring(0, 28),
      formatCurrency(Number(v.asking_price)),
      scored.tco ? formatCurrency(scored.tco.fuelCost5Year) : "—",
      scored.tco ? formatCurrency(scored.tco.repairCost5Year) : "—",
      scored.tco ? formatCurrency(scored.tco.totalTCO) : "—",
    ];
    
    tcoData.forEach((cell, i) => {
      if (i === 4 && isLowestTCO) {
        pdf.setTextColor(34, 197, 94);
        pdf.setFont("helvetica", "bold");
      }
      pdf.text(cell, xPos + 2, yPosition + 2);
      xPos += tcoColWidths[i];
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
    });
    
    yPosition += 8;
  });

  yPosition += 10;

  // Financial Outlook
  addSection("5-Year Financial Outlook");
  
  const finTableY = yPosition;
  const finCols = ["Vehicle", "Year 5 Equity", "Monthly Cost"];
  const finColWidths = [75, 50, 50];
  xPos = margin;
  
  pdf.setFillColor(59, 130, 246);
  pdf.rect(margin, finTableY, pageWidth - 2 * margin, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  
  finCols.forEach((col, i) => {
    pdf.text(col, xPos + 2, finTableY + 5);
    xPos += finColWidths[i];
  });
  
  yPosition = finTableY + 10;
  
  scoredVehicles.forEach((scored, index) => {
    const v = scored.vehicle;
    const equity = getYearFiveEquity(v.depreciation_table);
    const monthlyCost = scored.tco ? calculateMonthlyOwnershipCost(scored.tco) : null;
    
    if (index % 2 === 0) {
      pdf.setFillColor(245, 247, 250);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(margin, yPosition - 3, pageWidth - 2 * margin, 8, "F");
    
    xPos = margin;
    pdf.setFontSize(9);
    
    // Vehicle name
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${v.year} ${v.make} ${v.model}`.substring(0, 35), xPos + 2, yPosition + 2);
    xPos += finColWidths[0];
    
    // Equity
    if (equity !== null) {
      pdf.setTextColor(equity >= 0 ? 34 : 239, equity >= 0 ? 197 : 68, equity >= 0 ? 94 : 68);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${equity >= 0 ? "+" : ""}${formatCurrency(equity)}`, xPos + 2, yPosition + 2);
    } else {
      pdf.setTextColor(100, 100, 100);
      pdf.text("—", xPos + 2, yPosition + 2);
    }
    xPos += finColWidths[1];
    
    // Monthly cost
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    pdf.text(monthlyCost ? `${formatCurrency(monthlyCost)}/mo` : "—", xPos + 2, yPosition + 2);
    
    yPosition += 8;
  });

  yPosition += 10;

  // Score Breakdown for winner
  if (winner) {
    addSection("Best Buy Score Breakdown");
    addText(`${winner.vehicle.year} ${winner.vehicle.make} ${winner.vehicle.model}`, 12, true);
    yPosition += 3;
    
    winner.breakdown.forEach((item) => {
      const pct = Math.round((item.score / item.maxScore) * 100);
      const barWidth = 60;
      const filledWidth = (pct / 100) * barWidth;
      
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${item.category}`, margin, yPosition);
      
      // Progress bar background
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin + 45, yPosition - 3, barWidth, 4, "F");
      
      // Progress bar fill
      const barColor: [number, number, number] = pct >= 70 ? [34, 197, 94] : pct >= 40 ? [234, 179, 8] : [239, 68, 68];
      pdf.setFillColor(...barColor);
      pdf.rect(margin + 45, yPosition - 3, filledWidth, 4, "F");
      
      // Score text
      pdf.text(`${item.score}/${item.maxScore}`, margin + 110, yPosition);
      
      yPosition += 7;
    });
  }

  // Footer
  const footerY = pageHeight - 10;
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generated by CarWise on ${generatedDate.toLocaleDateString()}`, margin, footerY);
  pdf.text("www.carwise.com", pageWidth - margin - 30, footerY);

  // Save
  const vehicleNames = vehicles.slice(0, 2).map(v => `${v.year}_${v.make}`).join("_vs_");
  const fileName = `CarWise_Comparison_${vehicleNames}.pdf`;
  pdf.save(fileName);
}
