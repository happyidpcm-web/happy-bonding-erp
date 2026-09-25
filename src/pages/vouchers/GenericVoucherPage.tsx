import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Banknote,
  Boxes,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  IndianRupee as CircleIndianRupee,
  Keyboard,
  LayoutDashboard,
  MoreVertical,
  PackagePlus,
  Pencil,
  Percent,
  Plus,
  Printer,
  QrCode,
  Receipt,
  ReceiptIndianRupee,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  UserRoundPlus,
  Users,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { api } from "../../api";
import { money } from "../../data";
import type { Invoice, InvoiceSetting, Party, Product, VoucherRecord } from "../../types";
import { downloadInvoicePdf } from "../../utils/pdf";
import { BillOfSupplyTemplate } from "../../components/BillOfSupplyTemplate";
import {
  AddItemModal,
  CustomDateRange,
  CustomDateRangePopover,
  customRangeLabel,
  defaultInvoiceSetting,
  defaultSignatureUrl,
  EmptyState,
  isInvoiceInDateRange,
  Metric,
  Modal,
  PageHeading,
  REPORT_DATE_OPTIONS,
  shareWhatsAppInvoice,
} from "../../App";

export function CreateQuotationScreen({
  title,
  type,
  parties,
  products = [],
  invoices = [],
  vouchers = [],
  onBack,
  onSave,
  onProductsChanged,
  notify,
}: {
  title: string;
  type: string;
  parties: Party[];
  products?: Product[];
  invoices?: Invoice[];
  vouchers?: VoucherRecord[];
  onBack: () => void;
  onSave: (rec: VoucherRecord) => Promise<void>;
  onProductsChanged?: (rows: Product[]) => void;
  notify: (msg: string) => void;
}) {
  const [selectedParty, setSelectedParty] = useState<Party | undefined>(undefined);
  const [customPartyName, setCustomPartyName] = useState("");
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);

  const code = type === "Sales Return" ? "SR" : type === "Credit Note" ? "CN" : type === "Delivery Challan" ? "DC" : type === "Proforma Invoice" ? "PF" : type === "Quotation" ? "QUO" : type.toUpperCase().replace(/\s+/g, "").slice(0, 2);
  const [prefix, setPrefix] = useState(`HB/${code}/26-27/`);
  const [number, setNumber] = useState("1");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validDays, setValidDays] = useState(30);
  const [validityDate, setValidityDate] = useState("09 Sep 2026");
  const [linkedInvoice, setLinkedInvoice] = useState("");

  const [lines, setLines] = useState<Array<{ id: string; variantId: string | number; name: string; hsn: string; mrp: number; qty: number; price: number; discount: number; tax: number; amount: number }>>([]);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");

  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [terms, setTerms] = useState("NO REFUND ONCE SOLD... EXCHANGE ONLY AS PER STORE POLICY.");
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string>(() => "");
  const [signatoryName, setSignatoryName] = useState<string>(() => "");

  // Fetch official digital signature from PostgreSQL backend database on component mount
  useEffect(() => {
    api.invoiceSetting().then(stg => {
      if (stg && stg.signatureUrl) {
        setSignatureUrl(stg.signatureUrl);
        localStorage.setItem("hb_digital_signature", stg.signatureUrl);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const next = Math.max(0, ...vouchers.map(v => Number(v.number.split("/").pop()) || 0)) + 1;
    setNumber(String(next));
  }, [type, vouchers]);

  const [autoRoundOff, setAutoRoundOff] = useState(type === "Quotation" ? false : true);

  const [markFullyPaid, setMarkFullyPaid] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.amount, 0), [lines]);
  const taxableAmount = subtotal;
  const netAmount = Math.max(0, taxableAmount + Number(additionalCharges) - Number(overallDiscount));
  const finalTotal = autoRoundOff ? Math.round(netAmount) : netAmount;

  const handleSaveQuotation = async (keepNew = false) => {
    const partyName = selectedParty ? selectedParty.name : customPartyName.trim();
    if (!partyName) {
      notify("Please select or add a Party");
      return;
    }
    if (type === "Purchase Invoice" && lines.length === 0) {
      notify("Please add at least one item to update stock");
      return;
    }
    const fullNumber = type === "Quotation" ? number : `${prefix}${number}`;
    const newRecord: VoucherRecord = {
      id: String(Date.now()),
      date: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      number: fullNumber,
      party: partyName,
      dueIn: `${validDays} Days`,
      amount: finalTotal,
      status: "Open",
      notes: notes || `${type} created in ERP`,
      items: lines.map(line => ({ variantId: String(line.variantId), name: line.name, hsn: line.hsn, qty: line.qty, price: line.price, amount: line.amount })),
    };
    try {
      await onSave(newRecord);
      if (type === "Purchase Invoice" && onProductsChanged) onProductsChanged(await api.products());
    } catch (error) {
      notify(error instanceof Error ? error.message : "Voucher save failed");
      return;
    }
    notify(type === "Purchase Invoice" ? `${type} ${fullNumber} saved and stock added` : `${type} ${fullNumber} created successfully`);
    if (keepNew) {
      setLines([]);
      setSelectedParty(undefined);
      setCustomPartyName("");
      setNumber(n => String(Number(n) + 1));
    } else {
      onBack();
    }
  };

  const addItemToQuotation = (prod: Product) => {
    const price = type === "Purchase Invoice" ? prod.purchasePrice : prod.sellingPrice;
    const amount = price * 1;
    const newRow = {
      id: String(Date.now()) + Math.random(),
      variantId: prod.id,
      name: prod.name,
      hsn: prod.hsnCode || "6205",
      mrp: prod.mrp || price,
      qty: 1,
      price,
      discount: 0,
      tax: 5,
      amount,
    };
    setLines([...lines, newRow]);
    setItemSearchOpen(false);
    setItemQuery("");
  };

  const matchedProducts = itemQuery ? products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(itemQuery.toLowerCase())) : products.slice(0, 8);

  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partyQuery, setPartyQuery] = useState("");

  const matchedParties = useMemo(() => {
    if (!partyQuery.trim()) return parties;
    const q = partyQuery.toLowerCase();
    return parties.filter(p => p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q)));
  }, [parties, partyQuery]);

  return (
    <div className="printable-report" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, minHeight: "85vh" }}>
      {/* Top Header Bar matching Reference Image */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to list">
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>Create {type}</h1>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }} onClick={() => notify("Layout view toggled")}>
            <LayoutDashboard size={16} color="#475569" />
          </button>
          <button type="button" className="secondary" style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }} onClick={() => setQuickSettingsOpen(true)}>
            <Settings size={15} /> Settings
            <span style={{ position: "absolute", top: 4, right: 6, width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
          </button>
          <button type="button" className="secondary" onClick={() => handleSaveQuotation(true)}>
            Save & New
          </button>
          <button type="button" className="primary-purple-btn" style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 24px", font: "600 13px Manrope", cursor: "pointer" }} onClick={() => handleSaveQuotation(false)}>
            Save
          </button>
        </div>
      </div>

      {/* Top Split Block: Party Selector (Left) & Quotation Meta Card (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 }}>
        {/* Bill To Container with Fast Live Searchable Dropdown for 10,170 Database Customers */}
        <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 14, background: "#fafafa", minHeight: 120, position: "relative" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Bill To</span>
          {selectedParty ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div>
                <strong style={{ fontSize: 14, color: "#0f172a" }}>{selectedParty.name}</strong>
                {selectedParty.phone && <span style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 2 }}>Mobile: {selectedParty.phone}</span>}
                {selectedParty.address && <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>{selectedParty.address}</span>}
              </div>
              <button type="button" className="secondary compact" onClick={() => setSelectedParty(undefined)}>Change Party</button>
            </div>
          ) : customPartyName ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <strong style={{ fontSize: 14, color: "#0f172a" }}>{customPartyName}</strong>
              <button type="button" className="secondary compact" onClick={() => setCustomPartyName("")}>Change</button>
            </div>
          ) : (
            <div style={{ position: "relative", width: 280 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Type name or phone number..."
                  value={partyQuery}
                  onChange={e => {
                    setPartyQuery(e.target.value);
                    setPartyDropdownOpen(true);
                  }}
                  onFocus={() => setPartyDropdownOpen(true)}
                  style={{ width: "100%", height: 38, paddingLeft: 30, paddingRight: 8, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff" }}
                />
              </div>

              {/* Live Search Popup for 10,170 PostgreSQL Parties */}
              {partyDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 42,
                    left: 0,
                    width: 320,
                    maxHeight: 240,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.18)",
                    zIndex: 9999,
                    overflowY: "auto",
                    padding: 6
                  }}
                >
                  <div style={{ fontSize: 11, color: "#64748b", padding: "4px 8px", borderBottom: "1px solid #f1f5f9", marginBottom: 4, fontWeight: 600 }}>
                    PostgreSQL DB ({parties.length.toLocaleString()} Customers)
                  </div>
                  {matchedParties.map(p => (
                    <div
                      key={p.id}
                      style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", fontSize: 12, marginBottom: 4 }}
                      onClick={() => {
                        setSelectedParty(p);
                        setPartyDropdownOpen(false);
                        setPartyQuery("");
                      }}
                    >
                      <div>
                        <strong style={{ color: "#0f172a", display: "block" }}>{p.name}</strong>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{p.phone || "No phone"}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>Select ↵</span>
                    </div>
                  ))}
                  {matchedParties.length === 0 && (
                    <div style={{ padding: 12, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                      No matching customer found in DB.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quotation / Voucher Details Card matching Sales Invoice Design Layout */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 2 }}>
                {type === "Quotation" ? "Quotation Prefix" : "Invoice Prefix"}
              </label>
              <input value={prefix} onChange={e => setPrefix(e.target.value)} style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 2 }}>
                {type === "Quotation" ? "Quotation Number" : "Invoice Number"}
              </label>
              <input value={number} onChange={e => setNumber(e.target.value)} style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 2 }}>
              {type === "Delivery Challan" ? "Challan Date:" : `${type} Date:`}
            </label>
            <input type="date" defaultValue="2026-08-11" onChange={e => setDate(e.target.value)} style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
          </div>

          {type === "Sales Return" || type === "Credit Note" ? (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 2 }}>Link to Invoice:</label>
              <select
                value={linkedInvoice}
                onChange={e => setLinkedInvoice(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, background: "#fff" }}
              >
                <option value="">🔍 Search invoices ▾</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.number}>
                    {inv.number} - {inv.party} (₹ {inv.amount})
                  </option>
                ))}
              </select>
            </div>
          ) : type === "Delivery Challan" ? null : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 2 }}>
                  {type === "Proforma Invoice" ? "Payment Terms:" : "Valid For (Days)"}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="number" value={validDays} onChange={e => setValidDays(Number(e.target.value))} style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
                  {type === "Proforma Invoice" && <span style={{ fontSize: 11, color: "#64748b" }}>days</span>}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 2 }}>
                  {type === "Proforma Invoice" ? "Expiry Date:" : "Validity Date"}
                </label>
                <input type="date" defaultValue="2026-09-10" onChange={e => setValidityDate(e.target.value)} style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items Table matching Reference Image */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
              <th style={{ padding: "10px 12px", width: 40 }}>NO</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>ITEMS / SERVICES</th>
              <th style={{ padding: "10px 12px", width: 90 }}>HSN / SAC</th>
              <th style={{ padding: "10px 12px", width: 80, textAlign: "right" }}>MRP ℹ️</th>
              <th style={{ padding: "10px 12px", width: 70, textAlign: "center" }}>QTY</th>
              <th style={{ padding: "10px 12px", width: 110, textAlign: "right" }}>PRICE/ITEM (₹)</th>
              <th style={{ padding: "10px 12px", width: 90, textAlign: "right" }}>DISCOUNT</th>
              <th style={{ padding: "10px 12px", width: 70, textAlign: "right" }}>TAX</th>
              <th style={{ padding: "10px 12px", width: 110, textAlign: "right" }}>AMOUNT (₹)</th>
              <th style={{ padding: "10px 12px", width: 40, textAlign: "center" }}>
                <button type="button" style={{ background: "#cbd5e1", color: "#475569", border: "none", width: 20, height: 20, borderRadius: "50%", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }} onClick={() => setItemSearchOpen(true)}>
                  <Plus size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                <td style={{ padding: "10px 12px" }}><strong>{line.name}</strong></td>
                <td style={{ padding: "10px 12px", color: "#64748b" }}>{line.hsn}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>₹ {line.mrp}</td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  <input
                    type="number"
                    value={line.qty}
                    onChange={e => {
                      const q = Math.max(1, Number(e.target.value));
                      setLines(lines.map(l => l.id === line.id ? { ...l, qty: q, amount: q * l.price - l.discount } : l));
                    }}
                    style={{ width: 50, height: 28, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 4 }}
                  />
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>₹ {line.price}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>₹ {line.discount}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{line.tax}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>₹ {line.amount.toLocaleString("en-IN")}</td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  <button type="button" className="remove" onClick={() => setLines(lines.filter(l => l.id !== line.id))}><X size={14} /></button>
                </td>
              </tr>
            ))}
            {!lines.length && (
              <tr>
                <td colSpan={10} style={{ padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, alignItems: "center" }}>
                    <button
                      type="button"
                      style={{ height: 44, border: "1px dashed #60a5fa", background: "#ffffff", borderRadius: 8, padding: "0 20px", color: "#2563eb", font: "600 13px Manrope", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      onClick={() => setItemSearchOpen(true)}
                    >
                      <Plus size={16} /> Add Item
                    </button>
                    <div style={{ height: 44, border: "1px solid #cbd5e1", borderRadius: 8, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#ffffff", cursor: "pointer" }} onClick={() => notify("Barcode scanner ready")}>
                      <QrCode size={18} color="#475569" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Scan Barcode</span>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ background: "#f8fafc", padding: "10px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 30, fontSize: 13, fontWeight: 700, color: "#334155" }}>
          <span>SUBTOTAL: ₹ {subtotal.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Bottom Split Layout: Terms/Notes (Left) & Calculations (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 30 }}>
        {/* Left Side Links & Terms */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button type="button" style={{ background: "none", border: "none", color: "#2563eb", font: "600 13px Manrope", cursor: "pointer", textAlign: "left", width: "max-content" }} onClick={() => setShowNotes(!showNotes)}>
            + Add Notes
          </button>
          {showNotes && (
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={`Enter ${type} notes...`} style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }} />
          )}

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Terms and Conditions</label>
              <XCircle size={15} color="#94a3b8" style={{ cursor: "pointer" }} onClick={() => setTerms("")} />
            </div>
            <textarea
              value={terms}
              onChange={e => setTerms(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, color: "#334155" }}
            />
          </div>

          <button type="button" style={{ background: "none", border: "none", color: "#2563eb", font: "600 13px Manrope", cursor: "pointer", textAlign: "left", width: "max-content" }} onClick={() => notify(`Bank details attached to ${type}`)}>
            + Add Bank Account
          </button>
          <button type="button" style={{ background: "none", border: "none", color: "#2563eb", font: "600 13px Manrope", cursor: "pointer", textAlign: "left", width: "max-content" }} onClick={() => notify(`Payment QR code attached to ${type}`)}>
            + Add Payment QR
          </button>
        </div>

        {/* Right Side Calculation & Signature */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: "1px solid #f1f5f9", paddingLeft: 20 }}>
          {showAdditionalCharges ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
              <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Additional Charges:</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>₹</span>
              <input
                type="number"
                value={additionalCharges}
                onChange={e => setAdditionalCharges(Number(e.target.value))}
                style={{ width: 90, height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", background: "#fff" }}
              />
              <X size={14} color="#94a3b8" style={{ cursor: "pointer" }} onClick={() => { setShowAdditionalCharges(false); setAdditionalCharges(0); }} />
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
              <button type="button" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0, font: "600 13px Manrope" }} onClick={() => setShowAdditionalCharges(true)}>
                + Add Additional Charges
              </button>
              <span>₹ {additionalCharges}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
            <span>Taxable Amount</span>
            <span>₹ {taxableAmount.toLocaleString("en-IN")}</span>
          </div>

          {showDiscount ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
              <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Discount Amount:</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>₹</span>
              <input
                type="number"
                value={overallDiscount}
                onChange={e => setOverallDiscount(Number(e.target.value))}
                style={{ width: 90, height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", background: "#fff" }}
              />
              <X size={14} color="#94a3b8" style={{ cursor: "pointer" }} onClick={() => { setShowDiscount(false); setOverallDiscount(0); }} />
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
              <button type="button" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0, font: "600 13px Manrope" }} onClick={() => setShowDiscount(true)}>
                + Add Discount
              </button>
              <span>- ₹ {overallDiscount}</span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
            <input type="checkbox" checked={autoRoundOff} onChange={e => setAutoRoundOff(e.target.checked)} id="roundoff-check" />
            <label htmlFor="roundoff-check">Auto Round Off</label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
            <strong style={{ fontSize: 16, color: "#0f172a" }}>Total Amount</strong>
            <strong style={{ fontSize: 20, color: "#0f172a", fontFamily: "Manrope, sans-serif" }}>₹ {finalTotal.toLocaleString("en-IN")}</strong>
          </div>

          {/* Mark as fully paid / Payment Received / Delivery Challan / Proforma Invoice / Quotation Payment Input section matching User Reference Image */}
          {type === "Delivery Challan" || type === "Proforma Invoice" || type === "Quotation" ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <select style={{ height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#fff" }}>
                <option value="Add">+ Add ▾</option>
              </select>
              <span style={{ fontSize: 12, color: "#64748b" }}>₹</span>
              <input placeholder="Enter Payment amount" style={{ width: 150, height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#f8fafc" }} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  Mark as fully paid
                  <input type="checkbox" checked={markFullyPaid} onChange={e => setMarkFullyPaid(e.target.checked)} />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#475569" }}>{type === "Credit Note" ? "Amount Received" : "Amount Paid"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>₹</span>
                  <input
                    type="number"
                    value={markFullyPaid ? finalTotal : amountPaid}
                    onChange={e => setAmountPaid(Number(e.target.value))}
                    style={{ width: 90, height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, textAlign: "right", fontSize: 12, background: "#f8fafc" }}
                  />
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ height: 28, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11, background: "#fff" }}>
                    <option value="Cash">Cash ▾</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                <span>Balance Amount</span>
                <span>₹ {Math.max(0, finalTotal - (markFullyPaid ? finalTotal : amountPaid)).toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}

          {/* Dynamic Signature Block from Central Backend Settings */}
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>
              Authorized signatory for <strong>Happy Bonding Men's Wear</strong> ({signatoryName || "M. Saravanan"})
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <img
                src={signatureUrl || undefined}
                alt="Digital Signature"
                style={{ height: 48, objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Item Picker Modal */}
      {itemSearchOpen && (
        <AddItemModal
          products={products}
          currentLines={lines}
          onClose={() => setItemSearchOpen(false)}
          onApplyItems={setLines}
          notify={notify}
        />
      )}
      {/* Quick Voucher Settings Modal */}
      {quickSettingsOpen && (
        <QuickVoucherSettingsModal
          type={type}
          onClose={() => setQuickSettingsOpen(false)}
          onSaveSignature={(sigUrl, sigName) => {
            setSignatureUrl(sigUrl);
            setSignatoryName(sigName);
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

export function QuickVoucherSettingsModal({
  type,
  onClose,
  onSaveSignature,
  notify,
}: {
  type: string;
  onClose: () => void;
  onSaveSignature?: (sigUrl: string, sigName: string) => void;
  notify: (msg: string) => void;
}) {
  const code = type === "Sales Return" ? "SR" : type === "Credit Note" ? "CN" : type === "Delivery Challan" ? "DC" : type === "Proforma Invoice" ? "PF" : type === "Quotation" ? "QUO" : type === "Payment In" ? "PI" : "SL";
  const [prefixEnabled, setPrefixEnabled] = useState(true);
  const [prefix, setPrefix] = useState(`HB/${code}/26-27/`);
  const [sequenceNumber, setSequenceNumber] = useState("1");
  const [showItemImage, setShowItemImage] = useState(false);

  const [priceHistoryEnabled, setPriceHistoryEnabled] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(() => "");
  const [signatoryName, setSignatoryName] = useState(() => "");

  const handleSave = async () => {
    localStorage.setItem(`hb_settings_prefix_${type}`, prefix);
    localStorage.setItem(`hb_settings_seq_${type}`, sequenceNumber);
    localStorage.setItem(`hb_settings_show_img`, String(showItemImage));
    localStorage.setItem(`hb_settings_price_history`, String(priceHistoryEnabled));

    if (signatureUrl) {
      localStorage.setItem("hb_digital_signature", signatureUrl);
    } else {
      localStorage.removeItem("hb_digital_signature");
    }
    localStorage.setItem("hb_signature_name", signatoryName);

    try {
      const cur = await api.invoiceSetting();
      await api.saveInvoiceSetting({
        ...cur,
        signatureUrl: signatureUrl || "",
        signatureText: `Authorized signatory for Happy Bonding Men's Wear (${signatoryName})`,
      });
    } catch (error) { notify(error instanceof Error ? error.message : "Settings save failed"); return; }

    if (onSaveSignature) {
      onSaveSignature(signatureUrl, signatoryName);
    }

    notify(`Settings & Central Backend Signature saved successfully!`);
    onClose();
  };

  return (
    <div className="modal-backdrop bank-select-backdrop" onClick={onClose} style={{ zIndex: 99999 }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 520, borderRadius: 12, padding: 24, background: "#ffffff", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Quick {type} Settings</h3>
          <button type="button" className="icon-close-btn" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Prefix & Sequence Number */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16, background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>{type} Prefix & Sequence Number</strong>
              <span style={{ fontSize: 11, color: "#64748b" }}>Add your custom prefix & sequence for {type} Numbering</span>
            </div>
            {/* Toggle Switch */}
            <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer" }}>
              <input type="checkbox" checked={prefixEnabled} onChange={e => setPrefixEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: prefixEnabled ? "#4f46e5" : "#cbd5e1", borderRadius: 20, transition: "0.3s" }}>
                <span style={{ position: "absolute", content: '""', height: 16, width: 16, left: prefixEnabled ? 21 : 3, bottom: 3, background: "#fff", borderRadius: "50%", transition: "0.3s" }} />
              </span>
            </label>
          </div>

          {prefixEnabled && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Prefix</label>
                  <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Prefix" style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Sequence Number</label>
                  <input value={sequenceNumber} onChange={e => setSequenceNumber(e.target.value)} placeholder="Sequence No" style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
                </div>
              </div>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {type} Number: <strong style={{ color: "#334155" }}>{prefix}{sequenceNumber}</strong>
              </span>
            </>
          )}
        </div>

        {/* Section 2: Show Item Image on Invoice */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 16, background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>Show Item Image on Invoice</strong>
              <span style={{ fontSize: 11, color: "#64748b" }}>This will apply to all vouchers except for Payment In and Payment Out</span>
            </div>
            {/* Toggle Switch */}
            <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer" }}>
              <input type="checkbox" checked={showItemImage} onChange={e => setShowItemImage(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: showItemImage ? "#4f46e5" : "#cbd5e1", borderRadius: 20, transition: "0.3s" }}>
                <span style={{ position: "absolute", content: '""', height: 16, width: 16, left: showItemImage ? 21 : 3, bottom: 3, background: "#fff", borderRadius: "50%", transition: "0.3s" }} />
              </span>
            </label>
          </div>
        </div>

        {/* Section 3: Price History badge New matching Image 5 */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 24, background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13, color: "#0f172a" }}>Price History</strong>
                <span style={{ background: "#3b82f6", color: "#ffffff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "capitalize" }}>New</span>
              </div>
              <span style={{ fontSize: 11, color: "#64748b", display: "block", marginTop: 2 }}>Show last 5 sales / purchase prices of the item for the selected party in invoice</span>
            </div>
            {/* Toggle Switch */}
            <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer" }}>
              <input type="checkbox" checked={priceHistoryEnabled} onChange={e => setPriceHistoryEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: priceHistoryEnabled ? "#4f46e5" : "#cbd5e1", borderRadius: 20, transition: "0.3s" }}>
                <span style={{ position: "absolute", content: '""', height: 16, width: 16, left: priceHistoryEnabled ? 21 : 3, bottom: 3, background: "#fff", borderRadius: "50%", transition: "0.3s" }} />
              </span>
            </label>
          </div>
        </div>

        {/* Section 4: Official Digital Signature (PostgreSQL Database Connected) */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 24, background: "#ffffff" }}>
          <div style={{ marginBottom: 10 }}>
            <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>Official Digital Signature (PostgreSQL Backend DB)</strong>
            <span style={{ fontSize: 11, color: "#64748b" }}>Upload your signature image once here to automatically show on all Sales Invoices & Quotations</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 16, alignItems: "center" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Signatory Name</label>
              <input
                value={signatoryName}
                onChange={e => setSignatoryName(e.target.value)}
                placeholder="e.g. M. Saravanan"
                style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed #60a5fa", borderRadius: 8, padding: 8, background: "#f8fafc" }}>
              {signatureUrl ? (
                <div style={{ textAlign: "center" }}>
                  <img src={signatureUrl} alt="Signature Preview" style={{ height: 36, objectFit: "contain", display: "block", margin: "0 auto 4px" }} />
                  <label style={{ fontSize: 10, color: "#2563eb", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>
                    Change
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => {
                            setSignatureUrl(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              ) : (
                <label style={{ fontSize: 11, color: "#2563eb", cursor: "pointer", fontWeight: 600, textAlign: "center" }}>
                  + Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => {
                          setSignatureUrl(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" className="secondary" style={{ padding: "8px 22px", borderRadius: 6, fontSize: 13 }} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-purple-btn" style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, padding: "8px 28px", font: "600 13px Manrope", cursor: "pointer" }} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function GenericVoucherPage({
  title,
  subtitle,
  action,
  icon: Icon,
  type,
  parties,
  products = [],
  invoices = [],
  notify,
  invoiceSetting = defaultInvoiceSetting,
  onProductsChanged,
}: {
  title: string;
  subtitle: string;
  action: string;
  icon: typeof FileText;
  type: string;
  parties: Party[];
  products?: Product[];
  invoices?: Invoice[];
  notify: (msg: string) => void;
  invoiceSetting?: InvoiceSetting;
  onProductsChanged?: (rows: Product[]) => void;
}) {
  const [creatingFullVoucher, setCreatingFullVoucher] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherRecord | null>(null);
  const purchaseDocumentRef = useRef<HTMLDivElement>(null);
  const [purchasePdfDownloading, setPurchasePdfDownloading] = useState(false);
  const [records, setRecords] = useState<VoucherRecord[]>([]);
  const branchId = api.currentBranchId();
  useEffect(() => {
    let alive = true;
    setRecords([]);
    setCreatingFullVoucher(false);
    setSelectedVoucher(null);
    api.vouchers(type).then(rows => {
      if (alive) setRecords(rows);
    }).catch(error => {
      if (alive) notify(error instanceof Error ? error.message : "Could not load vouchers");
    });
    return () => { alive = false; };
  }, [type, branchId]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("Last 365 Days");

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!`${r.number} ${r.party} ${r.notes}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [records, query, statusFilter, dateFilter]);

  const handleSaveNewRecord = async (record: VoucherRecord) => {
    const saved = await api.saveVoucher(type, record);
    setRecords(rows => [saved, ...rows.filter(row => row.id !== saved.id)]);
  };

  const getPurchaseInvoicePreview = (voucher: VoucherRecord): Invoice => {
    const matchedParty = parties.find(p => p.name === voucher.party || voucher.party.startsWith(`${p.name} (`));
    return {
      id: voucher.id,
      number: voucher.number,
      date: voucher.date,
      party: voucher.party,
      partyPhone: matchedParty?.phone,
      partyAddress: matchedParty?.address,
      partyGstin: matchedParty?.gstin,
      amount: voucher.amount,
      paidAmount: voucher.status === "Open" ? 0 : voucher.amount,
      paymentMode: "Cash",
      status: voucher.status === "Open" ? "Unpaid" : "Paid",
      lines: (voucher.items || []).map(item => ({
        itemName: item.name,
        sku: item.hsn || "",
        quantity: item.qty,
        unitPrice: item.price,
        discount: 0,
        taxRate: 0,
        total: item.amount,
      })),
    };
  };

  const handlePurchaseDownloadPdf = async () => {
    if (!purchaseDocumentRef.current || !selectedVoucher) return;
    try {
      setPurchasePdfDownloading(true);
      await downloadInvoicePdf(purchaseDocumentRef.current, `Purchase_${selectedVoucher.number.replace(/[/\\?%*:|"<>]/g, "_")}`);
    } catch (err) {
      console.error(err);
      notify("Purchase PDF download failed");
    } finally {
      setPurchasePdfDownloading(false);
    }
  };

  const handleDeleteVoucher = async (voucher: VoucherRecord) => {
    if (!window.confirm(`Delete ${type} ${voucher.number}?${type === "Purchase Invoice" ? " Stock will be reduced." : ""}`)) return;
    try {
      await api.deleteVoucher(voucher.id);
      if (type === "Purchase Invoice" && onProductsChanged) onProductsChanged(await api.products());
    } catch (error) {
      notify(error instanceof Error ? error.message : `${type} delete failed`);
      return;
    }
    const nextRecords = records.filter(row => row.id !== voucher.id);
    setRecords(nextRecords);
    localStorage.setItem(`hb_vouchers_${type}`, JSON.stringify(nextRecords));
    notify(`${type} ${voucher.number} deleted successfully`);
    if (selectedVoucher?.id === voucher.id) setSelectedVoucher(null);
  };

  if (creatingFullVoucher) {
    return (
      <CreateQuotationScreen
        title={title}
        type={type}
        parties={parties}
        products={products}
        invoices={invoices}
        vouchers={records}
        onBack={() => setCreatingFullVoucher(false)}
        onSave={handleSaveNewRecord}
        onProductsChanged={onProductsChanged}
        notify={notify}
      />
    );
  }

  if (selectedVoucher && type === "Purchase Invoice") {
    const previewInvoice = getPurchaseInvoicePreview(selectedVoucher);
    const paid = previewInvoice.status === "Paid" ? previewInvoice.amount : 0;
    return (
      <div className="printable-report" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, minHeight: "85vh" }}>
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <div ref={purchaseDocumentRef}>
            <BillOfSupplyTemplate invoice={previewInvoice} setting={invoiceSetting} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="secondary compact" onClick={() => setSelectedVoucher(null)}>← {type} {selectedVoucher.number}</button>
            <span className={`pill ${selectedVoucher.status === "Converted" || selectedVoucher.status === "Completed" ? "success" : "danger"}`}>{selectedVoucher.status}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="secondary" onClick={handlePurchaseDownloadPdf} disabled={purchasePdfDownloading}>
              <Download size={15} /> {purchasePdfDownloading ? "Generating PDF..." : "Download PDF"}
            </button>
            <button className="secondary" onClick={() => {
              if (!purchaseDocumentRef.current) return;
              const win = window.open("", "_blank", "width=900,height=700");
              if (!win) return;
              win.document.write(`<html><head><title>Purchase ${selectedVoucher.number}</title></head><body style="margin:0">${purchaseDocumentRef.current.innerHTML}</body></html>`);
              win.document.close();
              win.focus();
              win.print();
            }}>
              <Printer size={15} /> Print
            </button>
            <button className="whatsapp-btn" onClick={() => shareWhatsAppInvoice({ partyName: selectedVoucher.party, number: selectedVoucher.number, amount: selectedVoucher.amount, paidAmount: paid })}>
              <Share2 size={15} /> Share
            </button>
            <button className="icon-button" onClick={() => handleDeleteVoucher(selectedVoucher)} style={{ color: "#dc2626" }} title="Delete">
              <Trash2 size={16} />
            </button>
            <button className="icon-button" onClick={() => setSelectedVoucher(null)}>
              <X size={18} />
            </button>
          </div>
        </div>

        <BillOfSupplyTemplate invoice={previewInvoice} setting={invoiceSetting} />
      </div>
    );
  }

  if (selectedVoucher) {
    return (
      <div style={{ background: "#fff", minHeight: "85vh", padding: "0 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="icon-button" onClick={() => setSelectedVoucher(null)} title="Back">
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>{type} #{selectedVoucher.number}</h1>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="secondary" onClick={() => notify(`${type} ${selectedVoucher.number} print ready`)}>
              <Printer size={15} /> Print
            </button>
            <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1", color: "#ef4444" }} onClick={() => handleDeleteVoucher(selectedVoucher)}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <section style={{ border: "1px solid #dbe3ef", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ background: "#f8fafc", borderBottom: "1px solid #dbe3ef", padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#334155" }}>{type} Details</div>
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.2fr 1.2fr", gap: 24, fontSize: 13 }}>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Party Name</span><strong>{selectedVoucher.party}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Date</span><strong>{selectedVoucher.date}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Amount</span><strong>₹ {selectedVoucher.amount.toLocaleString("en-IN")}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Status</span><strong>{selectedVoucher.status}</strong></div>
            <div style={{ gridColumn: "1 / -1" }}><span style={{ display: "block", color: "#64748b", marginBottom: 8 }}>Notes</span><strong>{selectedVoucher.notes || "--"}</strong></div>
          </div>
        </section>

        <section style={{ border: "1px solid #dbe3ef", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#fff", borderBottom: "1px solid #dbe3ef", padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#334155" }}>Items List</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#0f172a" }}>
                <th style={{ padding: "12px 14px", textAlign: "left" }}>Item Name</th>
                <th style={{ padding: "12px 14px", textAlign: "left" }}>HSN</th>
                <th style={{ padding: "12px 14px", textAlign: "center" }}>Qty</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Price</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(!selectedVoucher.items || selectedVoucher.items.length === 0) && (
                <tr><td colSpan={5} style={{ padding: "24px 14px", textAlign: "center", color: "#64748b" }}>No items listed</td></tr>
              )}
              {(selectedVoucher.items || []).map((item, idx) => (
                <tr key={`${item.name}-${idx}`}>
                  <td style={{ padding: "12px 14px" }}>{item.name}</td>
                  <td style={{ padding: "12px 14px" }}>{item.hsn}</td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>{item.qty}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>₹ {item.price.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>₹ {item.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  return (
    <div className="generic-voucher-wrap" style={{ minHeight: "85vh", padding: "0 4px" }}>
      {/* Header Bar matching Reference Image */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>{title}</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="icon-button" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }} title="Settings" onClick={() => setQuickSettingsOpen(true)}>
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
          <Icon size={16} /> All {title}
        </div>
      </div>

      {/* Filter Bar matching Reference Image */}
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

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: 38, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff", color: "#334155" }}
            >
              <option value="All">All {type === "Delivery Challan" ? "Challans" : type === "Proforma Invoice" ? "Invoices" : "Vouchers"} ▾</option>
              <option value="Show Open">Show Open {type === "Delivery Challan" ? "Challans" : type === "Proforma Invoice" ? "Invoices" : "Vouchers"} ▾</option>
            </select>
          </div>

          <button
            type="button"
            className="primary-purple-btn"
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", font: "600 13px Manrope", cursor: "pointer" }}
            onClick={() => setCreatingFullVoucher(true)}
          >
            {action}
          </button>
        </div>
      </article>

      {/* Table Card matching Reference Image */}
      <article className="card table-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Date ⇅</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Number</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Party Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Due In</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#1e293b" }}>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>{row.date}</td>
                  <td style={{ padding: "14px 16px" }} className="mono"><strong>{row.number}</strong></td>
                  <td style={{ padding: "14px 16px" }}><strong>{row.party}</strong></td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>{row.dueIn || "30 Days"}</td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700 }}>₹ {row.amount.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <span className={row.status === "Converted" || row.status === "Completed" ? "status-pill-green" : row.status === "Open" ? "status-pill-blue" : "status-pill-red"}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button type="button" className="secondary compact" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setSelectedVoucher(row)}>
                      View
                    </button>
                    <button type="button" className="icon-pencil-btn" style={{ marginLeft: 6, padding: "4px 6px" }} onClick={() => type === "Purchase Invoice" ? setSelectedVoucher(row) : notify(`${type} ${row.number} sent to print`)} title="Print">
                      <Printer size={14} />
                    </button>
                    <button type="button" className="icon-pencil-btn" style={{ marginLeft: 6, padding: "4px 6px", color: "#dc2626" }} onClick={() => handleDeleteVoucher(row)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "80px 20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileSpreadsheet size={32} color="#94a3b8" />
                      </div>
                      <span style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>No Transactions Matching the current filter</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Quick Settings Modal */}
      {quickSettingsOpen && (
        <QuickVoucherSettingsModal type={type} onClose={() => setQuickSettingsOpen(false)} notify={notify} />
      )}
    </div>
  );
}
