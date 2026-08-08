export async function downloadInvoicePdf(element: HTMLElement, filename: string) {
  if (!(window as any).html2pdf) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load PDF generation library"));
      document.body.appendChild(script);
    });
  }

  const cleanFilename = filename.replace(/[/\\?%*:|"<>]/g, "_");

  const opt = {
    margin: [0, 0, 0, 0],
    filename: cleanFilename.endsWith(".pdf") ? cleanFilename : `${cleanFilename}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  await (window as any).html2pdf().set(opt).from(element).save();
}
