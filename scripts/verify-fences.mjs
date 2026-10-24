import fs from 'fs';

const check = (p) => {
  let t = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const lines = t.split('\n');
  let open = null;
  const opens = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('```')) {
      if (open === null) {
        open = i + 1;
        opens.push(open);
      } else {
        open = null;
      }
    }
  }
  console.log(p, 'lines', lines.length, 'unclosedAt', open, 'openCount', opens.length);
  if (open !== null) {
    console.log('last opens', opens.slice(-5));
    console.log('tail:\n', lines.slice(-8).join('\n'));
  }
  return {t, open, lines};
};

for (const p of [
  'docs/linux/tidb/01-TiDBday01.md',
  'docs/linux/docker-k8s/k8s-ops-cases.md',
]) {
  check(p);
}
