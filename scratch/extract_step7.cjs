const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add imports near line 18
const importTarget = 'import { BarcodeGeneratorModal } from "./components/BarcodeGeneratorModal";\r\n';
const newImports = 'import { BarcodeGeneratorModal } from "./components/BarcodeGeneratorModal";\r\n' +
  'import { RemindersModule } from "./pages/reminders/RemindersModule";\r\n' +
  'import { ExpensesModule } from "./pages/expenses/ExpensesModule";\r\n' +
  'import { CashBank } from "./pages/cash-bank/CashBank";\r\n' +
  'import { Staff, StaffManagementModal } from "./pages/staff/Staff";\r\n' +
  'import { Parties, partyPayloadFromForm } from "./pages/parties/Parties";\r\n' +
  'import { Items } from "./pages/inventory/Items";\r\n' +
  'import { Reports, RateListReportScreen, StockSummaryReportScreen, LowStockSummaryReportScreen, ItemSalesSummaryReportScreen, SalesSummaryReportScreen, DayBookReportScreen, BillWiseProfitReportScreen, EmailExcelReportModal } from "./pages/reports/Reports";\r\n';

if (content.includes(importTarget)) {
  content = content.replace(importTarget, newImports);
  console.log("✅ Added imports");
} else {
  // try LF line endings if CRLF didn't match
  const importTargetLF = 'import { BarcodeGeneratorModal } from "./components/BarcodeGeneratorModal";\n';
  const newImportsLF = 'import { BarcodeGeneratorModal } from "./components/BarcodeGeneratorModal";\n' +
    'import { RemindersModule } from "./pages/reminders/RemindersModule";\n' +
    'import { ExpensesModule } from "./pages/expenses/ExpensesModule";\n' +
    'import { CashBank } from "./pages/cash-bank/CashBank";\n' +
    'import { Staff, StaffManagementModal } from "./pages/staff/Staff";\n' +
    'import { Parties, partyPayloadFromForm } from "./pages/parties/Parties";\n' +
    'import { Items } from "./pages/inventory/Items";\n' +
    'import { Reports, RateListReportScreen, StockSummaryReportScreen, LowStockSummaryReportScreen, ItemSalesSummaryReportScreen, SalesSummaryReportScreen, DayBookReportScreen, BillWiseProfitReportScreen, EmailExcelReportModal } from "./pages/reports/Reports";\n';
  content = content.replace(importTargetLF, newImportsLF);
  console.log("✅ Added imports (LF)");
}

// 2. Export isInvoiceInDateRange and CustomDateRangePopover
content = content.replace('function isInvoiceInDateRange(', 'export function isInvoiceInDateRange(');
content = content.replace('function CustomDateRangePopover(', 'export function CustomDateRangePopover(');
console.log("✅ Exported date helpers");

// 3. Line-based slicing for the three Reports blocks
const lines = content.split('\n');

// Find index of function EmailExcelReportModal
const block1Start = lines.findIndex(l => l.includes('function EmailExcelReportModal({'));
// Find index of interface BulkItemRow
const block1End = lines.findIndex(l => l.includes('interface BulkItemRow {'));

console.log(`Block 1 lines: ${block1Start+1} to ${block1End}`);

// Find index of function SalesSummaryReportScreen
const block2Start = lines.findIndex(l => l.includes('function SalesSummaryReportScreen({'));
// Find index of type InvoiceLineDraft
const block2End = lines.findIndex(l => l.includes('type InvoiceLineDraft={product:Product'));

console.log(`Block 2 lines: ${block2Start+1} to ${block2End}`);

// Find index of function Reports
const block3Start = lines.findIndex(l => l.includes('function Reports({'));
// Find index of interface AccountRecord
const block3End = lines.findIndex(l => l.includes('interface AccountRecord {'));

console.log(`Block 3 lines: ${block3Start+1} to ${block3End}`);

if (block1Start !== -1 && block1End !== -1 && block2Start !== -1 && block2End !== -1 && block3Start !== -1 && block3End !== -1) {
  // Slice out block3 first (highest index)
  lines.splice(block3Start, block3End - block3Start);
  // Slice out block2 second
  lines.splice(block2Start, block2End - block2Start);
  // Slice out block1 third
  lines.splice(block1Start, block1End - block1Start);

  fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf-8');
  console.log("✅ Reports domain extracted cleanly from App.tsx!");
} else {
  console.error("❌ Could not find all block boundaries!");
}
