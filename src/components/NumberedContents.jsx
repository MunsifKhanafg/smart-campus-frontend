import { splitContents } from './contentsUtil.js';
import './contents.css';

// Shows course contents as a numbered list (1, 2, 3 ...). `compact` is the small version used inside tables.
export default function NumberedContents({ text, compact = false }) {
  const items = splitContents(text, 200, 400);
  if (!items.length) return null;
  return (
    <ol className={`contents-list${compact ? ' compact' : ''}`}>
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ol>
  );
}
