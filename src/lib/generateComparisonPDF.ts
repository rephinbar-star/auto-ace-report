import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";
import { calculateTCO, calculateMonthlyOwnershipCost } from "@/lib/tco-calculations";
import { scoreAndRankVehicles, getYearFiveEquity } from "@/components/compare/scoring-utils";
import { calculateUVPRS, type UVPRSResult } from "@/lib/uvprs-scoring";

type VehicleReport = Tables<"vehicle_reports">;

interface ComparisonPDFData {
  vehicles: VehicleReport[];
  annualMiles?: number;
  generatedDate?: Date;
}

export async function generateComparisonPDF(data: ComparisonPDFData): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const { vehicles, annualMiles = 12000, generatedDate = new Date() } = data;

  // Score vehicles with mileage config
  const scoredVehicles = scoreAndRankVehicles(vehicles, { annualMiles });
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
  addSection(`5-Year Total Cost of Ownership (${annualMiles.toLocaleString()} mi/yr)`);
  
  const tcoTableY = yPosition;
  const hasMileageDepreciation = scoredVehicles.some(s => (s.tco?.mileageDepreciation ?? 0) > 0);
  const tcoCols = hasMileageDepreciation 
    ? ["Vehicle", "Purchase", "Fuel", "Repairs", "Mile Dep.", "Total TCO"]
    : ["Vehicle", "Purchase", "Fuel", "Repairs", "Total TCO"];
  const tcoColWidths = hasMileageDepreciation
    ? [45, 30, 25, 25, 25, 30]
    : [55, 35, 30, 30, 35];
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
    
    const tcoData = hasMileageDepreciation
      ? [
          `${v.year} ${v.make} ${v.model}`.substring(0, 22),
          formatCurrency(Number(v.asking_price)),
          scored.tco ? formatCurrency(scored.tco.fuelCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.repairCost5Year) : "—",
          scored.tco?.mileageDepreciation ? `+${formatCurrency(scored.tco.mileageDepreciation)}` : "—",
          scored.tco ? formatCurrency(scored.tco.totalTCO) : "—",
        ]
      : [
          `${v.year} ${v.make} ${v.model}`.substring(0, 28),
          formatCurrency(Number(v.asking_price)),
          scored.tco ? formatCurrency(scored.tco.fuelCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.repairCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.totalTCO) : "—",
        ];
    
    const totalColIndex = hasMileageDepreciation ? 5 : 4;
    const mileageDepColIndex = 4;
    
    tcoData.forEach((cell, i) => {
      if (i === totalColIndex && isLowestTCO) {
        pdf.setTextColor(34, 197, 94);
        pdf.setFont("helvetica", "bold");
      } else if (hasMileageDepreciation && i === mileageDepColIndex && cell !== "—") {
        pdf.setTextColor(234, 179, 8); // Warning color for mileage depreciation
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
  addSection(`5-Year Financial Outlook (${annualMiles.toLocaleString()} mi/yr)`);
  
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

  // Service History per vehicle
  const vehiclesWithHistory = vehicles.filter(v =>
    (v.major_services_done?.length ?? 0) > 0 ||
    (v.major_services_due?.length ?? 0) > 0 ||
    (v.chronic_repair_systems?.length ?? 0) > 0 ||
    v.service_gap_miles != null
  );

  if (vehiclesWithHistory.length > 0) {
    addSection("Service History");

    vehiclesWithHistory.forEach((v) => {
      if (yPosition > pageHeight - margin - 30) {
        pdf.addPage();
        yPosition = margin;
      }

      addText(`${v.year} ${v.make} ${v.model}`, 11, true);

      if (v.service_gap_miles != null) {
        const gap = v.service_gap_miles;
        const gapColor: [number, number, number] = gap <= 10000 ? [34, 197, 94] : gap <= 20000 ? [234, 179, 8] : [239, 68, 68];
        addText(`Largest Service Gap: ${gap.toLocaleString()} miles`, 9, true, gapColor);
      }

      if (v.major_services_done && v.major_services_done.length > 0) {
        addText("Completed:", 9, true, [34, 197, 94]);
        v.major_services_done.forEach((s) => addText(`  ✓ ${s}`, 8));
      }

      if (v.major_services_due && v.major_services_due.length > 0) {
        addText("Overdue:", 9, true, [239, 68, 68]);
        v.major_services_due.forEach((s) => addText(`  ⚠ ${s}`, 8));
      }

      if (v.chronic_repair_systems && v.chronic_repair_systems.length > 0) {
        addText("Chronic Issues:", 9, true, [239, 68, 68]);
        v.chronic_repair_systems.forEach((s) => addText(`  ⚠ ${s}`, 8));
      }

      yPosition += 3;
    });
  }

  // UVPRS Risk Score & TCO per vehicle
  addSection("UVPRS Risk Score & Ownership Cost");

  vehicles.forEach((v) => {
    if (yPosition > pageHeight - margin - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    const uvprs: UVPRSResult = calculateUVPRS({
      year: v.year,
      make: v.make,
      mileage: v.mileage,
      askingPrice: Number(v.asking_price),
      titleStatus: v.title_status,
      accidentCount: v.accident_count,
      ownerCount: v.owner_count,
      hasServiceRecords: v.has_service_records,
      healthScore: v.health_score,
      historyIssues: v.history_issues,
      historyPositives: v.history_positives,
      serviceGapMiles: v.service_gap_miles,
      majorServicesDue: v.major_services_due,
      majorServicesDone: v.major_services_done,
      chronicRepairSystems: v.chronic_repair_systems,
      fairMarketPrivate: v.fair_market_private ? Number(v.fair_market_private) : null,
      fairMarketDealer: v.fair_market_dealer ? Number(v.fair_market_dealer) : null,
    });

    const uvColor: [number, number, number] =
      uvprs.totalScore <= 20 ? [34, 197, 94] :
      uvprs.totalScore <= 40 ? [234, 179, 8] :
      uvprs.totalScore <= 60 ? [249, 115, 22] :
      [239, 68, 68];

    // Vehicle header with score
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${v.year} ${v.make} ${v.model}`, margin, yPosition);
    pdf.setTextColor(...uvColor);
    pdf.text(`${uvprs.totalScore}/100 — ${uvprs.riskLabel}`, margin + 80, yPosition);
    yPosition += 6;

    // Factor table header
    const fColWidths = [50, 16, 16, pageWidth - 2 * margin - 82];
    pdf.setFillColor(59, 130, 246);
    pdf.rect(margin, yPosition, pageWidth - 2 * margin, 6, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    let fxPos = margin;
    ["Factor", "Wt", "Score", "Detail"].forEach((h, i) => {
      pdf.text(h, fxPos + 2, yPosition + 4);
      fxPos += fColWidths[i];
    });
    yPosition += 8;

    // Factor rows
    uvprs.factors.forEach((factor, idx) => {
      if (yPosition > pageHeight - margin - 8) {
        pdf.addPage();
        yPosition = margin;
      }

      if (idx % 2 === 0) {
        pdf.setFillColor(245, 247, 250);
        pdf.rect(margin, yPosition - 3, pageWidth - 2 * margin, 6, "F");
      }

      fxPos = margin;
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);
      pdf.text(factor.label + (factor.known ? "" : " *"), fxPos + 2, yPosition);
      fxPos += fColWidths[0];

      pdf.setTextColor(100, 100, 100);
      pdf.text(`${Math.round(factor.weight * 100)}%`, fxPos + 2, yPosition);
      fxPos += fColWidths[1];

      const fColor: [number, number, number] =
        factor.score <= 20 ? [34, 197, 94] :
        factor.score <= 40 ? [234, 179, 8] :
        factor.score <= 60 ? [249, 115, 22] :
        [239, 68, 68];
      pdf.setTextColor(...fColor);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${Math.round(factor.score)}`, fxPos + 2, yPosition);
      fxPos += fColWidths[2];

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80, 80, 80);
      const descLines = pdf.splitTextToSize(factor.description, fColWidths[3] - 4);
      pdf.text(descLines[0] || "", fxPos + 2, yPosition);

      yPosition += 6;
    });

    yPosition += 4;

    // Per-vehicle TCO summary
    const tco = calculateTCO(
      Number(v.asking_price),
      v.mpg_combined,
      v.fuel_type,
      v.depreciation_table,
      { annualMiles },
      { make: v.make, year: v.year }
    );
    const monthlyCost = calculateMonthlyOwnershipCost(tco);

    if (yPosition > pageHeight - margin - 22) {
      pdf.addPage();
      yPosition = margin;
    }

    // TCO box
    pdf.setFillColor(245, 247, 250);
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 18, 2, 2, "F");

    const tcoColW = (pageWidth - 2 * margin) / 4;
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text("5-Year TCO", margin + 3, yPosition + 5);
    pdf.text("Cost/Mile", margin + tcoColW + 3, yPosition + 5);
    pdf.text("Monthly", margin + tcoColW * 2 + 3, yPosition + 5);
    pdf.text("Fuel (5yr)", margin + tcoColW * 3 + 3, yPosition + 5);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(formatCurrency(tco.totalTCO), margin + 3, yPosition + 13);
    pdf.text(`$${tco.costPerMile.toFixed(2)}`, margin + tcoColW + 3, yPosition + 13);
    pdf.text(`${formatCurrency(monthlyCost)}/mo`, margin + tcoColW * 2 + 3, yPosition + 13);
    pdf.setTextColor(59, 130, 246);
    pdf.text(formatCurrency(tco.fuelCost5Year), margin + tcoColW * 3 + 3, yPosition + 13);

    yPosition += 24;
  });

  // Footnotes section
  yPosition += 5;
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  
  // Mileage depreciation footnote (only when excess mileage applies)
  if (annualMiles > 12000) {
    const depFootnote = `* Mileage Depreciation: Driving above 12,000 miles/year adds ~$0.18 per excess mile in depreciation over 5 years, reflecting reduced resale value from higher-than-average mileage.`;
    const depLines = pdf.splitTextToSize(depFootnote, pageWidth - 2 * margin);
    
    if (yPosition + depLines.length * 3.5 > pageHeight - 20) {
      pdf.addPage();
      yPosition = margin;
    }
    
    pdf.text(depLines, margin, yPosition);
    yPosition += depLines.length * 3.5 + 2;
  }
  
  // Maintenance cost scaling footnote
  const maintenanceFootnote = `* Maintenance Costs: Scaled using a 0.85 power factor based on annual mileage. At ${annualMiles.toLocaleString()} mi/yr, maintenance is ${Math.round(Math.pow(annualMiles / 12000, 0.85) * 100)}% of the 12,000 mi/yr baseline, reflecting economies of scale at higher mileage.`;
  const maintLines = pdf.splitTextToSize(maintenanceFootnote, pageWidth - 2 * margin);
  
  if (yPosition + maintLines.length * 3.5 > pageHeight - 15) {
    pdf.addPage();
    yPosition = margin;
  }
  
  pdf.text(maintLines, margin, yPosition);
  yPosition += maintLines.length * 3.5 + 3;

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
