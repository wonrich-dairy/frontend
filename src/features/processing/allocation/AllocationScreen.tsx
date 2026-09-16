import { useEffect, useState, useMemo } from "react";
import { listTanks, type ProcessingTank } from "../../../api/processing/tanks";
import { createAllocation, listAllocations, getRunsInStoringTank, type TankAllocationDto, type ProductType, type StoringTankRunDto } from "../../../api/processing/allocations";
import { useSession } from "../../../auth/sessionStore";

const PRODUCT_OPTIONS: { value: ProductType; label: string; desc: string }[] = [
  { value: "SY", label: "SY - Set Yogurt", desc: "Yogurt, acceptable quality" },
  { value: "SK", label: "SK - Set Kiri", desc: "Yogurt, acceptable quality" },
  { value: "FM", label: "FM - Fresh Milk", desc: "Fresh, best quality Passed 80%" },
  { value: "FLM", label: "FLM - Flavored Milk", desc: "Flavored, best quality Passed 80%" },
  { value: "DY", label: "DY - Drinking Yogurt", desc: "Yogurt, acceptable quality" },
];

function getPreSelectedProducts(alcoholResult?: string): ProductType[] {
  if (!alcoholResult) return ["SY", "SK", "FM", "FLM", "DY"];
  if (alcoholResult.includes("80%")) return ["FM", "FLM"];
  if (alcoholResult.includes("75%") || alcoholResult.includes("68%") || alcoholResult.includes("COB")) return ["SY", "SK", "DY"];
  return ["SY", "SK", "FM", "FLM", "DY"];
}

