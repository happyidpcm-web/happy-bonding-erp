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

export function purchaseSummaryWorkbook(records: VoucherRecord[]) {
  const rows = records.map(invoice => {
    // Match the purchase preview: tax is applied after each item's discount.
    const tax = Math.round((invoice.items || []).reduce((sum, item) => {
      const base = Math.max(0, item.qty * item.price - (item.discount ?? 0));
      return sum + Math.round(base * (1 + (item.tax ?? 0) / 100) * 100) / 100 - base;
    }, 0) * 100) / 100;
    return [invoice.party, Number(invoice.amount), tax];
  });
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Party Name", "Total Amount (INR)", "Tax Amount (INR)"],
    ...rows,
    ["TOTAL", 0, 0],
  ]);
  for (const col of [1, 2]) {
    const address = XLSX.utils.encode_cell({ r: rows.length + 1, c: col });
    const letter = XLSX.utils.encode_col(col);
    sheet[address] = {
      t: "n",
      v: Math.round(rows.reduce((sum, row) => sum + Number(row[col]), 0) * 100) / 100,
      ...(rows.length ? { f: `SUM(${letter}2:${letter}${rows.length + 1})` } : {}),
    };
  }
  sheet["!cols"] = [{ wch: 55 }, { wch: 24 }, { wch: 24 }];
  sheet["!rows"] = Array.from({ length: rows.length + 2 }, () => ({ hpt: 24 }));
  if (rows.length) sheet["!autofilter"] = { ref: `A1:C${rows.length + 1}` };
  for (let row = 1; row <= rows.length + 1; row++) {
    for (const col of [1, 2]) sheet[XLSX.utils.encode_cell({ r: row, c: col })].z = "#,##0.00";
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Purchase Summary");
  return workbook;
}

export function downloadPurchaseSummaryExcel(records: VoucherRecord[]) {
  XLSX.writeFile(purchaseSummaryWorkbook(records), "Purchase_Invoices_Summary.xlsx");
}
