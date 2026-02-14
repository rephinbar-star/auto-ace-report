import { supabase } from "@/integrations/supabase/client";
import { VehicleHistory } from "@/types/vehicle";

export interface ParseHistoryResponse {
  success: boolean;
  error?: string;
  history?: VehicleHistory & { summary?: string; vin?: string | null };
  storagePath?: string;
}

export async function parseHistoryReport(
  file?: File,
  url?: string,
  mileage?: number
): Promise<ParseHistoryResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  // Allow analysis without auth - will store to session instead of server
  const headers: Record<string, string> = {};
  if (session) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  if (url) {
    formData.append("url", url);
  }
  
  // Add flag for unauthenticated analysis
  formData.append("allowUnauthenticated", session ? "false" : "true");
  
  if (mileage != null) {
    formData.append("mileage", String(mileage));
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-history-report`,
    {
      method: "POST",
      headers,
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error || `Request failed with status ${response.status}`,
    };
  }

  return data;
}
