import { useEffect } from 'react';

// On a phone a wide table cannot fit, and sideways scrolling is what makes a page feel broken. So on small screens every table
// is shown as a list of cards (see mobile.css): one card per row, with the column name above each value.
// The pages only write normal tables, so this copies the heading of every column onto the cells below it (data-label).
//
// It is ONE watcher for the whole page, not per screen: it covers the dashboard, the public pages (merit list, applications),
// dialogs and the timetable grid. It labels the tables once, and again whenever the page content changes (data arrives, a list is
// filtered ...). Started from main.jsx; the Layout hook below only makes sure it is running.

// A heading may be several lines, for example the timetable's "Period 1" over its time. Join them: "Period 1 · 08:00".
const headText = (th) => {
  const parts = [...th.children].map((c) => c.textContent.trim()).filter(Boolean);
  return parts.length > 1 ? parts.join(' · ') : th.textContent.trim();
};

const label = (root) => {
  root.querySelectorAll('table:not(.ps-table)').forEach((table) => {
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const heads = [...headRow.children].map(headText);
    if (!heads.some(Boolean)) return;
    [...table.tBodies].forEach((body) => {
      [...body.rows].forEach((tr) => {
        const cells = [...tr.children];
        // a row with one wide cell ("No records") has nothing to label
        if (cells.length === 1 && cells[0].hasAttribute('colspan')) return;
        cells.forEach((cell, i) => {
          if (cell.tagName !== 'TD') return;
          const text = heads[i] || '';
          if (cell.dataset.label !== text) cell.dataset.label = text;
        });
      });
    });
  });
};

let started = false;

export function initResponsiveTables() {
  if (started || typeof document === 'undefined') return;
  started = true;
  let frame = 0;
  const run = () => { frame = 0; label(document.body); };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}

// Layout calls this hook. It only makes sure the watcher is running (it normally was started in main.jsx already).
export default function useResponsiveTables() {
  useEffect(() => { initResponsiveTables(); }, []);
}
