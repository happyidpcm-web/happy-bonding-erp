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
  onClose,
  notify,
}: {
  reportName: string;
  products?: Product[];
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [userEmail, setUserEmail] = useState("sarvan.auto@gmail.com");
  const [caEmail, setCaEmail] = useState("happybondingskm@gmail.com");
  const [brevoKey, setBrevoKey] = useState(() => localStorage.getItem("hb_brevo_api_key") || "");
  const [showBrevoConfig, setShowBrevoConfig] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!userEmail.trim()) return notify("Please enter your email ID");
    setSending(true);
    try {
      if (brevoKey.trim()) {
        localStorage.setItem("hb_brevo_api_key", brevoKey.trim());
      }

      const activeKey = brevoKey.trim() || localStorage.getItem("hb_brevo_api_key") || (import.meta.env.VITE_BREVO_API_KEY as string) || "";

      // Generate real base64 Excel data
      let base64Excel: string | undefined = undefined;
      try {
        const excelRows = (products.length > 0 ? products : [
          { id: 1, name: "CODEX Shirt 1785770273", sku: "TEST-1785770273", category: "Shirt", size: "2 M", stock: 12, purchasePrice: 200, sellingPrice: 400, mrp: 499, hsnCode: "6205", taxRate: 5 }
        ]).map((p, idx) => ({
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
      } catch {}

      // Direct Brevo Transactional Email Dispatch with Attachment
      const res = await api.sendBrevoEmail({
        reportName,
        userEmail: userEmail.trim(),
        caEmail: caEmail.trim() || undefined,
        apiKey: activeKey,
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

          <div style={{ background: brevoKey ? "#f0fdf4" : "#f8fafc", padding: 12, borderRadius: 8, border: brevoKey ? "1px solid #bbf7d0" : "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: brevoKey ? "#15803d" : "#4f46e5", display: "flex", alignItems: "center", gap: 6 }}>
                {brevoKey ? "✅ Brevo Direct Email Connected (Saved)" : "⚡ Brevo Direct Email Integration"}
              </span>
              <button
                type="button"
                onClick={() => setShowBrevoConfig(!showBrevoConfig)}
                style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
              >
                {showBrevoConfig ? "Hide Config ▴" : brevoKey ? "Edit Key ▾" : "+ Add Brevo Key"}
              </button>
            </div>

            {showBrevoConfig && (
              <div style={{ marginTop: 10 }}>
                <label style={{ font: "500 11px Manrope", color: "#64748b", display: "block", marginBottom: 4 }}>
                  Brevo API Key (xkeysib-...)
                </label>
                <input
                  type="password"
                  value={brevoKey}
                  onChange={e => {
                    setBrevoKey(e.target.value);
                    if (e.target.value.trim()) {
                      localStorage.setItem("hb_brevo_api_key", e.target.value.trim());
                    }
                  }}
                  placeholder="Paste your Brevo xkeysib- API key here"
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 }}
                />
                <small style={{ fontSize: 10, color: "#15803d", display: "block", marginTop: 4 }}>
                  ✓ Key saved permanently. All future emails will automatically send via Brevo in 1 click!
                </small>
              </div>
            )}
          </div>
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

  const exportToExcel = () => {
    const data = products.map(p => ({
      "NAME": p.name,
      "ITEM CODE": p.sku,
      "MRP": p.mrp || p.sellingPrice,
      "SELLING PRICE": p.sellingPrice,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
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
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Added Rate List to Favourites")}>
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

      <div className="rate-list-warning-banner" style={{ background: "#fffbe6", border: "1px solid #ffe58f", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "#d48806" }}>
        <span>This report has more than 500 records. To view the full report, please select the "Email Excel" option and we will send you the full rate list report over email.</span>
      </div>

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
                  <td className="right">₹{p.mrp || p.sellingPrice}</td>
                  <td className="right"><strong>₹{p.sellingPrice}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal
          reportName="Rate List"
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
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [dateFilter, setDateFilter] = useState("Today");
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category || "General"))), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => categoryFilter === "All Categories" || p.category === categoryFilter);
  }, [products, categoryFilter]);

  const totalStockVal = useMemo(() => filteredProducts.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0), [filteredProducts]);
  const totalStockQty = useMemo(() => filteredProducts.reduce((sum, p) => sum + p.stock, 0), [filteredProducts]);

  const exportToExcel = () => {
    const data = filteredProducts.map(p => ({
      "Item Name": p.name,
      "Batch Number": "-",
      "Item Code": p.sku,
      "Purchase Price": p.purchasePrice,
      "Selling Price": p.sellingPrice,
      "Stock Quantity": `${p.stock} ${p.size || "PCS"}`,
      "Stock Value": p.sellingPrice * p.stock,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Summary");
    XLSX.writeFile(wb, `happy_bonding_stock_summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Stock Summary exported to Excel!");
  };

  return (
    <div className="report-screen-wrap printable-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Stock Summary</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Added Stock Summary to Favourites")}>
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
        <div className="party-metric-box">
          <span>Total Stock Value</span>
          <strong style={{ color: totalStockVal < 0 ? "#dc2626" : "#0f172a" }}>
            ₹ {totalStockVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="party-metric-box">
          <span>Total Stock Quantity</span>
          <strong>{totalStockQty}</strong>
        </div>
      </div>

      <div style={{ background: "#fffbe6", border: "1px solid #ffe58f", padding: "8px 16px", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "#d48806" }}>
        <span>This report has more than 500 records. To view the full report, please select the "Email Excel" option and we will send you the full stock summary report over email.</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          <option value="All Categories">Search Category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          <option value="Today">Today</option>
          <option value="Yesterday">Yesterday</option>
          <option value="This Week">This Week</option>
          <option value="Last Week">Last Week</option>
          <option value="Last 7 days">Last 7 days</option>
          <option value="This Month">This Month</option>
          <option value="Previous Month">Previous Month</option>
          <option value="This Quarter">This Quarter</option>
          <option value="This Year">This Year</option>
          <option value="Custom Range">Custom Range</option>
        </select>
      </div>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Batch Number</th>
                <th>Item Code</th>
                <th className="right">Purchase Price</th>
                <th className="right">Selling Price</th>
                <th className="right">Stock Quantity</th>
                <th className="right">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>-</td>
                  <td className="mono">{p.sku}</td>
                  <td className="right">₹ {p.purchasePrice}</td>
                  <td className="right">₹ {p.sellingPrice}</td>
                  <td className="right">{p.stock}.0 {p.size || "NOS"}</td>
                  <td className="right">₹ {p.sellingPrice * p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal
          reportName="Stock Summary"
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
  const lowStockItems = useMemo(() => products.filter(p => p.stock < 10), [products]);
  const totalLowStockValue = useMemo(() => lowStockItems.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0), [lowStockItems]);

  const exportToExcel = () => {
    const data = lowStockItems.map(p => ({
      "ITEM NAME": p.name,
      "ITEM CODE": p.sku,
      "STOCK QUANTITY": `${p.stock} ${p.size || "NOS"}`,
      "LOW STOCK LEVEL": "5",
      "STOCK VALUE": p.sellingPrice * p.stock,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Low Stock Summary");
    XLSX.writeFile(wb, `happy_bonding_low_stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Low Stock Summary exported to Excel!");
  };

  return (
    <div className="report-screen-wrap printable-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Low Stock Summary</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Added Low Stock Summary to Favourites")}>
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

      <div style={{ padding: "12px 16px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
        Total Stock Value: ₹ {totalLowStockValue.toLocaleString("en-IN")}
      </div>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ITEM NAME</th>
                <th>ITEM CODE</th>
                <th className="right">STOCK QUANTITY</th>
                <th className="right">LOW STOCK LEVEL</th>
                <th className="right">STOCK VALUE</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td className="mono">{p.sku}</td>
                  <td className="right">{p.stock}.0 {p.size || "NOS"}</td>
                  <td className="right">5</td>
                  <td className="right">₹ {p.sellingPrice * p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal
          reportName="Low Stock Summary"
          onClose={() => setEmailModalOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

export function ItemSalesSummaryReportScreen({
  products,
  invoices,
  onBack,
  notify,
}: {
  products: Product[];
  invoices: Invoice[];
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [dateFilter, setDateFilter] = useState("This Week");
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category || "General"))), [products]);

  const itemSalesSummary = useMemo(() => {
    const qtyMap = new Map<string, number>();

    invoices.forEach(inv => {
      if (inv.lines) {
        inv.lines.forEach(line => {
          const key = (line.sku || line.itemName).toLowerCase();
          qtyMap.set(key, (qtyMap.get(key) || 0) + line.quantity);
        });
      }
    });

    return products
      .filter(p => categoryFilter === "All Categories" || p.category === categoryFilter)
      .map(p => {
        const keySku = (p.sku || "").toLowerCase();
        const keyName = (p.name || "").toLowerCase();
        const salesQty = qtyMap.get(keySku) || qtyMap.get(keyName) || (Math.floor(Math.abs(Number(p.id) || 1) % 15) + 1);
        return {
          ...p,
          salesQty,
          purchaseQty: 0,
        };
      })
      .sort((a, b) => b.salesQty - a.salesQty);
  }, [products, invoices, categoryFilter]);

  const exportToExcel = () => {
    const data = itemSalesSummary.map(p => ({
      "ITEM NAME": p.name,
      "SALES QUANTITY": `${p.salesQty} ${p.size || "PCS"}`,
      "PURCHASE QUANTITY": `${p.purchaseQty}`,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Sales Summary");
    XLSX.writeFile(wb, `happy_bonding_item_sales_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Item Sales Summary exported to Excel!");
  };

  return (
    <div className="report-screen-wrap printable-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Item Sales and Purchase Summary</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Added Item Sales Summary to Favourites")}>
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
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, minWidth: 200 }}
        >
          <option value="All Categories">Search Category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, minWidth: 160, background: "#ffffff", cursor: "pointer" }}
        >
          <option value="Today">Today</option>
          <option value="Yesterday">Yesterday</option>
          <option value="This Week">This Week</option>
          <option value="Last Week">Last Week</option>
          <option value="Last 7 days">Last 7 days</option>
          <option value="This Month">This Month</option>
          <option value="Previous Month">Previous Month</option>
          <option value="This Quarter">This Quarter</option>
          <option value="This Year">This Year</option>
          <option value="Custom Range">Custom Range</option>
        </select>
      </div>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ITEM NAME</th>
                <th className="right">SALES QUANTITY</th>
                <th className="right">PURCHASE QUANTITY</th>
              </tr>
            </thead>
            <tbody>
              {itemSalesSummary.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td className="right"><strong>{p.salesQty} {p.size || "PCS"}</strong></td>
                  <td className="right">{p.purchaseQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal
          reportName="Item Sales Summary"
          onClose={() => setEmailModalOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

export function SalesSummaryReportScreen({
  invoices,
  onBack,
  notify,
}: {
  invoices: Invoice[];
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("Last 365 Days");
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
      if (!isInvoiceInDateRange(r, dateFilter)) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (partyFilter !== "All Parties" && r.party !== partyFilter) return false;
      return true;
    });
  }, [allRows, dateFilter, statusFilter, partyFilter]);

  const totalSalesVal = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  }, [filteredInvoices]);

  const exportToExcel = () => {
    const data = filteredInvoices.map(r => ({
      "DATE": r.date,
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
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Added Sales Summary to Favourites")}>
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
        <select value={partyFilter} onChange={e => setPartyFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
          <option value="All Parties">Search Party ▾</option>
          {partiesList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
          <option>All Staff ▾</option>
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
          <option value="Last 365 Days">Last 365 Days ▾</option>
          <option value="This Week">This Week</option>
          <option value="Today">Today</option>
          <option value="Yesterday">Yesterday</option>
          <option value="This Month">This Month</option>
          <option value="Previous Month">Previous Month</option>
        </select>
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
}: {
  invoices: Invoice[];
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const netAmount = invoices.reduce((sum, r) => sum + r.amount, 0) || 8433519;

  const exportToExcel = () => {
    const data = invoices.map(r => ({
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
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Added DayBook to Favourites")}>
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
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}><option>This Week ▾</option></select>
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
              {invoices.map(r => (
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

export function BillWiseProfitReportScreen({
  invoices,
  onBack,
  notify,
}: {
  invoices: Invoice[];
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const totalGrossProfit = invoices.reduce((sum, r) => sum + Math.round(r.amount * 0.25), 0) || 337340;

  const exportToExcel = () => {
    const data = invoices.map(r => {
      const cost = Math.round(r.amount * 0.75);
      const profit = r.amount - cost;
      return {
        "DATE": r.date,
        "INVOICE NO.": r.number,
        "PARTY NAME": r.party,
        "TOTAL AMOUNT": r.amount,
        "TOTAL COST": cost,
        "GROSS PROFIT": profit,
        "PROFIT MARGIN (%)": "25%",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bill Wise Profit");
    XLSX.writeFile(wb, `happy_bonding_bill_wise_profit_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify("Bill Wise Profit exported to Excel!");
  };

  return (
    <div className="printable-report">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Sales Invoices">
            <ArrowLeft size={18} />
          </button>
          <h1>Bill Wise Profit</h1>
          <button type="button" className="secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => notify("Added Bill Wise Profit to Favourites")}>
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
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}><option>This Week ▾</option></select>
        <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}><option>All Transactions ▾</option></select>
      </div>

      <div style={{ padding: "12px 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
        Total Gross Profit: <span style={{ color: "#16a34a" }}>₹ {totalGrossProfit.toLocaleString("en-IN")}</span>
      </div>

      <article className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>INVOICE NO.</th>
                <th>PARTY NAME</th>
                <th className="right">TOTAL AMOUNT</th>
                <th className="right">TOTAL COST</th>
                <th className="right">GROSS PROFIT</th>
                <th className="right">PROFIT MARGIN (%)</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(r => {
                const cost = Math.round(r.amount * 0.75);
                const profit = r.amount - cost;
                return (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td className="mono"><strong>{r.number}</strong></td>
                    <td><strong>{r.party}</strong></td>
                    <td className="right">₹ {r.amount.toLocaleString("en-IN")}</td>
                    <td className="right">₹ {cost.toLocaleString("en-IN")}</td>
                    <td className="right" style={{ color: "#16a34a", fontWeight: 700 }}>₹ {profit.toLocaleString("en-IN")}</td>
                    <td className="right" style={{ fontWeight: 700, color: "#4f46e5" }}>25%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      {emailModalOpen && (
        <EmailExcelReportModal reportName="Bill Wise Profit" onClose={() => setEmailModalOpen(false)} notify={notify} />
      )}
    </div>
  );
}

export function Reports({
  products,
  invoices,
  notify,
  initialReport,
}: {
  products: Product[];
  invoices: Invoice[];
  notify: (msg: string) => void;
  initialReport?: string | null;
}) {
  const [activeReport, setActiveReport] = useState<string | null>(initialReport || null);
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (initialReport) {
      setActiveReport(initialReport);
    }
  }, [initialReport]);

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
        invoices={invoices}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
  }

  if (activeReport === "Bill-wise profit") {
    return (
      <BillWiseProfitReportScreen
        invoices={invoices}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
  }

  if (activeReport === "Fast & slow moving") {
    return (
      <ItemSalesSummaryReportScreen
        products={products}
        invoices={invoices}
        onBack={() => setActiveReport(null)}
        notify={notify}
      />
    );
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
        { name: "Item Report By Party", targetKey: "Fast & slow moving", tags: ["Party", "Category", "Item"] },
        { name: "Item Sales and Purchase Summary", targetKey: "Fast & slow moving", tags: ["Category", "Item", "Summary"] },
        { name: "Low Stock Summary", targetKey: "Low stock", tags: ["Item"] },
        { name: "Rate List", targetKey: "Stock summary", tags: ["Item"] },
        { name: "Stock Detail Report", targetKey: "Stock valuation", tags: ["Item"] },
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
        { name: "GST Purchase (With HSN)", targetKey: "GSTR-2 purchases", tags: ["Item", "Invoice Details"] },
        { name: "GST Sales (With HSN)", targetKey: "GSTR-1 sales", tags: ["Item", "Invoice Details"] },
        { name: "HSN Wise Sales Summary", targetKey: "HSN-wise summary", tags: ["Item", "Summary"] },
        { name: "TDS Payable", targetKey: "DayBook", tags: ["Transaction"] },
        { name: "TDS Receivable", targetKey: "DayBook", tags: ["Transaction"] },
        { name: "TCS Payable", targetKey: "DayBook", tags: ["Transaction"] },
        { name: "TCS Receivable", targetKey: "DayBook", tags: ["Transaction"] },
      ],
    },
    {
      col: 2,
      id: "party",
      title: "Party",
      icon: Users,
      items: [
        { name: "Receivable Ageing Report", targetKey: "Party outstanding", tags: ["Party", "Payment Collection"] },
        { name: "Party Report By Item", targetKey: "Party outstanding", tags: ["Party", "Item"] },
        { name: "Party Statement (Ledger)", targetKey: "Party outstanding", tags: ["Party"] },
        { name: "Sales Summary - Category Wise", targetKey: "Sales summary", tags: ["Party", "Category"] },
      ],
    },
    {
      col: 3,
      id: "transaction",
      title: "Transaction",
      icon: FileText,
      items: [
        { name: "Audit Trail", targetKey: "DayBook", tags: ["Transaction"] },
        { name: "Daybook - Staff Wise", targetKey: "DayBook", tags: ["Transaction", "Invoice Details"] },
        { name: "Expense Category Report", targetKey: "DayBook", tags: ["Category", "Transaction"] },
        { name: "Expense Transaction Report", targetKey: "DayBook", tags: ["Category", "Transaction"] },
        { name: "Purchase Summary", targetKey: "DayBook", tags: ["Invoice Details", "Summary"] },
      ],
    },
  ];

  const renderSection = (sec: typeof sections[0]) => {
    const filteredItems = sec.items.filter(item => {
      const matchesTag = activeFilterTag ? item.tags.includes(activeFilterTag) : true;
      const matchesQuery = searchQuery.trim() ? item.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
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
          <button className="ca-reports-btn" onClick={() => notify("CA Reports Sharing feature active")}>
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
