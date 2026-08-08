import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, Banknote, Boxes, Building2, ChevronDown, IndianRupee as CircleIndianRupee,
  ClipboardList, CreditCard, Download, FileSpreadsheet, FileText, LayoutDashboard, Menu, PackagePlus,
  Plus, ReceiptIndianRupee, Search, Settings, ShoppingBag, ShoppingCart,
  TrendingUp, Upload, Users, UsersRound, WalletCards, X,
} from "lucide-react";
import { money } from "./data";
import { api } from "./api";
import type { Invoice, InvoiceSetting, Page, Party, Product } from "./types";
import * as XLSX from "xlsx";
import happyBondingLogo from "./assets/happy-bonding-logo-white.png";

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
    { id: "pos", label: "POS Billing", icon: ShoppingCart },
  ]},
  { section: "BUSINESS", items: [
    { id: "staff", label: "Staff & Payroll", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ]},
];

const defaultSignatureUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" width="220" height="60"><path d="M10 45 C30 10, 45 5, 55 45 C65 25, 75 15, 85 45 C95 10, 110 30, 130 40 C140 15, 155 25, 175 35 C185 10, 205 35, 240 15" stroke="%23111827" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M25 50 C80 48, 140 52, 210 48" stroke="%23111827" stroke-width="1.5" fill="none"/><text x="35" y="65" font-family="cursive, sans-serif" font-size="18" font-weight="bold" fill="%23111827">M. Saravana</text></svg>`;

const defaultInvoiceSetting: InvoiceSetting = { invoicePrefix: "HB/SL", paymentTermsDays: 30, terms: "NO REFUND ONCE SOLD. EXCHANGE ONLY AS PER STORE POLICY.", bankName: "", accountName: "", accountNumber: "", ifsc: "", upiId: "", qrText: "", signatureText: "Authorized signatory for Happy Bonding Men's Wear", signatureUrl: defaultSignatureUrl };

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
  const [toast, setToast] = useState("");
  const [salesCreateKey, setSalesCreateKey] = useState(0);

  useEffect(() => {
    if (!apiMode || !authenticated) return;
    Promise.all([api.products(), api.parties(), api.sales(), api.invoiceSetting()])
      .then(([nextProducts, nextParties, nextInvoices, nextSetting]) => {
        setProductRows(nextProducts); setPartyRows(nextParties); setInvoiceRows(nextInvoices);
        setInvoiceSetting({ ...defaultInvoiceSetting, ...nextSetting });
      })
      .catch(error => notify(`API sync failed: ${error instanceof Error ? error.message : "Unknown error"}`));
  }, [apiMode, authenticated]);

  const go = (id: Page) => { setPage(id); setSidebar(false); };
  const openSalesInvoice = () => { setPage("sales"); setSalesCreateKey(key => key + 1); setSidebar(false); };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };

  if (!authenticated) return <LoginScreen onLogin={() => setAuthenticated(true)}/>;

  return <div className="app-shell">
    <aside className={`sidebar ${sidebar ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-logo"><img src={happyBondingLogo} alt="Happy Bonding logo"/></div>
        <div><strong>Happy Bonding</strong><span>Men's Wear ERP</span></div>
        <button className="icon-button close-menu" onClick={() => setSidebar(false)}><X size={19}/></button>
      </div>
      <button className="new-sale" onClick={openSalesInvoice}><Plus size={17}/> New sale <span>F2</span></button>
      <nav>{nav.map(group => <div className="nav-group" key={group.section}>
        <p>{group.section}</p>
        {group.items.map(item => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => go(item.id)}>
          <item.icon size={18}/><span>{item.label}</span>
        </button>)}
      </div>)}</nav>
      <div className="branch-card"><Building2 size={17}/><div><small>Current branch</small><strong>Pavoorchatram</strong></div><ChevronDown size={16}/></div>
    </aside>
    <main>
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setSidebar(true)}><Menu/></button>
        <div><strong>{nav.flatMap(n => n.items).find(n => n.id === page)?.label}</strong><span>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric",weekday:"long"})}</span></div>
        <div className="top-actions"><button className="icon-button"><Search size={19}/></button><div className="avatar">SK</div></div>
      </header>
      <section className={page === "pos" ? "page pos-page" : "page"}>
        {page === "dashboard" && <DashboardLive products={productRows} parties={partyRows} invoices={invoiceRows} onNewSale={openSalesInvoice}/>} 
        {page === "parties" && <Parties rows={partyRows} setRows={setPartyRows} notify={notify} apiMode={apiMode}/>} 
        {page === "items" && <Items rows={productRows} setRows={setProductRows} notify={notify} apiMode={apiMode}/>} 
        {page === "sales" && <Sales rows={invoiceRows} products={productRows} parties={partyRows} setting={invoiceSetting} setSetting={setInvoiceSetting} setRows={setInvoiceRows} setParties={setPartyRows} setProducts={setProductRows} notify={notify} autoCreateKey={salesCreateKey}/>} 
        {page === "purchases" && <Purchases notify={notify}/>} 
        {page === "reports" && <Reports/>} 
        {page === "cash" && <CashBank notify={notify}/>} 
        {page === "pos" && <POS products={productRows} invoices={invoiceRows} setInvoices={setInvoiceRows} setProducts={setProductRows} notify={notify} apiMode={apiMode}/>} 
        {page === "staff" && <Staff/>} 
        {page === "settings" && <SettingsPage notify={notify}/>} 
      </section>
    </main>
    {sidebar && <div className="scrim" onClick={() => setSidebar(false)}/>} 
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await api.login(String(form.get("email")), String(form.get("password"))); onLogin(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Login failed"); } finally { setBusy(false); } };
  return <main className="login-page"><section className="login-panel"><div className="brand-logo login-brand-logo"><img src={happyBondingLogo} alt="Happy Bonding logo"/></div><div><h1>Welcome back</h1><p>Sign in to Happy Bonding ERP</p></div><form onSubmit={submit}><label>Email address<input name="email" type="email" defaultValue="admin@happybonding.in" required/></label><label>Password<input name="password" type="password" required/></label>{error && <div className="login-error">{error}</div>}<button className="primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button></form><small>Secure access · Branch permissions · Audit enabled</small></section><aside><div><img className="hero-logo" src={happyBondingLogo} alt="Happy Bonding logo"/><span>HAPPY BONDING ERP</span><h2>One system for every sale, stock movement and rupee.</h2><p>GST billing, garment variants and branch-wise control designed for your store.</p></div></aside></main>;
}

function PageHeading({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="primary" onClick={onAction}><Plus size={17}/>{action}</button>}</div>;
}

function Metric({ label, value, icon: Icon, tone = "amber", hint }: { label: string; value: string; icon: typeof TrendingUp; tone?: string; hint?: string }) {
  return <article className={`metric ${tone}`}><div className="metric-icon"><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div></article>;
}

