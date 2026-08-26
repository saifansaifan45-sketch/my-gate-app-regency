const fs = require('fs');

const file = fs.readFileSync('./frontend/app/(app)/leadership/tickets.tsx', 'utf8');
const lines = file.split('\n');
lines.forEach((line, index) => {
  if (line.includes('&&')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
