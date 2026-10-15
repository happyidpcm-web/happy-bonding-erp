export async function createInvoicePdf(element: HTMLElement, filename: string): Promise<File> {
  const { default: html2pdf } = await import("html2pdf.js");
  await document.fonts.ready;
  await Promise.all(Array.from(element.querySelectorAll("img"), img => img.decode().catch(() => undefined)));
  const cleanFilename = filename.replace(/[/\\?%*:|"<>]/g, "_");

  const opt = {
    margin: 0,
    filename: cleanFilename.endsWith(".pdf") ? cleanFilename : `${cleanFilename}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
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
