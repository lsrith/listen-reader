// Shared by every page: offline support and small helpers.

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

export const params = new URLSearchParams(location.search);

export function intParam(name, fallback = 0) {
  const n = parseInt(params.get(name), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export function readUrl(bookId, from, para = 0) {
  const q = new URLSearchParams({ book: bookId, from: String(from) });
  if (para > 0) q.set('para', String(para));
  return `read.html?${q}`;
}

export function chaptersUrl(bookId) {
  return `chapters.html?${new URLSearchParams({ book: bookId })}`;
}

// Index of the chapter that starts the page after `from`, skipping `perPage`
// real chapters (divider pages don't count towards the page size).
export function nextFrom(toc, from, perPage) {
  let i = from;
  let counted = 0;
  while (i < toc.length && counted < perPage) {
    if (!toc[i].s) counted++;
    i++;
  }
  return i;
}

export function prevFrom(toc, from, perPage) {
  let i = from;
  let counted = 0;
  while (i > 0 && counted < perPage) {
    i--;
    if (!toc[i].s) counted++;
  }
  return i;
}
