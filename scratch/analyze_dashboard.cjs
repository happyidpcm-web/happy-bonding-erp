const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const dashLines = lines.slice(1038, 1152);

console.log("=== DASHBOARDLIVE PROPS & CALLS ===");
console.log(dashLines[0]);
console.log(dashLines[1]);

dashLines.forEach((line, i) => {
  if (line.includes('api.') || line.includes('Modal') || line.includes('on') || line.includes('set') || line.includes('Invoice')) {
    console.log(`Dashboard line ${i + 1039}: ${line.trim()}`);
  }
});
