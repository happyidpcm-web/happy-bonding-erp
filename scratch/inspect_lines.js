const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

console.log("\n--- Line 2585 to 2595 ---");
for (let i = 2584; i < 2595; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}

console.log("\n--- Line 3842 to 3850 ---");
for (let i = 3841; i < 3850; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}

console.log("\n--- Line 6065 to 6075 ---");
for (let i = 6064; i < 6075; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}

console.log("\n--- Line 6455 to 6465 ---");
for (let i = 6454; i < 6465; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}

console.log("\n--- Line 7923 to 7938 ---");
for (let i = 7922; i < 7938; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}

console.log("\n--- Line 8190 to 8200 ---");
for (let i = 8189; i < 8200; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}
