  /* ============================================================
     WIKIDATA MOVEMENT VERIFICATION
     Confirmed working: query.wikidata.org/sparql is public,
     unauthenticated, and CORS-enabled (verified against multiple
     independent sources), so this runs live, per-candidate, in the
     browser — not a dev-time batch script. No key, no rate-limit
     ceiling shared across all visitors, and Wikidata's own coverage
     keeps improving without us doing anything.

     Two lookup paths:
     - By ULAN ID (P245) — exact match, no ambiguity. Used for AIC,
       which exposes a Getty ULAN id on artist records.
     - By name, disambiguated with birth/death year when available —
       used for Met and Cleveland, neither of which expose an external
       artist ID we can match on directly.

     Philosophy: an artist/piece Wikidata doesn't confidently classify
     into one of our 17 movements is excluded, not force-fit. A piece
     can carry more than one real movement — Wikidata's P135 is
     multi-valued by design (a real Picasso can genuinely be tagged
     both Cubism and Surrealism), so this returns every matching
     movement, not just one.
     ============================================================ */

  const WIKIDATA_MOVEMENT_CACHE = new Map(); // cache key -> string[] (matched movement names)

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

  // Intersects whatever movement labels Wikidata returned against our own
  // 17-movement list — anything outside that list is simply not something
  // this game classifies by, not an error.
  function matchMovementLabels(bindings){
    const labels = bindings.map(b => b.movementLabel && b.movementLabel.value).filter(Boolean);
    const matched = [];
    labels.forEach(label => {
      const hit = TERMS.find(t => t.toLowerCase() === label.toLowerCase());
      if(hit && !matched.includes(hit)) matched.push(hit);
    });
    return matched;
  }

  async function fetchMovementsByUlan(ulanId){
    const key = wikidataCacheKey('ulan', ulanId);
    if(WIKIDATA_MOVEMENT_CACHE.has(key)) return WIKIDATA_MOVEMENT_CACHE.get(key);
    const query = `SELECT ?movementLabel WHERE {
      ?artist wdt:P245 "${ulanId}".
      ?artist wdt:P135 ?movement.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
    const bindings = await sparqlQuery(query);
    const result = matchMovementLabels(bindings);
    WIKIDATA_MOVEMENT_CACHE.set(key, result);
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

  // Prefers a search result whose description reads like an artist, and
  // (when we have a birth year from the museum record) whose description
  // mentions that same year — cheap disambiguation for common names.
  function pickBestWikidataCandidate(candidates, birthYear){
    const artistLike = candidates.filter(c => c.description && /paint|artist|sculpt|draughts/i.test(c.description));
    const pool = artistLike.length ? artistLike : candidates;
    if(birthYear){
      const yearMatch = pool.find(c => c.description && c.description.includes(String(birthYear)));
      if(yearMatch) return yearMatch;
    }
    return pool[0] || null;
  }

  async function fetchMovementsByName(name, birthYear){
    const key = wikidataCacheKey('name', `${name}|${birthYear || ''}`);
    if(WIKIDATA_MOVEMENT_CACHE.has(key)) return WIKIDATA_MOVEMENT_CACHE.get(key);

    let result = [];
    const candidates = await searchWikidataEntity(name);
    const best = pickBestWikidataCandidate(candidates, birthYear);
    if(best && best.id){
      const query = `SELECT ?movementLabel WHERE {
        wd:${best.id} wdt:P135 ?movement.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`;
      const bindings = await sparqlQuery(query);
      result = matchMovementLabels(bindings);
    }
    WIKIDATA_MOVEMENT_CACHE.set(key, result);
    return result;
  }

  // Best-effort extraction of a birth year from whatever free-text artist
  // bio/display string a source provides (e.g. "French, 1840-1926") —
  // used only as a disambiguation hint, not required for a match.
  function extractBirthYearHint(displayText){
    if(!displayText) return null;
    const m = String(displayText).match(/(1[4-9]\d{2}|20\d{2})/);
    return m ? m[1] : null;
  }

  // Main entry point. `artist` = { name, birthYearHint, ulanId }.
  // Returns a string[] of matched movements (possibly empty — empty means
  // "exclude this candidate," not "assume the searched term is right").
  async function resolveArtistMovements(artist){
    if(artist.ulanId){
      const viaUlan = await fetchMovementsByUlan(artist.ulanId);
      if(viaUlan.length) return viaUlan;
      // ULAN lookup came up empty (no Wikidata item linked, or no P135 on
      // it) — fall through to name-based rather than give up entirely.
    }
    if(!artist.name) return [];
    return fetchMovementsByName(artist.name, artist.birthYearHint);
  }

  // Runs an async function over a list with a concurrency cap, instead of
  // firing every request at once — Wikidata is robust and free, but a
  // page that fires 50+ simultaneous lookups on load is a bad neighbor
  // regardless, and there's no reason to risk it.
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

