// Vehicle analysis types for CarWise

export interface VehicleInfo {
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  bodyStyle?: string;
  engineSize?: string;
  fuelType?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  interiorColor?: string;
  engine?: string; // Detailed engine string, e.g. "2.0L Turbo I4 248hp"
  engineHp?: number | null;
  engineTorque?: number | null;
  engineCylinders?: number | null;
  engineAspiration?: string | null;
  msrp?: number | null;
  installedEquipment?: string[];
  optionPackages?: string[];
}

export interface VehicleCondition {
  mileage: number;
  askingPrice: number;
  finalPrice?: number;
  condition: "excellent" | "good" | "fair" | "poor";
  listingUrl?: string;
  sellerType: "private" | "dealer";
  sellerName?: string;
  zipCode?: string;
  images?: string[];
  isCPO?: boolean;
  isBrandNew?: boolean;
}

export interface VehicleHistory {
  accidentCount: number;
  ownerCount: number;
  titleStatus: "clean" | "salvage" | "rebuilt" | "lemon";
  serviceRecords: boolean;
  lastServiceDate?: string;
  issues: string[];
  positives: string[];
  healthScore?: number; // 0-100
  // Granular service history fields for UVPRS S_svc scoring
  serviceGapMiles?: number | null;         // Largest mileage gap between documented services
  majorServicesDue?: string[] | null;       // Major services that should have been done but aren't documented
  majorServicesDone?: string[] | null;      // Major services documented as completed
  chronicRepairSystems?: string[] | null;   // Systems with repeated repairs (e.g., "transmission", "cooling")
  // Warranty data (extracted from CarFax or estimated)
  warrantyMonthsRemaining?: number | null;  // Months of factory/CPO warranty remaining
  isCPO?: boolean | null;                   // Certified Pre-Owned status
}

// AI Findings types for UVPRS dynamic scoring layer
export interface ActiveServiceFault {
  system: string;
  severityClass: 1 | 2 | 3 | 4 | 5;
  occurrences: number;
  estimatedCostPerIncident: number | null;
  isAnomalous: boolean;
  withinTwoYearsOfPrior: boolean;
  description: string;
}

export interface KnownFailurePattern {
  issue: string;
  probabilityTier: "high" | "medium" | "low" | "remote";
  costTier: "critical" | "major" | "moderate" | "minor";
  alreadyPresent: boolean;
  description: string;
  probabilityPercent: number;       // Explicit %: high=70, medium=40, low=15, remote=5
  yearsToFailureWindow: number;     // Years from now within which failure is most likely
}

export interface ChassisSignal {
  level: 1 | 2 | 3 | 4 | 5;
  isProblemGeneration: boolean;
  isWorstGeneration: boolean;
  withinFailureWindow: boolean;
  description: string;
}

export interface FloorOverrides {
  triggered: boolean;
  minimumScore: number | null;
  triggeringConditions: string[];
}

export interface OdometerIntegrity {
  status: "verified" | "discrepancy" | "rollback" | "unknown";
  lastReportedMileage: number | null;
  currentMileage: number;
  gapMiles: number | null;
  explanation: string;
}

export interface ServiceGapAnalysis {
  largestGapMiles: number;
  gapSeverity: "normal" | "minor" | "moderate" | "significant" | "severe";
  lastServiceMileage: number | null;
  lastServiceYear: number | null;
  inferredOverdueItems: string[];
}

export interface BatteryHealth {
  thermalManagement: "liquid" | "air" | "unknown";
  estimatedSoHMin: number | null;
  estimatedSoHMax: number | null;
  estimatedRangeMin: number | null;
  estimatedRangeMax: number | null;
  diagnosticRequired: boolean;
  diagnosticTool: string | null;
}

export interface AiFindings {
  activeServiceFaults: ActiveServiceFault[];
  knownFailurePatterns: KnownFailurePattern[];
  chassisSignal: ChassisSignal;
  floorOverrides?: FloorOverrides;
}

export interface FinancingInfo {
  type: "loan" | "lease" | "cash";
  /** True when user chose to skip financing details during the wizard */
  skipped?: boolean;
  // Negotiated price (may differ from asking price)
  negotiatedPrice?: number;
  // Loan fields
  loanAmount?: number;
  loanTerm?: number; // months
  apr?: number;
  // Lease fields
  monthlyPayment?: number;
  leaseTermMonths?: number;
  mileageAllowance?: number;
  residualValue?: number;
  monthsRemaining?: number;
  currentMileage?: number;
}

export interface DepreciationYear {
  year: number;
  privateValue: number;
  tradeInValue: number;
  loanBalance: number;
  repairCosts: number;
  maintenanceCosts?: number;
  netEquityPrivate: number;
  netEquityTradeIn: number;
}

export interface PriceAssessment {
  fairMarketPrivate: number;
  fairMarketDealer?: number;
  fairMarketTradeIn: number;
  askingPrice: number;
  dealRating: "excellent" | "good" | "fair" | "poor" | "overpriced";
  priceDifference: number;
  percentDifference: number;
}

export interface ReliabilityConcern {
  concern: string;
  costLow?: number | null;
  costHigh?: number | null;
}

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  depreciationRisk: string;
  reliabilityConcerns: ReliabilityConcern[];
  valueProposition: string;
  fairOfferPrice: number;
  expertOpinion: string;
}

export interface VehicleAnalysis {
  id?: string;
  userId?: string;
  createdAt?: string;
  vehicle: VehicleInfo;
  condition: VehicleCondition;
  history?: VehicleHistory;
  financing: FinancingInfo;
  priceAssessment?: PriceAssessment;
  depreciationTable?: DepreciationYear[];
  riskAssessment?: RiskAssessment;
  status: "draft" | "analyzing" | "complete" | "error";
}

export interface AnalysisFormData {
  step: number;
  vehicle: Partial<VehicleInfo>;
  condition: Partial<VehicleCondition>;
  historyFile?: File;
  historyUrl?: string;
  financing: Partial<FinancingInfo>;
}

// NHTSA VIN Decode response types
export interface NHTSAResult {
  Variable: string;
  Value: string | null;
  ValueId: string | null;
}

export interface NHTSAResponse {
  Count: number;
  Message: string;
  Results: NHTSAResult[];
  SearchCriteria: string;
}
