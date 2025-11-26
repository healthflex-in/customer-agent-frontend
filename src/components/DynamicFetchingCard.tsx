import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DynamicFetchingCardProps {
  variant?: "gradient" | "clean" | "glassy";
  mode?: "indeterminate" | "determinate";
  progress?: number;
  title?: string;
  subtitle?: string;
  className?: string;
}

const DynamicFetchingCard = ({
  variant = "glassy",
  mode = "indeterminate",
  progress = 0,
  title = "Analyzing your response",
  subtitle = "Please wait while I process...",
  className,
}: DynamicFetchingCardProps) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    if (mode === "determinate") {
      setAnimatedProgress(progress);
    }
  }, [progress, mode]);

  const variantStyles = {
    gradient: "bg-gradient-to-br from-primary/20 via-background/50 to-primary/10 border-primary/30",
    clean: "bg-background/80 border-border",
    glassy: "bg-background/40 backdrop-blur-xl border-primary/20",
  };

  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="relative max-w-[85%]">
        {/* Chat bubble tail */}
        <div className="absolute -left-2 bottom-3 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[12px] border-r-primary/20" />
        
        <div
          className={cn(
            "relative rounded-2xl border p-4 shadow-lg animate-pulse",
            variantStyles[variant],
            className
          )}
        >
          {/* Content */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
            
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-muted/30 rounded-full overflow-hidden">
            {mode === "indeterminate" ? (
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent animate-slide-progress" />
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${animatedProgress}%` }}
                />
                <span className="text-xs text-muted-foreground min-w-[3ch] text-right">
                  {Math.round(animatedProgress)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicFetchingCard;
