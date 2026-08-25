import { Brain, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThoughtStage {
  stage: string;
  detail: string;
  status: "done" | "active" | "pending";
}

interface AgentThoughtStreamProps {
  thoughts: ThoughtStage[];
  className?: string;
}

export function AgentThoughtStream({ thoughts, className }: AgentThoughtStreamProps) {
  if (!thoughts || thoughts.length === 0) return null;

  const activeIndex = thoughts.findIndex((t) => t.status === "active");
  const activeStage = activeIndex >= 0 ? thoughts[activeIndex].stage : null;

  return (
    <div
      className={cn(
        "w-full max-w-[380px] rounded-[24px] p-5 relative overflow-hidden",
        "bg-[#0D1B2A] border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
        className
      )}
    >
      <div className="relative flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Brain size={20} color="#DDFE71" strokeWidth={2} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#DDFE71] animate-ping opacity-70" />
          </div>
          <span className="text-[13px] font-semibold text-white/80 tracking-wide">
            Agent is Thinking
          </span>
        </div>

        {/* Thought stages */}
        <div className="flex flex-col gap-2.5">
          {thoughts.map((thought, idx) => (
            <div key={idx} className="flex items-start gap-3">
              {/* Status icon */}
              <div className="flex-shrink-0 mt-0.5">
                {thought.status === "done" && (
                  <CheckCircle2 size={16} color="#DDFE71" strokeWidth={2.5} />
                )}
                {thought.status === "active" && (
                  <Loader2
                    size={16}
                    color="#DDFE71"
                    strokeWidth={2.5}
                    className="animate-spin"
                  />
                )}
                {thought.status === "pending" && (
                  <span className="block w-4 h-4 rounded-full border-2 border-white/20" />
                )}
              </div>

              {/* Text */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span
                  className={cn(
                    "text-[13px] font-medium leading-snug transition-colors duration-300",
                    thought.status === "done" && "text-white/60",
                    thought.status === "active" && "text-white",
                    thought.status === "pending" && "text-white/25"
                  )}
                >
                  {thought.stage}
                </span>
                {thought.status === "active" && thought.detail && (
                  <span className="text-[11px] text-white/40 leading-snug line-clamp-1">
                    {thought.detail}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Animated pulse bar at bottom */}
        {activeStage && (
          <div className="relative h-[3px] rounded-full bg-white/5 overflow-hidden">
            <div className="absolute inset-0 rounded-full bg-[#DDFE71] animate-slide-progress opacity-60" />
          </div>
        )}
      </div>
    </div>
  );
}
