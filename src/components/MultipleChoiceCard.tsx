import { useState } from "react";

interface MultipleChoiceCardProps {
  style?: "glass" | "gradient" | "clean";
  question?: string;
  options?: { label: string; value: string }[];
  onSelect?: (value: string) => void;
}

export function MultipleChoiceCard({ 
  style = "clean",
  question = "How would you rate your overall health?",
  options = [
    { label: "Excellent - I feel great most days", value: "A" },
    { label: "Good - Generally healthy with minor issues", value: "B" },
    { label: "Fair - Some ongoing health concerns", value: "C" },
    { label: "Poor - Significant health challenges", value: "D" }
  ],
  onSelect
}: MultipleChoiceCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const styles = {
    glass: {
      background: "hsl(var(--card))",
      backdropFilter: "blur(12px)",
      border: "1px solid hsl(var(--border))",
      shadow: "0 8px 24px hsl(var(--primary) / 0.08)",
    },
    gradient: {
      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
      backdropFilter: "none",
      border: "1px solid hsl(var(--border))",
      shadow: "0 8px 24px hsl(var(--primary) / 0.15)",
    },
    clean: {
      background: "hsl(var(--card))",
      backdropFilter: "none",
      border: "1px solid hsl(var(--border))",
      shadow: "0 2px 18px hsl(var(--primary) / 0.12)",
    }
  };

  const currentStyle = styles[style];

  const handleSelect = (value: string) => {
    setSelected(value);
    onSelect?.(value);
  };

  return (
    <div className="w-full max-w-[340px] animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div
        className="relative rounded-[24px] p-6 overflow-hidden"
        style={{
          background: currentStyle.background,
          backdropFilter: currentStyle.backdropFilter,
          border: currentStyle.border,
          boxShadow: currentStyle.shadow,
        }}
      >
        <div className="relative flex flex-col gap-5">
          {/* Question */}
          <div>
            <h3 
              style={{ 
                color: style === "gradient" ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                lineHeight: "1.4",
                marginBottom: "8px"
              }}
            >
              {question}
            </h3>
            <p 
              style={{ 
                color: style === "gradient" ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))",
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                lineHeight: "1.5"
              }}
            >
              Select one option
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2.5">
            {options.map((option, index) => {
              const isSelected = selected === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className="relative w-full text-left rounded-xl p-3.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] animate-in fade-in slide-in-from-left-4"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    backgroundColor: isSelected
                      ? (style === "gradient" ? "hsl(var(--foreground) / 0.10)" : "hsl(var(--primary) / 0.14)")
                      : (style === "gradient" ? "hsl(var(--foreground) / 0.05)" : "hsl(var(--muted))"),
                    border: isSelected
                      ? (style === "gradient" ? "1px solid hsl(var(--foreground) / 0.35)" : "1px solid hsl(var(--primary))")
                      : "1px solid hsl(var(--border))",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Option letter badge */}
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: isSelected
                          ? (style === "gradient" ? "hsl(var(--foreground))" : "hsl(var(--primary))")
                          : (style === "gradient" ? "hsl(var(--foreground) / 0.12)" : "hsl(var(--muted))"),
                        color: isSelected
                          ? (style === "gradient" ? "hsl(var(--primary))" : "hsl(var(--primary-foreground))")
                          : (style === "gradient" ? "hsl(var(--primary))" : "hsl(var(--foreground))"),
                        fontFamily: "Inter, sans-serif",
                        fontSize: "14px",
                        fontWeight: 700
                      }}
                    >
                      {String.fromCharCode(65 + index)}
                    </div>

                    {/* Option text */}
                    <span
                      style={{
                        color: "hsl(var(--foreground))",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "14px",
                        fontWeight: isSelected ? 600 : 400,
                        lineHeight: "1.4"
                      }}
                    >
                      {option.label}
                    </span>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div
                      className="absolute top-3 right-3 w-2 h-2 rounded-full animate-in zoom-in duration-200"
                      style={{
                        backgroundColor: style === "gradient" ? "hsl(var(--foreground))" : "hsl(var(--primary))"
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

