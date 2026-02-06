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
import { Upload, FileText, Link as LinkIcon, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const historySchema = z.object({
  historyUrl: z.string().url().optional().or(z.literal("")),
});

interface HistoryStepProps {
  onComplete: (historyFile?: File, historyUrl?: string) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function HistoryStep({ onComplete, onBack, onSkip }: HistoryStepProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof historySchema>>({
    resolver: zodResolver(historySchema),
    defaultValues: { historyUrl: "" },
  });

  const handleFileSelect = (file: File) => {
    if (file.type === "application/pdf") {
      setUploadedFile(file);
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

  const handleSubmit = (data: z.infer<typeof historySchema>) => {
    onComplete(uploadedFile || undefined, data.historyUrl || undefined);
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vehicle History Report</h2>
        <p className="text-muted-foreground">
          Upload a Carfax or vehicle history report for deeper analysis.
        </p>
      </div>

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
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {uploadedFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="font-medium text-success">File uploaded</p>
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
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                <Button type="button" variant="outline" onClick={onBack}>
                  Back
                </Button>
                <Button type="submit" disabled={!uploadedFile && !form.watch("historyUrl")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Analyze History
                </Button>
                <Button type="button" variant="ghost" onClick={onSkip}>
                  Skip for now
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4">
          <p className="text-sm text-warning-foreground">
            <strong>Note:</strong> Without a vehicle history report, we'll provide estimates based on 
            average data for this make/model. A Carfax report allows for much more accurate analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
