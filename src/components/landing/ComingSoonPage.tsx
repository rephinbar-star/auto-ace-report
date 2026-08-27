import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ComingSoonPageProps {
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  previewItems: string[];
}

export function ComingSoonPage({
  title,
  description,
  seoTitle,
  seoDescription,
  seoKeywords,
  previewItems,
}: ComingSoonPageProps) {
  return (
    <>
      <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center bg-gradient-hero py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl">
              <Button asChild variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to solutions
                </Link>
              </Button>

              <Card className="border-2 bg-gradient-card shadow-card">
                <CardHeader className="text-center">
                  <Badge
                    variant="secondary"
                    className="mx-auto mb-4 w-fit"
                  >
                    Coming soon
                  </Badge>
                  <CardTitle className="text-3xl font-bold tracking-tight md:text-4xl">
                    {title}
                  </CardTitle>
                  <p className="mx-auto max-w-lg pt-2 text-lg text-muted-foreground">
                    {description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-xl border bg-card/50 p-5">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Planned inputs & results
                    </h2>
                    <ul className="space-y-3">
                      {previewItems.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-muted-foreground"
                        >
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to solutions
                      </Link>
                    </Button>
                    <Button asChild className="group flex-1">
                      <Link to="/analyze">
                        Try used-car analysis
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    This module is not yet live. No pricing, offers, or lender approvals are
                    implied.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
