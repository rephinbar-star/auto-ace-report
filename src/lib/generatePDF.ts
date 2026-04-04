import jsPDF from "jspdf";
import type { UVPRSResult } from "@/lib/uvprs-scoring";
import type { TCOResult } from "@/lib/tco-calculations";
import logoIcon from "@/assets/logo-icon.png";

interface VehicleData {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  askingPrice: number;
  purchasePrice?: number;
}

interface PriceAssessment {
  fairMarketPrivate: number;
  fairMarketDealer?: number;
  fairMarketTradeIn: number;
  dealRating: string;
  priceDifference: number;
}

interface RiskAssessment {
  level: string;
  fairOfferPrice: number;
  expertOpinion: string;
  depreciationRisk: string;
  reliabilityConcerns: Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>;
  valueProposition?: string;
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
  worstCaseRepairCosts?: number;
  maintenanceCosts?: number;
}

interface DealerReview {
  dealerName: string;
  trustScore: number;
  sentiment: "positive" | "mixed" | "negative" | "unknown";
  summary: string;
  positives: string[];
  watchOuts: string[];
  sources: string[];
}

interface ServiceHistory {
  serviceGapMiles?: number | null;
  majorServicesDue?: string[] | null;
  majorServicesDone?: string[] | null;
  chronicRepairSystems?: string[] | null;
}

interface TCOData {
  tco: TCOResult;
  annualMiles: number;
  gasPricePerGallon?: number;
  electricityPerKwh?: number;
}

interface WarrantyAnalysis {
  warrantyStatus: "active" | "expired" | "unknown";
  warrantyMonthsRemaining?: number | null;
  riskReductionFactor: number;
  warrantyNotes: string;
}

interface FinalVerdict {
  verdict: "Buy" | "Negotiate" | "Walk Away";
  justification: string;
}

interface RecallItemData {
  component: string;
  summary: string;
  campaignNumber?: string;
  remedyDescription?: string;
}

interface RecallData {
  count: number;
  openCount: number;
  recalls: RecallItemData[];
}

interface ReportData {
  vehicle: VehicleData;
  priceAssessment: PriceAssessment;
  riskAssessment: RiskAssessment;
  historyAnalysis: HistoryAnalysis;
  depreciationTable: DepreciationRow[];
  images?: string[];
  dealerReview?: DealerReview;
  serviceHistory?: ServiceHistory;
  uvprsResult?: UVPRSResult;
  tcoData?: TCOData;
  sellerType?: string;
  pricingSources?: string[];
  hasServiceRecords?: boolean;
  warrantyAnalysis?: WarrantyAnalysis;
  finalVerdict?: FinalVerdict;
  recallData?: RecallData;
  vin?: string;
}

// ── Color palette matching the website (teal primary) ──
const TEAL: [number, number, number] = [28, 175, 154];
const GREEN: [number, number, number] = [34, 197, 94];
const AMBER: [number, number, number] = [234, 179, 8];
const RED: [number, number, number] = [220, 38, 38];
const ORANGE: [number, number, number] = [249, 115, 22];
const SLATE: [number, number, number] = [100, 116, 139];
const BG_MUTED: [number, number, number] = [241, 245, 249];
const BLACK: [number, number, number] = [15, 23, 42];
const WHITE: [number, number, number] = [255, 255, 255];

// Helper to load image as base64 for PDF
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fitImageToBox(
  imgWidth: number,
  imgHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
  return { width: imgWidth * ratio, height: imgHeight * ratio };
}

const fmt = (v: number) => `$${v.toLocaleString()}`;

