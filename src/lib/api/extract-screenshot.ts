import { supabase } from "@/integrations/supabase/client";

export interface ExtractedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  askingPrice?: number;
  mileage?: number;
  vin?: string;
  sellerType?: "dealer" | "private";
  sellerName?: string;
  condition?: "excellent" | "good" | "fair" | "poor";
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  fuelType?: string;
  titleStatus?: "clean" | "salvage" | "rebuilt";
}

export interface ExtractScreenshotResponse {
  success: boolean;
  error?: string;
  vehicle?: ExtractedVehicle;
}

export async function extractFromScreenshot(file: File): Promise<ExtractScreenshotResponse> {
  try {
    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const imageBase64 = btoa(binary);

    const { data, error } = await supabase.functions.invoke<ExtractScreenshotResponse>(
      "extract-from-screenshot",
      { body: { imageBase64, mimeType: file.type } }
    );

    if (error) {
      console.error("Error extracting from screenshot:", error);
      let friendlyError = "Failed to extract vehicle details";
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          if (body?.error) friendlyError = body.error;
        } else if (data?.error) {
          friendlyError = data.error;
        } else if (error.message) {
          friendlyError = error.message;
        }
      } catch {
        friendlyError = error.message || "Failed to extract vehicle details";
      }
      return { success: false, error: friendlyError };
    }

    return data || { success: false, error: "No response from server" };
  } catch (err) {
    console.error("Screenshot extraction error:", err);
    return { success: false, error: "Failed to process screenshot" };
  }
}
