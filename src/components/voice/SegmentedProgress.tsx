import { cn } from "@/lib/utils";

interface StepStatus {
  name?: string;
  section?: string;
  isComplete?: boolean;
}

interface SegmentedProgressProps {
  steps: string[];
  currentStep: number;
  stepStatus?: StepStatus[];
  overallProgress: number;
  activeLabel?: string;
  className?: string;
}

export default function SegmentedProgress({
  steps,
  currentStep,
  stepStatus,
  overallProgress,
  activeLabel,
  className,
}: SegmentedProgressProps) {
  const total = steps.length;
  const activeIdx = Math.max(0, Math.min(total - 1, currentStep - 1));

  // Build a name→isComplete map from stepStatus so we match by name,
  // not by array index (backend may reorder completed sections first).
  const completionByName: Record<string, boolean> = {};
  if (stepStatus) {
    for (const s of stepStatus) {
      const key = (s.name || s.section || "").toLowerCase();
      if (key && typeof s.isComplete === "boolean") {
        completionByName[key] = s.isComplete;
      }
    }
  }

  // When overall progress is 100%, show everything complete immediately.
  const isFullyComplete = overallProgress >= 100;

  // Count completed sections for continuous green run from left.
  const completedCount = isFullyComplete
    ? total
    : (Object.values(completionByName).filter(Boolean).length
        || Math.max(0, activeIdx));

  const states = steps.map((_step, i) => {
    if (i < completedCount) return "complete" as const;
    if (!isFullyComplete && i === completedCount) return "active" as const;
    return isFullyComplete ? ("complete" as const) : ("pending" as const);
  });

  const labelToShow = activeLabel || steps[activeIdx] || "";
  const completedSteps = states.filter(s => s === "complete").length;
  const displayProgress = isFullyComplete ? 100 : Math.round((completedSteps / total) * 100);

  return (
    <div className={cn("w-full", className)}>
      {/* Compact bar only — phase label and % are shown in the main header */}
      <div className="relative h-1.5 w-full flex gap-0.5">
        {states.map((state, i) => (
          <div
            key={i}
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out flex-1 relative overflow-hidden",
              state === "complete" && "bg-stance-neon",
              state === "active" && "bg-stance-neon/40",
              state === "pending" && "bg-white/10"
            )}
          >
            {/* Pulsing leading-edge glow on active segment only */}
            {state === "active" && (
              <span className="absolute inset-0 rounded-full bg-stance-neon/60 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
