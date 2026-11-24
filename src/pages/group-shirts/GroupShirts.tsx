import { isAndroidApp } from "../../utils/mobileServer";
import { useEffect, useState } from "react";
import { Plus, Shirt, ArrowLeft, MoreVertical, Eye, Pencil, Trash2, Search } from "lucide-react";
import { useDismissibleDropdown } from "../../hooks/useDismissibleDropdown";
import { api } from "../../api";
import { money } from "../../data";
import { orderStatuses, normalizedStatus, statusLabel, type GroupShirtStatus, adultSizes, shirtSizes, sizeLabel, orderAmounts, productionAmounts, type GroupShirtInput, type GroupShirtOrder } from "./types";
import "./group-shirts.css";

const emptyOrder = (): GroupShirtInput => ({ groupName: "", customerName: "", phone: "", deliveryDate: "", fabric: "", colour: "", sleeve: "Half sleeve", printing: "", notes: "", photo: "", shirtRate: 0, discount: 0, vestiQuantity: 0, vestiRate: 0, advance: 0, lines: shirtSizes.map(size => ({ size, quantity: 0, rate: 0, photo: "" })) });

async function readPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo under 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Unable to process photo.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.75);
    if (result.length > 700000) throw new Error("Photo is too detailed. Please choose a smaller photo.");
    return result;
  } finally { URL.revokeObjectURL(url); }
}

function Photo({ value, onChange, label }: { value: string; onChange?: (value: string) => void; label: string }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <div className="gs-photo">
    {value && <a href={value} target="_blank" rel="noreferrer"><img src={value} alt={label} /></a>}
    {onChange && <><label>{busy ? "Processing photo…" : label}<input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
      setBusy(true); setError(""); try { onChange(await readPhoto(file)); } catch (err) { setError(err instanceof Error ? err.message : "Photo upload failed"); } finally { setBusy(false); }
    }} /></label>{value && <button type="button" onClick={() => onChange("")}>Remove photo</button>}</>}
    {error && <small role="alert">{error}</small>}
  </div>;
}

