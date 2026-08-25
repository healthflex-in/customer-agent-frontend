import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { KeyboardEvent } from "react";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Save, Trash2, Send, Square, Paperclip, ShieldCheck } from "lucide-react";
import { getApiUrl, getWsUrl } from "@/config/api";
import WaveformAnimation from "./WaveformAnimation";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import useWebSocket from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { UnderstandingCard } from "@/components/cards/UnderstandingCard";
import { AgentThoughtStream } from "@/components/cards/AgentThoughtStream";
import type { ThoughtStage } from "@/components/cards/AgentThoughtStream";
import SegmentedProgress from "@/components/voice/SegmentedProgress";

interface QuestionMeta {
  type:
    | "single_choice" | "multiple_choice" | "checkbox"
    | "scale" | "linear_scale" | "slider"
    | "rating"
    | "text" | "short_answer" | "paragraph"
    | "number"
    | "boolean" | "yes_no"
    | "dropdown"
    | "date" | "time"
    | "likert"
    | "choice_grid" | "checkbox_grid"
    | "file_upload"
    | "multi_answer";
  options?: string[] | null;
  question_id?: string | null;
  question_ids?: string[] | null;
  questions?: string[] | null;
  question_options?: (string[] | null)[] | null;
  question_types?: string[] | null;
  question_scales?: (string[] | null)[] | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  questionMeta?: QuestionMeta;
}

interface Attachment {
  id: string;
  label: string;
  fileName: string;
  url: string;
  uploadedAt: string;
}

interface InterviewState {
  section: string;
  current_section?: string;
  progress: number;
  missing_fields: string[];
  attachments?: Attachment[];
  formId?: string;
  promSteps?: string[] | null;   // PROM scale names — replaces hardcoded FRM-01 steps
  sectionProgress?: {
    progress?: number;
    steps?: Array<{
      name?: string;
      section?: string;
      isComplete?: boolean;
    }>;
  };
}

interface TranscriptionInterfaceProps {
  userId?: string;
  userName?: string;
  initialFormId?: string | null; // null = new form, string = existing form ID
}

// Compact typing-indicator style cards
const _VOICE_HINTS = ["Understanding...", "Transcribing...", "Processing...", "Analysing...", "Thinking..."];

function _VoiceProcessingCard() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % _VOICE_HINTS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="inline-flex items-center gap-2.5 bg-white border border-stance-steel/8 rounded-2xl px-4 py-2.5 shadow-sm">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-stance-steel/30 animate-bounce"
            style={{ animationDelay: `${i*150}ms`, animationDuration: '0.9s' }} />
        ))}
      </div>
      <span className="text-[12px] text-stance-steel/50 font-medium">{_VOICE_HINTS[idx]}</span>
    </div>
  );
}

// ChatGPT-style compact thought stream
function _CompactThoughtStream({ thoughts }: { thoughts: { stage: string; detail?: string; status: string }[] }) {
  const active = thoughts.find(t => t.status === "active");
  const doneCount = thoughts.filter(t => t.status === "done").length;
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-stance-steel/8 rounded-2xl px-4 py-2.5 shadow-sm max-w-xs">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-stance-neon/70 animate-bounce"
            style={{ animationDelay: `${i*150}ms`, animationDuration: '0.9s' }} />
        ))}
      </div>
      <span className="text-[12px] text-stance-steel/60 font-medium truncate">
        {active ? active.stage : doneCount > 0 ? "Almost ready..." : "Thinking..."}
      </span>
      {doneCount > 0 && (
        <span className="text-[10px] text-stance-steel/30 flex-shrink-0">{doneCount}/{thoughts.length}</span>
      )}
    </div>
  );
}

// Compact processing indicator (while LLM responds)
function _ThinkingDots() {
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-stance-steel/8 rounded-2xl px-4 py-2.5 shadow-sm">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-stance-steel/25 animate-bounce"
            style={{ animationDelay: `${i*150}ms`, animationDuration: '0.9s' }} />
        ))}
      </div>
      <span className="text-[12px] text-stance-steel/40 font-medium">Sage is thinking</span>
    </div>
  );
}

// ── Shared button style ────────────────────────────────────────────────────
const _BTN_BASE = "px-5 py-2.5 rounded-xl bg-stance-neon text-stance-steel font-bold text-sm hover:bg-stance-neon/90 transition-all active:scale-[0.98] self-start mt-2";
const _INPUT_BASE = "w-full bg-white/10 border border-white/20 rounded-xl text-white text-sm px-4 py-3 placeholder:text-white/30 focus:outline-none focus:border-stance-neon";

function _ShortAnswerInput({ onAnswer }: { onAnswer: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && val.trim() && onAnswer(val.trim())}
        placeholder="Type your answer…"
        className={_INPUT_BASE}
        autoFocus
      />
      {val.trim() && <button onClick={() => onAnswer(val.trim())} className={_BTN_BASE}>Submit</button>}
    </div>
  );
}

function _ParagraphInput({ onAnswer }: { onAnswer: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Type your answer…"
        rows={3}
        className={`${_INPUT_BASE} resize-none`}
        autoFocus
      />
      {val.trim() && <button onClick={() => onAnswer(val.trim())} className={_BTN_BASE}>Submit</button>}
    </div>
  );
}

function _DropdownSelect({ options, onAnswer }: { options: string[]; onAnswer: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <select
        value={val}
        onChange={e => setVal(e.target.value)}
        className="w-full bg-stance-steel border border-white/20 rounded-xl text-white text-sm px-4 py-3 focus:outline-none focus:border-stance-neon appearance-none"
      >
        <option value="" disabled>Select an option…</option>
        {options.map((o, i) => <option key={i} value={o}>{o}</option>)}
      </select>
      {val && <button onClick={() => onAnswer(val)} className={_BTN_BASE}>Submit</button>}
    </div>
  );
}

function _DateInput({ onAnswer }: { onAnswer: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <input
        type="date"
        value={val}
        onChange={e => setVal(e.target.value)}
        className={`${_INPUT_BASE} [color-scheme:dark]`}
      />
      {val && <button onClick={() => onAnswer(val)} className={_BTN_BASE}>Submit</button>}
    </div>
  );
}

function _TimeInput({ onAnswer }: { onAnswer: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <input
        type="time"
        value={val}
        onChange={e => setVal(e.target.value)}
        className={`${_INPUT_BASE} [color-scheme:dark]`}
      />
      {val && <button onClick={() => onAnswer(val)} className={_BTN_BASE}>Submit</button>}
    </div>
  );
}

