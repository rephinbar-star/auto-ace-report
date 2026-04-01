import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon, ExternalLink, Maximize2 } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface VehicleImageGalleryProps {
  images: string[];
  vehicleName: string;
  listingUrl?: string;
}

export function VehicleImageGallery({ images, vehicleName, listingUrl }: VehicleImageGalleryProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (!images || images.length === 0 || imageFailed) {
    return null;
  }

  const heroImage = images[0];

  return (
    <>
      <Card className="overflow-hidden">
        <div 
          className="relative aspect-video overflow-hidden bg-muted cursor-pointer group"
          onClick={() => setIsFullscreen(true)}
        >
          <img
            src={heroImage}
            alt={vehicleName}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
          
          {/* Vehicle name overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-white text-sm font-medium">
                <ImageIcon className="h-4 w-4" />
                {vehicleName}
              </div>
              {listingUrl && (
                <a 
                  href={listingUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white text-xs flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Listing <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Enlarge hint */}
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            Enlarge
          </div>
        </div>
      </Card>

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>{vehicleName}</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center h-[85vh]">
            <img
              src={heroImage}
              alt={vehicleName}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
