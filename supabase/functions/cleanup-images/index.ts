import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const BUCKET_NAME = "vehicle-images";
    const MAX_AGE_DAYS = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

    console.log(`Cleaning up images older than ${cutoffDate.toISOString()}`);

    // List all folders (batch IDs) in the bucket
    const { data: folders, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", { limit: 1000 });

    if (listError) {
      throw new Error(`Failed to list folders: ${listError.message}`);
    }

    if (!folders || folders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No images to clean up", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalDeleted = 0;
    const errors: string[] = [];

    // Process each folder
    for (const folder of folders) {
      if (!folder.name) continue;

      // List files in the folder
      const { data: files, error: filesError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folder.name, { limit: 100 });

      if (filesError) {
        errors.push(`Failed to list ${folder.name}: ${filesError.message}`);
        continue;
      }

      if (!files || files.length === 0) continue;

      // Check if all files in folder are old enough to delete
      const oldFiles = files.filter((file) => {
        if (!file.created_at) return false;
        const fileDate = new Date(file.created_at);
        return fileDate < cutoffDate;
      });

      if (oldFiles.length === 0) continue;

      // Delete old files
      const filePaths = oldFiles.map((f) => `${folder.name}/${f.name}`);
      
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        errors.push(`Failed to delete from ${folder.name}: ${deleteError.message}`);
      } else {
        totalDeleted += filePaths.length;
        console.log(`Deleted ${filePaths.length} files from ${folder.name}`);
      }
    }

    const result = {
      success: true,
      deleted: totalDeleted,
      cutoffDate: cutoffDate.toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`Cleanup complete: deleted ${totalDeleted} images`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
