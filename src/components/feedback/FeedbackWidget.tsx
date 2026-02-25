import { useState, useRef } from "react";
import { MessageSquarePlus, X, Loader2, Camera, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [type, setType] = useState<"suggestion" | "issue">("suggestion");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const screenshotDataRef = useRef<string | null>(null);

  const captureScreenshot = async () => {
    try {
      const canvas = await html2canvas(document.body, {
        ignoreElements: (el) => el.id === "feedback-widget",
        scale: 0.5,
        logging: false,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png", 0.7);
      screenshotDataRef.current = dataUrl;
      setScreenshotPreview(dataUrl);
    } catch (e) {
      console.error("Screenshot failed:", e);
    }
  };

  const handleOpen = async () => {
    setIsOpen(true);
    setIsSuccess(false);
    // Auto-capture screenshot when opening as issue
    if (type === "issue") {
      await captureScreenshot();
    }
  };

  const handleTypeChange = async (val: "suggestion" | "issue") => {
    setType(val);
    if (val === "issue" && !screenshotDataRef.current) {
      await captureScreenshot();
    }
    if (val === "suggestion") {
      screenshotDataRef.current = null;
      setScreenshotPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-feedback", {
        body: {
          type,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          screenshot: type === "issue" ? screenshotDataRef.current : null,
          pageUrl: window.location.href,
        },
      });
      if (error) throw error;

      setIsSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        setName("");
        setEmail("");
        setMessage("");
        setType("suggestion");
        screenshotDataRef.current = null;
        setScreenshotPreview(null);
      }, 2000);
    } catch (err) {
      console.error("Feedback submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="feedback-widget" className="fixed z-50 hidden sm:block" style={{ bottom: "6rem", right: "-1px" }}>
      {/* Vertical tab trigger */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 rounded-l-xl bg-primary px-3.5 py-4 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Suggestions / Support
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed bottom-20 right-4 z-50 w-[340px] rounded-xl border bg-card shadow-xl animate-in slide-in-from-right-5 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Share Feedback</h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {isSuccess ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <CheckCircle className="h-10 w-10 text-success" />
                <p className="text-sm font-medium text-foreground">Thank you!</p>
                <p className="text-xs text-muted-foreground">Your feedback has been sent.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 p-4">
                {/* Type selector */}
                <RadioGroup
                  value={type}
                  onValueChange={(v) => handleTypeChange(v as "suggestion" | "issue")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="suggestion" id="fb-suggestion" />
                    <Label htmlFor="fb-suggestion" className="text-xs cursor-pointer">Make a Suggestion</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="issue" id="fb-issue" />
                    <Label htmlFor="fb-issue" className="text-xs cursor-pointer">Report an Issue</Label>
                  </div>
                </RadioGroup>

                <div className="space-y-1">
                  <Label htmlFor="fb-name" className="text-xs">Name</Label>
                  <Input id="fb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-8 text-xs" required />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="fb-email" className="text-xs">Email</Label>
                  <Input id="fb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-8 text-xs" required />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="fb-message" className="text-xs">
                    {type === "suggestion" ? "Describe your suggestion" : "Describe the issue"}
                  </Label>
                  <Textarea id="fb-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={type === "suggestion" ? "I'd love to see..." : "I encountered a problem with..."} className="min-h-[80px] text-xs resize-none" required />
                </div>

                {/* Screenshot preview for issues */}
                {type === "issue" && screenshotPreview && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Camera className="h-3 w-3" />
                      <span>Screenshot attached</span>
                    </div>
                    <img src={screenshotPreview} alt="Screenshot" className="rounded border w-full h-auto max-h-24 object-cover object-top" />
                  </div>
                )}

                <Button type="submit" size="sm" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Sending...</> : "Submit"}
                </Button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
