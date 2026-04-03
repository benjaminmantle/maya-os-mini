/**
 * Mini-markdown renderer for idea task names.
 * Supports: **bold**, *italic*, \u2022 bullets, \n newlines.
 * Returns an array of React elements.
 */
export function renderRichText(text) {
  if (!text) return text;

  const lines = text.split('\n');
  const result = [];

  for (let li = 0; li < lines.length; li++) {
    if (li > 0) result.push(<br key={`br-${li}`} />);
    const line = lines[li];

    // Parse inline markdown: **bold** and *italic*
    const parts = parseInline(line);
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      const key = `${li}-${pi}`;
      if (p.bold) result.push(<strong key={key} style={{ fontWeight: 700 }}>{p.text}</strong>);
      else if (p.italic) result.push(<em key={key} style={{ fontStyle: 'italic' }}>{p.text}</em>);
      else result.push(<span key={key}>{p.text}</span>);
    }
  }

  return result;
}

function parseInline(text) {
  const parts = [];
  let i = 0;

  while (i < text.length) {
    // Bold: **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        parts.push({ text: text.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    // Italic: *...*  (but not **)
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1 && text[end + 1] !== '*') {
        parts.push({ text: text.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    // Plain text — collect until next *
    let nextStar = text.indexOf('*', i + 1);
    if (nextStar === -1) nextStar = text.length;
    parts.push({ text: text.slice(i, nextStar) });
    i = nextStar;
  }

  return parts;
}
