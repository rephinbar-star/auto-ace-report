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
}

export interface VehicleCondition {
  mileage: number;
  askingPrice: number;
  condition: "excellent" | "good" | "fair" | "poor";
  listingUrl?: string;
  sellerType: "private" | "dealer";
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
}

export interface FinancingInfo {
  type: "loan" | "lease" | "cash";
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
  netEquityPrivate: number;
  netEquityTradeIn: number;
}

export interface PriceAssessment {
  fairMarketPrivate: number;
  fairMarketTradeIn: number;
  askingPrice: number;
  dealRating: "excellent" | "good" | "fair" | "poor" | "overpriced";
  priceDifference: number;
  percentDifference: number;
}

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  depreciationRisk: string;
  reliabilityConcerns: string[];
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
