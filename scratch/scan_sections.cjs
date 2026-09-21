const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (/^(export\s+)?(function|interface|type|const)\s+([A-Za-z0-9_]+)/.test(line.trim())) {
    const match = line.trim().match(/^(export\s+)?(function|interface|type|const)\s+([A-Za-z0-9_]+)/);
    if (match) {
      console.log(`Line ${i + 1}: ${match[0]}`);
    }
  }
});
