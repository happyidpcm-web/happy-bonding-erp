// Remote fonts or images must not leave Download/Share waiting indefinitely.
async function waitForAssets(promise: Promise<unknown>, timeout = 3000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise.catch(() => undefined), new Promise<void>(resolve => { timer = setTimeout(resolve, timeout); })]);
  } finally { clearTimeout(timer); }
}

export async function createInvoicePdf(element: HTMLElement, filename: string): Promise<File> {
  const { default: html2pdf } = await import("html2pdf.js");
  await Promise.all([
    waitForAssets(document.fonts.ready),
    waitForAssets(Promise.all(Array.from(element.querySelectorAll("img"), img => img.decode().catch(() => undefined)))),
  ]);
  const cleanFilename = filename.replace(/[/\\?%*:|"<>]/g, "_");

  const opt = {
    margin: 0,
    filename: cleanFilename.endsWith(".pdf") ? cleanFilename : `${cleanFilename}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, imageTimeout: 5000,
      onclone: (clonedDocument: Document) => {
        // Font CSS can stay pending on restricted/slow networks in the cloned
        // document too. The invoice remains readable using its fallback fonts.
        clonedDocument.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => link.remove());
        for (const sheet of Array.from(clonedDocument.styleSheets)) {
          try {
            for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
              const rule = sheet.cssRules[index];
              if (rule instanceof CSSImportRule && rule.href.includes("fonts.googleapis.com")) sheet.deleteRule(index);
            }
          } catch { /* Cross-origin stylesheets cannot be inspected. */ }
        }
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    pagebreak: { mode: ["css", "legacy"], avoid: "tr" },
  };

  const blob: Blob = await html2pdf().set(opt).from(element).outputPdf("blob");
  if (!blob.size) throw new Error("PDF could not be created. Please try again.");
  return new File([blob], opt.filename, { type: "application/pdf" });
}

export function downloadPdfFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadInvoicePdf(element: HTMLElement, filename: string) {
  downloadPdfFile(await createInvoicePdf(element, filename));
}
