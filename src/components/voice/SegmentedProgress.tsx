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

  const states = steps.map((step, i) => {
    const key = step.toLowerCase();
    const explicit = completionByName[key];

    if (typeof explicit === "boolean") {
      if (explicit) return "complete" as const;
      return i === activeIdx ? ("active" as const) : ("pending" as const);
    }
    // Fallback: position-based
    if (i < activeIdx) return "complete" as const;
    if (i === activeIdx) return "active" as const;
    return "pending" as const;
  });

  const labelToShow = activeLabel || steps[activeIdx] || "";
  const completedSteps = states.filter(s => s === "complete").length;
  const displayProgress = Math.round((completedSteps / total) * 100);

  return (
    <div className={cn("w-full", className)}>
      {/* Caption row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stance-stone font-bold mb-0.5 opacity-80">
            Current Phase
          </span>
          <h2 className="font-display text-xl md:text-2xl text-white tracking-tight">
            {labelToShow}
          </h2>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stance-stone font-bold mb-0.5 opacity-70">
            Progress
          </span>
          <span className="font-display text-lg md:text-xl text-stance-neon">
            {completedSteps > 0 ? `${displayProgress}%` : `${completedSteps + 1} / ${total}`}
          </span>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-2 w-full flex gap-0.5">
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
