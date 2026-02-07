-- Add MPG fields for fuel economy data from EPA
ALTER TABLE vehicle_reports 
ADD COLUMN mpg_city integer,
ADD COLUMN mpg_highway integer,
ADD COLUMN mpg_combined integer;