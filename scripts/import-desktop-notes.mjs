/**
 * Import & consolidate desktop notes into docs/ + blog/
 * Run: node scripts/import-desktop-notes.mjs
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const desk = path.join(process.env.USERPROFILE, 'Desktop');

const ensureDir = (d) => fs.mkdirSync(d, {recursive: true});
const read = (rel) =>
  fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(desk, rel), 'utf8');
const writeDoc = (rel, body) => {
  const dest = path.join(root, 'docs', rel);
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, body.replace(/\r\n/g, '\n'), 'utf8');
  console.log('DOC', rel);
};
const writeBlog = (name, body) => {
  const dest = path.join(root, 'blog', name);
  fs.writeFileSync(dest, body.replace(/\r\n/g, '\n'), 'utf8');
  console.log('BLOG', name);
};
const copyDir = (src, dest) => {
  ensureDir(dest);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
};
const writeCategory = (rel, data) => {
  const dest = path.join(root, 'docs', rel, '_category_.json');
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('CAT', rel);
};

const stripBom = (s) => s.replace(/^\uFEFF/, '');

/** Remove leading blank lines; ensure single H1 if missing */
const normalizeArticle = (raw, fallbackTitle) => {
  let text = stripBom(raw).replace(/\r\n/g, '\n').trim() + '\n';
  if (!/^#\s+/m.test(text.split('\n').slice(0, 8).join('\n'))) {
    text = `# ${fallbackTitle}\n\n${text}`;
  }
  return text;
};

// ---------- categories ----------
writeCategory('linux/kernel', {
  label: '内核与实验环境',
  position: 3,
  link: {
    type: 'generated-index',
    title: 'Linux 内核与本地实验环境',
    description: 'QEMU/BusyBox、eBPF 等内核实验与调试笔记。',
  },
});
writeCategory('linux/ai-infra', {
  label: 'AI 推理与算力',
  position: 14,
  link: {
    type: 'generated-index',
    title: 'AI 推理与算力基础设施',
    description: 'GPU/NPU 调度、推理压测与大模型相关工程笔记。',
  },
});
writeCategory('linux/dameng', {
  label: '达梦数据库',
  position: 15,
  link: {
    type: 'generated-index',
    title: '达梦数据库',
    description: '达梦（DM）备份恢复等运维实践。',
  },
});

// ---------- 1) K8s 运维短文合并 ----------
{
  const a = normalizeArticle(
    read('K8s 故障排查案例 -conntrack-tools 缺失.md'),
    'K8s 故障排查：conntrack-tools 缺失',
  );
  const b = normalizeArticle(
    read('K8s集群中Pod手动迁移方案.md'),
    'K8s 集群中 Pod 手动迁移方案',
  );
  // demote inner H1 → H2 for parts
  const part = (md, title) => {
    const lines = md.trim().split('\n');
    if (lines[0].startsWith('# ')) lines[0] = '## ' + lines[0].slice(2);
    return `## ${title}\n\n${lines.join('\n').replace(/^## ${title}\n\n## /m, '## ')}\n`;
  };
  // simpler: wrap with section headers
  const body = `---
sidebar_position: 2
title: K8s 运维实战合集（排障与 Pod 迁移）
---

# K8s 运维实战合集

本文汇总两篇短文：**conntrack-tools 缺失排障** 与 **Pod 手动迁移方案**。

---

${a.replace(/^#\s+.+\n+/, '## 一、故障排查：conntrack-tools 缺失\n\n')}

---

${b.replace(/^#\s+.+\n+/, '## 二、Pod 手动迁移方案\n\n')}
`;
  writeDoc('linux/docker-k8s/k8s-ops-cases.md', body);
}

// ---------- 2) K8s 克隆指南（独立长文） ----------
{
  const raw = normalizeArticle(
    read('Kubernetes 虚拟机环境克隆与资源迁移全指南.md'),
    'Kubernetes 虚拟机环境克隆与资源迁移全指南',
  );
  writeDoc(
    'linux/docker-k8s/k8s-vm-clone-migration.md',
    `---
sidebar_position: 3
title: Kubernetes 虚拟机环境克隆与资源迁移全指南
---

${raw}`,
  );
}

// ---------- 3) Hyper-V GPU-PV + NAT 合并 ----------
{
  const a = normalizeArticle(
    read('手搓 Hyper-V Linux 虚拟机 GPU 半虚拟化 (GPU-PV) 实战与踩坑全纪录.md'),
    'Hyper-V Linux GPU-PV 实战',
  );
  const b = normalizeArticle(
    read('手动创建带固定 NAT 的内部交换机.md'),
    '手动创建带固定 NAT 的内部交换机',
  );
  writeDoc(
    'linux/server-ops/hyper-v-gpu-pv-and-nat.md',
    `---
sidebar_position: 2
title: Hyper-V：GPU-PV 与固定 NAT 网络实战
---

# Hyper-V：GPU-PV 与固定 NAT 网络实战

把两篇 Hyper-V 相关笔记合在一起：先讲 **Linux 虚拟机 GPU 半虚拟化**，再附 **固定 NAT 内部交换机** 配置。

---

${a.replace(/^#\s+.+\n+/, '## 一、GPU-PV 实战与踩坑\n\n')}

---

${b.replace(/^#\s+.+\n+/, '## 二、手动创建带固定 NAT 的内部交换机\n\n')}
`,
  );
}

// ---------- 4) HAMi + MinerU ----------
{
  const raw = normalizeArticle(
    read('hami-mineru-k8s-guide.md'),
    'HAMi + MinerU Kubernetes 部署指南',
  );
  writeDoc(
    'linux/ai-infra/hami-mineru-k8s.md',
    `---
sidebar_position: 1
title: HAMi + MinerU 在 K8s 上的部署指南
---

${raw}`,
  );
}

