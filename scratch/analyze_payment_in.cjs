const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const payLines = lines.slice(5314, 6303);

console.log("=== PAYMENT IN MODULE PROPS & CALLS ===");
console.log(payLines.find(l => l.includes('function PaymentInModule')));

payLines.forEach((line, i) => {
  if (line.includes('api.') || line.includes('Modal') || line.includes('set') || line.includes('function ')) {
    if (line.includes('function ') || line.includes('api.') || line.includes('Modal')) {
      console.log(`PaymentIn line ${i + 5315}: ${line.trim()}`);
    }
  }
});
