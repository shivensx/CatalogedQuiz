  /* ============================================================
     DECK-BASED SELECTION
     Replaces the old pickForRound() (pure independent random rolls
     each time, era chosen uniformly but with no memory of what was
     just shown) with two guarantees that a purely-random picker can
     only ever offer probabilistically, not actually guarantee:

     1. No artwork repeats as a featured/correct piece until every
        other available piece in its movement has been shown once.
     2. Movements themselves cycle evenly — over a full cycle, every
        movement gets a turn before any movement gets a second one,
        rather than random resampling occasionally clumping most of a
        session into one or two movements just by chance.

     Two-level deck: a shuffled deck of the 17 movement names, dealt
     one at a time; and one shuffled item-deck per movement, dealt the
     same way. Both persist in `state` across "play again" on purpose
     — only a fresh page load resets them, so the fairness holds
     across a whole session, not just within one run.

     A movement whose deck is empty when its turn comes up (no data
     loaded for it yet) is deferred to the BACK of the current cycle
     rather than dropped from it — dropping it was quietly giving
     already-populated movements more frequent turns than ones still
     waiting on background fetches to catch up, which undercut the
     whole point of the movement deck.

     Deliberately NOT preferring already-preloaded images here (unlike
     the plain random picker below) — preload status depends on each
     client's own network timing, which isn't reproducible. Any image
     that fails to actually load is caught by the existing onerror
     handlers elsewhere, which mark it broken and deal a replacement.

     Seeded runs (see setSeed() in js/state.js) read from a frozen,
     canonically-ordered snapshot of the pool instead of the live one
     — see refreshDeckSourcePool() below for why.
     ============================================================ */

  const RECENTLY_SHOWN_WINDOW = 40;

  function markShown(key){
    if(!key) return;
    state.recentlyShown.push(key);
    if(state.recentlyShown.length > RECENTLY_SHOWN_WINDOW) state.recentlyShown.shift();
  }

  function isRecentlyShown(key){
    return state.recentlyShown.includes(key);
  }

  // The array a shuffle starts from should depend only on WHICH items
  // exist, not the order network responses happened to arrive in —
  // otherwise the same seed can produce different shuffles just from
  // request timing, which is exactly the "played it twice, got a
  // different order" bug. Sorting by each item's own stable key first
  // removes that source of variation.
  function stableSortedPool(pool){
    return pool.slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  function currentDeckSourcePool(){
    return state.activePoolSnapshot || state.pool;
  }

  // Called once per "begin" click (see startGame/startGameTimeAttack/
  // startGameCaptcha). A seeded run freezes a snapshot of the pool as
  // it exists right now and starts its decks completely fresh, so the
  // ONLY thing determining that run's order is the seed itself — not
  // leftover deck state from an earlier unseeded run, and not further
  // background fetches arriving mid-run. Unseeded play keeps using the
  // live, ever-growing pool and lets decks persist across runs as
  // before, since reproducibility isn't the goal there.
  //
  // Honest limitation: this makes ONE run internally consistent, and
  // makes replaying a seed reproduce the same result as long as the
  // pool's contents haven't changed since — but if real time has
  // passed and background fetching has genuinely added new paintings,
  // a later replay of the same seed will reflect that larger pool and
  // can diverge. True bit-for-bit replay regardless of elapsed time
  // would mean caching the exact pool snapshot the first time a given
  // seed is used, and always reusing that cached snapshot for it —
  // real to build, just bigger than this pass, and worth doing
  // properly once the head-to-head mode is actually underway.
  function refreshDeckSourcePool(){
    if(state.seed){
      state.activePoolSnapshot = stableSortedPool(state.pool);
      state.movementDeck = [];
      state.itemDecks = {};
      state.recentlyShown = []; // a seeded run must start from a fully clean slate
    } else {
      state.activePoolSnapshot = null;
    }
  }

  function ensureMovementDeck(){
    if(state.movementDeck.length) return;
    const source = currentDeckSourcePool();
    const available = TERMS.filter(t => source.some(a => (a.eras || []).includes(t) && !state.brokenKeys.has(a.key)));
    state.movementDeck = shuffle(available.length ? available : [...TERMS]);
  }

  // Rebuilt fresh from the current source pool each time it's
  // reshuffled — for unseeded play, background fetching keeps adding
  // items over a session, so a later reshuffle naturally picks up that
  // growth instead of being stuck with a stale snapshot forever.
  //
  // Confident matches are shuffled among themselves and dealt first;
  // uncertain matches (real Wikidata movement data, just not a
  // confident single answer for this specific piece) are shuffled
  // separately and appended at the end — still fully in play, just
  // deprioritized rather than excluded.
  function ensureItemDeck(movement){
    if(state.itemDecks[movement] && state.itemDecks[movement].length) return;
    const source = currentDeckSourcePool();
    const items = source.filter(a => (a.eras || []).includes(movement) && !state.brokenKeys.has(a.key));
    const confident = items.filter(a => a.movementConfidence === 'confident');
    const uncertain = items.filter(a => a.movementConfidence !== 'confident');
    state.itemDecks[movement] = shuffle(confident).concat(shuffle(uncertain));
  }

  // The main entry point for actual gameplay rounds (Classic Quiz, Time
  // Attack). No arguments — it manages its own state internally rather
  // than taking a pre-filtered candidate list, since the whole point is
  // that IT decides which movement comes next, not the caller.
  function dealNextArtwork(){
    ensureMovementDeck();
    const maxAttempts = TERMS.length * 3 + 5;
    for(let attempts = 0; attempts < maxAttempts; attempts++){
      if(!state.movementDeck.length){
        ensureMovementDeck();
        if(!state.movementDeck.length) break; // pool is genuinely empty
      }
      const movement = state.movementDeck[0];
      ensureItemDeck(movement);
      // Drop anything that went bad after this deck was already built.
      state.itemDecks[movement] = (state.itemDecks[movement] || []).filter(a => !state.brokenKeys.has(a.key));

      if(state.itemDecks[movement].length){
        state.movementDeck = state.movementDeck.slice(1);
        const deck = state.itemDecks[movement];
        // Prefer a card that hasn't been shown very recently (covers a
        // thin deck that just cycled back sooner than a full session
        // would ideally like), without breaking deck order more than
        // necessary — look for the first eligible card, don't reshuffle.
        let idx = deck.findIndex(a => !isRecentlyShown(a.key));
        if(idx === -1) idx = 0;
        const card = deck[idx];
        state.itemDecks[movement] = deck.slice(0, idx).concat(deck.slice(idx + 1));
        markShown(card.key);
        return card;
      }
      // Nothing available for this movement RIGHT NOW — defer it to the
      // BACK of the current cycle instead of dropping it, so it gets
      // another chance once background fetching has caught up, rather
      // than sitting out the rest of this cycle entirely (which was
      // quietly giving already-populated movements more frequent turns).
      state.movementDeck = [...state.movementDeck.slice(1), movement];
    }
    // Total fallback for a near-empty pool (e.g. right at boot).
    const source = currentDeckSourcePool();
    const fallback = source.find(a => !state.brokenKeys.has(a.key)) || source[0];
    if(fallback) markShown(fallback.key);
    return fallback;
  }

  // Plain random pick (era chosen uniformly, then an item within it),
  // preferring already-preloaded images. Used where deck guarantees
  // don't apply or don't matter: the Spotlight daily pick (one piece a
  // day, not a repeated-rounds context), its broken-image replacement,
  // and CAPTCHA's tile filling (a 3x3 grid problem, not a movement-
  // cycling problem — CAPTCHA gets its own repeat protection via
  // isRecentlyShown at the call site instead).
  function pickRandomArtwork(candidates){
    const usable = candidates.filter(a => !state.brokenKeys.has(a.key));
    const pool = usable.length ? usable : candidates;
    const byEra = {};
    pool.forEach(a => { (byEra[a.era] = byEra[a.era] || []).push(a); });
    const eras = Object.keys(byEra);
    const era = pickRandom(eras);
    const group = byEra[era];
    const ready = group.filter(isPreloaded);
    return ready.length ? pickRandom(ready) : pickRandom(group);
  }

