
  const BRAND = 'cataloged.';

  /* ============================================================
     CONTENT CONFIG
     ============================================================ */
  const LANDING = {
    tagline: ''
  };

  const MODES = [
    { id:'classic', name:'Classic Quiz', desc:'name the artist and the movement', available:true },
    { id:'time', name:'Time Attack', desc:'race the clock', available:true },
    { id:'captcha', name:'CAPTCHA', desc:'prove you are human', available:true }
  ];

  const RULES = {
    classic: {
      title: 'Classic Quiz',
      items: [
        'You start with 10 hearts.',
        'A fully correct answer costs nothing.',
        'A half correct answer costs half a heart.',
        'A wrong answer costs one heart.',
        'The run ends at zero hearts, so try to beat your best.'
      ]
    },
    time: {
      title: 'Time Attack',
      items: [
        'You start with 60 seconds.',
        'Each artwork gives you 5 seconds to answer.',
        'A correct answer adds bonus time, and faster answers earn more.',
        'A wrong or missed answer costs 3 seconds.',
        'The run ends at zero seconds, so try to beat your best.'
      ]
    },
    captcha: {
      title: 'CAPTCHA',
      items: [
        'A movement is named above a grid of nine artworks.',
        'Click every tile that matches it.',
        'Right or wrong, a clicked tile is replaced with a new one.',
        'Five correct picks passes the round.',
        'Three wrong picks in a row fails it, so try to beat your best streak.'
      ]
    }
  };

  /* ============================================================
     THEME — light is the default state (no data-theme attribute).
     ============================================================ */
  /* ============================================================
     STORE — window.storage only exists inside Claude's artifact
     sandbox. This file is also meant to be downloaded and opened
     directly (or hosted elsewhere), where window.storage doesn't
     exist at all — every call to it was silently failing, which is
     why nothing (theme, best scores, the daily artwork) was ever
     actually persisting. This tries window.storage first, falls
     back to localStorage for a normal browser, and degrades to an
     in-memory value only if neither is available.
     ============================================================ */
  const Store = {
    _mem: {},
    async get(key){
      try{
        if(window.storage){
          const r = await window.storage.get(key, false);
          if(r && r.value != null) return r.value;
          return null;
        }
      } catch(e){}
      try{
        const v = localStorage.getItem(key);
        if(v != null) return v;
      } catch(e){}
      return Object.prototype.hasOwnProperty.call(this._mem, key) ? this._mem[key] : null;
    },
    async set(key, value){
      try{
        if(window.storage){ await window.storage.set(key, value, false); return; }
      } catch(e){}
      try{ localStorage.setItem(key, value); return; } catch(e){}
      this._mem[key] = value;
    }
  };

  const Theme = {
    STORAGE_KEY: 'cataloged-theme',
    current: 'light',
    async init(){
      let saved = await Store.get(this.STORAGE_KEY);
      if(!saved){
        saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      this.apply(saved);
    },
    apply(mode){
      this.current = mode;
      if(mode === 'dark'){ document.documentElement.setAttribute('data-theme', 'dark'); }
      else { document.documentElement.removeAttribute('data-theme'); }
      this.renderIcon();
    },
    async toggle(){
      const next = this.current === 'dark' ? 'light' : 'dark';
      this.apply(next);
      await Store.set(this.STORAGE_KEY, next);
    },
    renderIcon(){
      const btn = document.getElementById('themeBtn');
      if(!btn) return;
      btn.innerHTML = this.current === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';
    }
  };

  /* ============================================================
     AUTH (stub) — seam for a real login flow later. Everything
     that needs "who is playing" goes through this object.
     ============================================================ */
  const Auth = {
    ENABLED: false,
    user: null,
    isLoggedIn(){ return !!this.user; },
    getUser(){ return this.user; }
  };

  /* ============================================================
     SCORE STORE — abstracts where the best score lives. Local
     storage today; getBest/setBest are the only two functions
     that need to start talking to a backend once accounts exist.
     ============================================================ */
  const ScoreStore = {
    LOCAL_KEY: 'cataloged-best-score',
    // TODO(auth migration): on first login, read the local best via
    // getBest() before Auth.user is set, compare it to the account's
    // stored best, and keep whichever is higher. Do this once, right
    // after login succeeds, then let getBest/setBest talk to the
    // backend exclusively for that session.
    async getBest(){
      const v = await Store.get(this.LOCAL_KEY);
      return v ? (parseFloat(v) || 0) : 0;
    },
    async setBest(n){ await Store.set(this.LOCAL_KEY, String(n)); }
  };

  /* ============================================================
     TIME ATTACK SCORE STORE — same shape as ScoreStore, separate
     key, so classic and Time Attack keep independent records.
     ============================================================ */
  const TAScoreStore = {
    LOCAL_KEY: 'cataloged-best-timeattack',
    async getBest(){
      const v = await Store.get(this.LOCAL_KEY);
      return v ? (parseInt(v, 10) || 0) : 0;
    },
    async setBest(n){ await Store.set(this.LOCAL_KEY, String(n)); }
  };

  const CaptchaScoreStore = {
    LOCAL_KEY: 'cataloged-best-captcha-streak',
    async getBest(){
      const v = await Store.get(this.LOCAL_KEY);
      return v ? (parseInt(v, 10) || 0) : 0;
    },
    async setBest(n){ await Store.set(this.LOCAL_KEY, String(n)); }
  };

  /* ============================================================
     CHROME — logo is hidden on the landing page (it already is
     "home"); profile + theme stay visible always.
     ============================================================ */
  function updateChrome(){
    document.getElementById('mastheadLeft').classList.toggle('hidden', state.screen === 'landing');
    const onLanding = state.screen === 'landing';
    document.getElementById('bgGrid').classList.toggle('show', onLanding);
    document.getElementById('bgOverlay').classList.toggle('show', onLanding);
    document.getElementById('staticWall').classList.toggle('show', !onLanding);
  }

  /* ============================================================
     MOVEMENT LIST — rebuilt from scratch.
     Ukiyo-e was deliberately dropped: it's fundamentally a print
     medium, not painting, and this list is paintings-only. The old
     sculpture/ceramic exclusion blacklist (isSculptureOrCeramic) is
     gone too, superseded by strict painting-classification filtering
     built directly into each fetcher in js/api-sources.js — an
     allow-list against a real classification field beats a blacklist
     of keywords to reject.
     ============================================================ */
  const TERMS = [
    "Renaissance", "Baroque", "Rococo", "Neoclassicism", "Romanticism",
    "Realism", "Impressionism", "Post-Impressionism", "Fauvism",
    "Expressionism", "Art Nouveau", "Cubism", "Art Deco", "Surrealism",
    "Futurism", "Pop Art", "Abstract Expressionism"
  ];

  // ---------------- MOVEMENT DATE VERIFICATION ----------------
  // Cleveland and Met have no movement/style field at all, so a piece
  // only ends up labeled e.g. "Cubism" because it surfaced when THAT
  // museum's full-text search was queried for the word "Cubism" — a
  // keyword-relevance match, not a real classification. That can
  // occasionally return something wildly wrong. A rough historical
  // date range acts as a sanity check: if the piece's own recorded
  // creation date falls way outside where that movement could
  // plausibly exist, it gets rejected rather than mislabeled.
  const MOVEMENT_YEAR_RANGES = {
    'Renaissance': [1350, 1620],
    'Baroque': [1580, 1750],
    'Rococo': [1700, 1780],
    'Neoclassicism': [1740, 1840],
    'Romanticism': [1770, 1855],
    'Realism': [1830, 1885],
    'Impressionism': [1855, 1900],
    'Post-Impressionism': [1885, 1910],
    'Fauvism': [1904, 1910],
    'Expressionism': [1900, 1935],
    'Art Nouveau': [1890, 1910],
    'Cubism': [1905, 1925],
    'Art Deco': [1910, 1939],
    'Surrealism': [1915, 1955],
    'Futurism': [1909, 1944],
    'Pop Art': [1955, 1975],
    'Abstract Expressionism': [1935, 1970]
  };
  const MOVEMENT_YEAR_BUFFER = 15; // slack for imprecise dating / stylistic overlap

  function extractYear(dateStr){
    if(!dateStr) return null;
    const m = String(dateStr).match(/(\d{3,4})/);
    return m ? parseInt(m[1], 10) : null;
  }

  // Returns false only when we have an actual date AND it's clearly
  // outside the movement's window — a piece with no date at all is kept,
  // since there's nothing to contradict the label (still not proof it's
  // correct, just not disprovable from what the API gave us).
  function plausibleForMovement(term, dateStr){
    const range = MOVEMENT_YEAR_RANGES[term];
    if(!range) return true;
    const year = extractYear(dateStr);
    if(year == null) return true;
    return year >= (range[0] - MOVEMENT_YEAR_BUFFER) && year <= (range[1] + MOVEMENT_YEAR_BUFFER);
  }

  // ---------------- PAINTING FILTER: SECONDARY SAFETY NET ----------------
  // Primary painting filtering happens per-source against each museum's own
  // object-type field (AIC: artwork_type_title, Met: classification,
  // Cleveland: type) — an exact match against "Painting"/"Paintings" is
  // reliable most of the time. This is the fallback for the records a
  // museum still mislabels: if the medium/technique text itself names a
  // non-painting material, reject it regardless of what the type field said.
  const NON_PAINTING_MEDIUM_PATTERN = /ceramic|porcelain|\bbronze\b|\bmarble\b|terra[- ]?cotta|pottery|stoneware|earthenware|\brelief\b|\bstatue\b|\bsculpture\b|glazed|\bclay\b|\bphotograph/i;

  function isLikelyNonPaintingMedium(text){
    return text ? NON_PAINTING_MEDIUM_PATTERN.test(text) : false;
  }

  const HEART_PATH = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

  const LOADING_LINES = [
    "layering paint…","mixing a batch of ultramarine…","waiting for the varnish to cure…",
    "stretching canvas over the frame…","blocking in the underpainting…","glazing thin coats over dry paint…",
    "figuring out the horizon lines…","cross-hatching the shadows…","biting the plate in acid…",
    "pulling a proof off the press…","registering the color layers…","carving the woodblock…",
    "wiping ink from the etching plate…","roughing out the marble block…","casting bronze in the foundry…",
    "firing the kiln…","wedging clay to remove air bubbles…","patinating the bronze…",
    "mounting the armature…","developing the negatives…","waiting in the darkroom…",
    "coating the paper in silver nitrate…","focusing the view camera…","hanging the artworks…",
    "leveling the frame…","adjusting the gallery lighting…","writing the wall text…",
    "measuring the sight lines…","dusting the plinths…","deciding what goes next to what…",
    "cataloguing the collection…","cleaning centuries of varnish…","checking humidity in the archive…",
    "repairing a torn canvas…","cross-referencing the provenance…","photographing the piece for the record…",
    "cutting the mat board…","fitting the glass…","leveling the picture wire…",
    "crating the piece for transport…","tracing the artist's influences…","comparing brushwork across the collection…",
    "reading the museum's catalogue notes…","squinting at the signature in the corner…",
    "checking three museums at once…","unpacking crates from three museums…"
  ];

