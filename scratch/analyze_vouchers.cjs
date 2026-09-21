const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log("=== GENERIC VOUCHER PAGE & VOUCHER ENGINE SEARCH ===");

lines.forEach((line, i) => {
  if (line.includes('GenericVoucherPage') || line.includes('CreateQuotationScreen') || line.includes('voucherType') || line.includes('api.getVouchers')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
