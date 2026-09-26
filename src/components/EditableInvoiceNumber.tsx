import { useState } from "react";

export function EditableInvoiceNumber({ label, value, onChange, currency = false, min = 0, integer = false }: {
  label: string; value: number; onChange: (value: number) => void;
  currency?: boolean; min?: number; integer?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const start = () => { setDraft(String(value)); setError(false); setEditing(true); };
  const commit = () => {
    const next = Number(draft);
    if (!draft.trim() || !Number.isFinite(next) || next < min || (integer && !Number.isInteger(next))) {
      setError(true);
      return;
    }
    onChange(next);
    setEditing(false);
  };
  if (editing) return <div>
    <input autoFocus aria-label={label} aria-invalid={error} className="invoice-number-editor" type="number"
      min={min} step={integer ? 1 : "0.01"} value={draft}
      onFocus={e => e.currentTarget.select()} onChange={e => { setDraft(e.target.value); setError(false); }}
      onBlur={commit} onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commit(); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditing(false); }
      }} />
    {error && <small role="alert" style={{ color: "#b91c1c" }}>{integer ? "Enter a whole number" : "Enter a number"} ≥ {min}</small>}
  </div>;
  return <button type="button" className="gray-val-box invoice-number-display" aria-label={`Edit ${label}`}
    title="Double-click to edit (or press Enter)" onDoubleClick={start}
    onKeyDown={e => { if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); start(); } }}>
    {currency ? value.toLocaleString("en-IN", { style: "currency", currency: "INR" }) : value}
  </button>;
}
