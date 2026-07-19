  const state = {
    screen: 'landing',
    mode: null,
    pool: [],
    usedKeys: new Set(),
    brokenKeys: new Set(), // images that failed to actually load — excluded from future picks
    health: 10,
    correctCount: 0,
    best: 0,
    current: null,
    answered: false,
    termCursor: 0,
    history: [],
    lastResult: null,
    // Time Attack
    masterClock: 60,
    taCorrect: 0,
    taSeen: 0,
    taBest: 0,
    taEnded: false,
    roundStartTs: 0,
    taTimers: { masterInterval: null, roundTimeout: null, advance: null },
    classicAdvanceTimer: null,
    // CAPTCHA
    captchaTarget: null,
    captchaTiles: [],
    captchaCorrect: 0,
    captchaWrongStreak: 0,
    captchaCleared: 0,
    captchaBest: 0,
    captchaMistakes: 0,
    captchaLocked: new Set(),
    dailyArt: null
  };

  const screenEl = document.getElementById('screen');

  function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }
  function formatScore(n){ return Number.isInteger(n) ? String(n) : n.toFixed(1); }

  function renderHeartsInto(el){
    let html = '';
    for(let i=0;i<10;i++){
      const remaining = Math.max(0, Math.min(1, state.health - i));
      const widthPx = (remaining*18).toFixed(1);
      html += `<span class="heart-slot">
        <svg viewBox="0 0 24 24"><path d="${HEART_PATH}" fill="rgba(0,0,0,0.15)"/></svg>
        <span class="heart-front-wrap" style="width:${widthPx}px">
          <svg viewBox="0 0 24 24" style="width:18px;height:16px;"><path d="${HEART_PATH}" fill="var(--heart)"/></svg>
        </span>
      </span>`;
    }
    el.innerHTML = html;
  }

