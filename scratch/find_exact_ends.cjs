const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

function findBlockEnd(startLineIndex) {
  let depth = 0;
  let started = false;
  for (let i = startLineIndex; i < lines.length; i++) {
    const line = lines[i];
    for (let char of line) {
      if (char === '{') {
        depth++;
        started = true;
      } else if (char === '}') {
        depth--;
      }
    }
    if (started && depth === 0) {
      return i;
    }
  }
  return -1;
}

const functionStarts = [
  { name: 'PartyLedgerModal', start: lines.findIndex(l => l.includes('function PartyLedgerModal(')) },
  { name: 'StaffManagementModal', start: lines.findIndex(l => l.includes('function StaffManagementModal(')) },
  { name: 'dedupeContacts', start: lines.findIndex(l => l.includes('function dedupeContacts(')) },
  { name: 'Parties', start: lines.findIndex(l => l.includes('function Parties(')) },
  { name: 'CreateOfferModal', start: lines.findIndex(l => l.includes('interface Offer')) },
  { name: 'Items (main)', start: lines.findIndex(l => l.includes('function Items(')) },
  { name: 'ItemModal', start: lines.findIndex(l => l.includes('function ItemModal(')) },
  { name: 'AccountRecord / CashBank', start: lines.findIndex(l => l.includes('interface AccountRecord')) },
  { name: 'StaffMember / Staff', start: lines.findIndex(l => l.includes('interface StaffMember')) },
  { name: 'ExpensesModule', start: lines.findIndex(l => l.includes('function ExpensesModule(')) },
  { name: 'RemindersModule', start: lines.findIndex(l => l.includes('function RemindersModule(')) },
];

functionStarts.forEach(item => {
  if (item.start !== -1) {
    const end = findBlockEnd(item.start);
    console.log(`${item.name}: Line ${item.start + 1} to Line ${end + 1}`);
  } else {
    console.log(`${item.name}: NOT FOUND`);
  }
});