// Load logo as base64 at module level
let logoBase64: string | null = null;
async function getLogoBase64(): Promise<string | null> {
  if (logoBase64) return logoBase64;
  try {
    const response = await fetch(logoIcon);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64 = reader.result as string;
        resolve(logoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateReportPDF(data: ReportData): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 14;
  const contentW = W - 2 * M;
  let y = 0;

  const { vehicle, priceAssessment, riskAssessment, historyAnalysis, depreciationTable, images, dealerReview, serviceHistory, uvprsResult, tcoData, sellerType, pricingSources, hasServiceRecords, warrantyAnalysis, finalVerdict, recallData, vin } = data;

  // Helper to deduplicate sources by domain
  const getDeduplicatedSources = (sources: string[]): { displayName: string; url: string }[] => {
    const seen = new Map<string, { displayName: string; url: string }>();
    for (const url of sources) {
      try {
        const hostname = new URL(url).hostname.replace("www.", "");
        const domain = hostname.split(".")[0];
        if (!seen.has(domain)) {
          seen.set(domain, {
            displayName: domain.charAt(0).toUpperCase() + domain.slice(1),
            url,
          });
        }
      } catch { /* skip */ }
    }
    return Array.from(seen.values());
  };
  const deduplicatedSources = pricingSources?.length ? getDeduplicatedSources(pricingSources) : [];

  // ── Helpers ──
  const ensureSpace = (needed: number) => {
    if (y + needed > H - 14) {
      addFooter();
      pdf.addPage();
      y = M;
    }
  };

  const addFooter = () => {
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.text(`Generated by CarWise on ${new Date().toLocaleDateString()}`, M, H - 6);
    pdf.text("www.carwise.com", W - M - 28, H - 6);
  };

  const sectionTitle = (title: string) => {
    ensureSpace(14);
    y += 7;
    // Teal left accent bar
    pdf.setFillColor(...TEAL);
    pdf.rect(M, y - 4, 2.5, 6, "F");
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...BLACK);
    pdf.text(title, M + 6, y);
    y += 6;
  };

  const wrappedText = (text: string, fontSize: number, color: [number, number, number] = BLACK, bold = false, indent = 0) => {
    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentW - indent);
    const lh = fontSize * 0.4;
    ensureSpace(lines.length * lh + 2);
    pdf.text(lines, M + indent, y);
    y += lines.length * lh + 1.5;
  };

  const bulletItem = (text: string, color: [number, number, number] = SLATE) => {
    wrappedText(`\u2022  ${text}`, 9, color, false, 4);
  };

  // ══════════════════════════════════════════════
  // HEADER — Teal banner with logo
  // ══════════════════════════════════════════════
  pdf.setFillColor(...TEAL);
  pdf.rect(0, 0, W, 26, "F");

  // Logo image
  const logo = await getLogoBase64();
  if (logo) {
    try {
      pdf.addImage(logo, "PNG", M, 4, 18, 18);
    } catch { /* skip */ }
  }

  // Brand name
  pdf.setTextColor(...WHITE);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("CarWise", M + (logo ? 21 : 0), 14);

  // Subtitle
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Vehicle Analysis Report", M + (logo ? 21 : 0), 20);

  // Date on right
  pdf.setFontSize(8);
  pdf.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), W - M - 42, 14);

  y = 34;

  // ══════════════════════════════════════════════
  // VEHICLE TITLE
  // ══════════════════════════════════════════════
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...BLACK);
  pdf.text(`${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`, M, y);
  y += 6;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...SLATE);
  pdf.text(`${vehicle.mileage.toLocaleString()} miles  |  Asking ${fmt(vehicle.askingPrice)}`, M, y);
  y += 8;

  // ══════════════════════════════════════════════
  // QUICK STATS (4 cards)
  // ══════════════════════════════════════════════
  const cardW = (contentW - 9) / 4;
  const cardH = 20;

  const referenceValue = sellerType === "dealer" && priceAssessment.fairMarketDealer
    ? priceAssessment.fairMarketDealer
    : priceAssessment.fairMarketPrivate;

  const ratingColor = (r: string): [number, number, number] => {
    const map: Record<string, [number, number, number]> = {
      excellent: GREEN, good: GREEN, fair: AMBER, poor: ORANGE, overpriced: RED,
    };
    return map[r] || BLACK;
  };

  const uvprsColor = (): [number, number, number] => {
    if (!uvprsResult) return SLATE;
    if (uvprsResult.riskLevel === "low") return GREEN;
    if (uvprsResult.riskLevel === "moderate") return AMBER;
    if (uvprsResult.riskLevel === "elevated") return ORANGE;
    return RED;
  };

  const statCards = [
    { label: sellerType === "dealer" ? "Dealer Retail Value" : "Private Sale Value", value: fmt(referenceValue), color: TEAL },
    { label: "Deal Rating", value: priceAssessment.dealRating.charAt(0).toUpperCase() + priceAssessment.dealRating.slice(1), color: ratingColor(priceAssessment.dealRating) },
    { label: "Risk Score", value: uvprsResult ? `${uvprsResult.totalScore} / 100` : riskAssessment.level, color: uvprsColor() },
    { label: "Fair Offer", value: fmt(riskAssessment.fairOfferPrice), color: GREEN },
  ];

  statCards.forEach((card, i) => {
    const x = M + i * (cardW + 3);
    pdf.setFillColor(...BG_MUTED);
    pdf.roundedRect(x, y, cardW, cardH, 2, 2, "F");
    // Color left accent
    pdf.setFillColor(...card.color);
    pdf.rect(x, y, 2, cardH, "F");
    // Label
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.text(card.label, x + 5, y + 7);
    // Value
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...card.color);
    pdf.text(card.value, x + 5, y + 15);
    pdf.setFont("helvetica", "normal");
  });

  y += cardH + 6;

  // ══════════════════════════════════════════════
  // VEHICLE IMAGES (2x2 grid)
  // ══════════════════════════════════════════════
  if (images && images.length > 0) {
    const imagesToLoad = images.slice(0, 4);
    const loadedImages: { base64: string; width: number; height: number }[] = [];

    await Promise.all(
      imagesToLoad.map(async (url) => {
        const base64 = await loadImageAsBase64(url);
        if (base64) {
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => {
              loadedImages.push({ base64, width: img.width, height: img.height });
              resolve();
            };
            img.onerror = () => resolve();
            img.src = base64;
          });
        }
      })
    );

    if (loadedImages.length > 0) {
      const gridCols = Math.min(2, loadedImages.length);
      const imgBoxWidth = (contentW - 4) / gridCols;
      const imgBoxHeight = 35;
      const totalRows = Math.ceil(loadedImages.length / 2);
      ensureSpace(totalRows * (imgBoxHeight + 3) + 2);

      loadedImages.forEach((imgData, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const xPos = M + col * (imgBoxWidth + 4);
        const yPos = y + row * (imgBoxHeight + 3);

        pdf.setFillColor(...BG_MUTED);
        pdf.roundedRect(xPos, yPos, imgBoxWidth, imgBoxHeight, 2, 2, "F");

        const padding = 2;
        const fitted = fitImageToBox(imgData.width, imgData.height, imgBoxWidth - padding * 2, imgBoxHeight - padding * 2);
        const imgX = xPos + (imgBoxWidth - fitted.width) / 2;
        const imgY = yPos + (imgBoxHeight - fitted.height) / 2;
        try {
          pdf.addImage(imgData.base64, "JPEG", imgX, imgY, fitted.width, fitted.height);
        } catch { /* skip */ }
      });

      y += totalRows * (imgBoxHeight + 3) + 4;
    }
  }

  // ══════════════════════════════════════════════
  // PRICE ASSESSMENT
  // ══════════════════════════════════════════════
  sectionTitle("Price Assessment");

  // Market Verified / AI Estimated badge
  if (deduplicatedSources.length > 0) {
    ensureSpace(6);
    pdf.setFillColor(...GREEN);
    pdf.roundedRect(M, y - 3, 30, 6, 2, 2, "F");
    pdf.setFontSize(6);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...WHITE);
    pdf.text("Market Verified", M + 2, y);
    y += 5;
  }

  // Asking vs Fair Market highlight box
  ensureSpace(20);
  pdf.setFillColor(...BG_MUTED);
  pdf.roundedRect(M, y, contentW, 16, 3, 3, "F");

  pdf.setFontSize(8);
  pdf.setTextColor(...SLATE);
  pdf.text("Asking Price", M + 5, y + 5);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...BLACK);
  pdf.text(fmt(vehicle.askingPrice), M + 5, y + 12);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...SLATE);
  pdf.text("vs Fair Market", W - M - 45, y + 5);
  const diffColor: [number, number, number] = priceAssessment.priceDifference > 0 ? RED : GREEN;
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...diffColor);
  pdf.text(`${priceAssessment.priceDifference > 0 ? "+" : ""}${fmt(Math.abs(priceAssessment.priceDifference))}`, W - M - 45, y + 12);
  y += 20;

  // Price breakdown cards
  const priceCards: { label: string; value: string }[] = [];
  if (priceAssessment.fairMarketDealer) {
    priceCards.push({ label: "Dealer Retail", value: fmt(priceAssessment.fairMarketDealer) });
  }
  priceCards.push(
    { label: "Private Sale", value: fmt(priceAssessment.fairMarketPrivate) },
    { label: "Trade-In Value", value: fmt(priceAssessment.fairMarketTradeIn) },
  );
  const pcW = (contentW - (priceCards.length - 1) * 3) / priceCards.length;
  ensureSpace(16);
  priceCards.forEach((pc, i) => {
    const x = M + i * (pcW + 3);
    pdf.setDrawColor(200, 210, 220);
    pdf.roundedRect(x, y, pcW, 13, 2, 2, "S");
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.text(pc.label, x + 4, y + 5);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...BLACK);
    pdf.text(pc.value, x + 4, y + 11);
    pdf.setFont("helvetica", "normal");
  });
  y += 17;

  // Pricing sources
  if (deduplicatedSources.length > 0) {
    ensureSpace(10);
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Sources: ${deduplicatedSources.map(s => s.displayName).join(", ")}`, M, y);
    y += 5;
  }

  // ══════════════════════════════════════════════
  // FUEL ECONOMY & TOTAL COST OF OWNERSHIP
  // ══════════════════════════════════════════════
  if (tcoData) {
    const { tco, annualMiles } = tcoData;
    sectionTitle(`Fuel Economy & Ownership Cost (${annualMiles.toLocaleString()} mi/yr)`);

    // TCO summary box
    ensureSpace(22);
    pdf.setFillColor(...BG_MUTED);
    pdf.roundedRect(M, y, contentW, 18, 3, 3, "F");

    const tcoColW = contentW / 3;
    const tcoItems = [
      { label: "Total 5-Year Cost", value: fmt(tco.totalTCO), color: RED },
      { label: "Cost Per Mile", value: `$${tco.costPerMile.toFixed(2)}`, color: RED },
      { label: "Monthly Ownership", value: `${fmt(Math.round((tco.annualFuelCost / 12) + (tco.repairCost5Year / 60) + (tco.maintenanceCost5Year / 60)))}/mo`, color: BLACK },
    ];
    tcoItems.forEach((item, i) => {
      const x = M + i * tcoColW + 5;
      pdf.setFontSize(7);
      pdf.setTextColor(...SLATE);
      pdf.text(item.label, x, y + 6);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...item.color);
      pdf.text(item.value, x, y + 13);
      pdf.setFont("helvetica", "normal");
    });
    y += 22;

    // TCO Breakdown table
    const breakdownItems: [string, number][] = [
      ["Purchase Price", tco.purchasePrice],
      [`5-Year ${tco.fuelCost5Year > 0 ? "Fuel" : "Energy"} Cost`, tco.fuelCost5Year],
      [`5-Year Repairs${tco.worstCaseRepairCost5Year > 0 && tco.worstCaseRepairCost5Year !== tco.repairCost5Year ? ` (worst case: ${fmt(tco.worstCaseRepairCost5Year)})` : ""}`, tco.repairCost5Year],
      ["5-Year Maintenance", tco.maintenanceCost5Year || 0],
    ];
    if (tco.mileageDepreciation && tco.mileageDepreciation > 0) {
      breakdownItems.push(["Excess Mileage Depreciation", tco.mileageDepreciation]);
    }

    ensureSpace(breakdownItems.length * 7 + 14);
    // Header row
    pdf.setFillColor(...TEAL);
    pdf.rect(M, y, contentW, 7, "F");
    pdf.setTextColor(...WHITE);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("Category", M + 3, y + 5);
    pdf.text("Amount", M + contentW - 35, y + 5);
    y += 9;

    breakdownItems.forEach(([label, amount], idx) => {
      if (idx % 2 === 0) {
        pdf.setFillColor(...BG_MUTED);
        pdf.rect(M, y - 3, contentW, 7, "F");
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...BLACK);
      pdf.text(label, M + 3, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(fmt(amount), M + contentW - 35, y);
      y += 7;
    });

    // Total row
    pdf.setFillColor(...TEAL);
    pdf.rect(M, y - 3, contentW, 8, "F");
    pdf.setTextColor(...WHITE);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("Total Cost of Ownership", M + 3, y + 1);
    pdf.text(fmt(tco.totalTCO), M + contentW - 35, y + 1);
    y += 12;

    // Footnotes
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Based on ${annualMiles.toLocaleString()} miles/year over 5 years.`, M, y);
    y += 4;
    if (tco.mileageDepreciation && tco.mileageDepreciation > 0) {
      pdf.text("Excess mileage depreciation: ~$0.18/mile above 12,000 mi/yr baseline.", M, y);
      y += 4;
    }
  }

  // ══════════════════════════════════════════════
  // UVPRS RISK SCORE BREAKDOWN
  // ══════════════════════════════════════════════
  if (uvprsResult) {
    sectionTitle("Purchase Risk Score (UVPRS)");

    // Score header box
    ensureSpace(18);
    pdf.setFillColor(...BG_MUTED);
    pdf.roundedRect(M, y, contentW, 14, 3, 3, "F");

    const scoreColor = uvprsResult.riskLevel === "low" ? GREEN : uvprsResult.riskLevel === "moderate" ? AMBER : RED;
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...scoreColor);
    pdf.text(`${uvprsResult.totalScore}`, M + 5, y + 9);
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE);
    pdf.text("/ 100", M + 20, y + 9);

    // Risk label badge
    pdf.setFillColor(...scoreColor);
    pdf.roundedRect(M + 36, y + 3, 28, 8, 2, 2, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...WHITE);
    pdf.text(uvprsResult.riskLabel, M + 39, y + 8);

    // Known factors
    pdf.setTextColor(...SLATE);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${uvprsResult.knownFactorCount} of ${uvprsResult.factors.length} factors verified`, M + 70, y + 9);
    y += 18;

    // Factor breakdown table
    const factorColWidths = [50, 18, 18, contentW - 86];
    const factorHeaders = ["Factor", "Weight", "Score", "Detail"];

    ensureSpace(uvprsResult.factors.length * 7 + 12);
    pdf.setFillColor(...TEAL);
    pdf.rect(M, y, contentW, 7, "F");
    pdf.setTextColor(...WHITE);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    let fxPos = M;
    factorHeaders.forEach((h, i) => {
      pdf.text(h, fxPos + 2, y + 5);
      fxPos += factorColWidths[i];
    });
    y += 9;

    uvprsResult.factors.forEach((factor, idx) => {
      ensureSpace(8);
      if (idx % 2 === 0) {
        pdf.setFillColor(...BG_MUTED);
        pdf.rect(M, y - 3, contentW, 7, "F");
      }

      fxPos = M;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      // Label
      pdf.setTextColor(...BLACK);
      pdf.text(factor.label + (factor.known ? "" : " *"), fxPos + 2, y);
      fxPos += factorColWidths[0];

      // Weight
      pdf.setTextColor(...SLATE);
      pdf.text(`${Math.round(factor.weight * 100)}%`, fxPos + 2, y);
      fxPos += factorColWidths[1];

      // Score with 3-tier color
      const fColor: [number, number, number] =
        factor.score <= 33 ? GREEN :
        factor.score <= 67 ? AMBER :
        RED;
      pdf.setTextColor(...fColor);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${Math.round(factor.score)}`, fxPos + 2, y);
      fxPos += factorColWidths[2];

      // Description
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...SLATE);
      const descLines = pdf.splitTextToSize(factor.description, factorColWidths[3] - 4);
      pdf.text(descLines[0] || "", fxPos + 2, y);
      y += 7;
    });

    if (uvprsResult.knownFactorCount < uvprsResult.factors.length) {
      y += 2;
      pdf.setFontSize(7);
      pdf.setTextColor(...SLATE);
      pdf.text("* Unknown factors use neutral score; weight redistributed to known factors.", M, y);
      y += 5;
    }

    // Warning when no history report was provided
    if (hasServiceRecords === false) {
      ensureSpace(12);
      pdf.setFillColor(255, 240, 240);
      pdf.roundedRect(M, y, contentW, 9, 2, 2, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...RED);
      pdf.text("! Risk Score adversely affected because no available CarFax/AutoCheck was provided by user", M + 4, y + 6);
      pdf.setFont("helvetica", "normal");
      y += 12;
    }
  }

  // ══════════════════════════════════════════════
  // VEHICLE HEALTH SCORE
  // ══════════════════════════════════════════════
  sectionTitle("Vehicle Health");

  ensureSpace(14);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...BLACK);
  pdf.text(`${historyAnalysis.healthScore}`, M + 5, y + 2);
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE);
  pdf.text("/ 100", M + 20, y + 2);

  // Progress bar
  const barY = y + 5;
  pdf.setFillColor(230, 230, 230);
  pdf.roundedRect(M, barY, contentW, 3, 1.5, 1.5, "F");
  const healthColor = historyAnalysis.healthScore >= 70 ? GREEN : historyAnalysis.healthScore >= 40 ? AMBER : RED;
  pdf.setFillColor(...healthColor);
  pdf.roundedRect(M, barY, contentW * (historyAnalysis.healthScore / 100), 3, 1.5, 1.5, "F");
  y += 14;

  // Positives
  if (historyAnalysis.positives.length > 0) {
    wrappedText("Positives:", 9, GREEN, true);
    historyAnalysis.positives.forEach((item) => bulletItem(item, SLATE));
  }

  // Concerns
  if (historyAnalysis.concerns.length > 0) {
    wrappedText("Concerns:", 9, RED, true);
    historyAnalysis.concerns.forEach((item) => bulletItem(item, SLATE));
  }

  // ══════════════════════════════════════════════
  // SERVICE HISTORY
  // ══════════════════════════════════════════════
  const hasSvcData =
    (serviceHistory?.majorServicesDone?.length ?? 0) > 0 ||
    (serviceHistory?.majorServicesDue?.length ?? 0) > 0 ||
    (serviceHistory?.chronicRepairSystems?.length ?? 0) > 0 ||
    serviceHistory?.serviceGapMiles != null;

  if (hasSvcData) {
    sectionTitle("Service History");

    if (serviceHistory?.serviceGapMiles != null) {
      const gap = serviceHistory.serviceGapMiles;
      const gapColor = gap <= 10000 ? GREEN : gap <= 20000 ? AMBER : RED;
      ensureSpace(12);
      pdf.setFillColor(...BG_MUTED);
      pdf.roundedRect(M, y, contentW, 10, 2, 2, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...gapColor);
      pdf.text(`Largest service gap: ${gap.toLocaleString()} miles`, M + 4, y + 6);
      pdf.setFont("helvetica", "normal");
      y += 14;
    }

    // Done items
    if (serviceHistory?.majorServicesDone?.length) {
      serviceHistory.majorServicesDone.forEach((s) => {
        wrappedText(`${s}  [Completed]`, 8, GREEN, false, 4);
      });
    }
    // Due items
    if (serviceHistory?.majorServicesDue?.length) {
      serviceHistory.majorServicesDue.forEach((s) => {
        wrappedText(`${s}  [Overdue]`, 8, AMBER, false, 4);
      });
    }
    // Chronic items
    if (serviceHistory?.chronicRepairSystems?.length) {
      serviceHistory.chronicRepairSystems.forEach((s) => {
        wrappedText(`Chronic: ${s}  [Repeat Issue]`, 8, RED, false, 4);
      });
    }
  }

  // ══════════════════════════════════════════════
  // 5-YEAR DEPRECIATION & EQUITY — CHART + TABLE
  // ══════════════════════════════════════════════
  sectionTitle("5-Year Depreciation & Equity");

  // Market Verified badge for depreciation section
  if (deduplicatedSources.length > 0) {
    ensureSpace(6);
    pdf.setFillColor(...GREEN);
    pdf.roundedRect(M, y - 3, 30, 6, 2, 2, "F");
    pdf.setFontSize(6);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...WHITE);
    pdf.text("Market Verified", M + 2, y);
    y += 5;
  }

  // ── LINE CHART (drawn with jsPDF primitives) ──
  if (depreciationTable.length > 0) {
    const chartH = 55;
    const chartW = contentW;
    const chartM = { left: 25, right: 8, top: 8, bottom: 14 };
    const plotW = chartW - chartM.left - chartM.right;
    const plotH = chartH - chartM.top - chartM.bottom;

    ensureSpace(chartH + 6);

    const chartX = M;
    const chartY = y;

    // Background
    pdf.setFillColor(250, 251, 252);
    pdf.roundedRect(chartX, chartY, chartW, chartH, 2, 2, "F");

    // Gather data series
    const privateVals = depreciationTable.map(r => r.privateValue);
    const tradeInVals = depreciationTable.map(r => r.tradeInValue);
    const loanVals = depreciationTable.map(r => r.loanBalance);
    const allVals = [...privateVals, ...tradeInVals, ...loanVals];
    const maxVal = Math.max(...allVals);
    const minVal = Math.min(0, Math.min(...allVals));
    const range = maxVal - minVal || 1;

    const toPlotX = (i: number) => chartX + chartM.left + (i / Math.max(1, depreciationTable.length - 1)) * plotW;
    const toPlotY = (v: number) => chartY + chartM.top + plotH - ((v - minVal) / range) * plotH;

    // Grid lines & Y-axis labels
    pdf.setDrawColor(220, 225, 230);
    pdf.setLineWidth(0.2);
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const val = minVal + (range * i) / yTicks;
      const py = toPlotY(val);
      pdf.line(chartX + chartM.left, py, chartX + chartM.left + plotW, py);
      pdf.setFontSize(6);
      pdf.setTextColor(...SLATE);
      pdf.text(`$${(val / 1000).toFixed(0)}k`, chartX + 2, py + 1);
    }

    // X-axis labels
    depreciationTable.forEach((row, i) => {
      const px = toPlotX(i);
      pdf.setFontSize(6);
      pdf.setTextColor(...SLATE);
      pdf.text(`Yr ${row.year}`, px - 4, chartY + chartH - 3);
    });

    // Draw lines
    const drawLine = (values: number[], color: [number, number, number], dashed = false) => {
      pdf.setDrawColor(...color);
      pdf.setLineWidth(0.6);
      for (let i = 0; i < values.length - 1; i++) {
        const x1 = toPlotX(i), y1 = toPlotY(values[i]);
        const x2 = toPlotX(i + 1), y2 = toPlotY(values[i + 1]);
        if (dashed) {
          // Draw dashed line manually
          const dx = x2 - x1, dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const dashLen = 1.5, gapLen = 1;
          let d = 0;
          while (d < len) {
            const start = d / len;
            const end = Math.min((d + dashLen) / len, 1);
            pdf.line(x1 + dx * start, y1 + dy * start, x1 + dx * end, y1 + dy * end);
            d += dashLen + gapLen;
          }
        } else {
          pdf.line(x1, y1, x2, y2);
        }
      }
      // Draw dots
      values.forEach((v, i) => {
        pdf.setFillColor(...color);
        pdf.circle(toPlotX(i), toPlotY(v), 0.8, "F");
      });
    };

    drawLine(privateVals, GREEN);
    drawLine(tradeInVals, AMBER);
    drawLine(loanVals, TEAL, true);

    // Legend
    const legendY = chartY + chartH - 3;
    const legends = [
      { label: "Private Value", color: GREEN },
      { label: "Trade-In Value", color: AMBER },
      { label: "Loan Balance", color: TEAL },
    ];
    let legendX = chartX + chartM.left + 10;
    legends.forEach((lg) => {
      pdf.setFillColor(...lg.color);
      pdf.rect(legendX, legendY - 2, 4, 2, "F");
      pdf.setFontSize(6);
      pdf.setTextColor(...SLATE);
      pdf.text(lg.label, legendX + 6, legendY);
      legendX += 35;
    });

    y += chartH + 6;
  }

  // Depreciation table
  const cols = ["Year", "Private Value", "Trade-In", "Loan Bal.", "Repairs", "Maint.", "Net Position"];
  const colWidths = [20, 28, 28, 28, 24, 24, 28];

  ensureSpace(depreciationTable.length * 7 + 12);
  pdf.setFillColor(...TEAL);
  pdf.rect(M, y, contentW, 7, "F");
  pdf.setTextColor(...WHITE);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  let xPos = M;
  cols.forEach((col, i) => {
    pdf.text(col, xPos + 2, y + 5);
    xPos += colWidths[i];
  });
  y += 9;

  let cumulativeRepairs = 0;
  let cumulativeMaintenance = 0;
  const purchasePrice = data.vehicle.purchasePrice ?? data.vehicle.askingPrice;
  depreciationTable.forEach((row, index) => {
    cumulativeRepairs += row.repairCosts;
    cumulativeMaintenance += (row.maintenanceCosts || 0);
    const netPosition = row.privateValue - purchasePrice - cumulativeRepairs - cumulativeMaintenance;

    ensureSpace(8);
    if (index % 2 === 0) {
      pdf.setFillColor(...BG_MUTED);
      pdf.rect(M, y - 3, contentW, 7, "F");
    }

    xPos = M;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);

    const rowData = [
      `Year ${row.year}`,
      fmt(row.privateValue),
      fmt(row.tradeInValue),
      fmt(row.loanBalance),
      fmt(row.repairCosts),
      fmt(row.maintenanceCosts || 0),
      `${netPosition >= 0 ? "+" : ""}${fmt(netPosition)}`,
    ];

    rowData.forEach((cell, i) => {
      if (i === 4) {
        pdf.setTextColor(...RED);
      } else if (i === 5) {
        pdf.setTextColor(...SLATE);
      } else if (i === 6) {
        pdf.setTextColor(netPosition >= 0 ? 34 : 220, netPosition >= 0 ? 197 : 38, netPosition >= 0 ? 94 : 38);
        pdf.setFont("helvetica", "bold");
      } else {
        pdf.setTextColor(...BLACK);
      }
      pdf.text(cell, xPos + 2, y);
      xPos += colWidths[i];
    });
    y += 7;
  });

  // Cost data sources after depreciation table
  if (deduplicatedSources.length > 0) {
    ensureSpace(10);
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Repair & Maintenance Cost Sources: ${deduplicatedSources.map(s => s.displayName).join(", ")}`, M, y);
    y += 5;
  }

  // ══════════════════════════════════════════════
  // RISK FACTORS
  // ══════════════════════════════════════════════
  sectionTitle("Risk Factors");

  wrappedText("Depreciation Risk:", 9, BLACK, true);
  wrappedText(riskAssessment.depreciationRisk, 9, SLATE);

  if (riskAssessment.reliabilityConcerns.length > 0) {
    wrappedText("Reliability Concerns:", 9, BLACK, true);
    riskAssessment.reliabilityConcerns.forEach((item) => {
      let text = item.concern;
      if (item.costLow || item.costHigh) {
        text += ` - Est. ${item.costLow && item.costHigh 
          ? `$${item.costLow.toLocaleString()}-$${item.costHigh.toLocaleString()}`
          : item.costLow ? `$${item.costLow.toLocaleString()}+` 
          : `Up to $${item.costHigh!.toLocaleString()}`}`;
      }
      bulletItem(text, SLATE);
    });
  }

  if (riskAssessment.valueProposition) {
    ensureSpace(16);
    pdf.setFillColor(...BG_MUTED);
    const vpLines = pdf.splitTextToSize(riskAssessment.valueProposition, contentW - 8);
    const vpH = Math.max(12, vpLines.length * 3.5 + 8);
    pdf.roundedRect(M, y, contentW, vpH, 2, 2, "F");
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...BLACK);
    pdf.text("Value Proposition", M + 4, y + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...SLATE);
    pdf.text(vpLines, M + 4, y + 10);
    y += vpH + 4;
  }

  // Cost data sources after risk factors
  if (deduplicatedSources.length > 0) {
    ensureSpace(10);
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Cost Data Sources: ${deduplicatedSources.map(s => s.displayName).join(", ")}`, M, y);
    y += 5;
  }

  // ══════════════════════════════════════════════
  // EXPERT OPINION
  // ══════════════════════════════════════════════
  sectionTitle("Expert Opinion");
  wrappedText(riskAssessment.expertOpinion, 9, SLATE);

  // ══════════════════════════════════════════════
  // DEALER REVIEW (Pro only)
  // ══════════════════════════════════════════════
  if (dealerReview) {
    sectionTitle("Dealership Review");

    wrappedText(dealerReview.dealerName, 10, BLACK, true);

    ensureSpace(18);
    const dsColor: [number, number, number] =
      dealerReview.trustScore >= 70 ? GREEN :
      dealerReview.trustScore >= 50 ? AMBER : RED;

    pdf.setFillColor(...BG_MUTED);
    pdf.roundedRect(M, y, 55, 14, 2, 2, "F");
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.text("Trust Score", M + 4, y + 5);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...dsColor);
    pdf.text(`${dealerReview.trustScore}/100`, M + 4, y + 12);

    // Sentiment badge
    const sentimentText = dealerReview.sentiment.charAt(0).toUpperCase() + dealerReview.sentiment.slice(1);
    const sentimentColor: [number, number, number] =
      dealerReview.sentiment === "positive" ? GREEN :
      dealerReview.sentiment === "mixed" ? AMBER :
      dealerReview.sentiment === "negative" ? RED : SLATE;
    pdf.setFillColor(...sentimentColor);
    pdf.roundedRect(M + 60, y + 3, 26, 8, 2, 2, "F");
    pdf.setFontSize(7);
    pdf.setTextColor(...WHITE);
    pdf.text(sentimentText, M + 63, y + 8);
    y += 18;

    wrappedText(dealerReview.summary, 9, SLATE);

    if (dealerReview.positives.length > 0) {
      wrappedText("Positives:", 9, GREEN, true);
      dealerReview.positives.forEach((item) => bulletItem(item, SLATE));
    }
    if (dealerReview.watchOuts.length > 0) {
      wrappedText("Watch Out:", 9, RED, true);
      dealerReview.watchOuts.forEach((item) => bulletItem(item, SLATE));
    }
    if (dealerReview.sources.length > 0) {
      y += 2;
      pdf.setFontSize(7);
      pdf.setTextColor(...SLATE);
      pdf.text(`Sources: ${dealerReview.sources.join(", ")}`, M, y);
      y += 5;
    }
  }

  // ══════════════════════════════════════════════
  // WARRANTY ANALYSIS
  // ══════════════════════════════════════════════
  if (warrantyAnalysis) {
    sectionTitle("Warranty Analysis");

    ensureSpace(22);
    const waColor: [number, number, number] = warrantyAnalysis.warrantyStatus === "active" ? GREEN
      : warrantyAnalysis.warrantyStatus === "expired" ? RED : AMBER;

    // Status + Risk Reduction row
    pdf.setFillColor(...BG_MUTED);
    pdf.roundedRect(M, y, contentW, 16, 3, 3, "F");

    pdf.setFontSize(8);
    pdf.setTextColor(...SLATE);
    pdf.text("Warranty Status", M + 5, y + 5);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...waColor);
    const statusLabel = warrantyAnalysis.warrantyStatus.charAt(0).toUpperCase() + warrantyAnalysis.warrantyStatus.slice(1);
    pdf.text(statusLabel, M + 5, y + 12);

    if (warrantyAnalysis.warrantyMonthsRemaining != null) {
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...SLATE);
      pdf.text("Months Remaining", M + 50, y + 5);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...BLACK);
      pdf.text(`${warrantyAnalysis.warrantyMonthsRemaining}`, M + 50, y + 12);
    }

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...SLATE);
    pdf.text("Risk Reduction", M + 95, y + 5);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...(warrantyAnalysis.riskReductionFactor >= 50 ? GREEN : warrantyAnalysis.riskReductionFactor >= 20 ? AMBER : RED));
    pdf.text(`${warrantyAnalysis.riskReductionFactor}%`, M + 95, y + 12);

    pdf.setFont("helvetica", "normal");
    y += 20;

    // Warranty notes
    if (warrantyAnalysis.warrantyNotes) {
      wrappedText(warrantyAnalysis.warrantyNotes, 9, SLATE);
    }
  }

  // ══════════════════════════════════════════════
  // NHTSA SAFETY RECALLS
  // ══════════════════════════════════════════════
  if (recallData) {
    sectionTitle("NHTSA Safety Recalls");

    const hasOpenRecalls = recallData.openCount > 0;
    const recallStatusColor: [number, number, number] = hasOpenRecalls ? RED : GREEN;

    // Status banner
    ensureSpace(12);
    pdf.setFillColor(...(hasOpenRecalls ? [255, 240, 240] as [number, number, number] : [240, 255, 245] as [number, number, number]));
    pdf.roundedRect(M, y, contentW, 10, 2, 2, "F");
    pdf.setDrawColor(...recallStatusColor);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(M, y, contentW, 10, 2, 2, "S");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...recallStatusColor);
    const recallStatusText = hasOpenRecalls
      ? `⚠  ${recallData.openCount} Open ${recallData.openCount === 1 ? "Recall" : "Recalls"} Found`
      : recallData.count > 0
      ? `✓  All ${recallData.count} Recall${recallData.count !== 1 ? "s" : ""} Resolved`
      : "✓  No Recalls on Record";
    pdf.text(recallStatusText, M + 4, y + 7);
    pdf.setFont("helvetica", "normal");
    y += 14;

    if (hasOpenRecalls) {
      ensureSpace(8);
      pdf.setFontSize(8);
      pdf.setTextColor(...SLATE);
      pdf.text("Ensure all open recalls have been resolved before purchasing.", M, y);
      y += 6;
    }

    // Individual recalls
    recallData.recalls.forEach((recall, idx) => {
      ensureSpace(20);
      // Alternating row bg
      if (idx % 2 === 0) {
        pdf.setFillColor(...BG_MUTED);
        pdf.roundedRect(M, y - 1, contentW, 14, 1, 1, "F");
      }
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...BLACK);
      const component = recall.component || `Recall #${idx + 1}`;
      pdf.text(component, M + 3, y + 5);

      if (recall.campaignNumber) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(...SLATE);
        pdf.text(`Campaign: ${recall.campaignNumber}`, M + contentW - 65, y + 5);
      }
      y += 7;

      // Summary
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...SLATE);
      const summaryLines = pdf.splitTextToSize(recall.summary || "", contentW - 6);
      ensureSpace(summaryLines.length * 3.5 + 2);
      pdf.text(summaryLines, M + 3, y);
      y += summaryLines.length * 3.5 + 3;

      // Remedy
      if (recall.remedyDescription) {
        ensureSpace(10);
        pdf.setFillColor(245, 248, 250);
        const remLines = pdf.splitTextToSize(`Remedy: ${recall.remedyDescription}`, contentW - 10);
        pdf.roundedRect(M + 3, y - 1, contentW - 3, remLines.length * 3.5 + 5, 1, 1, "F");
        pdf.setFontSize(7);
        pdf.setTextColor(...SLATE);
        pdf.text(remLines, M + 6, y + 3);
        y += remLines.length * 3.5 + 6;
      }
      y += 2;
    });

    // NHTSA link note
    const nhtsaUrl = vin
      ? `nhtsa.gov/vehicle/${vin}/complaints`
      : "nhtsa.gov/vehicle-safety/recalls";
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Source: ${nhtsaUrl}`, M, y);
    y += 6;
  }

  // ══════════════════════════════════════════════
  // FINAL VERDICT & RECOMMENDATION
  y += 5;

  if (finalVerdict) {
    const verdictColor: [number, number, number] = finalVerdict.verdict === "Buy" ? GREEN
      : finalVerdict.verdict === "Negotiate" ? AMBER : RED;

    pdf.setDrawColor(...verdictColor);
    pdf.setLineWidth(0.8);
    pdf.roundedRect(M, y, contentW, 36, 3, 3, "S");

    // Verdict badge
    const verdictText = finalVerdict.verdict.toUpperCase();
    pdf.setFillColor(...verdictColor);
    const vBadgeW = pdf.getStringUnitWidth(verdictText) * 9 / pdf.internal.scaleFactor + 10;
    pdf.roundedRect(M + (contentW - vBadgeW) / 2, y + 3, vBadgeW, 9, 2, 2, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...WHITE);
    pdf.text(verdictText, M + (contentW - vBadgeW) / 2 + 5, y + 9);

    // Justification
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...SLATE);
    const justLines = pdf.splitTextToSize(finalVerdict.justification, contentW - 20);
    pdf.text(justLines, M + 10, y + 17);

    // Fair offer
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE);
    const foLabel = "Fair Offer Price";
    pdf.text(foLabel, M + (contentW - pdf.getStringUnitWidth(foLabel) * 9 / pdf.internal.scaleFactor) / 2, y + 25);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...BLACK);
    const fairOfferStr = fmt(riskAssessment.fairOfferPrice);
    pdf.text(fairOfferStr, M + (contentW - pdf.getStringUnitWidth(fairOfferStr) * 14 / pdf.internal.scaleFactor) / 2, y + 33);

    y += 40;
  } else {
    // Fallback: derive Buy/Negotiate/Walk Away from risk level
    const riskLevel = uvprsResult
      ? uvprsResult.riskLevel
      : riskAssessment.level;

    let derivedVerdict: "Buy" | "Negotiate" | "Walk Away";
    let derivedJustification: string;

    if (riskLevel === "low") {
      derivedVerdict = "Buy";
      derivedJustification = "This vehicle shows low risk indicators across pricing, history, and reliability factors. The deal aligns well with market values and presents a sound purchase opportunity.";
    } else if (riskLevel === "medium" || riskLevel === "moderate") {
      derivedVerdict = "Negotiate";
      derivedJustification = "This vehicle has moderate risk factors that warrant negotiation. Consider leveraging the identified concerns to negotiate a better price closer to the fair offer value.";
    } else {
      derivedVerdict = "Walk Away";
      derivedJustification = "This vehicle presents significant risk flags including pricing, history, or reliability concerns. The risks outweigh potential value at the current asking price.";
    }

    const verdictColor: [number, number, number] = derivedVerdict === "Buy" ? GREEN
      : derivedVerdict === "Negotiate" ? AMBER : RED;

    pdf.setDrawColor(...verdictColor);
    pdf.setLineWidth(0.8);
    pdf.roundedRect(M, y, contentW, 36, 3, 3, "S");

    // Verdict badge
    const verdictText = derivedVerdict.toUpperCase();
    pdf.setFillColor(...verdictColor);
    const vBadgeW = pdf.getStringUnitWidth(verdictText) * 9 / pdf.internal.scaleFactor + 10;
    pdf.roundedRect(M + (contentW - vBadgeW) / 2, y + 3, vBadgeW, 9, 2, 2, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...WHITE);
    pdf.text(verdictText, M + (contentW - vBadgeW) / 2 + 5, y + 9);

    // Justification
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...SLATE);
    const justLines = pdf.splitTextToSize(derivedJustification, contentW - 20);
    pdf.text(justLines, M + 10, y + 17);

    // Fair offer
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE);
    const foLabel = "Fair Offer Price";
    pdf.text(foLabel, M + (contentW - pdf.getStringUnitWidth(foLabel) * 9 / pdf.internal.scaleFactor) / 2, y + 25);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...BLACK);
    const fairOfferStr = fmt(riskAssessment.fairOfferPrice);
    pdf.text(fairOfferStr, M + (contentW - pdf.getStringUnitWidth(fairOfferStr) * 14 / pdf.internal.scaleFactor) / 2, y + 33);

    y += 40;
  }

  // ── Footer on last page ──
  addFooter();

  // Save
  const fileName = `CarWise_Report_${vehicle.year}_${vehicle.make}_${vehicle.model}.pdf`;
  pdf.save(fileName);
}

// Alternative: Generate PDF from HTML element
export async function generatePDFFromElement(elementId: string, fileName: string): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element with id "${elementId}" not found`);

  const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
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
