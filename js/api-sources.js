  /* ============================================================
     GAME POOL — MUSEUM FETCHERS
     Three sources: AIC, Cleveland, Met. SMK, Europeana, and
     Smithsonian stay out of the game pool (kept only for the Learn
     tab's specific hand-picked lookups further down this file).

     Painting filtering, two layers:
     1. PRIMARY — exact match against each source's own real
        object-type field: AIC's artwork_type_title, Met's
        classification, Cleveland's type. Not a substring match, not
        a blacklist of things to exclude.
     2. SECONDARY — a medium/technique text safety net
        (isLikelyNonPaintingMedium, see js/config.js) for the records
        a museum still mislabels despite the type field.

     Movement verification is done live against Wikidata (see
     js/wikidata.js) for all three sources, including AIC — even
     though AIC has its own curator-assigned style field, Wikidata is
     now the single cross-checked standard for all three, not just a
     patch for the two sources that lack one. AIC additionally
     resolves a Getty ULAN id per artist for an exact (not name-text)
     Wikidata match; Met and Cleveland fall back to name + a
     best-effort birth-year hint pulled from whatever bio text the
     source provides. A piece Wikidata can't confidently classify
     into one of our 17 movements is excluded, not force-fit — and a
     piece can carry more than one real movement (era = the single
     display/grouping label; eras = the full verified set, used for
     scoring so a genuinely multi-movement piece isn't marked wrong
     for a fair answer). The old date-range plausibility check
     (plausibleForMovement) stays on as an additional fallback layer
     after Wikidata's verdict, not removed.

     Randomization: museum search APIs rank by relevance, so the same
     well-known pieces would otherwise surface first every time. Each
     fetcher below pulls a random page/offset/sample instead of
     always taking whatever came back first.
     ============================================================ */

  // How many pages/offset-steps deep a fetcher is willing to reach into
  // a large result set. Keeps requests reasonable while still reaching
  // well past "page 1" for movements with a lot of matching work.
  const RANDOM_PAGE_DEPTH_CAP = 20;

  // Small caches so the same artist (which often appears across multiple
  // candidate paintings, within one fetch and across a session) only
  // triggers the extra network round-trips once.
  const aicUlanCache = new Map(); // AIC artist_id -> ULAN id | null

  async function fetchAICArtistUlan(artistId){
    if(!artistId) return null;
    if(aicUlanCache.has(artistId)) return aicUlanCache.get(artistId);
    let ulan = null;
    try{
      const res = await fetch(`https://api.artic.edu/api/v1/agents/${artistId}?fields=id,ulan_id`);
      if(res.ok){
        const data = await res.json();
        ulan = (data.data && data.data.ulan_id) || null;
      }
    } catch(e){ /* ignore, falls back to name-based lookup */ }
    aicUlanCache.set(artistId, ulan);
    return ulan;
  }

  // ---------------- FETCH: ART INSTITUTE OF CHICAGO ----------------
  async function fetchAIC(term){
    const fields = 'id,title,artist_title,artist_id,artist_display,date_display,image_id,place_of_origin,medium_display,artwork_type_title';
    const baseUrl = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(term)}`
      + `&fields=${fields}&limit=25`;
    try{
      const res1 = await fetch(`${baseUrl}&page=1`);
      if(!res1.ok) return [];
      const data1 = await res1.json();
      let items = data1.data || [];

      const totalPages = (data1.pagination && data1.pagination.total_pages) || 1;
      if(totalPages > 1){
        const cap = Math.min(totalPages, RANDOM_PAGE_DEPTH_CAP);
        const randomPage = 1 + Math.floor(Math.random() * cap);
        if(randomPage !== 1){
          try{
            const res2 = await fetch(`${baseUrl}&page=${randomPage}`);
            if(res2.ok){
              const data2 = await res2.json();
              if(data2.data && data2.data.length) items = data2.data;
            }
          } catch(e){ /* fall back to page 1's results */ }
        }
      }

      // Primary painting filter: exact match on AIC's real object-type
      // field. Secondary safety net: reject anything whose medium text
      // still names a non-painting material despite the type field.
      const rawCandidates = items
        .filter(a => a.image_id && a.artist_title)
        .filter(a => a.artwork_type_title === 'Painting')
        .filter(a => !isLikelyNonPaintingMedium(a.medium_display));

      const verified = await mapWithConcurrency(rawCandidates, 4, async (a) => {
        const ulanId = await fetchAICArtistUlan(a.artist_id);
        const birthYearHint = extractBirthYearHint(a.artist_display);
        const rawMovements = await resolveArtistMovements({ name: a.artist_title, birthYearHint, ulanId });
        if(!rawMovements.length) return null; // Wikidata has no confident classification — excluded, not force-fit
        // Artist-level movements narrowed to what THIS piece's own date
        // supports — an artist whose career spanned movements shouldn't
        // have every piece labeled with every movement they ever touched.
        const movements = narrowMovementsByDate(rawMovements, a.date_display);
        if(!movements.length) return null; // none of the artist's real movements fit this piece's date — excluded, not mislabeled
        const era = movements.includes(term) ? term : movements[0];
        if(!plausibleForMovement(era, a.date_display)) return null;
        return {
          key: `aic-${a.id}`,
          title: a.title || 'Untitled',
          artist: a.artist_title,
          era,
          eras: movements,
          date: a.date_display || '',
          medium: a.medium_display || '',
          origin: a.place_of_origin || '',
          img: `https://www.artic.edu/iiif/2/${a.image_id}/full/700,/0/default.jpg`,
          source: 'Art Institute of Chicago',
          sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
          sourceSearchUrl: `https://www.artic.edu/collection?q=${encodeURIComponent(a.artist_title)}`
        };
      });
      return verified.filter(Boolean);
    } catch(e){ return []; }
  }

  // ---------------- FETCH: CLEVELAND MUSEUM OF ART ----------------
  async function fetchCleveland(term){
    const baseUrl = `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(term)}&has_image=1&limit=25`;
    try{
      const res1 = await fetch(`${baseUrl}&skip=0`);
      if(!res1.ok) return [];
      const data1 = await res1.json();
      let items = data1.data || [];

      const total = (data1.info && data1.info.total) || items.length;
      if(total > 25){
        const maxSkip = Math.min(total - 25, RANDOM_PAGE_DEPTH_CAP * 25);
        const randomSkip = Math.floor(Math.random() * (maxSkip + 1));
        if(randomSkip > 0){
          try{
            const res2 = await fetch(`${baseUrl}&skip=${randomSkip}`);
            if(res2.ok){
              const data2 = await res2.json();
              if(data2.data && data2.data.length) items = data2.data;
            }
          } catch(e){ /* fall back to the first page's results */ }
        }
      }

      const rawCandidates = items
        .map(a => {
          const creatorDesc = a.creators && a.creators[0] ? a.creators[0].description : null;
          const artist = creatorDesc ? creatorDesc.split(' (')[0].trim() : null;
          const img = (a.images && (a.images.web || a.images.print)) ? (a.images.web ? a.images.web.url : a.images.print.url) : null;
          return { a, artist, img, creatorDesc };
        })
        .filter(x => x.img && x.artist)
        .filter(x => x.a.type === 'Painting')
        .filter(x => !isLikelyNonPaintingMedium(x.a.technique));

      const verified = await mapWithConcurrency(rawCandidates, 4, async (x) => {
        const birthYearHint = extractBirthYearHint(x.creatorDesc);
        const rawMovements = await resolveArtistMovements({ name: x.artist, birthYearHint });
        if(!rawMovements.length) return null;
        const movements = narrowMovementsByDate(rawMovements, x.a.creation_date);
        if(!movements.length) return null;
        const era = movements.includes(term) ? term : movements[0];
        if(!plausibleForMovement(era, x.a.creation_date)) return null;
        return {
          key: `cma-${x.a.id}`,
          title: x.a.title || 'Untitled',
          artist: x.artist,
          era,
          eras: movements,
          date: x.a.creation_date || '',
          medium: x.a.technique || '',
          img: x.img,
          source: 'Cleveland Museum of Art',
          sourceUrl: `https://www.clevelandart.org/art/${x.a.id}`,
          sourceSearchUrl: `https://www.clevelandart.org/art/collection/search?search_api_fulltext=${encodeURIComponent(x.artist)}`
        };
      });
      return verified.filter(Boolean);
    } catch(e){ return []; }
  }

  // ---------------- FETCH: THE METROPOLITAN MUSEUM OF ART ----------------
  // Met's search endpoint returns every matching object ID in one call
  // (no pagination) rather than a page at a time, so randomization here
  // means shuffling that full ID list before sampling from it, instead
  // of always taking the IDs the API happened to list first.
  async function fetchMet(term){
    try{
      const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(term)}`;
      const res = await fetch(searchUrl);
      if(!res.ok) return [];
      const data = await res.json();
      const allIds = data.objectIDs || [];
      if(!allIds.length) return [];

      const ids = shuffle([...allIds]).slice(0, 15);
      const details = await Promise.all(ids.map(id =>
        fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ));

      const rawCandidates = details
        .filter(Boolean)
        .map(o => ({ o, img: o.primaryImageSmall || o.primaryImage || null }))
        .filter(x => x.img && x.o.artistDisplayName)
        .filter(x => x.o.classification === 'Paintings')
        .filter(x => !isLikelyNonPaintingMedium(x.o.medium));

      const verified = await mapWithConcurrency(rawCandidates, 4, async (x) => {
        const birthYearHint = extractBirthYearHint(x.o.artistDisplayBio);
        const rawMovements = await resolveArtistMovements({ name: x.o.artistDisplayName, birthYearHint });
        if(!rawMovements.length) return null;
        const movements = narrowMovementsByDate(rawMovements, x.o.objectDate);
        if(!movements.length) return null;
        const era = movements.includes(term) ? term : movements[0];
        if(!plausibleForMovement(era, x.o.objectDate)) return null;
        return {
          key: `met-${x.o.objectID}`,
          title: x.o.title || 'Untitled',
          artist: x.o.artistDisplayName,
          era,
          eras: movements,
          date: x.o.objectDate || '',
          medium: x.o.medium || '',
          img: x.img,
          source: 'The Metropolitan Museum of Art',
          sourceUrl: x.o.objectURL || `https://www.metmuseum.org/art/collection/search/${x.o.objectID}`,
          sourceSearchUrl: `https://www.metmuseum.org/art/collection/search?q=${encodeURIComponent(x.o.artistDisplayName)}`
        };
      });
      return verified.filter(Boolean);
    } catch(e){ return []; }
  }

  // ---------------- LEARN TAB: SPECIFIC ARTWORK LOOKUPS ----------------
  // The Learn tab references particular, hand-picked pieces rather than
  // pulling a random pool pick, so it needs to fetch by exact ID or by
  // artist + title keyword instead of by movement search. AIC-only for
  // now, matching where the current Learn content set was verified.
  const AIC_FIELDS = 'id,title,artist_title,style_title,date_display,image_id,place_of_origin,medium_display';

  function mapAICRecord(a){
    if(!a || !a.image_id) return null;
    return {
      key: `aic-${a.id}`,
      title: a.title || '',
      artist: a.artist_title || '',
      era: a.style_title || '',
      date: a.date_display || '',
      medium: a.medium_display || '',
      img: `https://www.artic.edu/iiif/2/${a.image_id}/full/700,/0/default.jpg`,
      source: 'Art Institute of Chicago',
      sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
      sourceSearchUrl: `https://www.artic.edu/collection?q=${encodeURIComponent(a.artist_title || '')}`
    };
  }

  async function fetchAICById(id){
    try{
      const url = `https://api.artic.edu/api/v1/artworks/${id}?fields=${AIC_FIELDS}`;
      const res = await fetch(url);
      if(!res.ok) return null;
      const data = await res.json();
      return mapAICRecord(data.data);
    } catch(e){ return null; }
  }

  async function fetchAICByTitle(artist, titleKeyword){
    try{
      const q = `${artist} ${titleKeyword}`;
      const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&fields=${AIC_FIELDS}&limit=5`;
      const res = await fetch(url);
      if(!res.ok) return null;
      const data = await res.json();
      const needle = titleKeyword.toLowerCase();
      const match = (data.data || []).find(a => a.image_id && a.title && a.title.toLowerCase().includes(needle));
      return match ? mapAICRecord(match) : null;
    } catch(e){ return null; }
  }

  // Resolves one LEARN_CONTENT `lookup` object into a normalized artwork,
  // regardless of which lookup shape it uses. Only AIC is wired up right
  // now; other sources would just need a case added here.
  async function resolveLearnExample(lookup){
    if(lookup.source === 'aic' && lookup.type === 'id') return fetchAICById(lookup.id);
    if(lookup.source === 'aic' && lookup.type === 'title') return fetchAICByTitle(lookup.artist, lookup.titleKeyword);
    if(lookup.source === 'met' && lookup.type === 'id') return fetchMetById(lookup.id);
    if(lookup.source === 'cleveland' && lookup.type === 'accession') return fetchClevelandByAccession(lookup.accession);
    if(lookup.source === 'smk' && lookup.type === 'inventory') return fetchSMKByInventory(lookup.inventory);
    return null;
  }

  // Reuses the same per-object endpoint fetchMet() already uses for pool
  // items — this one is a known-good, verified shape.
  async function fetchMetById(id){
    try{
      const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
      if(!res.ok) return null;
      const o = await res.json();
      const img = o.primaryImageSmall || o.primaryImage || null;
      if(!img || !o.artistDisplayName) return null;
      return {
        key: `met-${o.objectID}`,
        title: o.title || '',
        artist: o.artistDisplayName,
        era: o.period || o.culture || o.classification || '',
        date: o.objectDate || '',
        medium: o.medium || '',
        img,
        source: 'The Metropolitan Museum of Art',
        sourceUrl: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`,
        sourceSearchUrl: `https://www.metmuseum.org/art/collection/search?q=${encodeURIComponent(o.artistDisplayName)}`
      };
    } catch(e){ return null; }
  }

  // Cleveland's API doesn't have a confirmed direct lookup-by-accession
  // endpoint, so this searches on the accession number as text and
  // matches the result whose own accession_number field agrees exactly.
  // Best-effort: fails gracefully (returns null) rather than guessing.
  async function fetchClevelandByAccession(accession){
    try{
      const url = `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(accession)}&has_image=1&limit=10`;
      const res = await fetch(url);
      if(!res.ok) return null;
      const data = await res.json();
      const match = (data.data || []).find(a => a.accession_number === accession);
      if(!match) return null;
      const img = (match.images && (match.images.web || match.images.print)) ? (match.images.web ? match.images.web.url : match.images.print.url) : null;
      const creator = match.creators && match.creators[0] ? match.creators[0].description : null;
      const artist = creator ? creator.split(' (')[0].trim() : null;
      if(!img || !artist) return null;
      return {
        key: `cma-${match.id}`,
        title: match.title || '',
        artist,
        era: '',
        date: match.creation_date || '',
        medium: match.technique || '',
        img,
        source: 'Cleveland Museum of Art',
        sourceUrl: `https://www.clevelandart.org/art/${match.id}`,
        sourceSearchUrl: `https://www.clevelandart.org/art/collection/search?search_api_fulltext=${encodeURIComponent(artist)}`
      };
    } catch(e){ return null; }
  }

  // Same best-effort approach for SMK: search on the inventory number,
  // match the item whose own object_number agrees exactly.
  async function fetchSMKByInventory(inventory){
    try{
      const url = `https://api.smk.dk/api/v1/art/search/?keys=${encodeURIComponent(inventory)}&rows=10`;
      const res = await fetch(url);
      if(!res.ok) return null;
      const data = await res.json();
      const match = (data.items || []).find(o => o.object_number === inventory);
      if(!match) return null;
      const titles = match.titles || [];
      const titleEn = titles.find(t => t.language === 'en');
      const title = (titleEn && titleEn.title) || (titles[0] && titles[0].title) || '';
      const prod = match.production && match.production[0];
      const artist = (Array.isArray(match.artist) && match.artist[0]) || (prod && prod.creator) || null;
      const img = match.image_native || match.image_thumbnail
        || (match.image_iiif_id ? `${match.image_iiif_id}/full/400,/0/default.jpg` : null);
      if(!img || !artist) return null;
      const dateRaw = (match.production_date && match.production_date[0] && (match.production_date[0].period || match.production_date[0].start)) || '';
      return {
        key: `smk-${match.id}`,
        title,
        artist,
        era: '',
        date: typeof dateRaw === 'string' ? dateRaw.slice(0, 4) : '',
        medium: (Array.isArray(match.techniques) && match.techniques.join(', ')) || '',
        img,
        source: 'SMK — National Gallery of Denmark',
        sourceUrl: match.object_url || `https://open.smk.dk/en/artwork/image/${match.id}`,
        sourceSearchUrl: `https://open.smk.dk/en/search?q=${encodeURIComponent(artist)}`
      };
    } catch(e){ return null; }
  }

  // ---------------- LEARN TAB: ARTIST PORTRAITS ----------------
  // Wikipedia's summary endpoint is free, needs no key, and returns a
  // lead thumbnail image for most well-known people — a reasonable
  // source for "put a picture of the artist next to their name."
  async function fetchWikipediaPortrait(pageTitle){
    try{
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
      const res = await fetch(url);
      if(!res.ok) return null;
      const data = await res.json();
      return (data.thumbnail && data.thumbnail.source) || (data.originalimage && data.originalimage.source) || null;
    } catch(e){ return null; }
  }
