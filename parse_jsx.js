const fs = require('fs');
const path = require('path');

function searchDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Let's just strip out all <Text>...</Text> blocks to make it easier to find other text
      let stripped = content.replace(/<Text[^>]*>[\s\S]*?<\/Text>/g, '');
      // Strip comments
      stripped = stripped.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      
      // Now look for any non-whitespace text between > and <
      let match;
      const regex = />([^<]+)</g;
      while ((match = regex.exec(stripped)) !== null) {
        const text = match[1].trim();
        if (text.length > 0) {
          console.log(`Found text node in ${fullPath}: "${text}"`);
        }
      }
    }
  }
}

searchDirectory('./frontend/app');
