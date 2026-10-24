/**
 * One-shot migration: flatten docs into linux/ + fitness/, emit redirect map.
 * Run: node scripts/migrate-docs.mjs
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const docsRoot = path.join(root, 'docs');

const ensureDir = (dir) => fs.mkdirSync(dir, {recursive: true});

const copyRecursive = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
};

const rmRecursive = (target) => {
  if (fs.existsSync(target)) {
    fs.rmSync(target, {recursive: true, force: true});
  }
};

/** doc route without /docs prefix and without .md */
const toDocId = (absMdPath) => {
  const rel = path.relative(docsRoot, absMdPath).replace(/\\/g, '/');
  return rel.replace(/\.mdx?$/i, '');
};

const moves = [
  // linux topics
  ['01-Linux运维笔记/Linux笔记/Ansible', 'linux/ansible'],
  ['01-Linux运维笔记/Linux笔记/Nginx', 'linux/nginx'],
  ['01-Linux运维笔记/Linux笔记/shell、正则、脚本', 'linux/shell'],
  ['01-Linux运维笔记/Linux笔记/容器 k8s、docker', 'linux/docker-k8s'],
  ['01-Linux运维笔记/Linux笔记/Tomcat', 'linux/tomcat'],
  ['01-Linux运维笔记/Linux笔记/数据库MySQL', 'linux/mysql'],
  ['01-Linux运维笔记/MySQL数据库', 'linux/mysql'],
  ['01-Linux运维笔记/Linux笔记/TiDB', 'linux/tidb'],
  ['01-Linux运维笔记/Linux笔记/服务器运维', 'linux/server-ops'],
  ['01-Linux运维笔记/Linux笔记/运维网络知识', 'linux/networking'],
  ['01-Linux运维笔记/Linux笔记/阿里云', 'linux/aliyun'],
  ['01-Linux运维笔记/Linux笔记/Linux答疑', 'linux/faq'],
  ['01-Linux运维笔记/Linux笔记/随堂测验(Linux)', 'linux/quiz'],
  ['01-Linux运维笔记/计算机英文词汇', 'linux/english-vocab'],
  // fitness
  ['02-运动健身/01-健身笔记/健身笔记', 'fitness/training'],
  ['02-运动健身/02-康复笔记/康复笔记', 'fitness/rehab'],
];

const redirects = [];
const staticExtras = [];

for (const [fromRel, toRel] of moves) {
  const fromDir = path.join(docsRoot, fromRel);
  const toDir = path.join(docsRoot, toRel);
  if (!fs.existsSync(fromDir)) {
    console.warn('SKIP missing:', fromRel);
    continue;
  }

  ensureDir(toDir);

  for (const name of fs.readdirSync(fromDir)) {
    const src = path.join(fromDir, name);
    const dest = path.join(toDir, name);
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
      // e.g. training/images
      copyRecursive(src, dest);
      continue;
    }

    const ext = path.extname(name).toLowerCase();

    // non-doc office files → static/files
    if (ext === '.docx' || ext === '.html') {
      const staticDest = path.join(root, 'static', 'files', path.basename(name));
      ensureDir(path.dirname(staticDest));
      fs.copyFileSync(src, staticDest);
      staticExtras.push({from: src, to: `/files/${path.basename(name)}`});
      continue;
    }

    if (ext === '.md' || ext === '.mdx') {
      const oldId = toDocId(src);
      // if dest exists (mysql merge), keep both files
      let finalDest = dest;
      if (fs.existsSync(finalDest) && path.resolve(src) !== path.resolve(finalDest)) {
        console.warn('DEST exists, keeping both names:', name);
      }
      fs.copyFileSync(src, finalDest);
      const newId = toDocId(finalDest);
      redirects.push({from: `/docs/${oldId}`, to: `/docs/${newId}`});
      continue;
    }

    // images, pdf, etc. stay next to docs so relative links keep working
    fs.copyFileSync(src, dest);
  }
}

// Write redirect map for docusaurus plugin
const redirectOut = path.join(root, 'scripts', 'redirects.generated.json');
fs.writeFileSync(
  redirectOut,
  JSON.stringify(
    {
      redirects,
      // also map common wrong links in welcome.md (without 01- prefix)
      extraFromWelcome: [
        {
          from: '/docs/Linux运维笔记/MySQL数据库/MySQL高可用架构实战手册',
          to: '/docs/linux/mysql/MySQL高可用架构实战手册',
        },
        {
          from: '/docs/Linux运维笔记/Linux笔记/容器 k8s、docker/Docker笔记',
          to: '/docs/linux/docker-k8s/Docker笔记',
        },
        {
          from: '/docs/Linux运维笔记/Linux笔记/Nginx/Nginx 进阶学习笔记',
          to: '/docs/linux/nginx/Nginx 进阶学习笔记',
        },
      ],
      staticExtras,
    },
    null,
    2,
  ),
  'utf8',
);

// Remove old trees
rmRecursive(path.join(docsRoot, '01-Linux运维笔记'));
rmRecursive(path.join(docsRoot, '02-运动健身'));

console.log('Moved topics:', moves.length);
console.log('Redirects:', redirects.length);
console.log('Static extras:', staticExtras.length);
console.log('Wrote', redirectOut);

// Sanity: list new md files
const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.mdx?$/i.test(e.name)) acc.push(path.relative(docsRoot, p).replace(/\\/g, '/'));
  }
  return acc;
};
console.log('New md count:', walk(docsRoot).length);
console.log(walk(docsRoot).join('\n'));
