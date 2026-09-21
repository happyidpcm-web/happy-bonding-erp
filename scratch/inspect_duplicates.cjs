const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log(`App.tsx total lines: ${lines.length}`);

// We search for line numbers of key definitions to remove
const targets = [
  'function Parties(',
  'function PartyCreateForm(',
  'function PartySettingsModal(',
  'function BulkAddPartiesModal(',
  'function PartyLedgerModal(',
  'function ShareLedgerModal(',
  'function dedupeContacts(',
  'function parseContactsCsv(',
  'function parseContactsFile(',
  'function downloadSampleTemplate(',
  'function exportCustomersToExcel(',
  'type BulkPartyRow',
  'interface BulkPartyRow',

  'function Items(',
  'function ItemModal(',
  'function ItemSettingsModal(',
  'function CreateOfferModal(',
  'function OffersScreen(',
  'function BulkEditSelectModal(',
  'function BulkEditItemsSpreadsheetScreen(',
  'function BulkEditGSTRateScreen(',
  'function BulkAddItemsSpreadsheetModal(',
  'function PurchaseBillUploadModal(',
  'function ItemsLibraryScreen(',
  'interface Offer',
  'interface ItemFormState',
  'const blankItem',
  'interface BulkItemRow',
  'const defaultBulkItemRows',

  'function CashBank(',
  'interface AccountRecord',

  'function Staff(',
  'function StaffManagementModal(',

  'function ExpensesModule(',
  'function RemindersModule(',
];

targets.forEach(t => {
  const idx = lines.findIndex(l => l.includes(t));
  if (idx !== -1) {
    console.log(`Found "${t}" at line ${idx + 1}`);
  } else {
    console.log(`NOT found: "${t}"`);
  }
});
