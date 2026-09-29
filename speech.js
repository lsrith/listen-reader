// Built-in reader using the browser's speech synthesis (Web Speech API) with
// the system default voice and speed. It speaks one block at a time,
// highlights and follows it, and asks the page for more chapters as it nears
// the end, so reading never stops at a page end.

export function createSpeaker({ article, loadMore, onPosition, onChange }) {
  const synth = window.speechSynthesis;
  if (!synth) return null;

  let cur = null; // block being read (or to resume from)
  let playing = false;
  let token = 0; // invalidates callbacks from cancelled utterances

  const blocks = () => [...article.querySelectorAll('h2, .body > :not(hr)')];

  function neighbour(el, step) {
    const list = blocks();
    return list[list.indexOf(el) + step] || null;
  }

  // First block at or below the top of the screen: where reading starts.
  function firstVisible() {
    const list = blocks();
    return list.find((el) => el.getBoundingClientRect().bottom > 60) || list[0];
  }

  function mark(el) {
    article.querySelector('.speaking')?.classList.remove('speaking');
    el.classList.add('speaking');
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight * 0.7) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function speak(el) {
    if (!el) return pause();
    cur = el;
    const t = ++token;
    synth.cancel();
    mark(el);
    onPosition(Number(el.closest('[data-c]')?.dataset.c ?? 0), Number(el.dataset.p || 0));

    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return advance(t);
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => advance(t);
    u.onerror = (e) => {
      if (t !== token) return;
      // Speech that iOS blocks (no tap yet) waits for the play button.
      if (e.error === 'not-allowed') pause();
      else if (e.error !== 'interrupted' && e.error !== 'canceled') advance(t);
    };
    synth.speak(u);
  }

  async function advance(t) {
    if (t !== token || !playing) return;
    let next = neighbour(cur, 1);
    // Keep a chapter's worth of blocks ahead so the next page is ready in time.
    if (!next || blocks().length - blocks().indexOf(cur) < 40) {
      const more = await loadMore();
      if (t !== token || !playing) return;
      if (!next && more) next = neighbour(cur, 1);
    }
    speak(next);
  }

  function setPlaying(value) {
    playing = value;
    onChange(playing);
  }

  function play(from) {
    setPlaying(true);
    speak(from || cur || firstVisible());
  }

  function pause() {
    token++;
    synth.cancel();
    setPlaying(false);
  }

  // Ends a session: stops speech and removes the highlight.
  function stop() {
    pause();
    article.querySelector('.speaking')?.classList.remove('speaking');
    cur = null;
  }

  function skip(step) {
    const target = neighbour(cur || firstVisible(), step);
    if (!target) return;
    if (playing) speak(target);
    else {
      cur = target;
      mark(target);
    }
  }

  addEventListener('pagehide', () => synth.cancel());

  return {
    play,
    pause,
    stop,
    skip,
    toggle: () => (playing ? pause() : play()),
  };
}
