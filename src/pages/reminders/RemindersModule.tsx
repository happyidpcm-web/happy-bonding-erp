import { useState } from "react";
import { MessageCircle } from "lucide-react";
import type { Invoice, Party } from "../../types";

export function RemindersModule({ parties, invoices, notify }: { parties: Party[]; invoices: Invoice[]; notify: (msg: string) => void }) {
  const [tab, setTab] = useState<"dues" | "greetings">("dues");

  const customersWithDue = parties.filter(p => p.type === "Customer" && p.balance > 0);
  const customersWithSpecialDays = parties.filter(p => p.type === "Customer" && (p.customBirthday || p.customKovilThiruvila));

  const handleSendPaymentReminder = (p: Party) => {
    const partyInvoices = invoices.filter(inv => inv.party === p.name && (inv.status === "Unpaid" || inv.status === "Partially paid"));
    const invNumbers = partyInvoices.map(i => i.number).join(", ") || "Outstanding Balance";
    const text = `👔 *Happy Bonding Men's Wear - Store Reminder*
--------------------------------------------
Hello *${p.name}*! Thank you for shopping with us.

🧾 *Bill Ref:* ${invNumbers}
🏷️ *Outstanding Due Amount:* ₹${p.balance.toLocaleString("en-IN")}

Kindly make payment via Cash or UPI at our store or online.
--------------------------------------------
📍 West Bus Stand, Pavoorchatram (Near Railway Gate)
📞 Contact: 7708030903`;

    const digits = (p.phone || "").replace(/\D/g, "");
    const targetPhone = digits.length === 10 ? `91${digits}` : digits.length > 10 ? digits : "";
    const url = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    notify(`WhatsApp reminder opened for ${p.name}`);
  };

  const handleSendGreeting = (p: Party, eventType: "Birthday" | "Festival") => {
    const eventName = eventType === "Birthday" ? (p.customBirthday || "Special Day") : (p.customKovilThiruvila || "Kovil Thiruvila");
    const text = `👔 *Happy Bonding Men's Wear - Pavoorchatram*
--------------------------------------------
✨ *Happy ${eventType === "Birthday" ? "Birthday" : "Festival"} Wishes to ${p.name}!* ✨

Warmest greetings on *${eventName}*! Wishing you and your family abundance, happiness, and prosperity.

Visit us for special festival offers & new shirt/pant arrivals!
--------------------------------------------
📍 West Bus Stand, Pavoorchatram (Near Railway Gate)`;

    const digits = (p.phone || "").replace(/\D/g, "");
    const targetPhone = digits.length === 10 ? `91${digits}` : digits.length > 10 ? digits : "";
    const url = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    notify(`WhatsApp greeting opened for ${p.name}`);
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>WhatsApp Reminders & Greetings</h1>
        <small style={{ color: "#64748b" }}>1-Click WhatsApp payment reminders & customer birthday/festival wishes</small>
      </div>

      <div style={{ display: "flex", gap: 16, borderBottom: "1px solid #e2e8f0", marginBottom: 20 }}>
        <button type="button" onClick={() => setTab("dues")} style={{ padding: "10px 16px", border: 0, background: "transparent", fontWeight: 700, fontSize: 14, color: tab === "dues" ? "#4f46e5" : "#64748b", borderBottom: tab === "dues" ? "2px solid #4f46e5" : "2px solid transparent", cursor: "pointer" }}>
          💳 Payment Due Reminders ({customersWithDue.length})
        </button>
        <button type="button" onClick={() => setTab("greetings")} style={{ padding: "10px 16px", border: 0, background: "transparent", fontWeight: 700, fontSize: 14, color: tab === "greetings" ? "#4f46e5" : "#64748b", borderBottom: tab === "greetings" ? "2px solid #4f46e5" : "2px solid transparent", cursor: "pointer" }}>
          🎉 Birthday & Kovil Thiruvila Greetings ({customersWithSpecialDays.length})
        </button>
      </div>

      {tab === "dues" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Customer Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Phone</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Balance Due (₹)</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>WhatsApp Action</th>
              </tr>
            </thead>
            <tbody>
              {customersWithDue.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>No customer pending balances found.</td></tr>
              ) : (
                customersWithDue.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <td style={{ padding: "14px 16px" }}><strong>{p.name}</strong></td>
                    <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.phone || "-"}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>₹{p.balance.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <button type="button" onClick={() => handleSendPaymentReminder(p)} style={{ background: "#25D366", color: "#fff", border: 0, borderRadius: 6, padding: "6px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <MessageCircle size={14}/> Send WhatsApp Reminder
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "greetings" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Customer Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Phone</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Birthday Date</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Kovil Thiruvila</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Send Wishes</th>
              </tr>
            </thead>
            <tbody>
              {customersWithSpecialDays.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>No customers registered with Birthday or Kovil Thiruvila info yet. Add them in Parties master.</td></tr>
              ) : (
                customersWithSpecialDays.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <td style={{ padding: "14px 16px" }}><strong>{p.name}</strong></td>
                    <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.phone || "-"}</td>
                    <td style={{ padding: "14px 16px" }}>{p.customBirthday || "-"}</td>
                    <td style={{ padding: "14px 16px" }}>{p.customKovilThiruvila || "-"}</td>
                    <td style={{ padding: "14px 16px", textAlign: "center", display: "flex", gap: 8, justifyContent: "center" }}>
                      {p.customBirthday && (
                        <button type="button" onClick={() => handleSendGreeting(p, "Birthday")} style={{ background: "#ec4899", color: "#fff", border: 0, borderRadius: 6, padding: "6px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          🎂 Birthday Wishes
                        </button>
                      )}
                      {p.customKovilThiruvila && (
                        <button type="button" onClick={() => handleSendGreeting(p, "Festival")} style={{ background: "#8b5cf6", color: "#fff", border: 0, borderRadius: 6, padding: "6px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          🚩 Festival Wishes
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
