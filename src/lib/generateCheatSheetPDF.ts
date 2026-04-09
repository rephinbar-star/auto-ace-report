import jsPDF from "jspdf";

interface DeductionItem {
  reason: string;
  amount: number;
}

interface CheatSheetSection {
  header: string;
  bullets: string[];
}

interface CheatSheetData {
  sections: CheatSheetSection[];
  deductionTable: DeductionItem[];
  targetOfferPrice: number;
  basePrice: number;
  floorPrice: number;
  vehicleLabel: string;
  askingPrice: number;
}

export function generateCheatSheetPDF(data: CheatSheetData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("BUYER NEGOTIATION BRIEF", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.vehicleLabel}  •  Asking: $${data.askingPrice.toLocaleString()}  •  ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: "center" });
  y += 5;

  // Divider
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Sections (skip last "OUR OFFER" section — we render deduction table + offer separately)
  const sectionsToRender = data.sections.slice(0, 5);

  for (const section of sectionsToRender) {
    if (y > 250) { doc.addPage(); y = margin; }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(section.header.toUpperCase(), margin, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    for (const bullet of section.bullets) {
      if (y > 260) { doc.addPage(); y = margin; }
      const lines = doc.splitTextToSize(`•  ${bullet}`, contentWidth - 4);
      doc.text(lines, margin + 2, y);
      y += lines.length * 3.2;
    }
    y += 2;
  }

  // Deduction Table
  if (y > 230) { doc.addPage(); y = margin; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PRICE ADJUSTMENT BREAKDOWN", margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  // Base price row
  doc.text("Fair Market Value (base)", margin + 2, y);
  doc.text(`$${data.basePrice.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
  y += 4;

  // Deduction rows
  for (const d of data.deductionTable) {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.text(d.reason, margin + 2, y);
    doc.setTextColor(180, 40, 40);
    doc.text(`- $${d.amount.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
    doc.setTextColor(0);
    y += 4;
  }

  // Divider
  doc.setDrawColor(100);
  doc.line(margin + 2, y, pageWidth - margin, y);
  y += 5;

  // Target offer
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TARGET OFFER PRICE", margin + 2, y);
  doc.text(`$${data.targetOfferPrice.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
  y += 5;

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text(`Floor: $${data.floorPrice.toLocaleString()} (trade-in value)  •  Rounded to nearest $250`, margin + 2, y);
  doc.setTextColor(0);
  y += 5;

  // 6th section (Our Offer justification) if present
  const offerSection = data.sections[5];
  if (offerSection) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(offerSection.header.toUpperCase(), margin, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    for (const bullet of offerSection.bullets) {
      if (y > 265) { doc.addPage(); y = margin; }
      const lines = doc.splitTextToSize(`•  ${bullet}`, contentWidth - 4);
      doc.text(lines, margin + 2, y);
      y += lines.length * 3.2;
    }
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currentYear = new Date().getFullYear();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(140);
    doc.text(
      "Pricing estimates are based on publicly available market data.",
      margin,
      pageHeight - 10
    );
    doc.text(
      `© ${currentYear} CarWise. All rights reserved.`,
      pageWidth - margin,
      pageHeight - 10,
      { align: "right" }
    );
    doc.setTextColor(0);
  }

  doc.save(`Negotiation_Brief_${data.vehicleLabel.replace(/\s+/g, "_")}.pdf`);
}
