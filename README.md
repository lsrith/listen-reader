# Listen Reader

A static web page for listening to EPUB novels on iPhone, two ways:

- **Listen to Page**, the browser's built-in reader, reads the chapter pages in
  the system voice and keeps going with the screen locked.
- **Read aloud** (Web Speech API, built in) uses the same system voice, follows
  the text, skips by paragraph and runs on into the next chapters without
  stopping. It needs the screen on.

**Live:** <https://lsrith.github.io/listen-reader/>. Tested on iPhone: Listen to
Page keeps reading with the screen locked, and Read aloud's default voice is the
same voice Listen to Page uses.

- The site has no book content. EPUBs are picked from Files/iCloud Drive and stored
  in the browser's IndexedDB on the phone.
- The site caches itself for offline use. Online, it always loads the latest
  deploy; the cached copy is used offline or when the network is slow.
- There's no build step and no dependencies to install (JSZip is vendored).

## Using it

1. Copy the `.epub` files to iCloud Drive (the compiled novels are in
   `../chrome-extension/novels/<novel>/<novel>.epub`).
2. On the iPhone, open the site in a normal browser tab, tap **+** and pick one
   or more `.epub` files.
3. Tap a book to open it at your saved place, as a page of N chapters.

Every page has the same slim icon bar at the bottom:

| Page | Icons |
|---|---|
| Library | **+** add EPUB · **?** tips |
| Chapters | library · open book: continue reading · target: scroll to the current chapter |
| Reading | library · chapter list · previous page · next page · layers + number: chapters per page (default 5; changing it reopens the page at the current paragraph) · headphones: read aloud |

Each library row shows the book, your current chapter (with its "Book N"
divider when chapter numbers restart), a progress bar, and icons for the
chapter list and removing the book. The reading page keeps the screen on (wake
lock) while it's open.

### Read aloud

- The headphones icon starts reading at the paragraph at the top of the screen.
  The bar switches to voice controls: previous paragraph, play/pause, next
  paragraph, speed, and ✕ to stop and return to the page icons.
- Tapping a paragraph shows a small bubble at the tap: headphones reads aloud
  from there, and the page icon starts a new page there (for Listen to Page).
  Tapping anywhere else dismisses it.
- The current paragraph is highlighted and kept near the top of the screen.
- It loads further chapters as it goes, so it doesn't stop at the page end.
- The saved place is the paragraph being read, so **Continue** resumes there.
- The voice is the system default (Settings → Accessibility → Spoken Content).
  The speed icon in the voice controls opens a menu of 0.65×–1.5×; 1× leaves the speed to
  the system. A new speed restarts the current paragraph.
- iOS stops web speech when the screen locks. Web speech produces no audio
  track, so a page can't keep it going in the background. Hence the wake lock.

### Listen to Page

1. Open the browser's page menu and choose **Listen to Page**. Lock the phone.
2. At the end of the page, tap **Next**, then start Listen to Page again.
3. To skip forward or back, tap a paragraph → page icon in the bubble ("Start
   page here"), then start Listen to Page again. It always reads from the top
   of the page.

A page can't change Listen to Page's own controls or see its position. With the
screen locked, pause, skip and speed are the browser's.

Re-importing a recompiled EPUB with the same title replaces the book and keeps
your place.

Open pages in a normal browser tab. A Home Screen web app has no browser
menu, so Listen to Page isn't available there.

## Files

| File | Role |
|---|---|
| `index.html`, `library.js` | Library, import, settings |
| `chapters.html`, `chapters.js` | Chapter list |
| `read.html`, `read.js` | Reading page: one run of chapters as a single `<article>` (more are appended while reading aloud), icon bar, wake lock |
| `speech.js` | Read aloud: Web Speech with system defaults, paragraph highlight and skip |
| `import.js` | EPUB → cleaned paragraphs (spine order, nav page skipped, dividers kept as section headings) |
| `db.js` | IndexedDB storage and settings |
| `icons.svg` | Icon sprite shared by all pages (`<use href="icons.svg#i-…">`) |
| `sw.js` | Offline cache; bump `CACHE` when changing the file list |

## License

[MIT](LICENSE). The bundled `vendor/jszip.min.js` is JSZip, dual-licensed MIT or
GPLv3 by its authors (see the header of that file).
