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

  // Use the 1-indexed step position (matches FormProgressCard's "1/6" display).
  const positionCount = Math.min(total, Math.max(1, currentStep));
  const labelToShow = activeLabel || steps[activeIdx] || "";

  return (
    <div className={cn("w-full", className)}>
      {/* Caption row */}
      <div className="flex items-end justify-between gap-4 mb-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
            Interview
          </span>
          <span className="text-[15px] md:text-[16px] font-medium text-foreground truncate">
            {labelToShow}
          </span>
        </div>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[16px] md:text-[18px] font-semibold text-foreground leading-none">
            {Math.round(overallProgress)}
            <span className="text-muted-foreground text-[13px] font-normal">%</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium ml-1">
            {positionCount}/{total} sections
          </span>
        </div>
      </div>

      {/* Segmented track */}
      <div
        className={cn(
          "relative h-3 rounded-full p-[2px]",
          "bg-muted border border-border/60"
        )}
        role="progressbar"
        aria-valuenow={Math.round(overallProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Interview progress: ${labelToShow}`}
      >
        <div
          className="grid h-full w-full gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {states.map((s, i) => (
            <Segment
              key={i}
              state={s}
              isFirst={i === 0}
              isLast={i === total - 1}
              label={steps[i]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Segment({
  state,
  isFirst,
  isLast,
  label,
}: {
  state: "complete" | "active" | "pending";
  isFirst: boolean;
  isLast: boolean;
  label: string;
}) {
  return (
    <div
      title={label}
      className={cn(
        "relative h-full overflow-hidden transition-colors duration-500",
        isFirst && "rounded-l-full",
        isLast && "rounded-r-full",
        state === "complete" &&
          "bg-accent shadow-[0_0_8px_-2px_hsl(var(--accent)/0.6)]",
        state === "active" && "bg-accent/30",
        state === "pending" && "bg-muted-foreground/10"
      )}
    >
      {state === "active" && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 left-0 w-[55%] bg-accent",
              isFirst && "rounded-l-full"
            )}
            style={{
              boxShadow: "0 0 10px -2px hsl(var(--accent) / 0.7)",
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-pulse"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, hsl(var(--accent) / 0.35) 60%, transparent 100%)",
              mixBlendMode: "multiply",
            }}
          />
        </>
      )}
    </div>
  );
}