function _LikertScale({ onAnswer, options }: { onAnswer: (v: string) => void; options?: string[] | null }) {
  const labels = options?.length === 5
    ? options
    : ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-1">
        {labels.map((lbl, i) => (
          <button
            key={i}
            onClick={() => onAnswer(lbl)}
            className="flex flex-col items-center gap-1 px-1 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-stance-neon/20 hover:border-stance-neon text-white text-center transition-all active:scale-95"
          >
            <span className="text-lg font-bold">{i + 1}</span>
            <span className="text-[9px] leading-tight opacity-60">{lbl}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// options format: ["Row 1", "Row 2", "|", "Col A", "Col B"]  ("|" separates rows from cols)
// If no "|" found, falls back to single-choice layout
function _ChoiceGrid({ options, onAnswer }: { options: string[]; onAnswer: (v: string) => void }) {
  const pivotIdx = options.indexOf("|");
  if (pivotIdx < 0) {
    // No grid structure — render as horizontal single-choice
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button key={i} onClick={() => onAnswer(o)}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-stance-neon/20 hover:border-stance-neon text-white text-sm font-medium transition-all active:scale-95"
          >{o}</button>
        ))}
      </div>
    );
  }
  const rows = options.slice(0, pivotIdx);
  const cols = options.slice(pivotIdx + 1);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const set = (row: string, col: string) => setSelections(prev => ({ ...prev, [row]: col }));
  const allDone = rows.every(r => selections[r]);
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left pb-2 text-white/40 font-normal text-xs"></th>
              {cols.map((c, i) => <th key={i} className="pb-2 text-center text-white/60 font-medium text-xs px-2">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white/5" : ""}>
                <td className="py-2 pr-3 text-white/80 text-xs">{row}</td>
                {cols.map((col, ci) => (
                  <td key={ci} className="py-2 text-center">
                    <button
                      onClick={() => set(row, col)}
                      className={cn("w-5 h-5 rounded-full border-2 transition-all mx-auto block",
                        selections[row] === col ? "bg-stance-neon border-stance-neon" : "border-white/30 hover:border-stance-neon/60")}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allDone && (
        <button onClick={() => onAnswer(rows.map(r => `${r}: ${selections[r]}`).join(", "))} className={_BTN_BASE}>
          Submit
        </button>
      )}
    </div>
  );
}

function _CheckboxGrid({ options, onAnswer }: { options: string[]; onAnswer: (v: string) => void }) {
  const pivotIdx = options.indexOf("|");
  const rows = pivotIdx >= 0 ? options.slice(0, pivotIdx) : ["Response"];
  const cols = pivotIdx >= 0 ? options.slice(pivotIdx + 1) : options;
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const toggle = (row: string, col: string) =>
    setSelections(prev => {
      const cur = prev[row] || [];
      return { ...prev, [row]: cur.includes(col) ? cur.filter(c => c !== col) : [...cur, col] };
    });
  const hasAny = Object.values(selections).some(v => v.length > 0);
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left pb-2 text-white/40 font-normal text-xs"></th>
              {cols.map((c, i) => <th key={i} className="pb-2 text-center text-white/60 font-medium text-xs px-2">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white/5" : ""}>
                <td className="py-2 pr-3 text-white/80 text-xs">{row}</td>
                {cols.map((col, ci) => (
                  <td key={ci} className="py-2 text-center">
                    <button
                      onClick={() => toggle(row, col)}
                      className={cn("w-5 h-5 rounded border-2 transition-all mx-auto block",
                        (selections[row] || []).includes(col) ? "bg-stance-neon border-stance-neon" : "border-white/30 hover:border-stance-neon/60")}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasAny && (
        <button onClick={() => onAnswer(
          rows.filter(r => (selections[r] || []).length > 0).map(r => `${r}: ${(selections[r] || []).join(", ")}`).join("; ")
        )} className={_BTN_BASE}>Submit</button>
      )}
    </div>
  );
}

function _FileUploadInput({ onAnswer }: { onAnswer: (v: string) => void }) {
  const [fileName, setFileName] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 border-dashed cursor-pointer transition-all">
        <svg className="w-5 h-5 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span className="text-white/60 text-sm">{fileName || "Tap to upload file"}</span>
        <input type="file" className="hidden" onChange={e => {
          const f = e.target.files?.[0];
          if (f) { setFileName(f.name); onAnswer(f.name); }
        }} />
      </label>
    </div>
  );
}

function _CheckboxQuestion({ options, onAnswer }: { options: string[]; onAnswer: (answer: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (opt: string) => setSelected(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
  return (
    <div className="mt-4 flex flex-col gap-2">
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => toggle(opt)}
          className={cn(
            "text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all",
            selected.includes(opt)
              ? "bg-stance-neon/25 border-stance-neon text-white"
              : "bg-white/10 border-white/20 text-white hover:bg-white/15"
          )}
        >
          <span className={cn("inline-block w-4 h-4 rounded border mr-2 align-middle transition-colors",
            selected.includes(opt) ? "bg-stance-neon border-stance-neon" : "border-white/40")} />
          {opt}
        </button>
      ))}
      {selected.length > 0 && (
        <button
          onClick={() => onAnswer(selected.join(", "))}
          className="mt-1 px-5 py-2.5 rounded-xl bg-stance-neon text-stance-steel font-bold text-sm hover:bg-stance-neon/90 transition-all active:scale-[0.98]"
        >
          Confirm ({selected.length} selected)
        </button>
      )}
    </div>
  );
}

function _NumberStepper({ onAnswer, min = 0, max = 100 }: { onAnswer: (v: string) => void; min?: number; max?: number }) {
  const [value, setValue] = useState<number>(min);
  const dec = () => setValue(v => Math.max(min, v - 1));
  const inc = () => setValue(v => Math.min(max, v + 1));
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button onClick={dec} className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 text-white text-xl font-bold transition-all active:scale-95">−</button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) setValue(Math.min(max, Math.max(min, n)));
          }}
          className="w-20 text-center bg-white/10 border border-white/20 rounded-xl text-white text-xl font-bold py-2 focus:outline-none focus:border-stance-neon"
        />
        <button onClick={inc} className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 text-white text-xl font-bold transition-all active:scale-95">+</button>
      </div>
      <button
        onClick={() => onAnswer(String(value))}
        className="px-5 py-2.5 rounded-xl bg-stance-neon text-stance-steel font-bold text-sm hover:bg-stance-neon/90 transition-all active:scale-[0.98] self-start"
      >
        Confirm
      </button>
    </div>
  );
}

function _RatingStars({ onAnswer }: { onAnswer: (v: string) => void }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(star)}
            className="text-3xl transition-transform hover:scale-110 active:scale-95"
          >
            <span className={(hovered || selected) >= star ? "text-stance-neon" : "text-white/20"}>★</span>
          </button>
        ))}
      </div>
      {selected > 0 && (
        <button
          onClick={() => onAnswer(String(selected))}
          className="px-5 py-2.5 rounded-xl bg-stance-neon text-stance-steel font-bold text-sm hover:bg-stance-neon/90 transition-all active:scale-[0.98] self-start"
        >
          Confirm ({selected}/5)
        </button>
      )}
    </div>
  );
}

function _SliderInput({ onAnswer, min = 0, max = 10, options }: { onAnswer: (v: string) => void; min?: number; max?: number; options?: string[] | null }) {
  const [value, setValue] = useState(Math.round((min + max) / 2));
  const minLabel = options?.[0] ?? String(min);
  const maxLabel = options?.[1] ?? String(max);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-white/50 min-w-[60px]">{minLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => setValue(parseInt(e.target.value, 10))}
          className="flex-1 accent-stance-neon"
        />
        <span className="text-[11px] text-white/50 min-w-[60px] text-right">{maxLabel}</span>
      </div>
      <div className="text-center text-2xl font-bold text-stance-neon">{value}</div>
      <button
        onClick={() => onAnswer(String(value))}
        className="px-5 py-2.5 rounded-xl bg-stance-neon text-stance-steel font-bold text-sm hover:bg-stance-neon/90 transition-all active:scale-[0.98] self-start"
      >
        Confirm
      </button>
    </div>
  );
}

