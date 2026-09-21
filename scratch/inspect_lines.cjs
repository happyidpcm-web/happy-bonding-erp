const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log("\n--- Line 3835 to 3848 ---");
for (let i = 3834; i < 3848; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}

console.log("\n--- Line 6445 to 6458 ---");
for (let i = 6444; i < 6458; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}

console.log("\n--- Line 8185 to 8198 ---");
for (let i = 8184; i < 8198; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}
