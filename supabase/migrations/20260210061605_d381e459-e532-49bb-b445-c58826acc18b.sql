-- Add granular service history columns to vehicle_reports
ALTER TABLE public.vehicle_reports
  ADD COLUMN IF NOT EXISTS service_gap_miles integer NULL,
  ADD COLUMN IF NOT EXISTS major_services_due text[] NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS major_services_done text[] NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS chronic_repair_systems text[] NULL DEFAULT '{}'::text[];