  // ---------------- GAME START ----------------
  const MIN_LOADING_MS = 4500;

  // Guarantees the loading screen (and its rotating messages) stays up
  // for at least MIN_LOADING_MS, regardless of how fast the pool loads.
  // The extra time isn't wasted — warmPoolInBackground() already started
  // every source the instant the page loaded, so this window is mostly
  // spent letting images actually finish downloading (not just their
  // JSON metadata), which is what keeps a round from showing a blank
  // or half-loaded image.
  function waitMinimum(startTs){
    const remaining = MIN_LOADING_MS - (Date.now() - startTs);
    return remaining > 0 ? new Promise(resolve => setTimeout(resolve, remaining)) : Promise.resolve();
  }

  async function ensurePool(){
    if(state.pool.length >= 4) return true;

    // Seed every movement up front (AIC + Cleveland are single fast
    // calls each) so the stratified picker above always has all
    // terms to choose from, not just whichever four happened to be
    // fetched first. Met is NOT re-fetched here — warmPoolInBackground()
    // already kicked it off the moment the page loaded, and it's the
    // slowest of the three (a search plus N detail fetches), so doing
    // it again here would just double up on the slowest request for
    // no benefit.
    const promises = [];
    TERMS.forEach(t => {
      promises.push(fetchAIC(t).then(addToPool));
      promises.push(fetchCleveland(t).then(addToPool));
    });
    await Promise.allSettled(promises);

    return state.pool.length >= 4;
  }

  async function startGame(){
    renderLoading();
    const loadStart = Date.now();
    state.best = await ScoreStore.getBest();
    const ok = await ensurePool();
    if(!ok){ renderError(); return; }
    await waitMinimum(loadStart);
    refreshDeckSourcePool();

    state.health = 10;
    state.correctCount = 0;
    state.history = [];
    beginRound();
  }

  // ---------------- ROUND ----------------
  function buildRound(){
    const art = dealNextArtwork();
    topUpIfLow();

    // Distractors are real (artist, era) pairings lifted from other actual
    // artworks in the pool — never a synthetic remix of a correct field
    // with a wrong one. Remixing was the source of two real problems:
    // the correct artist's name could end up on two different options
    // (an easy tell), and a wrong artist could get paired with a movement
    // they have nothing to do with (a Western name next to "Ukiyo-e"),
    // which gives the answer away through common sense rather than
    // actual knowledge of the piece. Recently-shown pieces (featured or
    // decoy, anywhere in the app) are avoided too, so a decoy doesn't
    // repeat something the player just saw a round or two ago.
    const notRecent = state.pool.filter(a => a.key !== art.key && !isRecentlyShown(a.key));
    const fallbackPool = state.pool.filter(a => a.key !== art.key);
    const candidates = shuffle(notRecent.length >= 3 ? notRecent : fallbackPool);
    const usedArtists = new Set([art.artist]);
    const usedPairs = new Set([`${art.artist}|${art.era}`]);
    const distractors = [];

    for(const a of candidates){
      if(distractors.length >= 3) break;
      if(usedArtists.has(a.artist)) continue;
      const pairKey = `${a.artist}|${a.era}`;
      if(usedPairs.has(pairKey)) continue;
      usedArtists.add(a.artist);
      usedPairs.add(pairKey);
      distractors.push(a);
    }
    // Pool too thin for three distinct artists — relax that requirement
    // (still real pairings, just possibly repeating an artist) rather
    // than ever showing fewer than four options.
    if(distractors.length < 3){
      for(const a of candidates){
        if(distractors.length >= 3) break;
        const pairKey = `${a.artist}|${a.era}`;
        if(usedPairs.has(pairKey)) continue;
        usedPairs.add(pairKey);
        distractors.push(a);
      }
    }
    distractors.forEach(a => markShown(a.key));

    const options = shuffle([
      { artist: art.artist, era: art.era, artistRight: true, eraRight: true },
      ...distractors.map(a => ({
        artist: a.artist,
        era: a.era,
        artistRight: a.artist === art.artist,
        eraRight: (art.eras || [art.era]).includes(a.era)
      }))
    ]);
    while(options.length < 4){
      options.push({ artist: 'Unrecorded Artist', era: 'Unclassified Period', artistRight: false, eraRight: false });
    }

    return { art, options };
  }

  function beginRound(){
    stopLoadingMessages();
    state.screen = 'round';
    updateChrome();
    state.current = buildRound();
    state.answered = false;
    renderRound();
  }

  function renderRound(){
    const { art, options } = state.current;
    screenEl.innerHTML = `
      <div class="frame">
        <img id="artImg" src="${art.img}" alt="Artwork to identify" referrerpolicy="no-referrer">
        <div class="badge" id="badge"></div>
      </div>
      <div class="stats-row">
        <div class="hearts-row" id="hearts"></div>
        <div class="score-label" id="scoreLabel">score: ${formatScore(state.correctCount)}</div>
      </div>
      <div class="choices" id="choices"></div>`;

    renderHeartsInto(document.getElementById('hearts'));

    const img = document.getElementById('artImg');
    img.addEventListener('load', () => img.classList.add('thrown'));
    if(img.complete && img.naturalWidth > 0) img.classList.add('thrown');
    img.addEventListener('error', () => {
      state.brokenKeys.add(art.key);
      if(state.screen === 'round' && !state.answered) beginRound();
    });

    const choicesEl = document.getElementById('choices');
    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<span class="choice-artist">${opt.artist}</span><span class="choice-era">${opt.era}</span>`;
      b.addEventListener('click', () => handleAnswer(b, opt));
      choicesEl.appendChild(b);
    });
  }

  function handleAnswer(btn, chosen){
    if(state.answered) return;
    state.answered = true;

    let heartsLost, verdictClass, verdictLabel, badgeText;
    if(chosen.artistRight && chosen.eraRight){
      heartsLost = 0; verdictClass = 'full'; verdictLabel = 'dead on'; badgeText = 'full marks';
      state.correctCount += 1;
    } else if(chosen.artistRight || chosen.eraRight){
      heartsLost = 0.5; verdictClass = 'partial'; verdictLabel = 'half right';
      badgeText = chosen.artistRight ? 'artist right, movement wrong' : 'movement right, artist wrong';
      state.correctCount += 0.5;
    } else {
      heartsLost = 1; verdictClass = 'miss'; verdictLabel = 'missed it';
      badgeText = 'both wrong';
    }
    state.health = Math.max(0, state.health - heartsLost);

    document.querySelectorAll('.choice').forEach(c => {
      c.disabled = true;
      const label = c.querySelector('.choice-artist').textContent;
      const eraLabel = c.querySelector('.choice-era').textContent;
      const opt = state.current.options.find(o => o.artist === label && o.era === eraLabel);
      if(opt){
        if(opt.artistRight && opt.eraRight) c.classList.add('opt-full');
        else if(opt.artistRight || opt.eraRight) c.classList.add('opt-partial');
        else c.classList.add('opt-miss');
      }
    });
    btn.classList.add('selected');

    renderHeartsInto(document.getElementById('hearts'));
    document.getElementById('scoreLabel').textContent = `score: ${formatScore(state.correctCount)}`;

    const badge = document.getElementById('badge');
    badge.className = `badge show ${verdictClass}`;
    badge.textContent = badgeText;

    state.history.push({ art: state.current.art, options: state.current.options, verdictClass, verdictLabel });

    scheduleNextClassic();
  }

  function scheduleNextClassic(){
    clearTimeout(state.classicAdvanceTimer);
    state.classicAdvanceTimer = setTimeout(() => {
      if(state.health <= 0) renderGameOver();
      else beginRound();
    }, 900);
  }


  // ---------------- GAME OVER ----------------
  async function renderGameOver(){
    state.screen = 'gameover';
    updateChrome();
    const isRecord = state.correctCount > state.best;
    if(isRecord){ state.best = state.correctCount; await ScoreStore.setBest(state.best); }
    state.lastResult = { mode: 'classic', correct: state.correctCount, best: state.best, isRecord };
    paintGameOverClassic();
  }

  function paintGameOverClassic(){
    state.screen = 'gameover';
    updateChrome();
    const r = state.lastResult;
    screenEl.innerHTML = `
      <div class="end-wrap">
        <div class="end-top">
          <div class="end-label">out of hearts</div>
          <p class="end-score">${formatScore(r.correct)}</p>
          <p class="end-sub">${r.isRecord ? 'new best' : `best ${formatScore(r.best)}`}</p>
        </div>
        <div class="end-actions">
          <button class="btn btn-primary end-act-left" id="reviewBtn">review</button>
          <button class="btn btn-primary end-act-center" id="againBtn">play again</button>
          <button class="btn btn-primary end-act-right" id="backBtn">back</button>
        </div>
      </div>`;
    document.getElementById('againBtn').addEventListener('click', startGame);
    document.getElementById('reviewBtn').addEventListener('click', renderReview);
    document.getElementById('backBtn').addEventListener('click', renderModes);
  }

  // ================================================================
  // TIME ATTACK MODE
  // Reuses the shared pool/fetch layer, the throw-in animation, and
  // the placard reveal component. Round building, timing, and the
  // game-over screen are specific to this mode.
  // ================================================================
