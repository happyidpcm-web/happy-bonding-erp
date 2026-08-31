import React from "react";
import type { Invoice, InvoiceSetting } from "../types";

export function ThermalReceiptTemplate({
  invoice,
  setting,
  paperWidth = "80mm",
}: {
  invoice: Invoice;
  setting?: InvoiceSetting;
  paperWidth?: "80mm" | "58mm";
}) {
  const is58 = paperWidth === "58mm";
  const widthPx = is58 ? "210px" : "290px";

  return (
    <div
      style={{
        width: widthPx,
        margin: "0 auto",
        padding: is58 ? "8px 4px" : "12px 8px",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: is58 ? "11px" : "12px",
        color: "#000",
        background: "#fff",
        lineHeight: 1.3,
      }}
    >
      {/* Store Header */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: is58 ? "14px" : "16px", display: "block" }}>
          HAPPY BONDING
        </strong>
        <span style={{ fontSize: "11px", display: "block" }}>Men's Wear</span>
        <span style={{ fontSize: "10px", display: "block" }}>
          West Bus Stand, Pavoorchatram
        </span>
        <span style={{ fontSize: "10px", display: "block" }}>Ph: 7708030903</span>
        {setting?.bankName && (
          <span style={{ fontSize: "9px", display: "block" }}>
            GSTIN: 33CWZPS9715D1ZU
          </span>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Bill Meta */}
      <div style={{ fontSize: "11px", marginBottom: 6 }}>
        <div>Bill No : <strong>{invoice.number}</strong></div>
        <div>Date    : {invoice.date}</div>
        <div>Customer: {invoice.party || "Cash Sale"}</div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: is58 ? "10px" : "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1px dashed #000" }}>
            <th style={{ textAlign: "left", paddingBottom: 4 }}>Item</th>
            <th style={{ textAlign: "center", paddingBottom: 4 }}>Qty</th>
            <th style={{ textAlign: "right", paddingBottom: 4 }}>Rate</th>
            <th style={{ textAlign: "right", paddingBottom: 4 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.lines || []).map((line, idx) => (
            <tr key={idx}>
              <td style={{ textAlign: "left", paddingTop: 4, paddingBottom: 2 }}>
                {line.itemName}
              </td>
              <td style={{ textAlign: "center", paddingTop: 4 }}>{line.quantity}</td>
              <td style={{ textAlign: "right", paddingTop: 4 }}>{line.unitPrice}</td>
              <td style={{ textAlign: "right", paddingTop: 4, fontWeight: "bold" }}>
                {line.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* Totals */}
      <div style={{ fontSize: is58 ? "11px" : "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal:</span>
          <span>₹{invoice.subtotal || invoice.amount}</span>
        </div>
        {(invoice.cgstTotal || 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>CGST / SGST:</span>
            <span>₹{(Number(invoice.cgstTotal || 0) + Number(invoice.sgstTotal || 0)).toFixed(2)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justify: "space-between",
            fontWeight: "bold",
            fontSize: is58 ? "13px" : "14px",
            marginTop: 4,
            borderTop: "1px solid #000",
            paddingTop: 4,
          }}
        >
          <span>NET PAYABLE:</span>
          <span>₹{invoice.amount.toLocaleString("en-IN")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: 2 }}>
          <span>Payment Mode:</span>
          <span>{invoice.paymentMode || "Cash"}</span>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0 4px" }} />

      {/* Thank You Footer */}
      <div style={{ textAlign: "center", fontSize: "10px" }}>
        <span>Thank you for shopping with us!</span>
        <br />
        <span>Exchange allowed within 7 days with bill tag.</span>
      </div>
    </div>
  );
}
