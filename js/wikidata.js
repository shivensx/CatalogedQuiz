  /* ============================================================
     WIKIDATA MOVEMENT VERIFICATION
     query.wikidata.org/sparql is public, unauthenticated, and
     CORS-enabled, so this runs live, per-painting, in tandem with the
     museum fetch itself — not a separate later pass.

     Three lookup paths, in order of precision, all converging on a
     single QID once resolved:
     - Direct Wikidata ID (Met's artistWikidata_URL) — exact, no
       lookup needed.
     - ULAN ID (AIC) — one extra query resolves ULAN -> QID, then
       proceeds exactly as the direct-ID path.
     - Name search (Cleveland always; AIC/Met when their faster path
       comes up empty) — disambiguated with a birth-year hint when
       available.

     For whichever QID gets resolved, one query pulls both P135
     (movement) and, as a fallback signal when P135 is entirely
     absent, the entity's own short Wikidata description — which
     often names a movement in plain text ("French Impressionist
     painter") even when the formal P135 statement was never filled
     in. See classifyMovementConfidence() in js/config.js for how
     these combine into a confidence tier. Nothing is ever excluded
     here — this module only resolves raw signal, the confidence
     classification and any push-to-back deck ordering happen
     downstream.
     ============================================================ */

  const WIKIDATA_CACHE = new Map(); // cache key -> { rawMovements, description }
  const WIKIDATA_QID_CACHE = new Map(); // ulan id -> qid | null

  function wikidataCacheKey(kind, value){
    return `${kind}:${value}`;
  }

  async function sparqlQuery(query){
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    try{
      const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
      if(!res.ok) return [];
      const data = await res.json();
      return (data.results && data.results.bindings) || [];
    } catch(e){ return []; }
  }

  // Intersects whatever movement labels Wikidata returned against our
  // own 17-movement list — anything outside that list just isn't
  // something this game classifies by, not an error.
  function matchMovementLabels(bindings){
    const labels = bindings.map(b => b.movementLabel && b.movementLabel.value).filter(Boolean);
    const matched = [];
    labels.forEach(label => {
      const hit = TERMS.find(t => t.toLowerCase() === label.toLowerCase());
      if(hit && !matched.includes(hit)) matched.push(hit);
    });
    return matched;
  }

  async function resolveQidFromUlan(ulanId){
    const key = wikidataCacheKey('ulan-qid', ulanId);
    if(WIKIDATA_QID_CACHE.has(key)) return WIKIDATA_QID_CACHE.get(key);
    const query = `SELECT ?artist WHERE { ?artist wdt:P245 "${ulanId}". } LIMIT 1`;
    const bindings = await sparqlQuery(query);
    const qid = (bindings[0] && bindings[0].artist && bindings[0].artist.value.split('/').pop()) || null;
    WIKIDATA_QID_CACHE.set(key, qid);
    return qid;
  }

  // One query, two OPTIONAL patterns: P135 (movement) and the entity's
  // own short description. Both optional so an artist with no P135 at
  // all still comes back with their description intact, rather than
  // an empty result set.
  async function fetchMovementAndDescriptionForQid(qid){
    const key = wikidataCacheKey('qid-full', qid);
    if(WIKIDATA_CACHE.has(key)) return WIKIDATA_CACHE.get(key);
    const query = `SELECT ?movementLabel ?description WHERE {
      OPTIONAL {
        wd:${qid} wdt:P135 ?movement.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      OPTIONAL { wd:${qid} schema:description ?description. FILTER(LANG(?description) = "en") }
    }`;
    const bindings = await sparqlQuery(query);
    const rawMovements = matchMovementLabels(bindings);
    const descRow = bindings.find(b => b.description);
    const description = descRow ? descRow.description.value : null;
    const result = { rawMovements, description };
    WIKIDATA_CACHE.set(key, result);
    return result;
  }

  async function searchWikidataEntity(name){
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}`
      + `&language=en&type=item&format=json&origin=*&limit=5`;
    try{
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      return data.search || [];
    } catch(e){ return []; }
  }

  function pickBestWikidataCandidate(candidates, birthYear){
    const artistLike = candidates.filter(c => c.description && /paint|artist|sculpt|draughts/i.test(c.description));
    const pool = artistLike.length ? artistLike : candidates;
    if(birthYear){
      const yearMatch = pool.find(c => c.description && c.description.includes(String(birthYear)));
      if(yearMatch) return yearMatch;
    }
    return pool[0] || null;
  }

  async function resolveByName(name, birthYear){
    const key = wikidataCacheKey('name', `${name}|${birthYear || ''}`);
    if(WIKIDATA_CACHE.has(key)) return WIKIDATA_CACHE.get(key);

    let result = { rawMovements: [], description: null };
    const candidates = await searchWikidataEntity(name);
    const best = pickBestWikidataCandidate(candidates, birthYear);
    if(best && best.id){
      const query = `SELECT ?movementLabel WHERE {
        wd:${best.id} wdt:P135 ?movement.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`;
      const bindings = await sparqlQuery(query);
      // The short description from the search step itself is already
      // free — no extra query needed for the text-fallback signal here.
      result = { rawMovements: matchMovementLabels(bindings), description: best.description || null };
    }
    WIKIDATA_CACHE.set(key, result);
    return result;
  }

  // Best-effort extraction of a birth year from whatever free-text
  // artist bio/display string a source provides (e.g. "French,
  // 1840-1926") — a disambiguation hint only, not required for a match.
  function extractBirthYearHint(displayText){
    if(!displayText) return null;
    const m = String(displayText).match(/(1[4-9]\d{2}|20\d{2})/);
    return m ? m[1] : null;
  }

  // Pulls the Q-ID out of a Wikidata URL like
  // "https://www.wikidata.org/wiki/Q5582" -> "Q5582".
  function extractWikidataQid(url){
    if(!url) return null;
    const m = String(url).match(/Q\d+/);
    return m ? m[0] : null;
  }

  // Main entry point. `artist` = { name, birthYearHint, ulanId, wikidataId }.
  // Returns { rawMovements: string[], description: string|null } —
  // js/config.js's classifyMovementConfidence() turns that into a
  // confidence tier and final era/eras, it isn't decided here.
  async function resolveArtistMovementInfo(artist){
    let qid = artist.wikidataId || null;
    if(!qid && artist.ulanId) qid = await resolveQidFromUlan(artist.ulanId);

    if(qid){
      const info = await fetchMovementAndDescriptionForQid(qid);
      if(info.rawMovements.length || info.description) return info;
      // Resolved a QID but got nothing at all from it — fall through
      // to name search rather than give up.
    }
    if(!artist.name) return { rawMovements: [], description: null };
    return resolveByName(artist.name, artist.birthYearHint);
  }

  // Wikidata descriptions almost always use the adjective form
  // ("French Impressionist painter"), not the movement's own noun form
  // ("Impressionism") — checking only the noun form would miss the
  // large majority of real matches.
  const MOVEMENT_ADJECTIVE_FORMS = {
    'Renaissance': ['Renaissance'],
    'Baroque': ['Baroque'],
    'Rococo': ['Rococo'],
    'Neoclassicism': ['Neoclassical', 'Neo-Classical'],
    'Romanticism': ['Romantic'],
    'Realism': ['Realist'],
    'Impressionism': ['Impressionist'],
    'Post-Impressionism': ['Post-Impressionist'],
    'Fauvism': ['Fauvist', 'Fauve'],
    'Expressionism': ['Expressionist'],
    'Art Nouveau': ['Art Nouveau'],
    'Cubism': ['Cubist'],
    'Art Deco': ['Art Deco'],
    'Surrealism': ['Surrealist'],
    'Futurism': ['Futurist'],
    'Pop Art': ['Pop Art'],
    'Abstract Expressionism': ['Abstract Expressionist']
  };

  // Scans a short description string for any of our 17 movement names
  // (or their adjective form) appearing directly in the text — the
  // fallback signal when an artist has no formal P135 statement at
  // all. Checks longer/more specific names first (e.g.
  // "Post-Impressionist" before "Impressionist") to avoid a substring
  // false-positive.
  function movementMentionedInText(text){
    if(!text) return null;
    const lower = text.toLowerCase();
    const sorted = [...TERMS].sort((a, b) => b.length - a.length);
    for(const term of sorted){
      const variants = [term, ...(MOVEMENT_ADJECTIVE_FORMS[term] || [])];
      if(variants.some(v => lower.includes(v.toLowerCase()))) return term;
    }
    return null;
  }

  // Runs an async function over a list with a concurrency cap, instead
  // of firing every request at once — Wikidata is robust and free, but
  // a page that fires dozens of simultaneous lookups on load is a bad
  // neighbor regardless, and there's no reason to risk it.
  async function mapWithConcurrency(items, limit, asyncFn){
    const results = new Array(items.length);
    let cursor = 0;
    async function worker(){
      while(cursor < items.length){
        const i = cursor++;
        results[i] = await asyncFn(items[i], i);
      }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
  }

