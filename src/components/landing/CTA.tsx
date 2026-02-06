import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="bg-primary py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold tracking-tight text-primary-foreground md:text-4xl">
            Ready to Make a Smarter Car Purchase?
          </h2>
          <p className="mb-8 text-lg text-primary-foreground/80">
            Join thousands of smart buyers who use CarWise to avoid overpaying 
            and catch hidden problems before they become expensive surprises.
          </p>
          <Button 
            asChild 
            size="lg" 
            variant="secondary" 
            className="group h-12 px-8 text-base"
          >
            <Link to="/analyze">
              Analyze Your First Vehicle
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
