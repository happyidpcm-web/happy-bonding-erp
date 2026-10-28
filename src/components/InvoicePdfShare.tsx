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
  const message = `${businessName}\nHello ${invoice.party || "Customer"},\nInvoice: ${invoice.number}\nDate: ${invoice.date}\nTotal: Rs. ${invoice.amount.toLocaleString("en-IN")}\nThank you for shopping with us!`;
  const digits = (invoice.partyPhone ?? "").replace(/\D/g, "").replace(/^00/, "");
  const localDigits = digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  const phone = localDigits.length === 10 ? `91${localDigits}` : /^[1-9]\d{10,14}$/.test(localDigits) ? localDigits : "";
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

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
    {phone ? <>
      <p>Open this customer's WhatsApp chat with the invoice details ready. Review the message and tap Send.</p>
      <a className="whatsapp-btn" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} />Open Customer WhatsApp</a>
    </> : <p role="status">Add a valid customer phone number to the invoice to open their WhatsApp chat.</p>}
    {!file && !error && <p role="status">Preparing your invoice PDF…</p>}
    {error && <p role="alert">{error}</p>}
    {!file && error && <button type="button" className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry PDF</button>}
    {file && <>
      <p className="pdf-share-filename">{file.name}</p>
      <p>To include the PDF, download it and choose <strong>Attach → Document</strong> in the customer chat, select this file and send.</p>
      <p>The direct chat link cannot attach the PDF automatically.</p>
      <div className="pdf-share-actions">
        <button type="button" className="secondary" onClick={() => { downloadPdfFile(file); setDownloaded(true); }}><Download size={16} />Download PDF</button>
        {canShare && <button type="button" className="secondary" disabled={sharing} onClick={share}>{sharing ? "Sharing…" : "Share PDF via other apps"}</button>}
      </div>
      {downloaded && <p role="status">PDF download started. Attach {file.name} in WhatsApp.</p>}
    </>}
  </dialog>;
}
