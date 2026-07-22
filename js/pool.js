  // ---------------- POOL MANAGEMENT ----------------
  const imageCache = new Map(); // key -> Image element, primes the browser cache ahead of use

  function preloadArt(item){
    if(imageCache.has(item.key)) return;
    const img = new Image();
    img.src = item.img;
    imageCache.set(item.key, img);
  }

  function isPreloaded(item){
    const img = imageCache.get(item.key);
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  function addToPool(items){
    if(!items || !items.length) return;
    const existing = new Set(state.pool.map(a => a.key));
    items.forEach(a => {
      if(!existing.has(a.key)){
        state.pool.push(a);
        existing.add(a.key);
        preloadArt(a);
        state.sourceCounts[a.source] = (state.sourceCounts[a.source] || 0) + 1;
        if(a.confidenceTier && state.confidenceTierCounts[a.confidenceTier] !== undefined){
          state.confidenceTierCounts[a.confidenceTier]++;
        }
      }
    });
  }

  // Movement-based topping up no longer applies (see the rebuilt
  // fetchers) — this just makes sure the continuous background loop is
  // running. Left as its own function since call sites throughout the
  // game still call it before building a round.
  function topUpIfLow(){
    startContinuousFetching();
  }

  // Runs forever once started: repeatedly asks all three sources for
  // their next batch, in parallel, with a brief pause between rounds so
  // it isn't hammering three APIs back to back nonstop. This is what
  // actually keeps the pool (and the dev page's live counters) growing
  // for as long as the page stays open, independent of anything the
  // player is doing in a game.
  let continuousFetchStarted = false;
  async function startContinuousFetching(){
    if(continuousFetchStarted) return;
    continuousFetchStarted = true;
    while(true){
      try{
        await Promise.all([
          fetchAICBatch().then(addToPool),
          fetchClevelandBatch().then(addToPool),
          fetchMetBatch().then(addToPool)
        ]);
      } catch(e){
        // Belt-and-suspenders: each fetcher already catches its own
        // errors internally, but a single unexpected rejection here
        // should never be able to kill the loop for every source —
        // that's exactly what happened when one fetcher was briefly
        // missing its own try/catch.
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  // ---------------- SCREEN: LANDING ----------------
  function renderLanding(){
    clearTATimers();
    clearTimeout(state.classicAdvanceTimer);
    state.screen = 'landing';
    updateChrome();
    screenEl.innerHTML = `
      <div class="hero">
        <h2 class="hero-title"><span class="hero-title-img"></span></h2>
        <p class="hero-lede">${LANDING.tagline}</p>
        <div class="hero-actions">
          <button class="btn btn-primary" id="spotlightBtn">Spotlight</button>
          <button class="btn btn-primary" id="learnBtn">Learn</button>
          <button class="btn btn-primary" id="playBtn">Play</button>
        </div>
      </div>
      <button class="dev-link" id="devLinkBtn" type="button">dev</button>`;
    document.getElementById('spotlightBtn').addEventListener('click', renderContent);
    document.getElementById('learnBtn').addEventListener('click', renderLearn);
    document.getElementById('playBtn').addEventListener('click', renderModes);
    document.getElementById('devLinkBtn').addEventListener('click', renderDevPage);
  }

  // Kicks off the continuous background fetch on page load, before the
  // player has chosen a mode, so there's already a real pool to work
  // with once they pick something.
  function warmPoolInBackground(){
    startContinuousFetching();
  }

  /* ============================================================
     DAILY ARTWORK — one artwork per calendar day, persisted so it
     doesn't change on repeat visits within the same day.
     ============================================================ */
