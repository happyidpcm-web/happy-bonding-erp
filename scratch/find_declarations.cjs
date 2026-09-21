const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('PageHeading') && (line.includes('function') || line.includes('const'))) {
    console.log(`PageHeading line ${index + 1}: ${line.trim()}`);
  }
  if (line.includes('Modal') && line.includes('function') && !line.includes('EmailExcelReportModal') && !line.includes('Modal(')) {
    console.log(`Modal line ${index + 1}: ${line.trim()}`);
  }
});
