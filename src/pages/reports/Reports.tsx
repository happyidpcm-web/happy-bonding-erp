import { matchesItemSearch } from "../../utils/itemSearch";
import { SearchablePicker } from "../../components/SearchablePicker";
import { ItemSummary } from './ItemSummary';
import { BackendReport, backendReports } from './BackendReport';
import { BalanceSummary } from './BalanceSummary';
import { DateRangeFilter } from "../../components/DateRangeFilter";
import type { CustomDateRange, DateRangeSelection } from "../../utils/invoiceDateRange";
import { invoiceExcelDate, invoiceTime } from "../../utils/invoiceDateRange";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BarChart3, Boxes, ChevronDown, Download, ExternalLink, FileSpreadsheet, FileText, Mail, Percent, Plus, Printer, Search, ShieldCheck, Sparkles, Star, Tag, Trash2, Upload, Users, X
} from "lucide-react";
import * as XLSX from "xlsx";
import { money } from "../../data";
import { api } from "../../api";
import type { Invoice, Product } from "../../types";
import { Modal, PageHeading, isInvoiceInDateRange } from "../../App";

export function EmailExcelReportModal({
  reportName,
  products = [],
  reportRows,
  onClose,
  notify,
}: {
  reportName: string;
  products?: Product[];
  reportRows?: Record<string, string | number>[];
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [userEmail, setUserEmail] = useState("");
  const [caEmail, setCaEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!userEmail.trim()) return notify("Please enter your email ID");
    setSending(true);
    try {
      // Generate real base64 Excel data
      let base64Excel: string | undefined = undefined;
      try {
        const excelRows = reportRows ?? products.map((p, idx) => ({
          "S.No": idx + 1,
          "Item Name": p.name,
          "SKU / Item Code": p.sku,
          "Category": p.category || "General",
          "Stock Quantity": `${p.stock} ${p.size || "PCS"}`,
          "Purchase Price (₹)": p.purchasePrice,
          "Sales Price (₹)": p.sellingPrice,
          "MRP (₹)": p.mrp || p.sellingPrice,
          "HSN Code": p.hsnCode || "6205",
          "GST Rate": `${p.taxRate}%`,
        }));

        const ws = XLSX.utils.json_to_sheet(excelRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, reportName.substring(0, 30));
        base64Excel = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      } catch { throw new Error('Unable to generate the Excel attachment. Please retry.'); }

      // Direct Brevo Transactional Email Dispatch with Attachment
      const res = await api.sendBrevoEmail({
        reportName,
        userEmail: userEmail.trim(),
        caEmail: caEmail.trim() || undefined,
        base64Excel,
      });

      notify(res.message || `✅ Excel report emailed to ${userEmail.trim()} via Brevo!`);
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : `Failed to dispatch email to ${userEmail.trim()}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title="Email Excel Report" onClose={onClose}>
      <div style={{ padding: "8px 0" }}>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
          We will send you the <strong>{reportName}</strong> export directly to the email addresses below.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ font: "600 13px Manrope", color: "#334155" }}>
            Your Email ID <span style={{ color: "#ef4444" }}>*</span>
            <input
              type="email"
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              placeholder="Enter your email"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4 }}
            />
          </label>

          <label style={{ font: "600 13px Manrope", color: "#334155" }}>
            CA Email ID (Optional)
            <input
              type="email"
              value={caEmail}
              onChange={e => setCaEmail(e.target.value)}
              placeholder="Enter CA email"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4 }}
            />
          </label>

          <p>Email is sent securely through the server to the addresses entered above.</p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button type="button" className="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSend}
            disabled={sending}
            style={{ background: "#4f46e5", borderColor: "#4f46e5", padding: "8px 24px" }}
          >
            {sending ? "Sending..." : "Send Report"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function RateListReportScreen({
  products,
  onBack,
  notify,
}: {
  products: Product[];
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const exportRows = products.map(p => ({
      "NAME": p.name,
      "ITEM CODE": p.sku,
      "MRP": p.mrp > 0 ? p.mrp : "Not set",
      "SELLING PRICE": p.sellingPrice,
    }));
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rate List");
    XLSX.writeFile(wb, `happy_bonding_rate_list_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Rate List exported to Excel successfully");
  };

  return (
    <div className="rate-list-screen printable-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Rate List</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Report favourites are not available yet")}>
            <Star size={14} /> Favourite
          </button>
        </div>

        <div className="header-actions" style={{ display: "flex", gap: 10 }}>
          <button type="button" className="secondary" disabled={!products.length} onClick={() => setEmailModalOpen(true)}>
            <Mail size={15} /> Email Excel
          </button>
          <button type="button" className="secondary" disabled={!products.length} onClick={exportToExcel}>
            <Download size={15} /> Download Excel ▾
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print PDF
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Total items: <strong>{products.length.toLocaleString("en-IN")}</strong>. Download and email include all items shown.</p>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>NAME</th>
                <th>ITEM CODE</th>
                <th className="right">MRP</th>
                <th className="right">SELLING PRICE</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td className="mono">{p.sku}</td>
                  <td className="right">{p.mrp > 0 ? money(p.mrp) : "Not set"}</td>
                  <td className="right"><strong>₹{p.sellingPrice}</strong></td>
                </tr>
              ))}
              {!products.length && <tr><td colSpan={4}>No items in this branch.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal
          reportName="Rate List"
          reportRows={exportRows}
          onClose={() => setEmailModalOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

export function StockSummaryReportScreen({
  products,
  onBack,
  notify,
}: {
  products: Product[];
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [stockDetail, setStockDetail] = useState<"value" | "quantity" | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category || "General"))), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => (categoryFilter === "All Categories" || (p.category || 'General') === categoryFilter) && matchesItemSearch(search, [p.name, p.sku, p.size])).sort((a,b) => (sort === 'low' ? a.stock-b.stock : sort === 'high' ? b.stock-a.stock : 0) || a.name.localeCompare(b.name));
  }, [products, categoryFilter, search, sort]);

  const totalStockVal = useMemo(() => filteredProducts.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0), [filteredProducts]);
  const totalStockQty = useMemo(() => filteredProducts.reduce((sum, p) => sum + p.stock, 0), [filteredProducts]);

  const exportRows = filteredProducts.map(p => ({
      "Item Name": p.name,
      "Size": p.size,
      "Item Code": p.sku,
      "Purchase Price": p.purchasePrice,
      "Selling Price": p.sellingPrice,
      "Available Stock (Pieces)": p.stock,
      "Stock Value (Selling Price)": p.sellingPrice * p.stock,
      "Stock Value (Purchase Price)": p.purchasePrice * p.stock,
    }));
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Summary");
    XLSX.writeFile(wb, `happy_bonding_stock_summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Stock Summary exported to Excel!");
  };

  return (
    <div className="report-screen-wrap printable-report low-stock-report">
      {stockDetail && <Modal title={stockDetail === "value" ? "Stock Value at Selling Price" : "Stock Quantity Breakdown"} onClose={() => setStockDetail(null)}>
        <div className="table-scroll"><table><thead><tr><th>Item</th><th>{stockDetail === "value" ? "Value" : "Quantity"}</th></tr></thead><tbody>
          {filteredProducts.map(p => <tr key={p.id}><td>{p.name}</td><td>{stockDetail === "value" ? money(p.sellingPrice * p.stock) : p.stock}</td></tr>)}
          {!filteredProducts.length && <tr><td colSpan={2}>No items in this category.</td></tr>}
        </tbody></table></div>
      </Modal>}
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Stock Summary</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Report favourites are not available yet")}>
            <Star size={14} /> Favourite
          </button>
        </div>

        <div className="header-actions" style={{ display: "flex", gap: 10 }}>
          <button type="button" className="secondary" onClick={() => setEmailModalOpen(true)}>
            <Mail size={15} /> Email Excel
          </button>
          <button type="button" className="secondary" onClick={exportToExcel}>
            <Download size={15} /> Download Excel ▾
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print PDF
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <button type="button" className="party-metric-box summary-action" onClick={() => setStockDetail("value")}>
          <span>Stock Value (Selling Price)</span>
          <strong style={{ color: totalStockVal < 0 ? "#dc2626" : "#0f172a" }}>
            ₹ {totalStockVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </strong>
        </button>
        <button type="button" className="party-metric-box summary-action" onClick={() => setStockDetail("quantity")}>
          <span>Available Stock (Pieces)</span>
          <strong>{totalStockQty}</strong>
        </button>
      </div>

      <div className="low-stock-summary-cards">
        <div><span>Total items / sizes</span><strong>{filteredProducts.length.toLocaleString('en-IN')}</strong></div>
        <div><span>Stock value (current purchase price)</span><strong>{money(filteredProducts.reduce((sum,p) => sum + p.stock*p.purchasePrice, 0))}</strong></div>
      </div>

      <div className="low-stock-filters">
        <SearchablePicker value={categoryFilter} onChange={setCategoryFilter} placeholder="Search Categories" emptyValue="All Categories" emptyLabel="All Categories" options={categories.map(c => ({ value: c, label: c }))} />

        <label>Search<input aria-label="Search stock summary" placeholder="Item / code / size" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Item name: A to Z</option><option value="low">Stock: Lowest first</option><option value="high">Stock: Highest first</option></select></label>
        <small style={{ color: "#64748b" }}>Current stock in this branch. Values use the current saved prices; purchase value is not historical accounting cost.</small>
      </div>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Size</th>
                <th>Item Code</th>
                <th className="right">Purchase Price</th>
                <th className="right">Selling Price</th>
                <th className="right">Available Stock (Pieces)</th>
                <th className="right">Stock Value (Selling Price)</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.size || "-"}</td>
                  <td>{p.sku}</td>
                  <td className="right">{money(p.purchasePrice)}</td>
                  <td className="right">{money(p.sellingPrice)}</td>
                  <td className="right">{p.stock} PCS</td>
                  <td className="right">{money(p.sellingPrice * p.stock)}</td>
                </tr>
              ))}
              {!filteredProducts.length && <tr><td colSpan={7}>No items match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal
          reportName="Stock Summary"
          reportRows={exportRows}
          onClose={() => setEmailModalOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

export function LowStockSummaryReportScreen({
  products,
  onBack,
  notify,
}: {
  products: Product[];
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sort, setSort] = useState('stock-asc');
  const categories = [...new Set(products.filter(p => p.stock < 10).map(p => p.category))].sort();
  const lowStockItems = useMemo(() => products.filter(p => {
    if (p.stock >= 10 || (category && p.category !== category)) return false;
    if (!matchesItemSearch(search, [p.name, p.sku, p.size])) return false;
    if (stockFilter === 'out') return p.stock <= 0;
    if (stockFilter === 'critical') return p.stock > 0 && p.stock <= 5;
    if (stockFilter === 'low') return p.stock > 5;
    return true;
  }).sort((a, b) => {
    const difference = sort === 'stock-desc' ? b.stock - a.stock : sort === 'value-desc' ? b.stock * b.sellingPrice - a.stock * a.sellingPrice : sort === 'name' ? 0 : a.stock - b.stock;
    return difference || a.name.localeCompare(b.name) || a.sku.localeCompare(b.sku);
  }), [products, category, stockFilter, search, sort]);
  const totalLowStockValue = useMemo(() => lowStockItems.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0), [lowStockItems]);

  const exportRows = lowStockItems.map(p => ({
      "ITEM NAME": p.name,
      "ITEM CODE": p.sku,
      "AVAILABLE STOCK (PIECES)": p.stock,
      "LOW STOCK THRESHOLD (PIECES)": 10,
      "STOCK VALUE (SELLING PRICE)": p.sellingPrice * p.stock,
    }));
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Low Stock Summary");
    XLSX.writeFile(wb, `happy_bonding_low_stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Low Stock Summary exported to Excel!");
  };

  return (
    <div className="report-screen-wrap printable-report low-stock-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Low Stock Summary</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Report favourites are not available yet")}>
            <Star size={14} /> Favourite
          </button>
        </div>

        <div className="header-actions" style={{ display: "flex", gap: 10 }}>
          <button type="button" className="secondary" onClick={() => setEmailModalOpen(true)}>
            <Mail size={15} /> Email Excel
          </button>
          <button type="button" className="secondary" onClick={exportToExcel}>
            <Download size={15} /> Download Excel ▾
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print PDF
          </button>
        </div>
      </div>

      <div className="low-stock-filters">
        <label>Search<input aria-label="Search low-stock items" placeholder="Item name / code / size" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label>Category<select aria-label="Low-stock category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c || 'Uncategorized'}</option>)}</select></label>
        <label>Stock level<select aria-label="Stock level" value={stockFilter} onChange={e => setStockFilter(e.target.value)}><option value="all">All low stock (below 10)</option><option value="out">Out of stock (0 or below)</option><option value="critical">Critical (above 0 to 5)</option><option value="low">Low (above 5, below 10)</option></select></label>
        <label>Sort by<select aria-label="Sort low-stock items" value={sort} onChange={e => setSort(e.target.value)}><option value="stock-asc">Stock: Lowest first</option><option value="stock-desc">Stock: Highest first</option><option value="value-desc">Stock value: Highest first</option><option value="name">Item name: A to Z</option></select></label>
        <button type="button" className="secondary" onClick={() => { setSearch(''); setCategory(''); setStockFilter('all'); setSort('stock-asc'); }}>Reset filters</button>
      </div>
      <div className="low-stock-summary-cards">
        <div><span>Total low-stock items</span><strong>{lowStockItems.length.toLocaleString('en-IN')}</strong><small>Filtered items; each item / size counts separately</small></div>
        <div><span>Total available pieces</span><strong>{lowStockItems.reduce((sum, p) => sum + p.stock, 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</strong></div>
        <div><span>Stock value (selling price)</span><strong>{money(totalLowStockValue)}</strong></div>
      </div>
      <p className="low-stock-explanation">Available stock is the quantity currently in store. Items below 10 pieces are listed here, including zero stock.</p>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ITEM NAME</th>
                <th>ITEM CODE</th>
                <th className="right">AVAILABLE STOCK (PIECES)</th>
                <th className="right">LOW STOCK THRESHOLD</th>
                <th className="right">STOCK VALUE (SELLING PRICE)</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.sku}</td>
                  <td className="right">{p.stock.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                  <td className="right">10</td>
                  <td className="right">{money(p.sellingPrice * p.stock)}</td>
                </tr>
              ))}
              {!lowStockItems.length && <tr><td colSpan={5}>No low-stock items match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal
          reportName="Low Stock Summary"
          reportRows={exportRows}
          onClose={() => setEmailModalOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

export function ItemSalesSummaryReportScreen(props: { products: Product[]; invoices: Invoice[]; onBack: () => void; notify: (message: string) => void }) {
  return <ItemSummary onBack={props.onBack} notify={props.notify} />;
}

export function SalesSummaryReportScreen({
  invoices,
  onBack,
  notify,
  initialDateSelection,
}: {
  invoices: Invoice[];
  initialDateSelection?: DateRangeSelection;
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(initialDateSelection?.filter || "All");
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>(initialDateSelection?.range || { from: "", to: "" });
  const [partyFilter, setPartyFilter] = useState("All Parties");
  const [statusFilter, setStatusFilter] = useState("All");

  const allRows = useMemo(() => {
    return invoices;
  }, [invoices]);

  const partiesList = useMemo(() => {
    return Array.from(new Set(allRows.map(r => r.party))).filter(Boolean);
  }, [allRows]);

  const filteredInvoices = useMemo(() => {
    return allRows.filter(r => {
      if (!isInvoiceInDateRange(r, dateFilter, customDateRange)) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (partyFilter !== "All Parties" && r.party !== partyFilter) return false;
      return true;
    });
  }, [allRows, dateFilter, customDateRange, statusFilter, partyFilter]);

  const totalSalesVal = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  }, [filteredInvoices]);

  const exportToExcel = () => {
    const data = filteredInvoices.map(r => ({
      "DATE": invoiceExcelDate(r),
      "TIME (IST)": invoiceTime(r),
      "INVOICE NO": r.number,
      "PARTY NAME": r.party,
      "DUE DATE": (r as any).dueDate || "-",
      "AMOUNT": r.amount,
      "BALANCE AMOUNT": r.amount - (r.paidAmount ?? r.amount),
      "INVOICE TYPE": "Sales Invoice",
      "INVOICE STATUS": r.status,
      "CREATED BY": "Saravana Kumar",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    for (let row = 2; row <= data.length + 1; row++) {
      if (ws[`A${row}`]?.t === "n") ws[`A${row}`].z = "dd/mm/yyyy";
    }
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Sales Summary");
    XLSX.writeFile(wb, `happy_bonding_sales_summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Sales Summary exported to Excel!");
  };

  return (
    <div className="printable-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Reports">
            <ArrowLeft size={18} />
          </button>
          <h1>Sales Summary - Staff wise</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Report favourites are not available yet")}>
            <Star size={14} /> Favourite
          </button>
        </div>

        <div className="header-actions" style={{ display: "flex", gap: 10 }}>
          <button type="button" className="secondary" onClick={() => setEmailModalOpen(true)}>
            <Mail size={15} /> Email Excel
          </button>
          <button type="button" className="secondary" onClick={exportToExcel}>
            <Download size={15} /> Download Excel ▾
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print PDF
          </button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", marginBottom: 16, width: "max-content", minWidth: 240 }}>
        <span style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Total Sales</span>
        <strong style={{ fontSize: 22, color: "#0f172a", fontFamily: "Manrope, sans-serif" }}>₹ {totalSalesVal.toLocaleString("en-IN")}</strong>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SearchablePicker value={partyFilter} onChange={setPartyFilter} placeholder="Search Party" emptyValue="All Parties" emptyLabel="All Parties" options={partiesList.map(p => ({ value: p, label: p }))} />
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
          <option>All Staff ▾</option>
        </select>
        <DateRangeFilter value={dateFilter} range={customDateRange} onChange={setDateFilter} onRangeChange={setCustomDateRange} />
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
          <option>Invoice Type ▾</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
          <option value="All">Invoice Status ▾</option>
          <option value="Paid">Paid</option>
          <option value="Partially paid">Partially paid</option>
          <option value="Unpaid">Unpaid</option>
        </select>
      </div>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No</th>
                <th>Party Name</th>
                <th>Due Date</th>
                <th className="right">Amount</th>
                <th className="right">Balance Amount</th>
                <th>Invoice Type</th>
                <th>Invoice Status</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td className="mono"><strong>{r.number}</strong></td>
                  <td><strong>{r.party}</strong></td>
                  <td>-</td>
                  <td className="right">₹ {r.amount.toLocaleString("en-IN")}</td>
                  <td className="right">₹ {(r.amount - (r.paidAmount ?? r.amount)).toLocaleString("en-IN")}</td>
                  <td>Sales Invoice</td>
                  <td>
                    <span className={r.status === "Paid" ? "status-pill-green" : "status-pill-red"}>{r.status}</span>
                  </td>
                  <td>Saravana Kumar</td>
                </tr>
              ))}
              {!filteredInvoices.length && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "60px 20px" }}>
                    <Search size={44} color="#cbd5e1" style={{ marginBottom: 12 }} />
                    <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>No transactions available to generate report</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal reportName="Sales Summary" onClose={() => setEmailModalOpen(false)} notify={notify} />
      )}
    </div>
  );
}

export function DayBookReportScreen({
  invoices,
  onBack,
  notify,
  initialDateSelection,
}: {
  invoices: Invoice[];
  initialDateSelection?: DateRangeSelection;
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(initialDateSelection?.filter || "All");
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>(initialDateSelection?.range || { from: "", to: "" });
  const filteredInvoices = useMemo(() => invoices.filter(row => isInvoiceInDateRange(row, dateFilter, customDateRange)), [invoices, dateFilter, customDateRange]);
  const netAmount = filteredInvoices.reduce((sum, r) => sum + r.amount, 0);

  const exportToExcel = () => {
    const data = filteredInvoices.map(r => ({
      "DATE": r.date,
      "PARTY NAME": r.party,
      "TRANSACTION TYPE": "Sales Invoice",
      "TRANSACTION NO.": r.number,
      "TOTAL AMOUNT": r.amount,
      "MONEY IN": r.amount,
      "MONEY OUT": 0,
      "BALANCE AMOUNT": 0,
      "CREATED BY": "Saravana Kumar",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daybook");
    XLSX.writeFile(wb, `happy_bonding_daybook_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Daybook exported to Excel!");
  };

  return (
    <div className="printable-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Sales Invoices">
            <ArrowLeft size={18} />
          </button>
          <h1>DayBook</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Report favourites are not available yet")}>
            <Star size={14} /> Favourite
          </button>
        </div>

        <div className="header-actions" style={{ display: "flex", gap: 10 }}>
          <button type="button" className="secondary" onClick={() => setEmailModalOpen(true)}>
            <Mail size={15} /> Email Excel
          </button>
          <button type="button" className="secondary" onClick={exportToExcel}>
            <Download size={15} /> Download Excel ▾
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print PDF
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}><option>All Staff ▾</option></select>
        <DateRangeFilter value={dateFilter} range={customDateRange} onChange={setDateFilter} onRangeChange={setCustomDateRange} />
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}><option>All Transactions ▾</option></select>
      </div>

      <div style={{ padding: "12px 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
        Net Amount: <span style={{ color: "#16a34a" }}>₹ {netAmount.toLocaleString("en-IN")}</span>
      </div>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>PARTY NAME</th>
                <th>TRANSACTION TYPE</th>
                <th>TRANSACTION NO.</th>
                <th className="right">TOTAL AMOUNT</th>
                <th className="right">MONEY IN</th>
                <th className="right">MONEY OUT</th>
                <th className="right">BALANCE AMOUNT</th>
                <th>CREATED BY</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td><strong>{r.party}</strong></td>
                  <td>Sales Invoice</td>
                  <td className="mono">{r.number}</td>
                  <td className="right">₹ {r.amount.toLocaleString("en-IN")}</td>
                  <td className="right" style={{ color: "#16a34a", fontWeight: 700 }}>₹ {r.amount.toLocaleString("en-IN")}</td>
                  <td className="right">₹ 0</td>
                  <td className="right">₹ 0</td>
                  <td>Saravana Kumar</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal reportName="Daybook" onClose={() => setEmailModalOpen(false)} notify={notify} />
      )}
    </div>
  );
}

export function BillWiseProfitReportScreen(props: { invoices: Invoice[]; onBack: () => void; notify: (message: string) => void; initialDateSelection?: DateRangeSelection }) {
  return <BackendReport report={backendReports['Bill-wise profit']} onBack={props.onBack} notify={props.notify} initialDateSelection={props.initialDateSelection} />;
}

export function Reports({
  products,
  invoices,
  notify,
  initialReport,
  initialDateSelection,
  onOpenInvoice,
}: {
  products: Product[];
  invoices: Invoice[];
  notify: (msg: string) => void;
  onOpenInvoice?: (id: string) => Promise<void>;
  initialReport?: string | null;
  initialDateSelection?: DateRangeSelection;
}) {
  const [activeReport, setActiveReport] = useState<string | null>(initialReport || null);
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (initialReport) {
      setActiveReport(initialReport);
    }
  }, [initialReport]);

  if (activeReport === 'Balance sheet') return <BalanceSummary onBack={() => setActiveReport(null)} />;
  if (activeReport && backendReports[activeReport]) return <BackendReport key={activeReport} report={backendReports[activeReport]} onOpenInvoice={onOpenInvoice} initialDateSelection={initialDateSelection} onBack={() => setActiveReport(null)} notify={notify} />;
  if (activeReport === 'Rate list') return <RateListReportScreen products={products} onBack={() => setActiveReport(null)} notify={notify} />;
  if (activeReport && !["Stock summary", "Stock valuation", "Low stock", "Sales summary", "Bill-wise profit", "Fast & slow moving", "DayBook"].includes(activeReport)) return <><div className="back-heading"><button type="button" className="icon-button" aria-label="Back" title="Back to Reports" onClick={() => setActiveReport(null)}><ArrowLeft size={18} /></button><h2>{activeReport}</h2></div><p>This report needs additional accounting or tax records that are not currently captured. It cannot be calculated reliably from sales invoices alone.</p></>;
  if (activeReport === "Stock summary" || activeReport === "Stock valuation") {
    return (
      <StockSummaryReportScreen
        products={products}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
  }

  if (activeReport === "Low stock") {
    return (
      <LowStockSummaryReportScreen
        products={products}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
  }

  if (
    activeReport === "Sales summary" ||
    activeReport === "Sales by staff" ||
    activeReport === "Sales returns" ||
    activeReport === "GSTR-1 sales"
  ) {
    return (
      <SalesSummaryReportScreen
        initialDateSelection={initialDateSelection}
        invoices={invoices}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
  }

  if (activeReport === "Bill-wise profit") {
    return (
      <BillWiseProfitReportScreen
        initialDateSelection={initialDateSelection}
        invoices={invoices}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
  }

  if (activeReport === "Fast & slow moving") {
    return <ItemSummary onBack={() => setActiveReport(null)} notify={notify} />;
  }

  if (
    activeReport === "DayBook" ||
    activeReport === "Cash & bank report" ||
    activeReport === "Party outstanding" ||
    activeReport === "GSTR-2 purchases" ||
    activeReport === "Profit & loss" ||
    activeReport === "Balance sheet" ||
    activeReport === "GSTR-3B summary" ||
    activeReport === "HSN-wise summary"
  ) {
    return (
      <DayBookReportScreen
        initialDateSelection={initialDateSelection}
        invoices={invoices}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
  }

  const filterTags = ["Party", "Category", "Payment Collection", "Item", "Invoice Details", "Summary"];

  const sections = [
    {
      col: 1,
      id: "favourite",
      title: "Favourite",
      icon: Sparkles,
      items: [
        { name: "Balance Sheet", targetKey: "Balance sheet", tags: ["Summary"], isFavourite: true },
        { name: "Bill Wise Profit", targetKey: "Bill-wise profit", tags: ["Summary", "Invoice Details"], isFavourite: true },
        { name: "Cash and Bank Report (All Payments)", targetKey: "Cash & bank report", tags: ["Payment Collection", "Transaction"], isFavourite: true },
        { name: "GSTR-1 (Sales)", targetKey: "GSTR-1 sales", tags: ["Invoice Details", "Summary"], isFavourite: true },
        { name: "Party Wise Outstanding", targetKey: "Party outstanding", tags: ["Party", "Category", "Payment Collection"], isFavourite: true },
        { name: "Profit And Loss Report", targetKey: "Profit & loss", tags: ["Summary"], isFavourite: true },
        { name: "Sales Summary - Staff Wise", targetKey: "Sales by staff", tags: ["Summary", "Invoice Details"], isFavourite: true },
      ],
    },
    {
      col: 1,
      id: "item",
      title: "Item",
      icon: Boxes,
      items: [
        { name: "Item Report By Party", targetKey: "Item by party", tags: ["Party", "Category", "Item"] },
        { name: "Item Sales and Purchase Summary", targetKey: "Fast & slow moving", tags: ["Category", "Item", "Summary"] },
        { name: "Low Stock Summary", targetKey: "Low stock", tags: ["Item"] },
        { name: "Rate List", targetKey: "Rate list", tags: ["Item"] },
        { name: "Stock Detail Report", targetKey: "Stock detail", tags: ["Item"] },
        { name: "Stock Summary", targetKey: "Stock summary", tags: ["Category", "Item", "Summary"] },
      ],
    },
    {
      col: 2,
      id: "gst",
      title: "GST",
      icon: Percent,
      items: [
        { name: "GSTR-2 (Purchase)", targetKey: "GSTR-2 purchases", tags: ["Invoice Details", "Summary"] },
        { name: "GSTR-3b", targetKey: "GSTR-3B summary", tags: ["Summary"] },
        { name: "GST Purchase (With HSN)", targetKey: "GST purchases", tags: ["Item", "Invoice Details"] },
        { name: "GST Sales (With HSN)", targetKey: "GST sales", tags: ["Item", "Invoice Details"] },
        { name: "HSN Wise Sales Summary", targetKey: "HSN-wise summary", tags: ["Item", "Summary"] },
        { name: "TDS Payable", targetKey: "TDS Payable", tags: ["Transaction"] },
        { name: "TDS Receivable", targetKey: "TDS Receivable", tags: ["Transaction"] },
        { name: "TCS Payable", targetKey: "TCS Payable", tags: ["Transaction"] },
        { name: "TCS Receivable", targetKey: "TCS Receivable", tags: ["Transaction"] },
      ],
    },
    {
      col: 2,
      id: "party",
      title: "Party",
      icon: Users,
      items: [
        { name: "Receivable Ageing Report", targetKey: "Receivable ageing", tags: ["Party", "Payment Collection"] },
        { name: "Party Report By Item", targetKey: "Party by item", tags: ["Party", "Item"] },
        { name: "Party Statement (Ledger)", targetKey: "Party ledger", tags: ["Party"] },
        { name: "Sales Summary - Category Wise", targetKey: "Category sales", tags: ["Party", "Category"] },
      ],
    },
    {
      col: 3,
      id: "transaction",
      title: "Transaction",
      icon: FileText,
      items: [
        { name: "Audit Trail", targetKey: "Audit trail", tags: ["Transaction"] },
        { name: "Daybook - Staff Wise", targetKey: "Daybook by staff", tags: ["Transaction", "Invoice Details"] },
        { name: "Expense Category Report", targetKey: "Expense categories", tags: ["Category", "Transaction"] },
        { name: "Expense Transaction Report", targetKey: "Expense transactions", tags: ["Category", "Transaction"] },
        { name: "Coupon Report", targetKey: "Coupon report", tags: ["Party", "Invoice Details", "Summary"] },
        { name: "Purchase Summary", targetKey: "Purchase summary", tags: ["Invoice Details", "Summary"] },
      ],
    },
  ];

  const renderSection = (sec: typeof sections[0]) => {
    const filteredItems = sec.items.filter(item => {
      const matchesTag = activeFilterTag ? item.tags.includes(activeFilterTag) : true;
      const matchesQuery = searchQuery.trim() ? matchesItemSearch(searchQuery, [item.name]) : true;
      return matchesTag && matchesQuery;
    });

    return (
      <div className="report-section-block" key={sec.id}>
        <div className="report-section-header">
          <sec.icon />
          <span>{sec.title}</span>
        </div>
        <div className="report-items-list">
          {filteredItems.length > 0 ? (
            filteredItems.map(x => (
              <button
                className="report-item-row"
                key={x.name}
                onClick={() => setActiveReport(x.targetKey)}
              >
                <span className="report-item-name">
                  {x.name}
                </span>
                {(x as any).isFavourite && <Star className="report-item-star" />}
              </button>
            ))
          ) : (
            <div className="no-reports-msg">No Reports Found</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeading title="Reports" subtitle="Accurate operational, GST and financial insights." />
      <div className="reports-hub-wrapper">
        <div className="reports-hub-topbar">
          <h1 className="reports-hub-title">Reports</h1>
          <button className="ca-reports-btn" onClick={() => notify("CA Reports Sharing is not available yet")}>
            <ShieldCheck size={16} /> CA Reports Sharing
          </button>
        </div>

        <div className="reports-filter-bar">
          <span className="filter-label">Filter By</span>
          {filterTags.map(tag => {
            const isActive = activeFilterTag === tag;
            return (
              <button
                key={tag}
                className={`filter-pill-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveFilterTag(isActive ? null : tag)}
              >
                {tag}
                {isActive && <span className="close-icon">✕</span>}
              </button>
            );
          })}
        </div>

        <div className="reports-3col-grid">
          <div className="reports-column">
            {sections.filter(s => s.col === 1).map(renderSection)}
          </div>
          <div className="reports-column">
            {sections.filter(s => s.col === 2).map(renderSection)}
          </div>
          <div className="reports-column">
            {sections.filter(s => s.col === 3).map(renderSection)}
          </div>
        </div>

        <div className="reports-bottom-bar">
          <div className="reports-search-box">
            <input
              placeholder="Find Report"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <kbd>Ctrl + F</kbd>
          </div>
        </div>
      </div>
    </>
  );
}
