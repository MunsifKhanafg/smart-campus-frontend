import { Fragment } from 'react';

// A small, safe Markdown renderer for assistant answers (no HTML is ever injected).
// Supports: headings, bold, italic, inline code, fenced code blocks, bullet and numbered lists, tables, quotes, rules.

const inline = (text, keyBase) => {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).filter((p) => p !== '');
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={key} className="md-code">{p.slice(1, -1)}</code>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={key}>{p.slice(1, -1)}</em>;
    return <Fragment key={key}>{p}</Fragment>;
  });
};

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-');
const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export default function Markdown({ text }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i += 1; }
      i += 1;
      out.push(<pre key={k++} className="md-pre"><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const Tag = `h${Math.min(h[1].length + 2, 6)}`;
      out.push(<Tag key={k++} className="md-h">{inline(h[2], k)}</Tag>);
      i += 1;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { out.push(<hr key={k++} />); i += 1; continue; }
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      out.push(
        <div key={k++} className="md-table">
          <table>
            <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, `h${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j}>{inline(c, `c${a}-${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      out.push(<blockquote key={k++}>{inline(q.join(' '), k)}</blockquote>);
      continue;
    }
    if (/^\s*([-*•])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*•])\s+/, '')); i += 1; }
      out.push(<ul key={k++}>{items.map((t, j) => <li key={j}>{inline(t, `u${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i += 1; }
      out.push(<ol key={k++}>{items.map((t, j) => <li key={j}>{inline(t, `o${j}`)}</li>)}</ol>);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*[-*•]\s+|\s*\d+[.)]\s+|\s*>)/.test(lines[i]) && !isTableRow(lines[i])) { para.push(lines[i]); i += 1; }
    if (!para.length) { para.push(lines[i]); i += 1; }
    out.push(<p key={k++}>{inline(para.join(' '), k)}</p>);
  }
  return <div className="md">{out}</div>;
}
