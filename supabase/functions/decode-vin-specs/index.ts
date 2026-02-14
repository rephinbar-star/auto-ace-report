import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vin } = await req.json();

    if (!vin || typeof vin !== "string" || vin.length !== 17) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid 17-character VIN required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("MARKETCHECK_API_KEY");
    if (!API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "MarketCheck API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call MarketCheck + NHTSA in parallel
    const [specsRes, optionsRes, nhtsaRes] = await Promise.all([
      fetch(`https://api.marketcheck.com/v2/decode/car/neovin/${vin}/specs?api_key=${API_KEY}&include_generic=true`),
      fetch(`https://api.marketcheck.com/v2/decode/car/neovin/${vin}/options-packages?api_key=${API_KEY}`),
      fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`),
    ]);

    let specs: any = null;
    let optionsPackages: any = null;
    let nhtsa: Record<string, string | null> = {};

    if (specsRes.ok) {
      specs = await specsRes.json();
      console.log(`NeoVIN specs decoded for ${vin}: ${specs.year} ${specs.make} ${specs.model}`);
    } else {
      console.warn(`NeoVIN specs failed for ${vin}: ${specsRes.status}`);
      const errText = await specsRes.text();
      console.warn("Specs error body:", errText);
    }

    if (optionsRes.ok) {
      optionsPackages = await optionsRes.json();
      console.log(`NeoVIN options decoded for ${vin}: ${optionsPackages?.options?.length || 0} packages`);
    } else {
      console.warn(`NeoVIN options failed for ${vin}: ${optionsRes.status}`);
      const errText = await optionsRes.text();
      console.warn("Options error body:", errText);
    }

    // Parse NHTSA data for engine fallback
    let nhtsaResults: any[] = [];
    if (nhtsaRes.ok) {
      try {
        const nhtsaData = await nhtsaRes.json();
        nhtsaResults = nhtsaData?.Results || [];
        const getVal = (variable: string): string | null => {
          const r = nhtsaResults.find((x: any) => x.Variable === variable);
          return r?.Value || null;
        };
        nhtsa = {
          displacement: getVal("Displacement (L)"),
          cylinders: getVal("Engine Number of Cylinders"),
          hp: getVal("Engine Brake (hp) From"),
          configuration: getVal("Engine Configuration"),
          fuelType: getVal("Fuel Type - Primary"),
          transmission: getVal("Transmission Style"),
          drivetrain: getVal("Drive Type"),
          bodyStyle: getVal("Body Class"),
          trim: getVal("Trim"),
        };
        console.log(`NHTSA engine data for ${vin}: ${nhtsa.displacement}L ${nhtsa.cylinders}cyl ${nhtsa.hp}hp`);
      } catch (e) {
        console.warn("Failed to parse NHTSA response:", e);
      }
    }

    if (!specs && !optionsPackages) {
      return new Response(
        JSON.stringify({ success: false, error: "NeoVIN decode not available for this VIN" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract installed equipment from all available sources and deduplicate
    const seen = new Set<string>();
    const installedEquipment: string[] = [];

    const addItem = (item: string) => {
      const key = item.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        installedEquipment.push(item.trim());
      }
    };

    // Source 1: installed_options_details
    if (specs?.installed_options_details && Array.isArray(specs.installed_options_details)) {
      for (const opt of specs.installed_options_details) {
        if (opt.name || opt.description) addItem(opt.name || opt.description);
      }
    }

    // Source 2: features (categorized map)
    if (specs?.features && typeof specs.features === "object") {
      for (const [category, items] of Object.entries(specs.features)) {
        if (Array.isArray(items)) {
          for (const feat of items as any[]) {
            const desc = feat.description || feat.name || feat;
            if (typeof desc === "string") addItem(desc);
          }
        }
      }
    }

    // Source 3: installed_equipment (categorized map)
    if (specs?.installed_equipment && typeof specs.installed_equipment === "object") {
      for (const [category, items] of Object.entries(specs.installed_equipment)) {
        if (Array.isArray(items)) {
          for (const equip of items as any[]) {
            const desc = equip.description || equip.name || equip;
            if (typeof desc === "string") addItem(desc);
          }
        }
      }
    }

    console.log(`Equipment from MarketCheck: ${installedEquipment.length} items`);

    // NHTSA safety/tech fallback if MarketCheck data is thin
    if (installedEquipment.length < 5 && nhtsaResults.length > 0) {
      const nhtsaEquipFields = [
        "Air Bag Loc Front", "Air Bag Loc Side", "Air Bag Loc Curtain", "Air Bag Loc Knee",
        "Anti-lock Braking System (ABS)", "Electronic Stability Control (ESC)",
        "Traction Control", "Blind Spot Monitoring", "Lane Departure Warning (LDW)",
        "Lane Keeping Assistance (LKA)", "Adaptive Cruise Control (ACC)",
        "Forward Collision Warning", "Automatic Crash Notification / ACN",
        "Backup Camera", "Parking Assist", "Daytime Running Light (DRL)",
        "Headlamp Light Source", "Keyless Ignition", "Pretensioner",
      ];
      for (const field of nhtsaEquipFields) {
        const r = nhtsaResults.find((x: any) => x.Variable === field);
        const val = r?.Value;
        if (val && val !== "Not Applicable" && val !== "Standard") {
          addItem(`${field}: ${val}`);
        } else if (val === "Standard") {
          addItem(field);
        }
      }
      console.log(`Equipment after NHTSA fallback: ${installedEquipment.length} items`);
    }

    // Extract option package names
    const packages: string[] = [];
    if (optionsPackages?.options && Array.isArray(optionsPackages.options)) {
      for (const pkg of optionsPackages.options) {
        if (pkg.name) packages.push(pkg.name);
      }
    }

    // Build engine detail string (MarketCheck first, NHTSA fallback)
    const rawHp = specs?.engine_hp || (nhtsa.hp ? parseFloat(nhtsa.hp) : null);
    const rawTorque = specs?.engine_torque || null;
    const rawCylinders = specs?.engine_cylinders || (nhtsa.cylinders ? parseInt(nhtsa.cylinders) : null);
    const rawDisplacement = specs?.engine_displacement || (nhtsa.displacement ? parseFloat(nhtsa.displacement) : null);
    const rawAspiration = specs?.engine_aspiration || null;
    const rawConfiguration = specs?.engine_configuration || (nhtsa.configuration || null);

    let engineDetail: string | null = null;
    {
      const parts: string[] = [];
      if (rawDisplacement) parts.push(`${rawDisplacement}L`);
      if (rawAspiration && rawAspiration !== "Natural") parts.push(typeof rawAspiration === "string" ? rawAspiration : rawAspiration.name || String(rawAspiration));
      if (rawConfiguration) parts.push(typeof rawConfiguration === "string" ? rawConfiguration : String(rawConfiguration));
      if (rawCylinders) parts.push(`${rawCylinders}-cyl`);
      if (rawHp) parts.push(`${rawHp}hp`);
      if (rawTorque) parts.push(`${rawTorque} lb-ft`);
      if (parts.length > 0) engineDetail = parts.join(" ");
    }

    // Helper to safely extract string from potentially object fields
    const str = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === "string") return val;
      if (typeof val === "object" && val.name) return val.name;
      return String(val);
    };

    const result = {
      success: true,
      data: {
        year: specs?.year || null,
        make: str(specs?.make),
        model: str(specs?.model),
        trim: str(specs?.trim) || nhtsa.trim || null,
        bodyStyle: str(specs?.body_type) || nhtsa.bodyStyle || null,
        transmission: str(specs?.transmission) || nhtsa.transmission || null,
        drivetrain: str(specs?.drivetrain) || nhtsa.drivetrain || null,
        fuelType: str(specs?.fuel_type) || nhtsa.fuelType || null,
        engineSize: rawDisplacement ? `${rawDisplacement}L` : null,
        engine: engineDetail,
        engineHp: rawHp,
        engineTorque: rawTorque,
        engineCylinders: rawCylinders,
        engineAspiration: str(rawAspiration),
        msrp: specs?.msrp || null,
        exteriorColor: str(specs?.exterior_color),
        interiorColor: str(specs?.interior_color),
        installedEquipment,
        optionPackages: packages,
        seatingCapacity: specs?.seating_capacity || null,
      },
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("decode-vin-specs error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
