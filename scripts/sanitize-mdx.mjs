import fs from 'fs';

const files = [
  'docs/linux/ai-infra/llm-acp-notes.md',
  'docs/linux/dameng/backup-restore.md',
  'docs/linux/docker-k8s/k8s-vm-clone-migration.md',
  'docs/linux/server-ops/zabbix-notes.md',
  'docs/linux/ai-infra/hami-mineru-k8s.md',
  'docs/linux/ai-infra/ais-bench.md',
  'docs/linux/docker-k8s/k8s-ops-cases.md',
  'docs/linux/server-ops/hyper-v-gpu-pv-and-nat.md',
  'docs/linux/kernel/qemu-busybox-lab.md',
  'docs/linux/kernel/ebpf-lab-linux72.md',
  'docs/linux/quiz/interview-linux-k8s.md',
];

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const quoteAttrs = (attrs) =>
  attrs.replace(/([:@A-Za-z_][\w:.-]*)=([^\s"'=<>`]+)/g, '$1="$2"');

const sanitizeChunk = (s) => {
  // drop obsolete font tags, keep inner text
  s = s.replace(/<\/?font\b[^>]*>/gi, '');

  s = s.replace(/<br\s*>/gi, '<br />');
  s = s.replace(/<hr\s*>/gi, '<hr />');

  // quote attributes on all HTML tags; self-close void tags
  s = s.replace(/<\/?([A-Za-z][\w-]*)(\s[^>]*)?>/g, (full, tag, attrs = '') => {
    const isClose = full.startsWith('</');
    if (isClose) return full;
    const lower = tag.toLowerCase();
    let a = quoteAttrs(attrs || '');
    if (voidTags.has(lower) && !/\/\s*$/.test(a)) a += ' /';
    return `<${lower}${a}>`;
  });

  // escape { } for MDX outside code
  s = s.replace(/(?<!\\)\{/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
  return s;
};

const sanitize = (md) => {
  // avoid double-escaping if run twice: unescape first then re-escape
  const parts = md.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith('```')) return part;
      // undo previous escapes
      let s = part.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
      return sanitizeChunk(s);
    })
    .join('');
};

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const before = fs.readFileSync(f, 'utf8');
  const after = sanitize(before);
  fs.writeFileSync(f, after);
  console.log('ok', f);
}
