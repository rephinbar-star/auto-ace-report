import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractFromScreenshot } from "@/lib/api/extract-screenshot";
import { useToast } from "@/hooks/use-toast";

interface VinCameraScannerProps {
  onVinCaptured: (vin: string) => void;
  label?: string;
}

export function VinCameraScanner({ onVinCaptured, label = "Scan" }: VinCameraScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const result = await extractFromScreenshot(file);

      if (!result.success || !result.vehicle?.vin) {
        toast({
          title: "VIN Not Found",
          description: result.error || "Couldn't read a VIN from the photo. Try a clearer shot of the VIN sticker.",
          variant: "destructive",
        });
        return;
      }

      const vin = result.vehicle.vin.toUpperCase();
      toast({
        title: "VIN Scanned!",
        description: `Captured: ${vin}`,
      });
      onVinCaptured(vin);
    } catch {
      toast({
        title: "Scan Failed",
        description: "Something went wrong. Please try again or type the VIN manually.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
      // Reset input so the same file can be selected again
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCapture}
        aria-hidden="true"
      />
      <Button
        type="button"
        variant="outline"
        className="h-10 gap-1.5"
        disabled={isScanning}
        onClick={() => inputRef.current?.click()}
        aria-label="Scan VIN with camera"
      >
        {isScanning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        <span>{isScanning ? "Scanning…" : label}</span>
      </Button>
    </>
  );
}
