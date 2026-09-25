import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TranscriptionInterface from "@/components/TranscriptionInterface";

export default function Index() {
  const { userId: pathUserId, formId: pathFormId } = useParams<{ userId?: string; formId?: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string>("");
  const [formId, setFormId] = useState<string>("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Priority 1: path params /{userId}/{formId}
    if (pathUserId) {
      const params = new URLSearchParams(window.location.search);
      setUserId(pathUserId);
      setFormId(pathFormId || "FRM-01");
      setAttemptId(params.get("attemptId"));
      setReady(true);
      return;
    }

    // Priority 2: query params ?userId=...&formId=...
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qUserId = params.get("userId");
    const qFormId = params.get("formId") || "FRM-01";
    const qAttemptId = params.get("attemptId");

    if (qUserId) {
      setUserId(qUserId);
      setFormId(qFormId);
      setAttemptId(qAttemptId);
      // Upgrade to clean path URL
      navigate(
        `/${qUserId}/${qFormId}` +
          (qAttemptId ? `?attemptId=${encodeURIComponent(qAttemptId)}` : ""),
        { replace: true },
      );
      setReady(true);
    }
  }, [pathUserId, pathFormId, navigate]);

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
      initialAttemptId={attemptId}
    />
  );
}
