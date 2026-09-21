const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log(`Exact line count of src/App.tsx: ${lines.length}`);

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
  return lines.length - 1;
}

lines.forEach((line, i) => {
  const trimmed = line.trim();
  if (/^(export\s+)?(function|interface|type)\s+([A-Za-z0-9_]+)/.test(trimmed)) {
    const match = trimmed.match(/^(export\s+)?(function|interface|type)\s+([A-Za-z0-9_]+)/);
    if (match) {
      const endLine = findBlockEnd(i);
      const size = endLine - i + 1;
      console.log(`Line ${i + 1} - ${endLine + 1} (${size} lines): ${match[2]} ${match[3]}`);
    }
  }
});
