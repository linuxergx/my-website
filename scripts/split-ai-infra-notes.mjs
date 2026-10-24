/**
 * Re-import AI notes as separate docs; restore math braces.
 */
import fs from 'fs';
import path from 'path';

const desk = path.join(process.env.USERPROFILE, 'Desktop');
const acp = path.join(desk, '大模型ACP');
const downloads = path.join(process.env.USERPROFILE, 'Downloads');
const outDir = path.join('docs', 'linux', 'ai-infra');
const imgDir = path.join(outDir, 'images');

fs.mkdirSync(imgDir, {recursive: true});

const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

const rewriteImages = (md) =>
  md.replace(
    /(!?\[[^\]]*\]\()(?!https?:|\/|@site\/|images\/|#)([^)]+\.(?:png|jpg|jpeg|gif|webp))(\))/gi,
    '$1images/$2$3',
  );

const writeDoc = (name, frontmatter, body) => {
  // restore \{ \} broken by earlier MDX sanitize (needed for KaTeX)
  body = body.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
  // Obsidian highlight → mark
  body = body.replace(/==([^=]+)==/g, '<mark>$1</mark>');
  const content = `---\n${frontmatter}\n---\n\n${body.trim()}\n`;
  fs.writeFileSync(path.join(outDir, name), content, 'utf8');
  console.log('wrote', name);
};

// copy ACP images
for (const name of fs.readdirSync(acp)) {
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(name)) {
    fs.copyFileSync(path.join(acp, name), path.join(imgDir, name));
  }
}

// --- separate: 混淆矩阵 ---
{
  let body = rewriteImages(read(path.join(acp, '混淆矩阵.md')));
  body = body.replace(/^#\s+.+\n+/, '');
  writeDoc(
    'confusion-matrix.md',
    `sidebar_position: 4
title: 混淆矩阵与分类指标
format: md`,
    `# 混淆矩阵与分类指标\n\n${body}`,
  );
}

// --- separate: 调和平均 ---
{
  let body = rewriteImages(read(path.join(acp, '关于调和平均的应用笔记.md')));
  body = body.replace(/^#\s+.+\n+/, '');
  writeDoc(
    'harmonic-mean.md',
    `sidebar_position: 5
title: 调和平均的应用笔记
format: md`,
    `# 调和平均的应用笔记\n\n${body}`,
  );
}

// --- separate: 线性插值（Downloads） ---
{
  const src = path.join(downloads, '线性插值计算模型输入输出的方法.md');
  let body = read(src);
  body = body.replace(/^#\s+.+\n+/, '');
  // self-close <br> for safety even with format md
  body = body.replace(/<br\s*>/gi, '<br />');
  writeDoc(
    'linear-interpolation-capacity.md',
    `sidebar_position: 6
title: 线性插值计算模型输入输出的方法
format: md`,
    `# 线性插值计算模型输入输出的方法\n\n${body}`,
  );
}

// --- ACP 汇总：只保留大模型一/二/三 + 新增题目 ---
{
  const parts = [
    ['大模型一.md', '大模型基础（一）'],
    ['大模型二.md', '大模型基础（二）'],
    ['大模型三.md', '大模型基础（三）'],
    ['新增题目.md', '补充题目'],
  ].map(([file, title]) => {
    let t = rewriteImages(read(path.join(acp, file)));
    t = t.replace(/^#\s+.+\n+/, '');
    return `## ${title}\n\n${t.trim()}`;
  });

  writeDoc(
    'llm-acp-notes.md',
    `sidebar_position: 3
title: 大模型 ACP 题库笔记
format: md`,
    `# 大模型 ACP 题库笔记\n\n备考题与知识点整理（不含混淆矩阵、调和平均等专题文，那些已单独成篇）。\n\n${parts.join('\n\n---\n\n')}`,
  );
}

console.log('done');
