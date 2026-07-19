  // ---------------- FETCH: AIC ----------------
  async function fetchAIC(term){
    const fields = 'id,title,artist_title,style_title,date_display,image_id,place_of_origin,medium_display';
    const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(term)}`
      + `&query[term][is_public_domain]=true&fields=${fields}&limit=25`;
    try{
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      const needle = term.toLowerCase();
      return (data.data || [])
        .filter(a => a.image_id && a.artist_title && a.style_title)
        .filter(a => a.style_title.toLowerCase().includes(needle))
        .filter(a => !isSculptureOrCeramic(a.medium_display))
        .map(a => ({
          key: `aic-${a.id}`,
          title: a.title || '',
          artist: a.artist_title,
          era: a.style_title,
          date: a.date_display || '',
          medium: a.medium_display || '',
          img: `https://www.artic.edu/iiif/2/${a.image_id}/full/700,/0/default.jpg`,
          source: 'Art Institute of Chicago',
          sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
          sourceSearchUrl: `https://www.artic.edu/collection?q=${encodeURIComponent(a.artist_title)}`
        }));
    } catch(e){ return []; }
  }

  // ---------------- FETCH: CLEVELAND ----------------
  async function fetchCleveland(term){
    const url = `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(term)}&has_image=1&limit=25`;
    try{
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      return (data.data || [])
        .map(a => {
          const creator = a.creators && a.creators[0] ? a.creators[0].description : null;
          const artist = creator ? creator.split(' (')[0].trim() : null;
          const img = (a.images && (a.images.web || a.images.print)) ? (a.images.web ? a.images.web.url : a.images.print.url) : null;
          return { a, artist, img };
        })
        .filter(x => x.img && x.artist && plausibleForMovement(term, x.a.creation_date))
        .filter(x => !isSculptureOrCeramic(x.a.type, x.a.technique))
        .map(x => ({
          key: `cma-${x.a.id}`,
          title: x.a.title || '',
          artist: x.artist,
          // Cleveland has no movement field (culture/type are things like
          // "American, 19th century" or "Painting") — the movement this
          // was searched under is the only reliable label to show.
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

  // ---------------- FETCH: MET (background only, slower) ----------------
  async function fetchMet(term){
    try{
      const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(term)}`;
      const res = await fetch(searchUrl);
      if(!res.ok) return [];
      const data = await res.json();
      const ids = (data.objectIDs || []).slice(0, 12);
      if(!ids.length) return [];
      const details = await Promise.all(ids.map(id =>
        fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ));
      return details
        .filter(Boolean)
        .map(o => ({ o, img: o.primaryImageSmall || o.primaryImage || null }))
        .filter(x => !isSculptureOrCeramic(x.o.classification, x.o.medium))
        .filter(x => x.o.isPublicDomain && x.img && x.o.artistDisplayName && plausibleForMovement(term, x.o.objectDate))
        .map(x => ({
          key: `met-${x.o.objectID}`,
          title: x.o.title || '',
          artist: x.o.artistDisplayName,
          // Met's period/culture/classification aren't movement tags
          // (they're things like "Ming dynasty" or "Paintings") — use
          // the movement this was searched under instead.
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

  // ---------------- FETCH: SMK (National Gallery of Denmark) ----------------
  // Free, no API key required. Unlike AIC, SMK doesn't reliably expose an
  // explicit art-movement field, so this is defensive by design: if the
  // shape of a response ever doesn't match what's expected here, individual
  // items are just filtered out rather than throwing — same fail-safe
  // pattern as the other sources.
  async function fetchSMK(term){
    try{
      // Repeated `filters` params, not one comma-joined value — this is
      // the format SMK's API actually expects; the joined version was
      // likely silently ignored, forcing an unfiltered (slower) search.
      const url = `https://api.smk.dk/api/v1/art/search/?keys=${encodeURIComponent(term)}`
        + `&filters=${encodeURIComponent('[has_image:true]')}`
        + `&filters=${encodeURIComponent('[public_domain:true]')}`
        + `&rows=25`;
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      return (data.items || [])
        .map(o => {
          const titles = o.titles || [];
          const titleEn = titles.find(t => t.language === 'en');
          const title = (titleEn && titleEn.title) || (titles[0] && titles[0].title) || '';
          const prod = o.production && o.production[0];
          const artist = (Array.isArray(o.artist) && o.artist[0]) || (prod && prod.creator) || null;
          const dateRaw = (o.production_date && o.production_date[0] && (o.production_date[0].period || o.production_date[0].start)) || '';
          const date = typeof dateRaw === 'string' ? dateRaw.slice(0, 4) : '';
          const medium = (Array.isArray(o.techniques) && o.techniques.join(', ')) || '';
          const objectNames = (Array.isArray(o.object_names) ? o.object_names.map(n => n.name).join(' ') : '');
          const img = o.image_native || o.image_thumbnail
            || (o.image_iiif_id ? `${o.image_iiif_id}/full/400,/0/default.jpg` : null);
          return { o, title, artist, date, medium, objectNames, img };
        })
        .filter(x => x.img && x.artist && plausibleForMovement(term, x.date))
        .filter(x => !isSculptureOrCeramic(x.medium, x.objectNames) && !/skulptur|keramik/i.test(x.objectNames || ''))
        .map(x => ({
          key: `smk-${x.o.id}`,
          title: x.title,
          artist: x.artist,
          // SMK has no movement field — use the movement this was
          // searched under, same fix as Cleveland and Met.
          era: term,
          date: x.date,
          medium: x.medium,
          img: x.img,
          source: 'SMK — National Gallery of Denmark',
          sourceUrl: x.o.object_url || `https://open.smk.dk/en/artwork/image/${x.o.id}`,
          sourceSearchUrl: `https://open.smk.dk/en/search?q=${encodeURIComponent(x.artist)}`
        }));
    } catch(e){ return []; }
  }

  // ---------------- FETCH: EUROPEANA ----------------
  // Aggregates thousands of providers with wildly inconsistent metadata —
  // there's no standard "movement" field the way AIC has style_title, so
  // this checks the free-text subject tags for a match. Same fail-safe
  // pattern as SMK: if the shape is ever off, items are filtered out
  // rather than throwing.
  const EUROPEANA_KEY = 'rogantant';
  async function fetchEuropeana(term){
    try{
      // qf=LANGUAGE:en restricts to English-tagged records — Europeana
      // aggregates thousands of European providers (Dutch institutions
      // are especially well represented), and without this filter a lot
      // of titles/descriptions come back in the source language instead.
      const url = `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_KEY}`
        + `&query=${encodeURIComponent(term)}&media=true&rows=25&qf=TYPE:IMAGE&qf=LANGUAGE:en&reusability=open`;
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      return (data.items || [])
        .map(o => {
          const title = (Array.isArray(o.title) && o.title[0]) || '';
          // dcCreator entries are sometimes a link to an authority record
          // (e.g. a Wikidata/VIAF URI) rather than a plain name — take
          // the first entry that isn't a URL, so we never show a raw
          // link where an artist name should be.
          const creators = Array.isArray(o.dcCreator) ? o.dcCreator : (o.dcCreator ? [o.dcCreator] : []);
          const artist = creators.find(c => typeof c === 'string' && !/^https?:\/\//i.test(c.trim())) || null;
          const date = (Array.isArray(o.year) && o.year[0]) || '';
          const img = (Array.isArray(o.edmPreview) && o.edmPreview[0]) || null;
          const provider = (Array.isArray(o.dataProvider) && o.dataProvider[0]) || 'Europeana';
          const typeText = [
            ...(Array.isArray(o.dcType) ? o.dcType : []),
            ...(Array.isArray(o.dcFormat) ? o.dcFormat : []),
            ...(Array.isArray(o.dcSubject) ? o.dcSubject : [])
          ].filter(s => typeof s === 'string').join(' ');
          return { o, title, artist, date, img, provider, typeText };
        })
        .filter(x => x.img && x.artist && plausibleForMovement(term, x.date))
        .filter(x => !isSculptureOrCeramic(x.typeText, x.title))
        .map(x => ({
          key: `eu-${x.o.id}`,
          title: x.title,
          artist: x.artist,
          // Europeana's subject tags are free-text, multilingual, and
          // rarely name a movement — use the movement this was searched
          // under instead, same fix as the other sources.
          era: term,
          date: x.date,
          medium: '',
          img: x.img,
          source: `Europeana (${x.provider})`,
          sourceUrl: x.o.guid || `https://www.europeana.eu/en/item${x.o.id}`,
          sourceSearchUrl: `https://www.europeana.eu/en/search?query=${encodeURIComponent(x.artist)}`
        }));
    } catch(e){ return []; }
  }

  // ---------------- FETCH: SMITHSONIAN ----------------
  // Same caveat as Europeana/SMK — the Smithsonian's Open Access API spans
  // many different collecting units with inconsistent metadata, so this
  // is defensive: several candidate fields are tried, and anything that
  // doesn't resolve just gets filtered out instead of erroring.
  const SMITHSONIAN_KEY = 'l0lIHKf1I2H8GxOtHISB0GxUb75SukQL62hCZA78';
  async function fetchSmithsonian(term){
    try{
      const url = `https://api.si.edu/openaccess/api/v1.0/search?q=${encodeURIComponent(term)}&rows=25&api_key=${SMITHSONIAN_KEY}`;
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      const rows = (data.response && data.response.rows) || [];
      return rows
        .map(r => {
          const desc = (r.content && r.content.descriptiveNonRepeating) || {};
          const title = (desc.title && desc.title.content) || '';
          const media = (desc.online_media && desc.online_media.media) || [];
          const imgObj = media.find(m => m.type === 'Images');
          const img = imgObj ? (imgObj.content || (imgObj.resources && imgObj.resources[0] && imgObj.resources[0].url)) : null;
          const freetext = (r.content && r.content.freetext) || {};
          const names = freetext.name || [];
          const artistEntry = names.find(n => /artist|creator|painter/i.test(n.label || '')) || names[0];
          const artist = (artistEntry && artistEntry.content) || null;
          const dateEntry = (freetext.date && freetext.date[0] && freetext.date[0].content) || '';
          const physDesc = freetext.physicalDescription || [];
          const medium = (physDesc[0] && physDesc[0].content) || '';
          const objectTypes = (freetext.objectType || []).map(t => t.content).join(' ');
          return { r, title, artist, date: dateEntry, medium, objectTypes, img };
        })
        .filter(x => x.img && x.artist && plausibleForMovement(term, x.date))
        .filter(x => !isSculptureOrCeramic(x.medium, x.objectTypes))
        .map(x => ({
          key: `si-${x.r.id}`,
          title: x.title,
          artist: x.artist,
          // Smithsonian's culture/category tags rarely name a Western art
          // movement — use the movement this was searched under instead.
          era: term,
          date: x.date,
          medium: x.medium,
          img: x.img,
          source: 'Smithsonian',
          sourceUrl: (x.r.content && x.r.content.descriptiveNonRepeating && x.r.content.descriptiveNonRepeating.record_link) || `https://www.si.edu/object/${x.r.id}`,
          sourceSearchUrl: `https://www.si.edu/search?edan_q=${encodeURIComponent(x.artist)}`
        }));
    } catch(e){ return []; }
  }

