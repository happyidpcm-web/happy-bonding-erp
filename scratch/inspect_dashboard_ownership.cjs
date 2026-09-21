const fs = require('fs');
const path = require('path');

const targets = ['DashboardLive', 'SalesReportChartCard', 'lastSevenDays'];

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  targets.forEach(t => {
    const matches = [...content.matchAll(new RegExp(`\\b${t}\\b`, 'g'))];
    if (matches.length > 0) {
      console.log(`File ${filePath}: "${t}" found ${matches.length} time(s)`);
    }
  });
}

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      searchInFile(fullPath);
    }
  });
}

searchDir('src');
