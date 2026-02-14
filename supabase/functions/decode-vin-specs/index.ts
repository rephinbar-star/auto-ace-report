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

    // Call both endpoints in parallel
    const [specsRes, optionsRes] = await Promise.all([
      fetch(`https://api.marketcheck.com/v2/decode/car/neovin/${vin}/specs?api_key=${API_KEY}`),
      fetch(`https://api.marketcheck.com/v2/decode/car/neovin/${vin}/options-packages?api_key=${API_KEY}`),
    ]);

    let specs: any = null;
    let optionsPackages: any = null;

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

    if (!specs && !optionsPackages) {
      return new Response(
        JSON.stringify({ success: false, error: "NeoVIN decode not available for this VIN" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract installed equipment from specs
    const installedEquipment: string[] = [];
    if (specs?.installed_options_details && Array.isArray(specs.installed_options_details)) {
      for (const opt of specs.installed_options_details) {
        if (opt.name || opt.description) {
          installedEquipment.push(opt.name || opt.description);
        }
      }
    }

    // Extract option package names
    const packages: string[] = [];
    if (optionsPackages?.options && Array.isArray(optionsPackages.options)) {
      for (const pkg of optionsPackages.options) {
        if (pkg.name) {
          packages.push(pkg.name);
        }
      }
    }

    // Build engine detail string
    let engineDetail: string | null = null;
    if (specs) {
      const parts: string[] = [];
      if (specs.engine_displacement) parts.push(`${specs.engine_displacement}L`);
      if (specs.engine_aspiration && specs.engine_aspiration !== "Natural") parts.push(specs.engine_aspiration);
      if (specs.engine_configuration) parts.push(specs.engine_configuration);
      if (specs.engine_hp) parts.push(`${specs.engine_hp}hp`);
      if (specs.engine_torque) parts.push(`${specs.engine_torque} lb-ft`);
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
        trim: str(specs?.trim),
        bodyStyle: str(specs?.body_type),
        transmission: str(specs?.transmission),
        drivetrain: str(specs?.drivetrain),
        fuelType: str(specs?.fuel_type),
        engineSize: specs?.engine_displacement ? `${specs.engine_displacement}L` : null,
        engine: engineDetail,
        engineHp: specs?.engine_hp || null,
        engineTorque: specs?.engine_torque || null,
        engineCylinders: specs?.engine_cylinders || null,
        engineAspiration: str(specs?.engine_aspiration),
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
