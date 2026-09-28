// EPUB import: unzip, walk the spine in order, and reduce every chapter to
// plain paragraphs and headings. Nothing from the book's own markup (scripts,
// styles, attributes) reaches the reading page.

import { getBook, putBook, putChapters, deleteChapters } from './db.js';

const BLOCK = new Set(['p', 'blockquote', 'li']);
const HEADING = /^h[1-6]$/;
const INLINE = new Set(['em', 'i', 'strong', 'b']);
const DROP = new Set(['script', 'style', 'iframe', 'img', 'svg', 'noscript', 'head', 'title']);

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function clean(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Inline content of one paragraph: text plus emphasis, everything else unwrapped.
function inlineHtml(node) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeHtml(child.textContent.replace(/\s+/g, ' '));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.localName.toLowerCase();
      if (DROP.has(tag)) continue;
      if (tag === 'br') out += '<br>';
      else if (INLINE.has(tag)) {
        const inner = inlineHtml(child);
        if (inner.trim()) out += `<${tag}>${inner}</${tag}>`;
      } else out += inlineHtml(child);
    }
  }
  return out;
}

// Flattens a chapter body into a list of blocks: {type: 'h'|'p'|'hr', html}.
function collectBlocks(node, blocks) {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = clean(child.textContent);
      if (text) blocks.push({ type: 'p', html: escapeHtml(text) });
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.localName.toLowerCase();
    if (DROP.has(tag)) continue;
    if (tag === 'hr') blocks.push({ type: 'hr' });
    else if (HEADING.test(tag)) {
      const text = clean(child.textContent);
      if (text) blocks.push({ type: 'h', html: escapeHtml(text), text });
    } else if (BLOCK.has(tag)) {
      const html = inlineHtml(child).trim();
      if (html) blocks.push({ type: 'p', html });
    } else collectBlocks(child, blocks);
  }
  return blocks;
}

function parseXml(text, type) {
  const doc = new DOMParser().parseFromString(text, type);
  return doc.querySelector('parsererror') ? null : doc;
}

function parseChapter(text, fallbackTitle) {
  const doc = parseXml(text, 'application/xhtml+xml') || new DOMParser().parseFromString(text, 'text/html');
  const body = doc.querySelector('body') || doc.documentElement;
  const blocks = collectBlocks(body, []);

  // The first heading is the chapter title; it is rendered separately.
  let title = clean(doc.querySelector('title')?.textContent || '') || fallbackTitle;
  const first = blocks.findIndex((b) => b.type !== 'hr');
  if (first !== -1 && blocks[first].type === 'h') {
    title = blocks[first].text;
    blocks.splice(first, 1);
  }

  const paragraphs = blocks.filter((b) => b.type === 'p');
  // A spine item with a title and no prose is a divider page ("Book 1 — The Ring").
  const isSection = paragraphs.length === 0;
  const html = blocks
    .map((b) => (b.type === 'hr' ? '<hr>' : b.type === 'h' ? `<h3>${b.html}</h3>` : `<p>${b.html}</p>`))
    .join('\n');
  return { title, isSection, html: isSection ? '' : html };
}

function resolvePath(base, href) {
  const parts = (base ? base.split('/') : []).concat(decodeURIComponent(href.split('#')[0]).split('/'));
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'book';
}

// onProgress(done, total) is called while chapters are processed.
export async function importEpub(file, onProgress = () => {}) {
  const zip = await JSZip.loadAsync(file);
  const read = (path) => {
    const entry = zip.file(path);
    if (!entry) throw new Error(`Missing file in EPUB: ${path}`);
    return entry.async('string');
  };

  const container = parseXml(await read('META-INF/container.xml'), 'application/xml');
  const opfPath = container?.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new Error('Not a valid EPUB (no package file).');
  const opf = parseXml(await read(opfPath), 'application/xml');
  if (!opf) throw new Error('Could not read the EPUB package file.');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const title =
    clean(opf.getElementsByTagNameNS('*', 'title')[0]?.textContent || '') || file.name.replace(/\.epub$/i, '');
  const manifest = new Map();
  for (const item of opf.getElementsByTagNameNS('*', 'item')) {
    manifest.set(item.getAttribute('id'), item);
  }
  // The nav document (epub-gen's "Table Of Contents") is a list of links, not prose.
  const spine = [...opf.getElementsByTagNameNS('*', 'itemref')]
    .map((ref) => manifest.get(ref.getAttribute('idref')))
    .filter(
      (item) =>
        item &&
        /x?html/.test(item.getAttribute('media-type') || '') &&
        !/\bnav\b/.test(item.getAttribute('properties') || ''),
    );
  if (!spine.length) throw new Error('The EPUB has no readable chapters.');

  // Re-importing a recompiled EPUB (same title) replaces it but keeps the place.
  const id = slugify(title);
  const previous = await getBook(id);
  await deleteChapters(id);

  const toc = [];
  let batch = [];
  for (const [n, item] of spine.entries()) {
    const text = await read(resolvePath(opfDir, item.getAttribute('href')));
    const chapter = parseChapter(text, `Section ${n + 1}`);
    toc.push(chapter.isSection ? { t: chapter.title, s: 1 } : { t: chapter.title });
    batch.push({ book: id, i: n, title: chapter.title, isSection: chapter.isSection, html: chapter.html });
    if (batch.length === 100) {
      await putChapters(batch);
      batch = [];
      onProgress(n + 1, spine.length);
    }
  }
  await putChapters(batch);
  onProgress(spine.length, spine.length);

  const book = {
    id,
    title,
    toc,
    addedAt: previous?.addedAt || Date.now(),
    lastOpened: Date.now(),
    lastFrom: Math.min(previous?.lastFrom || 0, toc.length - 1),
    lastPara: previous?.lastPara || 0,
  };
  await putBook(book);
  return book;
}
