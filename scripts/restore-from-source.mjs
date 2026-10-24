/**
 * Re-import notes from Desktop/Downloads WITHOUT MDX sanitization.
 * Only add format: md frontmatter. Do not alter body meaning.
 * Fitness docs are NOT touched.
 */
import fs from 'fs';
import path from 'path';

const desk = path.join(process.env.USERPROFILE, 'Desktop');
const downloads = path.join(process.env.USERPROFILE, 'Downloads');
const acp = path.join(desk, '大模型ACP');

const read = (p) =>
  fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

const write = (rel, frontmatter, body) => {
  const dest = path.join('docs', rel);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  const content = `---\n${frontmatter}\n---\n\n${body.trim()}\n`;
  fs.writeFileSync(dest, content, 'utf8');
  console.log('restored', rel, 'bytes', Buffer.byteLength(content));
};

const rewriteLocalImages = (md, prefix = 'images/') =>
  md.replace(
    /(!?\[[^\]]*\]\()(?!https?:|\/|@site\/|images\/|#)([^)]+\.(?:png|jpg|jpeg|gif|webp))(\))/gi,
    `$1${prefix}$2$3`,
  );

// --- ACP: separate originals, untouched body ---
{
  const cm = read(path.join(acp, '混淆矩阵.md'));
  write(
    'linux/ai-infra/confusion-matrix.md',
    `format: md\nsidebar_position: 4\ntitle: 混淆矩阵与分类指标`,
    rewriteLocalImages(cm),
  );

  // llm notes = 一/二/三 + 新增题目 only (no harmonic, no confusion)
  const parts = [
    ['大模型一.md', '大模型基础（一）'],
    ['大模型二.md', '大模型基础（二）'],
    ['大模型三.md', '大模型基础（三）'],
    ['新增题目.md', '补充题目'],
  ].map(([file, title]) => {
    let t = rewriteLocalImages(read(path.join(acp, file)));
    t = t.replace(/^#\s+.+\n+/, '');
    return `## ${title}\n\n${t.trim()}`;
  });
  write(
    'linux/ai-infra/llm-acp-notes.md',
    `format: md\nsidebar_position: 3\ntitle: 大模型 ACP 题库笔记`,
    `# 大模型 ACP 题库笔记\n\n${parts.join('\n\n---\n\n')}`,
  );

  // copy ACP images again
  const imgDir = 'docs/linux/ai-infra/images';
  fs.mkdirSync(imgDir, {recursive: true});
  for (const name of fs.readdirSync(acp)) {
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(name)) {
      fs.copyFileSync(path.join(acp, name), path.join(imgDir, name));
    }
  }
}

// --- linear interpolation from Downloads ---
{
  const src = path.join(downloads, '线性插值计算模型输入输出的方法.md');
  write(
    'linux/ai-infra/linear-interpolation-capacity.md',
    `format: md\nsidebar_position: 6\ntitle: 线性插值计算模型输入输出的方法`,
    read(src),
  );
}

// --- ais_bench ---
{
  write(
    'linux/ai-infra/ais-bench.md',
    `format: md\nsidebar_position: 2\ntitle: ais_bench 性能测试工具使用参考`,
    read(path.join(desk, 'ais_bench性能测试工具使用参考.md')),
  );
}

// --- hami ---
{
  write(
    'linux/ai-infra/hami-mineru-k8s.md',
    `format: md\nsidebar_position: 1\ntitle: HAMi + MinerU 在 K8s 上的部署指南`,
    read(path.join(desk, 'hami-mineru-k8s-guide.md')),
  );
}

// --- K8s ops merge (originals concatenated, bodies untouched) ---
{
  const a = read(path.join(desk, 'K8s 故障排查案例 -conntrack-tools 缺失.md'));
  const b = read(path.join(desk, 'K8s集群中Pod手动迁移方案.md'));
  write(
    'linux/docker-k8s/k8s-ops-cases.md',
    `format: md\nsidebar_position: 2\ntitle: K8s 运维实战合集（排障与 Pod 迁移）`,
    `# K8s 运维实战合集\n\n本文汇总两篇短文。\n\n---\n\n${a.trim()}\n\n---\n\n${b.trim()}`,
  );
}

{
  write(
    'linux/docker-k8s/k8s-vm-clone-migration.md',
    `format: md\nsidebar_position: 3\ntitle: Kubernetes 虚拟机环境克隆与资源迁移全指南`,
    read(path.join(desk, 'Kubernetes 虚拟机环境克隆与资源迁移全指南.md')),
  );
}

// --- Hyper-V merge ---
{
  const a = read(
    path.join(
      desk,
      '手搓 Hyper-V Linux 虚拟机 GPU 半虚拟化 (GPU-PV) 实战与踩坑全纪录.md',
    ),
  );
  const b = read(path.join(desk, '手动创建带固定 NAT 的内部交换机.md'));
  write(
    'linux/server-ops/hyper-v-gpu-pv-and-nat.md',
    `format: md\nsidebar_position: 2\ntitle: Hyper-V：GPU-PV 与固定 NAT 网络实战`,
    `# Hyper-V：GPU-PV 与固定 NAT 网络实战\n\n---\n\n${a.trim()}\n\n---\n\n${b.trim()}`,
  );
}

// --- kernel ---
{
  write(
    'linux/kernel/qemu-busybox-lab.md',
    `format: md\nsidebar_position: 1\ntitle: 基于 QEMU 与 BusyBox 的 Linux 内核实验环境`,
    read(path.join(desk, '构建基于 QEMU 与 BusyBox 的 Linux 内核本地开发与调试环境.md')),
  );
  write(
    'linux/kernel/ebpf-lab-linux72.md',
    `format: md\nsidebar_position: 2\ntitle: Linux 7.2 + eBPF 实验场构建指南`,
    read(
      path.join(
        desk,
        '电网大模型项目规范文档',
        'Linux 7.2 + eBPF 实验场构建全景实战指南.md',
      ),
    ),
  );
}

// --- interview ---
{
  write(
    'linux/quiz/interview-linux-k8s.md',
    `format: md\nsidebar_position: 2\ntitle: 面试复习：Linux 与 Kubernetes`,
    read(path.join(desk, '面试复习-Linux与K8s运维.md')),
  );
}

// --- dameng: restore md + keep images path rewrite only ---
{
  const srcMd = path.join(
    desk,
    '达梦8数据库备份与恢复流程',
    '达梦8数据库备份与恢复.md',
  );
  let md = read(srcMd);
  md = md.replace(/达梦8数据库备份与恢复\.assets\//g, 'images/');
  write(
    'linux/dameng/backup-restore.md',
    `format: md\nsidebar_position: 1\ntitle: 达梦 8 数据库备份与恢复`,
    md,
  );
}

// --- zabbix: restore original body; images stay in static via path rewrite ---
{
  let md = read(path.join(desk, 'zabbix_parsed', 'zabbix.md'));
  // only change image paths so figures work; do not alter prose/HTML/tildes
  md = md.replace(/\]\(images\//g, '](/img/zabbix/');
  write(
    'linux/server-ops/zabbix-notes.md',
    `format: md\nsidebar_position: 3\ntitle: Zabbix 笔记`,
    md,
  );
}

console.log('\nDone. Fitness untouched. harmonic-mean should stay deleted.');
