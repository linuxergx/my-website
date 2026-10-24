import fs from 'fs';

const p = 'docs/linux/tidb/01-TiDBday01.md';
const t = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const lines = t.split('\n');
let state = 'closed';
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('```')) {
    const prev = state;
    state = state === 'closed' ? 'open' : 'closed';
    console.log(
      String(i + 1).padStart(4),
      prev,
      '->',
      state,
      JSON.stringify(trimmed.slice(0, 50)),
    );
  }
}
console.log('FINAL', state);
if (state === 'open') {
  fs.writeFileSync(p, t.trimEnd() + '\n```\n');
  console.log('appended closer');
}
