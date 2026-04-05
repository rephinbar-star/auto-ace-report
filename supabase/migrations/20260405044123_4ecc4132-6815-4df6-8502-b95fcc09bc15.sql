ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS sales_tax_rate numeric DEFAULT NULL;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS fees numeric DEFAULT NULL;
ALTER TABLE public.vehicle_reports ADD COLUMN IF NOT EXISTS down_payment numeric DEFAULT NULL;