function OrderActions({ order, onOpen, onDelete, busy }: { order: GroupShirtOrder; onDelete: (order: GroupShirtOrder) => void; busy: boolean; onOpen: (order: GroupShirtOrder, mode: "view" | "edit") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissibleDropdown(open, () => setOpen(false));
  return <div className="gs-actions" ref={ref}>
    <button type="button" disabled={busy} aria-label={`Actions for ${order.groupName}`} aria-expanded={open} onClick={() => setOpen(!open)}><MoreVertical size={20} /></button>
    {open && <div className="gs-action-menu"><button type="button" onClick={() => { setOpen(false); onOpen(order, "view"); }}><Eye size={16} /> View</button><button type="button" onClick={() => { setOpen(false); onOpen(order, "edit"); }}><Pencil size={16} /> Edit</button><button type="button" style={{ color: "#c31332" }} onClick={() => { setOpen(false); onDelete(order); }}><Trash2 size={16} /> Delete</button></div>}
  </div>;
}

export function GroupShirts({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<GroupShirtOrder[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"list" | "create" | "view" | "edit">("list");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<GroupShirtInput>(emptyOrder); const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | GroupShirtStatus>("ALL");
  const currentStatus = normalizedStatus(orders.find(order => order.id === editingId)?.status || "PROCESSING");
  const visibleOrders = orders.filter(order => (statusFilter === "ALL" || normalizedStatus(order.status) === statusFilter) && (order.groupName + " " + order.customerName + " " + order.phone).toLowerCase().includes(search.toLowerCase()));
  async function changeStatus(status: GroupShirtStatus) {
    if (saving || mode !== "edit") return;
    setSaving(true); setError(""); setMessage("");
    try {
      const updated = await api.updateGroupShirtStatus(editingId, status);
      setOrders(rows => rows.map(row => row.id === updated.id ? updated : row));
      setMessage("Order status updated to " + statusLabel(updated.status) + ".");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update status"); }
    finally { setSaving(false); }
  }
  async function deleteOrder(order: GroupShirtOrder) {
    if (saving || !window.confirm('Delete order "' + order.groupName + '" for ' + order.customerName + '? This cannot be undone.')) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await api.deleteGroupShirtOrder(order.id);
      setOrders(rows => rows.filter(row => row.id !== order.id));
      setMessage("Group shirt order deleted successfully.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete order"); }
    finally { setSaving(false); }
  }
  const [message, setMessage] = useState("");
  async function load() { setLoading(true); setError(""); try { setOrders(await api.groupShirtOrders()); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load orders"); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const { total, quantity, subtotal, shirts, vesti, balance } = orderAmounts(draft);
  const costs = productionAmounts(draft);
  const [includeVesti, setIncludeVesti] = useState(false);
  function setQuantity(size: string, value: number) { setDraft(d => ({ ...d, lines: d.lines.map(l => l.size === size ? { ...l, quantity: Math.max(0, Math.min(10000, value)) } : l) })); }
  const readonly = mode === "view";
  function openOrder(order: GroupShirtOrder, nextMode: "view" | "edit") {
    setDraft({ ...order, lines: shirtSizes.map(size => order.lines.find(line => line.size === size) || { size, quantity: 0, rate: 0, photo: "" }) });
    setEditingId(order.id); setIncludeVesti(order.vestiQuantity > 0); setMode(nextMode); setError(""); setMessage("");
  }
  function field(key: keyof GroupShirtInput, value: string | number) { setDraft(d => ({ ...d, [key]: value })); }
  return <section className={`group-shirts ${mode === "list" ? "gs-list-page" : ""} ${isAndroidApp() ? "gs-android" : ""}`}>
    {mode === "list" && <button type="button" className="gs-dashboard-back" onClick={onBack}><ArrowLeft size={16} /> Back to Dashboard</button>}
    <header className="gs-header"><div className="gs-heading-content"><span className="gs-heading-icon"><Shirt size={23} aria-hidden="true" /></span><div><h1>Group Shirt Orders</h1><p>Manage orders, sizes and delivery status.</p></div></div>
      {mode === "list" && <button className="primary" onClick={() => { setDraft(emptyOrder()); setIncludeVesti(false); setMode("create"); setError(""); setMessage(""); }}><Plus size={16} /> Create Order</button>}
    </header>
    {mode !== "list" && <div className="gs-order-toolbar">
      <button type="button" disabled={saving} onClick={() => { setMode("list"); setError(""); setMessage(""); }}><ArrowLeft size={16} /> Back to orders</button>
      {mode !== "create" && <label className={`gs-status-control gs-status-control-${currentStatus.toLowerCase()}`}><span>Order status</span><select value={currentStatus} disabled={saving || readonly} onChange={e => void changeStatus(e.target.value as GroupShirtStatus)}>{orderStatuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>}
    </div>}
    {error && <div className="gs-error" role="alert">{error}{mode === "list" && <button onClick={() => void load()}>Retry</button>}</div>}
    {message && <p role="status">{message}</p>}
    {mode === "list" ? <>
      <div className="gs-summary" aria-label="Filter orders by status">
        {([{ value: "ALL", label: "Total orders" }, { value: "PROCESSING", label: "Pending" }, { value: "COMPLETED", label: "Completed" }, { value: "DELIVERED", label: "Delivered" }] as const).map(item => <button type="button" key={item.value} aria-pressed={statusFilter === item.value} className={statusFilter === item.value ? "gs-summary-active" : ""} onClick={() => { setStatusFilter(item.value); setSearch(""); }}><span>{item.label}</span><strong>{loading ? "..." : orders.filter(order => item.value === "ALL" || normalizedStatus(order.status) === item.value).length}</strong></button>)}
      </div>
      <div className="gs-list-toolbar"><div><h2>{statusFilter === "ALL" ? "All orders" : statusFilter === "PROCESSING" ? "Pending orders" : statusLabel(statusFilter) + " orders"}</h2><span>{loading ? "Loading orders..." : `${visibleOrders.length} ${visibleOrders.length === 1 ? "order" : "orders"}`}</span></div><div className="gs-search-control"><Search size={17} aria-hidden="true" /><input className="gs-search" aria-label="Search group orders" placeholder="Search event, customer or phone" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      {loading ? <p>Loading orders...</p> : <div className="gs-table-wrap"><table className="gs-table">
        <thead><tr><th>Event</th><th>{isAndroidApp() ? "Customer" : "Customer name"}</th><th>Mobile number</th><th className="gs-number">{isAndroidApp() ? "Total" : "Total amount"}</th><th className="gs-number">Advance amount</th><th className="gs-number">Remaining amount</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{visibleOrders.map(order => {
          const amounts = orderAmounts(order);
          return <tr key={order.id}><td data-label="Event"><button type="button" className="gs-order-link" onClick={() => openOrder(order, "view")}>{order.groupName}</button></td><td data-label="Customer">{order.customerName}</td><td data-label="Mobile">{order.phone}</td><td data-label="Total" className="gs-number">{money(amounts.total)}</td><td data-label="Advance" className="gs-number">{money(order.advance)}</td><td data-label="Balance" className="gs-number gs-due">{money(amounts.balance)}</td><td data-label="Status"><span className={`gs-status-badge gs-status-${normalizedStatus(order.status).toLowerCase()}`}>{statusLabel(order.status)}</span></td><td data-label="Actions"><OrderActions order={order} onOpen={openOrder} onDelete={order => void deleteOrder(order)} busy={saving} /></td></tr>;
        })}
        {!visibleOrders.length && <tr><td colSpan={8} className="gs-empty-row">{search || statusFilter !== "ALL" ? "No orders match this filter." : "No group shirt orders yet. Create your first order to get started."}</td></tr>}
        </tbody></table></div>}
    </> : <form onSubmit={async e => {
      e.preventDefault(); if (saving || readonly) return;
      if (e.currentTarget.querySelector('input[type="file"]:disabled')) { setError("Please wait until the photo finishes processing."); return; }
      if (!quantity) { setError("Enter quantity for at least one size."); return; }
      if (draft.discount > subtotal) { setError("Discount cannot exceed subtotal."); return; }
      if (draft.advance > total) { setError("Advance cannot exceed order total."); return; }
      setSaving(true); setError("");
      try { const order = mode === "edit" ? await api.updateGroupShirtOrder(editingId, draft) : await api.createGroupShirtOrder(draft); setOrders(rows => mode === "edit" ? rows.map(row => row.id === order.id ? order : row) : [order, ...rows]); setMode("list"); setMessage(mode === "edit" ? "Group shirt order updated successfully." : "Group shirt order created successfully."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save order"); } finally { setSaving(false); }
    }}>
      <fieldset disabled={readonly || saving} className="gs-card"><legend>{readonly ? "Order details" : mode === "edit" ? "Edit Group Shirt Order" : "Create Group Shirt Order"}</legend><div className="gs-fields">
        {([ ["groupName", "Group / event name"], ["customerName", "Customer / contact name"], ["phone", "Phone number"], ["deliveryDate", "Delivery date"], ["fabric", "Fabric"], ["colour", "Shirt colour"] ] as const).map(([key, label]) => <label key={key}>{label}<input required={["groupName", "customerName", "phone", "deliveryDate"].includes(key)} maxLength={key === "phone" ? 20 : 150} type={key === "deliveryDate" ? "date" : key === "phone" ? "tel" : "text"} value={draft[key]} onChange={e => field(key, e.target.value)} /></label>)}
        <label>Sleeve<select value={draft.sleeve} onChange={e => field("sleeve", e.target.value)}><option>Half sleeve</option><option>Full sleeve</option></select></label>
        <label>Printing / embroidery details<input maxLength={1000} placeholder="Logo, names, placement, print colour" value={draft.printing} onChange={e => field("printing", e.target.value)} /></label>
      </div><Photo value={draft.photo} label="Upload main shirt photo" onChange={readonly ? undefined : value => field("photo", value)} />
      <p>JPG, PNG or WebP, up to 10 MB. Photos are resized before saving.</p>
      </fieldset>

      {["Kids sizes", "Adult sizes"].map((title, group) => <fieldset disabled={readonly || saving} className="gs-card" key={title}><legend>{title}</legend><div className="gs-sizes gs-compact">
        {draft.lines.filter(line => group === 0 ? !(adultSizes as readonly string[]).includes(line.size) : (adultSizes as readonly string[]).includes(line.size)).map(line => <div className="gs-size" key={line.size}>
          <h3>{sizeLabel(line.size)}</h3><div className="gs-stepper">
            <button type="button" aria-label={"Decrease " + sizeLabel(line.size) + " quantity"} disabled={line.quantity <= 0} onClick={() => setQuantity(line.size, line.quantity - 1)}>-</button>
            <input aria-label={sizeLabel(line.size) + " quantity"} type="number" min={0} max={10000} step={1} required value={line.quantity} onChange={e => setQuantity(line.size, Number(e.target.value))} />
            <button type="button" aria-label={"Increase " + sizeLabel(line.size) + " quantity"} disabled={line.quantity >= 10000} onClick={() => setQuantity(line.size, line.quantity + 1)}>+</button>
          </div>
        </div>)}
      </div></fieldset>)}
      <fieldset disabled={readonly || saving} className="gs-card"><legend>Vesti (optional)</legend>
        <label className="gs-checkbox"><input type="checkbox" checked={includeVesti} onChange={e => { setIncludeVesti(e.target.checked); if (!e.target.checked) setDraft(d => ({ ...d, vestiQuantity: 0, vestiRate: 0 })); }} /> Add vesti to this order</label>
        {includeVesti && <div className="gs-fields"><label>Vesti quantity<input type="number" min={1} max={10000} step={1} required value={draft.vestiQuantity} onChange={e => field("vestiQuantity", Number(e.target.value))} /></label><label>Rate per vesti (INR)<input type="number" min={0} max={100000} step="0.01" required value={draft.vestiRate} onChange={e => field("vestiRate", Number(e.target.value))} /></label></div>}
      </fieldset>
      <fieldset disabled={readonly || saving} className="gs-card"><legend>Amount & payment</legend><div className="gs-fields">
        <label>Total shirt quantity<input readOnly value={quantity} /></label>
        {draft.shirtRate != null ? <label>Shirt rate (INR)<input type="number" min={0} max={100000} step="0.01" required value={draft.shirtRate} onChange={e => field("shirtRate", Number(e.target.value))} /></label> : <p>Previous order: original size-wise pricing retained.</p>}
        <label>Discount amount (INR)<input type="number" min={0} max={subtotal} step="0.01" required value={draft.discount || 0} onChange={e => field("discount", Number(e.target.value))} /></label>
        <label>Advance amount (INR)<input type="number" min={0} max={Math.max(0, total)} step="0.01" required value={draft.advance} onChange={e => field("advance", Number(e.target.value))} /></label>
        <label>Special instructions<textarea maxLength={2000} value={draft.notes} onChange={e => field("notes", e.target.value)} /></label></div>
        <div className="gs-totals"><p>Shirts ({quantity}) <strong>{money(shirts)}</strong></p>{includeVesti && <p>Vesti ({draft.vestiQuantity}) <strong>{money(vesti)}</strong></p>}<p>Subtotal <strong>{money(subtotal)}</strong></p><p>Discount <strong>- {money(draft.discount || 0)}</strong></p><p>Total amount <strong>{money(total)}</strong></p><p>Advance <strong>{money(draft.advance)}</strong></p><p className="gs-balance">Remaining amount <strong>{money(balance)}</strong></p></div>
        <small>Order tracking only. Create a sales invoice / payment entry separately for billing and collections.</small>
      </fieldset>
      <fieldset disabled={readonly || saving} className="gs-card gs-production"><legend>Fabric purchase</legend>
        <div className="gs-fabric-row">
          <label>Fabric supplier name<input maxLength={150} value={draft.fabricSupplier || ""} onChange={e => field("fabricSupplier", e.target.value)} /></label>
          <label>Fabric metres<input type="number" min={0} max={1000000} step="0.01" value={draft.fabricMetres || 0} onChange={e => field("fabricMetres", Number(e.target.value))} /></label>
          <label>Price per metre (INR)<input type="number" min={0} max={1000000} step="0.01" value={draft.fabricPrice || 0} onChange={e => field("fabricPrice", Number(e.target.value))} /></label>
          <div className="gs-inline-total"><span>Fabric total</span><strong>{money(costs.fabricTotal)}</strong></div>
        </div>
        <div className="gs-fabric-extras"><p>GST (5%) <strong>{money(costs.gst)}</strong></p>
          <label>Transport cost (INR)<input type="number" min={0} max={100000000} step="0.01" value={draft.transportCost || 0} onChange={e => field("transportCost", Number(e.target.value))} /></label>
          <p className="gs-cost-total">Fabric purchase total<strong>{money(costs.fabricPurchase)}</strong></p>
        </div>
      </fieldset>
      <fieldset disabled={readonly || saving} className="gs-card gs-stitching"><legend>Stitching cost</legend>
        <div className="gs-stitching-row"><label>Stitching quantity<input type="number" min={0} max={1000000} step={1} value={draft.stitchingQuantity || 0} onChange={e => field("stitchingQuantity", Number(e.target.value))} /></label>
          <label>Stitching price per piece (INR)<input type="number" min={0} max={1000000} step="0.01" value={draft.stitchingPrice || 0} onChange={e => field("stitchingPrice", Number(e.target.value))} /></label>
          <div className="gs-inline-total"><span>Stitching total</span><strong>{money(costs.stitching)}</strong></div>
        </div>
      </fieldset>
      <div className="gs-card gs-profit-card"><h2>Production cost & profit</h2><div className="gs-profit-row">
        <p>Fabric purchase total<strong>{money(costs.fabricPurchase)}</strong></p><p>Stitching total<strong>{money(costs.stitching)}</strong></p>
        <p className="gs-cost-total">Production cost<strong>{money(costs.production)}</strong></p>
        <p>Order subtotal<strong>{money(subtotal)}</strong></p><p className={`gs-profit ${costs.profit < 0 ? "gs-loss" : ""}`}>Shirt profit amount<strong>{money(costs.profit)}</strong></p>
      </div><small>Shirt profit = order subtotal (before discount, including vesti if added) − production cost. Advance does not change profit.</small></div>
      {!readonly && <button className="primary" type="submit" disabled={saving}>{saving ? "Saving order…" : mode === "edit" ? "Save Changes" : "Create Group Shirt Order"}</button>}
    </form>}
  </section>;
}
