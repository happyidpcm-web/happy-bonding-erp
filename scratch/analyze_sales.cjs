const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const salesLines = lines.slice(2386, 3818);

console.log("=== SALES COMPONENT PROPS & CALLS ===");
console.log(salesLines[0]);
console.log(salesLines[1]);

salesLines.forEach((line, i) => {
  if (line.includes('api.') || line.includes('Modal') || line.includes('set') || line.includes('notify') || line.includes('onNavigate')) {
    if (i < 50 || line.includes('api.')) {
      console.log(`Sales line ${i + 2387}: ${line.trim()}`);
    }
  }
});
