import { cn } from "@/lib/utils";

interface SegmentedProgressProps {
  /** Ordered section labels. One segment per step. */
  steps: string[];
  /** 1-based index of the active step. */
  currentStep: number;
  /** Per-step completion state (parallel to `steps`). Falls back to currentStep. */
  stepStatus?: Array<{ name?: string; section?: string; isComplete?: boolean }>;
  /** Overall % (0-100). Shown to the right. */
  overallProgress: number;
  /** Currently displayed section label (overrides step name if provided). */
  activeLabel?: string;
  className?: string;
}

/**
 * Segmented Progress
 *
 * One segment per interview section. Completed segments are filled with the
 * primary color; the active segment uses a softer fill with a pulsing leading
 * edge; pending segments sit dim against the track. Hairline gaps between
 * segments preserve a "track" feel.
 */
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

  const states = steps.map((_, i) => {
    const explicit = stepStatus?.[i]?.isComplete;
    if (typeof explicit === "boolean") {
      if (explicit) return "complete" as const;
      return i === activeIdx ? ("active" as const) : ("pending" as const);
    }
    if (i < activeIdx) return "complete" as const;
    if (i === activeIdx) return "active" as const;
    return "pending" as const;
  });

  const labelToShow = activeLabel || steps[activeIdx] || "";

  // Only completed sections count toward progress — active section is "in progress"
  // so the number stays consistent with the bar (only solid segments look "done").
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

      <div className="relative h-2 w-full bg-white/10 rounded-full overflow-hidden flex gap-0.5 p-px items-center">
        {states.map((state, i) => (
          <div
            key={i}
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out flex-1",
              state === "complete" && "bg-stance-neon",
              state === "active" && "bg-white/30 animate-pulse",
              state === "pending" && "bg-white/10"
            )}
          />
        ))}
      </div>
    </div>
  );
}

