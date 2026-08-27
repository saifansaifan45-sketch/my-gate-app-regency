const fs = require('fs');
const path = require('path');

function searchDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Very basic regex to look for stuff like `> a <` or `>a<`
        // that is NOT within a <Text> component.
        // Actually, let's just look for `> a ` or ` a <`
        if (line.match(/>\s*a\s*</i) || line.match(/}\s*a\s*</i) || line.match(/>\s*a\s*{/i)) {
          console.log(`Found possible 'a' text node in ${fullPath}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

searchDirectory('./frontend/app/(app)/leadership');
