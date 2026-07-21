  const state = {
    screen: 'landing',
    mode: null,
    pool: [],
    brokenKeys: new Set(), // images that failed to actually load — excluded from future picks
    // Deck-based selection (see js/decks.js) — a shuffled deck of the 17
    // movement names (dealt one at a time, reshuffled only once fully
    // cycled) plus one shuffled item-deck per movement. Together these
    // guarantee no artwork repeats until its movement's deck is
    // exhausted, and that movements themselves cycle evenly rather than
    // being resampled at random each round. Persists across "play
    // again" on purpose — only a fresh page load resets it.
    movementDeck: [],
    itemDecks: {},
    // Sliding window of recently-shown artwork keys, across every
    // surface (featured pieces, quiz decoys, CAPTCHA tiles) — used to
    // keep decoys/tiles from repeating something just shown elsewhere.
    recentlyShown: [],
    // Seeded RNG: defaults to Math.random (unseeded). Set via setSeed()
    // on the rules screen. Every piece of gameplay randomness (deck
    // shuffling, decoy selection, museum random-page selection) reads
    // from state.rng() rather than calling Math.random() directly, so a
    // given seed reproduces the same run — the groundwork for a future
    // head-to-head mode where two players share a seed.
    rng: Math.random,
    seed: null,
    health: 10,
    correctCount: 0,
    best: 0,
    current: null,
    answered: false,
    termCursor: 0,
    history: [],
    lastResult: null,
    // Time Attack
    masterClock: 60,
    taCorrect: 0,
    taSeen: 0,
    taBest: 0,
    taEnded: false,
    roundStartTs: 0,
    taTimers: { masterInterval: null, roundTimeout: null, advance: null },
    classicAdvanceTimer: null,
    // CAPTCHA
    captchaTarget: null,
    captchaTiles: [],
    captchaCorrect: 0,
    captchaWrongStreak: 0,
    captchaCleared: 0,
    captchaBest: 0,
    captchaMistakes: 0,
    captchaLocked: new Set(),
    dailyArt: null
  };

  const screenEl = document.getElementById('screen');

  // ---------------- SEEDED RNG ----------------
  // mulberry32 — small, fast, good-enough statistical quality for a game,
  // and fully deterministic given the same 32-bit seed.
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // djb2-style string hash — turns an arbitrary typed-in seed string into
  // the 32-bit integer mulberry32 needs.
  function hashSeedString(str){
    let h = 1779033703 ^ str.length;
    for(let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h ^ (h >>> 16)) >>> 0;
  }

  // Empty/falsy input reverts to genuine unseeded randomness.
  function setSeed(seedInput){
    if(!seedInput){
      state.rng = Math.random;
      state.seed = null;
      return;
    }
    state.rng = mulberry32(hashSeedString(String(seedInput)));
    state.seed = String(seedInput);
  }

  function pickRandom(arr){ return arr[Math.floor(state.rng()*arr.length)]; }

  // Fisher-Yates, reading from state.rng() — returns a new array rather
  // than mutating in place, both because that's safer in general and
  // because Array.sort with a random comparator (the old approach) isn't
  // actually a uniform shuffle, just a common but biased shortcut.
  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(state.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatScore(n){ return Number.isInteger(n) ? String(n) : n.toFixed(1); }

  function renderHeartsInto(el){
    let html = '';
    for(let i=0;i<10;i++){
      const remaining = Math.max(0, Math.min(1, state.health - i));
      const widthPx = (remaining*18).toFixed(1);
      html += `<span class="heart-slot">
        <svg viewBox="0 0 24 24"><path d="${HEART_PATH}" fill="rgba(0,0,0,0.15)"/></svg>
        <span class="heart-front-wrap" style="width:${widthPx}px">
          <svg viewBox="0 0 24 24" style="width:18px;height:16px;"><path d="${HEART_PATH}" fill="var(--heart)"/></svg>
        </span>
      </span>`;
    }
    el.innerHTML = html;
  }

