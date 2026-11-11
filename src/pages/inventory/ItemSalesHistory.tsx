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
    <p>{item.sku}{item.size ? ` · ${item.size}` : ""} · Current branch · All time</p>
    {!data && !error && <p role="status">Loading stock and sales transactions...</p>}
    {error && <div role="alert"><p>{error}</p><button className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry</button></div>}
    {data && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, margin: "16px 0" }}>
        {[["Current stock", `${data.stock.toLocaleString("en-IN")} PCS`],
          ["Sold quantity", `${data.soldQuantity.toLocaleString("en-IN")} PCS`],
          ["Item sales amount", money(data.salesAmount)],
          ["Sales invoices", data.transactions.length.toLocaleString("en-IN")]].map(([label, value]) =>
          <article className="card" key={label} style={{ padding: 16 }}><div>{label}</div><strong style={{ fontSize: 22 }}>{value}</strong></article>)}
      </div>
      <p>Saved sales invoices only. Sold quantity excludes cancelled invoices and is before returns. Item amounts include line discounts and tax; invoice-wide charges and payments are shown in the full invoice.</p>
      <h3>Sales invoice transactions</h3>
      {invoiceError && <p role="alert">{invoiceError}</p>}
      <div className="table-scroll" style={{ maxHeight: "45vh", overflow: "auto" }}>
        <table>
          <thead><tr><th>Date</th><th>Invoice number</th><th>Customer</th><th className="right">Item quantity</th><th className="right">Item amount</th><th>Payment status</th></tr></thead>
          <tbody>{data.transactions.map(row => <tr key={row.id}>
            <td>{new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td>
            <td><button className="text-button" disabled={opening !== null} onClick={() => openInvoice(row.id)}>{opening === row.id ? "Opening..." : row.number}</button></td>
            <td>{row.party}</td><td className="right">{row.quantity.toLocaleString("en-IN")}</td><td className="right">{money(row.amount)}</td>
            <td>{row.status === "PAID" ? "Paid" : row.status === "PARTIALLY_PAID" ? "Partially paid" : "Unpaid"}</td>
          </tr>)}{!data.transactions.length && <tr><td colSpan={6}>No sales invoices for this item yet.</td></tr>}</tbody>
        </table>
      </div>
    </>}
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Close</button></div>
  </Modal>;
}
