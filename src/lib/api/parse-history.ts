import { supabase } from "@/integrations/supabase/client";
import { VehicleHistory } from "@/types/vehicle";

export interface ParseHistoryResponse {
  success: boolean;
  error?: string;
  history?: VehicleHistory & { summary?: string };
  storagePath?: string;
}

export async function parseHistoryReport(
  file?: File,
  url?: string
): Promise<ParseHistoryResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return { success: false, error: "Please sign in to analyze history reports" };
  }

  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  if (url) {
    formData.append("url", url);
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-history-report`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
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
