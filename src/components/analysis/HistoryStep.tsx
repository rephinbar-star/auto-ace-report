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

const historySchema = z.object({
  historyUrl: z.string().url().optional().or(z.literal("")),
});

interface HistoryStepProps {
  onComplete: (history?: VehicleHistory) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function HistoryStep({ onComplete, onBack, onSkip }: HistoryStepProps) {
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

  const handleFileSelect = (file: File) => {
    if (file.type === "application/pdf") {
      setUploadedFile(file);
      setAnalysisResult(null);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
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

  const analyzeReport = async () => {
    const historyUrl = form.getValues("historyUrl");
    
    if (!uploadedFile && !historyUrl) {
      toast({
        title: "No report provided",
        description: "Please upload a PDF or enter a Carfax URL.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setUrlAccessError(false);

    try {
      const result = await parseHistoryReport(uploadedFile || undefined, historyUrl || undefined);

      if (result.success && result.history) {
        setAnalysisResult(result.history);
        setUrlAccessError(false);
        toast({
          title: "Report Analyzed",
          description: `Health Score: ${result.history.healthScore}/100`,
        });
      } else {
        // Check if this is a URL access error (no file uploaded, only URL)
        if (!uploadedFile && historyUrl) {
          setUrlAccessError(true);
        } else {
          toast({
            title: "Analysis Failed",
            description: result.error || "Could not analyze the report. Please try again.",
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
          description: "Failed to analyze report. Please try again.",
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
          Upload a Carfax or vehicle history report for deeper analysis.
        </p>
      </div>

      {/* URL Access Error State */}
      {urlAccessError && !analysisResult && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              CarFax Data Not Accessible
            </CardTitle>
            <CardDescription>
              CarFax data is not accessible through the link. Please upload it in PDF format instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              CarFax reports are protected and cannot be scraped directly. To include your vehicle history in the analysis:
            </p>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Open your CarFax report in a browser</li>
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
                accept="application/pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Upload CarFax PDF</p>
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
              Drag and drop a PDF or click to browse. We'll extract accident history, service records, and ownership details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File upload area */}
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
                accept="application/pdf"
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
                    <p className="font-medium">Drop your Carfax PDF here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or enter URL</span>
              </div>
            </div>

            {/* URL input */}
            <Form {...form}>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="historyUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Carfax Link
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://www.carfax.com/VehicleHistory/..." 
                          {...field}
                          disabled={isAnalyzing}
                        />
                      </FormControl>
                      <FormDescription>
                        If you have a link to the Carfax report, we'll attempt to extract key details.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-4">
                  <Button type="button" variant="outline" onClick={onBack} disabled={isAnalyzing}>
                    Back
                  </Button>
                  <Button 
                    type="button" 
                    onClick={analyzeReport}
                    disabled={isAnalyzing || (!uploadedFile && !form.watch("historyUrl"))}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Analyze History
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="ghost" onClick={onSkip} disabled={isAnalyzing}>
                    Skip for now
                  </Button>
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Analysis Complete</span>
              <div className={cn("flex items-center gap-2 rounded-full px-3 py-1", getHealthScoreBg(analysisResult.healthScore))}>
                <Shield className={cn("h-4 w-4", getHealthScoreColor(analysisResult.healthScore))} />
                <span className={cn("font-bold", getHealthScoreColor(analysisResult.healthScore))}>
                  {analysisResult.healthScore}/100
                </span>
              </div>
            </CardTitle>
            <CardDescription>
              {analysisResult.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Key stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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

            {/* Positives */}
            {analysisResult.positives.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium text-success">
                  <CheckCircle className="h-4 w-4" />
                  Positives
                </h4>
                <ul className="space-y-1">
                  {analysisResult.positives.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {analysisResult.issues.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Concerns
                </h4>
                <ul className="space-y-1">
                  {analysisResult.issues.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <Button type="button" variant="outline" onClick={() => setAnalysisResult(null)}>
                Analyze Different Report
              </Button>
              <Button onClick={handleContinue}>
                Continue with Analysis
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
