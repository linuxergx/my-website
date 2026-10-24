import fs from 'fs';

// 1) llm-acp-notes: bare `{...}` outside code → inline code
{
  const p = 'docs/linux/ai-infra/llm-acp-notes.md';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    /C\.correct \/= total; print\(fAccuracy: \{100 \* correct: 2f\}%'\)\s*/,
    "C. `correct /= total; print(f'Accuracy: {100 * correct:.2f}%')`\n\n",
  );
  // escape other bare JSX-looking braces outside fences (conservative: only lines with print(f
  s = s.replace(
    /^(?!```)(.*\{[^{}\n]+\}.*)$/gm,
    (line) => {
      if (line.trimStart().startsWith('|')) return line; // tables often have { } in latex
      if (line.includes('$')) return line; // math
      if (line.includes('`')) return line; // already code
      if (line.includes('{') && /print\(|f['"]|format\(|\{0\}|\{1\}/.test(line)) {
        return line.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
      }
      return line;
    },
  );
  fs.writeFileSync(p, s);
  console.log('acp fixed, has Accuracy snippet:', s.includes("f'Accuracy"));
}

// 2) confusion-matrix: Chinese inside $...$ → \text{...}
{
  const p = 'docs/linux/ai-infra/confusion-matrix.md';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    String.raw`$P = \frac{TP}{TP + FP} = \frac{说对的话}{说对的话+胡说的内容}$`,
    String.raw`$P = \frac{TP}{TP + FP} = \frac{\text{说对的话}}{\text{说对的话}+\text{胡说的内容}}$`,
  );
  s = s.replace(
    String.raw`$R = \frac{TP}{TP + FN} = \frac{说对的话}{说对的话+漏掉的话}$`,
    String.raw`$R = \frac{TP}{TP + FN} = \frac{\text{说对的话}}{\text{说对的话}+\text{漏掉的话}}$`,
  );
  s = s.replace(
    String.raw`$$最终得分 = 0.75 \times 事实准确度(F1  Score) + 0.25 \times 语义相似度$$`,
    String.raw`$$\text{最终得分} = 0.75 \times \text{事实准确度 (F1 Score)} + 0.25 \times \text{语义相似度}$$`,
  );
  fs.writeFileSync(p, s);
  console.log('confusion text{} ok:', s.includes(String.raw`\text{说对的话}`));
}
