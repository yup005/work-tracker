/**
 * Reflow oversized untagged HTML template literals without changing their HTML output.
 * Each source fragment becomes a backtick-quoted array entry; .join('') preserves
 * the original string exactly (including whitespace and interpolations).
 *
 * Run: node scripts/reflow-html-templates.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import prettier from 'prettier';

const file = new URL('../public/app.js', import.meta.url);
const tick = String.fromCharCode(96);
let source = await readFile(file, 'utf8');
let totalChanged = 0;

function maxLineLength(value) {
  return Math.max(...value.split('\n').map((line) => line.length));
}

function candidate(node, parent, text) {
  if (node.type !== 'TemplateLiteral' || parent?.type === 'TaggedTemplateExpression') {
    return false;
  }
  if (maxLineLength(text.slice(node.start, node.end)) <= 220) {
    return false;
  }
  return node.quasis.some((q) => /<(?:\/?[a-z][a-z0-9:-]*[\s/>]|!--)/i.test(q.value.raw));
}

function splitTemplate(node, text) {
  const fragments = [];
  let current = '';
  let insideTag = false;
  let quote = '';

  function mayBreak() {
    const trailing = current.match(/\\+$/)?.[0].length ?? 0;
    return trailing % 2 === 0;
  }
  function flush() {
    if (current) fragments.push(current);
    current = '';
  }
  function appendRaw(raw) {
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      const isTagStart = char === '<' && /[a-zA-Z/!]/.test(raw[i + 1] ?? '') && !insideTag;
      if (isTagStart && current.length > 130 && mayBreak()) flush();

      current += char;

      if (!insideTag && isTagStart) {
        insideTag = true;
      } else if (insideTag) {
        if (quote) {
          if (char === quote && raw[i - 1] !== '\\') quote = '';
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === '>') {
          insideTag = false;
        } else if (/\s/.test(char) && current.length > 200 && mayBreak()) {
          // Splitting at a space between HTML attributes retains the exact bytes.
          flush();
        }
      }
    }
  }

  for (let i = 0; i < node.quasis.length; i++) {
    const q = node.quasis[i];
    assert.equal(text.slice(q.start, q.end), q.value.raw);
    appendRaw(q.value.raw);
    if (i + 1 < node.quasis.length) {
      const next = node.quasis[i + 1];
      current += text.slice(q.end, next.start);
    }
  }
  flush();

  if (fragments.length < 2) return null;
  const original = text.slice(node.start + 1, node.end - 1);
  assert.equal(fragments.join(''), original, 'Must preserve original template source');
  if (fragments.some((s) => /\\+$/.test(s) && s.match(/\\+$/)[0].length % 2)) {
    return null;
  }
  return (
    '[\n' + fragments.map((part) => '  ' + tick + part + tick + ',').join('\n') + "\n].join('')"
  );
}

for (let pass = 1; pass <= 10; pass++) {
  const parsed = await prettier.__debug.parse(source, { parser: 'babel' });
  const found = [];
  const visited = new WeakSet();

  function walk(node, parent = null) {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);

    if (node.type && candidate(node, parent, source)) {
      const replacement = splitTemplate(node, source);
      if (replacement) found.push({ start: node.start, end: node.end, replacement });
    }

    for (const [key, value] of Object.entries(node)) {
      if (
        [
          'loc',
          'tokens',
          'comments',
          'extra',
          'parent',
          'leadingComments',
          'trailingComments',
        ].includes(key)
      ) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const child of value) walk(child, node);
      } else if (value && typeof value === 'object') {
        walk(value, node);
      }
    }
  }
  walk(parsed.ast);

  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const nonOverlapping = [];
  for (const item of found) {
    if (nonOverlapping.some((outer) => item.start < outer.end)) continue;
    nonOverlapping.push(item);
  }
  if (!nonOverlapping.length) break;

  for (const item of nonOverlapping.reverse()) {
    source = source.slice(0, item.start) + item.replacement + source.slice(item.end);
  }
  totalChanged += nonOverlapping.length;
  console.log('Pass ' + pass + ': reflowed ' + nonOverlapping.length + ' HTML templates');
}

await writeFile(file, source);
console.log('Total reflowed templates: ' + totalChanged);
if (totalChanged < 10) {
  throw new Error('Expected to reflow numerous HTML templates; verify parser and source');
}
