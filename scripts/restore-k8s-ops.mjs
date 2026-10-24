import fs from 'fs';
import path from 'path';

const desk = path.join(process.env.USERPROFILE, 'Desktop');
const a = fs
  .readFileSync(path.join(desk, 'K8s 故障排查案例 -conntrack-tools 缺失.md'), 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n');
const b = fs
  .readFileSync(path.join(desk, 'K8s集群中Pod手动迁移方案.md'), 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n');

const out = `---
format: md
sidebar_position: 2
title: K8s 运维实战合集（排障与 Pod 迁移）
---

# K8s 运维实战合集

本文汇总两篇短文。

---

${a.trim()}

---

${b.trim()}
`;

fs.writeFileSync('docs/linux/docker-k8s/k8s-ops-cases.md', out);
console.log('restored lines', out.split(/\n/).length);

// ensure conntrack install block is closed before ---
let t = out;
t = t.replace(
  /(apt-get install -y conntrack)\n+(\n---)/,
  '$1\n```\n$2',
);
// if already has ``` before ---, leave it
if (!/apt-get install -y conntrack\n```/.test(t) && /apt-get install -y conntrack\n\n---/.test(t)) {
  t = t.replace(
    /apt-get install -y conntrack\n\n---/,
    'apt-get install -y conntrack\n```\n\n---',
  );
  fs.writeFileSync('docs/linux/docker-k8s/k8s-ops-cases.md', t);
  console.log('ensured fence close before Pod section');
} else {
  // check if bash opened for install is closed
  const idx = t.indexOf('### 安装 conntrack-tools');
  const slice = t.slice(idx, idx + 400);
  console.log('install slice:\n', slice);
}
