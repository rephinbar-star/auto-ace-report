import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateUrl } from "../_shared/url-validator.ts";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VehicleHistory {
  accidentCount: number;
  ownerCount: number;
  titleStatus: "clean" | "salvage" | "rebuilt" | "lemon";
  serviceRecords: boolean;
  lastServiceDate?: string;
  issues: string[];
  positives: string[];
  healthScore: number;
  // Granular service fields for UVPRS
  serviceGapMiles?: number | null;
  majorServicesDue?: string[] | null;
  majorServicesDone?: string[] | null;
  chronicRepairSystems?: string[] | null;
  // Recall data from CarFax/AutoCheck
  openRecallCount?: number | null;
  resolvedRecallCount?: number | null;
  // Warranty data
  warrantyMonthsRemaining?: number | null;
  isCPO?: boolean | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting for unauthenticated requests
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, { 
      ...RATE_LIMITS.heavy, 
      keyPrefix: 'parse-history' 
    });
    
    if (!rateLimit.allowed) {
      console.log(`Rate limited: ${clientIp}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Too many requests. Please try again later.",
          retryAfter: rateLimit.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter || 60)
          } 
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("authorization");
    let user = null;

    // Check for authenticated user (optional now)
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error: authError } = await supabase.auth.getUser(token);
      if (!authError && data?.user) {
        user = data.user;
      }
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const reportUrl = formData.get("url") as string | null;
    const allowUnauthenticated = formData.get("allowUnauthenticated") === "true";
    const mileageRaw = formData.get("mileage") as string | null;
    const vehicleMileage = mileageRaw ? parseInt(mileageRaw, 10) : null;

    // If no auth and not explicitly allowing unauthenticated, reject
    if (!user && !allowUnauthenticated) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!file && !reportUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "File or URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let textContent = "";
    let storagePath = "";

    // Handle file upload
    if (file) {
      console.log("Processing uploaded file:", file.name, file.size, file.type);

      // Only upload to storage if user is authenticated
      if (user) {
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("history-reports")
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
        } else {
          storagePath = fileName;
        }
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const isImage = file.type.startsWith("image/");

      if (isImage) {
        // For images (screenshots of CarFax/AutoCheck), use Gemini vision directly
        console.log("Processing image file with Gemini vision");
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          try {
            let binary = "";
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode(...chunk);
            }
            const base64Image = btoa(binary);
            const mimeType = file.type || "image/png";
            const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "Extract ALL text content from this vehicle history report screenshot (CarFax, AutoCheck, or similar). Include every detail: VIN number, vehicle info, accident history, service records, ownership history, title info, recalls, mileage readings. Return the full text content."
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:${mimeType};base64,${base64Image}`
                        }
                      }
                    ]
                  }
                ],
                max_tokens: 8000,
              }),
            });

            if (visionResponse.ok) {
              const visionData = await visionResponse.json();
              const extractedText = visionData.choices?.[0]?.message?.content;
              if (extractedText && extractedText.length > 20) {
                console.log(`Gemini vision extracted ${extractedText.length} chars from image`);
                textContent = extractedText;
                const vinFromVision = extractedText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
                if (vinFromVision) {
                  console.log("VIN found via Gemini vision:", vinFromVision[1]);
                  textContent += `\nVIN: ${vinFromVision[1]}`;
                }
              }
            } else {
              console.error("Gemini vision request failed:", visionResponse.status);
            }
          } catch (e) {
            console.error("Gemini vision error:", e);
          }
        }
        if (!textContent || textContent.length < 50) {
          textContent = `Vehicle History Report screenshot: ${file.name}. Image uploaded for analysis.`;
        }
      } else {
        // PDF processing (existing logic)
        // Basic PDF text extraction (simplified - extracts visible text streams)
        textContent = extractTextFromPDF(bytes);

        // Decompress FlateDecode streams to find VIN and additional text
        const decompressedText = await decompressPDFStreams(bytes);
        if (decompressedText) {
          console.log(`Decompressed ${decompressedText.length} chars from PDF streams`);
          const vinFromDecompressed = decompressedText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
          if (vinFromDecompressed) {
            console.log("VIN found in decompressed PDF stream:", vinFromDecompressed[1]);
            textContent += `\nVIN: ${vinFromDecompressed[1]}`;
          }
          if (decompressedText.length > textContent.length) {
            textContent = decompressedText;
            if (vinFromDecompressed) {
              textContent += `\nVIN: ${vinFromDecompressed[1]}`;
            }
          }
        }

        // Fallback: scan raw bytes for VIN pattern  
        if (!textContent.includes("VIN:")) {
          const rawStr = new TextDecoder("latin1").decode(bytes);
          const vinFromRaw = rawStr.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
          if (vinFromRaw) {
            console.log("VIN found in raw PDF bytes:", vinFromRaw[1]);
            textContent += `\nVIN: ${vinFromRaw[1]}`;
          }
        }
        
        const vinIdx = textContent.toUpperCase().indexOf("VIN");
        if (vinIdx >= 0) {
          console.log("Text near 'VIN':", textContent.substring(Math.max(0, vinIdx - 20), vinIdx + 80));
        } else {
          console.log("No 'VIN' keyword found. First 300 chars:", textContent.substring(0, 300));
        }
        
        if (!textContent.includes("VIN:")) {
          const noSpaces = textContent.replace(/\s+/g, "");
          const vinNoSpaces = noSpaces.match(/([A-HJ-NPR-Z0-9]{17})/);
          if (vinNoSpaces) {
            console.log("VIN found after removing spaces:", vinNoSpaces[1]);
            textContent += `\nVIN: ${vinNoSpaces[1]}`;
          }
        }

        console.log(`Extracted text length: ${textContent.length} chars`);
        
        // If text is garbled, use Gemini vision to read the PDF
        const hasReadableText = /[a-zA-Z]{5,}/.test(textContent.substring(0, 500));
        if (!hasReadableText || textContent.length < 100) {
          console.log("Text appears garbled or too short, using Gemini vision to read PDF");
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (LOVABLE_API_KEY) {
            try {
              let binary = "";
              const chunkSize = 8192;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...chunk);
              }
              const base64PDF = btoa(binary);
              const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "Extract ALL text content from this PDF document. Include every detail: VIN number, vehicle info, accident history, service records, ownership history, title info, recalls. Return the full text content."
                        },
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:application/pdf;base64,${base64PDF}`
                          }
                        }
                      ]
                    }
                  ],
                  max_tokens: 8000,
                }),
              });

              if (visionResponse.ok) {
                const visionData = await visionResponse.json();
                const extractedText = visionData.choices?.[0]?.message?.content;
                if (extractedText && extractedText.length > 100) {
                  console.log(`Gemini vision extracted ${extractedText.length} chars`);
                  textContent = extractedText;
                  const vinFromVision = extractedText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
                  if (vinFromVision) {
                    console.log("VIN found via Gemini vision:", vinFromVision[1]);
                    textContent += `\nVIN: ${vinFromVision[1]}`;
                  }
                }
              } else {
                console.error("Gemini vision request failed:", visionResponse.status);
              }
            } catch (e) {
              console.error("Gemini vision error:", e);
            }
          }
        }
        
        if (!textContent || textContent.length < 100) {
          textContent = `Vehicle History Report: ${file.name}. File uploaded for analysis.`;
        }
      }
    }

    // Handle URL scraping
    if (reportUrl && !textContent) {
      // Validate URL to prevent SSRF attacks
      const urlValidation = validateUrl(reportUrl);
      if (!urlValidation.valid) {
        console.log(`URL validation failed: ${urlValidation.error}`);
        return new Response(
          JSON.stringify({ success: false, error: urlValidation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validatedUrl = urlValidation.url!.href;
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      
      if (FIRECRAWL_API_KEY) {
        try {
          // Use both markdown and screenshot formats; disable onlyMainContent
          // to capture full page including embedded report sections (AutoCheck, CarFax)
          // and increase waitFor to allow dynamic/JS content to render
          const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: validatedUrl,
              formats: ["markdown", "screenshot"],
              onlyMainContent: false,
              waitFor: 8000,
            }),
          });

          const scrapeData = await scrapeResponse.json();
          const markdownContent = scrapeData.data?.markdown || scrapeData.markdown || "";
          const screenshotBase64 = scrapeData.data?.screenshot || scrapeData.screenshot || "";
          
          console.log(`Firecrawl scraped ${markdownContent.length} chars of markdown, screenshot: ${screenshotBase64 ? 'yes' : 'no'}`);

          // Check if the markdown content looks like it has actual report data
          // (accident info, VIN, title status, owner count, etc.)
          const reportKeywords = /accident|damage|collision|recall|title|salvage|owner|service|maintenance|autocheck|carfax|vehicle\s*score|clean|rebuilt/i;
          const hasReportData = reportKeywords.test(markdownContent) && markdownContent.length > 500;
          
          if (hasReportData) {
            textContent = markdownContent;
            console.log("Using markdown content - contains report keywords");
          }

          // If markdown is thin or missing report data, use Gemini vision on the screenshot
          if (!hasReportData && screenshotBase64) {
            console.log("Markdown lacks report data, using Gemini vision on screenshot");
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
            if (LOVABLE_API_KEY) {
              try {
                const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      {
                        role: "user",
                        content: [
                          {
                            type: "text",
                            text: "This is a screenshot of a vehicle history report page (CarFax, AutoCheck, Experian, or similar). Extract ALL information visible on the page including: VIN, vehicle score/rating, accident history (number of accidents, severity, damage areas), title status, owner count, service/maintenance records, recall information, mileage readings, and any red flags or alerts shown. Be extremely thorough - every detail matters for assessing vehicle risk."
                          },
                          {
                            type: "image_url",
                            image_url: {
                              url: screenshotBase64.startsWith("data:") ? screenshotBase64 : `data:image/png;base64,${screenshotBase64}`
                            }
                          }
                        ]
                      }
                    ],
                    max_tokens: 8000,
                  }),
                });

                if (visionResponse.ok) {
                  const visionData = await visionResponse.json();
                  const extractedText = visionData.choices?.[0]?.message?.content;
                  if (extractedText && extractedText.length > 100) {
                    console.log(`Gemini vision extracted ${extractedText.length} chars from screenshot`);
                    // Combine both sources for maximum data coverage
                    textContent = `=== SCREENSHOT ANALYSIS ===\n${extractedText}\n\n=== PAGE CONTENT ===\n${markdownContent}`;
                  }
                } else {
                  console.error("Gemini vision request failed:", visionResponse.status);
                }
              } catch (e) {
                console.error("Gemini vision error for screenshot:", e);
              }
            }
          }
          
          // If we still don't have content, use whatever markdown we got
          if (!textContent && markdownContent) {
            textContent = markdownContent;
          }
        } catch (e) {
          console.error("Firecrawl error:", e);
        }
      }

      if (!textContent || textContent.length < 100) {
        // Scraping failed completely - most likely anti-bot protection (AutoTrader, CarFax, etc.)
        console.log("URL scraping failed - no usable content retrieved");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Unable to retrieve report data from this URL. The website is blocking automated access. Please take screenshots of the report and upload them instead.",
            scrapeBlocked: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use AI to analyze the vehicle history
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisPrompt = `Analyze this vehicle history report and extract key information. Pay close attention to accident reports, damage records, vehicle scores, and any red flags. Do NOT default to "clean" or "no accidents" unless the report explicitly confirms this. If the report mentions ANY accident, damage, or collision, you MUST report it accurately.

Report Content:
${textContent.slice(0, 15000)}

Extract structured information about accidents, ownership, title status, and service history.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert vehicle history analyst. Extract and analyze vehicle history report data. Be thorough but realistic. If information is missing, indicate "unknown" rather than guessing. Assess overall vehicle health on a 0-100 scale based on available data.
${vehicleMileage ? `\nCRITICAL MILEAGE CONSTRAINT: The vehicle's current odometer reading is ${vehicleMileage.toLocaleString()} miles. You MUST NOT report any service as completed at a mileage higher than ${vehicleMileage.toLocaleString()} miles. All service entries, gap calculations, and maintenance references must be consistent with this odometer reading. Only flag services as "due" if they would normally be required at or below ${vehicleMileage.toLocaleString()} miles.\n` : ''}
For service history analysis:
- Estimate the largest mileage gap between documented services (in miles). If no service records exist, return null.
- Identify major scheduled maintenance items (timing belt, transmission service, coolant flush, spark plugs, brake fluid flush) that should have been completed based on the vehicle's age/mileage but have no documentation.
- Identify major services that ARE documented as completed. Each entry MUST reference only mileages that the vehicle has actually reached.
- Flag any vehicle systems that show repeated repairs (2+ repairs to the same system like transmission, cooling, electrical, engine, suspension).`
          },
          { role: "user", content: analysisPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_vehicle_history",
              description: "Extract structured vehicle history data from a report",
              parameters: {
                type: "object",
                properties: {
                  accidentCount: { 
                    type: "number", 
                    description: "Number of reported accidents (0 if none found)" 
                  },
                  ownerCount: { 
                    type: "number", 
                    description: "Number of previous owners (estimate if unknown)" 
                  },
                  titleStatus: { 
                    type: "string", 
                    enum: ["clean", "salvage", "rebuilt", "lemon"],
                    description: "Title status - default to 'clean' if not mentioned"
                  },
                  serviceRecords: { 
                    type: "boolean", 
                    description: "Whether service records are available" 
                  },
                  lastServiceDate: { 
                    type: "string", 
                    description: "Last service date if known (YYYY-MM-DD format)" 
                  },
                  issues: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of concerns or red flags found (be specific)"
                  },
                  positives: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of positive findings (e.g., 'No accidents reported', 'Regular maintenance')"
                  },
                  healthScore: { 
                    type: "number", 
                    description: "Overall health score 0-100 based on history (100 = excellent)"
                  },
                  summary: {
                    type: "string",
                    description: "Brief 2-3 sentence summary of the vehicle's history"
                  },
                  serviceGapMiles: {
                    type: ["number", "null"],
                    description: "Largest mileage gap (in miles) between consecutive documented services. null if no service records exist or gap can't be determined."
                  },
                  majorServicesDue: {
                    type: "array",
                    items: { type: "string" },
                    description: "Major scheduled maintenance items that should have been completed by now based on age/mileage but have NO documentation (e.g., 'Timing belt replacement', 'Transmission fluid change', 'Coolant flush'). Empty array if all are documented or unknown."
                  },
                  majorServicesDone: {
                    type: "array",
                    items: { type: "string" },
                    description: `Major scheduled maintenance items that ARE documented as completed.${vehicleMileage ? ` All referenced mileages must be at or below the vehicle's current ${vehicleMileage.toLocaleString()} miles.` : ''} Empty array if none documented.`
                  },
                  chronicRepairSystems: {
                    type: "array",
                    items: { type: "string" },
                    description: "Vehicle systems showing repeated/chronic repair patterns (2+ repairs to same system). Use system names like 'transmission', 'cooling', 'electrical', 'engine', 'suspension', 'brakes'. Empty array if none."
                  },
                  openRecallCount: {
                    type: ["number", "null"],
                    description: "Number of OPEN/unresolved manufacturer recalls. If the report says 'No Recalls Reported', 'No open recalls', or similar, return 0. If recall status is not mentioned, return null. Only count recalls explicitly marked as open/unresolved — do NOT count completed/resolved recalls."
                  },
                  resolvedRecallCount: {
                    type: ["number", "null"],
                    description: "Number of manufacturer recalls that have been COMPLETED/RESOLVED for this specific vehicle. If the report shows recalls were remedied/fixed, count those here. Return 0 if no resolved recalls mentioned. Return null if recall information is not present in the report."
                  },
                  vin: {
                    type: ["string", "null"],
                    description: "The 17-character Vehicle Identification Number (VIN) if present in the report. Return null if not found."
                  },
                  warrantyMonthsRemaining: {
                    type: ["number", "null"],
                    description: "Months of factory or CPO warranty remaining as stated in the report (e.g., CarFax 'Warranty Information' section). Return the number of months if explicitly stated. Return null if warranty coverage is not mentioned."
                  },
                  isCPO: {
                    type: ["boolean", "null"],
                    description: "Whether the vehicle is Certified Pre-Owned (CPO). Return true if the report mentions CPO certification, manufacturer-backed certification, or dealer certification program. Return false if explicitly not CPO. Return null if not mentioned."
                  }
                },
                required: ["accidentCount", "ownerCount", "titleStatus", "serviceRecords", "issues", "positives", "healthScore", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_vehicle_history" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const historyAnalysis = JSON.parse(toolCall.function.arguments);

    // If AI didn't extract VIN, try brute-force regex on raw PDF text
    if (!historyAnalysis.vin && textContent) {
      const vinMatch = textContent.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
      if (vinMatch) {
        historyAnalysis.vin = vinMatch[1];
        console.log("VIN extracted via regex fallback:", historyAnalysis.vin);
      }
    }

    console.log("Successfully analyzed vehicle history, VIN:", historyAnalysis.vin || "not found");

    return new Response(
      JSON.stringify({
        success: true,
        history: historyAnalysis,
        storagePath: storagePath || undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Parse history error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to parse history report",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Simple PDF text extraction (extracts text between stream markers)
function extractTextFromPDF(bytes: Uint8Array): string {
  const decoder = new TextDecoder("latin1");
  const content = decoder.decode(bytes);
  
  const textParts: string[] = [];
  
  // Look for text in PDF streams
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/gi;
  let match;
  
  while ((match = streamRegex.exec(content)) !== null) {
    const streamContent = match[1];
    // Extract readable text (BT...ET blocks contain text)
    const textRegex = /\((.*?)\)/g;
    let textMatch;
    while ((textMatch = textRegex.exec(streamContent)) !== null) {
      const text = textMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (text.length > 2 && /[a-zA-Z0-9]/.test(text)) {
        textParts.push(text);
      }
    }
  }
  
  // Also try to find plain text markers
  const plainTextRegex = /\/T\s*\((.*?)\)/g;
  while ((match = plainTextRegex.exec(content)) !== null) {
    textParts.push(match[1]);
  }
  
  return textParts.join(" ").trim();
}

// Decompress FlateDecode PDF streams to extract text from compressed content
async function decompressPDFStreams(bytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder("latin1");
  const content = decoder.decode(bytes);
  const textParts: string[] = [];

  // Find all stream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  
  while ((match = streamRegex.exec(content)) !== null) {
    const streamBytes = new Uint8Array(match[1].length);
    for (let i = 0; i < match[1].length; i++) {
      streamBytes[i] = match[1].charCodeAt(i);
    }
    
    try {
      // Try to decompress as deflate (FlateDecode)
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      
      writer.write(streamBytes).catch(() => {});
      writer.close().catch(() => {});
      
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      if (chunks.length > 0) {
        const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
        const combined = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        
        const decompressed = new TextDecoder("latin1").decode(combined);
        // Extract text from PDF text operators: (text)Tj, (text)TJ, (text)'
        const pdfTextRegex = /\(([^)]*)\)/g;
        let textMatch;
        while ((textMatch = pdfTextRegex.exec(decompressed)) !== null) {
          const text = textMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
          if (text.length >= 1 && /[a-zA-Z0-9]/.test(text)) {
            textParts.push(text);
          }
        }
      }
    } catch {
      // Not a deflate stream, skip
    }
  }
  
  return textParts.join(" ").trim();
}
