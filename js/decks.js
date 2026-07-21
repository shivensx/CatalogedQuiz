  /* ============================================================
     DECK-BASED SELECTION
     Replaces the old pickForRound() (pure independent random rolls
     each time, era chosen uniformly but with no memory of what was
     just shown) with two guarantees that a purely-random picker can
     only ever offer probabilistically, not actually guarantee:

     1. No artwork repeats as a featured/correct piece until every
        other available piece in its movement has been shown once.
     2. Movements themselves cycle evenly — over any 17 consecutive
        rounds, every movement appears exactly once, rather than
        random resampling occasionally clumping 80% of a session into
        one or two movements just by chance.

     Two-level deck: a shuffled deck of the 17 movement names, dealt
     one at a time and reshuffled only once fully cycled; and one
     shuffled item-deck per movement, dealt the same way. Both persist
     in `state` across "play again" on purpose — only a fresh page
     load resets them, so the fairness holds across a whole session,
     not just within one run.

     Deliberately NOT preferring already-preloaded images here (unlike
     the plain random picker below) — preload status depends on each
     client's own network timing, which isn't reproducible. Letting it
     influence deal order would silently break seed reproducibility
     for the future head-to-head mode, since two clients on the same
     seed could get different orders just from network jitter. Any
     image that fails to actually load is caught by the existing
     onerror handlers elsewhere, which mark it broken and deal a
     replacement — that safety net covers this instead.
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

  function ensureMovementDeck(){
    if(state.movementDeck.length) return;
    const available = TERMS.filter(t => state.pool.some(a => a.era === t && !state.brokenKeys.has(a.key)));
    state.movementDeck = shuffle(available.length ? available : [...TERMS]);
  }

  // Rebuilt fresh from whatever's currently in the pool for that movement
  // each time it's reshuffled — background fetching keeps adding items
  // over a session, so a later reshuffle naturally picks up the growth
  // instead of being stuck with a stale first-look snapshot forever.
  function ensureItemDeck(movement){
    if(state.itemDecks[movement] && state.itemDecks[movement].length) return;
    const items = state.pool.filter(a => a.era === movement && !state.brokenKeys.has(a.key));
    state.itemDecks[movement] = shuffle(items);
  }

  // The main entry point for actual gameplay rounds (Classic Quiz, Time
  // Attack). No arguments — it manages its own state internally rather
  // than taking a pre-filtered candidate list, since the whole point is
  // that IT decides which movement comes next, not the caller.
  function dealNextArtwork(){
    ensureMovementDeck();
    const maxAttempts = state.movementDeck.length + TERMS.length + 1;
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
        const card = state.itemDecks[movement][0];
        state.itemDecks[movement] = state.itemDecks[movement].slice(1);
        markShown(card.key);
        return card;
      }
      // This movement has nothing available right now — skip it this
      // cycle rather than getting stuck, try the next one.
      state.movementDeck = state.movementDeck.slice(1);
    }
    // Total fallback for a near-empty pool (e.g. right at boot).
    const fallback = state.pool.find(a => !state.brokenKeys.has(a.key)) || state.pool[0];
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

