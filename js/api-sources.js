  /* ============================================================
     GAME POOL — MUSEUM FETCHERS
     Each fetcher's job: get real paintings from that source
     (paginated continuously, no movement/topic querying — see
     js/pool.js's startContinuousFetching), then resolve each one's
     real movement against Wikidata AS it's being pulled, not as a
     separate later pass. See js/wikidata.js for the lookup paths and
     js/config.js's classifyMovementConfidence() for how a piece ends
     up confident / uncertain / unmatched.

     Painting filtering is still the exact-match check against each
     source's own real object-type field (independently verified):
       - AIC:        artwork_type_title === 'Painting'
       - Met:         classification === 'Paintings'
       - Cleveland:   type === 'Painting'
     plus the medium/technique text safety net
     (isLikelyNonPaintingMedium, see js/config.js).

     Nothing gets excluded for lacking a confident movement match —
     era/eras are always set to SOMETHING when Wikidata has any P135
     data at all (even an uncertain one), and left empty only when
     there's genuinely no movement data on that artist. The deck
     system (js/decks.js) is what actually deals confident matches
     before uncertain ones — this layer just resolves and tags.
     ============================================================ */

  // ---------------- FETCH: ART INSTITUTE OF CHICAGO ----------------
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
    } catch(e){ /* falls back to name-based lookup */ }
    aicUlanCache.set(artistId, ulan);
    return ulan;
  }

  let aicPage = 1;
  async function fetchAICBatch(){
    const fields = 'id,title,artist_title,artist_id,artist_display,date_display,image_id,place_of_origin,medium_display,artwork_type_title';
    const url = `https://api.artic.edu/api/v1/artworks?fields=${fields}&limit=100&page=${aicPage}`;
    aicPage++;
    try{
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      const rawCandidates = (data.data || [])
        .filter(a => a.image_id && a.artist_title)
        .filter(a => a.artwork_type_title === 'Painting')
        .filter(a => !isLikelyNonPaintingMedium(a.medium_display));

      return mapWithConcurrency(rawCandidates, 6, async (a) => {
        const ulanId = await fetchAICArtistUlan(a.artist_id);
        const birthYearHint = extractBirthYearHint(a.artist_display);
        const info = await resolveArtistMovementInfo({ name: a.artist_title, birthYearHint, ulanId });
        const { tier, score, eras } = classifyMovementConfidence(info.rawMovements, a.date_display, info.description);
        return {
          key: `aic-${a.id}`,
          title: a.title || 'Untitled',
          artist: a.artist_title,
          era: eras[0] || null,
          eras,
          confidenceTier: tier,
          confidenceScore: score,
          date: a.date_display || '',
          medium: a.medium_display || '',
          origin: a.place_of_origin || '',
          img: `https://www.artic.edu/iiif/2/${a.image_id}/full/700,/0/default.jpg`,
          source: 'Art Institute of Chicago',
          sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
          sourceSearchUrl: `https://www.artic.edu/collection?q=${encodeURIComponent(a.artist_title)}`
        };
      });
    } catch(e){ return []; }
  }

  // ---------------- FETCH: CLEVELAND MUSEUM OF ART ----------------
  let clevelandSkip = 0;
  async function fetchClevelandBatch(){
    const url = `https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&limit=100&skip=${clevelandSkip}`;
    clevelandSkip += 100;
    try{
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      const rawCandidates = (data.data || [])
        .map(a => {
          const creatorDesc = a.creators && a.creators[0] ? a.creators[0].description : null;
          const artist = creatorDesc ? creatorDesc.split(' (')[0].trim() : null;
          const img = (a.images && (a.images.web || a.images.print)) ? (a.images.web ? a.images.web.url : a.images.print.url) : null;
          return { a, artist, img, creatorDesc };
        })
        .filter(x => x.img && x.artist)
        .filter(x => x.a.type === 'Painting')
        .filter(x => !isLikelyNonPaintingMedium(x.a.technique));

      return mapWithConcurrency(rawCandidates, 6, async (x) => {
        const birthYearHint = extractBirthYearHint(x.creatorDesc);
        const info = await resolveArtistMovementInfo({ name: x.artist, birthYearHint });
        const { tier, score, eras } = classifyMovementConfidence(info.rawMovements, x.a.creation_date, info.description);
        return {
          key: `cma-${x.a.id}`,
          title: x.a.title || 'Untitled',
          artist: x.artist,
          era: eras[0] || null,
          eras,
          confidenceTier: tier,
          confidenceScore: score,
          date: x.a.creation_date || '',
          medium: x.a.technique || '',
          img: x.img,
          source: 'Cleveland Museum of Art',
          sourceUrl: `https://www.clevelandart.org/art/${x.a.id}`,
          sourceSearchUrl: `https://www.clevelandart.org/art/collection/search?search_api_fulltext=${encodeURIComponent(x.artist)}`
        };
      });
    } catch(e){ return []; }
  }

  // ---------------- FETCH: THE METROPOLITAN MUSEUM OF ART ----------------
  // Met has no "list every painting" endpoint, so this steps through
  // the two departments confirmed to hold real paintings (European
  // Paintings, Modern Art), cycling between them over time.
  const MET_PAINTING_DEPARTMENTS = [11, 21];
  const metDeptIdsCache = new Map();
  const metDeptCursor = new Map();
  let metDeptRotation = 0;

  async function fetchMetDepartmentIds(deptId){
    if(metDeptIdsCache.has(deptId)) return metDeptIdsCache.get(deptId);
    try{
      const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects?departmentIds=${deptId}`);
      const ids = res.ok ? ((await res.json()).objectIDs || []) : [];
      metDeptIdsCache.set(deptId, ids);
      metDeptCursor.set(deptId, 0);
      return ids;
    } catch(e){
      metDeptIdsCache.set(deptId, []);
      metDeptCursor.set(deptId, 0);
      return [];
    }
  }

  async function fetchMetBatch(){
    try{
      const deptId = MET_PAINTING_DEPARTMENTS[metDeptRotation % MET_PAINTING_DEPARTMENTS.length];
      metDeptRotation++;
      const allIds = await fetchMetDepartmentIds(deptId);
      if(!allIds.length) return [];

      const cursor = metDeptCursor.get(deptId) || 0;
      const batch = allIds.slice(cursor, cursor + 40);
      metDeptCursor.set(deptId, cursor + 40 >= allIds.length ? 0 : cursor + 40);
      if(!batch.length) return [];

      const details = await Promise.all(batch.map(id =>
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

      return await mapWithConcurrency(rawCandidates, 10, async (x) => {
        const birthYearHint = extractBirthYearHint(x.o.artistDisplayBio);
        const wikidataId = extractWikidataQid(x.o.artistWikidata_URL);
        const info = await resolveArtistMovementInfo({ name: x.o.artistDisplayName, birthYearHint, wikidataId });
        const { tier, score, eras } = classifyMovementConfidence(info.rawMovements, x.o.objectDate, info.description);
        return {
          key: `met-${x.o.objectID}`,
          title: x.o.title || 'Untitled',
          artist: x.o.artistDisplayName,
          era: eras[0] || null,
          eras,
          confidenceTier: tier,
          confidenceScore: score,
          date: x.o.objectDate || '',
          medium: x.o.medium || '',
          img: x.img,
          source: 'The Metropolitan Museum of Art',
          sourceUrl: x.o.objectURL || `https://www.metmuseum.org/art/collection/search/${x.o.objectID}`,
          sourceSearchUrl: `https://www.metmuseum.org/art/collection/search?q=${encodeURIComponent(x.o.artistDisplayName)}`
        };
      });
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

  // Reuses the same per-object endpoint the pool fetchers use — this
  // one is a known-good, verified shape.
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
