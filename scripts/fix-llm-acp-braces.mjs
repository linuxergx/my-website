import fs from 'fs';

const p = 'docs/linux/ai-infra/llm-acp-notes.md';
let s = fs.readFileSync(p, 'utf8');

// Known broken formula cells
s = s.replace(
  '| {\text{Relevant Documents}} \\cap {\text{Retrieved Documents up to } K} |',
  '| $|\\\\{\\\\text{Relevant Documents}\\\\} \\\\cap \\\\{\\\\text{Retrieved Documents up to } K\\\\}|$ |',
);

// More reliable: fix the exact broken cell content
s = s.replace(
  String.raw`{\text{Relevant Documents}} \cap {\text{Retrieved Documents up to } K}`,
  String.raw`$|\{\text{Relevant Documents}\} \cap \{\text{Retrieved Documents up to } K\}|$`,
);

// Fix truncated probability formula on previous line if still broken
s = s.replace(
  String.raw`$P(\text{context} \| \text{chunk}_i$ 概率最大化。`,
  String.raw`$P(\text{context} \mid \text{chunk}_i)$ 概率最大化。`,
);

/**
 * Escape `{` `}` that are still outside code fences / inline code / math.
 * Process by segments so we don't touch ``` or $...$ / $$...$$ / `...`.
 */
function escapeBracesOutsideProtected(md) {
  const parts = [];
  const re = /(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|`[^`\n]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(md))) {
    parts.push({type: 'text', value: md.slice(last, m.index)});
    parts.push({type: 'prot', value: m[0]});
    last = m.index + m[0].length;
  }
  parts.push({type: 'text', value: md.slice(last)});

  return parts
    .map((part) => {
      if (part.type === 'prot') return part.value;
      // leave HTML tags alone roughly; escape remaining braces
      return part.value.replace(/(?<!\\)\{/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
    })
    .join('');
}

s = escapeBracesOutsideProtected(s);

// Undo double-escaping inside already-good math that got partially hit
// (escapeBracesOutsideProtected should skip $...$)

fs.writeFileSync(p, s);
console.log('done');
// show line 762 area
const lines = s.split('\n');
console.log('L761:', lines[760]);
console.log('L762:', lines[761]);
