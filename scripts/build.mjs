import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
await fs.copyFile('src/style.css', 'dist/style.css');
console.log('Built ESM, declarations and CSS in dist/');
