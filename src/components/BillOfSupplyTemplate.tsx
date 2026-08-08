import React from "react";
import happyBondingLogo from "../assets/happy-bonding-logo-white.png";
import type { Invoice, InvoiceSetting } from "../types";

const defaultSignatureUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" width="220" height="60"><path d="M10 45 C30 10, 45 5, 55 45 C65 25, 75 15, 85 45 C95 10, 110 30, 130 40 C140 15, 155 25, 175 35 C185 10, 205 35, 240 15" stroke="%23111827" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M25 50 C80 48, 140 52, 210 48" stroke="%23111827" stroke-width="1.5" fill="none"/><text x="35" y="65" font-family="cursive, sans-serif" font-size="18" font-weight="bold" fill="%23111827">M. Saravana</text></svg>`;

export function numberToWords(num: number): string {
  if (!num || num === 0) return "Zero Rupees";
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + inWords(n % 10000000) : "");
  }
  return inWords(Math.floor(num)) + " Rupees";
}

function CornerFiligree() {
  const ornament = (
    <svg width="22" height="22" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2 H14 C20 2, 28 10, 28 16 V28" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 5 H12 C16 5, 23 12, 23 16 V23" stroke="#d4af37" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="1.5" fill="#d4af37"/>
    </svg>
  );

  return (
    <>
      <div className="gold-ornament top-left">{ornament}</div>
      <div className="gold-ornament top-right">{ornament}</div>
      <div className="gold-ornament bottom-right">{ornament}</div>
      <div className="gold-ornament bottom-left">{ornament}</div>
    </>
  );
}

export const BillOfSupplyTemplate = React.forwardRef<HTMLDivElement, { invoice: Invoice; setting: InvoiceSetting }>(
  ({ invoice, setting }, ref) => {
    const lines = invoice.lines && invoice.lines.length > 0 ? invoice.lines : [
      { itemName: "XOXO T SHIRT SURPLUS", sku: "HB-TSH-001", quantity: 1, unitPrice: invoice.amount, discount: 0, taxRate: 5, total: invoice.amount }
    ];

    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const discount = lines.reduce((s, l) => s + l.discount, 0);
    const total = invoice.amount;
    const paid = invoice.paidAmount ?? total;
    const balance = Math.max(0, total - paid);

    return (
      <div ref={ref} className="a4-bill-document gold-frame bill-of-supply-template exact-ref-design">
        <CornerFiligree />

        {/* Header Section */}
        <div className="doc-header flex-header">
          <div className="header-left">
            <img src={happyBondingLogo} alt="Happy Bonding" className="doc-logo" />
            <div className="shop-info font-purple">
              <h1>Happy Bonding Men's Wear</h1>
              <p className="subtitle">Thanks For Choosing Happy Bonding Men's Wear</p>
              <p className="meta-line">
                <span><strong>Pan No</strong> CWZPS9715D</span>
                <span><strong>GSTIN</strong> 33CWZPS9715D1ZU</span>
              </p>
              <p className="phone-line">📞 7708030903</p>
              <p className="addr-line">📍 No. 10/901,West Bus Stand, Near Railway Gate, Pavoorchatram - 627808 , Tirunelveli, Tamil Nadu, 627808</p>
              <p className="web-line">happy bonding: <strong>www.happybonding.in</strong></p>
            </div>
          </div>
          <div className="header-right-badge">
            <div className="badge-box">
              <h3>BILL OF SUPPLY</h3>
              <span>ORIGINAL FOR RECIPIENT</span>
            </div>
          </div>
        </div>

        {/* Invoice Meta Strip */}
        <div className="doc-meta-strip grid-meta">
          <div>
            <span>Invoice No.</span>
            <strong>{invoice.number}</strong>
          </div>
          <div>
            <span>Invoice Date</span>
            <strong>{invoice.date} 9:29 PM</strong>
          </div>
        </div>

        {/* Party Addresses */}
        <div className="doc-addresses grid-addr">
          <div className="addr-box">
            <strong>Bill To</strong>
            <p className="party-name font-purple">{invoice.party}</p>
            {invoice.partyPhone && <p>Mobile {invoice.partyPhone}</p>}
            <p>Place of Supply Tamil Nadu</p>
          </div>
          <div className="addr-box">
            <strong>Ship To</strong>
            <p className="party-name font-purple">{invoice.party}</p>
            {invoice.partyPhone && <p>Mobile {invoice.partyPhone}</p>}
          </div>
        </div>

        {/* Line Items Table */}
        <table className="doc-lines-table purple-header-table">
          <thead>
            <tr>
              <th style={{ width: 45, textAlign: "center" }}>No</th>
              <th>Items</th>
              <th style={{ width: 80, textAlign: "center" }}>Qty.</th>
              <th style={{ width: 100, textAlign: "right" }}>MRP</th>
              <th style={{ width: 90, textAlign: "right" }}>Rate</th>
              <th style={{ width: 100, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const mrp = Math.round(l.unitPrice * 1.1);
              return (
                <tr key={idx}>
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                  <td>
                    <strong className="item-title">{l.itemName}</strong>
                  </td>
                  <td style={{ textAlign: "center" }}>{l.quantity} PCS</td>
                  <td style={{ textAlign: "right" }}>
                    {mrp}
                    {l.discount > 0 && <div className="discount-off">({Math.round((l.discount / mrp) * 100)}% OFF)</div>}
                  </td>
                  <td style={{ textAlign: "right" }}>{l.unitPrice}</td>
                  <td style={{ textAlign: "right" }}><strong>{l.total}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Subtotal Bar */}
        <div className="purple-subtotal-bar">
          <span className="subtotal-label">SUBTOTAL</span>
          <span className="subtotal-qty">{totalQty}</span>
          <span className="subtotal-amount">₹ {subtotal}</span>
        </div>

        {/* Summary Footer */}
        <div className="doc-summary-footer purple-summary-footer">
          <div className="summary-left">
            {discount > 0 && <p className="discount-line">Discount: - ₹ {discount}</p>}
            <div className="amount-words-box">
              <span>Total Amount (in words)</span>
              <strong>{numberToWords(total)}</strong>
            </div>
          </div>

          <div className="summary-right">
            <p><span>Discount</span><span>- ₹ {discount}</span></p>
            <h3 className="grand-total-row"><span>Total Amount</span><span>₹ {total}</span></h3>
            <p><span>Received Amount</span><span>₹ {paid}</span></p>
            <p className="balance-row"><span>Balance</span><span>₹ {balance}</span></p>

            <div className="gold-signature-box">
              <div className="sig-img-wrap">
                <img src={setting.signatureUrl || defaultSignatureUrl} alt="Signature" />
              </div>
              <div className="sig-label">Signature</div>
              <div className="sig-company">{setting.signatureText || "Happy Bonding Men's Wear"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
