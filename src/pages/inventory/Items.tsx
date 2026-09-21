import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Boxes, ChevronDown, ClipboardList, ExternalLink, FileSpreadsheet, FileText, Mail, PackagePlus, Pencil, Percent, Plus, Printer, QrCode, Search, Settings, Star, Tag, Trash2, Upload, X
} from "lucide-react";
import * as XLSX from "xlsx";
import { money } from "../../data";
import { api } from "../../api";
import { GARMENT_HSN_CODES } from "../../data/hsnCodes";
import { BarcodeGeneratorModal } from "../../components/BarcodeGeneratorModal";
import type { Invoice, Product } from "../../types";
import { Modal } from "../../App";
import { RateListReportScreen, StockSummaryReportScreen, LowStockSummaryReportScreen, ItemSalesSummaryReportScreen } from "../reports/Reports";

interface Offer {
  id: string;
  name: string;
  percentage: number;
  startDate: string;
  endDate: string;
  itemIds: string[];
  active: boolean;
  createdAt: string;
}

export function CreateOfferModal({
  products,
  onSaveOffer,
  onClose,
  notify,
}: {
  products: Product[];
  onSaveOffer: (offer: Offer) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [pct, setPct] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchItem, setSearchItem] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category || "General"))), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = `${p.name} ${p.sku}`.toLowerCase().includes(searchItem.toLowerCase());
      const matchCat = categoryFilter === "All Categories" || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, searchItem, categoryFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => String(p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = () => {
    if (!name.trim()) return notify("Please enter Offer Name");
    const percentage = Number(pct);
    if (!percentage || percentage <= 0 || percentage > 100) return notify("Please enter a valid Offer Percentage (1-100%)");
    if (!selectedIds.length) return notify("Please select at least one item for this offer");

    const newOffer: Offer = {
      id: "OFFER-" + Date.now(),
      name: name.trim(),
      percentage,
      startDate,
      endDate,
      itemIds: selectedIds,
      active: true,
      createdAt: new Date().toISOString(),
    };

    onSaveOffer(newOffer);
    notify(`Offer '${name}' created successfully for ${selectedIds.length} items!`);
    onClose();
  };

  return (
    <Modal title="Create Offer" onClose={onClose} wide>
      <div className="create-offer-modal-body">
        <div className="create-offer-grid">
          <label>
            <div className="label-title">Offer Name <span className="req">*</span></div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter Offer Name" />
          </label>
          <label>
            <div className="label-title">Start Date</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label>
            <div className="label-title">Offer Percentage <span className="req">*</span></div>
            <div className="offer-pct-wrap">
              <input type="number" value={pct} onChange={e => setPct(e.target.value)} placeholder="Enter Offer Percentage" />
              <div className="pct-addon">%</div>
            </div>
          </label>
          <label>
            <div className="label-title">End Date</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </label>
        </div>

        <div className="offer-items-selection">
          <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
            Select items you want to apply offer for
          </h4>

          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div className="search-input-wrap" style={{ flex: 1, background: "#ffffff" }}>
              <Search size={15} color="#94a3b8" />
              <input value={searchItem} onChange={e => setSearchItem(e.target.value)} placeholder="Search any item..." />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ padding: "0 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff", height: 40 }}
            >
              <option value="All Categories">Search Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="table-scroll" style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, background: "#ffffff" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>ITEM NAME ⇅</th>
                  <th>ITEM CODE</th>
                  <th>STOCK QTY ⇅</th>
                  <th className="right">MRP</th>
                  <th className="right">SELLING PRICE</th>
                  <th className="right">DISCOUNTED PRICE AFTER TAX</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const pId = String(p.id);
                  const isChecked = selectedIds.includes(pId);
                  const numPct = Number(pct) || 0;
                  const discountedPrice = numPct > 0 ? (p.mrp || p.sellingPrice) * (1 - numPct / 100) : p.sellingPrice;

                  return (
                    <tr key={p.id} className={isChecked ? "selected-row" : ""}>
                      <td>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(pId)} />
                      </td>
                      <td><strong>{p.name}</strong></td>
                      <td className="mono">{p.sku}</td>
                      <td>{p.stock} {p.size || "PCS"}</td>
                      <td className="right">₹ {p.mrp || p.sellingPrice}</td>
                      <td className="right">₹ {p.sellingPrice}</td>
                      <td className="right" style={{ color: numPct > 0 ? "#16a34a" : "#64748b", fontWeight: numPct > 0 ? 700 : 400 }}>
                        {numPct > 0 ? `₹ ${Math.round(discountedPrice)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10, paddingRight: 24 }}>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={handleSave} style={{ background: "#4f46e5", borderColor: "#4f46e5", padding: "8px 24px" }}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function OffersScreen({
  offers,
  products,
  onBack,
  onCreateOfferClick,
}: {
  offers: Offer[];
  products: Product[];
  onBack: () => void;
  onCreateOfferClick: () => void;
}) {
  return (
    <div className="offers-screen-wrapper">
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Offers</h1>
        </div>
      </div>

      <div className="offers-promo-cards-grid">
        <div className="offer-promo-card">
          <div className="promo-illustration">
            <Tag size={42} color="#3b82f6" />
          </div>
          <div className="promo-card-footer">
            <strong>Run item-level discounts</strong>
            <p>Apply discounts to selected items for a fixed period — perfect for festivals, sales, or clearance.</p>
          </div>
        </div>

        <div className="offer-promo-card">
          <div className="promo-illustration">
            <Percent size={42} color="#6366f1" />
          </div>
          <div className="promo-card-footer">
            <strong>Control pricing, avoid mistakes</strong>
            <p>Offers automatically apply the right discount during billing, so staff don't have to remember prices.</p>
          </div>
        </div>

        <div className="offer-promo-card">
          <div className="promo-illustration">
            <Boxes size={42} color="#10b981" />
          </div>
          <div className="promo-card-footer">
            <strong>One item, one active offer</strong>
            <p>Each item can have only one active offer at a time. New offers automatically replace older ones.</p>
          </div>
        </div>
      </div>

      <div className="offers-action-callout" style={{ textAlign: "center", margin: "24px 0" }}>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
          Takes less than a minute to create your first offer.
        </p>
        <button
          type="button"
          className="primary purple-party-btn"
          onClick={onCreateOfferClick}
          style={{ padding: "10px 24px", fontSize: 14, fontWeight: 700 }}
        >
          Create Your First Offer
        </button>
      </div>

      {offers.length > 0 && (
        <article className="card table-card" style={{ marginTop: 20 }}>
          <div className="table-toolbar">
            <h3>Active Offers ({offers.length})</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Offer Name</th>
                <th>Discount Percentage</th>
                <th>Validity Period</th>
                <th>Applied Items Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {offers.map(off => (
                <tr key={off.id}>
                  <td><strong>{off.name}</strong></td>
                  <td><span className="pill success">{off.percentage}% OFF</span></td>
                  <td>{off.startDate} to {off.endDate}</td>
                  <td>{off.itemIds.length} items</td>
                  <td><span className="pill success">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </div>
  );
}

export function BulkEditSelectModal({
  totalProductsCount,
  onProceed,
  onClose,
}: {
  totalProductsCount: number;
  onProceed: () => void;
  onClose: () => void;
}) {
  const [selectedRange, setSelectedRange] = useState("Items 1 - 1600");

  return (
    <Modal title="Bulk Edit" onClose={onClose}>
      <div style={{ padding: "8px 0" }}>
        <label style={{ font: "600 13px Manrope", color: "#334155", display: "block", marginBottom: 12 }}>
          Select Item Range to Edit
          <select
            value={selectedRange}
            onChange={e => setSelectedRange(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 6, fontSize: 13 }}
          >
            <option value="Items 1 - 1600">Items 1 - 1600</option>
            <option value="Items 1601 - 3200">Items 1601 - 3200</option>
            <option value="All Items">All Items ({totalProductsCount})</option>
          </select>
        </label>

        <p style={{ fontSize: 11, color: "#d97706", background: "#fef3c7", padding: "6px 10px", borderRadius: 6, margin: "0 0 20px" }}>
          in alphabetical order A to Z
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onProceed}
            style={{ background: "#4f46e5", borderColor: "#4f46e5" }}
          >
            Proceed
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function BulkEditItemsSpreadsheetScreen({
  products,
  onSaveProducts,
  onClose,
  notify,
}: {
  products: Product[];
  onSaveProducts: (updatedProducts: Product[]) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [editableItems, setEditableItems] = useState<Product[]>(() => products.map(p => ({ ...p })));

  const updateProductCell = (index: number, field: keyof Product, value: any) => {
    setEditableItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    onSaveProducts(editableItems);
    notify(`Bulk edited ${editableItems.length} items successfully!`);
    onClose();
  };

  return (
    <div className="bulk-add-parties-fullscreen">
      <div className="bulk-add-header">
        <div className="bulk-add-title">
          <button type="button" className="icon-button" onClick={onClose} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h2>Bulk Edit Items</h2>
          <button type="button" className="text-button" style={{ color: "#2563eb", font: "600 12px Manrope" }} onClick={() => notify("How to Use guide opened")}>
            ⓘ How to Use
          </button>
        </div>

        <div className="bulk-add-actions">
          <button type="button" className="secondary" onClick={() => setEditableItems(products.map(p => ({ ...p })))}>
            Reset
          </button>
          <button type="button" className="primary" onClick={handleSave} style={{ background: "#4f46e5", borderColor: "#4f46e5" }}>
            Save Changes
          </button>
        </div>
      </div>

      <div className="bulk-add-warning-banner">
        <span>You can edit only 4000 items at once. For editing more than 4000 items, please contact our support team at 7400417400. [Batched Items cannot be edited]</span>
      </div>

      <div className="table-scroll spreadsheet-container" style={{ flex: 1, padding: 12 }}>
        <table className="bulk-spreadsheet-table">
          <thead>
            <tr>
              <th className="row-num">#</th>
              <th style={{ minWidth: 180 }}>Item Name* (mandatory field)</th>
              <th style={{ minWidth: 140 }}>Description</th>
              <th style={{ minWidth: 120 }}>Category</th>
              <th style={{ minWidth: 130 }}>Item code</th>
              <th style={{ minWidth: 100 }}>HSN Code</th>
              <th style={{ minWidth: 110 }}>GST Tax Rate(%)</th>
              <th style={{ minWidth: 100 }}>Sales Price</th>
              <th style={{ minWidth: 120 }}>Sales Tax Inclusive</th>
              <th style={{ minWidth: 100 }}>Purchase Price</th>
              <th style={{ minWidth: 130 }}>Purchase Tax Inclusive</th>
              <th style={{ minWidth: 90 }}>MRP</th>
              <th style={{ minWidth: 100 }}>Current stock</th>
              <th style={{ minWidth: 130 }}>Low stock alert quantity</th>
              <th style={{ minWidth: 140 }}>Visible on Online Store?</th>
              <th style={{ minWidth: 90 }}>Discount</th>
            </tr>
          </thead>
          <tbody>
            {editableItems.map((p, i) => (
              <tr key={p.id}>
                <td className="row-num">{i + 1}</td>
                <td><input value={p.name} onChange={e => updateProductCell(i, "name", e.target.value)} /></td>
                <td><input value="" onChange={() => {}} placeholder="Description" /></td>
                <td><input value={p.category || "General"} onChange={e => updateProductCell(i, "category", e.target.value)} /></td>
                <td><input value={p.sku} onChange={e => updateProductCell(i, "sku", e.target.value)} /></td>
                <td><input value={p.hsnCode || "6205"} onChange={e => updateProductCell(i, "hsnCode", e.target.value)} /></td>
                <td><input value={String(p.taxRate || 0)} onChange={e => updateProductCell(i, "taxRate", Number(e.target.value))} /></td>
                <td><input value={String(p.sellingPrice)} onChange={e => updateProductCell(i, "sellingPrice", Number(e.target.value))} /></td>
                <td>
                  <select value="Inclusive" onChange={() => {}}>
                    <option value="Inclusive">Inclusive</option>
                    <option value="Exclusive">Exclusive</option>
                  </select>
                </td>
                <td><input value={String(p.purchasePrice)} onChange={e => updateProductCell(i, "purchasePrice", Number(e.target.value))} /></td>
                <td>
                  <select value="Inclusive" onChange={() => {}}>
                    <option value="Inclusive">Inclusive</option>
                    <option value="Exclusive">Exclusive</option>
                  </select>
                </td>
                <td><input value={String(p.mrp || p.sellingPrice)} onChange={e => updateProductCell(i, "mrp", Number(e.target.value))} /></td>
                <td><input value={String(p.stock)} onChange={e => updateProductCell(i, "stock", Number(e.target.value))} /></td>
                <td><input value="10" onChange={() => {}} /></td>
                <td>
                  <select value="Yes" onChange={() => {}}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td><input value="0" onChange={() => {}} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BulkEditGSTRateScreen({
  products,
  onSaveProducts,
  onClose,
  notify,
}: {
  products: Product[];
  onSaveProducts: (updatedProducts: Product[]) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [editableProducts, setEditableProducts] = useState<Product[]>(() => products.map(p => ({ ...p })));
  const [searchQuery, setSearchQuery] = useState("");
  const [rateFilter, setRateFilter] = useState("All Rates");

  const filteredProducts = useMemo(() => {
    return editableProducts.filter(p => {
      const matchSearch = `${p.name} ${p.sku} ${p.hsnCode || ""}`.toLowerCase().includes(searchQuery.toLowerCase());
      const pRate = String(p.taxRate || 0);
      const matchRate = rateFilter === "All Rates" || (rateFilter === "None" ? p.taxRate === 0 : pRate === rateFilter.replace("%", ""));
      return matchSearch && matchRate;
    });
  }, [editableProducts, searchQuery, rateFilter]);

  const updateProductProp = (id: string | number, field: keyof Product, value: any) => {
    setEditableProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSave = () => {
    onSaveProducts(editableProducts);
    notify("GST Rates updated successfully for all items!");
    onClose();
  };

  return (
    <div className="bulk-add-parties-fullscreen">
      <div className="bulk-add-header">
        <div className="bulk-add-title">
          <button type="button" className="icon-button" onClick={onClose} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h2>Bulk Edit GST Rate</h2>
        </div>

        <div className="bulk-add-actions">
          <button type="button" className="primary" onClick={handleSave} style={{ background: "#4f46e5", borderColor: "#4f46e5" }}>
            Save Changes
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={14} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Item Name, HSN code"
          />
        </div>

        <select
          value={rateFilter}
          onChange={e => setRateFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}
        >
          <option value="All Rates">Filter by GST Rate</option>
          <option value="None">None</option>
          <option value="0%">0%</option>
          <option value="0.25%">0.25%</option>
          <option value="3%">3%</option>
          <option value="5%">5%</option>
          <option value="12%">12%</option>
          <option value="18%">18%</option>
          <option value="28%">28%</option>
        </select>
      </div>

      <div className="table-scroll" style={{ flex: 1, padding: 14 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" /></th>
              <th style={{ minWidth: 220 }}>Item Name ⇅</th>
              <th style={{ minWidth: 160 }}>HSN/SAC Code</th>
              <th style={{ minWidth: 160 }}>Purchase Price (₹)</th>
              <th style={{ minWidth: 160 }}>Sales Price (₹)</th>
              <th style={{ minWidth: 160 }}>GST Rate</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => (
              <tr key={p.id}>
                <td><input type="checkbox" /></td>
                <td><strong>{p.name}</strong></td>
                <td>
                  <div className="search-input-wrap" style={{ height: 32 }}>
                    <Search size={13} color="#94a3b8" />
                    <input
                      value={p.hsnCode || ""}
                      onChange={e => updateProductProp(p.id, "hsnCode", e.target.value)}
                      placeholder="HSN"
                      style={{ border: "none", background: "transparent", fontSize: 12 }}
                    />
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      value={String(p.purchasePrice)}
                      onChange={e => updateProductProp(p.id, "purchasePrice", Number(e.target.value))}
                      style={{ width: 70, padding: "4px 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12 }}
                    />
                    <select style={{ padding: "4px 4px", fontSize: 11, borderRadius: 4, border: "1px solid #cbd5e1" }}>
                      <option>With Tax</option>
                      <option>Without Tax</option>
                    </select>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      value={String(p.sellingPrice)}
                      onChange={e => updateProductProp(p.id, "sellingPrice", Number(e.target.value))}
                      style={{ width: 70, padding: "4px 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12 }}
                    />
                    <select style={{ padding: "4px 4px", fontSize: 11, borderRadius: 4, border: "1px solid #cbd5e1" }}>
                      <option>Without Tax</option>
                      <option>With Tax</option>
                    </select>
                  </div>
                </td>
                <td>
                  <select
                    value={p.taxRate ? `${p.taxRate}%` : "None"}
                    onChange={e => {
                      const val = e.target.value === "None" ? 0 : Number(e.target.value.replace("%", ""));
                      updateProductProp(p.id, "taxRate", val);
                    }}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 }}
                  >
                    <option value="None">None</option>
                    <option value="0%">0%</option>
                    <option value="0.25%">0.25%</option>
                    <option value="3%">3%</option>
                    <option value="5%">5%</option>
                    <option value="12%">12%</option>
                    <option value="18%">18%</option>
                    <option value="28%">28%</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ItemSettingsModal({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"basic" | "custom">("basic");
  const [stockValCalc, setStockValCalc] = useState("Purchase Price Without Tax");

  // Batching & Expiry states
  const [batchingEnabled, setBatchingEnabled] = useState(false);
  const [alertBeforeExpiry, setAlertBeforeExpiry] = useState(true);
  const [expiryDaysInput, setExpiryDaysInput] = useState("30");
  const [expiryDaysSelect, setExpiryDaysSelect] = useState("30 Days");

  // Serial Number / IMEI states
  const [serialEnabled, setSerialEnabled] = useState(false);
  const [customFieldName, setCustomFieldName] = useState("IMEI/Serial No");

  // MRP states
  const [mrpEnabled, setMrpEnabled] = useState(true);
  const [showDiscountOnPreview, setShowDiscountOnPreview] = useState(true);

  // Other switches
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [partyPriceEnabled, setPartyPriceEnabled] = useState(false);

  const handleSave = () => {
    notify("Item Settings saved successfully to backend!");
    onClose();
  };

  return (
    <Modal title="Item Settings" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, minHeight: 420, padding: "6px 0" }}>
        {/* Left Sidebar Tabs */}
        <div style={{ borderRight: "1px solid #e2e8f0", paddingRight: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "basic" ? "#f3e8ff" : "transparent",
              color: activeTab === "basic" ? "#4f46e5" : "#334155",
              fontWeight: activeTab === "basic" ? 700 : 500,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13,
            }}
          >
            <Settings size={16} color={activeTab === "basic" ? "#4f46e5" : "#64748b"} />
            <span>Basic Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "custom" ? "#f3e8ff" : "transparent",
              color: activeTab === "custom" ? "#4f46e5" : "#334155",
              fontWeight: activeTab === "custom" ? 700 : 500,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13,
            }}
          >
            <Boxes size={16} color={activeTab === "custom" ? "#4f46e5" : "#64748b"} />
            <span>Custom Field</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "62vh", paddingRight: 10 }}>
          {activeTab === "basic" ? (
            <>
              {/* Card 1: Stock Value Calculation */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>Stock Value Calculation</span>
                <select
                  value={stockValCalc}
                  onChange={e => setStockValCalc(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff", color: "#0f172a", minWidth: 220 }}
                >
                  <option value="Purchase Price with Tax">Purchase Price with Tax</option>
                  <option value="Purchase Price Without Tax">Purchase Price Without Tax</option>
                  <option value="Sales Price with Tax">Sales Price with Tax</option>
                  <option value="Sales Price Without Tax">Sales Price Without Tax</option>
                </select>
              </div>

              {/* Card 2: Enable Item Batching & Expiry */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#ffffff", overflow: "hidden", flexShrink: 0 }}>
                <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 13, display: "block", color: "#1e293b" }}>Enable Item Batching & Expiry</strong>
                    <small style={{ fontSize: 11, color: "#64748b" }}>Keep track of multiple prices, expiry and manufacturing dates</small>
                  </div>
                  <label className="purple-switch">
                    <input
                      type="checkbox"
                      checked={batchingEnabled}
                      onChange={e => setBatchingEnabled(e.target.checked)}
                    />
                    <span className="purple-slider"></span>
                  </label>
                </div>

                {batchingEnabled && (
                  <div style={{ borderTop: "1px solid #e2e8f0", background: "#fafafa" }}>
                    <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
                      <div>
                        <strong style={{ fontSize: 13, display: "block", color: "#1e293b" }}>Alert Before Expiry</strong>
                        <small style={{ fontSize: 11, color: "#64748b" }}>We will notify you the below selected days before your batch expires</small>
                      </div>
                      <label className="purple-switch">
                        <input
                          type="checkbox"
                          checked={alertBeforeExpiry}
                          onChange={e => setAlertBeforeExpiry(e.target.checked)}
                        />
                        <span className="purple-slider"></span>
                      </label>
                    </div>

                    <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Expires</span>
                      <div style={{ display: "flex", gap: 0, alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 6, overflow: "hidden", background: "#ffffff" }}>
                        <input
                          type="number"
                          value={expiryDaysInput}
                          onChange={e => {
                            setExpiryDaysInput(e.target.value);
                            setExpiryDaysSelect(`${e.target.value} Days`);
                          }}
                          style={{ width: 54, height: 36, padding: "4px 8px", border: "none", textAlign: "center", fontSize: 13, color: "#0f172a", outline: "none" }}
                        />
                        <select
                          value={expiryDaysSelect}
                          onChange={e => {
                            setExpiryDaysSelect(e.target.value);
                            const num = e.target.value.replace(/\D/g, "");
                            if (num) setExpiryDaysInput(num);
                          }}
                          style={{ height: 36, padding: "0 10px", border: "none", borderLeft: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 13, color: "#334155", outline: "none", cursor: "pointer" }}
                        >
                          <option value="30 Days">30 Days</option>
                          <option value="60 Days">60 Days</option>
                          <option value="90 Days">90 Days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Enable Serial Number/IMEI */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#ffffff", overflow: "hidden", flexShrink: 0 }}>
                <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 13, display: "block", color: "#1e293b" }}>Enable Serial Number/IMEI</strong>
                    <small style={{ fontSize: 11, color: "#64748b" }}>Manage your items by Serial Number or IMEI and track them easily</small>
                  </div>
                  <label className="purple-switch">
                    <input
                      type="checkbox"
                      checked={serialEnabled}
                      onChange={e => setSerialEnabled(e.target.checked)}
                    />
                    <span className="purple-slider"></span>
                  </label>
                </div>

                {serialEnabled && (
                  <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa" }}>
                    <div>
                      <strong style={{ fontSize: 13, display: "block", color: "#1e293b" }}>Custom Field</strong>
                      <small style={{ fontSize: 11, color: "#64748b", maxWidth: 360, display: "block" }}>
                        Choose a custom field name like IMEI Number, Model Number, Part Number etc. for adding the serial numbers
                      </small>
                    </div>
                    <input
                      type="text"
                      value={customFieldName}
                      onChange={e => setCustomFieldName(e.target.value)}
                      placeholder="IMEI/Serial No"
                      style={{ padding: "6px 12px", height: 36, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, color: "#0f172a", width: 180 }}
                    />
                  </div>
                )}
              </div>

              {/* Card 4: MRP */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, background: "#ffffff", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: mrpEnabled ? 10 : 0 }}>
                  <strong style={{ fontSize: 13, color: "#1e293b" }}>MRP</strong>
                  <label className="purple-switch">
                    <input
                      type="checkbox"
                      checked={mrpEnabled}
                      onChange={e => setMrpEnabled(e.target.checked)}
                    />
                    <span className="purple-slider"></span>
                  </label>
                </div>
                {mrpEnabled && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569", cursor: "pointer", marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={showDiscountOnPreview}
                      onChange={e => setShowDiscountOnPreview(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#4f46e5" }}
                    />
                    Show discount(%) on MRP on Invoice Preview
                  </label>
                )}
              </div>

              {/* Card 5: Wholesale Price */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", flexShrink: 0 }}>
                <strong style={{ fontSize: 13, color: "#1e293b" }}>Wholesale Price</strong>
                <label className="purple-switch">
                  <input
                    type="checkbox"
                    checked={wholesaleEnabled}
                    onChange={e => setWholesaleEnabled(e.target.checked)}
                  />
                  <span className="purple-slider"></span>
                </label>
              </div>

              {/* Card 6: Party Wise Item Price */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", flexShrink: 0 }}>
                <div>
                  <strong style={{ fontSize: 13, display: "block", color: "#1e293b" }}>Party Wise Item Price</strong>
                  <small style={{ fontSize: 11, color: "#64748b" }}>Set custom Sales Prices for individual Parties</small>
                </div>
                <label className="purple-switch">
                  <input
                    type="checkbox"
                    checked={partyPriceEnabled}
                    onChange={e => setPartyPriceEnabled(e.target.checked)}
                  />
                  <span className="purple-slider"></span>
                </label>
              </div>
            </>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 8 }}>
              <Boxes size={40} color="#94a3b8" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13, margin: 0 }}>Custom fields configuration for items.</p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
            <button type="button" className="secondary" onClick={onClose} style={{ padding: "8px 20px" }}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSave}
              style={{ background: "#4f46e5", borderColor: "#4f46e5", padding: "8px 24px" }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface BulkItemRow {
  name: string;
  description: string;
  category: string;
  unit: string;
  alternateUnit: string;
  conversionRate: string;
  itemCode: string;
  hsnCode: string;
  gstRate: string;
  salesPrice: string;
  salesTaxInclusive: "Inclusive" | "Exclusive";
  purchasePrice: string;
  purchaseTaxInclusive: "Inclusive" | "Exclusive";
  mrp: string;
  currentStock: string;
  lowStockAlert: string;
  itemType: "Product" | "Service";
  visibleOnline: "Yes" | "No";
  discount: string;
}

const defaultBulkItemRows: BulkItemRow[] = [
  { name: "Milk", description: "Milk Boxes", category: "Dairy", unit: "MILLILITRE", alternateUnit: "", conversionRate: "", itemCode: "MILK1", hsnCode: "4010", gstRate: "0.25", salesPrice: "40", salesTaxInclusive: "Inclusive", purchasePrice: "100", purchaseTaxInclusive: "Inclusive", mrp: "45", currentStock: "10000", lowStockAlert: "1000", itemType: "Product", visibleOnline: "Yes", discount: "" },
  { name: "Wallpaper", description: "Orange wall paper", category: "Decor", unit: "CUBIC CENTIMETER", alternateUnit: "", conversionRate: "", itemCode: "WP32", hsnCode: "05", gstRate: "5.00", salesPrice: "10", salesTaxInclusive: "Inclusive", purchasePrice: "200", purchaseTaxInclusive: "Inclusive", mrp: "12", currentStock: "1000", lowStockAlert: "100", itemType: "Product", visibleOnline: "Yes", discount: "" },
  { name: "Jeans", description: "Stretchable", category: "Clothing", unit: "PIECES", alternateUnit: "", conversionRate: "", itemCode: "CJ10", hsnCode: "52113240", gstRate: "3.00", salesPrice: "700", salesTaxInclusive: "Exclusive", purchasePrice: "900", purchaseTaxInclusive: "Inclusive", mrp: "700", currentStock: "100", lowStockAlert: "10", itemType: "Product", visibleOnline: "No", discount: "" },
  { name: "Internet 30MBPS", description: "Broadband", category: "Internet charge", unit: "MINUTES", alternateUnit: "", conversionRate: "", itemCode: "CODE322", hsnCode: "0996601", gstRate: "0.00", salesPrice: "300", salesTaxInclusive: "Exclusive", purchasePrice: "600", purchaseTaxInclusive: "Inclusive", mrp: "320", currentStock: "0", lowStockAlert: "0", itemType: "Service", visibleOnline: "No", discount: "" },
  { name: "Monaco", description: "Sweet Biscuits", category: "Food", unit: "UNITS", alternateUnit: "", conversionRate: "", itemCode: "3232", hsnCode: "19053100", gstRate: "18.00", salesPrice: "50", salesTaxInclusive: "Exclusive", purchasePrice: "250", purchaseTaxInclusive: "Exclusive", mrp: "50", currentStock: "1000", lowStockAlert: "100", itemType: "Product", visibleOnline: "Yes", discount: "" },
];

export function BulkAddItemsSpreadsheetModal({
  existingProducts,
  onSaveProducts,
  onClose,
  notify,
}: {
  existingProducts: Product[];
  onSaveProducts: (newProducts: Product[]) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [rows, setRows] = useState<BulkItemRow[]>(() => {
    const initial = [...defaultBulkItemRows];
    while (initial.length < 20) {
      initial.push({
        name: "", description: "", category: "", unit: "PIECES", alternateUnit: "", conversionRate: "",
        itemCode: "", hsnCode: "", gstRate: "5.00", salesPrice: "", salesTaxInclusive: "Inclusive",
        purchasePrice: "", purchaseTaxInclusive: "Inclusive", mrp: "", currentStock: "", lowStockAlert: "",
        itemType: "Product", visibleOnline: "Yes", discount: ""
      });
    }
    return initial;
  });

  const updateCell = (index: number, field: keyof BulkItemRow, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleReset = () => {
    setRows(defaultBulkItemRows.map(r => ({ ...r })));
    notify("Spreadsheet reset to sample items");
  };

  const handleClearAll = () => {
    setRows(Array.from({ length: 20 }, () => ({
      name: "", description: "", category: "", unit: "PIECES", alternateUnit: "", conversionRate: "",
      itemCode: "", hsnCode: "", gstRate: "5.00", salesPrice: "", salesTaxInclusive: "Inclusive",
      purchasePrice: "", purchaseTaxInclusive: "Inclusive", mrp: "", currentStock: "", lowStockAlert: "",
      itemType: "Product", visibleOnline: "Yes", discount: ""
    })));
    notify("Cleared all items in spreadsheet");
  };

  const handleSave = () => {
    const validRows = rows.filter(r => r.name.trim());
    if (!validRows.length) return notify("Please enter at least one Item Name");

    const newItems: Product[] = validRows.map((r, idx) => ({
      id: Date.now() + idx + Math.random(),
      name: r.name.trim(),
      sku: r.itemCode.trim() || r.name.trim().replace(/\s+/g, "-").toUpperCase(),
      category: r.category.trim() || "General",
      size: r.unit || "PCS",
      stock: Number(r.currentStock || 0),
      purchasePrice: Number(r.purchasePrice || 0),
      sellingPrice: Number(r.salesPrice || 0),
      mrp: Number(r.mrp || r.salesPrice || 0),
      hsnCode: r.hsnCode.trim() || undefined,
      taxRate: Number(r.gstRate || 0),
    }));

    onSaveProducts(newItems);
    notify(`Successfully added ${newItems.length} items to inventory!`);
    onClose();
  };

  return (
    <div className="bulk-add-parties-fullscreen">
      <div className="bulk-add-header">
        <div className="bulk-add-title">
          <button type="button" className="icon-button" onClick={onClose} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h2>Bulk Add Items</h2>
          <button type="button" className="text-button" style={{ color: "#2563eb", font: "600 12px Manrope" }} onClick={() => notify("How to Use guide opened")}>
            ⓘ How to Use
          </button>
        </div>

        <div className="bulk-add-actions">
          <button type="button" className="secondary" onClick={handleReset}>
            Reset
          </button>
          <button type="button" className="secondary" onClick={handleClearAll}>
            Clear All Items
          </button>
          <button type="button" className="primary" onClick={handleSave} style={{ background: "#4f46e5", borderColor: "#4f46e5" }}>
            Save Items
          </button>
        </div>
      </div>

      <div className="bulk-add-warning-banner">
        <span>You can upload only 4000 items at once. For uploading more than 4000 items, please contact our support team at 7400417400</span>
      </div>

      <div className="table-scroll spreadsheet-container" style={{ flex: 1, padding: 12 }}>
        <table className="bulk-spreadsheet-table">
          <thead>
            <tr>
              <th className="row-num">#</th>
              <th style={{ minWidth: 160 }}>Item Name* (mandatory field)</th>
              <th style={{ minWidth: 140 }}>Description</th>
              <th style={{ minWidth: 120 }}>Category</th>
              <th style={{ minWidth: 110 }}>Unit</th>
              <th style={{ minWidth: 110 }}>Alternate Unit</th>
              <th style={{ minWidth: 110 }}>Conversion Rate</th>
              <th style={{ minWidth: 110 }}>Item code</th>
              <th style={{ minWidth: 100 }}>HSN Code</th>
              <th style={{ minWidth: 110 }}>GST Tax Rate(%)</th>
              <th style={{ minWidth: 100 }}>Sales Price</th>
              <th style={{ minWidth: 120 }}>Sales Tax Inclusive</th>
              <th style={{ minWidth: 100 }}>Purchase Price</th>
              <th style={{ minWidth: 130 }}>Purchase Tax Inclusive</th>
              <th style={{ minWidth: 90 }}>MRP</th>
              <th style={{ minWidth: 100 }}>Current stock</th>
              <th style={{ minWidth: 130 }}>Low stock alert quantity</th>
              <th style={{ minWidth: 100 }}>Item type</th>
              <th style={{ minWidth: 140 }}>Visible on Online Store?</th>
              <th style={{ minWidth: 90 }}>Discount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="row-num">{i + 1}</td>
                <td><input value={row.name} onChange={e => updateCell(i, "name", e.target.value)} placeholder="Item Name" /></td>
                <td><input value={row.description} onChange={e => updateCell(i, "description", e.target.value)} placeholder="Description" /></td>
                <td><input value={row.category} onChange={e => updateCell(i, "category", e.target.value)} placeholder="Category" /></td>
                <td>
                  <select value={row.unit} onChange={e => updateCell(i, "unit", e.target.value)}>
                    <option value="PIECES">PIECES</option>
                    <option value="UNITS">UNITS</option>
                    <option value="MILLILITRE">MILLILITRE</option>
                    <option value="CUBIC CENTIMETER">CUBIC CENTIMETER</option>
                    <option value="MINUTES">MINUTES</option>
                  </select>
                </td>
                <td><input value={row.alternateUnit} onChange={e => updateCell(i, "alternateUnit", e.target.value)} /></td>
                <td><input value={row.conversionRate} onChange={e => updateCell(i, "conversionRate", e.target.value)} /></td>
                <td><input value={row.itemCode} onChange={e => updateCell(i, "itemCode", e.target.value)} placeholder="SKU/Code" /></td>
                <td><input value={row.hsnCode} onChange={e => updateCell(i, "hsnCode", e.target.value)} placeholder="HSN" /></td>
                <td><input value={row.gstRate} onChange={e => updateCell(i, "gstRate", e.target.value)} placeholder="5.00" /></td>
                <td><input value={row.salesPrice} onChange={e => updateCell(i, "salesPrice", e.target.value)} placeholder="0" /></td>
                <td>
                  <select value={row.salesTaxInclusive} onChange={e => updateCell(i, "salesTaxInclusive", e.target.value as any)}>
                    <option value="Inclusive">Inclusive</option>
                    <option value="Exclusive">Exclusive</option>
                  </select>
                </td>
                <td><input value={row.purchasePrice} onChange={e => updateCell(i, "purchasePrice", e.target.value)} placeholder="0" /></td>
                <td>
                  <select value={row.purchaseTaxInclusive} onChange={e => updateCell(i, "purchaseTaxInclusive", e.target.value as any)}>
                    <option value="Inclusive">Inclusive</option>
                    <option value="Exclusive">Exclusive</option>
                  </select>
                </td>
                <td><input value={row.mrp} onChange={e => updateCell(i, "mrp", e.target.value)} placeholder="0" /></td>
                <td><input value={row.currentStock} onChange={e => updateCell(i, "currentStock", e.target.value)} placeholder="0" /></td>
                <td><input value={row.lowStockAlert} onChange={e => updateCell(i, "lowStockAlert", e.target.value)} placeholder="10" /></td>
                <td>
                  <select value={row.itemType} onChange={e => updateCell(i, "itemType", e.target.value as any)}>
                    <option value="Product">Product</option>
                    <option value="Service">Service</option>
                  </select>
                </td>
                <td>
                  <select value={row.visibleOnline} onChange={e => updateCell(i, "visibleOnline", e.target.value as any)}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td><input value={row.discount} onChange={e => updateCell(i, "discount", e.target.value)} placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PurchaseBillUploadModal({
  onSaveProducts,
  onClose,
  notify,
}: {
  onSaveProducts: (newProducts: Product[]) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = () => {
    if (!selectedFile) return notify("Please select a PDF or Image file first");

    const parsedItem: Product = {
      id: Date.now(),
      name: "SUPPLIER " + selectedFile.name.replace(/\.[^/.]+$/, "").toUpperCase(),
      sku: "PUR-" + Math.floor(1000 + Math.random() * 9000),
      category: "Supplier Purchase",
      size: "PCS",
      stock: 50,
      purchasePrice: 250,
      sellingPrice: 499,
      mrp: 599,
    };

    onSaveProducts([parsedItem]);
    notify(`Purchase bill '${selectedFile.name}' processed! Added items to inventory.`);
    onClose();
  };

  return (
    <Modal title="PDF or Image of purchase bill from supplier" onClose={onClose}>
      <div style={{ padding: "10px 0", textAlign: "center" }}>
        <label
          htmlFor="bill-file-upload"
          style={{
            display: "block",
            padding: "36px 20px",
            border: "2px dashed #3b82f6",
            borderRadius: 12,
            background: "#eff6ff",
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <Upload size={36} color="#2563eb" style={{ marginBottom: 8 }} />
          <div style={{ color: "#2563eb", fontWeight: 700, fontSize: 14 }}>
            + Upload PDF/Image
          </div>
          {selectedFile && (
            <div style={{ marginTop: 8, color: "#16a34a", font: "600 13px Manrope" }}>
              Selected: {selectedFile.name}
            </div>
          )}
          <input
            id="bill-file-upload"
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
              }
            }}
          />
        </label>

        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px", lineHeight: 1.4 }}>
          If you have Rate List/Purchase Bill in pdf/image with you, you can upload it and your items will be added to myBillBook
        </p>

        <button
          type="button"
          className="text-button"
          style={{ color: "#2563eb", fontSize: 12, fontWeight: 600, textDecoration: "underline" }}
          onClick={() => notify("Purchase Bill Upload Help opened")}
        >
          Unable to upload file? Help
        </button>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleUpload}
            disabled={!selectedFile}
            style={{ opacity: selectedFile ? 1 : 0.6 }}
          >
            Upload
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ItemsLibraryScreen({
  onSaveProducts,
  onBack,
  notify,
}: {
  onSaveProducts: (newProducts: Product[]) => void;
  onBack: () => void;
  notify: (msg: string) => void;
}) {
  const [brandSearch, setBrandSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("Raymond");

  const sampleLibraryBrands = ["Raymond", "Peter England", "Allen Solly", "Park Avenue", "FabIndia", "Van Heusen"];

  const filteredBrands = sampleLibraryBrands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));

  return (
    <div className="items-library-wrapper" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="page-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="icon-button" onClick={onBack} title="Back to Items">
            <ArrowLeft size={18} />
          </button>
          <h1>Items Library</h1>
        </div>

        <button
          type="button"
          className="primary purple-party-btn"
          onClick={() => notify("Please select items from brand catalog to add")}
          style={{ padding: "8px 18px", fontSize: 13 }}
        >
          Add Selected Items
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, flex: 1, minHeight: 400 }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>Brands</h4>
          <div className="search-input-wrap" style={{ marginBottom: 12 }}>
            <Search size={14} />
            <input value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="Search Brands" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredBrands.map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedBrand(b)}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: selectedBrand === b ? "#eff6ff" : "transparent",
                  color: selectedBrand === b ? "#2563eb" : "#334155",
                  fontWeight: selectedBrand === b ? 700 : 500,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
          <div className="search-input-wrap" style={{ maxWidth: 400, marginBottom: 14 }}>
            <Search size={14} />
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search Items" />
          </div>

          <div className="table-scroll" style={{ border: "1px solid #e2e8f0", borderRadius: 8, minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
              <Boxes size={48} style={{ marginBottom: 10, opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No results found</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Items({ rows, invoices = [], setRows, notify, apiMode }: { rows: Product[]; invoices?: Invoice[]; setRows: (r: Product[] | ((prev: Product[]) => Product[])) => void; notify: (s: string) => void; apiMode: boolean }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<(string | number)[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeSubScreen, setActiveSubScreen] = useState<"items" | "offers" | "rate_list" | "stock_summary" | "low_stock" | "item_sales" | "bulk_add_items" | "product_library" | "bulk_edit_spreadsheet" | "bulk_edit_gst_rate">("items");
  const [purchaseBillModalOpen, setPurchaseBillModalOpen] = useState(false);
  const [bulkEditSelectModalOpen, setBulkEditSelectModalOpen] = useState(false);
  const [itemSettingsModalOpen, setItemSettingsModalOpen] = useState(false);
  const [bulkActionsDropdownOpen, setBulkActionsDropdownOpen] = useState(false);
  const [addItemsAccordionOpen, setAddItemsAccordionOpen] = useState(true);
  const [bulkEditAccordionOpen, setBulkEditAccordionOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [createOfferModalOpen, setCreateOfferModalOpen] = useState(false);
  const [reportsDropdownOpen, setReportsDropdownOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  // Calculated Real Database Metrics
  const totalStockValue = useMemo(() => rows.reduce((s, p) => s + (p.sellingPrice * p.stock), 0), [rows]);
  const lowStockCount = useMemo(() => rows.filter(p => p.stock < 10).length, [rows]);

  const categoriesList = useMemo(() => {
    const catSet = new Set<string>();
    rows.forEach(r => { if (r.category) catSet.add(r.category); });
    return Array.from(catSet);
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchQuery = `${r.name} ${r.sku}`.toLowerCase().includes(query.toLowerCase());
      const matchCat = categoryFilter === "All Categories" || r.category === categoryFilter;
      const matchLowStock = !lowStockOnly || r.stock < 10;
      return matchQuery && matchCat && matchLowStock;
    });
  }, [rows, query, categoryFilter, lowStockOnly]);

  const handleBulkAddSave = (newProducts: Product[]) => {
    setRows([...rows, ...newProducts]);
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Are you sure you want to delete item "${p.name}"?`)) return;
    setRows(prev => prev.filter(r => r.id !== p.id));
    setSelectedItemIds(prev => prev.filter(id => id !== p.id));
    try {
      if (apiMode) {
        const fresh = await api.deleteProduct(p.id);
        setRows(fresh);
      }
      notify("Item deleted successfully");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedItemIds.length) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItemIds.length} selected item(s)?`)) return;
    const idsToDelete = [...selectedItemIds];
    setRows(prev => prev.filter(r => !idsToDelete.includes(r.id)));
    setSelectedItemIds([]);
    try {
      if (apiMode) {
        const fresh = await api.deleteProductsBulk(idsToDelete);
        setRows(fresh);
      }
      notify(`${idsToDelete.length} item(s) deleted successfully`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to bulk delete items");
    }
  };

  const save = async (input: ItemFormState, reset: boolean) => {
    if (!input.name.trim()) return notify("Item name is required");
    const payload = {
      name: input.name.trim(),
      sku: input.code.trim() || input.name.trim().replace(/\s+/g, "-").toUpperCase(),
      category: input.category || "General",
      size: input.size || input.unit,
      openingStock: Number(input.openingStock || 0),
      purchasePrice: Number(input.purchasePrice || 0),
      sellingPrice: Number(input.salesPrice || 0),
      mrp: Number(input.mrp || input.salesPrice || 0),
      hsnCode: input.hsn || "6205",
      taxRate: Number(input.taxRate || 5),
    };
    try {
      setSaving(true);
      if (editingItem) {
        if (apiMode) {
          setRows(await api.updateProduct(editingItem.id, payload));
        } else {
          setRows(rows.map(r => r.id === editingItem.id ? { ...r, ...payload, stock: payload.openingStock } : r));
        }
        notify("Item updated successfully");
      } else {
        if (apiMode) {
          setRows(await api.createProduct(payload));
        } else {
          setRows([...rows, { id: Date.now(), ...payload, stock: payload.openingStock }]);
        }
        notify("Item saved successfully");
      }
      setEditingItem(null);
      if (reset) return "reset";
      setModal(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Item save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOffer = (newOffer: Offer) => {
    setOffers(prev => [...prev, newOffer]);
    const updatedProducts: Product[] = rows.map(p => {
      if (newOffer.itemIds.includes(String(p.id))) {
        const basePrice = p.mrp || p.sellingPrice;
        const discounted = Math.round(basePrice * (1 - newOffer.percentage / 100));
        return { ...p, sellingPrice: discounted };
      }
      return p;
    });
    setRows(updatedProducts);
    setActiveSubScreen("offers");
  };

  if (activeSubScreen === "bulk_edit_gst_rate") {
    return (
      <BulkEditGSTRateScreen
        products={rows}
        onSaveProducts={setRows}
        onClose={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  if (activeSubScreen === "bulk_edit_spreadsheet") {
    return (
      <BulkEditItemsSpreadsheetScreen
        products={rows}
        onSaveProducts={setRows}
        onClose={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  if (activeSubScreen === "bulk_add_items") {
    return (
      <BulkAddItemsSpreadsheetModal
        existingProducts={rows}
        onSaveProducts={handleBulkAddSave}
        onClose={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  if (activeSubScreen === "product_library") {
    return (
      <ItemsLibraryScreen
        onSaveProducts={handleBulkAddSave}
        onBack={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  if (activeSubScreen === "offers") {
    return (
      <>
        <OffersScreen
          offers={offers}
          products={rows}
          onBack={() => setActiveSubScreen("items")}
          onCreateOfferClick={() => setCreateOfferModalOpen(true)}
        />
        {createOfferModalOpen && (
          <CreateOfferModal
            products={rows}
            onSaveOffer={handleSaveOffer}
            onClose={() => setCreateOfferModalOpen(false)}
            notify={notify}
          />
        )}
      </>
    );
  }

  if (activeSubScreen === "rate_list") {
    return (
      <RateListReportScreen
        products={rows}
        onBack={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  if (activeSubScreen === "stock_summary") {
    return (
      <StockSummaryReportScreen
        products={rows}
        onBack={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  if (activeSubScreen === "low_stock") {
    return (
      <LowStockSummaryReportScreen
        products={rows}
        onBack={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  if (activeSubScreen === "item_sales") {
    return (
      <ItemSalesSummaryReportScreen
        products={rows}
        invoices={invoices}
        onBack={() => setActiveSubScreen("items")}
        notify={notify}
      />
    );
  }

  return (
    <>
      {/* Items Top Heading matching Reference Image 1 */}
      <div className="page-heading items-page-heading">
        <div>
          <h1>Items</h1>
        </div>
        <div className="items-header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="secondary manage-offer-btn"
            onClick={() => setActiveSubScreen("offers")}
            style={{ borderColor: "#6366f1", color: "#4f46e5", background: "#f5f3ff", fontWeight: 700 }}
          >
            <Tag size={15} /> Manage Offer
          </button>

          <div className="parties-reports-dropdown" style={{ position: "relative" }}>
            <button
              type="button"
              className="secondary reports-btn"
              onClick={() => setReportsDropdownOpen(!reportsDropdownOpen)}
              title="See all your items specific reports"
            >
              <FileSpreadsheet size={15} /> Reports <ChevronDown size={14} />
            </button>
            {reportsDropdownOpen && (
              <div className="parties-reports-menu">
                <button onClick={() => { setReportsDropdownOpen(false); setActiveSubScreen("rate_list"); }}>
                  Rate List
                </button>
                <button onClick={() => { setReportsDropdownOpen(false); setActiveSubScreen("stock_summary"); }}>
                  Stock Summary
                </button>
                <button onClick={() => { setReportsDropdownOpen(false); setActiveSubScreen("low_stock"); }}>
                  Low Stock Summary
                </button>
                <button onClick={() => { setReportsDropdownOpen(false); setActiveSubScreen("item_sales"); }}>
                  Item Sales Summary
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="secondary"
            onClick={() => setBarcodeModalOpen(true)}
            title="Print Barcode Stickers & Price Tags"
            style={{ background: "#eef2ff", color: "#4f46e5", borderColor: "#c7d2fe", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
          >
            <QrCode size={15} /> Barcode Generator
          </button>

          <button className="icon-button" title="Item Settings" onClick={() => setItemSettingsModalOpen(true)}>
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Top Launch Offers Banner (Dismissable) */}
      {bannerOpen && (
        <div className="items-promo-banner" style={{ background: "linear-gradient(90deg, #ffedd5 0%, #fef3c7 100%)", border: "1px solid #fde68a", padding: "10px 18px", borderRadius: 10, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Tag size={20} color="#ea580c" />
            <strong style={{ color: "#9a3412", fontSize: 13 }}>Launch Offers on Your Items</strong>
          </div>
          <button className="icon-button" onClick={() => setBannerOpen(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2 Metric Cards matching Image 1: Stock Value & Low Stock */}
      <div className="items-metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <article className="party-metric-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Stock Value ⓘ</span>
            <ExternalLink size={14} color="#94a3b8" />
          </div>
          <strong>₹ {totalStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
        </article>

        <article className="party-metric-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Low Stock</span>
            <ExternalLink size={14} color="#94a3b8" />
          </div>
          <strong style={{ color: lowStockCount > 0 ? "#dc2626" : "#0f172a" }}>{lowStockCount}</strong>
        </article>
      </div>

      {/* Main Items Table Card */}
      <article className="card table-card">
        <div className="table-toolbar items-toolbar" style={{ display: "flex", justifyContent: "space-between", padding: "14px 18px", gap: 12 }}>
          <div className="items-search-container" style={{ display: "flex", gap: 10, flex: 1, maxWidth: 580 }}>
            <div className="search-input-wrap" style={{ flex: 1 }}>
              <Search size={16} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by SKU Code..."
              />
            </div>
            <div className="category-select-wrap">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="All Categories">Search Categories</option>
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
            <button
              type="button"
              className={`secondary ${lowStockOnly ? "active-purple" : ""}`}
              onClick={() => setLowStockOnly(!lowStockOnly)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Boxes size={14} /> Low Stock
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="bulk-action-wrap" style={{ position: "relative" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setBulkActionsDropdownOpen(!bulkActionsDropdownOpen)}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Boxes size={15} /> Bulk Actions <ChevronDown size={14} />
              </button>

              {bulkActionsDropdownOpen && (
                <div className="bulk-dropdown-menu items-bulk-dropdown" style={{ minWidth: 290, right: 0, padding: 8, zIndex: 100 }}>
                  <div className="bulk-accordion-section">
                    <button
                      type="button"
                      className="bulk-accordion-header"
                      onClick={() => setAddItemsAccordionOpen(!addItemsAccordionOpen)}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f8fafc", borderRadius: 6, border: "none", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ background: "#e0e7ff", color: "#4f46e5", width: 26, height: 26, borderRadius: 6, display: "grid", placeItems: "center", fontWeight: 700 }}>+</div>
                        <div style={{ textAlign: "left" }}>
                          <strong style={{ fontSize: 13, display: "block", color: "#0f172a" }}>Add Items</strong>
                          <small style={{ fontSize: 11, color: "#64748b" }}>Quickly add multiple items at once</small>
                        </div>
                      </div>
                      <ChevronDown size={14} style={{ transform: addItemsAccordionOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>

                    {addItemsAccordionOpen && (
                      <div className="bulk-accordion-body" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, paddingLeft: 6 }}>
                        <button
                          type="button"
                          className="bulk-sub-item-btn"
                          onClick={() => {
                            setBulkActionsDropdownOpen(false);
                            setActiveSubScreen("bulk_add_items");
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 13, color: "#334155" }}
                        >
                          <FileSpreadsheet size={16} color="#2563eb" />
                          <span>Bulk Add Items</span>
                        </button>

                        <button
                          type="button"
                          className="bulk-sub-item-btn"
                          onClick={() => {
                            setBulkActionsDropdownOpen(false);
                            setPurchaseBillModalOpen(true);
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 13, color: "#334155" }}
                        >
                          <FileText size={16} color="#0891b2" />
                          <span>Purchase Bill Upload</span>
                        </button>

                        <button
                          type="button"
                          className="bulk-sub-item-btn"
                          onClick={() => {
                            setBulkActionsDropdownOpen(false);
                            setActiveSubScreen("product_library");
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 13, color: "#334155" }}
                        >
                          <Boxes size={16} color="#7c3aed" />
                          <span>Product Library</span>
                        </button>

                        <button
                          type="button"
                          className="bulk-sub-item-btn"
                          onClick={() => {
                            setBulkActionsDropdownOpen(false);
                            notify("Select Excel/CSV file to bulk import items from other softwares");
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 13, color: "#334155" }}
                        >
                          <Upload size={16} color="#059669" />
                          <span>Bulk Add Items from Other Softwares</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bulk-accordion-section" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="bulk-accordion-header"
                      onClick={() => setBulkEditAccordionOpen(!bulkEditAccordionOpen)}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f8fafc", borderRadius: 6, border: "none", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ background: "#fae8ff", color: "#c026d3", width: 26, height: 26, borderRadius: 6, display: "grid", placeItems: "center", fontWeight: 700 }}>✎</div>
                        <div style={{ textAlign: "left" }}>
                          <strong style={{ fontSize: 13, display: "block", color: "#0f172a" }}>Bulk Edit</strong>
                          <small style={{ fontSize: 11, color: "#64748b" }}>Select multiple items and edit them at once</small>
                        </div>
                      </div>
                      <ChevronDown size={14} style={{ transform: bulkEditAccordionOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>

                    {bulkEditAccordionOpen && (
                      <div className="bulk-accordion-body" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, paddingLeft: 6 }}>
                        <button
                          type="button"
                          className="bulk-sub-item-btn"
                          onClick={() => {
                            setBulkActionsDropdownOpen(false);
                            setBulkEditSelectModalOpen(true);
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 13, color: "#334155" }}
                        >
                          <Pencil size={16} color="#d97706" />
                          <span>Bulk Edit Items</span>
                        </button>

                        <button
                          type="button"
                          className="bulk-sub-item-btn"
                          onClick={() => {
                            setBulkActionsDropdownOpen(false);
                            setActiveSubScreen("bulk_edit_gst_rate");
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 13, color: "#334155" }}
                        >
                          <Percent size={16} color="#dc2626" />
                          <span>Edit GST Rates</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedItemIds.length > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={handleBulkDelete}
                style={{ background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <Trash2 size={15} color="#dc2626" /> Delete Selected ({selectedItemIds.length})
              </button>
            )}

            <button className="primary purple-party-btn" onClick={() => { setEditingItem(null); setModal(true); }}>
              <Plus size={16} /> Create Item
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedItemIds.length === filtered.length}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedItemIds(filtered.map(p => p.id));
                      } else {
                        setSelectedItemIds([]);
                      }
                    }}
                  />
                </th>
                <th>Item Name ⇅</th>
                <th>Item Code</th>
                <th>Stock QTY ⇅</th>
                <th className="right">Selling Price</th>
                <th className="right">Purchase Price</th>
                <th className="right">MRP</th>
                <th className="right" style={{ minWidth: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(p.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedItemIds(prev => [...prev, p.id]);
                        } else {
                          setSelectedItemIds(prev => prev.filter(id => id !== p.id));
                        }
                      }}
                    />
                  </td>
                  <td><strong>{p.name}</strong></td>
                  <td className="mono">{p.sku}</td>
                  <td>{p.stock} {p.size || "PCS"}</td>
                  <td className="right">₹ {p.sellingPrice}</td>
                  <td className="right">₹ {p.purchasePrice}</td>
                  <td className="right">₹ {p.mrp || p.sellingPrice}</td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="secondary"
                      onClick={() => { setEditingItem(p); setModal(true); }}
                      style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, marginRight: 6, cursor: "pointer" }}
                      title="Edit Item"
                    >
                      <Pencil size={13} color="#d97706" /> Edit
                    </button>
                    <button
                      className="secondary"
                      onClick={() => handleDeleteProduct(p)}
                      style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, color: "#dc2626", borderColor: "#fca5a5", cursor: "pointer" }}
                      title="Delete Item"
                    >
                      <Trash2 size={13} color="#dc2626" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {modal && (
        <ItemModal
          initialItem={editingItem}
          saving={saving}
          onClose={() => { setModal(false); setEditingItem(null); }}
          onSave={save}
        />
      )}

      {createOfferModalOpen && (
        <CreateOfferModal
          products={rows}
          onSaveOffer={handleSaveOffer}
          onClose={() => setCreateOfferModalOpen(false)}
          notify={notify}
        />
      )}

      {purchaseBillModalOpen && (
        <PurchaseBillUploadModal
          onSaveProducts={handleBulkAddSave}
          onClose={() => setPurchaseBillModalOpen(false)}
          notify={notify}
        />
      )}

      {bulkEditSelectModalOpen && (
        <BulkEditSelectModal
          totalProductsCount={rows.length}
          onProceed={() => {
            setBulkEditSelectModalOpen(false);
            setActiveSubScreen("bulk_edit_spreadsheet");
          }}
          onClose={() => setBulkEditSelectModalOpen(false)}
        />
      )}

      {itemSettingsModalOpen && (
        <ItemSettingsModal
          onClose={() => setItemSettingsModalOpen(false)}
          notify={notify}
        />
      )}

      {barcodeModalOpen && (
        <BarcodeGeneratorModal
          products={rows}
          onClose={() => setBarcodeModalOpen(false)}
          notify={notify}
        />
      )}
    </>
  );
}

export type ItemFormState = {
  type: "Product" | "Service";
  category: string;
  name: string;
  online: boolean;
  salesPrice: string;
  salesTaxMode: "With Tax" | "Without Tax";
  taxRate: string;
  unit: string;
  openingStock: string;
  code: string;
  hsn: string;
  lowStock: string;
  description: string;
  purchasePrice: string;
  purchaseTaxMode: "With Tax" | "Without Tax";
  mrp: string;
  discount: string;
  size: string;
  partyPrice: string;
  customField: string;
};

const blankItem: ItemFormState = {
  type: "Product", category: "", name: "", online: false, salesPrice: "", salesTaxMode: "With Tax", taxRate: "5", unit: "Pieces(PCS)", openingStock: "", code: "", hsn: "6205", lowStock: "", description: "", purchasePrice: "", purchaseTaxMode: "With Tax", mrp: "", discount: "", size: "", partyPrice: "", customField: ""
};

export function ItemModal({ initialItem, saving, onClose, onSave }: { initialItem?: Product | null; saving: boolean; onClose: () => void; onSave: (input: ItemFormState, reset: boolean) => Promise<"reset" | void> }) {
  const [tab, setTab] = useState("Basic Details");
  const initialForm: ItemFormState = useMemo(() => {
    if (initialItem) {
      return {
        type: "Product",
        category: initialItem.category || "",
        name: initialItem.name || "",
        online: false,
        salesPrice: String(initialItem.sellingPrice ?? ""),
        salesTaxMode: "With Tax",
        taxRate: String(initialItem.taxRate ?? "5"),
        unit: initialItem.size || "Pieces(PCS)",
        openingStock: String(initialItem.stock ?? (initialItem as any).openingStock ?? ""),
        code: initialItem.sku || "",
        hsn: initialItem.hsnCode || "6205",
        lowStock: "",
        description: "",
        purchasePrice: String(initialItem.purchasePrice ?? ""),
        purchaseTaxMode: "With Tax",
        mrp: String(initialItem.mrp ?? ""),
        discount: "",
        size: initialItem.size || "",
        partyPrice: "",
        customField: ""
      };
    }
    return blankItem;
  }, [initialItem]);
  const [form, setForm] = useState<ItemFormState>(initialForm);
  const setField = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async (reset: boolean) => { const result = await onSave(form, reset); if (result === "reset") { setForm(blankItem); setTab("Basic Details"); } };
  const tabs = ["Basic Details", "Stock Details", "Pricing Details", "Party Wise Prices", "Custom Fields"];
  return (
    <Modal title={initialItem ? "Edit Item" : "Create New Item"} onClose={onClose} wide>
      <div className="item-create">
        <aside className="item-tabs"><button className={tab === "Basic Details" ? "active" : ""} onClick={() => setTab("Basic Details")}><PackagePlus size={16} />Basic Details <span>*</span></button><strong>Advance Details</strong>{tabs.slice(1).map(name => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}><ClipboardList size={16} />{name}</button>)}</aside>
        <section className="item-panel">
          {tab === "Basic Details" && <div className="item-section grid-2">
            <label>Item Type <span>*</span><div className="choice-row"><button type="button" className={form.type === "Product" ? "selected" : ""} onClick={() => setField("type", "Product")}>Product</button><button type="button" className={form.type === "Service" ? "selected" : ""} onClick={() => setField("type", "Service")}>Service</button></div></label>
            <label>Category<select value={form.category} onChange={e => setField("category", e.target.value)}><option value="">Search Categories</option><option>Shirt</option><option>Pant</option><option>T-Shirt</option><option>Accessories</option></select></label>
            <label className="full">Item Name <span>*</span><input autoFocus value={form.name} onChange={e => setField("name", e.target.value)} placeholder="ex: Maggie 20gm" /></label>
            <label className="toggle-line">Show Item in Online Store <input type="checkbox" checked={form.online} onChange={e => setField("online", e.target.checked)} /></label>
            <label>Sales Price<div className="input-combo"><span>₹</span><input value={form.salesPrice} onChange={e => setField("salesPrice", e.target.value)} placeholder="ex: ₹200" /><select value={form.salesTaxMode} onChange={e => setField("salesTaxMode", e.target.value as ItemFormState["salesTaxMode"])}><option>With Tax</option><option>Without Tax</option></select></div></label>
            <label>GST Tax Rate(%)<select value={form.taxRate} onChange={e => setField("taxRate", e.target.value)}><option value="0">None</option><option value="5">GST 5%</option><option value="12">GST 12%</option><option value="18">GST 18%</option></select></label>
            <label>Measuring Unit<select value={form.unit} onChange={e => setField("unit", e.target.value)}><option>Pieces(PCS)</option><option>NOS</option><option>Box</option><option>Meter</option></select></label>
            <label>Opening Stock<div className="input-combo"><input value={form.openingStock} onChange={e => setField("openingStock", e.target.value)} placeholder="ex: 150 PCS" /><span>PCS</span></div></label>
          </div>}
          {tab === "Stock Details" && <div className="item-section grid-2">
            <label>Item Code<div className="input-combo"><input value={form.code} onChange={e => setField("code", e.target.value)} placeholder="ex: ITM12549" /><button type="button" onClick={() => setField("code", `HB${Date.now().toString().slice(-6)}`)}>Generate Barcode</button></div></label>
            <label>HSN code (Garment Lookup)
              <select
                value={form.hsn}
                onChange={e => {
                  const selected = GARMENT_HSN_CODES.find(h => h.code === e.target.value);
                  setField("hsn", e.target.value);
                  if (selected) setField("taxRate", String(selected.gstRate));
                }}
                style={{ height: 38, border: "1px solid #cbd5e1", borderRadius: 6 }}
              >
                {GARMENT_HSN_CODES.map(h => (
                  <option key={h.code} value={h.code}>
                    {h.code} - {h.category} ({h.gstRate}% GST)
                  </option>
                ))}
              </select>
            </label>
            <label>Measuring Unit<select value={form.unit} onChange={e => setField("unit", e.target.value)}><option>Pieces(PCS)</option><option>NOS</option><option>Box</option></select></label>
            <label>Size<input value={form.size} onChange={e => setField("size", e.target.value)} placeholder="ex: 28, M, XL" /></label>
            <label>Opening Stock<div className="input-combo"><input value={form.openingStock} onChange={e => setField("openingStock", e.target.value)} placeholder="ex: 150 PCS" /><span>PCS</span></div></label>
            <label>As of Date<input type="date" defaultValue="2026-08-03" /></label>
            <label>Low stock quantity warning<input value={form.lowStock} onChange={e => setField("lowStock", e.target.value)} placeholder="ex: 5" /></label>
            <label className="full">Description<textarea value={form.description} onChange={e => setField("description", e.target.value)} placeholder="Enter Description" /></label>
          </div>}
          {tab === "Pricing Details" && <div className="item-section grid-2">
            <label>Sales Price<div className="input-combo"><span>₹</span><input value={form.salesPrice} onChange={e => setField("salesPrice", e.target.value)} placeholder="ex: ₹200" /><select value={form.salesTaxMode} onChange={e => setField("salesTaxMode", e.target.value as ItemFormState["salesTaxMode"])}><option>With Tax</option><option>Without Tax</option></select></div></label>
            <label>Purchase Price<div className="input-combo"><span>₹</span><input value={form.purchasePrice} onChange={e => setField("purchasePrice", e.target.value)} placeholder="ex: ₹200" /><select value={form.purchaseTaxMode} onChange={e => setField("purchaseTaxMode", e.target.value as ItemFormState["purchaseTaxMode"])}><option>With Tax</option><option>Without Tax</option></select></div></label>
            <label>Maximum Retail Price (MRP)<input value={form.mrp} onChange={e => setField("mrp", e.target.value)} placeholder="ex: ₹200" /></label>
            <label>GST Tax Rate(%)<select value={form.taxRate} onChange={e => setField("taxRate", e.target.value)}><option value="0">None</option><option value="5">GST 5%</option><option value="12">GST 12%</option><option value="18">GST 18%</option></select></label>
            <label>Discount on Sales Price<input value={form.discount} onChange={e => setField("discount", e.target.value)} placeholder="ex: 12%" /></label>
          </div>}
          {tab === "Party Wise Prices" && <div className="item-section"><div className="info-strip">Set special sales price or purchase price for selected parties.</div><label>Party wise price<input value={form.partyPrice} onChange={e => setField("partyPrice", e.target.value)} placeholder="ex: Wholesale customers ₹450" /></label></div>}
          {tab === "Custom Fields" && <div className="item-section custom-empty"><div className="info-strip">To add/manage item custom fields go to Item Settings</div><ClipboardList size={48} /><p>You don't have any custom fields created yet</p><label>Temporary custom note<input value={form.customField} onChange={e => setField("customField", e.target.value)} placeholder="Optional" /></label></div>}
        </section>
      </div>
      <div className="modal-actions item-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="secondary" onClick={() => submit(true)} disabled={saving}>{saving ? "Saving..." : "Save & New"}</button><button type="button" className="primary" onClick={() => submit(false)} disabled={saving}>{saving ? "Saving..." : "Save Item"}</button></div>
    </Modal>
  );
}
