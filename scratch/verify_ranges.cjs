const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

function printRange(start, end, label) {
  console.log(`\n=== ${label} (Lines ${start+1} to ${end+1}) ===`);
  console.log(`START ${start+1}: ${JSON.stringify(lines[start])}`);
  console.log(`END ${end+1}: ${JSON.stringify(lines[end])}`);
}

// 1. PartyLedgerModal: line 82 to 143 (index 81 to 142)
printRange(81, 142, "PartyLedgerModal");

// 2. Party helpers + subcomponents + Parties main: lines 1382 to 2313 (index 1381 to 2312)
printRange(1381, 2312, "Party helpers + subcomponents + Parties");

// 3. Items subcomponents + Items main + ItemModal: lines 2315 to 4217 (index 2314 to 4216)
printRange(2314, 4216, "Items all");

// 4. CashBank: lines 6297 to 6486 (index 6296 to 6485)
printRange(6296, 6485, "CashBank all");

// 5. StaffManagementModal: lines 844 to 916 (index 843 to 915)
printRange(843, 915, "StaffManagementModal");

// 6. Staff main: lines 6488 to 6671 (index 6487 to 6670)
printRange(6487, 6670, "Staff main");

// 7. ExpensesModule: lines 9226 to 9428 (index 9225 to 9427)
printRange(9225, 9427, "ExpensesModule");

// 8. RemindersModule: lines 9430 to 9569 (index 9429 to 9568)
printRange(9429, 9568, "RemindersModule");
