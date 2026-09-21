const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

console.log(`Current line count of App.tsx: ${lines.length}`);

// Find index of type SettingsTab
const settingsStart = lines.findIndex(l => l.includes('type SettingsTab ='));
console.log(`SettingsPage start index: ${settingsStart + 1}`);

if (settingsStart !== -1) {
  // Remove lines from settingsStart to end of file
  const remainingLines = lines.slice(0, settingsStart);
  fs.writeFileSync('src/App.tsx', remainingLines.join('\n'), 'utf-8');
  console.log(`✅ Extracted SettingsPage! New line count of App.tsx: ${remainingLines.length}`);
} else {
  console.error("❌ Could not find type SettingsTab");
}
