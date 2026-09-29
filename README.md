# Listen Reader

A static web page for listening to EPUB novels on iPhone, two ways:

- **Safari's Listen to Page** reads the chapter pages in the system voice and
  keeps going with the screen locked.
- **The built-in player** (Web Speech API) follows the text, skips by paragraph
  and runs on into the next chapters without stopping.

**Live:** <https://lsrith.github.io/listen-reader/>. Tested on iPhone: Listen to
Page appears in the Aa menu and keeps reading with the screen locked. The
built-in player hasn't been tested on iPhone yet.

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

### Built-in player

- **▶** starts at the paragraph at the top of the screen. **⏮ ⏭** skip by
  paragraph. The current paragraph is highlighted and kept in view.
- It loads further chapters as it goes, so it doesn't stop at the page end.
- The saved place is the paragraph being read, so **Continue** resumes there.
- **Voice & options:** choose a voice (Premium and Enhanced voices are listed
  first; download them in Settings → Accessibility → Spoken Content → Voices).
  Siri voices aren't available to web pages.
- iOS stops web speech when the screen locks. There are two workarounds:
  - **Lock-screen mode (experimental)** plays a silent looping track, so the page
    counts as playing media. That also puts play/pause and next/previous
    paragraph on the lock screen.
  - **Keep screen awake** stops the phone locking while the player runs.

### Listen to Page

1. In Safari, tap **Aa → Listen to Page**. Lock the phone.
2. At the end of the page, tap **Next**, then start Listen to Page again.
3. To skip forward or back, tap a paragraph → **Start page here**, then start
   Listen to Page again. It always reads from the top of the page.

A page can't change Listen to Page's own controls or see its position. With the
screen locked, pause, skip and speed are Safari's.

Re-importing a recompiled EPUB with the same title replaces the book and keeps
your place.

Open pages in a normal Safari tab. A Home Screen web app has no Aa menu, so
Listen to Page isn't available there.

## Files

| File | Role |
|---|---|
| `index.html`, `library.js` | Library, import, settings |
| `chapters.html`, `chapters.js` | Chapter list |
| `read.html`, `read.js` | Reading page (one run of chapters as a single `<article>`; more are appended as the player reaches the end) |
| `speech.js` | Built-in player: Web Speech, paragraph highlight, lock-screen mode, wake lock, Media Session |
| `import.js` | EPUB → cleaned paragraphs (spine order, nav page skipped, dividers kept as section headings) |
| `db.js` | IndexedDB storage and settings |
| `sw.js` | Offline cache; bump `CACHE` when changing the file list |
