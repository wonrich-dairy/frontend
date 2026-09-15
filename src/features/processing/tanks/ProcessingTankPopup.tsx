import { useEffect, useState } from "react";
import { changeTankStatus, deleteTank, type ProcessingTank } from "../../../api/processing/tanks";

interface Props {
  tank: ProcessingTank | null;
  token: string | null;
  onClose: () => void;
  onStatusChanged: () => void;
  onDeleted: () => void;
  onEdit: (code: string) => void;
  onError: (msg: string) => void;
}

export function ProcessingTankPopup({ tank, token, onClose, onStatusChanged, onDeleted, onEdit, onError }: Props) {
  const [view, setView] = useState<"menu" | "status" | "delete">("menu");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tank) {
      setView("menu");
      setDeleteConfirm("");
      setSaving(false);
    }
  }, [tank?.id]);

  const handleClose = () => {
    setView("menu");
    setDeleteConfirm("");
    setSaving(false);
    onClose();
  };

  if (!tank) return null;

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      await changeTankStatus(tank.id, tank.status === "Active" ? "Inactive" : "Active", tank.rowVersion, token);
      onStatusChanged();
      handleClose();
    } catch (e: any) {
      onError(e?.message ?? "Status change failed");
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteTank(tank.id, token);
      onDeleted();
      handleClose();
    } catch (e: any) {
      onError(e?.message ?? "Delete failed");
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  // UI fix only: constrain to 390px phone frame
  const scrimCenterStyle: React.CSSProperties = {
    display: "grid",
    placeItems: "center",
    padding: "16px",
    boxSizing: "border-box",
  };

  const scrimBottomStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    padding: 0,
    boxSizing: "border-box",
  };

  const confirmStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "min(360px, calc(100vw - 32px), 390px)",
    boxSizing: "border-box",
    margin: "0 auto",
  };

  const sheetStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "390px",
    margin: "0 auto",
    boxSizing: "border-box",
    borderLeft: "1.5px solid var(--navy-800)",
    borderRight: "1.5px solid var(--navy-800)",
  };

  if (view === "status") {
    return (
      <div className="scrim" style={scrimCenterStyle} onClick={handleClose}>
        <div className="confirm" style={confirmStyle} onClick={(e) => e.stopPropagation()}>
          <div className="confirm__head">
            <h3 className="confirm__title">{tank.status === "Active" ? "Take out of service?" : "Put back in service?"}</h3>
          </div>
          <div className="confirm__body">
            <p className="confirm__subject">{tank.code} - {tank.name}</p>
            <p className="confirm__detail">
              {tank.status === "Active"
                ? `This tank will not accept milk until put back in service.${tank.remainingKg > 0 ? ` It currently holds ${tank.remainingKg.toFixed(0)} KG - empty it first.` : ""}`
                : "This tank will start accepting milk again."}
            </p>
          </div>
          <div className="confirm__actions">
            <button type="button" className="button" disabled={saving} onClick={handleStatusChange}>{saving ? "Saving..." : "Confirm"}</button>
            <button type="button" className="button button--ghost" onClick={handleClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "delete") {
    const expected = `DELETE ${tank.code}`;
    const canDelete = deleteConfirm === expected;

    return (
      <div className="scrim" style={scrimCenterStyle} onClick={handleClose}>
        <div className="confirm" style={confirmStyle} onClick={(e) => e.stopPropagation()}>
          <div className="confirm__head">
            <span className="confirm__mark">!</span>
            <h3 className="confirm__title">Delete Tank? Cannot be undone</h3>
          </div>
          <div className="confirm__body">
            <p className="confirm__subject">{tank.code}</p>
            <p className="confirm__detail">
              This action cannot be undone. The tank will be permanently removed. Type <strong>{expected}</strong> to confirm.
            </p>
            <div className="field" style={{ marginTop: 12, width: "100%", boxSizing: "border-box" }}>
              <input
                value={deleteConfirm}
                placeholder={expected}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoFocus
                style={{ width: "100%", boxSizing: "border-box", maxWidth: "100%" }}
              />
            </div>
          </div>
          <div className="confirm__actions">
            <button type="button" className="button button--danger" disabled={!canDelete || saving} onClick={handleDelete}>{saving ? "Deleting..." : "Delete"}</button>
            <button type="button" className="button button--ghost" onClick={handleClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scrim scrim--bottom" style={scrimBottomStyle} onClick={handleClose}>
      <div className="sheet" style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <span className="sheet__grip" />
        <p className="sheet__eyebrow">{tank.code}</p>
        <h3 className="sheet__title">{tank.name}</h3>
        <div className="sheet__actions">
          <button type="button" className="sheetaction" onClick={() => onEdit(tank.code)}>
            Edit Capacity
          </button>
          <button type="button" className="sheetaction" onClick={() => setView("status")}>
            {tank.status === "Active" ? "Take Out of Service" : "Put Back in Service"}
          </button>
          <button type="button" className="sheetaction sheetaction--danger" onClick={() => { setDeleteConfirm(""); setView("delete"); }}>
            Delete Tank - only if never used
          </button>
        </div>
        <button type="button" className="button button--ghost" style={{ width: "100%", boxSizing: "border-box" }} onClick={handleClose}>Cancel</button>
      </div>
    </div>
  );
}
