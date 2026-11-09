import * as XLSX from "xlsx";
import type { VoucherRecord } from "../types";

export function purchaseWorkbook(records: VoucherRecord[], businessName: string) {
  const rows: (string | number)[][] = [];
  const merges: XLSX.Range[] = [];
  const moneyCells: string[] = [];
  const heading = (text: string) => {
    merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: 8 } });
    rows.push([text]);
  };
  const total = (label: string, amount: number) => {
    moneyCells.push(XLSX.utils.encode_cell({ r: rows.length, c: 8 }));
    merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: 7 } });
    rows.push([label, "", "", "", "", "", "", "", amount]);
  };
  heading(businessName);
  heading(`All Purchase Invoices (${records.length})`);
  rows.push([]);
  for (const invoice of records) {
    heading(`Party Name: ${invoice.party}`);
    heading(`Purchase Invoice: ${invoice.number} | Date: ${invoice.date}`);
    rows.push(["S.No", "Item Description", "HSN", "Quantity", "Price (INR)", "MRP (INR)", "Discount (INR)", "Tax (%)", "Amount (INR)"]);
    for (const [index, item] of (invoice.items || []).entries()) {
      for (const c of [4, 5, 6, 8]) moneyCells.push(XLSX.utils.encode_cell({ r: rows.length, c }));
      rows.push([index + 1, item.name, item.hsn || "", Number(item.qty), Number(item.price), item.mrp == null ? "" : Number(item.mrp), Number(item.discount ?? 0), Number(item.tax ?? 0), Number(item.amount)]);
    }
    if (!invoice.items?.length) heading("No item details recorded");
    total("Item Amount Total (INR)", (invoice.items || []).reduce((sum, item) => sum + Number(item.amount), 0));
    rows.push([], []);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = merges;
  sheet["!cols"] = [8, 60, 16, 12, 18, 18, 20, 12, 20].map(wch => ({ wch }));
  sheet["!rows"] = rows.map(() => ({ hpt: 24 }));
  // Expand the description column for long descriptions rather than clipping them.
  sheet["!cols"][1].wch = Math.max(60, ...records.flatMap(r => (r.items || []).map(i => i.name.length + 4)));
  for (const address of moneyCells) if (sheet[address]?.t === "n") sheet[address].z = '#,##0.00';
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Purchase Invoices");
  return workbook;
}

export function downloadPurchaseExcel(records: VoucherRecord[], businessName: string) {
  XLSX.writeFile(purchaseWorkbook(records, businessName), "Purchase_Invoices.xlsx");
}
