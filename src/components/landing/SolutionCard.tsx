import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SolutionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  status: "Available now" | "Coming soon";
  featured?: boolean;
}

export function SolutionCard({
  icon: Icon,
  title,
  description,
  ctaLabel,
  href,
  status,
  featured = false,
}: SolutionCardProps) {
  const isAvailable = status === "Available now";

  return (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden border-2 bg-gradient-card transition-all duration-200",
        "hover:shadow-card focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        featured
          ? "border-primary/30 bg-primary/[0.03] hover:border-primary/50"
          : "hover:border-primary/20"
      )}
    >
      <CardHeader className="flex-1">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              featured ? "bg-primary/15" : "bg-primary/10"
            )}
          >
            <Icon className={cn("h-6 w-6", featured ? "text-primary" : "text-primary")} />
          </div>
          <Badge
            variant={isAvailable ? "default" : "secondary"}
            className={cn(
              "shrink-0",
              isAvailable && "bg-success text-success-foreground hover:bg-success/90"
            )}
          >
            {status}
          </Badge>
        </div>
        <h3 className="mb-2 text-xl font-bold tracking-tight text-foreground">{title}</h3>
        <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          asChild
          variant={featured ? "default" : "outline"}
          className="w-full group/btn"
          size="lg"
        >
          <Link to={href}>
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
