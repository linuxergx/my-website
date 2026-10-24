import fs from 'fs';

const p = 'docs/linux/tidb/01-TiDBday01.md';
let t = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const lines = t.split('\n');

let state = 'closed';
let fixed = 0;
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trimStart();
  if (!trimmed.startsWith('```')) continue;
  if (state === 'closed') {
    state = 'open';
  } else {
    // closer must be plain ```
    if (trimmed !== '```') {
      lines[i] = '```';
      fixed++;
    }
    state = 'closed';
  }
}

if (state === 'open') {
  lines.push('```');
  fixed++;
}

t = lines.join('\n');
if (!/^---\n[\s\S]*?format:\s*md/m.test(t)) {
  t = `---\nformat: md\n---\n\n${t}`;
}

fs.writeFileSync(p, t);
console.log('normalized closers, fixes:', fixed);

// verify
state = 'closed';
let opens = 0;
for (const line of t.split('\n')) {
  if (line.trimStart().startsWith('```')) {
    if (state === 'closed') {
      state = 'open';
      opens++;
    } else state = 'closed';
  }
}
console.log('final state', state, 'pairs roughly', opens);
