import { useState } from "react";
import { ArrowLeft, ChevronRight, Landmark, Shirt } from "lucide-react";
import { GroupShirtAmountTransactions } from "./GroupShirtAmountTransactions";
import { GroupShirts } from "./GroupShirts";
import "./group-shirts.css";

type Screen = "home" | "orders" | "amounts";

export function GroupShirtWorkspace({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [viewOrderId, setViewOrderId] = useState<string>();
  if (screen === "orders") return <GroupShirts onBack={() => setScreen("home")} openOrderId={viewOrderId} onInitialOrderOpened={() => setViewOrderId(undefined)} />;
  if (screen === "amounts") return <GroupShirtAmountTransactions onBack={() => setScreen("home")} onViewOrder={id => { setViewOrderId(id); setScreen("orders"); }} />;
  return <section className="group-shirts gs-workspace">
    <button type="button" className="gs-dashboard-back" onClick={onBack}><ArrowLeft size={16} /> Back to Dashboard</button>
    <header className="gs-header"><div className="gs-heading-content"><span className="gs-heading-icon"><Shirt size={23} /></span><div><h1>Group Shirts</h1><p>Orders, costs and payments in one place.</p></div></div></header>
    <div className="gs-workspace-options">
      <button type="button" className="gs-workspace-option" onClick={() => setScreen("orders")}><span className="gs-workspace-icon"><Shirt size={26} /></span><span><strong>Orders</strong><small>Manage sizes and delivery status.</small></span><ChevronRight className="gs-workspace-arrow" size={18} aria-hidden="true" /></button>
      <button type="button" className="gs-workspace-option" onClick={() => setScreen("amounts")}><span className="gs-workspace-icon"><Landmark size={26} /></span><span><strong>Amount transactions</strong><small>Review costs, payments and profit.</small></span><ChevronRight className="gs-workspace-arrow" size={18} aria-hidden="true" /></button>
    </div>
  </section>;
}
