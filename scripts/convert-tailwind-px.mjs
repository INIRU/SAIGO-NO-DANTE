import fs from 'fs';
import { execSync } from 'child_process';

const files = execSync('find app components -name "*.tsx" -o -name "*.ts"', { encoding: 'utf8' }).trim().split('\n');

let totalChanges = 0;
const changes = {};

for (const file of files) {
  if (!file) continue;
  const content = fs.readFileSync(file, 'utf8');
  let count = 0;
  const result = content.replace(/text-\[(\d+)px\]/g, (match, px) => {
    const val = parseFloat(px);
    const rem = val / 16;
    let remStr;
    if (rem === Math.round(rem)) remStr = rem.toFixed(0);
    else if (rem * 10000 === Math.round(rem * 10000)) remStr = rem.toFixed(4);
    else remStr = rem.toFixed(4);
    remStr = remStr.replace(/0+$/, '').replace(/\.$/, '');
    count++;
    return `text-[${remStr}rem]`;
  });
  if (count > 0) {
    fs.writeFileSync(file, result);
    changes[file] = count;
    totalChanges += count;
  }
}

console.log('Total changes:', totalChanges);
for (const [f, c] of Object.entries(changes)) {
  console.log(`  ${f}: ${c}`);
}
