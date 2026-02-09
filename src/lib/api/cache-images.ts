import { supabase } from "@/integrations/supabase/client";

interface CachedImage {
  original: string;
  cached: string;
}

interface CacheImagesResponse {
  success: boolean;
  error?: string;
  images?: CachedImage[];
  batchId?: string;
  cached?: number;
  total?: number;
}

/**
 * Cache external images to Lovable Cloud storage for faster loading and persistence.
 * Returns cached URLs, falling back to original URLs if caching fails.
 */
export async function cacheImages(
  images: string[],
  reportId?: string
): Promise<CacheImagesResponse> {
  if (!images || images.length === 0) {
    return { success: true, images: [], cached: 0, total: 0 };
  }

  // Skip caching if user is not authenticated (edge function requires auth)
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return {
      success: false,
      error: "Not authenticated",
      images: images.map((url) => ({ original: url, cached: url })),
    };
  }

  const { data, error } = await supabase.functions.invoke<CacheImagesResponse>(
    "cache-images",
    {
      body: { images, reportId },
    }
  );

  if (error) {
    console.error("Error caching images:", error);
    // Return original images as fallback
    return {
      success: false,
      error: error.message,
      images: images.map((url) => ({ original: url, cached: url })),
    };
  }

  return data || { success: false, error: "No response from server" };
}

/**
 * Extract cached URLs from the response, preferring cached URLs over originals.
 */
export function getCachedUrls(response: CacheImagesResponse): string[] {
  if (!response.images) return [];
  return response.images.map((img) => img.cached);
}
