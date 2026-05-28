ALTER TABLE public.vehicle_reports
  ADD COLUMN IF NOT EXISTS days_on_market integer,
  ADD COLUMN IF NOT EXISTS days_on_market_as_of timestamptz;