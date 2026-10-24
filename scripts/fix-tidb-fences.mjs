import fs from 'fs';

const p = 'docs/linux/tidb/01-TiDBday01.md';
const lines = fs.readFileSync(p, 'utf8').split(/\n/);
let open = null;
const stack = [];
for (let i = 0; i < lines.length; i++) {
  if (/^```/.test(lines[i].trimStart())) {
    if (open === null) {
      open = i;
      stack.push({open: i + 1, head: lines[i].slice(0, 80)});
    } else {
      stack[stack.length - 1].close = i + 1;
      open = null;
    }
  }
}
const unclosed = stack.filter((s) => !s.close);
console.log('pairs', stack.filter((s) => s.close).length, 'unclosed', unclosed.length);
console.log(JSON.stringify(unclosed, null, 2));

// Fix known garbage fence opener that glued prose into lang tag
// ```ease read：... should be a normal prose/code split
let t = fs.readFileSync(p, 'utf8');
const bad =
  '```ease read：10：00发送⼀个⼼跳,heartbeat time interval给回应,读取\nlocal read：在election timeout抽期内时间内发⽣读取,肯定是leader.(10:00-->election)ease read：10：00发送⼀个⼼跳,heartbeat time interval给回应,读取\nlocal read：在election timeout抽期内时间内发⽣读取,肯定是leader.(10:00-->election)\n```';

const good = `* lease Read

\`\`\`
ease read：10：00发送一个心跳,heartbeat time interval给回应,读取
local read：在election timeout抽期内时间内发生读取,肯定是leader.(10:00-->election)
\`\`\`
`;

if (t.includes('```ease read')) {
  // more resilient replace
  t = t.replace(
    /\* lease Read\n```ease read[\s\S]*?```/,
    good.trim(),
  );
  console.log('rewrote lease Read fence');
}

// If still odd fences, append closing at EOF for last open
const lines2 = t.split(/\n/);
let open2 = null;
let lastOpen = -1;
for (let i = 0; i < lines2.length; i++) {
  if (/^```/.test(lines2[i].trimStart())) {
    if (open2 === null) {
      open2 = i;
      lastOpen = i;
    } else open2 = null;
  }
}
if (open2 !== null) {
  t = t.trimEnd() + '\n```\n';
  console.log('appended closing fence for open at', lastOpen + 1);
}

if (!/^---\n/.test(t) || !/format:\s*md/.test(t.slice(0, 80))) {
  if (t.startsWith('---\n')) t = t.replace(/^---\n/, '---\nformat: md\n');
  else t = `---\nformat: md\n---\n\n${t}`;
}

fs.writeFileSync(p, t);
console.log('saved', p);
