  // ---------------- SCREEN: MODES ----------------
  function renderModes(){
    clearTATimers();
    clearTimeout(state.classicAdvanceTimer);
    state.screen = 'modes';
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">select a mode</h2>
        <div class="mode-list" id="modeList"></div>
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    const list = document.getElementById('modeList');
    MODES.forEach(m => {
      const b = document.createElement('button');
      b.className = 'mode-item';
      b.disabled = !m.available;
      b.innerHTML = `
        <span class="mode-main">
          <span class="mode-name">${m.name}</span>
          ${m.desc ? `<span class="mode-desc">${m.desc}</span>` : ''}
        </span>
        ${!m.available ? '<span class="mode-tag">coming soon</span>' : ''}`;
      if(m.available) b.addEventListener('click', () => renderRules(m.id));
      list.appendChild(b);
    });
    document.getElementById('backBtn').addEventListener('click', renderLanding);
  }

  // ---------------- SCREEN: RULES ----------------
  function renderRules(modeId){
    state.screen = 'rules';
    state.mode = modeId;
    updateChrome();
    const rules = RULES[modeId];
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">${rules.title.toLowerCase()}</h2>
        <ul class="rules-list">${rules.items.map(i => `<li>${i}</li>`).join('')}</ul>
        <div class="rules-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
          <button class="btn btn-primary" id="beginBtn">begin</button>
        </div>
      </div>`;
    document.getElementById('backBtn').addEventListener('click', renderModes);
    document.getElementById('beginBtn').addEventListener('click', () => {
      if(state.mode === 'time') startGameTimeAttack();
      else if(state.mode === 'captcha') startGameCaptcha();
      else startGame();
    });
  }

  // ---------------- SCREEN: LOGIN ----------------
  function renderLogin(){
    let back;
    if(state.screen === 'modes') back = renderModes;
    else if(state.screen === 'rules') back = () => renderRules(state.mode);
    else if(state.screen === 'round' || state.screen === 'gameover' || state.screen === 'loading') back = renderModes;
    else back = renderLanding;

    state.screen = 'login';
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">sign up</h2>
        <p class="stage-body">accounts aren't live yet — your best score is saved on this device. once accounts launch, this is where you'll log in and keep your scores everywhere you play.</p>
        <button class="btn btn-ghost" id="backBtn">back</button>
      </div>`;
    document.getElementById('backBtn').addEventListener('click', back);
  }

  // ---------------- SCREEN: LOADING ----------------
  let loadingInterval = null;

  function stopLoadingMessages(){
    if(loadingInterval){ clearInterval(loadingInterval); loadingInterval = null; }
  }

  function renderLoading(){
    state.screen = 'loading';
    updateChrome();
    stopLoadingMessages();
    const lines = shuffle([...LOADING_LINES]);
    let i = 0;
    screenEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p id="loadingLine">${lines[0]}</p>
      </div>`;

    loadingInterval = setInterval(() => {
      i = (i + 1) % lines.length;
      const el = document.getElementById('loadingLine');
      if(el) el.textContent = lines[i];
    }, 1700);
  }

  function renderError(){
    stopLoadingMessages();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <p class="error-box">not enough public-domain artwork loaded</p>
        <button class="btn btn-ghost" id="backToModesBtn" style="margin-top:16px;">back</button>
      </div>`;
    document.getElementById('backToModesBtn').addEventListener('click', renderModes);
  }

