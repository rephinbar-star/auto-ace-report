import { supabase } from "@/integrations/supabase/client";

export interface ScrapedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  askingPrice?: number;
  condition?: "excellent" | "good" | "fair" | "poor";
  vin?: string;
  sellerType?: "dealer" | "private";
  sellerName?: string;
  description?: string;
  features?: string[];
  images?: string[];
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  interiorColor?: string;
  bodyStyle?: string;
  fuelType?: string;
  titleStatus?: "clean" | "salvage" | "rebuilt";
}

export interface ScrapeListingResponse {
  success: boolean;
  error?: string;
  vehicle?: ScrapedVehicle;
  sourceUrl?: string;
  rawContent?: string;
  message?: string;
  metadata?: {
    title?: string;
    scrapedAt?: string;
  };
}

export async function scrapeCarListing(url: string): Promise<ScrapeListingResponse> {
  const { data, error } = await supabase.functions.invoke<ScrapeListingResponse>("scrape-listing", {
    body: { url },
  });

  if (error) {
    console.error("Error scraping listing:", error);
    // When edge function returns non-2xx, the response body may be in error.context
    let friendlyError = "Failed to scrape listing";
    try {
      if (error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        if (body?.error) friendlyError = body.error;
      } else if (data?.error) {
        friendlyError = data.error;
      } else if (error.message) {
        friendlyError = error.message;
      }
    } catch {
      friendlyError = error.message || "Failed to scrape listing";
    }
    return { 
      success: false, 
      error: friendlyError
    };
  }

  return data || { success: false, error: "No response from server" };
}
