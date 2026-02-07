-- Add listing_images column to vehicle_reports table
ALTER TABLE public.vehicle_reports
ADD COLUMN listing_images text[] DEFAULT '{}'::text[];