function _MultiAnswerInput({
  questions,
  questionOptions,
  questionTypes,
  questionScales,
  onAnswer,
}: {
  questions: string[];
  questionOptions?: (string[] | null)[] | null;
  questionTypes?: string[] | null;
  questionScales?: string[] | null;
  onAnswer: (v: string) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(new Array(questions.length).fill(""));
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = answers.filter(a => a.trim() !== "").length;
  const allAnswered = answeredCount === questions.length;
  const progressPct = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const setAnswer = (i: number, val: string) => {
    if (submitted) return;
    setAnswers(prev => { const n = [...prev]; n[i] = val; return n; });
  };

  // Build section groups: [{sectionName, indices[]}]
  const sections: { name: string; indices: number[] }[] = [];
  questions.forEach((_, i) => {
    const scale = questionScales?.[i] || "";
    const last = sections[sections.length - 1];
    if (last && last.name === scale) {
      last.indices.push(i);
    } else {
      sections.push({ name: scale, indices: [i] });
    }
  });

  const renderControl = (i: number) => {
    const qType = questionTypes?.[i] ?? "text";
    const opts = questionOptions?.[i];

    if (qType === "scale" || qType === "linear_scale") {
      return (
        <div className="flex gap-1 flex-wrap mt-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} onClick={() => setAnswer(i, String(n))}
              className={cn("w-8 h-8 rounded-lg text-xs font-bold transition-all border",
                answers[i] === String(n)
                  ? "bg-stance-neon text-stance-steel border-stance-neon"
                  : n <= 3 ? "bg-green-500/20 border-green-400/40 hover:bg-green-500/40 text-white"
                  : n <= 6 ? "bg-yellow-500/20 border-yellow-400/40 hover:bg-yellow-500/40 text-white"
                  : "bg-red-500/20 border-red-400/40 hover:bg-red-500/40 text-white"
              )}>
              {n}
            </button>
          ))}
        </div>
      );
    }

    if (qType === "boolean" || qType === "yes_no") {
      const bOpts = opts?.length ? opts : ["Yes", "No"];
      return (
        <div className="flex gap-2 mt-1">
          {bOpts.map(opt => (
            <button key={opt} onClick={() => setAnswer(i, opt)}
              className={cn("flex-1 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border",
                answers[i] === opt
                  ? "bg-stance-neon text-stance-steel border-stance-neon"
                  : "bg-white/10 text-white border-white/20 hover:border-stance-neon/60"
              )}>
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if ((qType === "single_choice" || qType === "dropdown") && opts?.length) {
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {opts.map(opt => (
            <button key={opt} onClick={() => setAnswer(i, opt)}
              className={cn("px-3 py-1.5 rounded-lg text-xs transition-all border",
                answers[i] === opt
                  ? "bg-stance-neon text-stance-steel border-stance-neon font-bold"
                  : "bg-white/10 text-white border-white/20 hover:border-stance-neon/60"
              )}>
              {opt}
            </button>
          ))}
        </div>
      );
    }

    return (
      <input type="text" value={answers[i]}
        onChange={e => setAnswer(i, e.target.value)}
        placeholder="Type your answer…"
        className={cn(_INPUT_BASE, "mt-1")}
      />
    );
  };

  if (submitted) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-stance-neon text-sm font-semibold">
          <span>✓</span><span>Answers recorded</span>
        </div>
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
          </span>
          <span>Processing…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-0">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-stance-neon rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-white/40 tabular-nums shrink-0">
          {answeredCount}/{questions.length} answered
        </span>
      </div>

      {/* Voice hint */}
      <p className="text-xs text-white/30 mb-4 italic">
        Tap the mic below to answer all questions by voice, or select your answers here.
      </p>

      {/* Questions grouped by scale section */}
      <div className="flex flex-col gap-5">
        {sections.map((sec, si) => (
          <div key={si}>
            {sec.name && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-stance-neon/70 mb-3 border-b border-white/10 pb-1">
                {sec.name}
              </p>
            )}
            <div className="flex flex-col gap-4">
              {sec.indices.map(i => (
                <div key={i} className={cn(
                  "rounded-xl p-3 transition-all",
                  answers[i] ? "bg-white/5 border border-white/10" : "bg-white/[0.03] border border-white/5"
                )}>
                  <p className="text-sm text-white/90 leading-snug mb-2">{questions[i]}</p>
                  {renderControl(i)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={() => { setSubmitted(true); onAnswer(answers.join("|")); }}
        className={cn(
          "mt-6 w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]",
          allAnswered
            ? "bg-stance-neon text-stance-steel hover:bg-stance-neon/90 shadow-[0_4px_16px_rgba(200,255,0,0.25)]"
            : "bg-white/10 text-white/50 border border-white/10"
        )}
      >
        {allAnswered
          ? "Submit All Answers"
          : `Submit (${answeredCount}/${questions.length} answered)`}
      </button>
    </div>
  );
}

function _PromWrapper({
  onAnswer,
  children,
}: {
  onAnswer: (v: string) => void;
  children: (submit: (v: string) => void) => React.ReactNode;
}) {
  const [submitted, setSubmitted] = useState(false);
  if (submitted) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-stance-neon text-sm font-semibold">
          <span>✓</span><span>Answer recorded</span>
        </div>
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
          </span>
          <span>Processing…</span>
        </div>
      </div>
    );
  }
  return <>{children((v) => { setSubmitted(true); onAnswer(v); })}</>;
}

export default function TranscriptionInterface({
  userId = "",
  userName = "",
  initialFormId = null
}: TranscriptionInterfaceProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");
  const [hasEdited, setHasEdited] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [interviewState, setInterviewState] = useState<InterviewState | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const [agentThoughts, setAgentThoughts] = useState<ThoughtStage[] | null>(null);
  const [streamingToken, setStreamingToken] = useState("");   // tokens arriving in real-time
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState<boolean | null>(null); // null = checking
  const [pendingUploadRequest, setPendingUploadRequest] = useState(false);
  const [uploadRequestText, setUploadRequestText] = useState<string | null>(null);
  const [currentFormId, setCurrentFormId] = useState<string>("");
  const [inputMode, setInputMode] = useState<"voice" | "text" | null>(null); // null = show ready screen
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handleStartRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const audioStartSentRef = useRef(false);
  const audioBuffersRef = useRef<Map<string, Uint8Array>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lastChunkTimeRef = useRef<number>(0);
  const lastTranscriptionRef = useRef<string>("");
  const playedAudioMessagesRef = useRef<Set<string>>(new Set());
  const isPlayingAudioRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingTranscriptionRef = useRef<string | null>(null); // Track the transcription waiting to be auto-sent
  const sendTranscriptRef = useRef<((text: string) => void) | null>(null);
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track auto-send timeout
  const hasEditedRef = useRef<boolean>(false); // Track edit state for timeout callback
  const lastSentTextRef = useRef<string | null>(null); // Track last sent text to prevent duplicates
  const lastSentTimeRef = useRef<number>(0); // Track when last message was sent


  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined" && !audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
  }, []);

  // ── Consent check ────────────────────────────────────────────────────────────
  const checkConsent = useCallback(() => {
    if (!userId) return;
    fetch(getApiUrl(`/api/users/${userId}/consent`))
      .then((r) => r.json())
      .then((data) => setConsentAccepted(!!data.consentAccepted))
      .catch(() => setConsentAccepted(true)); // fail open — don't block patient
  }, [userId]);

  useEffect(() => {
    checkConsent();
  }, [checkConsent]);

  // Re-check the moment the user returns to this tab after accepting consent externally
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkConsent();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [checkConsent]);

  // Keep URL in sync with current user and form so that the outer app / backend
  // can read userId + formId from query params if needed.


  // Handle real-time transcription from server
  const handleTranscription = useCallback((transcription: string) => {
    // Hide listening card and the voice-processing indicator as soon as the
    // transcription text arrives — this is when the text lands in the textarea.
    setIsListening(false);
    setIsProcessingVoice(false);  // indicator goes away when text is populated
    if (transcription && transcription.trim()) {
      const trimmedTranscription = transcription.trim();
      pendingTranscriptionRef.current = trimmedTranscription;
      
      // Clear any existing auto-send timeout to prevent duplicates
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
      
      // CRITICAL: Update textarea state so the transcription appears
      // Always show server transcription, reset edit flag
      setCurrentTranscript(trimmedTranscription);
      setEditedTranscript(trimmedTranscription);
      setHasEdited(false);
      hasEditedRef.current = false; // Reset ref as well
      
      // Set auto-send timeout for 2 seconds - ONLY PATH for auto-send
      autoSendTimeoutRef.current = setTimeout(() => {
        // Only auto-send if user hasn't edited (check ref for current state)
        if (!hasEditedRef.current && sendTranscriptRef.current) {
          sendTranscriptRef.current(trimmedTranscription);
          // Clear after sending
          autoSendTimeoutRef.current = null;
        }
      }, 2000);
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: string, transcription?: string, interviewState?: InterviewState, requestAttachment?: boolean, questionMeta?: QuestionMeta) => {
    // Clear the pending transcription ref when new AI message arrives
    pendingTranscriptionRef.current = null;

    // DO NOT clear the transcription textarea when new AI message arrives
    // User may want to keep the transcription and send it manually
    
    // Only add message if it has content
    if (message && message.trim()) {
      // Add assistant message
      const aiMessage: Message = {
        role: "assistant",
        content: message.trim(),
        timestamp: new Date(),
        questionMeta: questionMeta || undefined,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsUnderstanding(false);
      setAgentThoughts(null);
    }

    // Handle attachment request - show/hide upload UI based on server signal
    if (requestAttachment) {
      console.log("[TranscriptionInterface] Attachment request detected:", message);
      setUploadRequestText(
        message ||
          "Please upload any MRI, X-ray, CT scan, or blood reports related to this issue."
      );
      setPendingUploadRequest(true);
    } else {
      // When the server stops requesting attachments for subsequent messages,
      // automatically hide the upload card so it doesn't "stick" on screen.
      setPendingUploadRequest(false);
      setUploadRequestText(null);
    }

    // Update interview state if provided
    if (interviewState) {
      setInterviewState(interviewState);
      if (interviewState.formId) {
        setCurrentFormId(interviewState.formId);
      }
    }
  }, []);

  // Handle audio start from server
  const handleAudioStart = useCallback((messageId: string, totalSize: number) => {
    // Only process if we haven't already played this audio
    if (playedAudioMessagesRef.current.has(messageId)) {
      console.log(`Audio ${messageId} already played, skipping`);
      return;
    }

    setIsModelSpeaking(true);
    isPlayingAudioRef.current = true;
    audioBuffersRef.current.set(messageId, new Uint8Array(0));
    console.log(`Audio stream started: ${messageId}, total size: ${totalSize}`);
  }, []);

  // Handle audio chunks from server and play them
  const handleAudioChunk = useCallback(async (messageId: string, audioData: ArrayBuffer, isLast: boolean) => {
    // Skip if we've already played this audio
    if (playedAudioMessagesRef.current.has(messageId)) {
      return;
    }

    // Accumulate audio chunks
    const existingBuffer = audioBuffersRef.current.get(messageId) || new Uint8Array(0);
    const newBuffer = new Uint8Array(existingBuffer.length + audioData.byteLength);
    newBuffer.set(existingBuffer);
    newBuffer.set(new Uint8Array(audioData), existingBuffer.length);
    audioBuffersRef.current.set(messageId, newBuffer);

    // If this is the last chunk, play the complete audio
    if (isLast && audioContextRef.current) {
      // Mark as played immediately to prevent duplicate playback
      playedAudioMessagesRef.current.add(messageId);

      try {
        const completeAudio = audioBuffersRef.current.get(messageId);
        if (completeAudio && completeAudio.length > 0) {
          // Stop any currently playing audio first
          if (currentAudioSourceRef.current) {
            try {
              currentAudioSourceRef.current.stop();
              currentAudioSourceRef.current = null;
            } catch (e) {
              // Ignore errors when stopping
            }
          }

          // Stop any text-to-speech that might be playing
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }

          // Convert Uint8Array to ArrayBuffer for decoding
          const audioArrayBuffer = completeAudio.buffer.slice(
            completeAudio.byteOffset,
            completeAudio.byteOffset + completeAudio.byteLength
          ) as ArrayBuffer;
          
          // Decode WAV audio
          const audioBuffer = await audioContextRef.current.decodeAudioData(audioArrayBuffer);

          // Create and play new audio source
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          
          currentAudioSourceRef.current = source;
          isPlayingAudioRef.current = true;

          // Play audio and wait for it to finish
          source.start(0);
          
          source.onended = () => {
            currentAudioSourceRef.current = null;
            isPlayingAudioRef.current = false;
            setIsModelSpeaking(false);
            // Don't auto-start recording - wait for user to click mic button
            // This prevents sending audio before server is ready
          };
        }
      } catch (error) {
        console.error("Error playing audio:", error);
        isPlayingAudioRef.current = false;
        setIsModelSpeaking(false);
        // Don't fallback to text-to-speech - we already have the text message
        // Just mark as done and allow recording to start
        if (handleStartRecordingRef.current) {
          setTimeout(() => {
            handleStartRecordingRef.current?.();
          }, 500);
        }
      } finally {
        // Clean up buffer
        audioBuffersRef.current.delete(messageId);
      }
    }
  }, []);

  const handleWebSocketError = useCallback((error: Error) => {
    toast({
      title: "Connection Error",
      description: error.message,
      variant: "destructive",
    });
  }, [toast]);

  const handleWebSocketStatusChange = useCallback((status: "disconnected" | "connecting" | "connected") => {
    // Status is managed by the hook
  }, []);

  const handleFormLoaded = useCallback((formData: Record<string, any>, interviewState?: InterviewState) => {
    setFormData(formData);
    if (interviewState) {
      setInterviewState(interviewState);
      if (interviewState.formId) {
        setCurrentFormId(interviewState.formId);
      }
    }
  }, []);

  const handleTranscriptionStable = useCallback((transcription: string) => {
    handleTranscription(transcription);
  }, [handleTranscription]);

  const handleAttachmentRequest = useCallback((messageText?: string) => {
    setUploadRequestText(messageText || "Please upload any MRI, X-ray, CT scan, or blood reports related to this issue.");
    setPendingUploadRequest(true);
  }, []);

  const handleChatHistory = useCallback((historyMessages: { role: "user" | "assistant"; content: string; timestamp: string }[]) => {
    const restored = historyMessages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
    setMessages(restored);
  }, []);

  const handleThoughtUpdate = useCallback((thoughts: ThoughtStage[]) => {
    setAgentThoughts(thoughts);
  }, []);

  // Accumulate streaming tokens into a live bubble; cleared when text_message arrives
  const handleToken = useCallback((token: string) => {
    setStreamingToken(prev => prev + token);
    setIsUnderstanding(true);  // keep processing card hidden while streaming
  }, []);

  // When the full text_message arrives, clear the streaming buffer (already added to messages)
  const handleWebSocketMessageWithTokenClear = useCallback(
    (message: string, transcription?: string, interviewState?: any, requestAttachment?: boolean, questionMeta?: QuestionMeta) => {
      setStreamingToken("");   // clear accumulated tokens — final message is now in messages[]
      handleWebSocketMessage(message, transcription, interviewState, requestAttachment, questionMeta);
    },
    [handleWebSocketMessage]
  );

  const { status, connect, disconnect, sendAudio, sendAudioStart, sendAudioEnd, sendTextInput, sendStartInterview, sendEndSession, sendStartNewForm, sendLoadForm, isConnected } = useWebSocket({
    serverUrl: userId ? getWsUrl(`/ws/${userId}`) : undefined,
    onMessage: handleWebSocketMessageWithTokenClear,
    onTranscription: handleTranscriptionStable,
    onAudioStart: handleAudioStart,
    onAudioChunk: handleAudioChunk,
    onError: handleWebSocketError,
    onStatusChange: handleWebSocketStatusChange,
    onFormLoaded: handleFormLoaded,
    onAttachmentRequest: handleAttachmentRequest,
    onChatHistory: handleChatHistory,
    onThoughtUpdate: handleThoughtUpdate,
    onToken: handleToken,
  });

  const sendTranscript = useCallback((textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    // Prevent duplicate sends — 8s window covers slow LLM + reconnect retries
    const now = Date.now();
    if (
      lastSentTextRef.current === trimmed &&
      now - lastSentTimeRef.current < 8000
    ) {
      console.log("Duplicate send prevented:", trimmed);
      return;
    }

    // Clear auto-send timeout if sending manually
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }

    // Track what we're sending
    lastSentTextRef.current = trimmed;
    lastSentTimeRef.current = now;

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "user" && lastMessage.content === trimmed) {
        return prev;
      }
      const userMessage: Message = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      return [...prev, userMessage];
    });

    sendTextInput(trimmed);
    setIsUnderstanding(true);
    // Don't clear agentThoughts here — the server sends thought_update immediately
    // after receiving text_input. Clearing here creates a flash of UnderstandingCard
    // before AgentThoughtStream appears. Let handleWebSocketMessage clear it on response.

    setCurrentTranscript("");
    setEditedTranscript("");
    setHasEdited(false);
    hasEditedRef.current = false;
    lastTranscriptionRef.current = "";
    pendingTranscriptionRef.current = null;
  }, [sendTextInput]);

  useEffect(() => {
    sendTranscriptRef.current = sendTranscript;
  }, [sendTranscript]);

  const handleSendMessage = useCallback(() => {
    const textToSend = (editedTranscript || currentTranscript).trim();
    sendTranscript(textToSend);
  }, [editedTranscript, currentTranscript, sendTranscript]);

  const dispatchPendingTranscription = useCallback(() => {
    const pendingText = pendingTranscriptionRef.current;
    if (!pendingText || !pendingText.trim()) {
      return false;
    }
    sendTranscript(pendingText);
    return true;
  }, [sendTranscript]);

  // Handle audio chunks from voice recorder
  const handleVoiceRecorderChunk = useCallback(async (chunk: Blob) => {
    // CRITICAL: Only send if we're actually recording AND audio_start has been sent AND we've waited
    // This prevents sending audio before server is ready
    if (!isRecordingRef.current || !audioStartSentRef.current) {
      // Silently drop chunks if server isn't ready yet
      return;
    }

    // Additional safety check: ensure enough time has passed since audio_start was sent
    if (recordingStartTimeRef.current) {
      const timeSinceStart = Date.now() - recordingStartTimeRef.current;
      if (timeSinceStart < 300) {
        // Don't send chunks in first 300ms after audio_start
        return;
      }
    }

    // Prevent duplicate chunks by checking time
    const now = Date.now();
    if (now - lastChunkTimeRef.current < 50) {
      // Skip if chunk arrived too soon (likely duplicate)
      return;
    }
    lastChunkTimeRef.current = now;

    // Only send if chunk has data
    if (chunk.size === 0) {
      return;
    }

    audioChunksRef.current.push(chunk);
    
    // Convert blob to ArrayBuffer and send
    try {
      const arrayBuffer = await chunk.arrayBuffer();
      // Double-check before sending
      if (isRecordingRef.current && audioStartSentRef.current && isConnected) {
        sendAudio(arrayBuffer);
      }
    } catch (error) {
      console.error("Error sending audio chunk:", error);
    }
  }, [sendAudio, isConnected]);

  // Handle live transcription from Web Speech API
  // NOTE: Browser transcription is IGNORED - only server transcription is used
  const handleLiveTranscript = useCallback((text: string, isFinal: boolean) => {
    // Completely ignore browser transcription - do not update any state or refs
    // Only server transcription should populate the textarea
    // This function is kept for compatibility but does nothing
    return;
  }, []);

  // NOTE: onTranscript is NOT passed - browser transcription is completely disabled
  // Only server transcription is used
  const { isRecording, audioLevel, startRecording, stopRecording } = useVoiceRecorder({
    onAudioChunk: handleVoiceRecorderChunk,
    // onTranscript is intentionally omitted - we only use server transcription
  });

  // Keep a ref to the latest connect so the mount effect doesn't re-run on re-renders
  const connectRef = useRef(connect);
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Connect to WebSocket once on mount — empty deps so re-renders never cancel the timer
  useEffect(() => {
    const timer = setTimeout(() => {
      connectRef.current();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup auto-send timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
    };
  }, []);

  // Start interview or load form once connected and userId is available
  useEffect(() => {
    console.log(`[TranscriptionInterface] useEffect triggered: isConnected=${isConnected}, userId=${userId}, initialFormId=${initialFormId}`);
    if (isConnected && userId) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        // Determine which formId to use (if any)
        // Priority: explicit initialFormId from parent (URL), then any saved formId from a previous session.
        const formIdToUse: string | undefined = initialFormId || undefined;

        // Always use start_interview (not load_form) - the backend will handle resume logic
        if (formIdToUse) {
          console.log(`[TranscriptionInterface] Starting/resuming interview for user ${userId} with form ${formIdToUse}`);
        } else {
          console.log(`[TranscriptionInterface] Starting new interview for user ${userId}`);
        }
        
        if (sendStartInterview) {
          const result = sendStartInterview(userId, formIdToUse);
          console.log(`[TranscriptionInterface] sendStartInterview returned: ${result}`);
        } else {
          console.error(`[TranscriptionInterface] sendStartInterview is undefined!`);
        }
      }, 500); // Increased delay to 500ms
      return () => clearTimeout(timer);
    }
  }, [isConnected, userId, initialFormId, sendStartInterview]);

  // No auto-start mic — user explicitly clicks the mic button to record,
  // or types in the text box. Both are always available after Get Started.

  // Auto-scroll only when new messages arrive or tokens stream in — NOT on mic state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingToken]);

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    if (isModelSpeaking || !isConnected) return;
    
    try {
      // Reset flags
      isRecordingRef.current = false; // Don't set to true yet - wait for audio_start to be sent
      audioStartSentRef.current = false;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      lastChunkTimeRef.current = 0;
      lastTranscriptionRef.current = ""; // Reset to allow new transcriptions
      
      // Clean up old played audio messages (keep only last 10)
      if (playedAudioMessagesRef.current.size > 10) {
        const messagesArray = Array.from(playedAudioMessagesRef.current);
        playedAudioMessagesRef.current = new Set(messagesArray.slice(-10));
      }
      
      // Send audio_start message FIRST, before starting recording
      const startSent = sendAudioStart();
      if (!startSent) {
        toast({
          title: "Connection Error",
          description: "Failed to send audio start signal. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      audioStartSentRef.current = true;
      
      // Wait longer to ensure audio_start is processed by server
      // Server needs to set is_recording = true before accepting binary data
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Now set recording flag and start recording
      isRecordingRef.current = true;
      await startRecording();
      setIsListening(true);
    } catch (error: any) {
      isRecordingRef.current = false;
      audioStartSentRef.current = false;
      setIsListening(false);
      let errorMessage = "Failed to start recording. ";
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage += "Microphone permission denied. Please allow microphone access and try again.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMessage += "No microphone found. Please connect a microphone and try again.";
      } else if (error.name === "NotSupportedError" || error.name === "ConstraintNotSatisfiedError") {
        errorMessage += "Microphone not supported. Please use a different browser or device.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please check microphone permissions and try again.";
      }
      
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Recording error details:", error);
    }
  }, [isModelSpeaking, isConnected, startRecording, sendAudioStart, toast]);

  handleStartRecordingRef.current = handleStartRecording;

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    // Stop recording flag FIRST to prevent more chunks from being sent
    isRecordingRef.current = false;
    audioStartSentRef.current = false;

    // Stop the MediaRecorder
    await stopRecording();

    // Wait a bit to ensure all pending chunks are processed
    await new Promise(resolve => setTimeout(resolve, 200));

    // Calculate duration
    const duration = recordingStartTimeRef.current 
      ? (Date.now() - recordingStartTimeRef.current) / 1000 
      : 0;

    // Send audio_end message
    sendAudioEnd(duration);

    // Switch from listening → processing voice while Whisper transcribes + auto-sends
    setIsListening(false);
    setIsProcessingVoice(true);
    // Safety timeout: hide if transcription + send never arrive (e.g. network drop)
    // 45s covers even long voice recordings on the base Whisper model
    setTimeout(() => {
      setIsProcessingVoice(false);
    }, 45000);

    // Reset chunk tracking
    lastChunkTimeRef.current = 0;

    // Don't clear transcript immediately - wait for server response
    // The server will send back the transcription, which will update the textarea
  }, [stopRecording, sendAudioEnd, dispatchPendingTranscription]);

  // Handle mic click
  const handleMicClick = useCallback(async () => {
    if (isRecording) {
      await handleStopRecording();
    } else {
      await handleStartRecording();
    }
  }, [isRecording, handleStopRecording, handleStartRecording]);

  // Handle text change
  const handleTextChange = (value: string) => {
    // Cancel auto-send if user edits
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
    
    setEditedTranscript(value);
    setCurrentTranscript(value); // Keep them in sync when user edits
    // Treat any user edit as authoritative so live transcription doesn't overwrite
    setHasEdited(true);
    hasEditedRef.current = true; // Update ref as well
  };
  
  // Handle textarea click/focus - cancel auto-send if user interacts
  const handleTextareaClick = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
      setHasEdited(true); // Mark as edited to prevent auto-send
      hasEditedRef.current = true; // Update ref as well
    }
  }, []);

  // Handle enter-to-send for manual input (Shift+Enter still makes a newline)
  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Handle save chat
  const handleSaveChat = async () => {
    try {
      const chatData = JSON.stringify({
        messages,
        interviewState,
        formData,
        timestamp: new Date().toISOString(),
      }, null, 2);
      const blob = new Blob([chatData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${Date.now()}.json`;
      a.click();
      
      toast({
        title: "Chat Saved",
        description: "Your conversation has been saved to your device.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save chat.",
        variant: "destructive",
      });
    }
  };

  // Handle clear form
  const handleClearForm = () => {
    setCurrentTranscript("");
    setEditedTranscript("");
    setHasEdited(false);
  };

  // Note: Transcript is cleared in handleSendMessage after sending
  // No need to clear it here based on messages


  // Handle end chat (pause & continue later)
  const handleEndChat = () => {
    if (isRecording) stopRecording();

    // Submit existing session to backend if possible
    if (userId && sendEndSession) {
      try {
        sendEndSession(userId);
      } catch (error) {
        console.error("Failed to send end_session message:", error);
      }
    }

    // Disconnect from WebSocket but keep UI state visible
    disconnect();
    setIsListening(false);
    setIsUnderstanding(false);
    setAgentThoughts(null);
    pendingTranscriptionRef.current = null;

    toast({
      title: "Chat Paused",
      description: "Your current interview has been saved. You can continue from here later.",
    });
  };

  // Render an interactive question UI based on question type
  const renderQuestionInput = (meta: QuestionMeta, onAnswer: (answer: string) => void) => {
    const { type, options } = meta;
    const isProm = !!meta.question_id; // single-question PROM turns

    // ── multi_answer: all PROM questions at once with section grouping ───────────
    if (type === "multi_answer" && meta.questions?.length) {
      return (
        <_MultiAnswerInput
          questions={meta.questions}
          questionOptions={meta.question_options ?? []}
          questionTypes={meta.question_types ?? []}
          questionScales={meta.question_scales ?? []}
          onAnswer={onAnswer}
        />
      );
    }

    // ── boolean / yes_no → 2-option single choice ────────────────────────────
    if (type === "boolean" || type === "yes_no") {
      const opts = options?.length ? options : ["Yes", "No"];
      const inner = (submit: (v: string) => void) => (
        <div className="mt-4 flex gap-2">
          {opts.map((opt, i) => (
            <button key={i} onClick={() => submit(opt)}
              className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-stance-neon/20 border border-white/20 hover:border-stance-neon text-white text-sm font-bold transition-all active:scale-[0.98]">
              {opt}
            </button>
          ))}
        </div>
      );
      return isProm
        ? <_PromWrapper onAnswer={onAnswer}>{inner}</_PromWrapper>
        : inner(onAnswer);
    }

    // ── single choice ─────────────────────────────────────────────────────────
    if (type === "single_choice" && options?.length) {
      const inner = (submit: (v: string) => void) => (
        <div className="mt-4 flex flex-col gap-2">
          {options.map((opt, i) => (
            <button key={i} onClick={() => submit(opt)}
              className="text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-stance-neon/20 border border-white/20 hover:border-stance-neon text-white text-sm font-medium transition-all active:scale-[0.98]">
              {opt}
            </button>
          ))}
        </div>
      );
      return isProm
        ? <_PromWrapper onAnswer={onAnswer}>{inner}</_PromWrapper>
        : inner(onAnswer);
    }

    // ── multiple choice / checkbox ────────────────────────────────────────────
    if (type === "multiple_choice" || type === "checkbox") {
      return <_CheckboxQuestion options={options || []} onAnswer={onAnswer} />;
    }

    // ── dropdown ─────────────────────────────────────────────────────────────
    if (type === "dropdown") {
      return <_DropdownSelect options={options || []} onAnswer={onAnswer} />;
    }

    // ── scale / linear_scale (0–10 buttons) ─────────────────────────────────
    if (type === "scale" || type === "linear_scale") {
      const minLabel = options?.[0] ?? null;
      const maxLabel = options?.[1] ?? null;
      const scaleInner = (submit: (v: string) => void) => (
        <div className="mt-4">
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} onClick={() => submit(String(i))}
                className={cn("w-10 h-10 rounded-lg text-sm font-bold transition-all active:scale-95 border",
                  i <= 3 ? "bg-green-500/20 border-green-400/40 hover:bg-green-500/40 text-white"
                    : i <= 6 ? "bg-yellow-500/20 border-yellow-400/40 hover:bg-yellow-500/40 text-white"
                    : "bg-red-500/20 border-red-400/40 hover:bg-red-500/40 text-white"
                )}>
                {i}
              </button>
            ))}
          </div>
          {(minLabel || maxLabel) && (
            <div className="flex justify-between mt-1 text-[10px] text-white/50">
              <span>{minLabel ?? "0"}</span><span>{maxLabel ?? "10"}</span>
            </div>
          )}
        </div>
      );
      return isProm
        ? <_PromWrapper onAnswer={onAnswer}>{scaleInner}</_PromWrapper>
        : scaleInner(onAnswer);
    }

    // ── rating (stars) ────────────────────────────────────────────────────────
    if (type === "rating") {
      return <_RatingStars onAnswer={onAnswer} />;
    }

    // ── likert scale ──────────────────────────────────────────────────────────
    if (type === "likert") {
      return <_LikertScale onAnswer={onAnswer} options={options} />;
    }

    // ── slider ────────────────────────────────────────────────────────────────
    if (type === "slider") {
      return <_SliderInput onAnswer={onAnswer} options={options} />;
    }

    // ── number stepper ────────────────────────────────────────────────────────
    if (type === "number") {
      return <_NumberStepper onAnswer={onAnswer} />;
    }

    // ── short answer (inline input) ───────────────────────────────────────────
    if (type === "short_answer") {
      return <_ShortAnswerInput onAnswer={onAnswer} />;
    }

    // ── paragraph (multiline) ─────────────────────────────────────────────────
    if (type === "paragraph") {
      return <_ParagraphInput onAnswer={onAnswer} />;
    }

    // ── date / time ───────────────────────────────────────────────────────────
    if (type === "date") return <_DateInput onAnswer={onAnswer} />;
    if (type === "time") return <_TimeInput onAnswer={onAnswer} />;

    // ── grid types ────────────────────────────────────────────────────────────
    if (type === "choice_grid") {
      return <_ChoiceGrid options={options || []} onAnswer={onAnswer} />;
    }
    if (type === "checkbox_grid") {
      return <_CheckboxGrid options={options || []} onAnswer={onAnswer} />;
    }

    // ── file upload ───────────────────────────────────────────────────────────
    if (type === "file_upload") {
      return <_FileUploadInput onAnswer={onAnswer} />;
    }

    return null; // text / paragraph → user types in chat input normally
  };

  // Format message content to render bullet points as proper lists
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let currentList: string[] = [];
    let currentParagraph: string[] = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 ml-2">
            {currentList.map((item, idx) => (
              <li key={idx} className="text-sm">{item.trim()}</li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText) {
          elements.push(
            <p key={`para-${elements.length}`} className="text-sm mb-2">
              {paragraphText}
            </p>
          );
        }
        currentParagraph = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check if line starts with bullet point (•, -, *, or numbered)
      if (trimmedLine.match(/^[•\-\*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        flushParagraph();
        // Remove bullet marker and add to list
        const listItem = trimmedLine.replace(/^[•\-\*]\s/, '').replace(/^\d+\.\s/, '').trim();
        if (listItem) {
          currentList.push(listItem);
        }
      } else if (trimmedLine === '') {
        // Empty line - flush both list and paragraph
        flushList();
        flushParagraph();
      } else {
        // Regular text line
        flushList();
        currentParagraph.push(trimmedLine);
      }
    });

    // Flush any remaining content
    flushList();
    flushParagraph();

    // If no elements were created, return the original content
    if (elements.length === 0) {
      return <p className="text-sm">{content}</p>;
    }

    return <div>{elements}</div>;
  };

  const _frmSteps = useMemo(
    () => [
      "Present Complaint",
      "Previous Consultations",
      "Pain Assessment",
      "History & Diagnostics",
      "Treatment Goals",
      "Referral",
    ],
    []
  );

  // Use PROM scale names from backend when available; fall back to FRM-01 steps
  const interviewSteps = useMemo(
    () => (interviewState?.promSteps?.length ? interviewState.promSteps : _frmSteps),
    [interviewState?.promSteps, _frmSteps]
  );

  const derivedCurrentStep = useMemo(() => {
    if (!interviewState) return 1;
    const totalSteps = interviewSteps.length;
    const normalizedProgress = Math.min(Math.max(interviewState.progress, 0), 100);

    if (normalizedProgress >= 100) return totalSteps;

    const currentSectionName = interviewState.current_section || interviewState.section;

    // For PROM: match directly against prom step names
    if (interviewState.promSteps?.length) {
      const idx = interviewSteps.findIndex(
        s => s.toLowerCase() === (currentSectionName || "").toLowerCase()
      );
      if (idx >= 0) return idx + 1;
      // Fallback: progress-based
      return Math.min(Math.max(Math.ceil((normalizedProgress / 100) * totalSteps) || 1, 1), totalSteps);
    }

    // FRM-01: use section aliases
    const sectionAliases: Record<string, string> = {
      "present complaint": "Present Complaint",
      "previous consultations": "Previous Consultations",
      "pain assessment": "Pain Assessment",
      "history & diagnostics": "History & Diagnostics",
      "treatment goals": "Treatment Goals",
      "referral": "Referral",
      "medical history": "History & Diagnostics",
      "lifestyle factors": "History & Diagnostics",
      "diagnostic reports": "History & Diagnostics",
    };
    const normalized = currentSectionName
      ? sectionAliases[currentSectionName.toLowerCase()] || currentSectionName
      : "";
    const sectionIndex = normalized
      ? interviewSteps.findIndex(s => s.toLowerCase() === normalized.toLowerCase())
      : -1;
    if (sectionIndex >= 0) return sectionIndex + 1;
    const progressStep = Math.ceil((normalizedProgress / 100) * totalSteps) || 1;
    return Math.min(Math.max(progressStep, 1), totalSteps);
  }, [interviewState, interviewSteps]);

  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  }, [messages]);

  const lastAssistantMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  return (
    <div className="h-[100dvh] bg-stance-steel flex flex-col overflow-hidden overflow-x-hidden text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>

      {/* ── Header ── */}
      <header className="bg-stance-steel/80 backdrop-blur-md z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/assets/brand/logo-white.png"
                alt="Stance Health"
                className="h-7 w-auto max-w-[120px]"
              />
              {interviewState?.section && (
                <>
                  <div className="h-3.5 w-px bg-white/15" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-semibold">Phase</span>
                    <span className="text-[12px] font-medium text-white/70 mt-0.5">
                      {interviewState.section}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Progress number — compact */}
              {interviewState && (
                <span className="text-[11px] font-bold text-stance-neon tabular-nums">
                  {Math.round(Math.max(interviewState.progress, interviewState.sectionProgress?.progress ?? 0))}%
                </span>
              )}

              <Badge
                variant="outline"
                className="rounded-sm border-0 text-stance-steel bg-stance-neon font-display text-[8px] uppercase tracking-widest px-2 py-0.5 font-bold"
              >
                Live
              </Badge>

              {status !== "connected" && (
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-red-500"
                  )} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                    {status === "connecting" ? "Connecting" : "Offline"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar — compact */}
          {interviewState && (
            <SegmentedProgress
              steps={interviewSteps}
              currentStep={derivedCurrentStep}
              stepStatus={interviewState.sectionProgress?.steps}
              overallProgress={
                Math.max(
                  interviewState.progress,
                  interviewState.sectionProgress?.progress ?? 0
                )
              }
              activeLabel={interviewState.section}
            />
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none overflow-hidden opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-stance-neon rounded-full blur-[128px]" />
          <div className="absolute top-1/2 -right-24 w-64 h-64 bg-stance-stone rounded-full blur-[96px]" />
        </div>

        <ScrollArea className="flex-1 min-h-0 bg-[#F0F3F8] shadow-[0_-8px_32px_rgba(0,0,0,0.2)] rounded-t-[32px] md:rounded-t-[48px] mt-2">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8 min-h-[calc(100dvh-200px)]">

            {/* ── Ready / Resume screen — shown until user clicks Get Started ──
                 Condition is inputMode === null ONLY, not message count.
                 Returning users get messages in the background before clicking,
                 but they still see this screen first. ── */}
            {inputMode === null ? (
              <div className="flex flex-col items-center text-center gap-8 pt-16 pb-8 min-h-[60vh] justify-center">

                {/* Big mic icon — like the original */}
                <div className="h-24 w-24 rounded-[28px] bg-stance-steel flex items-center justify-center shadow-[0_8px_32px_rgba(14,27,42,0.18)]">
                  <Mic className="h-10 w-10 text-stance-neon" />
                </div>

                {/* Headline */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-stance-steel/40">
                    Stance Health · Live Interview
                  </p>
                  <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-stance-steel">
                    {(messages.length > 0 || (interviewState && interviewState.progress > 5))
                      ? "Resume your session"
                      : "Ready to begin?"}
                  </h2>
                  <p className="text-stance-grey/50 max-w-xs mx-auto text-sm leading-relaxed">
                    {(messages.length > 0 || (interviewState && interviewState.progress > 5))
                      ? "Pick up right where you left off."
                      : "Choose how you'd like to answer — voice is faster."}
                  </p>
                </div>


                {/* Voice vs Text — info cards only, not buttons */}
                <div className="flex gap-2.5 w-full max-w-xs">
                  {/* Voice card — solid dark background for contrast */}
                  <div className="flex-1 rounded-xl bg-stance-steel px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Mic size={11} className="text-stance-neon" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stance-neon">Voice</span>
                    </div>
                    <p className="text-[17px] font-display font-bold text-white leading-none">~3 min</p>
                    <p className="text-[10px] text-white/50 mt-0.5">Speak naturally</p>
                  </div>
                  {/* Text card — muted */}
                  <div className="flex-1 rounded-xl bg-white border border-stance-steel/10 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Send size={10} className="text-stance-steel/40" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stance-steel/40">Text</span>
                    </div>
                    <p className="text-[17px] font-display font-bold text-stance-steel/30 leading-none">6–10 min</p>
                    <p className="text-[10px] text-stance-steel/30 mt-0.5">Type your answers</p>
                  </div>
                </div>

                <p className="text-[11px] text-stance-steel/35 italic">
                  Tip: Voice is much faster — just speak naturally.
                </p>

                {/* Consent gate — opens external consent site in new tab */}
                {consentAccepted === false && (
                  <button
                    onClick={() => {
                      const isDev = import.meta.env.DEV || window.location.hostname.startsWith('dev.');
                      const consentBase = isDev ? 'https://dev.consent.stance.health' : 'https://consent.stance.health';
                      const returnUrl = `${window.location.origin}/${userId}/FRM-01`;
                      window.open(`${consentBase}/${userId}?redirect=${encodeURIComponent(returnUrl)}`, "_blank", "noopener");
                    }}
                    className="w-full max-w-xs flex items-center justify-center gap-2 bg-stance-neon text-stance-steel font-semibold text-[14px] rounded-2xl py-3.5 px-6 hover:bg-stance-neon/90 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(200,255,0,0.25)]"
                  >
                    <ShieldCheck size={16} />
                    Accept Consent to Continue
                  </button>
                )}

                {/* Get Started — disabled until consent accepted */}
                <button
                  onClick={() => consentAccepted && setInputMode("voice")}
                  disabled={consentAccepted === false}
                  className={cn(
                    "w-full max-w-xs flex items-center justify-center gap-2 font-semibold text-[15px] rounded-2xl py-4 px-6 transition-all",
                    consentAccepted === false
                      ? "bg-stance-steel/30 text-white/30 cursor-not-allowed"
                      : consentAccepted === null
                      ? "bg-stance-steel/50 text-white/50 cursor-wait"
                      : "bg-stance-steel text-white hover:bg-stance-steel/90 active:scale-[0.98] shadow-[0_4px_24px_rgba(14,27,42,0.2)]"
                  )}
                >
                  Get Started
                  <Mic size={16} className={consentAccepted ? "text-stance-neon" : "text-white/30"} />
                </button>

              </div>
            ) : (
              messages.map((message, index) => {
                const isLastUserMessage = message.role === "user" && index === lastUserMessageIndex;
                const isLastAssistant = message.role === "assistant" && index === lastAssistantMessageIndex;
                const isAssistant = message.role === "assistant";
                const showUploadPrompt = isLastAssistant && pendingUploadRequest;

                return (
                  <div key={index} className={cn(
                    "flex flex-col space-y-2",
                    isAssistant ? "items-start" : "items-end"
                  )}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl p-5 md:p-6 shadow-sm transition-all duration-300",
                      isAssistant
                        ? "bg-stance-steel text-white rounded-tl-none border border-white/5"
                        : "bg-white text-stance-grey rounded-tr-none border border-stance-neon/50 shadow-sm"
                    )}>
                      {isAssistant
                        ? <>
                            {/* Hide the numbered question list for the active MCQ batch — it's
                                shown individually inside _MultiAnswerInput. For past batches
                                (not last), show the content so there's a visible record. */}
                            {!(isLastAssistant && message.questionMeta?.type === "multi_answer") && formatMessageContent(message.content)}
                            {isLastAssistant && message.questionMeta && renderQuestionInput(
                              message.questionMeta,
                              (answer) => {
                                // PROM questions (any type with question_id/s): silent submit — no chat bubble
                                const isProm = !!(message.questionMeta?.question_id || message.questionMeta?.question_ids?.length);
                                if (isProm || message.questionMeta?.type === "multi_answer") {
                                  sendTextInput(answer);
                                  setIsUnderstanding(true);
                                } else {
                                  if (sendTranscriptRef.current) sendTranscriptRef.current(answer);
                                }
                              }
                            )}
                          </>
                        : <p className="text-sm leading-relaxed">{message.content}</p>}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stance-grey/40 px-1">
                      {isAssistant ? "Sage" : "You"} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Inline upload prompt under the triggering assistant message */}
                    {showUploadPrompt && (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          id="file-upload-inline"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            const formId = currentFormId || interviewState?.formId;
                            if (!formId || !userId) return;
                            try {
                              const fd = new FormData();
                              for (let i = 0; i < files.length; i++) fd.append("files", files[i]);
                              fd.append("userId", userId);
                              toast({ title: "Uploading...", description: `Uploading ${files.length} file(s).` });
                              const res = await fetch(getApiUrl(`/api/forms/${formId}/attachments`), { method: "POST", body: fd });
                              if (!res.ok) throw new Error("Upload failed");
                              const result = await res.json();
                              toast({ title: "Upload Complete", description: "Documents added to your profile." });
                              setPendingUploadRequest(false);
                              if (result.attachments || result.progress !== undefined) {
                                setInterviewState(prev => prev ? { ...prev, attachments: result.attachments || prev.attachments || [], progress: result.progress !== undefined ? result.progress : prev.progress } : null);
                              }
                              if (sendTranscriptRef.current) sendTranscriptRef.current("I have uploaded my clinical documents.");
                            } catch {
                              toast({ title: "Upload failed", variant: "destructive" });
                            }
                            e.target.value = "";
                          }}
                        />
                        <Button
                          onClick={() => document.getElementById("file-upload-inline")?.click()}
                          size="sm"
                          className="bg-stance-neon text-stance-steel hover:bg-stance-neon/90 font-bold text-xs px-4 h-9 rounded-xl gap-2"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Upload Documents
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPendingUploadRequest(false);
                            // Tell the server the user has no reports so the interview continues
                            if (sendTranscriptRef.current) {
                              sendTranscriptRef.current("I don't have any reports to upload.");
                            }
                          }}
                          className="text-stance-grey/40 hover:text-stance-grey/70 text-xs h-9 px-3 rounded-xl"
                        >
                          Skip
                        </Button>
                      </div>
                    )}

                    {isLastUserMessage && isUnderstanding && (
                      <div className="w-full mt-3 flex justify-start">
                        {agentThoughts && agentThoughts.length > 0 ? (
                          <_CompactThoughtStream thoughts={agentThoughts} />
                        ) : (
                          <_ThinkingDots />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Live streaming bubble — shows words appearing as LLM generates them */}
            {streamingToken && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-[18px] px-5 py-3 bg-stance-steel text-white text-sm leading-relaxed shadow-sm">
                  {streamingToken}
                  <span className="inline-block w-1.5 h-3.5 bg-stance-neon ml-1 animate-pulse rounded-sm align-middle" />
                </div>
              </div>
            )}

            {isListening && (
              <div className="flex justify-end">
                <UnderstandingCard
                  style="clean"
                  headline="Listening..."
                  caption="Speak clearly. We're capturing every detail."
                  className="bg-stance-neon/5 border-stance-neon/20 text-stance-grey"
                />
              </div>
            )}

            {isProcessingVoice && !isListening && (
              <div className="flex justify-end">
                <_VoiceProcessingCard />
              </div>
            )}

            <div ref={messagesEndRef} className="h-32" />
          </div>
        </ScrollArea>
      </main>

      {/* Persistent Controls — shown after Get Started is clicked */}
      {inputMode !== null && (
        <div className="bg-[#F0F3F8] border-t border-stance-steel/10 px-6 py-4 z-20" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Textarea
                  ref={textareaRef}
                  value={editedTranscript || currentTranscript}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onClick={handleTextareaClick}
                  onFocus={handleTextareaClick}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={isProcessingVoice ? "Transcribing your voice..." : "Speak or type your response..."}
                  className={cn(
                    "min-h-[52px] max-h-[120px] pr-14 py-3.5 rounded-2xl bg-white border shadow-sm focus-visible:ring-stance-steel/10 resize-none text-base text-stance-grey placeholder:italic leading-snug",
                    isProcessingVoice
                      ? "border-stance-neon/40 placeholder:text-stance-neon/50 cursor-not-allowed opacity-70"
                      : "border-stance-steel/10 placeholder:text-stance-grey/30"
                  )}
                  disabled={isModelSpeaking || isProcessingVoice}
                />
                {(editedTranscript.trim() || currentTranscript.trim()) && (
                  <Button
                    onClick={handleSendMessage}
                    size="icon"
                    className="absolute right-3 bottom-3 h-8 w-8 rounded-xl bg-stance-steel text-white hover:bg-stance-grey transition-all shadow-md"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Button
                onClick={handleMicClick}
                disabled={!isConnected || isModelSpeaking || isProcessingVoice}
                className={cn(
                  "rounded-full w-14 h-14 flex-shrink-0 shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 shadow-red-500/30"
                    : "bg-stance-steel hover:bg-stance-steel/90 shadow-stance-steel/30 ring-2 ring-stance-neon ring-offset-2 ring-offset-[#F0F3F8]"
                )}
              >
                {isRecording ? (
                  <Square className="h-5 w-5 fill-white text-white animate-pulse" />
                ) : (
                  <Mic className="h-5 w-5 text-white" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

