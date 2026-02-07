import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ImageIcon, X, ExternalLink, Maximize2 } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface VehicleImageGalleryProps {
  images: string[];
  vehicleName: string;
  listingUrl?: string;
}

export function VehicleImageGallery({ images, vehicleName, listingUrl }: VehicleImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const handleImageError = useCallback((index: number) => {
    setFailedImages(prev => new Set(prev).add(index));
    if (index === currentIndex) {
      const nextValid = images.findIndex((_, i) => i > index && !failedImages.has(i));
      if (nextValid !== -1) {
        setCurrentIndex(nextValid);
      }
    }
  }, [currentIndex, images, failedImages]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      let newIndex = prev - 1;
      if (newIndex < 0) newIndex = images.length - 1;
      while (failedImages.has(newIndex) && newIndex !== prev) {
        newIndex = newIndex - 1;
        if (newIndex < 0) newIndex = images.length - 1;
      }
      return newIndex;
    });
  }, [images.length, failedImages]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      let newIndex = prev + 1;
      if (newIndex >= images.length) newIndex = 0;
      while (failedImages.has(newIndex) && newIndex !== prev) {
        newIndex = newIndex + 1;
        if (newIndex >= images.length) newIndex = 0;
      }
      return newIndex;
    });
  }, [images.length, failedImages]);

  // Keyboard navigation
  useEffect(() => {
    if (!isFullscreen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, goToPrevious, goToNext]);

  if (!images || images.length === 0) {
    return null;
  }

  // Filter out failed images
  const validImages = images.filter((_, idx) => !failedImages.has(idx));
  
  if (validImages.length === 0) {
    return null;
  }

  // Get display index among valid images
  const validCurrentIndex = validImages.findIndex((img) => img === images[currentIndex]) + 1;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5 text-primary" />
              Vehicle Photos
            </CardTitle>
            {listingUrl && (
              <a 
                href={listingUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                View Listing <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Main Image */}
          <div 
            className="relative aspect-video overflow-hidden rounded-lg bg-muted cursor-pointer group"
            onClick={() => setIsFullscreen(true)}
          >
            {!failedImages.has(currentIndex) && (
              <img
                src={images[currentIndex]}
                alt={`${vehicleName} - Photo ${validCurrentIndex}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                onError={() => handleImageError(currentIndex)}
              />
            )}
            
            {/* Navigation Arrows */}
            {validImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            
            {/* Image Counter */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {validCurrentIndex} / {validImages.length}
            </div>
            
            {/* Click hint */}
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <Maximize2 className="h-3 w-3" />
              Click to enlarge
            </div>
          </div>

          {/* Thumbnails */}
          {validImages.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {images.slice(0, 8).map((img, idx) => {
                if (failedImages.has(idx)) return null;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${
                      currentIndex === idx 
                        ? 'border-primary ring-1 ring-primary' 
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={() => handleImageError(idx)}
                    />
                  </button>
                );
              })}
              {validImages.length > 8 && (
                <div className="flex-shrink-0 w-14 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  +{validImages.length - 8}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>{vehicleName} Photos</DialogTitle>
          </VisuallyHidden>
          
          <div className="relative w-full h-[85vh] flex flex-col">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
            
            {/* Main Image Container */}
            <div className="flex-1 flex items-center justify-center relative">
              {!failedImages.has(currentIndex) && (
                <img
                  src={images[currentIndex]}
                  alt={`${vehicleName} - Photo ${validCurrentIndex}`}
                  className="max-w-full max-h-full object-contain"
                  onError={() => handleImageError(currentIndex)}
                />
              )}
              
              {/* Navigation */}
              {validImages.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full p-3 transition-colors"
                    aria-label="Previous image (Left Arrow)"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full p-3 transition-colors"
                    aria-label="Next image (Right Arrow)"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </>
              )}
            </div>
            
            {/* Bottom Bar with Thumbnails */}
            <div className="bg-black/80 px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                {/* Thumbnail strip in fullscreen */}
                <div className="flex gap-2 overflow-x-auto max-w-[80vw]">
                  {images.map((img, idx) => {
                    if (failedImages.has(idx)) return null;
                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                          currentIndex === idx 
                            ? 'border-white ring-2 ring-white/50' 
                            : 'border-transparent opacity-50 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(idx)}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Counter and keyboard hint */}
              <div className="flex items-center justify-center gap-4 mt-2 text-white/70 text-xs">
                <span>{validCurrentIndex} / {validImages.length}</span>
                <span className="hidden sm:inline">Use ← → arrow keys to navigate</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
