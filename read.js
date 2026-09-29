// The reading page: a run of chapters rendered as one plain article. Safari's
// Listen to Page reads it straight through; the built-in player (speech.js)
// reads it paragraph by paragraph and loads further chapters as it goes.

import { params, intParam, escapeHtml, readUrl, chaptersUrl, nextFrom, prevFrom } from './common.js';
import { getBook, putBook, getChapters, getSetting } from './db.js';
import { createPlayer } from './speech.js';

const book = await getBook(params.get('book'));
if (!book) {
  location.replace('./');
  throw new Error('Book not found');
}

const perPage = getSetting('perPage');
const from = Math.min(intParam('from'), book.toc.length - 1);
const para = intParam('para');
const prev = prevFrom(book.toc, from, perPage);
let loadedTo = from; // first chapter index not yet on the page

const article = document.getElementById('text');

function chapterHtml(c) {
  return c.isSection
    ? `<h2 class="divider" data-c="${c.i}">${escapeHtml(c.title)}</h2>`
    : `<section data-c="${c.i}"><h2>${escapeHtml(c.title)}</h2><div class="body">${c.html}</div></section>`;
}

// Appends the next page's worth of chapters and numbers their blocks.
async function appendPage() {
  if (loadedTo >= book.toc.length) return false;
  const to = nextFrom(book.toc, loadedTo, perPage);
  const chapters = await getChapters(book.id, loadedTo, to - 1);
  const start = loadedTo;
  loadedTo = to;
  article.insertAdjacentHTML('beforeend', chapters.map(chapterHtml).join(''));

  // Starting mid-chapter: drop the blocks before `para`, and the heading with them.
  const firstBody = start === from && article.querySelector(`section[data-c="${from}"] .body`);
  if (firstBody && para > 0) {
    [...firstBody.children].slice(0, para).forEach((el) => el.remove());
    firstBody.previousElementSibling?.remove();
    const note = document.getElementById('note');
    note.textContent = `Continuing ${book.toc[from].t} from paragraph ${para + 1}.`;
    note.hidden = false;
  }
  // Number every block so a tap can restart there.
  for (const c of chapters) {
    const body = article.querySelector(`section[data-c="${c.i}"] .body`);
    if (!body) continue;
    const offset = c.i === from ? para : 0;
    [...body.children].forEach((el, n) => {
      el.dataset.p = String(n + offset);
    });
  }
  renderNav();
  return true;
}

function renderNav() {
  const nextTitle = book.toc[loadedTo]?.t;
  document.getElementById('top').innerHTML = `
    <a href="./">‹ Library</a>
    <a href="${chaptersUrl(book.id)}">Chapters</a>
    <span class="spacer"></span>
    ${from > 0 ? `<a href="${readUrl(book.id, prev)}">‹ Prev</a>` : ''}
    ${nextTitle ? `<a href="${readUrl(book.id, loadedTo)}">Next ›</a>` : ''}`;
  document.getElementById('end').innerHTML = nextTitle
    ? `<a class="btn primary" href="${readUrl(book.id, loadedTo)}">Next: ${escapeHtml(nextTitle)}</a>
       <a class="btn" href="${chaptersUrl(book.id)}">Chapters</a>`
    : `<p class="sub">End of ${escapeHtml(book.title)}.</p><a class="btn" href="./">Library</a>`;
}

await appendPage();
document.title = book.toc[from]?.t || book.title;

let saved = { ...book };
async function savePosition(c, p) {
  saved = { ...saved, lastFrom: c, lastPara: p, lastOpened: Date.now() };
  await putBook(saved);
}
await savePosition(from, para);

const player = createPlayer({
  article,
  book,
  loadMore: appendPage,
  onPosition: (c, p) => {
    document.title = book.toc[c]?.t || book.title;
    savePosition(c, p);
  },
});

// Tap a paragraph: read from here with the player, or restart the page there
// for Listen to Page (which always starts from the top). Tap it again to dismiss.
const bar = document.getElementById('fromHere');
let tapped = null;

function clearTap() {
  tapped?.classList.remove('tapped');
  tapped = null;
  bar.classList.remove('show');
}

article.addEventListener('click', (e) => {
  if (getSelection()?.toString()) return;
  const block = e.target.closest('[data-p], h2');
  if (!block || block === tapped) return clearTap();
  clearTap();
  tapped = block;
  tapped.classList.add('tapped');
  bar.classList.add('show');
});

document.getElementById('speakHere').addEventListener('click', () => {
  if (!tapped) return;
  const el = tapped;
  clearTap();
  player.playFrom(el);
});
document.getElementById('startHere').addEventListener('click', () => {
  if (!tapped) return;
  const c = Number(tapped.closest('[data-c]').dataset.c);
  location.href = readUrl(book.id, c, Number(tapped.dataset.p || 0));
});
