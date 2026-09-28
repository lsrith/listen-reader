# Listen Reader

A static web page that turns EPUBs into plain chapter pages for Safari's
**Listen to Page** on iPhone, so novels can be listened to with the screen
locked, in the system voice.

- The site has no book content. EPUBs are picked from Files/iCloud Drive and stored
  in Safari's IndexedDB on the phone.
- The site caches itself for offline use after the first visit.
- There's no build step and no dependencies to install (JSZip is vendored).

## Using it

1. **Add EPUB…** and pick one or more `.epub` files.
2. **Continue** opens a page of N chapters (**Chapters per page**, default 5).
3. In Safari, tap **Aa → Listen to Page**. Lock the phone.
4. At the end of the page, tap **Next**, then start Listen to Page again.
5. To skip forward or back, tap a paragraph → **Start page here**, then start
   Listen to Page again. It always reads from the top of the page.

Re-importing a recompiled EPUB with the same title replaces the book and keeps
your place.

Open pages in a normal Safari tab. A Home Screen web app has no Aa menu, so
Listen to Page isn't available there.

## Publishing on GitHub Pages

```sh
git init && git add . && git commit -m "Listen Reader"
git branch -M main
git remote add origin git@github.com:<you>/listen-reader.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Deploy from a branch → main / (root)**.
The site appears at `https://<you>.github.io/listen-reader/`.

`.gitignore` excludes `*.epub` and `*.json` so novels are never committed.

## Local testing

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765/>. Listen to Page itself only exists in Safari.

## Files

| File | Role |
|---|---|
| `index.html`, `library.js` | Library, import, settings |
| `chapters.html`, `chapters.js` | Chapter list |
| `read.html`, `read.js` | Reading page (one run of chapters as a single `<article>`) |
| `import.js` | EPUB → cleaned paragraphs (spine order, nav page skipped, dividers kept as section headings) |
| `db.js` | IndexedDB storage and settings |
| `sw.js` | Offline cache; bump `CACHE` when changing the file list |
