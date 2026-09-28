// The reading page: a run of chapters rendered as one plain article, so that
// Safari's Listen to Page reads it straight through.

import { params, intParam, escapeHtml, readUrl, chaptersUrl, nextFrom, prevFrom } from './common.js';
import { getBook, putBook, getChapters, getSetting } from './db.js';

const book = await getBook(params.get('book'));
if (!book) {
  location.replace('./');
  throw new Error('Book not found');
}

const perPage = getSetting('perPage');
const from = Math.min(intParam('from'), book.toc.length - 1);
const para = intParam('para');
const next = nextFrom(book.toc, from, perPage);
const prev = prevFrom(book.toc, from, perPage);
const chapters = await getChapters(book.id, from, next - 1);

const article = document.getElementById('text');
article.innerHTML = chapters
  .map((c) =>
    c.isSection
      ? `<h2 class="divider">${escapeHtml(c.title)}</h2>`
      : `<section data-c="${c.i}"><h2>${escapeHtml(c.title)}</h2><div class="body">${c.html}</div></section>`,
  )
  .join('');

// Starting mid-chapter: drop the blocks before `para`, and the heading with them.
const firstBody = article.querySelector(`section[data-c="${from}"] .body`);
if (para > 0 && firstBody) {
  [...firstBody.children].slice(0, para).forEach((el) => el.remove());
  firstBody.previousElementSibling?.remove();
  const note = document.getElementById('note');
  note.textContent = `Continuing ${book.toc[from].t} from paragraph ${para + 1}.`;
  note.hidden = false;
}

// Number every block so a tap can restart the page at that paragraph.
for (const section of article.querySelectorAll('section')) {
  const offset = section.dataset.c == from ? para : 0;
  [...section.querySelector('.body').children].forEach((el, n) => {
    el.dataset.p = String(n + offset);
  });
}

const firstReal = chapters.find((c) => !c.isSection) || chapters[0];
document.title = firstReal ? firstReal.title : book.title;

const nextTitle = book.toc[next]?.t;
document.getElementById('top').innerHTML = `
  <a href="./">‹ Library</a>
  <a href="${chaptersUrl(book.id)}">Chapters</a>
  <span class="spacer"></span>
  ${from > 0 ? `<a href="${readUrl(book.id, prev)}">‹ Prev</a>` : ''}
  ${nextTitle ? `<a href="${readUrl(book.id, next)}">Next ›</a>` : ''}`;
document.getElementById('end').innerHTML = nextTitle
  ? `<a class="btn primary" href="${readUrl(book.id, next)}">Next: ${escapeHtml(nextTitle)}</a>
     <a class="btn" href="${chaptersUrl(book.id)}">Chapters</a>`
  : `<p class="sub">End of ${escapeHtml(book.title)}.</p><a class="btn" href="./">Library</a>`;

await putBook({ ...book, lastFrom: from, lastPara: para, lastOpened: Date.now() });

// Tap a paragraph to offer restarting the page there. Listen to Page always
// starts from the top, so this is how to skip forward or back.
const bar = document.getElementById('fromHere');
let tapped = null;

function clearTap() {
  tapped?.classList.remove('tapped');
  tapped = null;
  bar.classList.remove('show');
}

article.addEventListener('click', (e) => {
  if (getSelection()?.toString()) return;
  const block = e.target.closest('[data-p]');
  if (!block || block === tapped) return clearTap();
  clearTap();
  tapped = block;
  tapped.classList.add('tapped');
  bar.classList.add('show');
});

document.getElementById('cancelHere').addEventListener('click', clearTap);
document.getElementById('startHere').addEventListener('click', () => {
  if (!tapped) return;
  const c = Number(tapped.closest('section').dataset.c);
  location.href = readUrl(book.id, c, Number(tapped.dataset.p));
});
