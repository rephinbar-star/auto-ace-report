import type { MonthlyOwnershipBreakdown } from "@/lib/tco-calculations";

interface MonthlyOwnershipCostCardProps {
  monthlyCostRange: string;
  breakdown: MonthlyOwnershipBreakdown;
  isElectric: boolean;
  hasFinancing: boolean;
}

export function MonthlyOwnershipCostCard({
  monthlyCostRange,
  breakdown,
  isElectric,
  hasFinancing,
}: MonthlyOwnershipCostCardProps) {
  const rows: Array<{ label: string; value: string }> = [];

  if (hasFinancing && breakdown.monthlyPayment > 0) {
    rows.push({ label: "Loan Payment", value: `$${breakdown.monthlyPayment.toLocaleString()}` });
  } else {
    rows.push({ label: "Loan Payment", value: "—" });
  }

  rows.push({
    label: isElectric ? "Electricity" : "Fuel",
    value: `$${breakdown.fuel.toLocaleString()}`,
  });

  if (breakdown.insuranceLow > 0) {
    const insuranceVal =
      breakdown.insuranceHigh > 0 && breakdown.insuranceHigh !== breakdown.insuranceLow
        ? `$${breakdown.insuranceLow.toLocaleString()} – $${breakdown.insuranceHigh.toLocaleString()}`
        : `$${breakdown.insuranceLow.toLocaleString()}`;
    rows.push({ label: "Insurance", value: insuranceVal });
  }

  rows.push({ label: "Maintenance", value: `$${breakdown.maintenance.toLocaleString()}` });
  rows.push({ label: "Expected Repairs", value: `$${breakdown.repairs.toLocaleString()}` });

  const totalVal =
    breakdown.totalHigh > 0 && breakdown.totalHigh !== breakdown.totalLow
      ? `$${breakdown.totalLow.toLocaleString()} – $${breakdown.totalHigh.toLocaleString()}`
      : `$${breakdown.totalLow.toLocaleString()}`;

  const handleScrollTo = (targetId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <div id="section-financials" className="bg-card border border-border rounded-xl p-4 md:p-6">
        {/* Headline */}
        <p className="text-xs uppercase tracking-[0.08em] text-neutral mb-1">
          Estimated Monthly Ownership Cost
        </p>
        <p className="text-[32px] font-bold text-foreground leading-tight">
          {totalVal} / month
        </p>
        <p className="text-[13px] text-neutral mt-1">
          All-in: payment + {isElectric ? "electricity" : "fuel"} + maintenance + insurance + expected repairs
        </p>

        {/* Component Breakdown */}
        <div className="mt-6">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-3 text-[14px]"
              style={i < rows.length - 1 ? { borderBottom: "1px solid hsl(var(--border))" } : undefined}
            >
              <span className="text-foreground">{row.label}</span>
              <span className="font-semibold text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Divider + Total */}
        <div className="border-t border-border my-4" />
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground">Total Monthly Cost</span>
          <span className="text-[15px] font-semibold text-foreground">{totalVal}</span>
        </div>

        {/* Footnote */}
        <p className="text-[11px] text-muted-foreground mt-2">
          Repair estimate is probability-weighted. Range reflects expected cost (low) to maximum plausible scenario (high).
        </p>
      </div>

      {/* Links below the card */}
      <div className="flex items-center gap-4 mt-3">
        <a
          href="#section-tco"
          onClick={handleScrollTo("section-tco")}
          className="text-[13px] text-neutral hover:text-foreground hover:underline transition-colors"
        >
          View 5-year cost breakdown ↓
        </a>
        <a
          href="#section-financing"
          onClick={handleScrollTo("section-financing")}
          className="text-[13px] text-neutral hover:text-foreground hover:underline transition-colors"
        >
          Edit financing details ↓
        </a>
      </div>
    </div>
  );
}
