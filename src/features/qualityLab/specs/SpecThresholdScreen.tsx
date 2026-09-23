import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../../auth/sessionStore";
import {
  getAllSpecs,
  updateSpec,
  type SpecThresholdDto,
  type UpdateSpecRequest,
} from "../../../api/qualityLab/specs";
import { PRODUCT_LINE_LABEL, isLiquid, type ProductLine } from "../../../api/qualityLab/panels";
import "./SpecThresholdScreen.css";

export function SpecThresholdScreen() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;

  const [specs, setSpecs] = useState<SpecThresholdDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductLine | null>(null);
  const [form, setForm] = useState<UpdateSpecRequest>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSpecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllSpecs(token);
      setSpecs(data);
    } catch (err: any) {
      setError(err.message ?? "Failed to load specs.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  const startEdit = (spec: SpecThresholdDto) => {
    setEditing(spec.productLine);
    setForm({
      minFatPercent: spec.minFatPercent,
      maxFatPercent: spec.maxFatPercent,
      minPh: spec.minPh,
      maxPh: spec.maxPh,
      minSnf: spec.minSnf,
      minCorrectedClr: spec.minCorrectedClr,
    });
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({});
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await updateSpec(editing, form, token);
      setSuccess(`Thresholds updated for ${PRODUCT_LINE_LABEL[editing]}.`);
      setEditing(null);
      await fetchSpecs();
    } catch (err: any) {
      setError(err.message ?? "Failed to update thresholds.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof UpdateSpecRequest, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value === "" ? null : parseFloat(value),
    }));
  };

  return (
    <div className="spec-screen">
      <div className="spec-screen__header">
        <h1 className="spec-screen__title">⚙️ Spec Thresholds</h1>
        <p className="spec-screen__subtitle">Configure acceptable ranges per product type</p>
      </div>

      {error && <div className="spec-screen__error">{error}</div>}
      {success && <div className="spec-screen__success">{success}</div>}

      {loading ? (
        <p className="spec-screen__loading">Loading thresholds…</p>
      ) : (
        <div className="spec-screen__grid">
          {specs.map((spec) => {
            const liquid = isLiquid(spec.productLine);
            const isEditing = editing === spec.productLine;

            return (
              <div key={spec.id} className={`spec-screen__card ${isEditing ? "spec-screen__card--editing" : ""}`}>
                <div className="spec-screen__card-header">
                  <h3>{PRODUCT_LINE_LABEL[spec.productLine]}</h3>
                  <span className={`spec-screen__type-badge spec-screen__type-badge--${liquid ? "liquid" : "fermented"}`}>
                    {liquid ? "Liquid" : "Fermented"}
                  </span>
                </div>

                <div className="spec-screen__fields">
                  {renderField("Min Fat %", "minFatPercent", spec.minFatPercent, isEditing, form, updateField)}
                  {renderField("Max Fat %", "maxFatPercent", spec.maxFatPercent, isEditing, form, updateField)}
                  {renderField("Min pH", "minPh", spec.minPh, isEditing, form, updateField)}
                  {renderField("Max pH", "maxPh", spec.maxPh, isEditing, form, updateField)}
                  {liquid && renderField("Min SNF", "minSnf", spec.minSnf, isEditing, form, updateField)}
                  {liquid && renderField("Min CLR", "minCorrectedClr", spec.minCorrectedClr, isEditing, form, updateField)}
                </div>

                <div className="spec-screen__card-footer">
                  <span className="spec-screen__updated">
                    Updated by {spec.updatedBy} · {new Date(spec.updatedAtUtc).toLocaleDateString()}
                  </span>
                  {isEditing ? (
                    <div className="spec-screen__btn-group">
                      <button className="spec-screen__btn spec-screen__btn--secondary" onClick={cancelEdit}>Cancel</button>
                      <button className="spec-screen__btn spec-screen__btn--primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    <button className="spec-screen__btn spec-screen__btn--secondary" onClick={() => startEdit(spec)}>Edit</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderField(
  label: string,
  key: keyof UpdateSpecRequest,
  value: number | null,
  isEditing: boolean,
  form: UpdateSpecRequest,
  onChange: (key: keyof UpdateSpecRequest, value: string) => void,
) {
  return (
    <div className="spec-screen__field" key={key}>
      <span className="spec-screen__field-label">{label}</span>
      {isEditing ? (
        <input
          type="number"
          step="0.01"
          className="spec-screen__field-input"
          value={form[key] ?? ""}
          onChange={(e) => onChange(key, e.target.value)}
        />
      ) : (
        <span className="spec-screen__field-value">{value ?? "—"}</span>
      )}
    </div>
  );
}
