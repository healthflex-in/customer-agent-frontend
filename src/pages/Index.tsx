import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TranscriptionInterface from "@/components/TranscriptionInterface";
import { getApiUrl } from "@/config/api";

type ConsentState = "checking" | "ok" | "required";

export default function Index() {
  const { userId: pathUserId, formId: pathFormId } = useParams<{ userId?: string; formId?: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string>("");
  const [formId, setFormId] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [consentState, setConsentState] = useState<ConsentState>("checking");

  useEffect(() => {
    // Priority 1: path params /{userId}/{formId}
    if (pathUserId) {
      setUserId(pathUserId);
      setFormId(pathFormId || "FRM-01");
      setReady(true);
      return;
    }

    // Priority 2: query params ?userId=...&formId=...
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qUserId = params.get("userId");
    const qFormId = params.get("formId") || "FRM-01";

    if (qUserId) {
      setUserId(qUserId);
      setFormId(qFormId);
      // Upgrade to clean path URL
      navigate(`/${qUserId}/${qFormId}`, { replace: true });
      setReady(true);
    }
  }, [pathUserId, pathFormId]);

  // Consent gate: check before showing interview
  useEffect(() => {
    if (!ready || !userId) return;
    fetch(getApiUrl(`/api/users/${userId}/consent`))
      .then((r) => r.json())
      .then((data) => {
        if (data.consentAccepted) {
          setConsentState("ok");
        } else {
          setConsentState("required");
          navigate(`/consent/${userId}`, { replace: true });
        }
      })
      .catch(() => {
        // If consent check fails (network error), allow through to avoid blocking
        setConsentState("ok");
      });
  }, [ready, userId]);

  // Consent still being checked — show spinner (redirect happens in useEffect)
  if (ready && consentState === "checking") {
    return (
      <div className="min-h-screen bg-[#0E1B2A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C8FF00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Consent required — redirect is triggered in useEffect, show nothing
  if (ready && consentState === "required") {
    return null;
  }

  // No userId in URL — show a simple access-denied message
  if (!ready) {
    return (
      <div className="min-h-screen bg-stance-steel flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <img
            src="/assets/brand/logo-white.png"
            alt="Stance Health"
            className="h-10 w-auto mx-auto mb-6 opacity-80"
          />
          <h2 className="text-white font-display text-2xl font-bold">Access via your link</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Please use the link provided by your Stance Health clinician to begin your consultation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TranscriptionInterface
      userId={userId}
      initialFormId={formId}
    />
  );
}
