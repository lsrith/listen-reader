import { params, escapeHtml, readUrl } from './common.js';
import { getBook } from './db.js';

const book = await getBook(params.get('book'));
if (!book) {
  location.replace('./');
} else {
  document.title = `Chapters · ${book.title}`;
  document.getElementById('title').textContent = book.title;
  document.getElementById('count').textContent = `${book.toc.filter((c) => !c.s).length} chapters`;
  document.getElementById('resume').href = readUrl(book.id, book.lastFrom, book.lastPara);
  document.getElementById('toc').innerHTML = book.toc
    .map((c, i) => {
      if (c.s) return `<li class="section">${escapeHtml(c.t)}</li>`;
      const current = i === book.lastFrom ? ' class="current" id="current"' : '';
      return `<li${current}><a href="${readUrl(book.id, i)}">${escapeHtml(c.t)}</a></li>`;
    })
    .join('');
  const locate = () => document.getElementById('current')?.scrollIntoView({ block: 'center' });
  locate();
  document.getElementById('locate').addEventListener('click', locate);
}
