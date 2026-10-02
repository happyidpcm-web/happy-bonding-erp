import React, { useEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { api } from "../../api";
import type { Branch, InvoiceSetting } from "../../types";
import { Modal, PageHeading, EditBranchModal, BranchManagementModal } from "../../App";

export type SettingsTab = "profile" | "gst" | "numbering" | "print" | "users" | "branches" | "backup";

export function SettingsPage({
  notify,
  branches,
  currentBranchId,
  onSwitchBranch,
  onRefreshData,
  onStaff,
}: {
  notify: (msg: string) => void;
  branches?: Branch[];
  currentBranchId?: string;
  onSwitchBranch?: (branchId: string) => void;
  onRefreshData?: () => Promise<void> | void;
  onStaff: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchModalOpen, setBranchModalOpen] = useState(false);

  // Restore states
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [backupFileContent, setBackupFileContent] = useState<any>(null);
  const [checkOverwrite, setCheckOverwrite] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Live Reset states
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [clearProductsCheck, setClearProductsCheck] = useState(false);
  const [clearPartiesCheck, setClearPartiesCheck] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmInput.trim().toUpperCase() !== "RESET_LIVE") return;
    setResetting(true);
    try {
      const res = await api.resetTransactions({
        doubleConfirmation: "RESET_LIVE",
        clearProducts: clearProductsCheck,
        clearParties: clearPartiesCheck,
      });
      notify(res.message || "Database test data cleared successfully!");
      setResetModalOpen(false);
      setResetConfirmInput("");
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      notify("Reset failed: " + (err.message || "Unknown error"));
    } finally {
      setResetting(false);
    }
  };

  // Business Profile Form States
  const [businessName, setBusinessName] = useState("Happy Bonding Men's Wear");
  const [phone, setPhone] = useState("7708030903");
  const [email, setEmail] = useState("business@example.com");
  const [address, setAddress] = useState("No. 10/901, West Bus Stand, Near Railway Gate, Pavoorchatram - 627808");
  const [stateName, setStateName] = useState("Tamil Nadu");
  const [pincode, setPincode] = useState("627808");
  const [gstin, setGstin] = useState("33CWZPS9715D1ZU");
  const [pan, setPan] = useState("CWZPS9715D");

  // GST & Tax States
  const [taxType, setTaxType] = useState("Regular GST");
  const [defaultTaxRate, setDefaultTaxRate] = useState("5%");
  const [enableIgst, setEnableIgst] = useState(true);

  // Invoice Numbering States
  const [salesPrefix, setSalesPrefix] = useState("HB/SL/26-27/");
  const [quotationPrefix, setQuotationPrefix] = useState("HB/QT/26-27/");
  const [purchasePrefix, setPurchasePrefix] = useState("HB/PUR/26-27/");
  const [seqNo, setSeqNo] = useState("2323");

  // Print Template States
  const [printLayout, setPrintLayout] = useState("Standard A4");
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showTerms, setShowTerms] = useState(true);

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSetting | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [canSaveSettings, setCanSaveSettings] = useState(false);
  const [nextInvoice, setNextInvoice] = useState("");
  useEffect(() => {
    let active = true;
    setInvoiceSettings(null); setSettingsError(""); setCanSaveSettings(false);
    Promise.all([api.invoiceSetting(), api.me(), api.nextSaleNumber()]).then(([settings, me, next]) => {
      if (!active) return;
      setInvoiceSettings(settings); setCanSaveSettings(me.isAdmin); setNextInvoice(next.invoiceNumber);
    }).catch(error => { if (active) setSettingsError(error.message); });
    return () => { active = false; };
  }, [currentBranchId]);
  const updateInvoiceSettings = (patch: Partial<InvoiceSetting>) => setInvoiceSettings(value => value ? { ...value, ...patch } : value);
  const saveConnectedSettings = async () => {
    if (!invoiceSettings || savingSettings || !canSaveSettings) return;
    setSavingSettings(true); setSettingsError("");
    try {
      const saved = await api.saveInvoiceSetting(invoiceSettings);
      setInvoiceSettings(saved);
      setNextInvoice((await api.nextSaleNumber()).invoiceNumber);
      if (onRefreshData) await onRefreshData();
      notify("Invoice settings saved for this branch");
    } catch (error) { setSettingsError(error instanceof Error ? error.message : "Could not save settings"); }
    finally { setSavingSettings(false); }
  };

  const [business, setBusiness] = useState<Awaited<ReturnType<typeof api.businessSettings>> | null>(null);
  const [businessError, setBusinessError] = useState("");
  const [businessSaving, setBusinessSaving] = useState(false);
  useEffect(() => {
    let active = true; setBusiness(null); setBusinessError("");
    api.businessSettings().then(value => { if (active) setBusiness(value); }).catch(error => { if (active) setBusinessError(error.message); });
    return () => { active = false; };
  }, [currentBranchId]);
  const saveBusiness = async () => {
    if (!business || !canSaveSettings || businessSaving) return;
    setBusinessSaving(true); setBusinessError("");
    try { setBusiness(await api.saveBusinessSettings(business)); if (onRefreshData) await onRefreshData(); notify("Business settings saved"); }
    catch (error) { setBusinessError(error instanceof Error ? error.message : "Save failed"); }
    finally { setBusinessSaving(false); }
  };

  const settingsTabs: { id: SettingsTab; label: string }[] = [
    { id: "profile", label: "Business profile" },
    { id: "gst", label: "GST & tax" },
    { id: "numbering", label: "Invoice numbering" },
    { id: "print", label: "Print templates" },
    { id: "users", label: "Users & roles" },
    { id: "branches", label: "Branches" },
    { id: "backup", label: "Backup & audit" },
  ];

  const handleExportBackup = async () => {
    try {
      const backup = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `happy-bonding-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      notify("Database Backup downloaded successfully!");
    } catch {
      notify("Failed to export database backup");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result));
        setBackupFileContent(parsed);
        setRestoreModalOpen(true);
      } catch {
        notify("Invalid JSON backup file format");
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!checkOverwrite || confirmInput.trim() !== "RESTORE") {
      return notify("Please complete double confirmation checks before restoring!");
    }
    setRestoring(true);
    try {
      const res = await api.restoreBackup(backupFileContent, confirmInput.trim());
      notify(res.message || "Database restored successfully!");
      setRestoreModalOpen(false);
      setCheckOverwrite(false);
      setConfirmInput("");
    } catch (err: any) {
      notify(err.message || "Database restore failed");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <PageHeading title="Business settings" subtitle="Company, GST, invoice and access configuration." />
      <div className="settings-layout">
        <div className="settings-menu">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => {
                console.log("Switching settings tab to:", tab.id);
                setActiveTab(tab.id);
                if (tab.id === "branches") setBranchModalOpen(true);
                if (tab.id === "users") onStaff();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === "profile" || activeTab === "gst") && <article className="card settings-form">
          <h2>{activeTab === "profile" ? "Business profile" : "GST details"}</h2>
          <p>Company name and GST details are shared across branches. Address and branch phone apply only to the selected branch.</p>
          {businessError && <p role="alert">{businessError}</p>}
          {!business ? <p>{businessError ? "Could not load business settings. Reopen this page to retry." : "Loading business settings..."}</p> : <>
          {!canSaveSettings && <p>Only the owner can save changes.</p>}
          <fieldset disabled={!canSaveSettings || businessSaving} style={{border:0,padding:0,margin:0}}><div className="form-grid">
            {(activeTab === "profile" ? [['name','Business name'],['phone','Company phone'],['branchAddress','Branch address'],['branchPhone','Branch phone']] : [['gstin','GSTIN'],['pan','PAN'],['stateCode','Company state code (2 digits)']]).map(([key,label]) => <label key={key}>{label}<input value={business[key as keyof typeof business]} onChange={e => setBusiness({...business,[key]:e.target.value})}/></label>)}
          </div>
          {activeTab === "gst" && <p>Invoice item tax stays None until selected. Changing company state affects tax calculations on future invoice saves.</p>}
          <div className="save-line"><button className="primary" onClick={saveBusiness}>{businessSaving ? "Saving..." : "Save changes"}</button></div></fieldset>
          </>}
        </article>}

        {(activeTab === "numbering" || activeTab === "print") && <article className="card settings-form">
          <h2>{activeTab === "numbering" ? "Sales invoice numbering" : "Invoice print details"}</h2>
          {settingsError && <p role="alert">{settingsError}</p>}
          {!invoiceSettings ? <p>Loading invoice settings...</p> : <>
            <p>Settings for the current branch. Saved details are available to the invoice screen.</p>
            {!canSaveSettings && <p>Only the owner can save these settings.</p>}
            <fieldset disabled={!canSaveSettings || savingSettings} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="form-grid">
              {activeTab === "numbering" ? <>
                <label>Sales invoice prefix<input maxLength={30} value={invoiceSettings.invoicePrefix} onChange={e => updateInvoiceSettings({invoicePrefix:e.target.value})}/></label>
                <label>Payment terms (days)<input type="number" min={0} max={365} value={invoiceSettings.paymentTermsDays} onChange={e => updateInvoiceSettings({paymentTermsDays:Number(e.target.value)})}/></label>
                <p className="full">Financial year and sequence are added automatically. Next invoice: <strong>{nextInvoice}</strong>. Changes apply to future invoices.</p>
              </> : <>
                <label className="full">Terms and conditions<textarea maxLength={1000} value={invoiceSettings.terms} onChange={e => updateInvoiceSettings({terms:e.target.value})}/></label>
                {([['bankName','Bank name'],['accountName','Account holder'],['accountNumber','Account number'],['ifsc','IFSC'],['upiId','UPI ID'],['qrText','Payment QR text'],['signatureText','Signatory name'],['signatureUrl','Signature image URL']] as const).map(([key,label]) => <label key={key}>{label}<input value={invoiceSettings[key] || ""} onChange={e => updateInvoiceSettings({[key]:e.target.value})}/></label>)}
                <p className="full">Choose A4 or thermal printing from the invoice screen. Default layout preferences are not stored by the current API.</p>
              </>}
            </div>
            <div className="save-line"><button className="primary" type="button" onClick={saveConnectedSettings}>{savingSettings ? "Saving..." : "Save changes"}</button></div>
            </fieldset>
          </>}
        </article>}

        {/* Tab 5: Users & Roles */}
        {activeTab === "users" && (<article className="card settings-form"><h2>Users & roles</h2><p>View users, create staff logins and assign branch access.</p><button className="primary" onClick={onStaff}>Manage users & roles</button></article>)}
          {false && (
          <article className="card settings-form">
            <h2>Users & Staff Roles</h2>
            <p>Manage store staff accounts and access permissions.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 14, display: "block" }}>Saravana Kumar (Owner / Admin)</strong>
                  <small style={{ color: "#64748b" }}>sarvan.auto@gmail.com · Full Access</small>
                </div>
                <span className="pill green">Active Admin</span>
              </div>
              <div style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 14, display: "block" }}>Pavoorchatram Counter Staff</strong>
                  <small style={{ color: "#64748b" }}>Counter 1 Staff · Billing & Inventory Only</small>
                </div>
                <span className="pill neutral">Staff User</span>
              </div>
            </div>
            <div className="save-line">
              <button className="primary" onClick={() => notify("User management opened")}>
                + Add Staff User
              </button>
            </div>
          </article>
        )}

        {/* Tab 6: Branches */}
        {activeTab === "branches" && (
          <article className="card settings-form" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>Store Branches & Access Credentials</h2>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Manage multi-branch store locations, view linked staff usernames, edit store details and set branch login passwords.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(branches && branches.length > 0 ? branches : []).map(b => {
                const isActive = b.id === currentBranchId;
                const staffEmail = b.memberships?.find(m => m.user?.email && m.user.email.toLowerCase() !== "admin@happybonding.in")?.user?.email || b.memberships?.[0]?.user?.email || "No credentials set";
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: 16,
                      border: isActive ? "2px solid #8b5cf6" : "1px solid #e2e8f0",
                      borderRadius: 12,
                      background: isActive ? "#faf5ff" : "#ffffff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>📍</span>
                        <strong style={{ fontSize: 15, color: "#0f172a" }}>{b.name}</strong>
                        <code style={{ fontSize: 11, background: "#e2e8f0", padding: "2px 6px", borderRadius: 4, fontWeight: 700, color: "#334155" }}>{b.code}</code>
                        {isActive ? (
                          <span className="pill green" style={{ fontSize: 11 }}>Active Store Branch</span>
                        ) : (
                          <span className="pill neutral" style={{ fontSize: 11 }}>Configured Branch</span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
                        <span>📍 {b.address || "No address specified"}</span>
                        {b.phone && <span>📞 Phone: {b.phone}</span>}
                      </div>

                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        🔑 <strong>Branch Staff Username:</strong>
                        <code style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, fontSize: 11, color: "#4f46e5", fontWeight: 600 }}>{staffEmail}</code>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {!isActive && onSwitchBranch && (
                        <button
                          type="button"
                          className="secondary compact"
                          onClick={() => onSwitchBranch(b.id)}
                          style={{ background: "#e0e7ff", color: "#4338ca", border: "1px solid #c7d2fe", fontWeight: 600, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                        >
                          🔄 Switch Branch
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary compact"
                        onClick={() => setEditingBranch(b)}
                        style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", fontWeight: 600, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                      >
                        ✏️ Edit Details & Password
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="save-line" style={{ marginTop: 8 }}>
              <button className="primary" onClick={() => setBranchModalOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                + Add New Branch
              </button>
            </div>

            {editingBranch && (
              <EditBranchModal
                branch={editingBranch}
                onClose={() => setEditingBranch(null)}
                onSaved={async () => {
                  setEditingBranch(null);
                  if (onRefreshData) await onRefreshData();
                }}
                notify={notify}
              />
            )}

            {branchModalOpen && (
              <BranchManagementModal
                branches={branches || []}
                onClose={() => setBranchModalOpen(false)}
                onSaved={async () => {
                  setBranchModalOpen(false);
                  if (onRefreshData) await onRefreshData();
                  notify("✅ Branch created successfully!");
                }}
                notify={notify}
              />
            )}
          </article>
        )}

        {/* Tab 7: Backup & Audit */}
        {activeTab === "backup" && (
          <article className="card settings-form" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2>Database Backup & Safe Restore</h2>
            <p>Export database snapshots or perform double-confirmed safety restore.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Card 1: 1-Click Backup */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>💾 Database Backup</h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Download instant JSON snapshot of all database records (Parties, Stock, Invoices, Expenses, Staff).</p>
                <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, fontSize: 11, color: "#334155", border: "1px solid #e2e8f0" }}>
                  ⏰ <strong>Automated Daily Backup:</strong> Running daily at 11:59 PM to local <code>./backups</code> directory.
                </div>
                <button type="button" onClick={handleExportBackup} className="primary-purple-btn" style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 600, width: "max-content", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <Download size={15}/> Download Backup (JSON)
                </button>
              </div>

              {/* Card 2: Safe Database Restore */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>🔄 Safe Database Restore</h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Restore database from a previously downloaded JSON backup file.</p>
                <div style={{ background: "#fff7ed", padding: 10, borderRadius: 8, fontSize: 11, color: "#c2410c", border: "1px solid #ffedd5" }}>
                  🛡️ <strong>Safety Feature:</strong> Auto-creates pre-restore backup snapshot before restoring!
                </div>
                <label style={{ cursor: "pointer", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 14px", fontWeight: 600, width: "max-content", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Upload size={15}/> Select Backup JSON File...
                  <input type="file" accept=".json" onChange={handleFileSelect} style={{ display: "none" }} />
                </label>
              </div>

              {/* Card 3: Clear Test Data for Live */}
              <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12, gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", margin: 0 }}>🧹 Clear Test Data (Prepare for Live Launch)</h3>
                  <span className="pill warning" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>Live Launch Reset</span>
                </div>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  Wipe out test sales invoices, payments, expenses, stock balances (set to 0), and reset invoice numbering back to <code>HB/SL/00001</code>.
                </p>
                <div style={{ background: "#fef2f2", padding: 10, borderRadius: 8, fontSize: 11, color: "#991b1b", border: "1px solid #fecaca" }}>
                  ⚠️ <strong>Production Reset:</strong> Use this when you are ready to start real billing for your stores.
                </div>
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  style={{ background: "#dc2626", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontWeight: 600, width: "max-content", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <Trash2 size={15}/> Clear Test Data & Reset for Live
                </button>
              </div>
            </div>
          </article>
        )}
      </div>

      {/* Restore Safety Modal */}
      {restoreModalOpen && (
        <Modal title="⚠️ Confirm Database Restore" onClose={() => setRestoreModalOpen(false)}>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 14, borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
              <strong>WARNING:</strong> Restoring database will update current records with data from the backup file.
              An automatic pre-restore backup will be created in <code>./backups</code> before applying changes.
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              <input type="checkbox" checked={checkOverwrite} onChange={e => setCheckOverwrite(e.target.checked)} />
              I understand this will overwrite current data
            </label>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                Type "RESTORE" to double confirm:
              </label>
              <input type="text" value={confirmInput} onChange={e => setConfirmInput(e.target.value)} placeholder="RESTORE" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700 }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setRestoreModalOpen(false)}>Cancel</button>
              <button type="button" onClick={handleExecuteRestore} disabled={!checkOverwrite || confirmInput.trim() !== "RESTORE" || restoring} style={{ background: checkOverwrite && confirmInput.trim() === "RESTORE" ? "#dc2626" : "#cbd5e1", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: checkOverwrite && confirmInput.trim() === "RESTORE" ? "pointer" : "not-allowed" }}>
                {restoring ? "Restoring..." : "Execute Double-Confirmed Restore"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear Test Data Modal */}
      {resetModalOpen && (
        <Modal title="🧹 Clear Test Data & Prepare for Live" onClose={() => setResetModalOpen(false)}>
          <form onSubmit={handleResetSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 14, borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
              <strong>CRITICAL WARNING:</strong> This action will permanently delete:
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li>All test Sales Invoices & Payment Receipts</li>
                <li>All recorded Expenses & Credit Notes</li>
                <li>All Stock Movements (All stock quantities reset to 0)</li>
                <li>All Invoice Numbering sequences (Resets back to 1)</li>
              </ul>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <strong style={{ fontSize: 12, color: "#334155" }}>Optional Cleans:</strong>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: "#475569" }}>
                <input type="checkbox" checked={clearProductsCheck} onChange={e => setClearProductsCheck(e.target.checked)} />
                Also delete sample Items & Inventory products
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: "#475569" }}>
                <input type="checkbox" checked={clearPartiesCheck} onChange={e => setClearPartiesCheck(e.target.checked)} />
                Also delete sample Customers & Suppliers (Parties)
              </label>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  To confirm, type <code style={{ color: "#dc2626", fontWeight: 700 }}>RESET_LIVE</code> below:
                </label>
                <button
                  type="button"
                  onClick={() => setResetConfirmInput("RESET_LIVE")}
                  style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  ⚡ Click to Auto-Fill RESET_LIVE
                </button>
              </div>
              <input
                type="text"
                placeholder="Type RESET_LIVE"
                value={resetConfirmInput}
                onChange={e => setResetConfirmInput(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 600 }}
              />
            </div>

            <div className="modal-actions full">
              <button type="button" className="secondary" onClick={() => setResetModalOpen(false)} disabled={resetting}>Cancel</button>
              <button
                type="submit"
                className="primary"
                style={{ background: resetConfirmInput.trim().toUpperCase() === "RESET_LIVE" ? "#dc2626" : "#cbd5e1", color: "#fff", borderColor: resetConfirmInput.trim().toUpperCase() === "RESET_LIVE" ? "#dc2626" : "#cbd5e1", cursor: resetConfirmInput.trim().toUpperCase() === "RESET_LIVE" ? "pointer" : "not-allowed" }}
                disabled={resetConfirmInput.trim().toUpperCase() !== "RESET_LIVE" || resetting}
              >
                {resetting ? "Clearing..." : "Yes, Clear Database for Live Launch"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
