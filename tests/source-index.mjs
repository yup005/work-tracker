/**
 * Locate source snippets used by older VM-based tests.
 * Only test harnesses use this: application code is unaffected.
 */
export function sourceIndex(source, marker, fromIndex = 0) {
  const direct = source.indexOf(marker, fromIndex);
  if (direct !== -1) return direct;

  const escapeRegex = (character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Prettier adds parentheses to single-parameter arrow callbacks.
  // Retain the legacy markers while accepting both arrow spellings.
  const normalizedMarker = marker.replace(/,\\s*([a-zA-Z_$][\\w$]*)\\s*=>/g, ',($1)=>');

  const pattern = [...normalizedMarker]
    .map((character) => {
      if (/\s/.test(character)) return '\\s*';
      if (character === "'" || character === '"') return '[\\x22\\x27]';
      const escaped = escapeRegex(character);
      if (/[^a-zA-Z0-9_$]/.test(character)) {
        return `\\s*${escaped}\\s*`;
      }
      return escaped;
    })
    .join('');

  const match = new RegExp(pattern, 's').exec(source.slice(fromIndex));
  if (!match) {
    throw new Error('Source marker not found after formatting: ' + marker);
  }
  return fromIndex + match.index;
}
