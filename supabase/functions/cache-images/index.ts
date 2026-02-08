import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CacheImagesRequest {
  images: string[];
  reportId?: string;
}

interface CachedImage {
  original: string;
  cached: string;
}

// Limits to prevent abuse
const MAX_IMAGES_PER_REQUEST = 20;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, { 
      ...RATE_LIMITS.heavy, 
      keyPrefix: 'cache-images' 
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Too many requests", 
          retryAfter: rateLimit.retryAfter 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { images, reportId } = await req.json() as CacheImagesRequest;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Images array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit number of images per request
    if (images.length > MAX_IMAGES_PER_REQUEST) {
      return new Response(
        JSON.stringify({ success: false, error: `Maximum ${MAX_IMAGES_PER_REQUEST} images per request` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If reportId provided, verify user owns the report
    if (reportId) {
      const { data: report, error: reportError } = await supabase
        .from("vehicle_reports")
        .select("id")
        .eq("id", reportId)
        .eq("user_id", userData.user.id)
        .single();

      if (reportError || !report) {
        return new Response(
          JSON.stringify({ success: false, error: "Report not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const cachedImages: CachedImage[] = [];

    // Generate a unique folder for this batch
    const batchId = reportId || crypto.randomUUID();
    
    // Process images in parallel (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async (imageUrl, batchIndex) => {
          const index = i + batchIndex;
          
          try {
            // Skip if not a valid URL
            if (!imageUrl.startsWith("http")) {
              throw new Error("Invalid URL");
            }

            // Download the image
            const response = await fetch(imageUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ImageCache/1.0)",
                "Accept": "image/*",
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch: ${response.status}`);
            }

            const contentType = response.headers.get("content-type") || "image/jpeg";
            
            // Validate it's an image
            if (!contentType.startsWith("image/")) {
              throw new Error("Not an image");
            }

            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Skip if too small (likely a broken image or placeholder)
            if (uint8Array.length < 1000) {
              throw new Error("Image too small");
            }

            // Skip if too large
            if (uint8Array.length > MAX_IMAGE_SIZE) {
              throw new Error("Image too large");
            }

            // Determine file extension
            let ext = "jpg";
            if (contentType.includes("png")) ext = "png";
            else if (contentType.includes("webp")) ext = "webp";

            const fileName = `${batchId}/${index}.${ext}`;

            // Upload to storage (service role bypasses RLS)
            const { error: uploadError } = await supabase.storage
              .from("vehicle-images")
              .upload(fileName, uint8Array, {
                contentType,
                upsert: true,
              });

            if (uploadError) {
              throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Generate signed URL for private bucket (1 hour expiry)
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from("vehicle-images")
              .createSignedUrl(fileName, 3600);

            if (signedUrlError || !signedUrlData) {
              throw new Error("Failed to generate signed URL");
            }

            return {
              original: imageUrl,
              cached: signedUrlData.signedUrl,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error(`Failed to cache image ${index}:`, message);
            
            // Return original URL as fallback
            return {
              original: imageUrl,
              cached: imageUrl, // Fallback to original
            };
          }
        })
      );

      // Collect results
      for (const result of results) {
        if (result.status === "fulfilled") {
          cachedImages.push(result.value);
        }
      }
    }

    console.log(`Cached ${cachedImages.filter(img => img.cached !== img.original).length}/${images.length} images for user ${userData.user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        images: cachedImages,
        batchId,
        cached: cachedImages.filter(img => img.cached !== img.original).length,
        total: images.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cache images error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to cache images",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
