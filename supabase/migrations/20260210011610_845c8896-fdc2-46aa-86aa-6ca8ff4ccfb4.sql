ALTER TABLE public.vehicle_reports
  ADD COLUMN pricing_last_updated timestamp with time zone,
  ADD COLUMN pricing_sources text[] DEFAULT '{}'::text[];