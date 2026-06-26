import { useState } from "react";
import { Mic, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeOverlayProps {
  formName?: string;
  formDetails?: string;
  onProceed: () => void;
}

export default function WelcomeOverlay({
  formName = "Welcome to Stance",
  formDetails = "Please fill this form to help us understand more about your current condition and concerns.",
  onProceed,
}: WelcomeOverlayProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleProceed = () => {
    setAcknowledged(true);
    setTimeout(onProceed, 300);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-stance-mint/95 backdrop-blur-md transition-opacity duration-300",
        acknowledged ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="w-full max-w-md mx-auto px-6 flex flex-col items-center text-center gap-6">

        {/* Logo / brand mark */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-stance-neon/10 border border-stance-neon/20 flex items-center justify-center">
            <Mic size={22} className="text-stance-neon" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-white/40 font-semibold">Stance Health</span>
        </div>

        {/* Form name + details */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-display font-semibold text-white tracking-tight">
            {formName}
          </h1>
          <p className="text-[14px] text-white/55 leading-relaxed max-w-sm">
            {formDetails}
          </p>
        </div>

        {/* Voice-first callout */}
        <div className="w-full rounded-2xl border border-stance-neon/20 bg-stance-neon/5 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-stance-neon/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mic size={15} className="text-stance-neon" />
            </div>
            <div className="flex flex-col gap-0.5 text-left">
              <span className="text-[13px] font-semibold text-white">Voice-first experience</span>
              <span className="text-[12px] text-white/50 leading-snug">
                Just speak into the mic and we'll fill the form for you — no typing needed.
              </span>
            </div>
          </div>

          {/* Time comparison */}
          <div className="flex gap-3 pt-1">
            <div className="flex-1 rounded-xl bg-stance-neon/10 border border-stance-neon/15 px-3 py-2.5 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-stance-neon" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-stance-neon">By voice</span>
              </div>
              <span className="text-[16px] font-display font-bold text-white">~3 min</span>
            </div>
            <div className="flex-1 rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-white/30" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">By typing</span>
              </div>
              <span className="text-[16px] font-display font-bold text-white/40">6–10 min</span>
            </div>
          </div>
        </div>

        {/* Tip */}
        <p className="text-[12px] text-white/35 leading-relaxed max-w-xs italic">
          Tip: Speak naturally into the mic and answer each question — you'll move through it much faster than typing.
        </p>

        {/* CTA */}
        <button
          onClick={handleProceed}
          className="w-full flex items-center justify-center gap-2 bg-stance-neon text-stance-mint font-semibold text-[14px] rounded-2xl py-4 px-6 hover:bg-stance-neon/90 active:scale-[0.98] transition-all duration-150 shadow-[0_4px_24px_rgba(221,254,113,0.25)]"
        >
          Got it, let's start
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>

      </div>
    </div>
  );
}
