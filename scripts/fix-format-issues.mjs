import fs from 'fs';
import path from 'path';

const ensureFormatMd = (text) => {
  if (/^---\n[\s\S]*?format:\s*md/m.test(text)) return text;
  if (text.startsWith('---\n')) {
    return text.replace(/^---\n/, '---\nformat: md\n');
  }
  return `---\nformat: md\n---\n\n${text}`;
};

// ---------- Shell: fix awk variables mashed table ----------
{
  const p = 'docs/linux/shell/Linux脚本.md';
  let t = fs.readFileSync(p, 'utf8');
  const old =
    '- **常用内置变量**: | 变量 | 描述 | | :--- | :--- | | `NR` | 当前处理的行号 | | `NF` | 当前行的字段（列）数 | | `$0` | 当前整行的内容 | | `$1`, `$2`... | 第 1、2...列的内容 | | `FS` | 输入字段分隔符 (可用 `-F` 指定) | | `OFS` | **输出**字段分隔符，默认为空格 | | `RS` | **输入**记录（行）分隔符，默认为换行符 | | `ORS` | **输出**记录（行）分隔符，默认为换行符 |';
  const neu = `- **常用内置变量**:

| 变量 | 描述 |
| :--- | :--- |
| \`NR\` | 当前处理的行号 |
| \`NF\` | 当前行的字段（列）数 |
| \`$0\` | 当前整行的内容 |
| \`$1\`, \`$2\`... | 第 1、2...列的内容 |
| \`FS\` | 输入字段分隔符 (可用 \`-F\` 指定) |
| \`OFS\` | **输出**字段分隔符，默认为空格 |
| \`RS\` | **输入**记录（行）分隔符，默认为换行符 |
| \`ORS\` | **输出**记录（行）分隔符，默认为换行符 |`;
  if (t.includes('| 变量 | 描述 | | :--- | :--- |')) {
    t = t.replace(old, neu);
    fs.writeFileSync(p, ensureFormatMd(t));
    console.log('fixed shell awk table');
  } else {
    console.log('shell pattern not found, skip/partial');
  }
}

// ---------- TiDB wiki embed -> md image if file exists, else note ----------
{
  const p = 'docs/linux/tidb/TiDB原厂课程.md';
  let t = fs.readFileSync(p, 'utf8');
  const vaultImg = path.join(
    'D:\\obsdian-gx (2)',
    '01-技术学习',
    '01-Linux运维笔记',
    'Linux笔记',
    'TiDB',
    '62722602-BCB2-4060-B3FD-ABC0918221AF.png',
  );
  const dest = path.join('docs/linux/tidb', '62722602-BCB2-4060-B3FD-ABC0918221AF.png');
  if (fs.existsSync(vaultImg)) {
    fs.copyFileSync(vaultImg, dest);
    t = t.replace(
      '![[62722602-BCB2-4060-B3FD-ABC0918221AF.png]]',
      '![](62722602-BCB2-4060-B3FD-ABC0918221AF.png)',
    );
    console.log('fixed TiDB wiki embed + copied image');
  } else {
    t = t.replace(
      '![[62722602-BCB2-4060-B3FD-ABC0918221AF.png]]',
      '<!-- 原 Obsidian 嵌入，图片未找到: 62722602-BCB2-4060-B3FD-ABC0918221AF.png -->\n',
    );
    console.log('TiDB wiki image missing in vault, commented out');
  }
  // ==highlight== -> <mark> for non-fitness tech docs
  t = t.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  fs.writeFileSync(p, ensureFormatMd(t));
}

// ---------- Obsidian highlight in non-fitness tech docs ----------
const highlightFiles = [
  'docs/linux/ai-infra/ais-bench.md',
  'docs/linux/ai-infra/confusion-matrix.md',
  'docs/linux/ai-infra/hami-mineru-k8s.md',
  'docs/linux/ai-infra/llm-acp-notes.md',
  'docs/linux/dameng/backup-restore.md',
  'docs/linux/docker-k8s/k8s-vm-clone-migration.md',
  'docs/linux/quiz/interview-linux-k8s.md',
];
for (const p of highlightFiles) {
  if (!fs.existsSync(p)) continue;
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  t = t.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  t = ensureFormatMd(t);
  if (t !== before) {
    fs.writeFileSync(p, t);
    console.log('highlight->mark', p);
  }
}

console.log('batch done');
