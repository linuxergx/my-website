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

const strip = (md) =>
  md
    .replace(/^---[\s\S]*?---\n/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_|`\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const chineseChars = (s) => (s.match(/[\u4e00-\u9fff]/g) || []).length;

const files = walk('docs');
const rows = [];

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const body = raw.replace(/^---[\s\S]*?---\n/, '');
  const plain = strip(raw);
  const lines = body.split(/\n/).filter((l) => l.trim());
  const headings = lines.filter((l) => /^#+\s/.test(l)).length;
  const zh = chineseChars(plain);
  const enWords = (plain.match(/[A-Za-z]{3,}/g) || []).length;
  const latexCmds = (body.match(/\\[a-zA-Z]+/g) || []).length;
  const proseScore = zh + enWords;
  const tableLines = (body.match(/^\|/gm) || []).length;
  const mostlyTable = tableLines > lines.length * 0.35 && zh < 180;
  const thin = plain.length < 220 || zh < 90;
  const latexHeavy = latexCmds > 12 && zh < 220;
  const stubHeadings = headings >= 2 && zh < 120;
  const almostEmpty = proseScore < 60;

  // missing images referenced
  const imgRefs = [...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  let missingImgs = 0;
  for (const ref of imgRefs) {
    if (/^https?:/i.test(ref) || ref.startsWith('/')) continue;
    const abs = ref.startsWith('@site/')
      ? path.join(process.cwd(), ref.replace('@site/', ''))
      : path.join(path.dirname(f), ref);
    if (!fs.existsSync(abs)) missingImgs++;
  }

  const flags = [];
  if (almostEmpty) flags.push('almost-empty-prose');
  if (thin) flags.push('thin');
  if (latexHeavy) flags.push('latex-cheat-heavy');
  if (mostlyTable) flags.push('mostly-table');
  if (stubHeadings) flags.push('stub-headings');
  if (missingImgs > 0) flags.push(`missing-imgs:${missingImgs}`);

  // preview first non-empty prose
  const preview = plain.slice(0, 80);

  rows.push({
    f: f.replace(/\\/g, '/'),
    bytes: raw.length,
    zh,
    proseScore,
    latexCmds,
    headings,
    lines: lines.length,
    missingImgs,
    flags: flags.join('|') || 'ok',
    preview,
  });
}

rows.sort((a, b) => a.proseScore - b.proseScore);

console.log('TOTAL docs', rows.length);
console.log('\n=== 可疑（有内容但实质偏空 / 公式说明书 / 缺图）===');
const bad = rows.filter((r) => r.flags !== 'ok');
for (const r of bad) {
  console.log(`\n- ${r.f}`);
  console.log(
    `  score=${r.proseScore} zh=${r.zh} bytes=${r.bytes} lines=${r.lines} flags=${r.flags}`,
  );
  console.log(`  preview: ${r.preview}`);
}

console.log('\n=== 正文得分最低 12 篇（含 ok，便于对照）===');
for (const r of rows.slice(0, 12)) {
  console.log(
    `${String(r.proseScore).padStart(4)} | zh${String(r.zh).padStart(4)} | ${r.flags.padEnd(28)} | ${r.f}`,
  );
}
