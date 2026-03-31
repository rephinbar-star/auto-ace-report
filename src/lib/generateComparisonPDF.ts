import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";
import { lookupRecalls } from "@/lib/nhtsa";
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
    ? ["Vehicle", "Purchase", "Fuel", "Repairs", "Maint.", "Mile Dep.", "Total TCO"]
    : ["Vehicle", "Purchase", "Fuel", "Repairs", "Maint.", "Total TCO"];
  const tcoColWidths = hasMileageDepreciation
    ? [40, 25, 22, 22, 22, 22, 27]
    : [45, 30, 25, 25, 25, 30];
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
          `${v.year} ${v.make} ${v.model}`.substring(0, 20),
          formatCurrency(Number(v.asking_price)),
          scored.tco ? formatCurrency(scored.tco.fuelCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.repairCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.maintenanceCost5Year) : "—",
          scored.tco?.mileageDepreciation ? `+${formatCurrency(scored.tco.mileageDepreciation)}` : "—",
          scored.tco ? formatCurrency(scored.tco.totalTCO) : "—",
        ]
      : [
          `${v.year} ${v.make} ${v.model}`.substring(0, 22),
          formatCurrency(Number(v.asking_price)),
          scored.tco ? formatCurrency(scored.tco.fuelCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.repairCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.maintenanceCost5Year) : "—",
          scored.tco ? formatCurrency(scored.tco.totalTCO) : "—",
        ];
    
    const totalColIndex = hasMileageDepreciation ? 6 : 5;
    const mileageDepColIndex = hasMileageDepreciation ? 5 : -1;
    
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

  yPosition += 8;

  // Visual TCO bar chart
  if (scoredVehicles.filter(s => s.tco).length >= 2) {
    if (yPosition > pageHeight - margin - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    const chartVehicles = scoredVehicles.filter(s => s.tco);
    const maxTCO = Math.max(...chartVehicles.map(s => s.tco!.totalTCO));
    const chartMinTCO = Math.min(...chartVehicles.map(s => s.tco!.totalTCO));
    const barMaxWidth = pageWidth - 2 * margin - 55; // leave room for label
    const barHeight = 10;
    const barGap = 4;

    addText("TCO Comparison", 10, true, [0, 0, 0]);
    yPosition += 2;

    chartVehicles.forEach((scored, idx) => {
      const v = scored.vehicle;
      const tcoVal = scored.tco!.totalTCO;
      const barWidth = Math.max(8, (tcoVal / maxTCO) * barMaxWidth);
      const isLowest = tcoVal === chartMinTCO;

      // Vehicle label
      pdf.setFontSize(8);
      pdf.setFont("helvetica", isLowest ? "bold" : "normal");
      pdf.setTextColor(0, 0, 0);
      const label = `${v.year} ${v.make} ${v.model}`.substring(0, 25);
      pdf.text(label, margin, yPosition + barHeight / 2 + 1);

      // Bar background
      const barX = margin + 52;
      pdf.setFillColor(230, 230, 230);
      pdf.roundedRect(barX, yPosition - 1, barMaxWidth, barHeight, 1.5, 1.5, "F");

      // Stacked bar: purchase | fuel | repairs (+ mileage dep)
      const tco = scored.tco!;
      const purchaseW = (tco.purchasePrice / tcoVal) * barWidth;
      const fuelW = (tco.fuelCost5Year / tcoVal) * barWidth;
      const repairW = (tco.repairCost5Year / tcoVal) * barWidth;
      const maintW = (tco.maintenanceCost5Year / tcoVal) * barWidth;
      const mileDepW = ((tco.mileageDepreciation || 0) / tcoVal) * barWidth;

      let segX = barX;
      // Purchase segment
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(segX, yPosition - 1, purchaseW, barHeight, 1.5, 0, "F");
      pdf.rect(segX + 1.5, yPosition - 1, Math.max(0, purchaseW - 1.5), barHeight, "F");
      segX += purchaseW;

      // Fuel segment
      pdf.setFillColor(16, 185, 129);
      pdf.rect(segX, yPosition - 1, fuelW, barHeight, "F");
      segX += fuelW;

      // Repairs segment (red)
      pdf.setFillColor(239, 68, 68);
      pdf.rect(segX, yPosition - 1, repairW, barHeight, "F");
      segX += repairW;

      // Maintenance segment (amber)
      pdf.setFillColor(234, 179, 8);
      pdf.rect(segX, yPosition - 1, maintW, barHeight, "F");
      segX += maintW;

      // Mileage depreciation segment
      if (mileDepW > 0) {
        pdf.setFillColor(249, 115, 22);
        pdf.rect(segX, yPosition - 1, mileDepW, barHeight, "F");
      }

      // Value label at end of bar
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(isLowest ? 34 : 80, isLowest ? 197 : 80, isLowest ? 94 : 80);
      pdf.text(formatCurrency(tcoVal), barX + barWidth + 3, yPosition + barHeight / 2 + 1);

      yPosition += barHeight + barGap;
    });

    // Legend
    yPosition += 2;
    const legendItems: { label: string; color: [number, number, number] }[] = [
      { label: "Purchase", color: [59, 130, 246] },
      { label: "Fuel", color: [16, 185, 129] },
      { label: "Repairs", color: [239, 68, 68] },
      { label: "Maint.", color: [234, 179, 8] },
    ];
    if (scoredVehicles.some(s => (s.tco?.mileageDepreciation ?? 0) > 0)) {
      legendItems.push({ label: "Mile Dep.", color: [249, 115, 22] });
    }

    let legendX = margin;
    pdf.setFontSize(7);
    legendItems.forEach(({ label, color }) => {
      pdf.setFillColor(...color);
      pdf.rect(legendX, yPosition - 2, 4, 4, "F");
      pdf.setTextColor(80, 80, 80);
      pdf.setFont("helvetica", "normal");
      pdf.text(label, legendX + 5.5, yPosition + 1);
      legendX += pdf.getTextWidth(label) + 12;
    });

    yPosition += 8;
  }

  yPosition += 4;

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

  // Depreciation Curve Chart
  interface DepRow { year: number; privateValue: number; tradeInValue?: number }
  const vehiclesWithDepData = vehicles.filter(v => {
    if (!v.depreciation_table || !Array.isArray(v.depreciation_table)) return false;
    return (v.depreciation_table as unknown as DepRow[]).some(r => r.year && r.privateValue);
  });

  if (vehiclesWithDepData.length >= 2) {
    if (yPosition > pageHeight - margin - 90) {
      pdf.addPage();
      yPosition = margin;
    }

    addSection("5-Year Depreciation Curve");

    const chartX = margin + 25;
    const chartW = pageWidth - 2 * margin - 35;
    const chartH = 55;
    const chartY = yPosition;

    // Gather all data points
    const vehicleLines: { label: string; points: { year: number; value: number }[] }[] = [];
    let globalMax = 0;
    let globalMin = Infinity;

    vehiclesWithDepData.forEach(v => {
      const rows = (v.depreciation_table as unknown as DepRow[])
        .filter(r => r.year >= 0 && r.year <= 5 && r.privateValue != null)
        .sort((a, b) => a.year - b.year);
      // Add year 0 = asking price if not present
      const points = rows.map(r => ({ year: r.year, value: r.privateValue }));
      if (!points.find(p => p.year === 0)) {
        points.unshift({ year: 0, value: Number(v.asking_price) });
      }
      points.forEach(p => {
        if (p.value > globalMax) globalMax = p.value;
        if (p.value < globalMin) globalMin = p.value;
      });
      vehicleLines.push({
        label: `${v.year} ${v.make} ${v.model}`.substring(0, 22),
        points,
      });
    });

    // Add padding to range
    const valueRange = globalMax - globalMin || 1;
    const padded = valueRange * 0.1;
    const yMin = Math.max(0, globalMin - padded);
    const yMax = globalMax + padded;
    const yRange = yMax - yMin;

    // Draw axes
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    // Y axis
    pdf.line(chartX, chartY, chartX, chartY + chartH);
    // X axis
    pdf.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

    // Y axis labels (4 ticks)
    pdf.setFontSize(6);
    pdf.setTextColor(120, 120, 120);
    pdf.setFont("helvetica", "normal");
    for (let i = 0; i <= 3; i++) {
      const val = yMax - (yRange * i) / 3;
      const tickY = chartY + (chartH * i) / 3;
      pdf.setDrawColor(230, 230, 230);
      pdf.line(chartX, tickY, chartX + chartW, tickY); // grid line
      pdf.setDrawColor(200, 200, 200);
      const label = val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${Math.round(val)}`;
      pdf.text(label, chartX - 2, tickY + 1.5, { align: "right" });
    }

    // X axis labels
    for (let yr = 0; yr <= 5; yr++) {
      const xPt = chartX + (yr / 5) * chartW;
      pdf.text(yr === 0 ? "Now" : `Yr ${yr}`, xPt, chartY + chartH + 4, { align: "center" });
    }

    // Line colors per vehicle
    const lineColors: [number, number, number][] = [
      [59, 130, 246],   // blue
      [239, 68, 68],    // red
      [16, 185, 129],   // green
      [168, 85, 247],   // purple
      [234, 179, 8],    // yellow
    ];

    // Draw lines
    vehicleLines.forEach((vLine, vIdx) => {
      const color = lineColors[vIdx % lineColors.length];
      pdf.setDrawColor(...color);
      pdf.setLineWidth(0.6);

      for (let i = 0; i < vLine.points.length - 1; i++) {
        const p1 = vLine.points[i];
        const p2 = vLine.points[i + 1];
        const x1 = chartX + (p1.year / 5) * chartW;
        const y1 = chartY + ((yMax - p1.value) / yRange) * chartH;
        const x2 = chartX + (p2.year / 5) * chartW;
        const y2 = chartY + ((yMax - p2.value) / yRange) * chartH;
        pdf.line(x1, y1, x2, y2);
      }

      // Draw dots
      vLine.points.forEach(p => {
        const px = chartX + (p.year / 5) * chartW;
        const py = chartY + ((yMax - p.value) / yRange) * chartH;
        pdf.setFillColor(...color);
        pdf.circle(px, py, 0.8, "F");
      });
    });

    // Legend below chart
    yPosition = chartY + chartH + 10;
    let legendX = margin;
    pdf.setFontSize(7);
    vehicleLines.forEach((vLine, vIdx) => {
      const color = lineColors[vIdx % lineColors.length];
      pdf.setFillColor(...color);
      pdf.rect(legendX, yPosition - 2, 6, 2, "F");
      pdf.setTextColor(60, 60, 60);
      pdf.setFont("helvetica", "normal");
      pdf.text(vLine.label, legendX + 8, yPosition);
      legendX += pdf.getTextWidth(vLine.label) + 16;
    });

    yPosition += 8;
  }

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

  // ══════════════════════════════════════════════
  // NHTSA SAFETY RECALLS PER VEHICLE
  // ══════════════════════════════════════════════
  addSection("NHTSA Safety Recalls");

  for (const v of vehicles) {
    if (yPosition > pageHeight - margin - 30) {
      pdf.addPage();
      yPosition = margin;
    }

    addText(`${v.year} ${v.make} ${v.model}`, 11, true);

    try {
      const recallResult = await lookupRecalls(v.year, v.make, v.model);
      const recallCount = recallResult?.count ?? 0;
      const recalls = recallResult?.recalls ?? [];

      if (recallCount === 0) {
        // Green status
        pdf.setFillColor(240, 255, 245);
        pdf.setDrawColor(34, 197, 94);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 8, 2, 2, "FD");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(34, 197, 94);
        pdf.text("✓  No Recalls on Record", margin + 4, yPosition + 5);
        pdf.setFont("helvetica", "normal");
        yPosition += 12;
      } else {
        // Red/amber status — show count
        pdf.setFillColor(255, 240, 240);
        pdf.setDrawColor(239, 68, 68);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 8, 2, 2, "FD");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(239, 68, 68);
        pdf.text(`⚠  ${recallCount} Recall${recallCount !== 1 ? "s" : ""} Found`, margin + 4, yPosition + 5);
        pdf.setFont("helvetica", "normal");
        yPosition += 10;

        // List individual recalls (max 5)
        recalls.slice(0, 5).forEach((recall) => {
          if (yPosition > pageHeight - margin - 12) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          const component = recall.component || "Unknown Component";
          pdf.text(component.substring(0, 60), margin + 3, yPosition);

          if (recall.campaignNumber) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Campaign: ${recall.campaignNumber}`, pageWidth - margin - 55, yPosition);
          }
          yPosition += 4;

          // Summary
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(100, 100, 100);
          const summaryLines = pdf.splitTextToSize(recall.summary || "", pageWidth - 2 * margin - 6);
          pdf.text(summaryLines.slice(0, 2), margin + 3, yPosition);
          yPosition += summaryLines.slice(0, 2).length * 3 + 3;
        });

        if (recalls.length > 5) {
          pdf.setFontSize(7);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`... and ${recalls.length - 5} more`, margin + 3, yPosition);
          yPosition += 4;
        }
      }
    } catch {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Recall data unavailable", margin + 3, yPosition);
      yPosition += 6;
    }

    yPosition += 2;
  }

  yPosition += 4;

  // UVPRS Risk Score & TCO per vehicle
  addSection("UVPRS Risk Score & Ownership Cost");

  vehicles.forEach((v) => {
    if (yPosition > pageHeight - margin - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    const pdfIssues = (v.history_issues ?? []).map((s: string) => s.toLowerCase());
    const pdfHasFrame = pdfIssues.some((i: string) => i.includes("frame") || i.includes("structural"));
    const pdfSellerType = v.is_cpo ? "cpo" as const
      : v.seller_type === "private" ? "private" as const
      : v.seller_type ? "dealer" as const
      : null;

    const uvprs: UVPRSResult = calculateUVPRS({
      year: v.year,
      make: v.make,
      mileage: v.mileage,
      askingPrice: Number(v.asking_price),
      titleStatus: v.title_status,
      accidentCount: v.accident_count,
      ownerCount: v.owner_count,
      hasFrameDamage: pdfHasFrame,
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
      sellerType: pdfSellerType,
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

    // Warning when no history report was provided
    if (!v.has_service_records) {
      if (yPosition + 10 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.setFillColor(255, 240, 240);
      pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 8, 2, 2, "F");
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(239, 68, 68);
      pdf.text("! Risk Score adversely affected because no available CarFax/AutoCheck was provided by user", margin + 3, yPosition + 5);
      pdf.setFont("helvetica", "normal");
      yPosition += 10;
    }

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
    pdf.setTextColor(239, 68, 68);
    pdf.text(formatCurrency(tco.totalTCO), margin + 3, yPosition + 13);
    pdf.text(`$${tco.costPerMile.toFixed(2)}`, margin + tcoColW + 3, yPosition + 13);
    pdf.text(`${formatCurrency(monthlyCost)}/mo`, margin + tcoColW * 2 + 3, yPosition + 13);
    pdf.setTextColor(59, 130, 246);
    pdf.text(formatCurrency(tco.fuelCost5Year), margin + tcoColW * 3 + 3, yPosition + 13);

    yPosition += 24;
  });

  // ══════════════════════════════════════════════
  // PER-VEHICLE VERDICT (Buy / Negotiate / Walk Away)
  // ══════════════════════════════════════════════
  addSection("Verdict & Recommendation");

  const formatCurrencyLocal = (v: number) => `$${v.toLocaleString()}`;

  vehicles.forEach((v) => {
    if (yPosition > pageHeight - margin - 35) {
      pdf.addPage();
      yPosition = margin;
    }

    // Derive verdict from risk level
    const riskLevel = v.risk_level || "medium";
    let verdict: "Buy" | "Negotiate" | "Walk Away";
    let justification: string;

    if (riskLevel === "low") {
      verdict = "Buy";
      justification = "Low risk indicators across pricing, history, and reliability. A sound purchase opportunity.";
    } else if (riskLevel === "medium") {
      verdict = "Negotiate";
      justification = "Moderate risk factors warrant negotiation. Leverage concerns to get a better price.";
    } else {
      verdict = "Walk Away";
      justification = "Significant risk flags in pricing, history, or reliability outweigh the value.";
    }

    // Use AI verdict if available
    if (v.final_verdict) {
      const fv = v.final_verdict.toLowerCase();
      if (fv.includes("buy") && !fv.includes("walk")) {
        verdict = "Buy";
      } else if (fv.includes("negotiate")) {
        verdict = "Negotiate";
      } else if (fv.includes("walk")) {
        verdict = "Walk Away";
      }
      if (v.final_verdict_justification) {
        justification = v.final_verdict_justification;
      }
    }

    const verdictColor: [number, number, number] = verdict === "Buy" ? [34, 197, 94]
      : verdict === "Negotiate" ? [234, 179, 8] : [239, 68, 68];

    // Vehicle name
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${v.year} ${v.make} ${v.model}`, margin, yPosition);
    yPosition += 5;

    // Verdict card
    pdf.setDrawColor(...verdictColor);
    pdf.setLineWidth(0.6);
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 22, 2, 2, "S");

    // Badge
    const badgeText = verdict.toUpperCase();
    pdf.setFillColor(...verdictColor);
    pdf.roundedRect(margin + 4, yPosition + 3, 28, 7, 2, 2, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text(badgeText, margin + 6, yPosition + 8);

    // Fair offer price on right
    if (v.fair_offer_price) {
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text("Fair Offer", pageWidth - margin - 30, yPosition + 5);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(formatCurrencyLocal(Number(v.fair_offer_price)), pageWidth - margin - 30, yPosition + 12);
    }

    // Justification text
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);
    const justLines = pdf.splitTextToSize(justification, pageWidth - 2 * margin - 80);
    pdf.text(justLines[0] || "", margin + 36, yPosition + 8);
    if (justLines[1]) {
      pdf.text(justLines[1], margin + 36, yPosition + 12);
    }

    yPosition += 28;
  });

  yPosition += 4;

  // ══════════════════════════════════════════════
  // DATA SOURCES
  // ══════════════════════════════════════════════
  const allSources = vehicles.flatMap(v => v.pricing_sources || []);
  if (allSources.length > 0) {
    const seen = new Map<string, string>();
    for (const url of allSources) {
      try {
        const hostname = new URL(url).hostname.replace("www.", "");
        const domain = hostname.split(".")[0];
        if (!seen.has(domain)) {
          seen.set(domain, domain.charAt(0).toUpperCase() + domain.slice(1));
        }
      } catch { /* skip */ }
    }
    const sourceNames = Array.from(seen.values());

    if (yPosition + 12 > pageHeight - 15) {
      pdf.addPage();
      yPosition = margin;
    }

    addSection("Data Sources");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont("helvetica", "normal");
    const sourceLine = `Pricing, repair, and maintenance cost data sourced from: ${sourceNames.join(", ")}`;
    const srcLines = pdf.splitTextToSize(sourceLine, pageWidth - 2 * margin);
    pdf.text(srcLines, margin, yPosition);
    yPosition += srcLines.length * 3.5 + 4;
  }

  // Footnotes section
  yPosition += 2;
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
