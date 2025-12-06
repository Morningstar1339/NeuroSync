// scripts/fix-test-apos.js

const fs = require('fs');
const path = require('path');

// FIXED PATH — go up one folder first
const testsDir = path.join(__dirname, '..', 'app', 'tests');

function processFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // 1) Fix (... &apos;VALUE&apos;) pattern
  code = code.replace(/\(&apos;([^']*)&apos;\)/g, "('$1')");

  // 2) Fix (..., &apos;VALUE&apos;, ...)
  code = code.replace(/(\(|,\s*)&apos;([^']*)&apos;(?=[),])/g, "$1'$2'");

  // 3) Type unions & assignments
  code = code.replace(/([=|,]\s*)&apos;([^']*)&apos;/g, "$1'$2'");

  // 4) Ternaries
  code = code.replace(/(\?\s*)&apos;([^']*)&apos;/g, "$1'$2'");
  code = code.replace(/(:\s*)&apos;([^']*)&apos;/g, "$1'$2'");

  if (code !== original) {
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Fixed:', path.relative(process.cwd(), filePath));
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.tsx')) processFile(full);
  }
}

console.log('Scanning tests in:', testsDir);
walk(testsDir);
console.log('Done.');
