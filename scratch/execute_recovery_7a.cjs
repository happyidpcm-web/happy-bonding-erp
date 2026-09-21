const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log(`Initial line count of App.tsx: ${lines.length}`);

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

// Find indices for all blocks:
const partyLedgerStart = lines.findIndex(l => l.includes('function PartyLedgerModal('));
const partyLedgerEnd = findBlockEnd(partyLedgerStart);

const staffModalStart = lines.findIndex(l => l.includes('function StaffManagementModal('));
const staffModalEnd = findBlockEnd(staffModalStart);

const partiesStart = lines.findIndex(l => l.includes('function dedupeContacts('));
const partiesMainStart = lines.findIndex(l => l.includes('function Parties('));
const partiesMainEnd = findBlockEnd(partiesMainStart);

const itemsStart = lines.findIndex(l => l.includes('interface Offer'));
const itemModalStart = lines.findIndex(l => l.includes('function ItemModal('));
const itemModalEnd = findBlockEnd(itemModalStart);

const cashBankStart = lines.findIndex(l => l.includes('interface AccountRecord'));
const cashBankMainStart = lines.findIndex(l => l.includes('function CashBank('));
const cashBankEnd = findBlockEnd(cashBankMainStart);

const staffStart = lines.findIndex(l => l.includes('interface StaffMember'));
const staffMainStart = lines.findIndex(l => l.includes('function Staff('));
const staffEnd = findBlockEnd(staffMainStart);

const expensesStart = lines.findIndex(l => l.includes('function ExpensesModule('));
const expensesEnd = findBlockEnd(expensesStart);

const remindersStart = lines.findIndex(l => l.includes('function RemindersModule('));
const remindersEnd = findBlockEnd(remindersStart);

console.log(`1. PartyLedgerModal: lines ${partyLedgerStart+1} to ${partyLedgerEnd+1}`);
console.log(`2. StaffManagementModal: lines ${staffModalStart+1} to ${staffModalEnd+1}`);
console.log(`3. Parties domain: lines ${partiesStart+1} to ${partiesMainEnd+1}`);
console.log(`4. Items domain: lines ${itemsStart+1} to ${itemModalEnd+1}`);
console.log(`5. CashBank domain: lines ${cashBankStart+1} to ${cashBankEnd+1}`);
console.log(`6. Staff domain: lines ${staffStart+1} to ${staffEnd+1}`);
console.log(`7. ExpensesModule: lines ${expensesStart+1} to ${expensesEnd+1}`);
console.log(`8. RemindersModule: lines ${remindersStart+1} to ${remindersEnd+1}`);

// Perform deletions in reverse index order:
const ranges = [
  [remindersStart, remindersEnd],
  [expensesStart, expensesEnd],
  [staffStart, staffEnd],
  [cashBankStart, cashBankEnd],
  [itemsStart, itemModalEnd],
  [partiesStart, partiesMainEnd],
  [staffModalStart, staffModalEnd],
  [partyLedgerStart, partyLedgerEnd],
];

// Sort ranges descending by start index
ranges.sort((a, b) => b[0] - a[0]);

let modifiedLines = [...lines];
ranges.forEach(([start, end]) => {
  // delete lines from start to end inclusive
  modifiedLines.splice(start, end - start + 1);
});

console.log(`Final line count of App.tsx: ${modifiedLines.length}`);

fs.writeFileSync('src/App.tsx', modifiedLines.join('\n'), 'utf-8');
console.log("✅ Successfully updated App.tsx!");
