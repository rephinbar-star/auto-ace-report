import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Link as LinkIcon, X, CheckCircle, Loader2, AlertTriangle, Shield, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { VehicleHistory } from "@/types/vehicle";
import { parseHistoryReport } from "@/lib/api/parse-history";
import { useToast } from "@/hooks/use-toast";
import { ScreenshotTooltip } from "@/components/analysis/ScreenshotTooltip";

const historySchema = z.object({
  historyUrl: z.string().url().optional().or(z.literal("")),
});

interface HistoryStepProps {
  onComplete: (history?: VehicleHistory) => void;
  onBack: () => void;
  onSkip: () => void;
  mileage?: number;
  onVinExtracted?: (vin: string) => void;
}

export function HistoryStep({ onComplete, onBack, onSkip, mileage, onVinExtracted }: HistoryStepProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<(VehicleHistory & { summary?: string }) | null>(null);
  const [urlAccessError, setUrlAccessError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof historySchema>>({
    resolver: zodResolver(historySchema),
    defaultValues: { historyUrl: "" },
  });

  const acceptedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

  const handleFileSelect = (file: File) => {
    if (acceptedTypes.includes(file.type)) {
      setUploadedFile(file);
      setAnalysisResult(null);
      // If we're in the URL error state, switch back to main view so user can analyze
      if (urlAccessError) {
        setUrlAccessError(false);
      }
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or image file (PNG, JPG, WebP).",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const readReport = async () => {
    const historyUrl = form.getValues("historyUrl");
    
    if (!uploadedFile && !historyUrl) {
      toast({
        title: "No report provided",
        description: "Please upload a PDF or enter a CarFax/AutoCheck URL.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setUrlAccessError(false);

    try {
      const result = await parseHistoryReport(uploadedFile || undefined, historyUrl || undefined, mileage);

      if (result.success && result.history) {
        setAnalysisResult(result.history);
        setUrlAccessError(false);
        // Extract VIN if found in the history report
        if (result.history.vin && onVinExtracted) {
          onVinExtracted(result.history.vin);
        }
        toast({
          title: "Report Read Successfully",
          description: "Vehicle history data extracted. It will be analyzed with your full report.",
        });
      } else {
        // Check if this is a URL access error (no file uploaded, only URL)
        if (!uploadedFile && historyUrl) {
          setUrlAccessError(true);
        } else {
          toast({
            title: "Could Not Read Report",
            description: result.error || "Could not read the report. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      // If only URL was provided, show URL access error
      if (!uploadedFile && historyUrl) {
        setUrlAccessError(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to read report. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContinue = () => {
    if (analysisResult) {
      onComplete(analysisResult);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setAnalysisResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getHealthScoreBg = (score: number) => {
    if (score >= 80) return "bg-success/10";
    if (score >= 60) return "bg-warning/10";
    return "bg-destructive/10";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vehicle History Report</h2>
        <p className="text-muted-foreground">
          Upload a CarFax/AutoCheck report (PDF or screenshots) for deeper analysis.
        </p>
      </div>

      {/* URL Access Error State */}
      {urlAccessError && !analysisResult && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              CarFax/AutoCheck Data Not Accessible
            </CardTitle>
            <CardDescription>
              CarFax/AutoCheck data is not accessible through the link. Please upload it in PDF format instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              CarFax/AutoCheck reports are protected and cannot be scraped directly. To include your vehicle history in the analysis:
            </p>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Open your CarFax/AutoCheck report in a browser</li>
              <li>Print the page as PDF (Ctrl+P / Cmd+P → Save as PDF)</li>
              <li>Upload the PDF file below</li>
            </ol>
            
            {/* File upload area for retry */}
            <div
              className={cn(
                "relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                "border-muted-foreground/25 hover:border-primary/50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Upload CarFax/AutoCheck PDF or Screenshots</p>
                <p className="text-sm text-muted-foreground">Click to browse</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button 
                type="button" 
                onClick={() => {
                  setUrlAccessError(false);
                  onSkip();
                }}
              >
                Continue Without History
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!analysisResult && !urlAccessError ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload Report</CardTitle>
            <CardDescription>
              Upload a PDF or screenshots of your report. We'll extract accident history, service records, and ownership details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File upload area */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">PDF, PNG, JPG, or WebP</p>
              <ScreenshotTooltip />
            </div>
            <div
              className={cn(
                "relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50",
                uploadedFile && "border-success bg-success/5"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isAnalyzing && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={isAnalyzing}
              />

              {uploadedFile ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-success">File ready</p>
                    <p className="text-sm text-muted-foreground">{uploadedFile.name}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={isAnalyzing}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Drop your CarFax/AutoCheck PDF or screenshots here</p>
                    <p className="text-sm text-muted-foreground">PDF, PNG, JPG, or WebP</p>
                  </div>
                </div>
              )}
            </div>

            {/* URL input - hidden when file is uploaded */}
            {!uploadedFile && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or enter URL</span>
                  </div>
                </div>

                <Form {...form}>
                  <FormField
                    control={form.control}
                    name="historyUrl"
                    render={({ field }) => (
                      <FormItem>
                    <FormLabel className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4" />
                          CarFax/AutoCheck Link
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://www.carfax.com/VehicleHistory/..." 
                            {...field}
                            disabled={isAnalyzing}
                          />
                        </FormControl>
                        <FormDescription>
                          If you have a link to the CarFax/AutoCheck report, we'll attempt to extract key details.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Form>
              </>
            )}

            <div className="flex flex-wrap gap-4">
              <Button type="button" variant="outline" onClick={onBack} disabled={isAnalyzing}>
                Back
              </Button>
              <Button 
                type="button" 
                onClick={readReport}
                disabled={isAnalyzing || (!uploadedFile && !form.watch("historyUrl"))}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reading Report...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Read Report
                  </>
                )}
              </Button>
              <Button type="button" variant="ghost" onClick={onSkip} disabled={isAnalyzing}>
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {analysisResult && (
        <Card className="border-success/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Report Data Extracted
            </CardTitle>
            <CardDescription>
              History data has been read successfully and will be included in your full report analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key stats preview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold">{analysisResult.accidentCount}</p>
                <p className="text-xs text-muted-foreground">Accidents</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold">{analysisResult.ownerCount}</p>
                <p className="text-xs text-muted-foreground">Owners</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <Badge variant={analysisResult.titleStatus === "clean" ? "default" : "destructive"} className="capitalize">
                  {analysisResult.titleStatus}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">Title</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <Badge variant={analysisResult.serviceRecords ? "default" : "secondary"}>
                  {analysisResult.serviceRecords ? "Yes" : "No"}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">Service Records</p>
              </div>
            </div>

            {analysisResult.vin && (
              <p className="text-sm text-muted-foreground">
                VIN detected: <span className="font-mono font-medium text-foreground">{analysisResult.vin}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-4">
              <Button type="button" variant="outline" onClick={() => setAnalysisResult(null)}>
                Upload Different Report
              </Button>
              <Button onClick={handleContinue}>
                Continue with Report Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!analysisResult && !urlAccessError && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-warning" />
            <p className="text-sm text-warning-foreground">
              <strong>Note:</strong> Without a vehicle history report, we'll provide estimates based on 
              average data for this make/model. A Carfax report allows for much more accurate analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
