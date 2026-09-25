import React, { useEffect, useState } from "react";
import { Users, Banknote } from "lucide-react";
import { money } from "../../data";
import { api } from "../../api";
import type { Branch, StaffUser } from "../../types";
import { PageHeading, Metric, Modal } from "../../App";

export function StaffManagementModal({ branches, onClose, notify }: { branches: Branch[]; onClose: () => void; notify: (msg: string) => void }) {
  const [staffRows, setStaffRows] = useState<StaffUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState("");

  useEffect(() => { api.staff().then(setStaffRows).catch(() => setStaffRows([])); }, []);

  const handleResetPassword = async (staffId: string) => {
    if (!newStaffPassword || newStaffPassword.length < 6) {
      notify("Password must be at least 6 characters");
      return;
    }
    try {
      setSaving(true);
      await api.updateStaffPassword(staffId, newStaffPassword);
      notify("✅ Staff password updated successfully!");
      setEditingStaffId(null);
      setNewStaffPassword("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to update staff password");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const branchIds = form.getAll("branchIds").map(String);
    try {
      setSaving(true);
      const row = await api.createStaff({
        name: String(form.get("name") || ""),
        email: String(form.get("email") || ""),
        phone: String(form.get("phone") || ""),
        password: String(form.get("password") || ""),
        branchIds,
      });
      setStaffRows(prev => [row, ...prev]);
      notify("Staff login created with custom password");
      event.currentTarget.reset();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Staff save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Staff Login & Password Control" onClose={onClose} wide>
      <div className="table-scroll" style={{ maxHeight: 220, marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branches</th>
              <th style={{ textAlign: "right" }}>Password Action</th>
            </tr>
          </thead>
          <tbody>
            {staffRows.map(user => (
              <tr key={user.id}>
                <td><strong>{user.name}</strong></td>
                <td>{user.email}</td>
                <td><span className="pill neutral">{user.role}</span></td>
                <td>{user.branches.map(b => b.name).join(", ")}</td>
                <td style={{ textAlign: "right" }}>
                  {editingStaffId === user.id ? (
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="password"
                        placeholder="New Password"
                        value={newStaffPassword}
                        onChange={e => setNewStaffPassword(e.target.value)}
                        style={{ width: 120, padding: "4px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1" }}
                      />
                      <button className="primary compact" type="button" onClick={() => handleResetPassword(user.id)} disabled={saving}>Save</button>
                      <button className="secondary compact" type="button" onClick={() => setEditingStaffId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="secondary compact" type="button" onClick={() => { setEditingStaffId(user.id); setNewStaffPassword(""); }}>
                      🔑 Reset Password
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>Name<input name="name" required placeholder="Staff name" /></label>
        <label>Email<input name="email" type="email" required placeholder="staff@happybonding.in" /></label>
        <label>Phone<input name="phone" placeholder="Phone number" /></label>
        <label>Initial Password<input name="password" type="password" minLength={6} required placeholder="Set password (min 6 chars)" /></label>
        <div className="full" style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Branch Access</span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {branches.map(branch => (
              <label key={branch.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="branchIds" value={branch.id} defaultChecked={branches.length === 1} /> {branch.name}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions full">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Close</button>
          <button className="primary" disabled={saving}>{saving ? "Saving..." : "Create Staff Account"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function Staff() {
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.staff().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <><PageHeading title="Staff" subtitle="Staff accounts saved in the database" />
    <p>Attendance and payroll are not available yet. No attendance or salary records are shown.</p>
    {loading ? <p>Loading staff...</p> : error ? <p role="alert">{error}</p> : <table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.role}</td></tr>)}</tbody></table>}
  </>;
}
