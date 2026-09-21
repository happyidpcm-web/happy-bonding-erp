const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log(`Current App.tsx line count: ${lines.length}`);

// Search for SettingsPage and related symbols
lines.forEach((line, i) => {
  if (line.includes('SettingsPage') || line.includes('SettingsTab') || line.includes('handleResetSubmit') || line.includes('handleExportBackup') || line.includes('handleExecuteRestore')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
