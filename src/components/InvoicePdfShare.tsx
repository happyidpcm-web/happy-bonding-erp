import { useEffect, useRef, useState } from "react";
import { Download, MessageCircle, X } from "lucide-react";
import type { Invoice } from "../types";
import { createInvoicePdf, downloadPdfFile } from "../utils/pdf";

export function InvoicePdfShare({ invoice, businessName, element, onClose }: {
  invoice: Invoice; businessName: string; element: HTMLElement; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [nativeUnavailable, setNativeUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    setFile(null); setError(""); setDownloaded(false);
    createInvoicePdf(element, `Invoice_${invoice.number}`).then(pdf => {
      if (active) setFile(pdf);
    }).catch(() => {
      if (active) setError("Could not prepare the invoice PDF. Please retry.");
    });
    return () => { active = false; };
  }, [element, invoice, attempt]);

  let canShare = false;
  try { canShare = Boolean(file && !nativeUnavailable && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })); } catch { /* Use download fallback. */ }
  const message = `${businessName}\nHello ${invoice.party || "Customer"},\nInvoice: ${invoice.number}\nDate: ${invoice.date}\nTotal: Rs. ${invoice.amount.toLocaleString("en-IN")}\nPlease find your invoice PDF attached. Thank you for shopping with us!`;
  const digits = (invoice.partyPhone ?? "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `91${digits}` : digits.length > 10 ? digits : "";
  const whatsappUrl = `https://web.whatsapp.com/send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(message)}`;

  const share = async () => {
    if (!file || sharing) return;
    setSharing(true); setError("");
    try {
      // A fresh click after generation retains the required user activation.
      await navigator.share({ files: [file], title: `Invoice ${invoice.number}`, text: message });
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === "AbortError")) {
        setNativeUnavailable(true);
        setError("File sharing is unavailable here. Download the PDF and attach it in WhatsApp.");
      }
    } finally { setSharing(false); }
  };

  return <dialog ref={dialog} className="invoice-pdf-share" aria-labelledby="invoice-pdf-share-title" onCancel={onClose}>
    <div className="modal-head">
      <h2 id="invoice-pdf-share-title">Share invoice PDF</h2>
      <button type="button" className="icon-button" aria-label="Close PDF sharing" onClick={onClose}><X /></button>
    </div>
    <p><strong>{invoice.number}</strong><br />{invoice.party}{invoice.partyPhone ? ` · ${invoice.partyPhone}` : ""}</p>
    {!file && !error && <p role="status">Preparing your invoice PDF…</p>}
    {error && <p role="alert">{error}</p>}
    {!file && error && <button type="button" className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry PDF</button>}
    {file && <>
      <p className="pdf-share-filename">{file.name}</p>
      {canShare ? <>
        <p>Choose WhatsApp, select the customer, then tap Send. The invoice PDF is included.</p>
        <button type="button" className="whatsapp-btn" disabled={sharing} onClick={share}><MessageCircle size={16} />{sharing ? "Sharing…" : "Share PDF"}</button>
      </> : <>
        <p>Download this PDF, then open the customer chat. In WhatsApp, choose <strong>Attach → Document</strong>, select this file and send.</p>
        <p>WhatsApp Web cannot attach the PDF automatically.</p>
      </>}
      <div className="pdf-share-actions">
        <button type="button" className="secondary" onClick={() => { downloadPdfFile(file); setDownloaded(true); }}><Download size={16} />Download PDF</button>
        {!canShare && <a className="whatsapp-btn" href={whatsappUrl} target="_blank" rel="noopener noreferrer">Open WhatsApp Web</a>}
      </div>
      {downloaded && <p role="status">PDF download started. Attach {file.name} in WhatsApp.</p>}
      {!phone && <p>No customer phone number saved. Choose the recipient in WhatsApp.</p>}
    </>}
  </dialog>;
}
