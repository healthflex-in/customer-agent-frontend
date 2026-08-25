import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getApiUrl } from "@/config/api";

type ConsentStatus = "loading" | "accepted" | "required" | "error";

export default function ConsentPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConsentStatus>("loading");
  const [checked, setChecked] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Check consent status on load
  useEffect(() => {
    if (!userId) {
      setStatus("error");
      setErrorMsg("Invalid link — no user ID provided.");
      return;
    }
    fetch(getApiUrl(`/api/users/${userId}/consent`))
      .then((r) => r.json())
      .then((data) => {
        if (data.consentAccepted) {
          setStatus("accepted");
        } else {
          setStatus("required");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Could not connect to the server. Please try again.");
      });
  }, [userId]);

  // Redirect to interview once accepted
  useEffect(() => {
    if (status === "accepted" && userId) {
      navigate(`/${userId}/FRM-01`, { replace: true });
    }
  }, [status, userId, navigate]);

  const handleAccept = () => {
    if (!checked || !userId) return;
    const consentBase = (import.meta.env.VITE_CONSENT_URL || "https://consent.stance.health").replace(/\/$/, "");
    const returnUrl = `${window.location.origin}/${userId}/FRM-01`;
    window.location.href = `${consentBase}/${userId}?redirect=${encodeURIComponent(returnUrl)}`;
  };

  if (status === "loading" || status === "accepted") {
    return (
      <div className="min-h-screen bg-[#0E1B2A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#C8FF00] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 text-sm">
            {status === "accepted" ? "Taking you to your session..." : "Checking your status..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#0E1B2A] flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // status === "required" — show consent form
  return (
    <div className="min-h-screen bg-[#0E1B2A] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 flex flex-col gap-6">

        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/assets/brand/logo-white.png"
            alt="Stance Health"
            className="h-8 w-auto"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <h1 className="text-2xl font-bold text-white mt-2">Consent to Collect Health Information</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Before your intake assessment, please review and accept our consent policy.
          </p>
        </div>

        {/* Consent body */}
        <div className="bg-white/5 rounded-2xl p-5 text-white/70 text-sm leading-relaxed space-y-3 max-h-64 overflow-y-auto">
          <p>
            <strong className="text-white">What we collect:</strong> During this intake session,
            Sage (our AI assistant) will ask about your health history, symptoms, lifestyle, and
            treatment goals. Your responses are stored securely and shared only with your assigned
            Stance Health clinician.
          </p>
          <p>
            <strong className="text-white">How it's used:</strong> The information you provide helps
            your clinician understand your situation before your visit, making your session more
            focused and productive.
          </p>
          <p>
            <strong className="text-white">Your rights:</strong> You can request to view, update, or
            delete your data at any time by contacting{" "}
            <a href="https://www.stance.health/" target="_blank" rel="noreferrer" className="text-[#C8FF00] underline">
              Stance Health
            </a>. Participation is voluntary.
          </p>
          <p>
            <strong className="text-white">Data security:</strong> All data is encrypted in transit
            and at rest. We do not sell or share your information with third parties outside your
            care team.
          </p>
          <p className="text-white/40 text-xs">Policy version 1.1.0 · Last updated June 2026</p>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div
            onClick={() => setChecked((c) => !c)}
            className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
              checked ? "bg-[#C8FF00] border-[#C8FF00]" : "border-white/30 group-hover:border-white/60"
            }`}
          >
            {checked && (
              <svg className="w-3 h-3 text-[#0E1B2A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-white/70 text-sm leading-snug">
            I have read and agree to the collection and use of my health information as described above.
          </span>
        </label>

        {/* Error message */}
        {errorMsg && <p className="text-red-400 text-sm text-center">{errorMsg}</p>}

        {/* CTA */}
        <button
          onClick={handleAccept}
          disabled={!checked}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
            checked
              ? "bg-[#C8FF00] text-[#0E1B2A] hover:bg-[#b8ef00] active:scale-[0.98]"
              : "bg-white/10 text-white/30 cursor-not-allowed"
          }`}
        >
          I Agree — Continue to Assessment
        </button>

        <p className="text-center text-white/30 text-xs">
          Your data is protected under our{" "}
          <a href="https://www.stance.health/" target="_blank" rel="noreferrer" className="underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
