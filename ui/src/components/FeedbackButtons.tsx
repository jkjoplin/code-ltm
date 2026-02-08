import { useState } from "react";
import { useRecordFeedback } from "../hooks/useLearnings";
import type { FeedbackOutcome } from "../api/client";

interface FeedbackButtonsProps {
  learningId: string;
  compact?: boolean;
}

const LABELS: Record<FeedbackOutcome, string> = {
  used: "Used",
  helpful: "Helpful",
  dismissed: "Dismissed",
};

const BUTTON_STYLES: Record<FeedbackOutcome, string> = {
  used: "border-slate-300 text-slate-700 hover:bg-slate-100",
  helpful: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  dismissed: "border-rose-300 text-rose-700 hover:bg-rose-50",
};

export default function FeedbackButtons({
  learningId,
  compact = false,
}: FeedbackButtonsProps) {
  const feedbackMutation = useRecordFeedback();
  const [lastOutcome, setLastOutcome] = useState<FeedbackOutcome | null>(null);

  const submitFeedback = async (outcome: FeedbackOutcome) => {
    try {
      await feedbackMutation.mutateAsync({ id: learningId, outcome, source: "user" });
      setLastOutcome(outcome);
    } catch (error) {
      console.error("Feedback submission failed", error);
    }
  };

  return (
    <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
      {(["used", "helpful", "dismissed"] as FeedbackOutcome[]).map((outcome) => (
        <button
          key={outcome}
          type="button"
          onClick={() => submitFeedback(outcome)}
          disabled={feedbackMutation.isPending}
          className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
            BUTTON_STYLES[outcome]
          } ${
            lastOutcome === outcome
              ? "ring-1 ring-offset-1 ring-blue-400"
              : ""
          } disabled:cursor-not-allowed disabled:opacity-60`}
          title={`Mark as ${LABELS[outcome].toLowerCase()}`}
        >
          {LABELS[outcome]}
        </button>
      ))}
      {feedbackMutation.isPending && !compact && (
        <span className="text-xs text-gray-500">Saving…</span>
      )}
    </div>
  );
}
