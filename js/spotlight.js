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
      const art = pickForRound(state.pool);
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

  function devCardHTML(a){
    return `
      <a class="mini-card" href="${a.sourceUrl}" target="_blank" rel="noopener noreferrer">
        <img src="${a.img}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="mini-meta">
          <span class="mini-artist">${a.artist}</span>
          ${a.title ? `<span class="mini-title">${a.title}</span>` : ''}
          <span class="mini-era">${a.era}${a.date ? ', ' + a.date : ''}</span>
          ${a.medium ? `<span class="mini-medium">${a.medium}</span>` : ''}
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
  const DEV_SOURCES = [
    { label: 'Art Institute of Chicago', fn: fetchAIC },
    { label: 'Cleveland Museum of Art', fn: fetchCleveland },
    { label: 'The Metropolitan Museum of Art', fn: fetchMet }
  ];

  async function fetchDevSample(fn, count){
    const results = [];
    const seen = new Set();
    for(const term of shuffle([...TERMS])){
      if(results.length >= count) break;
      try{
        const items = await fn(term);
        items.forEach(it => {
          if(results.length < count && !seen.has(it.key)){ seen.add(it.key); results.push(it); }
        });
      } catch(e){}
    }
    return results;
  }

  function renderDevPage(){
    state.screen = 'dev';
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">dev: api check</h2>
        <p class="stage-body">not linked anywhere in the live site — pulls 5 fresh results directly from each source.</p>
        <div id="devResults">${DEV_SOURCES.map(s => `
          <div class="dev-group">
            <h3 class="dev-group-title">${s.label}</h3>
            <p class="dev-loading">loading…</p>
          </div>`).join('')}</div>
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    document.getElementById('backBtn').addEventListener('click', renderLanding);

    const groups = document.querySelectorAll('#devResults .dev-group');
    DEV_SOURCES.forEach((s, i) => {
      fetchDevSample(s.fn, 5).then(results => {
        const el = groups[i];
        if(!el) return;
        el.innerHTML = `
          <h3 class="dev-group-title">${s.label} <span class="dev-count">(${results.length} found)</span></h3>
          ${results.length
            ? `<div class="mini-grid">${results.map(devCardHTML).join('')}</div>`
            : `<p class="dev-empty">no results — check this source</p>`}`;
      });
    });
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
        const replacement = pickForRound(state.pool);
        const today = new Date().toISOString().slice(0, 10);
        await Store.set(DailyArt.KEY, JSON.stringify({ date: today, art: replacement }));
        state.dailyArt = replacement;
        renderContent();
      });
    }
  }

