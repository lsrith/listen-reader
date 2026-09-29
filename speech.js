// Built-in player using the browser's speech synthesis (Web Speech API).
// It speaks one block at a time, highlights and follows it, and asks the page
// for more chapters as it nears the end, so reading never stops at a page end.
//
// iOS stops speech when the screen locks. Two optional workarounds:
// - Lock-screen mode plays a silent looping track so the page counts as playing
//   media, which is also what makes lock-screen controls appear (Media Session).
// - Keep screen awake holds a screen wake lock while playing.

import { getSetting, setSetting } from './db.js';

const RATES = [0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.75, 2];

function quality(voice) {
  const uri = (voice.voiceURI || '').toLowerCase();
  if (uri.includes('premium')) return 2;
  if (uri.includes('enhanced')) return 1;
  return 0;
}

// One second of 8-bit silence as a WAV blob, looped by the lock-screen mode.
function silentWavUrl() {
  const rate = 8000;
  const buf = new ArrayBuffer(44 + rate);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + rate, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, rate, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function createPlayer({ article, book, loadMore, onPosition }) {
  const $ = (id) => document.getElementById(id);
  const synth = window.speechSynthesis;
  const ui = {
    bar: $('player'),
    prev: $('pPrev'),
    play: $('pPlay'),
    next: $('pNext'),
    rate: $('pRate'),
    voice: $('pVoice'),
    lock: $('pLock'),
    awake: $('pAwake'),
    status: $('pStatus'),
  };

  if (!synth) {
    ui.bar.hidden = true;
    return { playFrom() {} };
  }

  let cur = null; // block being read (or to resume from)
  let playing = false;
  let token = 0; // invalidates callbacks from cancelled utterances
  let voices = [];
  let silent = null;
  let wakeLock = null;

  // ---- settings -----------------------------------------------------------
  ui.rate.innerHTML = RATES.map((r) => `<option value="${r}">${r}×</option>`).join('');
  ui.rate.value = String(getSetting('rate'));
  ui.rate.addEventListener('change', () => {
    setSetting('rate', Number(ui.rate.value));
    if (playing) speak(cur);
  });

  ui.lock.checked = getSetting('lockMode');
  ui.lock.addEventListener('change', () => {
    setSetting('lockMode', ui.lock.checked);
    if (playing && ui.lock.checked) startSilent();
    else stopSilent();
  });

  ui.awake.checked = getSetting('keepAwake');
  ui.awake.addEventListener('change', () => {
    setSetting('keepAwake', ui.awake.checked);
    if (playing && ui.awake.checked) holdWake();
    else releaseWake();
  });

  function loadVoices() {
    const all = synth.getVoices();
    if (!all.length) return;
    const en = all.filter((v) => /^en\b/i.test(v.lang));
    voices = (en.length ? en : all).sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name));
    const saved = getSetting('voice');
    const tag = ['', ' · Enhanced', ' · Premium'];
    ui.voice.innerHTML =
      '<option value="">System default</option>' +
      voices
        .map((v) => `<option value="${v.voiceURI}">${v.name} (${v.lang})${tag[quality(v)]}</option>`)
        .join('');
    ui.voice.value = voices.some((v) => v.voiceURI === saved) ? saved : '';
  }
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
  ui.voice.addEventListener('change', () => {
    setSetting('voice', ui.voice.value);
    if (playing) speak(cur);
  });

  // ---- blocks -------------------------------------------------------------
  const blocks = () => [...article.querySelectorAll('h2, .body > :not(hr)')];

  function neighbour(el, step) {
    const list = blocks();
    return list[list.indexOf(el) + step] || null;
  }

  // First block at or below the top of the screen: where "play" starts.
  function firstVisible() {
    return blocks().find((el) => el.getBoundingClientRect().bottom > 60) || blocks()[0];
  }

  function position(el) {
    const c = Number(el.closest('[data-c]')?.dataset.c ?? 0);
    return { c, p: Number(el.dataset.p || 0) };
  }

  function mark(el) {
    article.querySelector('.speaking')?.classList.remove('speaking');
    el.classList.add('speaking');
    const r = el.getBoundingClientRect();
    if (document.visibilityState === 'visible' && (r.top < 60 || r.bottom > innerHeight * 0.75)) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // ---- speech -------------------------------------------------------------
  function speak(el) {
    if (!el) return stop('End of book.');
    cur = el;
    const t = ++token;
    synth.cancel();
    mark(el);
    const { c, p } = position(el);
    onPosition(c, p);
    updateSession(c);

    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return advance(t);
    const u = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.voiceURI === ui.voice.value);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = Number(ui.rate.value) || 1;
    u.onend = () => advance(t);
    u.onerror = (e) => {
      if (t !== token) return;
      if (e.error === 'not-allowed') stop('Tap ▶ to start speech.');
      else if (e.error !== 'interrupted' && e.error !== 'canceled') advance(t);
    };
    synth.speak(u);
    status('');
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

  function play(from) {
    playing = true;
    ui.play.textContent = '⏸';
    ui.play.setAttribute('aria-label', 'Pause');
    if (ui.lock.checked) startSilent();
    if (ui.awake.checked) holdWake();
    speak(from || cur || firstVisible());
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }

  function pause() {
    playing = false;
    token++;
    synth.cancel();
    ui.play.textContent = '▶';
    ui.play.setAttribute('aria-label', 'Play');
    stopSilent();
    releaseWake();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }

  function stop(message) {
    pause();
    status(message);
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

  function status(text) {
    ui.status.textContent = text;
    ui.status.hidden = !text;
  }

  // ---- lock screen, wake lock -------------------------------------------------
  function startSilent() {
    if (!silent) {
      silent = new Audio(silentWavUrl());
      silent.loop = true;
      silent.setAttribute('playsinline', '');
      // The lock-screen pause button pauses this element directly.
      silent.addEventListener('pause', () => {
        if (playing && ui.lock.checked) pause();
      });
    }
    silent.play().catch(() => status('Lock-screen mode could not start audio.'));
  }

  function stopSilent() {
    if (silent && !silent.paused) silent.pause();
  }

  async function holdWake() {
    try {
      wakeLock = await navigator.wakeLock?.request('screen');
    } catch {
      status('This browser can’t keep the screen awake.');
    }
  }

  function releaseWake() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && playing && ui.awake.checked) holdWake();
  });

  function updateSession(c) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: book.toc[c]?.t || book.title, artist: book.title });
  }

  if ('mediaSession' in navigator) {
    const set = (action, fn) => {
      try {
        navigator.mediaSession.setActionHandler(action, fn);
      } catch {}
    };
    set('play', () => play());
    set('pause', pause);
    set('nexttrack', () => skip(1));
    set('previoustrack', () => skip(-1));
  }

  // ---- controls -------------------------------------------------------------
  ui.play.addEventListener('click', () => (playing ? pause() : play()));
  ui.prev.addEventListener('click', () => skip(-1));
  ui.next.addEventListener('click', () => skip(1));
  addEventListener('pagehide', () => synth.cancel());

  return { playFrom: (el) => play(el) };
}
