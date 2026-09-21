import React, { useEffect, useMemo, useState } from "react";
import { WalletCards, CreditCard, Banknote } from "lucide-react";
import { money } from "../../data";
import { api } from "../../api";
import type { Expense, InvoiceSetting } from "../../types";
import { PageHeading, Metric, Modal } from "../../App";

interface AccountRecord {
  id: string;
  name: string;
  type: "Bank" | "UPI" | "Cash";
  accountNo?: string;
  ifsc?: string;
  balance: number;
}

export function CashBank({ notify }: { notify: (s: string) => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dbSetting, setDbSetting] = useState<InvoiceSetting | null>(null);
  const [customAccounts, setCustomAccounts] = useState<AccountRecord[]>([]);
  const [addAccountModal, setAddAccountModal] = useState(false);
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<"Bank" | "UPI" | "Cash">("Bank");
  const [accNo, setAccNo] = useState("");
  const [accIfsc, setAccIfsc] = useState("");
  const [accBal, setAccBal] = useState("");

  useEffect(() => {
    api.getExpenses().then(data => setExpenses(data)).catch(() => {});
    api.invoiceSetting().then(setting => setDbSetting(setting)).catch(() => {});
  }, []);

  const totalExpenseAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const cashExpenses = expenses.filter(e => e.paymentMode === "Cash").reduce((s, e) => s + Number(e.amount), 0);
  const bankExpenses = expenses.filter(e => e.paymentMode === "Bank Account" || e.paymentMode === "UPI" || e.paymentMode === "Bank").reduce((s, e) => s + Number(e.amount), 0);

  const realAccounts: AccountRecord[] = useMemo(() => {
    const list: AccountRecord[] = [];
    if (dbSetting?.bankName || dbSetting?.accountNumber) {
      list.push({
        id: "db-bank",
        name: dbSetting.bankName || "Store Bank Account",
        type: "Bank",
        accountNo: dbSetting.accountNumber || undefined,
        ifsc: dbSetting.ifsc || undefined,
        balance: 0,
      });
    }
    if (dbSetting?.upiId) {
      list.push({
        id: "db-upi",
        name: "Store UPI Account",
        type: "UPI",
        accountNo: dbSetting.upiId,
        balance: 0,
      });
    }
    return [...list, ...customAccounts];
  }, [dbSetting, customAccounts]);

  const totalAccountsBalance = realAccounts.reduce((s, a) => s + a.balance, 0);

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return notify("Enter Account Name");
    const newAcc: AccountRecord = {
      id: String(Date.now()),
      name: accName.trim(),
      type: accType,
      accountNo: accNo.trim() || undefined,
      ifsc: accIfsc.trim() || undefined,
      balance: Number(accBal || 0),
    };
    setCustomAccounts(prev => [...prev, newAcc]);
    setAddAccountModal(false);
    setAccName("");
    setAccNo("");
    setAccIfsc("");
    setAccBal("");
    notify(`Account "${newAcc.name}" saved!`);
  };

  return (
    <>
      <PageHeading title="Cash & Bank Accounts" subtitle="Live account balances, accounts master and expense payment outflow tracking." action="+ Add Account" onAction={() => setAddAccountModal(true)} />
      <div className="metrics-grid three">
        <Metric label="Total Cash & Bank Balance" value={money(totalAccountsBalance)} icon={WalletCards} tone="green" />
        <Metric label="Cash Outflow (Expenses)" value={money(-cashExpenses)} icon={CreditCard} tone="red" />
        <Metric label="Bank/UPI Outflow (Expenses)" value={money(-bankExpenses)} icon={Banknote} tone="blue" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20, marginTop: 20 }}>
        {/* Left Accounts List */}
        <article className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Store Bank & Cash Accounts</h3>
            <button type="button" className="primary compact" onClick={() => setAddAccountModal(true)} style={{ background: "#4f46e5", border: 0 }}>
              + Add Account
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {realAccounts.map(acc => (
              <div key={acc.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <div>
                  <strong style={{ fontSize: 13, display: "block", color: "#0f172a" }}>{acc.name}</strong>
                  <small style={{ color: "#64748b" }}>{acc.type} {acc.accountNo ? `· ${acc.accountNo}` : ""}</small>
                </div>
                <strong style={{ fontSize: 14, color: "#15803d" }}>{money(acc.balance)}</strong>
              </div>
            ))}
            {!realAccounts.length && (
              <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                No bank accounts configured in database. Click <strong>+ Add Account</strong> to create one.
              </div>
            )}
          </div>
        </article>

        {/* Right Expense Transactions Table */}
        <article className="card table-card">
          <div className="card-title">
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Expense Payment Outflows</h3>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Automated ledger linked directly to store expenses</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>EXPENSE CATEGORY</th>
                  <th>MODE</th>
                  <th className="right">AMOUNT DEDUCTED (₹)</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{exp.expenseDate}</td>
                    <td><strong>{exp.category}</strong> {exp.notes ? `(${exp.notes})` : ""}</td>
                    <td><span className="pill neutral">{exp.paymentMode}</span></td>
                    <td className="right"><strong style={{ color: "#e11d48" }}>- {money(Number(exp.amount))}</strong></td>
                  </tr>
                ))}
                {!expenses.length && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "#64748b", padding: 24 }}>
                      No expense payment outflow recorded yet in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {addAccountModal && (
        <Modal title="+ Add Cash / Bank Account" onClose={() => setAddAccountModal(false)}>
          <form onSubmit={handleAddAccount} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
              Account Name / Title *
              <input required value={accName} onChange={e => setAccName(e.target.value)} placeholder="e.g. Store Current Account, GPay Store, Main Cash Drawer" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
              Account Type
              <select value={accType} onChange={e => setAccType(e.target.value as any)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                <option value="Bank">Bank Account</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Cash">Cash Drawer</option>
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                Account Number / UPI ID
                <input value={accNo} onChange={e => setAccNo(e.target.value)} placeholder="e.g. 502000... or 7708030903@upi" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                IFSC Code (Bank only)
                <input value={accIfsc} onChange={e => setAccIfsc(e.target.value)} placeholder="e.g. HDFC0001234" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
              </label>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
              Opening Balance (₹)
              <input type="number" value={accBal} onChange={e => setAccBal(e.target.value)} placeholder="₹ 0.00" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setAddAccountModal(false)}>Cancel</button>
              <button type="submit" className="primary" style={{ background: "#4f46e5", border: 0, padding: "8px 20px" }}>Save Account</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