export function AllocationScreen() {
  const { session } = useSession();
  const token = (session as any)?.accessToken ?? null;

  const [storingTanks, setStoringTanks] = useState<ProcessingTank[] | null>(null);
  const [mixingTanks, setMixingTanks] = useState<ProcessingTank[] | null>(null);
  const [allocations, setAllocations] = useState<TankAllocationDto[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Form
  const [sourceTankId, setSourceTankId] = useState("");
  const [destTankId, setDestTankId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [productType, setProductType] = useState<ProductType>("FM");
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runsInSource, setRunsInSource] = useState<StoringTankRunDto[] | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTanks = () => {
    const abort = new AbortController();
    listTanks(token, abort.signal, "Storing", true)
      .then(setStoringTanks)
      .catch(() => setStoringTanks([]));
    listTanks(token, abort.signal, "Mixing", true)
      .then(setMixingTanks)
      .catch(() => setMixingTanks([]));
    listAllocations(token, abort.signal)
      .then((a) => {
        setAllocations(a);
        setLastRefresh(new Date());
      })
      .catch(() => setAllocations([]));
    return () => abort.abort();
  };

  useEffect(() => { return loadTanks(); }, [token]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadTanks(), 10000);
    return () => clearInterval(interval);
  }, [token, autoRefresh]);

  useEffect(() => {
    if (!sourceTankId) {
      setRunsInSource(null);
      setSelectedRunId("");
      return;
    }
    const abort = new AbortController();
    getRunsInStoringTank(sourceTankId, token, abort.signal)
      .then((runs) => {
        setRunsInSource(runs);
        const canAllocate = runs.find(r => r.canAllocate);
        if (canAllocate) {
          setSelectedRunId(canAllocate.id);
          const pre = getPreSelectedProducts(canAllocate.alcoholResult);
          if (pre.length > 0) setProductType(pre[0] as ProductType);
        }
      })
      .catch(() => setRunsInSource([]));
    return () => abort.abort();
  }, [sourceTankId, token]);

  const sourceTank = storingTanks?.find(t => t.id === sourceTankId) ?? null;
  const destTank = mixingTanks?.find(t => t.id === destTankId) ?? null;
  const selectedRun = runsInSource?.find(r => r.id === selectedRunId) ?? null;
  const quantity = Number(quantityKg);

  const preSelected = useMemo(() => getPreSelectedProducts(selectedRun?.alcoholResult), [selectedRun]);
  const isOverride = !preSelected.includes(productType);

  const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const existingLetters = allocations?.filter(a => a.batchNumber === dayOfYear && a.productType === productType).map(a => a.batchLetter) ?? [];
  const nextLetter = existingLetters.length === 0 ? "A" : String.fromCharCode(Math.max(...existingLetters.map(l => l.charCodeAt(0))) + 1);
  const batchPreview = `${dayOfYear}-${productType}-${existingLetters.includes(nextLetter) ? "?" : nextLetter}`;

  const quantityOk = Number.isFinite(quantity) && quantity > 0 && (!sourceTank || quantity <= sourceTank.availableKg + sourceTank.remainingKg) && (!destTank || quantity <= destTank.capacityKg);
  const sourceOk = !!sourceTankId && !!sourceTank && sourceTank.remainingKg > 0.01;
  const destOk = !!destTankId && !!destTank;
  const destEmptyOk = destTank ? destTank.remainingKg <= 0.01 : false;
  const runOk = !!selectedRun && selectedRun.canAllocate;
  const overrideOk = !isOverride || (isOverride && overrideReason.trim().length >= 5);

  const complete = sourceOk && destOk && destEmptyOk && quantityOk && runOk && overrideOk && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    setSaving(true);
    setFailure(null);
    setSuccess(null);
    try {
      const alloc = await createAllocation(
        {
          sourceStoringTankId: sourceTankId,
          destinationMixingTankId: destTankId,
          quantityKg: quantity,
          productType,
          overrideReason: isOverride ? overrideReason : undefined,
          processingRunId: selectedRunId || undefined,
        },
        token
      );
      setSuccess(`Allocated ${alloc.quantityKg.toFixed(0)} KG from ${alloc.sourceStoringTankCode} to ${alloc.destinationMixingTankCode} - Batch ${alloc.batchCode} - Product ${alloc.productType} - Dispatch ${alloc.dispatchNumber} - Alcohol ${alloc.alcoholResult}`);
      setQuantityKg("");
      setOverrideReason("");
      loadTanks();
    } catch (err: any) {
      setFailure(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="pagehead">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="pagehead__title">Allocation - Storing → Mixing</h1>
            <p className="pagehead__detail">Allocate released milk to mixing tank, batch code [day]-[product]-[letter] e.g., 258-FM-A, product pre-selected from alcohol result Passed 80%→FM/FLM, 75%/68%/COB→SY/SK/DY</p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh {lastRefresh ? `(${lastRefresh.toLocaleTimeString()})` : ""}
          </label>
        </div>
      </div>

      {failure && <p className="notice notice--error">{failure}</p>}
      {success && <p className="notice" style={{ background: "#e6f4ea", border: "1px solid #b7e4c7", color: "#15803d", padding: 12, borderRadius: 8 }}>{success}</p>}

      <form onSubmit={submit} noValidate>
        <section className="card">
          <h3 style={{ margin: 0, fontSize: 14 }}>New Allocation - Batch Code Preview: {batchPreview}</h3>
          <p className="card__footnote">DayOfYear {dayOfYear} - Product {productType} - Next letter {nextLetter} - Existing today for {productType}: {existingLetters.join(", ") || "none"}. Mixing tank must be empty (one batch at a time).</p>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="field__label">Source Storing Tank (must have milk, ReleasedForAllocation)</span>
            <select value={sourceTankId} onChange={(e) => setSourceTankId(e.target.value)} disabled={saving}>
              <option value="">Choose storing tank...</option>
              {storingTanks?.map(t => (
                <option key={t.id} value={t.id}>{t.code} - {t.name} - {t.remainingKg.toFixed(0)} KG held / {t.capacityKg.toFixed(0)} KG - {t.availableKg.toFixed(0)} free</option>
              ))}
            </select>
            {sourceTank && <span className="field__hint">Selected {sourceTank.code} holds {sourceTank.remainingKg.toFixed(0)} KG, {sourceTank.availableKg.toFixed(0)} free</span>}
          </label>

          {runsInSource && (
            <div style={{ marginTop: 12, padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
              <span className="field__label" style={{ fontWeight: 700 }}>Runs in {sourceTank?.code} - Select which dispatch to allocate (traceability)</span>
              {runsInSource.length === 0 && <p className="emptystate">No runs in this tank. Record unload first.</p>}
              {runsInSource.map(r => (
                <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: 6, background: r.id === selectedRunId ? "#dcfce7" : "white", borderRadius: 6, border: "1px solid #ccc" }}>
                  <input type="radio" name="run" checked={r.id === selectedRunId} onChange={() => { setSelectedRunId(r.id); const pre = getPreSelectedProducts(r.alcoholResult); if (pre.length>0) setProductType(pre[0] as ProductType); }} disabled={!r.canAllocate} />
                  <span style={{ fontSize: 13 }}>{r.dispatchNumber} - {r.quantityKg.toFixed(0)} KG - {r.qualityTestStatus} - {r.alcoholResult ?? "no alcohol"} - {r.verdict ?? ""} {r.canAllocate ? "✓ Can allocate" : "✗ Cannot"}</span>
                </label>
              ))}
              {selectedRun && (
                <p className="card__footnote" style={{ marginTop: 8 }}>
                  Selected {selectedRun.dispatchNumber} - Alcohol {selectedRun.alcoholResult} - Pre-selected products: {getPreSelectedProducts(selectedRun.alcoholResult).join(", ")} - Verdict {selectedRun.verdict}
                </p>
              )}
            </div>
          )}

          <label className="field" style={{ marginTop: 12 }}>
            <span className="field__label">Destination Mixing Tank (must be empty, one batch at a time)</span>
            <select value={destTankId} onChange={(e) => setDestTankId(e.target.value)} disabled={saving}>
              <option value="">Choose mixing tank...</option>
              {mixingTanks?.map(t => (
                <option key={t.id} value={t.id}>{t.code} - {t.name} - {t.remainingKg.toFixed(0)} KG held / {t.capacityKg.toFixed(0)} KG {t.remainingKg > 0.01 ? ` - HOLDS BATCH, must empty` : " - EMPTY ✓"}</option>
              ))}
            </select>
            {destTank && destTank.remainingKg > 0.01 && <span className="field__hint field__hint--warning">Mixing tank {destTank.code} holds {destTank.remainingKg.toFixed(0)} KG, must be empty before new allocation. Holds batch, cannot allocate new batch.</span>}
            {destTank && destTank.remainingKg <= 0.01 && <span className="field__hint">Selected {destTank.code} empty, can allocate - will hold batch {batchPreview}</span>}
          </label>

          <label className="field">
            <span className="field__label">Quantity KG - 2 decimals - Max {sourceTank ? Math.min(sourceTank.remainingKg, destTank?.capacityKg ?? 999999).toFixed(0) : ""} KG</span>
            <input value={quantityKg} inputMode="decimal" placeholder="1000" onChange={(e) => setQuantityKg(e.target.value)} disabled={saving} />
            {sourceTank && quantityKg && !quantityOk && <span className="field__hint field__hint--warning">Exceeds source remaining {sourceTank.remainingKg.toFixed(0)} KG or dest capacity</span>}
          </label>

          <label className="field">
            <span className="field__label">Product Type - Pre-selected from alcohol result {selectedRun?.alcoholResult ?? ""} - Override requires reason</span>
            <select value={productType} onChange={(e) => setProductType(e.target.value as ProductType)} disabled={saving}>
              {PRODUCT_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label} - {p.desc} {preSelected.includes(p.value) ? "✓ Pre-selected" : "⚠ Override"}</option>
              ))}
            </select>
            {isOverride && <span className="field__hint field__hint--warning">Override: Product {productType} not pre-selected from {selectedRun?.alcoholResult} (pre-selected {preSelected.join(", ")}). Reason required.</span>}
            {!isOverride && <span className="field__hint">Pre-selected {productType} matches alcohol {selectedRun?.alcoholResult} - Fresh/Flavoured for Passed 80%, Yogurt for Passed 75%/68%/COB</span>}
          </label>

          {isOverride && (
            <label className="field">
              <span className="field__label">Override Reason - Required when changing product line (min 5 chars)</span>
              <input value={overrideReason} placeholder="Customer order requires Yogurt instead of Fresh" onChange={(e) => setOverrideReason(e.target.value)} disabled={saving} />
            </label>
          )}

          <div style={{ marginTop: 12, padding: 10, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8 }}>
            <span className="field__label" style={{ fontWeight: 700 }}>Batch Code Preview (Real Process)</span>
            <p style={{ margin: "6px 0 0", fontWeight: 700, fontSize: 16 }}>{batchPreview}</p>
            <p className="card__footnote">Day {dayOfYear} (DayOfYear 1-365) - Product {productType} - Letter {nextLetter} (A-Z per product per day) - e.g., 1-SY-A, 258-FM-A</p>
            <p className="card__footnote">AllocatedAtUtc timestamp recorded, CreatedBy from JWT, concurrency-safe via unique constraint (BatchNumber, ProductType, BatchLetter)</p>
          </div>

          <button type="submit" className="button button--wide" style={{ marginTop: 12 }} disabled={!complete}>
            {saving ? "Allocating..." : `Allocate ${quantityKg || "0"} KG ${sourceTank?.code ?? ""} → ${destTank?.code ?? ""} - Batch ${batchPreview}`}
          </button>
        </section>
      </form>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section__head">
          <h2 className="section__title">Recent Allocations - Traceability</h2>
          <span className="section__count">{allocations?.length ?? 0} {lastRefresh ? `• ${lastRefresh.toLocaleTimeString()}` : ""}</span>
        </div>
        {!allocations && <p className="loading">Loading...</p>}
        {allocations?.length === 0 && <p className="emptystate">No allocations yet. Allocate from storing to mixing to create batch.</p>}
        {allocations?.map(a => (
          <article key={a.id} className="tankrow">
            <header className="tankrow__head">
              <h2 className="tankrow__name">{a.batchCode} - {a.productType}</h2>
              <span className="badge badge--good">{a.quantityKg.toFixed(0)} KG</span>
            </header>
            <p className="tankrow__status">{a.sourceStoringTankCode} → {a.destinationMixingTankCode} - Dispatch {a.dispatchNumber} - Alcohol {a.alcoholResult} - {new Date(a.allocatedAtUtc).toLocaleString()} by {a.createdBy}</p>
            {a.overrideReason && <p className="microlabel" style={{ marginTop: 4 }}>Override: {a.overrideReason}</p>}
            <p className="microlabel" style={{ marginTop: 4 }}>Trace: {a.dispatchNumber} ({a.alcoholResult}) → {a.sourceStoringTankCode} {a.quantityKg.toFixed(0)}KG → {a.destinationMixingTankCode} batch {a.batchCode}</p>
          </article>
        ))}
      </div>
    </>
  );
}
