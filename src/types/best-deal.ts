/** Shared contract between the `find-best-deals` edge function and the UI. */

export type DealTypeFilter = "any" | "lease" | "purchase";
export type VehicleTypeFilter = "any" | "sedan" | "truck" | "suv";
export type PowertrainFilter = "any" | "ev" | "hybrid" | "gas";
export type MileageFilter = "any" | "7500" | "10000" | "12000" | "15000";

export interface PurchaseAssumptions {
  termMonths: 48 | 60 | 72 | 84;
  aprPercent: number;
  downPayment: number;
}

export const DEFAULT_PURCHASE_ASSUMPTIONS: PurchaseAssumptions = {
  termMonths: 72,
  aprPercent: 7.49,
  downPayment: 0,
};

export type { LeaseAssumptions, LeaseTermMonths } from "@/lib/best-deal/deal-math";
export {
  DEFAULT_LEASE_ASSUMPTIONS,
  LEASE_TERM_CHOICES,
  validateLeaseAssumptions,
  estimateLeasePayment,
} from "@/lib/best-deal/deal-math";

import type { LeaseAssumptions } from "@/lib/best-deal/deal-math";

export interface BestDealSearchParams {
  dealType: DealTypeFilter;
  maxMonthlyPayment: number | null;
  annualMileage: MileageFilter;
  maxDueAtSigning: number | null;
  vehicleType: VehicleTypeFilter;
  powertrain: PowertrainFilter;
  zip: string;
  radius: 25 | 50 | 100;
  brand: string | null;
  /** Purchase-only finance assumptions used for CarWise purchase estimates. */
  purchaseAssumptions: PurchaseAssumptions;
  /** Lease-only assumptions used for CarWise lease estimates. */
  leaseAssumptions: LeaseAssumptions;
}

export type ValidationStatus =
  | "corroborated_numeric"
  | "editorial_match"
  | "no_comparable_match"
  | "unavailable"
  | "not_applicable";

export interface ValidationResult {
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  status: ValidationStatus;
  matchBasis: string;
  note: string;
}

export interface DealEvidence {
  label: string;
  detail: string;
}

export interface BestDeal {
  rank: number;
  listingId: string;
  vin: string | null;
  dealType: "lease" | "purchase";
  score: number;
  badge: "Exceptional" | "Strong" | "Worth a look";

  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  heading: string | null;
  inventoryType: string | null;

  imageUrl: string | null;
  dealerName: string | null;
  city: string | null;
  state: string | null;
  distanceMiles: number | null;
  vdpUrl: string | null;
  domActive: number | null;

  price: number | null;
  msrp: number | null;
  discountFromMsrp: number | null;
  discountPercent: number | null;
  cohortAdvantagePercent: number | null;

  monthlyPayment: number | null;
  paymentBasis: "advertised" | "estimated";
  paymentLabel: string;
  termMonths: number | null;
  advertisedDownPayment: number | null;
  effectiveMonthly: number | null;
  leaseValueRatio: number | null;
  assumedAprPercent: number | null;
  assumedDownPayment: number | null;

  mileageNote: string | null;
  evidence: DealEvidence[];
  dataSource: string;
  retrievedAt: string;
  validations: ValidationResult[];
}

export type {
  ProgramTermRecord,
  ResolvedProgramTerms,
  ResolvedAssumption,
  GlobalPrefill,
  TermAuthority,
  ParsedLenderTerms,
} from "@/lib/best-deal/program-terms";

export type {
  NormalizedOffer,
  OfferSourceType,
  OfferConfidence,
  SourceCheck,
  SourceCheckStatus,
  SourceCitation,
} from "@/lib/best-deal/offer-normalization";

import type { NormalizedOffer, SourceCheck } from "@/lib/best-deal/offer-normalization";
import type { GlobalPrefill } from "@/lib/best-deal/program-terms";

export interface BestDealResponse {
  success: boolean;
  error?: string;
  errorCode?:
    | "invalid_request"
    | "not_configured"
    | "upstream_error"
    | "rate_limited"
    | "internal_error";
  deals: BestDeal[];
  candidatesEvaluated: number;
  leaseCandidates: number;
  purchaseCandidates: number;
  retrievedAt: string;
  notices: string[];
  validationSources: { sourceName: string; sourceUrl: string; status: ValidationStatus }[];
  /** Published programs/offers from non-inventory sources (never shown as in stock). */
  programs?: NormalizedOffer[];
  /** Per-source outcome for the "Sources checked" summary. */
  sourcesChecked?: SourceCheck[];
  sourceSummary?: { success: number; noMatch: number; unavailable: number; notConfigured: number };
  /** Resolved lease tax rate and where it came from (user override vs ZIP). */
  taxResolution?: {
    ratePercent: number | null;
    label: string;
    sourceName: string;
    sourceUrl: string | null;
    asOf: string;
    confidence: "high" | "medium" | "low";
    origin: "user" | "auto_zip";
    note: string | null;
  };
  /** Global Advanced-assumptions prefill, only when every result agrees. */
  assumptionPrefill?: {
    moneyFactor: GlobalPrefill;
    residualPercent: GlobalPrefill;
    acquisitionFee: GlobalPrefill;
  };
}
