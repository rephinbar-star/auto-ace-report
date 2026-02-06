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
  description?: string;
  features?: string[];
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
    return { 
      success: false, 
      error: error.message || "Failed to scrape listing" 
    };
  }

  return data || { success: false, error: "No response from server" };
}
