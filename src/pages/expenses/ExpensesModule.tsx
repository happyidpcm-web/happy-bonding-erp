import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../../api";
import type { Expense } from "../../types";
import { Modal } from "../../App";

export function ExpensesModule({ notify, currentBranchId }: { notify: (msg: string) => void; currentBranchId?: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [category, setCategory] = useState("Shop Rent");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paidTo, setPaidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await api.getExpenses();
      setExpenses(res || []);
    } catch {
      const local = localStorage.getItem("hb_expenses");
      if (local) setExpenses(JSON.parse(local));
    }
  };

  useEffect(() => { fetchExpenses(); }, [currentBranchId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return notify("Please enter a valid expense amount.");
    setSaving(true);
    try {
      await api.createExpense({
        category,
        amount: amt,
        paymentMode,
        paidTo,
        notes,
        expenseDate: new Date(expenseDate).toISOString(),
      });
      notify("Expense recorded successfully!");
      setModalOpen(false);
      setAmount("");
      setNotes("");
      setPaidTo("");
      fetchExpenses();
    } catch (err: any) {
      notify(err.message || "Failed to record expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense entry?")) return;
    try {
      await api.deleteExpense(id);
      notify("Expense deleted");
      fetchExpenses();
    } catch {
      notify("Failed to delete expense");
    }
  };

  const categories = ["Shop Rent", "Electricity", "Tea/Refreshments", "Staff Advance", "Freight", "Shop Maintenance", "Printing & Stationery", "Other"];
  const filtered = expenses.filter(x => categoryFilter === "All" || x.category === categoryFilter);

  const totalSpent = filtered.reduce((acc, x) => acc + Number(x.amount || 0), 0);
  const rentSpent = expenses.filter(x => x.category === "Shop Rent").reduce((acc, x) => acc + Number(x.amount || 0), 0);
  const elecSpent = expenses.filter(x => x.category === "Electricity").reduce((acc, x) => acc + Number(x.amount || 0), 0);
  const teaSpent = expenses.filter(x => x.category === "Tea/Refreshments").reduce((acc, x) => acc + Number(x.amount || 0), 0);
  const advanceSpent = expenses.filter(x => x.category === "Staff Advance").reduce((acc, x) => acc + Number(x.amount || 0), 0);
  const freightSpent = expenses.filter(x => x.category === "Freight").reduce((acc, x) => acc + Number(x.amount || 0), 0);

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>Store Expenses</h1>
          <small style={{ color: "#64748b" }}>Track daily shop expenditures (Rent, Electricity, Tea, Staff Advance, Freight)</small>
        </div>
        <button className="primary-purple-btn" style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", font: "600 13px Manrope", cursor: "pointer" }} onClick={() => setModalOpen(true)}>
          + Add Store Expense
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <small style={{ color: "#64748b", fontWeight: 600 }}>Total Expenses</small>
          <h2 style={{ fontSize: 20, color: "#4f46e5", margin: "4px 0 0" }}>₹{totalSpent.toLocaleString("en-IN")}</h2>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <small style={{ color: "#64748b", fontWeight: 600 }}>Shop Rent</small>
          <h3 style={{ fontSize: 18, color: "#0f172a", margin: "4px 0 0" }}>₹{rentSpent.toLocaleString("en-IN")}</h3>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <small style={{ color: "#64748b", fontWeight: 600 }}>Electricity</small>
          <h3 style={{ fontSize: 18, color: "#0f172a", margin: "4px 0 0" }}>₹{elecSpent.toLocaleString("en-IN")}</h3>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <small style={{ color: "#64748b", fontWeight: 600 }}>Tea / Refreshments</small>
          <h3 style={{ fontSize: 18, color: "#0f172a", margin: "4px 0 0" }}>₹{teaSpent.toLocaleString("en-IN")}</h3>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <small style={{ color: "#64748b", fontWeight: 600 }}>Staff Advance</small>
          <h3 style={{ fontSize: 18, color: "#0f172a", margin: "4px 0 0" }}>₹{advanceSpent.toLocaleString("en-IN")}</h3>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <small style={{ color: "#64748b", fontWeight: 600 }}>Freight & Transport</small>
          <h3 style={{ fontSize: 18, color: "#0f172a", margin: "4px 0 0" }}>₹{freightSpent.toLocaleString("en-IN")}</h3>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Category Filter:</span>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}>
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Date</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Category</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Paid To</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Payment Mode</th>
              <th style={{ padding: "12px 16px", textAlign: "left" }}>Notes</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount (₹)</th>
              <th style={{ padding: "12px 16px", width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>No expense entries found.</td></tr>
            ) : (
              filtered.map(x => (
                <tr key={x.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>{new Date(x.expenseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ padding: "14px 16px" }}><span style={{ background: "#eef2ff", color: "#4f46e5", padding: "3px 8px", borderRadius: 6, fontWeight: 600, fontSize: 12 }}>{x.category}</span></td>
                  <td style={{ padding: "14px 16px" }}>{x.paidTo || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>{x.paymentMode}</td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>{x.notes || "-"}</td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>₹{Number(x.amount).toLocaleString("en-IN")}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button type="button" onClick={() => handleDelete(x.id)} style={{ border: 0, background: "transparent", color: "#ef4444", cursor: "pointer" }} title="Delete"><Trash2 size={15}/></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title="Record Store Expense" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>Expense Category
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Amount (₹)
                <input type="number" required min={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>Payment Mode
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                  <option value="Cash">Cash</option>
                  <option value="Bank Account">Bank Account</option>
                  <option value="UPI">UPI</option>
                </select>
              </label>
              <label>Expense Date
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
              </label>
            </div>

            <label>Paid To (Recipient / Vendor Name)
              <input type="text" value={paidTo} onChange={e => setPaidTo(e.target.value)} placeholder="e.g. Building Landlord, Electricity Board, Staff Name" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
            </label>

            <label>Notes / Particulars
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional expense notes" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="primary-purple-btn" style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px" }} disabled={saving}>
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
