import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { VehicleInputStep } from "@/components/analysis/VehicleInputStep";
import { ConditionStep } from "@/components/analysis/ConditionStep";
import { HistoryStep } from "@/components/analysis/HistoryStep";
import { FinancingStep } from "@/components/analysis/FinancingStep";
import { Progress } from "@/components/ui/progress";
import { VehicleInfo, VehicleCondition, FinancingInfo } from "@/types/vehicle";
import { useNavigate } from "react-router-dom";

const steps = [
  { id: 1, name: "Vehicle Info" },
  { id: 2, name: "Condition" },
  { id: 3, name: "History" },
  { id: 4, name: "Financing" },
];

export default function AnalyzePage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form data state
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [condition, setCondition] = useState<VehicleCondition | null>(null);
  const [historyFile, setHistoryFile] = useState<File | undefined>();
  const [historyUrl, setHistoryUrl] = useState<string | undefined>();
  const [financing, setFinancing] = useState<FinancingInfo | null>(null);

  const progress = (currentStep / steps.length) * 100;

  const vehicleSummary = vehicle 
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`
    : "";

  // Step handlers
  const handleVehicleComplete = (v: VehicleInfo) => {
    setVehicle(v);
    setCurrentStep(2);
  };

  const handleConditionComplete = (c: VehicleCondition) => {
    setCondition(c);
    setCurrentStep(3);
  };

  const handleHistoryComplete = (file?: File, url?: string) => {
    setHistoryFile(file);
    setHistoryUrl(url);
    setCurrentStep(4);
  };

  const handleHistorySkip = () => {
    setCurrentStep(4);
  };

  const handleFinancingComplete = async (f: FinancingInfo) => {
    setFinancing(f);
    
    // TODO: Submit to AI analysis and navigate to report
    // For now, just show a placeholder
    console.log("Analysis data:", {
      vehicle,
      condition,
      historyFile: historyFile?.name,
      historyUrl,
      financing: f,
    });

    // Navigate to report page (will be implemented next)
    // For now, store in sessionStorage for demo
    sessionStorage.setItem("analysisData", JSON.stringify({
      vehicle,
      condition,
      historyUrl,
      financing: f,
    }));
    
    navigate("/report/demo");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex-1 bg-gradient-hero py-8">
        <div className="container mx-auto max-w-3xl px-4">
          {/* Progress header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-semibold">New Vehicle Analysis</h1>
              <span className="text-sm text-muted-foreground">
                Step {currentStep} of {steps.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="mt-2 flex justify-between">
              {steps.map((step) => (
                <span
                  key={step.id}
                  className={`text-xs ${
                    step.id <= currentStep ? "text-primary font-medium" : "text-muted-foreground"
                  }`}
                >
                  {step.name}
                </span>
              ))}
            </div>
          </div>

          {/* Step content */}
          {currentStep === 1 && (
            <VehicleInputStep
              onComplete={handleVehicleComplete}
              initialData={vehicle || undefined}
            />
          )}

          {currentStep === 2 && vehicle && (
            <ConditionStep
              onComplete={handleConditionComplete}
              onBack={() => setCurrentStep(1)}
              initialData={condition || undefined}
              vehicleSummary={vehicleSummary}
            />
          )}

          {currentStep === 3 && (
            <HistoryStep
              onComplete={handleHistoryComplete}
              onBack={() => setCurrentStep(2)}
              onSkip={handleHistorySkip}
            />
          )}

          {currentStep === 4 && condition && (
            <FinancingStep
              onComplete={handleFinancingComplete}
              onBack={() => setCurrentStep(3)}
              askingPrice={condition.askingPrice}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
