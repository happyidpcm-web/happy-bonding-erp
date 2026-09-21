import React, { useState, useMemo } from "react";
import { ChevronDown, IndianRupee as CircleIndianRupee, CreditCard, WalletCards } from "lucide-react";
import { money } from "../../data";
import type { Invoice, OwnerBranchSummary, Party, Product } from "../../types";
import { PageHeading, Metric } from "../../App";

export function SalesReportChartCard({ invoices }: { invoices: Invoice[] }) {
  const [viewMode, setViewMode] = useState<"Daily" | "Weekly">("Daily");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Compute real last 7 days data from actual backend invoices (100% Real Data)
  const reportData = useMemo(() => {
    const now = new Date();
    const days: Array<{
      dateObj: Date;
      dayLabel: string;
      formattedDate: string;
      dateStr: string;
      sales: number;
      count: number;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short" });
      const formattedDate = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        dateObj: d,
        dayLabel,
        formattedDate,
        dateStr,
        sales: 0,
        count: 0,
      });
    }

    let total7DayInvoices = 0;

    invoices.forEach(inv => {
      const match = days.find(day => {
        if (inv.date === day.formattedDate) return true;
        if (inv.date && inv.date.slice(0, 10) === day.dateStr) return true;
        const invD = new Date(inv.date);
        return !isNaN(invD.getTime()) && invD.toDateString() === day.dateObj.toDateString();
      });

      if (match) {
        match.sales += Number(inv.amount || 0);
        match.count += 1;
        total7DayInvoices += 1;
      }
    });

    const startDateStr = days[0].formattedDate;
    const endDateStr = days[days.length - 1].formattedDate;
    const maxVal = Math.max(...days.map(d => d.sales), 0);
    const maxY = maxVal === 0 ? 1000 : Math.max(1000, Math.ceil(maxVal / 500) * 500);

    return {
      days,
      startDateStr,
      endDateStr,
      total7DayInvoices,
      maxY,
    };
  }, [invoices]);

  const { days, startDateStr, endDateStr, total7DayInvoices, maxY } = reportData;

  // Build dynamic SVG points
  const points = days.map((d, index) => {
    const x = (index / (days.length - 1)) * 700;
    const y = 208 - (d.sales / maxY) * 190;
    return { x, y };
  });

  // Construct smooth bezier curve path
  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cp1x = p1.x + (p2.x - p1.x) / 2;
    const cp1y = p1.y;
    const cp2x = p1.x + (p2.x - p1.x) / 2;
    const cp2y = p2.y;
    pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  const fillD = `${pathD} L ${points[points.length - 1].x},208 L ${points[0].x},208 Z`;

  // Dynamic Y-axis steps based on real sales value
  const ySteps = [maxY, (maxY * 5) / 6, (maxY * 4) / 6, (maxY * 3) / 6, (maxY * 2) / 6, maxY / 6, 0];

  return (
    <article className="card sales-report-card half-width">
      <div className="card-title sales-report-head">
        <h2>Sales Report - {startDateStr} to {endDateStr}</h2>
        <div className="report-select-wrap">
          <button
            type="button"
            className="report-select-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span>{viewMode}</span>
            <ChevronDown size={16} />
          </button>
          {dropdownOpen && (
            <div className="report-dropdown-menu">
              <button
                type="button"
                className={viewMode === "Daily" ? "active" : ""}
                onClick={() => { setViewMode("Daily"); setDropdownOpen(false); }}
              >
                Daily
              </button>
              <button
                type="button"
                className={viewMode === "Weekly" ? "active" : ""}
                onClick={() => { setViewMode("Weekly"); setDropdownOpen(false); }}
              >
                Weekly
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sales-chart-wrapper">
        <div className="sales-chart-main">
          {/* Dynamic Y-Axis Labels based on actual sales */}
          <div className="chart-y-axis">
            {ySteps.map((step, idx) => (
              <span key={idx}>₹ {Math.round(step).toLocaleString("en-IN")}</span>
            ))}
          </div>

          {/* Dynamic SVG Area Chart */}
          <div className="chart-svg-container">
            <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="chart-svg">
              <defs>
                <linearGradient id="salesGreenGradientReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                  <stop offset="65%" stopColor="#4ade80" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#86efac" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[10, 43, 76, 109, 142, 175, 208].map(y => (
                <line key={y} x1="0" y1={y} x2="700" y2={y} stroke={y === 208 ? "#e2e8f0" : "#f1f5f9"} strokeWidth="1" />
              ))}
              {[0, 116, 233, 350, 466, 583, 700].map(x => (
                <line key={x} x1={x} y1="10" x2={x} y2="208" stroke="#f1f5f9" strokeWidth="1" />
              ))}

              {/* Smooth Dynamic Area Path */}
              <path d={fillD} fill="url(#salesGreenGradientReal)" />

              {/* Smooth Dynamic Line Path */}
              <path d={pathD} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
            </svg>

            {/* Dynamic X-Axis Day Labels */}
            <div className="chart-x-axis">
              {days.map(d => (
                <span key={d.dayLabel}>{d.dayLabel}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Stats Panel */}
        <div className="sales-chart-stat-panel">
          <span className="stat-lbl">Invoices Made</span>
          <strong className="stat-val">{total7DayInvoices}</strong>
        </div>
      </div>
    </article>
  );
}

