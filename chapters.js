import { params, escapeHtml, readUrl } from './common.js';
import { getBook } from './db.js';

const book = await getBook(params.get('book'));
if (!book) {
  location.replace('./');
} else {
  document.title = `Chapters · ${book.title}`;
  document.getElementById('title').textContent = book.title;
  document.getElementById('toc').innerHTML = book.toc
    .map((c, i) => {
      if (c.s) return `<li class="section">${escapeHtml(c.t)}</li>`;
      const current = i === book.lastFrom ? ' class="current" id="current"' : '';
      return `<li${current}><a href="${readUrl(book.id, i)}">${escapeHtml(c.t)}</a></li>`;
    })
    .join('');
  document.getElementById('current')?.scrollIntoView({ block: 'center' });
}
