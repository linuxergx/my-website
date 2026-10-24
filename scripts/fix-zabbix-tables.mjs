import fs from 'fs';

const p = 'docs/linux/server-ops/zabbix-notes.md';
let t = fs.readFileSync(p, 'utf8');

const decode = (s) =>
  s
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const htmlTableToMd = (html) => {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const cells = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c;
    while ((c = cellRe.exec(m[1]))) {
      cells.push(decode(c[1]) || ' ');
    }
    if (cells.length) rows.push(cells);
  }
  if (rows.length < 2) return null;
  const width = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => {
    while (r.length < width) r.push(' ');
    return r;
  });
  const esc = (s) => s.replace(/\|/g, '\\|');
  const header = norm[0].map(esc);
  const sep = header.map(() => '---');
  const body = norm.slice(1).map((r) => r.map(esc));
  return [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
};

let converted = 0;
t = t.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
  const md = htmlTableToMd(table);
  if (!md) return table;
  converted++;
  return `\n\n${md}\n\n`;
});

if (!/^---\n[\s\S]*?format:\s*md/m.test(t)) {
  if (t.startsWith('---\n')) t = t.replace(/^---\n/, '---\nformat: md\n');
  else t = `---\nformat: md\n---\n\n${t}`;
}

fs.writeFileSync(p, t);
console.log('zabbix tables converted', converted);
