import { CheckCircle2, Circle } from "lucide-react";

type ProgressStyle = "glass" | "gradient" | "clean";

interface FormProgressCardProps {
  style?: ProgressStyle;
  currentStep?: number;
  totalSteps?: number;
  steps?: string[];
}

const styleTokens: Record<
  ProgressStyle,
  {
    container: React.CSSProperties;
    primaryText: string;
    mutedText: string;
    accent: string;
    barTrack: string;
  }
> = {
  glass: {
    container: {
      background: "rgba(30, 30, 32, 0.7)",
      backdropFilter: "blur(12px)",
      border: "1px solid #2D2D33",
      boxShadow: "none",
    },
    primaryText: "#FFFFFF",
    mutedText: "rgba(255, 255, 255, 0.7)",
    accent: "#FCD34D",
    barTrack: "rgba(252, 211, 77, 0.2)",
  },
  gradient: {
    container: {
      background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
      border: "none",
      boxShadow: "0 8px 32px rgba(252, 211, 77, 0.3)",
    },
    primaryText: "#000000",
    mutedText: "rgba(0, 0, 0, 0.7)",
    accent: "#000000",
    barTrack: "rgba(0, 0, 0, 0.15)",
  },
  clean: {
    container: {
      background: "#1F1F1F",
      border: "1px solid #3F3F3F",
      boxShadow: "0 2px 24px rgba(252, 211, 77, 0.1)",
    },
    primaryText: "#FFFFFF",
    mutedText: "rgba(255, 255, 255, 0.7)",
    accent: "#FCD34D",
    barTrack: "rgba(252, 211, 77, 0.2)",
  },
};

export function FormProgressCard({
  style = "clean",
  currentStep = 1,
  totalSteps = 8,
  steps = [
    "Present Complaint",
    "Previous Consultations",
    "Pain Assessment",
    "Medical History",
    "Lifestyle Factors",
    "Treatment Goals",
    "Diagnostic Reports",
    "Referral",
  ],
}: FormProgressCardProps) {
  const tokens = styleTokens[style];
  const safeTotal = Math.max(1, totalSteps);
  const safeStep = Math.min(Math.max(currentStep, 1), safeTotal);
  const progress = (safeStep / safeTotal) * 100;

  return (
    <div
      className="w-full max-w-[340px] rounded-[24px] p-6 space-y-5"
      style={tokens.container}
    >
      <div className="flex items-center justify-between">
        <h3
          style={{
            color: tokens.primaryText,
            fontFamily: "Inter, sans-serif",
            fontSize: "16px",
            fontWeight: 600,
          }}
        >
          Form Progress
        </h3>
        <span
          style={{
            color: tokens.accent,
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          {safeStep}/{safeTotal}
        </span>
      </div>

      <div>
        <div
          className="w-full rounded-full overflow-hidden mb-2"
          style={{ backgroundColor: tokens.barTrack, height: "8px" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background:
                style === "gradient"
                  ? "rgba(0, 0, 0, 0.6)"
                  : "linear-gradient(90deg, #FCD34D 0%, #FBBF24 100%)",
              boxShadow: style === "gradient" ? "none" : "0 0 8px rgba(252, 211, 77, 0.4)",
            }}
          />
        </div>
        <p
          style={{
            color: tokens.mutedText,
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
          }}
        >
          {Math.round(progress)}% complete
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {steps.slice(0, safeTotal).map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < safeStep;
          const isCurrent = stepNumber === safeStep;

          return (
            <div className="flex items-center gap-3" key={step}>
              {isCompleted ? (
                <CheckCircle2 size={20} color="#10B981" />
              ) : (
                <Circle
                  size={20}
                  color={
                    isCurrent
                      ? tokens.primaryText
                      : style === "gradient"
                      ? "rgba(0, 0, 0, 0.3)"
                      : "rgba(255, 255, 255, 0.3)"
                  }
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                />
              )}
              <span
                style={{
                  color:
                    isCompleted || isCurrent ? tokens.primaryText : tokens.mutedText,
                  fontFamily: "Inter, sans-serif",
                  fontSize: "14px",
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

