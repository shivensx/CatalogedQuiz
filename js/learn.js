  /* ============================================================
     LEARN TAB — rendering. Content/data lives in js/learn-content.js;
     the AIC lookup + Wikipedia portrait fetchers live in
     js/api-sources.js. This file is just the screens: four browsable
     lists (Movements / Artists / Subjects / Mediums), and detail
     pages showing a write-up on the left and its referenced
     artworks, larger, on the right.

     Navigation between entries happens inline: mentioning Monet in
     Renoir's write-up (or anywhere else) renders his name as a
     clickable reference that jumps straight to his page. There's no
     separate "continue" flow — following the content wherever it's
     mentioned. is the flow.
     ============================================================ */

  const learnExampleCache = new Map();  // lookup key -> resolved artwork (or null)
  const learnPortraitCache = new Map(); // artist id -> image url (or null)

  function learnLookupKey(lookup){
    return lookup.type === 'id'
      ? `${lookup.source}-id-${lookup.id}`
      : `${lookup.source}-title-${lookup.artist}-${lookup.titleKeyword}`;
  }

  async function resolveLearnExamples(examples){
    return Promise.all(examples.map(async ex => {
      const key = learnLookupKey(ex.lookup);
      if(!learnExampleCache.has(key)){
        learnExampleCache.set(key, await resolveLearnExample(ex.lookup));
      }
      return { ...ex, art: learnExampleCache.get(key) };
    }));
  }

  async function resolveArtistPortrait(artist){
    if(!artist.portraitQuery) return null;
    if(!learnPortraitCache.has(artist.id)){
      learnPortraitCache.set(artist.id, await fetchWikipediaPortrait(artist.portraitQuery));
    }
    return learnPortraitCache.get(artist.id);
  }

  // Fires the moment the app loads, same idea as warmPoolInBackground()
  // for gameplay — every artwork and portrait the Learn tab could show
  // starts fetching immediately instead of waiting until someone opens
  // that specific page, so by the time they get there it's either
  // already loaded or close to it.
  function warmLearnContent(){
    const allEntries = [
      ...Object.values(LEARN_CONTENT.movements),
      ...Object.values(LEARN_CONTENT.artists),
      ...Object.values(LEARN_CONTENT.subjects)
    ];
    allEntries.forEach(entry => resolveLearnExamples(entry.examples));
    Object.values(LEARN_CONTENT.artists).forEach(resolveArtistPortrait);
  }

  function examplesColHTML(resolved){
    const usable = resolved.filter(r => r.art);
    if(!usable.length) return '<p class="stage-body">No referenced artworks loaded yet.</p>';
    return usable.map((r, i) => `
      <a class="example-card" data-example-index="${i}" href="${r.art.sourceUrl}" target="_blank" rel="noopener noreferrer">
        <img src="${r.art.img}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="example-cap">
          <span class="example-title">${r.art.title || r.refLabel}</span>
          <span class="example-meta">${r.art.artist}${r.art.date ? ', ' + r.art.date : ''}</span>
        </span>
      </a>`).join('');
  }

  function wireLearnRefs(root){
    root.querySelectorAll('.learn-ref[data-ref-kind]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const kind = el.dataset.refKind;
        const id = el.dataset.refId;
        if(kind === 'artist') renderLearnArtistDetail(id);
        else if(kind === 'movement') renderLearnMovementDetail(id);
        else if(kind === 'subject') renderLearnSubjectDetail(id);
      });
    });
    root.querySelectorAll('.learn-ref-art[data-ref-example]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = el.dataset.refExample;
        const card = root.querySelector(`.example-card[data-example-index="${idx}"]`);
        if(!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('flash');
        setTimeout(() => card.classList.remove('flash'), 900);
      });
    });
  }

  // ---------------- SCREEN: LEARN HUB ----------------
  function renderLearn(){
    state.screen = 'learn';
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">learn</h2>
        <div class="mode-list" id="learnList"></div>
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    const learnList = document.getElementById('learnList');
    const sections = [
      { name: 'Movements', action: renderLearnMovements },
      { name: 'Artists', action: renderLearnArtists },
      { name: 'Subjects', action: renderLearnSubjects },
      { name: 'Mediums', action: renderLearnMediums }
    ];
    sections.forEach(s => {
      const b = document.createElement('button');
      b.className = 'mode-item';
      b.innerHTML = `<span class="mode-main"><span class="mode-name">${s.name}</span></span>`;
      b.addEventListener('click', s.action);
      learnList.appendChild(b);
    });
    document.getElementById('backBtn').addEventListener('click', renderLanding);
  }

  // ---------------- SHARED: BROWSABLE LIST SCREEN ----------------
  function renderLearnList(screenName, title, entries, onOpen){
    state.screen = screenName;
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">${title}</h2>
        <div class="mode-list" id="learnEntryList"></div>
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    const list = document.getElementById('learnEntryList');
    if(!entries.length){
      list.innerHTML = `<p class="stage-body">Content coming soon.</p>`;
    }
    entries.forEach(entry => {
      const b = document.createElement('button');
      b.className = 'mode-item';
      b.innerHTML = `
        <span class="mode-main">
          <span class="mode-name">${entry.title}</span>
          <span class="mode-desc">${entry.teaser}</span>
        </span>`;
      b.addEventListener('click', () => onOpen(entry.id));
      list.appendChild(b);
    });
    document.getElementById('backBtn').addEventListener('click', renderLearn);
  }

  function renderLearnMovements(){
    renderLearnList('learn-movements', 'movements', Object.values(LEARN_CONTENT.movements), renderLearnMovementDetail);
  }
  function renderLearnArtists(){
    renderLearnList('learn-artists', 'artists', Object.values(LEARN_CONTENT.artists), renderLearnArtistDetail);
  }
  function renderLearnSubjects(){
    renderLearnList('learn-subjects', 'subjects', Object.values(LEARN_CONTENT.subjects), renderLearnSubjectDetail);
  }
  function renderLearnMediums(){
    renderLearnList('learn-mediums', 'mediums', Object.values(LEARN_CONTENT.mediums), () => {});
  }

  /* ============================================================
     RELATED ENTRIES — experimental cross-referencing feature.
     Self-contained on purpose: to remove this entirely later, delete
     this whole block, the one call to relatedEntriesSectionHTML() /
     wireRelatedEntries() inside renderLearnDetail() below, and the
     matching CSS block in style.css (also marked for easy removal).
     Nothing else in the Learn tab depends on this.

     Reads an entry's optional `related` array (added in
     js/learn-content.js) — a flat list of { kind, id } pairs — and
     renders them as clickable chips at the bottom of the page.
     Relationships are manually authored on both sides in the content
     data, not auto-inferred.
     ============================================================ */
  function relatedEntryCollection(kind){
    if(kind === 'artist') return LEARN_CONTENT.artists;
    if(kind === 'movement') return LEARN_CONTENT.movements;
    if(kind === 'subject') return LEARN_CONTENT.subjects;
    return LEARN_CONTENT.mediums;
  }

  function relatedEntryOpen(kind, id){
    if(kind === 'artist') renderLearnArtistDetail(id);
    else if(kind === 'movement') renderLearnMovementDetail(id);
    else if(kind === 'subject') renderLearnSubjectDetail(id);
  }

  function relatedEntriesSectionHTML(entry){
    const items = entry.related || [];
    const chips = items
      .map(r => ({ ref: r, target: relatedEntryCollection(r.kind)[r.id] }))
      .filter(x => x.target);
    if(!chips.length) return '';
    return `
      <div class="related-entries-section">
        <div class="related-entries-label">related</div>
        <div class="related-entries-chips">
          ${chips.map(x => `
            <button type="button" class="related-entry-chip" data-related-kind="${x.ref.kind}" data-related-id="${x.ref.id}">
              <span class="related-entry-type">${x.ref.kind}</span>
              <span class="related-entry-title">${x.target.title}</span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function wireRelatedEntries(root){
    root.querySelectorAll('.related-entry-chip').forEach(el => {
      el.addEventListener('click', () => relatedEntryOpen(el.dataset.relatedKind, el.dataset.relatedId));
    });
  }
  /* ===== /RELATED ENTRIES ===== */

  // ---------------- SHARED: DETAIL SCREEN ----------------
  // Write-up on the left, its referenced artworks larger on the right.
  // Artists also get a portrait next to their name.
  async function renderLearnDetail(screenName, entry, backAction){
    state.screen = screenName;
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <div class="learn-heading">
          <span class="learn-portrait-lg" id="learnPortraitLg"></span>
          <div>
            <h2 class="stage-title learn-detail-title">${entry.title.toLowerCase()}</h2>
            ${entry.years ? `<p class="learn-meta">${entry.years}</p>` : ''}
          </div>
        </div>
        <div class="learn-detail-grid">
          <div class="writeup" id="learnWriteup">${entry.writeupHtml}</div>
          <div class="examples-col" id="examplesCol"><p class="stage-body">loading referenced artworks\u2026</p></div>
        </div>
        <!-- ===== RELATED ENTRIES (experimental, see block above) ===== -->
        ${relatedEntriesSectionHTML(entry)}
        <!-- ===== /RELATED ENTRIES ===== -->
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    document.getElementById('backBtn').addEventListener('click', backAction);
    wireLearnRefs(document.getElementById('learnWriteup'));
    wireRelatedEntries(screenEl); /* ===== RELATED ENTRIES (experimental) ===== */

    if(entry.kind === 'artist'){
      resolveArtistPortrait(entry).then(url => {
        const slot = document.getElementById('learnPortraitLg');
        if(slot && url) slot.innerHTML = `<img src="${url}" alt="" referrerpolicy="no-referrer">`;
      });
    } else {
      const slot = document.getElementById('learnPortraitLg');
      if(slot) slot.remove();
    }

    const resolved = await resolveLearnExamples(entry.examples);
    const col = document.getElementById('examplesCol');
    if(col) col.innerHTML = examplesColHTML(resolved);
  }

  function renderLearnMovementDetail(id){
    renderLearnDetail('learn-movement-detail', LEARN_CONTENT.movements[id], renderLearnMovements);
  }
  function renderLearnArtistDetail(id){
    renderLearnDetail('learn-artist-detail', LEARN_CONTENT.artists[id], renderLearnArtists);
  }
  function renderLearnSubjectDetail(id){
    renderLearnDetail('learn-subject-detail', LEARN_CONTENT.subjects[id], renderLearnSubjects);
  }
