import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ValidationExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card/50">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            How validation works
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t px-4 py-4 text-sm text-muted-foreground">
        <p>
          CarWise searches inventory and published offers across multiple independent sources:
          live local dealer inventory, published OEM and regional programs, public dealer specials
          pages, and independent lease/deal indexes. Each result states which kind of source it
          came from, and a published program is never shown as if it were in stock unless CarWise
          separately found an eligible nearby vehicle.
        </p>

        <ul className="space-y-2">
          <li>
            <strong className="text-foreground">Corroborated</strong> — the source publishes
            numeric terms (monthly, term, and upfront where stated) for the same year/make/model
            that we could parse unambiguously.
          </li>
          <li>
            <strong className="text-foreground">Also featured</strong> — the source currently
            mentions this vehicle editorially, but full numeric terms were not parseable. This is
            not a price match.
          </li>
          <li>
            <strong className="text-foreground">No comparable benchmark found</strong> — the
            source is readable but does not currently cover this vehicle.
          </li>
          <li>
            <strong className="text-foreground">Source unavailable</strong> — the page could not
            be read publicly. We never bypass logins, paywalls, CAPTCHAs, or bot protections.
          </li>
        </ul>
        <p>
          Benchmark deals often depend on region, credit tier, broker fees, and conditional
          loyalty, military, or college incentives that may not apply to you. A source mentioning
          a model never makes a listing "the best deal."
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
