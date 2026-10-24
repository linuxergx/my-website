import fs from 'fs';
import path from 'path';

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.mdx?$/i.test(e.name)) acc.push(p);
  }
  return acc;
};

const resolveImg = (mdFile, ref) => {
  if (/^https?:\/\//i.test(ref)) return {ok: true, kind: 'remote'};
  if (ref.startsWith('/')) {
    const p = path.join('static', ref.replace(/^\//, ''));
    return {ok: fs.existsSync(p), kind: 'static', path: p};
  }
  if (ref.startsWith('@site/')) {
    const p = path.join(process.cwd(), ref.replace('@site/', ''));
    return {ok: fs.existsSync(p), kind: 'site', path: p};
  }
  const p = path.join(path.dirname(mdFile), decodeURIComponent(ref.split('?')[0]));
  return {ok: fs.existsSync(p), kind: 'rel', path: p};
};

const issues = [];
const add = (file, type, detail, line) => {
  issues.push({
    file: file.replace(/\\/g, '/'),
    type,
    detail,
    line: line || null,
  });
};

const files = walk('docs');

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const text = raw.replace(/^\uFEFF/, '');
  const lines = text.split(/\n/);

  // --- missing images ---
  for (let i = 0; i < lines.length; i++) {
    const imgs = [...lines[i].matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)];
    for (const m of imgs) {
      const ref = m[1];
      const r = resolveImg(file, ref);
      if (!r.ok) add(file, 'missing-image', ref, i + 1);
    }
  }

  // --- unclosed code fences ---
  const fenceLines = [];
  lines.forEach((l, i) => {
    if (/^(`{3,}|~{3,})/.test(l.trim())) fenceLines.push(i + 1);
  });
  if (fenceLines.length % 2 === 1) {
    add(
      file,
      'unclosed-code-fence',
      `奇数个代码围栏(${fenceLines.length})，可能未闭合；起止行约: ${fenceLines.slice(0, 6).join(',')}`,
      fenceLines[fenceLines.length - 1],
    );
  }

  // --- extract code blocks and check for markdown tables inside ---
  const fenceRe = /^(`{3,}|~{3,})(.*)$/;
  let inFence = false;
  let fenceLang = '';
  let fenceStart = 0;
  let fenceBody = [];
  const checkFence = () => {
    const body = fenceBody.join('\n');
    const tableRows = (body.match(/^\|.+\|$/gm) || []).length;
    if (tableRows >= 3) {
      add(
        file,
        'table-inside-code',
        `代码块(lang=${fenceLang || '无'})内疑似 Markdown 表格 ${tableRows} 行`,
        fenceStart,
      );
    }
    // HTML table dumped as plain text inside code
    if (/<table[\s>]/i.test(body) && fenceLang && !/html|xml|svg/i.test(fenceLang)) {
      add(
        file,
        'html-table-inside-code',
        `非 html 语言代码块内含 <table>`,
        fenceStart,
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(fenceRe);
    if (m) {
      if (!inFence) {
        inFence = true;
        fenceLang = (m[2] || '').trim();
        fenceStart = i + 1;
        fenceBody = [];
      } else {
        inFence = false;
        checkFence();
      }
      continue;
    }
    if (inFence) fenceBody.push(lines[i]);
  }

  // --- broken / messy tables outside code ---
  inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^(`{3,}|~{3,})/.test(lines[i].trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const l = lines[i];
    // table row with almost empty cells pattern but header suggests data expected - soft signal
    if (/^\|([^|]*\|){2,}$/.test(l.trim())) {
      const cells = l.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 3 && cells.every((c) => c === '' || c === '---' || /^:?-+:?$/.test(c))) {
        // separator or empty - check if previous was header and next empty data
      }
      const nonEmpty = cells.filter((c) => c && !/^:?-+:?$/.test(c));
      if (cells.length >= 4 && nonEmpty.length <= 1 && i > 0) {
        // likely empty data row
        const prev = lines[i - 1] || '';
        if (/^\|/.test(prev) && !/^:?-+:?/.test(prev.split('|')[1] || '')) {
          add(file, 'empty-table-row', l.trim().slice(0, 80), i + 1);
        }
      }
    }

    // many pipes but not starting as table - mashed content
    if ((l.match(/\|/g) || []).length >= 6 && !/^\|/.test(l.trim()) && l.length > 80) {
      add(file, 'pipes-not-table', l.trim().slice(0, 100), i + 1);
    }
  }

  // --- paragraph mashed: very long line without breaks ---
  inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^(`{3,}|~{3,})/.test(lines[i].trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const l = lines[i];
    if (l.length > 500 && !/^\|/.test(l) && !l.trimStart().startsWith('![')) {
      add(
        file,
        'super-long-line',
        `行长 ${l.length}，疑似段落未断行/粘连`,
        i + 1,
      );
    }
    // Chinese headings glued: ####foo without space already caught; look for 。。 dense
    if (l.length > 200 && (l.match(/。/g) || []).length >= 8 && !/^\|/.test(l)) {
      add(file, 'dense-sentences-one-line', `一行内 ${(l.match(/。/g) || []).length} 个句号`, i + 1);
    }
  }

  // --- broken links to local md ---
  inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^(`{3,}|~{3,})/.test(lines[i].trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of lines[i].matchAll(/\[[^\]]*\]\(([^)]+\.md[^)]*)\)/g)) {
      let ref = decodeURIComponent(m[1].split('#')[0]);
      if (/^https?:/i.test(ref)) continue;
      const target = path.join(path.dirname(file), ref);
      if (!fs.existsSync(target)) {
        add(file, 'broken-md-link', m[1], i + 1);
      }
    }
  }

  // --- raw HTML tables outside code (ok for format md, but flag huge one-liners) ---
  inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^(`{3,}|~{3,})/.test(lines[i].trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/<table[\s>]/i.test(lines[i]) && lines[i].length > 300) {
      add(file, 'html-table-one-liner', `HTML 表格挤在一行(len=${lines[i].length})`, i + 1);
    }
  }

  // --- Obsidian leftovers ---
  if (/!\[\[/.test(text)) add(file, 'obsidian-embed', '含 ![[wiki 嵌入]]，Docusaurus 默认不渲染');
  if (/==[^=\n]+==/.test(text)) add(file, 'obsidian-highlight', '含 ==高亮== 语法，站点不会高亮');
}

// group report
const byType = {};
for (const it of issues) {
  byType[it.type] = (byType[it.type] || 0) + 1;
}

console.log('Scanned', files.length, 'docs');
console.log('\n=== 问题计数 ===');
Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(String(v).padStart(4), k));

const order = [
  'missing-image',
  'unclosed-code-fence',
  'table-inside-code',
  'html-table-inside-code',
  'html-table-one-liner',
  'empty-table-row',
  'super-long-line',
  'dense-sentences-one-line',
  'pipes-not-table',
  'broken-md-link',
  'obsidian-embed',
  'obsidian-highlight',
];

for (const type of order) {
  const list = issues.filter((i) => i.type === type);
  if (!list.length) continue;
  console.log(`\n=== ${type} (${list.length}) ===`);
  // group by file
  const byFile = {};
  for (const it of list) {
    byFile[it.file] = byFile[it.file] || [];
    byFile[it.file].push(it);
  }
  for (const [f, items] of Object.entries(byFile)) {
    console.log(`\n${f}`);
    for (const it of items.slice(0, 8)) {
      console.log(`  L${it.line || '?'}: ${it.detail}`);
    }
    if (items.length > 8) console.log(`  ... +${items.length - 8} more`);
  }
}

// write json for later
fs.writeFileSync(
  'scripts/audit-doc-format.report.json',
  JSON.stringify({count: issues.length, byType, issues}, null, 2),
);
console.log('\nReport written scripts/audit-doc-format.report.json');
