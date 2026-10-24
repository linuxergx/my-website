import fs from 'fs';

const p = 'docs/linux/server-ops/zabbix-notes.md';
let s = fs.readFileSync(p, 'utf8');

// Use CommonMark instead of MDX so HTML tables don't fight JSX/emphasis parsing
if (!/^---\n[\s\S]*?format:\s*md/m.test(s)) {
  if (s.startsWith('---\n')) {
    s = s.replace(/^---\n/, '---\nformat: md\n');
  } else {
    s = `---\nformat: md\ntitle: Zabbix 笔记\nsidebar_position: 3\n---\n\n${s}`;
  }
}

// Neutralize markdown punctuation inside HTML tables (belt & suspenders)
s = s.replace(/<table\b[\s\S]*?<\/table>/gi, (table) =>
  table
    .replace(/~/g, '～')
    .replace(/\*/g, '∗')
    .replace(/(?<![A-Za-z0-9])_(?![A-Za-z0-9])/g, '＿')
    .replace(/`/g, "'"),
);

fs.writeFileSync(p, s);
console.log('format md:', /^---\nformat:\s*md/m.test(s));
console.log('tables:', (s.match(/<table\b/gi) || []).length);
