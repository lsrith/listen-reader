# Listen Reader

A static web page that turns EPUBs into plain chapter pages for Safari's
**Listen to Page** on iPhone, so novels can be listened to with the screen
locked, in the system voice.

**Live:** <https://lsrith.github.io/listen-reader/>. Tested on iPhone: Listen to
Page appears in the Aa menu and keeps reading with the screen locked.

- The site has no book content. EPUBs are picked from Files/iCloud Drive and stored
  in Safari's IndexedDB on the phone.
- The site caches itself for offline use after the first visit.
- There's no build step and no dependencies to install (JSZip is vendored).

## Using it

1. Copy the `.epub` files to iCloud Drive (the compiled novels are in
   `../chrome-extension/novels/<novel>/<novel>.epub`).
2. On the iPhone, open the site in a normal Safari tab, tap **Add EPUB…** and
   pick one or more `.epub` files.
3. **Continue** opens a page of N chapters (**Chapters per page**, default 5).
4. In Safari, tap **Aa → Listen to Page**. Lock the phone.
5. At the end of the page, tap **Next**, then start Listen to Page again.
6. To skip forward or back, tap a paragraph → **Start page here**, then start
   Listen to Page again. It always reads from the top of the page.

A page can't change Listen to Page's own controls. With the screen locked,
pause, skip and speed are Safari's. Paragraph skipping works by restarting the
page at the tapped paragraph.

Re-importing a recompiled EPUB with the same title replaces the book and keeps
your place.

Open pages in a normal Safari tab. A Home Screen web app has no Aa menu, so
Listen to Page isn't available there.

## Deploying

GitHub Pages serves the `main` branch root of
[lsrith/listen-reader](https://github.com/lsrith/listen-reader). A push to
`main` deploys in about a minute:

```sh
git push
```

This clone sets `core.sshCommand` to use `~/.ssh/id_ed25519_github`, because
the default SSH key isn't registered with GitHub.

Phones pick up the new version on their second visit after a deploy: the
service worker serves the cached copy first and refreshes it in the background.

`.gitignore` excludes `*.epub` and `*.json` so novels are never committed. It
also excludes `.devcontainer/devcontainer.json`, which holds local paths.

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
