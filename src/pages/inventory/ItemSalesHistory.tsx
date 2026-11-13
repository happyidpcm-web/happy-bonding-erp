import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { Modal } from "../../App";
import { money } from "../../data";
import type { Product } from "../../types";

export function ItemSalesHistory({ item, onClose, onOpenInvoice }: {
  item: Product; onClose: () => void; onOpenInvoice: (id: string) => Promise<void>;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.itemSalesHistory>> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api.itemSalesHistory(item.id).then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load item history"); });
    return () => { active = false; };
  }, [item.id, attempt]);
  const openInvoice = async (id: string) => {
    setOpening(id);
    setInvoiceError("");
    try { await onOpenInvoice(id); }
    catch (err) { setInvoiceError(err instanceof Error ? err.message : "Unable to open invoice"); }
    finally { setOpening(null); }
  };
  return <Modal title={item.name} onClose={onClose} wide>
    <div className="item-sales-history">
    <div className="item-history-meta"><span>{item.sku}{item.size ? ` · ${item.size}` : ""}</span><span>Current branch · All time</span></div>
    {!data && !error && <p role="status">Loading stock and sales transactions...</p>}
    {error && <div role="alert"><p>{error}</p><button className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry</button></div>}
    {data && <>
      <div className="item-history-summary">
        {[["Current stock", `${data.stock.toLocaleString("en-IN")} PCS`],
          ["Sold quantity", `${data.soldQuantity.toLocaleString("en-IN")} PCS`],
          ["Item sales amount", money(data.salesAmount)],
          ["Sales invoices", data.transactions.length.toLocaleString("en-IN")]].map(([label, value]) =>
          <article className="item-history-stat" key={label}><div>{label}</div><strong>{value}</strong></article>)}
      </div>
      <h3>Stock adjustments</h3>
      <div className="item-history-summary">
        <article className="item-history-stat"><div>Total increased</div><strong className="stock-increase">+{(data.adjustments || []).reduce((sum, row) => sum + Math.max(0, row.quantity), 0).toLocaleString("en-IN")} PCS</strong></article>
        <article className="item-history-stat"><div>Total decreased</div><strong className="stock-decrease">-{(data.adjustments || []).reduce((sum, row) => sum + Math.max(0, -row.quantity), 0).toLocaleString("en-IN")} PCS</strong></article>
      </div>
      <div className="table-scroll item-history-table"><table>
        <thead><tr><th>Date / Time</th><th>Adjustment</th><th className="right">Quantity (PCS)</th></tr></thead>
        <tbody>{(data.adjustments || []).map(row => <tr key={row.id}>
          <td>{new Date(row.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
          <td>{row.quantity > 0 ? "Stock increased" : "Stock decreased"}</td>
          <td className={`right ${row.quantity > 0 ? "stock-increase" : "stock-decrease"}`}>{row.quantity > 0 ? "+" : ""}{row.quantity.toLocaleString("en-IN")}</td>
        </tr>)}{!data.adjustments?.length && <tr><td colSpan={3}>No stock adjustments for this item yet.</td></tr>}</tbody>
      </table></div>
      <h3>Sales invoice transactions</h3>
      {invoiceError && <p role="alert">{invoiceError}</p>}
      <div className="table-scroll item-history-table">
        <table>
          <thead><tr><th>Date</th><th>Invoice number</th><th>Customer</th><th className="right">Item quantity</th><th className="right">Item amount</th><th>Payment status</th></tr></thead>
          <tbody>{data.transactions.map(row => <tr key={row.id}>
            <td>{new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td>
            <td><button className="text-button" disabled={opening !== null} onClick={() => openInvoice(row.id)}>{opening === row.id ? "Opening..." : row.number}</button></td>
            <td>{row.party}</td><td className="right">{row.quantity.toLocaleString("en-IN")}</td><td className="right">{money(row.amount)}</td>
            <td><span className={`item-history-status ${row.status === "PAID" ? "paid" : "pending"}`}>{row.status === "PAID" ? "Paid" : row.status === "PARTIALLY_PAID" ? "Partially paid" : "Unpaid"}</span></td>
          </tr>)}{!data.transactions.length && <tr><td colSpan={6}>No sales invoices for this item yet.</td></tr>}</tbody>
        </table>
      </div>
    </>}
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Close</button></div>
    </div>
  </Modal>;
}
