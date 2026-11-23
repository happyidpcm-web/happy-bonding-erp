import { useEffect, useState } from "react";
import { Shirt, ArrowRight } from "lucide-react";
import { api } from "../../api";
import { money } from "../../data";
import * as XLSX from "xlsx";
import { normalizedStatus, statusLabel, orderAmounts, productionAmounts, type GroupShirtOrder } from "./types";
import "./group-shirt-report.css";

export function GroupShirtReport({ compact = false, onBack, onOpenOrders }: { compact?: boolean; onBack?: () => void; onOpenOrders?: () => void }) {
  const [orders, setOrders] = useState<GroupShirtOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const branchId = api.currentBranchId();
  useEffect(() => {
    let active = true;
    setOrders([]); setLoading(true); setError("");
    const load = async () => {
      try { const rows = await api.groupShirtOrders(); if (active) { setOrders(rows); setError(""); } }
      catch (err) { if (active) setError(err instanceof Error ? err.message : "Unable to load group shirt orders"); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [branchId, reload]);
  if (compact) return <button type="button" className="gsr-dashboard-card" onClick={onOpenOrders}>
    <span className="gsr-dashboard-icon"><Shirt size={22} /></span>
    <span className="gsr-dashboard-copy"><span>Group Shirt Orders</span><strong>{loading ? "Loading..." : error ? "View orders" : orders.length.toLocaleString("en-IN")}</strong><small>{error ? "Open orders to retry" : "View all orders"}</small></span>
    <ArrowRight size={18} aria-hidden="true" />
  </button>;
  const orderDate = (date: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
  const invalidRange = !!(from && to && from > to);
  const periodOrders = orders.filter(order => {
    const date = orderDate(order.createdAt);
    return !invalidRange && (!from || date >= from) && (!to || date <= to) && (order.groupName + " " + order.customerName + " " + order.phone).toLowerCase().includes(search.toLowerCase());
  });
  const filtered = periodOrders.filter(order => status === "ALL" || normalizedStatus(order.status) === status);
  const rows = filtered.map(order => ({ order, amounts: orderAmounts(order), costs: productionAmounts(order) }));
  const totals = rows.reduce((sum, row) => ({ total: sum.total + row.amounts.total, advance: sum.advance + row.order.advance, balance: sum.balance + row.amounts.balance, production: sum.production + row.costs.production, profit: sum.profit + row.costs.profit }), { total: 0, advance: 0, balance: 0, production: 0, profit: 0 });
  function download() {
    const data = rows.map(({ order, amounts, costs }) => ({ "Order date": orderDate(order.createdAt), Event: order.groupName, Customer: order.customerName, Phone: order.phone, "Delivery date": order.deliveryDate, Status: statusLabel(order.status), "Shirt quantity": amounts.quantity, "Vesti quantity": order.vestiQuantity, Subtotal: amounts.subtotal, Discount: order.discount, "Total amount": amounts.total, Advance: order.advance, Balance: amounts.balance, "Fabric purchase": costs.fabricPurchase, "Stitching cost": costs.stitching, "Production cost": costs.production, "Profit before discount": costs.profit }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), "Group Shirts");
    XLSX.writeFile(workbook, "group-shirts-report.xlsx");
  }
  return <section className="card gsr">
    <header className="gsr-heading"><div>{onBack && <button type="button" className="secondary" onClick={onBack}>Back to reports</button>}<h2>{compact ? "Group Shirt Orders" : "Group Shirts Report"}</h2><p>{compact ? "Current branch ? All dates ? Latest orders" : "Current branch ? Filter by order creation date"}</p></div>
      {compact ? <button type="button" className="secondary" onClick={onOpenOrders}>View all orders</button> : <button type="button" className="secondary" disabled={loading || !!error || !rows.length} onClick={download}>Download Excel</button>}
    </header>
    {!compact && <div className="gsr-filters"><label>From date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To date<input type="date" min={from || undefined} value={to} onChange={e => setTo(e.target.value)} /></label><label>Search orders<input placeholder="Event, customer or phone" value={search} onChange={e => setSearch(e.target.value)} /></label><button type="button" className="secondary" onClick={() => { setFrom(""); setTo(""); setSearch(""); setStatus("ALL"); }}>Reset filters</button></div>}
    {invalidRange && <p role="alert">To date must be on or after From date.</p>}
    {loading ? <p role="status">Loading group shirt orders...</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setReload(value => value + 1)}>Retry</button></p> : <>
      <div className="gsr-counts">{[{ value: "ALL", label: "Total orders" }, { value: "PROCESSING", label: "Pending" }, { value: "COMPLETED", label: "Completed" }, { value: "DELIVERED", label: "Delivered" }].map(item => <button type="button" key={item.value} aria-pressed={status === item.value} onClick={() => setStatus(item.value)}><span>{item.label}</span><strong>{periodOrders.filter(order => item.value === "ALL" || normalizedStatus(order.status) === item.value).length}</strong></button>)}</div>
      <div className="gsr-totals">{[["Order amount", totals.total], ["Advance", totals.advance], ["Remaining amount", totals.balance], ...(!compact ? [["Production cost", totals.production], ["Profit before discount", totals.profit]] : [])].map(([label, amount]) => <div key={label}><span>{label}</span><strong>{money(Number(amount))}</strong></div>)}</div>
      <div className="table-scroll"><table><thead><tr><th>Event</th><th>Customer</th><th>Delivery date</th><th>Status</th><th className="right">Total</th><th className="right">Advance</th><th className="right">Balance</th>{!compact && <><th className="right">Production cost</th><th className="right">Profit before discount</th></>}</tr></thead><tbody>{(compact ? rows.slice(0, 5) : rows).map(({ order, amounts, costs }) => <tr key={order.id}><td><strong>{order.groupName}</strong></td><td>{order.customerName}</td><td>{order.deliveryDate}</td><td>{statusLabel(order.status)}</td><td className="right">{money(amounts.total)}</td><td className="right">{money(order.advance)}</td><td className="right">{money(amounts.balance)}</td>{!compact && <><td className="right">{money(costs.production)}</td><td className="right">{money(costs.profit)}</td></>}</tr>)}{!rows.length && <tr><td colSpan={compact ? 7 : 9}>No group shirt orders match these filters.</td></tr>}</tbody></table></div>
      <p className="gsr-note">{compact ? "Showing " + Math.min(rows.length, 5) + " of " + rows.length + " matching orders. " : "Profit before discount = subtotal including vesti minus production cost. "}Group orders are tracked separately from sales invoices.</p>
    </>}
  </section>;
}
