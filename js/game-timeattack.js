  const TA_MASTER_START = 60;
  const TA_ROUND_SECONDS = 5;
  const TA_PENALTY = 3;

  function formatClock(totalSeconds){
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function clearTATimers(){
    if(state.taTimers.masterInterval) clearInterval(state.taTimers.masterInterval);
    if(state.taTimers.roundTimeout) clearTimeout(state.taTimers.roundTimeout);
    if(state.taTimers.advance) clearTimeout(state.taTimers.advance);
    state.taTimers = { masterInterval: null, roundTimeout: null, advance: null };
  }

  function startMasterClock(){
    state.taTimers.masterInterval = setInterval(() => {
      state.masterClock -= 1;
      if(state.masterClock <= 0){
        state.masterClock = 0;
        updateMasterClockDisplay();
        endTimeAttackRun();
        return;
      }
      updateMasterClockDisplay();
    }, 1000);
  }

  function updateMasterClockDisplay(){
    const el = document.getElementById('masterClock');
    if(!el) return;
    el.textContent = formatClock(state.masterClock);
    el.classList.remove('warn', 'danger', 'flash');
    if(state.masterClock > 0 && state.masterClock <= 5){
      el.classList.add('danger', 'flash');
    } else if(state.masterClock <= 15){
      el.classList.add('warn');
    }
  }

  function showClockDelta(text, cls){
    const el = document.getElementById('clockDelta');
    if(!el) return;
    el.classList.remove('show');
    void el.offsetWidth;
    el.textContent = text;
    el.className = `clock-delta show ${cls}`;
  }

  async function startGameTimeAttack(){
    renderLoading();
    const loadStart = Date.now();
    state.taBest = await TAScoreStore.getBest();
    const ok = await ensurePool();
    if(!ok){ renderError(); return; }
    await waitMinimum(loadStart);
    refreshDeckSourcePool();

    clearTATimers();
    state.masterClock = TA_MASTER_START;
    state.taCorrect = 0;
    state.taSeen = 0;
    state.taEnded = false;
    state.history = [];

    await renderCountdown();
    beginRoundTA();
    startMasterClock();
  }

  function renderCountdown(){
    const steps = ['3', '2', '1', 'Go!'];
    state.screen = 'round';
    updateChrome();
    return new Promise(resolve => {
      let i = 0;
      const paint = () => {
        screenEl.innerHTML = `<div class="countdown"><span>${steps[i]}</span></div>`;
      };
      paint();
      const interval = setInterval(() => {
        i++;
        if(i >= steps.length){
          clearInterval(interval);
          resolve();
          return;
        }
        paint();
      }, 700);
    });
  }

  function buildRoundTA(){
    const art = dealNextArtwork();
    topUpIfLow();

    const classifiable = state.pool.filter(a => a.eras && a.eras.length);
    const others = classifiable.filter(a => a.key !== art.key);
    const notRecent = others.filter(o => o.artist !== art.artist && o.era !== art.era && !isRecentlyShown(o.key));
    const unrelatedCandidates = notRecent.length
      ? notRecent
      : others.filter(o => o.artist !== art.artist && o.era !== art.era);
    // Tier-sorted, then take the front — highest confidence available,
    // randomized within that tier, rather than an equal-odds pick
    // across every confidence level (see sortByConfidenceTier in
    // js/decks.js).
    const tierSorted = sortByConfidenceTier(unrelatedCandidates);
    const unrelated = tierSorted.length
      ? tierSorted[0]
      : (others.length ? pickRandom(others) : art);
    markShown(unrelated.key);

    const options = shuffle([
      { artist: art.artist, era: art.era, correct: true },
      { artist: unrelated.artist, era: unrelated.era, correct: false }
    ]);

    return { art, options };
  }

  function beginRoundTA(isRetry){
    stopLoadingMessages();
    state.screen = 'round';
    updateChrome();
    if(!isRetry) state.imageRetryCount = 0;
    state.current = buildRoundTA();
    state.answered = false;
    renderRoundTA();
  }

  // Starts the 5s window and its visual bar only once the artwork is
  // actually visible — preloading (see preloadArt) means this fires
  // immediately in the common case, but this is the guarantee that the
  // clock never runs before the image does.
  function armRoundTimerTA(){
    state.roundStartTs = performance.now();
    clearTimeout(state.taTimers.roundTimeout);
    state.taTimers.roundTimeout = setTimeout(() => handleTimeoutTA(), TA_ROUND_SECONDS * 1000);
    const bar = document.getElementById('roundTimerBar');
    if(bar) bar.classList.add('run');
  }

  function renderRoundTA(){
    const { art, options } = state.current;
    screenEl.innerHTML = `
      <div class="frame">
        <img id="artImg" src="${art.img}" alt="Artwork to identify" referrerpolicy="no-referrer">
        <div class="round-timer"><div class="round-timer-bar" id="roundTimerBar"></div></div>
      </div>
      <div class="stats-row">
        <div class="clock-wrap">
          <span class="master-clock" id="masterClock">${formatClock(state.masterClock)}</span>
          <span class="clock-delta" id="clockDelta"></span>
        </div>
        <div class="score-label" id="scoreLabel">correct: ${state.taCorrect}</div>
      </div>
      <div class="choices choices-binary" id="choices"></div>`;

    updateMasterClockDisplay();

    const img = document.getElementById('artImg');
    const onReady = () => { img.classList.add('thrown'); armRoundTimerTA(); };
    img.addEventListener('load', onReady);
    if(img.complete && img.naturalWidth > 0) onReady();
    img.addEventListener('error', () => {
      state.brokenKeys.add(art.key);
      if(state.screen !== 'round' || state.answered) return;
      state.imageRetryCount = (state.imageRetryCount || 0) + 1;
      if(state.imageRetryCount > 3) return;
      beginRoundTA(true);
    });

    const choicesEl = document.getElementById('choices');
    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<span class="choice-artist">${opt.artist}</span><span class="choice-era">${opt.era}</span>`;
      b.addEventListener('click', () => handleAnswerTA(b, opt));
      choicesEl.appendChild(b);
    });
  }

  function revealChoicesTA(){
    document.querySelectorAll('#choices .choice').forEach(c => {
      c.disabled = true;
      const label = c.querySelector('.choice-artist').textContent;
      const eraLabel = c.querySelector('.choice-era').textContent;
      const opt = state.current.options.find(o => o.artist === label && o.era === eraLabel);
      if(opt) c.classList.add(opt.correct ? 'opt-full' : 'opt-miss');
    });
  }

  function handleAnswerTA(btn, chosen){
    if(state.answered) return;
    state.answered = true;
    clearTimeout(state.taTimers.roundTimeout);

    const elapsed = (performance.now() - state.roundStartTs) / 1000;
    state.taSeen++;

    let deltaText, verdictClass, verdictLabel;
    if(chosen.correct){
      const bonus = elapsed <= 2 ? 10 : elapsed <= 4 ? 5 : 1;
      state.masterClock += bonus;
      state.taCorrect++;
      deltaText = `+${bonus}s`; verdictClass = 'full'; verdictLabel = 'correct';
    } else {
      state.masterClock = Math.max(0, state.masterClock - TA_PENALTY);
      deltaText = `−${TA_PENALTY}s`; verdictClass = 'miss'; verdictLabel = 'wrong';
    }

    revealChoicesTA();
    btn.classList.add('selected');
    showClockDelta(deltaText, verdictClass);
    updateMasterClockDisplay();
    document.getElementById('scoreLabel').textContent = `correct: ${state.taCorrect}`;
    state.history.push({ art: state.current.art, options: state.current.options, verdictClass, verdictLabel });

    scheduleNextTA();
  }

  function handleTimeoutTA(){
    if(state.answered) return;
    state.answered = true;
    state.taSeen++;
    state.masterClock = Math.max(0, state.masterClock - TA_PENALTY);

    revealChoicesTA();
    showClockDelta(`−${TA_PENALTY}s`, 'miss');
    updateMasterClockDisplay();
    state.history.push({ art: state.current.art, options: state.current.options, verdictClass: 'miss', verdictLabel: 'missed it' });

    scheduleNextTA();
  }

  function scheduleNextTA(){
    clearTimeout(state.taTimers.advance);
    state.taTimers.advance = setTimeout(() => {
      if(state.taEnded) return;
      if(state.masterClock <= 0) endTimeAttackRun();
      else beginRoundTA();
    }, 700);
  }

  async function endTimeAttackRun(){
    if(state.taEnded) return;
    state.taEnded = true;
    clearTATimers();

    const isRecord = state.taCorrect > state.taBest;
    if(isRecord){ state.taBest = state.taCorrect; await TAScoreStore.setBest(state.taBest); }
    state.lastResult = { mode: 'time', correct: state.taCorrect, seen: state.taSeen, best: state.taBest, isRecord };
    paintGameOverTA();
  }

  function paintGameOverTA(){
    state.screen = 'gameover';
    updateChrome();
    const r = state.lastResult;
    screenEl.innerHTML = `
      <div class="end-wrap">
        <div class="end-top">
          <div class="end-label">time's up</div>
          <p class="end-score">${r.correct}</p>
          <p class="end-sub">${r.seen} seen · ${r.isRecord ? 'new best' : `best ${r.best}`}</p>
        </div>
        <div class="end-actions">
          <button class="btn btn-primary end-act-left" id="reviewBtn">review</button>
          <button class="btn btn-primary end-act-center" id="againBtn">play again</button>
          <button class="btn btn-primary end-act-right" id="backBtn">back</button>
        </div>
      </div>`;
    document.getElementById('againBtn').addEventListener('click', startGameTimeAttack);
    document.getElementById('reviewBtn').addEventListener('click', renderReview);
    document.getElementById('backBtn').addEventListener('click', renderModes);
  }

  // ================================================================
  // CAPTCHA MODE — "prove you're human (art edition)"
  // A 3x3 grid of artworks; click every tile matching the named
  // movement. Each click (right or wrong) is evaluated immediately
  // and the tile is replaced with a fresh one. Untimed, self-paced,
  // like a real CAPTCHA. Reuses the shared pool/fetch layer.
  // ================================================================
