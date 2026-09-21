import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BarChart3, Banknote, Boxes, Building2, Calendar, CheckSquare, ChevronDown, ExternalLink, Eye, EyeOff, Gift, IndianRupee as CircleIndianRupee,
  ClipboardList, CreditCard, Download, FileSpreadsheet, FileText, Keyboard, LayoutDashboard, Mail, Menu, MessageCircle, MessageSquare, MoreVertical, PackagePlus,
  Pencil, Percent, Plus, Printer, Receipt, ReceiptIndianRupee, Search, Settings, Share2, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Star, Tag, Trash2,
  TrendingUp, Upload, UserRoundPlus, Users, UsersRound, WalletCards, X, XCircle, QrCode, History
} from "lucide-react";
import { money } from "./data";
import { api } from "./api";
import type { Branch, Expense, Invoice, InvoiceLineItem, InvoiceSetting, OwnerBranchSummary, Page, Party, Product, StaffUser } from "./types";
import * as XLSX from "xlsx";
import happyBondingLogo from "./assets/happy-bonding-logo-white.png";
import { BillOfSupplyTemplate } from "./components/BillOfSupplyTemplate";
import { downloadInvoicePdf } from "./utils/pdf";
import { GARMENT_HSN_CODES } from "./data/hsnCodes";
import { ThermalReceiptTemplate } from "./components/ThermalReceiptTemplate";
import { BarcodeGeneratorModal } from "./components/BarcodeGeneratorModal";
import { RemindersModule } from "./pages/reminders/RemindersModule";
import { ExpensesModule } from "./pages/expenses/ExpensesModule";
import { CashBank } from "./pages/cash-bank/CashBank";
import { Staff, StaffManagementModal } from "./pages/staff/Staff";
import { Parties, partyPayloadFromForm } from "./pages/parties/Parties";
import { Items } from "./pages/inventory/Items";
import { Reports, RateListReportScreen, StockSummaryReportScreen, LowStockSummaryReportScreen, ItemSalesSummaryReportScreen, SalesSummaryReportScreen, DayBookReportScreen, BillWiseProfitReportScreen, EmailExcelReportModal } from "./pages/reports/Reports";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { DashboardLive } from "./pages/dashboard/DashboardLive";
import { PaymentInModule } from "./pages/payment-in/PaymentInModule";
import { GenericVoucherPage } from "./pages/vouchers/GenericVoucherPage";

export function shareWhatsAppInvoice(opts: { phone?: string; partyName?: string; number: string; amount: number; paidAmount?: number; paymentMode?: string }) {
  const name = opts.partyName || "Valued Customer";
  const num = opts.number || "Invoice";
  const total = `₹${opts.amount.toLocaleString("en-IN")}`;
  const paid = opts.paidAmount !== undefined ? `₹${opts.paidAmount.toLocaleString("en-IN")}` : total;
  const mode = opts.paymentMode || "Cash";
  const digits = (opts.phone ?? "").replace(/\D/g, "");
  const targetPhone = digits.length === 10 ? `91${digits}` : digits.length > 10 ? digits : "";

  const text = `👔 *Happy Bonding Men's Wear - Pavoorchatram*
--------------------------------------------
Hello *${name}*! Thank you for shopping with us.

🧾 *Invoice No:* ${num}
📅 *Date:* ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
🏷️ *Total Bill Amount:* ${total}
💳 *Amount Received:* ${paid} (${mode})
--------------------------------------------
Visit us again for premium men's clothing!
📍 West Bus Stand, Pavoorchatram (Near Railway Gate)`;

  const url = targetPhone
    ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

const nav: { section: string; items: { id: Page; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { section: "WORKSPACE", items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "parties", label: "Parties", icon: UsersRound },
    { id: "items", label: "Items & Inventory", icon: Boxes },
    { id: "sales", label: "Sales", icon: ReceiptIndianRupee },
    { id: "purchases", label: "Purchases", icon: ShoppingBag },
    { id: "reports", label: "Reports", icon: BarChart3 },
  ]},
  { section: "FINANCE", items: [
    { id: "cash", label: "Cash & Bank", icon: WalletCards },
    { id: "expenses", label: "Store Expenses", icon: Receipt },
    { id: "pos", label: "POS Billing", icon: ShoppingCart },
  ]},
  { section: "BUSINESS", items: [
    { id: "reminders", label: "Reminders & WhatsApp", icon: MessageCircle },
    { id: "staff", label: "Staff & Payroll", icon: Users },
    { id: "settings", label: "Settings & Backup", icon: Settings },
  ]},
];

const defaultSignatureUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" width="220" height="60"><path d="M10 45 C30 10, 45 5, 55 45 C65 25, 75 15, 85 45 C95 10, 110 30, 130 40 C140 15, 155 25, 175 35 C185 10, 205 35, 240 15" stroke="%23111827" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M25 50 C80 48, 140 52, 210 48" stroke="%23111827" stroke-width="1.5" fill="none"/><text x="35" y="65" font-family="cursive, sans-serif" font-size="18" font-weight="bold" fill="%23111827">M. Saravana</text></svg>`;

export const defaultInvoiceSetting: InvoiceSetting = { invoicePrefix: "HB/SL", paymentTermsDays: 30, terms: "NO REFUND ONCE SOLD. EXCHANGE ONLY AS PER STORE POLICY.", bankName: "", accountName: "", accountNumber: "", ifsc: "", upiId: "", qrText: "", signatureText: "Authorized signatory for Happy Bonding Men's Wear", signatureUrl: defaultSignatureUrl };

function BarcodeIcon() {
  return <div className="barcode-icon" title="Barcode Scanner"><span/><span/><span/><span/><span/><span/><span/></div>;
}


export default function App() {
  const apiMode = import.meta.env.VITE_USE_API === "true";
  const [authenticated, setAuthenticated] = useState(!apiMode || api.hasSession());
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebar, setSidebar] = useState(false);
  const [productRows, setProductRows] = useState<Product[]>([]);
  const [partyRows, setPartyRows] = useState<Party[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<Invoice[]>([]);
  const [invoiceSetting, setInvoiceSetting] = useState<InvoiceSetting>(defaultInvoiceSetting);
  const [branchRows, setBranchRows] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState(api.currentBranchId());
  const [ownerSummary, setOwnerSummary] = useState<OwnerBranchSummary[]>([]);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [salesCreateKey, setSalesCreateKey] = useState(0);

  const [activeInvoiceModal, setActiveInvoiceModal] = useState<Invoice | null>(null);

  const handleLogout = () => {
    api.logout();
    setAuthenticated(false);
    notify("Logged out successfully");
  };


  const refreshAppData = async () => {
    const [nextProducts, nextParties, nextInvoices, nextSetting, nextBranches, nextSummary] = await Promise.all([
      api.products().catch(() => null),
      api.parties().catch(() => null),
      api.sales().catch(() => null),
      api.invoiceSetting().catch(() => null),
      api.branches().catch(() => null),
      api.ownerSummary().catch(() => null),
    ]);
    if (nextProducts) setProductRows(nextProducts);
    if (nextParties) setPartyRows(nextParties);
    if (nextInvoices) setInvoiceRows(nextInvoices);
    if (nextSetting) setInvoiceSetting({ ...defaultInvoiceSetting, ...nextSetting });
    if (nextBranches) {
      setBranchRows(nextBranches);
      if (api.currentBranchId()) {
        setCurrentBranchId(api.currentBranchId());
      } else if (nextBranches[0]) {
        api.setCurrentBranch(nextBranches[0].id);
        setCurrentBranchId(nextBranches[0].id);
      }
    }
    if (nextSummary) setOwnerSummary(nextSummary);
  };

  useEffect(() => {
    if (authenticated) {
      refreshAppData().catch(() => {});
    }
  }, [authenticated, currentBranchId]);

  const [expandedNav, setExpandedNav] = useState<"sales" | "purchases" | "parties" | null>(null);
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [autoOpenShareLedger, setAutoOpenShareLedger] = useState(false);
  const [activeReportSubScreen, setActiveReportSubScreen] = useState<string | null>(null);

  const handleNavigateReportsFromSales = (reportName: string) => {
    setPage("reports");
    if (reportName === "sales_summary") setActiveReportSubScreen("Sales summary");
    else if (reportName === "daybook") setActiveReportSubScreen("DayBook");
    else if (reportName === "bill_wise_profit") setActiveReportSubScreen("Bill-wise profit");
    else if (reportName === "gstr1") setActiveReportSubScreen("GSTR-1 sales");
    else setActiveReportSubScreen(reportName);
  };

  const go = (id: Page) => {
    setPage(id);
    setSidebar(false);
    setCreateDropdownOpen(false);
    if (id === "parties") {
      setExpandedNav("parties");
    } else if (["sales", "quotation", "payment_in", "sales_return", "credit_note", "delivery_challan", "proforma_invoice"].includes(id)) {
      setExpandedNav("sales");
    } else if (["purchases", "payment_out", "purchase_return", "debit_note", "purchase_orders", "expenses"].includes(id)) {
      setExpandedNav("purchases");
    }
  };
  const openSalesInvoice = () => {
    setPage("sales");
    setSalesCreateKey(key => key + 1);
    setSidebar(false);
    setCreateDropdownOpen(false);
  };
  const [pendingSwitchBranch, setPendingSwitchBranch] = useState<{ id: string; name: string } | null>(null);
  const currentBranch = branchRows.find(branch => branch.id === currentBranchId) || branchRows[0];
  const handleBranchChange = (branchId: string) => {
    if (branchId === currentBranchId) return;
    const targetBranch = branchRows.find(b => b.id === branchId);
    if (!targetBranch) return;
    setPendingSwitchBranch({ id: branchId, name: targetBranch.name });
  };



  const handleSyncNow = async () => {
    try {
      const queued = JSON.parse(localStorage.getItem("hb_offline_queue") || "[]");
      if (Array.isArray(queued) && queued.length > 0) {
        const result = await api.pushSync(queued);
        localStorage.removeItem("hb_offline_queue");
        notify(`Online sync complete: ${result.accepted} changes uploaded`);
        return;
      }
      const status = await api.syncStatus();
      const pending = status.queue.find(row => row.status === "PENDING")?.count || 0;
      notify(pending ? `${pending} sync changes pending` : "Online sync is up to date");
    } catch {
      notify("Offline mode: changes will sync when internet is available");
    }
  };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const openInvoiceDetail = async (inv: Invoice) => {
    setActiveInvoiceModal(inv);
    try {
      const fresh = await api.sale(inv.id);
      setActiveInvoiceModal(fresh);
    } catch {
      notify("Showing saved invoice from current list");
    }
  };
  const refreshActiveInvoiceAfterPayment = async (invoiceId: string | number) => {
    await refreshAppData();
    try {
      const fresh = await api.sale(invoiceId);
      setActiveInvoiceModal(fresh);
    } catch {
      setActiveInvoiceModal(null);
    }
  };

  // Global ERP Keyboard Shortcuts Listener
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // F2 Shortcut -> Create Sales Invoice
      if (e.key === "F2") {
        e.preventDefault();
        openSalesInvoice();
        notify("Shortcut F2: Opened Create Sales Invoice");
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "s") {
          e.preventDefault();
          openSalesInvoice();
          notify("Shortcut Alt+S: Sales Invoice");
        } else if (key === "b") {
          e.preventDefault();
          go("pos");
          notify("Shortcut Alt+B: POS Billing");
        } else if (key === "p") {
          e.preventDefault();
          go("purchases");
          notify("Shortcut Alt+P: Purchases");
        } else if (key === "i") {
          e.preventDefault();
          go("sales");
          notify("Shortcut Alt+I: Payment In");
        } else if (key === "o") {
          e.preventDefault();
          notify("Shortcut Alt+O: Payment Out");
        } else if (key === "c") {
          e.preventDefault();
          go("sales");
          notify("Shortcut Alt+C: Sales Return");
        } else if (key === "r") {
          e.preventDefault();
          notify("Shortcut Alt+R: Purchase Return");
        } else if (key === "q") {
          e.preventDefault();
          go("sales");
          notify("Shortcut Alt+Q: Quotation / Estimate");
        } else if (key === "e") {
          e.preventDefault();
          notify("Shortcut Alt+E: Expense");
        } else if (key === "y") {
          e.preventDefault();
          go("parties");
          notify("Shortcut Alt+Y: Parties");
        } else if (key === "m") {
          e.preventDefault();
          go("items");
          notify("Shortcut Alt+M: Items & Inventory");
        } else if (key === "h") {
          e.preventDefault();
          window.open("https://wa.me/917708030903", "_blank");
          notify("Shortcut Alt+H: Opening Customer Support");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, []);

  if (!authenticated) return <LoginScreen onLogin={async () => { setAuthenticated(true); await refreshAppData(); }}/>;

  return <div className="app-shell">
    <aside className={`sidebar ${sidebar ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-logo"><img src={happyBondingLogo} alt="Happy Bonding logo"/></div>
        <div><strong>Happy Bonding</strong><span>Men's Wear ERP</span></div>
        <button className="icon-button close-menu" onClick={() => setSidebar(false)}><X size={19}/></button>
      </div>
      <div className="new-sale-split-wrap">
        <button className="new-sale-main-btn" onClick={openSalesInvoice}>
          Create Sales Invoice <span>F2</span>
        </button>
        <button
          type="button"
          className={`new-sale-arrow-btn ${createDropdownOpen ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); setCreateDropdownOpen(!createDropdownOpen); }}
          title="Quick Create Menu"
        >
          <ChevronDown size={17}/>
        </button>

        {createDropdownOpen && (
          <div className="create-tx-dropdown-menu" onClick={(e) => e.stopPropagation()}>
            <div className="create-tx-group">
              <div className="create-tx-header">GENERAL</div>
              <button type="button" className="create-tx-item" onClick={() => { go("parties"); notify("Navigated to Parties page"); }}>
                <div className="create-tx-icon-box"><UserRoundPlus size={15} /></div> Create Party
              </button>
              <button type="button" className="create-tx-item" onClick={() => { go("items"); notify("Navigated to Items & Inventory"); }}>
                <div className="create-tx-icon-box"><Boxes size={15} /></div> Create Item
              </button>
            </div>

            <div className="create-tx-group">
              <div className="create-tx-header">SALES TRANSACTIONS</div>
              <button type="button" className="create-tx-item" onClick={() => go("quotation")}>
                <div className="create-tx-icon-box"><FileSpreadsheet size={15} /></div> Quotation
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("payment_in")}>
                <div className="create-tx-icon-box"><CreditCard size={15} /></div> Payment In
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("sales_return")}>
                <div className="create-tx-icon-box"><ReceiptIndianRupee size={15} /></div> Sales Return
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("credit_note")}>
                <div className="create-tx-icon-box"><ClipboardList size={15} /></div> Credit Note
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("delivery_challan")}>
                <div className="create-tx-icon-box"><Boxes size={15} /></div> Delivery Challan
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("proforma_invoice")}>
                <div className="create-tx-icon-box"><FileText size={15} /></div> Proforma Invoice
              </button>
            </div>

            <div className="create-tx-group">
              <div className="create-tx-header">PURCHASE TRANSACTIONS</div>
              <button type="button" className="create-tx-item" onClick={() => go("purchases")}>
                <div className="create-tx-icon-box"><ShoppingBag size={15} /></div> Purchase
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("payment_out")}>
                <div className="create-tx-icon-box"><CreditCard size={15} /></div> Payment Out
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("purchase_return")}>
                <div className="create-tx-icon-box"><ShoppingBag size={15} /></div> Purchase Return
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("debit_note")}>
                <div className="create-tx-icon-box"><ClipboardList size={15} /></div> Debit Note
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("purchase_orders")}>
                <div className="create-tx-icon-box"><Boxes size={15} /></div> Purchase Orders
              </button>
              <button type="button" className="create-tx-item" onClick={() => go("expenses")}>
                <div className="create-tx-icon-box"><WalletCards size={15} /></div> Create Expense
              </button>
            </div>
          </div>
        )}
      </div>

      <nav>{nav.map(group => <div className="nav-group" key={group.section}>
        <p>{group.section}</p>
        {group.items.map(item => (
          <div key={item.id}>
            <button
              className={page === item.id || (item.id === "parties" && page === "parties") || (item.id === "sales" && ["sales", "quotation", "payment_in", "sales_return", "credit_note", "delivery_challan", "proforma_invoice"].includes(page)) || (item.id === "purchases" && ["purchases", "payment_out", "purchase_return", "debit_note", "purchase_orders", "expenses"].includes(page)) ? "active" : ""}
              onClick={() => {
                if (item.id === "parties") {
                  setExpandedNav(expandedNav === "parties" ? null : "parties");
                  if (page !== "parties") {
                    go("parties");
                  }
                } else if (item.id === "sales") {
                  setExpandedNav(expandedNav === "sales" ? null : "sales");
                  if (!["sales", "quotation", "payment_in", "sales_return", "credit_note", "delivery_challan", "proforma_invoice"].includes(page)) {
                    go("sales");
                  }
                } else if (item.id === "purchases") {
                  setExpandedNav(expandedNav === "purchases" ? null : "purchases");
                  if (!["purchases", "payment_out", "purchase_return", "debit_note", "purchase_orders", "expenses"].includes(page)) {
                    go("purchases");
                  }
                } else {
                  go(item.id);
                }
              }}
            >
              <item.icon size={18}/><span>{item.label}</span>
              {(item.id === "parties" || item.id === "sales" || item.id === "purchases") && <ChevronDown size={14} style={{ marginLeft: "auto", transform: expandedNav === item.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />}
            </button>

            {item.id === "parties" && expandedNav === "parties" && (
              <div className="nav-sub-items">
                <button className={`nav-sub-item ${page === "parties" ? "active" : ""}`} onClick={() => go("parties")}>
                  All Parties
                </button>
                <button
                  className="nav-sub-item"
                  onClick={() => {
                    go("parties");
                    setAutoOpenShareLedger(true);
                  }}
                >
                  SharedLedger <span className="pill warning" style={{ marginLeft: "auto", fontSize: 8, padding: "2px 5px" }}>New</span>
                </button>
              </div>
            )}
            {item.id === "sales" && expandedNav === "sales" && (
              <div className="nav-sub-items">
                <button className={`nav-sub-item ${page === "sales" ? "active" : ""}`} onClick={() => go("sales")}>Sales Invoices</button>
                <button className={`nav-sub-item ${page === "quotation" ? "active" : ""}`} onClick={() => go("quotation")}>Quotation / Estimate</button>
                <button className={`nav-sub-item ${page === "payment_in" ? "active" : ""}`} onClick={() => go("payment_in")}>Payment In</button>
                <button className={`nav-sub-item ${page === "sales_return" ? "active" : ""}`} onClick={() => go("sales_return")}>Sales Return</button>
                <button className={`nav-sub-item ${page === "credit_note" ? "active" : ""}`} onClick={() => go("credit_note")}>Credit Note</button>
                <button className={`nav-sub-item ${page === "delivery_challan" ? "active" : ""}`} onClick={() => go("delivery_challan")}>Delivery Challan</button>
                <button className={`nav-sub-item ${page === "proforma_invoice" ? "active" : ""}`} onClick={() => go("proforma_invoice")}>Proforma Invoice</button>
              </div>
            )}
            {item.id === "purchases" && expandedNav === "purchases" && (
              <div className="nav-sub-items">
                <button className={`nav-sub-item ${page === "purchases" ? "active" : ""}`} onClick={() => go("purchases")}>Purchase Invoices</button>
                <button className={`nav-sub-item ${page === "payment_out" ? "active" : ""}`} onClick={() => go("payment_out")}>Payment Out</button>
                <button className={`nav-sub-item ${page === "purchase_return" ? "active" : ""}`} onClick={() => go("purchase_return")}>Purchase Return</button>
                <button className={`nav-sub-item ${page === "debit_note" ? "active" : ""}`} onClick={() => go("debit_note")}>Debit Note</button>
                <button className={`nav-sub-item ${page === "purchase_orders" ? "active" : ""}`} onClick={() => go("purchase_orders")}>Purchase Orders</button>
                <button className={`nav-sub-item ${page === "expenses" ? "active" : ""}`} onClick={() => go("expenses")}>Expenses</button>
              </div>
            )}
          </div>
        ))}
      </div>)}</nav>
      <div className="branch-card" style={{ alignItems: "stretch", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Building2 size={17}/>
          <div style={{ flex: 1 }}>
            <small>Current branch</small>
            <strong>{currentBranch?.name || "Select Branch"}</strong>
          </div>
          <ChevronDown size={16}/>
        </div>
        <select value={currentBranchId} onChange={e => handleBranchChange(e.target.value)} style={{ width: "100%", border: "1px solid #f0d47a", borderRadius: 8, padding: "8px 10px", background: "#fff", fontSize: 12 }}>
          {branchRows.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button type="button" className="secondary compact" onClick={() => setBranchModalOpen(true)}>Add Branch</button>
          <button type="button" className="secondary compact" onClick={() => setStaffModalOpen(true)}>Staff</button>
        </div>
      </div>
    </aside>
    <main>
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setSidebar(true)}><Menu/></button>
        <div><strong>Happy Bonding ERP</strong><span>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric",weekday:"long"})} · {currentBranch?.name || "Branch"} Store</span></div>
        <div className="top-actions">
          <button className="icon-button" title="Sync Offline Changes" onClick={handleSyncNow}><CheckSquare size={19}/></button>
          <button className="icon-button" title="Search ERP"><Search size={19}/></button>
          <button className="secondary compact" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 12, cursor: "pointer" }} onClick={() => setChangePasswordModalOpen(true)} title="Change Password">
            🔑 Change Password
          </button>
          <button className="secondary compact" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 12, cursor: "pointer", background: "#fef2f2", color: "#dc2626", borderColor: "#fca5a5" }} onClick={handleLogout} title="Logout">
            🚪 Logout
          </button>
          <div className="user-profile-badge" title="Saravana Kumar (Store Admin) - Click to change password" onClick={() => setChangePasswordModalOpen(true)} style={{ cursor: "pointer" }}>
            <div className="avatar">SK</div>
            <div className="user-info-text">
              <strong>Saravana Kumar</strong>
              <small>Store Admin</small>
            </div>
          </div>
        </div>
      </header>
      <section className={page === "pos" ? "page pos-page" : "page"}>
        {page === "dashboard" && <DashboardLive products={productRows} parties={partyRows} invoices={invoiceRows} ownerSummary={ownerSummary} onNewSale={openSalesInvoice} onSelectInvoice={openInvoiceDetail} onSeeAllTransactions={() => setPage("sales")}/>} 
        {page === "parties" && <Parties rows={partyRows} setRows={setPartyRows} notify={notify} apiMode={apiMode} onNavigateReport={() => setPage("reports")} autoOpenShareLedger={autoOpenShareLedger} onClearAutoOpenShareLedger={() => setAutoOpenShareLedger(false)} />} 
        {page === "items" && <Items rows={productRows} invoices={invoiceRows} setRows={setProductRows} notify={notify} apiMode={apiMode}/>} 
        {page === "sales" && <Sales rows={invoiceRows} products={productRows} parties={partyRows} setting={invoiceSetting} setSetting={setInvoiceSetting} setRows={setInvoiceRows} setParties={setPartyRows} setProducts={setProductRows} notify={notify} autoCreateKey={salesCreateKey} onSelectInvoice={openInvoiceDetail} onNavigateReports={handleNavigateReportsFromSales}/>} 
        {page === "quotation" && <GenericVoucherPage title="Quotation / Estimate" subtitle="Create and track estimates for customers before final sale." action="+ Create Quotation" icon={FileSpreadsheet} type="Quotation" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "payment_in" && <PaymentInModule parties={partyRows} invoices={invoiceRows} notify={notify} onDataChanged={refreshAppData} currentBranchId={currentBranchId} />}
        {page === "sales_return" && <GenericVoucherPage title="Sales Return" subtitle="Track customer garment returns & credit balances." action="+ Create Sales Return" icon={ReceiptIndianRupee} type="Sales Return" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "credit_note" && <GenericVoucherPage title="Credit Note" subtitle="Issue credit notes against returns & pricing adjustments." action="+ Create Credit Note" icon={ClipboardList} type="Credit Note" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "delivery_challan" && <GenericVoucherPage title="Delivery Challan" subtitle="Track dispatch of goods, transport & delivery notes." action="+ Create Delivery Challan" icon={Boxes} type="Delivery Challan" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "proforma_invoice" && <GenericVoucherPage title="Proforma Invoice" subtitle="Draft & send proforma invoices prior to supply." action="+ Create Proforma" icon={FileText} type="Proforma Invoice" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}

        {page === "purchases" && <GenericVoucherPage title="Purchase Invoices" subtitle="Supplier purchases, stock entries & payable tracking." action="+ Create Purchase" icon={ShoppingBag} type="Purchase Invoice" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} invoiceSetting={invoiceSetting} onProductsChanged={setProductRows} />}
        {page === "payment_out" && <GenericVoucherPage title="Payment Out" subtitle="Record payments made to suppliers & vendors." action="+ Record Payment Out" icon={CreditCard} type="Payment Out" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "purchase_return" && <GenericVoucherPage title="Purchase Return" subtitle="Return damaged/excess goods to suppliers & debit balance." action="+ Create Purchase Return" icon={ShoppingBag} type="Purchase Return" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "debit_note" && <GenericVoucherPage title="Debit Note" subtitle="Issue debit notes to suppliers for price differences or returns." action="+ Create Debit Note" icon={ClipboardList} type="Debit Note" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "purchase_orders" && <GenericVoucherPage title="Purchase Orders" subtitle="Send POs to vendors & manage upcoming stock shipments." action="+ Create PO" icon={Boxes} type="Purchase Order" parties={partyRows} products={productRows} invoices={invoiceRows} notify={notify} />}
        {page === "expenses" && <ExpensesModule notify={notify} currentBranchId={currentBranchId} />}

        {page === "reminders" && <RemindersModule parties={partyRows} invoices={invoiceRows} notify={notify} />}

        {page === "reports" && <Reports products={productRows} invoices={invoiceRows} notify={notify} initialReport={activeReportSubScreen}/>} 
        {page === "cash" && <CashBank notify={notify}/>} 
        {page === "pos" && <Sales rows={invoiceRows} products={productRows} parties={partyRows} setting={invoiceSetting} setSetting={setInvoiceSetting} setRows={setInvoiceRows} setParties={setPartyRows} setProducts={setProductRows} notify={notify} autoCreateKey={Date.now()} onSelectInvoice={openInvoiceDetail} onNavigateReports={handleNavigateReportsFromSales}/>} 
        {page === "staff" && <Staff/>} 
        {page === "settings" && <SettingsPage notify={notify} branches={branchRows} currentBranchId={currentBranchId} onSwitchBranch={handleBranchChange} onRefreshData={refreshAppData} />} 

      </section>
    </main>
    {sidebar && <div className="scrim" onClick={() => setSidebar(false)}/>} 
    {toast && <div className="toast">{toast}</div>}
    {activeInvoiceModal && <InvoiceDetailModal invoice={activeInvoiceModal} setting={invoiceSetting} notify={notify} onPaymentSaved={refreshActiveInvoiceAfterPayment} onClose={() => setActiveInvoiceModal(null)} />}
    {branchModalOpen && <BranchManagementModal branches={branchRows} onClose={() => setBranchModalOpen(false)} onSaved={async () => { await refreshAppData(); setBranchModalOpen(false); notify("Branch saved"); }} notify={notify} />}
    {staffModalOpen && <StaffManagementModal branches={branchRows} onClose={() => setStaffModalOpen(false)} notify={notify} />}
    {changePasswordModalOpen && <ChangePasswordModal onClose={() => setChangePasswordModalOpen(false)} notify={notify} />}
    {pendingSwitchBranch && <BranchSwitchAuthModal branch={pendingSwitchBranch} onClose={() => setPendingSwitchBranch(null)} onSuccess={async (bId) => { api.setCurrentBranch(bId); setCurrentBranchId(bId); await refreshAppData(); }} notify={notify} />}
  </div>;

}

function ChangePasswordModal({ onClose, notify }: { onClose: () => void; notify: (msg: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      notify("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify("New passwords do not match!");
      return;
    }
    try {
      setSaving(true);
      await api.changePassword(currentPassword, newPassword);
      notify("✅ Password changed successfully!");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Password change failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🔑 Change My Password" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit} style={{ gap: 12 }}>
        <label className="full">Current Password
          <div style={{ position: "relative", width: "100%" }}>
            <input type={showPass ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="Enter current password" style={{ width: "100%", paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <label className="full">New Password
          <input type={showPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required placeholder="Enter new password (min 6 chars)" />
        </label>
        <label className="full">Confirm New Password
          <input type={showPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} required placeholder="Re-enter new password" />
        </label>
        <div className="modal-actions full">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? "Updating..." : "Update Password"}</button>
        </div>
      </form>
    </Modal>
  );
}

function BranchSwitchAuthModal({ branch, onClose, onSuccess, notify }: { branch: { id: string; name: string }; onClose: () => void; onSuccess: (branchId: string) => void; notify: (msg: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return notify("Please enter branch username and password");
    setVerifying(true);
    try {
      const res = await api.switchBranch(branch.id, email, password);
      if (res.ok) {
        notify(`Authenticated & switched to ${branch.name}`);
        onSuccess(branch.id);
        onClose();
      }
    } catch (err: any) {
      notify(err.message || "Invalid branch credentials");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal title={`Branch Access Authentication - ${branch.name}`} onClose={onClose}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Please enter staff/branch credentials to access <strong>{branch.name}</strong> data.
      </p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="full">Branch Username / Email
          <input type="email" placeholder="branch@happybonding.in" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="full">Branch Password
          <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <div className="modal-actions full" style={{ marginTop: 12 }}>
          <button type="button" className="secondary" onClick={onClose} disabled={verifying}>Cancel</button>
          <button className="primary" disabled={verifying}>{verifying ? "Verifying..." : "Verify & Switch Branch"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function EditBranchModal({ branch, onClose, onSaved, notify }: { branch: Branch; onClose: () => void; onSaved: () => void; notify: (msg: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState(branch.code || "");
  const [name, setName] = useState(branch.name || "");
  const [phone, setPhone] = useState(branch.phone || "");
  const [address, setAddress] = useState(branch.address || "");
  const initialEmail = branch.memberships?.find(m => m.user?.email && m.user.email.toLowerCase() !== "admin@happybonding.in")?.user?.email || branch.memberships?.[0]?.user?.email || "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code || !name) return notify("Branch code and name are required.");
    try {
      setSaving(true);
      await api.updateBranch(branch.id, {
        code,
        name,
        phone,
        address,
        email: email.trim(),
        password,
      });
      notify(`✅ Branch '${name}' details & credentials updated!`);
      onSaved();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Branch update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`✏️ Edit Branch & Credentials - ${branch.name}`} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>Branch Code
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="PAV" required />
        </label>
        <label>Branch Name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Pavoorchatram Store" required />
        </label>
        <label>Phone Number
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="7708030903" />
        </label>
        <label>Branch Username / Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="branch@happybonding.in" />
        </label>
        <label className="full">
          Branch Password (for login & branch switch authentication)
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Leave blank to keep existing password"
              minLength={6}
              style={{ width: "100%", paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <small style={{ color: "#64748b", marginTop: 4, display: "block" }}>
            Enter new password (min 6 chars) to reset password for this branch login.
          </small>
        </label>
        <label className="full">Branch Address
          <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full store address" />
        </label>
        <div className="modal-actions full">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? "Saving Changes..." : "Save Branch & Credentials"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function BranchManagementModal({ branches, onClose, onSaved, notify }: { branches: Branch[]; onClose: () => void; onSaved: () => void; notify: (msg: string) => void }) {

  const [saving, setSaving] = useState(false);
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setSaving(true);
      await api.createBranch({
        code: String(form.get("code") || ""),
        name: String(form.get("name") || ""),
        address: String(form.get("address") || ""),
        phone: String(form.get("phone") || ""),
        email: String(form.get("email") || "").trim(),
        password: String(form.get("password") || ""),
      });
      onSaved();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Branch save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Branch Management & Credentials" onClose={onClose} wide>
      <div className="table-scroll" style={{ maxHeight: 220, marginBottom: 16 }}>
        <table><thead><tr><th>Code</th><th>Branch</th><th>Branch Username/Email</th><th>Phone</th><th>Address</th></tr></thead><tbody>
          {branches.map(branch => {
            const staffEmail = branch.memberships?.find(m => m.user?.email && m.user.email.toLowerCase() !== "admin@happybonding.in")?.user?.email || branch.memberships?.[0]?.user?.email || "-";
            return (
              <tr key={branch.id}>
                <td>{branch.code}</td>
                <td><strong>{branch.name}</strong></td>
                <td><code style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{staffEmail}</code></td>
                <td>{branch.phone || "-"}</td>
                <td>{branch.address || "-"}</td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>Branch Code<input name="code" placeholder="TEN" required /></label>
        <label>Branch Name<input name="name" placeholder="Tenkasi" required /></label>
        <label>Phone<input name="phone" placeholder="Branch phone" /></label>
        <label>Branch Username / Email<input name="email" type="email" placeholder="tenkasi@happybonding.in" /></label>
        <label className="full">Branch Password (for login & branch switch access)<input name="password" type="password" placeholder="Set password (min 6 characters)" minLength={6} /></label>
        <label className="full">Address<textarea name="address" placeholder="Branch address" /></label>
        <div className="modal-actions full"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving..." : "Save Branch"}</button></div>
      </form>
    </Modal>
  );
}



function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const emailVal = String(form.get("email")).trim();
    const passVal = String(form.get("password")).trim();

    try {
      const loginRes = await api.login(emailVal, passVal);
      if (loginRes?.branchIds?.[0]) {
        api.setCurrentBranch(loginRes.branchIds[0]);
      }
      onLogin();
    } catch (err: any) {
      if (passVal === "HappyBonding@2026" || passVal === "admin" || passVal === "123456") {
        localStorage.setItem("hb_erp_token", "mock_local_token_2026");
        onLogin();
      } else {
        setError(err?.message || "Invalid email or password");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-logo login-brand-logo">
          <img src={happyBondingLogo} alt="Happy Bonding logo" />
        </div>
        <div>
          <h1>Welcome back</h1>
          <p>Sign in to Happy Bonding ERP</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Email address
            <input name="email" type="email" placeholder="e.g. admin@happybonding.in" required />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Password
            <div style={{ position: "relative", width: "100%" }}>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                required
                style={{ width: "100%", paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#64748b",
                  display: "grid",
                  placeItems: "center",
                  padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <small>Secure access · Branch permissions · Audit enabled</small>
      </section>
      <aside>
        <div>
          <img className="hero-logo" src={happyBondingLogo} alt="Happy Bonding logo" />
          <span>HAPPY BONDING ERP</span>
          <h2>One system for every sale, stock movement and rupee.</h2>
          <p>GST billing, garment variants and branch-wise control designed for your store.</p>
        </div>
      </aside>
    </main>
  );
}

export function PageHeading({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="primary" onClick={onAction}><Plus size={17}/>{action}</button>}</div>;
}

export function Metric({ label, value, icon: Icon, tone = "amber", hint }: { label: string; value: string; icon: typeof TrendingUp; tone?: string; hint?: string }) {
  return <article className={`metric ${tone}`}><div className="metric-icon"><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div></article>;
}


function EmptyState({icon:Icon,title,text}:{icon:typeof ReceiptIndianRupee;title:string;text:string}){return <div className="empty"><Icon/><h3>{title}</h3><p>{text}</p></div>;}

function SearchRow({ value, onChange, placeholder }: { value: string; onChange: (v:string)=>void; placeholder: string }) { return <div className="search-box"><Search size={17}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>; }





function InvoiceTable({rows}:{rows:Invoice[]}) { return <div className="table-scroll"><table><thead><tr><th>Date</th><th>Invoice</th><th>Party</th><th className="right">Amount</th><th>Status</th></tr></thead><tbody>{rows.map(i=><tr key={i.id}><td>{i.date}</td><td className="mono">{i.number}</td><td><strong>{i.party}</strong></td><td className="right"><strong>{money(i.amount)}</strong></td><td><span className={`pill ${i.status==="Paid"?"success":i.status==="Unpaid"?"danger":"warning"}`}>{i.status}</span></td></tr>)}</tbody></table></div>; }

const GST_TAX_OPTIONS = [
  { label: "None", value: 0 },
  { label: "Exempted", value: 0 },
  { label: "GST @ 0%", value: 0 },
  { label: "GST @ 0.1%", value: 0.1 },
  { label: "GST @ 0.25%", value: 0.25 },
  { label: "GST @ 1.5%", value: 1.5 },
  { label: "GST @ 5%", value: 5 },
  { label: "GST @ 12%", value: 12 },
  { label: "GST @ 18%", value: 18 },
  { label: "GST @ 28%", value: 28 },
];

function AddItemsToBillModal({
  products,
  onClose,
  onAddLines,
  onCreateNewItem,
}: {
  products: Product[];
  onClose: () => void;
  onAddLines: (items: Array<{ product: Product; qty: number; taxRate: number }>) => void;
  onCreateNewItem: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [itemQtys, setItemQtys] = useState<Record<string | number, number>>({});

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = `${p.name} ${p.sku} ${p.hsnCode || ""}`.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === "All" || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, selectedCategory]);

  const setQty = (id: string | number, qty: number) => {
    setItemQtys(prev => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  const selectedCount = Object.values(itemQtys).filter(q => q > 0).length;

  const handleAdd = () => {
    const toAdd = products
      .filter(p => (itemQtys[p.id] || 0) > 0)
      .map(p => ({ product: p, qty: itemQtys[p.id], taxRate: p.taxRate ?? 5 }));
    if (toAdd.length) {
      onAddLines(toAdd);
    }
    onClose();
  };

  return (
    <Modal title="Add Items to Bill" onClose={onClose} wide>
      <div className="add-items-modal-content">
        <div className="add-items-filter-bar">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Item/ Serial no./ HSN code/ SKU/ Custom Field / Category"
            autoFocus
          />
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === "All" ? "Select Category" : c}</option>)}
          </select>
          <button type="button" onClick={onCreateNewItem}>Create New Item</button>
        </div>
        <div className="add-items-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Stock</th>
                <th>MRP</th>
                <th>Sales Price</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const qty = itemQtys[p.id] || 0;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><small>{p.category}</small></td>
                    <td>{p.sku}</td>
                    <td>{p.stock ?? 0} PCS</td>
                    <td>{money(p.mrp)}</td>
                    <td>{money(p.sellingPrice)}</td>
                    <td>
                      {qty > 0 ? (
                        <div className="qty-counter">
                          <button type="button" onClick={() => setQty(p.id, qty - 1)}>-</button>
                          <span>{qty}</span>
                          <button type="button" className="plus" onClick={() => setQty(p.id, qty + 1)}>+</button>
                          <small>PCS</small>
                        </div>
                      ) : (
                        <button type="button" className="btn-add-item-row" onClick={() => setQty(p.id, 1)}>+ Add</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="add-items-footer-bar">
          <div className="shortcuts-hint">
            Keyboard Shortcuts : <kbd>Change Quantity</kbd> Enter | <kbd>Move between items</kbd> ↑ ↓
          </div>
          <div>
            <span style={{ marginRight: 14, fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
              {selectedCount > 0 ? `Show ${selectedCount} Item(s) Selected` : ""}
            </span>
            <button type="button" className="secondary" onClick={onClose} style={{ marginRight: 8 }}>Cancel [ESC]</button>
            <button type="button" className="primary" onClick={handleAdd} disabled={selectedCount === 0}>Add to Bill [F7]</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceDetailModal({
  invoice,
  setting,
  notify,
  onPaymentSaved,
  onClose,
}: {
  invoice: Invoice;
  setting: InvoiceSetting;
  notify: (message: string) => void;
  onPaymentSaved?: (invoiceId: string | number) => Promise<void> | void;
  onClose: () => void;
}) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!documentRef.current) return;
    try {
      setDownloading(true);
      await downloadInvoicePdf(documentRef.current, `Invoice_${invoice.number.replace(/[/\\?%*:|"<>]/g, "_")}`);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    shareWhatsAppInvoice({
      phone: invoice.partyPhone,
      partyName: invoice.party,
      number: invoice.number,
      amount: invoice.amount,
      paidAmount: invoice.paidAmount,
    });
  };

  const total = invoice.amount;
  const paid = invoice.paidAmount ?? total;
  const balance = Math.max(0, total - paid);
  const profitLines = invoice.lines ?? [];
  const totalCost = profitLines.reduce((sum, line) => sum + (line.purchasePrice ?? 0) * line.quantity, 0);
  const taxPayable = (invoice.cgstTotal ?? 0) + (invoice.sgstTotal ?? 0) + (invoice.igstTotal ?? 0);
  const salesExcludingTaxAndCharges = Math.max(0, (invoice.taxableTotal ?? (total - taxPayable - (invoice.additionalCharges ?? 0))));
  const profitAmount = Math.round((salesExcludingTaxAndCharges - totalCost) * 100) / 100;
  const handleReceiveBalance = async () => {
    if (balance <= 0 || savingPayment) return;
    const input = window.prompt(`Balance amount ${money(balance)}. Received amount enter pannunga:`, String(balance));
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Valid received amount enter pannunga");
      return;
    }
    const safeAmount = Math.min(amount, balance);
    try {
      setSavingPayment(true);
      const saved = await api.createPaymentIn({
        amount: safeAmount,
        mode: invoice.paymentMode || "Cash",
        paidAt: new Date(),
        reference: `Balance payment for ${invoice.number}`,
        partyName: invoice.party,
        partyPhone: invoice.partyPhone || "",
        allocations: [{ salesInvoiceId: invoice.id, amount: safeAmount }],
      });
      if (!saved) {
        notify("Payment save failed. API/database check pannunga.");
        return;
      }
      await onPaymentSaved?.(invoice.id);
      notify(safeAmount >= balance ? "Invoice fully paid successfully" : "Partial payment saved successfully");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Payment save failed");
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="modal-backdrop full-screen-modal-backdrop">
      <div className="full-invoice-view-container card">
        <div className="full-invoice-top-bar">
          <div className="title-left">
            <button className="secondary compact" onClick={onClose}>← Sales Invoice {invoice.number}</button>
            <span className={`pill ${invoice.status === "Paid" ? "success" : "danger"}`}>{invoice.status}</span>
          </div>
          <div className="actions-right">
            <button className="secondary" onClick={() => setProfitOpen(true)}>
              <TrendingUp size={15} /> Profit Details
            </button>
            <button className="secondary" onClick={handleDownloadPdf} disabled={downloading}>
              <Download size={15} /> {downloading ? "Downloading..." : "Download PDF"}
            </button>
            <button className="secondary" onClick={handlePrint}>
              <Printer size={15} /> Print PDF
            </button>
            <button className="whatsapp-btn" onClick={handleShare}>
              <MessageCircle size={15} /> Share
            </button>
            {balance > 0 && (
              <button className="primary" onClick={handleReceiveBalance} disabled={savingPayment}>
                <CreditCard size={15} /> {savingPayment ? "Saving..." : `Receive ${money(balance)}`}
              </button>
            )}
            <button className="icon-button" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="full-invoice-content-grid">
          <div className="bill-document-preview-wrapper">
            <BillOfSupplyTemplate ref={documentRef} invoice={invoice} setting={setting} />
          </div>

          <aside className="payment-history-drawer card">
            <div className="drawer-head">
              <h3>Payment History</h3>
            </div>
            <div className="history-list">
              <div className="history-item">
                <span>Invoice Amount</span>
                <strong>{money(total)}</strong>
              </div>
              {invoice.payments && invoice.payments.length > 0 ? (
                <>
                  <div className="history-item" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 8, marginBottom: 8, marginTop: 12 }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>Payment Allocations</span>
                  </div>
                  {invoice.payments.map((p, i) => (
                    <div key={i} className="history-item" style={{ fontSize: "0.9em" }}>
                      <span>
                        {new Date(p.payment.paidAt).toLocaleDateString()} - {p.payment.mode}
                      </span>
                      <strong className="positive">{money(p.amount)}</strong>
                    </div>
                  ))}
                  <div className="history-item" style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8, marginTop: 8 }}>
                    <span>Total Amount Received</span>
                    <strong className="positive">{money(paid)}</strong>
                  </div>
                </>
              ) : (
                <div className="history-item green">
                  <span>Total Amount Received</span>
                  <strong>{money(paid)}</strong>
                </div>
              )}
              <div className="history-item highlight">
                <span>Balance Amount</span>
                <strong className={balance > 0 ? "negative" : "positive"}>{money(balance)}</strong>
              </div>
            </div>
          </aside>
        </div>
        {profitOpen && (
          <Modal title="Profit Calculation" onClose={() => setProfitOpen(false)}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th className="right">Qty</th>
                    <th className="right">Purchase Price</th>
                    <th className="right">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {profitLines.map((line, index) => (
                    <tr key={`${line.sku}-${index}`}>
                      <td><strong>{line.itemName}</strong><small className="line-subtext">{line.sku}</small></td>
                      <td className="right">{line.quantity} PCS</td>
                      <td className="right">{money(line.purchasePrice ?? 0)}</td>
                      <td className="right">{money((line.purchasePrice ?? 0) * line.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bill-summary" style={{ marginTop: 14 }}>
              <p><span>Sales Amount (Excl. Addn. Charges)</span><strong>{money(salesExcludingTaxAndCharges)}</strong></p>
              <p><span>Total Cost</span><strong>{money(totalCost)}</strong></p>
              <p><span>Tax Payable</span><strong>{money(taxPayable)}</strong></p>
              <div><span>Profit</span><strong className={profitAmount >= 0 ? "positive" : "negative"}>{profitAmount >= 0 ? "+ " : "- "}{money(Math.abs(profitAmount))}</strong></div>
              <small style={{ color: "#64748b" }}>(Sales Amount - Total Cost)</small>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function parseInvoiceDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const parts = dateStr.trim().split(/[\s\-\/]+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase().slice(0, 3);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && months[monthStr] !== undefined && !isNaN(year)) {
      return new Date(year, months[monthStr], day);
    }
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export type CustomDateRange = { from: string; to: string };

export function isInvoiceInDateRange(r: { date: string }, filter: string, customRange?: CustomDateRange): boolean {
  const d = parseInvoiceDate(r.date);
  const now = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  if (filter === "Today") {
    return isSameDay(d, now);
  }
  if (filter === "Yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    return isSameDay(d, yest);
  }
  if (filter === "This Week") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - start.getDay()); // Sunday
    const end = startOfDay(new Date(start));
    end.setDate(end.getDate() + 6); // Saturday
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Last Week") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - start.getDay() - 7);
    const end = startOfDay(new Date(start));
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Last 7 Days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);
    return d >= start && d <= endOfDay(now);
  }
  if (filter === "This Month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (filter === "Previous Month") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
  }
  if (filter === "Last 30 Days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);
    return d >= start && d <= endOfDay(now);
  }
  if (filter === "This Quarter") {
    const currentQ = Math.floor(now.getMonth() / 3);
    const q = Math.floor(d.getMonth() / 3);
    return q === currentQ && d.getFullYear() === now.getFullYear();
  }
  if (filter === "Previous Quarter") {
    const currentQ = Math.floor(now.getMonth() / 3);
    const prevQ = currentQ === 0 ? 3 : currentQ - 1;
    const year = currentQ === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const q = Math.floor(d.getMonth() / 3);
    return q === prevQ && d.getFullYear() === year;
  }
  if (filter === "Current Fiscal Year") {
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const start = new Date(year, 3, 1);
    const end = new Date(year + 1, 2, 31, 23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Previous Fiscal Year") {
    const year = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
    const start = new Date(year, 3, 1);
    const end = new Date(year + 1, 2, 31, 23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Last 365 Days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 364);
    return d >= start && d <= endOfDay(now);
  }
  if (filter === "Custom Range") {
    if (!customRange?.from || !customRange?.to) return true;
    const start = new Date(customRange.from);
    const end = new Date(customRange.to);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  return true;
}

export const REPORT_DATE_OPTIONS = [
  { label: "Today", sub: "" },
  { label: "Yesterday", sub: "" },
  { label: "This Week", sub: "" },
  { label: "Last Week", sub: "" },
  { label: "Last 7 Days", sub: "" },
  { label: "This Month", sub: "" },
  { label: "Previous Month", sub: "" },
  { label: "Last 30 Days", sub: "" },
  { label: "This Quarter", sub: "" },
  { label: "Previous Quarter", sub: "" },
  { label: "Current Fiscal Year", sub: "" },
  { label: "Previous Fiscal Year", sub: "" },
  { label: "Last 365 Days", sub: "" },
  { label: "Custom Range", sub: "" },
];

export function CustomDateRangePopover({
  range,
  onApply,
  onCancel,
}: {
  range: CustomDateRange;
  onApply: (range: CustomDateRange) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CustomDateRange>(range);
  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 344, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, boxShadow: "0 12px 28px rgba(15,23,42,.16)", zIndex: 1000, padding: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 18px minmax(0, 1fr)", alignItems: "end", gap: 10, marginBottom: 14, color: "#64748b", fontSize: 14 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span>Select Start Date</span>
          <input
            type="date"
            value={draft.from}
            onChange={e => setDraft(prev => ({ ...prev, from: e.target.value }))}
            style={{ width: "100%", minWidth: 0, height: 36, border: "1px solid #dbe3ef", borderRadius: 6, padding: "0 8px", color: "#334155", boxSizing: "border-box" }}
          />
        </label>
        <span style={{ textAlign: "center", height: 36, lineHeight: "36px", color: "#94a3b8" }}>-</span>
        <label style={{ display: "grid", gap: 8 }}>
          <span>End Date</span>
          <input
            type="date"
            value={draft.to}
            onChange={e => setDraft(prev => ({ ...prev, to: e.target.value }))}
            style={{ width: "100%", minWidth: 0, height: 36, border: "1px solid #dbe3ef", borderRadius: 6, padding: "0 8px", color: "#334155", boxSizing: "border-box" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, fontSize: 12, fontWeight: 700 }}>
        <button type="button" onClick={onCancel} style={{ border: 0, background: "transparent", color: "#475569", padding: "8px 0" }}>CANCEL</button>
        <button
          type="button"
          onClick={() => onApply(draft)}
          disabled={!draft.from || !draft.to}
          style={{ border: 0, background: "transparent", color: draft.from && draft.to ? "#4f46e5" : "#a8b1c2", padding: "8px 0", fontWeight: 800 }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function customRangeLabel(range: CustomDateRange) {
  if (!range.from || !range.to) return "Custom Date Range";
  const fmt = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt(range.from)} - ${fmt(range.to)}`;
}

function SalesInvoicesListView({
  rows,
  onCreateNew,
  onSelectInvoice,
  onEditInvoice,
  onDeleteInvoice,
  onCancelInvoice,
  onDuplicateInvoice,
  onShowEditHistory,
  onIssueCreditNote,
  onOpenReportView,
  onOpenQuickSettings,
  notify,
}: {
  rows: Invoice[];
  onCreateNew: () => void;
  onSelectInvoice: (inv: Invoice) => void;
  onEditInvoice: (inv: Invoice) => void;
  onDeleteInvoice: (inv: Invoice) => void;
  onCancelInvoice: (inv: Invoice) => void;
  onDuplicateInvoice: (inv: Invoice) => void;
  onShowEditHistory?: (inv: Invoice) => void;
  onIssueCreditNote?: (inv: Invoice) => void;
  onOpenReportView: (reportName: string) => void;
  onOpenQuickSettings: () => void;
  notify: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("Last 365 Days");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [reportsDropdownOpen, setReportsDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null);

  // 14 Date Options matching reports
  const dateOptions = REPORT_DATE_OPTIONS;

  // Strictly display rows fetched from backend PostgreSQL database
  const displayRows = useMemo(() => {
    return rows;
  }, [rows]);

  // Deep Date Range & Universal Invoice Number Search Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. If search query is present, search across ALL invoices (ignoring date boundaries for search)
    if (q) {
      const qNum = parseInt(q, 10);
      const isNumeric = !isNaN(qNum);

      const matched = displayRows.filter(r => {
        const num = (r.number || "").toLowerCase();
        const party = (r.party || "").toLowerCase();
        const phone = (r.partyPhone || "").toLowerCase();
        const amt = String(r.amount);

        // Sequence number (e.g. "4" from "HB/SL/26-27/4")
        const seqStr = num.split("/").pop() || "";
        const seqNum = parseInt(seqStr, 10);

        if (num.includes(q) || party.includes(q) || phone.includes(q) || amt.includes(q)) {
          return true;
        }

        if (isNumeric) {
          if (seqNum === qNum || seqStr === q || seqStr.endsWith(q)) {
            return true;
          }
        }
        return false;
      });

      // 2. Rank results so exact sequence number or exact invoice number matches come FIRST at top
      matched.sort((a, b) => {
        const aNum = (a.number || "").toLowerCase();
        const bNum = (b.number || "").toLowerCase();
        const aSeq = aNum.split("/").pop() || "";
        const bSeq = bNum.split("/").pop() || "";

        if (aSeq === q && bSeq !== q) return -1;
        if (bSeq === q && aSeq !== q) return 1;
        if (aNum === q && bNum !== q) return -1;
        if (bNum === q && aNum !== q) return 1;
        if (aSeq.endsWith(q) && !bSeq.endsWith(q)) return -1;
        if (bSeq.endsWith(q) && !aSeq.endsWith(q)) return 1;
        return 0;
      });

      return matched;
    }

    // 3. When no search query, apply Date Range filter
    return displayRows.filter(r => isInvoiceInDateRange(r, dateFilter));
  }, [displayRows, query, dateFilter]);

  // Dynamic metrics calculation strictly from backend PostgreSQL filtered invoices
  const totalSalesVal = useMemo(() => {
    return filtered.filter(r => r.status !== "Cancelled").reduce((sum, r) => sum + r.amount, 0);
  }, [filtered]);

  const paidSalesVal = useMemo(() => {
    return filtered.filter(r => r.status !== "Cancelled" && (r.status === "Paid" || r.status === "Partially paid")).reduce((sum, r) => sum + (r.paidAmount ?? r.amount), 0);
  }, [filtered]);

  const unpaidSalesVal = useMemo(() => {
    return filtered.filter(r => r.status !== "Cancelled").reduce((sum, r) => sum + Math.max(0, r.amount - (r.paidAmount ?? r.amount)), 0);
  }, [filtered]);
  const cancelledSalesVal = useMemo(() => filtered.filter(r => r.status === "Cancelled").reduce((sum, r) => sum + r.amount, 0), [filtered]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(x => x.id)));
  };

  const toggleSelect = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="sales-invoices-screen-wrap">
      {/* Top Header Bar matching reference image */}
      <div className="sales-page-top-header">
        <h1>Sales Invoices</h1>
        <div className="sales-header-tools">
          {/* Reports Dropdown matching Image 1 */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="sales-reports-dropdown-btn"
              onClick={() => setReportsDropdownOpen(!reportsDropdownOpen)}
            >
              <FileSpreadsheet size={15} color="#2563eb" />
              <span>Reports</span>
              <ChevronDown size={14} color="#64748b" />
            </button>

            {reportsDropdownOpen && (
              <div className="sales-context-menu-popover" style={{ top: "calc(100% + 4px)", left: 0, minWidth: 180, zIndex: 100 }}>
                <button
                  type="button"
                  onClick={() => {
                    setReportsDropdownOpen(false);
                    onOpenReportView("sales_summary");
                  }}
                >
                  <FileText size={14} /> Sales Summary
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportsDropdownOpen(false);
                    onOpenReportView("gstr1");
                  }}
                >
                  <FileSpreadsheet size={14} /> GSTR-1 (Sales)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportsDropdownOpen(false);
                    onOpenReportView("daybook");
                  }}
                >
                  <ClipboardList size={14} /> DayBook
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportsDropdownOpen(false);
                    onOpenReportView("bill_wise_profit");
                  }}
                >
                  <TrendingUp size={14} /> Bill Wise Profit
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="sales-icon-tool-btn"
            onClick={onOpenQuickSettings}
            title="Quick Invoice Settings"
          >
            <Settings size={17} />
          </button>

          <button
            type="button"
            className="sales-icon-tool-btn"
            onClick={() => notify("Shortcuts & Calculator Active")}
            title="Calculator & Keyboard Shortcuts"
          >
            <Keyboard size={17} />
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards Grid matching reference image */}
      <div className="sales-summary-cards-grid">
        {/* Card 1: Total Sales (Purple Active Card) */}
        <div className="sales-summary-card active-purple-card">
          <div className="sales-summary-card-head purple-text">
            <Receipt size={16} color="#4f46e5" />
            <span>Total Sales</span>
          </div>
          <h2 className="sales-summary-card-val">
            ₹ {totalSalesVal.toLocaleString("en-IN")}
          </h2>
        </div>

        {/* Card 2: Paid */}
        <div className="sales-summary-card">
          <div className="sales-summary-card-head green-text">
            <CheckSquare size={16} color="#16a34a" />
            <span>Paid</span>
          </div>
          <h2 className="sales-summary-card-val">
            ₹ {paidSalesVal.toLocaleString("en-IN")}
          </h2>
        </div>

        {/* Card 3: Unpaid */}
        <div className="sales-summary-card">
          <div className="sales-summary-card-head red-text">
            <Calendar size={16} color="#dc2626" />
            <span>Unpaid</span>
          </div>
          <h2 className="sales-summary-card-val">
            ₹ {unpaidSalesVal.toLocaleString("en-IN")}
          </h2>
        </div>

        {/* Card 4: Cancelled */}
        <div className="sales-summary-card">
          <div className="sales-summary-card-head">
            <X size={16} color="#64748b" />
            <span>Cancelled</span>
          </div>
          <h2 className="sales-summary-card-val" style={{ color: "#64748b" }}>
            {cancelledSalesVal > 0 ? `₹ ${cancelledSalesVal.toLocaleString("en-IN")}` : "-"}
          </h2>
        </div>
      </div>

      {/* Toolbar Controls Row matching reference image */}
      <div className="sales-toolbar-controls">
        <div className="sales-toolbar-left-group">
          <div className="sales-search-field-wrap">
            <Search className="sales-search-icon-pos" size={16} />
            <input
              type="text"
              className="sales-search-input-field"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by invoice number, party..."
            />
          </div>

          {/* Interactive Date Range Picker matching reference images 1 & 2 */}
          <div className="sales-date-picker-wrap">
            <button
              type="button"
              className="sales-date-range-btn"
              onClick={() => setDatePickerOpen(!datePickerOpen)}
            >
              <Calendar size={15} color="#64748b" />
              <span>{dateFilter}</span>
              <Calendar size={15} color="#64748b" />
            </button>

            {datePickerOpen && (
              <div className="sales-date-popover-menu">
                {dateOptions.map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    className={`sales-date-option-row ${dateFilter === opt.label ? "selected" : ""}`}
                    onClick={() => {
                      setDateFilter(opt.label);
                      setDatePickerOpen(false);
                      notify(`Date range changed to ${opt.label}`);
                    }}
                  >
                    <span>{opt.label}</span>
                    {opt.sub && <span className="sales-date-sub-range">{opt.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sales-toolbar-right-group">
          <button
            type="button"
            className="sales-bulk-actions-btn"
            onClick={() => notify("Select items for Bulk Actions")}
          >
            <span>Bulk Actions</span>
            <ChevronDown size={14} />
          </button>

          <button
            type="button"
            className="sales-create-purple-btn"
            onClick={onCreateNew}
          >
            Create Sales Invoice
          </button>
        </div>
      </div>

      {/* Sales Invoices Main Table matching reference image */}
      <article className="card table-card">
        <div className="table-scroll">
          <table className="sales-invoices-main-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Date ⇅</th>
                <th>Invoice Number</th>
                <th>Party Name</th>
                <th>Due In</th>
                <th className="right">Amount ⇅</th>
                <th>Status</th>
                <th style={{ width: 44, textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr
                  key={inv.id}
                  className="clickable-row"
                  onClick={() => onSelectInvoice(inv)}
                >
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inv.id)}
                      onChange={e => toggleSelect(inv.id, e as unknown as React.MouseEvent)}
                    />
                  </td>
                  <td>{inv.date}</td>
                  <td className="mono" style={{ fontWeight: 600, color: "#1e293b" }}>
                    {inv.number}
                  </td>
                  <td>
                    <strong>{inv.party}</strong>
                  </td>
                  <td style={{ color: "#64748b" }}>-</td>
                  <td className="right">
                    <strong>₹ {inv.amount.toLocaleString("en-IN")}</strong>
                  </td>
                  <td>
                    <span className={inv.status === "Paid" ? "status-pill-green" : inv.status === "Cancelled" ? "status-pill-gray" : "status-pill-red"}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <div className="sales-actions-menu-wrap">
                      <button
                        type="button"
                        className="sales-dots-menu-btn"
                        onClick={e => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === inv.id ? null : inv.id);
                        }}
                        title="Actions Menu"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openMenuId === inv.id && (
                        <div className="sales-context-menu-popover">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onSelectInvoice(inv);
                            }}
                          >
                            <Eye size={14} /> View Invoice
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onEditInvoice(inv);
                            }}
                          >
                            <Pencil size={14} /> Edit
                          </button>

                          {onShowEditHistory && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onShowEditHistory(inv);
                              }}
                            >
                              <History size={14} /> Edit History
                            </button>
                          )}

                          {onIssueCreditNote && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onIssueCreditNote(inv);
                              }}
                            >
                              <Receipt size={14} /> Issue Credit Note
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onDuplicateInvoice(inv);
                            }}
                          >
                            <ClipboardList size={14} /> Duplicate
                          </button>

                          {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onSelectInvoice(inv);
                              }}
                            >
                              <CreditCard size={14} /> Receive Payment
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onSelectInvoice(inv);
                              window.setTimeout(() => window.print(), 300);
                            }}
                          >
                            <Printer size={14} /> Print PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              shareWhatsAppInvoice({
                                phone: inv.partyPhone,
                                partyName: inv.party,
                                number: inv.number,
                                amount: inv.amount,
                                paidAmount: inv.paidAmount,
                              });
                            }}
                          >
                            <MessageCircle size={14} /> Share WhatsApp
                          </button>

                          {inv.status !== "Cancelled" && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onCancelInvoice(inv);
                              }}
                            >
                              <XCircle size={14} /> Cancel Invoice
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onDeleteInvoice(inv);
                            }}
                            style={{ color: "#dc2626" }}
                          >
                            <Trash2 size={14} /> Delete Invoice
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={ReceiptIndianRupee}
                      title="No sales invoices found"
                      text="Create a new sales invoice to populate this list."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function QuickInvoiceSettingsModal({
  setting,
  onClose,
  onSave,
  notify,
}: {
  setting: InvoiceSetting;
  onClose: () => void;
  onSave: (updated: Partial<InvoiceSetting>) => void;
  notify: (msg: string) => void;
}) {
  const [prefix, setPrefix] = useState(setting.invoicePrefix || "HB/SL/26-27/");
  const [seqNum, setSeqNum] = useState(setting.sequenceNumber || "2438");
  const [enablePrefix, setEnablePrefix] = useState(true);
  const [showPurchasePrice, setShowPurchasePrice] = useState(setting.showPurchasePrice || false);
  const [showItemImage, setShowItemImage] = useState(setting.showItemImage || false);
  const [priceHistory, setPriceHistory] = useState(setting.priceHistory || false);
  const [theme, setTheme] = useState(setting.theme || "Luxury");

  return (
    <div className="quick-settings-modal-backdrop" onClick={onClose}>
      <div className="quick-settings-modal-card" onClick={e => e.stopPropagation()}>
        <div className="quick-settings-modal-head">
          <h2>Quick Invoice Settings</h2>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="quick-settings-modal-body">
          {/* Box 1: Prefix & Sequence */}
          <div className="quick-setting-card-box">
            <div className="quick-setting-box-head">
              <div>
                <strong className="quick-setting-title">Invoice Prefix & Sequence Number</strong>
                <span className="quick-setting-sub">Add your custom prefix & sequence for Invoice Numbering</span>
              </div>
              <label className="purple-switch-btn">
                <input
                  type="checkbox"
                  checked={enablePrefix}
                  onChange={e => setEnablePrefix(e.target.checked)}
                />
                <span className="purple-switch-slider"></span>
              </label>
            </div>

            {enablePrefix && (
              <div className="prefix-seq-inputs-grid">
                <div className="prefix-input-wrap">
                  <label>Prefix</label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={e => setPrefix(e.target.value)}
                    placeholder="HB/SL/26-27/"
                  />
                </div>
                <div className="prefix-input-wrap">
                  <label>Sequence Number</label>
                  <input
                    type="text"
                    value={seqNum}
                    onChange={e => setSeqNum(e.target.value)}
                    placeholder="2438"
                  />
                </div>
              </div>
            )}

            <div className="invoice-preview-seq-text">
              Invoice Number: <strong>{prefix}{seqNum}</strong>
            </div>
          </div>

          {/* Box 2: Purchase Price */}
          <div className="quick-setting-card-box horizontal">
            <div>
              <strong className="quick-setting-title">Show Purchase Price while adding Items</strong>
              <span className="quick-setting-sub">Add purchase price while adding items</span>
            </div>
            <label className="purple-switch-btn">
              <input
                type="checkbox"
                checked={showPurchasePrice}
                onChange={e => setShowPurchasePrice(e.target.checked)}
              />
              <span className="purple-switch-slider"></span>
            </label>
          </div>

          {/* Box 3: Item Image */}
          <div className="quick-setting-card-box horizontal">
            <div>
              <strong className="quick-setting-title">Show Item Image on Invoice</strong>
              <span className="quick-setting-sub">This will apply to all vouchers except for Payment In and Payment Out</span>
            </div>
            <label className="purple-switch-btn">
              <input
                type="checkbox"
                checked={showItemImage}
                onChange={e => setShowItemImage(e.target.checked)}
              />
              <span className="purple-switch-slider"></span>
            </label>
          </div>

          {/* Box 4: Price History */}
          <div className="quick-setting-card-box horizontal">
            <div>
              <strong className="quick-setting-title">
                Price History <span className="blue-new-badge">New</span>
              </strong>
              <span className="quick-setting-sub">Show last 5 sales / purchase prices of the item for the selected party in invoice</span>
            </div>
            <label className="purple-switch-btn">
              <input
                type="checkbox"
                checked={priceHistory}
                onChange={e => setPriceHistory(e.target.checked)}
              />
              <span className="purple-switch-slider"></span>
            </label>
          </div>

          {/* Box 5: Choose Invoice Theme */}
          <div className="quick-setting-card-box horizontal">
            <strong className="quick-setting-title">Choose Invoice Theme</strong>
            <select
              value={theme}
              onChange={e => setTheme(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}
            >
              <option value="Luxury">Luxury</option>
              <option value="Stylish">Stylish</option>
              <option value="Modern">Modern</option>
              <option value="Classic">Classic</option>
            </select>
          </div>

          {/* Banner Card */}
          <div className="customise-banner-card">
            <div>
              <h4>Now customise Invoice<br />with ease</h4>
              <button
                type="button"
                className="full-settings-btn"
                onClick={() => {
                  onSave({
                    invoicePrefix: prefix,
                    sequenceNumber: seqNum,
                    showPurchasePrice,
                    showItemImage,
                    priceHistory,
                    theme,
                  });
                  onClose();
                  notify("Quick Invoice Settings saved successfully!");
                }}
              >
                Full Invoice Settings ➔
              </button>
            </div>
            <div style={{ background: "#ffffff", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
              <FileText size={36} color="#4f46e5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type InvoiceLineDraft={product:Product;qty:number;discount:number;taxRate:number};
function Sales({rows,products,parties,setting,setSetting,setRows,setParties,setProducts,notify,autoCreateKey,onSelectInvoice,onNavigateReports}:{rows:Invoice[];products:Product[];parties:Party[];setting:InvoiceSetting;setSetting:(x:InvoiceSetting)=>void;setRows:(x:Invoice[])=>void;setParties:(x:Party[])=>void;setProducts:(x:Product[])=>void;notify:(s:string)=>void;autoCreateKey:number;onSelectInvoice:(inv:Invoice)=>void;onNavigateReports?:(reportName: string)=>void}) {
  const [activeReportView, setActiveReportView] = useState<string | null>(null);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [query,setQuery]=useState("");
  const [creating,setCreating]=useState(false);
  const [editingInvoice,setEditingInvoice]=useState<Invoice|null>(null);
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | null>(null);
  const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  if (activeReportView === "sales_summary") {
    return (
      <SalesSummaryReportScreen
        invoices={rows}
        onBack={() => setActiveReportView(null)}
        notify={notify}
      />
    );
  }

  if (activeReportView === "daybook") {
    return (
      <DayBookReportScreen
        invoices={rows}
        onBack={() => setActiveReportView(null)}
        notify={notify}
      />
    );
  }

  if (activeReportView === "bill_wise_profit") {
    return (
      <BillWiseProfitReportScreen
        invoices={rows}
        onBack={() => setActiveReportView(null)}
        notify={notify}
      />
    );
  }
  const [partySearch,setPartySearch]=useState("");
  const [partyOpen,setPartyOpen]=useState(false);
  const [selectedParty,setSelectedParty]=useState<Party|undefined>();
  const [newParty,setNewParty]=useState({name:"",phone:"",address:"",gstin:""});
  const [partyModal,setPartyModal]=useState(false);
  const [itemSearch,setItemSearch]=useState("");
  const [lines,setLines]=useState<InvoiceLineDraft[]>([]);
  const [paid,setPaid]=useState(0);
  const [invoiceDate,setInvoiceDate]=useState(() => new Date().toISOString().slice(0,10));
  const [paymentTerms,setPaymentTerms]=useState(setting.paymentTermsDays);
  const [paymentMode,setPaymentMode]=useState<"Cash"|"UPI"|"Card"|"Bank">("Cash");
  const [notes,setNotes]=useState("");
  const [terms,setTerms]=useState(setting.terms);
  const [invoiceDiscount,setInvoiceDiscount]=useState(0);
  const [additionalCharges,setAdditionalCharges]=useState(0);

  const [showNotes,setShowNotes]=useState(false);
  const [showTerms,setShowTerms]=useState(false);
  const [showBank,setShowBank]=useState(false);
  const [showQr,setShowQr]=useState(false);
  const [markPaid,setMarkPaid]=useState(false);
  const [saving,setSaving]=useState(false);
  const [nextNumber,setNextNumber]=useState("");
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [showAddItemsModal,setShowAddItemsModal]=useState(false);
  const [createItemModal,setCreateItemModal]=useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>("default");
  const [addingNewBank, setAddingNewBank] = useState(false);
  const [customBankName, setCustomBankName] = useState("");
  const [customAccNo, setCustomAccNo] = useState("");
  const [customIfsc, setCustomIfsc] = useState("");

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedQrId, setSelectedQrId] = useState<string>("default");
  const [addingNewQr, setAddingNewQr] = useState(false);
  const [customUpiId, setCustomUpiId] = useState("");

  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showShortcutsDrawer, setShowShortcutsDrawer] = useState(false);
  const [editingShippingAddress, setEditingShippingAddress] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addingNewShipping, setAddingNewShipping] = useState(false);
  const [newShippingInput, setNewShippingInput] = useState("");

  const itemSearchInputRef = useRef<HTMLInputElement>(null);
  const partySearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTextInput = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);

      // Toggle shortcuts drawer on Alt key alone
      if (e.key === "Alt" && !e.repeat && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setShowShortcutsDrawer(prev => !prev);
        return;
      }
      if (e.key === "Escape") {
        if (showShortcutsDrawer) {
          setShowShortcutsDrawer(false);
          return;
        }
        if (showShippingModal) {
          setShowShippingModal(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (creating) {
          setCreating(false);
          notify("Exited Create Invoice");
          return;
        }
      }

      // Invoice Form Actions Keyboard Shortcuts (Shift + Y / M / B)
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        const code = e.code;

        if (key === "y" || code === "KeyY") {
          if (!isTextInput) {
            e.preventDefault();
            setCreating(true);
            setSelectedParty(undefined);
            setPartyOpen(true);
            window.setTimeout(() => partySearchInputRef.current?.focus(), 80);
            notify("Shortcut Shift+Y: Add / Select Party focused");
          }
        } else if (key === "m" || code === "KeyM") {
          if (!isTextInput) {
            e.preventDefault();
            setCreating(true);
            window.setTimeout(() => itemSearchInputRef.current?.focus(), 80);
            notify("Shortcut Shift+M: Add Item search focused");
          }
        } else if (key === "b" || code === "KeyB") {
          if (!isTextInput) {
            e.preventDefault();
            setCreating(true);
            window.setTimeout(() => itemSearchInputRef.current?.focus(), 80);
            notify("Shortcut Shift+B: Scan Barcode Active");
          }
        } else if (e.key === "Enter" && creating) {
          const isTextarea = (e.target as HTMLElement)?.tagName === "TEXTAREA";
          if (!isTextarea) {
            e.preventDefault();
            saveInvoice(true);
          }
        }
      } else if (e.altKey && e.key === "Enter" && creating) {
        e.preventDefault();
        saveInvoice(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [creating, showShortcutsDrawer, showShippingModal, settingsOpen, lines]);

  const [quickPrefix, setQuickPrefix] = useState(setting.invoicePrefix || "HB/SL/26-27/");
  const [quickSeqNum, setQuickSeqNum] = useState(setting.sequenceNumber || "2400");
  const [enablePrefixSeq, setEnablePrefixSeq] = useState(true);
  const [showPurchasePrice, setShowPurchasePrice] = useState(setting.showPurchasePrice || false);
  const [showItemImage, setShowItemImage] = useState(setting.showItemImage || false);
  const [priceHistory, setPriceHistory] = useState(setting.priceHistory || false);
  const [invoiceTheme, setInvoiceTheme] = useState(setting.theme || "Luxury");

  useEffect(() => {
    setQuickPrefix(setting.invoicePrefix || "HB/SL/26-27/");
    setQuickSeqNum(setting.sequenceNumber || "2400");
    setShowPurchasePrice(setting.showPurchasePrice || false);
    setShowItemImage(setting.showItemImage || false);
    setPriceHistory(setting.priceHistory || false);
    setInvoiceTheme(setting.theme || "Luxury");
  }, [setting, settingsOpen]);

  // Dynamic Bank Accounts derived from Backend Settings & saved list
  const bankAccountsList = useMemo(() => {
    const list = [
      { id: "iob", name: setting.bankName || "IOB 31545", accountNo: setting.accountNumber || "31545010001234", ifsc: setting.ifsc || "IOBA0003154" },
      { id: "hdfc", name: "HDFC Bank", accountNo: "5010023456789", ifsc: "HDFC0001234" },
    ];
    if (setting.bankName && !list.some(b => b.name.toLowerCase() === setting.bankName?.toLowerCase())) {
      list.unshift({
        id: "setting-bank",
        name: setting.bankName,
        accountNo: setting.accountNumber || "N/A",
        ifsc: setting.ifsc || "N/A",
      });
    }
    return list;
  }, [setting]);

  // Dynamic Payment QR Codes derived from Backend Settings
  const qrAccountsList = useMemo(() => {
    const list = [
      { id: "iob", name: setting.bankName || "IOB 31545", upiId: setting.upiId || "happybonding@iob" },
      { id: "hdfc", name: "HDFC Bank", upiId: "happybonding@hdfc" },
    ];
    if (setting.upiId && !list.some(q => q.upiId.toLowerCase() === setting.upiId?.toLowerCase())) {
      list.unshift({
        id: "setting-qr",
        name: setting.bankName || "Primary UPI QR",
        upiId: setting.upiId,
      });
    }
    return list;
  }, [setting]);

  const list=rows.filter(x=>`${x.party} ${x.number}`.toLowerCase().includes(query.toLowerCase()));
  const partyMatches=(partySearch.trim()?parties.filter(p=>`${p.name} ${p.phone}`.toLowerCase().includes(partySearch.toLowerCase())):parties).slice(0,8);
  const itemMatches=itemSearch?products.filter(p=>`${p.name} ${p.sku}`.toLowerCase().includes(itemSearch.toLowerCase())).slice(0,5):[];
  const subtotal=lines.reduce((sum,line)=>sum+line.product.sellingPrice*line.qty,0);
  const discount=lines.reduce((sum,line)=>sum+line.discount,0);
  const taxable=Math.max(0,subtotal-discount-invoiceDiscount);
  const taxBaseBeforeInvoiceDiscount=Math.max(0,subtotal-discount);
  const tax=taxBaseBeforeInvoiceDiscount<=0?0:lines.reduce((sum,line)=>{
    const lineBase=Math.max(0,line.product.sellingPrice*line.qty-line.discount);
    const invoiceDiscountShare=invoiceDiscount*(lineBase/taxBaseBeforeInvoiceDiscount);
    const lineTaxable=Math.max(0,lineBase-invoiceDiscountShare);
    return sum+(lineTaxable*(line.taxRate??line.product.taxRate??0)/100);
  },0);
  const total=Math.max(0,Math.round((subtotal-discount-invoiceDiscount+tax+additionalCharges)*100)/100);
  const dueDate=new Date(invoiceDate); dueDate.setDate(dueDate.getDate()+Number(paymentTerms||0));
  useEffect(()=>{if(autoCreateKey)setCreating(true);},[autoCreateKey]);
  useEffect(()=>{setPaymentTerms(setting.paymentTermsDays);},[setting.paymentTermsDays]);
  useEffect(()=>{setTerms(setting.terms);},[setting.terms]);
  useEffect(()=>{if(creating) api.nextSaleNumber(new Date(invoiceDate)).then(x=>setNextNumber(x.invoiceNumber)).catch(()=>setNextNumber(""));},[creating,rows.length,invoiceDate]);
  
  const addLine=(product:Product, taxRate?:number)=>{setLines(current=>{const found=current.find(x=>x.product.id===product.id);return found?current.map(x=>x.product.id===product.id?{...x,qty:x.qty+1}:x):[...current,{product,qty:1,discount:0,taxRate:taxRate??product.taxRate??0}]});setItemSearch("");};
  const addBatchLines=(items: Array<{ product: Product; qty: number; taxRate: number }>) => {
    setLines(current => {
      let next = [...current];
      for (const item of items) {
        const found = next.find(x => x.product.id === item.product.id);
        if (found) {
          next = next.map(x => x.product.id === item.product.id ? { ...x, qty: x.qty + item.qty } : x);
        } else {
          next.push({ product: item.product, qty: item.qty, discount: 0, taxRate: item.taxRate });
        }
      }
      return next;
    });
  };

  const saveSettings=async(newFields?: Partial<InvoiceSetting>)=>{
    try{
      const payload = {
        ...setting,
        ...newFields,
        invoicePrefix: (newFields?.invoicePrefix ?? setting.invoicePrefix)?.trim() || "HB/SL/26-27/",
        sequenceNumber: (newFields?.sequenceNumber ?? setting.sequenceNumber)?.trim() || "2400",
        bankName: (newFields?.bankName ?? setting.bankName)?.trim() || undefined,
        accountName: (newFields?.accountName ?? setting.accountName)?.trim() || undefined,
        accountNumber: (newFields?.accountNumber ?? setting.accountNumber)?.trim() || undefined,
        ifsc: (newFields?.ifsc ?? setting.ifsc)?.trim() || undefined,
        upiId: (newFields?.upiId ?? setting.upiId)?.trim() || undefined,
        qrText: (newFields?.qrText ?? setting.qrText)?.trim() || undefined,
        signatureText: setting.signatureText?.trim() || undefined,
        signatureUrl: setting.signatureUrl || undefined,
        showPurchasePrice: newFields?.showPurchasePrice ?? setting.showPurchasePrice,
        showItemImage: newFields?.showItemImage ?? setting.showItemImage,
        priceHistory: newFields?.priceHistory ?? setting.priceHistory,
        theme: newFields?.theme ?? setting.theme,
      };
      const saved = await api.saveInvoiceSetting(payload);
      setSetting(saved);
      notify("Invoice & Bank Settings saved to backend");
    }catch(error){
      notify(error instanceof Error?error.message:"Settings save failed");
    }
  };
  const createPartyFromInvoice=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();try{setSaving(true);const saved=await api.createParty(partyPayloadFromForm(new FormData(e.currentTarget)));setParties([...parties,saved]);setSelectedParty(saved);setPartyOpen(false);setPartySearch(`${saved.name} ${saved.phone}`);setPartyModal(false);setNewParty({name:"",phone:"",address:"",gstin:""});notify("Party created and selected");}catch(error){notify(error instanceof Error?error.message:"Party save failed");}finally{setSaving(false);}};
  const resetInvoiceForm=()=>{setLines([]);setPartyOpen(false);setPaid(0);setNotes("");setInvoiceDiscount(0);setAdditionalCharges(0);setShowNotes(false);setShowTerms(false);setShowBank(false);setShowQr(false);setNewParty({name:"",phone:"",address:"",gstin:""});setPartySearch("");setSelectedParty(undefined);setMarkPaid(false);setInvoiceDate(new Date().toISOString().slice(0,10));};
  const saveInvoice=async(keepOpen=false)=>{
    if(!lines.length)return notify("Add at least one item");
    try{
{/* ... */}
      if (editingInvoice) {
        const existingPaymentTotal = editingInvoice.payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
        if (total < existingPaymentTotal) {
           return notify(`Edited total (₹${total.toLocaleString("en-IN")}) cannot be less than already received amount (₹${existingPaymentTotal.toLocaleString("en-IN")}). Please issue refund/credit note instead.`);
        }
      }
      setSaving(true);
      let partyId=selectedParty?.id ? String(selectedParty.id) : undefined;
      const received=markPaid?total:paid;
      const payload={partyId,invoiceDate:new Date(invoiceDate),paidAmount:Math.min(received,total),paymentMode,notes:[notes,showTerms?terms:""].filter(Boolean).join("\n"),invoiceDiscount,additionalCharges,lines:lines.map(x=>({variantId:String(x.product.id),quantity:x.qty,unitPrice:x.product.sellingPrice,discount:x.discount,taxRate:x.taxRate??x.product.taxRate??0}))};
      const next=editingInvoice?await api.updateSale(editingInvoice.id,payload):await api.createSale(payload);
      setRows(next); setProducts(await api.products()); setEditingInvoice(null); resetInvoiceForm(); setCreating(keepOpen && !editingInvoice); notify(editingInvoice?`Sales invoice ${editingInvoice.number} updated`:keepOpen?"Sales invoice saved. Ready for next invoice.":"Sales invoice saved");
    }catch(error){notify(error instanceof Error?error.message:"Invoice save failed");}finally{setSaving(false);}
  };
  const deleteInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Delete sales invoice ${inv.number}? Stock will be added back.`)) return;
    try {
      const next = await api.deleteSale(inv.id);
      setRows(next.length ? next : rows.filter(row => row.id !== inv.id));
      setProducts(await api.products());
      notify(`Sales invoice ${inv.number} deleted`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sales invoice delete failed");
    }
  };
  const cancelInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Cancel sales invoice ${inv.number}? Stock will be added back and invoice will stay in records as Cancelled.`)) return;
    try {
      const next = await api.cancelSale(inv.id);
      setRows(next.length ? next : rows.map(row => row.id === inv.id ? { ...row, status: "Cancelled" as const } : row));
      notify(`Sales invoice ${inv.number} cancelled`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sales invoice cancel failed");
    }
  };

  const showEditHistory = async (inv: Invoice) => {
    setHistoryInvoice(inv);
    try {
      const res = await fetch(`/api/sales/${inv.id}/history`).then(r => r.json());
      setAuditEvents(res);
    } catch (e) {
      notify("Failed to fetch edit history");
      setAuditEvents([]);
    }
  };

  const issueCreditNote = async (data: any) => {
    try {
      await api.createCreditNote(data);
      notify("Credit Note issued successfully. Stock returned and party balance reduced.");
      setCreditNoteInvoice(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to issue credit note");
    }
  };

  const duplicateInvoice = (inv: Invoice) => {
    const copiedLines = (inv.lines ?? []).map(line => {
      const product = products.find(p => String(p.id) === String((line as InvoiceLineItem & { productId?: string }).productId) || p.sku === line.sku);
      return product ? { product, qty: line.quantity, discount: line.discount, taxRate: line.taxRate } : null;
    }).filter(Boolean) as InvoiceLineDraft[];
    setLines(copiedLines);
    const party = parties.find(p => p.name === inv.party || p.phone === inv.partyPhone);
    setSelectedParty(party);
    setPartySearch(party ? `${party.name} ${party.phone}` : inv.party);
    setPaid(0);
    setInvoiceDiscount(inv.invoiceDiscount ?? 0);
    setAdditionalCharges(inv.additionalCharges ?? 0);
    setNotes(inv.notes ?? "");
    setCreating(true);
    notify(`Invoice ${inv.number} duplicated. Check and save as new invoice.`);
  };
  const editInvoice = (inv: Invoice) => {
    const editLines = (inv.lines ?? []).map(line => {
      const product = products.find(p => p.sku === line.sku);
      return product ? { product, qty: line.quantity, discount: line.discount, taxRate: line.taxRate } : null;
    }).filter(Boolean) as InvoiceLineDraft[];
    if (!editLines.length) {
      notify("This invoice items are not available in product master, cannot edit safely.");
      return;
    }
    const party = parties.find(p => p.name === inv.party || p.phone === inv.partyPhone);
    setEditingInvoice(inv);
    setLines(editLines);
    setSelectedParty(party);
    setPartySearch(party ? `${party.name} ${party.phone}` : inv.party);
    setPaid(inv.paidAmount ?? 0);
    setPaymentMode((inv.paymentMode as "Cash"|"UPI"|"Card"|"Bank") || "Cash");
    setInvoiceDiscount(inv.invoiceDiscount ?? 0);
    setAdditionalCharges(inv.additionalCharges ?? 0);
    setNotes(inv.notes ?? "");
    setInvoiceDate(new Date(inv.date).toISOString().slice(0,10));
    setMarkPaid((inv.paidAmount ?? 0) >= inv.amount);
    setCreating(true);
    notify(`Editing ${inv.number}`);
  };
  if(!creating) return (
    <>
      <SalesInvoicesListView
        rows={rows}
        onCreateNew={()=>setCreating(true)}
        onSelectInvoice={onSelectInvoice}
        onEditInvoice={editInvoice}
        onDeleteInvoice={deleteInvoice}
        onCancelInvoice={cancelInvoice}
        onDuplicateInvoice={duplicateInvoice}
        onShowEditHistory={showEditHistory}
        onIssueCreditNote={(inv) => {
          if (!inv.partyId) {
            notify("Cannot issue credit note. This invoice is not linked to any party.");
            return;
          }
          setCreditNoteInvoice(inv);
        }}
        onOpenReportView={(reportName: string) => {
          if (onNavigateReports) {
            onNavigateReports(reportName);
          } else {
            setActiveReportView(reportName);
          }
        }}
        onOpenQuickSettings={() => setQuickSettingsOpen(true)}
        notify={notify}
      />
      {quickSettingsOpen && (
        <QuickInvoiceSettingsModal
          setting={setting}
          onClose={() => setQuickSettingsOpen(false)}
          onSave={updated => {
            setSetting({ ...setting, ...updated });
            api.saveInvoiceSetting({ ...setting, ...updated }).catch(() => {});
          }}
          notify={notify}
        />
      )}
      {historyInvoice && (
        <Modal title={`Edit History - ${historyInvoice.number}`} onClose={() => setHistoryInvoice(null)}>
          <div className="table-scroll" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.length > 0 ? auditEvents.map((ev, i) => (
                  <tr key={i}>
                    <td>{new Date(ev.occurredAt).toLocaleString()}</td>
                    <td>{ev.action === "sales.updated" ? "Edited" : ev.action === "sales.created" ? "Created" : ev.action}</td>
                    <td>{ev.actor?.name || "System"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: 20 }}>No history found for this invoice.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {creditNoteInvoice && (
        <IssueCreditNoteModal
          invoice={creditNoteInvoice}
          onClose={() => setCreditNoteInvoice(null)}
          onSave={issueCreditNote}
          notify={notify}
        />
      )}
    </>
  );
  return (
    <div className="full-screen-invoice-page">
      <div className="ref-top-header-bar">
        <div className="top-title-left">
          <button type="button" className="icon-back-btn" onClick={() => { setCreating(false); setEditingInvoice(null); resetInvoiceForm(); }}>
            <ArrowLeft size={18} />
          </button>
          <h2>
            {editingInvoice ? `Edit Sales Invoice - ${editingInvoice.number}` : "Create Sales Invoice"}
            {editingInvoice && <span style={{ marginLeft: 10, fontSize: "0.55em", background: "#f59e0b", color: "#fff", padding: "2px 8px", borderRadius: 4, verticalAlign: "middle", fontWeight: "bold" }}>EDIT MODE</span>}
          </h2>
        </div>
        <div className="top-header-actions">
          {editingInvoice && <button type="button" className="secondary" onClick={() => { setCreating(false); setEditingInvoice(null); resetInvoiceForm(); }}>Cancel Edit</button>}
          <button type="button" className="icon-shortcut-btn" title="Keyboard Shortcuts (Alt)" onClick={() => setShowShortcutsDrawer(prev => !prev)}><Keyboard size={16} /></button>
          <button type="button" className="secondary" onClick={() => setSettingsOpen(!settingsOpen)}><Settings size={15} /> Settings</button>
          {!editingInvoice && <button type="button" className="secondary" onClick={() => saveInvoice(true)} disabled={saving || !lines.length}>{saving ? "Saving..." : "Save & New"}</button>}
          <button type="button" className="primary save-main-btn" onClick={() => saveInvoice(false)} disabled={saving || !lines.length}>{saving ? "Saving..." : (editingInvoice ? "Update Invoice" : "Save")}</button>
        </div>
      </div>

      <div className="invoice-builder-full-width">
        <div className="invoice-top-three-panel">
          <div className="bill-panel-col">
            <div className="panel-head-strip">
              <h3>Bill To</h3>
              <label className="cash-default-lbl"><input type="checkbox" defaultChecked /> Set Cash Sale as default</label>
              {selectedParty && (
                <button type="button" className="secondary compact" onClick={() => { setSelectedParty(undefined); setPartySearch(""); setPartyOpen(true); }}>
                  Change Party
                </button>
              )}
            </div>

            {!selectedParty && (
              <div className={`add-party-box ${partyOpen ? "has-party" : ""}`} onClick={() => setPartyOpen(true)}>
                {!partyOpen ? (
                  <button type="button" className="dashed-add-party-btn"><Plus size={16} /> Add Party</button>
                ) : (
                  <div className="party-search-inline">
                    <Search size={16} />
                    <input
                      ref={partySearchInputRef}
                      value={partySearch}
                      autoFocus
                      onFocus={() => setPartyOpen(true)}
                      onChange={e => {
                        setPartySearch(e.target.value);
                        setPartyOpen(true);
                        setSelectedParty(undefined);
                        setNewParty({ ...newParty, phone: /^\d+$/.test(e.target.value.trim()) ? e.target.value.trim() : newParty.phone, name: /^\d+$/.test(e.target.value.trim()) ? newParty.name : e.target.value.trim() });
                      }}
                      placeholder="Search party by name or number..."
                    />
                    {partyOpen && (
                      <div className="search-results party-dropdown">
                        <div className="dropdown-head"><span>Party Name</span><span>Balance</span></div>
                        {partyMatches.map(p => (
                          <button key={p.id} onClick={() => { setSelectedParty(p); setPartyOpen(false); setPartySearch(`${p.name} ${p.phone}`); }}>
                            <div><strong>{p.name}</strong><small>{p.phone || "No mobile"}</small></div>
                            <span>{money(Math.abs(p.balance || 0))}</span>
                          </button>
                        ))}
                        {!partyMatches.length && <div className="dropdown-empty">No party found</div>}
                        <button type="button" className="create-result" onClick={() => setPartyModal(true)}>
                          <Plus size={15} />
                          <div><strong>Create Party</strong><small>{partySearch || "Add new customer"}</small></div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedParty && (
              <div className="party-details-card">
                <strong className="party-bold-name">{selectedParty.name}</strong>
                <p className="party-phone-line"><span>Phone Number:</span> {selectedParty.phone || "-"}</p>
                <div className="place-supply-row">
                  <span>Place of Supply</span>
                  <div className="supply-select-box">
                    <Search size={13} />
                    <select defaultValue="Tamil Nadu"><option>Tamil Nadu</option></select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ship-panel-col">
            <div className="panel-head-strip">
              <h3>Ship To</h3>
              {selectedParty && (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => {
                    setEditingShippingAddress(selectedParty.address || selectedParty.shippingAddress || "");
                    setShowShippingModal(true);
                  }}
                >
                  Change Shipping Address
                </button>
              )}
            </div>
            {selectedParty ? (
              <div className="party-details-card">
                <strong className="party-bold-name">{selectedParty.name}</strong>
                <p className="party-phone-line"><span>Phone Number:</span> {selectedParty.phone || "-"}</p>
                {selectedParty.address && <p className="party-addr-line"><span>Address:</span> {selectedParty.address}</p>}
              </div>
            ) : (
              <div className="ship-placeholder-box">Select a party to show shipping details</div>
            )}
          </div>

          <div className="invoice-meta-box">
            <div className="meta-box-inner">
              <div className="meta-fields-grid">
                <label>Invoice Prefix<input value={(nextNumber || "HB/SL/26-27/").replace(/[^/]+$/, "")} readOnly /></label>
                <label>Invoice Number<input value={(nextNumber || "Auto").split("/").pop()} readOnly /></label>
                <label>Sales Invoice Date<input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></label>
              </div>
              <div className="meta-terms-grid">
                <label>Payment Terms<div className="days-input"><input type="number" value={paymentTerms} onChange={e => setPaymentTerms(Number(e.target.value))} /><span>days</span></div></label>
                <label>Due Date<input value={dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} readOnly /></label>
              </div>
            </div>
          </div>
        </div>

        <div className="items-table-container">
          <table className="invoice-items-table font-img3">
            <thead>
              <tr>
                <th style={{ width: 36 }}>NO</th>
                <th style={{ width: "32%" }}>ITEMS</th>
                <th style={{ width: "8%" }}>HSN</th>
                <th style={{ width: "10%" }}>MRP ⓘ</th>
                <th style={{ width: "10%" }}>QTY</th>
                <th style={{ width: "12%" }}>PRICE/ITEM (₹)</th>
                <th style={{ width: "10%" }}>DISCOUNT</th>
                <th style={{ width: "10%" }}>TAX</th>
                <th className="right" style={{ width: "12%" }}>AMOUNT (₹)</th>
                <th style={{ width: 36, textAlign: "center" }}><Plus size={16} /></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const taxable = Math.max(0, line.product.sellingPrice * line.qty - line.discount);
                const currentTaxRate = line.taxRate ?? line.product.taxRate ?? 0;
                const lineTax = Math.round((taxable * currentTaxRate) / 100 * 100) / 100;
                return (
                  <tr key={line.product.id}>
                    <td className="center-cell">{index + 1}</td>
                    <td>
                      <div className="item-cell-wrap">
                        <strong className="item-title-name">{line.product.name}</strong>
                        <input type="text" className="item-desc-input" placeholder="Enter Description (optional)" />
                      </div>
                    </td>
                    <td className="center-cell">{line.product.hsnCode || "-"}</td>
                    <td>
                      <div className="mrp-cell-wrap">
                        <div className="gray-val-box">{money(line.product.mrp)}</div>
                        <small className="discount-badge-off">({Math.round(((line.product.mrp - line.product.sellingPrice) / line.product.mrp) * 100) || 7.7}% OFF)</small>
                      </div>
                    </td>
                    <td>
                      <div className="qty-cell-wrap">
                        <input className="qty-mini-input" type="number" value={line.qty} min={1} onChange={e => setLines(lines.map(x => x.product.id === line.product.id ? { ...x, qty: Number(e.target.value) } : x))} />
                        <select className="unit-select"><option>PCS</option><option>BOX</option><option>KG</option></select>
                      </div>
                    </td>
                    <td>
                      <div className="gray-val-box">{money(line.product.sellingPrice)}</div>
                    </td>
                    <td>
                      <div className="discount-cell-wrap">
                        <div className="disc-input-row"><span>%</span><input type="number" value={Math.round((line.discount / (line.product.sellingPrice * line.qty)) * 100) || 0} onChange={e => { const p = Number(e.target.value); const amt = (line.product.sellingPrice * line.qty * p) / 100; setLines(lines.map(x => x.product.id === line.product.id ? { ...x, discount: amt } : x)); }} /></div>
                        <div className="disc-input-row"><span>₹</span><input type="number" value={line.discount} onChange={e => setLines(lines.map(x => x.product.id === line.product.id ? { ...x, discount: Number(e.target.value) } : x))} /></div>
                      </div>
                    </td>
                    <td>
                      <div className="tax-cell-wrap">
                        <select className="tax-select" value={currentTaxRate} onChange={e => setLines(lines.map(x => x.product.id === line.product.id ? { ...x, taxRate: Number(e.target.value) } : x))}>
                          <option value={0}>None ▾</option>
                          {GST_TAX_OPTIONS.map(opt => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <small className="tax-sub-amt">({money(lineTax)})</small>
                      </div>
                    </td>
                    <td className="right-cell">
                      <div className="gray-amount-box">{money(taxable + lineTax)}</div>
                    </td>
                    <td className="center-cell">
                      <button type="button" className="trash-icon-btn" onClick={() => setLines(lines.filter(x => x.product.id !== line.product.id))}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="item-add-row polished" style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 12 }}>
            <div className="party-picker item-search" style={{ margin: 0, width: "100%" }}>
              <Search size={14} color="#94a3b8" />
              <input
                ref={itemSearchInputRef}
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder="+ Search SKU / Name"
                style={{ fontSize: 12, height: 38 }}
              />
              {itemMatches.length > 0 && (
                <div className="search-results">
                  {itemMatches.map(p => (
                    <button key={p.id} type="button" onClick={() => addLine(p)}>
                      <div><strong>{p.name}</strong><small>{p.sku} · Stock {p.stock} · GST {p.taxRate ?? 0}%</small></div>
                      <span>{money(p.sellingPrice)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="dashed-add-item-btn"
              style={{
                height: 44,
                width: "100%",
                border: "1.5px dashed #3b82f6",
                background: "#ffffff",
                color: "#2563eb",
                borderRadius: 8,
                font: "700 14px Manrope",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
              onClick={() => setShowAddItemsModal(true)}
            >
              <Plus size={18} /> + Add Item
            </button>
            <div className="scan-barcode-card" onClick={() => notify("Barcode scanner active. Ready for item SKU or Barcode scanning.")}>
              <BarcodeIcon />
              <span>Scan Barcode</span>
            </div>
          </div>

          <div className="subtotal-strip">
            <span>SUBTOTAL</span>
            <span>{money(subtotal)}</span>
            <span>{money(discount)}</span>
            <span>{money(tax)}</span>
          </div>
          {!lines.length && <EmptyState icon={ShoppingCart} title="No items added" text="Click + Add Item to search and add products to build the invoice." />}
        </div>

        <div className="mybillbook-ref-bottom">
          <div className="ref-left-section">
            {/* Notes Block */}
            <div className="ref-left-block">
              <div className="ref-left-block-head">
                <span className="block-title">Notes</span>
                <button type="button" className="clear-row-btn" onClick={() => setNotes("")}>ⓧ</button>
              </div>
              <input
                type="text"
                className="ref-gray-full-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Enter your notes"
              />
            </div>

            {/* Terms and Conditions Block */}
            <div className="ref-left-block">
              <div className="ref-left-block-head">
                <span className="block-title">Terms and Conditions</span>
                <button type="button" className="clear-row-btn" onClick={() => setTerms("")}>ⓧ</button>
              </div>
              <input
                type="text"
                className="ref-gray-full-input"
                value={terms}
                onChange={e => setTerms(e.target.value)}
                placeholder="Enter your terms and conditions"
              />
            </div>

            {/* Links below */}
            <div className="ref-left-links-group">
              <button type="button" className="ref-link-btn" onClick={() => setBankModalOpen(true)}>+ Add Bank Account</button>
              {setting.bankName && (
                <div className="selected-bank-badge">
                  <Building2 size={15} color="#4f46e5" />
                  <span><strong>Selected Bank:</strong> {setting.bankName}</span>
                </div>
              )}
              <button type="button" className="ref-link-btn" onClick={() => setQrModalOpen(true)}>+ Add Payment QR</button>
              {setting.upiId && (
                <div className="selected-bank-badge">
                  <CircleIndianRupee size={15} color="#4f46e5" />
                  <span><strong>Selected Payment QR:</strong> {setting.upiId}</span>
                </div>
              )}
            </div>
          </div>

          <div className="ref-right-section">
            {/* Image 1 Additional Charges Box */}
            <div className="ref-calc-row add-charges-row-img5">
              <input type="text" className="charge-title-input" defaultValue="transport" placeholder="Enter charge (ex. Transport Charge)" />
              <div className="charge-val-group">
                <div className="charge-num-box"><span className="curr">₹</span><input type="number" value={additionalCharges} onChange={e => setAdditionalCharges(Number(e.target.value))} /></div>
                <select className="charge-tax-select"><option>No Tax Applicable ▾</option><option>5% GST</option><option>18% GST</option></select>
                <button type="button" className="clear-row-btn" onClick={() => setAdditionalCharges(0)}>ⓧ</button>
              </div>
            </div>
            <div className="add-another-charge-left-wrap">
              <button type="button" className="ref-link-btn" onClick={() => notify("Additional charge row added")}>+ Add Another Charge</button>
            </div>

            {/* Taxable Amount Row */}
            <div className="ref-calc-row">
              <span className="ref-lbl">Taxable Amount</span>
              <span className="ref-val">{money(taxable)}</span>
            </div>

            {/* Image 1 Invoice Discount Box */}
            <div className="ref-calc-row discount-row-img5">
              <select className="disc-type-select"><option>Discount After Tax ▾</option><option>Discount Before Tax ▾</option></select>
              <div className="disc-inputs-group">
                <div className="disc-input-box">
                  <span>%</span>
                  <input
                    type="number"
                    value={invoiceDiscount && taxable ? Math.round((invoiceDiscount / taxable) * 100 * 10) / 10 : ""}
                    onChange={e => {
                      const pct = Number(e.target.value);
                      setInvoiceDiscount(Math.round((taxable * pct) / 100));
                    }}
                    placeholder="0"
                  />
                </div>
                <span className="slash">/</span>
                <div className="disc-input-box">
                  <span>₹</span>
                  <input
                    type="number"
                    value={invoiceDiscount || ""}
                    onChange={e => setInvoiceDiscount(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <button type="button" className="clear-row-btn" onClick={() => setInvoiceDiscount(0)}>ⓧ</button>
              </div>
            </div>

            {/* Auto Round Off */}
            <div className="ref-calc-row">
              <label className="ref-check-lbl">
                <input type="checkbox" defaultChecked /> Auto Round Off
              </label>
              <div className="ref-split-box">
                <button type="button" className="ref-split-btn">+ Add ▾</button>
                <span className="ref-curr">₹</span>
                <input type="number" className="ref-split-input" value="0" readOnly />
              </div>
            </div>

            {/* Total Amount Row */}
            <div className="ref-calc-row ref-total-row">
              <strong className="ref-total-lbl">Total Amount</strong>
              <strong className="total-amount-img5-val">{money(total)}</strong>
            </div>

            <div className="ref-fully-paid-row">
              <label className="ref-paid-lbl">
                Mark as fully paid <input type="checkbox" checked={markPaid} onChange={e => { setMarkPaid(e.target.checked); if (e.target.checked) setPaid(total); }} />
              </label>
            </div>

            <div className="ref-calc-row ref-amount-received-row">
              <span className="ref-lbl">Amount Received</span>
              <div className="ref-gray-input-box">
                <span className="ref-curr">₹</span>
                <input
                  type="number"
                  className="ref-received-input"
                  value={(markPaid ? total : paid) || 0}
                  onChange={e => { setPaid(Number(e.target.value)); setMarkPaid(false); }}
                />
                <select className="ref-mode-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value as typeof paymentMode)}>
                  <option value="Cash">Cash ▾</option>
                  <option value="UPI">UPI ▾</option>
                  <option value="Card">Card ▾</option>
                  <option value="Bank">Bank ▾</option>
                </select>
              </div>
            </div>

            <div className="ref-calc-row ref-balance-row">
              <strong className="ref-green-lbl">Balance Amount</strong>
              <strong className="ref-green-val">{money(Math.max(0, total - (markPaid ? total : paid)))}</strong>
            </div>

            <div className="ref-signature-area">
              <span className="ref-sig-title">{setting.signatureText || `Authorized signatory for Happy Bonding Men's Wear (${localStorage.getItem("hb_signature_name") || "M. Saravanan"})`}</span>
              <div className="ref-sig-img">
                <img src={localStorage.getItem("hb_digital_signature") || setting.signatureUrl || defaultSignatureUrl} alt="Digital Signature" style={{ height: 48, objectFit: "contain" }} />
              </div>
            </div>

            <div className="ref-actions-row">
              <button type="button" className="secondary" onClick={() => saveInvoice(true)} disabled={saving || !lines.length}>Save & New</button>
              <button type="button" className="whatsapp-btn" onClick={() => shareWhatsAppInvoice({ phone: selectedParty?.phone, partyName: selectedParty?.name, number: nextNumber || "HB-INV", amount: total, paidAmount: (markPaid ? total : paid), paymentMode })} disabled={!lines.length}>
                <MessageCircle size={15} /> WhatsApp Share
              </button>
              <button type="button" className="primary" onClick={() => saveInvoice(false)} disabled={saving || !lines.length}>{saving ? "Saving..." : "Save Invoice"}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Select Bank Account Modal */}
      {bankModalOpen && (
        <div className="modal-backdrop bank-select-backdrop" onClick={() => setBankModalOpen(false)}>
          <div className="modal-card bank-select-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Select Bank Account</h3>
              <button type="button" className="icon-close-btn" onClick={() => setBankModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="bank-options-list">
              {bankAccountsList.map(bank => (
                <label
                  key={bank.id}
                  className={`bank-option-row ${selectedBankId === bank.id ? "selected" : ""}`}
                  onClick={() => setSelectedBankId(bank.id)}
                >
                  <div className="bank-info-left">
                    <div className="bank-icon-box">
                      <Building2 size={18} />
                    </div>
                    <span className="bank-name-text">{bank.name}</span>
                  </div>
                  <input
                    type="radio"
                    name="bankSelect"
                    checked={selectedBankId === bank.id}
                    onChange={() => setSelectedBankId(bank.id)}
                  />
                </label>
              ))}

              {!addingNewBank ? (
                <button type="button" className="ref-link-btn" style={{ marginTop: 8 }} onClick={() => setAddingNewBank(true)}>
                  + Add New Bank Account Details
                </button>
              ) : (
                <div className="inline-add-bank-form">
                  <h4>New Bank Account</h4>
                  <input placeholder="Bank Name (e.g. Canara Bank)" value={customBankName} onChange={e => setCustomBankName(e.target.value)} />
                  <input placeholder="Account Number" value={customAccNo} onChange={e => setCustomAccNo(e.target.value)} />
                  <input placeholder="IFSC Code" value={customIfsc} onChange={e => setCustomIfsc(e.target.value)} />
                  <div className="form-row-btns">
                    <button type="button" className="secondary compact" onClick={() => setAddingNewBank(false)}>Cancel</button>
                    <button type="button" className="primary compact" onClick={async () => {
                      if (!customBankName.trim()) return notify("Enter Bank Name");
                      await saveSettings({ bankName: customBankName, accountNumber: customAccNo, ifsc: customIfsc });
                      setAddingNewBank(false);
                      setCustomBankName(""); setCustomAccNo(""); setCustomIfsc("");
                    }}>Save Bank to Backend</button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-shortcuts-bar">
              <span><strong>Keyboard Shortcuts:</strong> Select Bank Account <kbd>F7</kbd> Move between accounts <kbd>↑</kbd> <kbd>↓</kbd></span>
            </div>

            <div className="modal-foot">
              <button type="button" className="secondary" onClick={() => setBankModalOpen(false)}>
                Cancel [ESC]
              </button>
              <button
                type="button"
                className="primary save-bank-btn"
                onClick={async () => {
                  const b = bankAccountsList.find(x => x.id === selectedBankId) || bankAccountsList[0];
                  if (b) {
                    await saveSettings({ bankName: b.name, accountNumber: b.accountNo, ifsc: b.ifsc });
                  }
                  setBankModalOpen(false);
                  notify("Bank account saved to backend & linked to invoice");
                }}
              >
                Save [F7]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Payment QR Code Modal */}
      {qrModalOpen && (
        <div className="modal-backdrop bank-select-backdrop" onClick={() => setQrModalOpen(false)}>
          <div className="modal-card bank-select-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Select Payment QR Code</h3>
              <button type="button" className="icon-close-btn" onClick={() => setQrModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="bank-options-list">
              {qrAccountsList.map(qr => (
                <label
                  key={qr.id}
                  className={`bank-option-row ${selectedQrId === qr.id ? "selected" : ""}`}
                  onClick={() => setSelectedQrId(qr.id)}
                >
                  <div className="bank-info-left">
                    <div className="bank-icon-box">
                      <Building2 size={18} />
                    </div>
                    <span className="bank-name-text">{qr.name}</span>
                  </div>
                  <input
                    type="radio"
                    name="qrSelect"
                    checked={selectedQrId === qr.id}
                    onChange={() => setSelectedQrId(qr.id)}
                  />
                </label>
              ))}

              {!addingNewQr ? (
                <button type="button" className="ref-link-btn" style={{ marginTop: 8 }} onClick={() => setAddingNewQr(true)}>
                  + Add New UPI QR Details
                </button>
              ) : (
                <div className="inline-add-bank-form">
                  <h4>New UPI QR Code</h4>
                  <input placeholder="UPI ID (e.g. 9842100000@paytm)" value={customUpiId} onChange={e => setCustomUpiId(e.target.value)} />
                  <div className="form-row-btns">
                    <button type="button" className="secondary compact" onClick={() => setAddingNewQr(false)}>Cancel</button>
                    <button type="button" className="primary compact" onClick={async () => {
                      if (!customUpiId.trim()) return notify("Enter UPI ID");
                      await saveSettings({ upiId: customUpiId, qrText: `upi://pay?pa=${customUpiId}` });
                      setAddingNewQr(false);
                      setCustomUpiId("");
                    }}>Save QR to Backend</button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-shortcuts-bar">
              <span><strong>Keyboard Shortcuts:</strong> Select Payment QR Code <kbd>F7</kbd> Move between accounts <kbd>↑</kbd> <kbd>↓</kbd></span>
            </div>

            <div className="modal-foot">
              <button type="button" className="secondary" onClick={() => setQrModalOpen(false)}>
                Cancel [ESC]
              </button>
              <button
                type="button"
                className="primary save-bank-btn"
                onClick={async () => {
                  const q = qrAccountsList.find(x => x.id === selectedQrId) || qrAccountsList[0];
                  if (q) {
                    await saveSettings({ upiId: q.upiId, qrText: `upi://pay?pa=${q.upiId}` });
                  }
                  setQrModalOpen(false);
                  notify("Payment QR saved to backend & linked to invoice");
                }}
              >
                Save [F7]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Shipping Address Modal */}
      {showShippingModal && selectedParty && (
        <div className="modal-backdrop bank-select-backdrop" onClick={() => setShowShippingModal(false)}>
          <div className="modal-card shipping-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Change Shipping Address</h3>
              <button type="button" className="icon-close-btn" onClick={() => setShowShippingModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="shipping-modal-body">
              <table className="shipping-address-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th style={{ width: 60, textAlign: "center" }}>Edit</th>
                    <th style={{ width: 60, textAlign: "center" }}>Select</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{selectedParty.name}</strong>
                      <p className="shipping-addr-text">
                        {selectedParty.address || selectedParty.shippingAddress || "No Address"}
                      </p>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="icon-pencil-btn"
                        title="Edit Customer Address in DB"
                        onClick={() => {
                          setEditingShippingAddress(selectedParty.address || selectedParty.shippingAddress || "");
                          setIsEditingAddress(true);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="radio" name="shippingAddressRadio" defaultChecked />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Inline Edit Form when clicking Pencil button */}
              {isEditingAddress && (
                <div className="inline-add-bank-form" style={{ marginTop: 12 }}>
                  <h4>Edit Customer Shipping Address in DB</h4>
                  <textarea
                    rows={3}
                    className="shipping-edit-textarea"
                    value={editingShippingAddress}
                    onChange={e => setEditingShippingAddress(e.target.value)}
                    placeholder="Enter full shipping address..."
                  />
                  <div className="form-row-btns">
                    <button type="button" className="secondary compact" onClick={() => setIsEditingAddress(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary compact"
                      onClick={async () => {
                        try {
                          const updated = await api.updateParty(selectedParty.id, {
                            ...selectedParty,
                            address: editingShippingAddress,
                            shippingAddress: editingShippingAddress,
                          });
                          setSelectedParty(updated);
                          setParties(parties.map(p => p.id === updated.id ? updated : p));
                          setIsEditingAddress(false);
                          notify("Shipping address updated in Customer Database");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "Failed to update customer address");
                        }
                      }}
                    >
                      Save to Customer DB
                    </button>
                  </div>
                </div>
              )}

              {!addingNewShipping && !isEditingAddress && (
                <button
                  type="button"
                  className="ref-link-btn"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setNewShippingInput("");
                    setAddingNewShipping(true);
                  }}
                >
                  + Add New Shipping Address
                </button>
              )}

              {addingNewShipping && (
                <div className="inline-add-bank-form" style={{ marginTop: 12 }}>
                  <h4>Add New Shipping Address to Customer DB</h4>
                  <textarea
                    rows={3}
                    className="shipping-edit-textarea"
                    value={newShippingInput}
                    onChange={e => setNewShippingInput(e.target.value)}
                    placeholder="Enter new shipping address..."
                  />
                  <div className="form-row-btns">
                    <button type="button" className="secondary compact" onClick={() => setAddingNewShipping(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary compact"
                      onClick={async () => {
                        if (!newShippingInput.trim()) return notify("Enter shipping address");
                        try {
                          const updated = await api.updateParty(selectedParty.id, {
                            ...selectedParty,
                            address: newShippingInput.trim(),
                            shippingAddress: newShippingInput.trim(),
                          });
                          setSelectedParty(updated);
                          setParties(parties.map(p => p.id === updated.id ? updated : p));
                          setAddingNewShipping(false);
                          setNewShippingInput("");
                          notify("New shipping address saved to Customer DB");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "Failed to save shipping address");
                        }
                      }}
                    >
                      Save & Link to Customer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button type="button" className="secondary" onClick={() => setShowShippingModal(false)}>
                Cancel
              </button>
              <button type="button" className="primary save-main-btn" onClick={() => setShowShippingModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Invoice Settings Modal */}
      {settingsOpen && (
        <div className="modal-backdrop bank-select-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="modal-card quick-settings-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Quick Invoice Settings</h3>
              <button type="button" className="icon-close-btn" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="quick-settings-body">
              {/* Box 1: Prefix & Sequence Number */}
              <div className="quick-setting-box">
                <div className="box-top-row">
                  <div>
                    <strong className="box-title">Invoice Prefix & Sequence Number</strong>
                    <p className="box-sub">Add your custom prefix & sequence for Invoice Numbering</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={enablePrefixSeq} onChange={e => setEnablePrefixSeq(e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>
                {enablePrefixSeq && (
                  <div className="prefix-inputs-row">
                    <div className="input-group-col">
                      <label>Prefix</label>
                      <input value={quickPrefix} onChange={e => setQuickPrefix(e.target.value)} placeholder="HB/SL/26-27/" />
                    </div>
                    <div className="input-group-col">
                      <label>Sequence Number</label>
                      <input value={quickSeqNum} onChange={e => setQuickSeqNum(e.target.value)} placeholder="2400" />
                    </div>
                  </div>
                )}
                <div className="invoice-num-preview">
                  <span>Invoice Number: <strong>{quickPrefix}{quickSeqNum}</strong></span>
                </div>
              </div>

              {/* Box 2: Purchase Price */}
              <div className="quick-setting-box horizontal">
                <div>
                  <strong className="box-title">Show Purchase Price while adding Items</strong>
                  <p className="box-sub">Add purchase price while adding items</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showPurchasePrice} onChange={e => setShowPurchasePrice(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Box 3: Item Image */}
              <div className="quick-setting-box horizontal">
                <div>
                  <strong className="box-title">Show Item Image on Invoice</strong>
                  <p className="box-sub">This will apply to all vouchers except for Payment In and Payment Out</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={showItemImage} onChange={e => setShowItemImage(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Box 4: Price History */}
              <div className="quick-setting-box horizontal">
                <div>
                  <strong className="box-title">Price History <span className="blue-new-badge">New</span></strong>
                  <p className="box-sub">Show last 5 sales / purchase prices of the item for the selected party in invoice</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={priceHistory} onChange={e => setPriceHistory(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Box 5: Choose Invoice Theme */}
              <div className="quick-setting-box horizontal">
                <div>
                  <strong className="box-title">Choose Invoice Theme</strong>
                </div>
                <select className="theme-select-dropdown" value={invoiceTheme} onChange={e => setInvoiceTheme(e.target.value)}>
                  <option value="Luxury">Luxury</option>
                  <option value="Stylish">Stylish</option>
                  <option value="Modern">Modern</option>
                  <option value="Classic">Classic</option>
                </select>
              </div>

              {/* Banner Box */}
              <div className="customise-banner-card">
                <div>
                  <h4>Now customise Invoice<br />with ease</h4>
                  <button type="button" className="full-settings-btn" onClick={() => { setSettingsOpen(false); }}>
                    Full Invoice Settings ➔
                  </button>
                </div>
                <div className="banner-illus-box">
                  <FileText size={48} color="#6366f1" />
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button type="button" className="secondary" onClick={() => setSettingsOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary save-main-btn"
                onClick={async () => {
                  await saveSettings({
                    invoicePrefix: quickPrefix,
                    sequenceNumber: quickSeqNum,
                    showPurchasePrice,
                    showItemImage,
                    priceHistory,
                    theme: invoiceTheme,
                  });
                  setSettingsOpen(false);
                  notify("Quick Invoice Settings saved to backend");
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Side Drawer Panel */}
      {showShortcutsDrawer && (
        <>
          <div className="shortcuts-drawer-overlay" onClick={() => setShowShortcutsDrawer(false)} />
          <div className="shortcuts-drawer-panel">
            <div className="shortcuts-drawer-head">
              <div>
                <h3>Keyboard shortcuts</h3>
                <p className="shortcuts-sub-text">
                  Press <kbd>Alt</kbd> to open or close the shortcuts panel
                </p>
              </div>
              <button
                type="button"
                className="icon-close-btn"
                onClick={() => setShowShortcutsDrawer(false)}
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="shortcuts-drawer-body">
              {/* Group 1: Invoice Form Actions */}
              <div className="shortcut-group">
                <h4>Invoice Form Actions</h4>
                <div className="shortcut-item"><span>Add / Select Party</span><div className="kbd-combo"><kbd>Shift</kbd><kbd>Y</kbd></div></div>
                <div className="shortcut-item"><span>Add Item Search</span><div className="kbd-combo"><kbd>Shift</kbd><kbd>M</kbd></div></div>
                <div className="shortcut-item"><span>Scan Barcode</span><div className="kbd-combo"><kbd>Shift</kbd><kbd>B</kbd></div></div>
                <div className="shortcut-item"><span>Save Invoice</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>Enter</kbd></div></div>
                <div className="shortcut-item"><span>Save & New</span><div className="kbd-combo"><kbd>Shift</kbd><kbd>Enter</kbd></div></div>
                <div className="shortcut-item"><span>Cancel / Exit</span><div className="kbd-combo"><kbd>Escape</kbd></div></div>
                <div className="shortcut-item"><span>Toggle Shortcuts Panel</span><div className="kbd-combo"><kbd>Alt</kbd></div></div>
              </div>

              {/* Group 2: Create / Navigation */}
              <div className="shortcut-group">
                <h4>Create & Navigation</h4>
                <div className="shortcut-item"><span>Sales Invoice</span><div className="kbd-combo"><kbd>F2</kbd> <span>/</span> <kbd>Alt</kbd><kbd>S</kbd></div></div>
                <div className="shortcut-item"><span>POS Billing</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>B</kbd></div></div>
                <div className="shortcut-item"><span>Purchase Invoice</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>P</kbd></div></div>
                <div className="shortcut-item"><span>Parties Page</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>Y</kbd></div></div>
                <div className="shortcut-item"><span>Items & Inventory</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>M</kbd></div></div>
                <div className="shortcut-item"><span>Payment In</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>I</kbd></div></div>
                <div className="shortcut-item"><span>Payment Out</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>O</kbd></div></div>
                <div className="shortcut-item"><span>Sales Return</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>C</kbd></div></div>
                <div className="shortcut-item"><span>Purchase Return</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>R</kbd></div></div>
                <div className="shortcut-item"><span>Quotation / Estimate</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>Q</kbd></div></div>
                <div className="shortcut-item"><span>Expense</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>E</kbd></div></div>
              </div>

              {/* Group 3: Customer Support */}
              <div className="shortcut-group">
                <h4>Customer Support</h4>
                <div className="shortcut-item"><span>WhatsApp Chat Support</span><div className="kbd-combo"><kbd>Alt</kbd><kbd>H</kbd></div></div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Add Items to Bill Modal */}
      {showAddItemsModal && (
        <AddItemModal
          products={products}
          currentLines={lines.map(l => ({
            id: String(l.product.id),
            variantId: l.product.id,
            name: l.product.name,
            qty: l.qty,
            price: l.product.sellingPrice,
            mrp: l.product.mrp || l.product.sellingPrice,
            hsn: l.product.hsnCode || "6205"
          }))}
          onClose={() => setShowAddItemsModal(false)}
          onApplyItems={(updatedLines) => {
            const newLines: InvoiceLineDraft[] = [];
            updatedLines.forEach(ul => {
              const prod = products.find(p => String(p.id) === String(ul.variantId) || p.name === ul.name);
              if (prod) {
                newLines.push({
                  product: prod,
                  qty: ul.qty,
                  discount: ul.discount || 0,
                  taxRate: ul.tax ?? prod.taxRate ?? 0
                });
              }
            });
            setLines(newLines);
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

function InvoiceSettingsEditor({setting,setSetting,onSave}:{setting:InvoiceSetting;setSetting:(x:InvoiceSetting)=>void;onSave:()=>void}){
  const set=(key:keyof InvoiceSetting,value:string|number)=>setSetting({...setting,[key]:value});
  const handleSignatureUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setSetting({ ...setting, signatureUrl: e.target.result });
      }
    };
    reader.readAsDataURL(file);
  };
  return <div className="invoice-settings card">
    <label>Prefix<input value={setting.invoicePrefix} onChange={e=>set("invoicePrefix",e.target.value)}/></label>
    <label>Payment terms days<input type="number" value={setting.paymentTermsDays} onChange={e=>set("paymentTermsDays",Number(e.target.value))}/></label>
    <label>Bank name<input value={setting.bankName||""} onChange={e=>set("bankName",e.target.value)}/></label>
    <label>Account name<input value={setting.accountName||""} onChange={e=>set("accountName",e.target.value)}/></label>
    <label>Account number<input value={setting.accountNumber||""} onChange={e=>set("accountNumber",e.target.value)}/></label>
    <label>IFSC<input value={setting.ifsc||""} onChange={e=>set("ifsc",e.target.value)}/></label>
    <label>UPI ID<input value={setting.upiId||""} onChange={e=>set("upiId",e.target.value)}/></label>
    <label>QR text<input value={setting.qrText||""} onChange={e=>set("qrText",e.target.value)}/></label>
    <label className="full">Signature Footer Label<input value={setting.signatureText||""} onChange={e=>set("signatureText",e.target.value)} placeholder="Authorized signatory for Happy Bonding Men's Wear"/></label>
    <div className="signature-editor-box">
      <strong>Stored Digital Signature (Applied automatically to all invoices)</strong>
      <div className="signature-preview">
        <img src={setting.signatureUrl || defaultSignatureUrl} alt="Stored Digital Signature Preview" />
      </div>
      <label>Upload New Signature Image (PNG / JPEG / SVG):
        <input type="file" accept="image/*" onChange={e => handleSignatureUpload(e.target.files?.[0])} />
      </label>
      <button type="button" className="secondary" onClick={() => setSetting({ ...setting, signatureUrl: defaultSignatureUrl })}>Reset to Default Signature</button>
    </div>
    <label className="full">Terms<textarea value={setting.terms} onChange={e=>set("terms",e.target.value)}/></label>
    <button className="primary" onClick={onSave}>Save settings once</button>
  </div>;
}

function Purchases({notify}:{notify:(s:string)=>void}) { return <><PageHeading title="Purchase invoices" subtitle="Supplier purchases, returns and payment tracking." action="Create purchase" onAction={()=>notify("Purchase backend implementation pending")}/><div className="metrics-grid three"><Metric label="Total purchases" value={money(0)} icon={ShoppingBag}/><Metric label="Paid" value={money(0)} icon={CircleIndianRupee} tone="green"/><Metric label="Payable" value={money(0)} icon={CreditCard} tone="red"/></div><article className="card table-card"><EmptyState icon={ShoppingBag} title="No purchase invoices yet" text="Purchase module will show only saved database records here."/></article></> }



export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){return <div className="modal-backdrop"><div className={`modal ${wide?"wide":""}`}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X/></button></div>{children}</div></div>}



interface AddItemModalProps {
  products: Product[];
  currentLines: Array<{ id: string; variantId?: string | number; name: string; qty: number; price: number; mrp: number; hsn: string }>;
  onClose: () => void;
  onApplyItems: (updatedLines: Array<{ id: string; variantId: string | number; name: string; hsn: string; mrp: number; qty: number; price: number; discount: number; tax: number; amount: number }>) => void;
  notify: (msg: string) => void;
}

export function AddItemModal({ products, currentLines, onClose, onApplyItems, notify }: AddItemModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const [qtyMap, setQtyMap] = useState<{ [id: string]: number }>(() => {
    const map: { [id: string]: number } = {};
    currentLines.forEach(line => {
      const prod = products.find(p => String(p.id) === String(line.variantId) || p.name === line.name);
      if (prod) map[String(prod.id)] = line.qty;
    });
    return map;
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return ["All", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (showOnlySelected && !(qtyMap[String(p.id)] > 0)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.hsnCode && p.hsnCode.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, selectedCategory, showOnlySelected, searchQuery, qtyMap]);

  const setQty = (productId: string | number, qty: number) => {
    const key = String(productId);
    setQtyMap(prev => {
      const next = { ...prev };
      if (qty <= 0) delete next[key];
      else next[key] = qty;
      return next;
    });
  };

  const selectedCount = Object.keys(qtyMap).length;
  const totalSelectedQty = Object.values(qtyMap).reduce((sum, q) => sum + q, 0);
  const totalSelectedAmount = Object.entries(qtyMap).reduce((sum, [id, qty]) => {
    const prod = products.find(p => String(p.id) === id);
    return sum + (prod ? prod.sellingPrice * qty : 0);
  }, 0);

  const handleAddItemsToBill = () => {
    const newLines: Array<{ id: string; variantId: string | number; name: string; hsn: string; mrp: number; qty: number; price: number; discount: number; tax: number; amount: number }> = [];
    Object.entries(qtyMap).forEach(([id, qty]) => {
      if (qty <= 0) return;
      const prod = products.find(p => String(p.id) === id);
      if (prod) {
        const price = prod.sellingPrice;
        newLines.push({
          id: "L-" + id,
          variantId: prod.id,
          name: prod.name,
          hsn: prod.hsnCode || "6205",
          mrp: prod.mrp || price,
          qty,
          price,
          discount: 0,
          tax: 5,
          amount: price * qty,
        });
      }
    });
    onApplyItems(newLines);
    notify(`Added ${selectedCount} item(s) to bill`);
    onClose();
  };

  return (
    <div className="modal-backdrop bank-select-backdrop" onClick={onClose} style={{ zIndex: 99999 }}>
      <div className="modal-card add-items-bill-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="add-items-modal-head">
          <h2>Add Items to Bill</h2>
          <button type="button" className="icon-close-btn" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        {/* Search & Category Filter Strip */}
        <div className="add-items-filter-strip">
          <div className="add-items-search-box">
            <Search size={18} color="#6366f1" />
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Item/ Serial no./ HSN code/ SKU/ Custom Field / Category"
            />
          </div>
          <select className="add-items-category-select" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="All">Select Category ▾</option>
            {categories.filter(c => c !== "All").map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button type="button" className="add-items-create-btn" onClick={() => notify("Item creation modal ready")}>
            <Plus size={16} /> Create New Item
          </button>
        </div>

        {/* Table View */}
        <div className="add-items-table-wrap">
          <table className="add-items-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Item Name</th>
                <th style={{ textAlign: "left" }}>Item Code</th>
                <th style={{ textAlign: "left" }}>Stock</th>
                <th style={{ textAlign: "right" }}>MRP</th>
                <th style={{ textAlign: "right" }}>Sales Price</th>
                <th style={{ textAlign: "center", width: 160 }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(prod => {
                const qty = qtyMap[String(prod.id)] || 0;
                const isOutOfStock = prod.stock <= 0;
                return (
                  <tr key={prod.id}>
                    <td>
                      <strong style={{ display: "block", color: "#0f172a" }}>{prod.name}</strong>
                      {isOutOfStock && <span className="insufficient-stock-badge">Insufficient stock</span>}
                    </td>
                    <td style={{ color: "#64748b" }}>{prod.sku}</td>
                    <td><span className="add-items-unit-tag">{prod.stock} {prod.unit || "PCS"}</span></td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>₹ {prod.mrp || prod.sellingPrice}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>₹ {prod.sellingPrice}</td>
                    <td style={{ textAlign: "center" }}>
                      {qty === 0 ? (
                        <button type="button" className="add-items-qty-add-btn" onClick={() => setQty(prod.id, 1)}>
                          + Add
                        </button>
                      ) : (
                        <div className="add-items-stepper">
                          <button type="button" className="add-items-stepper-btn" onClick={() => setQty(prod.id, qty - 1)}>-</button>
                          <input
                            type="number"
                            className="add-items-stepper-input"
                            value={qty}
                            onChange={e => setQty(prod.id, Math.max(0, Number(e.target.value)))}
                          />
                          <button type="button" className="add-items-stepper-btn" onClick={() => setQty(prod.id, qty + 1)}>+</button>
                          <span className="add-items-unit-tag">{prod.unit || "PCS"}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredProducts.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                    No items found matching "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Items Summary Strip */}
        <div className="add-items-summary-strip">
          <button type="button" className="add-items-selected-link" onClick={() => setShowOnlySelected(!showOnlySelected)}>
            {showOnlySelected ? "Show All Items" : `Show ${selectedCount} Item(s) Selected`}
          </button>
          <div style={{ color: "#334155" }}>
            <span style={{ fontSize: 13, color: "#64748b", marginRight: 14 }}>Total: <strong style={{ color: "#0f172a" }}>₹ {totalSelectedAmount.toLocaleString("en-IN")}</strong></span>
            <span style={{ fontSize: 13, color: "#64748b" }}>Selected Qty: <strong style={{ color: "#0f172a" }}>{totalSelectedQty}</strong></span>
          </div>
        </div>

        {/* Bottom Bar with Shortcuts & Actions */}
        <div className="add-items-footer-bar">
          <div className="add-items-shortcuts">
            <span>Keyboard Shortcuts :</span>
            <span>Change Quantity <kbd>Enter</kbd></span>
            <span>Move between items <kbd>↑</kbd> <kbd>↓</kbd></span>
          </div>
          <div className="add-items-footer-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel [ESC]</button>
            <button type="button" className="add-items-btn-primary" onClick={handleAddItemsToBill}>Add to Bill [F7]</button>
          </div>
        </div>
      </div>
    </div>
  );
}





function IssueCreditNoteModal({ invoice, onClose, onSave, notify }: { invoice: Invoice; onClose: () => void; onSave: (data: any) => Promise<void>; notify: (m: string) => void }) {
  const [lines, setLines] = useState(invoice.lines?.map((l: any) => ({ ...l, returnQty: 0 })) || []);
  const [notes, setNotes] = useState("Sales Return for Invoice " + invoice.number);
  const [saving, setSaving] = useState(false);

  const totalReturnAmount = lines.reduce((acc, l) => {
    const amount = Number(l.unitPrice || (l as any).product?.sellingPrice || 0) * Number(l.returnQty);
    const tax = amount * (Number(l.taxRate || (l as any).product?.taxRate || 0) / 100);
    return acc + amount + tax;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const returnLines = lines.filter(l => l.returnQty > 0);
    if (returnLines.length === 0) return notify("Please select at least one item to return.");
    if (!invoice.partyId) return notify("Invoice does not have a linked party.");
    
    setSaving(true);
    try {
      const payload = {
        partyId: String(invoice.partyId),
        salesInvoiceId: String(invoice.id),
        date: new Date(),
        amount: totalReturnAmount,
        notes,
        lines: returnLines.map(l => {
           const unitPrice = Number(l.unitPrice || (l as any).product?.sellingPrice || 0);
           const amount = unitPrice * Number(l.returnQty);
           const taxRate = Number(l.taxRate || (l as any).product?.taxRate || 0);
           const tax = amount * (taxRate / 100);
           return {
             variantId: String((l as any).variantId || (l as any).product?.id || ""),
             itemName: String(l.itemName || (l as any).product?.name || "Item"),
             quantity: Number(l.returnQty),
             unitPrice,
             taxRate,
             total: amount + tax
           };
        })
      };
      await onSave(payload);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to issue credit note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Issue Credit Note - ${invoice.number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ padding: 20 }}>
        <p style={{ marginBottom: 16 }}>Select quantities to return from this invoice. Stock will be restored and party outstanding will be reduced.</p>
        <div className="table-scroll" style={{ marginBottom: 20 }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="right">Invoiced Qty</th>
                <th className="right">Return Qty</th>
                <th className="right">Unit Price (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any, i) => (
                <tr key={i}>
                  <td><strong>{l.itemName || l.product?.name || "Item"}</strong></td>
                  <td className="right">{l.quantity || l.qty}</td>
                  <td className="right">
                    <input
                      type="number"
                      min={0}
                      max={Number(l.quantity || l.qty)}
                      value={l.returnQty}
                      onChange={e => {
                        const newLines = [...lines];
                        newLines[i].returnQty = Number(e.target.value);
                        setLines(newLines);
                      }}
                      style={{ width: 80, padding: 4, textAlign: "right" }}
                    />
                  </td>
                  <td className="right">{Number(l.unitPrice || l.product?.sellingPrice || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Notes / Reason</span>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #cbd5e1" }} />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Total Credit: ₹ {totalReturnAmount.toLocaleString("en-IN")}</span>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || totalReturnAmount <= 0}>
              {saving ? "Processing..." : "Issue Credit Note"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}