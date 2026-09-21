const fs = require('fs');

const content = fs.readFileSync('src/pages/inventory/Items.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('openingStock') || line.includes('ClipboardList') || line.includes('setRows(') || line.includes('setProducts')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
