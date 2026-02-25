
-- Add warranty analysis columns
ALTER TABLE public.vehicle_reports
  ADD COLUMN IF NOT EXISTS warranty_status text,
  ADD COLUMN IF NOT EXISTS warranty_risk_reduction integer,
  ADD COLUMN IF NOT EXISTS warranty_notes text;

-- Add final verdict columns
ALTER TABLE public.vehicle_reports
  ADD COLUMN IF NOT EXISTS final_verdict text,
  ADD COLUMN IF NOT EXISTS final_verdict_justification text;
