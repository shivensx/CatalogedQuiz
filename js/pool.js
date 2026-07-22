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
      await Promise.all([
        fetchAICBatch().then(addToPool),
        fetchClevelandBatch().then(addToPool),
        fetchMetBatch().then(addToPool)
      ]);
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

  // Builds the scrolling background mosaic from whatever artwork has
  // loaded into the pool so far. Cheap to rebuild — it only touches
  // image src attributes, which are already cached from preloading.
  // AIC serves IIFF images at whatever width is requested in the URL.
  // Gameplay uses 700px; the background mosaic only ever shows these
  // at ~70px, so requesting a much smaller render is a lot less data
  // to pull down and decode. Other sources are left as-is.
  function thumbUrl(url){
    return url.replace(/\/full\/\d+,\/0\/default\.jpg$/, '/full/200,/0/default.jpg');
  }

  function renderBgGrid(){
    const container = document.getElementById('bgGrid');
    if(!container) return;
    if(!state.pool.length){ container.innerHTML = ''; return; }

    const cols = 20;
    const tilesPerCol = 10;
    const needed = cols * tilesPerCol;

    // Cycle through a shuffled list of unique images rather than
    // sampling independently at random — independent random picks
    // statistically clump the same handful of images together even
    // with a decent-sized pool. Cycling spreads repeats evenly, and
    // once the pool has 200+ images there are no repeats at all.
    const unique = shuffle(state.pool.map(a => thumbUrl(a.img)));
    const sequence = [];
    for(let i = 0; i < needed; i++) sequence.push(unique[i % unique.length]);
    const shuffledSequence = shuffle(sequence);

    let html = '';
    let idx = 0;
    for(let c = 0; c < cols; c++){
      const dur = (40 + Math.random() * 40).toFixed(1);
      const delay = -(Math.random() * dur).toFixed(1);
      let tiles = '';
      for(let r = 0; r < tilesPerCol; r++){
        tiles += `<img src="${shuffledSequence[idx++]}" alt="" referrerpolicy="no-referrer">`;
      }
      html += `<div class="bg-col"><div class="bg-col-track" style="animation:bgScroll ${dur}s linear infinite; animation-delay:${delay}s;">${tiles}${tiles}</div></div>`;
    }
    container.innerHTML = html;
  }

  // Swaps a portion of the already-rendered tiles to freshly-arrived
  // images, in place — the scroll animation keeps running undisturbed
  // (no rebuild), but the grid visibly keeps filling in with more
  // variety for a couple of seconds as more of the pool loads in.
  // Runs exactly once, staggering individual tile swaps across ~2s
  // so the grid visibly fills in with more variety without every
  // touched tile changing in the same frame (which is what caused
  // the flashing/row-flicker when this ran on every fetch).
  function diversifyBgGridOnce(){
    const container = document.getElementById('bgGrid');
    if(!container) return;
    const images = state.pool.map(a => thumbUrl(a.img));
    if(!images.length) return;
    container.querySelectorAll('img').forEach(img => {
      if(Math.random() < 0.45){
        const delay = Math.random() * 2200;
        setTimeout(() => {
          if(!document.body.contains(img)) return;
          img.src = pickRandom(images);
        }, delay);
      }
    });
  }

  // Kicks off a small fetch on boot, before the player has chosen a
  // mode, purely so the landing page's background mosaic has real
  // artwork to show rather than sitting empty on first visit. The
  // grid builds as soon as the first results land, then gets one
  // gentle diversify pass once everything has settled — after that
  // it's left alone for the rest of the session.
  function warmPoolInBackground(){
    let built = false;
    let diversified = false;
    const onFirstData = () => {
      if(built || !state.pool.length) return;
      built = true;
      if(state.screen !== 'round') renderBgGrid();
    };
    const checkFirstData = setInterval(() => {
      if(state.pool.length){
        onFirstData();
        clearInterval(checkFirstData);
      }
    }, 200);
    const checkDiversify = setInterval(() => {
      if(state.pool.length >= 60 && !diversified){
        diversified = true;
        if(state.screen !== 'round') diversifyBgGridOnce();
        clearInterval(checkDiversify);
      }
    }, 500);
    startContinuousFetching();
  }

  /* ============================================================
     DAILY ARTWORK — one artwork per calendar day, persisted so it
     doesn't change on repeat visits within the same day.
     ============================================================ */
