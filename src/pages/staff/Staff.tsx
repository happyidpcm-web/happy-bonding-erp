import { attendanceRangeDates } from "./attendance-range";
import { attendanceLeaveDays } from "./attendance-summary";
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Users, Banknote } from "lucide-react";
import { money } from "../../data";
import { api } from "../../api";
import type { AttendanceStaff, Branch, StaffAttendance, StaffAttendanceStatus, StaffUser } from "../../types";
import { PageHeading, Metric, Modal } from "../../App";
import "./staff-attendance.css";

export function StaffManagementModal({ branches, onClose, notify, mode = "manage", onCreated }: { branches: Branch[]; onClose: () => void; notify: (msg: string) => void; mode?: "manage" | "create"; onCreated?: () => void }) {
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
      onCreated?.();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Staff save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === "create" ? "Add Staff Member" : "Staff Login & Password Control"} onClose={onClose} wide={mode === "manage"}>
      {mode === "create" && <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 13, lineHeight: 1.55 }}>Create the staff login first. Once saved, the member will appear in Staff Attendance & Payroll.</p>}
      {mode === "manage" && <div className="table-scroll" style={{ maxHeight: 220, marginBottom: 16 }}>
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
      </div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>Name<input name="name" required placeholder="Staff name" /></label>
        <label>Email<input name="email" type="email" required placeholder="staff@happybonding.in" /></label>
        <label>Phone<input name="phone" placeholder="Phone number" /></label>
        <label>Initial Password<input name="password" type="password" minLength={8} required placeholder="Set password (minimum 8 characters)" /></label>
        <div className="full" style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Branch Access <span style={{ fontWeight: 400 }}>(select at least one)</span></span>
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

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  status: "Present" | "Absent" | "On Leave";
}

