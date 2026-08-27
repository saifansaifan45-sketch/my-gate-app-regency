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
      
      let inJSX = false;
      let openTags = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Let's just use regex to look for bare text between tags
        // like > something < where something is not just whitespace and not starting with { or <
        
        let matches = line.match(/>([^<{]+)</g);
        if (matches) {
          for (let m of matches) {
            let inner = m.substring(1, m.length - 1).trim();
            if (inner.length > 0) {
              console.log(`Possible bare text in ${fullPath}:${i + 1}: ${m}`);
            }
          }
        }
      }
    }
  }
}

searchDirectory('./frontend/app/(app)/leadership');
