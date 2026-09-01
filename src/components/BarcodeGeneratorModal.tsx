import React, { useState } from "react";
import { Printer, X, Search, Tag } from "lucide-react";
import type { Product } from "../types";

export function BarcodeGeneratorModal({
  products,
  onClose,
  notify,
}: {
  products: Product[];
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);

  // Custom Tag Input State for Mode B
  const [storeName, setStoreName] = useState("HAPPY BONDING");
  const [tagTitle, setTagTitle] = useState("Classic Cotton Shirt");
  const [sku, setSku] = useState("HB-SH-M-01");
  const [size, setSize] = useState("L");
  const [mrp, setMrp] = useState("1299");
  const [price, setPrice] = useState("999");
  const [quantity, setQuantity] = useState(10);

  const matchedProducts = products.filter(p =>
    `${p.name} ${p.sku} ${p.size} ${p.category}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 15);

  const handlePrintTags = () => {
    window.print();
    notify("Sent tags to printer!");
  };

  const tagStore = storeName || "HAPPY BONDING";
  const tagItemTitle = mode === "auto" && selectedProduct ? selectedProduct.name : tagTitle;
  const tagSku = mode === "auto" && selectedProduct ? selectedProduct.sku : sku;
  const tagSize = mode === "auto" && selectedProduct ? selectedProduct.size : size;
  const tagMrp = mode === "auto" && selectedProduct ? selectedProduct.mrp : Number(mrp || 0);
  const tagPrice = mode === "auto" && selectedProduct ? selectedProduct.sellingPrice : Number(price || 0);

  return (
    <div className="modal-backdrop bank-select-backdrop" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: 820,
          maxHeight: "90vh",
          borderRadius: 12,
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <Tag size={20} color="#4f46e5" /> Garment Barcode Sticker & Price Tag Generator
            </h2>
            <small style={{ color: "#64748b" }}>Generate & print garment stickers for shirts, pants, t-shirts</small>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", flex: 1, overflowY: "auto" }}>
          {/* Left Form Controls */}
          <div style={{ padding: 20, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Mode Switcher Buttons */}
            <div style={{ display: "flex", gap: 8, background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setMode("auto")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: 0,
                  fontWeight: 700,
                  fontSize: 12,
                  background: mode === "auto" ? "#4f46e5" : "transparent",
                  color: mode === "auto" ? "#fff" : "#475569",
                  cursor: "pointer",
                }}
              >
                📦 Auto-Pick from Inventory
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: 0,
                  fontWeight: 700,
                  fontSize: 12,
                  background: mode === "manual" ? "#4f46e5" : "transparent",
                  color: mode === "manual" ? "#fff" : "#475569",
                  cursor: "pointer",
                }}
              >
                ✏️ Manual Custom Tag
              </button>
            </div>

            {mode === "auto" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                  Search Product Inventory:
                  <div style={{ position: "relative", marginTop: 4 }}>
                    <Search size={15} color="#94a3b8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      placeholder="Type garment name or SKU..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ width: "100%", height: 38, paddingLeft: 32, border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                </label>

                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  {matchedProducts.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedProduct(prod)}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        cursor: "pointer",
                        background: selectedProduct?.id === prod.id ? "#eef2ff" : "#fff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>{prod.name}</strong>
                        <small style={{ color: "#64748b" }}>SKU: {prod.sku} · Size: {prod.size}</small>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#4f46e5" }}>₹{prod.sellingPrice}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Store Name
                  <input value={storeName} onChange={e => setStoreName(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Garment Title
                  <input value={tagTitle} onChange={e => setTagTitle(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>SKU / Barcode
                    <input value={sku} onChange={e => setSku(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Garment Size
                    <input value={size} onChange={e => setSize(e.target.value)} placeholder="M / L / XL" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>MRP (₹)
                    <input type="number" value={mrp} onChange={e => setMrp(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Our Price (₹)
                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }} />
                  </label>
                </div>
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginTop: 4 }}>
              Number of Stickers to Print:
              <input
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", marginTop: 4 }}
              />
            </label>
          </div>

          {/* Right Tag Preview Card */}
          <div style={{ padding: 20, background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>
              Sticker Tag Preview (50mm x 25mm)
            </span>

            {/* Price Tag Graphic */}
            <div
              style={{
                width: 220,
                border: "2px solid #000",
                borderRadius: 8,
                padding: "10px 12px",
                background: "#fff",
                textAlign: "center",
                fontFamily: "sans-serif",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              <strong style={{ fontSize: 13, display: "block", color: "#000", letterSpacing: 0.5 }}>{tagStore}</strong>
              <span style={{ fontSize: 10, color: "#475569", display: "block" }}>Men's Wear · Pavoorchatram</span>

              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

              <strong style={{ fontSize: 12, display: "block", color: "#0f172a" }}>{tagItemTitle}</strong>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, margin: "4px 0", fontWeight: 700 }}>
                <span>SKU: {tagSku}</span>
                <span style={{ background: "#000", color: "#fff", padding: "1px 6px", borderRadius: 4 }}>SIZE: {tagSize}</span>
              </div>

              {/* Barcode Lines Graphic */}
              <div style={{ margin: "8px 0 4px", display: "flex", justifyContent: "center", gap: 2 }}>
                {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3].map((w, i) => (
                  <div key={i} style={{ width: w, height: 32, background: "#000" }} />
                ))}
              </div>
              <span style={{ fontSize: 9, fontFamily: "monospace", display: "block" }}>*{tagSku}*</span>

              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                <span style={{ textDecoration: "line-through", color: "#64748b" }}>MRP: ₹{tagMrp}</span>
                <strong style={{ fontSize: 14, color: "#000" }}>OFFER: ₹{tagPrice}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Ready to print {quantity} price stickers</span>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" onClick={handlePrintTags} className="primary-purple-btn" style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <Printer size={16} /> Print {quantity} Stickers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
