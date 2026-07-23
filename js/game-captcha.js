  const CAPTCHA_WIN = 5;
  const CAPTCHA_FAIL_STREAK = 3;
  const CAPTCHA_GRID_SIZE = 9;

  async function startGameCaptcha(){
    renderLoading();
    const loadStart = Date.now();
    state.captchaBest = await CaptchaScoreStore.getBest();
    const ok = await ensurePool();
    if(!ok){ renderError(); return; }
    await waitMinimum(loadStart);

    // CAPTCHA specifically needs at least one movement with real
    // Wikidata-classified paintings to have any target to quiz on —
    // ensurePool() only guarantees raw pool depth, not classified
    // depth. Checked explicitly here rather than letting a missing
    // target quietly show up as "undefined" in the prompt.
    const hasClassifiedMovement = state.pool.some(a => a.eras && a.eras.length);
    if(!hasClassifiedMovement){ renderError(); return; }

    state.captchaCleared = 0;
    state.history = [];
    beginCaptchaRound();
  }

  function eraGroups(){
    const byEra = {};
    state.pool.forEach(a => {
      if(!a.eras || !a.eras.length) return; // no real movement data — not eligible as a target or option
      (byEra[a.era] = byEra[a.era] || []).push(a);
    });
    return byEra;
  }

  function pickCaptchaTarget(){
    const byEra = eraGroups();
    // Favor movements with enough depth to keep refilling correct
    // tiles without immediately running out of fresh matches.
    const deep = Object.keys(byEra).filter(e => byEra[e].length >= 4);
    const pool = deep.length ? deep : Object.keys(byEra);
    return pickRandom(pool);
  }

  // Picks one artwork for a tile, excluding anything already showing
  // elsewhere in the grid so the same piece never appears twice at once,
  // and preferring pieces not recently shown elsewhere in the app so a
  // tile doesn't repeat something the player just saw a round or two ago.
  function pickCaptchaArt(matchTarget, excludeKeys){
    let candidates;
    if(matchTarget){
      candidates = state.pool.filter(a => (a.eras || [a.era]).includes(state.captchaTarget) && !excludeKeys.includes(a.key));
    } else {
      candidates = state.pool.filter(a => !(a.eras || [a.era]).includes(state.captchaTarget) && !excludeKeys.includes(a.key));
    }
    const notRecent = candidates.filter(a => !isRecentlyShown(a.key));
    if(notRecent.length) candidates = notRecent;
    if(!candidates.length) candidates = state.pool.filter(a => !excludeKeys.includes(a.key));
    if(!candidates.length) candidates = state.pool;
    // A matching tile is a positive claim ("this IS the target movement")
    // — prefer confident matches over uncertain ones, same reasoning as
    // Classic Quiz/Time Attack decoys (see sortByConfidenceTier in
    // js/decks.js). Non-matching tiles don't need this: confidence
    // doesn't change whether "not the target" is a safe claim.
    const picked = matchTarget
      ? (sortByConfidenceTier(candidates)[0] || pickRandomArtwork(candidates))
      : pickRandomArtwork(candidates);
    // Absolute last resort — state.pool should never actually be empty
    // by this point (ensurePool() guarantees it before a round starts),
    // but this guarantees pickCaptchaArt itself can never return
    // something falsy and leave a tile undefined in the grid.
    const finalPick = picked || state.pool[0];
    markShown(finalPick.key);
    return finalPick;
  }

  function beginCaptchaRound(){
    state.screen = 'round';
    updateChrome();
    state.captchaTarget = pickCaptchaTarget();
    state.captchaCorrect = 0;
    state.captchaWrongStreak = 0;
    state.captchaMistakes = 0;
    state.captchaLocked = new Set();

    // Randomize how many of the 9 starting tiles match, so the grid
    // can't be pattern-memorized round to round.
    const matchCount = 2 + Math.floor(Math.random() * 4); // 2..5
    const tiles = [];
    for(let i = 0; i < CAPTCHA_GRID_SIZE; i++){
      const shouldMatch = i < matchCount;
      const excludeKeys = tiles.map(t => t.key);
      const art = pickCaptchaArt(shouldMatch, excludeKeys);
      tiles.push(art);
    }
    state.captchaTiles = shuffle(tiles);
    topUpIfLow();
    renderCaptchaGrid();
  }

  function renderCaptchaGrid(){
    screenEl.innerHTML = `
      <div class="captcha-wrap">
        <p class="captcha-prompt">Select every square with <b>${state.captchaTarget}</b>.</p>
        <div class="captcha-meta">
          <span>${state.captchaCorrect} / ${CAPTCHA_WIN} correct</span>
          <span>${state.captchaWrongStreak} / ${CAPTCHA_FAIL_STREAK} wrong in a row</span>
        </div>
        <div class="captcha-grid" id="captchaGrid"></div>
      </div>`;

    const grid = document.getElementById('captchaGrid');
    state.captchaTiles.forEach((art, idx) => {
      const b = document.createElement('button');
      b.className = 'captcha-tile';
      b.dataset.idx = idx;
      b.innerHTML = `<img src="${art.img}" alt="" referrerpolicy="no-referrer"><span class="captcha-mark"></span>`;
      b.addEventListener('click', () => handleCaptchaTileClick(idx));
      grid.appendChild(b);

      // Persists across later replacements of this same tile (src just
      // gets reassigned on the same <img> node), so one listener covers
      // the whole life of this grid position.
      const imgEl = b.querySelector('img');
      imgEl.addEventListener('error', () => {
        if(state.screen !== 'round') return;
        const current = state.captchaTiles[idx];
        if(current) state.brokenKeys.add(current.key);
        const excludeKeys = state.captchaTiles.map(t => t.key);
        state.captchaTiles[idx] = pickCaptchaArt(Math.random() < 0.4, excludeKeys);
        imgEl.src = state.captchaTiles[idx].img;
      });
    });
  }

  function handleCaptchaTileClick(idx){
    if(state.captchaLocked.has(idx)) return;
    state.captchaLocked.add(idx);

    const art = state.captchaTiles[idx];
    const correct = (art.eras || [art.era]).includes(state.captchaTarget);
    const tileEl = document.querySelector(`.captcha-tile[data-idx="${idx}"]`);
    tileEl.classList.add('locked', correct ? 'flash-correct' : 'flash-wrong');
    tileEl.querySelector('.captcha-mark').textContent = correct ? '✓' : '✕';

    state.history.push({
      art,
      verdictClass: correct ? 'full' : 'miss',
      verdictLabel: correct ? 'matched' : 'no match'
    });

    if(correct){
      state.captchaCorrect++;
      state.captchaWrongStreak = 0;
    } else {
      state.captchaWrongStreak++;
      state.captchaMistakes++;
    }

    setTimeout(() => {
      if(!document.getElementById('captchaGrid')) return;
      if(state.captchaCorrect >= CAPTCHA_WIN){ captchaVerify(true); return; }
      if(state.captchaWrongStreak >= CAPTCHA_FAIL_STREAK){ captchaVerify(false); return; }

      // Replace this tile — right or wrong — with a fresh, freshly
      // randomized artwork (not guaranteed to match or not).
      const excludeKeys = state.captchaTiles.map(t => t.key);
      const shouldMatch = Math.random() < 0.4;
      state.captchaTiles[idx] = pickCaptchaArt(shouldMatch, excludeKeys);
      topUpIfLow();

      const img = tileEl.querySelector('img');
      img.src = state.captchaTiles[idx].img;
      tileEl.classList.remove('locked', 'flash-correct', 'flash-wrong');
      tileEl.querySelector('.captcha-mark').textContent = '';
      state.captchaLocked.delete(idx);

      document.querySelector('.captcha-meta span:first-child').textContent = `${state.captchaCorrect} / ${CAPTCHA_WIN} correct`;
      document.querySelector('.captcha-meta span:last-child').textContent = `${state.captchaWrongStreak} / ${CAPTCHA_FAIL_STREAK} wrong in a row`;
    }, 380);
  }

  function captchaVerify(passed){
    state.screen = 'round';
    screenEl.innerHTML = `
      <div class="captcha-verify">
        <div class="spinner"></div>
        <p>verifying…</p>
      </div>`;
    setTimeout(() => {
      if(state.screen !== 'round') return;
      if(passed) captchaPass();
      else captchaFail();
    }, 900);
  }

  const CAPTCHA_PASS_LINES = {
    flawless: ["suspiciously too human…", "not one mistake. suspicious.", "too clean. we're onto you."],
    clean: ["impressively human.", "barely broke a sweat.", "verified, and it wasn't close."],
    normal: ["certifiably not a robot.", "verified: human, probably.", "you may proceed, human."],
    rough: ["verified, but it was close.", "human confirmed. barely.", "that was more stressful than it needed to be."]
  };
  const CAPTCHA_FAIL_LINES = {
    none: ["definitely a robot.", "the machines have you outnumbered.", "0 for 3. rough start."],
    some: ["try again, human.", "so close, and yet a robot.", "the machines win this round."],
    close: ["almost human.", "one wrong move from freedom.", "so close to certified."]
  };

  function captchaPassLine(mistakes){
    const tier = mistakes === 0 ? 'flawless' : mistakes === 1 ? 'clean' : mistakes === 2 ? 'normal' : 'rough';
    return pickRandom(CAPTCHA_PASS_LINES[tier]);
  }
  function captchaFailLine(correctCount){
    const tier = correctCount === 0 ? 'none' : correctCount <= 2 ? 'some' : 'close';
    return pickRandom(CAPTCHA_FAIL_LINES[tier]);
  }

  async function captchaPass(){
    state.captchaCleared++;
    const isRecord = state.captchaCleared > state.captchaBest;
    if(isRecord){ state.captchaBest = state.captchaCleared; await CaptchaScoreStore.setBest(state.captchaBest); }
    state.lastResult = { mode: 'captcha', passed: true, line: captchaPassLine(state.captchaMistakes) };
    paintCaptchaResult();
  }

  async function captchaFail(){
    const isRecord = state.captchaCleared > state.captchaBest;
    if(isRecord){ state.captchaBest = state.captchaCleared; await CaptchaScoreStore.setBest(state.captchaBest); }
    state.lastResult = { mode: 'captcha', passed: false, line: captchaFailLine(state.captchaCorrect) };
    paintCaptchaResult();
  }

  function paintCaptchaResult(){
    state.screen = 'gameover';
    updateChrome();
    const r = state.lastResult;
    screenEl.innerHTML = `
      <div class="end-wrap">
        <div class="end-top">
          <p class="end-score" style="font-size:clamp(34px,6vw,58px); line-height:1.2;">${r.line}</p>
        </div>
        <div class="end-actions">
          <button class="btn btn-primary end-act-left" id="reviewBtn">review</button>
          <button class="btn btn-primary end-act-center" id="againBtn">${r.passed ? 'next captcha' : 'play again'}</button>
          <button class="btn btn-primary end-act-right" id="backBtn">back</button>
        </div>
      </div>`;
    document.getElementById('reviewBtn').addEventListener('click', renderReview);
    document.getElementById('backBtn').addEventListener('click', renderModes);
    document.getElementById('againBtn').addEventListener('click', () => {
      if(r.passed) beginCaptchaRound();
      else startGameCaptcha();
    });
  }