function StaffLegacy() {
  const [attendanceFilter, setAttendanceFilter] = useState<StaffMember["status"] | "All">("All");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [addStaffModal, setAddStaffModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Sales Staff");
  const [salary, setSalary] = useState("18000");

  useEffect(() => {
    // Fetch real staff members from database API
    api.staff().then(users => {
      if (users && users.length > 0) {
        setStaffList(users.map(u => ({
          id: u.id,
          name: u.name,
          phone: u.phone || "",
          role: u.role || "Staff Member",
          salary: 0,
          status: "Present",
        })));
      } else {
        setStaffList([]);
      }
    }).catch(() => {
      setStaffList([]);
    });
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
        <Metric onClick={() => setAttendanceFilter("Present")} selected={attendanceFilter === "Present"} label="Present Today" value={`${presentCount} Staff`} icon={Users} tone="green" />
        <Metric onClick={() => setAttendanceFilter("Absent")} selected={attendanceFilter === "Absent"} label="Absent Today" value={`${absentCount} Staff`} icon={Users} tone="red" />
        <Metric onClick={() => setAttendanceFilter("On Leave")} selected={attendanceFilter === "On Leave"} label="On Leave Today" value={`${leaveCount} Staff`} icon={Users} tone="blue" />
        <Metric onClick={() => setAttendanceFilter("All")} selected={attendanceFilter === "All"} label="Monthly Salary Due" value={money(totalSalaryDue)} icon={Banknote} />
      </div>

      <article className="card table-card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Staff Directory & Daily Attendance</h2>
            <p role="status" style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Showing: {attendanceFilter === "All" ? "All staff" : attendanceFilter}</p>
            <button type="button" className="text-button" onClick={() => setAttendanceFilter("All")}>Show All Staff</button>
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
              {!staffList.some(s => attendanceFilter === "All" || s.status === attendanceFilter) && <tr><td colSpan={5}>No staff match this filter.</td></tr>}
              {staffList.filter(s => attendanceFilter === "All" || s.status === attendanceFilter).map(s => (
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

const attendanceLabels: Record<StaffAttendanceStatus, string> = { PRESENT: "Present", ABSENT: "Absent", LEAVE: "On leave", HALF_DAY: "Half day" };
const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const currentMonth = () => localDate().slice(0, 7);
const weekForDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
};
const currentWeek = () => weekForDate(localDate());
const monthDates = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const total = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: total }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
};
const weekDates = (weekValue: string) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  if (!match) return [];
  const year = Number(match[1]); const week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const monday = new Date(januaryFourth);
  monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday); date.setDate(monday.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
};

function weekRangeLabel(week: string) {
  const dates = weekDates(week);
  if (!dates.length) return "Select a date";
  const format = (value: string) => new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return format(dates[0]) + " - " + format(dates[6]);
}

function statusStyle(status: StaffAttendanceStatus) {
  return status === "PRESENT" ? { borderColor: "#16a34a", color: "#15803d", background: "#f0fdf4" } : status === "ABSENT" ? { borderColor: "#dc2626", color: "#b91c1c", background: "#fef2f2" } : { borderColor: "#2563eb", color: "#1d4ed8", background: "#eff6ff" };
}

export function Staff({ notify }: { branches: Branch[]; notify: (message: string) => void }) {
  const [staffList, setStaffList] = useState<AttendanceStaff[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [periodMode, setPeriodMode] = useState<"MONTH" | "WEEK" | "CUSTOM">("MONTH");
  const [week, setWeek] = useState(currentWeek);
  const [rangeStart, setRangeStart] = useState(() => `${currentMonth()}-01`);
  const [rangeEnd, setRangeEnd] = useState(localDate);
  const loadVersion = useRef(0);
  const [selectedStaff, setSelectedStaff] = useState<AttendanceStaff | null>(null);
  const [attendanceModal, setAttendanceModal] = useState<{ staff: AttendanceStaff; date: string; status: StaffAttendanceStatus } | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<StaffAttendanceStatus | "ALL">("ALL");

  async function load() {
    const version = ++loadVersion.current;
    setLoading(true); setError("");
    try {
      const months = [...new Set([month, localDate().slice(0, 7), ...activeDates.map(date => date.slice(0, 7))])];
      const [staff, batches] = await Promise.all([api.attendanceStaff(), Promise.all(months.map(value => api.attendanceEntries(value)))]);
      const rows = batches.flat();
      if (version === loadVersion.current) { setStaffList(staff); setAttendance(rows); }
    } catch (err) { if (version === loadVersion.current) setError(err instanceof Error ? err.message : "Unable to load staff attendance."); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }
  useEffect(() => { void load(); }, [month, periodMode, week, rangeStart, rangeEnd]);

  const today = localDate();
  const todayStatus = (staffId: string) => attendance.find(row => row.staffId === staffId && row.attendanceDate === today)?.status;
  const presentCount = staffList.filter(staff => todayStatus(staff.id) === "PRESENT").length;
  const absentCount = staffList.filter(staff => todayStatus(staff.id) === "ABSENT").length;
  const leaveCount = staffList.filter(staff => todayStatus(staff.id) === "LEAVE").length;
  const visibleStaff = staffList.filter(staff => attendanceFilter === "ALL" || todayStatus(staff.id) === attendanceFilter);
  const selectedRows = selectedStaff ? attendance.filter(row => row.staffId === selectedStaff.id) : [];
  const activeDates = periodMode === "CUSTOM" ? attendanceRangeDates(rangeStart, rangeEnd) : periodMode === "WEEK" ? weekDates(week) : monthDates(month);
  const selectedPeriodRows = selectedRows.filter(row => activeDates.includes(row.attendanceDate));
  const halfDays = selectedPeriodRows.filter(row => row.status === "HALF_DAY").length;
  const presentDays = selectedPeriodRows.filter(row => row.status === "PRESENT").length;
  const periodLabel = periodMode === "CUSTOM" ? `${rangeStart} - ${rangeEnd}` : periodMode === "WEEK" ? weekRangeLabel(week) : new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  function changeWeek(value: string) {
    setWeek(value);
    const firstDate = weekDates(value)[0];
    if (firstDate) setMonth(firstDate.slice(0, 7));
  }

  function recordFor(staffId: string, date: string) { return attendance.find(row => row.staffId === staffId && row.attendanceDate === date); }
  function openAttendance(staff: AttendanceStaff, status: StaffAttendanceStatus, date = today) {
    const record = recordFor(staff.id, date);
    setError("");
    setAttendanceModal({ staff, date, status }); setCheckIn(record?.checkIn || ""); setCheckOut(record?.checkOut || ""); setNotes(record?.notes || "");
  }
  async function saveAttendance(event: React.FormEvent) {
    event.preventDefault(); if (!attendanceModal) return;
    if ((attendanceModal.status === "PRESENT" || attendanceModal.status === "HALF_DAY")) {
      if (!checkIn) {
        setError("Select check-in time. You can add check-out time later.");
        return;
      }
      if (checkOut && checkOut < checkIn) {
        setError("Check-out time must be after check-in time. Check the AM/PM selection.");
        return;
      }
    }
    setSaving(true); setError("");
    try {
      const row = await api.saveAttendanceEntry(attendanceModal.staff.id, attendanceModal.date, { status: attendanceModal.status, checkIn: (attendanceModal.status === "PRESENT" || attendanceModal.status === "HALF_DAY") ? checkIn : null, checkOut: (attendanceModal.status === "PRESENT" || attendanceModal.status === "HALF_DAY") ? checkOut || null : null, notes });
      setAttendance(rows => [row, ...rows.filter(item => item.id !== row.id)]);
      setAttendanceModal(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save attendance."); }
    finally { setSaving(false); }
  }

  if (selectedStaff) return <>
    <PageHeading title={`${selectedStaff.name} — Attendance`} subtitle="Date-wise attendance and work timing records. Select any date to add or update the entry." />
    <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
      <button className="secondary" type="button" onClick={() => setSelectedStaff(null)}><ArrowLeft size={16} /> Back to staff</button>
      <AttendancePeriodControl rangeStart={rangeStart} rangeEnd={rangeEnd} onRangeStart={setRangeStart} onRangeEnd={setRangeEnd} mode={periodMode} month={month} week={week} onModeChange={setPeriodMode} onMonthChange={setMonth} onWeekChange={changeWeek} />
    </div>
    <div className="metrics-grid"><Metric label="Present days" value={String(presentDays)} icon={Users} tone="green" /><Metric label="Half days" value={String(halfDays)} icon={Users} tone="blue" /><Metric label="Absent days" value={String(selectedPeriodRows.filter(row => row.status === "ABSENT").length)} icon={Users} tone="red" /><Metric label="Leave days" value={String(attendanceLeaveDays(selectedPeriodRows))} icon={Users} tone="blue" /><Metric label={periodMode === "CUSTOM" ? "Selected dates" : periodMode === "WEEK" ? "Selected week" : "Selected month"} value={periodLabel} icon={CalendarDays} /></div>
    {error && <p className="error" role="alert">{error}</p>}
    <article className="card table-card" style={{ marginTop: 20 }}><div className="card-title"><div><h2>{periodMode === "CUSTOM" ? "Custom attendance register" : periodMode === "WEEK" ? "Weekly attendance register" : "Monthly attendance register"}</h2><p>Check-in only = Partial (checkout pending). Every 4 half-days count as 1 leave day.</p></div><span className="staff-period-caption">{periodLabel}</span></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Status</th><th>Check in</th><th>Check out</th><th>Working time</th><th style={{ textAlign: "right" }}>Action</th></tr></thead><tbody>{activeDates.map(date => {
      const row = recordFor(selectedStaff.id, date); const status = row?.status;
      return <tr key={date}><td><strong>{new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</strong></td><td>{status ? <span className="pill" style={statusStyle(status)}>{attendanceLabels[status]}{(status === "PRESENT" || status === "HALF_DAY") && !row?.checkOut ? " - Partial (checkout pending)" : ""}</span> : <span style={{ color: "#64748b" }}>Not marked</span>}</td><td>{row?.checkIn || "—"}</td><td>{row?.checkOut || "—"}</td><td>{row?.checkIn && row?.checkOut ? `${row.checkIn} – ${row.checkOut}` : "—"}</td><td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button className="primary compact" type="button" onClick={() => openAttendance(selectedStaff, "PRESENT", date)}>Present</button><button className="secondary compact" type="button" onClick={() => openAttendance(selectedStaff, "HALF_DAY", date)}>Half day</button><button className="secondary compact" type="button" onClick={() => openAttendance(selectedStaff, "ABSENT", date)} style={{ marginLeft: 6 }}>Absent</button><button className="secondary compact" type="button" onClick={() => openAttendance(selectedStaff, "LEAVE", date)} style={{ marginLeft: 6 }}>Leave</button></td></tr>;
    })}</tbody></table></div></article>
    {attendanceModal && <AttendanceModal onStatus={status => setAttendanceModal({ ...attendanceModal, status })} error={error} value={attendanceModal} checkIn={checkIn} checkOut={checkOut} notes={notes} saving={saving} onCheckIn={setCheckIn} onCheckOut={setCheckOut} onNotes={setNotes} onClose={() => setAttendanceModal(null)} onSave={saveAttendance} />}
  </>;

  return <>
    <PageHeading title="Staff Attendance" subtitle="Attendance-only staff profiles. Click a name to maintain date-wise attendance and monthly work timing." action="+ Add Staff" onAction={() => setAddStaffOpen(true)} />
    <div className="metrics-grid staff-summary-grid"><Metric onClick={() => setAttendanceFilter("PRESENT")} selected={attendanceFilter === "PRESENT"} label="Present Today" value={`${presentCount} Staff`} icon={Users} tone="green" /><Metric onClick={() => setAttendanceFilter("ABSENT")} selected={attendanceFilter === "ABSENT"} label="Absent Today" value={`${absentCount} Staff`} icon={Users} tone="red" /><Metric onClick={() => setAttendanceFilter("LEAVE")} selected={attendanceFilter === "LEAVE"} label="On Leave Today" value={`${leaveCount} Staff`} icon={Users} tone="blue" /><Metric onClick={() => setAttendanceFilter("ALL")} selected={attendanceFilter === "ALL"} label="Staffs" value={`${staffList.length} Staff`} icon={Users} /><Metric label={periodMode === "CUSTOM" ? "Selected dates" : periodMode === "WEEK" ? "Selected week" : "Selected month"} value={periodLabel} icon={Clock3} /></div>
    <article className="card table-card" style={{ marginTop: 20 }}><div className="card-title staff-directory-head"><div><h2>{attendanceFilter === "ALL" ? "Staff directory" : `${attendanceLabels[attendanceFilter]} staff today`}</h2><p>{attendanceFilter === "ALL" ? "Click any staff name to see attendance for the selected dates." : `${visibleStaff.length} staff marked ${attendanceLabels[attendanceFilter].toLowerCase()} today. Click Staffs to show all staff.`}</p></div><AttendancePeriodControl rangeStart={rangeStart} rangeEnd={rangeEnd} onRangeStart={setRangeStart} onRangeEnd={setRangeEnd} mode={periodMode} month={month} week={week} onModeChange={setPeriodMode} onMonthChange={setMonth} onWeekChange={changeWeek} /></div>
      {error && !attendanceModal && <p className="error" role="alert">{error}</p>}<div className="table-scroll"><table><thead><tr><th>Staff name</th><th>Phone number</th><th>Store role</th><th>Today's attendance</th><th style={{ textAlign: "right" }}>Quick action</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Loading staff…</td></tr> : staffList.length === 0 ? <tr><td colSpan={5}>No attendance staff yet. Use Add Staff to create a profile.</td></tr> : visibleStaff.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No staff marked {attendanceFilter === "ALL" ? "for this view" : attendanceLabels[attendanceFilter].toLowerCase()} today.</td></tr> : visibleStaff.map(staff => { const row = recordFor(staff.id, today); const status = row?.status; return <tr key={staff.id}><td><button type="button" className="text-button" style={{ fontWeight: 700 }} onClick={() => setSelectedStaff(staff)}>{staff.name}</button></td><td>{staff.phone || "—"}</td><td><span className="pill neutral">{staff.role}</span></td><td>{status ? <span className="pill" style={statusStyle(status)}>{attendanceLabels[status]}{(status === "PRESENT" || status === "HALF_DAY") && !row?.checkOut ? " - Partial (checkout pending)" : ""}</span> : <span style={{ color: "#64748b" }}>Not marked</span>}</td><td style={{ textAlign: "right" }}><div className="staff-quick-actions">{status ? <button type="button" className="staff-edit-button" onClick={() => openAttendance(staff, status)}>{row?.checkIn && !row.checkOut ? "Add check-out" : "Edit attendance"}</button> : <><button type="button" className="staff-present-button" onClick={() => openAttendance(staff, "PRESENT")}>Present</button><button type="button" className="staff-leave-button" onClick={() => openAttendance(staff, "HALF_DAY")}>Half day</button><button type="button" className="staff-absent-button" onClick={() => openAttendance(staff, "ABSENT")}>Absent</button><button type="button" className="staff-leave-button" onClick={() => openAttendance(staff, "LEAVE")}>Leave</button></>}</div></td></tr>; })}</tbody></table></div></article>
    {attendanceModal && <AttendanceModal onStatus={status => setAttendanceModal({ ...attendanceModal, status })} error={error} value={attendanceModal} checkIn={checkIn} checkOut={checkOut} notes={notes} saving={saving} onCheckIn={setCheckIn} onCheckOut={setCheckOut} onNotes={setNotes} onClose={() => setAttendanceModal(null)} onSave={saveAttendance} />}
    {addStaffOpen && <AttendanceStaffModal notify={notify} onCreated={() => { setAddStaffOpen(false); void load(); }} onClose={() => setAddStaffOpen(false)} />}
  </>;
}

function AttendancePeriodControl({ mode, month, week, rangeStart, rangeEnd, onRangeStart, onRangeEnd, onModeChange, onMonthChange, onWeekChange }: { mode: "MONTH" | "WEEK" | "CUSTOM"; month: string; week: string; rangeStart: string; rangeEnd: string; onRangeStart: (value: string) => void; onRangeEnd: (value: string) => void; onModeChange: (mode: "MONTH" | "WEEK" | "CUSTOM") => void; onMonthChange: (month: string) => void; onWeekChange: (week: string) => void }) {
  const dates = weekDates(week);
  return <div className="attendance-period-control attendance-range-control" aria-label="Attendance period filter">
    <div className="attendance-period-tabs">{(["MONTH", "WEEK", "CUSTOM"] as const).map(option => <button key={option} type="button" className={mode === option ? "active" : ""} onClick={() => onModeChange(option)}>{option === "MONTH" ? "Monthly" : option === "WEEK" ? "Weekly" : "Custom"}</button>)}</div>
    {mode === "MONTH" ? <label><CalendarDays size={15} /><input aria-label="Select month" type="month" value={month} onChange={event => { if (event.target.value) onMonthChange(event.target.value); }} /></label> : <div className="staff-range-fields">
      <label>Start date<input aria-label="Start date" type="date" value={mode === "WEEK" ? dates[0] : rangeStart} onChange={event => { if (event.target.value) mode === "WEEK" ? onWeekChange(weekForDate(event.target.value)) : onRangeStart(event.target.value); }} /></label>
      <label>End date<input aria-label="End date" type="date" readOnly={mode === "WEEK"} min={mode === "CUSTOM" ? rangeStart : undefined} value={mode === "WEEK" ? dates[6] : rangeEnd} onChange={event => { if (event.target.value) onRangeEnd(event.target.value); }} /></label>
    </div>}
    {mode === "WEEK" && <div className="staff-week-range"><strong>{weekRangeLabel(week)}</strong><span>Monday to Sunday. End date is set automatically.</span></div>}
    {mode === "CUSTOM" && <div className="staff-week-range" role={rangeEnd < rangeStart ? "alert" : undefined}>{rangeEnd < rangeStart ? "End date must be on or after start date." : "Includes both start and end dates. Select a staff name to view attendance."}</div>}
  </div>;
}

function AttendanceModal({ onStatus, error, value, checkIn, checkOut, notes, saving, onCheckIn, onCheckOut, onNotes, onClose, onSave }: { onStatus: (status: StaffAttendanceStatus) => void; error: string; value: { staff: AttendanceStaff; date: string; status: StaffAttendanceStatus }; checkIn: string; checkOut: string; notes: string; saving: boolean; onCheckIn: (value: string) => void; onCheckOut: (value: string) => void; onNotes: (value: string) => void; onClose: () => void; onSave: (event: React.FormEvent) => void }) {
  return <Modal title={`${attendanceLabels[value.status]} attendance — ${value.staff.name}`} onClose={onClose}><form className="staff-attendance-form" onSubmit={onSave}>
    <div className="staff-attendance-date"><CalendarDays size={19} /><div><strong>{new Date(`${value.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong><span>Daily attendance entry</span></div><b className={`staff-status staff-status-${value.status.toLowerCase()}`}>{attendanceLabels[value.status]}</b></div>
    <label>Attendance type<select value={value.status} onChange={event => onStatus(event.target.value as StaffAttendanceStatus)}>{Object.entries(attendanceLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
    {(value.status === "PRESENT" || value.status === "HALF_DAY") ? <><p className="staff-attendance-helper">Save check-in when staff arrive. Add check-out later when they leave.</p><div className="staff-time-grid"><label>Check-in time<ClockTimePicker value={checkIn} onChange={onCheckIn} /></label><label>Check-out time (optional)<ClockTimePicker value={checkOut} onChange={onCheckOut} /></label></div></> : <p className="staff-attendance-helper">No working time is required for {attendanceLabels[value.status].toLowerCase()} attendance.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <label className="staff-notes">Notes <span>(optional)</span><input maxLength={500} value={notes} onChange={event => onNotes(event.target.value)} placeholder="Example: Half day, approved leave reason" /></label>
    <div className="modal-actions staff-attendance-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save attendance"}</button></div>
  </form></Modal>;
}

function ClockTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"HOUR" | "MINUTE">("HOUR");
  const parsed = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(value);
  const rawHour = parsed ? Number(parsed[1]) : 9;
  const minute = parsed ? Math.min(59, Number(parsed[2])) : 0;
  const inferredPm = parsed?.[3] ? parsed[3].toUpperCase() === "PM" : rawHour >= 12;
  const hour24 = parsed?.[3] ? (rawHour % 12) + (inferredPm ? 12 : 0) : rawHour % 24;
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const save = (nextHour12: number, nextMinute: number, nextMeridiem: "AM" | "PM") => {
    const nextHour24 = (nextHour12 % 12) + (nextMeridiem === "PM" ? 12 : 0);
    onChange(`${String(nextHour24).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`);
  };
  const openPicker = (nextMode: "HOUR" | "MINUTE") => { setMode(nextMode); setOpen(true); };
  const clockValues = mode === "HOUR" ? Array.from({ length: 12 }, (_, index) => index + 1) : Array.from({ length: 12 }, (_, index) => index * 5);
  const selectedValue = mode === "HOUR" ? hour12 : minute;
  const selectValue = (nextValue: number) => {
    if (mode === "HOUR") {
      save(nextValue, minute, meridiem);
      setMode("MINUTE");
      return;
    }
    save(hour12, nextValue, meridiem);
    setOpen(false);
  };
  return <div className="staff-clock-picker"><div className="staff-clock-trigger" aria-label="Select time"><button type="button" className={open && mode === "HOUR" ? "active" : ""} onClick={() => openPicker("HOUR")}>{value ? String(hour12).padStart(2, "0") : "--"}</button><span>:</span><button type="button" className={open && mode === "MINUTE" ? "active" : ""} onClick={() => openPicker("MINUTE")}>{value ? String(minute).padStart(2, "0") : "--"}</button><button type="button" className="staff-clock-meridiem-toggle" onClick={() => save(hour12, minute, meridiem === "AM" ? "PM" : "AM")}>{meridiem}</button><button type="button" className="staff-clock-icon" aria-label="Open time picker" aria-expanded={open} onClick={() => open ? setOpen(false) : openPicker("HOUR")}><Clock3 size={17} /></button></div>{open && <div className="staff-clock-popover"><div className="staff-clock-heading"><Clock3 size={16} /> <strong>{mode === "HOUR" ? "Select hour" : "Select minutes"}</strong><span>{mode === "HOUR" ? "Next: minutes" : "Tap a minute to finish"}</span></div><div className={`staff-clock-hours ${mode === "MINUTE" ? "minutes" : ""}`}>{clockValues.map(clockValue => <button key={clockValue} type="button" className={clockValue === selectedValue ? "active" : ""} onClick={() => selectValue(clockValue)}>{mode === "HOUR" ? clockValue : String(clockValue).padStart(2, "0")}</button>)}</div><div className="staff-clock-footer"><button type="button" className="staff-clock-step" onClick={() => setMode(current => current === "HOUR" ? "MINUTE" : "HOUR")}>{mode === "HOUR" ? "Minutes" : "Hours"}</button><div className="staff-clock-meridiem"><button type="button" className={meridiem === "AM" ? "active" : ""} onClick={() => save(hour12, minute, "AM")}>AM</button><button type="button" className={meridiem === "PM" ? "active" : ""} onClick={() => save(hour12, minute, "PM")}>PM</button></div><button type="button" className="staff-clock-done" onClick={() => { save(hour12, minute, meridiem); setOpen(false); }}>Done</button></div></div>}</div>;
}

function AttendanceStaffModal({ notify, onClose, onCreated }: { notify: (message: string) => void; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Staff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api.createAttendanceStaff({ name, phone, role });
      notify("Attendance staff added."); onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to add staff."); }
    finally { setSaving(false); }
  }
  return <Modal title="Add attendance staff" onClose={onClose}><form className="staff-attendance-form staff-add-form" onSubmit={submit}>
    <p className="staff-attendance-helper">This profile is only for attendance. It does not create a login, email account, or password.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="staff-time-grid"><label><span className="staff-field-label">Staff name</span><input required autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Enter staff name" /></label><label><span className="staff-field-label">Phone number <em>(optional)</em></span><input value={phone} onChange={event => setPhone(event.target.value)} placeholder="Enter phone number" /></label></div>
    <label className="staff-notes">Role<select value={role} onChange={event => setRole(event.target.value)}><option value="Staff">Staff</option><option value="Manager">Manager</option><option value="Owner">Owner</option></select></label>
    <div className="modal-actions staff-attendance-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Adding…" : "Add staff"}</button></div>
  </form></Modal>;
}
