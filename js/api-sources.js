  /* ============================================================
     GAME POOL — MUSEUM FETCHERS
     Rebuilt from scratch. Three sources only: AIC, Cleveland, Met.
     SMK, Europeana, and Smithsonian were dropped from the game pool
     entirely, none of the three has a classification field reliable
     enough to actually confirm "this is a painting," which is a hard
     requirement now, not a nice-to-have. (SMK is still used by the
     Learn tab further down this file, for a specific hand-picked
     piece with a known inventory number, that's a different,
     narrower job than pulling random gameplay artwork.)

     Two design rules apply to all three fetchers below:

     1. PAINTINGS ONLY. Each source has a real classification/type
        field (AIC: classification_title, Met: classification,
        Cleveland: type) checked against an allow-list, not a
        blacklist of things to exclude. Sculptures, prints,
        photographs, textiles, ceramics, and everything else that
        isn't a painting gets filtered out at the source.

     2. GENUINE RANDOMNESS. Museum search APIs rank results by
        relevance, which in practice means the same well-known pieces
        surface first on every identical query. Each fetcher below
        pulls a random page/offset/sample instead of always taking
        whatever came back first, so repeat visits (and repeat
        fetches within one session) surface different work instead of
        the same handful of famous paintings every time.

     Movement labeling: only AIC has real curator-assigned movement
     tags (style_title), so AIC results are cross-checked against the
     search term for a genuine match. Cleveland and Met have no such
     field at all, for those two, "movement" means the term this was
     searched under, sanity-checked against the piece's own recorded
     date via plausibleForMovement() (see js/config.js) so a piece
     whose date makes a given movement impossible gets rejected
     instead of mislabeled.
     ============================================================ */

  // How many pages/offset-steps deep a fetcher is willing to reach into
  // a large result set. Keeps requests reasonable while still reaching
  // well past "page 1" for movements with a lot of matching work.
  const RANDOM_PAGE_DEPTH_CAP = 20;

  // ---------------- FETCH: ART INSTITUTE OF CHICAGO ----------------
  async function fetchAIC(term){
    const fields = 'id,title,artist_title,style_title,date_display,image_id,place_of_origin,medium_display,classification_title';
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

      const needle = term.toLowerCase();
      return items
        .filter(a => a.image_id && a.artist_title && a.style_title)
        .filter(a => a.style_title.toLowerCase().includes(needle))
        .filter(a => a.classification_title && a.classification_title.toLowerCase().includes('paint'))
        .map(a => ({
          key: `aic-${a.id}`,
          title: a.title || 'Untitled',
          artist: a.artist_title,
          era: a.style_title,
          date: a.date_display || '',
          medium: a.medium_display || '',
          origin: a.place_of_origin || '',
          img: `https://www.artic.edu/iiif/2/${a.image_id}/full/700,/0/default.jpg`,
          source: 'Art Institute of Chicago',
          sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
          sourceSearchUrl: `https://www.artic.edu/collection?q=${encodeURIComponent(a.artist_title)}`
        }));
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

      return items
        .map(a => {
          const creator = a.creators && a.creators[0] ? a.creators[0].description : null;
          const artist = creator ? creator.split(' (')[0].trim() : null;
          const img = (a.images && (a.images.web || a.images.print)) ? (a.images.web ? a.images.web.url : a.images.print.url) : null;
          return { a, artist, img };
        })
        .filter(x => x.img && x.artist)
        .filter(x => x.a.type && x.a.type.toLowerCase().includes('paint'))
        .filter(x => plausibleForMovement(term, x.a.creation_date))
        .map(x => ({
          key: `cma-${x.a.id}`,
          title: x.a.title || 'Untitled',
          artist: x.artist,
          era: term,
          date: x.a.creation_date || '',
          medium: x.a.technique || '',
          img: x.img,
          source: 'Cleveland Museum of Art',
          sourceUrl: `https://www.clevelandart.org/art/${x.a.id}`,
          sourceSearchUrl: `https://www.clevelandart.org/art/collection/search?search_api_fulltext=${encodeURIComponent(x.artist)}`
        }));
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

      return details
        .filter(Boolean)
        .map(o => ({ o, img: o.primaryImageSmall || o.primaryImage || null }))
        .filter(x => x.img && x.o.artistDisplayName)
        .filter(x => x.o.classification && x.o.classification.toLowerCase().includes('paint'))
        .filter(x => plausibleForMovement(term, x.o.objectDate))
        .map(x => ({
          key: `met-${x.o.objectID}`,
          title: x.o.title || 'Untitled',
          artist: x.o.artistDisplayName,
          era: term,
          date: x.o.objectDate || '',
          medium: x.o.medium || '',
          img: x.img,
          source: 'The Metropolitan Museum of Art',
          sourceUrl: x.o.objectURL || `https://www.metmuseum.org/art/collection/search/${x.o.objectID}`,
          sourceSearchUrl: `https://www.metmuseum.org/art/collection/search?q=${encodeURIComponent(x.o.artistDisplayName)}`
        }));
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