function DashboardLive({ products, parties, invoices, onNewSale }: { products: Product[]; parties: Party[]; invoices: Invoice[]; onNewSale: () => void }) {
  const today = new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  const todaysInvoices = invoices.filter(x => x.date === today);
  const totalSales = invoices.reduce((sum,row)=>sum+row.amount,0);
  const todaysSales = todaysInvoices.reduce((sum,row)=>sum+row.amount,0);
  const outstandingInvoices = invoices.filter(x=>x.status!=="Paid");
  const outstanding = outstandingInvoices.reduce((sum,row)=>sum+row.amount,0);
  const stockValue = products.reduce((sum,row)=>sum+row.purchasePrice*row.stock,0);
  const lowStock = products.filter(row=>row.stock>0 && row.stock<10).length;
  const outOfStock = products.filter(row=>row.stock<=0).length;
  const chartDays = lastSevenDays(invoices);
  const maxDaySale = Math.max(...chartDays.map(x=>x.amount),1);
  return <>
    <PageHeading title="Dashboard" subtitle="Live business snapshot from your PostgreSQL data." action="Create sale" onAction={onNewSale}/>
    <div className="metrics-grid">
      <Metric label="Today's sales" value={money(todaysSales)} icon={TrendingUp} hint={`${todaysInvoices.length} invoices`}/>
      <Metric label="Total sales" value={money(totalSales)} icon={CircleIndianRupee} tone="green" hint={`${invoices.length} invoices`}/>
      <Metric label="Outstanding" value={money(outstanding)} icon={CreditCard} tone="red" hint={`${outstandingInvoices.length} unpaid invoices`}/>
      <Metric label="Stock value" value={money(stockValue)} icon={Boxes} tone="blue" hint={`${lowStock} low-stock variants`}/>
    </div>
    <div className="dashboard-grid">
      <article className="card chart-card"><div className="card-title"><div><h2>Sales overview</h2><p>Last 7 days</p></div><span className="trend">{money(chartDays.reduce((s,x)=>s+x.amount,0))}</span></div>
        <div className="chart"><div className="chart-labels"><span>{money(maxDaySale)}</span><span>{money(maxDaySale/2)}</span><span>{money(0)}</span></div><div className="bars">{chartDays.map(day=><div key={day.label}><span style={{height:`${Math.max(4,(day.amount/maxDaySale)*100)}%`}}/><small>{day.label}</small></div>)}</div></div>
      </article>
      <article className="card quick-card"><div className="card-title"><div><h2>Quick actions</h2><p>Common daily tasks</p></div></div><div className="quick-grid">{[[PackagePlus,"Add item"],[UsersRound,"New party"],[ShoppingCart,"POS billing"],[ClipboardList,"Reports"]].map(([Icon,label])=>{const I=Icon as typeof PackagePlus;return <button key={label as string}><I size={21}/><span>{label as string}</span></button>})}</div></article>
      <article className="card transactions"><div className="card-title"><div><h2>Recent transactions</h2><p>Latest sales invoices from database</p></div></div>{invoices.length?<InvoiceTable rows={invoices.slice(0,4)}/>:<EmptyState icon={ReceiptIndianRupee} title="No sales invoices yet" text="Create a POS bill to start building live dashboard data."/>}</article>
      <article className="card alerts"><div className="card-title"><div><h2>Needs attention</h2><p>Calculated from current data</p></div></div>
        <div className="alert-row"><span className="alert-dot red"/><div><strong>{outstandingInvoices.length} unpaid invoices</strong><small>{money(outstanding)} pending collection</small></div><span>Review</span></div>
        <div className="alert-row"><span className="alert-dot amber"/><div><strong>{lowStock} low-stock items</strong><small>{outOfStock} variants are out of stock</small></div><span>Restock</span></div>
        <div className="alert-row"><span className="alert-dot blue"/><div><strong>{parties.length} parties</strong><small>{parties.filter(x=>x.type==="Customer").length} customers, {parties.filter(x=>x.type==="Supplier").length} suppliers</small></div><span>View</span></div>
      </article>
    </div>
  </>;
}

function lastSevenDays(invoices: Invoice[]) {
  const days = Array.from({length:7},(_,index)=>{const date=new Date();date.setDate(date.getDate()-(6-index));return date;});
  return days.map(date=>{const label=date.toLocaleDateString("en-IN",{weekday:"short"});const key=date.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});return {label,amount:invoices.filter(row=>row.date===key).reduce((sum,row)=>sum+row.amount,0)};});
}

function EmptyState({icon:Icon,title,text}:{icon:typeof ReceiptIndianRupee;title:string;text:string}){return <div className="empty"><Icon/><h3>{title}</h3><p>{text}</p></div>;}

function SearchRow({ value, onChange, placeholder }: { value: string; onChange: (v:string)=>void; placeholder: string }) { return <div className="search-box"><Search size={17}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>; }

function partyPayloadFromForm(form: FormData): Parameters<typeof api.createParty>[0] {
  const balance = Number(form.get("openingBalance") || 0);
  const balanceType = String(form.get("openingBalanceType") || "TO_COLLECT") as "TO_COLLECT" | "TO_PAY";
  const gstin = String(form.get("gstin") || "").trim();
  return {
    name: String(form.get("name") || "").trim(), phone: String(form.get("phone") || "").trim(), email: String(form.get("email") || "").trim() || undefined,
    type: String(form.get("type") || "Customer") as Party["type"], gstin: gstin.length === 15 ? gstin : undefined, pan: String(form.get("pan") || "").trim() || undefined,
    category: String(form.get("category") || "").trim() || undefined, openingBalance: balanceType === "TO_PAY" ? -Math.abs(balance) : Math.abs(balance), openingBalanceType: balanceType,
    address: String(form.get("address") || "").trim() || undefined, sameAsBilling: form.get("sameAsBilling") === "on", shippingAddress: form.get("sameAsBilling") === "on" ? String(form.get("address") || "").trim() || undefined : String(form.get("shippingAddress") || "").trim() || undefined,
    creditPeriodDays: Number(form.get("creditPeriodDays") || 30), creditLimit: Number(form.get("creditLimit") || 0),
    contactPersonName: String(form.get("contactPersonName") || "").trim() || undefined, contactPersonDob: String(form.get("contactPersonDob") || "").trim() || undefined,
    bankName: String(form.get("bankName") || "").trim() || undefined, bankAccountName: String(form.get("bankAccountName") || "").trim() || undefined, bankAccountNumber: String(form.get("bankAccountNumber") || "").trim() || undefined, bankIfsc: String(form.get("bankIfsc") || "").trim() || undefined, bankBranch: String(form.get("bankBranch") || "").trim() || undefined,
    customBirthday: String(form.get("customBirthday") || "").trim() || undefined, customKovilThiruvila: String(form.get("customKovilThiruvila") || "").trim() || undefined,
  };
}

function dedupeContacts(list: Array<{ name: string; phone: string; email?: string; address?: string }>) {
  const seen = new Set<string>();
  const result: Array<{ name: string; phone: string; email?: string; address?: string }> = [];
  for (const item of list) {
    const rawPhone = String(item.phone || "").replace(/\D/g, "");
    const phone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;
    const name = item.name.trim();
    if (!name || !phone || phone.length < 7) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    result.push({ name, phone, email: item.email?.trim() || undefined, address: item.address?.trim() || undefined });
  }
  return result;
}

function parseContactsCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && next === "\n") i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  const headers = rows.shift()?.map(x => x.trim()) ?? [];
  const find = (names: string[]) => names.map(n => headers.findIndex(h => h.toLowerCase() === n.toLowerCase())).find(i => i !== undefined && i >= 0) ?? -1;
  const firstName = find(["Given Name","First Name"]);
  const fullName = find(["Name","Full Name","Party Name","Customer Name","Customer","Party"]);
  const phone = find(["Phone 1 - Value","Mobile Phone","Mobile","Phone","Phone Number","Mobile No","Mobile Number","Contact","Contact Number"]);
  const email = find(["E-mail 1 - Value","Email","E-mail","Email ID","Email Address"]);
  const address = find(["Address 1 - Formatted","Address","Home Address","Billing Address"]);
  return rows.map(cols => ({ name: (fullName >= 0 ? cols[fullName] : "") || (firstName >= 0 ? cols[firstName] : "") || (phone >= 0 ? cols[phone] : ""), phone: phone >= 0 ? cols[phone] : "", email: email >= 0 ? cols[email] : "", address: address >= 0 ? cols[address] : "" })).filter(x => x.name || x.phone);
}

async function parseContactsFile(file: File) {
  let list: Array<{ name: string; phone: string; email?: string; address?: string }> = [];
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    list = rows.map(row => {
      const getVal = (keys: string[]) => {
        for (const k of Object.keys(row)) {
          if (keys.some(x => x.toLowerCase() === k.toLowerCase().trim())) return String(row[k] ?? "").trim();
        }
        return "";
      };
      const name = getVal(["Name", "Party Name", "Customer Name", "Customer", "Full Name", "Given Name", "First Name", "Party"]);
      const phone = getVal(["Phone", "Mobile", "Mobile Number", "Phone Number", "Mobile No", "Contact", "Phone 1 - Value", "Mobile Phone", "Contact Number"]);
      const email = getVal(["Email", "E-mail", "Email ID", "Email Address", "E-mail 1 - Value"]);
      const address = getVal(["Address", "Billing Address", "Address 1 - Formatted", "Home Address"]);
      return { name: name || phone, phone, email, address };
    });
  } else {
    list = parseContactsCsv(await file.text());
  }
  return dedupeContacts(list);
}

function downloadSampleTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    { "Party Name": "Raja Textiles", "Mobile Number": "9876543210", "Email": "raja@gmail.com", "Address": "No. 12 Main Road, Tenkasi", "GSTIN": "33ABCDE1234F1Z5", "Opening Balance": 0, "Party Type": "Customer" },
    { "Party Name": "Murugan Stores", "Mobile Number": "9123456789", "Email": "", "Address": "Pavoorchatram", "GSTIN": "", "Opening Balance": 500, "Party Type": "Customer" },
    { "Party Name": "Kannan Readymades", "Mobile Number": "9988776655", "Email": "kannan@example.com", "Address": "West Street, Surandai", "GSTIN": "", "Opening Balance": 0, "Party Type": "Customer" },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "happy_bonding_customer_import_template.xlsx");
}

function exportCustomersToExcel(parties: Party[]) {
  const rows = parties.map(p => ({
    "Party Name": p.name,
    "Mobile Number": p.phone || "",
    "Email": p.email || "",
    "Address": p.address || "",
    "GSTIN": p.gstin || "",
    "Opening Balance": p.balance || 0,
    "Party Type": p.type || "Customer",
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Party Name": "", "Mobile Number": "", "Email": "", "Address": "", "GSTIN": "", "Opening Balance": 0, "Party Type": "Customer" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, `happy_bonding_customers_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function PartyCreateForm({onSubmit,onCancel,saving,defaults}:{onSubmit:(e:React.FormEvent<HTMLFormElement>)=>void;onCancel:()=>void;saving:boolean;defaults?:Partial<Party>}){
  return <form onSubmit={onSubmit} className="party-create-form">
    <div className="party-form-bar"><button type="button" className="secondary">Party Settings</button><button type="submit" name="mode" value="new" className="secondary" disabled={saving}>Save & New</button><button className="primary" disabled={saving}>{saving?"Saving...":"Save"}</button></div>
    <h3>General Details</h3><div className="party-grid four"><label>Party Name<span>*</span><input name="name" required defaultValue={defaults?.name||""} placeholder="Enter name"/></label><label>Mobile Number<input name="phone" defaultValue={defaults?.phone||""} placeholder="Enter mobile number"/></label><label>Email<input name="email" type="email" defaultValue={defaults?.email||""} placeholder="Enter email"/></label><label>Opening Balance<div className="split-input"><span>₹</span><input name="openingBalance" type="number" defaultValue={Math.abs(defaults?.balance||0)} /><select name="openingBalanceType" defaultValue={defaults?.openingBalanceType||"TO_COLLECT"}><option value="TO_COLLECT">To Collect</option><option value="TO_PAY">To Pay</option></select></div></label><label>GSTIN<input name="gstin" defaultValue={defaults?.gstin||""} placeholder="ex: 29XXXX9438X1XX"/></label><label>PAN Number<input name="pan" defaultValue={defaults?.pan||""} placeholder="Enter party PAN Number"/></label></div>
    <p className="form-note">Note: GSTIN details can be filled manually now; auto-fetch can be added later.</p>
    <div className="party-grid two"><label>Party Type<span>*</span><select name="type" defaultValue={defaults?.type||"Customer"}><option>Customer</option><option>Supplier</option></select></label><label>Party Category<input name="category" defaultValue={defaults?.category||""} placeholder="Search Categories"/></label></div>
    <h3>Address</h3><div className="party-grid two"><label>Billing Address<textarea name="address" defaultValue={defaults?.address||""} placeholder="Enter billing address"/></label><label>Shipping Address <span className="checkline"><input type="checkbox" name="sameAsBilling" defaultChecked={defaults?.sameAsBilling!==false}/> Same as Billing address</span><textarea name="shippingAddress" defaultValue={defaults?.shippingAddress||""} placeholder="Enter shipping address"/></label></div>
    <div className="party-grid two slim"><label>Credit Period<div className="split-input"><input name="creditPeriodDays" type="number" defaultValue={defaults?.creditPeriodDays??30}/><span>Days</span></div></label><label>Credit Limit<div className="split-input"><span>₹</span><input name="creditLimit" type="number" defaultValue={defaults?.creditLimit??0}/></div></label></div>
    <h3>Contact Person Details</h3><div className="party-grid two slim"><label>Contact Person Name<input name="contactPersonName" defaultValue={defaults?.contactPersonName||""} placeholder="Ex: Ankit Mishra"/></label><label>Date of Birth<input name="contactPersonDob" type="date" defaultValue={defaults?.contactPersonDob ? defaults.contactPersonDob.slice(0,10) : ""}/></label></div>
    <h3>Party Bank Account</h3><div className="party-grid four"><label>Bank Name<input name="bankName" defaultValue={defaults?.bankName||""} placeholder="Bank name"/></label><label>Account Holder<input name="bankAccountName" defaultValue={defaults?.bankAccountName||""} placeholder="Account holder name"/></label><label>Account Number<input name="bankAccountNumber" defaultValue={defaults?.bankAccountNumber||""} placeholder="Account number"/></label><label>IFSC<input name="bankIfsc" defaultValue={defaults?.bankIfsc||""} placeholder="IFSC"/></label><label>Branch<input name="bankBranch" defaultValue={defaults?.bankBranch||""} placeholder="Branch"/></label></div>
    <h3>Custom Field</h3><div className="party-grid two slim"><label>BIRTHDAY<input name="customBirthday" defaultValue={defaults?.customBirthday||""} placeholder="Custom Value"/></label><label>KOVIL THIRUVILA<input name="customKovilThiruvila" defaultValue={defaults?.customKovilThiruvila||""} placeholder="Custom Value"/></label></div>
    <div className="modal-actions full"><button type="button" className="secondary" onClick={onCancel} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving?"Saving...":"Save Party"}</button></div>
  </form>
}

function Parties({ rows, setRows, notify, apiMode }: { rows: Party[]; setRows:(r:Party[])=>void; notify:(s:string)=>void; apiMode:boolean }) {
  const [query,setQuery]=useState(""); const [modal,setModal]=useState(false); const [editing,setEditing]=useState<Party|undefined>(); const [saving,setSaving]=useState(false);
  const [pageIndex,setPageIndex]=useState(0); const pageSize=100;
  const importInput = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => rows.filter(r=>`${r.name} ${r.phone}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const visibleList = useMemo(() => query.trim() ? filtered.slice(0, 100) : filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), [filtered, query, pageIndex]);

  const add=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault(); const input=partyPayloadFromForm(new FormData(e.currentTarget)); try{setSaving(true); if(apiMode){const saved=await api.createParty(input); setRows([...rows,saved]);} else setRows([...rows,{id:Date.now(),...input,balance:input.openingBalance||0} as Party]); setModal(false);notify("Party created successfully");}catch(error){notify(error instanceof Error ? error.message : "Party save failed");}finally{setSaving(false);}};
  const update=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault(); if(!editing)return; const input=partyPayloadFromForm(new FormData(e.currentTarget)); try{setSaving(true); if(apiMode){const saved=await api.updateParty(editing.id,input); setRows(rows.map(row=>row.id===saved.id?saved:row));} else setRows(rows.map(row=>row.id===editing.id?({...row,...input,balance:input.openingBalance||0} as Party):row)); setEditing(undefined); notify("Party updated successfully");}catch(error){notify(error instanceof Error ? error.message : "Party update failed");}finally{setSaving(false);}};
  const importContacts=async(file?:File)=>{if(!file)return;try{setSaving(true);const contacts=await parseContactsFile(file);if(!contacts.length)throw new Error("File-la contacts kandupidikka mudiyala");const result=await api.importParties(contacts);setRows(await api.parties());notify(`Imported ${result.imported}. Skipped ${result.skipped} duplicates/invalid.`);}catch(error){notify(error instanceof Error ? error.message : "Import failed");}finally{setSaving(false);if(importInput.current)importInput.current.value="";}};
  return <><PageHeading title="Parties" subtitle="Customers, suppliers and outstanding balances." action="Add party" onAction={()=>setModal(true)}/><div className="metrics-grid three"><Metric label="Customers" value={String(rows.filter(r=>r.type==="Customer").length)} icon={UsersRound}/><Metric label="To collect" value={money(rows.filter(r=>r.balance>0).reduce((a,b)=>a+b.balance,0))} icon={CircleIndianRupee} tone="green"/><Metric label="To pay" value={money(Math.abs(rows.filter(r=>r.balance<0).reduce((a,b)=>a+b.balance,0)))} icon={CreditCard} tone="red"/></div><article className="card table-card"><div className="table-toolbar"><SearchRow value={query} onChange={v=>{setQuery(v);setPageIndex(0);}} placeholder="Search name or mobile number"/><div className="party-actions-group"><button className="secondary" title="Download Excel template for bulk customer import" onClick={downloadSampleTemplate}><Download size={14}/> Sample Template</button><button className="secondary" title="Export current customers to Excel" onClick={()=>exportCustomersToExcel(rows)}><FileSpreadsheet size={14}/> Export Customers</button><input ref={importInput} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={e=>importContacts(e.target.files?.[0])}/><button className="primary" disabled={saving} onClick={()=>importInput.current?.click()}><Upload size={14}/> {saving?"Importing...":"Import Excel / CSV"}</button></div></div><div className="table-scroll"><table><thead><tr><th>Party</th><th>Mobile</th><th>Type</th><th>Email</th><th>GSTIN</th><th className="right">Balance</th><th></th></tr></thead><tbody>{visibleList.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.category}</small></td><td>{p.phone}</td><td><span className="pill neutral">{p.type}</span></td><td>{p.email||"-"}</td><td>{p.gstin||"-"}</td><td className={`right ${p.balance<0?"negative":"positive"}`}>{p.balance<0?"Pay ":"Collect "}{money(Math.abs(p.balance))}</td><td className="right"><button className="secondary small-btn" onClick={()=>setEditing(p)}>Edit</button></td></tr>)}</tbody></table></div><div className="table-toolbar pagination-strip"><span>Showing {query ? visibleList.length : `${pageIndex * pageSize + 1} - ${Math.min((pageIndex + 1) * pageSize, filtered.length)}`} of {filtered.length} customers</span>{!query && <div className="tabs"><button disabled={pageIndex === 0} onClick={() => setPageIndex(p => Math.max(0, p - 1))}>Previous</button><button disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}>Next</button></div>}</div></article>{modal&&<Modal title="Create Party" onClose={()=>setModal(false)} wide><PartyCreateForm onSubmit={add} onCancel={()=>setModal(false)} saving={saving}/></Modal>}{editing&&<Modal title={`Edit Party - ${editing.name}`} onClose={()=>setEditing(undefined)} wide><PartyCreateForm onSubmit={update} onCancel={()=>setEditing(undefined)} saving={saving} defaults={editing}/></Modal>}</>;
}

function Items({ rows,setRows,notify,apiMode }:{rows:Product[];setRows:(r:Product[])=>void;notify:(s:string)=>void;apiMode:boolean}) {
  const [query,setQuery]=useState("");
  const [modal,setModal]=useState(false);
  const [saving,setSaving]=useState(false);
  const filtered=rows.filter(r=>`${r.name} ${r.sku}`.toLowerCase().includes(query.toLowerCase()));
  const save=async(input:ItemFormState, reset:boolean)=>{
    if(!input.name.trim()) return notify("Item name is required");
    const payload={name:input.name.trim(),sku:input.code.trim() || input.name.trim().replace(/\s+/g,"-").toUpperCase(),category:input.category || "General",size:input.size || input.unit,openingStock:Number(input.openingStock || 0),purchasePrice:Number(input.purchasePrice || 0),sellingPrice:Number(input.salesPrice || 0),mrp:Number(input.mrp || input.salesPrice || 0)};
    try{setSaving(true);if(apiMode){setRows(await api.createProduct(payload));}else setRows([...rows,{id:Date.now(),...payload,stock:payload.openingStock}]);notify("Item saved successfully");if(reset) return "reset";setModal(false);}catch(error){notify(error instanceof Error ? error.message : "Item save failed");}finally{setSaving(false);}
  };
  return <><PageHeading title="Items & inventory" subtitle="Manage garment variants, pricing and branch stock." action="Add item" onAction={()=>setModal(true)}/><div className="metrics-grid three"><Metric label="Stock value" value={money(rows.reduce((s,p)=>s+p.purchasePrice*p.stock,0))} icon={Boxes}/><Metric label="Low stock" value={String(rows.filter(p=>p.stock<10).length)} icon={TrendingUp} tone="red"/><Metric label="Total variants" value={String(rows.length)} icon={PackagePlus} tone="blue"/></div><article className="card table-card"><div className="table-toolbar"><SearchRow value={query} onChange={setQuery} placeholder="Search item, SKU or barcode"/><button className="secondary">Stock adjustment</button></div><table><thead><tr><th>Item / Variant</th><th>SKU</th><th>Stock</th><th className="right">Purchase</th><th className="right">Selling</th><th className="right">MRP</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.category} · Size {p.size}</small></td><td className="mono">{p.sku}</td><td><span className={`pill ${p.stock<5?"danger":p.stock<10?"warning":"success"}`}>{p.stock} PCS</span></td><td className="right">{money(p.purchasePrice)}</td><td className="right"><strong>{money(p.sellingPrice)}</strong></td><td className="right">{money(p.mrp)}</td></tr>)}</tbody></table></article>{modal&&<ItemModal saving={saving} onClose={()=>setModal(false)} onSave={save}/>}</>;
}

type ItemFormState={type:"Product"|"Service";category:string;name:string;online:boolean;salesPrice:string;salesTaxMode:"With Tax"|"Without Tax";taxRate:string;unit:string;openingStock:string;code:string;hsn:string;lowStock:string;description:string;purchasePrice:string;purchaseTaxMode:"With Tax"|"Without Tax";mrp:string;discount:string;size:string;partyPrice:string;customField:string};
const blankItem:ItemFormState={type:"Product",category:"",name:"",online:false,salesPrice:"",salesTaxMode:"With Tax",taxRate:"5",unit:"Pieces(PCS)",openingStock:"",code:"",hsn:"6205",lowStock:"",description:"",purchasePrice:"",purchaseTaxMode:"With Tax",mrp:"",discount:"",size:"",partyPrice:"",customField:""};

function ItemModal({saving,onClose,onSave}:{saving:boolean;onClose:()=>void;onSave:(input:ItemFormState,reset:boolean)=>Promise<"reset"|void>}){
  const [tab,setTab]=useState("Basic Details");
  const [form,setForm]=useState<ItemFormState>(blankItem);
  const setField=<K extends keyof ItemFormState>(key:K,value:ItemFormState[K])=>setForm(prev=>({...prev,[key]:value}));
  const submit=async(reset:boolean)=>{const result=await onSave(form,reset);if(result==="reset"){setForm(blankItem);setTab("Basic Details");}};
  const tabs=["Basic Details","Stock Details","Pricing Details","Party Wise Prices","Custom Fields"];
  return <Modal title="Create New Item" onClose={onClose} wide>
    <div className="item-create">
      <aside className="item-tabs"><button className={tab==="Basic Details"?"active":""} onClick={()=>setTab("Basic Details")}><PackagePlus size={16}/>Basic Details <span>*</span></button><strong>Advance Details</strong>{tabs.slice(1).map(name=><button key={name} className={tab===name?"active":""} onClick={()=>setTab(name)}><ClipboardList size={16}/>{name}</button>)}</aside>
      <section className="item-panel">
        {tab==="Basic Details"&&<div className="item-section grid-2">
          <label>Item Type <span>*</span><div className="choice-row"><button type="button" className={form.type==="Product"?"selected":""} onClick={()=>setField("type","Product")}>Product</button><button type="button" className={form.type==="Service"?"selected":""} onClick={()=>setField("type","Service")}>Service</button></div></label>
          <label>Category<select value={form.category} onChange={e=>setField("category",e.target.value)}><option value="">Search Categories</option><option>Shirt</option><option>Pant</option><option>T-Shirt</option><option>Accessories</option></select></label>
          <label className="full">Item Name <span>*</span><input autoFocus value={form.name} onChange={e=>setField("name",e.target.value)} placeholder="ex: Maggie 20gm"/></label>
          <label className="toggle-line">Show Item in Online Store <input type="checkbox" checked={form.online} onChange={e=>setField("online",e.target.checked)}/></label>
          <label>Sales Price<div className="input-combo"><span>₹</span><input value={form.salesPrice} onChange={e=>setField("salesPrice",e.target.value)} placeholder="ex: ₹200"/><select value={form.salesTaxMode} onChange={e=>setField("salesTaxMode",e.target.value as ItemFormState["salesTaxMode"])}><option>With Tax</option><option>Without Tax</option></select></div></label>
          <label>GST Tax Rate(%)<select value={form.taxRate} onChange={e=>setField("taxRate",e.target.value)}><option value="0">None</option><option value="5">GST 5%</option><option value="12">GST 12%</option><option value="18">GST 18%</option></select></label>
          <label>Measuring Unit<select value={form.unit} onChange={e=>setField("unit",e.target.value)}><option>Pieces(PCS)</option><option>NOS</option><option>Box</option><option>Meter</option></select></label>
          <label>Opening Stock<div className="input-combo"><input value={form.openingStock} onChange={e=>setField("openingStock",e.target.value)} placeholder="ex: 150 PCS"/><span>PCS</span></div></label>
        </div>}
        {tab==="Stock Details"&&<div className="item-section grid-2">
          <label>Item Code<div className="input-combo"><input value={form.code} onChange={e=>setField("code",e.target.value)} placeholder="ex: ITM12549"/><button type="button" onClick={()=>setField("code",`HB${Date.now().toString().slice(-6)}`)}>Generate Barcode</button></div></label>
          <label>HSN code<input value={form.hsn} onChange={e=>setField("hsn",e.target.value)} placeholder="ex: 4010"/><small>Find HSN Code</small></label>
          <label>Measuring Unit<select value={form.unit} onChange={e=>setField("unit",e.target.value)}><option>Pieces(PCS)</option><option>NOS</option><option>Box</option></select></label>
          <label>Size<input value={form.size} onChange={e=>setField("size",e.target.value)} placeholder="ex: 28, M, XL"/></label>
          <label>Opening Stock<div className="input-combo"><input value={form.openingStock} onChange={e=>setField("openingStock",e.target.value)} placeholder="ex: 150 PCS"/><span>PCS</span></div></label>
          <label>As of Date<input type="date" defaultValue="2026-08-03"/></label>
          <label>Low stock quantity warning<input value={form.lowStock} onChange={e=>setField("lowStock",e.target.value)} placeholder="ex: 5"/></label>
          <label className="full">Description<textarea value={form.description} onChange={e=>setField("description",e.target.value)} placeholder="Enter Description"/></label>
        </div>}
        {tab==="Pricing Details"&&<div className="item-section grid-2">
          <label>Sales Price<div className="input-combo"><span>₹</span><input value={form.salesPrice} onChange={e=>setField("salesPrice",e.target.value)} placeholder="ex: ₹200"/><select value={form.salesTaxMode} onChange={e=>setField("salesTaxMode",e.target.value as ItemFormState["salesTaxMode"])}><option>With Tax</option><option>Without Tax</option></select></div></label>
          <label>Purchase Price<div className="input-combo"><span>₹</span><input value={form.purchasePrice} onChange={e=>setField("purchasePrice",e.target.value)} placeholder="ex: ₹200"/><select value={form.purchaseTaxMode} onChange={e=>setField("purchaseTaxMode",e.target.value as ItemFormState["purchaseTaxMode"])}><option>With Tax</option><option>Without Tax</option></select></div></label>
          <label>Maximum Retail Price (MRP)<input value={form.mrp} onChange={e=>setField("mrp",e.target.value)} placeholder="ex: ₹200"/></label>
          <label>GST Tax Rate(%)<select value={form.taxRate} onChange={e=>setField("taxRate",e.target.value)}><option value="0">None</option><option value="5">GST 5%</option><option value="12">GST 12%</option><option value="18">GST 18%</option></select></label>
          <label>Discount on Sales Price<input value={form.discount} onChange={e=>setField("discount",e.target.value)} placeholder="ex: 12%"/></label>
        </div>}
        {tab==="Party Wise Prices"&&<div className="item-section"><div className="info-strip">Set special sales price or purchase price for selected parties.</div><label>Party wise price<input value={form.partyPrice} onChange={e=>setField("partyPrice",e.target.value)} placeholder="ex: Wholesale customers ₹450"/></label></div>}
        {tab==="Custom Fields"&&<div className="item-section custom-empty"><div className="info-strip">To add/manage item custom fields go to Item Settings</div><ClipboardList size={48}/><p>You don't have any custom fields created yet</p><label>Temporary custom note<input value={form.customField} onChange={e=>setField("customField",e.target.value)} placeholder="Optional"/></label></div>}
      </section>
    </div>
    <div className="modal-actions item-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="secondary" onClick={()=>submit(true)} disabled={saving}>{saving?"Saving...":"Save & New"}</button><button type="button" className="primary" onClick={()=>submit(false)} disabled={saving}>{saving?"Saving...":"Save Item"}</button></div>
  </Modal>;
}

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

type InvoiceLineDraft={product:Product;qty:number;discount:number;taxRate:number};
function Sales({rows,products,parties,setting,setSetting,setRows,setParties,setProducts,notify,autoCreateKey}:{rows:Invoice[];products:Product[];parties:Party[];setting:InvoiceSetting;setSetting:(x:InvoiceSetting)=>void;setRows:(x:Invoice[])=>void;setParties:(x:Party[])=>void;setProducts:(x:Product[])=>void;notify:(s:string)=>void;autoCreateKey:number}) {
  const [query,setQuery]=useState("");
  const [creating,setCreating]=useState(false);
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

  const list=rows.filter(x=>`${x.party} ${x.number}`.toLowerCase().includes(query.toLowerCase()));
  const partyMatches=(partySearch.trim()?parties.filter(p=>`${p.name} ${p.phone}`.toLowerCase().includes(partySearch.toLowerCase())):parties).slice(0,8);
  const itemMatches=itemSearch?products.filter(p=>`${p.name} ${p.sku}`.toLowerCase().includes(itemSearch.toLowerCase())).slice(0,5):[];
  const subtotal=lines.reduce((sum,line)=>sum+line.product.sellingPrice*line.qty,0);
  const discount=lines.reduce((sum,line)=>sum+line.discount,0);
  const tax=lines.reduce((sum,line)=>sum+((line.product.sellingPrice*line.qty-line.discount)*(line.taxRate??line.product.taxRate??5)/100),0);
  const taxable=Math.max(0,subtotal-discount-invoiceDiscount);
  const total=Math.max(0,Math.round((subtotal-discount-invoiceDiscount+tax+additionalCharges)*100)/100);
  const dueDate=new Date(invoiceDate); dueDate.setDate(dueDate.getDate()+Number(paymentTerms||0));
  useEffect(()=>{if(autoCreateKey)setCreating(true);},[autoCreateKey]);
  useEffect(()=>{setPaymentTerms(setting.paymentTermsDays);},[setting.paymentTermsDays]);
  useEffect(()=>{setTerms(setting.terms);},[setting.terms]);
  useEffect(()=>{if(creating) api.nextSaleNumber(new Date(invoiceDate)).then(x=>setNextNumber(x.invoiceNumber)).catch(()=>setNextNumber(""));},[creating,rows.length,invoiceDate]);
  
  const addLine=(product:Product, taxRate?:number)=>{setLines(current=>{const found=current.find(x=>x.product.id===product.id);return found?current.map(x=>x.product.id===product.id?{...x,qty:x.qty+1}:x):[...current,{product,qty:1,discount:0,taxRate:taxRate??product.taxRate??5}]});setItemSearch("");};
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

  const saveSettings=async()=>{
    try{
      const payload = {
        ...setting,
        bankName: setting.bankName?.trim() || undefined,
        accountName: setting.accountName?.trim() || undefined,
        accountNumber: setting.accountNumber?.trim() || undefined,
        ifsc: setting.ifsc?.trim() || undefined,
        upiId: setting.upiId?.trim() || undefined,
        qrText: setting.qrText?.trim() || undefined,
        signatureText: setting.signatureText?.trim() || undefined,
        signatureUrl: setting.signatureUrl || undefined,
      };
      setSetting(await api.saveInvoiceSetting(payload));
      notify("Bank & Invoice details saved");
    }catch(error){
      notify(error instanceof Error?error.message:"Settings save failed");
    }
  };
  const createPartyFromInvoice=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();try{setSaving(true);const saved=await api.createParty(partyPayloadFromForm(new FormData(e.currentTarget)));setParties([...parties,saved]);setSelectedParty(saved);setPartyOpen(false);setPartySearch(`${saved.name} ${saved.phone}`);setPartyModal(false);setNewParty({name:"",phone:"",address:"",gstin:""});notify("Party created and selected");}catch(error){notify(error instanceof Error?error.message:"Party save failed");}finally{setSaving(false);}};
  const resetInvoiceForm=()=>{setLines([]);setPartyOpen(false);setPaid(0);setNotes("");setInvoiceDiscount(0);setAdditionalCharges(0);setShowNotes(false);setShowTerms(false);setShowBank(false);setShowQr(false);setNewParty({name:"",phone:"",address:"",gstin:""});setPartySearch("");setSelectedParty(undefined);setMarkPaid(false);setInvoiceDate(new Date().toISOString().slice(0,10));};
  const saveInvoice=async(keepOpen=false)=>{
    if(!lines.length)return notify("Add at least one item");
    try{
      setSaving(true);
      let partyId=selectedParty?.id ? String(selectedParty.id) : undefined;
      const received=markPaid?total:paid;
      const next=await api.createSale({partyId,invoiceDate:new Date(invoiceDate),paidAmount:Math.min(received,total),paymentMode,notes:[notes,showTerms?terms:""].filter(Boolean).join("\n"),invoiceDiscount,additionalCharges,lines:lines.map(x=>({variantId:String(x.product.id),quantity:x.qty,unitPrice:x.product.sellingPrice,discount:x.discount}))});
      setRows(next); setProducts(await api.products()); resetInvoiceForm(); setCreating(keepOpen); notify(keepOpen?"Sales invoice saved. Ready for next invoice.":"Sales invoice saved");
    }catch(error){notify(error instanceof Error?error.message:"Invoice save failed");}finally{setSaving(false);}
  };
  if(creating) return <><PageHeading title="Create Sales Invoice" subtitle="myBillBook style invoice entry with database-backed customer and item data." action="Back to invoices" onAction={()=>setCreating(false)}/>
    <div className="invoice-builder polished-invoice"><section className="invoice-work card">
      <div className="invoice-toolbar"><button className="secondary" onClick={()=>setSettingsOpen(!settingsOpen)}><Settings size={15}/> Settings</button><button className="secondary" onClick={()=>saveInvoice(true)} disabled={saving||!lines.length}>{saving?"Saving...":"Save & New"}</button><button className="primary" onClick={()=>saveInvoice(false)} disabled={saving||!lines.length}>{saving?"Saving...":"Save"}</button></div>
      <div className={`invoice-top polished ${selectedParty?"party-selected":""}`}>
        <div className="bill-panel">
          <div className="panel-head">
            <h2>Bill To</h2>
            <label className="cash-default-check"><input type="checkbox" defaultChecked /> Set Cash Sale as default</label>
            {selectedParty&&<button className="secondary compact" onClick={()=>{setSelectedParty(undefined);setPartySearch("");setPartyOpen(true);}}>Change Party</button>}
          </div>
          {!selectedParty&&<div className={`add-party-box ${partyOpen?"has-party":""}`} onClick={()=>setPartyOpen(true)}>
            {!partyOpen ? <button type="button" className="dashed-add-btn"><Plus size={16}/> Add Party</button> : <>
              <Search size={16}/><input value={partySearch} autoFocus onFocus={()=>setPartyOpen(true)} onChange={e=>{setPartySearch(e.target.value);setPartyOpen(true);setSelectedParty(undefined);setNewParty({...newParty,phone:/^\d+$/.test(e.target.value.trim())?e.target.value.trim():newParty.phone,name:/^\d+$/.test(e.target.value.trim())?newParty.name:e.target.value.trim()});}} placeholder="Search party by name or number"/>
              {partyOpen&&<div className="search-results party-dropdown"><div className="dropdown-head"><span>Party Name</span><span>Balance</span></div>{partyMatches.map(p=><button key={p.id} onClick={()=>{setSelectedParty(p);setPartyOpen(false);setPartySearch(`${p.name} ${p.phone}`);}}><div><strong>{p.name}</strong><small>{p.phone||"No mobile"}</small></div><span>{money(Math.abs(p.balance||0))}</span></button>)}{!partyMatches.length&&<div className="dropdown-empty">No party found</div>}<button className="create-result" onClick={()=>setPartyModal(true)}><Plus size={15}/><div><strong>Create Party</strong><small>{partySearch||"Add new customer"}</small></div></button></div>}
            </>}
          </div>}
          {selectedParty&&<div className="party-address-card"><strong>{selectedParty.name}</strong><p><span>Phone Number:</span> {selectedParty.phone||"-"}</p>{selectedParty.gstin&&<p><span>GSTIN:</span> {selectedParty.gstin}</p>}<label>Place of Supply<select defaultValue="Tamil Nadu"><option>Tamil Nadu</option></select></label></div>}
        </div>
        <div className="ship-panel">
          <div className="panel-head"><h2>Ship To</h2>{selectedParty&&<button className="secondary compact">Change Shipping Address</button>}</div>
          {selectedParty?<div className="party-address-card"><strong>{selectedParty.name}</strong><p><span>Phone Number:</span> {selectedParty.phone||"-"}</p>{selectedParty.address&&<p><span>Address:</span> {selectedParty.address}</p>}</div>:<div className="ship-placeholder">Select a party to show shipping details</div>}
        </div>
        <div className="invoice-meta">
          <label>Invoice Prefix<input value={(nextNumber||"HB/SL/26-27/").replace(/[^/]+$/,"")} readOnly/></label><label>Invoice Number<input value={(nextNumber||"Auto").split("/").pop()} readOnly/></label><label>Sales Invoice Date<input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></label><label>Payment Terms<div className="days-input"><input type="number" value={paymentTerms} onChange={e=>setPaymentTerms(Number(e.target.value))}/><span>days</span></div></label><label>Due Date<input value={dueDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})} readOnly/></label>
        </div>
      </div>
      <div className="item-add-row polished" style={{ gridTemplateColumns: "1fr 220px 180px" }}>
        <div className="party-picker item-search"><Search size={16}/><input value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="+ Add Item by name, SKU or barcode"/>{itemMatches.length>0&&<div className="search-results">{itemMatches.map(p=><button key={p.id} onClick={()=>addLine(p)}><div><strong>{p.name}</strong><small>{p.sku} · Stock {p.stock} · GST {p.taxRate??5}%</small></div><span>{money(p.sellingPrice)}</span></button>)}</div>}</div>
        <button type="button" className="dashed-add-btn" style={{ height: 48, margin: 0, justifyContent: "center" }} onClick={() => setShowAddItemsModal(true)}>
          <Plus size={16} /> Add Items to Bill
        </button>
        <div className="scan-barcode-card" onClick={()=>notify("Barcode scanner active. Ready for item SKU or Barcode scanning.")}>
          <BarcodeIcon />
          <span>Scan Barcode</span>
        </div>
      </div>
      <table className="invoice-items-table"><thead><tr><th>No</th><th>Items / Services</th><th>HSN/SAC</th><th>MRP</th><th>Qty</th><th>Price/Item</th><th>Discount</th><th>Tax</th><th className="right">Amount</th></tr></thead><tbody>{lines.map((line,index)=>{const taxable=line.product.sellingPrice*line.qty-line.discount;const currentTaxRate=line.taxRate??line.product.taxRate??5;const lineTax=taxable*currentTaxRate/100;return <tr key={line.product.id}><td>{index+1}</td><td><strong>{line.product.name}</strong><small>{line.product.sku}</small></td><td>{line.product.hsnCode||"-"}</td><td>{money(line.product.mrp)}</td><td><input className="mini-input" type="number" value={line.qty} min={1} onChange={e=>setLines(lines.map(x=>x.product.id===line.product.id?{...x,qty:Number(e.target.value)}:x))}/></td><td>{money(line.product.sellingPrice)}</td><td><input className="mini-input" type="number" value={line.discount} onChange={e=>setLines(lines.map(x=>x.product.id===line.product.id?{...x,discount:Number(e.target.value)}:x))}/></td><td><select className="mini-select" value={currentTaxRate} onChange={e=>setLines(lines.map(x=>x.product.id===line.product.id?{...x,taxRate:Number(e.target.value)}:x))}>{GST_TAX_OPTIONS.map(opt=><option key={opt.label} value={opt.value}>{opt.label}</option>)}</select><small className="tax-amount-sub">({money(lineTax)})</small></td><td className="right"><strong>{money(taxable+lineTax)}</strong></td></tr>})}</tbody></table>
      <div className="subtotal-strip">
        <span>SUBTOTAL</span>
        <span>{money(subtotal)}</span>
        <span>{money(discount)}</span>
        <span>{money(tax)}</span>
      </div>
      {!lines.length&&<EmptyState icon={ShoppingCart} title="No items added" text="Search and add products to build the invoice."/>}
      <div className="invoice-bottom polished functional">
        <div className="invoice-left-links">
          <button className="text-button" onClick={()=>setShowNotes(!showNotes)}>+ Add Notes</button>
          {showNotes&&<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add Notes"/>}
          <button className="text-button" onClick={()=>setShowTerms(!showTerms)}>+ Add Terms and Conditions</button>
          {showTerms&&<textarea value={terms} onChange={e=>setTerms(e.target.value)} placeholder="Terms and Conditions"/>}
          <button className="text-button" onClick={()=>setShowBank(!showBank)}>+ Add Bank Account</button>
          {showBank&&<div className="inline-settings">
            <label>Bank Name<input value={setting.bankName||""} onChange={e=>setSetting({...setting,bankName:e.target.value})}/></label>
            <label>Account Name<input value={setting.accountName||""} onChange={e=>setSetting({...setting,accountName:e.target.value})}/></label>
            <label>Account Number<input value={setting.accountNumber||""} onChange={e=>setSetting({...setting,accountNumber:e.target.value})}/></label>
            <label>IFSC<input value={setting.ifsc||""} onChange={e=>setSetting({...setting,ifsc:e.target.value})}/></label>
            <button className="secondary" onClick={saveSettings}>Save Bank Details</button>
          </div>}
          <button className="text-button" onClick={()=>setShowQr(!showQr)}>+ Add Payment QR / UPI</button>
          {showQr&&<div className="inline-settings">
            <label>UPI ID<input value={setting.upiId||""} onChange={e=>setSetting({...setting,upiId:e.target.value})} placeholder="example@upi"/></label>
            <label>QR Text / UPI Link<input value={setting.qrText||""} onChange={e=>setSetting({...setting,qrText:e.target.value})} placeholder="upi://pay?..."/></label>
            <button className="secondary" onClick={saveSettings}>Save UPI / QR</button>
          </div>}
          <div className="invoice-print-info">
            <p><strong>Bank / UPI</strong></p>
            <p>{setting.bankName || "Bank name not set"} {setting.accountNumber && `· ${setting.accountNumber}`}</p>
            <p>{setting.ifsc} {setting.upiId && `· UPI: ${setting.upiId}`}</p>
            {setting.qrText&&<div className="qr-box">{setting.qrText}</div>}
            <p><strong>Terms & Conditions</strong></p>
            <p>{terms}</p>
          </div>
        </div>
        <div className="invoice-totals">
          <label className="total-edit-row"><span>Additional Charges</span><input type="number" min={0} value={additionalCharges||""} onChange={e=>setAdditionalCharges(Number(e.target.value||0))} placeholder="Rs 0"/></label>
          <p><span>Taxable Amount</span><strong>{money(taxable)}</strong></p>
          <label className="total-edit-row"><span>Invoice Discount</span><input type="number" min={0} value={invoiceDiscount||""} onChange={e=>setInvoiceDiscount(Number(e.target.value||0))} placeholder="Rs 0"/></label>
          <p><span>Line Discount</span><strong>- {money(discount)}</strong></p>
          <label className="roundoff"><input type="checkbox"/> Auto Round Off <span>{money(0)}</span></label>
          <h3><span>Total Amount</span><strong>{money(total)}</strong></h3>
          <label className="paid-check">Mark as fully paid <input type="checkbox" checked={markPaid} onChange={e=>{setMarkPaid(e.target.checked);if(e.target.checked)setPaid(total);}}/></label>
          <label>Amount Received<div className="amount-received-split-box"><span className="curr-symbol">₹</span><input type="number" value={(markPaid?total:paid)||""} onChange={e=>{setPaid(Number(e.target.value));setMarkPaid(false);}}/><select value={paymentMode} onChange={e=>setPaymentMode(e.target.value as typeof paymentMode)}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Card">Card</option><option value="Bank">Bank</option></select></div></label>
          <div className="balance"><span>Balance Amount</span><strong className="positive">{money(Math.max(0,total-paid))}</strong></div>
          <div className="signature-display-box">
            <span className="signature-label">{setting.signatureText || "Authorized signatory for Happy Bonding Men's Wear"}</span>
            <div className="signature-img-wrap">
              <img src={setting.signatureUrl || defaultSignatureUrl} alt="Stored Digital Signature" />
            </div>
          </div>
          <div className="invoice-save-row"><button className="secondary" onClick={()=>saveInvoice(true)} disabled={saving||!lines.length}>Save & New</button><button className="primary" onClick={()=>saveInvoice(false)} disabled={saving||!lines.length}>{saving?"Saving...":"Save Invoice"}</button></div>
        </div>
      </div>
    </section></div>{settingsOpen&&<Modal title="Invoice Settings" onClose={()=>setSettingsOpen(false)} wide><InvoiceSettingsEditor setting={setting} setSetting={setSetting} onSave={async()=>{await saveSettings();setSettingsOpen(false);}}/></Modal>}{partyModal&&<Modal title="Create Party" onClose={()=>setPartyModal(false)} wide><PartyCreateForm onSubmit={createPartyFromInvoice} onCancel={()=>setPartyModal(false)} saving={saving} defaults={{name:/^\d+$/.test(partySearch.trim())?"":partySearch.trim(),phone:/^\d+$/.test(partySearch.trim())?partySearch.trim():newParty.phone,type:"Customer"}}/></Modal>}{showAddItemsModal&&<AddItemsToBillModal products={products} onClose={()=>setShowAddItemsModal(false)} onAddLines={addBatchLines} onCreateNewItem={()=>{setShowAddItemsModal(false);setCreateItemModal(true);}}/>}</>;
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

function Reports(){const groups={"Sales & profit":["Sales summary","Bill-wise profit","Sales by staff","Sales returns"],"Inventory":["Stock summary","Low stock","Stock valuation","Fast & slow moving"],"GST":["GSTR-1 sales","GSTR-2 purchases","GSTR-3B summary","HSN-wise summary"],"Accounts":["Profit & loss","Balance sheet","Party outstanding","Cash & bank report"]};return <><PageHeading title="Reports" subtitle="Accurate operational, GST and financial insights."/><div className="report-grid">{Object.entries(groups).map(([title,items])=><article className="card report-card" key={title}><div className="report-icon"><FileText/></div><h2>{title}</h2>{items.map(x=><button key={x}>{x}<span>→</span></button>)}</article>)}</div></>}

function CashBank({notify}:{notify:(s:string)=>void}){return <><PageHeading title="Cash & bank" subtitle="Live account balances and money movement." action="Add account" onAction={()=>notify("Cash and bank backend implementation pending")}/><div className="account-layout"><article className="card accounts"><div className="account-total"><span>Total balance</span><strong>{money(0)}</strong></div><EmptyState icon={WalletCards} title="No accounts yet" text="Bank and cash accounts will appear after database support is added."/></article><article className="card transactions"><div className="card-title"><div><h2>Recent account activity</h2><p>Database records only</p></div><button className="secondary">Transfer money</button></div><div className="empty"><WalletCards/><h3>No transactions yet</h3><p>Saved cash and bank transactions will appear here.</p></div></article></div></>}

type CartLine={product:Product;qty:number;discount:number};
function POS({products,invoices,setInvoices,setProducts,notify,apiMode}:{products:Product[];invoices:Invoice[];setInvoices:(x:Invoice[])=>void;setProducts:(x:Product[])=>void;notify:(s:string)=>void;apiMode:boolean}){const [query,setQuery]=useState("");const [cart,setCart]=useState<CartLine[]>([]);const [paid,setPaid]=useState(0);const [saving,setSaving]=useState(false);const matches=query?products.filter(p=>`${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase())).slice(0,5):[];const add=(p:Product)=>{setCart(c=>{const old=c.find(x=>x.product.id===p.id);return old?c.map(x=>x.product.id===p.id?{...x,qty:x.qty+1}:x):[...c,{product:p,qty:1,discount:0}]});setQuery("");};const subtotal=cart.reduce((s,x)=>s+x.product.sellingPrice*x.qty,0);const discount=cart.reduce((s,x)=>s+x.discount,0);const tax=(subtotal-discount)*0.05;const total=Math.round(subtotal-discount+tax);const save=async()=>{if(!cart.length)return notify("Add at least one item");try{setSaving(true);if(apiMode){setInvoices(await api.createSale({paidAmount:Math.min(paid,total),paymentMode:"Cash",lines:cart.map(x=>({variantId:String(x.product.id),quantity:x.qty,unitPrice:x.product.sellingPrice,discount:x.discount}))}));setProducts(await api.products());}else setInvoices([{id:Date.now(),number:`HB/SL/26-27/${2322+invoices.length}`,date:"03 Aug 2026",party:"Cash Sale",amount:total,status:paid>=total?"Paid":"Partially paid"},...invoices]);setCart([]);setPaid(0);notify("Bill saved successfully");}catch(error){notify(error instanceof Error ? error.message : "Bill save failed");}finally{setSaving(false);}};return <><div className="pos-head"><div><h1>POS Billing</h1><p>Counter 1 · Pavoorchatram</p></div><button className="secondary">Hold bill <kbd>Ctrl+B</kbd></button></div><div className="pos-layout"><section className="pos-cart"><div className="pos-search"><Search/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Scan barcode or search item, SKU, category..."/><kbd>F1</kbd>{matches.length>0&&<div className="search-results">{matches.map(p=><button key={p.id} onClick={()=>add(p)}><div><strong>{p.name}</strong><small>{p.sku} · Size {p.size} · {p.stock} in stock</small></div><span>{money(p.sellingPrice)}</span></button>)}</div>}</div>{cart.length===0?<div className="empty pos-empty"><ShoppingCart/><h3>Your cart is empty</h3><p>Scan a barcode or search to add products.</p></div>:<div className="cart-table"><div className="cart-row head"><span>Item</span><span>Price</span><span>Qty</span><span>Amount</span><span/></div>{cart.map(line=><div className="cart-row" key={line.product.id}><span><strong>{line.product.name}</strong><small>{line.product.sku} · Size {line.product.size}</small></span><span>{money(line.product.sellingPrice)}</span><span className="qty"><button onClick={()=>setCart(c=>c.map(x=>x.product.id===line.product.id?{...x,qty:Math.max(1,x.qty-1)}:x))}>-</button>{line.qty}<button onClick={()=>setCart(c=>c.map(x=>x.product.id===line.product.id?{...x,qty:x.qty+1}:x))}>+</button></span><strong>{money(line.product.sellingPrice*line.qty)}</strong><button className="remove" onClick={()=>setCart(c=>c.filter(x=>x.product.id!==line.product.id))}><X/></button></div>)}</div>}</section><aside className="checkout"><div className="customer"><span>Customer details</span><button>Cash Sale <span>Change</span></button></div><div className="bill-summary"><h2>Bill summary</h2><p><span>Subtotal</span><strong>{money(subtotal)}</strong></p><p><span>Discount</span><strong>- {money(discount)}</strong></p><p><span>GST</span><strong>{money(tax)}</strong></p><div><span>Total amount</span><strong>{money(total)}</strong></div></div><label className="payment">Received amount<input type="number" value={paid||""} onChange={e=>setPaid(Number(e.target.value))} placeholder="₹ 0"/><select><option>Cash</option><option>UPI</option><option>Card</option></select></label><div className="balance"><span>Balance</span><strong>{money(Math.max(0,total-paid))}</strong></div><div className="checkout-actions"><button className="secondary" onClick={()=>notify("Print preview ready")} disabled={saving}>Save & print <kbd>F6</kbd></button><button className="primary" onClick={save} disabled={saving}>{saving?"Saving...":"Save bill"} <kbd>F7</kbd></button></div></aside></div></>}

function Staff(){return <><PageHeading title="Staff attendance & payroll" subtitle="Attendance, shifts, salary and advances." action="Add staff"/><div className="metrics-grid"><Metric label="Present" value="0" icon={Users} tone="green"/><Metric label="Absent" value="0" icon={Users} tone="red"/><Metric label="On leave" value="0" icon={Users} tone="blue"/><Metric label="Salary due" value={money(0)} icon={Banknote}/></div><article className="card table-card"><EmptyState icon={Users} title="No staff records yet" text="Staff attendance will show saved database records only."/></article></>}

function SettingsPage({notify}:{notify:(s:string)=>void}){return <><PageHeading title="Business settings" subtitle="Company, GST, invoice and access configuration."/><div className="settings-layout"><div className="settings-menu">{["Business profile","GST & tax","Invoice numbering","Print templates","Users & roles","Branches","Backup & audit"].map((x,i)=><button className={i===0?"active":""} key={x}>{x}</button>)}</div><article className="card settings-form"><h2>Business profile</h2><p>These details appear on GST invoices and receipts.</p><div className="form-grid"><label className="full">Business name<input defaultValue="Happy Bonding Men's Wear"/></label><label>Phone<input defaultValue="7708030903"/></label><label>Email<input placeholder="business@example.com"/></label><label className="full">Billing address<textarea defaultValue="No. 10/901, West Bus Stand, Near Railway Gate, Pavoorchatram - 627808"/></label><label>State<input defaultValue="Tamil Nadu"/></label><label>Pincode<input defaultValue="627808"/></label><label>GSTIN<input defaultValue="33CWZPS9715D1ZU"/></label><label>PAN<input defaultValue="CWZPS9715D"/></label></div><div className="save-line"><button className="primary" onClick={()=>notify("Business settings saved")}>Save changes</button></div></article></div></>}

function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){return <div className="modal-backdrop"><div className={`modal ${wide?"wide":""}`}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X/></button></div>{children}</div></div>}
