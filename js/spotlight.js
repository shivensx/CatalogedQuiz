  const DailyArt = {
    KEY: 'cataloged-daily-artwork',
    async get(){
      const today = new Date().toISOString().slice(0, 10);
      const raw = await Store.get(this.KEY);
      if(raw){
        try{
          const saved = JSON.parse(raw);
          if(saved.date === today && saved.art) return saved.art;
        } catch(e){}
      }
      if(!state.pool.length) return null;
      const art = pickRandomArtwork(state.pool);
      await Store.set(this.KEY, JSON.stringify({ date: today, art }));
      return art;
    }
  };

  // ---------------- SCREEN: CONTENT ----------------
  // Same-artist matches first, then same-movement matches, pulled from
  // whatever is already loaded across all connected museums — no extra
  // network calls, since the whole point is that the pool already spans
  // multiple sources by the time someone reaches this page.
  function relatedArtworks(art, limit){
    if(!art) return [];
    const sameArtist = state.pool.filter(a => a.key !== art.key && a.artist === art.artist);
    const sameEra = state.pool.filter(a => a.key !== art.key && a.artist !== art.artist && a.era === art.era);
    const seen = new Set();
    const result = [];
    [...sameArtist, ...sameEra].forEach(a => {
      if(result.length < limit && !seen.has(a.key)){ seen.add(a.key); result.push(a); }
    });
    return result;
  }

  function miniCardHTML(a){
    return `
      <a class="mini-card" href="${a.sourceUrl}" target="_blank" rel="noopener noreferrer">
        <img src="${a.img}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="mini-meta">
          <span class="mini-artist">${a.artist}</span>
          <span class="mini-era">${a.era}</span>
        </span>
      </a>`;
  }

  // ================================================================
  // DEV PAGE — not linked from anywhere in the normal flow except a
  // small low-key link on the landing page. Pulls a handful of fresh
  // results directly from each museum API (independent of whatever's
  // already in the shared gameplay pool) so it's obvious at a glance
  // whether a given source is actually returning usable data.
  // ================================================================
  /* ============================================================
     DEV PAGE — not linked anywhere in the live site. Shows a simple
     live counter of how many paintings each source has actually
     contributed to the pool so far, updating in real time as the
     continuous background fetch (see startContinuousFetching() in
     js/pool.js) keeps pulling more in. No movement/era breakdown
     anymore — that concept doesn't exist in the pool right now.
     ============================================================ */
  let devCounterInterval = null;

  const CONFIDENCE_TIER_META = {
    high:    { label: 'high (real P135, well-dated)',       color: 'var(--success)' },
    medium:  { label: 'medium (P135 exists, ambiguous fit)', color: '#d9a441' },
    low:     { label: 'low (no P135, text mention only)',    color: '#c1684f' },
    veryLow: { label: 'very low (no evidence at all)',       color: 'var(--danger)' }
  };

  function renderDevCounters(){
    const container = document.getElementById('devCounters');
    if(!container){
      if(devCounterInterval){ clearInterval(devCounterInterval); devCounterInterval = null; }
      return;
    }
    const sources = [
      'Art Institute of Chicago',
      'Cleveland Museum of Art',
      'The Metropolitan Museum of Art'
    ];
    const total = sources.reduce((sum, s) => sum + (state.sourceCounts[s] || 0), 0);
    const tiers = state.confidenceTierCounts;
    const tierTotal = Object.values(tiers).reduce((a, b) => a + b, 0) || 1; // avoid /0 before anything loads

    container.innerHTML = `
      <div class="dev-meter-total">total: <b>${total}</b> paintings loaded</div>
      <div class="dev-meter-bar">
        ${Object.keys(CONFIDENCE_TIER_META).map(tier => {
          const pct = (tiers[tier] / tierTotal) * 100;
          return pct > 0 ? `<div class="dev-meter-segment" style="width:${pct}%; background:${CONFIDENCE_TIER_META[tier].color};"></div>` : '';
        }).join('')}
      </div>
      <div class="dev-meter-legend">
        ${Object.keys(CONFIDENCE_TIER_META).map(tier => `
          <div class="dev-meter-legend-item">
            <span class="dev-meter-swatch" style="background:${CONFIDENCE_TIER_META[tier].color};"></span>
            <span class="dev-meter-legend-value">${tiers[tier] || 0}</span>
            <span class="dev-meter-legend-label">${CONFIDENCE_TIER_META[tier].label}</span>
          </div>`).join('')}
      </div>
      <div class="dev-counter-grid">
        ${sources.map(s => `
          <div class="dev-counter-card">
            <span class="dev-counter-value">${state.sourceCounts[s] || 0}</span>
            <span class="dev-counter-label">${s}</span>
          </div>`).join('')}
      </div>`;
  }

  function renderDevPage(){
    state.screen = 'dev';
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">dev: live fetch counter</h2>
        <p class="stage-body">not linked anywhere in the live site — breaks down movement-match confidence across four tiers as paintings load, live.</p>
        <div class="dev-counters" id="devCounters"></div>
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    document.getElementById('backBtn').addEventListener('click', () => {
      if(devCounterInterval){ clearInterval(devCounterInterval); devCounterInterval = null; }
      renderLanding();
    });

    startContinuousFetching(); // make sure it's running even if this is the first screen visited

    renderDevCounters();
    if(devCounterInterval) clearInterval(devCounterInterval);
    devCounterInterval = setInterval(renderDevCounters, 500);
  }

  async function renderContent(){
    await ensurePool();
    state.dailyArt = await DailyArt.get();
    state.screen = 'content';
    updateChrome();

    const art = state.dailyArt;
    const chips = art ? learnChips(art) : [];
    const related = art ? relatedArtworks(art, 24) : [];
    screenEl.innerHTML = `
      <div class="spotlight-page">
        <h2 class="stage-title spotlight-title">Spotlight</h2>
        <div class="spotlight-body">
          ${art ? `
          <div class="daily-section">
            <div class="daily-frame">
              <img id="dailyImg" src="${art.img}" alt="" referrerpolicy="no-referrer">
            </div>
            <div class="daily-label">
              <p class="pc-artist">${art.artist}</p>
              ${art.title ? `<p class="pc-title">${art.title}</p>` : ''}
              <p class="pc-era">${art.era}${art.date ? ', ' + art.date : ''}</p>
              ${art.medium ? `<p class="pc-medium">${art.medium}</p>` : ''}
            </div>
          </div>
          <div class="spotlight-links">
            ${chips.map(c => `<a class="spotlight-link" href="${c.url}" target="_blank" rel="noopener noreferrer">${c.label}</a>`).join('')}
          </div>` : ''}
        </div>
        ${related.length ? `
        <div class="related-section">
          <h3 class="related-title">related</h3>
          <div class="mini-grid">${related.map(miniCardHTML).join('')}</div>
        </div>` : ''}
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    document.getElementById('backBtn').addEventListener('click', renderLanding);
    const dailyImg = document.getElementById('dailyImg');
    if(dailyImg){
      dailyImg.addEventListener('error', async () => {
        state.brokenKeys.add(art.key);
        if(!state.pool.length) return;
        const replacement = pickRandomArtwork(state.pool);
        const today = new Date().toISOString().slice(0, 10);
        await Store.set(DailyArt.KEY, JSON.stringify({ date: today, art: replacement }));
        state.dailyArt = replacement;
        renderContent();
      });
    }
  }

