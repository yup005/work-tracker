/**
 * Locate a source fragment in app.js for legacy VM-based tests.
 *
 * Formatting may add whitespace around JS operators or switch quote styles.
 * Source markers are a transitional compatibility layer until these tests can
 * import isolated modules directly instead of slicing source text.
 */
export function sourceIndex(source, marker, fromIndex = 0) {
  const direct = source.indexOf(marker, fromIndex);
  if (direct !== -1) return direct;

  const escaped = [...marker].map((character) => {
    if (/\\s/.test(character)) return '\\s*';
    if (character === "'" || character === '"') return '["\\\']';
    if (/[()[\\]{}.,;:=<>!+*?\\/|&-]/.test(character)) {
      return '\\s*' + character.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\s*';
    }
    return character.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }).join('');

  const match = new RegExp(escaped, 's').exec(source.slice(fromIndex));
  if (!match) {
    throw new Error('Source marker not found after formatting: ' + marker);
  }
  return fromIndex + match.index;
}
