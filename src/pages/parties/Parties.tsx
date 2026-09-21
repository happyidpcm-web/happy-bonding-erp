import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Boxes, ChevronDown, ClipboardList, FileSpreadsheet, MessageCircle, MessageSquare, MoreVertical, Plus, Search, Settings, Share2, Trash2
} from "lucide-react";
import * as XLSX from "xlsx";
import { money } from "../../data";
import { api } from "../../api";
import type { Invoice, Party } from "../../types";
import { Modal } from "../../App";

export function PartyLedgerModal({ party, onClose }: { party: Party; onClose: () => void }) {
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.partyLedger(party.id).then(res => {
      setLedger(res);
      setLoading(false);
    });
  }, [party.id]);

  const rows = useMemo(() => {
    if (!ledger) return [];
    const items: any[] = [];
    ledger.invoices?.forEach((inv: any) => {
      items.push({
        id: `inv-${inv.id}`,
        date: new Date(inv.invoiceDate),
        type: "Sales Invoice",
        refNo: inv.invoiceNumber,
        debit: inv.grandTotal,
        credit: 0,
      });
    });
    ledger.payments?.forEach((pay: any) => {
      items.push({
        id: `pay-${pay.id}`,
        date: new Date(pay.paidAt),
        type: "Payment In",
        refNo: pay.mode,
        debit: 0,
        credit: pay.amount,
      });
    });
    items.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = ledger.openingBalance || 0;
    return items.map(item => {
      runningBalance += item.debit - item.credit;
      return { ...item, runningBalance };
    });
  }, [ledger]);

  return (
    <Modal title={`Party Ledger - ${party.name}`} onClose={onClose}>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>Loading Ledger...</div>
      ) : (
        <div className="table-scroll" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Ref No</th>
                <th className="right">Debit (₹)</th>
                <th className="right">Credit (₹)</th>
                <th className="right">Running Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "#f8fafc" }}>
                <td colSpan={5}><strong>Opening Balance</strong></td>
                <td className="right"><strong>{money(ledger?.openingBalance || 0)}</strong></td>
              </tr>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>{row.date.toLocaleDateString()}</td>
                  <td>{row.type}</td>
                  <td>{row.refNo}</td>
                  <td className="right" style={{ color: "#e11d48" }}>{row.debit > 0 ? money(row.debit) : ""}</td>
                  <td className="right" style={{ color: "#16a34a" }}>{row.credit > 0 ? money(row.credit) : ""}</td>
                  <td className="right" style={{ fontWeight: 600 }}>{money(row.runningBalance)} {row.runningBalance > 0 ? "Dr" : row.runningBalance < 0 ? "Cr" : ""}</td>
                </tr>
              ))}
              <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                <td colSpan={3}>Closing Balance</td>
                <td className="right">{money(ledger?.invoiceTotal || 0)}</td>
                <td className="right">{money(ledger?.paidTotal || 0)}</td>
                <td className="right">{money(ledger?.balance || 0)} {Number(ledger?.balance) > 0 ? "Dr" : Number(ledger?.balance) < 0 ? "Cr" : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export function partyPayloadFromForm(form: FormData): Parameters<typeof api.createParty>[0] {
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

export function dedupeContacts(list: Array<{ name: string; phone: string; email?: string; address?: string }>) {
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

export function parseContactsCsv(text: string) {
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

export async function parseContactsFile(file: File) {
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

export function downloadSampleTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    { "Party Name": "Raja Textiles", "Mobile Number": "9876543210", "Email": "raja@gmail.com", "Address": "No. 12 Main Road, Tenkasi", "GSTIN": "33ABCDE1234F1Z5", "Opening Balance": 0, "Party Type": "Customer" },
    { "Party Name": "Murugan Stores", "Mobile Number": "9123456789", "Email": "", "Address": "Pavoorchatram", "GSTIN": "", "Opening Balance": 500, "Party Type": "Customer" },
    { "Party Name": "Kannan Readymades", "Mobile Number": "9988776655", "Email": "kannan@example.com", "Address": "West Street, Surandai", "GSTIN": "", "Opening Balance": 0, "Party Type": "Customer" },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "happy_bonding_customer_import_template.xlsx");
}

export function exportCustomersToExcel(parties: Party[]) {
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

export function PartyCreateForm({onSubmit,onCancel,saving,defaults}:{onSubmit:(e:React.FormEvent<HTMLFormElement>)=>void;onCancel:()=>void;saving:boolean;defaults?:Partial<Party>}){
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

export function PartySettingsModal({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"greetings" | "custom">("greetings");
  const [milestonesEnabled, setMilestonesEnabled] = useState(true);
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [milestoneTemplate, setMilestoneTemplate] = useState("Hey , {{MilestoneMessage}} with {{YourBusinessName}} — thank you, {{PartyName}}! 🎉 <View Invoice>");
  const [birthdayTemplate, setBirthdayTemplate] = useState("Happy Birthday, {{PartyName}}! 🎂 Wishing you success & smiles.");

  const [customFields, setCustomFields] = useState<string[]>(["BIRTHDAY", "KOVIL THIRUVILA"]);
  const [newFieldName, setNewFieldName] = useState("");

  const handleAddField = () => {
    if (newFieldName.trim()) {
      setCustomFields([...customFields, newFieldName.trim().toUpperCase()]);
      setNewFieldName("");
    }
  };

  const handleDeleteField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    notify("Party Settings saved successfully");
    onClose();
  };

  return (
    <Modal title="Party Settings" onClose={onClose} wide>
      <div className="party-settings-layout">
        <aside className="party-settings-nav">
          <button
            type="button"
            className={activeTab === "greetings" ? "active" : ""}
            onClick={() => setActiveTab("greetings")}
          >
            <MessageSquare size={16} /> Send Smart Greetings
          </button>
          <button
            type="button"
            className={activeTab === "custom" ? "active" : ""}
            onClick={() => setActiveTab("custom")}
          >
            <Boxes size={16} /> Custom Fields
          </button>
        </aside>

        <div className="party-settings-content">
          {activeTab === "greetings" && (
            <div className="settings-section">
              <h3 className="section-title">Select Templates to Share Automated Smart Greetings with Parties on WhatsApp</h3>

              <div className="setting-card">
                <div className="setting-card-head">
                  <div>
                    <strong>Invoice Milestones</strong>
                    <p>Make every 10th, 25th, 50th or 100th invoice feel special.</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={milestonesEnabled}
                      onChange={e => setMilestonesEnabled(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="template-select-box">
                  <select
                    value={milestoneTemplate}
                    onChange={e => setMilestoneTemplate(e.target.value)}
                    disabled={!milestonesEnabled}
                  >
                    <option value="Hey , {{MilestoneMessage}} with {{YourBusinessName}} — thank you, {{PartyName}}! 🎉 <View Invoice>">
                      {"Hey , {{MilestoneMessage}} with {{YourBusinessName}} — thank you, {{PartyName}}! 🎉 <View Invoice>"}
                    </option>
                    <option value="Hey , Half-century! 50 invoices with Happy Bonding — thank you, Shubhi Trading! 🥳 <View Invoice>">
                      {"Hey , Half-century! 50 invoices with Happy Bonding — thank you, Shubhi Trading! 🥳 <View Invoice>"}
                    </option>
                  </select>
                </div>
              </div>

              <div className="setting-card" style={{ marginTop: 16 }}>
                <div className="setting-card-head">
                  <div>
                    <strong>Birthday Wishes</strong>
                    <p>Send a warm greeting on your party's birthday automatically.</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={birthdayEnabled}
                      onChange={e => setBirthdayEnabled(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="template-select-box">
                  <select
                    value={birthdayTemplate}
                    onChange={e => setBirthdayTemplate(e.target.value)}
                    disabled={!birthdayEnabled}
                  >
                    <option value="Happy Birthday, {{PartyName}}! 🎂 Wishing you success & smiles.">
                      {"Happy Birthday, {{PartyName}}! 🎂 Wishing you success & smiles."}
                    </option>
                    <option value="Happy Birthday, Shubhi Traders! 🎂 Wishing you success & smiles.">
                      Happy Birthday, Shubhi Traders! 🎂 Wishing you success & smiles.
                    </option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "custom" && (
            <div className="settings-section">
              <h3 className="section-title">Add party custom fields</h3>

              <div className="custom-fields-list">
                {customFields.map((field, idx) => (
                  <div key={idx} className="custom-field-row">
                    <div className="field-input-box">
                      <small>Field Name</small>
                      <input value={field} readOnly />
                    </div>
                    <button
                      type="button"
                      className="icon-button delete-field-btn"
                      onClick={() => handleDeleteField(idx)}
                      title="Delete Field"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                ))}

                <div className="add-field-box" style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={e => setNewFieldName(e.target.value)}
                    placeholder="Enter new field name (e.g. ANNIVERSARY)"
                    style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleAddField}
                    style={{ fontWeight: 700 }}
                  >
                    + Add New Field
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="modal-actions" style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={handleSave} style={{ background: "#4f46e5", borderColor: "#4f46e5" }}>
          Save
        </button>
      </div>
    </Modal>
  );
}

interface BulkPartyRow {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  shippingAddress: string;
  shippingPincode: string;
  shippingCity: string;
  shippingState: string;
  billingAddress: string;
  billingPincode: string;
  billingCity: string;
  billingState: string;
  partyType: string;
  openingBalance: string;
  creditPeriod: string;
  email: string;
  birthday: string;
  kovilThiruvila: string;
}

export function BulkAddPartiesModal({
  existingParties,
  onSaveParties,
  onClose,
  notify,
}: {
  existingParties: Party[];
  onSaveParties: (newParties: Party[]) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const initialRows: BulkPartyRow[] = [
    {
      id: "1",
      name: "Sample Party A",
      phone: "7999999999",
      gstin: "24AABCS1429B1Z0",
      shippingAddress: "Icon Imperio, Pune",
      shippingPincode: "560029",
      shippingCity: "Bangalore",
      shippingState: "Karnataka",
      billingAddress: "139, Pandeyganj, Lucknow",
      billingPincode: "226004",
      billingCity: "Lucknow",
      billingState: "Uttar Pradesh",
      partyType: "Supplier",
      openingBalance: "2000",
      creditPeriod: "1",
      email: "",
      birthday: "",
      kovilThiruvila: "",
    },
    {
      id: "2",
      name: "Sample Party B",
      phone: "9899999999",
      gstin: "09AABCS1429B1Z8",
      shippingAddress: "139, 5th main, Hongasandra, Bangalore",
      shippingPincode: "560029",
      shippingCity: "Bangalore",
      shippingState: "Karnataka",
      billingAddress: "139, Pandeyganj, Lucknow",
      billingPincode: "226004",
      billingCity: "Lucknow",
      billingState: "Uttar Pradesh",
      partyType: "Supplier",
      openingBalance: "0",
      creditPeriod: "2",
      email: "supplier@gmail.com",
      birthday: "",
      kovilThiruvila: "",
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: String(i + 3),
      name: "",
      phone: "",
      gstin: "",
      shippingAddress: "",
      shippingPincode: "",
      shippingCity: "",
      shippingState: "",
      billingAddress: "",
      billingPincode: "",
      billingCity: "",
      billingState: "",
      partyType: "Customer",
      openingBalance: "0",
      creditPeriod: "30",
      email: "",
      birthday: "",
      kovilThiruvila: "",
    })),
  ];

  const [rows, setRows] = useState<BulkPartyRow[]>(initialRows);

  const updateCell = (id: string, field: keyof BulkPartyRow, val: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleReset = () => {
    setRows(initialRows);
    notify("Form reset to default sample rows");
  };

  const handleClearAll = () => {
    setRows(rows.map(r => ({ ...r, name: "", phone: "", gstin: "", shippingAddress: "", billingAddress: "", openingBalance: "0", email: "" })));
    notify("Cleared all table entries");
  };

  const handleSave = async () => {
    const validRows = rows.filter(r => r.name.trim());
    if (!validRows.length) {
      notify("Please enter at least one Party Name");
      return;
    }

    const seenMobiles = new Set<string>();
    const newPartiesList: Party[] = [];
    let duplicatesSkipped = 0;

    for (const r of validRows) {
      const phoneDigits = r.phone.replace(/\D/g, "");
      
      // Check duplicate mobile number against existing database and current batch
      if (phoneDigits && (seenMobiles.has(phoneDigits) || existingParties.some(p => p.phone && p.phone.replace(/\D/g, "") === phoneDigits))) {
        duplicatesSkipped++;
        continue; // Skip duplicate mobile number as requested!
      }

      if (phoneDigits) seenMobiles.add(phoneDigits);

      newPartiesList.push({
        id: Date.now() + Math.random(),
        name: r.name.trim(),
        phone: r.phone.trim(),
        gstin: r.gstin.trim() || undefined,
        address: r.billingAddress.trim() || undefined,
        shippingAddress: r.shippingAddress.trim() || undefined,
        type: (r.partyType || "Customer") as "Customer" | "Supplier",
        balance: Number(r.openingBalance || 0),
        creditPeriodDays: Number(r.creditPeriod || 30),
        email: r.email.trim() || undefined,
        customBirthday: r.birthday.trim() || undefined,
        customKovilThiruvila: r.kovilThiruvila.trim() || undefined,
      });
    }

    if (newPartiesList.length > 0) {
      onSaveParties(newPartiesList);
      notify(`Successfully added ${newPartiesList.length} parties! ${duplicatesSkipped ? `(${duplicatesSkipped} duplicate mobile numbers skipped)` : ""}`);
      onClose();
    } else {
      notify(`All entered parties had duplicate mobile numbers (${duplicatesSkipped} skipped).`);
    }
  };

  return (
    <div className="bulk-add-parties-fullscreen">
      <div className="bulk-add-header">
        <div className="bulk-add-title">
          <button type="button" className="icon-button" onClick={onClose} title="Back to Parties">
            <ArrowLeft size={18} />
          </button>
          <h2>Bulk Add Parties</h2>
          <button type="button" className="text-button" style={{ color: "#2563eb", font: "600 12px Manrope" }} onClick={() => notify("How to Use guide opened")}>
            ⓘ How to Use
          </button>
        </div>

        <div className="bulk-add-actions">
          <button type="button" className="secondary" onClick={handleReset}>
            Reset
          </button>
          <button type="button" className="secondary" onClick={handleClearAll}>
            Clear All Parties
          </button>
          <button type="button" className="primary" onClick={handleSave} style={{ background: "#4f46e5", borderColor: "#4f46e5" }}>
            Save Parties
          </button>
        </div>
      </div>

      <div className="bulk-add-warning-banner">
        <span>You can upload only 4000 parties at once. For uploading more than 4000 parties, please contact our support team at 7400417400</span>
      </div>

      <div className="bulk-spreadsheet-container">
        <table className="bulk-spreadsheet-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Party Name* (mandatory field)</th>
              <th>Mobile Number</th>
              <th>GST number</th>
              <th>Shipping Address</th>
              <th>Shipping pincode</th>
              <th>Shipping city</th>
              <th>Shipping state</th>
              <th>Billing Address</th>
              <th>Billing pincode</th>
              <th>Billing city</th>
              <th>Billing state</th>
              <th>Party Type</th>
              <th>Opening balance</th>
              <th>Credit Period</th>
              <th>Email ID</th>
              <th>BIRTHDAY</th>
              <th>KOVIL THIRUVILA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id}>
                <td className="row-num">{idx + 1}</td>
                <td><input value={row.name} onChange={e => updateCell(row.id, "name", e.target.value)} placeholder="Sample Party Name" /></td>
                <td><input value={row.phone} onChange={e => updateCell(row.id, "phone", e.target.value)} placeholder="Mobile Number" /></td>
                <td><input value={row.gstin} onChange={e => updateCell(row.id, "gstin", e.target.value)} placeholder="GST Number" /></td>
                <td><input value={row.shippingAddress} onChange={e => updateCell(row.id, "shippingAddress", e.target.value)} /></td>
                <td><input value={row.shippingPincode} onChange={e => updateCell(row.id, "shippingPincode", e.target.value)} /></td>
                <td><input value={row.shippingCity} onChange={e => updateCell(row.id, "shippingCity", e.target.value)} /></td>
                <td><input value={row.shippingState} onChange={e => updateCell(row.id, "shippingState", e.target.value)} /></td>
                <td><input value={row.billingAddress} onChange={e => updateCell(row.id, "billingAddress", e.target.value)} /></td>
                <td><input value={row.billingPincode} onChange={e => updateCell(row.id, "billingPincode", e.target.value)} /></td>
                <td><input value={row.billingCity} onChange={e => updateCell(row.id, "billingCity", e.target.value)} /></td>
                <td><input value={row.billingState} onChange={e => updateCell(row.id, "billingState", e.target.value)} /></td>
                <td>
                  <select value={row.partyType} onChange={e => updateCell(row.id, "partyType", e.target.value)}>
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                  </select>
                </td>
                <td><input type="number" value={row.openingBalance} onChange={e => updateCell(row.id, "openingBalance", e.target.value)} /></td>
                <td><input type="number" value={row.creditPeriod} onChange={e => updateCell(row.id, "creditPeriod", e.target.value)} /></td>
                <td><input value={row.email} onChange={e => updateCell(row.id, "email", e.target.value)} /></td>
                <td><input value={row.birthday} onChange={e => updateCell(row.id, "birthday", e.target.value)} /></td>
                <td><input value={row.kovilThiruvila} onChange={e => updateCell(row.id, "kovilThiruvila", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ShareLedgerModal({
  parties,
  onClose,
  notify,
}: {
  parties: Party[];
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [selectedPartyId, setSelectedPartyId] = useState<string | number>(parties[0]?.id || "");
  const selectedParty = parties.find(p => String(p.id) === String(selectedPartyId)) || parties[0];

  const shareUrl = selectedParty
    ? `https://happybonding.in/portal/ledger?party=${encodeURIComponent(selectedParty.name)}&phone=${encodeURIComponent(selectedParty.phone || "")}`
    : "https://happybonding.in/portal/ledger";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    notify("ShareLedger Portal link copied to clipboard!");
  };

  const handleSendWhatsApp = () => {
    if (!selectedParty?.phone) {
      notify("Selected party does not have a mobile number");
      return;
    }
    const num = selectedParty.phone.replace(/\D/g, "");
    const targetPhone = num.length === 10 ? `91${num}` : num;
    const msg = `Dear ${selectedParty.name},\nView your live statement of account, invoices & payment history on your ShareLedger Portal:\n${shareUrl}\n\nThank you!\nHappy Bonding Men's Wear Pavoorchatram.`;
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <Modal title="ShareLedger Portal" onClose={onClose}>
      <div className="share-ledger-modal-body" style={{ padding: 12 }}>
        <div className="info-strip" style={{ marginBottom: 16 }}>
          <strong>What is ShareLedger Portal?</strong>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>
            ShareLedger Portal allows your customers and suppliers to view their live statement of accounts, download invoice PDFs, and pay pending balances online anytime.
          </p>
        </div>

        <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#334155" }}>
          Select Customer / Supplier:
        </label>
        <select
          value={selectedPartyId}
          onChange={e => setSelectedPartyId(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 16, fontSize: 13 }}
        >
          {parties.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.phone || "No phone"}) - Balance: ₹{Math.abs(p.balance || 0).toLocaleString("en-IN")}
            </option>
          ))}
        </select>

        <div className="portal-url-box" style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 20 }}>
          <small style={{ color: "#64748b", fontSize: 10 }}>LIVE PORTAL LINK</small>
          <div style={{ font: "600 12px monospace", color: "#2563eb", wordBreak: "break-all", marginTop: 4 }}>
            {shareUrl}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={handleCopyLink}>
            Copy Link
          </button>
          <button type="button" className="primary" onClick={handleSendWhatsApp} style={{ background: "#25D366", borderColor: "#25D366" }}>
            <MessageCircle size={16} /> Send via WhatsApp
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Parties({
  rows,
  setRows,
  notify,
  apiMode,
  onNavigateReport,
  autoOpenShareLedger,
  onClearAutoOpenShareLedger,
}: {
  rows: Party[];
  setRows: (r: Party[]) => void;
  notify: (s: string) => void;
  apiMode: boolean;
  onNavigateReport: () => void;
  autoOpenShareLedger?: boolean;
  onClearAutoOpenShareLedger?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Party|undefined>();
  const [ledgerParty, setLedgerParty] = useState<Party | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportsDropdownOpen, setReportsDropdownOpen] = useState(false);
  const [bulkActionDropdownOpen, setBulkActionDropdownOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [shareLedgerModalOpen, setShareLedgerModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 100;
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoOpenShareLedger) {
      setShareLedgerModalOpen(true);
      if (onClearAutoOpenShareLedger) onClearAutoOpenShareLedger();
    }
  }, [autoOpenShareLedger, onClearAutoOpenShareLedger]);

  // Dynamic Metrics Calculated from Real Database
  const totalPartiesCount = rows.length;
  const toCollect = useMemo(() => rows.filter(r => r.balance > 0).reduce((a, b) => a + b.balance, 0), [rows]);
  const toPay = useMemo(() => Math.abs(rows.filter(r => r.balance < 0).reduce((a, b) => a + b.balance, 0)), [rows]);

  const categoriesList = useMemo(() => {
    const catSet = new Set<string>();
    rows.forEach(r => { if (r.category) catSet.add(r.category); });
    return Array.from(catSet);
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchQuery = `${r.name} ${r.phone}`.toLowerCase().includes(query.toLowerCase());
      const matchCat = categoryFilter === "All Categories" || r.category === categoryFilter;
      return matchQuery && matchCat;
    });
  }, [rows, query, categoryFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const visibleList = useMemo(() => query.trim() ? filtered.slice(0, 100) : filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), [filtered, query, pageIndex]);

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = partyPayloadFromForm(new FormData(e.currentTarget));
    try {
      setSaving(true);
      if (apiMode) {
        const saved = await api.createParty(input);
        setRows([...rows, saved]);
      } else {
        setRows([...rows, { id: Date.now(), ...input, balance: input.openingBalance || 0 } as Party]);
      }
      setModal(false);
      notify("Party created successfully");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Party save failed");
    } finally {
      setSaving(false);
    }
  };

  const update = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const input = partyPayloadFromForm(new FormData(e.currentTarget));
    try {
      setSaving(true);
      if (apiMode) {
        const saved = await api.updateParty(editing.id, input);
        setRows(rows.map(row => row.id === saved.id ? saved : row));
      } else {
        setRows(rows.map(row => row.id === editing.id ? ({ ...row, ...input, balance: input.openingBalance || 0 } as Party) : row));
      }
      setEditing(undefined);
      notify("Party updated successfully");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Party update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAddParties = (newParties: Party[]) => {
    setRows([...rows, ...newParties]);
  };

  return (
    <>
      {/* Top Heading Strip with Share Ledger Portal, Reports ▾ & Settings */}
      <div className="page-heading parties-page-heading">
        <div>
          <h1>Parties</h1>
        </div>
        <div className="parties-header-actions">
          <button
            type="button"
            className="secondary share-ledger-btn"
            onClick={() => setShareLedgerModalOpen(true)}
          >
            <Share2 size={15} /> ShareLedger Portal
          </button>

          <div className="parties-reports-dropdown">
            <button
              type="button"
              className="secondary reports-btn"
              onClick={() => setReportsDropdownOpen(!reportsDropdownOpen)}
            >
              <FileSpreadsheet size={15} /> Reports <ChevronDown size={14} />
            </button>
            {reportsDropdownOpen && (
              <div className="parties-reports-menu">
                <button onClick={() => { setReportsDropdownOpen(false); onNavigateReport(); notify("Report: Partywise Outstanding opened"); }}>
                  Partywise Outstanding
                </button>
                <button onClick={() => { setReportsDropdownOpen(false); onNavigateReport(); notify("Report: Item Report By Party opened"); }}>
                  Item Report By Party
                </button>
                <button onClick={() => { setReportsDropdownOpen(false); onNavigateReport(); notify("Report: Receivable Ageing Report opened"); }}>
                  Receivable Ageing Report
                </button>
              </div>
            )}
          </div>

          <button className="icon-button" title="Party Settings" onClick={() => setSettingsModalOpen(true)}>
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* 3 Metric Cards matching reference image */}
      <div className="parties-metrics-row">
        <article className="party-metric-box active-blue">
          <span>All Parties</span>
          <strong>{totalPartiesCount}</strong>
        </article>

        <article className="party-metric-box">
          <span>↓ To Collect</span>
          <strong style={{ color: "#16a34a" }}>₹ {toCollect.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
        </article>

        <article className="party-metric-box">
          <span>↑ To Pay</span>
          <strong style={{ color: "#dc2626" }}>₹ {toPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
        </article>
      </div>

      {/* Parties Table Card */}
      <article className="card table-card">
        <div className="table-toolbar parties-toolbar">
          <div className="parties-search-container">
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setPageIndex(0); }}
                placeholder="Search party name or mobile number..."
              />
            </div>
            <div className="category-select-wrap">
              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setPageIndex(0); }}
              >
                <option value="All Categories">Search Categories</option>
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="parties-toolbar-right" style={{ position: "relative" }}>
            <div className="bulk-action-wrap">
              <button className="secondary" onClick={() => setBulkActionDropdownOpen(!bulkActionDropdownOpen)}>
                Bulk Action <ChevronDown size={14} />
              </button>
              {bulkActionDropdownOpen && (
                <div className="bulk-dropdown-menu">
                  <button
                    onClick={() => {
                      setBulkActionDropdownOpen(false);
                      setBulkModalOpen(true);
                    }}
                    className="bulk-add-item-btn"
                  >
                    <div>
                      <strong>Bulk Add Parties</strong>
                      <small>Quickly add all your Parties with Excel</small>
                    </div>
                    <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }} />
                  </button>
                </div>
              )}
            </div>

            <button className="primary purple-party-btn" onClick={() => setModal(true)}>
              <Plus size={16} /> Create Party
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Party Name ⇅</th>
                <th>Category</th>
                <th>Mobile Number</th>
                <th>Party type</th>
                <th className="right">Balance ⇅</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleList.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.category || "-"}</td>
                  <td>{p.phone || "-"}</td>
                  <td><span className="pill neutral">{p.type || "Customer"}</span></td>
                  <td className={`right ${p.balance < 0 ? "negative" : "positive"}`}>
                    {p.balance < 0 ? "↑ " : "↓ "}₹ {Math.abs(p.balance).toLocaleString("en-IN")}
                  </td>
                  <td className="right" style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                    {p.phone && (
                      <button
                        type="button"
                        className="whatsapp-icon-btn"
                        title="Send WhatsApp Message"
                        onClick={() => {
                          const num = p.phone.replace(/\D/g, "");
                          const target = num.length === 10 ? `91${num}` : num;
                          window.open(`https://wa.me/${target}?text=${encodeURIComponent(`Hello ${p.name}! Greeting from Happy Bonding Men's Wear Pavoorchatram.`)}`, "_blank");
                        }}
                      >
                        <MessageCircle size={16} color="#25D366" />
                      </button>
                    )}
                    <button className="icon-button" onClick={() => setLedgerParty(p)} title="View Ledger">
                      <ClipboardList size={16} />
                    </button>
                    <button className="icon-button" onClick={() => setEditing(p)} title="Edit Party">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {!visibleList.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    No parties found matching your search. Click <strong>+ Create Party</strong> to add a customer or supplier.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-toolbar pagination-strip">
          <span>Showing {query ? visibleList.length : `${pageIndex * pageSize + 1} - ${Math.min((pageIndex + 1) * pageSize, filtered.length)}`} of {filtered.length} parties</span>
          {!query && (
            <div className="tabs">
              <button disabled={pageIndex === 0} onClick={() => setPageIndex(p => Math.max(0, p - 1))}>Previous</button>
              <button disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}>Next</button>
            </div>
          )}
        </div>
      </article>

      {modal && (
        <Modal title="Create Party" onClose={() => setModal(false)} wide>
          <PartyCreateForm onSubmit={add} onCancel={() => setModal(false)} saving={saving} />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit Party - ${editing.name}`} onClose={() => setEditing(undefined)} wide>
          <PartyCreateForm onSubmit={update} onCancel={() => setEditing(undefined)} saving={saving} defaults={editing} />
        </Modal>
      )}

      {settingsModalOpen && (
        <PartySettingsModal onClose={() => setSettingsModalOpen(false)} notify={notify} />
      )}

      {shareLedgerModalOpen && (
        <ShareLedgerModal parties={rows} onClose={() => setShareLedgerModalOpen(false)} notify={notify} />
      )}

      {bulkModalOpen && (
        <BulkAddPartiesModal
          existingParties={rows}
          onSaveParties={handleBulkAddParties}
          onClose={() => setBulkModalOpen(false)}
          notify={notify}
        />
      )}

      {ledgerParty && (
        <PartyLedgerModal party={ledgerParty} onClose={() => setLedgerParty(null)} />
      )}
    </>
  );
}
