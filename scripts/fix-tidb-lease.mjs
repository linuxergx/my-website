import fs from 'fs';

const p = 'docs/linux/tidb/01-TiDBday01.md';
let t = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

t = t.replace(
  /\* lease Read\n```ease[\s\S]*?```/,
  `* lease Read

\`\`\`
ease read：10：00发送一个心跳,heartbeat time interval给回应,读取
local read：在election timeout抽期内时间内发生读取,肯定是leader.(10:00-->election)
\`\`\``,
);

// remove trailing orphan fence after 备注
t = t.replace(
  /(#### 备注\n[^\n]+)\n```\s*$/,
  '$1\n',
);

// ensure format md
if (!/^---\n[\s\S]*?format:\s*md/m.test(t)) {
  if (t.startsWith('---\n')) t = t.replace(/^---\n/, '---\nformat: md\n');
  else t = `---\nformat: md\n---\n\n${t}`;
}

fs.writeFileSync(p, t);

// verify fences
const lines = t.split('\n');
let open = null;
let unclosed = 0;
for (let i = 0; i < lines.length; i++) {
  if (/^```/.test(lines[i].trimStart())) {
    if (open === null) open = i + 1;
    else open = null;
  }
}
if (open !== null) {
  unclosed = open;
  t = t.trimEnd() + '\n```\n';
  fs.writeFileSync(p, t);
}
console.log('lease fixed; unclosed was', unclosed || 'none');

// show lease region
const i = t.indexOf('* lease Read');
console.log(t.slice(i, i + 280));
