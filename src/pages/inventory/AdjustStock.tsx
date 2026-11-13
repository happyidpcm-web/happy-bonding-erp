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
  const increasing = direction === "increase";
  const nextStock = item.stock + (valid ? amount * (increasing ? 1 : -1) : 0);
  const formatQuantity = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 3 });
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
      <div className="stock-adjust-item"><div><strong>{item.name}</strong><p>Item code: {item.sku}{item.size && !/^(pieces\s*(\(pcs\))?|pcs|nos|-)$/i.test(item.size.trim()) ? ` · Size: ${item.size}` : ""}</p></div><span>Current stock<strong>{formatQuantity(item.stock)} <small>PCS</small></strong></span></div>
      <p className="stock-adjust-intro">Add or remove stock for this item in the current branch.</p>
      <div className="stock-adjust-fields">
        <label>Adjustment type<select disabled={saving} value={direction} onChange={e => setDirection(e.target.value as typeof direction)}><option value="increase">Increase stock (+)</option><option value="decrease">Decrease stock (−)</option></select></label>
        <label>Quantity (PCS)<input autoFocus required type="number" min="0.001" max="99999999999" step="0.001" value={quantity} disabled={saving} onChange={e => setQuantity(e.target.value)} placeholder={increasing ? "Quantity to add" : "Quantity to remove"} aria-describedby="stock-quantity-help" /></label>
      </div>
      <p id="stock-quantity-help" className="stock-adjust-help">Enter how many pieces to {increasing ? "add to" : "remove from"} your stock.</p>
      <div className={`stock-adjust-preview ${increasing ? "is-increase" : "is-decrease"}`} aria-live="polite">
        <div className="stock-adjust-calculation"><span>Current stock<strong>{formatQuantity(item.stock)}</strong></span><b aria-hidden="true">{increasing ? "+" : "−"}</b><span>{increasing ? "Adding" : "Removing"}<strong>{valid ? formatQuantity(amount) : "0"}</strong></span><b aria-hidden="true">=</b><span>New stock<strong>{formatQuantity(nextStock)} <small>PCS</small></strong></span></div>
        <p>{valid ? `Stock will ${increasing ? "increase" : "decrease"} from ${formatQuantity(item.stock)} to ${formatQuantity(nextStock)} PCS after saving.` : "Enter a quantity to preview your new stock balance."}</p>
      </div>
      {error && <p className="stock-adjust-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="primary" disabled={saving || !valid}>{saving ? "Saving..." : "Save Adjustment"}</button></div>
    </form>
  </Modal>;
}
