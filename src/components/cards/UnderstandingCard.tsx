import { Brain, Sparkles } from "lucide-react";

type UnderstandingStyle = "glass" | "gradient" | "clean";

interface UnderstandingCardProps {
  style?: UnderstandingStyle;
  headline?: string;
  caption?: string;
}

const styleTokens: Record<
  UnderstandingStyle,
  {
    container: React.CSSProperties;
    primaryText: string;
    secondaryText: string;
    dotColor: string;
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
    secondaryText: "hsl(var(--muted-foreground))",
    dotColor: "hsl(var(--primary))",
  },
  gradient: {
    container: {
      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 8px 24px hsl(var(--primary) / 0.15)",
    },
    primaryText: "hsl(var(--primary-foreground))",
    secondaryText: "hsl(var(--muted-foreground))",
    dotColor: "hsl(var(--foreground))",
  },
  clean: {
    container: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 2px 18px hsl(var(--primary) / 0.12)",
    },
    primaryText: "hsl(var(--foreground))",
    secondaryText: "hsl(var(--muted-foreground))",
    dotColor: "hsl(var(--primary))",
  },
};

export function UnderstandingCard({
  style = "clean",
  headline = "Understanding your text...",
  caption = "Analyzing context and intent",
}: UnderstandingCardProps) {
  const tokens = styleTokens[style];

  return (
    <div
      className="w-full max-w-[340px] rounded-[24px] p-6 relative overflow-hidden"
      style={tokens.container}
    >
      {/* Decorative sparkles */}
      {style === "gradient" && (
        <>
          <span className="absolute top-4 right-8 w-2 h-2 rounded-full bg-white/40 animate-bounce" />
          <span className="absolute bottom-8 right-12 w-1.5 h-1.5 rounded-full bg-white/40 animate-[bounce_2s_infinite]" />
        </>
      )}

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="animate-pulse">
              <Brain size={24} color={tokens.primaryText} strokeWidth={2.5} />
            </div>
            <Sparkles
              size={12}
              color={tokens.primaryText}
              className="absolute -top-1 -right-1 animate-pulse"
            />
          </div>

          <div className="flex flex-col gap-1 flex-1">
            <h3
              style={{
                color: tokens.primaryText,
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                lineHeight: "1.4",
              }}
            >
              {headline}
            </h3>
            <p
              style={{
                color: tokens.secondaryText,
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              {caption}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 150}ms`,
                backgroundColor: tokens.dotColor,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