export function DashboardLive({
  parties,
  invoices,
  ownerSummary = [],
  onNewSale,
  onSelectInvoice,
  onSeeAllTransactions,
}: {
  products: Product[];
  parties: Party[];
  invoices: Invoice[];
  ownerSummary?: OwnerBranchSummary[];
  onNewSale: () => void;
  onSelectInvoice: (inv: Invoice) => void;
  onSeeAllTransactions: () => void;
}) {
  // Real calculation from backend database (No Dummy Data)
  const toCollect = parties.filter(r => r.balance > 0).reduce((a, b) => a + b.balance, 0);
  const toPay = Math.abs(parties.filter(r => r.balance < 0).reduce((a, b) => a + b.balance, 0));
  const cashBalance = invoices.filter(i => i.status === "Paid").reduce((a, b) => a + b.amount, 0);

  const displayList = invoices;

  return (
    <>
      <PageHeading title="Dashboard" subtitle="Business Overview" action="Create Sales Invoice" onAction={onNewSale} />
      <div className="metrics-grid three">
        <Metric label="↓ To Collect" value={`₹ ${toCollect.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} icon={CircleIndianRupee} tone="green" />
        <Metric label="↑ To Pay" value={`₹ ${toPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} icon={CreditCard} tone="red" />
        <Metric label="🏛️ Total Cash + Bank Balance" value={`₹ ${cashBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} icon={WalletCards} tone="blue" />
      </div>

      {ownerSummary.length > 0 && (
        <article className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="card-title"><div><h2>Owner Branch Summary</h2><p>All branch sales, stock and payment totals</p></div></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Branch</th><th>Sales</th><th>Payment In</th><th>Payment Out</th><th>Stock Qty</th><th>Invoices</th></tr></thead>
              <tbody>
                {ownerSummary.map(row => (
                  <tr key={row.branchId}>
                    <td><strong>{row.branchName}</strong><small style={{ display: "block", color: "#64748b" }}>{row.code}</small></td>
                    <td>{money(row.salesTotal)}</td>
                    <td>{money(row.paymentIn)}</td>
                    <td>{money(row.paymentOut)}</td>
                    <td>{row.stockQty.toLocaleString("en-IN")}</td>
                    <td>{row.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <div className="dashboard-grid" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 1. Latest Transactions Card FIRST */}
        <article className="card transactions" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">
            <div>
              <h2>Latest Transactions</h2>
            </div>
            <button className="text-button" style={{ font: "700 13px Manrope", color: "#2563eb" }} onClick={onSeeAllTransactions}>
              See All Transactions →
            </button>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>TYPE</th>
                  <th>TXN NO</th>
                  <th>PARTY NAME</th>
                  <th className="right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {displayList.slice(0, 5).map(i => (
                  <tr key={i.id} className="clickable-row" onClick={() => onSelectInvoice(i)}>
                    <td>{i.date}</td>
                    <td><span className="pill neutral">Sales Invoices</span></td>
                    <td className="mono bold-invoice-num">{i.number}</td>
                    <td><strong>{i.party}</strong></td>
                    <td className="right"><strong>{money(i.amount)}</strong></td>
                  </tr>
                ))}
                {!displayList.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                      No transactions recorded yet. Click <strong>+ Create Sales Invoice</strong> to add a sale.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: "center", padding: "14px 0" }}>
            <button className="text-button" style={{ font: "700 13px Manrope", color: "#2563eb" }} onClick={onSeeAllTransactions}>
              See All Transactions →
            </button>
          </div>
        </article>

        {/* 2. Sales Report Card BELOW Transactions, occupying Left to Center of screen */}
        <div className="dashboard-bottom-row">
          <SalesReportChartCard invoices={invoices} />
        </div>
      </div>
    </>
  );
}

export function lastSevenDays(invoices: Invoice[]) {
  const days = Array.from({length:7},(_,index)=>{const date=new Date();date.setDate(date.getDate()-(6-index));return date;});
  return days.map(date=>{const label=date.toLocaleDateString("en-IN",{weekday:"short"});const key=date.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});return {label,amount:invoices.filter(row=>row.date===key).reduce((sum,row)=>sum+row.amount,0)};});
}
