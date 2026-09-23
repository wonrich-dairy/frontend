import { useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import {
  submitDetermination,
  supersedeDetermination,
  REASON_CODES,
  type DeterminationDto,
  type SubmitDeterminationRequest,
} from "../../../api/qualityLab/determinations";
import "./DeterminationForm.css";

interface Props {
  batchCode: string;
  hasOutOfSpecFlags: boolean;
  existing: DeterminationDto | null;
  onComplete: () => void;
}

export function DeterminationForm({ batchCode, hasOutOfSpecFlags, existing, onComplete }: Props) {
  const { session } = useSession();
  const token = session?.accessToken ?? null;

  const [result, setResult] = useState<"Pass" | "Fail" | null>(null);
  const [reasonCodes, setReasonCodes] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [superseding, setSuperseding] = useState(false);

  // Show existing determination
  if (existing && !superseding) {
    const isPass = existing.result === "Pass";
    return (
      <div className={`determination-result determination-result--${isPass ? "pass" : "fail"}`}>
        <div className="determination-result__header">
          <span className="determination-form__title">🏷️ Determination</span>
          <span className={`determination-result__badge determination-result__badge--${isPass ? "pass" : "fail"}`}>
            {existing.result === "Pass" ? "✅ PASSED" : "❌ FAILED"}
          </span>
        </div>
        {existing.reasonCodes.length > 0 && (
          <p className="determination-result__detail">
            <strong>Reason codes:</strong> {existing.reasonCodes.join(", ")}
          </p>
        )}
        {existing.overrideReason && (
          <p className="determination-result__detail">
            <strong>Override:</strong> {existing.overrideReason}
          </p>
        )}
        {existing.notes && (
          <p className="determination-result__detail">
            <strong>Notes:</strong> {existing.notes}
          </p>
        )}
        <p className="determination-result__detail">
          <strong>By:</strong> {existing.determinedBy} · {new Date(existing.determinedAtUtc).toLocaleString()}
        </p>
        <button
          className="determination-result__supersede-btn"
          onClick={() => setSuperseding(true)}
        >
          ↻ Supersede this determination
        </button>
      </div>
    );
  }

  const toggleReason = (code: string) => {
    setReasonCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const needsOverride = result === "Pass" && hasOutOfSpecFlags;

  const canSubmit =
    result !== null &&
    (result === "Pass" || reasonCodes.length > 0) &&
    (!needsOverride || overrideReason.trim().length > 0);

  const handleSubmit = async () => {
    if (!result || !canSubmit) return;
    setSubmitting(true);
    setError(null);

    const body: SubmitDeterminationRequest = {
      result,
      reasonCodes: result === "Fail" ? reasonCodes : undefined,
      overrideReason: needsOverride ? overrideReason : undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (superseding && existing) {
        await supersedeDetermination(batchCode, body, token);
      } else {
        await submitDetermination(batchCode, body, token);
      }
      setResult(null);
      setReasonCodes([]);
      setOverrideReason("");
      setNotes("");
      setSuperseding(false);
      onComplete();
    } catch (err: any) {
      setError(err.message ?? "Failed to submit determination.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="determination-form">
      <h4 className="determination-form__title">
        {superseding ? "↻ Supersede Determination" : "🏷️ Submit Determination"}
      </h4>

      {error && <div className="determination-form__error">{error}</div>}

      <div className="determination-form__result-btns">
        <button
          className={`determination-form__result-btn ${result === "Pass" ? "determination-form__result-btn--pass" : ""}`}
          onClick={() => setResult("Pass")}
        >
          ✅ Pass
        </button>
        <button
          className={`determination-form__result-btn ${result === "Fail" ? "determination-form__result-btn--fail" : ""}`}
          onClick={() => setResult("Fail")}
        >
          ❌ Fail
        </button>
      </div>

      {result === "Fail" && (
        <div className="determination-form__reason-section">
          <span className="determination-form__reason-label">Select reason codes (at least one):</span>
          <div className="determination-form__reasons">
            {REASON_CODES.map((r) => (
              <button
                key={r.code}
                className={`determination-form__reason-chip ${reasonCodes.includes(r.code) ? "determination-form__reason-chip--selected" : ""}`}
                onClick={() => toggleReason(r.code)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsOverride && (
        <div className="determination-form__override">
          <span className="determination-form__override-label">
            ⚠️ Override reason required (batch has out-of-spec flags):
          </span>
          <textarea
            className="determination-form__textarea"
            placeholder="Explain why this batch is being passed despite out-of-spec parameters..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </div>
      )}

      <div style={{ marginBottom: "0.5rem" }}>
        <span className="determination-form__reason-label">Notes (optional):</span>
        <textarea
          className="determination-form__textarea"
          placeholder="Additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <button
        className={`determination-form__submit-btn determination-form__submit-btn--${result ?? "pass"}`}
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Submitting…" : superseding ? "Supersede Determination" : `Submit ${result ?? ""} Determination`}
      </button>

      {superseding && (
        <button
          style={{ width: "100%", marginTop: "0.375rem", padding: "0.5rem", border: "none", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: "0.75rem" }}
          onClick={() => setSuperseding(false)}
        >
          Cancel supersede
        </button>
      )}
    </div>
  );
}
