const fs = require('fs');
const path = require('path');

const sharedItems = [
  'Modal',
  'PageHeading',
  'Metric',
  'EmptyState',
  'SearchRow',
  'InvoiceDetailModal',
  'AddItemsToBillModal',
  'CustomDateRangePopover',
  'isInvoiceInDateRange',
  'BranchManagementModal',
  'EditBranchModal',
];

const appContent = fs.readFileSync('src/App.tsx', 'utf-8');

console.log("=== SHARED COMPONENTS CONSUMERS IN APP.TSX ===");

sharedItems.forEach(item => {
  const matches = [...appContent.matchAll(new RegExp(`\\b${item}\\b`, 'g'))];
  console.log(`${item}: ${matches.length} occurrences in App.tsx`);
});
