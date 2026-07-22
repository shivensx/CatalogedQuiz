  /* ============================================================
     WIKIDATA MOVEMENT VERIFICATION
     query.wikidata.org/sparql is public, unauthenticated, and
     CORS-enabled (verified against multiple independent sources), so
     this runs live, per-painting, in the browser, in tandem with the
     museum fetch itself — not a separate later pass.

     Three lookup paths, tried in order of precision:
     - By exact Wikidata ID (P135 direct) — used when a source exposes
       one directly (Met's artistWikidata_URL).
     - By ULAN ID (P245) — used for AIC, which exposes a Getty ULAN id
       on artist records. One extra lookup to resolve the ULAN id
       itself, then an exact match, no name-guessing involved.
     - By name, disambiguated with a birth-year hint when available —
       the fallback for everything else (Cleveland always; AIC/Met
       when their more precise path comes up empty).

     A painting Wikidata can't confidently place into one of our 17
     movements is NOT excluded — see classifyMovementConfidence() in
     js/config.js. It still gets included, just flagged uncertain so
     the deck system deals it after the confident matches instead of
     first.
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

  async function fetchMovementsByWikidataId(qid){
    const key = wikidataCacheKey('qid', qid);
    if(WIKIDATA_MOVEMENT_CACHE.has(key)) return WIKIDATA_MOVEMENT_CACHE.get(key);
    const query = `SELECT ?movementLabel WHERE {
      wd:${qid} wdt:P135 ?movement.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
    const bindings = await sparqlQuery(query);
    const result = matchMovementLabels(bindings);
    WIKIDATA_MOVEMENT_CACHE.set(key, result);
    return result;
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
  // Returns a raw string[] of matched movements (possibly empty) —
  // js/config.js's classifyMovementConfidence() turns that into a
  // confidence level and final era/eras, it isn't decided here.
  async function resolveArtistMovements(artist){
    if(artist.wikidataId){
      const viaQid = await fetchMovementsByWikidataId(artist.wikidataId);
      if(viaQid.length) return viaQid;
    }
    if(artist.ulanId){
      const viaUlan = await fetchMovementsByUlan(artist.ulanId);
      if(viaUlan.length) return viaUlan;
    }
    if(!artist.name) return [];
    return fetchMovementsByName(artist.name, artist.birthYearHint);
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

