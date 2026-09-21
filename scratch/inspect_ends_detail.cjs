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

const checkList = [
  'function ItemModal(',
  'function CashBank(',
  'function Staff(',
  'function ExpensesModule(',
  'function RemindersModule(',
];

checkList.forEach(name => {
  const idx = lines.findIndex(l => l.includes(name));
  if (idx !== -1) {
    const endIdx = findBlockEnd(idx);
    console.log(`${name}: Line ${idx + 1} to Line ${endIdx + 1}`);
    console.log(`Line ${endIdx + 1}: ${JSON.stringify(lines[endIdx])}`);
    if (endIdx + 1 < lines.length) {
      console.log(`Line ${endIdx + 2}: ${JSON.stringify(lines[endIdx + 1])}`);
    }
  }
});
