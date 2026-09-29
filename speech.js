// Built-in reader using the browser's speech synthesis (Web Speech API) with
// the system default voice. At rate 1 the speed is left to the system too.
// It speaks one block at a time, highlights and follows it, and asks the page
// for more chapters as it nears the end, so reading never stops at a page end.

export function createSpeaker({ article, loadMore, onPosition, onChange, rate = 1 }) {
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

  // Highlights the block and scrolls it to just below the top of the screen,
  // so the text still to come fills the rest of the view.
  function mark(el) {
    article.querySelector('.speaking')?.classList.remove('speaking');
    el.classList.add('speaking');
    const offset = Math.round(innerHeight * 0.08);
    const top = el.getBoundingClientRect().top;
    if (Math.abs(top - offset) > 4) scrollTo({ top: scrollY + top - offset, behavior: 'smooth' });
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
    if (rate !== 1) u.rate = rate;
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
    // A new speed restarts the current block so it applies straight away.
    setRate(value) {
      rate = value;
      if (playing) speak(cur);
    },
  };
}
