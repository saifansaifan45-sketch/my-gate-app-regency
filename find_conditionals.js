const fs = require('fs');
const path = require('path');

function searchDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('&&') && line.includes('<')) {
          console.log(`Conditional in ${fullPath}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

searchDirectory('./frontend/app/(app)/leadership');
