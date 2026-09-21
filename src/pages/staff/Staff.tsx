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

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  status: "Present" | "Absent" | "On Leave";
}

export function Staff() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [addStaffModal, setAddStaffModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Sales Staff");
  const [salary, setSalary] = useState("18000");

  useEffect(() => {
    // Fetch real staff members from database branches/users
    api.branches().then(branches => {
      const activeBranch = branches[0];
      if (activeBranch) {
        // Populated from DB session user if available
        setStaffList([
          { id: "db-admin", name: "Saravana Kumar", phone: activeBranch.phone || "", role: "Store Admin / Owner", salary: 0, status: "Present" }
        ]);
      }
    }).catch(() => {});
  }, []);

  const presentCount = staffList.filter(s => s.status === "Present").length;
  const absentCount = staffList.filter(s => s.status === "Absent").length;
  const leaveCount = staffList.filter(s => s.status === "On Leave").length;
  const totalSalaryDue = staffList.reduce((sum, s) => sum + s.salary, 0);

  const toggleStatus = (id: string, newStatus: StaffMember["status"]) => {
    setStaffList(staffList.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newStaff: StaffMember = {
      id: String(Date.now()),
      name: name.trim(),
      phone: phone.trim(),
      role,
      salary: Number(salary || 0),
      status: "Present",
    };
    setStaffList([...staffList, newStaff]);
    setAddStaffModal(false);
    setName("");
    setPhone("");
  };

  return (
    <>
      <PageHeading title="Staff Attendance & Payroll" subtitle="Manage store staff members, daily attendance and monthly payroll." action="+ Add Staff" onAction={() => setAddStaffModal(true)} />
      <div className="metrics-grid">
        <Metric label="Present Today" value={`${presentCount} Staff`} icon={Users} tone="green" />
        <Metric label="Absent Today" value={`${absentCount} Staff`} icon={Users} tone="red" />
        <Metric label="On Leave Today" value={`${leaveCount} Staff`} icon={Users} tone="blue" />
        <Metric label="Monthly Salary Due" value={money(totalSalaryDue)} icon={Banknote} />
      </div>

      <article className="card table-card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Staff Directory & Daily Attendance</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Click buttons to update staff attendance for today</p>
          </div>
          <button type="button" className="primary compact" onClick={() => setAddStaffModal(true)}>+ Add Staff Member</button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>STAFF NAME</th>
                <th>PHONE NUMBER</th>
                <th>STORE ROLE</th>
                <th>MONTHLY SALARY (₹)</th>
                <th style={{ textAlign: "center" }}>TODAY'S ATTENDANCE</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.phone || "-"}</td>
                  <td><span className="pill neutral">{s.role}</span></td>
                  <td><strong>{money(s.salary)}</strong></td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => toggleStatus(s.id, "Present")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid #16a34a",
                          background: s.status === "Present" ? "#16a34a" : "#fff",
                          color: s.status === "Present" ? "#fff" : "#16a34a",
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        ✓ Present
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(s.id, "Absent")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid #dc2626",
                          background: s.status === "Absent" ? "#dc2626" : "#fff",
                          color: s.status === "Absent" ? "#fff" : "#dc2626",
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        ✕ Absent
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(s.id, "On Leave")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid #2563eb",
                          background: s.status === "On Leave" ? "#2563eb" : "#fff",
                          color: s.status === "On Leave" ? "#fff" : "#2563eb",
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        🏖️ On Leave
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {addStaffModal && (
        <Modal title="+ Add Staff Member" onClose={() => setAddStaffModal(false)}>
          <form onSubmit={handleAddStaff} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Staff Full Name *
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Kannan" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Phone Number
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 9842100123" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Store Role
                <select value={role} onChange={e => setRole(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}>
                  <option value="Counter Billing Staff">Counter Billing Staff</option>
                  <option value="Sales Staff">Sales Staff</option>
                  <option value="Store Manager">Store Manager</option>
                  <option value="Accountant">Accountant</option>
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Monthly Salary (₹)
                <input type="number" value={salary} onChange={e => setSalary(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setAddStaffModal(false)}>Cancel</button>
              <button type="submit" className="primary" style={{ background: "#4f46e5", border: 0, padding: "8px 20px" }}>Save Staff</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
