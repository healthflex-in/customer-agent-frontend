import { FileText, Clock } from "lucide-react";

interface Form {
  formId: string;
  title: string;
  timestamp?: string;
  createdAt: string;
  updatedAt: string;
  current_section: string;
  progress: number;
}

interface FormSelectionCardProps {
  forms: Form[];
  onSelectForm: (formId: string) => void;
  style?: "glass" | "gradient" | "clean";
}

const styleTokens = {
  glass: {
    background: "rgba(30, 30, 32, 0.7)",
    backdropFilter: "blur(12px)",
    border: "1px solid #2D2D33",
    shadow: "none",
    textColor: "#FFFFFF",
    textMuted: "rgba(255, 255, 255, 0.7)",
    iconColor: "#FCD34D",
  },
  gradient: {
    background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
    backdropFilter: "none",
    border: "none",
    shadow: "0 8px 32px rgba(252, 211, 77, 0.3)",
    textColor: "#000000",
    textMuted: "rgba(0, 0, 0, 0.7)",
    iconColor: "#000000",
  },
  clean: {
    background: "#1F1F1F",
    backdropFilter: "none",
    border: "1px solid #3F3F3F",
    shadow: "0 2px 24px rgba(252, 211, 77, 0.1)",
    textColor: "#FFFFFF",
    textMuted: "rgba(255, 255, 255, 0.7)",
    iconColor: "#FCD34D",
  },
};

export function FormSelectionCard({
  forms,
  onSelectForm,
  style = "clean",
}: FormSelectionCardProps) {
  const tokens = styleTokens[style];

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="w-full max-w-[600px] space-y-4">
      <div
        className="rounded-[24px] p-6"
        style={{
          background: tokens.background,
          backdropFilter: tokens.backdropFilter,
          border: tokens.border,
          boxShadow: tokens.shadow,
        }}
      >
        <h3
          style={{
            color: tokens.textColor,
            fontFamily: "Inter, sans-serif",
            fontSize: "18px",
            fontWeight: 600,
            lineHeight: "1.4",
            marginBottom: "16px",
          }}
        >
          Select a Form to Continue
        </h3>
        <p
          style={{
            color: tokens.textMuted,
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
            lineHeight: "1.5",
            marginBottom: "20px",
          }}
        >
          Choose from your existing forms or start a new one
        </p>

        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
          {forms.map((form, index) => (
            <button
              key={form.formId}
              onClick={() => onSelectForm(form.formId)}
              className="relative w-full text-left rounded-xl p-4 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] animate-in fade-in slide-in-from-bottom-2"
              style={{
                animationDelay: `${index * 50}ms`,
                backgroundColor:
                  style === "gradient"
                    ? "rgba(0, 0, 0, 0.08)"
                    : "rgba(255, 255, 255, 0.08)",
                border: "1px solid",
                borderColor:
                  style === "gradient"
                    ? "rgba(0, 0, 0, 0.2)"
                    : "rgba(255, 255, 255, 0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = style === "gradient"
                  ? "rgba(0, 0, 0, 0.12)"
                  : "rgba(255, 255, 255, 0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = style === "gradient"
                  ? "rgba(0, 0, 0, 0.08)"
                  : "rgba(255, 255, 255, 0.08)";
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor:
                      style === "gradient"
                        ? "rgba(0, 0, 0, 0.15)"
                        : "rgba(252, 211, 77, 0.2)",
                  }}
                >
                  <FileText
                    size={20}
                    style={{
                      color: tokens.iconColor,
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    style={{
                      color: tokens.textColor,
                      fontFamily: "Inter, sans-serif",
                      fontSize: "15px",
                      fontWeight: 600,
                      lineHeight: "1.4",
                      marginBottom: "4px",
                    }}
                  >
                    {form.title}
                  </h4>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Clock
                        size={12}
                        style={{
                          color: tokens.textMuted,
                        }}
                      />
                      <span
                        style={{
                          color: tokens.textMuted,
                          fontFamily: "Inter, sans-serif",
                          fontSize: "12px",
                        }}
                      >
                        {formatDate(form.updatedAt || form.createdAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        color: tokens.textMuted,
                        fontFamily: "Inter, sans-serif",
                        fontSize: "12px",
                      }}
                    >
                      {Math.round(form.progress || 0)}% complete
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

