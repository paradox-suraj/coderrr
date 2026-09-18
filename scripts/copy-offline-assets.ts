import fs from 'fs';
import path from 'path';

console.log('📦 Syncing offline execution assets (Pyodide & Monaco)...');

const pyodideSrc = path.resolve(__dirname, '../node_modules/pyodide');
const pyodideDest = path.resolve(__dirname, '../public/pyodide');

const monacoSrc = path.resolve(__dirname, '../node_modules/monaco-editor/min/vs');
const monacoDest = path.resolve(__dirname, '../public/monaco/vs');

// 1. Sync Pyodide
if (fs.existsSync(pyodideSrc)) {
  fs.mkdirSync(pyodideDest, { recursive: true });
  const pyodideFiles = [
    'pyodide.js',
    'pyodide.asm.js',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
  ];
  for (const file of pyodideFiles) {
    const srcFile = path.join(pyodideSrc, file);
    const destFile = path.join(pyodideDest, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
    }
  }
  console.log('✅ Pyodide distribution copied to public/pyodide/');
} else {
  console.warn('⚠️ node_modules/pyodide not found.');
}

// 2. Sync Monaco vs directory
if (fs.existsSync(monacoSrc)) {
  fs.mkdirSync(monacoDest, { recursive: true });
  fs.cpSync(monacoSrc, monacoDest, { recursive: true });
  console.log('✅ Monaco editor vs distribution copied to public/monaco/vs/');
} else {
  console.warn('⚠️ node_modules/monaco-editor/min/vs not found.');
}

console.log('🎉 Offline runtime assets synced successfully.');
