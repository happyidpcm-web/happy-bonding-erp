import React, { useState } from "react";
import { Modal } from "../../App";
import { api } from "../../api";
import type { Product } from "../../types";

export function AdjustStock({ item, onClose, onSaved }: { item: Product; onClose: () => void; onSaved: (stock: number) => void }) {
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const amount = Number(quantity);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 99999999999 && Math.abs(amount * 1000 - Math.round(amount * 1000)) < 0.0001;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError("");
    try { const result = await api.adjustStock(item.id, direction, amount); onSaved(result.stock); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to adjust stock"); }
    finally { setSaving(false); }
  };
  return <Modal title="Adjust Stock" onClose={() => { if (!saving) onClose(); }}>
    <form onSubmit={submit} className="stock-adjust-form">
      <div><strong>{item.name}</strong><p>{item.sku}{item.size ? ` · ${item.size}` : ""}</p></div>
      <p>Current stock: <strong>{item.stock.toLocaleString("en-IN")} PCS</strong></p>
      <label>Adjustment type<select disabled={saving} value={direction} onChange={e => setDirection(e.target.value as typeof direction)}><option value="increase">Increase stock</option><option value="decrease">Decrease stock</option></select></label>
      <label>Quantity (PCS)<input autoFocus required type="number" min="0.001" max="99999999999" step="0.001" value={quantity} disabled={saving} onChange={e => setQuantity(e.target.value)} placeholder="Enter quantity" /></label>
      <p>Stock after adjustment: <strong>{(item.stock + (valid ? amount * (direction === "increase" ? 1 : -1) : 0)).toLocaleString("en-IN")} PCS</strong></p>
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="primary" disabled={saving || !valid}>{saving ? "Saving..." : "Save Adjustment"}</button></div>
    </form>
  </Modal>;
}
