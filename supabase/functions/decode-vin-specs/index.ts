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

    // Call MarketCheck + NHTSA + VinAudit in parallel
    const VINAUDIT_API_KEY = Deno.env.get("VINAUDIT_API_KEY");
    const [specsRes, optionsRes, nhtsaRes, vinAuditRes] = await Promise.all([
      fetch(`https://api.marketcheck.com/v2/decode/car/neovin/${vin}/specs?api_key=${API_KEY}&include_generic=true`),
      fetch(`https://api.marketcheck.com/v2/decode/car/neovin/${vin}/options-packages?api_key=${API_KEY}`),
      fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`),
      VINAUDIT_API_KEY
        ? fetch(`https://specs.vinaudit.com/?key=${encodeURIComponent(VINAUDIT_API_KEY)}&vin=${encodeURIComponent(vin)}&format=json`)
        : Promise.resolve(new Response(null, { status: 204 })),
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

    // Parse VinAudit spec data as enrichment fallback
    let vinAudit: Record<string, string | number | null> = {};
    if (vinAuditRes.ok && vinAuditRes.status !== 204) {
      try {
        const vaData = await vinAuditRes.json();
        console.log("VinAudit specs raw:", JSON.stringify(vaData).slice(0, 500));
        if (vaData?.success !== false && vaData?.data) {
          const d = vaData.data;
          vinAudit = {
            year: d.year || null,
            make: d.make || null,
            model: d.model || null,
            trim: d.trim || null,
            bodyStyle: d.body_style || null,
            transmission: d.transmission || null,
            drivetrain: d.drivetrain || null,
            fuelType: d.fuel_type || null,
            engineSize: d.engine_displacement ? `${d.engine_displacement}L` : null,
            engineCylinders: d.engine_cylinders || null,
            engineHp: d.horsepower || null,
            engineTorque: d.torque || null,
            msrp: d.msrp || null,
            exteriorColor: d.exterior_color || null,
            interiorColor: d.interior_color || null,
          };
          console.log(`VinAudit specs for ${vin}: ${vinAudit.year} ${vinAudit.make} ${vinAudit.model} ${vinAudit.trim || ""}`);
        }
      } catch (e) {
        console.warn("Failed to parse VinAudit response:", e);
      }
    }

    // If MarketCheck failed, try NHTSA + VinAudit fallback
    if (!specs && !optionsPackages) {
      const getVal = (variable: string): string | null => {
        const r = nhtsaResults.find((x: any) => x.Variable === variable);
        return r?.Value || null;
      };
      const nhtsaYear = getVal("Model Year");
      const nhtsaMake = getVal("Make");
      const nhtsaModel = getVal("Model");

      const fallbackYear = nhtsaYear || vinAudit.year;
      const fallbackMake = nhtsaMake || vinAudit.make;
      const fallbackModel = nhtsaModel || vinAudit.model;

      if (!fallbackYear || !fallbackMake || !fallbackModel) {
        console.warn(`All VIN decode sources insufficient for ${vin} — returning graceful fallback`);
        return new Response(
          JSON.stringify({ success: false, error: "VIN decode temporarily unavailable", fallback: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`MarketCheck unavailable, using NHTSA/VinAudit fallback for ${vin}`);

      const nhtsaDisplacement = nhtsa.displacement ? parseFloat(nhtsa.displacement) : null;
      const nhtsaCylinders = nhtsa.cylinders ? parseInt(nhtsa.cylinders) : null;
      const nhtsaHp = nhtsa.hp ? parseFloat(nhtsa.hp) : null;
      let engineDetail: string | null = null;
      {
        const parts: string[] = [];
        if (nhtsaDisplacement) parts.push(`${nhtsaDisplacement}L`);
        if (nhtsa.configuration) parts.push(nhtsa.configuration);
        if (nhtsaCylinders) parts.push(`${nhtsaCylinders}-cyl`);
        if (nhtsaHp) parts.push(`${nhtsaHp}hp`);
        if (parts.length > 0) engineDetail = parts.join(" ");
      }

      // Build NHTSA-only equipment from safety/tech fields
      const nhtsaEquipment: Record<string, string[]> = {};
      const nhtsaEquipFields: [string, string][] = [
        ["Air Bag Loc Front", "Safety"], ["Air Bag Loc Side", "Safety"], ["Air Bag Loc Curtain", "Safety"],
        ["Anti-lock Braking System (ABS)", "Safety"], ["Electronic Stability Control (ESC)", "Safety"],
        ["Traction Control", "Safety"], ["Backup Camera", "Technology"], ["Parking Assist", "Technology"],
        ["Blind Spot Monitoring", "Safety"], ["Lane Departure Warning (LDW)", "Safety"],
        ["Forward Collision Warning", "Safety"], ["Adaptive Cruise Control (ACC)", "Technology"],
        ["Keyless Ignition", "Technology"], ["Daytime Running Light (DRL)", "Exterior"],
      ];
      const seenEquip = new Set<string>();
      for (const [field, cat] of nhtsaEquipFields) {
        const r = nhtsaResults.find((x: any) => x.Variable === field);
        const val = r?.Value;
        if (val && val !== "Not Applicable") {
          const label = val === "Standard" ? field : `${field}: ${val}`;
          const key = label.toLowerCase();
          if (!seenEquip.has(key)) {
            seenEquip.add(key);
            if (!nhtsaEquipment[cat]) nhtsaEquipment[cat] = [];
            nhtsaEquipment[cat].push(label);
          }
        }
      }

      const result = {
        success: true,
        data: {
          year: parseInt(nhtsaYear),
          make: nhtsaMake,
          model: nhtsaModel,
          trim: nhtsa.trim || null,
          bodyStyle: nhtsa.bodyStyle || null,
          transmission: nhtsa.transmission || null,
          drivetrain: nhtsa.drivetrain || null,
          fuelType: nhtsa.fuelType || null,
          engineSize: nhtsaDisplacement ? `${nhtsaDisplacement}L` : null,
          engine: engineDetail,
          engineHp: nhtsaHp,
          engineTorque: null,
          engineCylinders: nhtsaCylinders,
          engineAspiration: null,
          msrp: null,
          exteriorColor: null,
          interiorColor: null,
          installedEquipment: Object.values(nhtsaEquipment).flat(),
          categorizedEquipment: nhtsaEquipment,
          optionPackages: [],
          seatingCapacity: null,
        },
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract installed equipment from all sources, categorized and deduplicated
    const seen = new Set<string>();
    const categorizedEquipment: Record<string, string[]> = {};

    const addItem = (category: string, item: string) => {
      const key = item.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        if (!categorizedEquipment[category]) categorizedEquipment[category] = [];
        categorizedEquipment[category].push(item.trim());
      }
    };

    // Category classification keywords
    const classifyItem = (name: string, sourceCategory?: string): string => {
      const lower = name.toLowerCase();
      if (sourceCategory) {
        const cat = sourceCategory.toLowerCase();
        if (cat.includes("safety") || cat.includes("airbag") || cat.includes("brake") || cat.includes("collision") || cat.includes("security")) return "Safety";
        if (cat.includes("comfort") || cat.includes("seat") || cat.includes("climate") || cat.includes("air con")) return "Comfort";
        if (cat.includes("tech") || cat.includes("audio") || cat.includes("entertain") || cat.includes("connect") || cat.includes("infotainment") || cat.includes("multimedia")) return "Technology";
        if (cat.includes("exterior") || cat.includes("light") || cat.includes("mirror") || cat.includes("wheel") || cat.includes("roof")) return "Exterior";
        if (cat.includes("interior") || cat.includes("storage") || cat.includes("cargo") || cat.includes("instrument")) return "Interior";
        if (cat.includes("drive") || cat.includes("engine") || cat.includes("transmission") || cat.includes("performance") || cat.includes("suspension") || cat.includes("steering")) return "Drivetrain & Performance";
      }
      // Keyword-based fallback
      if (/airbag|air bag|abs|brake|collision|stability|traction|blind spot|lane|pretensioner|seat belt|anti.?theft/i.test(lower)) return "Safety";
      if (/seat|heated|ventilated|climate|air con|lumbar|memory|armrest/i.test(lower)) return "Comfort";
      if (/bluetooth|radio|audio|usb|touch screen|navigation|app|satellite|speaker|display|camera|sensor|parking assist/i.test(lower)) return "Technology";
      if (/mirror|light|fog|headl|tail|sunroof|moonroof|roof|wiper|door|window|wheel|tire|bumper|grille|spoiler|color/i.test(lower)) return "Exterior";
      if (/cargo|trunk|storage|cup|visor|floor mat|gauge|instrument|glove/i.test(lower)) return "Interior";
      if (/drive|awd|4wd|engine|cylinder|turbo|supercharger|transmission|gear|differential|suspension|cruise|descent|crawl/i.test(lower)) return "Drivetrain & Performance";
      return "Other";
    };

    // Source 1: installed_options_details (no category info)
    if (specs?.installed_options_details && Array.isArray(specs.installed_options_details)) {
      for (const opt of specs.installed_options_details) {
        const name = opt.name || opt.description;
        if (name) addItem(classifyItem(name), name);
      }
    }

    // Source 2: features (categorized map)
    if (specs?.features && typeof specs.features === "object") {
      for (const [category, items] of Object.entries(specs.features)) {
        if (Array.isArray(items)) {
          for (const feat of items as any[]) {
            const desc = feat.description || feat.name || feat;
            if (typeof desc === "string") addItem(classifyItem(desc, category), desc);
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
            if (typeof desc === "string") addItem(classifyItem(desc, category), desc);
          }
        }
      }
    }

    const totalItems = Object.values(categorizedEquipment).reduce((s, a) => s + a.length, 0);
    console.log(`Equipment from MarketCheck: ${totalItems} items in ${Object.keys(categorizedEquipment).length} categories`);

    // Flat list for backward compat
    const installedEquipment = Object.values(categorizedEquipment).flat();

    // NHTSA safety/tech fallback if MarketCheck data is thin
    if (totalItems < 5 && nhtsaResults.length > 0) {
      const nhtsaEquipFields: [string, string][] = [
        ["Air Bag Loc Front", "Safety"], ["Air Bag Loc Side", "Safety"], ["Air Bag Loc Curtain", "Safety"], ["Air Bag Loc Knee", "Safety"],
        ["Anti-lock Braking System (ABS)", "Safety"], ["Electronic Stability Control (ESC)", "Safety"],
        ["Traction Control", "Safety"], ["Blind Spot Monitoring", "Safety"], ["Lane Departure Warning (LDW)", "Safety"],
        ["Lane Keeping Assistance (LKA)", "Safety"], ["Adaptive Cruise Control (ACC)", "Technology"],
        ["Forward Collision Warning", "Safety"], ["Automatic Crash Notification / ACN", "Safety"],
        ["Backup Camera", "Technology"], ["Parking Assist", "Technology"], ["Daytime Running Light (DRL)", "Exterior"],
        ["Headlamp Light Source", "Exterior"], ["Keyless Ignition", "Technology"], ["Pretensioner", "Safety"],
      ];
      for (const [field, cat] of nhtsaEquipFields) {
        const r = nhtsaResults.find((x: any) => x.Variable === field);
        const val = r?.Value;
        if (val && val !== "Not Applicable" && val !== "Standard") {
          addItem(cat, `${field}: ${val}`);
        } else if (val === "Standard") {
          addItem(cat, field);
        }
      }
      console.log(`Equipment after NHTSA fallback: ${Object.values(categorizedEquipment).reduce((s, a) => s + a.length, 0)} items`);
    }

    // Extract option package names
    const packages: string[] = [];
    if (optionsPackages?.options && Array.isArray(optionsPackages.options)) {
      for (const pkg of optionsPackages.options) {
        if (pkg.name) packages.push(pkg.name);
      }
    }

    // Build engine detail string (MarketCheck first, NHTSA fallback, VinAudit tertiary)
    const rawHp = specs?.engine_hp || (nhtsa.hp ? parseFloat(nhtsa.hp) : null) || vinAudit.engineHp;
    const rawTorque = specs?.engine_torque || null || vinAudit.engineTorque;
    const rawCylinders = specs?.engine_cylinders || (nhtsa.cylinders ? parseInt(nhtsa.cylinders) : null) || vinAudit.engineCylinders;
    const rawDisplacement = specs?.engine_displacement || (nhtsa.displacement ? parseFloat(nhtsa.displacement) : null) || (vinAudit.engineSize ? parseFloat(vinAudit.engineSize.replace("L","")) : null);
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
        year: specs?.year || vinAudit.year || null,
        make: str(specs?.make) || vinAudit.make || null,
        model: str(specs?.model) || vinAudit.model || null,
        trim: str(specs?.trim) || nhtsa.trim || vinAudit.trim || null,
        bodyStyle: str(specs?.body_type) || nhtsa.bodyStyle || vinAudit.bodyStyle || null,
        transmission: str(specs?.transmission) || nhtsa.transmission || vinAudit.transmission || null,
        drivetrain: str(specs?.drivetrain) || nhtsa.drivetrain || vinAudit.drivetrain || null,
        fuelType: str(specs?.fuel_type) || nhtsa.fuelType || vinAudit.fuelType || null,
        engineSize: rawDisplacement ? `${rawDisplacement}L` : null,
        engine: engineDetail,
        engineHp: rawHp,
        engineTorque: rawTorque,
        engineCylinders: rawCylinders,
        engineAspiration: str(rawAspiration),
        msrp: specs?.msrp || vinAudit.msrp || null,
        exteriorColor: str(specs?.exterior_color) || vinAudit.exteriorColor || null,
        interiorColor: str(specs?.interior_color) || vinAudit.interiorColor || null,
        installedEquipment,
        categorizedEquipment,
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
