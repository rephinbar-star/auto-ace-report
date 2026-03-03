
-- Seed 10 representative marketplace listings across popular metros
-- Only insert if no seed listings exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_listings WHERE source = 'seed' LIMIT 1) THEN
    INSERT INTO public.marketplace_listings
      (source, status, seller_type, year, make, model, trim, mileage, asking_price, condition, city, state, zip_code, body_style, fuel_type, transmission, drivetrain, exterior_color, description)
    VALUES
      ('seed','active','dealer',2021,'Toyota','Camry','SE',32000,24900,'good','Los Angeles','CA','90001','Sedan','Gasoline','Automatic','FWD','Midnight Black','One-owner Toyota Camry SE with full service history. Clean title, non-smoker vehicle. Includes backup camera, Apple CarPlay, and lane departure warning.'),
      ('seed','active','dealer',2022,'Honda','CR-V','EX',18500,31500,'excellent','New York','NY','10001','SUV','Gasoline','CVT','AWD','Platinum White','Like-new Honda CR-V EX with Honda Sensing suite. Heated seats, panoramic sunroof, and wireless CarPlay. Still under factory warranty.'),
      ('seed','active','dealer',2020,'Ford','F-150','XLT',47000,38900,'good','Chicago','IL','60601','Truck','Gasoline','Automatic','4WD','Agate Black','Rugged F-150 XLT with Sport package, tow package, and bed liner. Perfect for work or weekend adventures. Well maintained with all service records.'),
      ('seed','active','dealer',2019,'Chevrolet','Silverado 1500','LT',58000,34500,'good','Houston','TX','77001','Truck','Gasoline','Automatic','4WD','Summit White','Reliable Silverado LT Crew Cab with 5.3L V8. Trailering package, remote start, and Chevy MyLink infotainment. Clean CARFAX.'),
      ('seed','active','dealer',2022,'Tesla','Model 3','Long Range',22000,36800,'excellent','Phoenix','AZ','85001','Sedan','Electric','Automatic','AWD','Pearl White','Tesla Model 3 Long Range AWD with Full Self-Driving capability included. 350-mile estimated range, heated seats, premium audio. Still under warranty.'),
      ('seed','active','dealer',2021,'Jeep','Grand Cherokee','Limited',29000,41200,'good','Miami','FL','33101','SUV','Gasoline','Automatic','4WD','Granite Crystal','Fully loaded Grand Cherokee Limited with Uconnect 8.4", panoramic sunroof, ventilated front seats, and advanced safety tech. One owner, clean title.'),
      ('seed','active','dealer',2021,'Subaru','Outback','Premium',35000,28500,'good','Seattle','WA','98101','Wagon','Gasoline','CVT','AWD','Ice Silver','Adventure-ready Subaru Outback Premium with EyeSight Driver Assist. X-Mode for off-road, heated seats, and CarPlay. Perfect for the Pacific Northwest.'),
      ('seed','active','dealer',2020,'Toyota','4Runner','TRD Off-Road',44000,39900,'good','Denver','CO','80201','SUV','Gasoline','Automatic','4WD','Army Green','Toyota 4Runner TRD Off-Road with Multi-Terrain Select, locking rear differential, and Crawl Control. A true off-road capable family SUV.'),
      ('seed','active','dealer',2022,'Honda','Accord','Sport',15000,27800,'excellent','Atlanta','GA','30301','Sedan','Gasoline','CVT','FWD','Sonic Gray Pearl','Low-mileage Accord Sport with 1.5T engine, sporty 18-inch wheels, heated seats, and Honda Sensing. Almost like new — barely driven.'),
      ('seed','active','dealer',2021,'Ford','Mustang','EcoBoost Premium',28000,33500,'good','Austin','TX','78701','Coupe','Gasoline','Automatic','RWD','Grabber Yellow','Head-turning Mustang EcoBoost Premium with 10-speed auto, Recaro sport seats, B&O audio, and active exhaust. Clean title, garage kept.');
  END IF;
END $$;
