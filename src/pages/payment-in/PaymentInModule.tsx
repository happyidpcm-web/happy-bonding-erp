import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  IndianRupee as CircleIndianRupee,
  Keyboard,
  LayoutDashboard,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings,
  Share2,
  Trash2,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../data";
import type { Invoice, Party } from "../../types";
import { downloadInvoicePdf } from "../../utils/pdf";
import {
  CustomDateRange,
  CustomDateRangePopover,
  customRangeLabel,
  isInvoiceInDateRange,
  Metric,
  Modal,
  PageHeading,
  REPORT_DATE_OPTIONS,
} from "../../App";

export interface PaymentInRecord {
  id: string;
  date: string;
  number: string;
  prefix: string;
  numOnly: string;
  partyName: string;
  partyPhone?: string;
  totalSettled: number;
  amountReceived: number;
  discount: number;
  mode: string;
  notes?: string;
  invoiceRef?: string;
  allocations?: Array<{ date: string; invoiceNumber: string; invoiceAmount: number; amountReceived: number; balanceAmount: number; discount: number; tds: number }>;
}

export type PaymentInApiRow = Awaited<ReturnType<typeof api.paymentIns>>[number];

export function paymentInRecordFromApi(row: PaymentInApiRow, fallbackIndex: number): PaymentInRecord {
  let meta: { paymentNumber?: string; prefix?: string; number?: string; partyName?: string; partyPhone?: string; discount?: number; notes?: string } = {};
  try {
    meta = row.reference ? JSON.parse(row.reference) : {};
  } catch {
    meta = { notes: row.reference || "" };
  }
  const allocation = row.allocations?.[0];
  const invoice = allocation?.salesInvoice;
  const party = invoice?.party;
  const amount = Number(row.amount || 0);
  const paidAt = new Date(row.paidAt);
  const date = paidAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const number = meta.paymentNumber || `HB/PI/26-27/${fallbackIndex}`;
  const numOnly = meta.number || number.split("/").pop() || String(fallbackIndex);
  const prefix = meta.prefix || number.replace(numOnly, "");
  const partyName = meta.partyName || party?.name || "Cash Sale";
  const discount = Number(meta.discount || 0);
  return {
    id: row.id,
    date,
    number,
    prefix,
    numOnly,
    partyName,
    partyPhone: meta.partyPhone || party?.phone || "",
    totalSettled: (row.allocations || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    amountReceived: amount,
    discount,
    mode: row.mode || "Cash",
    notes: meta.notes || "",
    invoiceRef: invoice?.invoiceNumber,
    allocations: (row.allocations || []).map(item => {
      const inv = item.salesInvoice;
      const invoiceAmount = Number(inv?.grandTotal || 0);
      const received = Number(item.amount || 0);
      const paid = Number(inv?.paidAmount || 0);
      return {
        date: inv?.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-",
        invoiceNumber: inv?.invoiceNumber || "-",
        invoiceAmount,
        amountReceived: received,
        balanceAmount: Math.max(0, invoiceAmount - paid),
        discount: 0,
        tds: 0,
      };
    }),
  };
}

export function amountPlain(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function sharePaymentInWhatsApp(record: PaymentInRecord) {
  const lines = [
    "Happy Bonding Men's Wear - Payment Receipt",
    `Payment In: ${record.number}`,
    `Party: ${record.partyName}`,
    `Date: ${record.date}`,
    `Amount Received: ${amountPlain(record.amountReceived)}`,
    `Discount: ${amountPlain(record.discount)}`,
    `Mode: ${record.mode}`,
    record.notes ? `Notes: ${record.notes}` : "",
  ].filter(Boolean);
  const digits = (record.partyPhone || "").replace(/\D/g, "");
  const targetPhone = digits.length === 10 ? `91${digits}` : digits.length > 10 ? digits : "";
  const url = targetPhone
    ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(lines.join("\n"))}`
    : `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank");
}

export function PaymentInReceiptTemplate({ record }: { record: PaymentInRecord }) {
  return (
    <div style={{ width: 794, minHeight: 1123, background: "#fff", color: "#0f172a", fontFamily: "Arial, sans-serif", padding: 44, boxSizing: "border-box" }}>
      <div style={{ borderBottom: "2px solid #111827", paddingBottom: 16, marginBottom: 22, display: "flex", justifyContent: "space-between", gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Happy Bonding Men's Wear</h1>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#475569" }}>Pavoorchatram</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Payment In</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700 }}>{record.number}</p>
        </div>
      </div>

      <section style={{ border: "1px solid #dbe3ef", borderRadius: 6, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ background: "#f8fafc", padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>Payment Details</div>
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", rowGap: 18, columnGap: 24, fontSize: 13 }}>
          <div><span style={{ display: "block", color: "#64748b", marginBottom: 6 }}>Party Name</span><strong>{record.partyName}</strong></div>
          <div><span style={{ display: "block", color: "#64748b", marginBottom: 6 }}>Payment Date</span><strong>{record.date}</strong></div>
          <div><span style={{ display: "block", color: "#64748b", marginBottom: 6 }}>Payment Mode</span><strong>{record.mode}</strong></div>
          <div><span style={{ display: "block", color: "#64748b", marginBottom: 6 }}>Amount Received</span><strong>{amountPlain(record.amountReceived)}</strong></div>
          <div><span style={{ display: "block", color: "#64748b", marginBottom: 6 }}>Payment In Discount</span><strong>{amountPlain(record.discount)}</strong></div>
          <div><span style={{ display: "block", color: "#64748b", marginBottom: 6 }}>Notes</span><strong>{record.notes || "--"}</strong></div>
        </div>
      </section>

      <section style={{ border: "1px solid #dbe3ef", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>Invoices settled with this payment</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {["Date", "Invoice Number", "Invoice Amount", "TDS", "Discount", "Amount Received", "Balance Amount"].map(head => (
                <th key={head} style={{ padding: "10px 8px", textAlign: head.includes("Amount") || head === "TDS" || head === "Discount" ? "right" : "left", borderTop: "1px solid #dbe3ef", borderBottom: "1px solid #dbe3ef" }}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(!record.allocations || record.allocations.length === 0) && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No invoices have been settled with this payment</td></tr>
            )}
            {(record.allocations || []).map((item, idx) => (
              <tr key={`${item.invoiceNumber}-${idx}`}>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>{item.date}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>{item.invoiceNumber}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>{amountPlain(item.invoiceAmount)}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>{amountPlain(item.tds)}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>{amountPlain(item.discount)}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>{amountPlain(item.amountReceived)}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>{amountPlain(item.balanceAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function PaymentInModule({
  parties,
  invoices = [],
  notify,
  onDataChanged,
  currentBranchId,
  initialSelectPartyId,
  onClearInitialPartyId,
}: {
  parties: Party[];
  invoices?: Invoice[];
  notify: (msg: string) => void;
  onDataChanged?: () => Promise<void> | void;
  currentBranchId?: string;
  initialSelectPartyId?: string | null;
  onClearInitialPartyId?: () => void;
}) {
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit" | "detail">("list");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PaymentInRecord | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [activeMenuId]);

  const [records, setRecords] = useState<PaymentInRecord[]>([]);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("Last 365 Days");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({ from: "2025-08-16", to: "2026-08-15" });
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceDateFilter, setInvoiceDateFilter] = useState("Last 365 Days");
  const [invoiceDateMenuOpen, setInvoiceDateMenuOpen] = useState(false);
  const [invoiceCustomDateRange, setInvoiceCustomDateRange] = useState<CustomDateRange>({ from: "2025-08-16", to: "2026-08-15" });

  const [editingRecord, setEditingRecord] = useState<PaymentInRecord | null>(null);
  const [partyInput, setPartyInput] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [dateInput, setDateInput] = useState("2026-08-10");
  const [modeInput, setModeInput] = useState("Cash");
  const [prefixInput, setPrefixInput] = useState("HB/PI/26-27/");
  const [numberInput, setNumberInput] = useState("1");
  const [notesInput, setNotesInput] = useState("");
  const [numberLoading, setNumberLoading] = useState(false);
  const paymentReceiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api.paymentIns().then(rows => {
      if (!alive) return;
      const mapped = rows.map((row, idx) => paymentInRecordFromApi(row, rows.length - idx));
      setRecords(mapped);
      localStorage.setItem("hb_payment_in_records", JSON.stringify(mapped));
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [currentBranchId]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!`${r.number} ${r.partyName} ${r.mode} ${r.notes}`.toLowerCase().includes(q)) return false;
      }
      if (!isInvoiceInDateRange(r, dateFilter, customDateRange)) return false;
      return true;
    });
  }, [records, query, dateFilter, customDateRange]);

  const partyInvoices = useMemo(() => {
    if (!partyInput) return [];
    const q = invoiceQuery.trim().toLowerCase();
    return invoices.filter(inv => {
      if (inv.party !== partyInput) return false;
      if (q && !`${inv.number} ${inv.party} ${inv.status}`.toLowerCase().includes(q)) return false;
      return isInvoiceInDateRange(inv, invoiceDateFilter, invoiceCustomDateRange);
    });
  }, [invoices, partyInput, invoiceQuery, invoiceDateFilter, invoiceCustomDateRange]);

  const settledInvoiceRows = partyInvoices.filter(inv => Math.max(0, inv.amount - (inv.paidAmount ?? 0)) > 0);

  const settledTotals = settledInvoiceRows.reduce((acc, inv) => acc + Math.max(0, inv.amount - (inv.paidAmount ?? 0)), 0);
  const selectedPartyBalance = invoices
    .filter(inv => inv.party === partyInput)
    .reduce((sum, inv) => sum + Math.max(0, inv.amount - (inv.paidAmount ?? 0)), 0);
  const partyMatches = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    return parties
      .filter(p => !q || `${p.name} ${p.phone}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [parties, partySearch]);

  useEffect(() => {
    if (viewMode === "list" || !partyInput || editingRecord) return;
    setAmountInput(String(settledTotals || ""));
  }, [settledTotals, partyInput, viewMode, editingRecord]);

  useEffect(() => {
    if (viewMode !== "create") return;
    let alive = true;
    setNumberLoading(true);
    api.nextPaymentInNumber(new Date(dateInput)).then(next => {
      if (!alive) return;
      setPrefixInput(next.prefix);
      setNumberInput(String(next.number));
    }).finally(() => {
      if (alive) setNumberLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [dateInput, viewMode]);

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setPartyInput("");
    setPartySearch("");
    setPartyDropdownOpen(false);
    setAmountInput("");
    setDiscountInput("0");
    setDateInput("2026-08-15");
    setModeInput("Cash");
    setNotesInput("");
    setViewMode("create");
    setNumberLoading(true);
    api.nextPaymentInNumber(new Date("2026-08-15")).then(next => {
      setPrefixInput(next.prefix);
      setNumberInput(String(next.number));
    }).finally(() => setNumberLoading(false));
  };

  const handleOpenEdit = (rec: PaymentInRecord) => {
    setEditingRecord(rec);
    setPartyInput(rec.partyName);
    setPartySearch(rec.partyName);
    setPartyDropdownOpen(false);
    setAmountInput(String(rec.amountReceived));
    setDiscountInput(String(rec.discount || 0));
    setDateInput(rec.date.includes("2026") ? "2026-02-21" : "2026-08-10");
    setModeInput(rec.mode || "Cash");
    setPrefixInput(rec.prefix || "HB/PI/25-26/");
    setNumberInput(rec.numOnly || "1");
    setNotesInput(rec.notes || "");
    setActiveMenuId(null);
    setViewMode("edit");
  };

  const handleDelete = (id: string) => {
    const next = records.filter(r => r.id !== id);
    setRecords(next);
    localStorage.setItem("hb_payment_in_records", JSON.stringify(next));
    setActiveMenuId(null);
    notify("Payment In entry deleted successfully");
  };

  const handleSave = async () => {
    if (!partyInput.trim()) {
      notify("Please select or enter a Party Name");
      return;
    }
    const amt = Number(amountInput) || 0;
    if (amt <= 0) {
      notify("Amount Received must be greater than zero");
      return;
    }
    const fullNum = `${prefixInput}${numberInput}`;

    if (viewMode === "edit" && editingRecord) {
      const updated: PaymentInRecord = {
        ...editingRecord,
        partyName: partyInput.trim(),
        amountReceived: amt,
        totalSettled: amt,
        discount: Number(discountInput) || 0,
        mode: modeInput,
        prefix: prefixInput,
        numOnly: numberInput,
        number: fullNum,
        notes: notesInput.trim(),
        date: new Date(dateInput).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      };
      const next = records.map(r => r.id === editingRecord.id ? updated : r);
      setRecords(next);
      localStorage.setItem("hb_payment_in_records", JSON.stringify(next));
      notify(`Payment In #${fullNum} updated successfully`);
    } else {
      const selectedParty = parties.find(p => p.name === partyInput);
      let remainingAllocation = Math.min(amt, settledTotals);
      const allocationsPayload = settledInvoiceRows.flatMap(inv => {
        if (remainingAllocation <= 0) return [];
        const invoiceBalance = Math.max(0, inv.amount - (inv.paidAmount ?? 0));
        const allocated = Math.min(invoiceBalance, remainingAllocation);
        remainingAllocation -= allocated;
        return [{ salesInvoiceId: inv.id, amount: allocated }];
      });
      const saved = await api.createPaymentIn({
        amount: amt,
        mode: modeInput,
        paidAt: new Date(dateInput),
        reference: notesInput.trim(),
        partyName: partyInput.trim(),
        partyPhone: selectedParty?.phone || "",
        paymentNumber: fullNum,
        prefix: prefixInput,
        number: numberInput,
        discount: Number(discountInput) || 0,
        allocations: allocationsPayload,
      });
      if (!saved) {
        notify("Payment In save failed. Please check API/database connection.");
        return;
      }
      const newRec = paymentInRecordFromApi(saved, Number(numberInput) || records.length + 1);
      const next = [newRec, ...records.filter(r => r.id !== newRec.id)];
      setRecords(next);
      localStorage.setItem("hb_payment_in_records", JSON.stringify(next));
      setQuery("");
      setDateFilter("Last 365 Days");
      setDateMenuOpen(false);
      setCustomDateRange({ from: "2025-08-16", to: "2026-08-15" });
      await onDataChanged?.();
      notify(`Payment In #${fullNum} saved successfully`);
    }
    setViewMode("list");
  };

  if (viewMode === "list") {
    return (
      <div className="payment-in-wrap" style={{ minHeight: "85vh", padding: "0 4px" }}>
        {/* Header Bar matching Image 1 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>Payment In</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }} title="Settings" onClick={() => notify("Payment In Settings opened")}>
              <Settings size={16} color="#475569" />
            </button>
            <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }} title="Toggle Layout">
              <LayoutDashboard size={16} color="#475569" />
            </button>
          </div>
        </div>

        {/* Subtab Bar matching Image 1 */}
        <div style={{ borderBottom: "1px solid #e2e8f0", marginBottom: 16, display: "flex", gap: 24 }}>
          <div style={{ borderBottom: "2px solid #4f46e5", paddingBottom: 8, color: "#4f46e5", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <CircleIndianRupee size={16} /> Payment Received
          </div>
        </div>

        {/* Filter Bar matching Image 1 */}
        <article className="card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", width: 220 }}>
                <Search size={15} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search..."
                  style={{ width: "100%", paddingLeft: 34, paddingRight: 10, height: 38, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff" }}
                />
              </div>
              <div style={{ position: "relative", width: 220 }}>
                <button
                  type="button"
                  onClick={() => setDateMenuOpen(open => !open)}
                  style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff", color: "#334155", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={15} color="#64748b" />
                    {dateFilter === "Custom Range" ? customRangeLabel(customDateRange) : dateFilter}
                  </span>
                  <ChevronDown size={14} color="#64748b" />
                </button>
                {dateMenuOpen && dateFilter !== "Custom Range" && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 260, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 12px 28px rgba(15,23,42,.14)", zIndex: 999, padding: 6 }}>
                    {REPORT_DATE_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          setDateFilter(opt.label);
                          if (opt.label === "Custom Range") return;
                          setDateMenuOpen(false);
                        }}
                        style={{ width: "100%", border: 0, background: dateFilter === opt.label ? "#eef2ff" : "transparent", color: dateFilter === opt.label ? "#4f46e5" : "#334155", padding: "8px 10px", borderRadius: 6, textAlign: "left", fontSize: 12, display: "grid", gap: 2 }}
                      >
                        <span>{opt.label}</span>
                        {opt.sub && <small style={{ color: "#94a3b8" }}>{opt.sub}</small>}
                      </button>
                    ))}
                  </div>
                )}
                {dateMenuOpen && dateFilter === "Custom Range" && (
                  <CustomDateRangePopover
                    range={customDateRange}
                    onCancel={() => setDateMenuOpen(false)}
                    onApply={range => {
                      setCustomDateRange(range);
                      setDateMenuOpen(false);
                    }}
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              className="primary-purple-btn"
              style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", font: "600 13px Manrope", cursor: "pointer" }}
              onClick={handleOpenCreate}
            >
              Create Payment In
            </button>
          </div>
        </article>

        {/* Table Card matching Image 1 & Image 3 */}
        <article className="card table-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "visible" }}>
          <div className="table-scroll" style={{ minHeight: 240, overflow: "visible" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Date ⇅</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Payment Number</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Party Name</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Amount Settled</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Received</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Payment Mode</th>
                  <th style={{ padding: "12px 16px", width: 50, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const isUpward = idx >= filtered.length - 2 || filtered.length <= 3;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setSelectedRecord(row);
                        setViewMode("detail");
                      }}
                      style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#1e293b", position: "relative", cursor: "pointer" }}
                    >
                      <td style={{ padding: "14px 16px", color: "#64748b" }}>{row.date}</td>
                      <td style={{ padding: "14px 16px" }} className="mono"><strong>{row.number}</strong></td>
                      <td style={{ padding: "14px 16px" }}><strong>{row.partyName}</strong></td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>₹ {row.totalSettled.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700 }}>₹ {row.amountReceived.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "14px 16px" }}>{row.mode}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", position: "relative" }}>
                        <button
                          type="button"
                          className="icon-button"
                          style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 6px", background: "#fff" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === row.id ? null : row.id);
                          }}
                        >
                          <MoreVertical size={15} color="#475569" />
                        </button>

                        {/* Image 3 Popover Menu - Smart Positioned */}
                        {activeMenuId === row.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 16,
                              top: isUpward ? "auto" : 36,
                              bottom: isUpward ? 36 : "auto",
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              borderRadius: 8,
                              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.18)",
                              zIndex: 999,
                              width: 130,
                              padding: "4px 0",
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                background: "transparent",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 13,
                                color: "#334155",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                              onClick={() => handleOpenEdit(row)}
                            >
                              <Pencil size={14} color="#475569" /> Edit
                            </button>
                            <button
                              type="button"
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                background: "transparent",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 13,
                                color: "#ef4444",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                              onClick={() => handleDelete(row.id)}
                            >
                              <Trash2 size={14} color="#ef4444" /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    );
  }

  if (viewMode === "detail" && selectedRecord) {
    const receiptFileName = `${selectedRecord.number.replace(/[/\\?%*:|"<>]/g, "-")}_payment_in_${selectedRecord.partyName.replace(/[^a-z0-9]+/gi, "_")}`;
    const handlePaymentDownload = async () => {
      if (!paymentReceiptRef.current) return;
      await downloadInvoicePdf(paymentReceiptRef.current, receiptFileName);
    };
    const handlePaymentPrint = async () => {
      if (!paymentReceiptRef.current) return;
      const printable = paymentReceiptRef.current.innerHTML;
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) return;
      win.document.write(`<html><head><title>${selectedRecord.number}</title></head><body style="margin:0">${printable}</body></html>`);
      win.document.close();
      win.focus();
      win.print();
    };
    return (
      <div style={{ background: "#fff", minHeight: "85vh", padding: "0 4px" }}>
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <div ref={paymentReceiptRef}>
            <PaymentInReceiptTemplate record={selectedRecord} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="icon-button" onClick={() => setViewMode("list")} title="Back">
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0f172a", margin: 0 }}>Payment In #{selectedRecord.number}</h1>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="secondary" onClick={() => handleOpenEdit(selectedRecord)}><Pencil size={15} /> Edit</button>
            <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1", color: "#ef4444" }} onClick={() => handleDelete(selectedRecord.id)}><Trash2 size={15} /></button>
            <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1" }}><Keyboard size={15} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
          <button type="button" className="secondary" onClick={handlePaymentDownload}><Download size={15} /> Download PDF</button>
          <button type="button" className="secondary" onClick={handlePaymentPrint}><Printer size={15} /> Print PDF</button>
          <button type="button" className="secondary"><CircleIndianRupee size={15} /></button>
          <button type="button" className="secondary" onClick={() => sharePaymentInWhatsApp(selectedRecord)}><Share2 size={15} /> Share <ChevronDown size={14} /></button>
        </div>

        <section style={{ border: "1px solid #dbe3ef", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ background: "#f8fafc", borderBottom: "1px solid #dbe3ef", padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#334155" }}>Payment Details</div>
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.2fr 1.2fr 1.2fr", gap: 24, fontSize: 13 }}>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Party Name</span><strong>{selectedRecord.partyName}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Payment Date</span><strong>{selectedRecord.date}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Amount Received</span><strong>{amountPlain(selectedRecord.amountReceived)}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Payment In Discount</span><strong>{amountPlain(selectedRecord.discount)}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Payment Mode</span><strong>{selectedRecord.mode}</strong></div>
            <div style={{ gridColumn: "1 / -1" }}><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Notes</span><strong>{selectedRecord.notes || "--"}</strong></div>
          </div>
        </section>

        <section style={{ border: "1px solid #dbe3ef", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#fff", borderBottom: "1px solid #dbe3ef", padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#334155" }}>Invoices settled with this payment</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#0f172a" }}>
                <th style={{ padding: "12px 14px", textAlign: "left" }}>Date</th>
                <th style={{ padding: "12px 14px", textAlign: "left" }}>Invoice Number</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Invoice Amount</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>TDS</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Discount</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Amount Received</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Balance Amount</th>
              </tr>
            </thead>
            <tbody>
              {(!selectedRecord.allocations || selectedRecord.allocations.length === 0) && (
                <tr>
                  <td colSpan={7} style={{ padding: "24px 14px", textAlign: "center", color: "#64748b" }}>No invoices have been settled with this payment</td>
                </tr>
              )}
              {(selectedRecord.allocations || []).map((item, idx) => (
                <tr key={`${item.invoiceNumber}-${idx}`}>
                  <td style={{ padding: "12px 14px" }}>{item.date}</td>
                  <td style={{ padding: "12px 14px" }}>{item.invoiceNumber}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>{amountPlain(item.invoiceAmount)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>{amountPlain(item.tds)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>{amountPlain(item.discount)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>{amountPlain(item.amountReceived)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>{amountPlain(item.balanceAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  return (
    <div className="printable-report" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, minHeight: "85vh" }}>
      {/* Top Header Bar matching Image 2 & Image 4 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={() => setViewMode("list")} title="Back to list">
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {viewMode === "edit" ? `Record Payment In #${prefixInput}${numberInput}` : `Record Payment In #${numberInput}`}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }} onClick={() => notify("Layout view toggled")}>
            <LayoutDashboard size={16} color="#475569" />
          </button>
          <button type="button" className="secondary" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => notify("Payment In Settings opened")}>
            <Settings size={15} /> Settings
          </button>
          <button type="button" className="secondary" onClick={() => setViewMode("list")}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-purple-btn"
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 24px", font: "600 13px Manrope", cursor: "pointer" }}
            onClick={handleSave}
          >
            {viewMode === "edit" ? "Save Changes" : "Save"}
          </button>
        </div>
      </div>

      {/* Top 2 Cards Block matching Image 2 & Image 4 */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, .9fr) minmax(560px, 1.2fr)", gap: 20, marginBottom: 24 }}>
        {/* Left Card */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Party Name</label>
            <div style={{ position: "relative" }}>
              <input
                value={partySearch}
                onFocus={() => setPartyDropdownOpen(true)}
                onChange={e => {
                  setPartySearch(e.target.value);
                  setPartyInput("");
                  setPartyDropdownOpen(true);
                }}
                placeholder="Search party by name or number"
                style={{ width: "100%", height: 38, padding: "0 34px 0 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, background: "#fff" }}
              />
              <ChevronDown size={15} color="#64748b" style={{ position: "absolute", right: 10, top: 12 }} />
              {partyDropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 260, overflow: "auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 12px 28px rgba(15,23,42,.14)", zIndex: 1000 }}>
                  {partyMatches.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPartyInput(p.name);
                        setPartySearch(`${p.name}${p.phone ? ` ${p.phone}` : ""}`);
                        setPartyDropdownOpen(false);
                      }}
                      style={{ width: "100%", border: 0, borderBottom: "1px solid #eef2f7", background: "#fff", padding: "10px 12px", textAlign: "left", display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "#1e293b" }}
                    >
                      <span><strong>{p.name}</strong><small style={{ display: "block", color: "#64748b", marginTop: 2 }}>{p.phone || "No mobile number"}</small></span>
                      <span style={{ color: "#475569", fontWeight: 700 }}>₹{p.balance.toLocaleString("en-IN")}</span>
                    </button>
                  ))}
                  {!partyMatches.length && <div style={{ padding: 14, textAlign: "center", color: "#64748b", fontSize: 12 }}>No party found in database</div>}
                </div>
              )}
            </div>
            <select
              value={partyInput}
              onChange={e => setPartyInput(e.target.value)}
              style={{ display: "none" }}
            >
              <option value="">Search party by name or number ▾</option>
              {parties.map(p => (
                <option key={p.id} value={p.name}>
                  {p.name} {p.phone ? `(${p.phone})` : ""}
                </option>
              ))}
            </select>
            {partyInput && <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>Current Balance: ₹{selectedPartyBalance.toLocaleString("en-IN")}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Amount Received</label>
              <input
                type="number"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="0"
                style={{ width: "100%", height: 38, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Payment In Discount ℹ️</label>
              <input
                type="number"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                placeholder="0"
                style={{ width: "100%", height: 38, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff" }}
              />
            </div>
          </div>
        </div>

        {/* Right Card */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fafafa", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Payment Date</label>
              <input
                type="date"
                value={dateInput}
                onChange={e => setDateInput(e.target.value)}
                style={{ width: "100%", height: 38, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, background: "#fff" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Payment Mode</label>
              <select
                value={modeInput}
                onChange={e => setModeInput(e.target.value)}
                style={{ width: "100%", height: 38, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, background: "#fff" }}
              >
                <option value="Cash">Cash ▾</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Payment In Prefix</label>
              <input
                value={prefixInput}
                readOnly
                style={{ width: "100%", height: 38, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, background: "#f8fafc" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Payment In Number</label>
              <input
                value={numberInput}
                readOnly
                placeholder={numberLoading ? "..." : "1"}
                style={{ width: "100%", height: 38, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, background: "#f8fafc" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Notes</label>
            <input
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              placeholder="Enter Notes"
              style={{ width: "100%", height: 38, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, background: "#fff" }}
            />
          </div>
        </div>
      </div>

      {/* Below Cards: Empty State (Image 2) OR Settled Invoices Table (Image 4) */}
      {!partyInput ? (
        /* Image 2 Empty State */
        <div style={{ textAlign: "center", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileSpreadsheet size={40} color="#94a3b8" />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>No party selected!</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 16px" }}>Select Party Name to view transactions</p>
          </div>
          <button
            type="button"
            className="primary-purple-btn"
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", font: "600 13px Manrope", cursor: "pointer" }}
            onClick={() => {
              if (parties.length > 0) setPartyInput(parties[0].name);
            }}
          >
            Select Party
          </button>
        </div>
      ) : (
        /* Image 4 Settled Invoices Section */
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#ffffff", padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Settle invoices with this payment</h3>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ background: "#eff6ff", color: "#2563eb", padding: "4px 10px", borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
                1 Invoice Selected ✕
              </span>
              <div style={{ position: "relative", width: 160 }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={invoiceQuery}
                  onChange={e => setInvoiceQuery(e.target.value)}
                  placeholder="Search..."
                  style={{ width: "100%", paddingLeft: 28, height: 32, border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }}
                />
              </div>
              <div style={{ position: "relative", width: 190 }}>
                <button
                  type="button"
                  onClick={() => setInvoiceDateMenuOpen(open => !open)}
                  style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, color: "#334155", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {invoiceDateFilter === "Custom Range" ? customRangeLabel(invoiceCustomDateRange) : invoiceDateFilter}
                  </span>
                  <ChevronDown size={13} color="#64748b" />
                </button>
                {invoiceDateMenuOpen && invoiceDateFilter !== "Custom Range" && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 260, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 12px 28px rgba(15,23,42,.14)", zIndex: 999, padding: 6 }}>
                    {REPORT_DATE_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          setInvoiceDateFilter(opt.label);
                          if (opt.label === "Custom Range") return;
                          setInvoiceDateMenuOpen(false);
                        }}
                        style={{ width: "100%", border: 0, background: invoiceDateFilter === opt.label ? "#eef2ff" : "transparent", color: invoiceDateFilter === opt.label ? "#4f46e5" : "#334155", padding: "8px 10px", borderRadius: 6, textAlign: "left", fontSize: 12, display: "grid", gap: 2 }}
                      >
                        <span>{opt.label}</span>
                        {opt.sub && <small style={{ color: "#94a3b8" }}>{opt.sub}</small>}
                      </button>
                    ))}
                  </div>
                )}
                {invoiceDateMenuOpen && invoiceDateFilter === "Custom Range" && (
                  <CustomDateRangePopover
                    range={invoiceCustomDateRange}
                    onCancel={() => setInvoiceDateMenuOpen(false)}
                    onApply={range => {
                      setInvoiceCustomDateRange(range);
                      setInvoiceDateMenuOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                <th style={{ padding: "12px 16px", width: 40, textAlign: "center" }}>
                  <input type="checkbox" defaultChecked />
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Date ⇅</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Due Date ⇅</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Invoice #</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Invoice Amount</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Discount</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Received</th>
              </tr>
            </thead>
            <tbody>
              {settledInvoiceRows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    No backend invoices found for this party and date range
                  </td>
                </tr>
              )}
              {settledInvoiceRows.map(inv => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#1e293b" }}>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <input type="checkbox" defaultChecked />
                  </td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>{inv.date}</td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>-</td>
                  <td style={{ padding: "14px 16px" }} className="mono"><strong>{inv.number}</strong></td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>₹ {inv.amount.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "14px 16px", textAlign: "right", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>Apply Discount</td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700 }}>₹ {inv.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
              <tr style={{ background: "#f8fafc", fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                <td colSpan={4} style={{ padding: "12px 16px" }}>Total</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>₹ {settledTotals.toLocaleString("en-IN")}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>₹ {settledTotals.toLocaleString("en-IN")}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>₹ 0</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>₹ {settledTotals.toLocaleString("en-IN")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
