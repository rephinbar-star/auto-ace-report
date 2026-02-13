-- Add new jsonb column for structured reliability concerns with costs
ALTER TABLE public.vehicle_reports
  ADD COLUMN reliability_concerns_v2 jsonb DEFAULT '[]'::jsonb;

-- Migrate existing text[] data into structured jsonb format
UPDATE public.vehicle_reports
SET reliability_concerns_v2 = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('concern', elem, 'costLow', NULL, 'costHigh', NULL))
   FROM unnest(reliability_concerns) AS elem),
  '[]'::jsonb
)
WHERE reliability_concerns IS NOT NULL AND array_length(reliability_concerns, 1) > 0;

-- Drop old column and rename new one
ALTER TABLE public.vehicle_reports DROP COLUMN reliability_concerns;
ALTER TABLE public.vehicle_reports RENAME COLUMN reliability_concerns_v2 TO reliability_concerns;