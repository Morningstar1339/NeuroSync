// fix-timers.js
// Auto-fix NodeJS.Timeout timer types for React Native / Expo

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();

const exts = ['.ts', '.tsx'];

let filesScanned = 0;
let filesModified = 0;

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  if (!exts.includes(ext)) return false;

  // You can exclude some folders if you want, e.g. node_modules, .expo, etc.
  if (filePath.includes('node_modules')) return false;
  if (filePath.includes('.expo')) return false;
  if (filePath.includes('dist')) return false;
  if (filePath.includes('build')) return false;

  return true;
}

function processFile(filePath) {
  if (!shouldProcessFile(filePath)) return;

  let text = fs.readFileSync(filePath, 'utf8');
  const original = text;

  // 1) Change useRef<NodeJS.Timeout | null> to useRef<number | null>
  text = text.replace(
    /useRef<NodeJS\.Timeout\s*\|\s*null>/g,
    'useRef<number | null>'
  );

  // 2) Change variable declarations like:
  //    let foo: NodeJS.Timeout | null = null;
  //    const bar: NodeJS.Timeout | null = null;
  text = text.replace(
    /(:\s*)NodeJS\.Timeout\s*\|\s*null/g,
    '$1number | null'
  );

  // 3) Remove trailing casts like:  ) as NodeJS.Timeout;
  text = text.replace(
    /\s+as\s+NodeJS\.Timeout\b/g,
    ''
  );

  if (text !== original) {
    fs.writeFileSync(filePath, text, 'utf8');
    filesModified += 1;
    console.log(`Modified: ${filePath}`);
  }

  filesScanned += 1;
}

function walkDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else {
      processFile(fullPath);
    }
  }
}

console.log('Starting timer type auto-fix from:', ROOT_DIR);
walkDir(ROOT_DIR);
console.log('Done.');
console.log(`Files scanned:   ${filesScanned}`);
console.log(`Files modified:  ${filesModified}`);
