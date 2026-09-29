# Listen Reader

A static web page for listening to EPUB novels on iPhone, two ways:

- **Safari's Listen to Page** reads the chapter pages in the system voice and
  keeps going with the screen locked.
- **Read aloud** (Web Speech API, built in) uses the same system voice, follows
  the text, skips by paragraph and runs on into the next chapters without
  stopping. It needs the screen on.

**Live:** <https://lsrith.github.io/listen-reader/>. Tested on iPhone: Listen to
Page keeps reading with the screen locked, and Read aloud's default voice is the
same voice Listen to Page uses.

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

The reading page keeps the screen on (wake lock) while it's open. Its bottom bar
has five icons: library, chapter list, previous page, next page, and read aloud
(headphones).

### Read aloud

- The headphones icon starts reading at the paragraph at the top of the screen.
  The bar switches to voice controls: previous paragraph, play/pause, next
  paragraph, and ✕ to stop and return to the page icons.
- Tapping a paragraph shows a small bubble at the tap: headphones reads aloud
  from there, and the page icon starts a new page there (for Listen to Page).
  Tapping anywhere else dismisses it.
- The current paragraph is highlighted and kept near the top of the screen.
- It loads further chapters as it goes, so it doesn't stop at the page end.
- The saved place is the paragraph being read, so **Continue** resumes there.
- Voice and speed are the system defaults (Settings → Accessibility → Spoken
  Content). There are no in-page settings.
- iOS stops web speech when the screen locks. Web speech produces no audio
  track, so a page can't keep it going in the background. Hence the wake lock.

### Listen to Page

1. In Safari, tap **Aa → Listen to Page**. Lock the phone.
2. At the end of the page, tap **Next**, then start Listen to Page again.
3. To skip forward or back, tap a paragraph → page icon in the bubble ("Start
   page here"), then start Listen to Page again. It always reads from the top
   of the page.

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
| `read.html`, `read.js` | Reading page: one run of chapters as a single `<article>` (more are appended while reading aloud), icon bar, wake lock |
| `speech.js` | Read aloud: Web Speech with system defaults, paragraph highlight and skip |
| `import.js` | EPUB → cleaned paragraphs (spine order, nav page skipped, dividers kept as section headings) |
| `db.js` | IndexedDB storage and settings |
| `sw.js` | Offline cache; bump `CACHE` when changing the file list |
