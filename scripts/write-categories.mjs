import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');

const write = (rel, data) => {
  const file = path.join(docs, rel, '_category_.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('wrote', rel);
};

const linuxCats = [
  ['server-ops', '服务器运维', 1, 'Linux 服务器日常运维与排障手册。'],
  ['networking', '运维网络', 2, '网络基础与运维相关网络知识点。'],
  ['shell', 'Shell 与脚本', 3, 'Shell、正则与运维脚本实践。'],
  ['ansible', 'Ansible', 4, 'Ansible 自动化运维笔记。'],
  ['nginx', 'Nginx', 5, 'Nginx 进阶配置与实践。'],
  ['tomcat', 'Tomcat', 6, 'Tomcat 部署与运维。'],
  ['aliyun', '阿里云', 7, '阿里云相关实践记录。'],
  ['docker-k8s', 'Docker / K8s', 1, '容器与 Kubernetes 相关笔记。'],
  ['kernel', '内核与实验环境', 2, 'QEMU/BusyBox、eBPF 等内核实验与调试笔记。'],
  ['mysql', 'MySQL', 1, 'MySQL SQL 进阶与高可用架构。'],
  ['tidb', 'TiDB', 2, 'TiDB 分布式数据库学习笔记。'],
  ['dameng', '达梦数据库', 3, '达梦（DM）备份恢复等运维实践。'],
  ['ai-infra', 'AI 推理与算力', 1, '面向生产的 GPU/LLM 运维：调度切分、压测容量、排障与监控。'],
  ['faq', 'Linux 答疑', 1, '常见 Linux 问题答疑汇总。'],
  ['quiz', '测验与面试', 2, 'Linux/K8s 面试题，以及 CKA 模拟考场使用说明。'],
  ['english-vocab', '计算机英文词汇', 3, '计算机与互联网行业术语词汇。'],
];

for (const [dir, label, position, description] of linuxCats) {
  write(`linux/${dir}`, {
    label,
    position,
    link: {
      type: 'generated-index',
      title: label,
      description,
    },
  });
}

write('fitness/training', {
  label: '健身训练笔记',
  position: 1,
  link: {
    type: 'generated-index',
    title: '健身训练核心笔记',
    description: '分化计划、动作与营养，偏教练执行笔记。',
    slug: '/category/fitness-training-notes',
  },
});

write('fitness/rehab', {
  label: '运动康复指南',
  position: 2,
  link: {
    type: 'generated-index',
    title: '各部位运动康复指南',
    description: '针对踝、膝、腰、颈、肩等部位的防护与恢复思路。',
    slug: '/category/exercise-rehab-guide',
  },
});

write('culture/communication', {
  label: '传播学笔记',
  position: 1,
  link: {
    type: 'generated-index',
    title: '传播学笔记',
    description: '传播学概论、作业与信息茧房等媒介笔记。',
  },
});

write('culture/arts', {
  label: '艺术学笔记',
  position: 2,
  link: {
    type: 'generated-index',
    title: '艺术学笔记',
    description: '美学概念与短文赏析（不含十二章教材正文）。',
  },
});

console.log('done');
