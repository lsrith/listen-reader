// The reading page: a run of chapters rendered as one plain article. Safari's
// Listen to Page reads it straight through; the built-in player (speech.js)
// reads it paragraph by paragraph and loads further chapters as it goes.

import { params, intParam, escapeHtml, readUrl, chaptersUrl, nextFrom, prevFrom } from './common.js';
import { getBook, putBook, getChapters, getSetting } from './db.js';
import { createSpeaker } from './speech.js';

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

function setLink(id, href) {
  const a = document.getElementById(id);
  if (href) a.href = href;
  else a.removeAttribute('href');
  a.classList.toggle('disabled', !href);
}

function renderNav() {
  const nextTitle = book.toc[loadedTo]?.t;
  setLink('chapters', chaptersUrl(book.id));
  setLink('prevPage', from > 0 && readUrl(book.id, prev));
  setLink('nextPage', nextTitle && readUrl(book.id, loadedTo));
  document.getElementById('end').innerHTML = nextTitle
    ? `<a class="btn primary" href="${readUrl(book.id, loadedTo)}">Next: ${escapeHtml(nextTitle)}</a>`
    : `<p class="sub">End of ${escapeHtml(book.title)}.</p>`;
}

await appendPage();
document.title = book.toc[from]?.t || book.title;

let saved = { ...book };
async function savePosition(c, p) {
  saved = { ...saved, lastFrom: c, lastPara: p, lastOpened: Date.now() };
  await putBook(saved);
}
await savePosition(from, para);

// Keep the screen on while this page is open. The lock is released whenever
// the page is hidden, so it is requested again on return.
async function keepAwake() {
  try {
    if (document.visibilityState === 'visible') await navigator.wakeLock?.request('screen');
  } catch {}
}
keepAwake();
document.addEventListener('visibilitychange', keepAwake);

// Dock: page navigation, or voice controls while reading aloud.
const navRow = document.getElementById('navRow');
const voiceRow = document.getElementById('voiceRow');
const playBtn = document.getElementById('vPlay');

const speaker = createSpeaker({
  article,
  loadMore: appendPage,
  onPosition: (c, p) => {
    document.title = book.toc[c]?.t || book.title;
    savePosition(c, p);
  },
  onChange: (playing) => {
    playBtn.querySelector('use').setAttribute('href', playing ? 'icons.svg#i-pause' : 'icons.svg#i-play');
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  },
});

function showVoice(on) {
  navRow.hidden = on;
  voiceRow.hidden = !on;
}

function listen(from) {
  showVoice(true);
  speaker.play(from);
}

if (!speaker) {
  document.getElementById('listen').hidden = true;
  document.getElementById('speakHere').hidden = true;
}
document.getElementById('listen').addEventListener('click', () => listen());
playBtn.addEventListener('click', () => speaker.toggle());
document.getElementById('vPrev').addEventListener('click', () => speaker.skip(-1));
document.getElementById('vNext').addEventListener('click', () => speaker.skip(1));
document.getElementById('vClose').addEventListener('click', () => {
  speaker.stop();
  showVoice(false);
});

// Tap a paragraph: a bubble at the tap offers reading aloud from there, or
// restarting the page there for Listen to Page (which always starts from the
// top). Tapping anywhere else dismisses it.
const tip = document.getElementById('tip');
let tapped = null;

function clearTap() {
  tapped?.classList.remove('tapped');
  tapped = null;
  tip.hidden = true;
}

// Places the bubble above the tap point, or below it near the top of the screen.
function showTip(x, y) {
  tip.hidden = false;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.min(Math.max(x - w / 2, 8), document.documentElement.clientWidth - w - 8);
  const below = y - h - 14 < 8;
  tip.classList.toggle('below', below);
  tip.style.left = `${left + scrollX}px`;
  tip.style.top = `${(below ? y + 14 : y - h - 14) + scrollY}px`;
  tip.style.setProperty('--arrow-x', `${x - left}px`);
}

document.addEventListener('click', (e) => {
  if (tip.contains(e.target)) return;
  const block = article.contains(e.target) && e.target.closest('[data-p], h2');
  if (!block || block === tapped || getSelection()?.toString()) return clearTap();
  clearTap();
  tapped = block;
  tapped.classList.add('tapped');
  showTip(e.clientX, e.clientY);
});

document.getElementById('speakHere').addEventListener('click', () => {
  if (!tapped) return;
  const el = tapped;
  clearTap();
  listen(el);
});
document.getElementById('startHere').addEventListener('click', () => {
  if (!tapped) return;
  const c = Number(tapped.closest('[data-c]').dataset.c);
  location.href = readUrl(book.id, c, Number(tapped.dataset.p || 0));
});
