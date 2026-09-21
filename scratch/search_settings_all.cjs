const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('Settings') && (line.includes('function') || line.includes('const') || line.includes('interface') || line.includes('type'))) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
