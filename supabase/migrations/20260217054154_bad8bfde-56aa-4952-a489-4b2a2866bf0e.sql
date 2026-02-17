
ALTER TABLE public.vehicle_reports
ADD COLUMN warranty_months_remaining integer NULL,
ADD COLUMN is_cpo boolean NULL DEFAULT false;
