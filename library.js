import { escapeHtml, readUrl, chaptersUrl } from './common.js';
import { listBooks, deleteBook, getSetting, setSetting } from './db.js';
import { importEpub } from './import.js';

const $ = (id) => document.getElementById(id);
const status = $('status');

const perPage = $('perPage');
function showPerPage() {
  $('perPageValue').textContent = perPage.value;
}
perPage.value = String(getSetting('perPage'));
showPerPage();
perPage.addEventListener('change', () => {
  setSetting('perPage', Number(perPage.value));
  showPerPage();
});

$('help').addEventListener('click', () => {
  const tips = $('tips');
  tips.hidden = !tips.hidden;
  $('help').setAttribute('aria-expanded', String(!tips.hidden));
  if (!tips.hidden) tips.scrollIntoView({ behavior: 'smooth' });
});

function setStatus(text, isError = false) {
  status.textContent = text;
  status.hidden = !text;
  status.classList.toggle('error', isError);
}

function countChapters(toc) {
  return toc.filter((c) => !c.s).length;
}

async function render() {
  const books = await listBooks();
  $('books').innerHTML = books.length
    ? books
        .map((b) => {
          // Name the chapter, not a "Book N" divider the saved place may sit on,
          // and prefix that divider when chapter numbers restart in each book.
          const i = b.toc.findIndex((c, n) => n >= b.lastFrom && !c.s);
          const chapter = b.toc[i]?.t || b.toc[b.lastFrom]?.t || '';
          const section = b.toc.slice(0, i).findLast((c) => c.s)?.t;
          const at = section ? `${section} · ${chapter}` : chapter;
          const pct = Math.round(((b.lastFrom + 1) / b.toc.length) * 100);
          return `<li class="book">
            <a class="book-main" href="${readUrl(b.id, b.lastFrom, b.lastPara)}">
              <span class="book-title">${escapeHtml(b.title)}</span>
              <span class="book-meta">${escapeHtml(at)} · ${countChapters(b.toc)} chapters</span>
              <span class="progress"><span style="width:${pct}%"></span></span>
            </a>
            <a class="icon" href="${chaptersUrl(b.id)}" aria-label="Chapters" title="Chapters"><svg><use href="icons.svg#i-list"/></svg></a>
            <button class="icon" data-delete="${escapeHtml(b.id)}" aria-label="Remove ${escapeHtml(b.title)}" title="Remove"><svg><use href="icons.svg#i-trash"/></svg></button>
          </li>`;
        })
        .join('')
    : '<li class="empty">No books yet. Tap <b>+</b> below to add an EPUB from Files or iCloud Drive.</li>';
}

$('books').addEventListener('click', async (e) => {
  const id = e.target.closest('[data-delete]')?.dataset.delete;
  if (!id) return;
  if (!confirm('Remove this book from this device?')) return;
  await deleteBook(id);
  render();
});

$('file').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  // Ask Safari not to evict the library when storage runs low.
  navigator.storage?.persist?.().catch(() => {});
  for (const file of files) {
    try {
      setStatus(`Opening ${file.name}…`);
      const book = await importEpub(file, (done, total) => {
        setStatus(`${file.name}: ${done} / ${total}`);
      });
      setStatus(`Added ${book.title} (${countChapters(book.toc)} chapters).`);
    } catch (err) {
      setStatus(`${file.name}: ${err.message}`, true);
    }
    await render();
  }
});

render();
