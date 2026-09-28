import { escapeHtml, readUrl, chaptersUrl } from './common.js';
import { listBooks, deleteBook, getSetting, setSetting } from './db.js';
import { importEpub } from './import.js';

const $ = (id) => document.getElementById(id);
const status = $('status');

const perPage = $('perPage');
perPage.value = String(getSetting('perPage'));
perPage.addEventListener('change', () => setSetting('perPage', Number(perPage.value)));

function countChapters(toc) {
  return toc.filter((c) => !c.s).length;
}

async function render() {
  const books = await listBooks();
  $('books').innerHTML = books.length
    ? books
        .map((b) => {
          const at = b.toc[b.lastFrom]?.t || b.toc[0]?.t || '';
          return `<section class="card">
            <h2>${escapeHtml(b.title)}</h2>
            <p class="meta">${countChapters(b.toc)} chapters · at ${escapeHtml(at)}</p>
            <div class="row">
              <a class="btn primary" href="${readUrl(b.id, b.lastFrom, b.lastPara)}">Continue</a>
              <a class="btn" href="${chaptersUrl(b.id)}">Chapters</a>
              <button class="danger" data-delete="${escapeHtml(b.id)}">Remove</button>
            </div>
          </section>`;
        })
        .join('')
    : '<p class="sub">No books yet. Add an EPUB from Files or iCloud Drive.</p>';
}

$('books').addEventListener('click', async (e) => {
  const id = e.target.dataset?.delete;
  if (!id) return;
  if (!confirm('Remove this book from this device?')) return;
  await deleteBook(id);
  render();
});

$('file').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  status.classList.remove('error');
  // Ask Safari not to evict the library when storage runs low.
  navigator.storage?.persist?.().catch(() => {});
  for (const file of files) {
    try {
      status.textContent = `Opening ${file.name}…`;
      const book = await importEpub(file, (done, total) => {
        status.textContent = `${file.name}: ${done} / ${total}`;
      });
      status.textContent = `Added ${book.title} (${countChapters(book.toc)} chapters).`;
    } catch (err) {
      status.classList.add('error');
      status.textContent = `${file.name}: ${err.message}`;
    }
    await render();
  }
});

render();
