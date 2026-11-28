import { useEffect, useState } from "react";
import { ArrowLeft, IndianRupee, Landmark, ReceiptText, Scissors, Shirt, WalletCards } from "lucide-react";
import { api } from "../../api";
import { money } from "../../data";
import { normalizedStatus, statusLabel, type GroupShirtOrder, type GroupShirtAmountSummary } from "./types";
import "./group-shirts.css";

const emptySummary: GroupShirtAmountSummary = {
  openingAmount: 0, availableAmount: 0, fabricPurchase: 0, vestiPurchase: 0,
  stitching: 0, productionCost: 0, shirtProfit: 0, transactions: [],
};

export function GroupShirtAmountTransactions({ onBack, onViewOrder }: { onBack: () => void; onViewOrder: (id: string) => void }) {
  const [orders, setOrders] = useState<GroupShirtOrder[]>([]);
  const [summary, setSummary] = useState<GroupShirtAmountSummary>(emptySummary);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [next, nextOrders] = await Promise.all([api.groupShirtAmountTransactions(), api.groupShirtOrders()]);
      setOrders(nextOrders);
      setSummary(next); setOpeningAmount(String(next.openingAmount));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load group shirt transactions."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function saveOpeningAmount() {
    const amount = Number(openingAmount);
    if (!Number.isFinite(amount) || amount < 0) { setError("Enter a valid opening amount."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const next = await api.setGroupShirtOpeningAmount(amount);
      setSummary(next); setOpeningAmount(String(next.openingAmount)); setMessage("Opening amount saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save opening amount."); }
    finally { setSaving(false); }
  }

  const cards = [
    ["Available amount", summary.availableAmount, WalletCards, "available"],
    ["Fabric purchase", summary.fabricPurchase, Shirt, "expense"],
    ["Vesti purchase", summary.vestiPurchase, ReceiptText, "expense"],
    ["Stitching", summary.stitching, Scissors, "expense"],
    ["Shirt profit", summary.shirtProfit, IndianRupee, summary.shirtProfit < 0 ? "loss" : "profit"],
  ] as const;

  return <section className="group-shirts gs-amount-page">
    <button type="button" className="gs-dashboard-back" onClick={onBack}><ArrowLeft size={16} /> Back to Group Shirts</button>
    <header className="gs-header"><div className="gs-heading-content"><span className="gs-heading-icon"><Landmark size={23} /></span><div><h1>Amount transactions</h1><p>Opening amount, order production costs and profit for this branch.</p></div></div></header>
    {error && <div className="gs-error" role="alert">{error}</div>}
    {message && <div className="gs-success" role="status">{message}</div>}

    <section className="gs-opening-card" aria-label="Opening amount">
      <div><span>Opening amount</span><small>Add the cash available for Group Shirts before order expenses.</small></div>
      <label><span className="sr-only">Opening amount</span><input type="number" min="0" step="0.01" value={openingAmount} disabled={loading || saving} onChange={event => setOpeningAmount(event.target.value)} /></label>
      <button type="button" className="primary" disabled={loading || saving} onClick={() => void saveOpeningAmount()}>{saving ? "Saving…" : "Save opening amount"}</button>
    </section>

    <section className="gs-amount-summary" aria-label="Amount summary">
      {cards.map(([label, amount, Icon, tone]) => <article key={label} className={`gs-amount-card gs-amount-${tone}`}><Icon size={19} /><span>{label}</span><strong>{money(amount)}</strong></article>)}
    </section>
    <p className="gs-amount-note">Available amount = opening amount − fabric purchase − vesti purchase − stitching. Shirt profit is sales subtotal minus production cost.</p>

    <section className="gs-transaction-section"><div className="gs-list-toolbar"><div><h2>Transactions</h2><span>{summary.transactions.length} {summary.transactions.length === 1 ? "order" : "orders"}</span></div><strong>Total production cost: {money(summary.productionCost)}</strong></div>
      <div className="gs-table-wrap"><table className="gs-table gs-transaction-table"><thead><tr><th>Date</th><th>Order</th><th>Fabric</th><th>Vesti</th><th>Stitching</th><th>Cost</th><th>Profit</th><th>Status</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="gs-empty-row">Loading transactions…</td></tr> : summary.transactions.length === 0 ? <tr><td colSpan={8} className="gs-empty-row">No Group Shirt order costs yet.</td></tr> : summary.transactions.map(row => <tr key={row.id} className="gs-view-row" tabIndex={0} role="button" aria-label={`View ${row.groupName} order`} onClick={() => onViewOrder(row.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onViewOrder(row.id); } }}><td>{new Date(row.createdAt).toLocaleDateString("en-IN")}</td><td><strong>{row.groupName}</strong><small>{row.customerName}</small><small className="gs-transaction-mobile-date">{new Date(row.createdAt).toLocaleDateString("en-IN")}</small></td><td className="gs-number">{money(row.fabricPurchase)}</td><td className="gs-number">{money(row.vestiPurchase)}</td><td className="gs-number">{money(row.stitching)}</td><td className="gs-number gs-due">{money(row.productionCost)}</td><td className={`gs-number ${row.shirtProfit < 0 ? "gs-loss-text" : "gs-profit-text"}`}>{money(row.shirtProfit)}</td><td className="gs-transaction-status">{(() => { const status = orders.find(order => order.id === row.id)?.status; return status ? <span className={`gs-status-badge gs-status-${normalizedStatus(status).toLowerCase()}`}>{statusLabel(status)}</span> : <span>Unavailable</span>; })()}</td></tr>)}</tbody>
      </table></div>
    </section>
  </section>;
}