// ---------- 5) ais_bench ----------
{
  const raw = normalizeArticle(
    read('ais_bench性能测试工具使用参考.md'),
    'ais_bench 性能测试工具使用参考',
  );
  writeDoc(
    'linux/ai-infra/ais-bench.md',
    `---
sidebar_position: 2
title: ais_bench 性能测试工具使用参考
---

${raw}`,
  );
}

// ---------- 6) 大模型 ACP 汇总 ----------
{
  const acpDir = path.join(desk, '大模型ACP');
  const order = [
    ['大模型一.md', '大模型基础（一）'],
    ['大模型二.md', '大模型基础（二）'],
    ['大模型三.md', '大模型基础（三）'],
    ['混淆矩阵.md', '混淆矩阵'],
    ['关于调和平均的应用笔记.md', '调和平均的应用'],
    ['新增题目.md', '补充题目'],
  ];
  const parts = order.map(([file, title]) => {
    let t = stripBom(fs.readFileSync(path.join(acpDir, file), 'utf8')).replace(
      /\r\n/g,
      '\n',
    );
    // rewrite local image refs like ](1772600667069.png) → ](images/1772600667069.png)
    t = t.replace(
      /(!?\[[^\]]*\]\()(?!https?:|\/|images\/|#)([^)]+\.(?:png|jpg|jpeg|gif|webp))(\))/gi,
      '$1images/$2$3',
    );
    t = t.replace(/^#\s+.+\n+/, '');
    return `## ${title}\n\n${t.trim()}\n`;
  });
  // copy images from ACP root
  const imgDest = path.join(root, 'docs/linux/ai-infra/images');
  ensureDir(imgDest);
  for (const name of fs.readdirSync(acpDir)) {
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(name)) {
      fs.copyFileSync(path.join(acpDir, name), path.join(imgDest, name));
    }
  }
  writeDoc(
    'linux/ai-infra/llm-acp-notes.md',
    `---
sidebar_position: 3
title: 大模型 ACP 学习笔记（汇总）
---

# 大模型 ACP 学习笔记（汇总）

将桌面「大模型ACP」文件夹中的多篇备考笔记合并为一篇，便于检索与复习。

${parts.join('\n---\n\n')}`,
  );
}

// ---------- 7) QEMU + eBPF → kernel 两篇同目录（系列，不硬揉成一篇超长文） ----------
{
  writeDoc(
    'linux/kernel/qemu-busybox-lab.md',
    `---
sidebar_position: 1
title: 基于 QEMU 与 BusyBox 的 Linux 内核实验环境
---

${normalizeArticle(
  read('构建基于 QEMU 与 BusyBox 的 Linux 内核本地开发与调试环境.md'),
  '基于 QEMU 与 BusyBox 的 Linux 内核实验环境',
)}`,
  );
  writeDoc(
    'linux/kernel/ebpf-lab-linux72.md',
    `---
sidebar_position: 2
title: Linux 7.2 + eBPF 实验场构建指南
---

${normalizeArticle(
  read(
    path.join(
      desk,
      '电网大模型项目规范文档',
      'Linux 7.2 + eBPF 实验场构建全景实战指南.md',
    ),
  ),
  'Linux 7.2 + eBPF 实验场构建指南',
)}`,
  );
}

// ---------- 8) 面试复习 → quiz ----------
{
  writeDoc(
    'linux/quiz/interview-linux-k8s.md',
    `---
sidebar_position: 2
title: 面试复习：Linux 与 Kubernetes
---

${normalizeArticle(
  read('面试复习-Linux与K8s运维.md'),
  '面试复习：Linux 与 Kubernetes',
)}`,
  );
}

// ---------- 9) 达梦 + assets ----------
{
  const srcMd = path.join(
    desk,
    '达梦8数据库备份与恢复流程',
    '达梦8数据库备份与恢复.md',
  );
  let md = stripBom(fs.readFileSync(srcMd, 'utf8')).replace(/\r\n/g, '\n');
  const assetsSrc = path.join(
    desk,
    '达梦8数据库备份与恢复流程',
    '达梦8数据库备份与恢复.assets',
  );
  const assetsDest = path.join(root, 'docs/linux/dameng/images');
  if (fs.existsSync(assetsSrc)) {
    copyDir(assetsSrc, assetsDest);
    md = md.replace(/达梦8数据库备份与恢复\.assets\//g, 'images/');
  }
  writeDoc(
    'linux/dameng/backup-restore.md',
    `---
sidebar_position: 1
title: 达梦 8 数据库备份与恢复
---

${normalizeArticle(md, '达梦 8 数据库备份与恢复')}`,
  );
}

// ---------- 10) Zabbix → server-ops ----------
{
  writeDoc(
    'linux/server-ops/zabbix-notes.md',
    `---
sidebar_position: 3
title: Zabbix 笔记
---

${normalizeArticle(read(path.join(desk, 'zabbix_parsed', 'zabbix.md')), 'Zabbix 笔记')}`,
  );
}

// ---------- 11) Blog: 技术已死 ----------
{
  const raw = normalizeArticle(
    read(path.join(desk, '技术已死？真的死了吗？', '技术已死？真的死了吗？.md')),
    '技术已死？真的死了吗？',
  );
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  writeBlog(
    `${y}-${m}-${d}-is-tech-dead.md`,
    `---
slug: is-tech-dead
title: 技术已死？真的死了吗？
authors: [linuxergx]
tags: [随笔, 思考]
---

${raw.replace(/^#\s+.+\n+/, '')}`,
  );
}

console.log('\\nDone. Jar 考核文未导入（按约定排除）。');
