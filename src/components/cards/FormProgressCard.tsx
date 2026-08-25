import { CheckCircle2, Circle } from "lucide-react";

type ProgressStyle = "glass" | "gradient" | "clean";

interface FormProgressCardProps {
  style?: ProgressStyle;
  currentStep?: number;
  totalSteps?: number;
  steps?: string[];
  // Optional backend-driven progress (0–100). When provided, this overrides
  // the step-based bar calculation so UI matches API progress exactly.
  overallProgress?: number;
  // Optional per-section completion coming from the backend. When provided,
  // tick/untick status is driven purely by isComplete instead of position.
  // filledFields/totalFields are also sent by the backend and let us show
  // "3/4" next to sections that are only partially complete — so the user
  // sees WHY a section is unticked.
  stepStatus?: Array<{
    name?: string;
    section?: string;
    isComplete?: boolean;
    filledFields?: number;
    totalFields?: number;
  }>;
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
      background: "hsl(var(--card))",
      backdropFilter: "blur(12px)",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 8px 24px hsl(var(--primary) / 0.08)",
    },
    primaryText: "hsl(var(--foreground))",
    mutedText: "hsl(var(--muted-foreground))",
    accent: "hsl(var(--primary))",
    barTrack: "hsl(var(--muted))",
  },
  gradient: {
    container: {
      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 8px 24px hsl(var(--primary) / 0.15)",
    },
    primaryText: "hsl(var(--primary-foreground))",
    mutedText: "hsl(var(--muted-foreground))",
    accent: "hsl(var(--foreground))",
    barTrack: "hsl(var(--muted))",
  },
  clean: {
    container: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 2px 18px hsl(var(--primary) / 0.12)",
    },
    primaryText: "hsl(var(--foreground))",
    mutedText: "hsl(var(--muted-foreground))",
    accent: "hsl(var(--primary))",
    barTrack: "hsl(var(--muted))",
  },
};

export function FormProgressCard({
  style = "clean",
  currentStep = 1,
  totalSteps = 6,
  steps = [
    "Present Complaint",
    "Previous Consultations",
    "Pain Assessment",
    "History & Diagnostics",
    "Treatment Goals",
    "Referral",
  ],
  overallProgress,
  stepStatus,
}: FormProgressCardProps) {
  const tokens = styleTokens[style];
  const safeTotal = Math.max(1, totalSteps);
  const safeStep = Math.min(Math.max(currentStep, 1), safeTotal);
  const progress =
    typeof overallProgress === "number"
      ? Math.min(Math.max(overallProgress, 0), 100)
      : (safeStep / safeTotal) * 100;

  const normalizedStepStatus =
    stepStatus?.map((s) => ({
      key: (s.name || s.section || "").toLowerCase(),
      isComplete: !!s.isComplete,
      filledFields:
        typeof s.filledFields === "number" ? s.filledFields : undefined,
      totalFields:
        typeof s.totalFields === "number" ? s.totalFields : undefined,
    })) ?? [];

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
                  ? "hsl(var(--foreground) / 0.6)"
                  : "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
              boxShadow: style === "gradient" ? "none" : "0 0 8px hsl(var(--primary) / 0.25)",
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
          const currentStepFloor = Math.floor(safeStep);
          // If backend stepStatus is provided, drive ticks purely from it.
          const statusFromBackend = normalizedStepStatus.find(
            (s) => s.key && s.key === step.toLowerCase()
          );

          let isCompleted: boolean;
          let isCurrent: boolean;

          if (statusFromBackend) {
            isCompleted = statusFromBackend.isComplete;
            // Treat non-completed backend steps as "current" for styling.
            isCurrent = !statusFromBackend.isComplete;
          } else if (normalizedStepStatus.length > 0) {
            // When we have backend data but this particular label wasn't found,
            // default to "not completed".
            isCompleted = false;
            isCurrent = false;
          } else {
            // Legacy behaviour: derive from currentStep position.
            // Mark as completed only if we're clearly past this step.
            isCompleted = currentStepFloor > stepNumber;
            isCurrent = currentStepFloor === stepNumber;
          }

          return (
            <div className="flex items-center gap-3" key={step}>
              {isCompleted ? (
                <CheckCircle2 size={20} color="hsl(var(--primary))" />
              ) : (
                <Circle
                  size={20}
                  color={
                    isCurrent
                      ? tokens.primaryText
                      : style === "gradient"
                      ? "hsl(var(--foreground) / 0.3)"
                      : "hsl(var(--muted-foreground))"
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
              {!isCompleted &&
                statusFromBackend &&
                typeof statusFromBackend.filledFields === "number" &&
                typeof statusFromBackend.totalFields === "number" &&
                statusFromBackend.totalFields > 0 && (
                  <span
                    style={{
                      color: tokens.mutedText,
                      fontFamily: "Inter, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      marginLeft: "auto",
                    }}
                    title={`${statusFromBackend.filledFields} of ${statusFromBackend.totalFields} fields filled`}
                  >
                    {statusFromBackend.filledFields}/
                    {statusFromBackend.totalFields}
                  </span>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

