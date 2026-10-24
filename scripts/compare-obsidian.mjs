import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const vault = 'D:\\obsdian-gx (2)';
const siteDocs = 'docs';

const walk = (d, acc = []) => {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.trash', '.obsidian'].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.md$/i.test(e.name)) acc.push(p);
  }
  return acc;
};

const norm = (s) =>
  s
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/^---\n[\s\S]*?\n---\n+/, '') // strip site frontmatter
    .trim();

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

const vaultFiles = walk(vault);
const siteFiles = walk(siteDocs);

console.log('vault md:', vaultFiles.length, 'site md:', siteFiles.length);

// index vault by basename
const byBase = new Map();
for (const f of vaultFiles) {
  const base = path.basename(f);
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(f);
}

const pairs = [];
for (const site of siteFiles) {
  const base = path.basename(site);
  const cands = byBase.get(base) || [];
  if (!cands.length) {
    pairs.push({site, vault: null, status: 'NO_BASENAME_MATCH'});
    continue;
  }
  const siteBody = norm(fs.readFileSync(site, 'utf8'));
  let best = null;
  for (const v of cands) {
    const vb = norm(fs.readFileSync(v, 'utf8'));
    const same = siteBody === vb;
    // rough similarity: shared length ratio via simple approach
    const a = siteBody.length;
    const b = vb.length;
    const lenRatio = a && b ? Math.min(a, b) / Math.max(a, b) : 0;
    const score = same ? 1 : lenRatio;
    if (!best || score > best.score) {
      best = {
        vault: v,
        same,
        score,
        siteLen: a,
        vaultLen: b,
        siteHash: hash(siteBody),
        vaultHash: hash(vb),
      };
    }
  }
  pairs.push({
    site,
    ...best,
    status: best.same
      ? 'IDENTICAL'
      : best.score > 0.9
        ? 'NEAR_LEN'
        : best.score > 0.5
          ? 'PARTIAL'
          : 'DIVERGED',
  });
}

const summary = {};
for (const p of pairs) {
  summary[p.status] = (summary[p.status] || 0) + 1;
}
console.log('\n=== Summary by status ===');
console.log(summary);

console.log('\n=== IDENTICAL (sample up to 15) ===');
pairs
  .filter((p) => p.status === 'IDENTICAL')
  .slice(0, 15)
  .forEach((p) =>
    console.log('OK', path.relative(siteDocs, p.site), '<=', path.relative(vault, p.vault)),
  );

console.log('\n=== DIVERGED / PARTIAL / NEAR (need attention) ===');
for (const p of pairs.filter((p) =>
  ['DIVERGED', 'PARTIAL', 'NEAR_LEN'].includes(p.status),
)) {
  console.log(
    p.status,
    `site=${p.siteLen} vault=${p.vaultLen} ratio=${p.score.toFixed(2)}`,
  );
  console.log('  site :', path.relative(siteDocs, p.site));
  console.log('  vault:', path.relative(vault, p.vault));
}

console.log('\n=== NO_BASENAME_MATCH (site-only or renamed) ===');
for (const p of pairs.filter((p) => p.status === 'NO_BASENAME_MATCH')) {
  console.log('-', path.relative(siteDocs, p.site));
}

// Focus compare for known restored/imported titles
console.log('\n=== Focus: search vault for key titles ===');
const keys = [
  '混淆矩阵',
  '线性插值',
  'ais_bench',
  'hami-mineru',
  'Zabbix',
  'zabbix',
  'conntrack',
  'GPU-PV',
  'QEMU',
  'eBPF',
  '面试复习',
  '达梦',
  '训练计划',
  '碳循环',
  'TiDBday01',
  'Docker笔记',
];
for (const k of keys) {
  const hits = vaultFiles.filter((f) => f.includes(k) || path.basename(f).includes(k));
  if (!hits.length) {
    console.log(`MISS in vault: ${k}`);
    continue;
  }
  console.log(`\n[${k}] ${hits.length} hit(s)`);
  hits.slice(0, 5).forEach((h) => console.log(' ', path.relative(vault, h)));
}
