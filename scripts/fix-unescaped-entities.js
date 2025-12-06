// scripts/fix-unescaped-entities.js
// Run with: node scripts/fix-unescaped-entities.js

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const PATTERN = 'app/**/*.tsx'; // adjust/expand if you want

function fixFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace text between > and < when it does NOT contain { or }
  const updated = original.replace(/>([^<]+)</g, (match, text) => {
    // If there is JSX expression inside, skip (too risky to auto-edit)
    if (text.includes('{') || text.includes('}')) {
      return match;
    }

    const newText = text
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;');

    if (newText !== text) {
      changed = true;
      return '>' + newText + '<';
    }

    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

function main() {
  const files = glob.sync(PATTERN, {
    absolute: true,
  });

  if (files.length === 0) {
    console.log('No .tsx files found matching pattern', PATTERN);
    return;
  }

  console.log(`Scanning ${files.length} files for unescaped JSX text entities...`);

  files.forEach((file) => {
    fixFile(file);
  });

  console.log('Done.');
}

main();
